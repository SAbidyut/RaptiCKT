// AC circuits solved in the phasor domain, step by step, the way Alexander & Sadiku's
// Fundamentals of Electric Circuits does it (ch. 10 Sinusoidal Steady-State Analysis, ch. 13
// Magnetically Coupled Circuits):
//   1. transform the circuit to the phasor (frequency) domain,
//   2. solve it with a circuit technique (nodal, mesh, superposition, Thevenin, Norton …),
//   3. transform the resulting phasor back to the time domain.
//
// Network model: elements { id, kind, n: [p, q], name, src }
//   Z: an impedance — a resistor (R), an inductor (L, with its series R) or a capacitor (C)
//   V: an independent voltage source, phasor `ph` at ω = `w`, + at p
//   I: an independent current source, phasor `ph` at ω = `w`, pushing it out at q
//   DV / DI: a dependent (controlled) source, gain × its control (`ctl`), + at p / out at q
// and couplings { a, b, M }: a mutual inductance between the coils a and b (dot convention
// folded into the sign of M, for the coils' p → q currents).

import { C, fmtPhasor, fmtRect, fmtTime, num, sourcePhasor, sourceOmega } from './phasor.js';
import { topology, findMeshes, spTree, UF, ms, plainMath } from './theorem.js';

// ------------------------------------------------------------------ formatting
const fr = (a, b) => `\\frac{${a}}{${b}}`;
const tx = (w) => `\\t{${w}}`;
const P = (text) => ({ t: 'p', text });
const F = (...lines) => ({ t: 'f', lines: lines.flat() });
const TIP = (text) => ({ t: 'tip', text });
const step = (title, blocks, fig = null, result = []) => ({ title, blocks, fig, result });
const fV = (z) => fmtPhasor(z, 'V');
const fI = (z) => fmtPhasor(z, 'A');
const fZ = (z) => (Number.isFinite(z[0]) && Number.isFinite(z[1]) ? fmtRect(z, 'Ω') : '∞ Ω (open)');
const rect = (z) => fmtRect(z);
/** a complex coefficient inside a sum: "(4 − j3)", "j8", "10" */
const par = (z) => { const s = rect(z); return /\s[+−]\s/.test(s) ? `(${s})` : s; };
const W = (w) => num(w, 4);
const isZero = (z) => C.abs(z) < 1e-12;
/** "(a ∥ b)" → "a ∥ b" when the brackets hold the whole expression */
function unwrap(s) {
  if (s[0] !== '(' || s[s.length - 1] !== ')') return s;
  let d = 0;
  for (let i = 0; i < s.length; i++) { d += s[i] === '(' ? 1 : s[i] === ')' ? -1 : 0; if (!d && i < s.length - 1) return s; }
  return s.slice(1, -1);
}
/** a matrix equation [A][x] = [b], drawn with brackets by the view */
const MX = (A, xs, b) => ({ t: 'matrix', A: A.map((row) => row.map(rect)), x: xs, b: b.map(rect) });

const VSRC = new Set(['dcv', 'acv', 'square', 'pulse', 'triangle', 'sawtooth', 'noise', 'sweep']);
const ISRC = new Set(['dci', 'aci']);
const isCoilEl = (e) => typeof e.coilDot === 'function' && e.p.l > 0;
const isCapEl = (e) => typeof e.jNow === 'function' && e.p.c > 0;

/** Does this circuit belong to the AC (phasor) theorems: a sine / cosine source, or the phasor domain on? */
export function isACDoc(doc) {
  if (!doc) return false;
  if (doc.domain === 'phasor') return true;
  return doc.elements.some((e) => (VSRC.has(e.constructor.type) || ISRC.has(e.constructor.type) || e.constructor.type === 'rail') && sourceOmega(e.p) > 0);
}

// ------------------------------------------------------------------ circuit → network
function classify(e) {
  const t = e.constructor.type, p = e.p || {}, n = e.localPosts().length;
  if (t === 'ground') return { k: 'gnd' };
  if (t === 'mutual') return { k: 'M' };
  if (n === 0 || t === 'netlabel' || t === 'label') return { k: 'skip' };
  if (t === 'resistor') return { k: 'Z', R: Math.max(p.r, 1e-12) };
  if (isCoilEl(e)) return { k: 'Z', L: p.l, R: p.rs > 0 ? p.rs : 0, coil: true };
  if (isCapEl(e)) return { k: 'Z', C: p.c };
  const w = sourceOmega(p);
  if (VSRC.has(t) || ISRC.has(t) || t === 'rail') {
    if (w == null) return { k: 'bad', why: 'not a sine, cosine or DC source' };
    const ph = sourcePhasor(p, w);
    if (t === 'rail') return { k: 'rail', ph, w };
    return VSRC.has(t) ? { k: 'V', ph, w, r: p.rint > 0 ? p.rint : 0 } : { k: 'I', ph, w };
  }
  if (t === 'depsrc') return { k: e.isCurrent() ? 'DI' : 'DV', gain: +p.gain, ctrl: String(p.ctrl || ''), sym: String(p.sym || '') };
  if (t === 'ammeter') return p.rsh > 0 ? { k: 'Z', R: p.rsh } : { k: 'short' };
  if (t === 'voltmeter') return p.rin > 0 ? { k: 'Z', R: p.rin } : { k: 'open' };
  if (n === 2 && typeof e.isClosed === 'function') return e.isClosed() ? (p.ron > 0 ? { k: 'Z', R: p.ron } : { k: 'short' }) : { k: 'open' };
  return { k: 'bad', why: e.constructor.title };
}

/** The phasor-domain network of a circuit document. */
export function extractACNetwork(doc) {
  const cls = doc.elements.map(classify);
  const topo = topology(doc, cls), { node, posts } = topo;
  const elems = [], bad = [], muts = [];
  let hasGround = topo.hasGround;
  cls.forEach((c, i) => {
    const e = doc.elements[i], ps = posts[i], base = { name: e.name, src: i };
    if (c.k === 'Z') elems.push({ ...base, kind: 'Z', n: [node(ps[0]), node(ps[1])], R: c.R || 0, L: c.L || 0, C: c.C || 0, coil: !!c.coil });
    else if (c.k === 'I') elems.push({ ...base, kind: 'I', n: [node(ps[0]), node(ps[1])], ph: c.ph, w: c.w });
    else if (c.k === 'rail') { hasGround = true; elems.push({ ...base, kind: 'V', n: [node(ps[0]), 0], ph: c.ph, w: c.w, rail: true }); }
    else if (c.k === 'V') {
      const p = node(ps[0]), q = node(ps[1]);
      if (!c.r) { elems.push({ ...base, kind: 'V', n: [p, q], ph: c.ph, w: c.w }); return; }
      const m = topo.newNode();
      elems.push({ ...base, kind: 'V', n: [p, m], ph: c.ph, w: c.w });
      elems.push({ ...base, name: `r(${e.name})`, kind: 'Z', n: [m, q], R: c.r, L: 0, C: 0, internal: true });
    } else if (c.k === 'DI' || c.k === 'DV') elems.push({ ...base, kind: c.k, n: [node(ps[0]), node(ps[1])], gain: c.gain, ctrl: c.ctrl, sym: c.sym });
    else if (c.k === 'bad') bad.push(`${e.name} (${c.why})`);
  });
  elems.forEach((x, i) => { x.id = i; });
  // controls of the dependent sources: v:PART, i:PART or node:LABEL
  for (const x of elems) {
    if (x.kind !== 'DI' && x.kind !== 'DV') continue;
    const m = /^(node|v|i):\s*(.+)$/.exec(x.ctrl.trim());
    if (!m) { bad.push(`${x.name} (its control "${x.ctrl}" is not node:NAME, v:PART or i:PART)`); continue; }
    if (m[1] === 'node') {
      const li = doc.elements.findIndex((e) => e.netName && e.netName() === m[2].trim());
      if (li < 0) { bad.push(`${x.name} (no net label ${m[2]})`); continue; }
      x.ctl = { type: 'node', p: node(posts[li][0]), q: 0, label: m[2].trim() };
      continue;
    }
    const tgt = elems.find((y) => y.name === m[2].trim() && !y.internal);
    if (!tgt) { bad.push(`${x.name} (no part ${m[2]} to take its control from)`); continue; }
    x.ctl = { type: m[1], el: tgt };
  }
  // mutual inductances: the two coils each one couples, with the dot convention's sign
  doc.elements.forEach((e, i) => {
    if (cls[i].k !== 'M') return;
    const [a, b] = e.coils(doc.elements);
    if (!a) { bad.push(`${e.name} (a mutual inductance needs two inductors near it)`); return; }
    const ea = elems.find((x) => x.src === doc.elements.indexOf(a) && x.kind === 'Z'), eb = elems.find((x) => x.src === doc.elements.indexOf(b) && x.kind === 'Z');
    if (ea && eb) muts.push({ a: ea, b: eb, M: e.p.m * a.coilDot() * b.coilDot(), Mabs: e.p.m, name: e.name, src: i });
  });
  const nodePos = topo.nodePos();
  return { elems, muts, nodeCount: topo.count(), hasGround, nodePos, bad, posts };
}

/** impedance of a Z element at ω */
export function zAt(e, w) {
  if (e.C) return w > 0 ? [e.R || 0, -1 / (w * e.C)] : [Infinity, 0];
  return [e.R || 0, w * (e.L || 0)];
}
/** the book's transform of a part into the phasor domain, as a line of text */
function transformLine(e, w) {
  if (e.kind === 'Z') {
    if (e.C) return `${num(e.C)} F  ⇒  ${fr('1', 'jωC')} = ${rect(zAt(e, w))} Ω`;
    if (e.L) return `${num(e.L)} H  ⇒  jωL = ${rect([0, w * e.L])} Ω${e.R ? `  ${tx(`(+ ${num(e.R)} Ω winding resistance)`)}` : ''}`;
    return null;
  }
  return null;
}
const srcTime = (x) => {
  const unit = x.kind === 'I' ? 'A' : 'V';
  return x.w > 0 ? fmtTime(x.ph, x.w, unit) : `${num(x.ph[0])} ${unit} (DC)`;
};

// ------------------------------------------------------------------ complex solver
/** Gaussian elimination on complex [re, im] entries. A: n × n, b: n. Returns x or null. */
export function csolve(A, b) {
  const n = b.length;
  A = A.map((r) => r.map((z) => [...z])); b = b.map((z) => [...z]);
  let norm = 0;
  for (const r of A) for (const z of r) norm = Math.max(norm, C.abs(z));
  const tol = Math.max(norm, 1e-30) * 1e-12;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (C.abs(A[r][c]) > C.abs(A[piv][c])) piv = r;
    if (C.abs(A[piv][c]) < tol) return null;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = C.div(A[r][c], A[c][c]);
      if (isZero(f)) continue;
      for (let k = c; k < n; k++) A[r][k] = C.sub(A[r][k], C.mul(f, A[c][k]));
      b[r] = C.sub(b[r], C.mul(f, b[c]));
    }
  }
  const x = new Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s = C.sub(s, C.mul(A[r][k], x[k]));
    x[r] = C.div(s, A[r][r]);
  }
  return x;
}
/** determinant of a small complex matrix (Cramer's rule, as the book does for 2 or 3 unknowns) */
function cdet(A) {
  const n = A.length;
  if (n === 1) return A[0][0];
  if (n === 2) return C.sub(C.mul(A[0][0], A[1][1]), C.mul(A[0][1], A[1][0]));
  let d = [0, 0];
  for (let k = 0; k < n; k++) {
    const minor = A.slice(1).map((r) => r.filter((_, j) => j !== k));
    const t = C.mul(A[0][k], cdet(minor));
    d = k % 2 ? C.sub(d, t) : C.add(d, t);
  }
  return d;
}

/**
 * Phasors of a network at ω by modified nodal analysis. Sources running at another ω are off
 * (a voltage source a short, a current source an open), and so is every independent source but
 * `only` when it is given. Coils carry their currents as unknowns (for M, and for ω = 0).
 * extra: more elements (a 1 A test source, a short between a and b).
 * Returns { v: node phasors, cur(e): the phasor current through e from n[0] to n[1] } or null.
 */
export function solveAC(net, elems, w, { ref = 0, only = null, extra = [], muts = net.muts } = {}) {
  const all = [...elems, ...extra];
  const on = (x) => (x.kind === 'V' || x.kind === 'I') && (only ? x === only : true) && Math.abs((x.w || 0) - w) <= 1e-9 * Math.max(1, w);
  const used = new Set([ref]);
  for (const e of all) { used.add(e.n[0]); used.add(e.n[1]); }
  const uf = new UF();
  for (const e of all) if (!(e.kind === 'I' || (e.kind === 'Z' && e.C && !(w > 0)))) uf.union(e.n[0], e.n[1]);
  const refs = new Set([ref]), seen = new Set([uf.find(ref)]);
  for (const n of [...used].sort((x, y) => x - y)) if (!seen.has(uf.find(n))) { seen.add(uf.find(n)); refs.add(n); }
  const idx = new Map();
  for (const n of used) if (!refs.has(n)) idx.set(n, idx.size);
  const branchy = all.filter((e) => e.kind === 'V' || e.kind === 'DV' || (e.kind === 'Z' && e.coil));
  const bi = new Map(branchy.map((e, k) => [e, idx.size + k]));
  const N = idx.size + branchy.length;
  const A = Array.from({ length: N }, () => Array.from({ length: N }, () => [0, 0])), b = Array.from({ length: N }, () => [0, 0]);
  const I = (n) => (idx.has(n) ? idx.get(n) : -1);
  const add = (r, c, z) => { if (r >= 0 && c >= 0) A[r][c] = C.add(A[r][c], z); };
  const addY = (p, q, y) => { add(p, p, y); add(q, q, y); add(p, q, C.neg(y)); add(q, p, C.neg(y)); };
  // the current through x (p → q) as row coefficients: [[col, coef]]; for a control
  const curTerms = (x) => {
    if (bi.has(x)) return [[bi.get(x), [1, 0]]];
    if (x.kind === 'Z') { const y = C.inv(zAt(x, w)); return [[I(x.n[0]), y], [I(x.n[1]), C.neg(y)]]; }
    if (x.kind === 'I') return null; // a known value, handled as a constant
    return null;
  };
  const ctlTerms = (d) => {
    const c = d.ctl;
    if (!c) return { terms: [], k: [0, 0] };
    if (c.type === 'node') return { terms: [[I(c.p), [1, 0]]], k: [0, 0] };
    if (c.type === 'v') return { terms: [[I(c.el.n[0]), [1, 0]], [I(c.el.n[1]), [-1, 0]]], k: [0, 0] };
    if (c.el.kind === 'I') return { terms: [], k: on(c.el) ? c.el.ph : [0, 0] };
    return { terms: curTerms(c.el) || [], k: [0, 0] };
  };
  for (const e of all) {
    const p = I(e.n[0]), q = I(e.n[1]);
    if (e.kind === 'Z' && !e.coil) { const z = zAt(e, w); if (Number.isFinite(z[0]) && Number.isFinite(z[1])) addY(p, q, C.inv(z)); }
    else if (e.kind === 'I') { if (on(e)) { if (p >= 0) b[p] = C.sub(b[p], e.ph); if (q >= 0) b[q] = C.add(b[q], e.ph); } }
    else if (e.kind === 'DI') {
      const { terms, k } = ctlTerms(e), g = [e.gain, 0];
      for (const [col, cf] of terms) { add(p, col, C.mul(g, cf)); add(q, col, C.neg(C.mul(g, cf))); }
      if (!isZero(k)) { if (p >= 0) b[p] = C.sub(b[p], C.mul(g, k)); if (q >= 0) b[q] = C.add(b[q], C.mul(g, k)); }
    }
  }
  for (const e of branchy) {
    const r = bi.get(e), p = I(e.n[0]), q = I(e.n[1]);
    add(p, r, [1, 0]); add(q, r, [-1, 0]); add(r, p, [1, 0]); add(r, q, [-1, 0]);
    if (e.kind === 'V') b[r] = on(e) ? e.ph : [0, 0];
    else if (e.kind === 'Z') add(r, r, C.neg(zAt(e, w)));
    else if (e.kind === 'DV') {
      const { terms, k } = ctlTerms(e), g = [e.gain, 0];
      for (const [col, cf] of terms) add(r, col, C.neg(C.mul(g, cf)));
      if (!isZero(k)) b[r] = C.add(b[r], C.mul(g, k));
    }
  }
  for (const m of muts || []) {
    if (!bi.has(m.a) || !bi.has(m.b)) continue;
    const zm = [0, w * m.M];
    add(bi.get(m.a), bi.get(m.b), C.neg(zm)); add(bi.get(m.b), bi.get(m.a), C.neg(zm));
  }
  const x = N ? csolve(A, b) : [];
  if (!x) return null;
  const v = Array.from({ length: net.nodeCount + 2 }, () => [0, 0]);
  for (const [n, k] of idx) v[n] = x[k];
  const cur = (e) => {
    if (bi.has(e)) return x[bi.get(e)];
    if (e.kind === 'Z') { const z = zAt(e, w); return Number.isFinite(z[0]) && Number.isFinite(z[1]) ? C.div(C.sub(v[e.n[0]], v[e.n[1]]), z) : [0, 0]; }
    if (e.kind === 'I') return on(e) ? e.ph : [0, 0];
    if (e.kind === 'DI') { const { terms, k } = ctlTerms(e); let s = k; for (const [col, cf] of terms) if (col >= 0) s = C.add(s, C.mul(cf, x[col])); return C.scale(s, e.gain); }
    return [0, 0];
  };
  return { v, cur, w };
}

// ------------------------------------------------------------------ setup
/** What the AC theorems can work on: the network, the loads (R, L or C) and the sources. */
export function prepareAC(doc) {
  const net = extractACNetwork(doc);
  const targets = net.elems.filter((e) => e.kind === 'Z' && !e.internal).map((e) => {
    const el = doc.elements[e.src];
    return { ...e, valText: e.C ? `${num(e.C)} F` : e.L ? `${num(e.L)} H` : `${num(e.R)} Ω`, kindText: e.C ? 'capacitor' : e.L ? 'inductor' : 'resistor', el };
  });
  const sources = net.elems.filter((e) => e.kind === 'V' || e.kind === 'I');
  const omegas = [];
  for (const s of sources) if (!omegas.some((w) => Math.abs(w - s.w) <= 1e-9 * Math.max(1, w))) omegas.push(s.w);
  return { ac: true, net, targets, sources, omegas, bad: net.bad, notes: [] };
}

function context(prep, src, want) {
  const { net } = prep;
  const T = net.elems.find((e) => e.src === src && e.kind === 'Z' && !e.internal);
  if (!T) return { error: 'Pick a resistor, an inductor or a capacitor.' };
  if (T.n[0] === T.n[1]) return { error: `${T.name} is shorted: both its ends are on the same node, so no current flows in it.` };
  const reach = new Set([T.n[0]]);
  for (let grew = true; grew;) {
    grew = false;
    for (const e of net.elems) if (reach.has(e.n[0]) !== reach.has(e.n[1])) { reach.add(e.n[0]); reach.add(e.n[1]); grew = true; }
    for (const m of net.muts) for (const [x, y] of [[m.a, m.b], [m.b, m.a]]) if (reach.has(x.n[0]) && !reach.has(y.n[0])) { reach.add(y.n[0]); reach.add(y.n[1]); grew = true; }
  }
  const elems = net.elems.filter((e) => reach.has(e.n[0]));
  const muts = net.muts.filter((m) => elems.includes(m.a) && elems.includes(m.b));
  const a = T.n[0], b = T.n[1];
  const ref = net.hasGround && reach.has(0) ? 0 : b;
  const omegas = [];
  for (const s of elems) if ((s.kind === 'V' || s.kind === 'I') && !omegas.some((w) => Math.abs(w - s.w) <= 1e-9 * Math.max(1, w))) omegas.push(s.w);
  // node names the book's way: 1, 2, 3 … left to right across the drawing; a and b at the load
  const fixed = new Set([ref]);
  for (let grew = true; grew;) {
    grew = false;
    for (const e of elems) if (e.kind === 'V' && fixed.has(e.n[0]) !== fixed.has(e.n[1])) { fixed.add(e.n[0]); fixed.add(e.n[1]); grew = true; }
  }
  // the unknown nodes first (V1, V2 … as the book numbers them), then the ones a source fixes
  const pos = (n) => net.nodePos.get(n) || [0, 0];
  const nodes = [...reach].filter((n) => n !== ref).sort((x, y) => (fixed.has(x) - fixed.has(y)) || Math.round(pos(x)[0] / 40) - Math.round(pos(y)[0] / 40) || pos(x)[1] - pos(y)[1]);
  const num1 = new Map(nodes.map((n, i) => [n, String(i + 1)]));
  const c = {
    prep, net, elems, muts, T, a, b, ref, want, omegas,
    w: omegas.length === 1 ? omegas[0] : null,
    nm: (n) => (n === ref ? '0' : num1.get(n) ?? 'n' + n), // the reference node is 0
    ab: (n) => (n === a ? 'a' : n === b ? 'b' : num1.get(n) ?? 'n' + n),
  };
  // the full answer: one phasor per frequency (the time functions add up)
  c.parts = omegas.map((w) => { const s = solveAC(net, elems, w, { ref, muts }); return s ? { w, I: s.cur(T), V: C.sub(s.v[a], s.v[b]) } : null; });
  if (c.parts.some((p) => !p)) return { error: 'This circuit has no single solution: look for voltage sources joined in a loop (or in parallel), or a current source whose current has no path.' };
  return c;
}

// ------------------------------------------------------------------ figures
/** the user's drawing in the phasor domain at ω, changed: parts hidden, sources off, nodes named */
const boardFig = (c, o = {}) => ({ kind: 'board', phasor: true, omega: o.omega ?? c.w ?? 0, target: c.T.src, a: c.a, b: c.b, ...o });
/** sources off on the drawing: voltage sources shorted, current sources opened */
function offSpec(c, keep) {
  const wire = [], open = [], ground = [];
  for (const e of c.elems) {
    if (e === keep || (Array.isArray(keep) && keep.includes(e))) continue;
    if (e.kind === 'V') (e.rail ? ground : wire).push(e.src);
    else if (e.kind === 'I') open.push(e.src);
  }
  return { wire: [...new Set(wire)], open, ground };
}
const nodeTags = (c, f = c.nm) => [...new Set(c.elems.flatMap((e) => e.n))].filter((n) => n !== c.ref || !c.net.hasGround).map((n) => ({ node: n, text: f(n) }));

/** The equivalent the theorem ends with, drawn: a source with Z in series (or in parallel), and the load. */
function equivalentFig(c, { norton = false, src, z, zName, srcName, w }) {
  return { kind: 'equiv', norton, src, z, zName, srcName, w, load: c.T.src, loadName: c.T.name };
}

// ------------------------------------------------------------------ step pieces
function transformStep(c, title, w = c.w) {
  const lines = [];
  for (const e of c.elems) {
    if ((e.kind === 'V' || e.kind === 'I') && (e.w === w || (c.omegas.length === 1))) lines.push(`${ms(e.name)}:  ${srcTime(e)}  ⇒  ${e.w > 0 ? (e.kind === 'I' ? fI(e.ph) : fV(e.ph)) : `${num(e.ph[0])} ${e.kind === 'I' ? 'A' : 'V'}`}${e.w > 0 ? `,  ω = ${W(e.w)} rad/s` : ''}`);
  }
  for (const e of c.elems) { const t = transformLine(e, w); if (t) lines.push(`${ms(e.name)}:  ${t}`); }
  for (const e of c.elems) if (e.kind === 'Z' && !e.L && !e.C) lines.push(`${ms(e.name)}:  ${num(e.R)} Ω  ⇒  ${num(e.R)} Ω  ${tx('(a resistor is the same in both domains)')}`);
  for (const m of c.muts) lines.push(`${ms(m.name)}:  M = ${num(m.Mabs)} H  ⇒  jωM = ${rect([0, w * m.Mabs])} Ω  ${tx(`(between ${m.a.name} and ${m.b.name}; its sign in each equation by the dots)`)}`);
  const blocks = [
    P(`The sources are sinusoids at ω = ${W(w)} rad/s, so the circuit is solved in the **phasor (frequency) domain**: a source V_m cos(ωt + φ) becomes the phasor V_m∠φ, an inductor jωL, a capacitor 1/(jωC) = −j/(ωC).`),
    F(lines),
  ];
  if (c.muts.length) blocks.push(TIP('Dot convention: a current entering the dotted end of one coil induces a voltage that is positive at the dotted end of the other.'));
  return step(title, blocks, boardFig(c, { omega: w, highlight: [], tags: nodeTags(c) }));
}

/** the answer for the load, phasor and time function, as the last lines of a step */
function answerLines(c, I, V, w) {
  const ZL = zAt(c.T, w);
  const out = [];
  out.push(`I_{L} = ${fI(I)}  ⇒  i_{L}(t) = ${fmtTime(I, w, 'A')}`);
  out.push(`V_{L} = I_{L} Z_{L} = ${fI(I)} × ${par(ZL)} Ω = ${fV(V)}  ⇒  v_{L}(t) = ${fmtTime(V, w, 'V')}`);
  return out;
}

/**
 * Nodal analysis written out (book style): known nodes, KCL at each other node or supernode,
 * the matrix form, Cramer's rule for 2–3 unknowns, the node voltages.
 */
function nodalWork(c, elems, w, { ref = c.ref, only = null, extra = [], nm = c.nm } = {}) {
  const sol = solveAC(c.net, elems, w, { ref, only, extra, muts: c.muts });
  if (!sol) return null;
  const all = [...elems, ...extra];
  const on = (x) => (x.kind === 'V' || x.kind === 'I') && (only ? x === only : true) && Math.abs((x.w || 0) - w) <= 1e-9 * Math.max(1, w);
  const V = (n) => (n === ref ? '0' : `V_{${nm(n)}}`);
  const lines = [];
  // nodes fixed by independent voltage sources from the reference
  const known = new Map([[ref, [0, 0]]]);
  for (let grew = true; grew;) {
    grew = false;
    for (const e of all) {
      if (e.kind !== 'V') continue;
      const [p, q] = e.n, kp = known.has(p), kq = known.has(q);
      if (kp === kq) continue;
      const val = on(e) ? e.ph : [0, 0];
      const to = kp ? q : p, v = kp ? C.sub(known.get(p), val) : C.add(known.get(q), val);
      known.set(to, v);
      lines.push(`${V(to)} = ${fV(v)}  ${tx(`(set by ${e.name}${on(e) ? '' : ', turned off'})`)}`);
      grew = true;
    }
  }
  const used = new Set();
  for (const e of all) { used.add(e.n[0]); used.add(e.n[1]); }
  const unknown = [...used].filter((n) => !known.has(n)).sort((x, y) => (+nm(x) || 99) - (+nm(y) || 99) || x - y);
  if (!unknown.length) return { sol, lines, unknown };
  // supernodes: joined by voltage sources (independent or dependent) between unknown nodes
  const g = new UF();
  for (const n of unknown) g.find(n);
  for (const e of all) if ((e.kind === 'V' || e.kind === 'DV') && !known.has(e.n[0]) && !known.has(e.n[1])) g.union(e.n[0], e.n[1]);
  const groups = new Map();
  for (const n of unknown) { const r = g.find(n); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(n); }
  // a term (V_x − V_y)/Z, with known node voltages written as numbers
  const vTxt = (n) => (known.has(n) ? (isZero(known.get(n)) ? '0' : fmtPhasor(known.get(n))) : V(n));
  const diff = (x, y) => (vTxt(y) === '0' ? vTxt(x) : `${vTxt(x)} − ${vTxt(y)}`);
  const ctlText = (d) => {
    const ct = d.ctl;
    if (!ct) return '0';
    if (ct.type === 'node') return V(ct.p);
    if (ct.type === 'v') return `(${diff(ct.el.n[0], ct.el.n[1])})`;
    if (ct.el.kind === 'Z' && !ct.el.coil) return fr(diff(ct.el.n[0], ct.el.n[1]), rect(zAt(ct.el, w)));
    return `I_{${ct.el.name}}`;
  };
  const symOf = (d) => (d.sym ? d.sym.replace(/^([a-zA-Z])([a-zA-Z0-9]+)$/, '$1_{$2}') : 'x');
  const defs = [];
  for (const G of groups.values()) {
    const inG = new Set(G), terms = [];
    for (const e of all) {
      const i0 = inG.has(e.n[0]), i1 = inG.has(e.n[1]);
      if (i0 === i1) continue;
      const x = i0 ? e.n[0] : e.n[1], y = i0 ? e.n[1] : e.n[0], sgn = i0 ? 1 : -1; // current leaving the group
      if (e.kind === 'Z') {
        if (e.coil && c.muts.some((m) => m.a === e || m.b === e)) { terms.push(`${sgn < 0 ? '−' : ''}I_{${e.name}}`); continue; }
        const z = zAt(e, w);
        if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) continue; // an open (a capacitor at DC)
        terms.push(fr(diff(x, y), rect(z)));
      } else if (e.kind === 'I') { if (on(e)) terms.push(`${sgn > 0 ? '' : '−'}${fmtPhasor(e.ph)}`); }
      else if (e.kind === 'DI') {
        terms.push(`${sgn > 0 ? '' : '−'}${num(e.gain)}${symOf(e)}`);
        defs.push(`${symOf(e)} = ${ctlText(e)}`);
      } else if (e.kind === 'V' || e.kind === 'DV') terms.push(`${sgn > 0 ? '' : '−'}I_{${e.name}}`);
    }
    const eq = (terms.join(' + ') || '0').replace(/\+ −/g, '− ');
    lines.push(`${tx(G.length === 1 ? `KCL at node ${nm(G[0])}:` : `Supernode (${G.map(nm).join(', ')}):`)}  ${eq} = 0`);
    for (const e of all) if ((e.kind === 'V' || e.kind === 'DV') && inG.has(e.n[0]) && inG.has(e.n[1])) lines.push(`${tx('and')}  ${V(e.n[0])} − ${V(e.n[1])} = ${e.kind === 'V' ? fV(on(e) ? e.ph : [0, 0]) : `${num(e.gain)}${symOf(e)}`}`);
  }
  for (const d of [...new Set(defs)]) lines.push(`${tx('where')}  ${d}`);
  // coupled coils: each coil's current is an unknown, its voltage is jωL·I plus the mutual term
  const coupled = [...new Set(c.muts.filter((m) => all.includes(m.a) && all.includes(m.b)).flatMap((m) => [m.a, m.b]))];
  if (coupled.length) {
    lines.push(tx('Each coupled coil has its current as an unknown, its voltage from the dot convention:'));
    for (const e of coupled) {
      const terms = [`${rect([0, w * e.L])}I_{${e.name}}`];
      for (const m of c.muts) {
        const other = m.a === e ? m.b : m.b === e ? m.a : null;
        if (other && all.includes(other)) terms.push(`${m.M < 0 ? '−' : '+'} j${num(Math.abs(w * m.M))}I_{${other.name}}`);
      }
      lines.push(`${diff(e.n[0], e.n[1])} = ${terms.join(' ').replace(/^(\S+)/, '$1')}${e.R ? ` + ${num(e.R)}I_{${e.name}}` : ''}`);
    }
  }
  return { sol, lines, unknown, known, V, coupled };
}

/** The node equations collected as [Y][V] = [I] over the unknown nodes, solved; book's matrix form. */
function nodalMatrix(c, work, elems, w, { only = null, extra = [] } = {}) {
  const { unknown, sol, V } = work;
  if (!unknown || !unknown.length || unknown.length > 4) return [];
  // the system as the solver sees it, reduced to node voltages: column k = response to V_k
  // (numerically: A from the KCL rows of the unknown nodes with the known ones moved right)
  const n = unknown.length;
  // build by probing: equations are linear, so evaluate each KCL row with unit node voltages
  const all = [...elems, ...extra], idx = new Map(unknown.map((u, k) => [u, k]));
  const hasBranch = all.some((e) => e.kind === 'DV' || (e.kind === 'V' && !(work.known.has(e.n[0]) || work.known.has(e.n[1]))) || (e.kind === 'Z' && e.coil && c.muts.some((m) => m.a === e || m.b === e)));
  if (hasBranch) {
    const coils = (work.coupled || []).map((e) => `I_{${e.name}} = ${fI(sol.cur(e))}`);
    return [F(`${tx('Solving these together:')}  ${[...unknown.map((u) => `${V(u)} = ${fV(sol.v[u])}`), ...coils].join(',   ')}`)];
  }
  const on = (x) => (x.kind === 'V' || x.kind === 'I') && (only ? x === only : true) && Math.abs((x.w || 0) - w) <= 1e-9 * Math.max(1, w);
  const A = Array.from({ length: n }, () => Array.from({ length: n }, () => [0, 0])), b = Array.from({ length: n }, () => [0, 0]);
  const kv = (m) => (work.known.has(m) ? work.known.get(m) : null);
  for (const [u, r] of idx) {
    for (const e of all) {
      const i0 = e.n[0] === u, i1 = e.n[1] === u;
      if (i0 === i1) continue;
      const y = i0 ? e.n[1] : e.n[0], sg = i0 ? 1 : -1;
      if (e.kind === 'Z') {
        const z = zAt(e, w);
        if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) continue;
        const Y = C.inv(z);
        A[r][r] = C.add(A[r][r], Y);
        if (idx.has(y)) A[r][idx.get(y)] = C.sub(A[r][idx.get(y)], Y); else b[r] = C.add(b[r], C.mul(Y, kv(y) || [0, 0]));
      } else if (e.kind === 'I') { if (on(e)) b[r] = C.sub(b[r], C.scale(e.ph, sg)); }
      else if (e.kind === 'DI') {
        // gain × control, the control written in node voltages
        const ct = e.ctl; if (!ct) continue;
        const g = e.gain * sg;
        const addV = (nn, cf) => { if (idx.has(nn)) A[r][idx.get(nn)] = C.add(A[r][idx.get(nn)], C.scale(cf, g)); else b[r] = C.sub(b[r], C.scale(C.mul(cf, kv(nn) || [0, 0]), g)); };
        if (ct.type === 'node') addV(ct.p, [1, 0]);
        else if (ct.type === 'v') { addV(ct.el.n[0], [1, 0]); addV(ct.el.n[1], [-1, 0]); }
        else if (ct.el.kind === 'Z' && !ct.el.coil) { const Y = C.inv(zAt(ct.el, w)); addV(ct.el.n[0], Y); addV(ct.el.n[1], C.neg(Y)); }
        else return [F(`${tx('Solving these together:')}  ${unknown.map((u2) => `${V(u2)} = ${fV(sol.v[u2])}`).join(',   ')}`)];
      }
    }
  }
  const out = [P('In matrix form, [Y][V] = [I]:'), MX(A, unknown.map(V), b)];
  if (n <= 3) {
    const D = cdet(A);
    if (C.abs(D) > 1e-15) {
      const lines = [`Δ = ${rect(D)}`];
      unknown.forEach((u, k) => {
        const Ak = A.map((row, i) => row.map((z, j) => (j === k ? b[i] : z)));
        const Dk = cdet(Ak);
        lines.push(`Δ_{${k + 1}} = ${rect(Dk)}    ⇒    ${V(u)} = ${fr(`Δ_{${k + 1}}`, 'Δ')} = ${fr(rect(Dk), rect(D))} = ${fV(C.div(Dk, D))}`);
      });
      out.push(F(lines));
      return out;
    }
  }
  out.push(F(`${tx('Solving:')}  ${unknown.map((u) => `${V(u)} = ${fV(sol.v[u])}`).join(',   ')}`));
  return out;
}

/** Mesh analysis written out: mesh currents I_1 … clockwise, KVL round each (with ±jωM terms), matrix, Cramer. */
function meshWork(c, elems, w, { only = null } = {}) {
  const geo = { el: (e) => { const ps = c.net.posts[e.src]; return ps && ps.length >= 2 && !e.internal ? [ps[0], ps[1]] : null; } };
  const br = elems.filter((e) => e.n[0] !== e.n[1] && !(e.kind === 'Z' && e.C && !(w > 0)));
  const { meshes, co } = findMeshes(br, geo);
  const m = meshes.length;
  if (!m) return { error: 'This circuit has no closed loop, so it has no mesh currents.' };
  if (m > 4) return { error: `This circuit has ${m} meshes; mesh analysis is written out for up to 4. Use nodal analysis.` };
  const on = (x) => (x.kind === 'V' || x.kind === 'I') && (only ? x === only : true) && Math.abs((x.w || 0) - w) <= 1e-9 * Math.max(1, w);
  for (const e of br) if ((e.kind === 'I' || e.kind === 'DI') && co(e).size > 2) return { error: `${e.name} is a current source shared by more than two meshes: use nodal analysis for this circuit.` };
  for (const e of br) if ((e.kind === 'DI' || e.kind === 'DV') && e.ctl && e.ctl.type === 'node') return { error: `${e.name} is controlled by a node voltage: use nodal analysis for this circuit.` };
  const Ik = (k) => `I_{${k + 1}}`;
  // an element's current as mesh-current coefficients
  const curCo = (e) => { const out = Array.from({ length: m }, () => 0); for (const [k, o] of co(e)) out[k] += o; return out; };
  const A = Array.from({ length: m }, () => Array.from({ length: m }, () => [0, 0])), b = Array.from({ length: m }, () => [0, 0]);
  const termsTxt = Array.from({ length: m }, () => Array.from({ length: m }, () => []));
  const fixed = new Map(); // mesh → its current set by a current source on its outer branch
  const shared = []; // current sources between two meshes
  const muts = c.muts.filter((mm) => br.includes(mm.a) && br.includes(mm.b));
  meshes.forEach((mesh, j) => {
    for (const { e, o } of mesh.edges) {
      if (e.kind === 'Z') {
        const z = zAt(e, w), cc = curCo(e);
        cc.forEach((k, kk) => { if (k) { A[j][kk] = C.add(A[j][kk], C.scale(z, o * k)); termsTxt[j][kk].push(`${o * k < 0 ? '−' : ''}${par(z)}`); } });
        for (const mm of muts) {
          const other = mm.a === e ? mm.b : mm.b === e ? mm.a : null;
          if (!other) continue;
          const zm = [0, w * mm.M], c2 = curCo(other);
          c2.forEach((k, kk) => { if (k) { A[j][kk] = C.add(A[j][kk], C.scale(zm, o * k)); termsTxt[j][kk].push(`${o * k * Math.sign(mm.M) < 0 ? '−' : ''}j${num(Math.abs(w * mm.M))}${tx('(M)')}`); } });
        }
      } else if (e.kind === 'V') { if (on(e)) b[j] = C.sub(b[j], C.scale(e.ph, o)); }
      else if (e.kind === 'DV') {
        const ct = e.ctl; if (!ct) continue;
        let cf = Array.from({ length: m }, () => [0, 0]);
        if (ct.type === 'i') cf = curCo(ct.el).map((k) => [k, 0]);
        else if (ct.type === 'v') { const z = zAt(ct.el, w); cf = curCo(ct.el).map((k) => C.scale(z, k)); }
        cf.forEach((z, kk) => { if (!isZero(z)) { A[j][kk] = C.add(A[j][kk], C.scale(z, -o * e.gain)); termsTxt[j][kk].push(`${-o * e.gain < 0 ? '−' : ''}${num(Math.abs(e.gain))}${tx(`(${e.name})`)}`); } });
      } else if (e.kind === 'I' || e.kind === 'DI') {
        if (co(e).size > 1) { if (!shared.includes(e)) shared.push(e); } // between two meshes: a supermesh
        else fixed.set(j, e.kind === 'I' ? { e, val: on(e) ? C.scale(e.ph, curCo(e)[j] || 1) : [0, 0] } : { e, dep: true });
      }
    }
  });
  // a current source shared by two meshes: the two meshes become a supermesh — KVL round the outside
  // of both (the source's own voltage unknown, so left out), and the source fixes the difference of
  // the two mesh currents
  const superOf = new Map(), consOf = new Map();
  for (const e of shared) {
    const [j, k] = [...co(e).keys()].sort((x, y) => x - y);
    if (fixed.has(j) || fixed.has(k) || superOf.has(j) || consOf.has(j) || superOf.has(k) || consOf.has(k)) return { error: `${e.name} shares two meshes that also meet another current source: use nodal analysis for this circuit.` };
    for (let q = 0; q < m; q++) A[j][q] = C.add(A[j][q], A[k][q]);
    b[j] = C.add(b[j], b[k]);
    for (let q = 0; q < m; q++) A[k][q] = [0, 0];
    b[k] = [0, 0];
    const ct = e.ctl;
    for (const [mm, o] of co(e)) A[k][mm] = C.add(A[k][mm], [o, 0]);
    if (e.kind === 'I') b[k] = on(e) ? e.ph : [0, 0];
    else if (ct && (ct.type === 'i' || ct.type === 'v')) {
      const cf = ct.type === 'i' ? curCo(ct.el).map((x) => [x, 0]) : curCo(ct.el).map((x) => C.scale(zAt(ct.el, w), x));
      cf.forEach((z, q) => { A[k][q] = C.sub(A[k][q], C.scale(z, e.gain)); });
    }
    superOf.set(j, { k, e }); consOf.set(k, { j, e });
  }
  const lines = [];
  for (let j = 0; j < m; j++) {
    if (superOf.has(j)) {
      const { k, e } = superOf.get(j);
      const simp = A[j].map((z, q) => (isZero(z) ? null : `${par(z)}${Ik(q)}`)).filter(Boolean).join(' + ').replace(/\+ −/g, '− ');
      lines.push(`${tx(`Supermesh (meshes ${j + 1} and ${k + 1}, with ${e.name} between them):`)}  ${tx('KVL round the outside of both')}`, `   ${simp} = ${rect(b[j])}`);
      continue;
    }
    if (consOf.has(j)) {
      const { e } = consOf.get(j);
      const lhs = [...co(e)].map(([mm, o]) => `${o < 0 ? '−' : '+'} ${Ik(mm)}`).join(' ').replace(/^\+ /, '');
      const rhs = e.kind === 'I' ? rect(b[j]) : `${num(e.gain)}${e.sym || 'x'}`;
      lines.push(`${tx(`Constraint (${e.name} fixes the difference of the two mesh currents):`)}  ${lhs} = ${rhs}`);
      continue;
    }
    if (fixed.has(j)) {
      const f = fixed.get(j);
      A[j] = Array.from({ length: m }, () => [0, 0]); A[j][j] = [1, 0];
      if (f.dep) {
        const e = f.e, ct = e.ctl, k = curCo(e)[j] || 1;
        let cf = Array.from({ length: m }, () => [0, 0]);
        if (ct && ct.type === 'i') cf = curCo(ct.el).map((x) => [x, 0]);
        else if (ct && ct.type === 'v') { const z = zAt(ct.el, w); cf = curCo(ct.el).map((x) => C.scale(z, x)); }
        cf.forEach((z, kk) => { A[j][kk] = C.sub(A[j][kk], C.scale(z, e.gain * k)); });
        b[j] = [0, 0];
        lines.push(`${tx(`Mesh ${j + 1}:`)}  ${Ik(j)} = ${k < 0 ? '−' : ''}${num(e.gain)}${e.sym || 'x'}  ${tx(`(${e.name} is on its outer branch)`)}`);
      } else {
        b[j] = f.val;
        lines.push(`${tx(`Mesh ${j + 1}:`)}  ${Ik(j)} = ${fI(f.val)}  ${tx(`(${f.e.name} is on its outer branch)`)}`);
      }
      continue;
    }
    const lhs = [];
    for (let k = 0; k < m; k++) {
      const t = termsTxt[j][k];
      if (!t.length) continue;
      const z = A[j][k];
      if (isZero(z)) continue;
      const sumTxt = t.join(' + ').replace(/\+ −/g, '− ');
      lhs.push(`${t.length > 1 ? `(${sumTxt})` : sumTxt}${Ik(k)}`);
    }
    lines.push(`${tx(`KVL round mesh ${j + 1}:`)}  ${lhs.join(' + ').replace(/\+ −/g, '− ').replace(/\+ \(−/g, '+ (−') || '0'} = ${rect(b[j])}`);
    const simp = A[j].map((z, k) => (isZero(z) ? null : `${par(z)}${Ik(k)}`)).filter(Boolean).join(' + ').replace(/\+ −/g, '− ');
    lines.push(`   ${tx('or')}  ${simp} = ${rect(b[j])}`);
  }
  const x = csolve(A, b);
  if (!x) return { error: 'The mesh equations have no single solution.' };
  const blocks = [F(lines), P('In matrix form, [Z][I] = [V]:'), MX(A, meshes.map((_, k) => Ik(k)), b)];
  if (m <= 3) {
    const D = cdet(A);
    if (C.abs(D) > 1e-15) {
      const L = [`Δ = ${rect(D)}`];
      for (let k = 0; k < m; k++) {
        const Dk = cdet(A.map((row, i) => row.map((z, jj) => (jj === k ? b[i] : z))));
        L.push(`Δ_{${k + 1}} = ${rect(Dk)}    ⇒    ${Ik(k)} = ${fr(rect(Dk), rect(D))} = ${fI(C.div(Dk, D))}`);
      }
      blocks.push(F(L));
    }
  } else blocks.push(F(`${tx('Solving:')}  ${x.map((z, k) => `${Ik(k)} = ${fI(z)}`).join(',   ')}`));
  const curOf = (e) => curCo(e).reduce((s, k, kk) => C.add(s, C.scale(x[kk], k)), [0, 0]);
  const marks = meshes.map((mm, k) => ({ at: mm.at, box: mm.box, text: `I${k + 1}` }));
  return { blocks, x, curOf, co, marks, meshes, Ik };
}

// ------------------------------------------------------------------ equivalent impedance
/** Z seen from a–b with the independent sources off: series–parallel steps when it is one, else a test source. */
function zthWork(c, w) {
  const hasDep = c.elems.some((e) => e.kind === 'DI' || e.kind === 'DV');
  const rest = c.elems.filter((e) => e !== c.T);
  // sources off: a voltage source joins its ends, a current source is removed
  const uf = new UF();
  for (const e of rest) if (e.kind === 'V') uf.unionMin(e.n[0], e.n[1]);
  const mm = (n) => uf.find(n);
  const zs = rest.filter((e) => e.kind === 'Z').map((e) => ({ ...e, n: [mm(e.n[0]), mm(e.n[1])], orig: e }));
  const A = mm(c.a), B = mm(c.b);
  const lines = [];
  if (!hasDep && !c.muts.length && A !== B) {
    const { tree } = spTree(zs, A, B);
    if (tree) {
      const red = (t) => {
        if (t.k === 'L') { const z = zAt(t.e, w); return { z, s: Number.isFinite(z[0]) && Number.isFinite(z[1]) ? par(z) : '∞' }; }
        const kids = t.kids.map(red);
        if (t.k === 'S') {
          const z = kids.reduce((s, k) => C.add(s, k.z), [0, 0]);
          return { z, s: kids.map((k) => k.s).join(' + ') };
        }
        const fin = kids.filter((k) => Number.isFinite(k.z[0]) && Number.isFinite(k.z[1]));
        if (fin.some((k) => isZero(k.z))) return { z: [0, 0], s: '0' };
        const y = fin.reduce((s, k) => C.add(s, C.inv(k.z)), [0, 0]);
        const z = isZero(y) ? [Infinity, 0] : C.inv(y);
        return { z, s: `(${fin.map((k) => k.s).join(' ∥ ')})` };
      };
      const r = red(tree);
      lines.push(`Z_{th} = ${unwrap(r.s)}`);
      const collect = (t) => (t.k === 'L' ? [] : [...t.kids.flatMap(collect), ...(t.k === 'P' ? [t] : [])]);
      for (const p of collect(tree)) {
        const kids = p.kids.map(red).filter((k) => Number.isFinite(k.z[0]));
        if (kids.length === 2) lines.push(`   ${par(kids[0].z)} ∥ ${par(kids[1].z)} = ${fr(`${par(kids[0].z)} × ${par(kids[1].z)}`, rect(C.add(kids[0].z, kids[1].z)))} = ${rect(C.div(C.mul(kids[0].z, kids[1].z), C.add(kids[0].z, kids[1].z)))} Ω`);
      }
      lines.push(`Z_{th} = ${fZ(r.z)}`);
      return { z: r.z, lines, how: 'sp' };
    }
  }
  // a test source: 1∠0° A into a, out of b; Z_th = V_ab / 1 A
  const test = { kind: 'I', n: [c.b, c.a], ph: [1, 0], w, name: 'I_test', id: -1, src: -1 };
  const offEls = rest.map((e) => e);
  const sol = solveAC(c.net, offEls, w, { ref: c.ref, only: test, extra: [test], muts: c.muts });
  if (!sol) return { error: 'The impedance seen from a–b cannot be found (the load is in a part with no other path).' };
  const z = C.sub(sol.v[c.a], sol.v[c.b]);
  lines.push(`${tx(hasDep ? 'With a dependent source, Z_th is found with a test source:' : 'Not a series–parallel combination, so Z_th is found with a test source:')}  ${tx('apply')} 1∠0° A ${tx('into a, turn the independent sources off, and')} Z_{th} = ${fr('V_{ab}', '1∠0° A')}`);
  lines.push(`V_{ab} = ${fV(z)}  ⇒  Z_{th} = ${fZ(z)}`);
  return { z, lines, how: 'test' };
}

// ------------------------------------------------------------------ the theorems
const head = (c, I, V, w, extra = '') => {
  const main = c.want === 'V' ? `V_L = ${fV(V)}` : `I_L = ${fI(I)}`;
  const sub = `${c.want === 'V' ? `v_L(t) = ${fmtTime(V, w, 'V')}` : `i_L(t) = ${fmtTime(I, w, 'A')}`}${extra}`;
  return { main, sub };
};
const single = (c) => (c.omegas.length > 1 ? { error: `The sources run at different frequencies (ω = ${c.omegas.map(W).join(', ')} rad/s): each needs its own phasor domain. Use the superposition theorem, which takes one frequency at a time.` } : null);
const done = (c, theorem, steps, I, V, w, extra = {}) => ({ ok: true, ac: true, theorem, target: c.T.name, steps, answer: { I, V, w }, head: head(c, I, V, w), ...extra });

function nodalMethod(c) {
  const bad = single(c); if (bad) return { ok: false, error: bad.error };
  const w = c.w, steps = [transformStep(c, 'Step 1 — Transform to the phasor domain', w)];
  const work = nodalWork(c, c.elems, w);
  if (!work) return { ok: false, error: 'This circuit has no single solution.' };
  steps.push(step('Step 2 — KCL at the nodes', [P(`Take node ${c.net.hasGround ? '0 (ground)' : c.nm(c.ref)} as the reference and write KCL — the currents leaving each node add up to zero:`), F(work.lines)], boardFig(c, { tags: nodeTags(c) })));
  steps.push(step('Step 3 — Solve for the node voltages', nodalMatrix(c, work, c.elems, w)));
  const Vab = C.sub(work.sol.v[c.a], work.sol.v[c.b]), I = C.div(Vab, zAt(c.T, w));
  steps.push(step(`Step 4 — The current and voltage of ${c.T.name}`, [
    F(`I_{L} = ${fr(c.b === c.ref ? `V_{${c.nm(c.a)}}` : c.a === c.ref ? `−V_{${c.nm(c.b)}}` : `V_{${c.nm(c.a)}} − V_{${c.nm(c.b)}}`, 'Z_{L}')} = ${fr(fV(Vab), rect(zAt(c.T, w)))}`, ...answerLines(c, I, Vab, w)),
    P('Transformed back to the time domain: a phasor I_m∠φ is the sinusoid I_m cos(ωt + φ).'),
  ], boardFig(c, { highlight: [c.T.src], arrow: true }), [['I_L', fI(I)], ['V_L', fV(Vab)]]));
  return done(c, 'nodal', steps, I, Vab, w);
}

function meshMethod(c) {
  const bad = single(c); if (bad) return { ok: false, error: bad.error };
  const w = c.w, steps = [transformStep(c, 'Step 1 — Transform to the phasor domain', w)];
  const mw = meshWork(c, c.elems, w);
  if (mw.error) return { ok: false, error: mw.error };
  steps.push(step('Step 2 — KVL round each mesh', [P(`One current round each mesh, clockwise: ${mw.meshes.map((_, k) => `I_${k + 1}`).join(', ')}.${c.muts.length ? ' A coupled coil adds the mutual voltage ±jωM × (the other coil’s current) to its mesh, its sign by the dot convention.' : ''}`), ...mw.blocks],
    boardFig(c, { mode: 'mesh', meshes: mw.marks })));
  const I = mw.curOf(c.T), V = C.mul(I, zAt(c.T, w));
  const cc = [...mw.co(c.T)].map(([k, o]) => `${o < 0 ? '− ' : '+ '}${mw.Ik(k)}`).join(' ').replace(/^\+ /, '');
  steps.push(step(`Step 3 — The current and voltage of ${c.T.name}`, [
    F(`I_{L} = ${cc} = ${fI(I)}`, ...answerLines(c, I, V, w)),
    P('Transformed back to the time domain: a phasor I_m∠φ is the sinusoid I_m cos(ωt + φ).'),
  ], boardFig(c, { highlight: [c.T.src], arrow: true, mode: 'mesh', meshes: mw.marks }), [['I_L', fI(I)], ['V_L', fV(V)]]));
  return done(c, 'mesh', steps, I, V, w);
}

/** V_th: the open-circuit voltage at a–b (the load removed), solved by nodal analysis */
function vthWork(c, w) {
  const rest = c.elems.filter((e) => e !== c.T);
  const tag = (n) => c.ab(n);
  const work = nodalWork(c, rest, w, { nm: tag });
  if (!work) return null;
  const v = C.sub(work.sol.v[c.a], work.sol.v[c.b]);
  return { v, lines: [...work.lines, `V_{th} = V_{a} − V_{b} = ${fV(work.sol.v[c.a])} − ${par(work.sol.v[c.b]) === '0' ? '0' : `(${fV(work.sol.v[c.b])})`} = ${fV(v)}`], work };
}

function thevenin(c, maxPower = false) {
  const bad = single(c); if (bad) return { ok: false, error: bad.error };
  const w = c.w, steps = [transformStep(c, 'Step 1 — Transform to the phasor domain', w)];
  const zt = zthWork(c, w);
  if (zt.error) return { ok: false, error: zt.error };
  const off = offSpec(c);
  steps.push(step('Step 2 — Find Z_th', [P(`Remove ${c.T.name} (the load, between a and b) and turn the independent sources off — a voltage source becomes a short, a current source an open. Z_th is the impedance seen from a–b:`), F(zt.lines)],
    boardFig(c, { ...off, hide: [c.T.src], ab: true, show: 'Rth' }), [['Z_th', fZ(zt.z)]]));
  const vt = vthWork(c, w);
  if (!vt) return { ok: false, error: 'The open-circuit voltage cannot be found.' };
  steps.push(step('Step 3 — Find V_th', [P(`Put the sources back, leave a–b open (no load) and find the voltage across it:`), F(vt.lines)],
    boardFig(c, { hide: [c.T.src], ab: true, show: 'Vth', tags: nodeTags(c, c.ab) }), [['V_th', fV(vt.v)]]));
  const ZL = zAt(c.T, w), Zsum = C.add(zt.z, ZL);
  const I = C.div(vt.v, Zsum), V = C.mul(I, ZL);
  if (maxPower) {
    const Rth = zt.z[0];
    const ZLbest = C.conj(zt.z), Pmax = Rth > 0 ? (C.abs(vt.v) ** 2) / (8 * Rth) : Infinity, Pnow = 0.5 * C.abs(I) ** 2 * ZL[0];
    steps.push(step('Step 4 — Maximum average power', [
      P('The load takes the most average power when its impedance is the **complex conjugate** of Z_th (R_L = R_th, X_L = −X_th):'),
      F(`Z_{L} = Z_{th}^{*} = ${fZ(ZLbest)}`, `P_{max} = ${fr('|V_{th}|^{2}', '8 R_{th}')} = ${fr(`${num(C.abs(vt.v))}^{2}`, `8 × ${num(Rth)}`)} = ${num(Pmax)} W  ${tx('(peak phasors)')}`,
        `${tx(`With the present ${c.T.name}`)} (Z_{L} = ${fZ(ZL)}):  I_{L} = ${fr('V_{th}', 'Z_{th} + Z_{L}')} = ${fI(I)},  P = ½|I_{L}|^{2}R_{L} = ${num(Pnow)} W`),
      TIP(Pmax > 0 && Number.isFinite(Pmax) ? `The present load takes ${(100 * Pnow / Pmax).toFixed(Pnow / Pmax > 0.995 ? 1 : 0)} % of P_max.` : 'R_th is 0: the power has no maximum.'),
    ], { kind: 'equiv', src: vt.v, z: zt.z, srcName: 'Vth', zName: 'Zth', w, load: c.T.src, loadName: c.T.name }, [['Z_L', fZ(ZLbest)], ['P_max', `${num(Pmax)} W`]]));
    const res = done(c, 'maxpower', steps, I, V, w);
    res.head = { main: `Z_L = Z_th* = ${fZ(ZLbest)}`, sub: `P_max = ${num(Pmax)} W · now P = ${num(Pnow)} W` };
    return res;
  }
  steps.push(step('Step 4 — The Thevenin equivalent with the load', [
    P(`The circuit seen by ${c.T.name} is V_th in series with Z_th:`),
    F(`I_{L} = ${fr('V_{th}', 'Z_{th} + Z_{L}')} = ${fr(fV(vt.v), `${par(zt.z)} + ${par(ZL)}`)} = ${fr(fV(vt.v), fZ(Zsum))}`, ...answerLines(c, I, V, w)),
  ], { kind: 'equiv', src: vt.v, z: zt.z, srcName: 'Vth', zName: 'Zth', w, load: c.T.src, loadName: c.T.name }, [['I_L', fI(I)], ['V_L', fV(V)]]));
  return done(c, 'thevenin', steps, I, V, w);
}

function norton(c) {
  const bad = single(c); if (bad) return { ok: false, error: bad.error };
  const w = c.w, steps = [transformStep(c, 'Step 1 — Transform to the phasor domain', w)];
  const zt = zthWork(c, w);
  if (zt.error) return { ok: false, error: zt.error };
  steps.push(step('Step 2 — Find Z_N (= Z_th)', [P(`Remove ${c.T.name} and turn the independent sources off; Z_N is the impedance seen from a–b:`), F(zt.lines.map((l) => l.replace(/Z_\{th\}/g, 'Z_{N}')))],
    boardFig(c, { ...offSpec(c), hide: [c.T.src], ab: true, show: 'RN' }), [['Z_N', fZ(zt.z)]]));
  const rest = c.elems.filter((e) => e !== c.T);
  const sh = { kind: 'V', n: [c.a, c.b], ph: [0, 0], w, name: 'short', id: -2, src: -1 };
  const sol = solveAC(c.net, rest, w, { ref: c.ref, extra: [sh], muts: c.muts });
  if (!sol) return { ok: false, error: 'The short-circuit current cannot be found.' };
  const IN = sol.cur(sh);
  steps.push(step('Step 3 — Find I_N', [P('Short a–b (the load replaced by a wire) with the sources on; I_N is the current in the short, from a to b:'), F(`I_{N} = ${fI(IN)}`)],
    boardFig(c, { hide: [c.T.src], ab: true, shortAB: true, show: 'IN' }), [['I_N', fI(IN)]]));
  const ZL = zAt(c.T, w), I = C.div(C.mul(IN, zt.z), C.add(zt.z, ZL)), V = C.mul(I, ZL);
  steps.push(step('Step 4 — The Norton equivalent with the load', [
    P(`I_N with Z_N in parallel feeds ${c.T.name}; the current divides:`),
    F(`I_{L} = ${fr('Z_{N}', 'Z_{N} + Z_{L}')} I_{N} = ${fr(par(zt.z), `${par(zt.z)} + ${par(ZL)}`)} × ${fI(IN)}`, ...answerLines(c, I, V, w)),
  ], { kind: 'equiv', norton: true, src: IN, z: zt.z, srcName: 'IN', zName: 'ZN', w, load: c.T.src, loadName: c.T.name }, [['I_L', fI(I)], ['V_L', fV(V)]]));
  return done(c, 'norton', steps, I, V, w);
}

function superposition(c) {
  const srcs = c.elems.filter((e) => e.kind === 'V' || e.kind === 'I');
  if (srcs.length < 2) return { ok: false, error: 'Superposition needs two or more independent sources: this circuit has one. Pick another method.' };
  const steps = [];
  const multi = c.omegas.length > 1;
  steps.push(step('Step 1 — One source at a time', [
    P(`The circuit has ${srcs.length} independent sources${multi ? ` running at **different frequencies** (ω = ${c.omegas.map(W).join(', ')} rad/s). Each frequency has its own phasor domain — the inductors and capacitors have other impedances at each — so the responses are added **in the time domain**, never as phasors.` : '. Find the response to each with the others turned off (a voltage source a short, a current source an open), then add the phasors.'}`),
    TIP('Dependent sources stay on in every step.'),
  ], boardFig(c, { tags: [] })));
  const parts = [];
  srcs.forEach((s, k) => {
    const w = s.w;
    const sol = solveAC(c.net, c.elems, w, { ref: c.ref, only: s, muts: c.muts });
    if (!sol) return;
    const I = sol.cur(c.T), V = C.mul(I, zAt(c.T, w));
    parts.push({ s, w, I, V });
    const lines = [];
    for (const e of c.elems) { const t = transformLine(e, w); if (t) lines.push(`${ms(e.name)}:  ${t}`); }
    for (const mm of c.muts) lines.push(`${ms(mm.name)}:  jωM = ${rect([0, w * mm.Mabs])} Ω`);
    const work = nodalWork(c, c.elems, w, { only: s });
    steps.push(step(`Step ${k + 2} — ${s.name} alone${w > 0 ? ` (ω = ${W(w)} rad/s)` : ' (DC: ω = 0)'}`, [
      P(`${s.name} = ${srcTime(s)}${w > 0 ? ` ⇒ ${s.kind === 'I' ? fI(s.ph) : fV(s.ph)}` : ''}; the other independent sources are off.${w > 0 ? ` At ω = ${W(w)} rad/s:` : ' At DC an inductor is a short and a capacitor an open:'}`),
      ...(lines.length ? [F(lines)] : []),
      ...(work && !c.muts.length ? [F(work.lines)] : []),
      F(`I_{L}' = ${fI(I)}  ⇒  ${w > 0 ? fmtTime(I, w, 'A') : `${num(I[0])} A`}`),
    ], boardFig(c, { omega: w, ...offSpec(c, s), highlight: [s.src, c.T.src], tags: [] }), [[`I_L (${s.name})`, w > 0 ? fI(I) : `${num(I[0])} A`]]));
  });
  if (parts.length !== srcs.length) return { ok: false, error: 'A part of the circuit has no single solution.' };
  const sameW = !multi;
  let I, V, sumLine;
  if (sameW) {
    I = parts.reduce((s, p) => C.add(s, p.I), [0, 0]); V = C.mul(I, zAt(c.T, c.w));
    sumLine = [`I_{L} = ${parts.map((p) => par(p.I)).join(' + ')} = ${fI(I)}`, ...answerLines(c, I, V, c.w)];
  } else {
    const t = parts.map((p) => (p.w > 0 ? fmtTime(p.I, p.w) : num(p.I[0]))).join(' + ').replace(/\+ −/g, '− ');
    sumLine = [`i_{L}(t) = ${t} A`, tx('(each term at its own frequency: they cannot be added as phasors)')];
    I = parts[0].I; V = C.mul(I, zAt(c.T, parts[0].w));
  }
  steps.push(step(`Step ${srcs.length + 2} — Add the responses`, [F(sumLine)], boardFig(c, { highlight: [c.T.src], arrow: true, omega: c.omegas[0] })));
  const res = done(c, 'superposition', steps, I, V, c.w ?? c.omegas[0]);
  if (!sameW) {
    const t = parts.map((p) => (p.w > 0 ? fmtTime(p.I, p.w) : num(p.I[0]))).join(' + ').replace(/\+ −/g, '− ');
    const tv = parts.map((p) => (p.w > 0 ? fmtTime(p.V, p.w) : num(p.V[0]))).join(' + ').replace(/\+ −/g, '− ');
    res.head = c.want === 'V' ? { main: `v_L(t) = ${tv} V`, sub: 'the sum of the responses at each frequency' } : { main: `i_L(t) = ${t} A`, sub: 'the sum of the responses at each frequency' };
  }
  return res;
}

export const AC_THEOREMS = [
  { id: 'thevenin', title: 'Thevenin’s theorem (phasors)', short: 'Thevenin', desc: 'Replace the circuit seen by the load with V_th (a phasor) in series with Z_th.' },
  { id: 'norton', title: 'Norton’s theorem (phasors)', short: 'Norton', desc: 'Replace it with I_N in parallel with Z_N = Z_th.' },
  { id: 'superposition', title: 'Superposition theorem', short: 'Superposition', desc: 'One source at a time; sources at different frequencies add in the time domain.' },
  { id: 'maxpower', title: 'Maximum average power transfer', short: 'Maximum power transfer', desc: 'Most power when Z_L = Z_th* (the conjugate): P_max = |V_th|² / (8·R_th).' },
  { id: 'nodal', method: true, title: 'Nodal analysis (phasors)', short: 'Nodal analysis', desc: 'KCL at every node with phasor voltages and impedances, then Cramer’s rule.' },
  { id: 'mesh', method: true, title: 'Mesh analysis (phasors)', short: 'Mesh analysis', desc: 'KVL round every mesh with impedances (and ±jωM for coupled coils), then Cramer’s rule.' },
];

/** Solve the AC circuit for the part doc.elements[src] with a theorem. */
export function runACTheorem(prep, theorem, src, want = 'I') {
  const c = context(prep, src, want);
  if (c.error) return { ok: false, error: c.error };
  const fn = { thevenin: (x) => thevenin(x), norton, superposition, maxpower: (x) => thevenin(x, true), nodal: nodalMethod, mesh: meshMethod }[theorem];
  if (!fn) return { ok: false, error: 'Unknown theorem' };
  const res = fn(c);
  if (res.ok) res.check = c.parts; // the direct solution, per frequency
  return res;
}

export { plainMath };
