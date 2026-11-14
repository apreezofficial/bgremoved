import { create } from 'zustand';
import { BackgroundConfig, BrushSettings, InferenceProgress, RecentItem, ToolType } from '../types';

interface AppState {
  name: string;
  originalUrl: string | null;
  cutoutUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  setImage: (name: string, orig: string, cutout: string, w: number, h: number) => void;
  clearImage: () => void;

  isProcessing: boolean;
  progress: InferenceProgress;
  setIsProcessing: (v: boolean) => void;
  setProgress: (p: InferenceProgress) => void;

  tool: ToolType;
  setTool: (t: ToolType) => void;
  brush: BrushSettings;
  setBrush: (b: Partial<BrushSettings>) => void;
  wandTolerance: number;
  setWandTolerance: (n: number) => void;

  bg: BackgroundConfig;
  setBg: (b: Partial<BackgroundConfig>) => void;

  zoom: number; // 1 = fit to stage
  setZoom: (z: number) => void;

  recents: RecentItem[];
  setRecents: (r: RecentItem[]) => void;
  addRecent: (r: RecentItem) => void;
  removeRecent: (id: string) => void;
}

const DEFAULT_BG: BackgroundConfig = { type: 'transparent', color: '#F91AC3', color2: '#5B9BEA', angle: 135 };

export const useAppStore = create<AppState>((set) => ({
  name: 'untitled',
  originalUrl: null,
  cutoutUrl: null,
  imageWidth: 0,
  imageHeight: 0,
  setImage: (name, originalUrl, cutoutUrl, imageWidth, imageHeight) =>
    set({ name, originalUrl, cutoutUrl, imageWidth, imageHeight, zoom: 1, bg: { ...DEFAULT_BG }, tool: 'bg' }),
  clearImage: () => set({ originalUrl: null, cutoutUrl: null, imageWidth: 0, imageHeight: 0 }),

  isProcessing: false,
  progress: { stage: 'idle', percent: 0, message: '' },
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setProgress: (progress) => set({ progress }),

  tool: 'bg',
  setTool: (tool) => set({ tool }),
  brush: { size: 40, softness: 0.2 },
  setBrush: (b) => set((s) => ({ brush: { ...s.brush, ...b } })),
  wandTolerance: 32,
  setWandTolerance: (wandTolerance) => set({ wandTolerance }),

  bg: { ...DEFAULT_BG },
  setBg: (b) => set((s) => ({ bg: { ...s.bg, ...b } })),

  zoom: 1,
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(4, zoom)) }),

  recents: [],
  setRecents: (recents) => set({ recents }),
  addRecent: (item) => set((s) => ({ recents: [item, ...s.recents.filter((r) => r.id !== item.id)].slice(0, 30) })),
  removeRecent: (id) => set((s) => ({ recents: s.recents.filter((r) => r.id !== id) })),
}));
