// Switches and electromechanical parts: SPST, SPDT, push buttons, relay,
// DC motor, buzzer.

import { Element, TwoTerm, register, GRID } from './base.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

/** Stamp an ideal switch branch k between a and b. */
function stampSwitch(s, a, b, k, closed, ron) {
  s.addBranchKCL(a, b, k);
  if (closed) {
    s.addA(k, a - 1, 1); s.addA(k, b - 1, -1);
    if (ron > 0) s.addA(k, k, -ron);
  } else {
    s.addA(k, k, 1);
  }
}
function stampSwitchAC(ac, a, b, k, closed, ron) {
  ac.addBranchKCL(a, b, k);
  if (closed) {
    ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1);
    if (ron > 0) ac.addA(k, k, -ron);
  } else ac.addA(k, k, 1);
}

export class Switch extends TwoTerm {
  static type = 'switch'; static title = 'Switch (SPST)'; static category = 'Switches';
  static prefix = 'S'; static keywords = 'switch toggle spst on off';
  static props = [
    { key: 'closed', label: 'Closed', type: 'bool', def: false },
    { key: 'ron', label: 'On resistance', unit: 'Ω', def: 0, min: 0, max: 1e3 },
  ];
  static description = 'Single-pole single-throw switch. Tap it to open/close — even while the simulation runs.';
  interactive = true;
  shortCheck = false;
  branchCount() { return 1; }
  valueLabel() { return ''; }
  isClosed() { return !!this.p.closed; }
  stamp(s) { stampSwitch(s, this.nodes[0], this.nodes[1], this.branches[0], this.isClosed(), this.p.ron); }
  stampAC(ac) { stampSwitchAC(ac, this.nodes[0], this.nodes[1], this.branches[0], this.isClosed(), this.p.ron); }
  accept(s) { this.setCurrent(s.x[this.branches[0]]); }
  onTap() { this.p.closed = !this.p.closed; return true; }
  readings(s) { return [['State', this.isClosed() ? 'Closed' : 'Open', ''], ['Voltage', this.voltageDiff(s), 'V'], ['Current', this.i, 'A']]; }
  spice(n) { return `R${this.name} ${n[0]} ${n[1]} ${this.isClosed() ? Math.max(this.p.ron, 1e-6) : 1e12} ; switch`; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  draw(g) {
    const c = this.isClosed();
    g.circle(-G, 0, 3, { fill: g.vc(g.pv(0)) });
    g.circle(G, 0, 3, { fill: g.vc(g.pv(1)) });
    const ang = c ? 0 : -0.5;
    g.line(-G, 0, -G + Math.cos(ang) * 2 * G, Math.sin(ang) * 2 * G, c ? g.vc(g.pv(0)) : g.body, g.lw * 1.2);
  }
}
register(Switch);

export class PushButton extends Switch {
  static type = 'pushno'; static title = 'Push Button (NO)'; static keywords = 'push button momentary tactile normally open';
  static props = [{ key: 'ron', label: 'On resistance', unit: 'Ω', def: 0, min: 0, max: 1e3 }];
  static description = 'Momentary push button, normally open: conducts only while you hold it.';
  nc = false;
  constructor(x, y) { super(x, y); this.pressed = false; }
  isClosed() { return this.pressed !== this.nc; }
  onTap() { return false; }
  onPress() { this.pressed = true; return true; }
  onRelease() { this.pressed = false; return true; }
  draw(g) {
    const c = this.isClosed();
    g.circle(-G, 0, 3, { fill: g.vc(g.pv(0)) });
    g.circle(G, 0, 3, { fill: g.vc(g.pv(1)) });
    const y = this.nc ? (c ? 3 : 7) : c ? -2 : -9;
    g.line(-G * 1.1, y, G * 1.1, y, c ? g.accent : g.body, g.lw * 1.3);
    g.line(0, y, 0, y - 10, g.body, g.lw);
    g.line(-6, y - 10, 6, y - 10, g.body, g.lw * 1.4);
  }
}
register(PushButton);

export class PushButtonNC extends PushButton {
  static type = 'pushnc'; static title = 'Push Button (NC)'; static keywords = 'push button momentary normally closed stop';
  static description = 'Momentary push button, normally closed: opens while you hold it.';
  nc = true;
}
register(PushButtonNC);

export class SPDT extends Element {
  static type = 'spdt'; static title = 'Switch (SPDT)'; static category = 'Switches';
  static prefix = 'S'; static keywords = 'spdt changeover selector two way switch';
  static props = [
    { key: 'pos', label: 'Position B', type: 'bool', def: false },
    { key: 'ron', label: 'On resistance', unit: 'Ω', def: 0, min: 0, max: 1e3 },
  ];
  static description = 'Single-pole double-throw switch: common terminal (left) connects to A (top) or B (bottom). Tap to flip.';
  interactive = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  localPosts() { return [[-2 * G, 0], [2 * G, -G], [2 * G, G]]; }
  localBox() { return [-2 * G, -1.4 * G, 2 * G, 1.4 * G]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, -G, G, -G], [2, 2 * G, G, G, G]]; }
  branchCount() { return 2; }
  valueLabel() { return ''; }
  stamp(s) {
    const [c, a, b] = this.nodes, [k1, k2] = this.branches;
    stampSwitch(s, c, a, k1, !this.p.pos, this.p.ron);
    stampSwitch(s, c, b, k2, !!this.p.pos, this.p.ron);
  }
  stampAC(ac) {
    const [c, a, b] = this.nodes, [k1, k2] = this.branches;
    stampSwitchAC(ac, c, a, k1, !this.p.pos, this.p.ron);
    stampSwitchAC(ac, c, b, k2, !!this.p.pos, this.p.ron);
  }
  accept(s) {
    const i1 = s.x[this.branches[0]], i2 = s.x[this.branches[1]];
    this.postCurrents = [i1 + i2, -i1, -i2]; this.i = i1 + i2;
  }
  onTap() { this.p.pos = !this.p.pos; return true; }
  readings() { return [['Position', this.p.pos ? 'B' : 'A', ''], ['Current', this.i, 'A']]; }
  draw(g) {
    g.circle(-G, 0, 3, { fill: g.vc(g.pv(0)) });
    g.circle(G, -G, 3, { fill: g.vc(g.pv(1)) });
    g.circle(G, G, 3, { fill: g.vc(g.pv(2)) });
    const ty = this.p.pos ? G : -G;
    g.line(-G, 0, G * 0.95, ty * 0.92, g.vc(g.pv(0)), g.lw * 1.2);
    g.text('A', G * 1.45, -G * 1.35, { size: 8, color: g.muted });
    g.text('B', G * 1.45, G * 1.35, { size: 8, color: g.muted });
  }
}
register(SPDT);

// ------------------------------------------------------------------- relay
export class Relay extends Element {
  static type = 'relay'; static title = 'Relay'; static category = 'Switches';
  static prefix = 'K'; static keywords = 'relay coil electromagnetic contactor spdt';
  static props = [
    { key: 'vcoil', label: 'Coil rated voltage', unit: 'V', def: 5, min: 0.5, max: 400 },
    { key: 'rcoil', label: 'Coil resistance', unit: 'Ω', def: 70, min: 0.1, max: 1e6, log: true },
    { key: 'lcoil', label: 'Coil inductance', unit: 'H', def: 0.05, min: 1e-6, max: 100, log: true },
    { key: 'pull', label: 'Pull-in (% rated I)', unit: '%', def: 75, min: 1, max: 200 },
    { key: 'drop', label: 'Drop-out (% rated I)', unit: '%', def: 30, min: 1, max: 200 },
  ];
  static description = 'Electromechanical relay: coil (left) with inductance; SPDT contacts COM/NO/NC switch when coil current exceeds pull-in.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0, 0]; this.on = false; }
  // posts: coil1, coil2, COM, NC, NO
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [G, 2 * G], [0, -2 * G], [2 * G, -2 * G]]; }
  localBox() { return [-2 * G, -2 * G, 2 * G, 2 * G]; }
  leads() { return [[0, -2 * G, -G, -1.2 * G, -G], [1, -2 * G, G, -1.2 * G, G], [2, G, 2 * G, G, 0.9 * G], [3, 0, -2 * G, 0, -1.2 * G], [4, 2 * G, -2 * G, 2 * G, -1.2 * G]]; }
  connectivity() { return [[0, 1], [2, 3, 4]]; }
  branchCount() { return 3; }
  valueLabel() { return fmtShort(this.p.vcoil, 'V'); }
  labelPos() { return [-1.2 * G, -2.4 * G]; }
  reset() { this.on = false; this.iPrev = 0; this.vlPrev = 0; }
  req(s) { return this.p.rcoil + (s.mode === 'dc' ? 0 : (s.method === 'be' ? 1 : 2) * this.p.lcoil / s.dt); }
  stamp(s) {
    const [c1, c2, com, nc, no] = this.nodes, [kc, k1, k2] = this.branches;
    s.addBranchKCL(c1, c2, kc); s.addA(kc, c1 - 1, 1); s.addA(kc, c2 - 1, -1); s.addA(kc, kc, -this.req(s));
    stampSwitch(s, com, nc, k1, !this.on, 0.01);
    stampSwitch(s, com, no, k2, this.on, 0.01);
  }
  stampStep(s) {
    if (s.mode === 'dc') return;
    const L = this.p.lcoil;
    s.b[this.branches[0]] += s.method === 'be' ? -(L / s.dt) * this.iPrev : -(2 * L / s.dt) * this.iPrev - this.vlPrev;
  }
  accept(s) {
    const [c1, c2] = this.nodes, [kc, k1, k2] = this.branches;
    const i = s.x[kc];
    this.iPrev = i;
    this.vlPrev = s.mode === 'dc' ? 0 : s.v(c1) - s.v(c2) - this.p.rcoil * i;
    const irated = this.p.vcoil / this.p.rcoil;
    const a = Math.abs(i);
    const nextOn = this.on ? a > irated * this.p.drop / 100 : a > irated * this.p.pull / 100;
    if (nextOn !== this.on) { this.on = nextOn; s.markEvent(); }
    const i1 = s.x[k1], i2 = s.x[k2];
    this.postCurrents = [i, -i, i1 + i2, -i1, -i2];
    this.i = i;
  }
  digitalSettle(s) {
    const i = Math.abs(s.x[this.branches[0]]), irated = this.p.vcoil / this.p.rcoil;
    const n = i > irated * this.p.pull / 100;
    if (n !== this.on) { this.on = n; s.dirty = true; return true; }
    return false;
  }
  stampAC(ac) {
    const [c1, c2, com, nc, no] = this.nodes, [kc, k1, k2] = this.branches;
    ac.addBranchKCL(c1, c2, kc); ac.addA(kc, c1 - 1, 1); ac.addA(kc, c2 - 1, -1); ac.addA(kc, kc, -this.p.rcoil, -ac.omega * this.p.lcoil);
    stampSwitchAC(ac, com, nc, k1, !this.on, 0.01);
    stampSwitchAC(ac, com, no, k2, this.on, 0.01);
  }
  readings(s) { return [['State', this.on ? 'Energised' : 'Released', ''], ['Coil current', this.i, 'A'], ['Coil voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V']]; }
  draw(g) {
    g.box(-1.6 * G, -1.2 * G, -0.8 * G, 1.2 * G, { stroke: g.body, width: g.lw * 0.9, fill: this.on ? 'rgba(90,170,255,0.25)' : g.fill, r: 2 });
    g.line(-1.6 * G, -0.8 * G, -0.8 * G, 0.8 * G, g.body, g.lw * 0.7);
    g.poly([[-1.2 * G, -G], [-1.6 * G, -G]], { stroke: g.vc(g.pv(0)), width: g.lw });
    g.poly([[-1.2 * G, G], [-1.6 * G, G]], { stroke: g.vc(g.pv(1)), width: g.lw });
    g.poly([[-0.8 * G, 0], [0.3 * G, 0]], { stroke: g.muted, width: g.lw * 0.6, dash: [3, 3] });
    g.circle(0, -1.2 * G, 3, { fill: g.vc(g.pv(3)) });
    g.circle(2 * G, -1.2 * G, 3, { fill: g.vc(g.pv(4)) });
    const tx = this.on ? 1.9 * G : 0.1 * G;
    g.line(G, 0.9 * G, tx, -1.05 * G, g.vc(g.pv(2)), g.lw * 1.2);
    g.text('NC', -0.45 * G, -1.55 * G, { size: 7, color: g.muted });
    g.text('NO', 1.55 * G, -1.55 * G, { size: 7, color: g.muted });
    g.text('COM', 1.6 * G, 1.4 * G, { size: 7, color: g.muted });
  }
}
register(Relay);

// ---------------------------------------------------------------- DC motor
export class DCMotor extends TwoTerm {
  static type = 'motor'; static title = 'DC Motor'; static category = 'Output';
  static prefix = 'M'; static keywords = 'dc motor fan actuator back emf';
  static props = [
    { key: 'ra', label: 'Armature resistance', unit: 'Ω', def: 2, min: 1e-3, max: 1e4, log: true },
    { key: 'la', label: 'Armature inductance', unit: 'H', def: 1e-3, min: 1e-7, max: 10, log: true },
    { key: 'k', label: 'Motor constant K', unit: 'V·s/rad', def: 0.01, min: 1e-5, max: 10, log: true },
    { key: 'j', label: 'Rotor inertia J', unit: 'kg·m²', def: 1e-6, min: 1e-10, max: 10, log: true },
    { key: 'b', label: 'Friction b', unit: 'N·m·s', def: 1e-6, min: 0, max: 1 },
    { key: 'load', label: 'Load torque', unit: 'N·m', def: 0, min: -10, max: 10, knob: true },
  ];
  static description = 'Permanent-magnet DC motor: V = R·i + L·di/dt + K·ω and J·dω/dt = K·i − b·ω − T_load, solved simultaneously.';
  constructor(x, y) { super(x, y); this.angle = 0; this.w = 0; }
  branchCount() { return 2; } // armature current, angular speed
  valueLabel() { return `${Math.round((this.w || 0) * 60 / (2 * Math.PI))} rpm`; }
  reset() { this.iPrev = 0; this.w = 0; this.angle = 0; this.setCurrent(0); }
  stamp(s) {
    const [a, b] = this.nodes, [ki, kw] = this.branches, p = this.p;
    s.addBranchKCL(a, b, ki);
    // electrical: v - (R + L/dt) i - K w = -(L/dt) i_prev   (backward Euler)
    s.addA(ki, a - 1, 1); s.addA(ki, b - 1, -1);
    s.addA(ki, ki, -(p.ra + (s.mode === 'dc' ? 0 : p.la / s.dt)));
    s.addA(ki, kw, -p.k);
    // mechanical: (J/dt + b) w - K i = J w_prev/dt - T
    s.addA(kw, kw, (s.mode === 'dc' ? 0 : p.j / s.dt) + Math.max(p.b, 1e-12));
    s.addA(kw, ki, -p.k);
  }
  stampStep(s) {
    const [ki, kw] = this.branches, p = this.p;
    if (s.mode !== 'dc') {
      s.b[ki] += -(p.la / s.dt) * this.iPrev;
      s.b[kw] += (p.j / s.dt) * this.w;
    }
    s.b[kw] -= p.load;
  }
  accept(s) {
    const [ki, kw] = this.branches;
    this.iPrev = s.x[ki];
    this.w = s.x[kw];
    if (s.mode !== 'dc') this.angle += this.w * s.dt;
    this.setCurrent(this.iPrev);
  }
  stampAC(ac) {
    const [a, b] = this.nodes, [ki, kw] = this.branches, p = this.p, w = ac.omega;
    ac.addBranchKCL(a, b, ki);
    ac.addA(ki, a - 1, 1); ac.addA(ki, b - 1, -1);
    ac.addA(ki, ki, -p.ra, -w * p.la); ac.addA(ki, kw, -p.k);
    ac.addA(kw, kw, Math.max(p.b, 1e-12), w * p.j); ac.addA(kw, ki, -p.k);
  }
  readings(s) {
    const v = this.voltageDiff(s);
    return [['Voltage', v, 'V'], ['Current', this.i, 'A'], ['Speed', this.w * 60 / (2 * Math.PI), 'rpm'], ['Torque', this.p.k * this.i, 'N·m'],
      ['Back-EMF', this.p.k * this.w, 'V'], ['Mech. power', this.p.k * this.i * this.w, 'W']];
  }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  draw(g) {
    g.circle(0, 0, G, { stroke: g.body, width: g.lw, fill: g.fill });
    const a = this.angle || 0;
    const ctx = g.ctx;
    for (let k = 0; k < 3; k++) {
      const t = a + (k * 2 * Math.PI) / 3;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(t) * G * 0.7, Math.sin(t) * G * 0.7);
      ctx.strokeStyle = g.accent; ctx.lineWidth = g.lw * 1.1; ctx.lineCap = 'round'; ctx.stroke();
    }
    g.circle(0, 0, 3, { fill: g.accent });
    g.text('M', 0, -G * 1.35, { size: 9, color: g.muted, bold: true });
  }
}
register(DCMotor);

export class Buzzer extends TwoTerm {
  static type = 'buzzer'; static title = 'Buzzer'; static category = 'Output';
  static prefix = 'BZ'; static keywords = 'buzzer beeper alarm sound piezo';
  static props = [
    { key: 'r', label: 'Resistance', unit: 'Ω', def: 100, min: 1, max: 1e6, log: true },
    { key: 'ion', label: 'Sounding current', unit: 'A', def: 0.005, min: 1e-6, max: 1, log: true },
    { key: 'tone', label: 'Tone', unit: 'Hz', def: 2400, min: 100, max: 8000, knob: true },
  ];
  static description = 'Active buzzer: sounds (if device sound is enabled) when current exceeds the sounding current.';
  get R() { return this.p.r; }
  stamp(s) { s.addG(this.nodes[0], this.nodes[1], 1 / this.R); }
  stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], 1 / this.R); }
  accept(s) { this.setCurrent(this.voltageDiff(s) / this.R); this.sounding = this.i > this.p.ion; }
  valueLabel() { return ''; }
  leads() { return [[0, -2 * G, 0, -0.9 * G, 0], [1, 2 * G, 0, 0.9 * G, 0]]; }
  draw(g) {
    g.box(-0.9 * G, -0.8 * G, 0.9 * G, 0.8 * G, { stroke: g.body, width: g.lw, fill: g.fill, r: 8 });
    g.circle(0, 0, 0.35 * G, { stroke: g.body, width: g.lw * 0.8 });
    if (g.running && this.sounding) {
      const ctx = g.ctx, ph = (g.t * 6) % 1;
      for (let k = 0; k < 3; k++) {
        const r = G * (0.9 + 0.35 * ((k + ph) % 3));
        ctx.beginPath(); ctx.arc(0, 0, r, -0.6 - Math.PI / 2, 0.6 - Math.PI / 2);
        ctx.strokeStyle = `rgba(255,200,80,${0.8 - 0.25 * ((k + ph) % 3)})`; ctx.lineWidth = g.lw * 0.7; ctx.stroke();
      }
    }
  }
}
register(Buzzer);
