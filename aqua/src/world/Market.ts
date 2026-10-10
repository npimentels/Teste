import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import type { WorldBuilder } from './Builders';
import { LAYOUT, registerPaving } from './WorldLayout';
import { BRANDS, ProductBatch, type ProductShape } from './Products';
import { teardropLamp } from './Furniture';
import { UseSpot } from '../systems/Interactables';
import { VendingMachine } from '../systems/VendingMachine';
import type { Collider } from '../physics/Collision';
import type { Updatable } from '../core/types';
import { roundRect } from '../core/AssetManager';
import { createRng, damp, randRange } from '../core/math';
import { yawFacing } from '../systems/Seats';

const K = LAYOUT.market;
const CEIL = 4.2;
const FONT = '"Segoe UI", "Frutiger", "Myriad Pro", "Helvetica Neue", Arial, sans-serif';

interface Fridge {
  door: THREE.Object3D;
  open: boolean;
  angle: number;
  timer: number;
  hinge: THREE.Vector3;
  side: number;
  light: THREE.MeshBasicMaterial;
  category: string;
  brands: Array<{ brand: number; shape: ProductShape }>;
}

/** Fictional product sheets shown when examining products. */
const PRODUCT_INFO: Record<number, string> = {
  0: 'Água mineral natural de fonte, 500 ml. Garrafa 100% reciclável · Recarregue no Átrio.',
  1: 'Água com gás de bolhas finas, 500 ml. Leve, refrescante e sem açúcar.',
  2: 'Chá verde gelado com lima-da-pérsia, 350 ml. Sem conservantes.',
  3: 'Isotônico Maré sabor frutas cítricas, 473 ml. Para depois de explorar o complexo.',
  4: 'Suco de laranja integral, 1 litro. Laranjas colhidas nas estufas do platô.',
  5: 'Iogurte natural cremoso, 170 g. Fermentos vivos e embalagem compostável.',
  6: 'Geleia de frutas vermelhas, 220 g. Pote de vidro retornável.',
  7: 'Cereal integral com aveia e mel, 300 g. Fibras e grãos inteiros.',
};

/**
 * Mercado Aqua — futuristic grocery store (reference: aisle of glass-door fridges on cobalt
 * rounded bases with lime caps, cobalt blob ceiling with downlights, hanging glass planters,
 * an arched window at the end and a reflective "water" floor).
 *
 * Interactions: automatic entrance doors, every fridge door opens, products can be examined,
 * shelves have price tags, baskets can be carried, the checkout beeps, seats by the window and
 * a vending machine outside.
 */
export class MercadoAqua implements Updatable {
  private readonly fridges: Fridge[] = [];
  private readonly doors: Array<{ leaf: THREE.Object3D; closedZ: number; dir: number }> = [];
  private doorOpen = 0;
  private doorCollider!: Collider;
  private readonly checkoutScreen: { ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture };
  private checkoutFlash = 0;

  constructor(private readonly ctx: WorldContext) {
    const b = ctx.builder;
    this.buildShell(b);
    this.buildFridges(b);
    this.buildShelves(b);
    this.buildProduce(b);
    this.checkoutScreen = this.buildCheckout(b);
    this.buildCeiling(b);
    this.buildLounge(b);
    b.flush('market');
  }

  // ---------------------------------------------------------------------------------------
  // Shell: floor, walls, glass facade with automatic doors, arched window, roof, signage
  // ---------------------------------------------------------------------------------------
  private buildShell(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const cx = (K.x0 + K.x1) / 2;
    const cz = (K.z0 + K.z1) / 2;
    // reflective "water" floor: glossy cobalt-cyan with a soft wave pattern
    const floorTex = waveTexture(ctx);
    floorTex.repeat.set(1 / 6, 1 / 6);
    const floor = new THREE.MeshPhysicalMaterial({ name: 'marketFloor', color: 0x9fd2ff, map: floorTex, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 });
    floor.userData.worldUV = true;
    b.box(floor, cx, -0.06, cz, K.x1 - K.x0, 0.1, K.z1 - K.z0, { cast: false });
    // north / south walls: white outside, cobalt band, lime top line
    for (const z of [K.z0, K.z1]) {
      b.box(m.whiteCeramic, cx, 0, z, K.x1 - K.x0 + 0.3, CEIL, 0.3, { collide: 'tile' });
      const inner = z === K.z0 ? z + 0.16 : z - 0.16;
      b.box(m.cobaltCeramic, cx, 0, inner, K.x1 - K.x0 - 0.3, 0.9, 0.02, { cast: false });
      b.box(m.limeGlossy, cx, 0.9, inner, K.x1 - K.x0 - 0.3, 0.05, 0.025, { cast: false });
      const outer = z === K.z0 ? z - 0.16 : z + 0.16;
      b.box(m.cobaltCeramic, cx, CEIL - 0.7, outer, K.x1 - K.x0 + 0.3, 0.5, 0.03, { cast: false });
    }
    // east wall with the arched window (real opening, glazed)
    const az0 = cz - 2.8;
    const az1 = cz + 2.8;
    const archR = (az1 - az0) / 2;
    const springY = CEIL - 0.35 - archR;
    const shape = new THREE.Shape([new THREE.Vector2(-K.z1 - 0.15, 0), new THREE.Vector2(-K.z0 + 0.15, 0), new THREE.Vector2(-K.z0 + 0.15, CEIL), new THREE.Vector2(-K.z1 - 0.15, CEIL)]);
    const arch = new THREE.Path();
    arch.moveTo(-az1, 0.55);
    arch.lineTo(-az0, 0.55);
    arch.lineTo(-az0, springY);
    arch.absarc(-cz, springY, archR, 0, Math.PI, false);
    arch.lineTo(-az1, 0.55);
    shape.holes.push(arch);
    const eastGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false, curveSegments: 40 });
    eastGeo.rotateY(Math.PI / 2);
    b.place(eastGeo, m.whiteCeramic, K.x1 - 0.15, 0, 0);
    eastGeo.dispose();
    b.collision.addBox({ x: K.x1, z: cz, sx: 0.3, sz: K.z1 - K.z0 + 0.3, minY: 0, maxY: CEIL, surface: 'tile' });
    // arch frame + mullions + glass
    const archFrame = new THREE.Shape();
    archFrame.moveTo(-az1 - 0.12, 0.43);
    archFrame.lineTo(-az0 + 0.12, 0.43);
    archFrame.lineTo(-az0 + 0.12, springY);
    archFrame.absarc(-cz, springY, archR + 0.12, 0, Math.PI, false);
    archFrame.lineTo(-az1 - 0.12, 0.43);
    const inner = new THREE.Path();
    inner.moveTo(-az1, 0.55);
    inner.lineTo(-az0, 0.55);
    inner.lineTo(-az0, springY);
    inner.absarc(-cz, springY, archR, 0, Math.PI, false);
    inner.lineTo(-az1, 0.55);
    archFrame.holes.push(inner);
    const frameGeo = new THREE.ExtrudeGeometry(archFrame, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 40 });
    frameGeo.rotateY(Math.PI / 2);
    b.place(frameGeo, m.cobaltCeramic, K.x1 - 0.24, 0, 0, { cast: false });
    frameGeo.dispose();
    const glassShape = new THREE.Shape();
    glassShape.moveTo(-az1, 0.55);
    glassShape.lineTo(-az0, 0.55);
    glassShape.lineTo(-az0, springY);
    glassShape.absarc(-cz, springY, archR, 0, Math.PI, false);
    glassShape.lineTo(-az1, 0.55);
    const glassGeo = new THREE.ShapeGeometry(glassShape, 40);
    glassGeo.rotateY(Math.PI / 2);
    b.place(glassGeo, m.glass, K.x1, 0, 0, { cast: false, receive: false });
    glassGeo.dispose();
    for (const z of [cz - 1.4, cz, cz + 1.4]) b.box(m.whiteCeramic, K.x1 - 0.02, 0.55, z, 0.06, springY - 0.55 + (z === cz ? archR : Math.sqrt(archR * archR - (z - cz) ** 2)), 0.06, { cast: false });
    b.box(m.whiteCeramic, K.x1 - 0.02, springY, cz, 0.06, 0.06, archR * 2, { cast: false });
    // west facade: glass curtain with the automatic double door and the big sign
    const dz0 = cz - 1.3;
    const dz1 = cz + 1.3;
    for (const [a, c] of [
      [K.z0 + 0.15, dz0 - 0.3],
      [dz1 + 0.3, K.z1 - 0.15],
    ]) {
      b.box(m.glass, K.x0, 0.35, (a + c) / 2, 0.04, CEIL - 1.15, c - a, { cast: false, receive: false });
      b.box(m.cobaltCeramic, K.x0, 0, (a + c) / 2, 0.3, 0.35, c - a, { radius: 0.06 });
      b.collision.addBox({ x: K.x0, z: (a + c) / 2, sx: 0.3, sz: c - a, minY: 0, maxY: CEIL, surface: 'glass' });
      const n = Math.max(1, Math.round((c - a) / 1.8));
      for (let i = 0; i <= n; i++) b.box(m.whiteCeramic, K.x0, 0.35, a + ((c - a) * i) / n, 0.14, CEIL - 1.15, 0.12, { radius: 0.03, cast: false });
    }
    for (const z of [dz0 - 0.15, dz1 + 0.15]) b.box(m.cobaltCeramic, K.x0, 0, z, 0.36, 2.8, 0.3, { radius: 0.1, collide: 'tile' });
    b.box(m.whiteCeramic, K.x0, 2.8, cz, 0.3, CEIL - 0.8 - 2.8, dz1 - dz0 + 0.6);
    // fascia band with the sign
    b.box(m.whiteCeramic, K.x0 - 0.1, CEIL - 0.8, cz, 0.4, 0.8, K.z1 - K.z0 + 0.3, { radius: 0.08 });
    b.box(m.limeGlossy, K.x0 - 0.31, CEIL - 0.78, cz, 0.02, 0.06, K.z1 - K.z0 + 0.2, { cast: false });
    const signTex = marketSign(ctx, 'Mercado Aqua', 'frescor · cor · água gelada', '#1747b5', 'facade');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false }));
    sign.position.set(K.x0 - 0.33, CEIL - 0.4, cz);
    sign.rotation.y = -Math.PI / 2;
    b.root.add(sign);
    // canopy over the entrance (rounded slab on chrome rods)
    b.box(m.whiteCeramic, K.x0 - 1.15, 2.75, cz, 2.0, 0.14, 4.4, { radius: 0.07 });
    b.box(m.cyanAcrylic, K.x0 - 2.1, 2.72, cz, 0.06, 0.06, 4.2, { cast: false });
    for (const z of [cz - 2, cz + 2]) b.cylinder(m.chrome, K.x0 - 2.0, 0, z, 0.04, 0.04, 2.75, { collide: 'metal', segments: 10, cast: false });
    // automatic sliding doors
    const half = (dz1 - dz0) / 2;
    for (const e of [-1, 1]) {
      const leaf = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.5, half), m.glass);
      glass.position.y = 1.27;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, half), m.cobaltCeramic);
      bar.position.y = 1.0;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.55, 0.05), m.chrome);
      frame.position.set(0, 1.27, -e * (half / 2));
      leaf.add(glass, bar, frame);
      const closedZ = cz + (e * half) / 2;
      leaf.position.set(K.x0, 0, closedZ);
      b.root.add(leaf);
      this.doors.push({ leaf, closedZ, dir: e });
    }
    this.doorCollider = b.collision.addBox({ x: K.x0, z: cz, sx: 0.2, sz: dz1 - dz0, minY: 0, maxY: 2.6, surface: 'glass' });
    // roof
    b.box(m.whiteCeramic, cx, CEIL, cz, K.x1 - K.x0 + 0.6, 0.35, K.z1 - K.z0 + 0.6, { radius: 0.12 });
    b.box(m.glossyCyan, cx, CEIL + 0.14, K.z1 + 0.31, K.x1 - K.x0 + 0.4, 0.06, 0.02, { cast: false });
    // entrance mat + paving + outdoor vending machine
    b.box(m.paving, K.x0 - 2.15, -0.08, cz, 4.3, 0.1, 6.4, { cast: false });
    registerPaving(K.x0 - 4.3, cz - 3.2, K.x0, cz + 3.2);
    const vm = new VendingMachine(ctx, 'market-vending', K.x0 - 0.75, K.z0 + 1.2, -Math.PI / 2);
    ctx.addInteractable(vm);
    ctx.addModal(vm);
    ctx.addUpdatable(vm);
    ctx.audio.addWaterSource('hum', { x: cx, y: 2, z: cz }, 0.25, true);
  }

  // ---------------------------------------------------------------------------------------
  // Glass-door fridges lining the central aisle
  // ---------------------------------------------------------------------------------------
  private buildFridges(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const cz = (K.z0 + K.z1) / 2;
    const unit = 1.25;
    const x0 = 26;
    const count = 12;
    const depth = 0.78;
    const H = 2.25;
    const batch = new ProductBatch();
    const rng = createRng(31);
    const catalogue: Record<string, Array<{ brand: number; shape: ProductShape }>> = {
      Águas: [
        { brand: 0, shape: 'bottle' },
        { brand: 1, shape: 'bottle' },
        { brand: 0, shape: 'tallBottle' },
      ],
      Refrescos: [
        { brand: 2, shape: 'bottle' },
        { brand: 3, shape: 'can' },
        { brand: 1, shape: 'can' },
      ],
      Sucos: [
        { brand: 4, shape: 'tallBottle' },
        { brand: 4, shape: 'carton' },
        { brand: 2, shape: 'carton' },
      ],
      Laticínios: [
        { brand: 5, shape: 'cup' },
        { brand: 5, shape: 'carton' },
        { brand: 6, shape: 'cup' },
      ],
    };
    const north: string[] = ['Águas', 'Águas', 'Águas', 'Refrescos', 'Refrescos', 'Refrescos', 'Águas', 'Águas', 'Refrescos', 'Refrescos', 'Águas', 'Refrescos'];
    const south: string[] = ['Sucos', 'Sucos', 'Sucos', 'Laticínios', 'Laticínios', 'Laticínios', 'Sucos', 'Sucos', 'Laticínios', 'Laticínios', 'Sucos', 'Laticínios'];
    const glassDoor = m.glass;
    for (const side of [-1, 1]) {
      // side −1: north row facing +z; side +1: south row facing −z
      const faceZ = cz + side * 1.78;
      const backZ = faceZ + side * depth;
      const midZ = (faceZ + backZ) / 2;
      const rotY = side < 0 ? 0 : Math.PI;
      const xs = x0;
      const xe = x0 + unit * count;
      // continuous cobalt rounded base with lime cap (reference)
      b.box(m.cobaltCeramic, (xs + xe) / 2, 0, midZ, xe - xs + 0.1, 0.32, depth + 0.06, { radius: 0.14 });
      b.box(m.limeGlossy, (xs + xe) / 2, 0.32, midZ, xe - xs + 0.1, 0.05, depth + 0.08, { radius: 0.02 });
      // cabinet shell and top header
      b.box(m.whiteCeramic, (xs + xe) / 2, 0.37, backZ - side * 0.04, xe - xs, H - 0.37, 0.08, { cast: false });
      b.box(m.whiteCeramic, (xs + xe) / 2, H, midZ, xe - xs + 0.1, 0.35, depth + 0.06, { radius: 0.08 });
      b.box(m.emissiveCyan, (xs + xe) / 2, H + 0.04, faceZ - side * 0.035, xe - xs, 0.03, 0.01, { cast: false, receive: false });
      for (const x of [xs - 0.05, xe + 0.05]) b.box(m.whiteCeramic, x, 0.37, midZ, 0.1, H - 0.37, depth + 0.06, { radius: 0.03 });
      b.collision.addBox({ x: (xs + xe) / 2, z: midZ, sx: xe - xs + 0.2, sz: depth + 0.1, minY: 0, maxY: H + 0.35, surface: 'glass' });
      const cats = side < 0 ? north : south;
      for (let i = 0; i < count; i++) {
        const ux0 = xs + i * unit;
        const ux = ux0 + unit / 2;
        // mullion
        b.box(m.chrome, ux0, 0.37, faceZ - side * 0.02, 0.05, H - 0.37, 0.04, { cast: false });
        // lit back panel + shelves
        const light = new THREE.MeshBasicMaterial({ color: 0xcfefff, toneMapped: false });
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(unit - 0.08, H - 0.45), light);
        panel.position.set(ux, 0.37 + (H - 0.45) / 2, backZ - side * 0.085);
        panel.rotation.y = rotY;
        b.root.add(panel);
        const cat = cats[i];
        const brands = catalogue[cat];
        for (const [k, y] of [0.42, 0.86, 1.3, 1.74].entries()) {
          b.box(m.glass, ux, y - 0.02, midZ, unit - 0.1, 0.02, depth - 0.16, { cast: false, receive: false });
          b.box(m.chrome, ux, y - 0.03, faceZ - side * 0.1, unit - 0.1, 0.035, 0.01, { cast: false });
          const item = brands[(k + i) % brands.length];
          const per = item.shape === 'tallBottle' ? 5 : item.shape === 'carton' ? 6 : item.shape === 'cup' ? 7 : 6;
          for (let j = 0; j < per; j++) {
            const px = ux0 + 0.1 + ((unit - 0.2) * (j + 0.5)) / per;
            for (const dd of [0.18, 0.4]) batch.add(item.shape, px + randRange(rng, -0.005, 0.005), y, faceZ + side * dd, rotY + randRange(rng, -0.15, 0.15), item.brand);
          }
        }
        // the door (hinged on the mullion side), handle and frame — one dynamic group
        const door = new THREE.Group();
        const dw = unit - 0.06;
        const pane = new THREE.Mesh(new THREE.BoxGeometry(dw, H - 0.45, 0.025), glassDoor);
        pane.position.set(side < 0 ? dw / 2 : -dw / 2, (H - 0.45) / 2, 0);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 0.04), m.chrome);
        handle.position.set(side < 0 ? dw - 0.08 : -dw + 0.08, (H - 0.45) / 2, -side * 0.04);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(dw, 0.04, 0.035), m.chrome);
        rail.position.set(pane.position.x, 0.02, 0);
        door.add(pane, handle, rail);
        const hingeX = side < 0 ? ux0 + 0.03 : ux0 + unit - 0.03;
        door.position.set(hingeX, 0.4, faceZ - side * 0.03);
        b.root.add(door);
        const fridge: Fridge = { door, open: false, angle: 0, timer: 0, hinge: new THREE.Vector3(hingeX, 1.2, faceZ), side, light, category: cat, brands };
        this.fridges.push(fridge);
        const spot = new THREE.Vector3(ux, 1.2, faceZ - side * 0.05);
        ctx.addInteractable(
          new UseSpot(`market-fridge-${side < 0 ? 'n' : 's'}${i}`, spot, new THREE.Vector3(unit / 2 - 0.05, 0.8, 0.08), 0, () => (fridge.open ? `Fechar geladeira · ${cat}` : `Abrir geladeira · ${cat}`), () => this.toggleFridge(fridge), 2.6),
        );
        // examine: a spot inside the open fridge
        ctx.addInteractable(
          new UseSpot(
            `market-examine-${side < 0 ? 'n' : 's'}${i}`,
            new THREE.Vector3(ux, 1.1, midZ),
            new THREE.Vector3(unit / 2 - 0.12, 0.7, depth / 2 - 0.12),
            0,
            () => `Examinar produtos · ${cat}`,
            () => this.examine(fridge),
            2.8,
            () => fridge.open && Math.abs(fridge.angle) > 0.8,
          ),
        );
        if (i % 3 === 1) {
          // category sign over the fridge row
          const tex = marketSign(ctx, cat, cat === 'Águas' ? 'água mineral & com gás' : cat === 'Refrescos' ? 'chás · isotônicos · latas' : cat === 'Sucos' ? 'sucos integrais' : 'iogurtes & leites', side < 0 ? '#1d6fe0' : '#5fae12', `fr-${side}-${i}`);
          const p = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
          p.position.set(ux + unit / 2, H + 0.18, faceZ - side * 0.045);
          p.rotation.y = rotY;
          b.root.add(p);
        }
      }
    }
    batch.build(b.root, ctx.assets, 'fridgeProducts');
    ctx.audio.addWaterSource('hum', { x: 33, y: 1, z: cz }, 0.18, true);
  }

  // ---------------------------------------------------------------------------------------
  // Gondola shelves (grocery) with price tags
  // ---------------------------------------------------------------------------------------
  private buildShelves(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const batch = new ProductBatch();
    const rng = createRng(77);
    const tagTex = priceTagTexture(ctx);
    const tagMat = new THREE.MeshBasicMaterial({ name: 'priceTags', map: tagTex, toneMapped: false });
    const runs: Array<{ x0: number; x1: number; z: number; face: number; depth: number; label: string; items: Array<{ brand: number; shape: ProductShape }> }> = [
      // wall shelving on the north wall (faces +z)
      { x0: 27, x1: 41, z: K.z0 + 0.4, face: 1, depth: 0.45, label: 'Mercearia', items: [{ brand: 7, shape: 'box' }, { brand: 6, shape: 'jar' }, { brand: 0, shape: 'tallBottle' }] },
      // double-sided gondola: both faces
      { x0: 27.5, x1: 40.5, z: 14.25 - 0.22, face: -1, depth: 0.44, label: 'Mercearia', items: [{ brand: 6, shape: 'jar' }, { brand: 7, shape: 'box' }, { brand: 2, shape: 'jar' }] },
      { x0: 27.5, x1: 40.5, z: 14.25 + 0.22, face: 1, depth: 0.44, label: 'Café da manhã', items: [{ brand: 7, shape: 'box' }, { brand: 5, shape: 'jar' }, { brand: 4, shape: 'box' }] },
      // wall shelving on the south wall (faces −z)
      { x0: 27, x1: 41, z: K.z1 - 0.4, face: -1, depth: 0.45, label: 'Conservas', items: [{ brand: 6, shape: 'jar' }, { brand: 3, shape: 'can' }, { brand: 2, shape: 'jar' }] },
    ];
    for (const [ri, r] of runs.entries()) {
      const len = r.x1 - r.x0;
      const mid = (r.x0 + r.x1) / 2;
      const rotY = r.face > 0 ? 0 : Math.PI;
      const back = r.z - r.face * (r.depth / 2);
      b.box(m.whiteCeramic, mid, 0, r.z, len, 0.14, r.depth, { radius: 0.04 });
      b.box(m.cobaltCeramic, mid, 0, r.z + r.face * (r.depth / 2 - 0.02), len, 0.14, 0.03, { cast: false });
      b.box(m.whiteCeramic, mid, 0.14, back + r.face * 0.02, len, 1.86, 0.04, { cast: false });
      for (let x = r.x0; x <= r.x1 + 0.01; x += len / Math.round(len / 1.3)) b.box(m.whiteCeramic, x, 0, r.z, 0.04, 2.0, r.depth, { cast: false });
      b.collision.addBox({ x: mid, z: r.z, sx: len, sz: r.depth, minY: 0, maxY: 2.0, surface: 'tile' });
      for (const [k, y] of [0.14, 0.62, 1.1, 1.58].entries()) {
        if (k > 0) b.box(m.whiteCeramic, mid, y - 0.03, r.z, len, 0.03, r.depth, { cast: false });
        // price tag strip on the shelf edge
        const strip = new THREE.PlaneGeometry(len, 0.045);
        const uv = strip.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len / 1.2));
        b.place(strip, tagMat, mid, y - 0.012, r.z + r.face * (r.depth / 2 + 0.003), { rotY, cast: false, receive: false });
        strip.dispose();
        const item = r.items[(k + ri) % r.items.length];
        const step = item.shape === 'box' ? 0.17 : item.shape === 'jar' ? 0.11 : 0.1;
        for (let x = r.x0 + 0.12; x < r.x1 - 0.1; x += step) {
          if (rng() < 0.06) continue; // a few gaps, like a real shelf
          batch.add(item.shape, x, y, r.z + r.face * (r.depth / 2 - 0.08), rotY + randRange(rng, -0.08, 0.08), item.brand);
          if (item.shape !== 'box') batch.add(item.shape, x, y, r.z + r.face * (r.depth / 2 - 0.22), rotY, item.brand);
        }
      }
      // category sign on top
      const tex = marketSign(ctx, r.label, ri % 2 ? 'grãos · cafés · cereais' : 'potes · geleias · conservas', '#1747b5', `sh-${ri}`);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
      p.position.set(mid, 2.3, r.z + r.face * (r.depth / 2 - 0.1));
      p.rotation.y = rotY;
      b.root.add(p);
      // examine spot per run (centre)
      const items = r.items;
      ctx.addInteractable(
        new UseSpot(`market-shelf-${ri}`, new THREE.Vector3(mid, 1.0, r.z + r.face * (r.depth / 2 - 0.1)), new THREE.Vector3(len / 2, 0.9, 0.18), 0, () => `Examinar prateleira · ${r.label}`, () => this.showProducts(r.label, items), 2.4),
      );
    }
    batch.build(b.root, ctx.assets, 'shelfProducts');
  }

  // ---------------------------------------------------------------------------------------
  // Produce islands (cobalt bases, lime caps) with fruit, and baskets
  // ---------------------------------------------------------------------------------------
  private buildProduce(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const batch = new ProductBatch();
    const rng = createRng(5);
    const fruitColors = [0xff8a1e, 0xe8352e, 0x8fd12a, 0xffd23a, 0xff6f8a];
    for (const [i, x] of [29.5, 33.5, 37.5].entries()) {
      const z = 23.2;
      b.box(m.cobaltCeramic, x, 0, z, 2.6, 0.62, 1.2, { radius: 0.3, collide: 'tile' });
      b.box(m.limeGlossy, x, 0.62, z, 2.7, 0.06, 1.3, { radius: 0.03 });
      b.box(m.whiteCeramic, x, 0.68, z, 2.5, 0.1, 1.1, { radius: 0.05 });
      for (const [k, dx] of [-0.85, 0, 0.85].entries()) {
        const color = fruitColors[(i * 3 + k) % fruitColors.length];
        for (let n = 0; n < 34; n++) {
          const a = rng() * Math.PI * 2;
          const rr = Math.sqrt(rng()) * 0.36;
          const layer = rr < 0.18 ? (rng() < 0.5 ? 0.07 : 0) : 0;
          batch.add('fruit', x + dx + Math.cos(a) * rr, 0.78 + layer, z + Math.sin(a) * rr * 1.2, rng() * 6, 0, randRange(rng, 0.85, 1.15), color);
        }
        b.torus(m.chrome, x + dx, 0.78, z, 0.4, 0.015, { rotX: Math.PI / 2, cast: false });
      }
      const tex = marketSign(ctx, 'Hortifruti', 'frutas das estufas do platô', '#5fae12', `hf-${i}`);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
      p.position.set(x, 0.35, z - 0.61);
      p.rotation.y = Math.PI;
      b.root.add(p);
      ctx.addInteractable(
        new UseSpot(`market-produce-${i}`, new THREE.Vector3(x, 0.85, z), new THREE.Vector3(1.25, 0.2, 0.6), 0, () => 'Examinar frutas', () => ctx.showCard('<b>Hortifruti</b><br>Laranjas, maçãs, limas e carambolas cultivadas nas estufas hidropônicas do platô. Colhidas hoje de manhã.', 6), 2.4),
      );
    }
    batch.build(b.root, ctx.assets, 'produce');
    // baskets: a stack by the door and two carriable ones
    const basketMat = m.cyanAcrylic;
    for (let k = 0; k < 4; k++) this.basketMesh(b, basketMat, K.x0 + 0.9, 0.02 + k * 0.09, K.z1 - 1.0, true);
    for (const [k, z] of [K.z1 - 1.8, K.z1 - 2.4].entries()) {
      const mesh = this.basketMesh(b, k ? m.limeGlossy : basketMat, 0, 0, 0, false)!;
      mesh.position.set(K.x0 + 0.9, 0.17, z);
      ctx.scene.add(mesh);
      const ball = ctx.physics.addBall(`market-basket-${k}`, 'cesta de compras', mesh, 0.17);
      ball.upright = true;
      ctx.addInteractable(ball);
    }
  }

  private basketMesh(b: WorldBuilder, mat: THREE.Material, x: number, y: number, z: number, batched: boolean): THREE.Mesh | null {
    const key = 'basket';
    let geo = basketGeoCache.get(key);
    if (!geo) {
      const body = new THREE.CylinderGeometry(0.22, 0.17, 0.2, 4, 1, true);
      body.rotateY(Math.PI / 4);
      body.scale(1.25, 1, 0.8);
      body.translate(0, 0.1, 0);
      const bottom = new THREE.BoxGeometry(0.33, 0.015, 0.23).translate(0, 0.0075, 0);
      const handle = new THREE.TorusGeometry(0.16, 0.012, 6, 20, Math.PI).translate(0, 0.2, 0);
      const parts = [body, bottom, handle].map((g) => (g.index ? g.toNonIndexed() : g));
      parts.forEach((g) => {
        for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
      });
      geo = mergeGeoms(parts);
      basketGeoCache.set(key, geo);
    }
    if (batched) {
      b.place(geo, mat, x, y, z, { cast: false });
      return null;
    }
    const mesh = new THREE.Mesh(geo.clone().translate(0, -0.12, 0), mat);
    mesh.castShadow = true;
    return mesh;
  }

  // ---------------------------------------------------------------------------------------
  // Checkout near the entrance
  // ---------------------------------------------------------------------------------------
  private buildCheckout(b: WorldBuilder): { ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture } {
    const ctx = this.ctx;
    const m = b.mats;
    const x = 22.6;
    const z = K.z0 + 2.4;
    // rounded counter: white body, cobalt front, lime top edge, conveyor
    b.box(m.whiteCeramic, x, 0, z, 3.2, 0.9, 0.9, { radius: 0.25, collide: 'tile' });
    b.box(m.cobaltCeramic, x, 0.08, z + 0.455, 3.0, 0.7, 0.02, { radius: 0.01, cast: false });
    b.box(m.limeGlossy, x, 0.9, z, 3.24, 0.04, 0.94, { radius: 0.02 });
    b.box(m.glossBlack, x - 0.5, 0.94, z, 1.8, 0.02, 0.5, { cast: false });
    b.cylinder(m.chrome, x + 0.9, 0.94, z - 0.1, 0.05, 0.05, 0.35, { segments: 12, cast: false });
    const scr = ctx.assets.dynamicCanvas(256, 160, 'checkout');
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ map: scr.texture, toneMapped: false }));
    screen.position.set(x + 0.9, 1.42, z - 0.08);
    b.root.add(screen);
    const screenBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.03), m.whiteCeramic);
    screenBack.position.set(x + 0.9, 1.42, z - 0.1);
    b.root.add(screenBack);
    // scanner glow
    b.box(m.emissiveCyan, x + 0.3, 0.95, z, 0.3, 0.005, 0.22, { cast: false, receive: false });
    const sign = marketSign(ctx, 'Caixa', 'pague com um sorriso · cortesia', '#1d6fe0', 'checkout');
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: sign, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
    p.position.set(x, 2.9, z);
    b.root.add(p);
    b.cylinder(m.chrome, x - 0.6, 3.1, z, 0.008, 0.008, CEIL - 3.1, { segments: 6, cast: false });
    b.cylinder(m.chrome, x + 0.6, 3.1, z, 0.008, 0.008, CEIL - 3.1, { segments: 6, cast: false });
    ctx.addInteractable(
      new UseSpot('market-checkout', new THREE.Vector3(x + 0.3, 1.0, z), new THREE.Vector3(0.35, 0.12, 0.3), 0, () => 'Passar no caixa', () => this.checkout(), 2.4),
    );
    const out = { ctx: scr.ctx, texture: scr.texture };
    drawCheckout(out, 'Bem-vindo!', 'Mercado Aqua');
    return out;
  }

  // ---------------------------------------------------------------------------------------
  // Ceiling: cobalt blobs with downlights, hanging glass planters
  // ---------------------------------------------------------------------------------------
  private buildCeiling(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const cz = (K.z0 + K.z1) / 2;
    b.box(m.whiteCeramic, (K.x0 + K.x1) / 2, CEIL - 0.04, cz, K.x1 - K.x0 - 0.3, 0.04, K.z1 - K.z0 - 0.3, { cast: false });
    const blob = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    blob.rotateX(Math.PI);
    const rng = createRng(12);
    const blobs: Array<[number, number, number, number]> = [];
    for (let x = 22; x < K.x1 - 1.5; x += 3.4) {
      blobs.push([x + randRange(rng, -0.4, 0.4), cz + randRange(rng, -0.5, 0.5), randRange(rng, 1.3, 1.8), randRange(rng, 0.9, 1.3)]);
      if (x > 25 && x < 41) {
        blobs.push([x + 1.6, K.z0 + 2.2, randRange(rng, 1.0, 1.4), 0.8]);
        blobs.push([x + 1.6, K.z1 - 2.2, randRange(rng, 1.0, 1.4), 0.8]);
      }
    }
    for (const [x, z, sx, sz] of blobs) {
      const g = blob.clone();
      g.scale(sx, 0.32, sz);
      b.place(g, m.cobaltCeramic, x, CEIL - 0.05, z, { cast: false, rotY: rng() * Math.PI });
      g.dispose();
      b.cylinder(m.emissiveWarm, x, CEIL - 0.39, z, 0.16, 0.16, 0.02, { cast: false, segments: 16 });
      b.torus(m.chrome, x, CEIL - 0.37, z, 0.17, 0.012, { rotX: Math.PI / 2, cast: false });
    }
    blob.dispose();
    // hanging glass planters with trailing vines
    for (const [x, z] of [
      [24, cz - 1.0],
      [24, cz + 1.0],
      [43.4, cz - 2.4],
      [43.4, cz + 2.4],
      [30.2, cz],
      [36.4, cz],
    ] as Array<[number, number]>) {
      const y = 2.75;
      b.sphere(m.glass, x, y, z, 0.28, { cast: false });
      b.sphere(m.soil, x, y - 0.06, z, 0.2, { cast: false });
      b.cylinder(m.chrome, x, y + 0.27, z, 0.006, 0.006, CEIL - y - 0.3, { segments: 5, cast: false });
      ctx.veg.fern(x, y - 0.02, z, 0.38);
      ctx.veg.vine(x + 0.15, y - 0.1, z, 0.9);
      ctx.veg.vine(x - 0.12, y - 0.1, z + 0.1, 0.7);
    }
    const glow = m.frostedGlass.clone();
    glow.name = 'marketLamps';
    glow.emissive = new THREE.Color(0xfff3dc);
    glow.emissiveIntensity = 1.3;
    for (const [x, z] of [
      [21.2, K.z0 + 2.4],
      [24.0, K.z0 + 2.4],
    ] as Array<[number, number]>) teardropLamp(b, x, 2.4, z, CEIL, glow, 0.18);
  }

  // ---------------------------------------------------------------------------------------
  // Window lounge with blob seats
  // ---------------------------------------------------------------------------------------
  private buildLounge(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const cz = (K.z0 + K.z1) / 2;
    for (const [x, z, mat] of [
      [43.6, cz - 1.6, m.fabricCobalt],
      [43.6, cz + 1.6, m.fabricLime],
      [42.6, cz, m.fabricCyan],
    ] as Array<[number, number, THREE.Material]>) {
      b.sphere(mat, x, 0.12, z, 0.45, { cast: true });
      b.collision.addCylinder({ x, z, r: 0.45, minY: 0, maxY: 0.45, surface: 'tile' });
      ctx.addSeat({ id: `market-pouf-${x}-${z.toFixed(1)}`, x, y: 0.5, z, yaw: yawFacing(1, 0) });
    }
    b.cylinder(m.whiteCeramic, 44.0, 0, cz, 0.35, 0.3, 0.42, { segments: 28, collide: 'stone' });
    b.cylinder(m.glass, 44.0, 0.42, cz, 0.45, 0.45, 0.02, { segments: 32, cast: false });
    // planters at the window corners
    for (const z of [K.z0 + 1.0, K.z1 - 1.0]) {
      b.cylinder(m.whiteCeramic, K.x1 - 0.8, 0, z, 0.45, 0.35, 0.6, { segments: 24, collide: 'stone' });
      b.cylinder(m.soil, K.x1 - 0.8, 0.57, z, 0.4, 0.4, 0.04, { segments: 20, cast: false });
      ctx.veg.palm(K.x1 - 0.8, 0.6, z, 0.45);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------------------
  private toggleFridge(f: Fridge): void {
    f.open = !f.open;
    f.timer = f.open ? 12 : 0;
    this.ctx.audio.play(f.open ? 'fridgeOpen' : 'fridgeClose', { position: f.hinge });
  }

  private examine(f: Fridge): void {
    this.showProducts(f.category, f.brands);
    f.timer = Math.max(f.timer, 8);
  }

  private showProducts(title: string, items: Array<{ brand: number; shape: ProductShape }>): void {
    const seen = new Set<number>();
    const rows = items
      .filter((i) => (seen.has(i.brand) ? false : (seen.add(i.brand), true)))
      .map((i) => `<li><b style="color:${BRANDS[i.brand].color}">${BRANDS[i.brand].name}</b> — ${PRODUCT_INFO[i.brand]}</li>`)
      .join('');
    this.ctx.showCard(`<b>${title}</b><ul class="card-list">${rows}</ul>`, 8);
  }

  private checkout(): void {
    this.checkoutFlash = 1.2;
    this.ctx.audio.play('vendSelect', { position: { x: 23, y: 1, z: K.z0 + 2.4 } });
    window.setTimeout(() => this.ctx.audio.play('vendDone', { position: { x: 23, y: 1, z: K.z0 + 2.4 } }), 250);
    drawCheckout(this.checkoutScreen, 'Obrigado!', 'Volte sempre');
    this.ctx.showCard('<b>Mercado Aqua</b><br>Tudo aqui é cortesia do complexo: leve só o que for usar e devolva as cestas na entrada.', 5);
  }

  update(dt: number): void {
    const v = this.ctx.viewer;
    const near = v.x > K.x0 - 8 && v.x < K.x1 + 3 && v.z > K.z0 - 3 && v.z < K.z1 + 3;
    // automatic doors
    const cz = (K.z0 + K.z1) / 2;
    const want = Math.abs(v.x - K.x0) < 2.6 && Math.abs(v.z - cz) < 2.2 ? 1 : 0;
    if (this.doorOpen !== want) {
      this.doorOpen = damp(this.doorOpen, want, want ? 6 : 3, dt);
      if (Math.abs(this.doorOpen - want) < 0.002) this.doorOpen = want;
      for (const d of this.doors) d.leaf.position.z = d.closedZ + d.dir * 1.2 * this.doorOpen;
      this.doorCollider.enabled = this.doorOpen < 0.7;
    }
    if (!near) return;
    for (const f of this.fridges) {
      if (f.timer > 0) {
        f.timer -= dt;
        if (f.timer <= 0 && f.open) this.toggleFridge(f);
      }
      const target = f.open ? -1.75 : 0;
      if (Math.abs(f.angle - target) > 1e-3) {
        f.angle = damp(f.angle, target, 6, dt);
        f.door.rotation.y = f.angle;
      }
      const k = Math.min(1, Math.abs(f.angle) / 1.5);
      f.light.color.setRGB(0.8 + 0.2 * k, 0.93 + 0.07 * k, 1);
    }
    if (this.checkoutFlash > 0) {
      this.checkoutFlash -= dt;
      if (this.checkoutFlash <= 0) drawCheckout(this.checkoutScreen, 'Bem-vindo!', 'Mercado Aqua');
    }
  }
}

const basketGeoCache = new Map<string, THREE.BufferGeometry>();

function mergeGeoms(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0;
  for (const p of parts) count += p.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array as Float32Array, o * 3);
    nor.set(p.attributes.normal.array as Float32Array, o * 3);
    if (p.attributes.uv) uv.set(p.attributes.uv.array as Float32Array, o * 2);
    o += p.attributes.position.count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function marketSign(ctx: WorldContext, title: string, sub: string, color: string, key: string): THREE.CanvasTexture {
  const { ctx: c, texture } = ctx.assets.dynamicCanvas(1024, 256, `msign-${key}`);
  c.clearRect(0, 0, 1024, 256);
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#e6f4ff');
  c.fillStyle = g;
  roundRect(c, 6, 6, 1012, 244, 110);
  c.fill();
  c.lineWidth = 10;
  c.strokeStyle = color;
  roundRect(c, 6, 6, 1012, 244, 110);
  c.stroke();
  // droplet emblem
  c.fillStyle = color;
  c.beginPath();
  c.arc(128, 136, 58, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#9be22d';
  c.beginPath();
  c.arc(150, 112, 18, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = color;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.font = `800 92px ${FONT}`;
  c.fillText(title, 220, 110);
  c.fillStyle = '#2a3a5c';
  c.font = `600 40px ${FONT}`;
  c.fillText(sub, 224, 190);
  texture.needsUpdate = true;
  return texture;
}

function priceTagTexture(ctx: WorldContext): THREE.CanvasTexture {
  const { ctx: c, texture } = ctx.assets.dynamicCanvas(512, 32, 'priceTags');
  c.fillStyle = '#9be22d';
  c.fillRect(0, 0, 512, 32);
  const prices = ['2,90', '4,50', '3,20', '5,90'];
  for (let i = 0; i < 4; i++) {
    const x = i * 128 + 20;
    c.fillStyle = '#ffffff';
    roundRect(c, x, 3, 88, 26, 6);
    c.fill();
    c.fillStyle = '#1747b5';
    c.font = `800 20px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`Ꜷ ${prices[i]}`, x + 44, 17);
  }
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function waveTexture(ctx: WorldContext): THREE.CanvasTexture {
  const { ctx: c, texture } = ctx.assets.dynamicCanvas(512, 512, 'marketFloor');
  const g = c.createLinearGradient(0, 0, 512, 512);
  g.addColorStop(0, '#5fb8ff');
  g.addColorStop(1, '#2f86e8');
  c.fillStyle = g;
  c.fillRect(0, 0, 512, 512);
  c.strokeStyle = 'rgba(255,255,255,0.22)';
  c.lineWidth = 6;
  for (let k = 0; k < 8; k++) {
    c.beginPath();
    for (let x = 0; x <= 512; x += 8) {
      const y = k * 64 + 20 + Math.sin((x / 512) * Math.PI * 4 + k) * 12;
      if (x === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function drawCheckout(s: { ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture }, title: string, sub: string): void {
  const c = s.ctx;
  const g = c.createLinearGradient(0, 0, 0, 160);
  g.addColorStop(0, '#1d6fe0');
  g.addColorStop(1, '#0d3a8f');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 160);
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `800 40px ${FONT}`;
  c.fillText(title, 128, 66);
  c.fillStyle = '#b8ffd0';
  c.font = `600 22px ${FONT}`;
  c.fillText(sub, 128, 112);
  s.texture.needsUpdate = true;
}

