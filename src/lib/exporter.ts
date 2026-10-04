import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { BackgroundConfig, CutoutTransform, ExportFormat, ExportTarget } from '../types';

export interface ExportOptions {
  target: ExportTarget;
  format: ExportFormat;
  quality?: number; // 0.0 to 1.0 (for JPEG)
  cutoutCanvas: HTMLCanvasElement;
  originalImage: HTMLImageElement | null;
  backgroundImage: HTMLImageElement | null;
  backgroundConfig: BackgroundConfig;
  transform: CutoutTransform;
  maxDimension?: number;
}

export async function composeAndRender(options: ExportOptions): Promise<{ dataUrl: string; blob: Blob }> {
  const {
    target,
    format,
    quality = 0.92,
    cutoutCanvas,
    backgroundImage,
    backgroundConfig,
    transform,
    maxDimension,
  } = options;

  let width = cutoutCanvas.width;
  let height = cutoutCanvas.height;

  // If maxDimension is set (e.g. for instant live preview), scale down canvas
  const origWidth = width;
  const origHeight = height;
  if (maxDimension && (width > maxDimension || height > maxDimension)) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const scaleRatio = width / origWidth;

  // 1. If target is 'object_only'
  if (target === 'object_only') {
    ctx.drawImage(cutoutCanvas, 0, 0, width, height);
  } else if (target === 'background_only') {
    // Render only background
    renderBackground(ctx, width, height, backgroundConfig, backgroundImage);
  } else {
    // 2. 'composed' target
    // Step A: Draw background
    renderBackground(ctx, width, height, backgroundConfig, backgroundImage);

    // Step B: Draw transformed cutout
    ctx.save();
    const cx = width / 2;
    const cy = height / 2;

    ctx.translate(cx + transform.x * scaleRatio, cy + transform.y * scaleRatio);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scale * scaleRatio, transform.scale * scaleRatio);
    ctx.drawImage(cutoutCanvas, -origWidth / 2, -origHeight / 2, origWidth, origHeight);
    ctx.restore();
  }

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

  // For small preview canvases, toDataURL is instant.
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to encode image to blob'));
        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve({ dataUrl, blob });
      },
      mimeType,
      quality
    );
  });
}

function renderBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: BackgroundConfig,
  bgImg: HTMLImageElement | null
) {
  if (config.type === 'color') {
    ctx.fillStyle = config.color;
    ctx.fillRect(0, 0, width, height);
  } else if (config.type === 'image' && bgImg) {
    // Aspect fill image
    const bgAspect = bgImg.naturalWidth / bgImg.naturalHeight;
    const canvasAspect = width / height;
    let drawW = width;
    let drawH = height;
    let offsetX = 0;
    let offsetY = 0;

    if (bgAspect > canvasAspect) {
      drawW = height * bgAspect;
      offsetX = (width - drawW) / 2;
    } else {
      drawH = width / bgAspect;
      offsetY = (height - drawH) / 2;
    }
    ctx.drawImage(bgImg, offsetX, offsetY, drawW, drawH);
  } else {
    // Transparent - clear rect
    ctx.clearRect(0, 0, width, height);
  }
}

export async function saveToDevice(blob: Blob, dataUrl: string, filename: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
      return result.uri;
    } catch (err: any) {
      console.error('Failed to save via Filesystem', err);
      throw err;
    }
  }

  // Web download fallback: blob URL is lightning fast and memory efficient
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return filename;
}

export async function shareImage(blob: Blob, dataUrl: string, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: 'Share Cutout',
        url: saved.uri,
        dialogTitle: 'Share with',
      });
      return;
    } catch (err: any) {
      console.warn('Native share failed', err);
    }
  }

  // Web share API if supported
  if (navigator.share) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'bgremoved',
          files: [file],
        });
        return;
      }
    } catch (err) {
      console.warn('Web share failed', err);
    }
  }

  // Fallback: trigger download
  await saveToDevice(blob, dataUrl, filename);
}
