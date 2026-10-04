import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { composeAndRender, saveToDevice, shareImage } from '../lib/exporter';
import { ExportFormat, ExportTarget } from '../types';
import {
  ArrowLeftIcon,
  DownloadIcon,
  ShareIcon,
  CheckIcon,
} from '../components/Icons';

export const ExportScreen: React.FC = () => {
  const {
    setScreen,
    cutoutImageUrl,
    backgroundConfig,
    cutoutTransform,
  } = useAppStore();

  const [target, setTarget] = useState<ExportTarget>('composed');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality] = useState<number>(0.92);
  const [previewUrl, setPreviewUrl] = useState<string | null>(cutoutImageUrl);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const cutoutImgRef = useRef<HTMLImageElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const [, setLoadVersion] = useState<number>(0);

  // 1. Load cutout image once
  useEffect(() => {
    if (!cutoutImageUrl) return;
    const img = new Image();
    img.onload = () => {
      cutoutImgRef.current = img;
      setLoadVersion((v) => v + 1);
    };
    img.src = cutoutImageUrl;
  }, [cutoutImageUrl]);

  // 2. Load background image if set
  useEffect(() => {
    if (backgroundConfig.type === 'image' && backgroundConfig.customImageUrl) {
      const bg = new Image();
      bg.onload = () => {
        bgImgRef.current = bg;
        setLoadVersion((v) => v + 1);
      };
      bg.src = backgroundConfig.customImageUrl;
    } else {
      bgImgRef.current = null;
      setLoadVersion((v) => v + 1);
    }
  }, [backgroundConfig.customImageUrl, backgroundConfig.type]);

  // 3. Render fast live preview whenever settings change
  useEffect(() => {
    if (!cutoutImgRef.current) return;
    const cutoutImg = cutoutImgRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = cutoutImg.naturalWidth || cutoutImg.width;
    canvas.height = cutoutImg.naturalHeight || cutoutImg.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(cutoutImg, 0, 0);

    const effectiveFormat: ExportFormat = target === 'object_only' ? 'png' : format;

    composeAndRender({
      target,
      format: effectiveFormat,
      quality,
      cutoutCanvas: canvas,
      originalImage: null,
      backgroundImage: bgImgRef.current,
      backgroundConfig,
      transform: cutoutTransform,
      maxDimension: 500,
    }).then((rendered) => {
      setPreviewUrl(rendered.dataUrl);
    });
  }, [target, format, quality, backgroundConfig, cutoutTransform, cutoutImageUrl]);

  const handleSave = async () => {
    if (!cutoutImgRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const cutoutImg = cutoutImgRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = cutoutImg.naturalWidth || cutoutImg.width;
      canvas.height = cutoutImg.naturalHeight || cutoutImg.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(cutoutImg, 0, 0);

      const effectiveFormat: ExportFormat = target === 'object_only' ? 'png' : format;

      // Full-resolution export on demand
      const rendered = await composeAndRender({
        target,
        format: effectiveFormat,
        quality,
        cutoutCanvas: canvas,
        originalImage: null,
        backgroundImage: bgImgRef.current,
        backgroundConfig,
        transform: cutoutTransform,
      });

      const ext = effectiveFormat === 'jpeg' ? 'jpg' : 'png';
      const filename = `bgremoved_${Date.now()}.${ext}`;
      await saveToDevice(rendered.blob, rendered.dataUrl, filename);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert('Failed to save image: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (!cutoutImgRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const cutoutImg = cutoutImgRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = cutoutImg.naturalWidth || cutoutImg.width;
      canvas.height = cutoutImg.naturalHeight || cutoutImg.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(cutoutImg, 0, 0);

      const effectiveFormat: ExportFormat = target === 'object_only' ? 'png' : format;

      // Full-resolution export on demand
      const rendered = await composeAndRender({
        target,
        format: effectiveFormat,
        quality,
        cutoutCanvas: canvas,
        originalImage: null,
        backgroundImage: bgImgRef.current,
        backgroundConfig,
        transform: cutoutTransform,
      });

      const ext = effectiveFormat === 'jpeg' ? 'jpg' : 'png';
      const filename = `bgremoved_${Date.now()}.${ext}`;
      await shareImage(rendered.blob, rendered.dataUrl, filename);
    } catch (err: any) {
      alert('Failed to share: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg text-fg select-none overflow-y-auto px-4 py-4 safe-top safe-bottom">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setScreen('editor')}
          className="p-2 rounded-btn hover:bg-card text-muted hover:text-fg transition-colors"
        >
          <ArrowLeftIcon size={20} />
        </button>
        <h2 className="text-sm font-semibold tracking-wider uppercase text-fg font-mono">Export Cutout</h2>
        <div className="w-8" />
      </div>

      {/* Live Preview Box */}
      <div className="relative aspect-square max-h-[46vh] w-full bg-card border border-border rounded-btn overflow-hidden flex items-center justify-center mb-6">
        <div className="absolute inset-0 bg-checkerboard opacity-60" />
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Export preview"
            className="relative z-10 max-h-full max-w-full object-contain p-2"
          />
        ) : (
          <span className="relative z-10 text-xs font-mono text-muted">Generating export preview...</span>
        )}
      </div>

      {/* Target Options */}
      <div className="flex flex-col space-y-4 mb-6">
        <div>
          <label className="text-xs font-mono text-muted uppercase tracking-wider block mb-2">Export Content</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setTarget('composed')}
              className={`py-2 px-2 text-xs font-mono rounded-btn border text-center transition-colors ${
                target === 'composed'
                  ? 'border-accent bg-accent/10 text-accent font-semibold'
                  : 'border-border bg-card text-muted hover:text-fg'
              }`}
            >
              Composed
            </button>
            <button
              onClick={() => setTarget('object_only')}
              className={`py-2 px-2 text-xs font-mono rounded-btn border text-center transition-colors ${
                target === 'object_only'
                  ? 'border-accent bg-accent/10 text-accent font-semibold'
                  : 'border-border bg-card text-muted hover:text-fg'
              }`}
            >
              Object Only
            </button>
            <button
              onClick={() => setTarget('background_only')}
              className={`py-2 px-2 text-xs font-mono rounded-btn border text-center transition-colors ${
                target === 'background_only'
                  ? 'border-accent bg-accent/10 text-accent font-semibold'
                  : 'border-border bg-card text-muted hover:text-fg'
              }`}
            >
              Backdrop
            </button>
          </div>
        </div>

        {/* Format Options */}
        {target !== 'object_only' && (
          <div>
            <label className="text-xs font-mono text-muted uppercase tracking-wider block mb-2">File Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFormat('png')}
                className={`py-2 px-2 text-xs font-mono rounded-btn border text-center transition-colors ${
                  format === 'png'
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : 'border-border bg-card text-muted hover:text-fg'
                }`}
              >
                PNG (Lossless)
              </button>
              <button
                onClick={() => setFormat('jpeg')}
                className={`py-2 px-2 text-xs font-mono rounded-btn border text-center transition-colors ${
                  format === 'jpeg'
                    ? 'border-accent bg-accent/10 text-accent font-semibold'
                    : 'border-border bg-card text-muted hover:text-fg'
                }`}
              >
                JPG (Smaller)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-auto flex flex-col space-y-3 pt-2">
        <button
          onClick={handleSave}
          disabled={isExporting || !previewUrl}
          className="w-full flex items-center justify-center space-x-2 bg-accent text-accent-fg py-3.5 px-6 rounded-btn font-semibold text-sm tracking-tight hover:bg-accent-hover active:scale-[0.99] transition-all duration-fast disabled:opacity-50"
        >
          {isExporting ? (
            <span>Exporting...</span>
          ) : savedSuccess ? (
            <>
              <CheckIcon size={18} />
              <span>Saved to Gallery!</span>
            </>
          ) : (
            <>
              <DownloadIcon size={18} />
              <span>Save to Device</span>
            </>
          )}
        </button>

        <button
          onClick={handleShare}
          disabled={isExporting || !previewUrl}
          className="w-full flex items-center justify-center space-x-2 bg-card hover:bg-surface border border-border text-fg py-3 px-6 rounded-btn font-medium text-sm tracking-tight active:scale-[0.99] transition-all duration-fast disabled:opacity-50"
        >
          {isExporting ? (
            <span>Preparing...</span>
          ) : (
            <>
              <ShareIcon size={18} className="text-muted" />
              <span>Share</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
