// More switches and relays: voltage- and current-controlled switches (SPICE S
// and W elements), DIP switch, key, foot, toggle, slide and illuminated rocker
// switches, latching (bistable) relay, SPST / DPST relays, control
// (auxiliary) relay 2NO+2NC, contactor with NO + NC auxiliary contacts, 3-pole
// thermal overload relay, phase-failure / sequence relay and over/under-voltage
// relay.

import { Element, register, GRID } from './base.js';
import { MultiSwitch, CoilRelay, stampSw, stampSwAC } from './switches2.js';
import { withChip, CycleMeter } from './kit.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

// ---------------------------------------------------- controlled switches
class CtrlSwitch extends Element {
  static category = 'Switches';
  static prefix = 'S';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; this.on = false; }
  // posts: S1, S2 (switch), C+, C− (control)
  localPosts() { return [[-2 * G, 0], [2 * G, 0], [-G, 2 * G], [G, 2 * G]]; }
  pinNames() { return ['S1', 'S2', 'C+', 'C−']; }
  localBox() { return [-2 * G, -1.1 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -0.8 * G, 0], [1, 2 * G, 0, 0.8 * G, 0], [2, -G, 2 * G, -G, G], [3, G, 2 * G, G, G]]; }
  connectivity() { return [[0, 1], [2, 3]]; }
  reset() { this.on = false; this.postCurrents.fill(0); }
  gs() { return this.on ? 1 / Math.max(this.p.ron, 1e-6) : 1 / Math.max(this.p.roff, 1); }
  ctrl() { return 0; }
  decide(x) { return this.on ? x > this.p.off : x > this.p.on; }
  preStep(s) { const n = this.decide(this.ctrl(s)); if (n !== this.on) { this.on = n; s.dirty = true; s.event = true; } }
  digitalSettle(s) { const n = this.decide(this.ctrl(s)); if (n !== this.on) { this.on = n; s.dirty = true; return true; } return false; }
  readings(s) { return [['State', this.on ? 'Closed' : 'Open', ''], ['Switch current', this.i, 'A'], ['Control', this.ctrl(s), this.constructor.cunit]]; }
  drawBody(g) {
    g.circle(-0.8 * G, 0, 2.6, { fill: g.vc(g.pv(0)) }); g.circle(0.8 * G, 0, 2.6, { fill: g.vc(g.pv(1)) });
    if (this.on) g.line(-0.8 * G, 0, 0.8 * G, 0, g.vc(g.pv(0)), g.lw * 1.1); else g.line(-0.8 * G, 0, 0.6 * G, -0.6 * G, g.body, g.lw * 1.1);
    g.box(-1.3 * G, 0.45 * G, 1.3 * G, G, { stroke: g.body, width: g.lw * 0.7, fill: g.fill, r: 3 });
    g.poly([[0, -0.25 * G], [0, 0.45 * G]], { stroke: g.muted, width: g.lw * 0.5, dash: [2, 2] });
  }
}

export class VCSwitch extends CtrlSwitch {
  static type = 'vcsw'; static title = 'Voltage-Controlled Switch'; static cunit = 'V';
  static keywords = 'voltage controlled switch spice s switch analog switch threshold ideal switch';
  static props = [
    { key: 'on', label: 'Turn-on control voltage', unit: 'V', def: 2.5, min: -1e4, max: 1e4, knob: true },
    { key: 'off', label: 'Turn-off control voltage', unit: 'V', def: 1.5, min: -1e4, max: 1e4 },
    { key: 'ron', label: 'On resistance', unit: 'Ω', def: 0.01, min: 1e-6, max: 1e6, log: true },
    { key: 'roff', label: 'Off resistance', unit: 'Ω', def: 1e9, min: 1, max: 1e15, log: true },
  ];
  static description = 'SPICE-style voltage-controlled switch: S1–S2 closes when V(C+) − V(C−) rises above the turn-on voltage and opens when it falls below the turn-off voltage (hysteresis). The control input draws no current.';
  ctrl(s) { return s.v(this.nodes[2]) - s.v(this.nodes[3]); }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], this.gs()); s.addG(this.nodes[2], this.nodes[3], 1e-12); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], this.gs()); }
  accept(s) { const i = (s.v(this.nodes[0]) - s.v(this.nodes[1])) * this.gs(); this.postCurrents = [i, -i, 0, 0]; this.i = i; if (this.decide(this.ctrl(s)) !== this.on) s.event = true; }
  valueLabel() { return `>${fmtShort(this.p.on, 'V')}`; }
  draw(g) { this.drawBody(g); g.text('V', 0, 0.73 * G, { size: 7, color: g.accent, bold: true, follow: true }); }
}
register(VCSwitch);

export class CCSwitch extends CtrlSwitch {
  static type = 'ccsw'; static title = 'Current-Controlled Switch'; static cunit = 'A';
  static keywords = 'current controlled switch spice w switch overcurrent sensing threshold';
  static props = [
    { key: 'on', label: 'Turn-on control current', unit: 'A', def: 0.1, min: -1e4, max: 1e4, knob: true },
    { key: 'off', label: 'Turn-off control current', unit: 'A', def: 0.05, min: -1e4, max: 1e4 },
    { key: 'ron', label: 'On resistance', unit: 'Ω', def: 0.01, min: 1e-6, max: 1e6, log: true },
    { key: 'roff', label: 'Off resistance', unit: 'Ω', def: 1e9, min: 1, max: 1e15, log: true },
  ];
  static description = 'SPICE-style current-controlled switch: the control path C+ → C− is a zero-volt current sensor in series with your circuit; S1–S2 closes when that current exceeds the turn-on value and opens below the turn-off value.';
  branchCount() { return 1; }
  ctrl(s) { return s.x[this.branches[0]]; }
  stamp(s) {
    const [a, b, cp, cn] = this.nodes, k = this.branches[0];
    s.addG(a, b, this.gs());
    s.addBranchKCL(cp, cn, k); s.addA(k, cp - 1, 1); s.addA(k, cn - 1, -1);
  }
  stampAC(ac) {
    const [a, b, cp, cn] = this.nodes, k = this.branches[0];
    ac.addY(a, b, this.gs()); ac.addBranchKCL(cp, cn, k); ac.addA(k, cp - 1, 1); ac.addA(k, cn - 1, -1);
  }
  accept(s) {
    const i = (s.v(this.nodes[0]) - s.v(this.nodes[1])) * this.gs(), ic = s.x[this.branches[0]];
    this.postCurrents = [i, -i, ic, -ic]; this.i = i;
    if (this.decide(ic) !== this.on) s.event = true;
  }
  valueLabel() { return `>${fmtShort(this.p.on, 'A')}`; }
  draw(g) { this.drawBody(g); g.text('I', 0, 0.73 * G, { size: 7, color: g.accent, bold: true, follow: true }); }
}
register(CCSwitch);

// ------------------------------------------------------------ manual switches
export class DIPSwitch extends MultiSwitch {
  static type = 'dipsw'; static title = 'DIP Switch (4-way)'; static keywords = 'dip switch 4 position piano switch configuration address selector';
  static props = [{ key: 'v', label: 'Switch pattern (0–15)', unit: '', def: 0, min: 0, max: 15, knob: true }];
  static description = 'Four independent on/off switches in one package: switch k (pins kL–kR) is ON when bit k of the pattern is set. Tap to count the pattern 0 → 15; set it in the properties or with the knob.';
  ys() { return [-2 * G, -G, 0, G]; }
  localPosts() { return [...this.ys().map((y) => [-2 * G, y]), ...this.ys().map((y) => [2 * G, y])]; }
  localBox() { return [-2 * G, -2.6 * G, 2 * G, 1.6 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 0.55 * G, y]); }
  paths() { return [[0, 4], [1, 5], [2, 6], [3, 7]]; }
  bitsNow() { const v = Math.round(this.p.v) & 15; return [0, 1, 2, 3].map((k) => !!((v >> k) & 1)); }
  closedSet() { return this.bitsNow(); }
  onTap() { this.p.v = (Math.round(this.p.v) + 1) & 15; return true; }
  valueLabel() { return this.bitsNow().map((b) => (b ? '1' : '0')).reverse().join(''); }
  stateName() { return this.valueLabel(); }
  draw(g) {
    g.box(-1.1 * G, -2.6 * G, 1.1 * G, 1.6 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 3 });
    this.bitsNow().forEach((on, k) => {
      const y = this.ys()[k];
      g.box(-0.55 * G, y - 0.28 * G, 0.55 * G, y + 0.28 * G, { stroke: g.muted, width: 1, fill: g.bg, r: 2 });
      g.box(on ? 0 : -0.5 * G, y - 0.22 * G, on ? 0.5 * G : 0, y + 0.22 * G, { fill: on ? g.accent : g.muted, r: 2 });
      g.text(String(k + 1), -0.85 * G, y, { size: 6, color: g.muted });
    });
    g.text('ON →', 0, -2.25 * G, { size: 6, color: g.muted, follow: true });
  }
}
register(DIPSwitch);

class SPST2 extends MultiSwitch {
  static props = [{ key: 'on', label: 'On', type: 'bool', def: false }];
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.2 * G, 2 * G, 0.7 * G]; }
  leads() { return [[0, -2 * G, 0, -0.8 * G, 0], [1, 2 * G, 0, 0.8 * G, 0]]; }
  paths() { return [[0, 1]]; }
  closedSet() { return [!!this.p.on]; }
  onTap() { this.p.on = !this.p.on; return true; }
  stateName() { return this.p.on ? 'ON' : 'OFF'; }
}

export class KeySwitch extends SPST2 {
  static type = 'keysw'; static title = 'Key Switch'; static keywords = 'key switch keyed lock switch security panel enable';
  static description = 'Lock-operated on/off switch for panels and machines: only someone with the key can turn it on. Tap to turn the key.';
  draw(g) {
    this.contact(g, -0.8 * G, 0, 0.8 * G, 0, this.p.on, g.pv(0));
    g.circle(0, -0.85 * G, 0.22 * G, { stroke: g.accent, width: g.lw * 0.8 });
    g.line(0.2 * G, -0.85 * G, 0.6 * G, -0.85 * G, g.accent, g.lw * 0.8); g.line(0.5 * G, -0.85 * G, 0.5 * G, -0.68 * G, g.accent, g.lw * 0.8);
  }
}
register(KeySwitch);

export class FootSwitch extends SPST2 {
  static type = 'footsw'; static title = 'Foot Switch (NO)'; static keywords = 'foot switch pedal momentary sewing machine press';
  static props = [];
  static description = 'Momentary foot pedal (normally open): closed only while it is pressed — press and hold it.';
  constructor(x, y) { super(x, y); this.held = false; }
  closedSet() { return [this.held]; }
  onTap() { return false; }
  onPress() { this.held = true; return true; }
  onRelease() { this.held = false; return true; }
  stateName() { return this.held ? 'Pressed' : 'Released'; }
  draw(g) {
    this.contact(g, -0.8 * G, 0, 0.8 * G, 0, this.held, g.pv(0));
    g.poly([[-0.5 * G, -0.85 * G], [0.5 * G, -0.85 * G], [0.3 * G, -0.55 * G], [-0.3 * G, -0.55 * G]], { stroke: g.body, width: g.lw * 0.7, close: true });
  }
}
register(FootSwitch);

class SPDT2 extends MultiSwitch {
  static props = [{ key: 'pos', label: 'Position B', type: 'bool', def: false }];
  localPosts() { return [[-2 * G, 0], [2 * G, -G], [2 * G, G]]; }
  localBox() { return [-2 * G, -1.5 * G, 2 * G, 1.5 * G]; }
  leads() { return [[0, -2 * G, 0, -0.8 * G, 0], [1, 2 * G, -G, 0.8 * G, -G], [2, 2 * G, G, 0.8 * G, G]]; }
  paths() { return [[0, 1], [0, 2]]; }
  closedSet() { return [!this.p.pos, !!this.p.pos]; }
  onTap() { this.p.pos = !this.p.pos; return true; }
  stateName() { return this.p.pos ? 'B' : 'A'; }
  draw(g) {
    g.circle(-0.8 * G, 0, 2.6, { fill: g.vc(g.pv(0)) }); g.circle(0.8 * G, -G, 2.6, { fill: g.vc(g.pv(1)) }); g.circle(0.8 * G, G, 2.6, { fill: g.vc(g.pv(2)) });
    g.line(-0.8 * G, 0, 0.76 * G, this.p.pos ? 0.95 * G : -0.95 * G, g.vc(g.pv(0)), g.lw * 1.1);
    this.knob(g);
  }
  knob() {}
}
export class ToggleSwitch extends SPDT2 {
  static type = 'togglesw'; static title = 'Toggle Switch (SPDT)'; static keywords = 'toggle switch bat handle lever spdt changeover panel';
  static description = 'Lever (bat-handle) toggle switch, single-pole changeover: COM connects to A or B. Tap to flip.';
  knob(g) { const y = this.p.pos ? 0.4 * G : -0.4 * G; g.line(-0.2 * G, 0, 0.1 * G, y, g.accent, g.lw * 1.8); g.circle(0.1 * G, y, 0.12 * G, { fill: g.accent }); }
}
register(ToggleSwitch);
export class SlideSwitch extends SPDT2 {
  static type = 'slidesw'; static title = 'Slide Switch (SPDT)'; static keywords = 'slide switch spdt small changeover pcb';
  static description = 'Miniature slide switch, single-pole changeover (COM to A or B). Tap to slide it.';
  knob(g) { g.box(-0.45 * G, -1.35 * G, 0.45 * G, -1.05 * G, { stroke: g.muted, width: 1, r: 2 }); g.box(this.p.pos ? 0 : -0.4 * G, -1.32 * G, this.p.pos ? 0.4 * G : 0, -1.08 * G, { fill: g.accent, r: 2 }); }
}
register(SlideSwitch);

export class RockerSwitch extends MultiSwitch {
  static type = 'rockersw'; static title = 'Illuminated Rocker Switch'; static keywords = 'rocker switch illuminated neon lamp power switch mains extension board';
  static props = [{ key: 'on', label: 'On', type: 'bool', def: false }, { key: 'rlamp', label: 'Indicator lamp resistance', unit: 'Ω', def: 150000, min: 100, max: 1e8, log: true }];
  static description = 'Mains rocker switch with a built-in indicator lamp: L-IN → L-OUT is switched, and the lamp (between L-OUT and N) glows while the output is live. Tap to switch.';
  localPosts() { return [[-2 * G, 0], [2 * G, 0], [0, 2 * G]]; }
  pinNames() { return ['L-IN', 'L-OUT', 'N']; }
  localBox() { return [-2 * G, -1.2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, 0, -0.8 * G, 0], [1, 2 * G, 0, 0.8 * G, 0], [2, 0, 2 * G, 0, 0.9 * G]]; }
  paths() { return [[0, 1]]; }
  closedSet() { return [!!this.p.on]; }
  onTap() { this.p.on = !this.p.on; return true; }
  stamp(s) { super.stamp(s); s.addG(this.nodes[1], this.nodes[2], 1 / this.p.rlamp); }
  stampAC(ac) { super.stampAC(ac); ac.addY(this.nodes[1], this.nodes[2], 1 / this.p.rlamp); }
  accept(s) {
    super.accept(s);
    const il = (s.v(this.nodes[1]) - s.v(this.nodes[2])) / this.p.rlamp;
    this.postCurrents[1] -= il; this.postCurrents[2] += il;
    this.vl = Math.abs(s.v(this.nodes[1]) - s.v(this.nodes[2]));
  }
  stateName() { return this.p.on ? 'ON' : 'OFF'; }
  draw(g) {
    const lit = g.running && (this.vl || 0) > 60;
    g.box(-0.6 * G, -0.9 * G, 0.6 * G, 0.75 * G, { stroke: g.body, width: g.lw * 0.8, fill: lit ? 'rgba(255,80,40,0.55)' : g.fill, r: 4 });
    if (lit) g.glow(0, 0, 1.1 * G, '255,90,40', 0.45);
    g.line(-0.8 * G, 0, -0.6 * G, 0, g.vc(g.pv(0)), g.lw); g.line(0.6 * G, 0, 0.8 * G, 0, g.vc(g.pv(1)), g.lw);
    g.text(this.p.on ? 'I' : 'O', 0, -0.05 * G, { size: 10, color: g.text2, bold: true, follow: true });
    g.line(0, 0.75 * G, 0, 0.9 * G, g.vc(g.pv(2)), g.lw);
  }
}
register(RockerSwitch);

// ------------------------------------------------------------------- relays
function relayType(type, title, pins, contacts, defs, keywords, desc, glyph) {
  const C = class extends CoilRelay {};
  Object.assign(C, { type, title, pins, contacts, keywords, description: desc });
  C.props = CoilRelay.props.map((p) => ({ ...p, def: defs[p.key] ?? p.def }));
  C.prototype.draw = function (g) { this.drawCoilAndContacts(g, glyph); };
  register(C);
  return C;
}
relayType('relayspst', 'Relay (SPST-NO)', [['A1', 'L'], ['A2', 'L'], ['13', 'R'], ['14', 'R']], [[2, 3, 'NO']], { vcoil: 12, rcoil: 400 },
  'relay spst normally open make contact single pole 12v', 'Single-pole make (normally open) relay: coil A1–A2, contact 13–14 closes when energised.', 'K NO');
relayType('relaydpst', 'Relay (DPST-NO)', [['A1', 'L'], ['A2', 'L'], ['13', 'R'], ['14', 'R'], ['23', 'R'], ['24', 'R']], [[2, 3, 'NO'], [4, 5, 'NO']], { vcoil: 24, rcoil: 800 },
  'relay dpst double pole normally open two contacts 24v', 'Double-pole make relay: coil A1–A2, contacts 13–14 and 23–24 close together — switches both line and neutral.', 'K 2NO');
relayType('auxrelay', 'Control Relay 2NO + 2NC', [['A1', 'L'], ['A2', 'L'], ['13', 'R'], ['14', 'R'], ['23', 'R'], ['24', 'R'], ['31', 'R'], ['32', 'R'], ['41', 'R'], ['42', 'R']],
  [[2, 3, 'NO'], [4, 5, 'NO'], [6, 7, 'NC'], [8, 9, 'NC']], { vcoil: 230, rcoil: 4000, lcoil: 5, ac: true },
  'control relay auxiliary relay contactor relay 2no 2nc interlock plc interposing 230v',
  'Industrial control (auxiliary) relay with a 230 V AC coil: two NO contacts (13–14, 23–24) and two NC contacts (31–32, 41–42) for hold-in, interlock and signalling circuits.', 'KA');

export class Contactor2 extends CoilRelay {
  static type = 'contactor2'; static title = 'Contactor 3-pole + NO + NC';
  static keywords = 'contactor auxiliary contact nc interlock forward reverse star delta 21 22 13 14 3 pole';
  static props = CoilRelay.props.map((p) => ({ ...p, def: { vcoil: 230, rcoil: 600, lcoil: 3, ac: true }[p.key] ?? p.def }));
  static pins = [['A1', 'L'], ['A2', 'L'], ['L1', 'T'], ['L2', 'T'], ['L3', 'T'], ['T1', 'B'], ['T2', 'B'], ['T3', 'B'], ['13', 'R'], ['14', 'R'], ['21', 'R'], ['22', 'R']];
  static contacts = [[2, 5, 'NO'], [3, 6, 'NO'], [4, 7, 'NO'], [8, 9, 'NO'], [10, 11, 'NC']];
  static chipOpts = { dense: true };
  static description = 'Power contactor with a 230 V AC coil (A1–A2), three main contacts (L1–T1, L2–T2, L3–T3) and two auxiliary contacts: 13–14 NO for the hold-in circuit and 21–22 NC for electrical interlocking (forward/reverse, star/delta).';
  draw(g) {
    this.drawCoilAndContacts(g, 'KM');
    const on = this.contactsClosed(), { posts } = this.geom();
    for (let p = 0; p < 3; p++) { const x = posts[2 + p][0]; g.line(x, -0.5 * G, x + (on ? 0 : 0.25 * G), 0.35 * G, g.body, g.lw * 0.8); }
  }
}
register(Contactor2);

export class LatchingRelay extends withChip(Element) {
  static type = 'latchrelay'; static title = 'Latching Relay (bistable)'; static category = 'Switches';
  static prefix = 'K'; static keywords = 'latching relay bistable impulse relay set reset coil memory relay two coil';
  static props = [
    { key: 'vcoil', label: 'Coil rated voltage', unit: 'V', def: 12, min: 0.5, max: 1000, knob: true },
    { key: 'rcoil', label: 'Coil resistance', unit: 'Ω', def: 200, min: 0.1, max: 1e6, log: true },
    { key: 'lcoil', label: 'Coil inductance', unit: 'H', def: 0.02, min: 1e-6, max: 100, log: true },
  ];
  static pins = [['S1', 'L'], ['S2', 'L'], ['R1', 'L'], ['R2', 'L'], ['COM', 'R'], ['NC', 'R'], ['NO', 'R']];
  static description = 'Bistable relay with two coils: a pulse on the SET coil (S1–S2) moves the contact to COM–NO, a pulse on the RESET coil (R1–R2) moves it back to COM–NC. It keeps its position with no coil power — a mechanical memory.';
  constructor(x, y) { super(x, y); this.postCurrents = new Array(7).fill(0); this.set = false; }
  connectivity() { return [[0, 1], [2, 3], [4, 5, 6]]; }
  branchCount() { return 4; }
  reset() { this.set = false; this.ia = [0, 0]; this.postCurrents.fill(0); }
  coil(s, a, b, k) { s.addBranchKCL(a, b, k); s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -(this.p.rcoil + (s.mode === 'dc' ? 0 : this.p.lcoil / s.dt))); }
  stamp(s) {
    const n = this.nodes, [k1, k2, k3, k4] = this.branches;
    this.coil(s, n[0], n[1], k1); this.coil(s, n[2], n[3], k2);
    stampSw(s, n[4], n[6], k3, this.set, 0.005); stampSw(s, n[4], n[5], k4, !this.set, 0.005);
  }
  stampStep(s) { if (s.mode !== 'dc') { s.b[this.branches[0]] += -(this.p.lcoil / s.dt) * this.ia[0]; s.b[this.branches[1]] += -(this.p.lcoil / s.dt) * this.ia[1]; } }
  accept(s) {
    const [k1, k2, k3, k4] = this.branches, i1 = s.x[k1], i2 = s.x[k2], c1 = s.x[k3], c2 = s.x[k4];
    this.ia = [i1, i2];
    const ir = 0.7 * this.p.vcoil / this.p.rcoil;
    let next = this.set;
    if (Math.abs(i1) > ir && Math.abs(i2) < ir) next = true; else if (Math.abs(i2) > ir && Math.abs(i1) < ir) next = false;
    if (next !== this.set) { this.set = next; if (s.mode === 'dc') s.dirty = true; else s.markEvent(); }
    this.postCurrents = [i1, -i1, i2, -i2, c1 + c2, -c2, -c1]; this.i = i1;
  }
  digitalSettle(s) { const was = this.set; this.accept(s); return was !== this.set; }
  stampAC(ac) {
    const n = this.nodes, [k1, k2, k3, k4] = this.branches;
    for (const [a, b, k] of [[n[0], n[1], k1], [n[2], n[3], k2]]) { ac.addBranchKCL(a, b, k); ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -this.p.rcoil, -ac.omega * this.p.lcoil); }
    stampSwAC(ac, n[4], n[6], k3, this.set, 0.005); stampSwAC(ac, n[4], n[5], k4, !this.set, 0.005);
  }
  valueLabel() { return this.set ? 'SET' : 'RESET'; }
  readings(s) { return [['Position', this.set ? 'SET (COM–NO)' : 'RESET (COM–NC)', ''], ['SET coil current', this.ia?.[0] || 0, 'A'], ['RESET coil current', this.ia?.[1] || 0, 'A']]; }
  draw(g) { this.drawChip(g, 'LATCH'); const { bw, top } = this.geom(); g.circle(bw - 0.4 * G, top + 0.4 * G, 3, { fill: this.set ? g.hi : g.lo }); }
}
register(LatchingRelay);

// --------------------------------------------------- 3-pole overload relay
export class OverloadRelay3 extends withChip(Element) {
  static type = 'olr3'; static title = 'Thermal Overload Relay (3-pole)'; static category = 'Protection';
  static prefix = 'F'; static keywords = 'overload relay 3 pole thermal olr motor protection phase loss class 10 95 96 97 98';
  static props = [{ key: 'ir', label: 'Current setting Ir', unit: 'A', def: 8, min: 0.1, max: 1000, log: true, knob: true }];
  static pins = [['1', 'T'], ['3', 'T'], ['5', 'T'], ['2', 'B'], ['4', 'B'], ['6', 'B'], ['95', 'L'], ['96', 'L'], ['97', 'R'], ['98', 'R']];
  static chipOpts = { dense: true };
  static description = 'Three-pole motor overload relay (class 10, IEC 60947-4-1): the three heaters 1–2, 3–4, 5–6 carry the motor currents. On overload — or faster on a lost phase (single phasing) — it trips: the NC contact 95–96 opens (put it in the contactor coil circuit) and the NO contact 97–98 closes (alarm lamp). Tap to reset.';
  interactive = true;
  constructor(x, y) { super(x, y); this.postCurrents = new Array(10).fill(0); this.tripped = false; this.theta = 0; }
  connectivity() { return [[0, 3], [1, 4], [2, 5], [6, 7], [8, 9]]; }
  branchCount() { return 5; }
  reset() { this.tripped = false; this.theta = 0; this.i2 = [0, 0, 0]; this.postCurrents.fill(0); this.cause = ''; }
  stamp(s) {
    const n = this.nodes, k = this.branches;
    for (let p = 0; p < 3; p++) stampSw(s, n[p], n[p + 3], k[p], true, 0.01);
    stampSw(s, n[6], n[7], k[3], !this.tripped, 0.01); stampSw(s, n[8], n[9], k[4], this.tripped, 0.01);
  }
  stampAC(ac) {
    const n = this.nodes, k = this.branches;
    for (let p = 0; p < 3; p++) stampSwAC(ac, n[p], n[p + 3], k[p], true, 0.01);
    stampSwAC(ac, n[6], n[7], k[3], !this.tripped, 0.01); stampSwAC(ac, n[8], n[9], k[4], this.tripped, 0.01);
  }
  accept(s) {
    const k = this.branches, is = [0, 1, 2].map((p) => s.x[k[p]]);
    is.forEach((i, p) => { this.postCurrents[p] = i; this.postCurrents[p + 3] = -i; });
    const c1 = s.x[k[3]], c2 = s.x[k[4]];
    this.postCurrents[6] = c1; this.postCurrents[7] = -c1; this.postCurrents[8] = c2; this.postCurrents[9] = -c2;
    this.i = is[0];
    this.thermal(s, is);
  }
  /** Thermal image of the three heater currents `is`; trips on overload or phase loss. */
  thermal(s, is) {
    if (s.mode === 'dc' || this.tripped) return;
    const a = Math.min(1, s.dt / 0.1);
    this.i2 = this.i2.map((v, p) => v + (is[p] * is[p] - v) * a);
    const rms = this.i2.map((v) => Math.sqrt(v)), mx = Math.max(...rms), mn = Math.min(...rms);
    // differential (phase-loss) mechanism: a dead phase while the others carry load trips faster
    const loss = mx > 0.5 * this.p.ir && mn < 0.15 * mx;
    const x = mx / this.p.ir * (loss ? 1.6 : 1);
    this.theta += (x * x - this.theta) * Math.min(1, s.dt / 240);
    if (this.theta >= 1.3) { this.tripped = true; this.cause = loss ? 'phase loss' : 'overload'; s.markEvent(); }
  }
  onTap() { this.tripped = false; this.theta = 0; return true; }
  valueLabel() { return fmtShort(this.p.ir, 'A'); }
  readings() {
    const rms = (this.i2 || [0, 0, 0]).map((v) => Math.sqrt(v));
    return [['State', this.tripped ? `TRIPPED (${this.cause}) — 95–96 open, 97–98 closed` : 'Normal', ''], ['I L1 (RMS)', rms[0], 'A'], ['I L2 (RMS)', rms[1], 'A'], ['I L3 (RMS)', rms[2], 'A'], ['Thermal load', Math.min(100, (this.theta / 1.3) * 100), '%']];
  }
  draw(g) {
    this.drawChip(g, 'OLR');
    if (this.tripped) g.glow(0, 0, 1.5 * G, '255,70,70', 0.4);
    const { bw, top } = this.geom(); g.circle(bw - 0.4 * G, top + 0.4 * G, 3, { fill: this.tripped ? '#ef4444' : g.lo });
  }
}
register(OverloadRelay3);

// ------------------------------------------------------------ monitoring relays
/** 3-phase monitor: phase loss, phase sequence and unbalance; output changeover contact. */
export class PhaseRelay extends withChip(Element) {
  static type = 'phaserelay'; static title = 'Phase Failure / Sequence Relay'; static category = 'Protection';
  static prefix = 'K'; static keywords = 'phase failure relay phase sequence relay phase monitoring relay single phasing reversal unbalance 3 phase protection';
  static props = [
    { key: 'vmin', label: 'Minimum phase voltage (RMS)', unit: 'V', def: 180, min: 1, max: 1e5, log: true, knob: true },
    { key: 'unb', label: 'Maximum unbalance', unit: '%', def: 10, min: 1, max: 50 },
    { key: 'delay', label: 'Trip delay', unit: 's', def: 0.3, min: 0, max: 30 },
  ];
  static pins = [['L1', 'L'], ['L2', 'L'], ['L3', 'L'], ['N', 'L'], ['11', 'R'], ['12', 'R'], ['14', 'R']];
  static description = 'Monitors a 3-phase supply (L1, L2, L3 against N): when all phases are present, in the correct sequence (L1→L2→L3) and balanced, its relay is energised (11–14 closed, 11–12 open). On phase loss, low voltage, reversed sequence or unbalance it releases after the delay — put 11–14 in series with the motor contactor coil.';
  constructor(x, y) { super(x, y); this.postCurrents = new Array(7).fill(0); this.meters = [new CycleMeter(0.1), new CycleMeter(0.1), new CycleMeter(0.1)]; }
  connectivity() { return [[0, 1, 2, 3], [4, 5, 6]]; }
  branchCount() { return 2; }
  reset() { this.ok = false; this.bad = 0; this.why = 'starting'; this.meters.forEach((m) => m.reset()); this.postCurrents.fill(0); this.t = 0; }
  stamp(s) {
    const n = this.nodes;
    for (let p = 0; p < 3; p++) s.addG(n[p], n[3], 1 / 220e3);
    stampSw(s, n[4], n[6], this.branches[0], this.ok, 0.01); stampSw(s, n[4], n[5], this.branches[1], !this.ok, 0.01);
  }
  stampAC(ac) {
    const n = this.nodes;
    for (let p = 0; p < 3; p++) ac.addY(n[p], n[3], 1 / 220e3);
    stampSwAC(ac, n[4], n[6], this.branches[0], this.ok, 0.01); stampSwAC(ac, n[4], n[5], this.branches[1], !this.ok, 0.01);
  }
  accept(s) {
    const n = this.nodes, k = this.branches, c1 = s.x[k[0]], c2 = s.x[k[1]];
    const v = [0, 1, 2].map((p) => s.v(n[p]) - s.v(n[3]));
    this.postCurrents = [...v.map((x) => x / 220e3), -(v[0] + v[1] + v[2]) / 220e3, c1 + c2, -c2, -c1];
    this.monitor(s, v);
  }
  /** Phase-to-neutral voltages `v`: decide healthy / released (with the trip delay). */
  monitor(s, v) {
    if (s.mode === 'dc') return;
    v.forEach((x, p) => this.meters[p].push(s.t, s.dt, x));
    this.t = s.t;
    if (s.t < 0.1) return; // let the meters settle
    const rms = this.meters.map((m) => m.vrms), mx = Math.max(...rms), mn = Math.min(...rms);
    // sequence from the phase of L2 relative to L1: about −120° for L1→L2→L3
    const t1 = this.meters[0].lastCross, t2 = this.meters[1].lastCross, T = this.meters[0].period;
    let seqOK = true;
    if (t1 !== null && t2 !== null && T > 0 && mn > this.p.vmin) { const d = (((t2 - t1) / T) % 1 + 1) % 1; seqOK = d > 0.2 && d < 0.5; }
    let why = '';
    if (mn < this.p.vmin) why = mn < 0.3 * this.p.vmin ? 'phase loss' : 'under-voltage';
    else if ((mx - mn) / mx * 100 > this.p.unb) why = 'unbalance';
    else if (!seqOK) why = 'wrong phase sequence';
    if (why) { this.bad += s.dt; if (this.ok && this.bad >= this.p.delay) { this.ok = false; s.markEvent(); } } else { this.bad = 0; if (!this.ok) { this.ok = true; s.markEvent(); } }
    this.why = why || 'healthy';
    this.rms = rms;
  }
  valueLabel() { return this.ok ? 'OK' : 'FAULT'; }
  readings() {
    const r = this.rms || [0, 0, 0];
    return [['Status', this.ok ? 'Healthy — relay ON (11–14 closed)' : `Released: ${this.why}`, ''], ['V L1-N', r[0], 'V'], ['V L2-N', r[1], 'V'], ['V L3-N', r[2], 'V']];
  }
  draw(g) { this.drawChip(g, 'PHASE'); const { bw, top } = this.geom(); g.circle(bw - 0.4 * G, top + 0.4 * G, 3, { fill: this.ok ? g.hi : '#ef4444' }); }
}
register(PhaseRelay);

export class VoltageRelay extends withChip(Element) {
  static type = 'voltrelay'; static title = 'Over / Under-Voltage Relay'; static category = 'Protection';
  static prefix = 'K'; static keywords = 'over voltage relay under voltage relay voltage monitoring relay ovp uvp protection';
  static props = [
    { key: 'vlo', label: 'Under-voltage trip (RMS)', unit: 'V', def: 190, min: 0.1, max: 1e5, log: true, knob: true },
    { key: 'vhi', label: 'Over-voltage trip (RMS)', unit: 'V', def: 260, min: 0.1, max: 1e5, log: true },
    { key: 'delay', label: 'Trip delay', unit: 's', def: 0.5, min: 0, max: 60 },
  ];
  static pins = [['L', 'L'], ['N', 'L'], ['11', 'R'], ['12', 'R'], ['14', 'R']];
  static description = 'Voltage monitoring relay: energised (11–14 closed) while the RMS voltage between L and N stays between the under- and over-voltage limits; outside them for longer than the delay it releases (11–12 closed) to disconnect sensitive loads. Works on AC (RMS) and DC.';
  constructor(x, y) { super(x, y); this.postCurrents = new Array(5).fill(0); this.m = new CycleMeter(0.1); }
  connectivity() { return [[0, 1], [2, 3, 4]]; }
  branchCount() { return 2; }
  reset() { this.ok = false; this.bad = 0; this.m.reset(); this.postCurrents.fill(0); this.why = 'starting'; }
  stamp(s) { const n = this.nodes; s.addG(n[0], n[1], 1 / 220e3); stampSw(s, n[2], n[4], this.branches[0], this.ok, 0.01); stampSw(s, n[2], n[3], this.branches[1], !this.ok, 0.01); }
  stampAC(ac) { const n = this.nodes; ac.addY(n[0], n[1], 1 / 220e3); stampSwAC(ac, n[2], n[4], this.branches[0], this.ok, 0.01); stampSwAC(ac, n[2], n[3], this.branches[1], !this.ok, 0.01); }
  accept(s) {
    const n = this.nodes, c1 = s.x[this.branches[0]], c2 = s.x[this.branches[1]], v = s.v(n[0]) - s.v(n[1]);
    this.postCurrents = [v / 220e3, -v / 220e3, c1 + c2, -c2, -c1];
    if (s.mode === 'dc') return;
    this.m.push(s.t, s.dt, v);
    if (s.t < 0.1) return;
    const rms = this.m.vrms;
    this.vr = rms;
    const why = rms < this.p.vlo ? 'under-voltage' : rms > this.p.vhi ? 'over-voltage' : '';
    if (why) { this.bad += s.dt; if (this.ok && this.bad >= this.p.delay) { this.ok = false; s.markEvent(); } } else { this.bad = 0; if (!this.ok) { this.ok = true; s.markEvent(); } }
    this.why = why || 'healthy';
  }
  valueLabel() { return `${fmtShort(this.p.vlo, 'V')}–${fmtShort(this.p.vhi, 'V')}`; }
  readings() { return [['Status', this.ok ? 'Within limits — relay ON' : `Released: ${this.why}`, ''], ['Voltage (RMS)', this.vr || 0, 'V']]; }
  draw(g) { this.drawChip(g, 'U<>'); const { bw, top } = this.geom(); g.circle(bw - 0.4 * G, top + 0.4 * G, 3, { fill: this.ok ? g.hi : '#ef4444' }); }
}
register(VoltageRelay);
