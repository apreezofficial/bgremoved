export interface PickedImage {
  dataUrl: string;
  width: number;
  height: number;
  name: string;
}

const MAX_DIM = 2048;

export function fileToPicked(file: File): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(null);
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const raw = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w <= MAX_DIM && h <= MAX_DIM) return resolve({ dataUrl: raw, width: w, height: h, name: file.name });
        const s = MAX_DIM / Math.max(w, h);
        const tw = Math.round(w * s);
        const th = Math.round(h * s);
        const c = document.createElement('canvas');
        c.width = tw;
        c.height = th;
        c.getContext('2d')!.drawImage(img, 0, 0, tw, th);
        resolve({ dataUrl: c.toDataURL('image/png'), width: tw, height: th, name: file.name });
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

export function pickImage(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? await fileToPicked(f) : null);
    };
    input.click();
  });
}
