// Ícones de partículas (corações, Zzz, notas, migalhas, gotas...).
// Mapas de pixel desenhados à mão e ampliados 2x para a escala do jogo.

const OUT = '#2a1f30';

export const ICONS = {
  heart: { rows: ['.OO.OO.', 'OrrOrrO', 'OrwrrrO', 'OrrrrrO', '.OrrrO.', '..OrO..', '...O...'], pal: { O: OUT, r: '#ff6b8a', w: '#ffd0dc' } },
  zzz: { rows: ['OOOOO', '...O.', '..O..', '.O...', 'OOOOO'], pal: { O: '#e8eaff' } },
  note: { rows: ['..OOO', '..O.O', '..O.O', 'OOO.O', 'OOO..'], pal: { O: '#fff3c4' } },
  sparkle: { rows: ['..y..', '..y..', 'yywyy', '..y..', '..y..'], pal: { y: '#fff6c8', w: '#ffffff' } },
  crumb: { rows: ['ab', 'ba'], pal: { a: '#c9853a', b: '#8a5a2c' } },
  drop: { rows: ['.w.', 'wbw', '.w.'], pal: { w: '#bfe9ff', b: '#ffffff' } },
};

const cache = new Map();
export function iconSprite(name) {
  let c = cache.get(name);
  if (c) return c;
  const ic = ICONS[name];
  const s = name === 'crumb' || name === 'drop' ? 1 : 2;
  c = document.createElement('canvas');
  c.width = ic.rows[0].length * s;
  c.height = ic.rows.length * s;
  const ctx = c.getContext('2d');
  ic.rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const col = ic.pal[ch];
    if (!col) return;
    ctx.fillStyle = col;
    ctx.fillRect(i * s, j * s, s, s);
  }));
  cache.set(name, c);
  return c;
}
