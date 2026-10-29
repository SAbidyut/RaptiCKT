// From a figure's line drawing to a circuit: wires (straight horizontal and vertical runs),
// the vertices they meet at, and the two-terminal parts between wire ends — resistors
// (zigzags), sources (circles and diamonds), capacitors and batteries (plates), inductors
// (coils) — plus grounds hanging off a wire end.

import { thin, skeletonGraph, pruneSpurs, edgePoints, simplify } from './skeleton.js';
import { findShapes } from './shapes.js';
import { components, fillPinholes } from './image.js';
import { arrowTip } from './arrow.js';

const deg = (a) => (a * 180) / Math.PI;

/** Inside a source body (outline included)? */
function inShape(s, x, y, pad) {
  if (s.kind === 'circle') return Math.hypot((x - s.cx) / ((s.rx || s.r) + pad), (y - s.cy) / ((s.ry || s.r) + pad)) <= 1;
  return Math.abs(x - s.cx) + Math.abs(y - s.cy) <= s.r + pad * 1.42;
}
function inInterior(s, x, y, pad) {
  if (s.kind === 'circle') return Math.hypot((x - s.cx) / Math.max(1, (s.rx || s.r) - pad), (y - s.cy) / Math.max(1, (s.ry || s.r) - pad)) <= 1;
  return Math.abs(x - s.cx) + Math.abs(y - s.cy) <= s.r - pad * 1.42;
}

/**
 * How far apart two plates face each other as a capacitor's or a battery's do — in line, their
 * wires leaving on opposite sides, away from each other — or -1 when they do not. Drawn by
 * hand, plates are often long and wide apart: the gap is weighed against their length.
 */
export function plateGap(P, Q, sw) {
  if (Q.dir !== P.dir) return -1;
  const along = P.dir === 'v' ? Math.abs(Q.cx - P.cx) : Math.abs(Q.cy - P.cy);
  const across = P.dir === 'v' ? Math.abs(Q.cy - P.cy) : Math.abs(Q.cx - P.cx);
  const short = Math.min(P.len, Q.len);
  // (a battery's short plate is often half the long one, or less)
  if (across > Math.max(2 * sw, 0.3 * short) || along > Math.max(8 * sw, 0.9 * short, 0.5 * Math.max(P.len, Q.len)) || along < 0.5 * sw) return -1;
  if (P.wireFrom[0] + Q.wireFrom[0] !== 0 || P.wireFrom[1] + Q.wireFrom[1] !== 0) return -1;
  // each wire on its own side, not between the plates
  if ((Q.cx - P.cx) * P.wireFrom[0] + (Q.cy - P.cy) * P.wireFrom[1] > 0) return -1;
  return along;
}

/**
 * The little rings of paper a line drawing closes around (bigger than a pinhole, much smaller
 * than a source body): { x, y, area } each.
 */
function smallHoles(art, W, H, sw) {
  const seen = new Uint8Array(W * H), out = [], stack = [];
  for (let i = 0; i < W * H; i++) {
    if (art[i] || seen[i]) continue;
    let n = 0, sx = 0, sy = 0, open = false;
    seen[i] = 1; stack.push(i);
    while (stack.length) {
      const j = stack.pop(), x = j % W, y = (j - x) / W;
      n++; sx += x; sy += y;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) open = true;
      if (n > 60 * sw * sw) open = true;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) if (k >= 0 && !art[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
    }
    if (!open && n >= sw * sw) out.push({ x: sx / n, y: sy / n, area: n });
  }
  return out;
}

/**
 * Read the structure of one figure. `img` = { w, h, ink, labels, comps, sw }; `fig` from
 * findFigures. Returns { vertices, wires, parts, grounds, shapes, plates, tilt, … } (tilt: how far
 * the page is turned, dy per dx).
 * vertices: { id, x, y }; wires: { a, b } (vertex ids, straight H or V);
 * parts: { id, type, a, b, axis ('h'|'v'), cx, cy, box, plus ('a'|'b'|null), arrow ('a'|'b'|null), ... }.
 */
export function readStructure(img, fig) {
  const { w, h, ink, labels, sw } = img;
  const pad = Math.round(4 * sw);
  const X0 = Math.max(0, fig.box[0] - pad), Y0 = Math.max(0, fig.box[1] - pad);
  const X1 = Math.min(w - 1, fig.box[2] + pad), Y1 = Math.min(h - 1, fig.box[3] + pad);
  const W = X1 - X0 + 1, H = Y1 - Y0 + 1;
  // local copies: the figure's line drawing, and all ink
  const isPart = new Set(fig.parts);
  const art = new Uint8Array(W * H), all = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (Y0 + y) * w + (X0 + x);
      if (ink[i]) { all[y * W + x] = 1; if (isPart.has(labels[i])) art[y * W + x] = 1; }
    }
  }
  fillPinholes(art, W, H, Math.round(0.6 * sw * sw));
  const shapes = findShapes(art, W, H, [0, 0, W - 1, H - 1], sw);
  const holes = smallHoles(art, W, H, sw);
  let g = skeletonGraph(thin(art, W, H), W, H);
  g = pruneSpurs(g, Math.max(3, Math.round(1.6 * sw)));

  // ---------------------------------------------------------------- vertices and pieces
  const vertices = [];
  const vNode = new Map(); // graph node → vertex
  const addV = (x, y, extra = {}) => { const v = { id: vertices.length, x, y, ...extra }; vertices.push(v); return v.id; };
  const nodeV = (nid) => { if (!vNode.has(nid)) { const nd = g.nodes[nid]; vNode.set(nid, addV(nd.x, nd.y, { node: nid })); } return vNode.get(nid); };
  const shapeOf = (x, y) => shapes.findIndex((s) => inShape(s, x, y, 0.9 * sw));
  const pieces = [];
  const shapeTerm = shapes.map(() => []); // vertices where a wire run leaves each shape
  const eps = Math.max(1.5, 0.6 * sw);
  let runs = 0;
  for (const e of g.edges) {
    const pts = edgePoints(g, e);
    const inS = pts.map(([x, y]) => shapeOf(x, y));
    // runs of points outside every shape
    let k = 0;
    while (k < pts.length) {
      if (inS[k] >= 0) { k++; continue; }
      let j = k;
      while (j + 1 < pts.length && inS[j + 1] < 0) j++;
      const run = pts.slice(k, j + 1);
      if (run.length >= 2) {
        const startV = k === 0 ? nodeV(e.a) : addV(run[0][0], run[0][1], { cut: inS[k - 1] });
        const endV = j === pts.length - 1 ? nodeV(e.b) : addV(run[run.length - 1][0], run[run.length - 1][1], { cut: inS[j + 1] });
        if (k > 0) shapeTerm[inS[k - 1]].push(startV);
        if (j < pts.length - 1) shapeTerm[inS[j + 1]].push(endV);
        const keep = simplify(run, eps);
        const runId = runs++;
        let prevV = startV;
        for (let q = 1; q < keep.length; q++) {
          const a = run[keep[q - 1]], b = run[keep[q]];
          const vb = q === keep.length - 1 ? endV : addV(b[0], b[1]);
          const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
          const ang = deg(Math.atan2(Math.abs(dy), Math.abs(dx)));
          pieces.push({ id: pieces.length, a: prevV, b: vb, pts: run.slice(keep[q - 1], keep[q] + 1), len, dx, dy, dir: ang <= 15 ? 'h' : ang >= 75 ? 'v' : null, cls: null, run: runId, k: q - 1 });
          prevV = vb;
        }
      } else if (run.length === 1 && k > 0 && j < pts.length - 1 && inS[k - 1] !== inS[j + 1]) {
        // two shapes touching through a single pixel: nothing between them
      }
      k = j + 1;
    }
  }
  const at = vertices.map(() => []); // vertex → incident pieces
  for (const p of pieces) { at[p.a].push(p.id); at[p.b].push(p.id); }
  const other = (p, v) => (p.a === v ? p.b : p.a);

  // ---------------------------------------------------------------- plates
  // a plate: a short straight bar whose middle a wire meets at right angles, both bar ends free
  // (drawn by hand, a bar may be longer, lean a little and meet its wire a little askew)
  const plates = [];
  const plateMax = Math.max(12 * sw, 0.15 * Math.max(W, H));
  const away = (p, v) => {
    const o = vertices[other(p, v)], V = vertices[v], dx = o.x - V.x, dy = o.y - V.y, l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  // one half of a bar from where the wire meets it: its pieces on to a free end, going on
  // straight (a pen stroke's end may hook a little: the half is then two pieces)
  const half = (p, v) => {
    const u0 = away(p, v), list = [p];
    let cur = p, from = v, len = p.len;
    for (;;) {
      const to = other(cur, from);
      if (at[to].length === 1) return { list, len, end: to };
      if (at[to].length !== 2 || list.length >= 3) return null;
      const nxt = pieces[at[to].find((id) => id !== cur.id)];
      const u = away(nxt, to);
      if (u[0] * u0[0] + u[1] * u0[1] < 0.85) return null;
      list.push(nxt); len += nxt.len; from = to; cur = nxt;
    }
  };
  for (const v of vertices) {
    const inc = at[v.id];
    if (inc.length !== 3) continue;
    const ps = inc.map((id) => pieces[id]);
    for (let i = 0; i < 3; i++) {
      const [p1, p2] = ps.filter((_, k) => k !== i), p3 = ps[i];
      const h1 = half(p1, v.id), h2 = half(p2, v.id);
      if (!h1 || !h2) continue;
      // (a sketch's plates are drawn long beside a thin pen line: long, for the drawing's size)
      if (h1.len > plateMax || h2.len > plateMax) continue;
      // the two halves point opposite ways, in one line; the bar lies within 25° of level (or
      // of upright), and the wire meets it within 25° of square
      const u1 = away(p1, v.id), u2 = away(p2, v.id), u3 = away(p3, v.id);
      if (u1[0] * u2[0] + u1[1] * u2[1] > -0.9) continue;
      const bx = u1[0] - u2[0], by = u1[1] - u2[1], bl = Math.hypot(bx, by);
      if (Math.min(Math.abs(bx), Math.abs(by)) / bl > 0.42 || Math.abs(bx * u3[0] + by * u3[1]) / bl > 0.42) continue;
      const dir = Math.abs(bx) >= Math.abs(by) ? 'h' : 'v';
      const e1 = vertices[h1.end], e2 = vertices[h2.end];
      for (const q of [...h1.list, ...h2.list]) q.cls = 'plate';
      const ov = other(p3, v.id), o = vertices[ov];
      // which side the wire comes from, along the wire only (a tilt of a pixel is no side)
      const from = dir === 'h' ? [0, Math.sign(o.y - v.y)] : [Math.sign(o.x - v.x), 0];
      plates.push({ v: v.id, dir, len: h1.len + h2.len, cx: (e1.x + e2.x) / 2, cy: (e1.y + e2.y) / 2, wireFrom: from, wire: p3.id });
      break;
    }
  }

  // ---------------------------------------------------------------- wire or part
  // a wire never turns straight back: steep strokes that go up, down, up … (or left, right …)
  // are a zigzag, however upright they are
  const byRun = new Map();
  for (const p of pieces) { if (!byRun.has(p.run)) byRun.set(p.run, []); byRun.get(p.run).push(p); }
  // (the next stroke, or one a short bend further on: a tip drawn by hand is rounded; long
  // strokes only when the two are of a length, as a wide zigzag's are, not a hook at a wire's end)
  const back = (p, q) => {
    const long = Math.max(p.len, q.len);
    return p.dx * q.dx + p.dy * q.dy < -0.5 * p.len * q.len && (long <= 8 * sw || (long <= 14 * sw && Math.min(p.len, q.len) >= 0.5 * long));
  };
  for (const list of byRun.values()) {
    list.sort((a, b) => a.k - b.k);
    for (let k = 0; k + 1 < list.length; k++) {
      const p = list[k];
      if (p.cls === 'plate' || p.len > 14 * sw) continue;
      for (let j = k + 1, bend = 0; j < list.length && bend <= 3 * sw; j++) {
        const q = list[j];
        if (q.cls === 'plate' || q.len > 14 * sw) break;
        if (back(p, q)) {
          for (let t = k; t <= j; t++) list[t].cls = 'other';
          break;
        }
        bend += q.len;
      }
    }
  }
  for (const p of pieces) if (!p.cls) p.cls = p.a === p.b ? 'drop' : p.dir ? 'wire' : 'other'; // a loop: a tiny hole in a thick blot
  // what is left of a source body's outline just outside the shape fitted to it is no part (a
  // small ring is a joint: what runs into it are its wires)
  for (const p of pieces) {
    if (p.cls === 'other' && shapes.some((s) => s.r >= 3 * sw && p.pts.every(([x, y]) => inShape(s, x, y, 1.6 * sw)))) p.cls = 'drop';
  }
  // pieces at a vertex, leaving out dropped specks
  const live = (v, but) => at[v].filter((id) => id !== but && pieces[id].cls !== 'drop');
  // short dangling branches are ticks and specks (a burr on a zigzag, a letter touching a wire):
  // prune them leaf by leaf; plates keep their free ends
  for (let round = 0; round < 6; round++) {
    let changed = false;
    // (a point on a source body is held by the body, not free)
    const free = (v, but) => vertices[v].cut == null && live(v, but).length === 0;
    for (const p of pieces) {
      if (p.cls === 'drop' || p.cls === 'plate' || p.len >= 3 * sw) continue;
      if (free(p.a, p.id) !== free(p.b, p.id)) { p.cls = 'drop'; changed = true; }
    }
    if (!changed) break;
  }
  // a short straight bit between pieces of a part (a zigzag tip, the side of a coil)
  for (let round = 0; round < 4; round++) {
    let changed = false;
    for (const p of pieces) {
      if (p.cls !== 'wire' || p.len >= 5 * sw) continue;
      const na = live(p.a, p.id), nb = live(p.b, p.id);
      if (na.length && nb.length && na.every((id) => pieces[id].cls === 'other') && nb.every((id) => pieces[id].cls === 'other')) { p.cls = 'other'; changed = true; }
    }
    if (!changed) break;
  }

  // ---------------------------------------------------------------- parts from 'other' pieces
  const groupOf = new Int32Array(pieces.length).fill(-1);
  const groups = [];
  for (const p of pieces) {
    if (p.cls !== 'other' || groupOf[p.id] >= 0) continue;
    const gid = groups.length, list = [];
    const stack = [p.id];
    groupOf[p.id] = gid;
    while (stack.length) {
      const q = pieces[stack.pop()];
      list.push(q.id);
      for (const v of [q.a, q.b]) for (const id of at[v]) if (pieces[id].cls === 'other' && groupOf[id] < 0) { groupOf[id] = gid; stack.push(id); }
    }
    groups.push(list);
  }
  // a tiny kink in a wire (a jog, a blot at a corner) is still wire
  for (const list of groups) {
    const len = list.reduce((t, id) => t + pieces[id].len, 0);
    const pts = list.flatMap((id) => pieces[id].pts);
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const off = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (len < 4 * sw && off < 1.5 * sw && span < 4 * sw) {
      for (const id of list) { const q = pieces[id]; q.cls = 'wire'; q.dir = Math.abs(q.dx) >= Math.abs(q.dy) ? 'h' : 'v'; }
      list.length = 0;
    }
  }
  // where a part's lead runs, across the part's axis: its wire a little way out from terminal v,
  // where it runs straight (a zigzag may start at a tip, its lead bent over to it)
  const lead = (v, axis) => {
    const V = vertices[v], here = axis === 'h' ? V.y : V.x, vals = [];
    const seen = new Set([v]);
    let ring = [v];
    for (let step = 0; step < 4 && ring.length; step++) {
      const next = [];
      for (const u of ring) for (const id of at[u]) {
        // (along the lead only: wire running the part's way, or a little bend into it)
        const q = pieces[id], o = other(q, u);
        if (q.cls !== 'wire' || seen.has(o) || (q.dir !== axis && q.len > 2 * sw)) continue;
        seen.add(o); next.push(o);
        if (q.dir !== axis) continue;
        for (const [x, y] of q.pts) {
          const out = axis === 'h' ? Math.abs(x - V.x) : Math.abs(y - V.y), across = axis === 'h' ? y : x;
          if (out >= 2 * sw && out <= 8 * sw && Math.abs(across - here) <= 3 * sw) vals.push(across);
        }
      }
      ring = next;
    }
    return vals.length ? vals.sort((a, b) => a - b)[vals.length >> 1] : here;
  };
  // a coil drawn as a spring seen from the side (ℓℓℓ): each turn closes a little ring, all on one
  // side of its line (the rings a stray line makes across a zigzag lie on both)
  const coilRings = (part, A, B, box) => {
    if (part.type === 'inductor') return part;
    const L = Math.hypot(B.x - A.x, B.y - A.y) || 1, nx = -(B.y - A.y) / L, ny = (B.x - A.x) / L;
    const near = holes.filter((o) => o.x >= box[0] - 3 * sw && o.x <= box[2] + 3 * sw && o.y >= box[1] - 3 * sw && o.y <= box[3] + 3 * sw);
    const side = near.map((o) => (o.x - A.x) * nx + (o.y - A.y) * ny);
    if (near.length < 2 || !(side.every((d) => d > 0.5 * sw) || side.every((d) => d < -0.5 * sw))) return part;
    return { ...part, type: 'inductor', flips: near.length, rings: near.length };
  };
  const parts = [];
  for (const list of groups) {
    if (!list.length) continue;
    const vs = new Set();
    for (const id of list) { vs.add(pieces[id].a); vs.add(pieces[id].b); }
    // terminals: vertices of the group where a wire (or a plate's wire) continues
    // terminals: where a wire continues, or where the part runs straight into a source body
    const terms = [...vs].filter((v) => vertices[v].cut != null || at[v].some((id) => pieces[id].cls === 'wire'));
    const pts = list.flatMap((id) => pieces[id].pts);
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const len = list.reduce((s, id) => s + pieces[id].len, 0);
    if (terms.length < 2) {
      if (len > 3 * sw) parts.push({ type: 'loose', terms, box, pieces: list });
      continue;
    }
    // the two terminals farthest apart along one axis
    let a = terms[0], b = terms[1], best = -1;
    for (const u of terms) for (const v of terms) {
      if (u >= v) continue;
      const d = Math.max(Math.abs(vertices[u].x - vertices[v].x), Math.abs(vertices[u].y - vertices[v].y));
      if (d > best) { best = d; a = u; b = v; }
    }
    let part = classifyPath(vertices[a], vertices[b], pts, box, sw, list, orderPath(a, b, list, pieces, at), lead);
    part = coilRings(part, vertices[a], vertices[b], box);
    // a wire drawn by hand wobbles, and a mark on it (a hook, an arrowhead) bulges out; a part
    // zigzags or coils: what never turns back and is hardly longer than its ends are apart is wire
    // (unless it turns this way and that all along, a zigzag drawn small and tight)
    const chord = Math.hypot(vertices[a].x - vertices[b].x, vertices[a].y - vertices[b].y);
    if (part.type !== 'inductor' && part.flips <= 1 && part.turns < 4 && len < 1.35 * chord) {
      const dir = Math.abs(vertices[a].x - vertices[b].x) >= Math.abs(vertices[a].y - vertices[b].y) ? 'h' : 'v';
      for (const id of list) { pieces[id].cls = 'wire'; pieces[id].dir = dir; }
      continue;
    }
    parts.push(part);
  }

  // two path parts meeting end to end in line, with nothing else at the meeting point, are one
  // part (a zigzag cut in two by a blot or a stray bit of wire)
  const pathy = (p) => p.type === 'resistor' || p.type === 'inductor' || p.type === 'unknown';
  // the bit of wire around a vertex: its vertices and total length (wire pieces only)
  const wireBit = (v0) => {
    const seen = new Set([v0]), stack = [v0];
    let len = 0;
    while (stack.length) {
      const v = stack.pop();
      for (const id of at[v]) {
        const q = pieces[id];
        if (q.cls !== 'wire' || q.seen === v0) continue;
        q.seen = v0;
        len += q.len;
        const o = q.a === v ? q.b : q.a;
        if (!seen.has(o)) { seen.add(o); stack.push(o); }
      }
    }
    for (const q of pieces) if (q.seen === v0) delete q.seen;
    return { vs: seen, len };
  };
  for (let merged = true; merged;) {
    merged = false;
    for (let i = 0; i < parts.length && !merged; i++) {
      for (let j = i + 1; j < parts.length && !merged; j++) {
        const P = parts[i], Q = parts[j];
        if (!pathy(P) || !pathy(Q) || P.axis !== Q.axis) continue;
        // P's end and Q's end are one point, or joined by a little wire that nothing else uses
        let pair = null;
        for (const p of [P.a, P.b]) {
          const bit = wireBit(p);
          if (bit.len > 3 * sw) continue;
          const q = [Q.a, Q.b].find((x) => bit.vs.has(x));
          if (q == null) continue;
          const others = parts.some((R, k) => k !== i && k !== j && (bit.vs.has(R.a) || bit.vs.has(R.b)));
          if (!others && ![...bit.vs].some((v) => vertices[v].cut != null)) pair = [p, q];
        }
        if (!pair) continue;
        const ends = [P.a === pair[0] ? P.b : P.a, Q.a === pair[1] ? Q.b : Q.a];
        const A = vertices[ends[0]], B = vertices[ends[1]];
        const off = P.axis === 'h' ? Math.abs(A.y - B.y) : Math.abs(A.x - B.x);
        if (off > 2.5 * sw) continue;
        const list = [...P.pieces, ...Q.pieces];
        const pts = list.flatMap((id) => pieces[id].pts);
        const box = [Math.min(P.box[0], Q.box[0]), Math.min(P.box[1], Q.box[1]), Math.max(P.box[2], Q.box[2]), Math.max(P.box[3], Q.box[3])];
        const np = coilRings(classifyPath(A, B, pts, box, sw, list, orderPath(ends[0], ends[1], list, pieces, at), lead), A, B, box);
        if (np.type !== 'resistor' && np.type !== 'inductor') np.type = 'resistor';
        parts.splice(j, 1);
        parts[i] = np;
        merged = true;
      }
    }
  }

  // ---------------------------------------------------------------- sources
  shapes.forEach((s, k) => {
    // where a wire (or a part) leaves the body: not a speck pruned away
    const terms = [...new Set(shapeTerm[k])].filter((v) => at[v].some((id) => pieces[id].cls !== 'drop'));
    // a small ring is no source: at a wire's end it is an open terminal (a, b), where the wire
    // just ends; between wires, a joint
    if (s.r < 3 * sw) {
      if (terms.length >= 2) {
        const c = addV(s.cx, s.cy);
        at.push([]);
        for (const v of terms) {
          const V = vertices[v], dx = s.cx - V.x, dy = s.cy - V.y;
          const q = { id: pieces.length, a: v, b: c, pts: [[V.x, V.y], [s.cx, s.cy]], len: Math.hypot(dx, dy), dx, dy, dir: Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v', cls: 'wire' };
          pieces.push(q);
          at[v].push(q.id); at[c].push(q.id);
        }
      }
      return;
    }
    // drawn by hand, a wire may stop just short of the body: its free end, pointing at it, is
    // where it joins
    if (terms.length < 2) {
      for (const v of vertices) {
        if (terms.includes(v.id) || v.cut != null) continue;
        const inc = live(v.id, -1);
        if (inc.length !== 1 || pieces[inc[0]].cls !== 'wire') continue;
        const d = Math.hypot(v.x - s.cx, v.y - s.cy);
        if (inShape(s, v.x, v.y, -sw) || !inShape(s, v.x, v.y, 3 * sw)) continue;
        const o = vertices[other(pieces[inc[0]], v.id)], L = Math.hypot(v.x - o.x, v.y - o.y) || 1;
        if (((s.cx - v.x) * (v.x - o.x) + (s.cy - v.y) * (v.y - o.y)) / (L * (d || 1)) < 0.8) continue;
        terms.push(v.id);
      }
    }
    let a = null, b = null, best = -1;
    for (const u of terms) for (const v of terms) {
      if (u >= v) continue;
      const A = vertices[u], B = vertices[v];
      // opposite sides, through the centre
      const d = Math.hypot(A.x - B.x, A.y - B.y);
      const off = Math.abs((B.x - A.x) * (s.cy - A.y) - (B.y - A.y) * (s.cx - A.x)) / (d || 1);
      const v2 = d - 2 * off;
      if (v2 > best) { best = v2; a = u; b = v; }
    }
    const rx = s.rx || s.r, ry = s.ry || s.r;
    const part = { type: s.kind === 'circle' ? 'source' : 'depsource', shape: k, cx: s.cx, cy: s.cy, r: s.r, box: [s.cx - rx, s.cy - ry, s.cx + rx, s.cy + ry] };
    if (a == null) { part.terms = terms; parts.push({ ...part, type: 'loose' }); return; }
    const A = vertices[a], B = vertices[b];
    part.a = a; part.b = b;
    part.axis = Math.abs(B.x - A.x) >= Math.abs(B.y - A.y) ? 'h' : 'v';
    Object.assign(part, innerSymbol(all, W, H, s, A, B, sw));
    parts.push(part);
  });

  // loose straight bars nearby (the lower bars of a ground, the inner cells of a battery, a plate
  // drawn apart from its wire)
  const bars = looseBars(img, fig, X0, Y0, sw);
  const usedBars = new Set();
  // ---------------------------------------------------------------- plates the thinning lost
  // a short plate's halves can thin away (one or both): its wire then just ends at the bar; drawn
  // by hand, the bar may stop short of the wire, a stroke of its own just past the wire's end
  for (const v of vertices) {
    if (v.cut != null) continue;
    const inc = live(v.id, -1);
    if (inc.length !== 1) continue;
    const p = pieces[inc[0]];
    if (p.cls !== 'wire' || !p.dir || p.len < 2 * sw) continue;
    const o = vertices[other(p, v.id)];
    let bar = barAcross(art, W, H, v, p.dir, sw);
    if (!bar) {
      const L = Math.hypot(v.x - o.x, v.y - o.y) || 1, ux = (v.x - o.x) / L, uy = (v.y - o.y) / L;
      let best = null, bd = Infinity;
      for (const r of bars) {
        if (usedBars.has(r.id) || r.dir === p.dir) continue;
        // ahead of the end, and the wire's line through the bar
        const along = (r.cx - v.x) * ux + (r.cy - v.y) * uy, across = Math.abs(-(r.cx - v.x) * uy + (r.cy - v.y) * ux);
        if (along < -0.5 * sw || along > 4 * sw || across > r.len / 2) continue;
        if (along < bd) { bd = along; best = r; }
      }
      if (best) { usedBars.add(best.id); bar = best; }
    }
    if (!bar) continue;
    const from = p.dir === 'v' ? [0, Math.sign(o.y - v.y)] : [Math.sign(o.x - v.x), 0];
    plates.push({ v: v.id, dir: p.dir === 'v' ? 'h' : 'v', len: bar.len, cx: bar.cx, cy: bar.cy, wireFrom: from, wire: p.id });
  }

  // ---------------------------------------------------------------- capacitors, batteries, grounds
  const used = new Set();
  for (let i = 0; i < plates.length; i++) {
    if (used.has(i)) continue;
    const P = plates[i];
    let mate = -1, md = Infinity;
    for (let j = 0; j < plates.length; j++) {
      if (j === i || used.has(j)) continue;
      const along = plateGap(P, plates[j], sw);
      if (along >= 0 && along < md) { md = along; mate = j; }
    }
    if (mate >= 0) {
      used.add(i); used.add(mate);
      const Q = plates[mate];
      P.paired = Q.paired = true;
      const A = vertices[P.v], B = vertices[Q.v];
      const axis = P.dir === 'v' ? 'h' : 'v';
      const ratio = Math.min(P.len, Q.len) / Math.max(P.len, Q.len);
      const between = bars.filter((r) => r.dir === P.dir && (axis === 'h' ? r.cx > Math.min(A.x, B.x) && r.cx < Math.max(A.x, B.x) && Math.abs(r.cy - A.y) < 2 * sw : r.cy > Math.min(A.y, B.y) && r.cy < Math.max(A.y, B.y) && Math.abs(r.cx - A.x) < 2 * sw));
      const isBattery = ratio < 0.75 || between.length > 0;
      for (const r of between) usedBars.add(r.id);
      const part = { type: isBattery ? 'battery' : 'capacitor', a: P.v, b: Q.v, axis, cx: (A.x + B.x) / 2, cy: (A.y + B.y) / 2, box: [Math.min(A.x, B.x) - sw, Math.min(P.cy - P.len / 2, Q.cy - Q.len / 2), Math.max(A.x, B.x) + sw, Math.max(P.cy + P.len / 2, Q.cy + Q.len / 2)] };
      if (axis === 'v') part.box = [Math.min(P.cx - P.len / 2, Q.cx - Q.len / 2), Math.min(A.y, B.y) - sw, Math.max(P.cx + P.len / 2, Q.cx + Q.len / 2), Math.max(A.y, B.y) + sw];
      if (isBattery) part.plus = P.len >= Q.len ? 'a' : 'b'; // the long plate is +
      parts.push(part);
    }
  }
  const grounds = [];
  plates.forEach((P, i) => {
    if (used.has(i)) return;
    // a bar under a wire that comes down to it, often with shorter bars below it
    const V = vertices[P.v];
    const below = bars.filter((r) => r.dir === 'h' && r.cy > V.y && r.cy - V.y < 5 * sw && Math.abs(r.cx - V.x) < Math.max(2 * sw, P.len / 2));
    if ((P.dir === 'h' && P.wireFrom[1] === -1) || below.length) {
      grounds.push({ v: P.v, bars: below.length });
      for (const r of below) usedBars.add(r.id);
    }
  });

  // ---------------------------------------------------------------- switches
  // a lever: a straight stroke from where one wire ends, slanting off towards (not onto) the end
  // of the next wire, which it would close onto
  const ended = new Set([...plates.map((P) => P.v), ...grounds.map((g) => g.v)]);
  for (const p of parts) if (p.a != null) { ended.add(p.a); ended.add(p.b); }
  for (const L of parts) {
    if (L.type !== 'loose' || !L.pieces || L.terms.length !== 1) continue;
    const A = vertices[L.terms[0]];
    let E = null, ed = 0;
    for (const id of L.pieces) for (const [x, y] of pieces[id].pts) { const d = Math.hypot(x - A.x, y - A.y); if (d > ed) { ed = d; E = { x, y }; } }
    if (!E || ed < 6 * sw) continue;
    // its tip free: touching nothing (where a zigzag's stroke turns, it goes on)
    const tips = L.pieces.flatMap((id) => [pieces[id].a, pieces[id].b]).filter((v) => v !== A.id);
    const tip = tips.reduce((t, v) => (Math.hypot(vertices[v].x - A.x, vertices[v].y - A.y) > Math.hypot(vertices[t].x - A.x, vertices[t].y - A.y) ? v : t), tips[0]);
    if (at[tip].length !== 1) continue;
    const ux = (E.x - A.x) / ed, uy = (E.y - A.y) / ed;
    let bow = 0;
    for (const id of L.pieces) for (const [x, y] of pieces[id].pts) bow = Math.max(bow, Math.abs(-(x - A.x) * uy + (y - A.y) * ux));
    if (bow > Math.max(1.5 * sw, 0.12 * ed)) continue;
    let best = null, bd = Infinity;
    for (const v of vertices) {
      // (a contact drawn as a little ring: the wire ends at the ring)
      if (v.id === A.id || ended.has(v.id) || (v.cut != null && shapes[v.cut].r >= 3 * sw)) continue;
      const inc = live(v.id, -1);
      if (inc.length !== 1 || pieces[inc[0]].cls !== 'wire') continue;
      const d = Math.hypot(v.x - E.x, v.y - E.y), dAB = Math.hypot(v.x - A.x, v.y - A.y);
      if (d > Math.max(4 * sw, 0.5 * ed) || dAB < 0.6 * ed) continue;
      // the lever slants off the line to that end by 12° to 60°, its tip lifted clear of it
      const cos = ((v.x - A.x) * ux + (v.y - A.y) * uy) / dAB;
      if (cos > 0.978 || cos < 0.5) continue;
      if (Math.abs((E.x - A.x) * (v.y - A.y) - (E.y - A.y) * (v.x - A.x)) / dAB < 1.5 * sw) continue;
      if (d < bd) { bd = d; best = v; }
    }
    if (!best) continue;
    // and nothing else drawn in between (the rest of a zigzag drawn in two strokes)
    const bx0 = Math.min(A.x, best.x, E.x) + 0.5 * sw, bx1 = Math.max(A.x, best.x, E.x) - 0.5 * sw;
    const by0 = Math.min(A.y, best.y, E.y) + 0.5 * sw, by1 = Math.max(A.y, best.y, E.y) - 0.5 * sw;
    if (pieces.some((q) => q.cls === 'other' && !L.pieces.includes(q.id) && q.pts.some(([x, y]) => x > bx0 && x < bx1 && y > by0 && y < by1))) continue;
    Object.assign(L, { type: 'switch', a: A.id, b: best.id, axis: Math.abs(best.x - A.x) >= Math.abs(best.y - A.y) ? 'h' : 'v', cx: (A.x + best.x) / 2, cy: (A.y + best.y) / 2 });
    ended.add(A.id); ended.add(best.id);
  }

  // ---------------------------------------------------------------- wires
  const wires = pieces.filter((p) => p.cls === 'wire').map((p) => ({ a: p.a, b: p.b, dir: p.dir, len: p.len, id: p.id }));
  // how far the page is turned (dy per dx): the long wires run a little off level by as much
  const slopes = [];
  for (const wv of wires) {
    const A = vertices[wv.a], B = vertices[wv.b];
    const dx = B.x - A.x, dy = B.y - A.y;
    if (Math.hypot(dx, dy) < 8 * sw) continue;
    slopes.push(wv.dir === 'h' ? dy / dx : -dx / dy);
  }
  slopes.sort((a, b) => a - b);
  const tilt = slopes.length >= 3 ? Math.max(-0.15, Math.min(0.15, slopes[slopes.length >> 1])) : 0;
  // global coordinates out
  for (const v of vertices) { v.x += X0; v.y += Y0; }
  for (const p of parts) {
    if (p.cx != null) { p.cx += X0; p.cy += Y0; }
    if (p.box) p.box = [p.box[0] + X0, p.box[1] + Y0, p.box[2] + X0, p.box[3] + Y0];
  }
  for (const P of plates) { P.cx += X0; P.cy += Y0; }
  return { vertices, wires, parts, grounds, shapes: shapes.map((s) => ({ ...s, cx: s.cx + X0, cy: s.cy + Y0 })), plates, origin: [X0, Y0], pieces, usedBars: [...usedBars], tilt };
}

/** The group's pieces in order from vertex a to vertex b, when they form one simple path. */
function orderPath(a, b, list, pieces, at) {
  const inGroup = new Set(list);
  const out = [];
  let v = a, prev = -1;
  for (let guard = 0; guard < list.length + 1; guard++) {
    if (v === b) return out.length === list.length ? out : out.length >= list.length * 0.8 ? out : null;
    const next = at[v].filter((id) => inGroup.has(id) && id !== prev);
    if (next.length !== 1) return null;
    const q = pieces[next[0]];
    const forward = q.a === v;
    out.push({ dx: forward ? q.dx : -q.dx, dy: forward ? q.dy : -q.dy, len: q.len });
    prev = q.id;
    v = forward ? q.b : q.a;
  }
  return null;
}

/**
 * A part drawn as a path between two terminals: a zigzag (resistor), bumps on one side
 * (inductor) or something else.
 */
function classifyPath(A, B, pts, box, sw, list, path, lead) {
  const axis = Math.abs(B.x - A.x) >= Math.abs(B.y - A.y) ? 'h' : 'v';
  const ux = axis === 'h' ? Math.sign(B.x - A.x) || 1 : 0, uy = axis === 'v' ? Math.sign(B.y - A.y) || 1 : 0;
  const L = axis === 'h' ? Math.abs(B.x - A.x) : Math.abs(B.y - A.y);
  // profile: offset from the line its leads run on, against the distance along it
  const bins = Math.max(4, Math.round(L / (0.5 * sw)));
  const sum = new Float64Array(bins), cnt = new Uint32Array(bins);
  const base = lead ? (lead(A.id, axis) + lead(B.id, axis)) / 2 : axis === 'h' ? (A.y + B.y) / 2 : (A.x + B.x) / 2;
  for (const [x, y] of pts) {
    const t = axis === 'h' ? (x - A.x) * ux : (y - A.y) * uy;
    const s = axis === 'h' ? y - base : x - base;
    const k = Math.min(bins - 1, Math.max(0, Math.floor((t / (L || 1)) * bins)));
    sum[k] += s; cnt[k]++;
  }
  const prof = [];
  for (let k = 0; k < bins; k++) if (cnt[k]) prof.push(sum[k] / cnt[k]);
  const amp = Math.max(...prof.map(Math.abs));
  // sign changes of the offset, ignoring the flat middle band
  let flips = 0, last = 0, pos = 0, neg = 0;
  for (const s of prof) {
    const sg = s > 0.45 * sw ? 1 : s < -0.45 * sw ? -1 : 0;
    if (sg > 0) pos++; else if (sg < 0) neg++;
    if (sg && last && sg !== last) flips++;
    if (sg) last = sg;
  }
  const oneSide = Math.max(pos, neg) / Math.max(1, pos + neg);
  // how far it crosses its line, for how far it swings out: a coil's bumps rise from the line on
  // one side (its cusps touch it), a zigzag swings across it, however lopsided (its very ends,
  // where the leads come in, left out)
  const inner = prof.slice(Math.floor(0.12 * prof.length), Math.ceil(0.88 * prof.length));
  const hi = Math.max(0, ...inner), lo = Math.min(0, ...inner);
  const cross = Math.min(hi, -lo) / Math.max(hi, -lo, 1e-6);
  // along one simple path: a zigzag turns sharply at every tip, a coil bends gently
  let turns = 0;
  if (path && path.length >= 3) {
    let sharp = 0, gentle = 0, bend = 0;
    for (let k = 1; k < path.length; k++) {
      const p = path[k - 1], q = path[k];
      if (p.len < 0.8 * sw || q.len < 0.8 * sw) continue;
      const c = (p.dx * q.dx + p.dy * q.dy) / (p.len * q.len);
      const turn = deg(Math.acos(Math.max(-1, Math.min(1, c))));
      if (turn > 95) sharp++; else if (turn > 15) { gentle++; bend += Math.sign(p.dx * q.dy - p.dy * q.dx); }
    }
    turns = sharp + gentle;
    if (sharp >= 2 && sharp >= gentle - 1) return { type: 'resistor', a: A.id, b: B.id, axis, cx: (A.x + B.x) / 2, cy: (A.y + B.y) / 2, box, flips: sharp, turns, amp, pieces: list };
    // a coil: gentle bumps all on one side (it takes a clean drawing to tell; resistors are the
    // usual part, so anything less certain stays one)
    if (gentle >= 3 && sharp <= 1 && oneSide > 0.8 && cross < 0.3) return { type: 'inductor', a: A.id, b: B.id, axis, cx: (A.x + B.x) / 2, cy: (A.y + B.y) / 2, box, flips: gentle, turns, amp, pieces: list };
  }
  let type = 'unknown';
  if ((flips >= 2 || amp >= 0.7 * sw) && amp < 6 * sw) type = 'resistor';
  // (a zigzag drawn wide by hand, its tips rounded: back and forth across its line)
  if (flips >= 3 && cross >= 0.3 && amp < 10 * sw) type = 'resistor';
  return { type, a: A.id, b: B.id, axis, cx: (A.x + B.x) / 2, cy: (A.y + B.y) / 2, box, flips, turns, amp, pieces: list };
}

/**
 * What is drawn inside a source: + / − signs (a voltage source, which end is +) or an arrow
 * (a current source, which way it points). A and B are the two terminal vertices.
 */
function innerSymbol(all, W, H, s, A, B, sw) {
  const R = Math.ceil(Math.max(s.r, s.rx || 0, s.ry || 0));
  const x0 = Math.max(0, Math.floor(s.cx - R)), y0 = Math.max(0, Math.floor(s.cy - R));
  const x1 = Math.min(W - 1, Math.ceil(s.cx + R)), y1 = Math.min(H - 1, Math.ceil(s.cy + R));
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const m = new Uint8Array(bw * bh);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (all[y * W + x] && inInterior(s, x, y, 1.0 * sw)) m[(y - y0) * bw + (x - x0)] = 1;
  const { labels, comps } = components(m, bw, bh);
  // direction from terminal a to b
  const ax = B.x - A.x, ay = B.y - A.y, aL = Math.hypot(ax, ay) || 1;
  const ux = ax / aL, uy = ay / aL;
  let plus = null, minus = null, arrow = null, wave = false;
  const signs = [];
  for (const c of comps) {
    if (c.area < 0.5 * sw * sw) continue;
    const cw = c.x1 - c.x0 + 1, ch = c.y1 - c.y0 + 1;
    const pts = [];
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if (labels[y * bw + x] === c.id) pts.push([x + x0, y + y0]);
    // principal direction
    let mx = 0, my = 0;
    for (const [x, y] of pts) { mx += x; my += y; }
    mx /= pts.length; my /= pts.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    const tr = sxx + syy, dt = sxx * syy - sxy * sxy, l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - dt)), l2 = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - dt));
    const elong = Math.sqrt(l1 / Math.max(1e-6, l2));
    let vx = sxy, vy = l1 - sxx;
    if (Math.abs(vx) + Math.abs(vy) < 1e-9) { vx = sxx >= syy ? 1 : 0; vy = sxx >= syy ? 0 : 1; }
    const vl = Math.hypot(vx, vy); vx /= vl; vy /= vl;
    const along = (mx - s.cx) * ux + (my - s.cy) * uy; // where it sits between the terminals
    const long = Math.max(cw, ch);
    // centre row and column runs: a plus has both
    const rowRun = (yy) => { let best = 0, run = 0; for (let x = c.x0; x <= c.x1; x++) { if (labels[yy * bw + x] === c.id) { run++; best = Math.max(best, run); } else run = 0; } return best; };
    const colRun = (xx) => { let best = 0, run = 0; for (let y = c.y0; y <= c.y1; y++) { if (labels[y * bw + xx] === c.id) { run++; best = Math.max(best, run); } else run = 0; } return best; };
    const cyl = Math.round((c.y0 + c.y1) / 2), cxl = Math.round((c.x0 + c.x1) / 2);
    let hr = 0, vr = 0;
    for (let d = -1; d <= 1; d++) { hr = Math.max(hr, rowRun(Math.min(c.y1, Math.max(c.y0, cyl + d)))); vr = Math.max(vr, colRun(Math.min(c.x1, Math.max(c.x0, cxl + d)))); }
    const isPlus = elong < 1.8 && hr >= 0.7 * cw && vr >= 0.7 * ch && cw >= 1.6 * sw && ch >= 1.6 * sw;
    const isMinus = elong >= 2.2 && Math.min(cw, ch) <= 2.2 * sw && long <= 1.1 * s.r && long >= 1.2 * sw;
    if (isPlus) { signs.push({ kind: '+', along }); continue; }
    if (isMinus && long < 0.75 * s.r) { signs.push({ kind: '-', along }); continue; }
    if (elong >= 2 && long >= 0.7 * s.r) {
      // an arrow: its width along its length tells where the tip is
      let t0 = Infinity, t1 = -Infinity;
      for (const [x, y] of pts) { const t = (x - mx) * vx + (y - my) * vy; t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
      const n = Math.max(2, Math.round(t1 - t0) + 1);
      const lo = new Float32Array(n).fill(Infinity), hi = new Float32Array(n).fill(-Infinity);
      for (const [x, y] of pts) {
        const k = Math.min(n - 1, Math.round((x - mx) * vx + (y - my) * vy - t0)), q = -(x - mx) * vy + (y - my) * vx;
        if (q < lo[k]) lo[k] = q;
        if (q > hi[k]) hi[k] = q;
      }
      const width = Array.from(lo, (a, k) => (hi[k] >= a ? hi[k] - a + 1 : 0));
      // a wave (an AC source's ~): a thin stroke all along that swings to both sides of its axis
      // (an arrow is a straight shaft, widened at its head)
      const mid = Array.from(lo, (a, k) => (hi[k] >= a ? (a + hi[k]) / 2 : 0));
      const ws = width.filter((v) => v > 0).sort((a, b) => a - b);
      const kLo = mid.indexOf(Math.min(...mid)), kHi = mid.indexOf(Math.max(...mid)), swing = Math.max(0.6 * sw, 0.08 * (t1 - t0));
      if (ws[ws.length >> 1] <= 2.5 * sw && mid[kLo] < -swing && mid[kHi] > swing && Math.abs(kLo - kHi) >= 0.25 * n) { wave = true; continue; }
      const tip = arrowTip(width, sw);
      if (!tip) continue;
      const dirx = tip * vx, diry = tip * vy;
      const dot = dirx * ux + diry * uy;
      arrow = { to: dot > 0 ? 'b' : 'a', along: Math.abs(dot) };
      continue;
    }
    if (elong >= 1.5 && cw > 0.8 * s.r) wave = true;
  }
  plus = signs.find((q) => q.kind === '+');
  minus = signs.find((q) => q.kind === '-');
  const out = { signs: signs.length, wave };
  if (arrow) { out.kind = 'current'; out.arrow = arrow.to; return out; }
  if (plus || minus) {
    out.kind = 'voltage';
    const at = plus ? plus.along : -minus.along;
    out.plus = at < 0 ? 'a' : 'b';
    if (plus && minus && Math.sign(plus.along) === Math.sign(minus.along)) out.unsure = true;
    return out;
  }
  out.kind = wave ? 'ac' : 'voltage';
  out.unsure = true;
  out.plus = 'a';
  return out;
}

/**
 * A straight bar of ink across the free end v of a wire running along wireDir ('h' | 'v'), the
 * wire meeting it away from its ends: { len, cx, cy }, or null.
 */
function barAcross(art, W, H, v, wireDir, sw) {
  // u: along the bar (across the wire), s: along the wire
  const flip = wireDir === 'h';
  const pix = (u, s) => {
    const x = flip ? s : u, y = flip ? u : s;
    return x >= 0 && y >= 0 && x < W && y < H && art[y * W + x] === 1;
  };
  const u0 = Math.round(flip ? v.y : v.x), s0 = Math.round(flip ? v.x : v.y);
  const reach = Math.round(16 * sw);
  // how far the ink runs from (u, s) one way, over gaps of a pixel
  const run = (u, s, du, ds) => {
    let last = 0;
    for (let k = 1; k <= reach; k++) {
      if (pix(u + du * k, s + ds * k)) last = k;
      else if (k - last > 1) break;
    }
    return last;
  };
  let best = null;
  for (let ds = -Math.round(1.5 * sw); ds <= Math.round(1.5 * sw); ds++) {
    const s = s0 + ds;
    if (!pix(u0, s)) continue;
    const lo = run(u0, s, -1, 0), hi = run(u0, s, 1, 0);
    if (!best || lo + hi > best.lo + best.hi) best = { s, lo, hi };
  }
  if (!best) return null;
  const len = best.lo + best.hi + 1;
  if (len < 3.2 * sw || len > 15 * sw || Math.min(best.lo, best.hi) < Math.max(1.2 * sw, 0.2 * len)) return null;
  // thin all along (a blot or a letter is not a plate)
  const mid = u0 + (best.hi - best.lo) / 2;
  for (const f of [-0.3, 0.3]) {
    const u = Math.round(mid + f * len);
    if (!pix(u, best.s)) return null;
    if (run(u, best.s, 0, -1) + run(u, best.s, 0, 1) + 1 > 2.2 * sw) return null;
  }
  return flip ? { len, cx: best.s, cy: mid } : { len, cx: mid, cy: best.s };
}

/**
 * Straight thin pieces of other ink near the figure: loose plates and bars, level or upright
 * within 25° (a bar drawn by hand leans). Measured along their own axis: { dir, cx, cy, len, id }.
 */
function looseBars(img, fig, X0, Y0, sw) {
  const { labels, w } = img;
  const out = [];
  for (const id of fig.near) {
    const c = img.comps[id - 1];
    const cw = c.x1 - c.x0 + 1, ch = c.y1 - c.y0 + 1;
    if (Math.max(cw, ch) < 2.5 * sw || Math.min(cw, ch) > 12 * sw) continue;
    let n = 0, mx = 0, my = 0, sxx = 0, syy = 0, sxy = 0;
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if (labels[y * w + x] === id) { n++; mx += x; my += y; }
    if (!n) continue;
    mx /= n; my /= n;
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if (labels[y * w + x] === id) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
    sxx /= n; syy /= n; sxy /= n;
    const tr = sxx + syy, d = Math.sqrt(Math.max(0, tr * tr / 4 - (sxx * syy - sxy * sxy)));
    // a uniform bar of length L spreads L / √12 along itself
    const len = Math.sqrt(12 * (tr / 2 + d)), thick = Math.sqrt(12 * Math.max(0, tr / 2 - d));
    if (thick > 2.2 * sw || len < 2.5 * sw || len < 2.5 * Math.max(1, thick)) continue;
    // a solid stroke, not a bent one (a letter)
    if (n < 0.6 * len * Math.max(1, thick)) continue;
    const ang = Math.atan2(2 * sxy, sxx - syy) / 2, lean = Math.abs(Math.sin(ang)), dir = lean < 0.42 ? 'h' : lean > 0.906 ? 'v' : null;
    if (!dir) continue;
    out.push({ dir, cx: mx - X0, cy: my - Y0, len, id });
  }
  return out;
}
