import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useAppStore } from '../store/useAppStore';
import { applyMagicWand } from '../lib/magicWand';

export interface CanvasEditorHandle {
  getCutoutCanvas: () => HTMLCanvasElement | null;
  getBackgroundImage: () => HTMLImageElement | null;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  resetView: () => void;
}

interface CanvasEditorProps {
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

const MAX_HISTORY = 30;

export const CanvasEditor = forwardRef<CanvasEditorHandle, CanvasEditorProps>(
  ({ onHistoryChange }, ref) => {
    const {
      originalImageUrl,
      cutoutImageUrl,
      activeTool,
      brushSettings,
      magicWandSettings,
      backgroundConfig,
      cutoutTransform,
      setCutoutTransform,
    } = useAppStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Keep images in memory
    const origImgRef = useRef<HTMLImageElement | null>(null);
    const bgImgRef = useRef<HTMLImageElement | null>(null);

    // History for Undo / Redo
    const historyRef = useRef<ImageData[]>([]);
    const historyIndexRef = useRef<number>(-1);

    // Pan & Zoom viewport state
    const [zoom, setZoom] = useState<number>(1);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Drawing state
    const isInteractingRef = useRef<boolean>(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    // Gesture tracking (pinch / 2-finger pan)
    const touchStartDistRef = useRef<number | null>(null);
    const touchStartCenterRef = useRef<{ x: number; y: number } | null>(null);
    const touchStartTransformRef = useRef<{ x: number; y: number; scale: number; rotation: number } | null>(null);
    const touchStartAngleRef = useRef<number | null>(null);

    // Update history indicators
    const notifyHistory = useCallback(() => {
      const canUndo = historyIndexRef.current > 0;
      const canRedo = historyIndexRef.current < historyRef.current.length - 1;
      onHistoryChange?.(canUndo, canRedo);
    }, [onHistoryChange]);

    const pushHistory = useCallback(
      (imageData: ImageData) => {
        // Clone image data
        const cloned = new ImageData(
          new Uint8ClampedArray(imageData.data),
          imageData.width,
          imageData.height
        );
        // Truncate redo
        const newHist = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHist.push(cloned);
        if (newHist.length > MAX_HISTORY) {
          newHist.shift();
        }
        historyRef.current = newHist;
        historyIndexRef.current = newHist.length - 1;
        notifyHistory();
      },
      [notifyHistory]
    );

    const undo = useCallback(() => {
      if (historyIndexRef.current > 0) {
        historyIndexRef.current -= 1;
        const snapshot = historyRef.current[historyIndexRef.current];
        const canvas = canvasRef.current;
        if (canvas && snapshot) {
          const ctx = canvas.getContext('2d')!;
          ctx.putImageData(snapshot, 0, 0);
          notifyHistory();
        }
      }
    }, [notifyHistory]);

    const redo = useCallback(() => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current += 1;
        const snapshot = historyRef.current[historyIndexRef.current];
        const canvas = canvasRef.current;
        if (canvas && snapshot) {
          const ctx = canvas.getContext('2d')!;
          ctx.putImageData(snapshot, 0, 0);
          notifyHistory();
        }
      }
    }, [notifyHistory]);

    const resetView = useCallback(() => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getCutoutCanvas: () => canvasRef.current,
        getBackgroundImage: () => bgImgRef.current,
        undo,
        redo,
        canUndo: historyIndexRef.current > 0,
        canRedo: historyIndexRef.current < historyRef.current.length - 1,
        resetView,
      }),
      [undo, redo, resetView]
    );

    // Load original image
    useEffect(() => {
      if (!originalImageUrl) return;
      const img = new Image();
      img.onload = () => {
        origImgRef.current = img;
      };
      img.src = originalImageUrl;
    }, [originalImageUrl]);

    // Load background image if present
    useEffect(() => {
      if (backgroundConfig.customImageUrl) {
        const bg = new Image();
        bg.onload = () => {
          bgImgRef.current = bg;
        };
        bg.src = backgroundConfig.customImageUrl;
      } else {
        bgImgRef.current = null;
      }
    }, [backgroundConfig.customImageUrl]);

    // Initial cutout image load onto canvas
    useEffect(() => {
      if (!cutoutImageUrl) return;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // Save initial state to history
        const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        historyRef.current = [initialData];
        historyIndexRef.current = 0;
        notifyHistory();
      };
      img.src = cutoutImageUrl;
    }, [cutoutImageUrl, notifyHistory]);

    // Convert client pointer event coordinates to canvas pixel coordinates
    const getCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = Math.round((clientX - rect.left) * scaleX);
      const y = Math.round((clientY - rect.top) * scaleY);
      return { x, y };
    };

    // Brush stroke interpolation
    const drawBrush = (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const { size, softness } = brushSettings;

      ctx.save();
      if (activeTool === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
        if (softness > 0.05) {
          const grad = ctx.createRadialGradient(x, y, size * (1 - softness) * 0.5, x, y, size * 0.5);
          grad.addColorStop(0, 'rgba(0,0,0,1)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = 'rgba(0,0,0,1)';
        }
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (activeTool === 'restore' && origImgRef.current) {
        // To restore original pixels:
        // Use a temporary offscreen circular clip and draw original image through it
        const off = document.createElement('canvas');
        off.width = size;
        off.height = size;
        const offCtx = off.getContext('2d')!;

        // Draw source portion
        const sx = x - size * 0.5;
        const sy = y - size * 0.5;
        offCtx.drawImage(origImgRef.current, sx, sy, size, size, 0, 0, size, size);

        // Apply radial mask
        offCtx.globalCompositeOperation = 'destination-in';
        if (softness > 0.05) {
          const grad = offCtx.createRadialGradient(
            size * 0.5,
            size * 0.5,
            size * (1 - softness) * 0.5,
            size * 0.5,
            size * 0.5,
            size * 0.5
          );
          grad.addColorStop(0, 'rgba(0,0,0,1)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          offCtx.fillStyle = grad;
        } else {
          offCtx.fillStyle = 'rgba(0,0,0,1)';
        }
        offCtx.beginPath();
        offCtx.arc(size * 0.5, size * 0.5, size * 0.5, 0, Math.PI * 2);
        offCtx.fill();

        // Draw restored patch over working canvas
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(off, sx, sy);
      }
      ctx.restore();
    };

    const drawLine = (fromX: number, fromY: number, toX: number, toY: number) => {
      const dist = Math.hypot(toX - fromX, toY - fromY);
      const step = Math.max(1, brushSettings.size * 0.2);
      const steps = Math.ceil(dist / step);
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const curX = fromX + (toX - fromX) * t;
        const curY = fromY + (toY - fromY) * t;
        drawBrush(curX, curY);
      }
    };

    // Pointer events (Mouse / Touch)
    const handlePointerDown = (e: React.PointerEvent) => {
      // Background move/scale tool
      if (activeTool === 'background') {
        isInteractingRef.current = true;
        lastPointRef.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      // Drawing or Magic Wand
      const coords = getCanvasCoords(e.clientX, e.clientY);
      if (!coords) return;

      if (activeTool === 'magic_wand') {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = applyMagicWand(currentData, coords.x, coords.y, magicWandSettings.tolerance);
        ctx.putImageData(result, 0, 0);
        pushHistory(result);
        return;
      }

      if (activeTool === 'erase' || activeTool === 'restore') {
        isInteractingRef.current = true;
        lastPointRef.current = coords;
        drawBrush(coords.x, coords.y);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!isInteractingRef.current || !lastPointRef.current) return;

      if (activeTool === 'background') {
        const dx = e.clientX - lastPointRef.current.x;
        const dy = e.clientY - lastPointRef.current.y;
        lastPointRef.current = { x: e.clientX, y: e.clientY };

        setCutoutTransform((prev) => ({
          ...prev,
          x: prev.x + dx / zoom,
          y: prev.y + dy / zoom,
        }));
        return;
      }

      if (activeTool === 'erase' || activeTool === 'restore') {
        const coords = getCanvasCoords(e.clientX, e.clientY);
        if (!coords) return;
        drawLine(lastPointRef.current.x, lastPointRef.current.y, coords.x, coords.y);
        lastPointRef.current = coords;
      }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!isInteractingRef.current) return;
      isInteractingRef.current = false;
      lastPointRef.current = null;

      if (activeTool === 'erase' || activeTool === 'restore') {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          pushHistory(currentData);
        }
      }
    };

    // Multi-touch gestures for 2-finger zoom / pan
    const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const center = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

        touchStartDistRef.current = dist;
        touchStartCenterRef.current = center;
        touchStartAngleRef.current = angle;
        touchStartTransformRef.current = { ...cutoutTransform };
      }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistRef.current !== null && touchStartCenterRef.current !== null) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const scaleChange = currentDist / touchStartDistRef.current;
        const currentCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        const currentAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
        const angleDelta = currentAngle - (touchStartAngleRef.current || 0);

        if (activeTool === 'background' && touchStartTransformRef.current) {
          // Scale & rotate cutout over background
          setCutoutTransform({
            x: touchStartTransformRef.current.x + (currentCenter.x - touchStartCenterRef.current.x),
            y: touchStartTransformRef.current.y + (currentCenter.y - touchStartCenterRef.current.y),
            scale: Math.max(0.1, Math.min(5, touchStartTransformRef.current.scale * scaleChange)),
            rotation: (touchStartTransformRef.current.rotation + angleDelta) % 360,
          });
        } else {
          // Viewport pinch-zoom and pan
          const newZoom = Math.max(0.5, Math.min(6, zoom * scaleChange));
          setZoom(newZoom);
          setPan((p) => ({
            x: p.x + (currentCenter.x - touchStartCenterRef.current!.x),
            y: p.y + (currentCenter.y - touchStartCenterRef.current!.y),
          }));
          touchStartDistRef.current = currentDist;
          touchStartCenterRef.current = currentCenter;
        }
      }
    };

    const handleTouchEnd = () => {
      touchStartDistRef.current = null;
      touchStartCenterRef.current = null;
      touchStartTransformRef.current = null;
      touchStartAngleRef.current = null;
    };

    // Wheel zoom
    const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((prev) => Math.max(0.5, Math.min(6, prev * delta)));
    };

    // Render background style
    const getBgStyle = (): React.CSSProperties => {
      if (backgroundConfig.type === 'color') {
        return { backgroundColor: backgroundConfig.color };
      }
      if (backgroundConfig.type === 'image' && backgroundConfig.customImageUrl) {
        return {
          backgroundImage: `url(${backgroundConfig.customImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        };
      }
      return {};
    };

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden flex items-center justify-center select-none touch-none"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background Layer container */}
        <div
          className={`relative max-w-full max-h-full flex items-center justify-center transition-transform duration-75 ${
            backgroundConfig.type === 'transparent' ? 'bg-checkerboard' : ''
          }`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            ...getBgStyle(),
          }}
        >
          {/* Active Cutout Canvas */}
          <canvas
            ref={canvasRef}
            className="max-h-[72vh] max-w-[92vw] object-contain shadow-none touch-none cursor-crosshair"
            style={{
              transform:
                activeTool === 'background' || backgroundConfig.type !== 'transparent'
                  ? `translate(${cutoutTransform.x}px, ${cutoutTransform.y}px) scale(${cutoutTransform.scale}) rotate(${cutoutTransform.rotation}deg)`
                  : 'none',
              transformOrigin: 'center center',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>

        {/* Zoom indicator tag */}
        {zoom !== 1 && (
          <button
            onClick={resetView}
            className="absolute top-4 left-4 bg-card/90 border border-border text-xs px-2.5 py-1 rounded-btn text-muted hover:text-fg font-mono transition-colors"
          >
            {Math.round(zoom * 100)}% • Reset
          </button>
        )}
      </div>
    );
  }
);
