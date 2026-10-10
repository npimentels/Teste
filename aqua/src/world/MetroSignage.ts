import * as THREE from 'three';
import type { AssetManager } from '../core/AssetManager';
import { roundRect } from '../core/AssetManager';
import { createRng } from '../core/math';

/**
 * Aqua Metro visual identity (canvas textures). Modelled on the reference signage: glossy
 * cobalt rounded panels, white bilingual type, line badge, pictogram and arrow.
 */

const FONT = '"Segoe UI", "Frutiger", "Myriad Pro", "Helvetica Neue", Arial, sans-serif';

function cobaltPanel(ctx: CanvasRenderingContext2D, w: number, h: number, r: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3b74df');
  g.addColorStop(0.45, '#1a4fc0');
  g.addColorStop(1, '#123c9e');
  ctx.fillStyle = g;
  roundRect(ctx, 4, 4, w - 8, h - 8, r);
  ctx.fill();
  const gl = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  gl.addColorStop(0, 'rgba(255,255,255,0.32)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  roundRect(ctx, 12, 10, w - 24, h * 0.42, r * 0.8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 6;
  roundRect(ctx, 4, 4, w - 8, h - 8, r);
  ctx.stroke();
}

/** Train pictogram (front view) in a white rounded square. */
function trainIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, s, s, s * 0.2);
  ctx.fill();
  ctx.fillStyle = '#1a4fc0';
  roundRect(ctx, x + s * 0.22, y + s * 0.14, s * 0.56, s * 0.58, s * 0.14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x + s * 0.3, y + s * 0.22, s * 0.4, s * 0.2, s * 0.05);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + s * 0.36, y + s * 0.58, s * 0.05, 0, Math.PI * 2);
  ctx.arc(x + s * 0.64, y + s * 0.58, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a4fc0';
  ctx.lineWidth = s * 0.06;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.32, y + s * 0.88);
  ctx.lineTo(x + s * 0.4, y + s * 0.74);
  ctx.moveTo(x + s * 0.68, y + s * 0.88);
  ctx.lineTo(x + s * 0.6, y + s * 0.74);
  ctx.stroke();
}

function lineBadge(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): number {
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${h}px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('2', x, y);
  const w = ctx.measureText('2').width;
  ctx.font = `600 ${h * 0.34}px ${FONT}`;
  ctx.fillText('Linha 2', x + w + 10, y - h * 0.45);
  ctx.font = `400 ${h * 0.3}px ${FONT}`;
  ctx.fillText('Line 2', x + w + 10, y - h * 0.06);
  return x + w + 10 + Math.max(ctx.measureText('Linha 2').width, 120);
}

export interface MetroSignOptions {
  arrow?: '↓' | '↑' | '→' | '←' | '';
  title: string;
  titleEn?: string;
  footer?: string;
  footerRight?: string;
  line?: boolean;
  icon?: 'train' | 'wc' | 'exit' | 'none';
}

/** Hanging / wall sign in the reference style. 1024×384 (aspect 8:3). */
export function metroSign(assets: AssetManager, key: string, o: MetroSignOptions): THREE.CanvasTexture {
  const { canvas, ctx, texture } = assets.dynamicCanvas(1024, 384, `metroSign:${key}`);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  cobaltPanel(ctx, 1024, 384, 46);
  let x = 40;
  if (o.arrow) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 150px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.arrow, x, 150);
    x += 120;
  }
  if (o.line) {
    x = lineBadge(ctx, x + 10, 205, 150) + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(x, 70, 4, 160);
    x += 30;
  }
  const iconSize = 140;
  const textRight = o.icon && o.icon !== 'none' ? 1024 - iconSize - 70 : 1000;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let fs = 92;
  ctx.font = `600 ${fs}px ${FONT}`;
  while (ctx.measureText(o.title).width > textRight - x && fs > 40) {
    fs -= 4;
    ctx.font = `600 ${fs}px ${FONT}`;
  }
  ctx.fillText(o.title, x, o.titleEn ? 150 : 185);
  if (o.titleEn) {
    ctx.font = `400 ${Math.round(fs * 0.62)}px ${FONT}`;
    ctx.fillStyle = 'rgba(235,245,255,0.95)';
    ctx.fillText(o.titleEn, x, 218);
  }
  if (o.icon === 'train') trainIcon(ctx, 1024 - iconSize - 40, 50, iconSize);
  else if (o.icon === 'wc') {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 1024 - iconSize - 40, 50, iconSize, iconSize, 26);
    ctx.fill();
    ctx.fillStyle = '#1a4fc0';
    ctx.font = `700 70px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('WC', 1024 - 40 - iconSize / 2, 145);
  } else if (o.icon === 'exit') {
    ctx.fillStyle = '#9be22d';
    roundRect(ctx, 1024 - iconSize - 40, 50, iconSize, iconSize, 26);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 96px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('→', 1024 - 40 - iconSize / 2, 122);
  }
  if (o.footer || o.footerRight) {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(40, 262, 944, 3);
    ctx.fillStyle = '#ffffff';
    ctx.font = `500 46px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (o.footer) ctx.fillText(o.footer, 50, 320);
    if (o.footerRight) {
      ctx.textAlign = 'right';
      ctx.fillText(o.footerRight, 980, 320);
    }
  }
  texture.needsUpdate = true;
  return texture;
}

/** Live LED departure board (navy screen, amber-free cyan/white type). Redraw with `draw`. */
export class DepartureBoard {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private last = '';

  constructor(assets: AssetManager, key: string) {
    const d = assets.dynamicCanvas(1024, 384, `board:${key}`);
    this.texture = d.texture;
    this.ctx = d.ctx;
  }

  draw(time: string, rows: Array<{ dest: string; info: string; status: string; highlight?: boolean }>): void {
    const sig = time + JSON.stringify(rows);
    if (sig === this.last) return;
    this.last = sig;
    const c = this.ctx;
    const g = c.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, '#0b2459');
    g.addColorStop(1, '#071a40');
    c.fillStyle = g;
    c.fillRect(0, 0, 1024, 384);
    c.fillStyle = '#1a4fc0';
    c.fillRect(0, 0, 1024, 78);
    c.fillStyle = '#ffffff';
    c.font = `600 40px ${FONT}`;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText('Partidas · Departures', 30, 40);
    c.textAlign = 'right';
    c.font = `600 44px ${FONT}`;
    c.fillStyle = '#9fe6f2';
    c.fillText(time, 994, 40);
    rows.forEach((r, i) => {
      const y = 140 + i * 100;
      c.fillStyle = '#28c5df';
      roundRect(c, 30, y - 34, 68, 68, 14);
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `700 46px ${FONT}`;
      c.textAlign = 'center';
      c.fillText('2', 64, y + 2);
      c.textAlign = 'left';
      c.font = `600 44px ${FONT}`;
      c.fillText(r.dest, 120, y - 10);
      c.font = `400 28px ${FONT}`;
      c.fillStyle = '#9fc3e6';
      c.fillText(r.info, 120, y + 28);
      c.textAlign = 'right';
      c.font = `600 40px ${FONT}`;
      c.fillStyle = r.highlight ? '#9be22d' : '#ffffff';
      c.fillText(r.status, 994, y);
    });
    this.texture.needsUpdate = true;
  }
}

/** Network map: the line, the available stop and the planned (not yet open) ones. */
export function networkMap(assets: AssetManager, here: 'central' | 'park'): THREE.CanvasTexture {
  const { ctx: c, texture } = assets.dynamicCanvas(1024, 512, `netmap:${here}`);
  c.fillStyle = '#f2fbff';
  c.fillRect(0, 0, 1024, 512);
  c.fillStyle = '#1a4fc0';
  c.fillRect(0, 0, 1024, 90);
  c.fillStyle = '#ffffff';
  c.font = `600 44px ${FONT}`;
  c.textBaseline = 'middle';
  c.fillText('Rede Aqua Metro · Network', 34, 46);
  const stops: Array<{ name: string; en: string; x: number; open: boolean; id?: string }> = [
    { name: 'AQUA Central', en: 'Central', x: 150, open: true, id: 'central' },
    { name: 'Parque Flutuante', en: 'Floating Park', x: 430, open: true, id: 'park' },
    { name: 'Cidade das Águas', en: 'Water City', x: 690, open: false },
    { name: 'Porto Bolha', en: 'Bubble Harbour', x: 900, open: false },
  ];
  // line
  c.lineCap = 'round';
  c.strokeStyle = '#28c5df';
  c.lineWidth = 22;
  c.beginPath();
  c.moveTo(150, 250);
  c.lineTo(430, 250);
  c.stroke();
  c.setLineDash([18, 16]);
  c.strokeStyle = '#a9c4d6';
  c.beginPath();
  c.moveTo(430, 250);
  c.lineTo(900, 250);
  c.stroke();
  c.setLineDash([]);
  for (const s of stops) {
    c.fillStyle = s.open ? '#ffffff' : '#eef3f6';
    c.strokeStyle = s.open ? '#1a4fc0' : '#a9c4d6';
    c.lineWidth = 9;
    c.beginPath();
    c.arc(s.x, 250, 26, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    if (s.id === here) {
      c.fillStyle = '#9be22d';
      c.beginPath();
      c.arc(s.x, 250, 13, 0, Math.PI * 2);
      c.fill();
    }
    c.textAlign = 'center';
    c.fillStyle = s.open ? '#0b2f5c' : '#8aa3b5';
    c.font = `600 30px ${FONT}`;
    c.fillText(s.name, s.x, 320);
    c.font = `400 24px ${FONT}`;
    c.fillText(s.en, s.x, 354);
    c.font = `500 22px ${FONT}`;
    c.fillStyle = s.open ? '#3fae66' : '#8aa3b5';
    c.fillText(s.open ? (s.id === here ? 'você está aqui' : 'em operação') : 'em breve', s.x, 190);
  }
  c.textAlign = 'left';
  c.fillStyle = '#0b4f6c';
  c.font = `400 24px ${FONT}`;
  c.fillText('● Linha 2 em operação entre AQUA Central e Parque Flutuante · trens a cada ~1 min', 34, 450);
  texture.needsUpdate = true;
  return texture;
}

/** Digital clock face (HH:MM). */
export class DigitalClock {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private shown = '';
  constructor(assets: AssetManager, key: string) {
    const d = assets.dynamicCanvas(512, 192, `clock:${key}`);
    this.texture = d.texture;
    this.ctx = d.ctx;
  }
  draw(text: string): void {
    if (text === this.shown) return;
    this.shown = text;
    const c = this.ctx;
    c.fillStyle = '#071a40';
    roundRect(c, 0, 0, 512, 192, 40);
    c.fill();
    c.fillStyle = '#9fe6f2';
    c.font = `600 130px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 256, 102);
    this.texture.needsUpdate = true;
  }
}

/** Flowing floor bands (white / sky / cobalt / lime) as in the reference platform floor. */
export function waveFloorTexture(assets: AssetManager): THREE.CanvasTexture {
  const { canvas, ctx: c, texture } = assets.dynamicCanvas(1024, 1024, 'waveFloor');
  c.fillStyle = '#f4f9fc';
  c.fillRect(0, 0, 1024, 1024);
  const bands: Array<[string, number, number, number]> = [
    // colour, centre (0..1), half width (0..1), phase
    ['#c6e7f6', 0.12, 0.07, 0.0],
    ['#2c62cf', 0.3, 0.05, 1.3],
    ['#b6dd57', 0.47, 0.04, 2.1],
    ['#d7eff9', 0.62, 0.08, 0.6],
    ['#2c62cf', 0.82, 0.035, 2.9],
  ];
  for (const [col, cy, hw, ph] of bands) {
    c.fillStyle = col;
    c.beginPath();
    for (let i = 0; i <= 64; i++) {
      const y = (i / 64) * 1024;
      const x = (cy + Math.sin((i / 64) * Math.PI * 2 + ph) * 0.06) * 1024 - hw * 1024;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    for (let i = 64; i >= 0; i--) {
      const y = (i / 64) * 1024;
      const x = (cy + Math.sin((i / 64) * Math.PI * 2 + ph + 0.35) * 0.06) * 1024 + hw * 1024;
      c.lineTo(x, y);
    }
    c.closePath();
    c.fill();
  }
  // subtle polished speckle
  const rng = createRng(77);
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(255,255,255,${0.1 + rng() * 0.2})`;
    c.fillRect(rng() * 1024, rng() * 1024, 2, 2);
  }
  void canvas;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** Lime tactile warning strip with raised dots. */
export function tactileTexture(assets: AssetManager): THREE.CanvasTexture {
  const { ctx: c, texture } = assets.dynamicCanvas(128, 128, 'tactile');
  c.fillStyle = '#b4dc4e';
  c.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const g = c.createRadialGradient(16 + x * 32 - 3, 16 + y * 32 - 3, 1, 16 + x * 32, 16 + y * 32, 10);
      g.addColorStop(0, '#f1ffc8');
      g.addColorStop(1, '#8fbd2a');
      c.fillStyle = g;
      c.beginPath();
      c.arc(16 + x * 32, 16 + y * 32, 9, 0, Math.PI * 2);
      c.fill();
    }
  }
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}
