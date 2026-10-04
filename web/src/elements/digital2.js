// More digital logic: 3/4-input gates, tri-state buffer, adders, magnitude
// comparator, multiplexers, decoders, priority encoder, parity generator,
// D latch, shift register, up/down / decade / BCD / 8-bit counters,
// monostable, clock divider, 4-bit register and a hex keypad input.

import { register, GRID } from './base.js';
import { Digital, DIGI_PROPS } from './digital.js';
import { withChip } from './kit.js';

const G = GRID;
export const bits = (v, n) => Array.from({ length: n }, (_, b) => !!((v >> b) & 1));
export const val = (arr) => arr.reduce((a, b, i) => a | ((b ? 1 : 0) << i), 0);

/** IC-style digital part: pins = [[label, side, 'i'|'o'], ...] */
export class Chip extends withChip(Digital) {
  static keywords = 'logic ic 74hc cmos ttl';
  inputs() { return this.constructor.pins.map((p, i) => (p[2] === 'i' ? i : -1)).filter((i) => i >= 0); }
  outputs() { return this.constructor.pins.map((p, i) => (p[2] === 'o' ? i : -1)).filter((i) => i >= 0); }
  connectivity() { return [[...this.outputs(), 'gnd']]; }
  shown() { return ''; }
  draw(g) {
    this.drawChip(g, this.constructor.chip || '');
    const t = this.shown();
    // sideways the chip is narrow across this spot: sit further in and never exceed the width
    const side = g.rot & 1, gm = this.geom();
    if (t !== '') g.upright(() => g.text(String(t), 0, 0, { size: 12, color: g.text1, bold: true, mono: true, maxW: side ? 1.9 * G : 2 * gm.bw - 6 }), 0, gm.bot - (side ? 1.05 : 0.75) * G);
    if (g.running) {
      const { posts, bw } = this.geom();
      this.outputs().forEach((pi, k) => {
        const [x, y] = posts[pi];
        if (Math.abs(x) > bw) g.circle(Math.sign(x) * (bw - 0.1 * G), y - 0.28 * G, 1.8, { fill: this.out[k] ? g.hi : g.lo });
      });
    }
  }
  readings(s) {
    const r = [];
    this.constructor.pins.forEach(([lab], i) => r.push([lab, s.v(this.nodes[i]), 'V']));
    const t = this.shown();
    return t !== '' ? [['Value', t, ''], ...r] : r;
  }
}
export const P = (lab, side, kind) => [lab, side, kind];

// ------------------------------------------------------------ N-input gates
const FN = { and: (a) => a.every(Boolean), or: (a) => a.some(Boolean), nand: (a) => !a.every(Boolean), nor: (a) => !a.some(Boolean) };
class GateN extends Digital {
  static keywords = 'logic gate multi input';
  n() { return this.constructor.n; }
  ys() { return this.n() === 3 ? [-G, 0, G] : [-2 * G, -G, G, 2 * G]; }
  localPosts() { return [...this.ys().map((y) => [-2 * G, y]), [2 * G, 0]]; }
  localBox() { const h = this.n() === 3 ? 1.5 * G : 2.4 * G; return [-2 * G, -h, 2 * G, h]; }
  inv() { return this.constructor.fn.startsWith('n'); }
  leads() { return [...this.ys().map((y, i) => [i, -2 * G, y, -G, y]), [this.n(), 2 * G, 0, this.inv() ? 1.35 * G : G, 0]]; }
  inputs() { return this.ys().map((_, i) => i); }
  outputs() { return [this.n()]; }
  compute(ins) { return [FN[this.constructor.fn](ins)]; }
  draw(g) {
    const ctx = g.ctx, base = this.constructor.fn.replace(/^n/, ''), L = -G, H = this.n() === 3 ? 1.35 * G : 2.25 * G;
    ctx.beginPath();
    if (base === 'and') { ctx.moveTo(L, -H); ctx.lineTo(-0.1 * G, -H); ctx.bezierCurveTo(1.25 * G, -H, 1.25 * G, H, -0.1 * G, H); ctx.lineTo(L, H); ctx.closePath(); } else {
      ctx.moveTo(L - 4, -H); ctx.quadraticCurveTo(0.3 * G, -H, G + 2, 0); ctx.quadraticCurveTo(0.3 * G, H, L - 4, H); ctx.quadraticCurveTo(L + 0.5 * G, 0, L - 4, -H); ctx.closePath();
    }
    ctx.fillStyle = g.fill; ctx.fill(); ctx.strokeStyle = g.body; ctx.lineWidth = g.lw; ctx.stroke();
    if (this.inv()) g.circle(1.18 * G, 0, 4, { stroke: g.body, width: g.lw * 0.9, fill: g.bg });
    if (g.running) g.circle(0, 0, 3, { fill: this.out[0] ? g.hi : g.lo });
  }
}
for (const [fn, n] of [['and', 3], ['or', 3], ['nand', 3], ['nor', 3], ['and', 4], ['nand', 4]]) {
  const C = class extends GateN {};
  const T = fn.toUpperCase();
  Object.assign(C, { fn, n, type: `${fn}${n}`, title: `${T} Gate (${n}-input)`, keywords: `logic gate ${fn} ${n} input 74hc${fn === 'and' ? '11' : fn === 'nand' ? (n === 3 ? '10' : '20') : fn === 'or' ? '4075' : '27'}`, description: `${n}-input ${T} gate.` });
  register(C);
}

export class TriState extends Digital {
  static type = 'tristate'; static title = 'Tri-State Buffer'; static keywords = 'tri state buffer three state enable bus driver 74hc125 high impedance';
  static description = 'Buffer with output enable: when EN is high Y follows A; when EN is low the output is high-impedance (disconnected) so several drivers can share a bus.';
  localPosts() { return [[-2 * G, 0], [0, 2 * G], [2 * G, 0]]; }
  localBox() { return [-2 * G, -G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 0, 2 * G, 0, 0.5 * G], [2, 2 * G, 0, G, 0]]; }
  inputs() { return [0, 1]; }
  outputs() { return [2]; }
  pinNames() { return ['A', 'EN', 'Y']; }
  compute(ins) { this.en = ins[1]; return [ins[0]]; }
  preStep(s) { const was = this.en; super.preStep(s); if (was !== this.en) s.markEvent(); }
  stamp(s) { s.addG(this.nodes[2], 0, this.en ? 1 / this.p.rout : 1e-9); }
  stampStep(s) { if (this.en) s.addI(0, this.nodes[2], (this.outLevel(0) * (s.srcScale ?? 1)) / this.p.rout); }
  accept(s) { this.postCurrents[2] = this.en ? (s.v(this.nodes[2]) - this.outLevel(0)) / this.p.rout : s.v(this.nodes[2]) * 1e-9; }
  stampAC(ac) { ac.addY(this.nodes[2], 0, this.en ? 1 / this.p.rout : 1e-9); }
  draw(g) {
    g.poly([[-G, -0.9 * G], [G, 0], [-G, 0.9 * G]], { stroke: g.body, width: g.lw, fill: g.fill, close: true });
    g.line(0, 0.45 * G, 0, 0.5 * G, g.body, g.lw);
    if (g.running) g.circle(-0.3 * G, 0, 3, { fill: !this.en ? '#94a3b8' : this.out[0] ? g.hi : g.lo });
  }
}
register(TriState);

// ------------------------------------------------------------- combinational
export function chip(type, title, chipName, pins, compute, keywords, desc, extra = {}) {
  const C = class extends Chip {};
  Object.assign(C, { type, title, chip: chipName, pins, keywords, description: desc, ...extra });
  C.prototype.compute = compute;
  if (extra.shown) C.prototype.shown = extra.shown;
  register(C);
  return C;
}

chip('halfadder', 'Half Adder', 'HA', [P('A', 'L', 'i'), P('B', 'L', 'i'), P('S', 'R', 'o'), P('C', 'R', 'o')],
  (i) => [i[0] !== i[1], i[0] && i[1]], 'half adder binary addition sum carry xor', 'S = A ⊕ B, C = A·B.');
chip('fulladder', 'Full Adder', 'FA', [P('A', 'L', 'i'), P('B', 'L', 'i'), P('Cin', 'L', 'i'), P('S', 'R', 'o'), P('Cout', 'R', 'o')],
  (i) => { const n = i.filter(Boolean).length; return [n % 2 === 1, n >= 2]; }, 'full adder carry in carry out', 'S = A ⊕ B ⊕ Cin, Cout = majority(A, B, Cin).');
chip('adder4', '4-bit Adder (74HC283)', 'Σ4',
  [...[0, 1, 2, 3].map((k) => P('A' + k, 'L', 'i')), ...[0, 1, 2, 3].map((k) => P('B' + k, 'L', 'i')), P('Cin', 'L', 'i'), ...[0, 1, 2, 3].map((k) => P('S' + k, 'R', 'o')), P('Cout', 'R', 'o')],
  function (i) { const a = val(i.slice(0, 4)), b = val(i.slice(4, 8)), s = a + b + (i[8] ? 1 : 0); this.sum = s; return bits(s, 5); },
  '4 bit binary adder 74283 ripple carry', 'Adds two 4-bit numbers with carry-in: S = A + B + Cin (carry out on Cout).',
  { chipOpts: { dense: true }, shown() { return this.sum ?? 0; } });
chip('comp4', '4-bit Comparator (74HC85)', 'A?B',
  [...[0, 1, 2, 3].map((k) => P('A' + k, 'L', 'i')), ...[0, 1, 2, 3].map((k) => P('B' + k, 'L', 'i')), P('A>B', 'R', 'o'), P('A=B', 'R', 'o'), P('A<B', 'R', 'o')],
  (i) => { const a = val(i.slice(0, 4)), b = val(i.slice(4, 8)); return [a > b, a === b, a < b]; }, 'magnitude comparator 7485 equality greater less', 'Compares two 4-bit numbers A and B.', { chipOpts: { dense: true } });
chip('mux2', '2:1 Multiplexer', 'MUX', [P('I0', 'L', 'i'), P('I1', 'L', 'i'), P('S', 'B', 'i'), P('Y', 'R', 'o')],
  (i) => [i[2] ? i[1] : i[0]], 'multiplexer mux 2 to 1 selector 74hc157 data selector', 'Y = S ? I1 : I0.');
chip('mux4', '4:1 Multiplexer', 'MUX4', [P('I0', 'L', 'i'), P('I1', 'L', 'i'), P('I2', 'L', 'i'), P('I3', 'L', 'i'), P('S0', 'B', 'i'), P('S1', 'B', 'i'), P('Y', 'R', 'o')],
  (i) => [i[(i[4] ? 1 : 0) + (i[5] ? 2 : 0)]], 'multiplexer 4 to 1 74hc153 data selector', 'Y = I[S1S0].');
chip('dec2to4', '2-to-4 Decoder (74HC139)', 'DEC', [P('A0', 'L', 'i'), P('A1', 'L', 'i'), P('EN', 'L', 'i'), P('Y0', 'R', 'o'), P('Y1', 'R', 'o'), P('Y2', 'R', 'o'), P('Y3', 'R', 'o')],
  (i) => { const k = (i[0] ? 1 : 0) + (i[1] ? 2 : 0); return [0, 1, 2, 3].map((j) => i[2] && j === k); }, 'decoder 2 to 4 demultiplexer demux address', 'Active-high outputs: Y[A1A0] = 1 while EN is high.');
chip('dec3to8', '3-to-8 Decoder (74HC138)', 'DEC8', [P('A0', 'L', 'i'), P('A1', 'L', 'i'), P('A2', 'L', 'i'), P('EN', 'L', 'i'), ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => P('Y' + k, 'R', 'o'))],
  (i) => { const k = val(i.slice(0, 3)); return [0, 1, 2, 3, 4, 5, 6, 7].map((j) => i[3] && j === k); }, 'decoder 3 to 8 74138 demultiplexer address decoder', 'Active-high one-of-eight decoder with enable.', { chipOpts: { dense: true } });
chip('enc4to2', 'Priority Encoder 4-to-2', 'ENC', [P('I0', 'L', 'i'), P('I1', 'L', 'i'), P('I2', 'L', 'i'), P('I3', 'L', 'i'), P('A0', 'R', 'o'), P('A1', 'R', 'o'), P('V', 'R', 'o')],
  (i) => { let k = -1; for (let j = 3; j >= 0; j--) if (i[j]) { k = j; break; } return k < 0 ? [false, false, false] : [!!(k & 1), !!(k & 2), true]; }, 'priority encoder 74148 encoder', 'Outputs the binary index of the highest active input; V = any input active.');
chip('parity', 'Parity Generator (4-bit)', 'PAR', [P('D0', 'L', 'i'), P('D1', 'L', 'i'), P('D2', 'L', 'i'), P('D3', 'L', 'i'), P('EVEN', 'R', 'o'), P('ODD', 'R', 'o')],
  (i) => { const o = i.filter(Boolean).length % 2 === 1; return [o, !o]; }, 'parity generator checker even odd 74280 error detection', 'EVEN = parity bit that makes the total count of 1s even; ODD is its complement.');

// --------------------------------------------------------------- sequential
export class SeqChip extends Chip {
  resetState() { this.st = 0; this.prevClk = false; }
  edge(clk, settle) { const e = !settle && clk && !this.prevClk; this.prevClk = clk; return e; }
}
export function seq(type, title, chipName, pins, compute, keywords, desc, extra = {}) {
  const C = class extends SeqChip {};
  Object.assign(C, { type, title, chip: chipName, pins, keywords, description: desc });
  if (extra.chipOpts) C.chipOpts = extra.chipOpts;
  C.prototype.compute = compute;
  if (extra.shown) C.prototype.shown = extra.shown;
  if (extra.resetState) C.prototype.resetState = extra.resetState;
  if (extra.props) C.props = extra.props;
  register(C);
  return C;
}

seq('dlatch', 'D Latch', 'D-L', [P('D', 'L', 'i'), P('EN', 'L', 'i'), P('Q', 'R', 'o'), P('Q̄', 'R', 'o')],
  function (i) { if (i[1]) this.st = i[0] ? 1 : 0; return [!!this.st, !this.st]; }, 'd latch transparent latch 74hc373 level triggered', 'Transparent latch: Q follows D while EN is high and holds when EN goes low.');
seq('shift4', '4-bit Shift Register (SIPO)', 'SRG4', [P('DATA', 'L', 'i'), P('CLK', 'L', 'i'), P('RST', 'L', 'i'), P('Q0', 'R', 'o'), P('Q1', 'R', 'o'), P('Q2', 'R', 'o'), P('Q3', 'R', 'o')],
  function (i, settle) {
    if (i[2]) this.st = 0; else if (this.edge(i[1], settle)) this.st = ((this.st << 1) | (i[0] ? 1 : 0)) & 15;
    if (i[2]) this.prevClk = i[1];
    return bits(this.st, 4);
  }, 'shift register serial in parallel out sipo 74hc164 74hc595', 'On each rising clock edge the bits shift Q0→Q3 and DATA enters Q0. RST clears.', { shown() { return (this.st ?? 0).toString(2).padStart(4, '0'); } });
seq('updown', '4-bit Up/Down Counter', 'CTR±', [P('CLK', 'L', 'i'), P('UP', 'L', 'i'), P('RST', 'L', 'i'), P('Q0', 'R', 'o'), P('Q1', 'R', 'o'), P('Q2', 'R', 'o'), P('Q3', 'R', 'o')],
  function (i, settle) {
    if (i[2]) { this.st = 0; this.prevClk = i[0]; } else if (this.edge(i[0], settle)) this.st = (this.st + (i[1] ? 1 : 15)) & 15;
    return bits(this.st, 4);
  }, 'up down counter 74hc193 reversible binary counter', 'Counts up (UP = 1) or down (UP = 0) on rising clock edges; RST clears to 0.', { shown() { return this.st ?? 0; } });
seq('decade', 'Decade Counter (CD4017)', '4017', [P('CLK', 'L', 'i'), P('RST', 'L', 'i'), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => P('Q' + k, 'R', 'o'))],
  function (i, settle) {
    if (i[1]) { this.st = 0; this.prevClk = i[0]; } else if (this.edge(i[0], settle)) this.st = (this.st + 1) % 10;
    return Array.from({ length: 10 }, (_, k) => k === this.st);
  }, '4017 decade counter johnson counter led chaser divide by 10', 'Ten decoded outputs: exactly one output is high and it advances on every rising clock edge — the classic LED chaser.', { chipOpts: { dense: true }, shown() { return this.st ?? 0; } });
seq('bcdcounter', 'BCD Counter (74HC390)', 'BCD', [P('CLK', 'L', 'i'), P('RST', 'L', 'i'), P('Q0', 'R', 'o'), P('Q1', 'R', 'o'), P('Q2', 'R', 'o'), P('Q3', 'R', 'o'), P('CO', 'R', 'o')],
  function (i, settle) {
    if (i[1]) { this.st = 0; this.prevClk = i[0]; } else if (this.edge(i[0], settle)) this.st = (this.st + 1) % 10;
    // ripple carry: high for counts 0–4, so its rising edge comes exactly when the count wraps
    // 9 → 0 and CO can clock the next digit directly (it is also a 50 % duty ÷10 output)
    return [...bits(this.st, 4), this.st <= 4];
  }, 'bcd counter decade 7490 74390 mod 10 counter', 'Counts 0–9 in BCD. CO goes high as the count wraps from 9 to 0 (high for 0–4), so wiring CO to the next counter\'s CLK cascades digits (00 → 99). Drive a 7-segment decoder with Q0–Q3.', { shown() { return this.st ?? 0; } });
seq('counter8', '8-bit Counter', 'CTR8', [P('CLK', 'L', 'i'), P('RST', 'L', 'i'), ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => P('Q' + k, 'R', 'o'))],
  function (i, settle) {
    if (i[1]) { this.st = 0; this.prevClk = i[0]; } else if (this.edge(i[0], settle)) this.st = (this.st + 1) & 255;
    return bits(this.st, 8);
  }, '8 bit binary counter 74hc590 divider', '8-bit binary up-counter (0–255) with reset.', { chipOpts: { dense: true }, shown() { return this.st ?? 0; } });
seq('reg4', '4-bit Register (74HC175)', 'REG4', [P('D0', 'L', 'i'), P('D1', 'L', 'i'), P('D2', 'L', 'i'), P('D3', 'L', 'i'), P('CLK', 'L', 'i'), P('Q0', 'R', 'o'), P('Q1', 'R', 'o'), P('Q2', 'R', 'o'), P('Q3', 'R', 'o')],
  function (i, settle) { if (this.edge(i[4], settle)) this.st = val(i.slice(0, 4)); return bits(this.st, 4); }, 'register 4 bit parallel load 74175 data latch storage', 'Stores D0–D3 on each rising clock edge.', { shown() { return (this.st ?? 0).toString(16).toUpperCase(); } });
seq('clockdiv', 'Clock Divider ÷N', '÷N', [P('CLK', 'L', 'i'), P('OUT', 'R', 'o')],
  function (i, settle) {
    if (this.edge(i[0], settle)) this.st = (this.st + 1) % Math.max(1, Math.round(this.p.n));
    return [this.st < Math.max(1, Math.round(this.p.n)) / 2];
  }, 'clock divider frequency divider prescaler divide by n', 'Divides the clock frequency by N (50 % duty for even N).',
  { props: [{ key: 'n', label: 'Divide by N', unit: '', def: 10, min: 1, max: 1e6, knob: true }, ...DIGI_PROPS], shown() { return '÷' + Math.round(this.p.n); } });

export class Monostable extends SeqChip {
  static type = 'mono'; static title = 'Monostable (74HC121)'; static chip = 'MONO';
  static keywords = 'monostable one shot pulse stretcher 74121 timer';
  static props = [{ key: 'tw', label: 'Pulse width', unit: 's', def: 0.01, min: 1e-9, max: 1e3, log: true, knob: true }, ...DIGI_PROPS];
  static pins = [P('TRIG', 'L', 'i'), P('Q', 'R', 'o'), P('Q̄', 'R', 'o')];
  static description = 'One-shot: a rising edge on TRIG produces a single output pulse of width tw (not retriggerable).';
  resetState() { this.st = 0; this.prevClk = false; this.until = -1; this.t = 0; }
  preStep(s) { this.t = s.mode === 'dc' ? 0 : s.tNext; super.preStep(s); }
  compute(i, settle) {
    if (this.edge(i[0], settle) && !(this.until > this.t)) this.until = this.t + this.p.tw;
    const on = this.until > this.t;
    return [on, !on];
  }
}
register(Monostable);

export class HexInput extends Chip {
  static type = 'hexin'; static title = 'Hex Keypad (4-bit input)'; static chip = 'HEX';
  static keywords = 'hex keypad thumbwheel 4 bit input dip switch binary input bcd switch';
  static props = [{ key: 'v', label: 'Value (0–15)', unit: '', def: 0, min: 0, max: 15, knob: true }, ...DIGI_PROPS.map((p) => (p.key === 'rout' ? { ...p, def: 1 } : p))];
  static pins = [P('D0', 'R', 'o'), P('D1', 'R', 'o'), P('D2', 'R', 'o'), P('D3', 'R', 'o')];
  static description = 'Hex thumbwheel: tap to step 0 → F; drives D0–D3 with the binary value.';
  interactive = true;
  compute() { return bits(Math.round(this.p.v) & 15, 4); }
  onTap() { this.p.v = (Math.round(this.p.v) + 1) & 15; return true; }
  shown() { return (Math.round(this.p.v) & 15).toString(16).toUpperCase(); }
  draw(g) {
    this.drawChip(g, 'HEX');
    g.upright(() => g.text(this.shown(), 0, 0, { size: 16, color: g.accent, bold: true, mono: true }), 0, 0.2 * G);
  }
}
register(HexInput);
