import { create } from 'zustand';
import {
  AppScreen,
  ToolType,
  BrushSettings,
  MagicWandSettings,
  BackgroundConfig,
  CutoutTransform,
  RecentItem,
  InferenceProgress,
} from '../types';

interface AppState {
  // Navigation
  screen: AppScreen;
  setScreen: (screen: AppScreen) => void;

  // Active images
  originalImageUrl: string | null;
  cutoutImageUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  setImages: (orig: string, cutout: string, w: number, h: number) => void;
  setCutoutImageUrl: (url: string) => void;

  // Inference state
  isProcessing: boolean;
  progress: InferenceProgress;
  setIsProcessing: (loading: boolean) => void;
  setProgress: (progress: InferenceProgress) => void;

  // Tools
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  brushSettings: BrushSettings;
  setBrushSettings: (settings: Partial<BrushSettings>) => void;
  magicWandSettings: MagicWandSettings;
  setMagicWandSettings: (settings: Partial<MagicWandSettings>) => void;

  // Background
  backgroundConfig: BackgroundConfig;
  setBackgroundConfig: (config: Partial<BackgroundConfig>) => void;
  cutoutTransform: CutoutTransform;
  setCutoutTransform: (transform: Partial<CutoutTransform> | ((prev: CutoutTransform) => CutoutTransform)) => void;
  resetCutoutTransform: () => void;

  // Recents
  recents: RecentItem[];
  setRecents: (items: RecentItem[]) => void;
  addRecent: (item: RecentItem) => void;
  removeRecent: (id: string) => void;

  // Reset editor
  resetEditor: () => void;
}

const DEFAULT_TRANSFORM: CutoutTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};

export const useAppStore = create<AppState>((set) => ({
  screen: 'home',
  setScreen: (screen) => set({ screen }),

  originalImageUrl: null,
  cutoutImageUrl: null,
  imageWidth: 0,
  imageHeight: 0,
  setImages: (orig, cutout, w, h) =>
    set({
      originalImageUrl: orig,
      cutoutImageUrl: cutout,
      imageWidth: w,
      imageHeight: h,
      cutoutTransform: { ...DEFAULT_TRANSFORM },
    }),
  setCutoutImageUrl: (url) => set({ cutoutImageUrl: url }),

  isProcessing: false,
  progress: {
    stage: 'idle',
    percent: 0,
    message: '',
  },
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setProgress: (progress) => set({ progress }),

  activeTool: 'erase',
  setActiveTool: (activeTool) => set({ activeTool }),
  brushSettings: {
    size: 28,
    softness: 0.2,
  },
  setBrushSettings: (settings) =>
    set((state) => ({ brushSettings: { ...state.brushSettings, ...settings } })),

  magicWandSettings: {
    tolerance: 32,
  },
  setMagicWandSettings: (settings) =>
    set((state) => ({ magicWandSettings: { ...state.magicWandSettings, ...settings } })),

  backgroundConfig: {
    type: 'transparent',
    color: '#FFFFFF',
    customImageUrl: undefined,
  },
  setBackgroundConfig: (config) =>
    set((state) => ({ backgroundConfig: { ...state.backgroundConfig, ...config } })),

  cutoutTransform: { ...DEFAULT_TRANSFORM },
  setCutoutTransform: (transform) =>
    set((state) => ({
      cutoutTransform:
        typeof transform === 'function' ? transform(state.cutoutTransform) : { ...state.cutoutTransform, ...transform },
    })),
  resetCutoutTransform: () => set({ cutoutTransform: { ...DEFAULT_TRANSFORM } }),

  recents: [],
  setRecents: (recents) => set({ recents }),
  addRecent: (item) =>
    set((state) => ({
      recents: [item, ...state.recents.filter((r) => r.id !== item.id)].slice(0, 30),
    })),
  removeRecent: (id) =>
    set((state) => ({
      recents: state.recents.filter((r) => r.id !== id),
    })),

  resetEditor: () =>
    set({
      originalImageUrl: null,
      cutoutImageUrl: null,
      imageWidth: 0,
      imageHeight: 0,
      activeTool: 'erase',
      cutoutTransform: { ...DEFAULT_TRANSFORM },
      backgroundConfig: {
        type: 'transparent',
        color: '#FFFFFF',
        customImageUrl: undefined,
      },
      isProcessing: false,
      progress: {
        stage: 'idle',
        percent: 0,
        message: '',
      },
    }),
}));
