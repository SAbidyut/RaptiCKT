// AC circuits the way Alexander & Sadiku's Fundamentals of Electric Circuits works them (ch. 10
// Sinusoidal Steady-State Analysis, ch. 13 Magnetically Coupled Circuits): each opens ready for
// ⋮ → AC circuit: phasor domain and ⋮ → Run with theorem, which solve it step by step the book's
// way. Values as the book's figures give them; a figure drawn in the phasor domain (j4 Ω, −j2 Ω)
// is built at ω = 1 rad/s, where X ohms is X henries (or 1/X farads).

const CAT = 'AC Circuits (Phasors)';
const S = 6; // grid units between two node points; a part is 4 long, a short lead each side
const W1 = 1 / (2 * Math.PI); // the frequency of ω = 1 rad/s

/** A part from node point p to node point q (its first terminal at p), leads to both. */
function between(b, type, p, q, props = {}) {
  const [x0, y0] = [p[0] * S, p[1] * S], [x1, y1] = [q[0] * S, q[1] * S];
  const hor = y0 === y1, rot = hor ? (x0 < x1 ? 0 : 2) : (y0 < y1 ? 1 : 3);
  const e = b.el(type, (x0 + x1) / 2, (y0 + y1) / 2, props, rot);
  const [a, c] = [b.pin(e, 0), b.pin(e, 1)];
  if (a[0] !== x0 || a[1] !== y0) b.w([x0, y0], a);
  if (c[0] !== x1 || c[1] !== y1) b.w(c, [x1, y1]);
  return e;
}
const wire = (b, ...pts) => b.w(...pts.map(([x, y]) => [x * S, y * S]));
const phasorDoc = (b) => { b.doc.domain = 'phasor'; };

export const EXAMPLES4 = [
  {
    id: 'ac101', cat: CAT, title: 'Nodal analysis in phasors (book Ex. 10.1)',
    desc: 'Find ix: 20 cos 4t V through 10 Ω, a 0.1 F capacitor (ix), a 1 H coil, a dependent current source 2ix and 0.5 H. ⋮ → AC circuit: phasor domain shows it as the book’s Fig. 10.2 (20∠0° V, −j2.5 Ω, j4 Ω, j2 Ω); ⋮ → Run with theorem → Nodal analysis → C1 gives V1 = 18.97∠18.43° V and ix = 7.59∠108.4° A, i.e. ix = 7.59 cos(4t + 108.4°) A.',
    build(b) {
      between(b, 'acv', [0, 0], [0, 1], { wave: 'cos', amp: 20, freq: 4 / (2 * Math.PI) });
      between(b, 'resistor', [0, 0], [1, 0], { r: 10 });
      between(b, 'capacitor', [1, 0], [1, 1], { c: 0.1 });
      between(b, 'inductor', [1, 0], [2, 0], { l: 1 });
      between(b, 'depsrc', [2.5, 1], [2.5, 0], { kind: 'cccs', gain: 2, ctrl: 'i:C1', sym: 'ix' });
      between(b, 'inductor', [3.5, 0], [3.5, 1], { l: 0.5 });
      wire(b, [2, 0], [3.5, 0]); wire(b, [0, 1], [3.5, 1]);
      b.el('ground', 1.75 * S, S);
    },
  },
  {
    id: 'ac103', cat: CAT, title: 'Mesh analysis in phasors (book Ex. 10.3)',
    desc: 'Drawn in the phasor domain (ω = 1 rad/s): 5∠0° A, 20∠90° V, j10 Ω, two −j2 Ω, 4 Ω and 8 Ω. ⋮ → Run with theorem → Mesh analysis → R2 (4 Ω): the current source fixes I3 = 5 A, two KVL equations, Cramer’s rule — I2 = 6.12∠−35.22° A, so the book’s Io = −I2 = 6.12∠144.78° A.',
    build(b) {
      phasorDoc(b);
      between(b, 'aci', [0, 1], [0, 0], { wave: 'cos', amp: 5, freq: W1 });
      between(b, 'inductor', [0, 1], [1, 1], { l: 10 });
      between(b, 'capacitor', [1, 0], [1, 1], { c: 0.5 });
      between(b, 'resistor', [0, 1], [0, 2], { r: 8 });
      between(b, 'capacitor', [1, 1], [1, 2], { c: 0.5 });
      between(b, 'resistor', [1, 0], [2, 0], { r: 4 });
      between(b, 'acv', [2, 0], [2, 2], { wave: 'cos', amp: 20, phase: 90, freq: W1 });
      wire(b, [0, 0], [1, 0]); wire(b, [0, 2], [2, 2]);
    },
  },
  {
    id: 'ac106', cat: CAT, title: 'Superposition at three frequencies (book Ex. 10.6)',
    desc: 'A 5 V DC source, 10 cos 2t V and 2 sin 5t A in one circuit: each frequency needs its own phasor domain. ⋮ → Run with theorem → Superposition → R1 (1 Ω), Voltage: one source at a time (at DC the coil is a short and the capacitor an open), then the three added in the time domain — vo = −1 + 2.498 cos(2t − 30.78°) + 2.328 cos(5t − 77.91°) V (the book prints the last as 2.328 sin(5t + 10°), its angle rounded; worked exactly, −j2 ∥ 4 = 0.8 − j1.6 Ω gives 12.09°).',
    build(b) {
      between(b, 'acv', [0, 0], [0, 1], { wave: 'cos', amp: 10, freq: 2 / (2 * Math.PI) });
      between(b, 'inductor', [0, 0], [1, 0], { l: 2 });
      between(b, 'aci', [1, 1], [1, 0], { wave: 'sine', amp: 2, freq: 5 / (2 * Math.PI) });
      between(b, 'resistor', [1, 0], [2, 0], { r: 1 });
      between(b, 'capacitor', [2, 0], [2, 1], { c: 0.1 });
      between(b, 'resistor', [2, 0], [3, 0], { r: 4 });
      between(b, 'dcv', [3, 0], [3, 1], { amp: 5 });
      wire(b, [0, 1], [3, 1]);
      b.el('ground', 1.5 * S, S);
    },
  },
  {
    id: 'ac108', cat: CAT, title: 'Thevenin equivalent in phasors (book Ex. 10.8)',
    desc: 'The bridge of Fig. 10.22 (120∠75° V, −j6 Ω, 8 Ω, 4 Ω, j12 Ω) with a 10 Ω load across a–b. ⋮ → Run with theorem → Thevenin → R3: Z_th = (−j6 ∥ 8) + (4 ∥ j12) = 6.48 − j2.64 Ω, V_th = 37.95∠220.3° V, as in the book; Maximum power transfer gives Z_L = Z_th* = 6.48 + j2.64 Ω.',
    build(b) {
      phasorDoc(b);
      between(b, 'acv', [0, 0], [0, 2], { wave: 'cos', amp: 120, phase: 75, freq: W1 });
      between(b, 'capacitor', [1, 0], [1, 1], { c: 1 / 6 });
      between(b, 'resistor', [1, 1], [1, 2], { r: 8 });
      between(b, 'resistor', [3, 0], [3, 1], { r: 4 });
      between(b, 'inductor', [3, 1], [3, 2], { l: 12 });
      between(b, 'resistor', [1, 1], [3, 1], { r: 10 });
      wire(b, [0, 0], [3, 0]); wire(b, [0, 2], [3, 2]);
    },
  },
  {
    id: 'ac131', cat: CAT, title: 'Coupled coils, two loops (book Ex. 13.1)',
    desc: 'Two loops joined only by the coupling of their coils: 12∠0° V, −j4 Ω and j5 Ω; j6 Ω and 12 Ω; jωM = j3 Ω, both dots at the top. ⋮ → Run with theorem → Mesh analysis → R1 (12 Ω): (−j4 + j5)I1 − j3I2 = 12 and −j3I1 + (12 + j6)I2 = 0 give I1 = 13.01∠−49.39° A and I2 = 2.91∠14.04° A.',
    build(b) {
      phasorDoc(b);
      between(b, 'acv', [0, 0], [0, 1], { wave: 'cos', amp: 12, freq: W1 });
      between(b, 'capacitor', [0, 0], [1, 0], { c: 0.25 });
      between(b, 'inductor', [1.5, 0], [1.5, 1], { l: 5, dot: 'a' });
      between(b, 'inductor', [2.5, 0], [2.5, 1], { l: 6, dot: 'a' });
      between(b, 'resistor', [3.5, 0], [3.5, 1], { r: 12 });
      b.el('mutual', 2 * S, -0.3 * S, { m: 3 });
      wire(b, [1, 0], [1.5, 0]); wire(b, [0, 1], [1.5, 1]);
      wire(b, [2.5, 0], [3.5, 0]); wire(b, [2.5, 1], [3.5, 1]);
    },
  },
  {
    id: 'ac132', cat: CAT, title: 'Coupled coils, mesh analysis (book Ex. 13.2)',
    desc: 'Fig. 13.11: 100∠0° V, 4 Ω, −j3 Ω, coils j6 Ω and j8 Ω with jωM = j2 Ω, and 5 Ω. Mesh 2 runs through both coils the same way into their dots (+2·j2). ⋮ → Run with theorem → Mesh analysis → R2: (4 + j3)I1 − j8I2 = 100, −j8I1 + (5 + j18)I2 = 0, Δ = 30 + j87, I1 = 20.3∠3.5° A, I2 = 8.693∠19.03° A.',
    build(b) {
      phasorDoc(b);
      between(b, 'acv', [0, 0], [0, 1], { wave: 'cos', amp: 100, freq: W1 });
      between(b, 'resistor', [0, 0], [1, 0], { r: 4 });
      between(b, 'capacitor', [1, 0], [2, 0], { c: 1 / 3 });
      between(b, 'inductor', [2, 0], [2, 1], { l: 6, dot: 'a' });
      between(b, 'inductor', [2, 0], [3, 0], { l: 8, dot: 'b' });
      between(b, 'resistor', [3, 0], [3, 1], { r: 5 });
      b.el('mutual', 2.35 * S, 0.45 * S, { m: 2 });
      wire(b, [0, 1], [3, 1]);
    },
  },
];
