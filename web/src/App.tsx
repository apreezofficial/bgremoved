import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { Editor, EditorHandle } from './components/Editor';
import { ColorPicker } from './components/ColorPicker';
import * as I from './components/Icons';
import { initWorker, removeBackground } from './lib/removerClient';
import { fileToPicked, pickImage, PickedImage } from './lib/imagePicker';
import { composeImage, downloadBlob } from './lib/exporter';
import { getAllRecents, saveRecentItem, deleteRecentItem } from './lib/storage';
import { generateTextures } from './lib/textures';
import { gradientCss } from './lib/background';
import { ExportFormat, ExportTarget, RecentItem, ToolType } from './types';

const SWATCHES = ['#2EC4B6', '#2B5C9E', '#C8283C', '#D6347E', '#E8603F', '#F2D45C', '#7A5AF8', '#16A34A', '#FFFFFF', '#000000', '#94A3B8', '#111827'];

const TOOLS: { id: ToolType; label: string; key: string; icon: React.FC<{ size?: number }> }[] = [
  { id: 'bg', label: 'Add BG', key: 'G', icon: I.AddBgIcon },
  { id: 'erase', label: 'Erase', key: 'E', icon: I.EraseIcon },
  { id: 'brush', label: 'Brush', key: 'B', icon: I.BrushIcon },
  { id: 'wand', label: 'Wand', key: 'W', icon: I.WandIcon },
  { id: 'crop', label: 'Crop', key: 'C', icon: I.CropIcon },
  { id: 'rotate', label: 'Rotate', key: 'R', icon: I.RotateIcon },
  { id: 'flip', label: 'Flip', key: 'F', icon: I.FlipIcon },
  { id: 'pan', label: 'Pan', key: 'H', icon: I.PanIcon },
  { id: 'zoom', label: 'Zoom', key: 'Z', icon: I.ZoomIcon },
];

const ASPECTS: { label: string; v: number | null }[] = [
  { label: 'Free', v: null }, { label: '1:1', v: 1 }, { label: '4:3', v: 4 / 3 },
  { label: '3:4', v: 3 / 4 }, { label: '16:9', v: 16 / 9 }, { label: '9:16', v: 9 / 16 },
];

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(b); });

function Logo() {
  return (
    <div className="flex items-baseline select-none leading-none" style={{ fontSize: 30, letterSpacing: '-0.05em' }}>
      <span className="font-extrabold" style={{ background: 'linear-gradient(90deg,#E5484D,#D6347E)', WebkitBackgroundClip: 'text', color: 'transparent' }}>remove</span>
      <span className="font-black" style={{ background: 'linear-gradient(90deg,#D6347E,#7A5AF8)', WebkitBackgroundClip: 'text', color: 'transparent' }}>BG</span>
    </div>
  );
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-14 shrink-0 flex items-center px-5 border-b border-white/5">
      <h2 className="font-display text-[15px]">{children}</h2>
    </div>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-2.5"><span>{label}</span><span className="text-fg">{value}</span></div>
      {children}
    </div>
  );
}

function Range(p: { min: number; max: number; step?: number; value: number; onChange: (v: number) => void }) {
  const pct = ((p.value - p.min) / (p.max - p.min)) * 100;
  return (
    <input type="range" min={p.min} max={p.max} step={p.step ?? 1} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))}
      className="panel-range w-full" style={{ background: `linear-gradient(to right,#5B9BEA ${pct}%,#3a3c42 ${pct}%)` }} />
  );
}

function ToolBtn({ icon: Icon, label, onClick, disabled, active, danger }: { icon: React.FC<{ size?: number }>; label: string; onClick?: () => void; disabled?: boolean; active?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-[4px] text-[11px] transition-colors disabled:opacity-35 ${active ? 'bg-white/10' : 'hover:bg-white/5'} ${danger ? 'hover:text-pink' : ''}`}>
      <Icon size={17} />
      <span>{label}</span>
    </button>
  );
}

const BigBtn = ({ onClick, icon: Icon, label }: { onClick: () => void; icon: React.FC<{ size?: number }>; label: string }) => (
  <button onClick={onClick} className="flex-1 h-20 rounded-[3px] bg-[#1B1C20] hover:bg-black/40 flex flex-col items-center justify-center gap-2 text-xs">
    <Icon size={22} />{label}
  </button>
);

export default function App() {
  const s = useAppStore();
  const editor = useRef<EditorHandle>(null);
  const colorsRow = useRef<HTMLDivElement>(null);
  const [hist, setHist] = useState({ undo: false, redo: false });
  const [compare, setCompare] = useState(false);
  const [custom, setCustom] = useState(false);
  const [stop, setStop] = useState<0 | 1>(0);
  const [cropAspect, setCropAspect] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [textures, setTextures] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const hasImage = !!s.cutoutUrl;

  useEffect(() => {
    initWorker().catch(() => {});
    getAllRecents().then(s.setRecents);
    const t = setTimeout(() => setTextures(generateTextures()), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const process = useCallback(async (picked: PickedImage | null) => {
    if (!picked) return;
    setError('');
    setCompare(false);
    setCustom(false);
    const st = useAppStore.getState();
    st.setIsProcessing(true);
    st.setProgress({ stage: 'loading_model', percent: 10, message: 'Initializing model…' });
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('Could not read image')); img.src = picked.dataUrl; });
      const { blob, width, height } = await removeBackground(img, st.setProgress);
      const resultDataUrl = await blobToDataUrl(blob);
      const tc = document.createElement('canvas');
      tc.width = 160;
      tc.height = Math.max(1, Math.round((160 * height) / width));
      tc.getContext('2d')!.drawImage(img, 0, 0, tc.width, tc.height);
      const item: RecentItem = {
        id: Math.random().toString(36).slice(2, 10), timestamp: Date.now(),
        thumbnailDataUrl: tc.toDataURL('image/jpeg', 0.7), originalDataUrl: picked.dataUrl, resultDataUrl, width, height,
      };
      saveRecentItem(item);
      st.addRecent(item);
      st.setImage(picked.name.replace(/\.[^.]+$/, '') || 'untitled', picked.dataUrl, resultDataUrl, width, height);
    } catch (e: any) {
      setError(e?.message || 'Background removal failed');
    } finally {
      useAppStore.getState().setIsProcessing(false);
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files || []).find((x) => x.type.startsWith('image/'));
      if (f) fileToPicked(f).then(process);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const st = useAppStore.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editor.current?.redo(); else editor.current?.undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || !st.cutoutUrl) return;
      const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (t) { st.setTool(t.id); setCustom(false); }
      if (e.key === '[') st.setBrush({ size: Math.max(8, st.brush.size - 8) });
      if (e.key === ']') st.setBrush({ size: Math.min(200, st.brush.size + 8) });
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('paste', onPaste); window.removeEventListener('keydown', onKey); };
  }, [process]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  const upload = () => pickImage().then(process);

  const doExport = async (target: ExportTarget, format: ExportFormat) => {
    const cv = editor.current?.getCutoutCanvas();
    if (!cv) return;
    const blob = await composeImage({ target, format, cutoutCanvas: cv, bg: s.bg });
    const suffix = target === 'cutout' ? 'cutout' : target === 'backdrop' ? 'backdrop' : 'edit';
    downloadBlob(blob, `${s.name}-${suffix}.${format === 'jpeg' ? 'jpg' : 'png'}`);
    setMenu(false);
  };

  const openRecent = (r: RecentItem) => { setCompare(false); setCustom(false); s.setImage('recent-' + r.id, r.originalDataUrl, r.resultDataUrl, r.width, r.height); };
  const delRecent = (id: string) => { deleteRecentItem(id); s.removeRecent(id); };

  const pickBackdrop = async () => {
    const p = await pickImage();
    if (p) s.setBg({ type: 'image', customImageUrl: p.dataUrl });
  };

  const setStopColor = (hex: string) => {
    if (s.bg.type === 'gradient' && stop === 1) s.setBg({ color2: hex });
    else s.setBg({ color: hex, type: s.bg.type === 'gradient' ? 'gradient' : 'color' });
  };

  const pct = Math.round(s.zoom * 100);

  // ---------------------------------------------------------------- panels
  const renderPanel = () => {
    if (!hasImage) return null;
    switch (s.tool) {
      case 'bg':
        if (custom)
          return (
            <>
              <PanelHeader>Background</PanelHeader>
              <div className="bg-[#323338] flex-1 overflow-y-auto">
                <div className="flex items-center px-5 h-12 text-sm"><span>Custom Colour</span><button onClick={() => setCustom(false)} className="ml-auto text-pink"><I.CloseIcon size={18} /></button></div>
                <div className="px-5 pb-5 flex flex-col gap-4">
                  <select
                    value={s.bg.type === 'gradient' ? 'gradient' : 'solid'}
                    onChange={(e) => { setStop(0); s.setBg({ type: e.target.value === 'gradient' ? 'gradient' : 'color' }); }}
                    className="w-[92px] h-8 bg-transparent border border-blue rounded-[2px] text-xs px-2 outline-none"
                  >
                    <option className="bg-panel" value="solid">Solid</option>
                    <option className="bg-panel" value="gradient">Gradient</option>
                  </select>
                  {s.bg.type === 'gradient' && (
                    <>
                      <div className="flex gap-2">
                        {[0, 1].map((i) => (
                          <button key={i} onClick={() => setStop(i as 0 | 1)} className={`flex-1 h-8 rounded-[3px] border-2 text-xs ${stop === i ? 'border-blue' : 'border-transparent'}`}
                            style={{ background: i === 0 ? s.bg.color : s.bg.color2 }}>
                            <span className="px-2 py-0.5 rounded bg-black/40">{i === 0 ? 'From' : 'To'}</span>
                          </button>
                        ))}
                      </div>
                      <Field label="Angle" value={`${s.bg.angle ?? 135}°`}><Range min={0} max={360} value={s.bg.angle ?? 135} onChange={(angle) => s.setBg({ angle })} /></Field>
                    </>
                  )}
                  <ColorPicker value={s.bg.type === 'gradient' && stop === 1 ? s.bg.color2 ?? '#5B9BEA' : s.bg.color} onChange={setStopColor} />
                </div>
              </div>
            </>
          );
        return (
          <>
            <PanelHeader>Background</PanelHeader>
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 pt-4 pb-3 text-sm">Colours</div>
              <div className="flex items-center border-b border-white/5 pb-4">
                <button onClick={() => colorsRow.current?.scrollBy({ left: -120, behavior: 'smooth' })} className="px-1 text-pink"><I.ChevronLeftIcon size={14} /></button>
                <div ref={colorsRow} className="flex gap-2.5 overflow-x-auto no-scrollbar flex-1 py-1">
                  <button onClick={() => { setCustom(true); if (s.bg.type === 'transparent' || s.bg.type === 'image') s.setBg({ type: 'color' }); }} title="Custom colour" className="w-9 h-9 shrink-0 rounded-[3px] bg-[#1B1C20] flex items-center justify-center"><I.ColorWheel size={18} /></button>
                  <button onClick={() => s.setBg({ type: 'transparent' })} title="No background" className={`w-9 h-9 shrink-0 rounded-[3px] bg-[#1B1C20] flex items-center justify-center text-muted border-2 ${s.bg.type === 'transparent' ? 'border-blue' : 'border-transparent'}`}><I.BanIcon size={16} /></button>
                  {SWATCHES.map((c) => (
                    <button key={c} onClick={() => s.setBg({ type: 'color', color: c })} style={{ background: c }}
                      className={`w-9 h-9 shrink-0 rounded-[3px] border-2 ${s.bg.type === 'color' && s.bg.color.toUpperCase() === c ? 'border-blue' : 'border-transparent'}`} />
                  ))}
                </div>
                <button onClick={() => colorsRow.current?.scrollBy({ left: 120, behavior: 'smooth' })} className="px-1 text-pink"><I.ChevronRightIcon size={14} /></button>
              </div>
              <div className="px-5 pt-4 pb-3 text-sm">Images</div>
              <div className="grid grid-cols-3 gap-2 px-5 pb-5">
                <button onClick={pickBackdrop} title="Upload your own" className="aspect-square rounded-[3px] bg-[#1B1C20] flex items-center justify-center text-pink hover:bg-black/40"><I.UploadImgIcon size={22} /></button>
                {textures.map((t, i) => (
                  <button key={i} onClick={() => s.setBg({ type: 'image', customImageUrl: t })}
                    className={`aspect-square rounded-[3px] bg-cover bg-center border-2 ${s.bg.type === 'image' && s.bg.customImageUrl === t ? 'border-blue' : 'border-transparent'}`} style={{ backgroundImage: `url(${t})` }} />
                ))}
                {s.bg.type === 'image' && s.bg.customImageUrl && !textures.includes(s.bg.customImageUrl) && (
                  <div className="aspect-square rounded-[3px] bg-cover bg-center border-2 border-blue" style={{ backgroundImage: `url(${s.bg.customImageUrl})` }} />
                )}
              </div>
              {s.bg.type === 'gradient' && <div className="mx-5 mb-5 h-8 rounded-[3px] border-2 border-blue" style={{ background: gradientCss(s.bg) }} />}
            </div>
          </>
        );
      case 'erase':
      case 'brush':
        return (
          <>
            <PanelHeader>{s.tool === 'erase' ? 'Erase' : 'Brush'}</PanelHeader>
            <div className="p-5 flex flex-col gap-6">
              <Field label="Size" value={`${s.brush.size}px`}><Range min={8} max={200} value={s.brush.size} onChange={(size) => s.setBrush({ size })} /></Field>
              <Field label="Softness" value={`${Math.round(s.brush.softness * 100)}%`}><Range min={0} max={1} step={0.05} value={s.brush.softness} onChange={(softness) => s.setBrush({ softness })} /></Field>
              <p className="text-xs text-muted leading-relaxed">
                {s.tool === 'erase' ? 'Paint over anything you want removed.' : 'Paint to bring back parts of the original photo.'}
                <br />Use <b className="text-fg">[</b> and <b className="text-fg">]</b> to resize.
              </p>
            </div>
          </>
        );
      case 'wand':
        return (
          <>
            <PanelHeader>Magic Wand</PanelHeader>
            <div className="p-5 flex flex-col gap-6">
              <Field label="Tolerance" value={`${s.wandTolerance}%`}><Range min={1} max={100} value={s.wandTolerance} onChange={s.setWandTolerance} /></Field>
              <p className="text-xs text-muted leading-relaxed">Click a colour area on the image to erase everything similar and connected.</p>
            </div>
          </>
        );
      case 'crop':
        return (
          <>
            <PanelHeader>Crop</PanelHeader>
            <div className="p-5 flex flex-col gap-5">
              <div className="grid grid-cols-3 gap-2">
                {ASPECTS.map((a) => (
                  <button key={a.label} onClick={() => setCropAspect(a.v)}
                    className={`h-9 rounded-[3px] border text-xs ${cropAspect === a.v ? 'border-blue text-blue' : 'border-line text-muted hover:text-fg'}`}>{a.label}</button>
                ))}
              </div>
              <button onClick={() => editor.current?.applyCrop()} className="h-10 rounded-[3px] text-sm font-semibold text-white" style={{ background: 'linear-gradient(90deg,#E5484D,#D6347E)' }}>Apply crop</button>
              <p className="text-xs text-muted leading-relaxed">Drag the corners or the box. Crop can be undone.</p>
            </div>
          </>
        );
      case 'rotate':
        return (
          <>
            <PanelHeader>Rotate</PanelHeader>
            <div className="p-5 flex gap-3">
              <BigBtn onClick={() => editor.current?.rotate(-1)} icon={I.RotateIcon} label="Left 90°" />
              <BigBtn onClick={() => editor.current?.rotate(1)} icon={I.RotateCwIcon} label="Right 90°" />
            </div>
          </>
        );
      case 'flip':
        return (
          <>
            <PanelHeader>Flip</PanelHeader>
            <div className="p-5 flex gap-3">
              <BigBtn onClick={() => editor.current?.flip('h')} icon={I.FlipIcon} label="Horizontal" />
              <BigBtn onClick={() => editor.current?.flip('v')} icon={I.FlipVIcon} label="Vertical" />
            </div>
          </>
        );
      case 'pan':
        return (<><PanelHeader>Pan</PanelHeader><p className="p-5 text-xs text-muted leading-relaxed">Drag the canvas to move around. In any tool you can hold <b className="text-fg">Space</b> and drag to pan.</p></>);
      case 'zoom':
        return (
          <>
            <PanelHeader>Zoom</PanelHeader>
            <div className="p-5 flex flex-col gap-5">
              <Field label="Level" value={`${pct}%`}><Range min={10} max={400} value={pct} onChange={(v) => s.setZoom(v / 100)} /></Field>
              <button onClick={() => s.setZoom(1)} className="h-9 rounded-[3px] border border-line text-xs hover:text-blue hover:border-blue">Fit to screen</button>
              <p className="text-xs text-muted leading-relaxed">Scroll anywhere on the canvas to zoom.</p>
            </div>
          </>
        );
    }
  };

  // ---------------------------------------------------------------- render
  return (
    <div
      className="h-screen w-screen flex flex-col p-3 sm:p-5 min-w-[960px]"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) fileToPicked(f).then(process); }}
    >
      <div className="flex-1 min-h-0 flex flex-col rounded-[14px] overflow-hidden bg-nav ring-1 ring-white/20 shadow-2xl">
        {/* Nav */}
        <header className="h-[72px] shrink-0 flex items-center px-8 border-b border-white/5">
          <Logo />
          <nav className="ml-auto flex items-stretch h-full text-[15px]">
            <span className="px-5 flex items-center border-b-2 border-blue text-fg">Editor</span>
          </nav>
        </header>

        {/* Editor frame */}
        <div className="flex-1 min-h-0 flex p-6 gap-0">
          <div className="flex-1 min-w-0 flex rounded-[4px] overflow-hidden">
            {/* Rail */}
            <nav className={`w-[150px] shrink-0 bg-rail overflow-y-auto no-scrollbar py-3 ${hasImage ? '' : 'opacity-40 pointer-events-none'}`}>
              {TOOLS.map((t) => {
                const active = s.tool === t.id;
                return (
                  <button key={t.id} onClick={() => { s.setTool(t.id); setCustom(false); }} title={`${t.label} (${t.key})`}
                    className={`relative w-full h-[62px] flex items-center gap-4 pl-6 text-[15px] ${active ? 'text-blue font-bold' : 'text-fg hover:bg-white/5'}`}>
                    {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue" />}
                    <t.icon size={20} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Panel */}
            <section className={`w-[290px] shrink-0 bg-panel flex flex-col min-h-0 ${hasImage ? '' : 'opacity-40 pointer-events-none'}`}>
              {renderPanel() ?? <PanelHeader>Background</PanelHeader>}
            </section>

            {/* Stage */}
            <section className="flex-1 min-w-0 bg-stage flex flex-col relative">
              <div className="h-[84px] shrink-0 flex items-start justify-between px-10 pt-4">
                <div className="flex gap-3">
                  <ToolBtn icon={I.UndoIcon} label="Undo" disabled={!hasImage || !hist.undo} onClick={() => editor.current?.undo()} />
                  <ToolBtn icon={I.RedoIcon} label="Redo" disabled={!hasImage || !hist.redo} onClick={() => editor.current?.redo()} />
                  <ToolBtn icon={I.CompareIcon} label="Compare" disabled={!hasImage} active={compare} onClick={() => setCompare((c) => !c)} />
                </div>
                <div className="flex gap-3 relative">
                  <ToolBtn icon={I.UploadImgIcon} label="Upload New" onClick={upload} />
                  <div onPointerDown={(e) => e.stopPropagation()} className="relative">
                    <ToolBtn icon={I.DownloadIcon} label="Download" disabled={!hasImage} danger active={menu} onClick={() => setMenu((m) => !m)} />
                    {menu && (
                      <div className="absolute right-0 top-full mt-1 z-40 w-56 rounded-[4px] bg-panel border border-line shadow-xl py-1 text-[13px]">
                        {([
                          ['Image (PNG)', 'composed', 'png'], ['Image (JPG)', 'composed', 'jpeg'],
                          ['Cutout only (transparent PNG)', 'cutout', 'png'], ['Backdrop only (PNG)', 'backdrop', 'png'],
                        ] as [string, ExportTarget, ExportFormat][]).map(([l, t, f]) => (
                          <button key={l} onClick={() => doExport(t, f)} className="w-full text-left px-4 py-2.5 hover:bg-white/5">{l}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 relative">
                {hasImage ? (
                  <Editor ref={editor} compare={compare} cropAspect={cropAspect} onHistory={(undo, redo) => setHist({ undo, redo })} />
                ) : (
                  <div className="absolute inset-0 overflow-y-auto flex flex-col items-center px-10 pb-8">
                    <button onClick={upload}
                      className={`w-full max-w-2xl my-auto rounded-[6px] border-2 border-dashed py-16 flex flex-col items-center gap-4 transition-colors ${dragging ? 'border-blue bg-blue/5' : 'border-line hover:border-muted'}`}>
                      <span className="text-pink"><I.UploadImgIcon size={44} /></span>
                      <span className="font-display text-2xl text-center px-6">Drop an image to remove its background</span>
                      <span className="text-sm text-muted">or click to browse · paste with ⌘V · stays on your device</span>
                    </button>
                    {error && <p className="mt-4 text-sm text-danger">{error}</p>}
                    {s.recents.length > 0 && (
                      <div className="w-full max-w-2xl mt-8">
                        <div className="text-sm mb-3 text-muted">Recent</div>
                        <div className="grid grid-cols-6 gap-3">
                          {s.recents.map((r) => (
                            <div key={r.id} className="group relative aspect-square rounded-[3px] overflow-hidden bg-checker">
                              <button onClick={() => openRecent(r)} className="w-full h-full"><img src={r.thumbnailDataUrl} className="w-full h-full object-cover" alt="" /></button>
                              <button onClick={() => delRecent(r.id)} title="Delete" className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:text-pink"><I.TrashIcon size={13} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {dragging && hasImage && (
                  <div className="absolute inset-3 rounded-[6px] border-2 border-dashed border-blue bg-blue/5 flex items-center justify-center pointer-events-none text-blue font-semibold">Drop to replace image</div>
                )}
              </div>

              {/* Zoom */}
              <div className={`h-[78px] shrink-0 flex flex-col items-center justify-center gap-1.5 ${hasImage ? '' : 'opacity-40 pointer-events-none'}`}>
                <span className="text-[13px]">{pct}%</span>
                <div className="flex items-center gap-4">
                  <button onClick={() => s.setZoom(s.zoom / 1.25)}><I.ZoomOutIcon size={18} /></button>
                  <input type="range" min={10} max={400} value={pct} onChange={(e) => s.setZoom(Number(e.target.value) / 100)}
                    className="zoom-range w-[220px]"
                    style={{ background: `linear-gradient(to right,#5B9BEA ${((pct - 10) / 390) * 100}%,#6b6d73 ${((pct - 10) / 390) * 100}%)` }} />
                  <button onClick={() => s.setZoom(s.zoom * 1.25)}><I.ZoomInIcon size={18} /></button>
                </div>
              </div>

              {s.isProcessing && (
                <div className="absolute inset-0 bg-stage/90 flex flex-col items-center justify-center gap-4 z-30">
                  <div className="font-display text-lg">{s.progress.message || 'Working…'}</div>
                  <div className="w-72 h-1.5 rounded-full bg-black/40 overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${s.progress.percent}%`, background: 'linear-gradient(90deg,#E5484D,#D6347E,#7A5AF8)' }} />
                  </div>
                  <div className="text-xs text-muted">{s.progress.percent}%</div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
