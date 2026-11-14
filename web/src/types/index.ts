export type ToolType = 'bg' | 'erase' | 'brush' | 'wand' | 'crop' | 'rotate' | 'flip' | 'pan' | 'zoom';

export interface BrushSettings { size: number; softness: number }

export type BackgroundType = 'transparent' | 'color' | 'gradient' | 'image';

export interface BackgroundConfig {
  type: BackgroundType;
  color: string;
  color2?: string;
  angle?: number;
  customImageUrl?: string;
}

export interface RecentItem {
  id: string;
  timestamp: number;
  thumbnailDataUrl: string;
  originalDataUrl: string;
  resultDataUrl: string;
  width: number;
  height: number;
}

export interface InferenceProgress {
  stage: 'idle' | 'loading_model' | 'preprocessing' | 'inferring' | 'postprocessing' | 'done';
  percent: number;
  message: string;
}

export type ExportFormat = 'png' | 'jpeg';
export type ExportTarget = 'composed' | 'cutout' | 'backdrop';
