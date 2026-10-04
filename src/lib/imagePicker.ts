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
        quality: 100,
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

  // Web / fallback file picker
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
        const dataUrl = reader.result as string;
        const dims = await getImageDimensions(dataUrl);
        resolve({
          dataUrl,
          width: dims.width,
          height: dims.height,
        });
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
