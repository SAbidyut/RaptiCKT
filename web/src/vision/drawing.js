// A read structure (vertices, wires, parts in picture pixels) as the grid drawing that
// buildFromDrawing() turns into a board circuit — the same format Claude answers in.

const KIND = {
  resistor: () => 'resistor',
  capacitor: () => 'capacitor',
  inductor: () => 'inductor',
  battery: () => 'voltage_source',
  source: (p) => (p.kind === 'current' ? 'current_source' : p.kind === 'ac' ? 'ac_voltage_source' : 'voltage_source'),
  depsource: (p) => (p.kind === 'current' ? 'dependent_current_source' : 'dependent_voltage_source'),
  unknown: () => 'resistor',
};

/**
 * Grid positions for the structure's vertices. Rows join vertices tied by horizontal wires and
 * parts, columns by vertical ones; the grid keeps the picture's proportions (in units of about
 * one part length, the photo's tilt taken out), and rows or columns close together share a
 * line only when that joins nothing the drawing does not join.
 * Returns { at: vertex id → { x, y } | undefined, rows, cols, unit }.
 */
export function gridOf(S, sw) {
  const n = S.vertices.length;
  const used = new Uint8Array(n);
  for (const wv of S.wires) { used[wv.a] = 1; used[wv.b] = 1; }
  const parts = S.parts.filter((p) => p.a != null && p.b != null && KIND[p.type]);
  for (const p of parts) { used[p.a] = 1; used[p.b] = 1; }
  for (const g of S.grounds) used[g.v] = 1;
  const mk = () => { const pa = Array.from({ length: n }, (_, k) => k); const f = (a) => { while (pa[a] !== a) { pa[a] = pa[pa[a]]; a = pa[a]; } return a; }; return { f, u: (a, b) => { a = f(a); b = f(b); if (a !== b) pa[a] = b; } }; };
  const row = mk(), col = mk();
  for (const wv of S.wires) {
    const A = S.vertices[wv.a], B = S.vertices[wv.b];
    // a speck of wire joins two points into one
    if (Math.hypot(A.x - B.x, A.y - B.y) < 1.5 * sw) { row.u(wv.a, wv.b); col.u(wv.a, wv.b); continue; }
    if (wv.dir === 'h') row.u(wv.a, wv.b); else col.u(wv.a, wv.b);
  }
  for (const p of parts) { if (p.axis === 'h') row.u(p.a, p.b); else col.u(p.a, p.b); }
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
  // the unit: most of a typical part's length, so parts span one or two units
  const lens = parts.map((p) => Math.hypot(S.vertices[p.a].x - S.vertices[p.b].x, S.vertices[p.a].y - S.vertices[p.b].y)).sort((a, b) => a - b);
  const unit = Math.max(4 * sw, (lens.length ? lens[lens.length >> 1] : 20 * sw) * 0.75);
  // the electrical nodes: points joined by wires
  const node = mk();
  for (const wv of S.wires) node.u(wv.a, wv.b);
  // what runs along a row (or a column): its wires and parts
  const runs = (horiz) => {
    const m = new Map();
    const add = (a, b, wire) => { const r = (horiz ? row : col).f(a); if (!m.has(r)) m.set(r, []); m.get(r).push({ a, b, wire }); };
    for (const wv of S.wires) if ((wv.dir === 'h') === horiz) add(wv.a, wv.b, true);
    for (const p of parts) if ((p.axis === 'h') === horiz) add(p.a, p.b, false);
    return m;
  };
  const rowRuns = runs(true), colRuns = runs(false);
  /**
   * Can two rows (or columns) share one line? Not when that would put two different nodes on
   * one point, a point on a wire or part it is not joined to, or a wire or part over another.
   * pos: a point's place along the line; same(u, v): whether two points land on one place.
   */
  const clash = (A, B, own, pos, same) => {
    const segs = (C) => own.get(C.rep) || [];
    for (const [P, Q] of [[A, B], [B, A]]) {
      for (const u of P.members) {
        for (const v of Q.members) if (same(u, v) && node.f(u) !== node.f(v)) return true;
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
  // rows (columns) closer than half a unit share a line when nothing clashes: five branches side
  // by side, each part's ends a little higher or lower, are not ten rows
  const place = (list, ok) => {
    let g = 0, line = [], anchor = 0;
    list.forEach((c, k) => {
      if (k) {
        const step = Math.round((c.at - list[k - 1].at) / unit);
        if (step === 0 && c.at - anchor < 0.5 * unit && line.every((o) => ok(o, c))) { c.g = g; line.push(c); return; }
        g += Math.max(1, step);
      }
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
  return { at, rows, cols, unit };
}

/**
 * The drawing for buildFromDrawing: { title, parts, wires, ground, quantities, asked }, plus
 * notes on what was unsure. `labels` (optional) gives each part's text, value and control.
 */
export function toDrawing(S, sw, { title = 'Circuit from photo', labels = new Map(), quantities = [], asked = [] } = {}) {
  const { at } = gridOf(S, sw);
  const notes = [];
  const pt = (v) => ({ x: at[v].x, y: at[v].y });
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
    parts.push({ kind, text: L.text || '', value: L.value ?? defaultValue(kind), from: pt(p.a), to: pt(p.b), polarity, control: L.control || '' });
  });
  const wires = [];
  for (const wv of S.wires) {
    const A = at[wv.a], B = at[wv.b];
    if (!A || !B || (A.x === B.x && A.y === B.y)) continue;
    wires.push({ from: { ...A }, to: { ...B } });
  }
  const ground = S.grounds.map((g) => at[g.v]).filter(Boolean).map((p) => ({ ...p }));
  const qs = quantities.map((q) => {
    if (q.kind === 'node_voltage') return { name: q.name, kind: q.kind, at: at[q.vertex] ? { ...at[q.vertex] } : { x: 0, y: 0 }, part: -1, positive: 'none' };
    const i = index.get(q.part);
    const d = parts[i];
    return { name: q.name, kind: q.kind, at: d ? { ...d.from } : { x: 0, y: 0 }, part: i ?? -1, positive: q.positive || 'none' };
  }).filter((q) => q.kind === 'node_voltage' || q.part >= 0);
  return { title, parts, wires, ground, quantities: qs, asked, notes, index };
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
