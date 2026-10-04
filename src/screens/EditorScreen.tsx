import React, { useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { CanvasEditor, CanvasEditorHandle } from '../components/CanvasEditor';
import {
  EraserIcon,
  BrushIcon,
  WandIcon,
  LayersIcon,
  UndoIcon,
  RedoIcon,
  ArrowLeftIcon,
  PhotoIcon,
  ResetIcon,
} from '../components/Icons';
import { pickImage } from '../lib/imagePicker';

const COLOR_PRESETS = [
  '#FFFFFF',
  '#000000',
  '#18181B',
  '#E11D48',
  '#2563EB',
  '#16A34A',
  '#D97706',
  '#9333EA',
  '#0D9488',
  '#475569',
];

export const EditorScreen: React.FC = () => {
  const {
    setScreen,
    activeTool,
    setActiveTool,
    brushSettings,
    setBrushSettings,
    magicWandSettings,
    setMagicWandSettings,
    backgroundConfig,
    setBackgroundConfig,
    cutoutTransform,
    setCutoutTransform,
    resetCutoutTransform,
    setCutoutImageUrl,
  } = useAppStore();

  const editorRef = useRef<CanvasEditorHandle>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const handlePickBgImage = async () => {
    const picked = await pickImage('photos');
    if (picked) {
      setBackgroundConfig({
        type: 'image',
        customImageUrl: picked.dataUrl,
      });
    }
  };

  const handleExportClick = () => {
    const canvas = editorRef.current?.getCutoutCanvas();
    if (canvas) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        setCutoutImageUrl(dataUrl);
      } catch {
        canvas.toBlob((blob) => {
          if (blob) setCutoutImageUrl(URL.createObjectURL(blob));
        }, 'image/png');
      }
    }
    setScreen('export');
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg text-fg select-none overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border z-20">
        <button
          onClick={() => setScreen('home')}
          aria-label="Back"
          className="p-2 rounded-btn hover:bg-card text-muted hover:text-fg transition-colors"
        >
          <ArrowLeftIcon size={20} />
        </button>

        {/* Undo / Redo controls */}
        <div className="flex items-center space-x-1 bg-card border border-border rounded-btn p-0.5">
          <button
            onClick={() => editorRef.current?.undo()}
            disabled={!canUndo}
            aria-label="Undo"
            className="p-1.5 rounded-btn hover:bg-surface text-muted hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <UndoIcon size={18} />
          </button>
          <button
            onClick={() => editorRef.current?.redo()}
            disabled={!canRedo}
            aria-label="Redo"
            className="p-1.5 rounded-btn hover:bg-surface text-muted hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <RedoIcon size={18} />
          </button>
        </div>

        {/* Export CTA */}
        <button
          onClick={handleExportClick}
          className="bg-accent text-accent-fg font-semibold text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-btn hover:bg-accent-hover transition-colors"
        >
          Export
        </button>
      </div>

      {/* Main Interactive Canvas Area */}
      <div className="flex-1 relative overflow-hidden bg-bg">
        <CanvasEditor
          ref={editorRef}
          onHistoryChange={(undoable, redoable) => {
            setCanUndo(undoable);
            setCanRedo(redoable);
          }}
        />
      </div>

      {/* Secondary Tool Parameter Strip */}
      <div className="bg-surface/95 border-t border-border px-4 py-2.5 z-20 flex flex-col space-y-2">
        {(activeTool === 'erase' || activeTool === 'restore') && (
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted">
              <span>SIZE: {brushSettings.size}px</span>
              <span>SOFTNESS: {Math.round(brushSettings.softness * 100)}%</span>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min={6}
                max={120}
                value={brushSettings.size}
                onChange={(e) => setBrushSettings({ size: Number(e.target.value) })}
                className="w-full h-1.5 bg-card accent-accent rounded-lg cursor-pointer"
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={brushSettings.softness}
                onChange={(e) => setBrushSettings({ softness: Number(e.target.value) })}
                className="w-full h-1.5 bg-card accent-accent rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}

        {activeTool === 'magic_wand' && (
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted">
              <span>MAGIC WAND TOLERANCE</span>
              <span>{magicWandSettings.tolerance}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={magicWandSettings.tolerance}
              onChange={(e) => setMagicWandSettings({ tolerance: Number(e.target.value) })}
              className="w-full h-1.5 bg-card accent-accent rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-muted text-center font-mono">Tap any contiguous color area on image to erase</p>
          </div>
        )}

        {activeTool === 'background' && (
          <div className="flex flex-col space-y-3">
            {/* Background type tabs */}
            <div className="flex items-center justify-between space-x-2">
              <button
                onClick={() => setBackgroundConfig({ type: 'transparent' })}
                className={`flex-1 py-1.5 text-xs font-mono rounded-btn border transition-colors ${
                  backgroundConfig.type === 'transparent'
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : 'border-border bg-card text-muted hover:text-fg'
                }`}
              >
                Transparent
              </button>
              <button
                onClick={() => setBackgroundConfig({ type: 'color' })}
                className={`flex-1 py-1.5 text-xs font-mono rounded-btn border transition-colors ${
                  backgroundConfig.type === 'color'
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : 'border-border bg-card text-muted hover:text-fg'
                }`}
              >
                Solid Color
              </button>
              <button
                onClick={handlePickBgImage}
                className={`flex-1 py-1.5 text-xs font-mono rounded-btn border flex items-center justify-center space-x-1 transition-colors ${
                  backgroundConfig.type === 'image'
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : 'border-border bg-card text-muted hover:text-fg'
                }`}
              >
                <PhotoIcon size={14} />
                <span>Gallery</span>
              </button>
            </div>

            {/* Color palette presets if color selected */}
            {backgroundConfig.type === 'color' && (
              <div className="flex items-center space-x-2 overflow-x-auto py-1 scrollbar-none">
                <input
                  type="color"
                  value={backgroundConfig.color}
                  onChange={(e) => setBackgroundConfig({ color: e.target.value })}
                  className="w-8 h-8 rounded-btn border border-border cursor-pointer bg-transparent p-0 flex-shrink-0"
                />
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBackgroundConfig({ color: c })}
                    className={`w-7 h-7 rounded-btn border flex-shrink-0 transition-transform ${
                      backgroundConfig.color === c ? 'border-accent scale-110' : 'border-border'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}

            {/* Cutout transform controls (scale & rotate) */}
            <div className="flex items-center space-x-3 pt-1 border-t border-border/50 text-[11px] font-mono text-muted">
              <div className="flex-1 flex flex-col space-y-1">
                <span>SCALE: {cutoutTransform.scale.toFixed(2)}x</span>
                <input
                  type="range"
                  min={0.3}
                  max={3.0}
                  step={0.05}
                  value={cutoutTransform.scale}
                  onChange={(e) => setCutoutTransform({ scale: Number(e.target.value) })}
                  className="w-full h-1 bg-card accent-accent rounded-lg cursor-pointer"
                />
              </div>
              <div className="flex-1 flex flex-col space-y-1">
                <span>ROTATE: {Math.round(cutoutTransform.rotation)}°</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={cutoutTransform.rotation}
                  onChange={(e) => setCutoutTransform({ rotation: Number(e.target.value) })}
                  className="w-full h-1 bg-card accent-accent rounded-lg cursor-pointer"
                />
              </div>
              <button
                onClick={resetCutoutTransform}
                title="Reset Position"
                className="p-1.5 rounded-btn bg-card border border-border hover:text-accent transition-colors self-end"
              >
                <ResetIcon size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Primary Bottom Thumb Toolbar */}
      <div className="grid grid-cols-4 bg-card border-t border-border px-2 py-2 safe-bottom z-20">
        <button
          onClick={() => setActiveTool('erase')}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-btn transition-colors ${
            activeTool === 'erase' ? 'bg-surface text-accent border border-border' : 'text-muted hover:text-fg'
          }`}
        >
          <EraserIcon size={20} />
          <span className="text-[10px] font-mono mt-1 font-medium">Erase</span>
        </button>

        <button
          onClick={() => setActiveTool('restore')}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-btn transition-colors ${
            activeTool === 'restore' ? 'bg-surface text-accent border border-border' : 'text-muted hover:text-fg'
          }`}
        >
          <BrushIcon size={20} />
          <span className="text-[10px] font-mono mt-1 font-medium">Restore</span>
        </button>

        <button
          onClick={() => setActiveTool('magic_wand')}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-btn transition-colors ${
            activeTool === 'magic_wand' ? 'bg-surface text-accent border border-border' : 'text-muted hover:text-fg'
          }`}
        >
          <WandIcon size={20} />
          <span className="text-[10px] font-mono mt-1 font-medium">Wand</span>
        </button>

        <button
          onClick={() => setActiveTool('background')}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-btn transition-colors ${
            activeTool === 'background' ? 'bg-surface text-accent border border-border' : 'text-muted hover:text-fg'
          }`}
        >
          <LayersIcon size={20} />
          <span className="text-[10px] font-mono mt-1 font-medium">Backdrop</span>
        </button>
      </div>
    </div>
  );
};
