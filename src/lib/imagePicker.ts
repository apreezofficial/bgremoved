import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export interface PickedImage {
  dataUrl: string;
  width: number;
  height: number;
}

export async function pickImage(source: 'photos' | 'camera'): Promise<PickedImage | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        width: 1600,
        height: 1600,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      });

      if (!image.dataUrl) return null;
      const dims = await getImageDimensions(image.dataUrl);
      return {
        dataUrl: image.dataUrl,
        width: dims.width,
        height: dims.height,
      };
    } catch (err: any) {
      if (err.message?.includes('User cancelled') || err.message?.includes('cancel')) {
        return null;
      }
      console.warn('Native camera failed, falling back to file picker', err);
    }
  }

  // Web / fallback file picker with automatic fast downscaling for large uploads
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') {
      input.capture = 'environment';
    }

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const rawDataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1600;
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;

          if (w <= MAX_DIM && h <= MAX_DIM) {
            resolve({
              dataUrl: rawDataUrl,
              width: w,
              height: h,
            });
            return;
          }

          // Scale down huge camera / gallery photos to max 1600px for speed
          const scale = MAX_DIM / Math.max(w, h);
          const targetW = Math.round(w * scale);
          const targetH = Math.round(h * scale);
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          resolve({
            dataUrl,
            width: targetW,
            height: targetH,
          });
        };
        img.onerror = () => resolve(null);
        img.src = rawDataUrl;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };

    input.click();
  });
}

export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
