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
    const poly = e.sv ? e.worldPoly() : null; // a slanted part: its own turned outline, not its square box
    const i0 = Math.max(0, Math.floor((x1 - G - xmin) / HG)), i1 = Math.min(cols - 1, Math.ceil((x2 + G - xmin) / HG));
    const j0 = Math.max(0, Math.floor((y1 - G - ymin) / HG)), j1 = Math.min(rows - 1, Math.ceil((y2 + G - ymin) / HG));
    for (let j = j0; j <= j1; j++) {
      const y = ymin + j * HG;
      for (let i = i0; i <= i1; i++) {
        const x = xmin + i * HG;
        if (poly ? inPoly(poly, x, y, 0.5) : x > x1 + 0.5 && x < x2 - 0.5 && y > y1 + 0.5 && y < y2 - 0.5) cell[j * cols + i] |= BODY;
        // hugging a part's outline: allowed, but a route one step further out looks cleaner
        if (poly ? inPoly(poly, x, y, -G + 0.5) : x > x1 - G + 0.5 && x < x2 + G - 0.5 && y > y1 - G + 0.5 && y < y2 + G - 0.5) cell[j * cols + i] |= HUG;
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
      if (sx && sy) {
        // slanting: the grid points it passes through, at any slant
        const gx = Math.round((q[0] - p[0]) / G), gy = Math.round((q[1] - p[1]) / G), gcd = (u, v) => (v ? gcd(v, u % v) : Math.abs(u)), n = gcd(gx, gy) || 1;
        for (let s = 0; s <= n; s++) wireNodes.add(key(p[0] + (gx / n) * s * G, p[1] + (gy / n) * s * G));
        continue;
      }
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

// ------------------------------------------------------------------------
// Predictable wiring. Wires should look like a person drew them: straight
// runs and one or two bends, following the finger while drawing and keeping
// their shape when a part is moved. The search-based router above is only a
// last resort for a route that would otherwise cut through a part or make a
// false connection, and then only if it is not a long detour.

const snapG = (v) => Math.round(v / GRID) * GRID;
/** Drop repeated and collinear points (a shape with a zero-length leg is the same route). */
function simplifyPts(pts) {
  const out = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push([p[0], p[1]]); }
  for (let i = out.length - 2; i >= 1; i--) {
    const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
    if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) === 0) out.splice(i, 1);
  }
  return out;
}
const horiz = (d) => d === 0 || d === 2;

/** The route a draughtsman would use: leave and enter each terminal along its lead. */
export function naturalRoute(a, b, ea = -1, eb = -1, hFirst = true) {
  if (a[0] === b[0] || a[1] === b[1]) return [a, b];
  if (ea >= 0 && eb >= 0) {
    if (horiz(ea) && horiz(eb)) { const mx = snapG((a[0] + b[0]) / 2); return [a, [mx, a[1]], [mx, b[1]], b]; }
    if (!horiz(ea) && !horiz(eb)) { const my = snapG((a[1] + b[1]) / 2); return [a, [a[0], my], [b[0], my], b]; }
    return horiz(ea) ? [a, [b[0], a[1]], b] : [a, [a[0], b[1]], b];
  }
  if (ea >= 0) return horiz(ea) ? [a, [b[0], a[1]], b] : [a, [a[0], b[1]], b];
  if (eb >= 0) return horiz(eb) ? [a, [a[0], b[1]], b] : [a, [b[0], a[1]], b];
  return hFirst ? [a, [b[0], a[1]], b] : [a, [a[0], b[1]], b];
}

/**
 * Stretch an existing wire so its ends sit on na / nb while keeping its shape:
 * only the segment next to a moved end slides along with it. Returns null for a
 * straight two-point wire (it has no shape to keep).
 */
export function stretchWire(pts, na, nb) {
  const n = pts.length;
  if (n < 3) return null;
  const p = pts.map((q) => [q[0], q[1]]);
  const a0 = p[0], b0 = p[n - 1];
  if (na[0] !== a0[0] || na[1] !== a0[1]) {
    const h = p[0][1] === p[1][1];
    p[0] = [na[0], na[1]];
    if (h) p[1][1] = na[1]; else p[1][0] = na[0];
  }
  if (nb[0] !== b0[0] || nb[1] !== b0[1]) {
    const h = p[n - 1][1] === p[n - 2][1];
    p[n - 1] = [nb[0], nb[1]];
    if (h) p[n - 2][1] = nb[1]; else p[n - 2][0] = nb[0];
  }
  return p;
}

// ------------------------------------------------------- slanted shapes
/** Signed area sign of a polygon (1 or -1), so its inside can be told from its outside. */
function turn(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a >= 0 ? 1 : -1;
}

/** Is (x, y) inside the convex polygon `poly`, by more than m? */
export function inPoly(poly, x, y, m = 0) {
  const sg = turn(poly);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ey = b[1] - a[1];
    if ((sg * (ex * (y - a[1]) - ey * (x - a[0]))) / (Math.hypot(ex, ey) || 1) <= m) return false;
  }
  return true;
}

/** Do two convex polygons overlap by more than m (separating axes)? */
export function polysHit(A, B, m = 2) {
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], nx = a[1] - b[1], ny = b[0] - a[0], l = Math.hypot(nx, ny) || 1;
    let a1 = Infinity, a2 = -Infinity, b1 = Infinity, b2 = -Infinity;
    for (const p of A) { const d = (p[0] * nx + p[1] * ny) / l; if (d < a1) a1 = d; if (d > a2) a2 = d; }
    for (const p of B) { const d = (p[0] * nx + p[1] * ny) / l; if (d < b1) b1 = d; if (d > b2) b2 = d; }
    if (a2 - m <= b1 || b2 - m <= a1) return false;
  }
  return true;
}

/** How much of segment p–q (0 … 1) runs inside the convex polygon, kept m in from its edges. */
export function segInPoly(p, q, poly, m = 0.5) {
  const sg = turn(poly), dx = q[0] - p[0], dy = q[1] - p[1];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
    const nx = (-sg * ey) / l, ny = (sg * ex) / l; // inward normal
    const num = nx * (p[0] - a[0]) + ny * (p[1] - a[1]) - m, den = nx * dx + ny * dy;
    if (Math.abs(den) < 1e-12) { if (num < 0) return 0; continue; }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t1 <= t0) return 0;
  }
  return t1 - t0;
}

/** Do two parts' outlines overlap (more than touching)? Slanted parts by their own turned boxes. */
export function partsHit(e, o) {
  const A = e.worldBox(), B = o.worldBox();
  if (!(A[0] + 2 < B[2] && A[2] - 2 > B[0] && A[1] + 2 < B[3] && A[3] - 2 > B[1])) return false;
  return !(e.sv || o.sv) || polysHit(e.worldPoly(), o.worldPoly());
}

/**
 * Can a straight wire run from a to b (any slant) without crossing a part, passing over a
 * terminal or another wire's point (which would join them), or lying along another wire?
 * skip: wires to leave out (the wire itself, wires moving with it).
 */
export function straightClear(doc, a, b, skip = new Set()) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
  if (l < 1) return true;
  // (a few units in from each end: arriving at a terminal, a wire may graze the edge of its
  // part's box, as at the top of a ground symbol)
  const cut = Math.min(6, l / 4), a2 = [a[0] + (dx * cut) / l, a[1] + (dy * cut) / l], b2 = [b[0] - (dx * cut) / l, b[1] - (dy * cut) / l];
  for (const e of doc.elements) {
    if (e.constructor.type === 'label') continue;
    if (segInPoly(a2, b2, e.worldPoly()) * (l - 2 * cut) > 1) return false;
  }
  const on = (p) => {
    if ((p[0] === a[0] && p[1] === a[1]) || (p[0] === b[0] && p[1] === b[1])) return false;
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (l * l);
    return t > 0 && t < 1 && Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l < 0.5;
  };
  for (const e of doc.elements) for (const p of e.getPosts()) if (on(p)) return false;
  for (const w of doc.wires) {
    if (skip.has(w)) continue;
    for (const p of w.pts) if (on(p)) return false;
    for (let k = 1; k < w.pts.length; k++) {
      const p = w.pts[k - 1], q = w.pts[k], ex = q[0] - p[0], ey = q[1] - p[1];
      // lying along it: in line, and overlapping by more than a point
      if (Math.abs(ex * dy - ey * dx) > 1e-6 || Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l > 0.5) continue;
      const s1 = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l, s2 = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l;
      if (Math.min(l, Math.max(s1, s2)) - Math.max(0, Math.min(s1, s2)) > 1) return false;
    }
  }
  return true;
}

/**
 * Which way a wire leaves terminal p of a part, as a whole grid step [dx, dy] (grid units) on
 * along the part's own line (a slanted part's too), or null when p is no part's terminal.
 */
function leadStep(doc, p) {
  for (const e of doc.elements) {
    const posts = e.getPosts(), i = posts.findIndex((q) => q[0] === p[0] && q[1] === p[1]);
    if (i < 0) continue;
    if (posts.length === 2) {
      const o = posts[1 - i], gx = Math.round((p[0] - o[0]) / GRID), gy = Math.round((p[1] - o[1]) / GRID);
      const gcd = (u, v) => (v ? gcd(v, u % v) : Math.abs(u)), n = gcd(gx, gy);
      if (n) return [gx / n, gy / n];
    }
    const d = exitDir(e, p);
    return d >= 0 ? DIRS[d] : null;
  }
  return null;
}

/**
 * A wire from a to b where wires may slant (slanting on, or a circuit drawn slanting): straight
 * when it runs clear, else the neatest clear shape of level, upright and 45° runs with a bend or
 * two, leaving and entering terminals along their parts' leads where it can. Every run is held
 * to straightClear and no bend may sit on a terminal or another wire. Returns the points, or
 * null when no such shape is clear (the right-angled router takes over).
 */
export function freeRoute(doc, a, b, skip = new Set()) {
  const G = GRID, same = (p, q) => p[0] === q[0] && p[1] === q[1];
  if (same(a, b)) return [a, b];
  const shapes = (p, q) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], sx = Math.sign(dx), sy = Math.sign(dy), d = Math.min(Math.abs(dx), Math.abs(dy));
    const out = [[p, q]];
    if (dx && dy) {
      if (Math.abs(dx) !== Math.abs(dy)) out.push([p, [p[0] + sx * d, p[1] + sy * d], q], [p, [q[0] - sx * d, q[1] - sy * d], q]);
      out.push([p, [q[0], p[1]], q], [p, [p[0], q[1]], q]);
    }
    return out;
  };
  const la = leadStep(doc, a), lb = leadStep(doc, b);
  const cands = shapes(a, b);
  for (const s of [1, 2]) {
    const a1 = la ? [a[0] + la[0] * s * G, a[1] + la[1] * s * G] : a, b1 = lb ? [b[0] + lb[0] * s * G, b[1] + lb[1] * s * G] : b;
    if (la || lb) for (const mid of shapes(a1, b1)) cands.push([a, ...mid, b]);
  }
  // a bend may not sit on a terminal or on another wire (it would join them)
  const onWire = (p) => doc.wires.some((w) => !skip.has(w) && w.pts.some((q, i) => same(p, q) || (i > 0 && onSegment(p, w.pts[i - 1], q))));
  const onPost = (p) => doc.elements.some((e) => e.getPosts().some((q) => same(p, q)));
  const angle = (u, v) => { const c = (u[0] * v[0] + u[1] * v[1]) / ((Math.hypot(...u) * Math.hypot(...v)) || 1); return Math.acos(Math.max(-1, Math.min(1, c))); };
  let best = null, bestScore = Infinity;
  for (const raw of cands) {
    const pts = [];
    for (const p of raw) if (!pts.length || !same(pts[pts.length - 1], p)) pts.push(p);
    // (drop points in line with their neighbours)
    for (let i = pts.length - 2; i >= 1; i--) {
      const [p, q, r] = [pts[i - 1], pts[i], pts[i + 1]];
      if ((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]) === 0 && (q[0] - p[0]) * (r[0] - q[0]) + (q[1] - p[1]) * (r[1] - q[1]) > 0) pts.splice(i, 1);
    }
    if (pts.length < 2) continue;
    let score = 0, ok = true;
    for (let i = 1; i < pts.length && ok; i++) {
      const p = pts[i - 1], q = pts[i];
      score += Math.hypot(q[0] - p[0], q[1] - p[1]) / G;
      if (!straightClear(doc, p, q, skip)) ok = false;
      if (i < pts.length - 1) {
        if (onWire(q) || onPost(q)) ok = false;
        const t = angle([q[0] - p[0], q[1] - p[1]], [pts[i + 1][0] - q[0], pts[i + 1][1] - q[1]]);
        if (t > (100 * Math.PI) / 180) ok = false; // doubling back
        score += 1.5 + (t > Math.PI / 3 ? 0.6 : 0);
      }
    }
    if (!ok) continue;
    // leaving or entering a terminal across its own part, or sideways to its lead
    const n = pts.length;
    if (la) { const t = angle(la, [pts[1][0] - a[0], pts[1][1] - a[1]]); score += t > Math.PI / 2 + 0.1 ? 6 : t > Math.PI / 4 + 0.1 ? 0.4 : 0; }
    if (lb) { const t = angle(lb, [pts[n - 2][0] - b[0], pts[n - 2][1] - b[1]]); score += t > Math.PI / 2 + 0.1 ? 6 : t > Math.PI / 4 + 0.1 ? 0.4 : 0; }
    if (score < bestScore - 1e-9) { bestScore = score; best = pts; }
  }
  return best;
}

function onSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  if (!l2) return false;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  return t > 0 && t < 1 && Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / Math.sqrt(l2) < 0.5;
}

/** Obstacle picture of the document, shared by the cost checks of one routing decision. */
export function wireContext(doc, skipWires = new Set()) {
  const G = GRID;
  const bodies = doc.elements.map((e) => e.worldBox());
  const polys = doc.elements.map((e) => (e.sv ? e.worldPoly() : null)); // slanted parts: their own turned outline
  const posts = new Set();
  for (const e of doc.elements) for (const p of e.getPosts()) posts.add(key(p[0], p[1]));
  const ends = new Set(), nodes = new Set(), edges = new Set(), segs = [];
  for (const w of doc.wires) {
    if (skipWires.has(w)) continue;
    for (const p of w.pts) ends.add(key(p[0], p[1]));
    for (let k = 1; k < w.pts.length; k++) {
      const [p, q] = [w.pts[k - 1], w.pts[k]];
      segs.push([p, q]);
      if (p[0] !== q[0] && p[1] !== q[1]) {
        // slanting: the grid points it passes through (a route bending there would join it)
        const gx = Math.round((q[0] - p[0]) / G), gy = Math.round((q[1] - p[1]) / G), gcd = (u, v) => (v ? gcd(v, u % v) : Math.abs(u)), n = gcd(gx, gy) || 1;
        for (let s = 0; s <= n; s++) nodes.add(key(p[0] + (gx / n) * s * G, p[1] + (gy / n) * s * G));
        continue;
      }
      const sx = Math.sign(q[0] - p[0]), sy = Math.sign(q[1] - p[1]);
      const m = Math.round(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) / G);
      for (let s = 0; s <= m; s++) {
        const x = p[0] + sx * s * G, y = p[1] + sy * s * G;
        nodes.add(key(x, y));
        if (s < m) edges.add(key(Math.min(x, x + sx * G), Math.min(y, y + sy * G)) + (sx ? 'h' : 'v'));
      }
    }
  }
  return { bodies, polys, posts, ends, nodes, edges, segs };
}

/**
 * How bad a wire route is: 0 = clean. Cutting through a part costs per half
 * grid step; touching a terminal or another wire's end, bending on another
 * wire or running along one (all of which would create a connection the user
 * did not draw) costs a lot. Crossing another wire is fine.
 */
export function routeCost(ctx, pts, joinsOnly = false) {
  const G = GRID, HG = G / 2;
  let cost = 0;
  const last = pts.length - 1;
  // joinsOnly: count only what would create a connection the user did not draw
  const inBody = (x, y) => !joinsOnly && ctx.bodies.some(([x1, y1, x2, y2], i) => x > x1 + 0.5 && x < x2 - 0.5 && y > y1 + 0.5 && y < y2 - 0.5 && (!ctx.polys?.[i] || inPoly(ctx.polys[i], x, y, 0.5)));
  for (let k = 1; k <= last; k++) {
    const [p, q] = [pts[k - 1], pts[k]];
    const len = Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]));
    const m = Math.max(1, Math.round(len / HG));
    for (let s = 0; s <= m; s++) {
      if ((k === 1 && s === 0) || (k === last && s === m)) continue; // the wire's own ends
      if (s === 0) continue; // counted as the previous segment's last sample
      const x = p[0] + ((q[0] - p[0]) * s) / m, y = p[1] + ((q[1] - p[1]) * s) / m;
      if (inBody(x, y)) cost += 10;
      if (x % G === 0 && y % G === 0) {
        const kk = key(x, y);
        if (ctx.posts.has(kk) || ctx.ends.has(kk)) cost += 60;
      }
      if (s < m && (p[0] === q[0] || p[1] === q[1])) {
        const x2 = p[0] + ((q[0] - p[0]) * (s + 1)) / m, y2 = p[1] + ((q[1] - p[1]) * (s + 1)) / m;
        const gx = Math.floor(Math.min(x, x2) / G) * G, gy = Math.floor(Math.min(y, y2) / G) * G;
        if (ctx.edges.has(key(gx, gy) + (p[1] === q[1] ? 'h' : 'v'))) cost += 30;
      }
    }
    if (k < last && ctx.nodes.has(key(q[0], q[1]))) cost += 60; // a corner on another wire joins it
  }
  return cost;
}

const wireLen = (pts) => pts.slice(1).reduce((a, q, i) => a + Math.abs(q[0] - pts[i][0]) + Math.abs(q[1] - pts[i][1]), 0);

/** Number of times an orthogonal route crosses other wires. */
function crossings(ctx, pts) {
  let n = 0;
  for (let k = 1; k < pts.length; k++) {
    const [p, q] = [pts[k - 1], pts[k]];
    if (p[0] !== q[0] && p[1] !== q[1]) continue;
    for (const [r, t] of ctx.segs) {
      if (r[0] !== t[0] && r[1] !== t[1]) continue;
      const hA = p[1] === q[1], hB = r[1] === t[1];
      if (hA === hB) continue;
      const [h1, h2, v1, v2] = hA ? [p, q, r, t] : [r, t, p, q];
      const x = v1[0], y = h1[1];
      if (x > Math.min(h1[0], h2[0]) && x < Math.max(h1[0], h2[0]) && y > Math.min(v1[1], v2[1]) && y < Math.max(v1[1], v2[1])) n++;
    }
  }
  return n;
}

/** Combined score: hard problems dominate, then looks. Lower is better. */
export function routeScore(doc, ctx, pts) { return routeCost(ctx, pts) * 100 + looksCost(doc, pts, ctx); }

/** Heading index (into DIRS) of the segment p→q, or -1. */
function heading(p, q) {
  if (q[0] > p[0]) return 0; if (q[1] > p[1]) return 1; if (q[0] < p[0]) return 2; if (q[1] < p[1]) return 3;
  return -1;
}

/**
 * Soft (looks) cost: bends, extra length over the direct Manhattan distance,
 * and leaving / entering a terminal sideways (entering sideways beats a long
 * loop around the part, going back through it is a hard cost anyway).
 */
function looksCost(doc, pts, ctx) {
  const n = pts.length, a = pts[0], b = pts[n - 1];
  let c = 0.5 * Math.max(0, n - 2);
  if (ctx) c += 0.8 * crossings(ctx, pts);
  for (let k = 1; k < n; k++) if (pts[k][0] !== pts[k - 1][0] && pts[k][1] !== pts[k - 1][1]) c += 6; // slanted
  c += (0.5 * (wireLen(pts) - Math.abs(a[0] - b[0]) - Math.abs(a[1] - b[1]))) / GRID;
  const ea = exitAt(doc, a), eb = exitAt(doc, b);
  if (ea >= 0 && heading(a, pts[1]) !== ea) c += 1.5;
  if (eb >= 0 && heading(b, pts[n - 2]) !== eb) c += 1.5;
  return c;
}

/** Simple one- and two-bend shapes between a and b, the preferred one first. */
export function simpleRoutes(a, b, ea = -1, eb = -1, hFirst = true) {
  const G = GRID, out = [];
  const L = (h) => (a[0] === b[0] || a[1] === b[1] ? [a, b] : h ? [a, [b[0], a[1]], b] : [a, [a[0], b[1]], b]);
  out.push(L(hFirst), naturalRoute(a, b, ea, eb, hFirst), L(!hFirst));
  if (a[0] !== b[0] && a[1] !== b[1]) {
    const mx = snapG((a[0] + b[0]) / 2), my = snapG((a[1] + b[1]) / 2);
    const sx = Math.sign(b[0] - a[0]), sy = Math.sign(b[1] - a[1]);
    // the middle leg of a Z: halfway first, then every other column / row in between
    // (several wires moving side by side each need their own)
    const cols = [mx], rows = [my];
    for (let x = a[0] + sx * G; x !== b[0] && cols.length < 40; x += sx * G) cols.push(x);
    for (let y = a[1] + sy * G; y !== b[1] && rows.length < 40; y += sy * G) rows.push(y);
    for (const x of new Set(cols)) out.push([a, [x, a[1]], [x, b[1]], b]);
    for (const y of new Set(rows)) out.push([a, [a[0], y], [b[0], y], b]);
    out.push([a, b]); // last resort: a straight slanted wire beats a false connection
  } else if (a[0] !== b[0] || a[1] !== b[1]) {
    // ends in line: the straight wire may run over a terminal in between (a part dragged next
    // to its own wire), so also offer side-steps that run parallel to it
    const vert = a[0] === b[0];
    for (const d of [1, -1, 2, -2, 3, -3]) {
      const ox = vert ? d * G : 0, oy = vert ? 0 : d * G;
      out.push([a, [a[0] + ox, a[1] + oy], [b[0] + ox, b[1] + oy], b]);
    }
  }
  return out;
}

/**
 * Pick a route among simple candidates (earlier ones win ties). A candidate that
 * cuts through a part or makes a false connection always loses to a clean one;
 * among clean ones the shape that follows the terminals' leads with few bends
 * wins. The search router is only used when every simple shape is bad, and only
 * if it is not a long detour.
 */
export function pickRoute(doc, candidates, opts = {}) {
  const ctx = wireContext(doc, opts.skipWires);
  let best = null, bestHard = Infinity, bestScore = Infinity;
  for (const raw of candidates) {
    if (!raw || raw.length < 2) continue;
    const c = simplifyPts(raw);
    // both ends on one point (a drag brought them together): no shape to score — the caller
    // keeps a zero-length wire. Scoring it used to crash the drag (reading pts[1] of one point).
    if (c.length < 2) continue;
    const hard = routeCost(ctx, c);
    const score = hard * 100 + looksCost(doc, c, ctx);
    if (score < bestScore - 1e-9) { best = c; bestHard = hard; bestScore = score; }
  }
  if (!best) return null;
  if (bestHard === 0 || opts.noSearch) return best;
  const a = best[0], b = best[best.length - 1];
  const manhattan = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  for (const o of [{ exitA: -1, exitB: -1 }, {}]) { // sideways entry allowed first: it avoids loops
    const smart = autoRoute(doc, a, b, { skipWires: opts.skipWires, ...o });
    if (!smart || wireLen(smart) > Math.max(manhattan * 1.6, manhattan + 8 * GRID)) continue;
    const hard = routeCost(ctx, smart);
    if (hard < bestHard) { best = smart; bestHard = hard; }
    if (hard === 0) break;
  }
  return best;
}
