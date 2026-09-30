// Obstacle-aware orthogonal wire routing on the schematic grid.
//
// Used when a part is moved (its wires follow) and while a new wire is drawn.
// A route:
//  - leaves a terminal away from its part (along the lead) and enters the far
//    terminal the same way,
//  - never crosses a part's body,
//  - never passes through another terminal or wire end, and never bends or runs
//    along another wire (either would make an unintended connection, because a
//    point lying on a wire joins it),
//  - prefers few bends and short length; crossing another wire is allowed.

import { GRID } from '../elements/index.js';

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const key = (x, y) => x + ',' + y;

/** Direction (index into DIRS) in which a wire should leave terminal `p` of part `e`. */
export function exitDir(e, p) {
  const posts = e.getPosts();
  const i = posts.findIndex((q) => q[0] === p[0] && q[1] === p[1]);
  if (i < 0) return -1;
  let dx = 0, dy = 0;
  const lead = e.leads && e.leads().find((l) => l[0] === i);
  if (lead) {
    const a = e.toWorld(lead[1], lead[2]), b = e.toWorld(lead[3], lead[4]);
    dx = a[0] - b[0]; dy = a[1] - b[1];
  }
  if (!dx && !dy) {
    const [x1, y1, x2, y2] = e.worldBox();
    dx = p[0] - (x1 + x2) / 2; dy = p[1] - (y1 + y2) / 2;
  }
  if (!dx && !dy) return -1;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 0 : 2;
  return dy > 0 ? 1 : 3;
}

/** Terminal exit direction for a point, if it is a part's terminal. */
export function exitAt(doc, p) {
  for (const e of doc.elements) {
    const d = exitDir(e, p);
    if (d >= 0) return d;
  }
  return -1;
}

/**
 * Route from a to b (grid points). Returns the point list, or null when no clean
 * route exists within the search area (callers then fall back to a plain L).
 * opts: { skipWires: Set<Wire>, exitA, exitB } — exits default to the parts' leads.
 */
export function autoRoute(doc, a, b, opts = {}) {
  const G = GRID;
  if (a[0] === b[0] && a[1] === b[1]) return [a, b];
  const skip = opts.skipWires || new Set();
  const exitA = opts.exitA ?? exitAt(doc, a);
  const exitB = opts.exitB ?? exitAt(doc, b);

  // ---- search area
  const pad = 8 * G;
  const xmin = Math.min(a[0], b[0]) - pad, xmax = Math.max(a[0], b[0]) + pad;
  const ymin = Math.min(a[1], b[1]) - pad, ymax = Math.max(a[1], b[1]) + pad;

  // ---- obstacles, rasterised over the search area at half-grid resolution
  // (routes only ever test grid points and the midpoints of grid steps)
  const HG = G / 2;
  const cols = Math.round((xmax - xmin) / HG) + 1, rows = Math.round((ymax - ymin) / HG) + 1;
  const BODY = 1, HUG = 2;
  const cell = new Uint8Array(cols * rows);
  for (const e of doc.elements) {
    const [x1, y1, x2, y2] = e.worldBox();
    const i0 = Math.max(0, Math.floor((x1 - G - xmin) / HG)), i1 = Math.min(cols - 1, Math.ceil((x2 + G - xmin) / HG));
    const j0 = Math.max(0, Math.floor((y1 - G - ymin) / HG)), j1 = Math.min(rows - 1, Math.ceil((y2 + G - ymin) / HG));
    for (let j = j0; j <= j1; j++) {
      const y = ymin + j * HG;
      for (let i = i0; i <= i1; i++) {
        const x = xmin + i * HG;
        if (x > x1 + 0.5 && x < x2 - 0.5 && y > y1 + 0.5 && y < y2 - 0.5) cell[j * cols + i] |= BODY;
        // hugging a part's outline: allowed, but a route one step further out looks cleaner
        if (x > x1 - G + 0.5 && x < x2 + G - 0.5 && y > y1 - G + 0.5 && y < y2 + G - 0.5) cell[j * cols + i] |= HUG;
      }
    }
  }
  const at = (x, y) => cell[Math.round((y - ymin) / HG) * cols + Math.round((x - xmin) / HG)];
  const inBox = (x, y) => (at(x, y) & BODY) !== 0;
  const hug = (x, y) => (at(x, y) & HUG) !== 0;
  // points a wire must not touch: terminals, and the ends and corners of other wires
  const blocked = new Set();
  for (const e of doc.elements) for (const p of e.getPosts()) blocked.add(key(p[0], p[1]));
  const wireEdges = new Set(); // unit grid edges used by other wires
  const wireNodes = new Set(); // grid points lying on other wires
  for (const w of doc.wires) {
    if (skip.has(w)) continue;
    for (const p of w.pts) blocked.add(key(p[0], p[1]));
    for (let k = 1; k < w.pts.length; k++) {
      const [p, q] = [w.pts[k - 1], w.pts[k]];
      const sx = Math.sign(q[0] - p[0]), sy = Math.sign(q[1] - p[1]);
      const n = Math.round(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) / G);
      for (let s = 0; s <= n; s++) {
        const x = p[0] + sx * s * G, y = p[1] + sy * s * G;
        wireNodes.add(key(x, y));
        if (s < n) wireEdges.add(key(Math.min(x, x + sx * G), Math.min(y, y + sy * G)) + (sx ? 'h' : 'v'));
      }
    }
  }
  const ka = key(a[0], a[1]), kb = key(b[0], b[1]);
  blocked.delete(ka); blocked.delete(kb);

  // ---- A* over (point, heading)
  const BEND = 2.2, H = (x, y) => (Math.abs(x - b[0]) + Math.abs(y - b[1])) / G;
  const heap = [];
  const push = (n) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].f < heap[m].f) m = l;
        if (r < heap.length && heap[r].f < heap[m].f) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const best = new Map(), parent = new Map();
  const sk = (x, y, d) => x + ',' + y + ',' + d;
  // d = heading of the last step; -1 at the start
  push({ f: H(a[0], a[1]), g: 0, x: a[0], y: a[1], d: -1, k: sk(a[0], a[1], -1) });
  best.set(sk(a[0], a[1], -1), 0);
  let found = null, iter = 0;
  while (heap.length && iter++ < 30000) {
    const { g, x, y, d, k } = pop();
    if (g > (best.get(k) ?? Infinity) + 1e-9) continue;
    if (d >= 0 && x === b[0] && y === b[1]) {
      // arrive against the far terminal's exit direction
      if (exitB < 0 || d === (exitB + 2) % 4) { found = k; break; }
      continue;
    }
    for (let nd = 0; nd < 4; nd++) {
      if (d >= 0 && nd === (d + 2) % 4) continue; // no U-turns
      if (d < 0 && exitA >= 0 && nd !== exitA) continue; // leave along the lead
      const nx = x + DIRS[nd][0] * G, ny = y + DIRS[nd][1] * G;
      if (nx < xmin || nx > xmax || ny < ymin || ny > ymax) continue;
      const nk = key(nx, ny);
      if (nk !== kb && (blocked.has(nk) || inBox(nx, ny))) continue;
      if (inBox((x + nx) / 2, (y + ny) / 2)) continue; // would cut through a part
      if (wireEdges.has(key(Math.min(x, nx), Math.min(y, ny)) + (nd % 2 === 0 ? 'h' : 'v'))) continue; // never run along another wire
      const bend = d >= 0 && nd !== d;
      if (bend && wireNodes.has(key(x, y))) continue; // a corner on another wire would join it
      const ng = g + 1 + (bend ? BEND : 0) + (wireNodes.has(nk) ? 0.6 : 0) + (nk !== kb && hug(nx, ny) ? 0.35 : 0);
      const nsk = sk(nx, ny, nd);
      if (ng < (best.get(nsk) ?? Infinity) - 1e-9) {
        best.set(nsk, ng);
        parent.set(nsk, k);
        push({ f: ng + H(nx, ny), g: ng, x: nx, y: ny, d: nd, k: nsk });
      }
    }
  }
  if (!found) return null;
  const pts = [];
  for (let k = found; k; k = parent.get(k)) { const [x, y] = k.split(',').map(Number); pts.push([x, y]); }
  pts.reverse();
  // keep only the corners
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [p, q, r] = [pts[i - 1], pts[i], pts[i + 1]];
    if ((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]) !== 0) out.push(q);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
