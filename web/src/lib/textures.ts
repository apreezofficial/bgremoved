// Procedurally generated backdrop textures (no external assets, works offline).
const S = 768;

function rng(seed: number) {
  let t = seed;
  return () => ((t = (t * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function blobs(base: string, colors: string[], seed: number) {
  return () => {
    const r = rng(seed);
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d')!;
    x.fillStyle = base;
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) {
      const px = r() * S, py = r() * S, rad = S * (0.3 + r() * 0.4);
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      const col = colors[i % colors.length];
      g.addColorStop(0, col + 'cc');
      g.addColorStop(1, col + '00');
      x.fillStyle = g;
      x.fillRect(0, 0, S, S);
    }
    return c;
  };
}

function noise(base: [number, number, number], amt: number, seed: number, speck = 0) {
  return () => {
    const r = rng(seed);
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d')!;
    const d = x.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const n = (r() - 0.5) * amt + (speck && r() > 0.992 ? speck : 0);
      d.data[i * 4] = base[0] + n;
      d.data[i * 4 + 1] = base[1] + n;
      d.data[i * 4 + 2] = base[2] + n;
      d.data[i * 4 + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    return c;
  };
}

function wood(seed: number) {
  return () => {
    const r = rng(seed);
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d')!;
    for (let y = 0; y < S; y += 2) {
      const l = 30 + r() * 14 + Math.sin(y / 23) * 5;
      x.fillStyle = `hsl(22, 48%, ${l}%)`;
      x.fillRect(0, y, S, 2);
    }
    for (let i = 0; i < 1400; i++) {
      x.fillStyle = `rgba(0,0,0,${r() * 0.12})`;
      x.fillRect(r() * S, r() * S, 30 + r() * 120, 1);
    }
    return c;
  };
}

function folds(seed: number) {
  return () => {
    const r = rng(seed);
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d')!;
    x.fillStyle = '#d9d9dc';
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 7; i++) {
      x.beginPath();
      x.moveTo(r() * S, r() * S);
      x.lineTo(r() * S, r() * S);
      x.lineTo(r() * S, r() * S);
      x.closePath();
      const v = 175 + r() * 70;
      x.fillStyle = `rgba(${v},${v},${v + 4},0.75)`;
      x.fill();
    }
    return c;
  };
}

function grad(a: string, b: string, angle: number) {
  return () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d')!;
    const t = (angle * Math.PI) / 180;
    const g = x.createLinearGradient(S / 2 - Math.sin(t) * S / 2, S / 2 + Math.cos(t) * S / 2, S / 2 + Math.sin(t) * S / 2, S / 2 - Math.cos(t) * S / 2);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    return c;
  };
}

const GENERATORS = [
  blobs('#5b3fa0', ['#d65db1', '#4d7cff', '#8a4fff'], 3),
  noise([22, 38, 62], 40, 7, 90),
  grad('#ff9966', '#c33764', 160),
  blobs('#0f3d3e', ['#2ec4b6', '#7bdff2', '#1b9aaa'], 11),
  wood(5),
  folds(9),
  grad('#f7c6b9', '#b76e79', 130),
  blobs('#07261f', ['#16a34a', '#34d399', '#0d9488'], 21),
  noise([128, 128, 130], 46, 13),
  blobs('#14102e', ['#ff2fa0', '#3b82f6', '#a855f7'], 31),
  noise([214, 190, 150], 30, 17, -60),
];

export function generateTextures(): string[] {
  return GENERATORS.map((g) => g().toDataURL('image/jpeg', 0.88));
}
