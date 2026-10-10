import * as THREE from 'three';
import { createRng } from './math';

/**
 * Generates and caches procedural textures (no external image files are required) and keeps
 * track of every GPU resource it created so the game can release them on teardown.
 */
export class AssetManager {
  private readonly textures = new Map<string, THREE.Texture>();
  private maxAnisotropy = 1;

  setRenderer(renderer: THREE.WebGLRenderer): void {
    this.maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  private canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    return [c, ctx];
  }

  private finish(key: string, canvas: HTMLCanvasElement, repeat = true, srgb = true): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(canvas);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = this.maxAnisotropy;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.name = key;
    this.textures.set(key, t);
    return t;
  }

  private cached(key: string, make: () => THREE.Texture): THREE.Texture {
    return this.textures.get(key) ?? make();
  }

  /** Large polished floor tiles with fine grout lines. One texture repeat = `tiles` tiles. */
  floorTiles(): THREE.Texture {
    return this.cached('floorTiles', () => {
      const size = 512;
      const [c, ctx] = this.canvas(size, size);
      const rng = createRng(3);
      const tiles = 4;
      const s = size / tiles;
      for (let y = 0; y < tiles; y++) {
        for (let x = 0; x < tiles; x++) {
          const v = 243 + Math.floor(rng() * 8);
          ctx.fillStyle = `rgb(${v - 4},${v},${Math.min(255, v + 4)})`;
          ctx.fillRect(x * s, y * s, s, s);
          const g = ctx.createLinearGradient(x * s, y * s, x * s + s, y * s + s);
          g.addColorStop(0, 'rgba(255,255,255,0.35)');
          g.addColorStop(0.5, 'rgba(255,255,255,0)');
          g.addColorStop(1, 'rgba(200,225,235,0.18)');
          ctx.fillStyle = g;
          ctx.fillRect(x * s, y * s, s, s);
        }
      }
      ctx.strokeStyle = 'rgba(165,190,200,0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= tiles; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s, 0);
        ctx.lineTo(i * s, size);
        ctx.moveTo(0, i * s);
        ctx.lineTo(size, i * s);
        ctx.stroke();
      }
      return this.finish('floorTiles', c);
    });
  }

  /** Small cyan / white glass mosaic for pool basins. */
  poolMosaic(): THREE.Texture {
    return this.cached('poolMosaic', () => {
      const size = 256;
      const [c, ctx] = this.canvas(size, size);
      const rng = createRng(5);
      const n = 16;
      const s = size / n;
      ctx.fillStyle = '#d9f3f6';
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const r = rng();
          const col = r < 0.55 ? [120 + rng() * 40, 214 + rng() * 25, 230 + rng() * 20] : r < 0.85 ? [70, 180 + rng() * 30, 215 + rng() * 25] : [235, 250, 252];
          ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
          ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
        }
      }
      return this.finish('poolMosaic', c);
    });
  }

  /** Soft speckled lawn. */
  grass(): THREE.Texture {
    return this.cached('grass', () => {
      const size = 256;
      const [c, ctx] = this.canvas(size, size);
      const rng = createRng(9);
      ctx.fillStyle = '#5fb86a';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 5000; i++) {
        const g = 150 + rng() * 70;
        ctx.fillStyle = `rgba(${60 + rng() * 50},${g},${70 + rng() * 40},${0.25 + rng() * 0.35})`;
        const x = rng() * size;
        const y = rng() * size;
        ctx.fillRect(x, y, 1 + rng() * 2, 2 + rng() * 4);
      }
      return this.finish('grass', c);
    });
  }

  /** Pale sand with ripples for aquarium floors. */
  sand(): THREE.Texture {
    return this.cached('sand', () => {
      const size = 256;
      const [c, ctx] = this.canvas(size, size);
      const rng = createRng(13);
      ctx.fillStyle = '#efe6cf';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 3000; i++) {
        const v = 200 + rng() * 55;
        ctx.fillStyle = `rgba(${v},${v - 10},${v - 35},0.35)`;
        ctx.fillRect(rng() * size, rng() * size, 1.5, 1.5);
      }
      ctx.strokeStyle = 'rgba(190,175,140,0.25)';
      for (let y = 0; y < size; y += 9) {
        ctx.beginPath();
        for (let x = 0; x <= size; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.08 + y) * 3);
        ctx.stroke();
      }
      return this.finish('sand', c);
    });
  }

  /** Subtle stone paving for garden paths. */
  paving(): THREE.Texture {
    return this.cached('paving', () => {
      const size = 512;
      const [c, ctx] = this.canvas(size, size);
      const rng = createRng(21);
      ctx.fillStyle = '#e9eef0';
      ctx.fillRect(0, 0, size, size);
      const rows = 8;
      const h = size / rows;
      for (let r = 0; r < rows; r++) {
        let x = r % 2 ? -h : 0;
        while (x < size) {
          const w = h * (1.5 + Math.floor(rng() * 2) * 0.5);
          const v = 226 + rng() * 22;
          ctx.fillStyle = `rgb(${v - 6},${v},${v + 3})`;
          ctx.fillRect(x + 2, r * h + 2, w - 4, h - 4);
          x += w;
        }
      }
      return this.finish('paving', c);
    });
  }

  /** White painted panels with recessed seams (walls). */
  wallPanels(): THREE.Texture {
    return this.cached('wallPanels', () => {
      const size = 256;
      const [c, ctx] = this.canvas(size, size);
      ctx.fillStyle = '#f4f8fa';
      ctx.fillRect(0, 0, size, size);
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(215,230,238,0.4)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(170,195,210,0.55)';
      ctx.fillRect(0, size - 3, size, 3);
      ctx.fillRect(size - 3, 0, 3, size);
      return this.finish('wallPanels', c);
    });
  }

  /** Blue-to-white vertical gradient used as aquarium back walls. */
  tankBackdrop(): THREE.Texture {
    return this.cached('tankBackdrop', () => {
      const [c, ctx] = this.canvas(4, 256);
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#bff4ff');
      g.addColorStop(0.5, '#4cc3e0');
      g.addColorStop(1, '#0d6f9c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 256);
      return this.finish('tankBackdrop', c, false);
    });
  }

  /**
   * AQUA wayfinding sign: cobalt glossy pill, white humanist type, a cyan bubble with the
   * arrow and an optional lime dot. `zoneColor` tints the bubble per destination.
   */
  sign(text: string, arrow: '←' | '→' | '↑' | '' = '', zoneColor = '#28c5df'): THREE.Texture {
    const key = `sign:${text}:${arrow}:${zoneColor}`;
    return this.cached(key, () => {
      const [c, ctx] = this.canvas(1024, 256);
      ctx.clearRect(0, 0, 1024, 256);
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#3f78e0');
      g.addColorStop(0.48, '#1747b5');
      g.addColorStop(0.52, '#0f3a9c');
      g.addColorStop(1, '#1747b5');
      ctx.fillStyle = g;
      roundRect(ctx, 6, 6, 1012, 244, 122);
      ctx.fill();
      // glossy reflection band
      const gloss = ctx.createLinearGradient(0, 6, 0, 128);
      gloss.addColorStop(0, 'rgba(255,255,255,0.55)');
      gloss.addColorStop(1, 'rgba(255,255,255,0.04)');
      ctx.fillStyle = gloss;
      roundRect(ctx, 22, 12, 980, 110, 60);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      roundRect(ctx, 6, 6, 1012, 244, 122);
      ctx.stroke();
      // destination bubble
      const bx = arrow ? 128 : -200;
      if (arrow) {
        const rg = ctx.createRadialGradient(bx - 22, 104, 10, bx, 128, 92);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(0.35, zoneColor);
        rg.addColorStop(1, '#0b6d97');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(bx, 128, 88, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 112px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(arrow, bx, 136);
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 92px "Segoe UI", "Frutiger", "Myriad Pro", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const tx = arrow ? 250 : 80;
      const maxW = 1024 - tx - 90;
      const w = ctx.measureText(text).width;
      if (w > maxW) ctx.font = `600 ${Math.floor((92 * maxW) / w)}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(text, tx, 132);
      // lime dot
      ctx.fillStyle = '#9be22d';
      ctx.beginPath();
      ctx.arc(960, 128, 18, 0, Math.PI * 2);
      ctx.fill();
      return this.finish(key, c, false);
    });
  }

  /** White terrazzo with cobalt, cyan, ocean and a few lime chips (large, calm pattern). */
  terrazzo(): THREE.Texture {
    return this.cached('terrazzo', () => {
      const size = 1024;
      const [c, ctx] = this.canvas(size, size);
      const rng = createRng(31);
      ctx.fillStyle = '#f3f7f9';
      ctx.fillRect(0, 0, size, size);
      // soft cloudy variation
      for (let i = 0; i < 60; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 60 + rng() * 140;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rng() < 0.5 ? '225,236,242' : '255,255,255'},0.5)`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const chips: Array<[string, number]> = [
        ['#5d86d6', 0.22],
        ['#4aa6cc', 0.2],
        ['#8fdcea', 0.24],
        ['#c9d6dd', 0.3],
        ['#b8e27a', 0.04],
      ];
      for (let i = 0; i < 1500; i++) {
        let r = rng();
        let col = chips[0][0];
        for (const [cc, w] of chips) {
          if (r < w) {
            col = cc;
            break;
          }
          r -= w;
        }
        const x = rng() * size;
        const y = rng() * size;
        const s = 1.2 + rng() * rng() * 5;
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.3 + rng() * 0.35;
        ctx.beginPath();
        const n = 5 + Math.floor(rng() * 3);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + rng() * 0.5;
          const rr = s * (0.6 + rng() * 0.5);
          if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // large slab joints
      ctx.strokeStyle = 'rgba(160,185,198,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, size, size);
      return this.finish('terrazzo', c);
    });
  }

  /** Glass mosaic in cobalt / ocean / cyan / white — pools, wainscots, accent bands. */
  cobaltMosaic(): THREE.Texture {
    return this.cached('cobaltMosaic', () => {
      const size = 256;
      const [c, ctx] = this.canvas(size, size);
      const rng = createRng(17);
      const n = 16;
      const s = size / n;
      ctx.fillStyle = '#dfeef4';
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const r = rng();
          const col = r < 0.42 ? [23, 71, 181] : r < 0.7 ? [8, 125, 174] : r < 0.88 ? [40, 197, 223] : [235, 248, 252];
          const j = (rng() - 0.5) * 24;
          ctx.fillStyle = `rgb(${Math.max(0, col[0] + j) | 0},${Math.max(0, col[1] + j) | 0},${Math.min(255, col[2] + j) | 0})`;
          ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(x * s + 2, y * s + 2, s - 5, 3);
        }
      }
      return this.finish('cobaltMosaic', c);
    });
  }

  /** White wall panels with soft vertical flutes and a recessed joint every panel. */
  flutedPanels(): THREE.Texture {
    return this.cached('flutedPanels', () => {
      const w = 512;
      const h = 512;
      const [c, ctx] = this.canvas(w, h);
      ctx.fillStyle = '#f4f8fa';
      ctx.fillRect(0, 0, w, h);
      const flutes = 16;
      const fw = w / flutes;
      for (let i = 0; i < flutes; i++) {
        const g = ctx.createLinearGradient(i * fw, 0, (i + 1) * fw, 0);
        g.addColorStop(0, 'rgba(200,218,228,0.55)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.9)');
        g.addColorStop(0.7, 'rgba(240,246,249,0.6)');
        g.addColorStop(1, 'rgba(190,210,222,0.6)');
        ctx.fillStyle = g;
        ctx.fillRect(i * fw, 0, fw, h);
      }
      ctx.fillStyle = 'rgba(150,178,195,0.6)';
      ctx.fillRect(0, h - 4, w, 4);
      return this.finish('flutedPanels', c);
    });
  }

  /** Circular rug pattern: concentric waves in cyan / cobalt on pearl. */
  rug(): THREE.Texture {
    return this.cached('rug', () => {
      const size = 512;
      const [c, ctx] = this.canvas(size, size);
      ctx.fillStyle = '#e8f4f8';
      ctx.fillRect(0, 0, size, size);
      const cx = size / 2;
      const rings = ['#1747b5', '#ffffff', '#28c5df', '#e8f4f8', '#087dae', '#ffffff', '#9fe6f2'];
      rings.forEach((col, i) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = 14 - i;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.02) {
          const r = 230 - i * 30 + Math.sin(a * 6 + i) * 6;
          const x = cx + Math.cos(a) * r;
          const y = cx + Math.sin(a) * r;
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      return this.finish('rug', c, false);
    });
  }

  /** Creates (not cached) a canvas texture the caller redraws, e.g. interactive screens. */
  dynamicCanvas(w: number, h: number, key: string): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture } {
    const [canvas, ctx] = this.canvas(w, h);
    const texture = this.finish(`${key}:${this.textures.size}`, canvas, false);
    return { canvas, ctx, texture };
  }

  dispose(): void {
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
