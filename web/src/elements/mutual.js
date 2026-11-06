// Mutual inductance between two separate coils, drawn the way the textbook draws a
// magnetically coupled circuit (Alexander & Sadiku ch. 13): two inductors anywhere in the
// circuit, each with a dot, and a curved double arrow marked M between them.
//
//   v1 = L1 di1/dt ± M di2/dt,  v2 = L2 di2/dt ± M di1/dt
// + when both currents enter (or both leave) the dotted ends, − otherwise (the dot convention).

import { Element, register, GRID } from './base.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

export class MutualInductance extends Element {
  static type = 'mutual'; static title = 'Mutual Inductance (M)'; static category = 'Transformers';
  static prefix = 'M'; static keywords = 'mutual inductance m coupled coils magnetically coupled dot convention jwm textbook';
  static props = [
    { key: 'm', label: 'Mutual inductance M', unit: 'H', def: 1, min: 1e-12, max: 1e4, log: true, knob: true },
    { key: 'l1', label: 'First coil (empty: the nearest)', type: 'text', def: '', structural: true, suggest: (doc) => coilNames(doc) },
    { key: 'l2', label: 'Second coil (empty: the next nearest)', type: 'text', def: '', structural: true, suggest: (doc) => coilNames(doc) },
  ];
  static description = 'Couples two inductors magnetically, like the curved arrow marked M in a textbook: place it between the two coils (it couples the two nearest, or the ones named) and set M. The dot on each inductor (its properties) gives the sign: with both currents entering the dotted ends the mutual voltage M·di/dt adds, otherwise it subtracts. In the phasor domain it is the impedance jωM.';
  constructor(x, y) { super(x, y); this.postCurrents = []; }
  localPosts() { return []; }
  leads() { return []; }
  connectivity() { return []; }
  branchCount() { return 0; }
  localBox() { return [-1.6 * G, -1.1 * G, 1.6 * G, 0.5 * G]; }
  labelSide() { return [0, -1]; }

  /** The two coupled coils: the ones named, else the two nearest inductors. [] when there are not two. */
  coils(els) {
    const list = (els || []).filter(isCoil);
    const named = (n) => { n = String(n || '').trim(); return n ? list.find((e) => e.name === n) || null : null; };
    let a = named(this.p.l1), b = named(this.p.l2);
    const d = (e) => { const c = e.toWorld ? e.toWorld(0, 0) : [e.x, e.y]; return Math.hypot(c[0] - this.x, c[1] - this.y); };
    const rest = list.filter((e) => e !== a && e !== b).sort((p, q) => d(p) - d(q));
    if (!a) a = rest.shift() || null;
    if (!b) b = rest.find((e) => e !== a) || null;
    return a && b && a !== b ? [a, b] : [];
  }
  /** M with the sign of the dot convention for the two coils' terminal-1 → terminal-2 currents */
  mEff(a, b) { return this.p.m * a.coilDot() * b.coilDot(); }

  pair(s) { return this.coils(s.elements); }
  stamp(s) {
    if (s.mode === 'dc') return; // in DC the coils are shorts: no mutual voltage
    const [a, b] = this.pair(s);
    if (!a) return;
    const g = ((s.method === 'be' ? 1 : 2) * this.mEff(a, b)) / s.dt;
    s.addA(a.branches[0], b.branches[0], -g); s.addA(b.branches[0], a.branches[0], -g);
  }
  stampStep(s) {
    if (s.mode === 'dc') return;
    const [a, b] = this.pair(s);
    if (!a) return;
    const g = ((s.method === 'be' ? 1 : 2) * this.mEff(a, b)) / s.dt;
    s.b[a.branches[0]] += -g * (b.iPrev || 0);
    s.b[b.branches[0]] += -g * (a.iPrev || 0);
  }
  stampAC(ac) {
    const [a, b] = this.pair(ac.sim);
    if (!a) return;
    const x = ac.omega * this.mEff(a, b);
    ac.addA(a.branches[0], b.branches[0], 0, -x); ac.addA(b.branches[0], a.branches[0], 0, -x);
  }
  valueLabel() { return `M=${fmtShort(this.p.m, 'H')}`; }
  readings(s) {
    const [a, b] = this.coils(s?.elements || []);
    if (!a) return [['Coupled coils', 'two inductors are needed near it', '']];
    return [['Coupled coils', `${a.name} and ${b.name}`, ''], ['M', this.p.m, 'H'], ['Coupling k = M/√(L1L2)', this.p.m / Math.sqrt(a.p.l * b.p.l), '']];
  }
  spice() { return `* ${this.name}: mutual inductance ${this.p.m} H (K element needs the coil names)`; }
  draw(g) {
    // a curved double-headed arrow, as in the book
    const ctx = g.ctx, r = 1.5 * G;
    ctx.beginPath();
    ctx.arc(0, 0.9 * G, r, Math.PI * 1.22, Math.PI * 1.78);
    ctx.strokeStyle = g.accent; ctx.lineWidth = g.lw; ctx.stroke();
    const tip = (t, dir) => {
      const x = r * Math.cos(t), y = 0.9 * G + r * Math.sin(t);
      const tx = -Math.sin(t) * dir, ty = Math.cos(t) * dir; // along the arc
      const nx = -ty, ny = tx, L = 0.35 * G, W = 0.2 * G;
      g.poly([[x, y], [x - tx * L + nx * W, y - ty * L + ny * W], [x - tx * L - nx * W, y - ty * L - ny * W]], { fill: g.accent });
    };
    tip(Math.PI * 1.22, -1); tip(Math.PI * 1.78, 1);
    g.upright(() => g.text('M', 0, -0.15 * G, { size: 9, color: g.muted, bold: true }));
  }
}
register(MutualInductance);

export function isCoil(e) { return !!e && typeof e.coilDot === 'function' && e.nodes !== undefined && e.p && e.p.l > 0; }
function coilNames(doc) { return (doc?.elements || []).filter(isCoil).map((e) => e.name); }
