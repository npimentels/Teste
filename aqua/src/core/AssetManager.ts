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

  /** Directional sign with arrow, Frutiger-style typography. */
  sign(text: string, arrow: '←' | '→' | '↑' | '' = ''): THREE.Texture {
    const key = `sign:${text}:${arrow}`;
    return this.cached(key, () => {
      const [c, ctx] = this.canvas(512, 128);
      const g = ctx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#dff3fa');
      ctx.fillStyle = g;
      roundRect(ctx, 4, 4, 504, 120, 28);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#28c5df';
      ctx.stroke();
      ctx.fillStyle = '#087dae';
      ctx.font = '600 46px "Segoe UI", "Frutiger", "Myriad Pro", "Helvetica Neue", Arial, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(text, 40, 66);
      if (arrow) {
        ctx.fillStyle = '#28c5df';
        ctx.beginPath();
        ctx.arc(448, 64, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 52px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(arrow, 448, 66);
      }
      return this.finish(key, c, false);
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
