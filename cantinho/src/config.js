// Constantes do mundo isométrico.
//
// Unidades: 1 tile = 16 unidades em X e Y. Z é medido em pixels de tela.
// Projeção 2:1 (estilo Habbo):  sx = x - y   |   sy = (x + y) / 2 - z
// Ou seja, um tile vira um losango de 32x16 px.

export const TILE = 16;
export const WALL_H = 76;   // altura das paredes (px)
export const WALL_T = 6;    // espessura das paredes
export const FLOOR_T = 7;   // espessura da laje do piso

export const WALK_SPEED = 34;   // unidades por segundo (~2 tiles/s, ritmo do Habbo)
export const PET_SPEED = 26;

export const SAVE_KEY = 'cantinho.save.v1';

export const project = (x, y, z = 0) => [x - y, (x + y) / 2 - z];

// Inverso da projeção no plano z
export const unproject = (sx, sy, z = 0) => {
  const s = sy + z;
  return [s + sx / 2, s - sx / 2];
};
