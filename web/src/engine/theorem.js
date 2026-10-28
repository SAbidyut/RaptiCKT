// Network theorems worked step by step, the way a student writes them: Thevenin, Norton,
// superposition and source transformation, on linear DC circuits (resistors, DC voltage and
// current sources, switches, ideal meters). Each solver returns its steps — the text, the
// circuit to draw for the step and the values found — and the answer, checked against a
// direct solution of the whole circuit.
//
// Network model: elements { id, kind: 'R' | 'V' | 'I', n: [p, q], val, name, src }.
//   R: resistance val between p and q.  V: val volts, + at p.  I: val amps flowing p → q
//   inside the source (it pushes current out at q).  src: index of the part in doc.elements.

import { fmtSI } from './units.js';

const key = (p) => Math.round(p[0]) + ',' + Math.round(p[1]);
const NODE_NAMES = 'cdefghkmnpqrstuvwxyz';

// ------------------------------------------------------------------ formatting
const tidy = (v) => (Math.abs(v) < 1e-13 ? 0 : v);
export const fmt = (v, u = '') => fmtSI(tidy(v), u, 4);
const fR = (v) => fmt(v, 'Ω');
const fV = (v) => fmt(v, 'V');
const fI = (v) => fmt(v, 'A');
const fP = (v) => fmt(v, 'W');
/** a value inside a sum: negative ones in brackets, "(−2 mA)" */
const fS = (v, f) => (tidy(v) < 0 ? `(${f(v)})` : f(v));

const P = (text) => ({ t: 'p', text });
const F = (...lines) => ({ t: 'f', lines: lines.flat() });
const TIP = (text) => ({ t: 'tip', text });
const step = (title, blocks, fig = null, result = []) => ({ title, blocks, fig, result });
const names = (list) => list.map((e) => e.name).join(', ');
const plural = (list, one, many) => (list.length === 1 ? one : many);

// ------------------------------------------------------------------ union-find
class UF {
  constructor() { this.p = new Map(); }
  find(k) {
    if (!this.p.has(k)) { this.p.set(k, k); return k; }
    let r = k;
    while (this.p.get(r) !== r) r = this.p.get(r);
    while (this.p.get(k) !== r) { const n = this.p.get(k); this.p.set(k, r); k = n; }
    return r;
  }
  union(a, b) { a = this.find(a); b = this.find(b); if (a !== b) this.p.set(a, b); }
  /** join keeping the smaller number as the root, so node 0 (ground) stays 0 */
  unionMin(a, b) { a = this.find(a); b = this.find(b); if (a !== b) { if (a < b) this.p.set(b, a); else this.p.set(a, b); } }
}

function onSeg(p, a, b) {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if (Math.abs(cross) > 1e-6) return false;
  const dot = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
  const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  return dot > 1e-6 && dot < len2 - 1e-6;
}

// ------------------------------------------------------------------ circuit → network
const VSRC = new Set(['dcv', 'acv', 'square', 'pulse', 'triangle', 'sawtooth', 'noise', 'sweep']);
const ISRC = new Set(['dci', 'aci']);

/** What a part is in a DC network. */
function classify(e) {
  const t = e.constructor.type, p = e.p || {}, n = e.localPosts().length;
  const dc = !p.wave || p.wave === 'dc';
  const ac = { k: 'bad', why: 'not a DC source' };
  if (t === 'ground') return { k: 'gnd' };
  if (n === 0 || t === 'netlabel') return { k: 'skip' };
  if (t === 'resistor') return { k: 'R', v: p.r };
  if (VSRC.has(t)) return dc ? { k: 'V', v: p.amp, r: p.rint > 0 ? p.rint : 0 } : ac;
  if (ISRC.has(t)) return dc ? { k: 'I', v: p.amp } : ac;
  if (t === 'rail') return dc ? { k: 'rail', v: p.amp } : ac;
  if (t === 'ammeter') return p.rsh > 0 ? { k: 'R', v: p.rsh } : { k: 'short' };
  if (t === 'voltmeter') return p.rin > 0 ? { k: 'R', v: p.rin } : { k: 'open' };
  if (t === 'capacitor' || t === 'ecap') return { k: 'open', note: `${e.name} (capacitor) is an open circuit in DC steady state.` };
  if (t === 'inductor') return { k: 'short', note: `${e.name} (inductor) is a short circuit (a plain wire) in DC steady state.` };
  if (n === 2 && typeof e.isClosed === 'function') return e.isClosed() ? (p.ron > 0 ? { k: 'R', v: p.ron } : { k: 'short' }) : { k: 'open' };
  return { k: 'bad', why: e.constructor.title };
}

/**
 * The DC network of a circuit document. Wires, T-junctions and net labels join points into
 * nodes (node 0 is ground); closed switches, ideal ammeters and inductors join their two ends.
 * Returns { elems, nodeCount, hasGround, nodePos, bad, notes, posts }.
 */
export function extractNetwork(doc) {
  const uf = new UF(), pts = [];
  const live = doc.wires.filter((w) => !w.burnt);
  for (const w of live) w.pts.forEach((p, i) => { uf.find(key(p)); pts.push(p); if (i) uf.union(key(w.pts[i - 1]), key(p)); });
  const posts = doc.elements.map((e) => e.getPosts());
  for (const ps of posts) for (const p of ps) { uf.find(key(p)); pts.push(p); }
  for (const w of live) for (let i = 1; i < w.pts.length; i++) for (const p of pts) if (onSeg(p, w.pts[i - 1], w.pts[i])) uf.union(key(p), key(w.pts[i - 1]));
  const nets = new Map();
  doc.elements.forEach((e, i) => {
    const nm = e.netName ? e.netName() : '';
    if (!nm || !posts[i].length) return;
    const k = key(posts[i][0]);
    if (nets.has(nm)) uf.union(nets.get(nm), k); else nets.set(nm, k);
  });
  const cls = doc.elements.map(classify);
  cls.forEach((c, i) => { if (c.k === 'short') uf.union(key(posts[i][0]), key(posts[i][1])); });
  let gnd = null;
  cls.forEach((c, i) => {
    if (c.k !== 'gnd') return;
    const r = uf.find(key(posts[i][0]));
    if (gnd === null) gnd = r; else uf.union(r, gnd);
  });
  if (gnd !== null) gnd = uf.find(gnd);
  const ids = new Map();
  let count = 1;
  const node = (p) => {
    const r = uf.find(key(p));
    if (r === gnd) return 0;
    if (!ids.has(r)) ids.set(r, count++);
    return ids.get(r);
  };
  const elems = [], bad = [], notes = [];
  let hasGround = gnd !== null;
  cls.forEach((c, i) => {
    const e = doc.elements[i], ps = posts[i];
    if (c.note) notes.push(c.note);
    if (c.k === 'R') elems.push({ kind: 'R', n: [node(ps[0]), node(ps[1])], val: c.v, name: e.name, src: i });
    else if (c.k === 'I') elems.push({ kind: 'I', n: [node(ps[0]), node(ps[1])], val: c.v, name: e.name, src: i });
    else if (c.k === 'rail') { hasGround = true; elems.push({ kind: 'V', n: [node(ps[0]), 0], val: c.v, name: e.name, src: i, rail: true }); }
    else if (c.k === 'V') {
      const p = node(ps[0]), q = node(ps[1]);
      if (!c.r) { elems.push({ kind: 'V', n: [p, q], val: c.v, name: e.name, src: i }); return; }
      const m = count++; // the internal resistance sits between the ideal source and its − terminal
      elems.push({ kind: 'V', n: [p, m], val: c.v, name: e.name, src: i });
      elems.push({ kind: 'R', n: [m, q], val: c.r, name: `r(${e.name})`, src: i, internal: true });
    } else if (c.k === 'bad') bad.push(`${e.name} (${c.why})`);
  });
  elems.forEach((x, i) => { x.id = i; });
  // where to put a node's name on the drawing: its busiest point (a junction if it has one)
  const deg = new Map();
  const bump = (p, d = 1) => deg.set(key(p), (deg.get(key(p)) || 0) + d);
  for (const w of live) w.pts.forEach((p, i) => bump(p, i === 0 || i === w.pts.length - 1 ? 1 : 2));
  for (const ps of posts) for (const p of ps) bump(p, 1.5);
  const nodePos = new Map(), best = new Map();
  for (const p of pts) {
    const n = node(p), d = deg.get(key(p)) || 0;
    if (!best.has(n) || d > best.get(n)) { best.set(n, d); nodePos.set(n, [p[0], p[1]]); }
  }
  return { elems, nodeCount: count, hasGround, nodePos, bad, notes, posts };
}

// ------------------------------------------------------------------ solver
function gauss(A, b) {
  const n = b.length;
  let norm = 0;
  for (const row of A) for (const x of row) norm = Math.max(norm, Math.abs(x));
  const tol = Math.max(norm, 1e-30) * 1e-13;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < tol) return null;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

/**
 * Node voltages (node `ref` at 0 V) and element currents of a network, by modified nodal
 * analysis. A piece of the network not joined to `ref` gets its own 0 V node. Returns null
 * when the circuit has no solution (a loop of voltage sources, a current source with no path).
 * cur(e): current through e from e.n[0] to e.n[1] (for a voltage source: from + to − inside it).
 */
export function solveNet(elems, nodeCount, ref) {
  const used = new Set([ref]);
  for (const e of elems) { used.add(e.n[0]); used.add(e.n[1]); }
  const uf = new UF();
  for (const e of elems) uf.union(e.n[0], e.n[1]);
  const refs = new Set([ref]), seen = new Set([uf.find(ref)]);
  for (const n of [...used].sort((x, y) => x - y)) if (!seen.has(uf.find(n))) { seen.add(uf.find(n)); refs.add(n); }
  const idx = new Map();
  for (const n of used) if (!refs.has(n)) idx.set(n, idx.size);
  const m = idx.size, vs = elems.filter((e) => e.kind === 'V'), N = m + vs.length;
  const A = Array.from({ length: N }, () => new Float64Array(N)), b = new Float64Array(N);
  const I = (n) => (idx.has(n) ? idx.get(n) : -1);
  const add = (r, c, v) => { if (r >= 0 && c >= 0) A[r][c] += v; };
  for (const e of elems) {
    const p = I(e.n[0]), q = I(e.n[1]);
    if (e.kind === 'R') { const g = 1 / e.val; add(p, p, g); add(q, q, g); add(p, q, -g); add(q, p, -g); }
    else if (e.kind === 'I') { if (p >= 0) b[p] -= e.val; if (q >= 0) b[q] += e.val; }
  }
  vs.forEach((e, k) => {
    const r = m + k, p = I(e.n[0]), q = I(e.n[1]);
    add(p, r, 1); add(q, r, -1); add(r, p, 1); add(r, q, -1);
    b[r] = e.val;
  });
  const x = N ? gauss(A, b) : new Float64Array(0);
  if (!x) return null;
  const v = new Float64Array(nodeCount + 1);
  for (const [n, k] of idx) v[n] = x[k];
  const iv = new Map(vs.map((e, k) => [e, x[m + k]]));
  return { v, cur: (e) => (e.kind === 'R' ? (v[e.n[0]] - v[e.n[1]]) / e.val : e.kind === 'I' ? e.val : iv.get(e)) };
}

// ------------------------------------------------------------------ series-parallel
const leaves = (t) => (t.k === 'L' ? [t.e] : t.kids.flatMap(leaves));
export const flipTree = (t) => (t.k === 'L' ? { ...t, rev: !t.rev } : t.k === 'S' ? { k: 'S', kids: t.kids.map(flipTree).reverse() } : { k: 'P', kids: t.kids.map(flipTree) });

/**
 * Series-parallel decomposition of the two-terminal network `elems` between nodes s and t.
 * tree: { k: 'L', e, rev } (rev: e runs from n[1] to n[0]), { k: 'S', kids } in order from s
 * to t, or { k: 'P', kids }, every kid oriented from s's side to t's side.
 * Returns { tree, open, dropped }: tree is null when s and t are not joined (open) or the
 * network is not series-parallel (a bridge). dropped: [{ e, why: 'open' | 'short' }], parts
 * that carry no current (a free end, or both ends on one node).
 */
export function spTree(elems, s, t) {
  let items = elems.map((e) => ({ u: e.n[0], v: e.n[1], tr: { k: 'L', e, rev: false } }));
  const dropped = [];
  const drop = (it, why) => { it.dead = true; for (const e of leaves(it.tr)) dropped.push({ e, why }); };
  for (let guard = 0; guard < 10000; guard++) {
    let changed = false;
    for (const it of items) if (it.u === it.v) { drop(it, 'short'); changed = true; }
    items = items.filter((it) => !it.dead);
    const inc = new Map();
    for (const it of items) for (const x of [it.u, it.v]) { if (!inc.has(x)) inc.set(x, []); inc.get(x).push(it); }
    for (const [x, list] of inc) if (list.length === 1 && x !== s && x !== t && !list[0].dead) { drop(list[0], 'open'); changed = true; }
    items = items.filter((it) => !it.dead);
    if (changed) continue;
    const pairs = new Map();
    for (const it of items) {
      const k = Math.min(it.u, it.v) + '|' + Math.max(it.u, it.v);
      if (!pairs.has(k)) pairs.set(k, []);
      pairs.get(k).push(it);
    }
    for (const g of pairs.values()) {
      if (g.length < 2) continue;
      const f = g[0], kids = [];
      for (const it of g) {
        const tr = it.u === f.u ? it.tr : flipTree(it.tr);
        if (tr.k === 'P') kids.push(...tr.kids); else kids.push(tr);
        it.dead = true;
      }
      items.push({ u: f.u, v: f.v, tr: { k: 'P', kids } });
      changed = true;
    }
    items = items.filter((it) => !it.dead);
    if (changed) continue;
    for (const [x, list] of inc) {
      if (list.length !== 2 || x === s || x === t) continue;
      const [i1, i2] = list;
      const t1 = i1.v === x ? i1.tr : flipTree(i1.tr), from = i1.v === x ? i1.u : i1.v;
      const t2 = i2.u === x ? i2.tr : flipTree(i2.tr), to = i2.u === x ? i2.v : i2.u;
      i1.dead = i2.dead = true;
      items.push({ u: from, v: to, tr: { k: 'S', kids: [...(t1.k === 'S' ? t1.kids : [t1]), ...(t2.k === 'S' ? t2.kids : [t2])] } });
      changed = true;
      break;
    }
    items = items.filter((it) => !it.dead);
    if (!changed) break;
  }
  if (!items.length) return { tree: null, open: true, dropped };
  const [it] = items;
  if (items.length === 1 && ((it.u === s && it.v === t) || (it.u === t && it.v === s))) return { tree: it.u === s ? it.tr : flipTree(it.tr), open: false, dropped };
  return { tree: null, open: false, dropped };
}

/** Equivalent resistance of a tree of resistors, writing one line per combination. Sets t.val and t.label. */
function reduce(t, lines) {
  if (t.k === 'L') { t.val = t.e.val; t.label = t.e.name; return t.val; }
  const vals = t.kids.map((k) => reduce(k, lines)), labs = t.kids.map((k) => k.label);
  if (t.k === 'S') {
    t.val = vals.reduce((s, x) => s + x, 0);
    lines.push(`${labs.join(' + ')} = ${vals.map(fR).join(' + ')} = ${fR(t.val)}`);
    t.label = wrap(labs.join(' + '), t.val);
  } else {
    t.val = vals.some((x) => x === 0) ? 0 : 1 / vals.reduce((s, x) => s + 1 / x, 0);
    lines.push(vals.length === 2
      ? `${labs[0]} ∥ ${labs[1]} = (${fR(vals[0])} × ${fR(vals[1])}) / (${fR(vals[0])} + ${fR(vals[1])}) = ${fR(t.val)}`
      : `${labs.join(' ∥ ')} = 1 / (${vals.map((x) => '1/' + fR(x)).join(' + ')}) = ${fR(t.val)}`);
    t.label = wrap(labs.join(' ∥ '), t.val);
  }
  return t.val;
}
const wrap = (s, v) => (s.length <= 22 ? `(${s})` : fR(v));

/** Tree nodes from the root down to the leaf holding element e (or null). */
function pathTo(t, e) {
  if (t.k === 'L') return t.e === e ? [t] : null;
  for (const k of t.kids) { const p = pathTo(k, e); if (p) return [t, ...p]; }
  return null;
}

// ------------------------------------------------------------------ nodal analysis, written out
/**
 * The node-voltage method as a student writes it: nodes fixed by voltage sources, then KCL
 * at each other node (a supernode around a voltage source between two unknown nodes), and
 * the voltages that solve them. `sol` must be solved with `ref` at 0 V.
 */
function nodalLines(elems, sol, ref, nm, max = 5) {
  const V = (n) => 'V' + nm(n);
  const used = new Set([ref]);
  for (const e of elems) { used.add(e.n[0]); used.add(e.n[1]); }
  const known = new Map([[ref, 0]]), lines = [];
  for (let grew = true; grew;) {
    grew = false;
    for (const e of elems) {
      if (e.kind !== 'V') continue;
      const [p, q] = e.n, kp = known.has(p), kq = known.has(q);
      if (kp === kq) continue;
      // V(+) − V(−) = E
      const to = kp ? q : p, val = kp ? known.get(p) - e.val : known.get(q) + e.val;
      known.set(to, val);
      lines.push(`${V(to)} = ${fV(val)}   (fixed by ${e.name} = ${fV(e.val)}, + at ${nm(p)})`);
      grew = true;
    }
  }
  const unknown = [...used].filter((n) => !known.has(n)).sort((x, y) => x - y);
  if (!unknown.length) return lines;
  if (unknown.length > max) return [...lines, `(${unknown.length} node equations, solved together)`, ...unknown.map((n) => `${V(n)} = ${fV(sol.v[n])}`)];
  const g = new UF();
  for (const n of unknown) g.find(n);
  for (const e of elems) if (e.kind === 'V' && !known.has(e.n[0]) && !known.has(e.n[1])) g.union(e.n[0], e.n[1]);
  const groups = new Map();
  for (const n of unknown) { const r = g.find(n); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(n); }
  const rTerm = (x, y, R) => {
    if (!known.has(y)) return `(${V(x)} − ${V(y)})/${fR(R)}`;
    const k = tidy(known.get(y));
    return k === 0 ? `${V(x)}/${fR(R)}` : `(${V(x)} ${k > 0 ? '−' : '+'} ${fV(Math.abs(k))})/${fR(R)}`;
  };
  for (const G of groups.values()) {
    const inG = new Set(G), terms = [];
    let inj = 0;
    for (const e of elems) {
      const i0 = inG.has(e.n[0]), i1 = inG.has(e.n[1]);
      if (i0 === i1) continue;
      const x = i0 ? e.n[0] : e.n[1], y = i0 ? e.n[1] : e.n[0];
      if (e.kind === 'R') terms.push(rTerm(x, y, e.val));
      else if (e.kind === 'I') inj += i0 ? -e.val : e.val; // current the source pushes into this node
    }
    lines.push(G.length === 1 ? `KCL at ${nm(G[0])}:  ${terms.join(' + ') || '0'} = ${fI(inj)}` : `Supernode {${G.map(nm).join(', ')}}:  ${terms.join(' + ') || '0'} = ${fI(inj)}`);
    for (const e of elems) if (e.kind === 'V' && inG.has(e.n[0]) && inG.has(e.n[1])) lines.push(`   and ${V(e.n[0])} − ${V(e.n[1])} = ${fV(e.val)}   (${e.name})`);
  }
  lines.push('Solving: ' + unknown.map((n) => `${V(n)} = ${fV(sol.v[n])}`).join(',  '));
  return lines;
}

// ------------------------------------------------------------------ setup
/** What the theorems can work on in this document: the network, the possible loads and the sources. */
export function prepareTheorem(doc) {
  const net = extractNetwork(doc);
  const targets = net.elems.filter((e) => e.kind === 'R' && !e.internal && doc.elements[e.src].constructor.type === 'resistor');
  const sources = net.elems.filter((e) => e.kind !== 'R');
  return { net, targets, sources, bad: net.bad, notes: net.notes };
}

function context(net, src, want) {
  const T0 = net.elems.find((e) => e.src === src && e.kind === 'R' && !e.internal);
  if (!T0) return { error: 'Pick a resistor.' };
  if (T0.n[0] === T0.n[1]) return { error: `${T0.name} is shorted: both its ends are on the same node, so no current flows in it.` };
  // only what is joined to the load matters
  const reach = new Set([T0.n[0]]);
  for (let grew = true; grew;) {
    grew = false;
    for (const e of net.elems) if (reach.has(e.n[0]) !== reach.has(e.n[1])) { reach.add(e.n[0]); reach.add(e.n[1]); grew = true; }
  }
  const elems = net.elems.filter((e) => reach.has(e.n[0]));
  const apart = net.elems.filter((e) => !reach.has(e.n[0]));
  const full = solveNet(elems, net.nodeCount, T0.n[1]);
  if (!full) return { error: 'This circuit has no single solution: look for voltage sources joined in a loop (or in parallel), or a current source whose current has no path.' };
  // a is the end at the higher potential, so the load current flows from a to b
  const up = full.v[T0.n[0]] - full.v[T0.n[1]] >= -1e-12;
  const a = up ? T0.n[0] : T0.n[1], b = up ? T0.n[1] : T0.n[0];
  const ref = net.hasGround && reach.has(0) ? 0 : b;
  const nm = new Map([[a, 'a'], [b, 'b']]);
  if (reach.has(0) && net.hasGround && !nm.has(0)) nm.set(0, 'gnd');
  let k = 0;
  for (const n of [...reach].sort((x, y) => x - y)) if (!nm.has(n)) nm.set(n, k < NODE_NAMES.length ? NODE_NAMES[k++] : 'n' + n);
  const vab = full.v[a] - full.v[b];
  return {
    net, elems, apart, T: T0, a, b, ref, RL: T0.val, want, nodeCount: net.nodeCount,
    nm: (n) => nm.get(n) ?? 'n' + n,
    full: { I: vab / T0.val, V: vab },
  };
}

/** Turn sources off (all but `keep`): a voltage source becomes a short, its two nodes merge; a current source becomes an open. */
function killed(c, elems, keep = null) {
  const uf = new UF();
  const shorted = [], opened = [];
  for (const e of elems) {
    if (e === keep || e.kind === 'R') continue;
    if (e.kind === 'V') { uf.unionMin(e.n[0], e.n[1]); shorted.push(e); } else opened.push(e);
  }
  const m = (n) => uf.find(n);
  const out = elems.filter((e) => e === keep || e.kind === 'R').map((e) => ({ ...e, n: [m(e.n[0]), m(e.n[1])], orig: e }));
  return { elems: out, m, shorted, opened };
}

function offLine(k) {
  const parts = [];
  if (k.shorted.length) parts.push(`${names(k.shorted)} → short circuit (wire)`);
  if (k.opened.length) parts.push(`${names(k.opened)} → open circuit (removed)`);
  return parts.length ? [F('Turned off:  ' + parts.join(';  '))] : [];
}

function droppedText(dropped) {
  const open = dropped.filter((d) => d.why === 'open').map((d) => d.e), short = dropped.filter((d) => d.why === 'short').map((d) => d.e);
  const out = [];
  if (open.length) out.push(P(`${names(open)} ${plural(open, 'has', 'have')} a free end here, so no current flows in ${plural(open, 'it', 'them')}: ${plural(open, 'it drops', 'they drop')} out.`));
  if (short.length) out.push(P(`${names(short)} ${plural(short, 'is', 'are')} shorted out (both ends on the same node), so ${plural(short, 'it drops', 'they drop')} out.`));
  return out;
}

const signNote = (x, what) => (tidy(x) < 0 ? ` (negative: the ${what} actually flows the other way)` : '');

// ------------------------------------------------------------------ figures
// board: the user's own drawing, changed — hide parts, turn sources off, short a–b, tag nodes
// ladder: a network redrawn as a ladder with the load on the right
const boardFig = (c, o = {}) => ({ kind: 'board', target: c.T.src, a: c.a, b: c.b, ...o });
const killSpec = (k) => ({ wire: k.shorted.filter((e) => !e.rail).map((e) => e.src), ground: k.shorted.filter((e) => e.rail).map((e) => e.src), open: k.opened.map((e) => e.src) });
const tagNodes = (c, elems, nm = c.nm) => {
  const ns = new Set();
  for (const e of elems) { ns.add(e.n[0]); ns.add(e.n[1]); }
  return [...ns].filter((n) => c.net.nodePos.has(n) && n !== c.a && n !== c.b && nm(n) !== 'gnd').map((n) => ({ node: n, text: nm(n) }));
};

// ------------------------------------------------------------------ steps shared by the theorems
function givenStep(c, extra = []) {
  const { T } = c;
  const blocks = [
    P(`We want the ${c.want === 'V' ? 'voltage across' : 'current through'} **${T.name}** (${fR(T.val)}). Call it the load **R_L** and name its ends **a** and **b**: the load current I_L flows from a to b, and V_L = V_a − V_b.`),
  ];
  if (c.net.notes.length) blocks.push(P(c.net.notes.join(' ')));
  if (c.apart.length) blocks.push(P(`${names(c.apart)} ${plural(c.apart, 'is', 'are')} not connected to ${T.name}'s circuit, so ${plural(c.apart, 'it does', 'they do')} not affect it.`));
  return step('The given circuit', [...blocks, ...extra], boardFig(c, { highlight: [T.src], ab: true }));
}

/**
 * A bridge of resistors made series-parallel by one delta → star swap (or star → delta).
 * Returns { val, blocks } with the swap and the combinations written out, or null.
 */
function starDelta(rs, A, B, c, sym) {
  const O = c.nodeCount + 200; // the centre of a new star
  const nm = (n) => (n === O ? 'o' : c.nm(n));
  const live = rs.filter((e) => e.n[0] !== e.n[1]);
  const pair = (x, y) => Math.min(x, y) + '|' + Math.max(x, y);
  const pairs = new Map();
  for (const e of live) { const k = pair(...e.n); if (!pairs.has(k)) pairs.set(k, []); pairs.get(k).push(e); }
  const one = (x, y) => { const g = pairs.get(pair(x, y)); return g && g.length === 1 ? g[0] : null; };
  const nodes = [...new Set(live.flatMap((e) => e.n))].sort((x, y) => x - y);
  const finish = (els, intro, swap) => {
    const sp = spTree(els, A, B);
    if (!sp.tree) return null;
    const lines = [];
    const val = reduce(sp.tree, lines);
    return { val, blocks: [P(intro), F(swap), ...droppedText(sp.dropped), P('Now everything is in series or in parallel:'), F(lines, `${sym} = ${fR(val)}`)] };
  };
  // delta → star: three resistors in a triangle
  for (const x of nodes) for (const y of nodes) for (const z of nodes) {
    if (!(x < y && y < z)) continue;
    const exy = one(x, y), eyz = one(y, z), exz = one(x, z);
    if (!exy || !eyz || !exz) continue;
    const S = exy.val + eyz.val + exz.val;
    const arm = (n, r1, r2) => ({ kind: 'R', n: [n, O], val: (r1.val * r2.val) / S, name: `R${nm(n)}`, r1, r2 });
    const star = [arm(x, exy, exz), arm(y, exy, eyz), arm(z, exz, eyz)];
    const r = finish([...live.filter((e) => e !== exy && e !== eyz && e !== exz), ...star],
      `These resistors form a **bridge**, so they are not simply in series or in parallel. ${exy.name}, ${eyz.name} and ${exz.name} make a **delta (Δ)** — a triangle between ${nm(x)}, ${nm(y)} and ${nm(z)}. Turn it into an equivalent **star (Y)** with its centre at a new point o: each arm = the two delta resistors meeting at that corner, multiplied, ÷ the sum of all three.`,
      [`ΣR = ${exy.name} + ${eyz.name} + ${exz.name} = ${fR(exy.val)} + ${fR(eyz.val)} + ${fR(exz.val)} = ${fR(S)}`,
        ...star.flatMap((t) => [`${t.name} (${nm(t.n[0])}–o) = ${t.r1.name} × ${t.r2.name} / ΣR`, `   = ${fR(t.r1.val)} × ${fR(t.r2.val)} / ${fR(S)} = ${fR(t.val)}`])]);
    if (r) return r;
  }
  // star → delta: a point (not a or b) where exactly three resistors meet
  for (const o of nodes) {
    if (o === A || o === B) continue;
    const at = live.filter((e) => e.n.includes(o));
    if (at.length !== 3) continue;
    const ends = at.map((e) => (e.n[0] === o ? e.n[1] : e.n[0]));
    if (new Set(ends).size !== 3) continue;
    const sum = at[0].val * at[1].val + at[1].val * at[2].val + at[2].val * at[0].val;
    const delta = [[0, 1, 2], [1, 2, 0], [0, 2, 1]].map(([i, j, opp]) => ({ kind: 'R', n: [ends[i], ends[j]], val: sum / at[opp].val, name: `R${nm(ends[i])}${nm(ends[j])}`, opp: at[opp] }));
    const r = finish([...live.filter((e) => !at.includes(e)), ...delta],
      `These resistors form a **bridge**, so they are not simply in series or in parallel. ${names(at)} make a **star (Y)** at ${nm(o)}. Turn it into an equivalent **delta (Δ)** between ${ends.map(nm).join(', ')}: each delta resistor = (sum of the products of the star arms taken two at a time) ÷ the arm opposite it.`,
      [`ΣRR = ${at[0].name}·${at[1].name} + ${at[1].name}·${at[2].name} + ${at[2].name}·${at[0].name} = ${fmt(sum, 'Ω²')}`,
        ...delta.flatMap((d) => [`${d.name} = ΣRR / ${d.opp.name}`, `   = ${fmt(sum, 'Ω²')} / ${fR(d.opp.val)} = ${fR(d.val)}`])]);
    if (r) return r;
  }
  return null;
}

/** R_th (= R_N): sources off, load out, resistance seen from a–b. */
function resistanceStep(c, title, sym) {
  const others = c.elems.filter((e) => e !== c.T);
  const k = killed(c, others);
  const A = k.m(c.a), B = k.m(c.b);
  const blocks = [
    P(`Take R_L out and turn every independent source **off**: a voltage source becomes a short circuit (a plain wire) and a current source becomes an open circuit. Then find the resistance seen from a and b.`),
    ...offLine(k),
  ];
  let val, sd;
  if (A === B) {
    val = 0;
    blocks.push(P(`a and b are now joined by a wire (through ${names(k.shorted)}), so ${sym} = 0.`));
  } else {
    const sp = spTree(k.elems, A, B);
    blocks.push(...droppedText(sp.dropped));
    if (sp.tree) {
      const lines = [];
      val = reduce(sp.tree, lines);
      if (sp.tree.k === 'L') blocks.push(F(`${sym} = ${sp.tree.e.name} = ${fR(val)}`));
      else blocks.push(P('Combine the resistors in series and parallel, starting from the far end:'), F(lines, `${sym} = ${fR(val)}`));
    } else if (sp.open) {
      val = Infinity;
      blocks.push(P(`With the sources off nothing joins a to b, so ${sym} is infinite (an open circuit).`));
    } else if ((sd = starDelta(k.elems, A, B, c, sym))) {
      val = sd.val;
      blocks.push(...sd.blocks);
    } else {
      // a bridge no single star–delta swap opens: a 1 A test current into a, R = V_ab / 1 A
      const test = { kind: 'I', n: [B, A], val: 1, name: 'Itest' };
      const s = solveNet([...k.elems, test], c.nodeCount + 1, B);
      val = s ? s.v[A] - s.v[B] : NaN;
      blocks.push(
        P('These resistors are not simply in series or in parallel (they form a bridge). Push a 1 A test current into a and out of b, and find the voltage it makes:'),
        F(`Va − Vb = ${fV(val)}   (with 1 A flowing in)`, `${sym} = (Va − Vb) / 1 A = ${fR(val)}`),
      );
    }
  }
  return { val, step: step(title, blocks, boardFig(c, { hide: [c.T.src], ab: true, show: sym, ...killSpec(k) }), [[sym, fR(val)]]) };
}

function answerBlocks(c, I, V) {
  const out = [];
  const P_L = I * I * c.RL;
  const main = c.want === 'V' ? `V_L = ${fV(V)}` : `I_L = ${fI(I)}`;
  out.push(P(`**Answer: ${main}** ${c.want === 'V' ? `(and I_L = ${fI(I)})` : `(and V_L = ${fV(V)})`}, power in ${c.T.name}: P_L = ${fP(P_L)}.`));
  const ok = Math.abs(I - c.full.I) <= 1e-6 * Math.max(Math.abs(c.full.I), 1e-9) + 1e-12;
  out.push(TIP(ok
    ? `Check: solving the whole circuit directly gives I_L = ${fI(c.full.I)} and V_L = ${fV(c.full.V)} — the same answer.`
    : `Check: solving the whole circuit directly gives I_L = ${fI(c.full.I)}, V_L = ${fV(c.full.V)}.`));
  return out;
}

const done = (c, theorem, steps, I, V, extra = {}) => ({ ok: true, theorem, target: c.T.name, steps, answer: { I, V, P: I * I * c.RL }, full: c.full, want: c.want, ...extra });

// ------------------------------------------------------------------ Thevenin
function thevenin(c) {
  const { T, a, b, RL } = c;
  const steps = [givenStep(c, [P('Thevenin’s theorem: everything connected to a and b can be replaced by **one voltage source V_th in series with one resistor R_th**. We find R_th and V_th, then put R_L back.')])];
  const r = resistanceStep(c, 'Step 1 — Find R_th', 'Rth');
  steps.push(r.step);
  const Rth = r.val;
  if (!Number.isFinite(Rth)) {
    steps.push(step('No Thevenin equivalent', [P('R_th is infinite: only a current source feeds the load, so a voltage source in series with R_th cannot model it. Use **Norton’s theorem** for this circuit.'), ...answerBlocks(c, c.full.I, c.full.V)]));
    return done(c, 'thevenin', steps, c.full.I, c.full.V);
  }
  const v = vthStep(c, 'Step 2 — Find V_th');
  steps.push(v.step);
  const Vth = v.Vth;
  const I = Vth / (Rth + RL), V = I * RL;
  steps.push(step('Step 3 — Thevenin equivalent circuit', [
    P('Replace everything left of a–b by V_th in series with R_th, and connect R_L back between a and b. Now it is one simple loop:'),
    F(`IL = Vth / (Rth + RL)`, `   = ${fV(Vth)} / (${fR(Rth)} + ${fR(RL)})`, `   = ${fI(I)}`, `VL = IL × RL = ${fI(I)} × ${fR(RL)} = ${fV(V)}`),
    ...answerBlocks(c, I, V),
    ...(Rth > 0 ? [TIP(`Maximum power transfer: R_L would take the most power, P_max = Vth² / (4·Rth) = ${fP((Vth * Vth) / (4 * Rth))}, when R_L = R_th = ${fR(Rth)}.`)] : []),
  ], ladderFig(c, Rth > 0 ? [
    { id: 'Vth', kind: 'V', n: [-1, b], val: Vth, name: 'Vth' },
    { id: 'Rth', kind: 'R', n: [-1, a], val: Rth, name: 'Rth' },
  ] : [{ id: 'Vth', kind: 'V', n: [a, b], val: Vth, name: 'Vth' }]), [['I_L', fI(I)], ['V_L', fV(V)]]));
  return done(c, 'thevenin', steps, I, V, { Rth, Vth });
}

/** V_th: sources on, a–b open, solved by node voltages. */
function vthStep(c, title) {
  const { T, a, b } = c;
  const others = c.elems.filter((e) => e !== T);
  const sol = solveNet(others, c.nodeCount, c.ref);
  const Vth = sol.v[a] - sol.v[b];
  return { Vth, step: step(title, [
    P('Turn the sources back on and leave a–b **open** (R_L still out). V_th is the voltage between a and b now. Solve the node voltages' + refText(c, c.ref)),
    F(nodalLines(others, sol, c.ref, c.nm)),
    F(`Vth = Va − Vb = ${fS(sol.v[a], fV)} − ${fS(sol.v[b], fV)} = ${fV(Vth)}`),
  ], boardFig(c, { hide: [T.src], ab: true, show: 'Vth', tags: tagNodes(c, others) }), [['Vth', fV(Vth)]]) };
}
const refText = (c, ref, nm = c.nm) => (nm(ref) === 'gnd' ? ' (ground = 0 V):' : ` (taking ${nm(ref)} as 0 V):`);

/** The final equivalents and the source-transformation stages, drawn as a ladder with the load on the right. */
function ladderFig(c, elems, hi = [], load = {}) {
  const T = { ...c.T, n: [c.a, c.b], id: 'T', ...load };
  const M = c.nodeCount + 100; // the middle node of a two-part equivalent
  const fixed = elems.map((e) => {
    const x = { ...e, n: e.n.map((n) => (n === -1 ? M : n)) };
    // keep drawn values positive: flip the source instead
    if (x.kind !== 'R' && x.val < 0) { x.val = -x.val; x.n = [x.n[1], x.n[0]]; }
    return x;
  });
  return { kind: 'ladder', elems: [...fixed, T], a: c.a, b: c.b, load: 'T', hi: [...hi, 'T'], style: c.style };
}

// ------------------------------------------------------------------ Norton
function norton(c) {
  const { T, a, b, RL } = c;
  const steps = [givenStep(c, [P('Norton’s theorem: everything connected to a and b can be replaced by **one current source I_N in parallel with one resistor R_N**. We find R_N and I_N, then put R_L back.')])];
  const r = resistanceStep(c, 'Step 1 — Find R_N', 'RN');
  steps.push(r.step);
  const Rn = r.val;
  if (Rn === 0) {
    steps.push(step('No Norton equivalent', [P('R_N = 0: a voltage source sits right across a–b, so the short-circuit current would be infinite. Use **Thevenin’s theorem** for this circuit.'), ...answerBlocks(c, c.full.I, c.full.V)]));
    return done(c, 'norton', steps, c.full.I, c.full.V);
  }
  // short a–b: the two nodes become one
  const others = c.elems.filter((e) => e !== T);
  const rep = Math.min(a, b), mp = (n) => (n === a || n === b ? rep : n);
  const shorted = others.map((e) => ({ ...e, n: [mp(e.n[0]), mp(e.n[1])], orig: e }));
  const ref = mp(c.ref);
  const sol = solveNet(shorted, c.nodeCount, ref);
  const nm2 = (n) => (n === rep ? 'a' : c.nm(n));
  const into = [];
  for (const e of shorted) {
    const o = e.orig;
    const atA = o.n[0] === a || o.n[1] === a;
    if (!atA || (o.n[0] === a && o.n[1] === a)) continue;
    const x = o.n[1] === a ? sol.cur(e) : -sol.cur(e); // current e delivers into a
    into.push([o, x]);
  }
  const In = into.reduce((s, [, x]) => s + x, 0);
  steps.push(step('Step 2 — Find I_N', [
    P('Turn the sources back on and join a and b with a **short circuit** (a wire in place of R_L). I_N is the current flowing through that wire from a to b.'),
    P('With a and b joined they are one node. Solve the node voltages' + (nm2(ref) === 'gnd' ? ' (ground = 0 V):' : ` (taking ${nm2(ref)} = b as 0 V):`)),
    F(nodalLines(shorted, sol, ref, nm2)),
    P('By KCL at a, the current leaving through the short equals the current arriving at a from the rest of the circuit:'),
    F(into.map(([o, x]) => `from ${o.name}:  ${fI(x)}`), `IN = ${into.map(([, x]) => fS(x, fI)).join(' + ') || '0'} = ${fI(In)}`),
  ], boardFig(c, { hide: [T.src], ab: true, shortAB: true, show: 'IN', tags: tagNodes(c, others, nm2) }), [['IN', fI(In)]]));
  const I = Number.isFinite(Rn) ? (In * Rn) / (Rn + RL) : In, V = I * RL;
  steps.push(step('Step 3 — Norton equivalent circuit', [
    P('Replace everything left of a–b by I_N in parallel with R_N, and connect R_L back. I_N splits between R_N and R_L (current divider):'),
    F(Number.isFinite(Rn)
      ? [`IL = IN × RN / (RN + RL)`, `   = ${fI(In)} × ${fR(Rn)} / (${fR(Rn)} + ${fR(RL)})`, `   = ${fI(I)}`]
      : [`RN is infinite, so all of IN flows in RL:  IL = IN = ${fI(I)}`],
    `VL = IL × RL = ${fI(I)} × ${fR(RL)} = ${fV(V)}`),
    ...answerBlocks(c, I, V),
    ...(Number.isFinite(Rn) ? [TIP(`Thevenin and Norton are the same circuit seen two ways: Vth = IN × RN = ${fV(In * Rn)}, and Rth = RN.`)] : []),
  ], ladderFig(c, [
    { id: 'IN', kind: 'I', n: [b, a], val: In, name: 'IN' },
    ...(Number.isFinite(Rn) ? [{ id: 'RN', kind: 'R', n: [a, b], val: Rn, name: 'RN' }] : []),
  ]), [['I_L', fI(I)], ['V_L', fV(V)]]));
  return done(c, 'norton', steps, I, V, { Rn, In });
}

// ------------------------------------------------------------------ superposition
/** The load current and voltage with only source s on, explained by series-parallel steps where possible. */
function contribution(c, s) {
  const k = killed(c, c.elems, s);
  const S = k.elems.find((e) => e.orig === s), L = k.elems.find((e) => e.orig === c.T);
  const A = k.m(c.a), B = k.m(c.b);
  const sol = solveNet(k.elems, c.nodeCount, k.m(c.ref));
  if (!sol) return { error: `With only ${s.name} on the circuit cannot be solved (${s.kind === 'V' ? 'it is shorted by another voltage source' : 'its current has no path'}).` };
  const I = A === B ? 0 : (sol.v[A] - sol.v[B]) / c.RL;
  const blocks = [P(`Keep only **${s.name}** on and turn the other sources off.`), ...offLine(k)];
  const start = S.kind === 'V' ? S.n[0] : S.n[1], end = S.kind === 'V' ? S.n[1] : S.n[0];
  const rest = k.elems.filter((e) => e !== S);
  const sp = start === end ? null : spTree(rest, start, end);
  if (A === B) blocks.push(P(`a and b are joined by a short here, so no current flows in R_L.`));
  else if (start === end) blocks.push(P(`${s.name}'s two ends are joined by a short, so all its current flows there and none reaches R_L.`));
  else if (sp && sp.tree) {
    blocks.push(...droppedText(sp.dropped.filter((d) => d.e !== L)));
    const lines = [];
    const Req = reduce(sp.tree, lines);
    const path = pathTo(sp.tree, L);
    blocks.push(P(`Resistance seen by ${s.name}:`), F(lines.length ? lines : [`${sp.tree.label}`], `Req = ${fR(Req)}`));
    let Ix, Vx;
    const out = [];
    if (S.kind === 'V') { Ix = S.val / Req; Vx = S.val; out.push(`I(${s.name}) = ${s.name} / Req = ${fV(S.val)} / ${fR(Req)} = ${fI(Ix)}`); }
    else { Ix = S.val; Vx = S.val * Req; out.push(`V across ${s.name} = ${s.name} × Req = ${fI(S.val)} × ${fR(Req)} = ${fV(Vx)}`); }
    if (path) {
      for (let i = 0; i + 1 < path.length; i++) {
        const X = path[i], Y = path[i + 1];
        if (X.k === 'S') {
          Vx = Ix * Y.val;
          out.push(`${Y.k === 'L' ? 'VL' : `V across ${Y.label}`} = ${fI(Ix)} × ${fR(Y.val)} = ${fV(Vx)}`);
        } else {
          Ix = Y.val ? Vx / Y.val : 0;
          out.push(`${Y.k === 'L' ? 'IL' : `I in ${Y.label}`} = ${fV(Vx)} / ${fR(Y.val)} = ${fI(Ix)}`);
        }
      }
      if (path[path.length - 1].k === 'L' && path.length > 1 && path[path.length - 2].k === 'S') out.push(`IL = ${fI(Ix)} (the same current flows through it)`);
      blocks.push(P('Follow the current from the source to R_L: in series the current is the same and the voltage divides; in parallel the voltage is the same and the current divides.'), F(out));
    } else blocks.push(F(out), P('No current from this source reaches R_L.'));
  } else {
    blocks.push(P('Solve this circuit by node voltages:'), F(nodalLines(k.elems, sol, k.m(c.ref), (n) => (n === A ? 'a' : n === B ? 'b' : c.nm(n)))));
  }
  blocks.push(F(`IL(${s.name}) = ${fI(I)}   (a → b)${signNote(I, 'current')}`, `VL(${s.name}) = ${fV(I * c.RL)}`));
  return { I, V: I * c.RL, blocks, kill: killSpec(k) };
}

function superposition(c) {
  const { T } = c;
  const srcs = c.elems.filter((e) => e.kind !== 'R');
  const steps = [givenStep(c, [P(srcs.length
    ? `Superposition: in a linear circuit the response to several sources is the **sum of the responses to each source acting alone**. This circuit has ${srcs.length} independent source${srcs.length > 1 ? 's' : ''}: ${names(srcs)}. Take one at a time — the others turned off (voltage source → short, current source → open) — then add.`
    : 'This circuit has no source, so every current and voltage is zero.')])];
  const parts = [];
  for (const s of srcs) {
    const r = contribution(c, s);
    if (r.error) return { ok: false, error: r.error };
    parts.push([s, r]);
    steps.push(step(`Step ${parts.length} — Only ${s.name} on`, r.blocks, boardFig(c, { highlight: [T.src], ab: true, ...r.kill, keep: s.src }), [[`I_L(${s.name})`, fI(r.I)]]));
  }
  const I = parts.reduce((x, [, r]) => x + r.I, 0), V = I * c.RL;
  const sumP = parts.reduce((x, [, r]) => x + r.I * r.I * c.RL, 0);
  steps.push(step(`Step ${parts.length + 1} — Add the effects`, [
    P('With every source back on, the load current is the sum of the parts (each one taken from a to b, so a negative part subtracts):'),
    F(`IL = ${parts.map(([s]) => `IL(${s.name})`).join(' + ') || '0'}`, `   = ${parts.map(([, r]) => fS(r.I, fI)).join(' + ') || '0'}`, `   = ${fI(I)}`,
      `VL = ${parts.map(([, r]) => fS(r.V, fV)).join(' + ') || '0'} = ${fV(V)}`),
    ...answerBlocks(c, I, V),
    ...(parts.length > 1 ? [TIP(`Power does not add up: P_L = I_L² × R_L = ${fP(I * I * c.RL)}, but the powers of the parts would sum to ${fP(sumP)}. Superposition works for currents and voltages only.`)] : []),
  ], boardFig(c, { highlight: [T.src], ab: true, arrow: true }), [['I_L', fI(I)], ['V_L', fV(V)]]));
  return done(c, 'superposition', steps, I, V);
}

// ------------------------------------------------------------------ maximum power transfer
const pct = (x) => `${(x * 100).toFixed(x > 0.995 ? 1 : 0)} %`;

function maxPower(c) {
  const { a, b, RL } = c;
  const steps = [givenStep(c, [P('Maximum power transfer theorem: a load takes the **most power** from a circuit when its resistance equals the circuit’s Thevenin resistance seen from the load’s ends, **R_L = R_th**. Then P_max = V_th² / (4·R_th). So we find R_th and V_th first.')])];
  const r = resistanceStep(c, 'Step 1 — Find R_th', 'Rth');
  steps.push(r.step);
  const Rth = r.val;
  if (!(Rth > 0) || !Number.isFinite(Rth)) {
    steps.push(step('No best load', [P(Rth === 0
      ? 'R_th = 0: a voltage source sits right across the load, so the smaller R_L, the more power it takes — there is no best value.'
      : 'R_th is infinite: a current source alone feeds the load, so the larger R_L, the more power it takes — there is no best value.'), ...answerBlocks(c, c.full.I, c.full.V)]));
    return done(c, 'maxpower', steps, c.full.I, c.full.V);
  }
  const v = vthStep(c, 'Step 2 — Find V_th');
  steps.push(v.step);
  const Vth = v.Vth, Pmax = (Vth * Vth) / (4 * Rth);
  steps.push(step('Step 3 — The load that takes the most power', [
    P('Draw the Thevenin equivalent and make R_L equal to R_th. Then half of V_th drops across R_th and half across R_L:'),
    F(`RL = Rth = ${fR(Rth)}`, `IL = Vth / (2·Rth)`, `   = ${fV(Vth)} / ${fR(2 * Rth)} = ${fI(Vth / (2 * Rth))}`, `VL = Vth / 2 = ${fV(Vth / 2)}`, `Pmax = Vth² / (4·Rth)`, `     = (${fV(Vth)})² / (4 × ${fR(Rth)})`, `     = ${fP(Pmax)}`),
    TIP('At maximum power the efficiency is only 50 %: R_th takes as much power as the load. Power systems run far from this point; matching is used in electronics (amplifier → speaker, antenna → receiver), where getting the most signal power matters.'),
  ], ladderFig(c, [{ id: 'Vth', kind: 'V', n: [-1, b], val: Vth, name: 'Vth' }, { id: 'Rth', kind: 'R', n: [-1, a], val: Rth, name: 'Rth' }], [], { val: Rth, name: 'RL' }), [['R_L', fR(Rth)], ['P_max', fP(Pmax)]]));
  const I = Vth / (Rth + RL), V = I * RL, Pnow = I * I * RL;
  const curve = [];
  const lo = Math.log10(Math.min(Rth / 10, RL / 2)), hi = Math.log10(Math.max(Rth * 10, RL * 2)); // the present load on the curve too
  for (let i = 0; i <= 80; i++) { const x = Math.pow(10, lo + ((hi - lo) * i) / 80); curve.push([x, (Vth * Vth * x) / (Rth + x) ** 2]); }
  steps.push(step(`Step 4 — ${c.T.name} as it is now`, [
    P(`With the present ${c.T.name} = ${fR(RL)} the load takes:`),
    F(`IL = Vth / (Rth + RL)`, `   = ${fV(Vth)} / (${fR(Rth)} + ${fR(RL)}) = ${fI(I)}`, `PL = IL² × RL = ${fP(Pnow)}`, `   = ${pct(Pnow / Pmax)} of Pmax`),
    { t: 'curve', pts: curve, now: [RL, Pnow], best: [Rth, Pmax], xl: 'R_L', yl: 'P_L' },
    F([0.25, 0.5, 1, 2, 4].map((m) => { const x = m * Rth; return `RL = ${m}·Rth = ${fR(x)} → PL = ${fP((Vth * Vth * x) / (Rth + x) ** 2)}`; })),
    ...answerBlocks(c, I, V),
  ], null, [['P_L', fP(Pnow)], ['P_max', fP(Pmax)]]));
  return done(c, 'maxpower', steps, I, V, { Rth, Vth, Pmax, head: { main: `P_max = ${fP(Pmax)}`, sub: `at R_L = R_th = ${fR(Rth)} · now ${c.T.name} = ${fR(RL)} takes ${fP(Pnow)}` } });
}

// ------------------------------------------------------------------ Millman
/** The branches of a circuit made only of branches between a and b, each a chain through two-wire points. */
function millmanBranches(c) {
  const { a, b, T } = c;
  const others = c.elems.filter((e) => e !== T);
  const inc = new Map();
  for (const e of others) for (const n of new Set(e.n)) { if (!inc.has(n)) inc.set(n, []); inc.get(n).push(e); }
  const other = (e, x) => (e.n[0] === x ? e.n[1] : e.n[0]);
  const used = new Set(), branches = [];
  for (const first of inc.get(a) || []) {
    if (used.has(first)) continue;
    const chain = [{ e: first, from: a }];
    used.add(first);
    let node = other(first, a);
    while (node !== b) {
      const list = inc.get(node) || [];
      if (node === a || list.length !== 2) return { bad: node };
      const nx = list.find((e) => !used.has(e));
      if (!nx) return { bad: node };
      used.add(nx); chain.push({ e: nx, from: node }); node = other(nx, node);
    }
    branches.push(chain);
  }
  const left = others.filter((e) => !used.has(e));
  return left.length ? { bad: left[0].n.find((n) => (inc.get(n) || []).length > 2) ?? left[0].n[0], left } : { branches };
}

function millman(c) {
  const { a, b, RL } = c;
  const steps = [givenStep(c, [P('Millman’s theorem: when several branches — each a voltage source with its series resistor, a plain resistor or a current source — are all connected **in parallel between the same two points**, they can be replaced by **one source V_M in series with one resistor R_M**:'),
    F('VM = (E1/R1 + E2/R2 + … + I) / (1/R1 + 1/R2 + …)', 'RM = 1 / (1/R1 + 1/R2 + …)')])];
  const mb = millmanBranches(c);
  if (!mb.branches) {
    steps.push(step('Not a Millman circuit', [
      P(`Millman’s theorem needs every branch to run straight from a to b, side by side. Here point **${c.nm(mb.bad)}** joins more than two parts, so the circuit is not just parallel branches between a and b. **Thevenin’s theorem** or **source transformation** solves it (source transformation reduces a ladder to this parallel form).`),
      ...answerBlocks(c, c.full.I, c.full.V),
    ]));
    return done(c, 'millman', steps, c.full.I, c.full.V, { notApplicable: true });
  }
  const br = mb.branches.map((chain, k) => {
    const R = chain.filter((x) => x.e.kind === 'R'), V = chain.filter((x) => x.e.kind === 'V'), I = chain.filter((x) => x.e.kind === 'I');
    const rv = R.reduce((s, x) => s + x.e.val, 0);
    if (I.length) {
      const x = I[0], into = x.e.n[0] === x.from ? -x.e.val : x.e.val; // current it pushes into a
      return { k: k + 1, kind: 'I', I: into, text: `${x.e.name} (current source${R.length + V.length ? `; ${names([...R, ...V].map((y) => y.e))} in series change nothing` : ''})  →  I${k + 1} = ${fI(into)} into a` };
    }
    const E = V.reduce((s, x) => s + (x.e.n[0] === x.from ? x.e.val : -x.e.val), 0); // + end toward a adds
    const what = [...V.map((x) => x.e.name), ...R.map((x) => x.e.name)].join(' + ');
    return { k: k + 1, kind: V.length ? 'V' : 'R', E, R: rv, text: `${what}  →  E${k + 1} = ${fV(E)},  R${k + 1} = ${R.length > 1 ? R.map((x) => fR(x.e.val)).join(' + ') + ' = ' : ''}${fR(rv)}` };
  });
  const ideal = br.find((x) => x.kind !== 'I' && x.R === 0);
  const res = br.filter((x) => x.kind !== 'I' && x.R > 0), cur = br.filter((x) => x.kind === 'I');
  steps.push(step('Step 1 — The branches between a and b', [
    P(`Taking R_L out leaves ${br.length} branch${br.length > 1 ? 'es' : ''}, all joined between a and b. For each: its source voltage E (counted + when it raises a above b) and its total resistance R:`),
    F(br.map((x) => `Branch ${x.k}: ${x.text}`)),
  ], { ...ladderFig(c, c.elems.filter((e) => e !== c.T).map((e) => ({ ...e }))), columns: true }, []));
  let Vm, Rm, lines;
  if (ideal) {
    Vm = ideal.E; Rm = 0;
    lines = [`Branch ${ideal.k} is a voltage source with no resistance: it fixes VM = ${fV(Vm)} and RM = 0`];
  } else {
    const G = res.reduce((s, x) => s + 1 / x.R, 0), J = res.reduce((s, x) => s + x.E / x.R, 0) + cur.reduce((s, x) => s + x.I, 0);
    Rm = G ? 1 / G : Infinity; Vm = G ? J / G : NaN;
    const num = [...res.filter((x) => x.E).map((x) => `${fS(x.E, fV)}/${fR(x.R)}`), ...cur.map((x) => fS(x.I, fI))].join(' + ') || '0';
    const den = res.map((x) => `1/${fR(x.R)}`).join(' + ');
    lines = G
      ? [`VM = (${res.filter((x) => x.E).map((x) => `E${x.k}/R${x.k}`).concat(cur.map((x) => `I${x.k}`)).join(' + ') || '0'}) / (${res.map((x) => `1/R${x.k}`).join(' + ')})`,
        `   = (${num}) / (${den})`, `   = ${fI(J)} / ${fmt(G, 'S')} = ${fV(Vm)}`,
        `RM = 1 / (${den}) = ${fR(Rm)}`]
      : [`Only current sources: they add up to ${fI(J)} into a, and RM is infinite`];
    if (!G) Vm = J; // used below as the current
  }
  steps.push(step('Step 2 — Millman’s equivalent source', [F(lines)], null, Number.isFinite(Rm) ? [['V_M', fV(Vm)], ['R_M', fR(Rm)]] : []));
  const I = Number.isFinite(Rm) ? Vm / (Rm + RL) : Vm, V = I * RL;
  steps.push(step('Step 3 — Equivalent circuit', [
    P('Replace all the branches by V_M in series with R_M and put R_L back between a and b:'),
    F(Number.isFinite(Rm) ? [`IL = VM / (RM + RL) = ${fV(Vm)} / (${fR(Rm)} + ${fR(RL)}) = ${fI(I)}`] : [`IL = ${fI(I)} (all the source current flows in RL)`], `VL = IL × RL = ${fV(V)}`),
    ...answerBlocks(c, I, V),
  ], Number.isFinite(Rm) ? ladderFig(c, Rm > 0 ? [{ id: 'VM', kind: 'V', n: [-1, b], val: Vm, name: 'VM' }, { id: 'RM', kind: 'R', n: [-1, a], val: Rm, name: 'RM' }] : [{ id: 'VM', kind: 'V', n: [a, b], val: Vm, name: 'VM' }]) : null, [['I_L', fI(I)], ['V_L', fV(V)]]));
  return done(c, 'millman', steps, I, V, { Vm, Rm });
}

// ------------------------------------------------------------------ reciprocity
function reciprocity(c) {
  const { T, a, b } = c;
  const srcs = c.elems.filter((e) => e.kind !== 'R');
  const steps = [givenStep(c, [P('Reciprocity theorem: in a linear circuit with **one source**, if a voltage source E in branch x makes a current I in branch y, then the same E moved into branch y makes the **same current I in branch x**. For a current source it is the voltages: the voltage it makes across y equals the voltage across x when it is moved to y.')])];
  if (srcs.length !== 1 || srcs[0].rail) {
    steps.push(step('Needs exactly one source', [P(srcs.length > 1
      ? `This circuit has ${srcs.length} sources (${names(srcs)}). Reciprocity is stated for a circuit with a single source: use superposition to split the circuit into one-source circuits first.`
      : srcs.length ? 'A voltage rail has only one terminal, so it cannot be moved into another branch. Draw it as a two-terminal voltage source to use reciprocity.' : 'There is no source in this circuit.'), ...answerBlocks(c, c.full.I, c.full.V)]));
    return done(c, 'reciprocity', steps, c.full.I, c.full.V, { notApplicable: true });
  }
  const S = srcs[0], [p, q] = S.n;
  const one = contribution(c, S);
  const m = c.nodeCount + 1, nm2 = (n) => (n === m ? 'o' : c.nm(n));
  if (S.kind === 'V') {
    steps.push(step(`Step 1 — ${S.name} where it is: current in R_L`, one.blocks.slice(1), boardFig(c, { highlight: [T.src, S.src], ab: true, arrow: 'IL' }), [['I_L', fI(one.I)]]));
    // S's place becomes a short; S goes in series with R_L, driving current through it from a to b
    const rep = Math.min(p, q), mp = (n) => (n === p || n === q ? rep : n);
    const els = c.elems.filter((e) => e !== S && e !== T).map((e) => ({ ...e, n: e.n.map(mp), orig: e }));
    const T2 = { ...T, n: [mp(a), m] }, S2 = { ...S, n: [mp(b), m] };
    const all = [...els, T2, S2], sol = solveNet(all, c.nodeCount + 2, mp(c.ref));
    // the current through the short from q to p is the current leaving p's side into everything else
    let Ix = 0;
    const parts = [];
    for (const e of els) {
      const o = e.orig;
      if (o.n[0] === o.n[1] || !o.n.includes(p) || (o.n.includes(p) && o.n.includes(q))) continue;
      const x = o.n[0] === p ? sol.cur(e) : -sol.cur(e);
      parts.push([o.name, x]); Ix += x;
    }
    if (a === p) { const x = sol.cur(T2); parts.push([T.name, x]); Ix += x; }
    if (b === p) { const x = sol.cur(S2); parts.push([S.name, x]); Ix += x; }
    // the shorted point is one node with p and q: call it by the name the reader knows best
    const joined = [a, b, c.ref, p].find((n) => mp(n) === rep);
    const nmM = (n) => (n === rep ? c.nm(joined) : nm2(n));
    steps.push(step(`Step 2 — Move ${S.name} into the load’s branch`, [
      P(`Short ${S.name}’s old place (an ammeter there reads the current) and put ${S.name} in series with R_L so that it drives current through R_L from a to b (o is the new point between R_L and ${S.name}). Solve${refText(c, mp(c.ref), nmM)}`),
      F(nodalLines(all, sol, mp(c.ref), nmM)),
      P(`The current in the short (in the direction ${S.name} pushed it) is what leaves point ${c.nm(p)} into the rest of the circuit:`),
      F(parts.length === 1 ? [`I = current into ${parts[0][0]} = ${fI(Ix)}`] : [...parts.map(([n, x]) => `into ${n}:  ${fI(x)}`), `I = ${parts.map(([, x]) => fS(x, fI)).join(' + ') || '0'} = ${fI(Ix)}`]),
    ], boardFig(c, { highlight: [T.src], ab: true, arrow: `${S.name} here`, meter: { src: S.src, type: 'ammeter', text: 'I = ?' } }), [['I', fI(Ix)]]));
    steps.push(step('Step 3 — Compare', [
      F(`Step 1: ${S.name} in its branch  →  current in ${T.name} = ${fI(one.I)}`, `Step 2: ${S.name} in ${T.name}’s branch  →  current where ${S.name} was = ${fI(Ix)}`),
      P(Math.abs(Ix - one.I) <= 1e-6 * Math.max(Math.abs(one.I), 1e-9) + 1e-12
        ? `The two currents are equal: **reciprocity holds**. The ratio E / I = ${fR(S.val / one.I)} (the transfer resistance) is the same both ways.`
        : 'The two currents differ — this circuit is not reciprocal.'),
      ...answerBlocks(c, c.full.I, c.full.V),
    ], null, [['I (Step 1)', fI(one.I)], ['I (Step 2)', fI(Ix)]]));
    return done(c, 'reciprocity', steps, c.full.I, c.full.V);
  }
  // a current source: compare voltages
  steps.push(step(`Step 1 — ${S.name} where it is: voltage across R_L`, one.blocks.slice(1), boardFig(c, { highlight: [T.src, S.src], ab: true }), [['V_L', fV(one.V)]]));
  const S2 = { ...S, n: [b, a] }; // now pushes its current into a, across the load
  const all = [...c.elems.filter((e) => e !== S), S2], sol = solveNet(all, c.nodeCount, c.ref);
  const Vx = sol.v[q] - sol.v[p];
  steps.push(step(`Step 2 — Move ${S.name} across the load`, [
    P(`Take ${S.name} out (open its old place; a voltmeter there reads the voltage) and connect it across R_L so that it pushes its current into a. Solve the node voltages${refText(c, c.ref)}`),
    F(nodalLines(all, sol, c.ref, c.nm)),
    F(`V where ${S.name} was = V${c.nm(q)} − V${c.nm(p)} = ${fV(Vx)}   (+ on the side it pushed current into)`),
  ], boardFig(c, { highlight: [T.src], ab: true, arrow: `${S.name} here`, meter: { src: S.src, type: 'voltmeter', text: 'V = ?' } }), [['V', fV(Vx)]]));
  steps.push(step('Step 3 — Compare', [
    F(`Step 1: ${S.name} in place  →  voltage across ${T.name} = ${fV(one.V)}`, `Step 2: ${S.name} across ${T.name}  →  voltage where ${S.name} was = ${fV(Vx)}`),
    P(Math.abs(Vx - one.V) <= 1e-6 * Math.max(Math.abs(one.V), 1e-9) + 1e-12 ? `The two voltages are equal: **reciprocity holds** (transfer resistance V / I = ${fR(one.V / S.val)}).` : 'The two voltages differ — this circuit is not reciprocal.'),
    ...answerBlocks(c, c.full.I, c.full.V),
  ], null, [['V (Step 1)', fV(one.V)], ['V (Step 2)', fV(Vx)]]));
  return done(c, 'reciprocity', steps, c.full.I, c.full.V);
}

// ------------------------------------------------------------------ Tellegen
function tellegen(c) {
  const { T } = c;
  const sol = solveNet(c.elems, c.nodeCount, c.ref);
  const steps = [givenStep(c, [P('Tellegen’s theorem: in any circuit, the powers of all the branches add up to **zero**, Σ v·i = 0, when every branch voltage and current follow the same sign convention (current entering the + end). In other words: the power the sources deliver is exactly the power the other parts take.')])];
  steps.push(step('Step 1 — Solve the circuit', [P('Find every node voltage' + refText(c, c.ref)), F(nodalLines(c.elems, sol, c.ref, c.nm))],
    boardFig(c, { highlight: [T.src], ab: true, tags: tagNodes(c, c.elems) })));
  const rows = c.elems.map((e) => { const v = sol.v[e.n[0]] - sol.v[e.n[1]], i = sol.cur(e); return { e, v, i, p: v * i }; });
  steps.push(step('Step 2 — Voltage, current and power of every branch', [
    P('For each part take v across it and i through it the same way round — the current entering the end that v is measured from (the + end of a voltage source, the tail of a current source’s arrow). Then p = v × i: positive means the part **takes** power, negative means it **gives** (delivers) power.'),
    { t: 'table', head: ['Part', 'v', 'i', 'p = v·i', ''], rows: rows.map((r) => [r.e.name, fV(r.v), fI(r.i), fP(r.p), tidy(r.p) < 0 ? 'gives' : tidy(r.p) > 0 ? 'takes' : '—']), mark: rows.findIndex((r) => r.e === T) },
  ]));
  const take = rows.filter((r) => tidy(r.p) > 0), give = rows.filter((r) => tidy(r.p) < 0);
  const Pin = give.reduce((s, r) => s - r.p, 0), Pout = take.reduce((s, r) => s + r.p, 0), sum = rows.reduce((s, r) => s + r.p, 0);
  steps.push(step('Step 3 — Add them up', [
    F(`Delivered: ${give.map((r) => `${r.e.name} ${fP(-r.p)}`).join(' + ') || '0'} = ${fP(Pin)}`, `Taken:     ${take.map((r) => `${r.e.name} ${fP(r.p)}`).join(' + ') || '0'} = ${fP(Pout)}`, `Σ p = ${fP(Pout)} − ${fP(Pin)} = ${fP(Math.abs(sum) < 1e-9 * Math.max(Pin, 1e-12) ? 0 : sum)}`),
    P(`The sum is zero: **Tellegen’s theorem holds** — every watt the sources deliver is taken by the resistors. ${T.name} takes ${fP(c.full.I * c.full.I * c.RL)} of the ${fP(Pin)}.`),
    ...answerBlocks(c, c.full.I, c.full.V),
  ], null, [['Σ p', '0 W'], ['Delivered', fP(Pin)]]));
  return done(c, 'tellegen', steps, c.full.I, c.full.V, { head: { main: 'Σ p = 0', sub: `the sources deliver ${fP(Pin)}; ${T.name} takes ${fP(c.full.I * c.full.I * c.RL)} (I_L = ${fI(c.full.I)})` } });
}

// ------------------------------------------------------------------ source transformation
/** The few circuits a source transformation ends with: the load fed by one source with one resistor. */
function finalForm(els, T, a, b) {
  const others = els.filter((e) => e !== T);
  const across = (e) => (e.n[0] === a && e.n[1] === b) || (e.n[0] === b && e.n[1] === a);
  if (!others.length) return { k: 'none' };
  if (others.every(across)) {
    const R = others.filter((e) => e.kind === 'R'), V = others.filter((e) => e.kind === 'V'), I = others.filter((e) => e.kind === 'I');
    if (V.length === 1 && others.length === 1) return { k: 'V', V: V[0] };
    if (I.length === 1 && R.length <= 1 && !V.length) return { k: 'N', I: I[0], R: R[0] };
    if (R.length === 1 && others.length === 1) return { k: 'none' };
    return null;
  }
  if (others.length === 2) {
    const [x, y] = others;
    const m = x.n.find((n) => n !== a && n !== b && y.n.includes(n));
    if (m === undefined || x.kind === y.kind || !['R', 'V'].includes(x.kind) || !['R', 'V'].includes(y.kind)) return null;
    const ends = [...x.n, ...y.n].filter((n) => n !== m);
    if (ends.includes(a) && ends.includes(b)) return { k: 'T', V: x.kind === 'V' ? x : y, R: x.kind === 'R' ? x : y, m };
  }
  return null;
}

function sourceTransformation(c) {
  const { T: T0, a, b, RL } = c;
  let els = c.elems.map((e) => ({ ...e }));
  const T = els.find((e) => e.id === T0.id);
  let nextNode = c.nodeCount + 1, nextId = 1000;
  const count = { R: 0, V: 0, I: 0 }, PRE = { R: 'Req', V: 'Vs', I: 'Is' };
  const fresh = (kind, n, val, name) => ({ id: nextId++, kind, n, val, name: name || `${PRE[kind]}${++count[kind]}` });
  const other = (e, x) => (e.n[0] === x ? e.n[1] : e.n[0]);
  const incident = () => {
    const m = new Map();
    for (const e of els) for (const n of new Set(e.n)) { if (!m.has(n)) m.set(n, []); m.get(n).push(e); }
    return m;
  };
  const snap = (hi) => ladderFig(c, els.filter((e) => e !== T).map((e) => ({ ...e })), hi);
  const pairKey = (e) => Math.min(...e.n) + '|' + Math.max(...e.n);
  const steps = [givenStep(c, [P('Source transformation: a voltage source V in series with a resistor R acts on the rest of the circuit exactly like a current source **I = V / R in parallel with the same R** — and back again (V = I × R). Swapping between the two lets series and parallel parts combine, until only one source and one resistor feed R_L.')])];
  const first = snap([]);
  steps.push(step('Redraw the circuit', [P('The same circuit, drawn as a ladder with R_L on the right between a and b.')], first));
  const rules = [
    // parts that carry no current
    () => {
      const inc = incident(), out = [], gone = new Set();
      for (const e of els) if (e !== T && e.n[0] === e.n[1]) { if (e.kind === 'V' && e.val) throw new Error(`${e.name} is shorted by a wire.`); gone.add(e); out.push(`${e.name} is shorted out (both ends on one node): remove it.`); }
      for (const [x, list] of inc) {
        if (x === a || x === b || list.length !== 1 || gone.has(list[0]) || list[0] === T) continue;
        const e = list[0];
        if (e.kind === 'I') throw new Error(`${e.name}'s current has no path back.`);
        gone.add(e); out.push(`${e.name} has a free end: no current flows in it, remove it.`);
      }
      if (!gone.size) return null;
      els = els.filter((e) => !gone.has(e));
      return { title: 'Remove parts that carry no current', text: out, hi: [] };
    },
    // resistors in series
    () => {
      const inc = incident(), used = new Set(), out = [], hi = [];
      const mid = (x) => x !== a && x !== b && inc.get(x)?.length === 2;
      const isR = (e) => e.kind === 'R' && e !== T;
      for (const [x, list] of inc) {
        if (!mid(x) || !list.every(isR) || list.some((e) => used.has(e))) continue;
        const chain = [...list];
        let L = other(list[0], x), Rn = other(list[1], x);
        const grow = (end, add) => {
          for (let g = 0; g < 1000 && mid(end); g++) {
            const nx = inc.get(end).find((e) => !chain.includes(e));
            if (!nx || !isR(nx) || used.has(nx)) break;
            add(nx); end = other(nx, end);
          }
          return end;
        };
        L = grow(L, (e) => chain.unshift(e));
        Rn = grow(Rn, (e) => chain.push(e));
        for (const e of chain) used.add(e);
        const r = fresh('R', [L, Rn], chain.reduce((s, e) => s + e.val, 0));
        els = els.filter((e) => !chain.includes(e));
        els.push(r); hi.push(r.id);
        out.push(`${chain.map((e) => e.name).join(' + ')} are in series:  ${r.name} = ${chain.map((e) => fR(e.val)).join(' + ')} = ${fR(r.val)}`);
      }
      return out.length ? { title: 'Combine resistors in series', text: out, hi } : null;
    },
    // resistors in parallel
    () => {
      const groups = new Map(), out = [], hi = [];
      for (const e of els) if (e.kind === 'R' && e !== T) { const k = pairKey(e); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
      for (const g of groups.values()) {
        if (g.length < 2) continue;
        const val = 1 / g.reduce((s, e) => s + 1 / e.val, 0);
        const r = fresh('R', [...g[0].n], val);
        els = els.filter((e) => !g.includes(e));
        els.push(r); hi.push(r.id);
        out.push(g.length === 2
          ? `${g[0].name} ∥ ${g[1].name}:  ${r.name} = (${fR(g[0].val)} × ${fR(g[1].val)}) / (${fR(g[0].val)} + ${fR(g[1].val)}) = ${fR(val)}`
          : `${g.map((e) => e.name).join(' ∥ ')}:  ${r.name} = 1 / (${g.map((e) => '1/' + fR(e.val)).join(' + ')}) = ${fR(val)}`);
      }
      return out.length ? { title: 'Combine resistors in parallel', text: out, hi } : null;
    },
    // current sources in parallel
    () => {
      const groups = new Map(), out = [], hi = [];
      for (const e of els) if (e.kind === 'I') { const k = pairKey(e); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
      for (const g of groups.values()) {
        if (g.length < 2) continue;
        const [p, q] = g[0].n;
        const sum = g.reduce((s, e) => s + (e.n[1] === q ? e.val : -e.val), 0);
        const r = fresh('I', sum >= 0 ? [p, q] : [q, p], Math.abs(sum));
        els = els.filter((e) => !g.includes(e));
        els.push(r); hi.push(r.id);
        out.push(`${g.map((e) => e.name).join(' and ')} are in parallel: they add (opposite arrows subtract):  ${r.name} = ${g.map((e) => fS(e.n[1] === q ? e.val : -e.val, fI)).join(' + ')} = ${fI(sum)}${sum < 0 ? ' (so the arrow turns round)' : ''}`);
      }
      return out.length ? { title: 'Combine current sources in parallel', text: out, hi } : null;
    },
    // voltage sources in series
    () => {
      const inc = incident();
      for (const [x, list] of inc) {
        if (x === a || x === b || list.length !== 2 || !list.every((e) => e.kind === 'V')) continue;
        const [e1, e2] = list, p = other(e1, x), q = other(e2, x);
        // rise from p to q: a source adds its value when its + end faces q
        const rise = (e1.n[0] === x ? e1.val : -e1.val) + (e2.n[0] === q ? e2.val : -e2.val);
        const v = fresh('V', rise >= 0 ? [q, p] : [p, q], Math.abs(rise));
        els = els.filter((e) => e !== e1 && e !== e2);
        els.push(v);
        return { title: 'Combine voltage sources in series', text: [`${e1.name} and ${e2.name} are in series: their voltages add (or subtract when they face opposite ways):  ${v.name} = ${fV(Math.abs(rise))}`], hi: [v.id] };
      }
      return null;
    },
    // anything in series with a current source does not change its current
    () => {
      const inc = incident();
      for (const [x, list] of inc) {
        if (x === a || x === b || list.length !== 2) continue;
        const i = list.find((e) => e.kind === 'I'), o = list.find((e) => e !== i);
        if (!i || !o || o === T || o.kind === 'I') continue;
        const far = other(o, x);
        els = els.filter((e) => e !== o);
        i.n = i.n.map((n) => (n === x ? far : n));
        return { title: `Remove ${o.name} (in series with ${i.name})`, text: [`${o.name} is in series with the current source ${i.name}. ${i.name} sets the current in that branch whatever else is in it, so ${o.name} changes nothing for the rest of the circuit: take it out (short it).`], hi: [i.id] };
      }
      return null;
    },
    // anything in parallel with a voltage source does not change its voltage
    () => {
      for (const v of els.filter((e) => e.kind === 'V')) {
        const o = els.find((e) => e !== v && e !== T && e.kind !== 'V' && pairKey(e) === pairKey(v));
        if (!o) continue;
        els = els.filter((e) => e !== o);
        return { title: `Remove ${o.name} (in parallel with ${v.name})`, text: [`${o.name} is in parallel with the voltage source ${v.name}. ${v.name} sets the voltage across it whatever else is connected, so ${o.name} changes nothing for the rest of the circuit: take it out.`], hi: [v.id] };
      }
      return null;
    },
    // V in series with R → I in parallel with R, where it then joins other parts in parallel
    () => {
      const inc = incident();
      for (const [m, list] of inc) {
        if (m === a || m === b || list.length !== 2) continue;
        const v = list.find((e) => e.kind === 'V'), r = list.find((e) => e.kind === 'R' && e !== T);
        if (!v || !r) continue;
        const pv = other(v, m), pr = other(r, m);
        if (pv === pr) continue;
        // worth it only when something else joins the same two nodes: then they combine in parallel
        const joins = (u, w) => (u === pv && w === pr) || (u === pr && w === pv);
        const partner = els.some((e) => e !== v && e !== r && e !== T && joins(e.n[0], e.n[1]))
          || [...inc].some(([m2, l2]) => m2 !== m && m2 !== a && m2 !== b && l2.length === 2 && !l2.includes(T) && joins(other(l2[0], m2), other(l2[1], m2)));
        if (!partner) continue;
        const toward = v.n[0] === m ? pr : pv; // the arrow points to the side the + end faces
        const i = fresh('I', [toward === pr ? pv : pr, toward], v.val / r.val);
        els = els.filter((e) => e !== v);
        r.n = [pv, pr];
        els.push(i);
        return { title: `Transform ${v.name} + ${r.name} into a current source`, text: [
          `${v.name} in series with ${r.name}  →  current source ${i.name} in parallel with ${r.name}:`,
          `${i.name} = ${v.name} / ${r.name} = ${fV(v.val)} / ${fR(r.val)} = ${fI(i.val)}   (arrow toward the + end of ${v.name})`,
        ], hi: [i.id, r.id] };
      }
      return null;
    },
    // I in parallel with R → V in series with R, where it then joins other parts in series
    () => {
      const inc = incident();
      for (const i of els.filter((e) => e.kind === 'I')) {
        const r = els.find((e) => e.kind === 'R' && e !== T && pairKey(e) === pairKey(i));
        if (!r) continue;
        const [p, q] = i.n;
        if ((p === a || p === b) && (q === a || q === b)) continue;
        const pick = [p, q].filter((x) => x !== a && x !== b && inc.get(x).length === 3)
          .map((x) => ({ x, third: inc.get(x).find((e) => e !== i && e !== r) }))
          .find(({ third }) => third && third !== T && (third.kind === 'R' || third.kind === 'V'));
        if (!pick) continue;
        const { x, third } = pick, y = x === p ? q : p, m = nextNode++;
        const toY = i.n[1] === y; // current flows toward y
        let v;
        if (third.kind === 'R') { r.n = [x, m]; v = fresh('V', toY ? [y, m] : [m, y], i.val * r.val); } // x –R– m –V– y
        else { r.n = [m, y]; v = fresh('V', toY ? [m, x] : [x, m], i.val * r.val); } // x –V– m –R– y
        els = els.filter((e) => e !== i);
        els.push(v);
        return { title: `Transform ${i.name} ∥ ${r.name} into a voltage source`, text: [
          `${i.name} in parallel with ${r.name}  →  voltage source ${v.name} in series with ${r.name}:`,
          `${v.name} = ${i.name} × ${r.name} = ${fI(i.val)} × ${fR(r.val)} = ${fV(v.val)}   (+ end on the side the arrow of ${i.name} points to)`,
        ], hi: [v.id, r.id] };
      }
      return null;
    },
  ];
  let fin = null, stuck = false;
  try {
    for (let guard = 0; guard < 60; guard++) {
      fin = finalForm(els, T, a, b);
      if (fin) break;
      let r = null;
      for (const rule of rules) { r = rule(); if (r) break; }
      if (!r) { stuck = true; break; }
      steps.push(step(`Step ${steps.length - 1} — ${r.title}`, [F(r.text)], snap(r.hi)));
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
  if (stuck || !fin) {
    steps.push(step('No further transformation', [
      P('No source transformation or series / parallel combination applies any more (for example the resistors form a bridge, or a source has no resistor in series or in parallel with it). **Thevenin’s or Norton’s theorem** solves this circuit.'),
      ...answerBlocks(c, c.full.I, c.full.V),
    ]));
    return done(c, 'source', steps, c.full.I, c.full.V, { stuck: true });
  }
  let I, lines, kind;
  if (fin.k === 'none') { I = 0; lines = ['No source is left feeding R_L, so IL = 0']; kind = 'No source left'; }
  else if (fin.k === 'V') {
    const Vab = fin.V.n[0] === a ? fin.V.val : -fin.V.val;
    I = Vab / RL; kind = 'One voltage source across R_L';
    lines = [`${fin.V.name} sits right across R_L:  VL = ${fV(Vab)}`, `IL = VL / RL = ${fV(Vab)} / ${fR(RL)} = ${fI(I)}`];
  } else if (fin.k === 'N') {
    const In = fin.I.n[1] === a ? fin.I.val : -fin.I.val;
    kind = 'Norton form: current source ∥ resistor';
    if (fin.R) {
      I = (In * fin.R.val) / (fin.R.val + RL);
      lines = [`${fin.I.name} splits between ${fin.R.name} and RL (current divider):`, `IL = ${fin.I.name} × ${fin.R.name} / (${fin.R.name} + RL)`, `   = ${fI(In)} × ${fR(fin.R.val)} / (${fR(fin.R.val)} + ${fR(RL)})`, `   = ${fI(I)}`];
    } else { I = In; lines = [`All of ${fin.I.name} flows in RL:  IL = ${fI(I)}`]; }
  } else {
    const { V: v, R: r, m } = fin;
    const vEnd = other(v, m); // the end of the source not at m
    const Vab = vEnd === a ? (v.n[0] === a ? v.val : -v.val) : (v.n[0] === m ? v.val : -v.val);
    I = Vab / (r.val + RL); kind = 'Thevenin form: voltage source + series resistor';
    lines = [`One loop: ${v.name}, ${r.name} and RL in series:`, `IL = ${v.name} / (${r.name} + RL) = ${fV(Vab)} / (${fR(r.val)} + ${fR(RL)}) = ${fI(I)}`];
  }
  const V = I * RL;
  steps.push(step(`Step ${steps.length - 1} — Solve the last loop (${kind})`, [F(lines, `VL = IL × RL = ${fI(I)} × ${fR(RL)} = ${fV(V)}`), ...answerBlocks(c, I, V)], snap([]), [['I_L', fI(I)], ['V_L', fV(V)]]));
  return done(c, 'source', steps, I, V);
}

// ------------------------------------------------------------------ entry
export const THEOREMS = [
  { id: 'thevenin', title: 'Thevenin’s theorem', short: 'Thevenin', desc: 'Replace the circuit seen by the load with one voltage source V_th in series with R_th.' },
  { id: 'norton', title: 'Norton’s theorem', short: 'Norton', desc: 'Replace it with one current source I_N in parallel with R_N.' },
  { id: 'superposition', title: 'Superposition theorem', short: 'Superposition', desc: 'Take one source at a time (the others off), then add up the effects.' },
  { id: 'source', title: 'Source transformation', short: 'Source transformation', desc: 'Swap V + series R ⇄ I ∥ R and combine, step by step, until one source and one resistor are left.' },
  { id: 'maxpower', title: 'Maximum power transfer theorem', short: 'Maximum power transfer', desc: 'The load takes the most power when R_L = R_th: find R_th, V_th and P_max = V_th² / 4R_th.' },
  { id: 'millman', title: 'Millman’s theorem', short: 'Millman', desc: 'Parallel branches (sources with series resistors) between two points → one source V_M with R_M.' },
  { id: 'reciprocity', title: 'Reciprocity theorem', short: 'Reciprocity', desc: 'Move the single source into the load’s branch: the current where it was is the same.' },
  { id: 'tellegen', title: 'Tellegen’s theorem', short: 'Tellegen (power balance)', desc: 'The powers of all the branches add up to zero: sources deliver what the resistors take.' },
];

/**
 * Solve the circuit for the resistor at doc.elements[src] with a theorem.
 * want: 'I' (current) or 'V' (voltage). Returns { ok, steps, answer, full, … } or { ok: false, error }.
 */
export function runTheorem(prep, theorem, src, want = 'I') {
  const c = context(prep.net, src, want);
  if (c.error) return { ok: false, error: c.error };
  c.style = prep.style;
  const fn = { thevenin, norton, superposition, source: sourceTransformation, maxpower: maxPower, millman, reciprocity, tellegen }[theorem];
  return fn ? fn(c) : { ok: false, error: 'Unknown theorem' };
}
