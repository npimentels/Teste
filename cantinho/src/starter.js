// Quarto inicial: um apartamento-estúdio decorado, inspirado em quartos de
// designers do Habbo — sala, quarto, cozinha/jantar, banheiro e jardim com piscina.

import { Room } from './room.js';
import { DEFAULT_LOOK } from './avatar.js';

export function starterRoom() {
  const r = new Room({ w: 18, d: 14, floor: { style: 'porcelanato', color: 0 }, wall: { style: 'lisa', color: 0 }, doorY: 1 });
  const fails = [];
  const put = (id, x, y, rot = 0, variant = 0, state = 0) => { const it = r.add(id, x, y, rot, variant, state); if (!it) fails.push(id + '@' + x + ',' + y); return it; };
  const wall = (id, side, pos, z, variant = 0, state = 0) => { const it = r.addWall(id, side, pos, z, variant, state); if (!it) fails.push('wall:' + id); return it; };

  // pisos por ambiente (primeiro, ficam por baixo)
  for (let x = 0; x < 4; x++) for (let y = 9; y < 14; y++) put('piso_marmore', x, y, 0, 0);
  for (let x = 10; x < 18; x++) for (let y = 8; y < 14; y++) if (!(x >= 12 && x <= 15 && y >= 10 && y <= 12)) put(x >= 12 && x <= 16 && y >= 9 && y <= 13 ? 'piso_deck' : 'piso_grama', x, y, 0, 0);
  for (let x = 12; x <= 15; x++) for (let y = 10; y <= 12; y++) put('piscina', x, y, 0, 0);

  // ----- sala
  put('tapete_moderno', 2, 2, 0, 0);
  put('estante', 1, 0, 0, 0);
  put('rack_tv', 3, 0, 0, 0);
  put('tv_tela', 3, 0, 0, 0, 0);
  put('palmeira', 5, 0, 0, 0);
  put('mesa_vidro', 3, 2, 0, 0);
  put('vaso_flores', 3, 2, 0, 0);
  put('livros', 4, 2, 0, 0);
  put('sofa_moderno', 2, 4, 2, 1);
  put('poltrona_concha', 6, 2, 3, 0);
  put('poltrona_classica', 1, 2, 1, 0);
  put('mesa_lateral', 6, 3, 0, 0);
  put('abajur', 6, 3, 0, 0, 1);
  put('vaso_pampas', 7, 0, 0, 0);
  put('luminaria', 8, 0, 0, 0, 1);
  wall('janela', 'R', 166, 34, 0);
  wall('quadro_abstrato', 'R', 104, 78, 0);
  wall('relogio_parede', 'R', 236, 84, 0);
  wall('interruptor', 'L', 76, 46, 0, 1);
  wall('arandela', 'L', 100, 56, 0, 1);

  // ----- quarto
  put('tapete_geometrico', 11, 1, 0, 0);
  put('guarda_roupa', 9, 0, 0, 0);
  put('criado', 11, 0, 0, 0);
  put('abajur', 11, 0, 0, 0, 1);
  put('cama_casal', 12, 0, 0, 0);
  put('criado', 14, 0, 0, 0);
  put('abajur', 14, 0, 0, 0, 1);
  put('penteadeira', 15, 0, 0, 0);
  put('banqueta', 12, 3, 0, 0);
  put('cavalete', 16, 3, 3, 0);
  wall('painel_ripado', 'R', 386, 4, 0);
  wall('prateleira', 'R', 330, 76, 0);
  wall('varal_luzes', 'R', 446, 100, 0, 1);

  // ----- cozinha e jantar
  put('geladeira', 0, 4, 1, 0);
  put('balcao', 0, 5, 1, 0);
  put('maquina_cafe', 0, 5, 1, 0);
  put('pia_cozinha', 0, 6, 1, 0);
  put('fogao', 0, 7, 1, 0);
  put('tapete_persa', 2, 4, 1, 1);
  put('mesa_redonda', 2, 5, 0, 0);
  put('bolo', 2, 5, 0, 0);
  put('xicara_cafe', 3, 6, 0, 0);
  put('vaso_flores', 3, 5, 0, 3);
  put('cadeira_jantar', 2, 7, 2, 0);
  put('cadeira_jantar', 3, 7, 2, 0);
  put('cadeira_jantar', 4, 5, 3, 0);
  put('cadeira_jantar', 4, 6, 3, 0);
  wall('prateleira', 'L', 162, 66, 0);

  // ----- banheiro
  put('divisoria_marmore', 0, 8, 0, 0);
  put('divisoria_marmore', 1, 8, 0, 0);
  put('divisoria_marmore', 2, 8, 0, 0);
  put('pia_banheiro', 0, 9, 1, 0);
  put('tapete_banheiro', 1, 11, 1, 0);
  put('vaso_sanitario', 0, 11, 1, 0);
  put('suporte_papel', 1, 12, 1, 0);
  put('banheira', 0, 12, 1, 0, 1);
  put('toalheiro', 2, 13, 2, 0);
  put('cesto_roupa', 3, 13, 0, 0);
  wall('espelho_redondo', 'L', 302, 58, 0);
  wall('arandela', 'L', 288, 60, 0, 1);
  wall('arandela', 'L', 344, 60, 0, 1);
  wall('toalheiro_parede', 'L', 396, 44, 0);

  // ----- jardim e piscina
  put('arvore', 10, 8, 0, 0);
  put('cipreste', 17, 8, 0, 0);
  put('escada_piscina', 13, 10, 0, 0);
  put('pedra_passagem', 15, 11, 0, 0);
  put('espreguicadeira', 16, 10, 0, 0);
  put('espreguicadeira', 17, 10, 0, 1);
  put('guarda_sol', 17, 12, 0, 0);
  put('arbusto', 10, 12, 0, 0);
  put('arbusto', 10, 13, 0, 1);
  put('sofa_externo', 12, 13, 2, 0);
  put('poste_jardim', 11, 10, 0, 0, 1);
  put('fogueira', 16, 13, 0, 0, 0);

  // ----- pets
  put('caminha', 7, 6, 0, 0);
  put('pote_racao', 8, 7, 0, 0);
  put('arranhador', 9, 4, 0, 0);

  if (fails.length && typeof console !== 'undefined') console.warn('starter: não coube', fails.join(' '));
  return r;
}

export function starterData() {
  return {
    room: starterRoom().toJSON(),
    look: { ...DEFAULT_LOOK },
    pets: [
      { uid: 1, kind: 'cachorro', color: 0, name: 'Paçoca', tx: 6, ty: 6 },
      { uid: 2, kind: 'gato', color: 0, name: 'Mingau', tx: 8, ty: 5 },
    ],
    inventory: [
      { id: 'pizza', variant: 0, n: 1 }, { id: 'pipoqueira', variant: 0, n: 1 }, { id: 'vitrola', variant: 0, n: 1 },
      { id: 'caldeirao', variant: 0, n: 1 }, { id: 'quadro_gato', variant: 0, n: 1 }, { id: 'puff', variant: 0, n: 2 },
    ],
    outfits: [],
  };
}
