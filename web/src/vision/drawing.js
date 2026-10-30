// A read structure (vertices, wires, parts in picture pixels) as the grid drawing that
// buildFromDrawing() turns into a board circuit.

const KIND = {
  resistor: () => 'resistor',
  capacitor: () => 'capacitor',
  inductor: () => 'inductor',
  battery: () => 'voltage_source',
  source: (p) => (p.kind === 'current' ? 'current_source' : p.kind === 'ac' ? 'ac_voltage_source' : 'voltage_source'),
  depsource: (p) => (p.kind === 'current' ? 'dependent_current_source' : 'dependent_voltage_source'),
  unknown: () => 'resistor',
  switch: () => 'open_switch',
};

/**
 * Grid positions for the structure's vertices. Rows join vertices tied by horizontal wires and
 * parts, columns by vertical ones. The grid is drawn as a person would draw it: in the picture's
 * order (its tilt taken out), neighbouring rows and columns one unit apart, so that a part spans
 * about one unit and comes out at its own size on the board; a part's leads and the little
 * offsets of a photo vanish, as rows or columns a few parts' lengths apart at most share a line
 * unless that would join what the drawing does not join (or drop an open terminal's stub).
 * Returns { at: vertex id → { x, y } | undefined, rows, cols }.
 */
export function gridOf(S, sw) {
  const n = S.vertices.length;
  const mk = () => { const pa = Array.from({ length: n }, (_, k) => k); const f = (a) => { while (pa[a] !== a) { pa[a] = pa[pa[a]]; a = pa[a]; } return a; }; return { f, u: (a, b) => { a = f(a); b = f(b); if (a !== b) pa[a] = b; } }; };
  const parts = S.parts.filter((p) => p.a != null && p.b != null && KIND[p.type]);
  // the circuit: what wires and parts join to a part (bits of wire joined to no part are crumbs
  // of a blurred symbol or stray lines)
  const net = mk();
  for (const wv of S.wires) net.u(wv.a, wv.b);
  for (const p of parts) net.u(p.a, p.b);
  const live = new Set(parts.map((p) => net.f(p.a)));
  const used = new Uint8Array(n);
  for (const wv of S.wires) if (live.has(net.f(wv.a))) { used[wv.a] = 1; used[wv.b] = 1; }
  for (const p of parts) { used[p.a] = 1; used[p.b] = 1; }
  for (const g of S.grounds) if (live.has(net.f(g.v))) used[g.v] = 1;
  const row = mk(), col = mk();
  for (const wv of S.wires) {
    const A = S.vertices[wv.a], B = S.vertices[wv.b];
    // a speck of wire joins two points into one
    if (Math.hypot(A.x - B.x, A.y - B.y) < 1.5 * sw) { row.u(wv.a, wv.b); col.u(wv.a, wv.b); continue; }
    if (wv.dir === 'h') row.u(wv.a, wv.b); else if (wv.dir !== 'd') col.u(wv.a, wv.b);
  }
  // (what runs slanting ties neither: it is led round on the grid afterwards)
  for (const p of parts) { if (p.axis === 'h') row.u(p.a, p.b); else if (p.axis !== 'd') col.u(p.a, p.b); }
  const classes = (uf, coord) => {
    const m = new Map();
    for (let v = 0; v < n; v++) {
      if (!used[v]) continue;
      const r = uf.f(v);
      if (!m.has(r)) m.set(r, { sum: 0, n: 0, members: [] });
      const c = m.get(r);
      c.sum += coord(S.vertices[v]); c.n++; c.members.push(v);
    }
    const list = [...m.values()].map((c) => ({ ...c, at: c.sum / c.n }));
    list.sort((a, b) => a.at - b.at);
    return list;
  };
  // positions as if the photo were straight
  const t = S.tilt || 0;
  const Y = (v) => v.y - t * v.x, X = (v) => v.x + t * v.y;
  const rows = classes(row, Y), cols = classes(col, X);
  // a typical part's size in the picture (a capacitor's ends are a gap apart; its plates are not)
  const lens = parts.map((p) => Math.max(Math.hypot(S.vertices[p.a].x - S.vertices[p.b].x, S.vertices[p.a].y - S.vertices[p.b].y), p.box ? Math.max(p.box[2] - p.box[0], p.box[3] - p.box[1]) : 0)).sort((a, b) => a - b);
  const span = Math.max(4 * sw, lens.length ? lens[lens.length >> 1] : 20 * sw);
  // the electrical nodes: points joined by wires
  const node = mk();
  for (const wv of S.wires) node.u(wv.a, wv.b);
  // a wire's free end (an open terminal, a wire running off the picture) keeps its stub; a
  // crumb of wire at a part's end is no stub
  const ends = new Uint8Array(n), stub = new Float64Array(n);
  for (const wv of S.wires) { ends[wv.a]++; ends[wv.b]++; stub[wv.a] = stub[wv.b] = Math.hypot(S.vertices[wv.a].x - S.vertices[wv.b].x, S.vertices[wv.a].y - S.vertices[wv.b].y); }
  for (const p of parts) { ends[p.a] += 2; ends[p.b] += 2; }
  for (const g of S.grounds) ends[g.v] += 2;
  const free = (v) => ends[v] === 1 && stub[v] >= 0.5 * span;
  // what runs along a row (or a column): its wires and parts
  const runs = (horiz) => {
    const m = new Map();
    const add = (a, b, wire) => { const r = (horiz ? row : col).f(a); if (!m.has(r)) m.set(r, []); m.get(r).push({ a, b, wire }); };
    for (const wv of S.wires) if (used[wv.a] && wv.dir !== 'd' && (wv.dir === 'h') === horiz) add(wv.a, wv.b, true);
    for (const p of parts) if (p.axis !== 'd' && (p.axis === 'h') === horiz) add(p.a, p.b, false);
    return m;
  };
  const rowRuns = runs(true), colRuns = runs(false);
  /**
   * Can two rows (or columns) share one line? Not when that would put two different nodes on
   * one point (or a free end on any point), a point on a wire or part it is not joined to, or a
   * wire or part over another.
   * pos: a point's place along the line; same(u, v): whether two points land on one place.
   */
  const clash = (A, B, own, pos, same) => {
    const segs = (C) => own.get(C.rep) || [];
    for (const [P, Q] of [[A, B], [B, A]]) {
      for (const u of P.members) {
        for (const v of Q.members) if (same(u, v) && (node.f(u) !== node.f(v) || free(u) || free(v))) return true;
        for (const s of segs(Q)) {
          const lo = Math.min(pos(s.a), pos(s.b)), hi = Math.max(pos(s.a), pos(s.b));
          if (pos(u) > lo && pos(u) < hi && !same(u, s.a) && !same(u, s.b) && !(s.wire && node.f(s.a) === node.f(u))) return true;
        }
      }
    }
    for (const s of segs(A)) {
      for (const q of segs(B)) {
        const lo = Math.max(Math.min(pos(s.a), pos(s.b)), Math.min(pos(q.a), pos(q.b)));
        const hi = Math.min(Math.max(pos(s.a), pos(s.b)), Math.max(pos(q.a), pos(q.b)));
        if (hi > lo && !(s.wire && q.wire && node.f(s.a) === node.f(q.a))) return true;
      }
    }
    return false;
  };
  // one unit to the next line; a row (column) less than three parts past the one before joins
  // its line when nothing clashes (a line spreads over four parts at most): a part's leads, a
  // ground's stub, five branches side by side with each part's ends a little higher or lower,
  // are no lines of their own. A part's two ends always clash, so no part gets shorter than one
  // unit, and two branches side by side always do too
  const place = (list, ok) => {
    let g = 0, line = [], anchor = 0;
    list.forEach((c, k) => {
      if (k && c.at - list[k - 1].at < 3 * span && c.at - anchor < 4 * span && line.every((o) => ok(o, c))) { c.g = g; line.push(c); return; }
      if (k) g++;
      c.g = g; line = [c]; anchor = c.at;
    });
  };
  for (const c of rows) c.rep = row.f(c.members[0]);
  for (const c of cols) c.rep = col.f(c.members[0]);
  // columns first, points told apart by their rows (the rows keep their order, and the rows
  // below check what lands on one point once the columns are set)
  place(cols, (A, B) => !clash(A, B, colRuns, (v) => Y(S.vertices[v]), (u, v) => row.f(u) === row.f(v)));
  const cx = new Map();
  for (const c of cols) for (const v of c.members) cx.set(v, c.g);
  place(rows, (A, B) => !clash(A, B, rowRuns, (v) => cx.get(v), (u, v) => cx.get(u) === cx.get(v)));
  const at = new Array(n);
  const ry = new Map();
  for (const c of rows) for (const v of c.members) ry.set(v, c.g);
  for (let v = 0; v < n; v++) if (used[v]) at[v] = { x: cx.get(v), y: ry.get(v) };
  return { at, rows, cols };
}

/**
 * The drawing for buildFromDrawing: { title, parts, wires, ground, quantities, asked }, plus
 * notes on what was unsure. `labels` (optional) gives each part's text, value and control.
 */
export function toDrawing(S, sw, { title = 'Circuit from photo', labels = new Map(), quantities = [], asked = [] } = {}) {
  const { at } = gridOf(S, sw);
  const notes = [];
  const parts = [];
  const index = new Map(); // structure part → drawing part index
  S.parts.forEach((p, k) => {
    if (p.a == null || p.b == null || !KIND[p.type]) return;
    const kind = KIND[p.type](p);
    const A = at[p.a], B = at[p.b];
    if (!A || !B || (A.x === B.x && A.y === B.y)) { notes.push('A part with both ends on one point was left out.'); return; }
    const L = labels.get(k) || {};
    let polarity = 'none';
    if (/voltage_source/.test(kind)) polarity = p.plus === 'b' ? 'to' : 'from';
    if (/current_source/.test(kind)) polarity = p.arrow === 'b' ? 'to' : 'from';
    if (p.unsure) notes.push(`The + of the source at ${describe(p, S)} could not be seen; + was put at its ${polarity === 'from' ? 'first' : 'second'} end.`);
    if (p.type === 'unknown') notes.push(`A part ${describe(p, S)} could not be recognised and was read as a resistor.`);
    index.set(k, parts.length);
    parts.push({ kind, text: L.text || '', value: L.value ?? defaultValue(kind), from: { ...A }, to: { ...B }, polarity, control: L.control || '', a: p.a, b: p.b, d: p.axis === 'd' });
  });
  let wires = [];
  for (const wv of S.wires) {
    const A = at[wv.a], B = at[wv.b];
    if (!A || !B || (A.x === B.x && A.y === B.y)) continue;
    wires.push({ from: { ...A }, to: { ...B }, a: wv.a, b: wv.b, d: wv.dir === 'd' });
  }
  wires = [...wires, ...squareUp(S, at, parts, wires)];
  for (const x of [...parts, ...wires]) { delete x.a; delete x.b; delete x.d; }
  const ground = S.grounds.map((g) => at[g.v]).filter(Boolean).map((p) => ({ ...p }));
  const qs = quantities.map((q) => {
    if (q.kind === 'node_voltage') {
      // (a name read next to a crumb of wire marks the nearest point of the circuit)
      let v = q.vertex;
      if (!at[v]) {
        const V = S.vertices[v];
        let bd = Infinity;
        at.forEach((p, u) => { if (!p) return; const d = Math.hypot(S.vertices[u].x - V.x, S.vertices[u].y - V.y); if (d < bd) { bd = d; v = u; } });
      }
      return { name: q.name, kind: q.kind, at: at[v] ? { ...at[v] } : { x: 0, y: 0 }, part: -1, positive: 'none' };
    }
    const i = index.get(q.part);
    const d = parts[i];
    return { name: q.name, kind: q.kind, at: d ? { ...d.from } : { x: 0, y: 0 }, part: i ?? -1, positive: q.positive || 'none' };
  }).filter((q) => q.kind === 'node_voltage' || q.part >= 0);
  return { title, parts, wires, ground, quantities: qs, asked, notes, index };
}

/**
 * What runs slanting (the sides of a bridge drawn as a diamond) laid along the grid. On a grid
 * of half steps, each such part or wire is led from a point of the one node it joins to a point
 * of the other (an end, or a point along one of the node's wires) by the shortest way with the
 * fewest turns that lands on nothing else, runs along nothing and crosses no part; it may cross
 * another node's wire straight over (no joint: the board joins wires only at their ends). A part
 * lies on the longest straight stretch of its way that nothing crosses; the rest are its leads.
 * Parts and wires are changed in place; returns the wires added. Afterwards the half steps
 * nothing uses are taken out again.
 */
function squareUp(S, at, parts, wires) {
  // (and what was drawn slanting but came out lying along a part or another node's wire, as two
  // sides of a delta between the same two corners: led round too)
  const lies = new Set();
  const along0 = (e, g) => {
    const [a, b] = [e.from, e.to], [c, d] = [g.from, g.to];
    if (a.x === b.x && c.x === d.x && a.x === c.x) return Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) > Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
    if (a.y === b.y && c.y === d.y && a.y === c.y) return Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) > Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
    return false;
  };
  const isWire = (e) => wires.includes(e);
  const laid = [];
  for (const e of [...parts.filter((x) => !x.d), ...wires.filter((x) => !x.d), ...parts.filter((x) => x.d), ...wires.filter((x) => x.d)]) {
    if (e.from.x !== e.to.x && e.from.y !== e.to.y) continue;
    if (e.d && laid.some((g) => along0(e, g) && !(isWire(e) && isWire(g)))) { lies.add(e); continue; }
    laid.push(e);
  }
  const slanting = (e) => lies.has(e) || (e.from.x !== e.to.x && e.from.y !== e.to.y);
  if (![...parts, ...wires].some(slanting)) return [];
  // the nodes the level and upright wires make (a slanting wire joins two of them once it is led)
  const n = S.vertices.length;
  const pa = Array.from({ length: n }, (_, k) => k);
  const f = (a) => { while (pa[a] !== a) { pa[a] = pa[pa[a]]; a = pa[a]; } return a; };
  for (const w of wires) if (!slanting(w)) pa[f(w.a)] = f(w.b);
  // (points on one place of the grid are joined there)
  const first = new Map();
  for (const e of [...parts, ...wires]) {
    for (const [P, v] of [[e.from, e.a], [e.to, e.b]]) {
      const k = `${P.x},${P.y}`;
      if (first.has(k)) pa[f(v)] = f(first.get(k)); else first.set(k, v);
    }
  }
  // all on the half-step grid
  const all = () => [...parts, ...wires, ...added];
  const added = [];
  for (const e of [...parts, ...wires]) for (const P of [e.from, e.to]) { P.x *= 2; P.y *= 2; }
  const key = (x, y) => `${x},${y}`;
  // segments in place: { A, B, node } (node -1: a part)
  const segs = [];
  for (const p of parts) if (!slanting(p)) segs.push({ A: p.from, B: p.to, node: -1 });
  for (const w of wires) if (!slanting(w)) segs.push({ A: w.from, B: w.to, node: f(w.a) });
  const pts = new Map(); // point → node
  const nodeOfEnd = (e, P) => f(P === e.from ? e.a : e.b);
  for (const e of [...parts, ...wires]) for (const P of [e.from, e.to]) pts.set(key(P.x, P.y), nodeOfEnd(e, P));
  const inside = (x, y, A, B) => (A.x === B.x ? x === A.x && y > Math.min(A.y, B.y) && y < Math.max(A.y, B.y) : y === A.y && x > Math.min(A.x, B.x) && x < Math.max(A.x, B.x));
  const on = (x, y) => segs.filter((t) => inside(x, y, t.A, t.B));
  // a unit step along an existing segment
  const along = (x0, y0, x1, y1) => segs.some((t) => (t.A.x === t.B.x ? x0 === x1 && x0 === t.A.x && Math.min(y0, y1) >= Math.min(t.A.y, t.B.y) && Math.max(y0, y1) <= Math.max(t.A.y, t.B.y) : y0 === y1 && y0 === t.A.y && Math.min(x0, x1) >= Math.min(t.A.x, t.B.x) && Math.max(x0, x1) <= Math.max(t.A.x, t.B.x)));
  const xs = () => all().flatMap((e) => [e.from.x, e.to.x]), ys = () => all().flatMap((e) => [e.from.y, e.to.y]);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // the points of a node to start or end at: its ends, and the points along its wires
  const reach = (node) => {
    const out = new Set();
    for (const [k, v] of pts) if (f(v) === node) out.add(k);
    for (const t of segs) {
      if (t.node < 0 || f(t.node) !== node) continue;
      if (t.A.x === t.B.x) for (let y = Math.min(t.A.y, t.B.y) + 1; y < Math.max(t.A.y, t.B.y); y++) out.add(key(t.A.x, y));
      else for (let x = Math.min(t.A.x, t.B.x) + 1; x < Math.max(t.A.x, t.B.x); x++) out.add(key(x, t.A.y));
    }
    return out;
  };
  const route = (na, nb) => {
    const from = reach(na), to = reach(nb);
    const X = xs(), Y = ys();
    const x0 = Math.min(...X) - 2, x1 = Math.max(...X) + 2, y0 = Math.min(...Y) - 2, y1 = Math.max(...Y) + 2;
    // Dijkstra over (point, heading): a step costs 1, a turn 2 more, crossing a wire 3 more
    const dist = new Map(), prev = new Map(), heap = [];
    const push = (st, d, pr) => { if (d < (dist.get(st) ?? Infinity)) { dist.set(st, d); prev.set(st, pr); heap.push([d, st]); } };
    for (const k of from) for (let h = 0; h < 4; h++) push(`${k},${h}`, 0, null);
    while (heap.length) {
      let bi = 0;
      for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
      const [d, st] = heap.splice(bi, 1)[0];
      if (d > dist.get(st)) continue;
      const [x, y, h] = st.split(',').map(Number);
      const here = key(x, y);
      if (to.has(here) && prev.get(st) != null) {
        const path = [];
        for (let s0 = st; s0 != null; s0 = prev.get(s0)) { const [px, py] = s0.split(',').map(Number); path.unshift({ x: px, y: py }); }
        return path;
      }
      // crossing a wire: straight on only
      const crossing = prev.get(st) != null && !pts.has(here) && on(x, y).length > 0;
      DIRS.forEach(([dx, dy], nh) => {
        if (crossing && nh !== h) return;
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || along(x, y, nx, ny)) return;
        // onto a point: only one of the node it is going to
        if (pts.has(k) && !to.has(k)) return;
        if (from.has(k) && !to.has(k)) return;
        const over = on(nx, ny);
        if (!to.has(k) && over.some((t) => t.node < 0)) return;
        const turn = prev.get(st) != null && nh !== h ? 2 : 0;
        push(`${k},${nh}`, d + 1 + turn + (!to.has(k) && over.length ? 3 : 0), st);
      });
    }
    return null;
  };
  // the corners of a way: its straight stretches
  const stretches = (path) => {
    const out = [];
    let s0 = path[0];
    for (let i = 1; i < path.length; i++) {
      const P = path[i - 1], Q = path[i], R = path[i + 1];
      if (!R || (Q.x - P.x) !== (R.x - Q.x) || (Q.y - P.y) !== (R.y - Q.y)) { out.push({ A: { ...s0 }, B: { ...Q } }); s0 = Q; }
    }
    return out;
  };
  for (const e of [...parts, ...wires]) {
    if (!slanting(e)) continue;
    const isPart = parts.includes(e), na = f(e.a), nb = f(e.b);
    const path = route(na, nb);
    if (!path) continue;
    const legs = stretches(path);
    let own = legs[0];
    if (isPart) {
      // the part: the longest stretch nothing crosses
      const clear = legs.filter((s) => { for (let x = Math.min(s.A.x, s.B.x); x <= Math.max(s.A.x, s.B.x); x++) for (let y = Math.min(s.A.y, s.B.y); y <= Math.max(s.A.y, s.B.y); y++) if (!((x === s.A.x && y === s.A.y) || (x === s.B.x && y === s.B.y)) && on(x, y).length) return false; return true; });
      if (!clear.length) continue;
      own = clear.reduce((a, b) => (Math.abs(b.A.x - b.B.x) + Math.abs(b.A.y - b.B.y) > Math.abs(a.A.x - a.B.x) + Math.abs(a.A.y - a.B.y) ? b : a));
    }
    const k = legs.indexOf(own);
    legs.forEach((s, i) => {
      const node = isPart ? (i < k ? na : i > k ? nb : -1) : na;
      segs.push({ ...s, node });
      for (const P of [s.A, s.B]) if (!pts.has(key(P.x, P.y))) pts.set(key(P.x, P.y), node >= 0 ? node : P === s.A ? na : nb);
      if (s !== own) added.push({ from: s.A, to: s.B });
    });
    e.from = { ...own.A }; e.to = { ...own.B };
    if (!isPart) pa[na] = nb;
  }
  // the rows and columns in use, one unit apart again
  const X = [...new Set([...xs(), ...at.filter(Boolean).map((p) => 2 * p.x)])].sort((a, b) => a - b);
  const Y = [...new Set([...ys(), ...at.filter(Boolean).map((p) => 2 * p.y)])].sort((a, b) => a - b);
  const mx = new Map(X.map((x, i) => [x, i])), my = new Map(Y.map((y, i) => [y, i]));
  for (const e of all()) for (const P of [e.from, e.to]) { P.x = mx.get(P.x); P.y = my.get(P.y); }
  for (const P of at) if (P) { P.x = mx.get(2 * P.x); P.y = my.get(2 * P.y); }
  return added;
}

function defaultValue(kind) {
  if (kind === 'resistor') return 1000;
  if (kind === 'capacitor') return 1e-6;
  if (kind === 'inductor') return 1e-3;
  if (/dependent/.test(kind)) return 1;
  if (/current/.test(kind)) return 1;
  return 10;
}

function describe(p, S) {
  const A = S.vertices[p.a], B = S.vertices[p.b];
  return `(${Math.round((A.x + B.x) / 2)}, ${Math.round((A.y + B.y) / 2)})`;
}
