import { InferenceProgress } from '../types';

let worker: Worker | null = null;
let isWorkerReady = false;
let initPromise: Promise<void> | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/remover.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
}

export function initWorker(): Promise<void> {
  if (isWorkerReady) return Promise.resolve();
  if (initPromise) return initPromise;

  const w = getWorker();
  initPromise = new Promise((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'INIT_DONE') {
        isWorkerReady = true;
        w.removeEventListener('message', handler);
        resolve();
      } else if (e.data.type === 'ERROR') {
        w.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ type: 'INIT' });
  });

  return initPromise;
}

export async function removeBackground(
  imageSource: HTMLImageElement | ImageBitmap | ImageData,
  onProgress?: (progress: InferenceProgress) => void
): Promise<{ resultImageData: ImageData; width: number; height: number; blob: Blob }> {
  await initWorker();
  const w = getWorker();

  // Determine original dimensions
  let originalWidth = 0;
  let originalHeight = 0;
  if (imageSource instanceof ImageData) {
    originalWidth = imageSource.width;
    originalHeight = imageSource.height;
  } else {
    originalWidth = (imageSource as any).naturalWidth || imageSource.width;
    originalHeight = (imageSource as any).naturalHeight || imageSource.height;
  }

  // Draw 320x320 small version directly for U2-Netp (hardware accelerated)
  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = 320;
  smallCanvas.height = 320;
  const smallCtx = smallCanvas.getContext('2d', { willReadFrequently: true })!;

  if (imageSource instanceof ImageData) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalWidth;
    tempCanvas.height = originalHeight;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageSource, 0, 0);
    smallCtx.drawImage(tempCanvas, 0, 0, 320, 320);
  } else {
    smallCtx.drawImage(imageSource, 0, 0, 320, 320);
  }

  const smallImageData = smallCtx.getImageData(0, 0, 320, 320);
  const id = Math.random().toString(36).substring(2, 9);

  return new Promise((resolve, reject) => {
    const messageHandler = (e: MessageEvent) => {
      const { type, id: msgId, stage, percent, message, maskAlpha, targetSize = 320, error } = e.data;

      if (type === 'PROGRESS' && (!msgId || msgId === id)) {
        onProgress?.({
          stage: stage || 'inferring',
          percent: percent || 0,
          message: message || '',
        });
      } else if (type === 'SUCCESS_MASK' && msgId === id) {
        w.removeEventListener('message', messageHandler);

        try {
          // 1. Create mask canvas
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = targetSize;
          maskCanvas.height = targetSize;
          const maskCtx = maskCanvas.getContext('2d')!;
          const maskImgData = maskCtx.createImageData(targetSize, targetSize);
          const maskPixels = maskImgData.data;

          for (let i = 0; i < maskAlpha.length; i++) {
            const idx = i * 4;
            maskPixels[idx] = 0;
            maskPixels[idx + 1] = 0;
            maskPixels[idx + 2] = 0;
            maskPixels[idx + 3] = maskAlpha[i];
          }
          maskCtx.putImageData(maskImgData, 0, 0);

          // 2. Hardware-accelerated GPU masking
          const resCanvas = document.createElement('canvas');
          resCanvas.width = originalWidth;
          resCanvas.height = originalHeight;
          const resCtx = resCanvas.getContext('2d', { willReadFrequently: true })!;

          if (imageSource instanceof ImageData) {
            resCtx.putImageData(imageSource, 0, 0);
          } else {
            resCtx.drawImage(imageSource, 0, 0, originalWidth, originalHeight);
          }

          resCtx.imageSmoothingEnabled = true;
          resCtx.imageSmoothingQuality = 'high';
          resCtx.globalCompositeOperation = 'destination-in';
          resCtx.drawImage(maskCanvas, 0, 0, originalWidth, originalHeight);

          const resultImageData = resCtx.getImageData(0, 0, originalWidth, originalHeight);

          resCanvas.toBlob((blob) => {
            if (blob) {
              resolve({
                resultImageData,
                width: originalWidth,
                height: originalHeight,
                blob,
              });
            } else {
              reject(new Error('Failed to create Blob from canvas'));
            }
          }, 'image/png');
        } catch (err) {
          reject(err);
        }
      } else if (type === 'ERROR' && (!msgId || msgId === id)) {
        w.removeEventListener('message', messageHandler);
        reject(new Error(error || 'Background removal failed'));
      }
    };

    w.addEventListener('message', messageHandler);

    // Send small 320x320 image to worker (only ~400KB!)
    w.postMessage(
      {
        type: 'PROCESS',
        id,
        smallImageData,
      },
      [smallImageData.data.buffer]
    );
  });
}
