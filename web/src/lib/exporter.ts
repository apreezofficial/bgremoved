import { BackgroundConfig, ExportFormat, ExportTarget } from '../types';
import { drawBackground } from './background';

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('image failed to load'));
    i.src = url;
  });
}

export async function composeImage(o: {
  target: ExportTarget;
  format: ExportFormat;
  cutoutCanvas: HTMLCanvasElement;
  bg: BackgroundConfig;
}): Promise<Blob> {
  const { width: w, height: h } = o.cutoutCanvas;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const mime = o.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  if (o.format === 'jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  const img = o.bg.type === 'image' && o.bg.customImageUrl ? await loadImage(o.bg.customImageUrl) : null;
  if (o.target !== 'cutout') drawBackground(ctx, w, h, o.bg, img);
  if (o.target !== 'backdrop') ctx.drawImage(o.cutoutCanvas, 0, 0);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), mime, 0.92));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
