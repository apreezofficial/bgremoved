import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { applyMagicWand } from '../lib/magicWand';
import { bgStyle } from '../lib/background';
import { loadImage } from '../lib/exporter';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

export interface EditorHandle {
  undo(): void;
  redo(): void;
  rotate(dir: 1 | -1): void;
  flip(axis: 'h' | 'v'): void;
  applyCrop(): void;
  getCutoutCanvas(): HTMLCanvasElement | null;
}

interface Snap { cut: ImageData; orig: HTMLCanvasElement }
interface Rect { x: number; y: number; w: number; h: number }

interface Props {
  compare: boolean;
  cropAspect: number | null; // w/h, null = free
  onHistory: (canUndo: boolean, canRedo: boolean) => void;
}

const MAX_HISTORY = 25;
const PAD = 56;
const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;

const newCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export const Editor = forwardRef<EditorHandle, Props>(({ compare, cropAspect, onHistory }, ref) => {
  const originalUrl = useAppStore((s) => s.originalUrl);
  const cutoutUrl = useAppStore((s) => s.cutoutUrl);
  const tool = useAppStore((s) => s.tool);
  const bg = useAppStore((s) => s.bg);
  const zoom = useAppStore((s) => s.zoom);

  const stageRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cmpRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const origRef = useRef<HTMLCanvasElement | null>(null);
  const histRef = useRef<Snap[]>([]);
  const idxRef = useRef(-1);

  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [version, setVersion] = useState(0);
  const [comparePos, setComparePos] = useState(50);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);

  const fit = dims.w && stage.w ? Math.min(2, Math.max(0.05, Math.min((stage.w - PAD * 2) / dims.w, (stage.h - PAD * 2) / dims.h))) : 1;
  const scale = fit * zoom; // CSS px per image px
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const onHistoryRef = useRef(onHistory);
  onHistoryRef.current = onHistory;

  const notify = useCallback(() => {
    onHistoryRef.current(idxRef.current > 0, idxRef.current < histRef.current.length - 1);
  }, []);

  const pushHistory = useCallback(() => {
    const cv = canvasRef.current!;
    const cut = ctx2d(cv).getImageData(0, 0, cv.width, cv.height);
    const next = histRef.current.slice(0, idxRef.current + 1);
    next.push({ cut, orig: origRef.current! });
    if (next.length > MAX_HISTORY) next.shift();
    histRef.current = next;
    idxRef.current = next.length - 1;
    setVersion((v) => v + 1);
    notify();
  }, [notify]);

  const restore = useCallback((snap: Snap) => {
    const cv = canvasRef.current!;
    if (cv.width !== snap.cut.width || cv.height !== snap.cut.height) {
      cv.width = snap.cut.width;
      cv.height = snap.cut.height;
    }
    ctx2d(cv).putImageData(snap.cut, 0, 0);
    origRef.current = snap.orig;
    setDims({ w: cv.width, h: cv.height });
    setVersion((v) => v + 1);
    notify();
  }, [notify]);

  // ---- load images -------------------------------------------------------
  useEffect(() => {
    if (!cutoutUrl || !originalUrl) return;
    let dead = false;
    Promise.all([loadImage(cutoutUrl), loadImage(originalUrl)]).then(([cut, orig]) => {
      if (dead || !canvasRef.current) return;
      const w = cut.naturalWidth, h = cut.naturalHeight;
      const cv = canvasRef.current;
      cv.width = w;
      cv.height = h;
      const ctx = ctx2d(cv);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(cut, 0, 0);
      const oc = newCanvas(w, h);
      ctx2d(oc).drawImage(orig, 0, 0, w, h);
      origRef.current = oc;
      histRef.current = [{ cut: ctx.getImageData(0, 0, w, h), orig: oc }];
      idxRef.current = 0;
      setDims({ w, h });
      setPan({ x: 0, y: 0 });
      setVersion((v) => v + 1);
      notify();
    });
    return () => { dead = true; };
  }, [cutoutUrl, originalUrl, notify]);

  // ---- stage size --------------------------------------------------------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ---- compare overlay (original photo) ---------------------------------
  useEffect(() => {
    const c = cmpRef.current;
    if (!compare || !c || !origRef.current) return;
    c.width = dims.w;
    c.height = dims.h;
    ctx2d(c).drawImage(origRef.current, 0, 0);
  }, [compare, dims, version]);

  // ---- wheel zoom (anchored at cursor) ----------------------------------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useAppStore.getState();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      const next = Math.max(0.1, Math.min(4, st.zoom * factor));
      const ratio = next / st.zoom;
      const r = el.getBoundingClientRect();
      const cx = e.clientX - (r.left + r.width / 2);
      const cy = e.clientY - (r.top + r.height / 2);
      setPan((p) => ({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio }));
      st.setZoom(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Reset pan when zoom returns to fit.
  useEffect(() => { if (zoom === 1) setPan({ x: 0, y: 0 }); }, [zoom]);

  // space = temporary pan
  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') { e.preventDefault(); setSpaceDown(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceDown(false); };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  // ---- crop rect defaults ------------------------------------------------
  const defaultCrop = useCallback((): Rect => {
    const { w, h } = dims;
    if (!cropAspect) return { x: 0, y: 0, w, h };
    let cw = w, ch = w / cropAspect;
    if (ch > h) { ch = h; cw = h * cropAspect; }
    return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
  }, [dims, cropAspect]);

  useEffect(() => {
    setCrop(tool === 'crop' && dims.w ? defaultCrop() : null);
  }, [tool, dims, cropAspect, defaultCrop]);

  // ---- geometry ops ------------------------------------------------------
  const transformBoth = useCallback((fn: (src: HTMLCanvasElement) => HTMLCanvasElement) => {
    const cv = canvasRef.current;
    if (!cv || !origRef.current) return;
    const snapshot = newCanvas(cv.width, cv.height);
    ctx2d(snapshot).drawImage(cv, 0, 0);
    const nc = fn(snapshot);
    const no = fn(origRef.current);
    cv.width = nc.width;
    cv.height = nc.height;
    ctx2d(cv).drawImage(nc, 0, 0);
    origRef.current = no;
    setDims({ w: nc.width, h: nc.height });
    pushHistory();
  }, [pushHistory]);

  useImperativeHandle(ref, () => ({
    undo() {
      if (idxRef.current > 0) { idxRef.current -= 1; restore(histRef.current[idxRef.current]); }
    },
    redo() {
      if (idxRef.current < histRef.current.length - 1) { idxRef.current += 1; restore(histRef.current[idxRef.current]); }
    },
    rotate(dir) {
      transformBoth((src) => {
        const c = newCanvas(src.height, src.width);
        const x = c.getContext('2d')!;
        x.translate(c.width / 2, c.height / 2);
        x.rotate((dir * Math.PI) / 2);
        x.drawImage(src, -src.width / 2, -src.height / 2);
        return c;
      });
    },
    flip(axis) {
      transformBoth((src) => {
        const c = newCanvas(src.width, src.height);
        const x = c.getContext('2d')!;
        if (axis === 'h') { x.translate(src.width, 0); x.scale(-1, 1); } else { x.translate(0, src.height); x.scale(1, -1); }
        x.drawImage(src, 0, 0);
        return c;
      });
    },
    applyCrop() {
      if (!crop) return;
      const r = { x: Math.round(crop.x), y: Math.round(crop.y), w: Math.max(1, Math.round(crop.w)), h: Math.max(1, Math.round(crop.h)) };
      transformBoth((src) => {
        const c = newCanvas(r.w, r.h);
        c.getContext('2d')!.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        return c;
      });
    },
    getCutoutCanvas: () => canvasRef.current,
  }), [restore, transformBoth, crop]);

  // ---- brush -------------------------------------------------------------
  const stamp = (x: number, y: number, erase: boolean) => {
    const cv = canvasRef.current!;
    const ctx = ctx2d(cv);
    const { size, softness } = useAppStore.getState().brush;
    const r = Math.max(0.5, size / scaleRef.current / 2);
    const inner = Math.min(r - 0.5, r * (1 - softness));
    if (erase) {
      const g = ctx.createRadialGradient(x, y, Math.max(0, inner), x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
    } else if (origRef.current) {
      const d = Math.max(2, Math.ceil(r * 2));
      const tmp = newCanvas(d, d);
      const t = tmp.getContext('2d')!;
      t.drawImage(origRef.current, x - r, y - r, d, d, 0, 0, d, d);
      const g = t.createRadialGradient(d / 2, d / 2, Math.max(0, inner), d / 2, d / 2, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      t.globalCompositeOperation = 'destination-in';
      t.fillStyle = g;
      t.fillRect(0, 0, d, d);
      ctx.drawImage(tmp, x - r, y - r);
    }
  };

  const strokeLine = (a: { x: number; y: number }, b: { x: number; y: number }, erase: boolean) => {
    const { size } = useAppStore.getState().brush;
    const step = Math.max(1, (size / scaleRef.current) * 0.12);
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let i = 0; i <= n; i++) stamp(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, erase);
  };

  const toImage = (cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * dims.w, y: ((cy - r.top) / r.height) * dims.h, inside: cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom };
  };

  // ---- pointer interaction ----------------------------------------------
  const mode = useRef<null | 'pan' | 'stroke' | 'pinch'>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const pinchStats = () => {
    const [a, b] = Array.from(pointers.current.values());
    return { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };
  const last = useRef({ x: 0, y: 0 });
  const lastClient = useRef({ x: 0, y: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-nodraw]')) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // second finger: discard any half-drawn stroke and switch to pinch zoom / two-finger pan
      if (mode.current === 'stroke' && histRef.current[idxRef.current]) restore(histRef.current[idxRef.current]);
      mode.current = 'pinch';
      pinch.current = pinchStats();
      setPanning(false);
      return;
    }
    if (pointers.current.size > 2) return;
    const st = useAppStore.getState();
    if (st.tool === 'pan' || spaceDown || e.button === 1) {
      mode.current = 'pan';
      lastClient.current = { x: e.clientX, y: e.clientY };
      setPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (compare || !dims.w) return;
    const p = toImage(e.clientX, e.clientY);
    if (st.tool === 'wand' && p.inside) {
      const cv = canvasRef.current!;
      const ctx = ctx2d(cv);
      const data = ctx.getImageData(0, 0, cv.width, cv.height);
      ctx.putImageData(applyMagicWand(data, Math.round(p.x), Math.round(p.y), st.wandTolerance), 0, 0);
      pushHistory();
    } else if ((st.tool === 'erase' || st.tool === 'brush') && p.inside) {
      mode.current = 'stroke';
      last.current = p;
      stamp(p.x, p.y, st.tool === 'erase');
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const ring = ringRef.current;
    if (ring) {
      const r = stageRef.current!.getBoundingClientRect();
      ring.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px) translate(-50%, -50%)`;
    }
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode.current === 'pinch') {
      if (pointers.current.size >= 2 && pinch.current) {
        const cur = pinchStats();
        const prev = pinch.current;
        const st = useAppStore.getState();
        const next = Math.max(0.1, Math.min(4, st.zoom * (cur.dist / prev.dist)));
        const ratio = next / st.zoom;
        const r = stageRef.current!.getBoundingClientRect();
        const cx = cur.cx - (r.left + r.width / 2);
        const cy = cur.cy - (r.top + r.height / 2);
        setPan((p) => ({ x: cx - (cx - p.x) * ratio + (cur.cx - prev.cx) * 0, y: cy - (cy - p.y) * ratio }));
        // add the finger-centre drift so two-finger drag pans too
        setPan((p) => ({ x: p.x + (cur.cx - prev.cx), y: p.y + (cur.cy - prev.cy) }));
        st.setZoom(next);
        pinch.current = cur;
      }
      return;
    }
    if (mode.current === 'pan') {
      const dx = e.clientX - lastClient.current.x;
      const dy = e.clientY - lastClient.current.y;
      lastClient.current = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else if (mode.current === 'stroke') {
      const p = toImage(e.clientX, e.clientY);
      strokeLine(last.current, p, useAppStore.getState().tool === 'erase');
      last.current = p;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (mode.current === 'pinch') {
      if (pointers.current.size < 2) { mode.current = null; pinch.current = null; }
      return;
    }
    if (mode.current === 'stroke') pushHistory();
    mode.current = null;
    setPanning(false);
  };

  // ---- crop handles ------------------------------------------------------
  const cropDrag = useRef<null | { kind: string; start: Rect; px: number; py: number }>(null);

  const imgPoint = (cx: number, cy: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * dims.w, y: ((cy - r.top) / r.height) * dims.h };
  };

  const cropDown = (kind: string) => (e: React.PointerEvent) => {
    if (!crop) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = imgPoint(e.clientX, e.clientY);
    cropDrag.current = { kind, start: crop, px: p.x, py: p.y };
  };

  const cropMove = (e: React.PointerEvent) => {
    const d = cropDrag.current;
    if (!d) return;
    const { w, h } = dims;
    const p = imgPoint(e.clientX, e.clientY);
    const s = d.start;
    if (d.kind === 'move') {
      setCrop({ ...s, x: Math.max(0, Math.min(w - s.w, s.x + p.x - d.px)), y: Math.max(0, Math.min(h - s.h, s.y + p.y - d.py)) });
      return;
    }
    const ax = d.kind.includes('l') ? s.x + s.w : s.x;
    const ay = d.kind.includes('t') ? s.y + s.h : s.y;
    const cx = Math.max(0, Math.min(w, p.x));
    const cy = Math.max(0, Math.min(h, p.y));
    let nw = Math.max(20, Math.abs(cx - ax));
    let nh = Math.max(20, Math.abs(cy - ay));
    const maxW = cx >= ax ? w - ax : ax;
    const maxH = cy >= ay ? h - ay : ay;
    if (cropAspect) {
      if (nw / nh > cropAspect) nh = nw / cropAspect; else nw = nh * cropAspect;
      if (nw > maxW) { nw = maxW; nh = nw / cropAspect; }
      if (nh > maxH) { nh = maxH; nw = nh * cropAspect; }
    }
    setCrop({ x: cx >= ax ? ax : ax - nw, y: cy >= ay ? ay : ay - nh, w: nw, h: nh });
  };

  const cropUp = () => { cropDrag.current = null; };

  // ---- compare handle ----------------------------------------------------
  const cmpDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = wrapRef.current!.getBoundingClientRect();
      setComparePos(Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100)));
    };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const showRing = (tool === 'erase' || tool === 'brush') && !compare && !spaceDown;
  const brushSize = useAppStore((s) => s.brush.size);
  const cursor = tool === 'pan' || spaceDown ? (panning ? 'grabbing' : 'grab') : showRing ? 'none' : tool === 'wand' ? 'crosshair' : 'default';

  const dispW = dims.w * scale;
  const dispH = dims.h * scale;
  const k = scale; // image px -> css px

  const corner = (kind: string, style: React.CSSProperties, border: string) => (
    <div
      key={kind}
      data-nodraw
      onPointerDown={cropDown(kind)}
      onPointerMove={cropMove}
      onPointerUp={cropUp}
      className="absolute w-6 h-6 touch-none"
      style={{ ...style, cursor: kind === 'tl' || kind === 'br' ? 'nwse-resize' : 'nesw-resize' }}
    >
      <div className="absolute inset-0 border-white" style={{ borderWidth: 0, ...Object.fromEntries(border.split(' ').map((b) => [b, '4px solid #fff'])) }} />
    </div>
  );

  return (
    <div
      ref={stageRef}
      className="relative w-full h-full overflow-hidden select-none touch-none"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => { if (ringRef.current) ringRef.current.style.opacity = '0'; }}
      onPointerEnter={() => { if (ringRef.current) ringRef.current.style.opacity = '1'; }}
    >
      {(
        <div
          ref={wrapRef}
          className="absolute left-1/2 top-1/2"
          style={{ display: dims.w > 0 ? 'block' : 'none', width: dispW, height: dispH, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))` }}
        >
          <div className={`absolute inset-0 ${bg.type === 'transparent' ? 'bg-checker' : ''}`} style={bgStyle(bg)} />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

          {compare && (
            <>
              <canvas
                ref={cmpRef}
                className="absolute inset-0 w-full h-full block pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}
              />
              <div data-nodraw className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ left: `${comparePos}%`, transform: 'translateX(-50%)' }} />
              <div
                data-nodraw
                onPointerDown={cmpDown}
                className="absolute top-1/2 w-9 h-9 rounded-full bg-white/90 text-pink flex items-center justify-center cursor-ew-resize touch-none shadow-lg"
                style={{ left: `${comparePos}%`, transform: 'translate(-50%, -50%)' }}
              >
                <ChevronLeftIcon size={14} />
                <ChevronRightIcon size={14} />
              </div>
            </>
          )}

          {crop && tool === 'crop' && (
            <div
              data-nodraw
              onPointerDown={cropDown('move')}
              onPointerMove={cropMove}
              onPointerUp={cropUp}
              className="absolute touch-none cursor-move"
              style={{
                left: crop.x * k, top: crop.y * k, width: crop.w * k, height: crop.h * k,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
                backgroundImage:
                  'linear-gradient(to right, transparent 33.2%, rgba(255,255,255,.35) 33.3%, transparent 33.5%, transparent 66.5%, rgba(255,255,255,.35) 66.6%, transparent 66.8%), linear-gradient(to bottom, transparent 33.2%, rgba(255,255,255,.35) 33.3%, transparent 33.5%, transparent 66.5%, rgba(255,255,255,.35) 66.6%, transparent 66.8%)',
              }}
            >
              {corner('tl', { left: -2, top: -2 }, 'borderTop borderLeft')}
              {corner('tr', { right: -2, top: -2 }, 'borderTop borderRight')}
              {corner('bl', { left: -2, bottom: -2 }, 'borderBottom borderLeft')}
              {corner('br', { right: -2, bottom: -2 }, 'borderBottom borderRight')}
            </div>
          )}
        </div>
      )}

      {/* brush cursor */}
      <div
        ref={ringRef}
        className="absolute left-0 top-0 rounded-full border border-white pointer-events-none"
        style={{ width: brushSize, height: brushSize, opacity: 0, display: showRing ? 'block' : 'none', boxShadow: '0 0 0 1px rgba(0,0,0,.5)' }}
      />
    </div>
  );
});
