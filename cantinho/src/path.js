// A* em grade com 8 direções, sem "cortar quinas" (estilo Habbo).

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function findPath(w, d, passable, from, to, maxNodes = 4000) {
  const [sx, sy] = from, [gx, gy] = to;
  if (sx === gx && sy === gy) return [];
  const key = (x, y) => y * w + x;
  const open = new Map();
  const g = new Map([[key(sx, sy), 0]]);
  const came = new Map();
  const h = (x, y) => {
    const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
  };
  open.set(key(sx, sy), { x: sx, y: sy, f: h(sx, sy) });
  const closed = new Set();
  let n = 0;
  while (open.size && n++ < maxNodes) {
    let cur = null;
    for (const v of open.values()) if (!cur || v.f < cur.f) cur = v;
    const ck = key(cur.x, cur.y);
    open.delete(ck);
    if (cur.x === gx && cur.y === gy) {
      const path = [];
      let k = ck;
      while (k !== key(sx, sy)) {
        path.unshift([k % w, Math.floor(k / w)]);
        k = came.get(k);
      }
      return path;
    }
    closed.add(ck);
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= d) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const isGoal = nx === gx && ny === gy;
      if (!isGoal && !passable(nx, ny)) continue;
      if (dx && dy && (!passable(cur.x + dx, cur.y) || !passable(cur.x, cur.y + dy))) continue;
      const ng = g.get(ck) + (dx && dy ? 1.41 : 1);
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, ck);
        open.set(nk, { x: nx, y: ny, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
}
