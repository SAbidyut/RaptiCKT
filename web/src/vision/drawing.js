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
    for (const wv of S.wires) if (used[wv.a] && (wv.dir === 'h') === horiz) add(wv.a, wv.b, true);
    for (const p of parts) if ((p.axis === 'h') === horiz) add(p.a, p.b, false);
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
