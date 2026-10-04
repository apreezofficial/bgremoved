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
    originalWidth = imageSource.width;
    originalHeight = imageSource.height;
  }

  // Draw onto canvas to extract full-res ImageData
  const canvas = document.createElement('canvas');
  canvas.width = originalWidth;
  canvas.height = originalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  let origImageData: ImageData;
  if (imageSource instanceof ImageData) {
    origImageData = imageSource;
    ctx.putImageData(imageSource, 0, 0);
  } else {
    ctx.drawImage(imageSource, 0, 0);
    origImageData = ctx.getImageData(0, 0, originalWidth, heightFromWidth(imageSource));
  }

  const id = Math.random().toString(36).substring(2, 9);

  return new Promise((resolve, reject) => {
    const messageHandler = (e: MessageEvent) => {
      const { type, id: msgId, stage, percent, message, resultImageData, error } = e.data;

      if (type === 'PROGRESS' && (!msgId || msgId === id)) {
        onProgress?.({
          stage: stage || 'inferring',
          percent: percent || 0,
          message: message || '',
        });
      } else if (type === 'SUCCESS' && msgId === id) {
        w.removeEventListener('message', messageHandler);

        // Put result to canvas to convert to PNG blob
        const resCanvas = document.createElement('canvas');
        resCanvas.width = resultImageData.width;
        resCanvas.height = resultImageData.height;
        const resCtx = resCanvas.getContext('2d')!;
        resCtx.putImageData(resultImageData, 0, 0);

        resCanvas.toBlob((blob) => {
          if (blob) {
            resolve({
              resultImageData,
              width: resultImageData.width,
              height: resultImageData.height,
              blob,
            });
          } else {
            reject(new Error('Failed to create Blob from canvas'));
          }
        }, 'image/png');
      } else if (type === 'ERROR' && (!msgId || msgId === id)) {
        w.removeEventListener('message', messageHandler);
        reject(new Error(error || 'Background removal failed'));
      }
    };

    w.addEventListener('message', messageHandler);

    // Send to worker
    w.postMessage(
      {
        type: 'PROCESS',
        id,
        imageData: origImageData,
        width: originalWidth,
        height: originalHeight,
      },
      [origImageData.data.buffer]
    );
  });
}

function heightFromWidth(source: HTMLImageElement | ImageBitmap): number {
  return source.height;
}
