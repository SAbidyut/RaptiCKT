// More digital and mixed-signal ICs: demultiplexer, encoders, subtractors,
// clocked SR flip-flop, ring / Johnson counters, SISO / PISO (74HC165) /
// universal (74HC194) shift registers, 8-bit ADC and DAC, logic level
// converter, 16×4 RAM, 16×8 ROM (editable contents) and a programmable
// count-down timer.

import { register } from './base.js';
import { DIGI_PROPS } from './digital.js';
import { chip, seq, P, bits, val, Chip } from './digital2.js';

const L = (n, side = 'L') => P(n, side, 'i');
const O = (n, side = 'R') => P(n, side, 'o');
const range = (n) => Array.from({ length: n }, (_, k) => k);

// ------------------------------------------------------------ combinational
chip('demux4', 'Demultiplexer 1-to-4', 'DMX', [L('D'), L('S0', 'B'), L('S1', 'B'), ...range(4).map((k) => O('Y' + k))],
  (i) => { const k = (i[1] ? 1 : 0) + (i[2] ? 2 : 0); return range(4).map((j) => i[0] && j === k); },
  'demultiplexer demux 1 to 4 data distributor 74hc139 74hc155', 'Routes the data input D to the output selected by S1S0; the other outputs stay low.');
chip('enc8to3', 'Priority Encoder 8-to-3 (74HC148)', 'ENC8', [...range(8).map((k) => L('I' + k)), O('A0'), O('A1'), O('A2'), O('GS')],
  (i) => { let k = -1; for (let j = 7; j >= 0; j--) if (i[j]) { k = j; break; } return k < 0 ? [false, false, false, false] : [...bits(k, 3), true]; },
  'priority encoder 8 to 3 74148 keyboard encoder interrupt', 'Outputs the binary number of the highest active input (I7 has priority); GS = any input active.', { chipOpts: { dense: true } });
chip('enc4to2s', 'Encoder 4-to-2 (no priority)', 'ENC', [L('I0'), L('I1'), L('I2'), L('I3'), O('A0'), O('A1')],
  (i) => [i[1] || i[3], i[2] || i[3]], 'encoder 4 to 2 binary encoder or gates',
  'Simple binary encoder made of OR gates: A0 = I1 + I3, A1 = I2 + I3. Exactly one input should be high (I0 gives 00, like no input — use the priority encoder when inputs can overlap).');
chip('halfsub', 'Half Subtractor', 'HS', [L('A'), L('B'), O('D'), O('Bo')],
  (i) => [i[0] !== i[1], !i[0] && i[1]], 'half subtractor binary subtraction difference borrow', 'D = A ⊕ B (difference), Bo = Ā·B (borrow out).');
chip('fullsub', 'Full Subtractor', 'FS', [L('A'), L('B'), L('Bin'), O('D'), O('Bo')],
  (i) => { const [a, b, bi] = i; const x = a !== b; return [x !== bi, (!a && b) || (bi && !x)]; },
  'full subtractor borrow in borrow out', 'D = A ⊕ B ⊕ Bin, Bo = Ā·B + Bin·(A ⊙ B) — computes A − B − Bin.');
chip('sub4', '4-bit Subtractor', 'A−B',
  [...range(4).map((k) => L('A' + k)), ...range(4).map((k) => L('B' + k)), L('Bin'), ...range(4).map((k) => O('D' + k)), O('Bo')],
  function (i) { const a = val(i.slice(0, 4)), b = val(i.slice(4, 8)), d = a - b - (i[8] ? 1 : 0); this.diff = d; return [...bits(d & 15, 4), d < 0]; },
  '4 bit subtractor binary subtraction two complement borrow', 'D = A − B − Bin (4 bits); Bo = 1 when the result is negative (the D bits then hold the two\'s-complement value).',
  { chipOpts: { dense: true }, shown() { return this.diff ?? 0; } });

// --------------------------------------------------------------- sequential
seq('srff', 'SR Flip-Flop (clocked)', 'SR-FF', [L('S'), L('CLK'), L('R'), O('Q'), O('Q̄')],
  function (i, settle) {
    if (this.edge(i[1], settle)) { if (i[0] && !i[2]) this.st = 1; else if (i[2] && !i[0]) this.st = 0; else if (i[0] && i[2]) this.bad = true; }
    if (!(i[0] && i[2])) this.bad = false;
    return [!!this.st, !this.st];
  }, 'sr flip flop clocked set reset synchronous', 'On each rising clock edge: S=1 sets Q, R=1 resets Q, S=R=0 holds. S=R=1 is the forbidden input (Q holds here).',
  { shown() { return this.bad ? 'S=R=1!' : ''; } });
seq('ring4', 'Ring Counter (4-bit)', 'RING', [L('CLK'), L('RST'), ...range(4).map((k) => O('Q' + k))],
  function (i, settle) {
    if (i[1] || !this.st) { this.st = 1; this.prevClk = i[0]; } else if (this.edge(i[0], settle)) this.st = ((this.st << 1) | (this.st >> 3)) & 15;
    return bits(this.st, 4);
  }, 'ring counter one hot circulating shift register sequencer', 'A single 1 circulates Q0 → Q1 → Q2 → Q3 → Q0 on each rising clock edge (4 states). RST loads 0001.',
  { shown() { return (this.st ?? 1).toString(2).padStart(4, '0'); } });
seq('johnson4', 'Johnson Counter (4-bit)', 'JOHN', [L('CLK'), L('RST'), ...range(4).map((k) => O('Q' + k))],
  function (i, settle) {
    if (i[1]) { this.st = 0; this.prevClk = i[0]; } else if (this.edge(i[0], settle)) this.st = ((this.st << 1) | ((this.st >> 3) & 1 ? 0 : 1)) & 15;
    return bits(this.st, 4);
  }, 'johnson counter twisted ring counter mobius 8 state', 'Twisted-ring counter: the inverted last bit feeds back, giving 8 states 0000 → 0001 → 0011 → 0111 → 1111 → 1110 → 1100 → 1000 with only one bit changing per step.',
  { shown() { return (this.st ?? 0).toString(2).padStart(4, '0'); } });
seq('siso4', 'Shift Register 4-bit (SISO)', 'SISO', [L('DATA'), L('CLK'), L('RST'), O('SOUT')],
  function (i, settle) {
    if (i[2]) { this.st = 0; this.prevClk = i[1]; } else if (this.edge(i[1], settle)) this.st = ((this.st << 1) | (i[0] ? 1 : 0)) & 15;
    return [!!((this.st >> 3) & 1)];
  }, 'shift register serial in serial out siso delay line', 'Serial in, serial out: each rising clock edge shifts DATA in; it appears at SOUT four clocks later.',
  { shown() { return (this.st ?? 0).toString(2).padStart(4, '0'); } });
seq('piso8', 'Shift Register 8-bit PISO (74HC165)', '165',
  [...range(8).map((k) => L('D' + k)), L('SER'), L('SH/LD̄'), L('CLK'), O('Q7')],
  function (i, settle) {
    if (!i[9]) this.st = val(i.slice(0, 8)); // SH/LD̄ low: asynchronous parallel load
    else if (this.edge(i[10], settle)) this.st = ((this.st << 1) | (i[8] ? 1 : 0)) & 255;
    if (!i[9]) this.prevClk = i[10];
    return [!!((this.st >> 7) & 1)];
  }, 'shift register parallel in serial out piso 74hc165 input expander', 'Parallel in, serial out: with SH/LD̄ low the eight inputs are loaded; with it high each rising clock edge shifts the bits towards Q7 (D7 comes out first, SER fills from D0).',
  { chipOpts: { dense: true }, shown() { return (this.st ?? 0).toString(2).padStart(8, '0'); } });
seq('univ194', 'Universal Shift Register (74HC194)', '194',
  [...range(4).map((k) => L('D' + k)), L('DSR'), L('DSL'), L('S0'), L('S1'), L('CLK'), L('CLR'), ...range(4).map((k) => O('Q' + k))],
  function (i, settle) {
    if (i[9]) { this.st = 0; this.prevClk = i[8]; return bits(0, 4); }
    if (this.edge(i[8], settle)) {
      const m = (i[6] ? 1 : 0) + (i[7] ? 2 : 0);
      if (m === 1) this.st = ((this.st << 1) | (i[4] ? 1 : 0)) & 15; // shift right: DSR → Q0 → Q3
      else if (m === 2) this.st = (this.st >> 1) | (i[5] ? 8 : 0); // shift left: DSL → Q3 → Q0
      else if (m === 3) this.st = val(i.slice(0, 4)); // parallel load
    }
    return bits(this.st, 4);
  }, 'universal shift register 74194 bidirectional parallel load pipo sipo piso siso', 'Four modes on S1S0 at each rising clock edge: 00 hold, 01 shift right (DSR enters Q0), 10 shift left (DSL enters Q3), 11 parallel load D0–D3. So it works as SISO, SIPO, PISO or PIPO. CLR (high) clears.',
  { chipOpts: { dense: true }, shown() { return (this.st ?? 0).toString(2).padStart(4, '0'); } });
seq('dtimer', 'Programmable Timer (count-down)', 'TMR',
  [L('CLK'), L('START'), L('RST'), O('OUT'), O('DONE')],
  function (i, settle) {
    const n = Math.max(1, Math.round(this.p.n));
    if (i[2]) { this.st = 0; this.go = false; this.prevStart = i[1]; this.prevClk = i[0]; return [false, false]; }
    if (!settle && i[1] && !this.prevStart) { this.st = n; this.go = true; this.ran = true; }
    this.prevStart = i[1];
    if (this.edge(i[0], settle) && this.go && this.st > 0) { this.st--; if (this.st === 0) this.go = false; }
    return [this.go, this.ran && !this.go];
  }, 'programmable timer count down timer digital timer delay cd4536 interval',
  'Digital interval timer: a rising edge on START loads N; OUT stays high while it counts N clock pulses down to zero, then DONE goes high. Use a 1 Hz clock for an N-second timer. RST aborts and clears DONE.',
  { props: [{ key: 'n', label: 'Count N (clock pulses)', unit: '', def: 10, min: 1, max: 1e7, knob: true }, ...DIGI_PROPS], shown() { return this.st ?? 0; },
    resetState() { this.st = 0; this.prevClk = false; this.go = false; this.prevStart = false; this.ran = false; } });

// ------------------------------------------------------------ mixed signal
class AnalogInChip extends Chip {
  inputs() { return this.constructor.digIn || []; }
}

export class ADC8 extends AnalogInChip {
  static type = 'adc8'; static title = '8-bit ADC (ADC0804)'; static chip = 'ADC8';
  static keywords = 'adc 8 bit analog to digital converter adc0804 adc0808 successive approximation';
  static pins = [P('VIN', 'L', 'a'), P('VREF', 'L', 'a'), ...range(8).map((k) => O('D' + k))];
  static chipOpts = { dense: true };
  static description = '8-bit analog-to-digital converter: code = round(256 · Vin / Vref) clamped to 0–255 (1 LSB = Vref/256 ≈ 19.5 mV at 5 V).';
  resetState() { this.code = 0; }
  sample(s) {
    const vin = s.v(this.nodes[0]), vref = s.v(this.nodes[1]);
    this.code = vref > 1e-6 ? Math.max(0, Math.min(255, Math.round((256 * vin) / vref - 0.5))) : 0;
    return bits(this.code, 8);
  }
  preStep(s) { const o = this.sample(s); if (o.some((v, k) => v !== this.out[k])) s.event = true; this.out = o; }
  digitalSettle(s) { const o = this.sample(s), ch = o.some((v, k) => v !== this.out[k]); this.out = o; return ch; }
  shown() { return this.code ?? 0; }
}
register(ADC8);

export class DAC8 extends Chip {
  static type = 'dac8'; static title = '8-bit DAC (R-2R)'; static chip = 'DAC8';
  static keywords = 'dac 8 bit digital to analog converter r2r dac0808 ladder';
  static props = [{ key: 'vref', label: 'Reference voltage', unit: 'V', def: 5, min: 0, max: 100, knob: true }, ...DIGI_PROPS.map((p) => (p.key === 'rout' ? { ...p, def: 100 } : p))];
  static pins = [...range(8).map((k) => L('D' + k)), O('OUT')];
  static chipOpts = { dense: true };
  static description = '8-bit R-2R digital-to-analog converter: OUT = Vref · code / 256 behind its output resistance.';
  resetState() { this.code = 0; }
  compute(ins) { this.code = val(ins); return [true]; }
  outLevel() { return (this.p.vref * (this.code || 0)) / 256; }
  preStep(s) { const old = this.code; this.inState = this.readInputs(s); this.compute(this.inState); if (old !== this.code) s.event = true; }
  digitalSettle(s) { const old = this.code; this.inState = this.readInputs(s); this.compute(this.inState); return old !== this.code; }
  shown() { return this.code ?? 0; }
}
register(DAC8);

export class LevelShifter extends Chip {
  static type = 'levelshift'; static title = 'Logic Level Converter (4-ch)'; static chip = 'LVL';
  static keywords = 'logic level converter level shifter 3.3v 5v txs0104 bss138 translator';
  static props = [
    { key: 'vlow', label: 'Low-side logic level (A)', unit: 'V', def: 3.3, min: 0.8, max: 15, knob: true },
    { key: 'vdd', label: 'High-side logic level (B)', unit: 'V', def: 5, min: 0.8, max: 30 },
    { key: 'rout', label: 'Output resistance', unit: 'Ω', def: 50, min: 0.01, max: 1e5 },
  ];
  static pins = [L('A1'), L('A2'), L('A3'), L('A4'), O('B1'), O('B2'), O('B3'), O('B4')];
  static description = 'Four-channel level translator: inputs A1–A4 switch at half the low-side level (e.g. 1.65 V for 3.3 V logic) and the B outputs drive the high-side level (e.g. 5 V) — lets 3.3 V and 5 V logic talk to each other.';
  readInputs(s) {
    const th = this.p.vlow / 2, h = this.p.vlow * 0.08;
    return this.inputs().map((pi, k) => { const v = s.v(this.nodes[pi]); return this.inState[k] ? v > th - h : v > th + h; });
  }
  compute(ins) { return ins; }
}
register(LevelShifter);

export class RAM16 extends Chip {
  static type = 'ram16x4'; static title = 'RAM 16×4 (74HC189)'; static chip = 'RAM';
  static keywords = 'ram memory 16x4 static ram sram 74189 read write memory';
  static pins = [...range(4).map((k) => L('A' + k)), ...range(4).map((k) => L('D' + k)), L('WE'), ...range(4).map((k) => O('Q' + k))];
  static chipOpts = { dense: true };
  static description = '16 words × 4 bits of static RAM. A0–A3 select the word; while WE is high the data D0–D3 is written into it; Q0–Q3 always show the stored word at the current address. Contents are cleared when the simulation restarts.';
  resetState() { this.mem = new Array(16).fill(0); this.addr = 0; }
  compute(i) {
    this.addr = val(i.slice(0, 4));
    if (i[8]) this.mem[this.addr] = val(i.slice(4, 8));
    return bits(this.mem[this.addr], 4);
  }
  shown() { return `${this.addr ?? 0}:${((this.mem && this.mem[this.addr ?? 0]) || 0).toString(16).toUpperCase()}`; }
}
register(RAM16);

export class ROM16 extends Chip {
  static type = 'rom16x8'; static title = 'ROM 16×8 (programmable)'; static chip = 'ROM';
  static keywords = 'rom eprom eeprom memory lookup table 16x8 program memory character generator';
  static props = [
    { key: 'data', label: 'Contents (16 hex bytes)', type: 'text', def: '3F 06 5B 4F 66 6D 7D 07 7F 6F 77 7C 39 5E 79 71' },
    ...DIGI_PROPS,
  ];
  static pins = [...range(4).map((k) => L('A' + k)), L('CE'), ...range(8).map((k) => O('D' + k))];
  static chipOpts = { dense: true };
  static description = 'Read-only memory with 16 bytes you can edit (hex, separated by spaces). While CE is high the byte at address A3–A0 appears on D0–D7. The default contents are the 7-segment patterns for 0–F (D0 = segment a … D6 = g), so it works as a hex-to-7-segment decoder.';
  bytes() {
    if (this._src !== this.p.data) {
      this._src = this.p.data;
      const t = String(this.p.data).trim().split(/[\s,;]+/).filter(Boolean).map((x) => parseInt(x, 16));
      this._bytes = range(16).map((k) => (Number.isFinite(t[k]) ? t[k] & 255 : 0));
    }
    return this._bytes;
  }
  compute(i) { this.addr = val(i.slice(0, 4)); return i[4] ? bits(this.bytes()[this.addr], 8) : bits(0, 8); }
  shown() { return `${this.addr ?? 0}:${this.bytes()[this.addr ?? 0].toString(16).toUpperCase().padStart(2, '0')}`; }
}
register(ROM16);
