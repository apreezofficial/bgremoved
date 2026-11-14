import type { CSSProperties } from 'react';
import { BackgroundConfig } from '../types';

export function gradientCss(c: BackgroundConfig): string {
  return `linear-gradient(${c.angle ?? 135}deg, ${c.color}, ${c.color2 ?? '#5B9BEA'})`;
}

/** CSS for the live preview backdrop. */
export function bgStyle(c: BackgroundConfig): CSSProperties {
  if (c.type === 'color') return { backgroundColor: c.color };
  if (c.type === 'gradient') return { backgroundImage: gradientCss(c) };
  if (c.type === 'image' && c.customImageUrl)
    return { backgroundImage: `url(${c.customImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  return {};
}

/** Canvas equivalent of bgStyle, used for export so output matches the preview. */
export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, c: BackgroundConfig, img: HTMLImageElement | null) {
  if (c.type === 'color') {
    ctx.fillStyle = c.color;
    ctx.fillRect(0, 0, w, h);
  } else if (c.type === 'gradient') {
    const a = ((c.angle ?? 135) * Math.PI) / 180;
    const len = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
    const dx = (Math.sin(a) * len) / 2;
    const dy = (-Math.cos(a) * len) / 2;
    const g = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
    g.addColorStop(0, c.color);
    g.addColorStop(1, c.color2 ?? '#5B9BEA');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (c.type === 'image' && img) {
    const ia = img.naturalWidth / img.naturalHeight;
    let dw = w, dh = h;
    if (ia > w / h) dw = h * ia; else dh = w / ia;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
}
