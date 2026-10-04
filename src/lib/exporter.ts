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
  } = options;

  const width = cutoutCanvas.width;
  const height = cutoutCanvas.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. If target is 'object_only'
  if (target === 'object_only') {
    ctx.drawImage(cutoutCanvas, 0, 0);
  } else if (target === 'background_only') {
    // Render only background
    renderBackground(ctx, width, height, backgroundConfig, backgroundImage);
  } else {
    // 2. 'composed' target
    // Step A: Draw background
    renderBackground(ctx, width, height, backgroundConfig, backgroundImage);

    // Step B: Draw transformed cutout
    ctx.save();
    // Center of canvas
    const cx = width / 2;
    const cy = height / 2;

    ctx.translate(cx + transform.x, cy + transform.y);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scale, transform.scale);
    ctx.drawImage(cutoutCanvas, -cx, -cy);
    ctx.restore();
  }

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(mimeType, quality);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to encode image to blob'));
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

export async function saveToDevice(dataUrl: string, filename: string): Promise<string> {
  const base64Data = dataUrl.split(',')[1];

  if (Capacitor.isNativePlatform()) {
    try {
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

  // Web download fallback
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return filename;
}

export async function shareImage(dataUrl: string, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = dataUrl.split(',')[1];
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
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: blob.type });
      await navigator.share({
        title: 'bgremoved',
        files: [file],
      });
      return;
    } catch (err) {
      console.warn('Web share failed', err);
    }
  }

  // Fallback: trigger download
  await saveToDevice(dataUrl, filename);
}
