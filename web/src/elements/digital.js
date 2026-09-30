// Digital logic: gates, flip-flops, counter, decoder, 7-segment display,
// logic input/output, ADC/DAC. Mixed-signal: inputs sense node voltages with
// hysteresis, outputs are Norton drivers with finite output resistance.

import { Element, register, GRID } from './base.js';

const G = GRID;

const DIGI_PROPS = [
  { key: 'vdd', label: 'Logic high level', unit: 'V', def: 5, min: 0.5, max: 30 },
  { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 25, min: 0.01, max: 1e5 },
];

class Digital extends Element {
  static category = 'Digital';
  static prefix = 'U';
  static props = DIGI_PROPS;
  constructor(x, y) {
    super(x, y);
    this.postCurrents = new Array(this.localPosts().length).fill(0);
    this.inState = [];
    this.out = [];
  }
  inputs() { return []; }
  outputs() { return []; }
  connectivity() { return [[...this.outputs(), 'gnd']]; }
  valueLabel() { return ''; }
  reset() {
    this.inState = this.inputs().map(() => false);
    this.out = this.outputs().map(() => false);
    this.resetState();
    this.out = this.compute(this.inState, true) || this.out;
  }
  resetState() {}
  readInputs(s) {
    const vdd = this.p.vdd, th = vdd / 2, h = vdd * 0.08;
    return this.inputs().map((pi, k) => {
      const v = s.v(this.nodes[pi]);
      return this.inState[k] ? v > th - h : v > th + h;
    });
  }
  /** compute outputs from inputs; `settle` true while finding the DC operating point */
  compute(ins) { return this.out; }
  preStep(s) {
    const ins = this.readInputs(s);
    const out = this.compute(ins, s.mode === 'dc');
    this.inState = ins;
    if (out) {
      for (let k = 0; k < out.length; k++) if (out[k] !== this.out[k]) s.event = true;
      this.out = out;
    }
  }
  digitalSettle(s) {
    const ins = this.readInputs(s);
    const out = this.compute(ins, true);
    this.inState = ins;
    let changed = false;
    if (out) { for (let k = 0; k < out.length; k++) if (out[k] !== this.out[k]) changed = true; this.out = out; }
    return changed;
  }
  stamp(s) { for (const pi of this.outputs()) s.addG(this.nodes[pi], 0, 1 / this.p.rout); }
  outLevel(k) { return this.out[k] ? this.p.vdd : 0; }
  stampStep(s) {
    this.outputs().forEach((pi, k) => s.addI(0, this.nodes[pi], (this.outLevel(k) * (s.srcScale ?? 1)) / this.p.rout));
  }
  accept(s) {
    this.outputs().forEach((pi, k) => {
      this.postCurrents[pi] = (s.v(this.nodes[pi]) - this.outLevel(k)) / this.p.rout;
    });
  }
  stampAC(ac) { for (const pi of this.outputs()) ac.addY(this.nodes[pi], 0, 1 / this.p.rout); }
  readings(s) {
    const r = [];
    const names = this.pinNames ? this.pinNames() : null;
    this.localPosts().forEach((_, i) => r.push([names ? names[i] : 'Pin ' + (i + 1), s.v(this.nodes[i]), 'V']));
    return r;
  }
}

// ------------------------------------------------------------------- gates
const GATE_FN = {
  and: (a, b) => a && b, or: (a, b) => a || b, xor: (a, b) => a !== b,
  nand: (a, b) => !(a && b), nor: (a, b) => !(a || b), xnor: (a, b) => a === b,
};

class Gate2 extends Digital {
  static keywords = 'logic gate boolean';
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.4 * G, 2 * G, 1.4 * G]; }
  leads() { return [[0, -2 * G, -G, -G, -G], [1, -2 * G, G, -G, G], [2, 2 * G, 0, this.inverted() ? 1.35 * G : G, 0]]; }
  inputs() { return [0, 1]; }
  outputs() { return [2]; }
  inverted() { return /^n|xnor/.test(this.constructor.fn); }
  compute(ins) { return [GATE_FN[this.constructor.fn](ins[0], ins[1])]; }
  pinNames() { return ['A', 'B', 'Y']; }
  spice() { return `* ${this.name}: ${this.constructor.fn.toUpperCase()} gate (digital, not exported)`; }
  draw(g) {
    const fn = this.constructor.fn, ctx = g.ctx;
    const base = fn.replace(/^n(?=and|or)/, '').replace('xnor', 'xor');
    ctx.beginPath();
    const L = -G, R = G, H = 1.2 * G;
    if (base === 'and') {
      ctx.moveTo(L, -H); ctx.lineTo(0, -H); ctx.arc(0, 0, H, -Math.PI / 2, Math.PI / 2); ctx.lineTo(L, H); ctx.closePath();
    } else {
      ctx.moveTo(L - 4, -H); ctx.quadraticCurveTo(0.2 * G, -H, R + 2, 0); ctx.quadraticCurveTo(0.2 * G, H, L - 4, H);
      ctx.quadraticCurveTo(L + 0.45 * G, 0, L - 4, -H); ctx.closePath();
    }
    ctx.fillStyle = g.fill; ctx.fill();
    ctx.strokeStyle = g.body; ctx.lineWidth = g.lw; ctx.lineJoin = 'round'; ctx.stroke();
    if (base === 'xor') {
      ctx.beginPath(); ctx.moveTo(L - 11, -H); ctx.quadraticCurveTo(L + 0.3 * G - 7, 0, L - 11, H);
      ctx.strokeStyle = g.body; ctx.stroke();
    }
    if (this.inverted()) g.circle(G * 1.18, 0, 4, { stroke: g.body, width: g.lw * 0.9, fill: g.bg });
    if (g.running) g.circle(0, 0, 3, { fill: this.out[0] ? g.hi : g.lo });
  }
}

const GATE_TITLES = { and: 'AND', or: 'OR', xor: 'XOR', nand: 'NAND', nor: 'NOR', xnor: 'XNOR' };
for (const fn of Object.keys(GATE_TITLES)) {
  const C = class extends Gate2 {};
  C.fn = fn; C.type = fn; C.title = GATE_TITLES[fn] + ' Gate'; C.keywords = `logic gate ${fn}`;
  C.description = `${GATE_TITLES[fn]} gate. Inputs switch at VDD/2 with hysteresis; output drives VDD or 0 V through its output resistance.`;
  register(C);
}

class Gate1 extends Digital {
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -G, 2 * G, G]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, this.constructor.inv ? 1.25 * G : G, 0]]; }
  inputs() { return [0]; }
  outputs() { return [1]; }
  pinNames() { return ['A', 'Y']; }
  readInputs(s) {
    if (!this.constructor.schmitt) return super.readInputs(s);
    const v = s.v(this.nodes[0]), vdd = this.p.vdd;
    return [this.inState[0] ? v > vdd * 0.33 : v > vdd * 0.6];
  }
  compute(ins) { return [this.constructor.inv ? !ins[0] : ins[0]]; }
  draw(g) {
    g.poly([[-G, -0.9 * G], [G, 0], [-G, 0.9 * G]], { stroke: g.body, width: g.lw, fill: g.fill, close: true, join: 'round' });
    if (this.constructor.inv) g.circle(1.13 * G, 0, 4, { stroke: g.body, width: g.lw * 0.9, fill: g.bg });
    if (this.constructor.schmitt) {
      g.poly([[-0.65 * G, 0.25 * G], [-0.3 * G, 0.25 * G], [-0.3 * G, -0.25 * G], [0, -0.25 * G]], { stroke: g.muted, width: g.lw * 0.6 });
      g.poly([[-0.5 * G, 0.25 * G], [-0.5 * G, -0.25 * G], [-0.15 * G, -0.25 * G]], { stroke: g.muted, width: g.lw * 0.6 });
    }
  }
}
for (const [type, title, inv, schmitt] of [['not', 'NOT Gate', true, false], ['buffer', 'Buffer', false, false], ['schmitt', 'Schmitt Inverter', true, true]]) {
  const C = class extends Gate1 {};
  C.type = type; C.title = title; C.inv = inv; C.schmitt = schmitt;
  C.keywords = `logic ${type} inverter buffer 74hc14 schmitt`;
  C.description = schmitt ? 'Inverter with Schmitt-trigger input (thresholds at 33 % and 60 % of VDD) – great for RC oscillators.' : `${title}.`;
  register(C);
}

// --------------------------------------------------------- logic I/O
export class LogicInput extends Digital {
  static type = 'logicin'; static title = 'Logic Input'; static prefix = 'IN';
  static keywords = 'logic input switch toggle high low button';
  static props = [
    { key: 'on', label: 'State', type: 'bool', def: false },
    { key: 'momentary', label: 'Momentary (push button)', type: 'bool', def: false },
    ...DIGI_PROPS.map((p) => (p.key === 'rout' ? { ...p, def: 1 } : p)),
  ];
  static description = 'Tap to toggle between logic HIGH and LOW.';
  localPosts() { return [[G, 0]]; }
  localBox() { return [-1.4 * G, -0.8 * G, G, 0.8 * G]; }
  leads() { return [[0, G, 0, 0.3 * G, 0]]; }
  outputs() { return [0]; }
  compute() { return [!!this.p.on]; }
  onTap() { if (this.p.momentary) return false; this.p.on = !this.p.on; return true; }
  onPress() { if (!this.p.momentary) return false; this.p.on = true; return true; }
  onRelease() { if (!this.p.momentary) return false; this.p.on = false; return true; }
  interactive = true;
  labelPos() { return [-0.2 * G, -1.2 * G]; }
  draw(g) {
    const on = !!this.p.on;
    g.circle(-0.35 * G, 0, 0.72 * G, { fill: on ? g.hiFill : g.loFill, stroke: on ? g.hi : g.lo, width: g.lw });
    if (on) g.glow(-0.35 * G, 0, G * 1.1, g.hiRGB, 0.35);
    g.text(on ? '1' : '0', -0.35 * G, 0.5, { size: 13, color: '#fff', bold: true });
  }
}
register(LogicInput);

export class LogicOutput extends Digital {
  static type = 'logicout'; static title = 'Logic Probe'; static prefix = 'OUT';
  static keywords = 'logic output probe indicator led';
  static description = 'Shows the logic level of a node (threshold at VDD/2).';
  localPosts() { return [[-G, 0]]; }
  localBox() { return [-G, -0.8 * G, 1.4 * G, 0.8 * G]; }
  leads() { return [[0, -G, 0, -0.3 * G, 0]]; }
  inputs() { return [0]; }
  connectivity() { return null; }
  compute(ins) { this.level = ins[0]; return []; }
  labelPos() { return [0.2 * G, -1.2 * G]; }
  draw(g) {
    const on = this.inState[0];
    g.box(-0.3 * G, -0.7 * G, 1.1 * G, 0.7 * G, { fill: on ? g.hiFill : g.loFill, stroke: on ? g.hi : g.lo, width: g.lw, r: 5 });
    if (on) g.glow(0.4 * G, 0, G * 1.1, g.hiRGB, 0.35);
    g.text(on ? 'H' : 'L', 0.4 * G, 0.5, { size: 12, color: '#fff', bold: true });
  }
}
register(LogicOutput);

// ----------------------------------------------------------- flip-flops
class FlipFlop extends Digital {
  resetState() { this.q = false; this.prevClk = false; }
  outLevel(k) { const q = k === 0 ? this.q : !this.q; return q ? this.p.vdd : 0; }
  compute() { return [this.q, !this.q]; }
  boxDraw(g, title, labels) {
    const [x1, y1, x2, y2] = this.localBox();
    g.box(x1 + G, y1 + 0.2 * G, x2 - G, y2 - 0.2 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.text(title, 0, y1 + 0.75 * G, { size: 9, color: g.accent, bold: true });
    this.localPosts().forEach(([px, py], i) => {
      if (!labels[i]) return;
      const left = px < 0;
      g.text(labels[i], left ? x1 + 1.2 * G : x2 - 1.2 * G, py, { size: 8, color: g.muted, align: left ? 'left' : 'right' });
    });
    if (g.running) g.circle(0, 0.3 * G, 3.5, { fill: this.q ? g.hi : g.lo });
  }
}

export class DFlipFlop extends FlipFlop {
  static type = 'dff'; static title = 'D Flip-Flop'; static keywords = 'd flip flop register latch edge triggered memory';
  static description = 'Positive-edge-triggered D flip-flop: Q takes the value of D on each rising clock edge.';
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, -G], [2 * G, G]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, -G, -G, -G], [1, -2 * G, G, -G, G], [2, 2 * G, -G, G, -G], [3, 2 * G, G, G, G]]; }
  inputs() { return [0, 1]; }
  outputs() { return [2, 3]; }
  pinNames() { return ['D', 'CLK', 'Q', 'Q̄']; }
  compute(ins, settle) {
    const [d, clk] = ins;
    if (!settle && clk && !this.prevClk) this.q = d;
    this.prevClk = clk;
    return [this.q, !this.q];
  }
  draw(g) { this.boxDraw(g, 'D-FF', ['D', '▷CLK', 'Q', 'Q̄']); }
}
register(DFlipFlop);

export class TFlipFlop extends DFlipFlop {
  static type = 'tff'; static title = 'T Flip-Flop'; static keywords = 't toggle flip flop divider';
  static description = 'Toggle flip-flop: Q inverts on each rising clock edge while T is high (frequency divider).';
  pinNames() { return ['T', 'CLK', 'Q', 'Q̄']; }
  compute(ins, settle) {
    const [t, clk] = ins;
    if (!settle && clk && !this.prevClk && t) this.q = !this.q;
    this.prevClk = clk;
    return [this.q, !this.q];
  }
  draw(g) { this.boxDraw(g, 'T-FF', ['T', '▷CLK', 'Q', 'Q̄']); }
}
register(TFlipFlop);

export class JKFlipFlop extends FlipFlop {
  static type = 'jkff'; static title = 'JK Flip-Flop'; static keywords = 'jk flip flop';
  static description = 'JK flip-flop (rising edge): J=K=1 toggles, J=1 sets, K=1 resets.';
  localPosts() { return [[-2 * G, -G], [-2 * G, 0], [-2 * G, G], [2 * G, -G], [2 * G, G]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, -G, -G, -G], [1, -2 * G, 0, -G, 0], [2, -2 * G, G, -G, G], [3, 2 * G, -G, G, -G], [4, 2 * G, G, G, G]]; }
  inputs() { return [0, 1, 2]; }
  outputs() { return [3, 4]; }
  pinNames() { return ['J', 'CLK', 'K', 'Q', 'Q̄']; }
  compute(ins, settle) {
    const [j, clk, k] = ins;
    if (!settle && clk && !this.prevClk) {
      if (j && k) this.q = !this.q; else if (j) this.q = true; else if (k) this.q = false;
    }
    this.prevClk = clk;
    return [this.q, !this.q];
  }
  draw(g) { this.boxDraw(g, 'JK-FF', ['J', '▷CLK', 'K', 'Q', 'Q̄']); }
}
register(JKFlipFlop);

export class SRLatch extends FlipFlop {
  static type = 'srlatch'; static title = 'SR Latch'; static keywords = 'sr latch set reset nor nand memory';
  static description = 'Level-sensitive SR latch (NOR type): S sets, R resets, S=R=1 is invalid (both outputs low).';
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, -G], [2 * G, G]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, -G, -G, -G], [1, -2 * G, G, -G, G], [2, 2 * G, -G, G, -G], [3, 2 * G, G, G, G]]; }
  inputs() { return [0, 1]; }
  outputs() { return [2, 3]; }
  pinNames() { return ['S', 'R', 'Q', 'Q̄']; }
  compute(ins) {
    const [sI, rI] = ins;
    this.invalid = sI && rI;
    if (sI && !rI) this.q = true; else if (rI && !sI) this.q = false;
    return [this.q, !this.q];
  }
  outLevel(k) {
    if (this.invalid) return 0;
    return super.outLevel(k);
  }
  draw(g) { this.boxDraw(g, 'SR', ['S', 'R', 'Q', 'Q̄']); }
}
register(SRLatch);

// ------------------------------------------------------------- counter
export class Counter extends Digital {
  static type = 'counter'; static title = '4-bit Counter'; static keywords = 'counter binary 74hc161 74hc393 divider';
  static description = '4-bit binary up-counter: increments on rising clock edges, synchronous-free reset when RST is high.';
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, -2 * G], [2 * G, -G], [2 * G, 0], [2 * G, G]]; }
  localBox() { return [-2 * G, -2.8 * G, 2 * G, 1.8 * G]; }
  leads() {
    return [[0, -2 * G, -G, -G, -G], [1, -2 * G, G, -G, G], [2, 2 * G, -2 * G, G, -2 * G], [3, 2 * G, -G, G, -G], [4, 2 * G, 0, G, 0], [5, 2 * G, G, G, G]];
  }
  inputs() { return [0, 1]; }
  outputs() { return [2, 3, 4, 5]; }
  pinNames() { return ['CLK', 'RST', 'Q0', 'Q1', 'Q2', 'Q3']; }
  resetState() { this.count = 0; this.prevClk = false; }
  compute(ins, settle) {
    const [clk, rst] = ins;
    if (rst) this.count = 0;
    else if (!settle && clk && !this.prevClk) this.count = (this.count + 1) & 15;
    this.prevClk = clk;
    return [0, 1, 2, 3].map((b) => !!(this.count >> b & 1));
  }
  readings(s) { return [['Count', this.count, ''], ...super.readings(s)]; }
  draw(g) {
    g.box(-G, -2.6 * G, G, 1.6 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.text('CTR4', 0, -2.15 * G, { size: 8, color: g.accent, bold: true });
    g.text('▷', -0.75 * G, -G, { size: 8, color: g.muted, align: 'left' });
    g.text('R', -0.75 * G, G, { size: 8, color: g.muted, align: 'left' });
    ['Q0', 'Q1', 'Q2', 'Q3'].forEach((t, i) => g.text(t, 0.8 * G, (i - 2) * G, { size: 7, color: g.muted, align: 'right' }));
    g.text(String(this.count ?? 0), -0.1 * G, 0.1 * G, { size: 14, color: g.text1, bold: true });
  }
}
register(Counter);

// ---------------------------------------------------- 7-segment decoder
const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71];

export class SevenSegDecoder extends Digital {
  static type = 'decoder7'; static title = 'BCD→7-Seg Decoder'; static keywords = 'decoder bcd seven segment 7447 4511 hex';
  static description = 'Hex/BCD to 7-segment decoder (active-high outputs a–g, like the CD4511 for 0–9, extended to A–F).';
  localPosts() {
    const p = [[-2 * G, -2 * G], [-2 * G, -G], [-2 * G, 0], [-2 * G, G]];
    for (let i = 0; i < 7; i++) p.push([2 * G, (i - 3) * G]);
    return p;
  }
  localBox() { return [-2 * G, -3.6 * G, 2 * G, 3.6 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, x < 0 ? -G : G, y]); }
  inputs() { return [0, 1, 2, 3]; }
  outputs() { return [4, 5, 6, 7, 8, 9, 10]; }
  pinNames() { return ['A0', 'A1', 'A2', 'A3', 'a', 'b', 'c', 'd', 'e', 'f', 'g']; }
  compute(ins) {
    this.code = ins.reduce((a, b, i) => a | ((b ? 1 : 0) << i), 0);
    const m = SEG[this.code];
    return [0, 1, 2, 3, 4, 5, 6].map((i) => !!(m >> i & 1));
  }
  draw(g) {
    g.box(-G, -3.4 * G, G, 3.4 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.text('DEC', 0, -2.9 * G, { size: 8, color: g.accent, bold: true });
    ['A0', 'A1', 'A2', 'A3'].forEach((t, i) => g.text(t, -0.8 * G, (i - 2) * G, { size: 7, color: g.muted, align: 'left' }));
    'abcdefg'.split('').forEach((t, i) => g.text(t, 0.8 * G, (i - 3) * G, { size: 7, color: g.muted, align: 'right' }));
  }
}
register(SevenSegDecoder);

export class SevenSeg extends Digital {
  static type = 'sevenseg'; static title = '7-Segment Display'; static category = 'Output';
  static prefix = 'DS'; static keywords = 'seven segment display led digit numeric';
  static props = [
    { key: 'color', label: 'Colour', type: 'select', def: 'red', options: [['red', 'Red'], ['green', 'Green'], ['blue', 'Blue'], ['amber', 'Amber']] },
    { key: 'vdd', label: 'Threshold ×2', unit: 'V', def: 5, min: 0.5, max: 30 },
  ];
  static description = 'Logic-level 7-segment display: a segment lights when its input is above half the logic level.';
  localPosts() { const p = []; for (let i = 0; i < 7; i++) p.push([-2 * G, (i - 3) * G]); return p; }
  localBox() { return [-2 * G, -3.6 * G, 2.6 * G, 3.6 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, -1.2 * G, y]); }
  inputs() { return [0, 1, 2, 3, 4, 5, 6]; }
  connectivity() { return null; }
  compute() { return []; }
  pinNames() { return 'abcdefg'.split(''); }
  draw(g) {
    g.box(-1.2 * G, -3.4 * G, 2.6 * G, 3.4 * G, { fill: '#0b0f14', stroke: g.body, width: g.lw * 0.8, r: 5 });
    const col = { red: '255,48,48', green: '60,255,110', blue: '70,150,255', amber: '255,176,0' }[this.p.color];
    const on = this.inState || [];
    const X0 = -0.1 * G, X1 = 1.5 * G, Y0 = -2.3 * G, Y1 = 0, Y2 = 2.3 * G, w = 0.28 * G;
    const segs = [[X0, Y0, X1, Y0], [X1, Y0, X1, Y1], [X1, Y1, X1, Y2], [X0, Y2, X1, Y2], [X0, Y1, X0, Y2], [X0, Y0, X0, Y1], [X0, Y1, X1, Y1]];
    const ctx = g.ctx;
    segs.forEach(([a, b, c, d], i) => {
      const lit = on[i];
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d);
      ctx.lineCap = 'round'; ctx.lineWidth = w;
      if (lit) { ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = 12; }
      ctx.strokeStyle = lit ? `rgb(${col})` : 'rgba(255,255,255,0.07)';
      ctx.stroke(); ctx.shadowBlur = 0;
    });
    'abcdefg'.split('').forEach((t, i) => g.text(t, -1.5 * G, (i - 3) * G - 6, { size: 7, color: g.muted }));
  }
}
register(SevenSeg);

// ---------------------------------------------------------------- ADC/DAC
export class ADC extends Digital {
  static type = 'adc'; static title = '4-bit ADC'; static category = 'Digital';
  static keywords = 'adc analog to digital converter flash';
  static description = '4-bit flash ADC: code = floor(16·Vin/Vref), clamped to 0–15.';
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, -2 * G], [2 * G, -G], [2 * G, 0], [2 * G, G]]; }
  localBox() { return [-2 * G, -2.8 * G, 2 * G, 1.8 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, x < 0 ? -G : G, y]); }
  inputs() { return []; }
  outputs() { return [2, 3, 4, 5]; }
  pinNames() { return ['Vin', 'Vref', 'D0', 'D1', 'D2', 'D3']; }
  connectivity() { return [[2, 3, 4, 5, 'gnd']]; }
  resetState() { this.code = 0; }
  sample(s) {
    const vin = s.v(this.nodes[0]), vref = s.v(this.nodes[1]);
    this.code = vref > 1e-6 ? Math.max(0, Math.min(15, Math.floor((16 * vin) / vref))) : 0;
    return [0, 1, 2, 3].map((b) => !!(this.code >> b & 1));
  }
  preStep(s) {
    const o = this.sample(s);
    if (o.some((v, k) => v !== this.out[k])) s.event = true;
    this.out = o;
  }
  digitalSettle(s) { const o = this.sample(s); const ch = o.some((v, k) => v !== this.out[k]); this.out = o; return ch; }
  readings(s) { return [['Code', this.code, ''], ...super.readings(s)]; }
  draw(g) {
    g.box(-G, -2.6 * G, G, 1.6 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.text('ADC', 0, -2.15 * G, { size: 8, color: g.accent, bold: true });
    g.text('IN', -0.8 * G, -G, { size: 7, color: g.muted, align: 'left' });
    g.text('REF', -0.8 * G, G, { size: 7, color: g.muted, align: 'left' });
    ['D0', 'D1', 'D2', 'D3'].forEach((t, i) => g.text(t, 0.8 * G, (i - 2) * G, { size: 7, color: g.muted, align: 'right' }));
    g.text(String(this.code ?? 0), -0.1 * G, 0, { size: 12, color: g.text1, bold: true });
  }
}
register(ADC);

export class DAC extends Digital {
  static type = 'dac'; static title = '4-bit DAC'; static category = 'Digital';
  static keywords = 'dac digital to analog converter r2r';
  static props = [
    { key: 'vref', label: 'Reference voltage', unit: 'V', def: 5, min: 0, max: 100, knob: true },
    ...DIGI_PROPS,
  ];
  static description = '4-bit DAC: Vout = Vref · code / 16.';
  localPosts() { return [[-2 * G, -2 * G], [-2 * G, -G], [-2 * G, 0], [-2 * G, G], [2 * G, -G]]; }
  localBox() { return [-2 * G, -2.8 * G, 2 * G, 1.8 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, x < 0 ? -G : G, y]); }
  inputs() { return [0, 1, 2, 3]; }
  outputs() { return [4]; }
  pinNames() { return ['D0', 'D1', 'D2', 'D3', 'OUT']; }
  resetState() { this.code = 0; }
  compute(ins) { this.code = ins.reduce((a, b, i) => a | ((b ? 1 : 0) << i), 0); return [this.code]; }
  outLevel() { return (this.p.vref * (this.code || 0)) / 16; }
  preStep(s) {
    const ins = this.readInputs(s);
    const old = this.code;
    this.inState = ins;
    this.compute(ins);
    if (old !== this.code) s.event = true;
  }
  digitalSettle(s) { const old = this.code; this.inState = this.readInputs(s); this.compute(this.inState); return old !== this.code; }
  readings(s) { return [['Code', this.code, ''], ['Vout', s.v(this.nodes[4]), 'V']]; }
  draw(g) {
    g.box(-G, -2.6 * G, G, 1.6 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    g.text('DAC', 0, -2.15 * G, { size: 8, color: g.accent, bold: true });
    ['D0', 'D1', 'D2', 'D3'].forEach((t, i) => g.text(t, -0.8 * G, (i - 2) * G, { size: 7, color: g.muted, align: 'left' }));
    g.text('OUT', 0.8 * G, -G, { size: 7, color: g.muted, align: 'right' });
  }
}
register(DAC);
