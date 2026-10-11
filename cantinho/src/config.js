// Constantes do mundo isométrico (escala do Habbo).
//
// Unidades: 1 tile = 32 unidades em X e Y. Z é medido em pixels de tela.
// Projeção 2:1:  sx = x - y   |   sy = (x + y) / 2 - z
// Ou seja, um tile vira um losango de 64 × 32 px, igual ao Habbo.

export const TILE = 32;
export const WALL_H = 124;  // altura das paredes (px)
export const WALL_T = 8;    // espessura das paredes
export const FLOOR_T = 10;  // espessura da laje do piso

export const WALK_SPEED = 68;   // unidades por segundo (~2 tiles/s, ritmo do Habbo)
export const PET_SPEED = 52;
export const SIT_OFFSET = 12;   // altura do quadril sentado (avatar.z = assento - isto)

export const SAVE_KEY = 'cantinho.save.v2';

export const project = (x, y, z = 0) => [x - y, (x + y) / 2 - z];

// Inverso da projeção no plano z
export const unproject = (sx, sy, z = 0) => {
  const s = sy + z;
  return [s + sx / 2, s - sx / 2];
};
