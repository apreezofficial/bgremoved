export type AppScreen = 'home' | 'editor' | 'export';

export type ToolType = 'erase' | 'restore' | 'magic_wand' | 'background';

export interface BrushSettings {
  size: number; // 5 to 100
  softness: number; // 0 (hard) to 1 (soft)
}

export interface MagicWandSettings {
  tolerance: number; // 0 to 100
}

export type BackgroundType = 'transparent' | 'color' | 'image';

export interface BackgroundConfig {
  type: BackgroundType;
  color: string; // hex
  customImageUrl?: string; // object URL or data URL
}

export interface CutoutTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number; // degrees
}

export interface RecentItem {
  id: string;
  timestamp: number;
  thumbnailDataUrl: string; // low-res preview
  originalDataUrl: string;
  resultDataUrl: string;
  width: number;
  height: number;
}

export interface InferenceProgress {
  stage: 'idle' | 'loading_model' | 'preprocessing' | 'inferring' | 'postprocessing' | 'done';
  percent: number; // 0 to 100
  message: string;
}

export type ExportFormat = 'png' | 'jpeg';
export type ExportTarget = 'object_only' | 'composed' | 'background_only';
