import { useEffect, useRef, useState } from 'react';

function hexToHsv(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`.toUpperCase();
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value));
  const [text, setText] = useState(value.toUpperCase());
  const lastEmitted = useRef(value.toUpperCase());

  // Sync when the value changes from outside (e.g. switching gradient stop).
  useEffect(() => {
    if (value.toUpperCase() !== lastEmitted.current) {
      setHsv(hexToHsv(value));
      setText(value.toUpperCase());
      lastEmitted.current = value.toUpperCase();
    }
  }, [value]);

  const emit = (next: [number, number, number]) => {
    setHsv(next);
    const hex = hsvToHex(...next);
    lastEmitted.current = hex;
    setText(hex);
    onChange(hex);
  };

  const drag = (el: HTMLElement, fn: (x: number, y: number) => void) => (e: React.PointerEvent) => {
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
    };
    move(e.nativeEvent);
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const [h, s, v] = hsv;
  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative h-[110px] cursor-crosshair rounded-[2px]"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))` }}
        onPointerDown={(e) => drag(e.currentTarget, (x, y) => emit([h, x, 1 - y]))(e)}
      >
        <span className="absolute w-3 h-3 rounded-full bg-white border border-black/30 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }} />
      </div>
      <div
        className="relative h-2.5 rounded-full cursor-pointer"
        style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
        onPointerDown={(e) => drag(e.currentTarget, (x) => emit([x * 359.99, s, v]))(e)}
      >
        <span className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-white border border-black/30 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${(h / 360) * 100}%` }} />
      </div>
      <div className="flex gap-3 items-center">
        <span className="w-8 h-8 rounded-[3px] shrink-0 border border-line" style={{ background: value }} />
        <input
          value={text}
          onChange={(e) => {
            const t = e.target.value.toUpperCase();
            setText(t);
            if (/^#[0-9A-F]{6}$/.test(t)) { setHsv(hexToHsv(t)); lastEmitted.current = t; onChange(t); }
          }}
          spellCheck={false}
          className="flex-1 min-w-0 h-8 bg-transparent border border-blue rounded-[2px] text-center text-xs font-bold tracking-wide outline-none"
        />
      </div>
    </div>
  );
}
