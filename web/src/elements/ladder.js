// Ladder-diagram (detached) parts, drawn the way control circuits are taught: the coil
// of a contactor or timer sits in a rung of the control ladder, and its contacts are
// separate symbols wherever they are needed (main contacts in the power circuit, NO/NC
// auxiliaries in other rungs). Contacts follow the coil, overload relay or monitoring
// relay that carries the same tag (e.g. "KF"), just as on a printed schematic.

import { Element, register, GRID } from './base.js';
import { CoilRelay, TimerRelay, stampSw, stampSwAC } from './switches2.js';
import { OverloadRelay3, PhaseRelay } from './switches3.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;
const TAG = (def) => ({ key: 'tag', label: 'Tag (contacts with this tag follow it)', type: 'text', def });
const tagOf = (e) => String(e.p.tag || '').trim();

/** A horizontal coil: A1 on the left, A2 on the right, the tag written in the box. */
function asLadderCoil(Base) {
  return class extends Base {
    static pins = [['A1', 'L'], ['A2', 'R']];
    static coil = [0, 1];
    static contacts = [];
    static noName = true;
    localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
    localBox() { return [-2 * G, -0.75 * G, 2 * G, 0.75 * G]; }
    leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
    labelSide() { return [0, 1]; }
    linkTag() { return tagOf(this); }
    operated() { return this.contactsClosed(); }
    drawCoil(g, sub) {
      const on = this.contactsClosed();
      if (on) g.glow(0, 0, 1.4 * G, '90,170,255', 0.35);
      g.box(-G, -0.6 * G, G, 0.6 * G, { stroke: on ? g.accent : g.body, width: g.lw, fill: on ? 'rgba(90,170,255,0.25)' : g.fill });
      g.text(tagOf(this) || '?', 0, sub ? -0.12 * G : 0, { size: 9.5, color: on ? g.accent : g.text1, bold: true, follow: false });
      if (sub) g.text(sub, 0, 0.36 * G, { size: 6, color: g.muted, bold: true, follow: false });
    }
  };
}

export class LadderCoil extends asLadderCoil(CoilRelay) {
  static type = 'lcoil'; static title = 'Contactor Coil (ladder)'; static category = 'Switches';
  static keywords = 'coil contactor coil relay coil ladder diagram control circuit a1 a2 km kf kr detached';
  static props = [TAG('K1'), ...CoilRelay.props.map((p) => ({ ...p, def: { vcoil: 230, rcoil: 600, lcoil: 3, ac: true }[p.key] ?? p.def }))];
  static description = 'The coil (A1–A2) of a contactor or relay, drawn on its own in a rung of a ladder diagram. Every Main Contacts, NO Contact and NC Contact part with the same tag (for example KF) switches with it: they close (NO) or open (NC) when the coil pulls in. 230 V AC coil by default.';
  valueLabel() { return ''; }
  draw(g) { this.drawCoil(g); }
}
register(LadderCoil);

export class LadderTimer extends asLadderCoil(TimerRelay) {
  static type = 'ltimer'; static title = 'Timer Coil (ladder)'; static category = 'Switches';
  static keywords = 'timer coil time delay relay ton tof on delay off delay star delta ladder diagram kt';
  static props = [TAG('KT'), ...TimerRelay.props.map((p) => (p.key === 'mode'
    ? { ...p, options: [...p.options, ['twin', 'Twin / cyclic (ON for T, OFF for T2, repeating)']] }
    : p.key === 't' ? { ...p, label: 'Delay time T (twin: ON time)' } : p)),
  { key: 't2', label: 'Twin: OFF time T2', unit: 's', def: 1, min: 1e-3, max: 3600, log: true }];
  static description = 'The coil of a time-delay relay, drawn on its own in a ladder rung. Contacts with the same tag are its timed contacts: on-delay (TON) — an NO contact closes and an NC contact opens T seconds after the coil is energised; off-delay (TOF) — they switch at once and return T seconds after it is de-energised.';
  twin() { return this.p.mode === 'twin'; }
  onChange(s) {
    if (!this.twin()) return super.onChange(s);
    this.timer = 0; this.out = this.on; s.markEvent(); // twin: starts with the ON period
  }
  tick(s) {
    if (!this.twin()) return super.tick(s);
    if (s.mode === 'dc' || !this.on) return;
    this.timer += s.dt;
    if (this.timer >= (this.out ? this.p.t : this.p.t2)) { this.timer = 0; this.out = !this.out; s.markEvent(); }
  }
  modeName() { return { on: 'TON', off: 'TOF', twin: 'TWIN' }[this.p.mode] || 'TON'; }
  valueLabel() { return this.twin() ? `TWIN ${fmtShort(this.p.t, 's')}/${fmtShort(this.p.t2, 's')}` : `${this.modeName()} ${fmtShort(this.p.t, 's')}`; }
  draw(g) {
    this.drawCoil(g, this.modeName());
    const lim = this.twin() ? (this.out ? this.p.t : this.p.t2) : this.p.t;
    if (g.running && this.timer > 0 && this.timer < lim) g.box(-G, 0.62 * G, -G + 2 * G * (this.timer / lim), 0.75 * G, { fill: '#f59e0b' });
  }
}
register(LadderTimer);

/** The part (coil, overload relay, monitoring relay) that contacts tagged `tag` follow. */
function findMaster(s, me, tag) {
  return tag ? s.elements.find((e) => e !== me && e.linkTag && e.linkTag() === tag) || null : null;
}

/** Shared behaviour of contacts that follow a tagged master. */
class Linked extends CoilRelay {
  static noName = true;
  static props = [TAG('K1')];
  constructor(x, y) { super(x, y); this.master = null; }
  connectivity() { return this.constructor.paths.map(([a, b]) => [a, b]); }
  branchCount() { return this.constructor.paths.length; }
  reset(s) { if (s) this.master = findMaster(s, this, tagOf(this)); this.postCurrents.fill(0); }
  /** Is the master operated (coil energised, overload tripped, phases healthy)? */
  operated() { return !!(this.master && this.master.operated()); }
  closedAt(j) { return this.constructor.paths[j][2] === 'NO' ? this.operated() : !this.operated(); }
  stamp(s) { this.constructor.paths.forEach(([a, b], j) => stampSw(s, this.nodes[a], this.nodes[b], this.branches[j], this.closedAt(j), 0.005)); }
  stampStep() {}
  stampAC(ac) { this.constructor.paths.forEach(([a, b], j) => stampSwAC(ac, this.nodes[a], this.nodes[b], this.branches[j], this.closedAt(j), 0.005)); }
  accept(s) {
    this.postCurrents.fill(0);
    this.constructor.paths.forEach(([a, b], j) => { const i = s.x[this.branches[j]]; this.postCurrents[a] += i; this.postCurrents[b] -= i; });
    this.i = s.x[this.branches[0]];
  }
  digitalSettle() { return false; }
  valueLabel() { return ''; }
  readings() {
    return [['Follows', this.master ? `${tagOf(this)} (${this.master.constructor.title})` : `nothing — no coil or relay is tagged "${tagOf(this)}"`, ''],
      ['State', this.closedAt(0) ? 'Closed' : 'Open', ''], ['Current', this.i || 0, 'A']];
  }
}

/** One NO or NC contact: two terminals left and right, tag above, terminal numbers below. */
class LadderContact extends Linked {
  static pins = [['1', 'L'], ['2', 'R']];
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.05 * G, 2 * G, 0.75 * G]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  draw(g) {
    const nc = this.constructor.paths[0][2] === 'NC', c = this.closedAt(0), col = c ? g.accent : g.body;
    g.circle(-G, 0, 2.5, { fill: g.vc(g.pv(0)) });
    g.circle(G, 0, 2.5, { fill: g.vc(g.pv(1)) });
    if (nc) {
      // IEC normally-closed: the blade rests against a stop; operated, it swings away from it
      g.line(0.7 * G, -0.42 * G, 0.7 * G, 0.02 * G, g.body, g.lw);
      g.line(-G, 0, c ? G : 0.75 * G, c ? 0 : 0.36 * G, col, g.lw * 1.3);
    } else g.line(-G, 0, c ? G : 0.85 * G, c ? 0 : -0.55 * G, col, g.lw * 1.3);
    g.text(tagOf(this) || '?', 0, -0.78 * G, { size: 8.5, color: c ? g.accent : g.text1, bold: true, follow: false });
    if (this.p.terms) g.text(this.p.terms, 0, 0.62 * G, { size: 6, color: g.muted, follow: false });
  }
}

export class LadderNO extends LadderContact {
  static type = 'lno'; static title = 'NO Contact (ladder)'; static category = 'Switches';
  static keywords = 'no contact normally open auxiliary contact hold in seal in 13 14 ladder diagram linked contact';
  static props = [TAG('K1'), { key: 'terms', label: 'Terminal numbers', type: 'text', def: '13-14' }];
  static paths = [[0, 1, 'NO']];
  static description = 'Normally-open contact of the coil or relay with the same tag: it closes when that coil pulls in (or the timer runs out, or the overload relay trips). Use it as the hold-in (seal-in) contact across START, or to switch a pilot lamp.';
}
register(LadderNO);

export class LadderNC extends LadderContact {
  static type = 'lnc'; static title = 'NC Contact (ladder)'; static category = 'Switches';
  static keywords = 'nc contact normally closed auxiliary contact interlock 21 22 95 96 overload contact ladder diagram linked contact';
  static props = [TAG('K1'), { key: 'terms', label: 'Terminal numbers', type: 'text', def: '21-22' }];
  static paths = [[0, 1, 'NC']];
  static description = 'Normally-closed contact of the coil or relay with the same tag: it opens when that coil pulls in. Use it for electrical interlocking (forward/reverse, star/delta) or, tagged like an overload relay (95-96), to drop the coil when the motor is overloaded.';
}
register(LadderNC);

export class LadderMain3 extends Linked {
  static type = 'lmain3'; static title = 'Main Contacts 3-pole (ladder)'; static category = 'Switches';
  static keywords = 'main contacts power contacts contactor 3 pole l1 t1 power circuit ladder diagram linked km';
  static pins = [['L1', 'T'], ['L2', 'T'], ['L3', 'T'], ['T1', 'B'], ['T2', 'B'], ['T3', 'B']];
  static paths = [[0, 3, 'NO'], [1, 4, 'NO'], [2, 5, 'NO']];
  static description = 'The three main (power) contacts L1–T1, L2–T2, L3–T3 of the contactor whose coil has the same tag. Draw them in the power circuit; they close together when the coil in the control ladder pulls in.';
  localPosts() { return [[-G, -2 * G], [0, -2 * G], [G, -2 * G], [-G, 2 * G], [0, 2 * G], [G, 2 * G]]; }
  localBox() { return [-1.5 * G, -2 * G, 1.6 * G, 2 * G]; }
  leads() { return [0, 1, 2].flatMap((p) => [[p, (p - 1) * G, -2 * G, (p - 1) * G, -0.8 * G], [p + 3, (p - 1) * G, 2 * G, (p - 1) * G, 0.8 * G]]); }
  labelSide() { return [-1, 0]; }
  draw(g) {
    const c = this.operated(), col = c ? g.accent : g.body;
    for (let p = 0; p < 3; p++) {
      const x = (p - 1) * G;
      g.circle(x, -0.8 * G, 2.2, { fill: g.vc(g.pv(p)) });
      g.circle(x, 0.8 * G, 2.2, { fill: g.vc(g.pv(p + 3)) });
      g.line(x, 0.8 * G, c ? x : x - 0.5 * G, c ? -0.8 * G : -0.55 * G, col, g.lw * 1.2);
    }
    const ym = c ? 0 : 0.1 * G; // mechanical link: the three poles move together
    g.poly([[-G - (c ? 0 : 0.25 * G), ym], [G - (c ? 0 : 0.25 * G), ym]], { stroke: g.muted, width: g.lw * 0.6, dash: [3, 3] });
    g.text(tagOf(this) || '?', 1.35 * G, -0.9 * G, { size: 9, color: c ? g.accent : g.text1, bold: true, align: 'left', follow: false });
  }
}
register(LadderMain3);

export class LadderOLR extends OverloadRelay3 {
  static type = 'lolr'; static title = 'Overload Relay Heaters (ladder)';
  static keywords = 'overload relay heaters thermal olr 3 pole power circuit ladder diagram 95 96 detached f1';
  static props = [TAG('F1'), ...OverloadRelay3.props];
  static pins = [['1', 'T'], ['3', 'T'], ['5', 'T'], ['2', 'B'], ['4', 'B'], ['6', 'B']];
  static noName = true;
  static description = 'The three heaters (1–2, 3–4, 5–6) of a thermal overload relay, for the power circuit of a ladder diagram. Its contacts are drawn in the control ladder with the same tag: an NC Contact (95-96) in series with the coil drops the contactor on overload or phase loss, an NO Contact (97-98) lights a TRIP lamp. Tap it once to TEST (trip it by hand), tap again to RESET.';
  connectivity() { return [[0, 3], [1, 4], [2, 5]]; }
  branchCount() { return 3; }
  localPosts() { return [[-G, -2 * G], [0, -2 * G], [G, -2 * G], [-G, 2 * G], [0, 2 * G], [G, 2 * G]]; }
  localBox() { return [-1.6 * G, -2 * G, 1.6 * G, 2 * G]; }
  leads() { return [0, 1, 2].flatMap((p) => [[p, (p - 1) * G, -2 * G, (p - 1) * G, -0.7 * G], [p + 3, (p - 1) * G, 2 * G, (p - 1) * G, 0.7 * G]]); }
  labelSide() { return [-1, 0]; }
  linkTag() { return tagOf(this); }
  operated() { return this.tripped; }
  stamp(s) { for (let p = 0; p < 3; p++) stampSw(s, this.nodes[p], this.nodes[p + 3], this.branches[p], true, 0.01); }
  stampAC(ac) { for (let p = 0; p < 3; p++) stampSwAC(ac, this.nodes[p], this.nodes[p + 3], this.branches[p], true, 0.01); }
  accept(s) {
    const is = [0, 1, 2].map((p) => s.x[this.branches[p]]);
    is.forEach((i, p) => { this.postCurrents[p] = i; this.postCurrents[p + 3] = -i; });
    this.i = is[0];
    this.thermal(s, is);
  }
  onTap() { if (this.tripped) { this.tripped = false; this.theta = 0; } else { this.tripped = true; this.cause = 'TEST button'; } return true; }
  readings() { return super.readings().map((r, k) => (k ? r : ['State', this.tripped ? `TRIPPED (${this.cause}) — contacts tagged ${tagOf(this)} switched` : 'Normal', ''])); }
  draw(g) {
    if (this.tripped) g.glow(0, 0, 1.5 * G, '255,70,70', 0.4);
    g.box(-1.5 * G, -0.7 * G, 1.5 * G, 0.7 * G, { stroke: this.tripped ? '#ef4444' : g.body, width: g.lw * 0.8, fill: g.fill });
    for (let p = 0; p < 3; p++) { // the thermal (bimetal) element symbol on each pole
      const x = (p - 1) * G;
      g.poly([[x, -0.7 * G], [x, -0.3 * G], [x + 0.25 * G, -0.3 * G], [x + 0.25 * G, 0.3 * G], [x, 0.3 * G], [x, 0.7 * G]], { stroke: g.body, width: g.lw * 0.8 });
    }
    g.text(tagOf(this) || '?', -1.75 * G, -0.9 * G, { size: 9, color: this.tripped ? '#ef4444' : g.text1, bold: true, align: 'right', follow: false });
  }
}
register(LadderOLR);

export class LadderPhase extends PhaseRelay {
  static type = 'lphase'; static title = 'Phase Monitor (ladder)';
  static keywords = 'phase failure relay phase monitor sensing single phasing sequence ladder diagram detached kp';
  static props = [TAG('KP'), ...PhaseRelay.props];
  static pins = [['L1', 'L'], ['L2', 'L'], ['L3', 'L'], ['N', 'L']];
  static noName = true;
  static description = 'The sensing part of a phase-failure / sequence relay (L1, L2, L3, N). While all phases are present, in sequence and balanced, it is operated: its NO Contact (11-14) with the same tag closes in the control ladder. On phase loss, under-voltage, wrong sequence or unbalance it releases after the delay.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  connectivity() { return [[0, 1, 2, 3]]; }
  branchCount() { return 0; }
  linkTag() { return tagOf(this); }
  operated() { return !!this.ok; }
  stamp(s) { const n = this.nodes; for (let p = 0; p < 3; p++) s.addG(n[p], n[3], 1 / 220e3); }
  stampAC(ac) { const n = this.nodes; for (let p = 0; p < 3; p++) ac.addY(n[p], n[3], 1 / 220e3); }
  accept(s) {
    const n = this.nodes, v = [0, 1, 2].map((p) => s.v(n[p]) - s.v(n[3]));
    this.postCurrents = [...v.map((x) => x / 220e3), -(v[0] + v[1] + v[2]) / 220e3];
    this.monitor(s, v);
  }
  draw(g) {
    this.drawChip(g, 'PHASE');
    const { bw, top } = this.geom();
    g.circle(bw - 0.4 * G, top + 0.4 * G, 3, { fill: this.ok ? g.hi : '#ef4444' });
  }
  valueLabel() { return `${tagOf(this) || '?'} ${this.ok ? 'OK' : 'FAULT'}`; }
}
register(LadderPhase);

// ------------------------------------------------------------------ MPCB
export class LadderMPCB extends LadderOLR {
  static type = 'lmpcb'; static title = 'MPCB (ladder)';
  static keywords = 'mpcb motor protection circuit breaker motor circuit breaker thermal magnetic 3 pole q1 manual motor starter';
  static props = [TAG('Q1'), { key: 'ir', label: 'Current setting Ir', unit: 'A', def: 8, min: 0.1, max: 100, log: true, knob: true },
    { key: 'closed', label: 'Switched ON', type: 'bool', def: true }];
  static description = 'Motor protection circuit breaker: a 3-pole switch with a thermal overload release (set to the motor full-load current, Ir) and a magnetic short-circuit release (about 13 × Ir, instant). Tap it to switch OFF / ON; after a trip, tap to reset. Its auxiliary NO Contact (13-14) with the same tag is closed while the breaker is ON — put it in the control circuit.';
  conducting() { return !!this.p.closed && !this.tripped; }
  operated() { return this.conducting(); }
  stamp(s) { const on = this.conducting(); for (let p = 0; p < 3; p++) stampSw(s, this.nodes[p], this.nodes[p + 3], this.branches[p], on, 0.01); }
  stampAC(ac) { const on = this.conducting(); for (let p = 0; p < 3; p++) stampSwAC(ac, this.nodes[p], this.nodes[p + 3], this.branches[p], on, 0.01); }
  accept(s) {
    super.accept(s);
    if (s.mode === 'dc' || this.tripped) return;
    const ipk = Math.max(...[0, 1, 2].map((p) => Math.abs(s.x[this.branches[p]])));
    if (ipk > 13 * this.p.ir * Math.SQRT2) { this.tripped = true; this.cause = 'short circuit'; s.markEvent(); }
  }
  onTap() { if (this.tripped) { this.tripped = false; this.theta = 0; this.p.closed = true; } else this.p.closed = !this.p.closed; return true; }
  readings() { const r = super.readings(); r[0] = ['State', this.tripped ? `TRIPPED (${this.cause})` : this.p.closed ? 'ON' : 'OFF', '']; return r; }
  draw(g) {
    const on = this.conducting(), col = on ? g.accent : g.body;
    if (this.tripped) g.glow(0, 0, 1.5 * G, '255,70,70', 0.4);
    g.box(-1.5 * G, -0.8 * G, 1.5 * G, 0.8 * G, { stroke: this.tripped ? '#ef4444' : g.body, width: g.lw * 0.8, fill: g.fill });
    for (let p = 0; p < 3; p++) {
      const x = (p - 1) * G;
      g.line(x, 0.8 * G, on ? x : x - 0.35 * G, on ? -0.8 * G : -0.45 * G, col, g.lw);
    }
    g.text('I>', 1.05 * G, 0.45 * G, { size: 6.5, color: g.muted, bold: true, follow: false });
    g.text(tagOf(this) || '?', -1.75 * G, -0.9 * G, { size: 9, color: this.tripped ? '#ef4444' : g.text1, bold: true, align: 'right', follow: false });
  }
}
register(LadderMPCB);

// ------------------------------------------------------------------ counter
export class LadderCounter extends asLadderCoil(CoilRelay) {
  static type = 'lcounter'; static title = 'Counter Coil (ladder)'; static category = 'Switches';
  static keywords = 'counter coil preset counter production counter count input ladder diagram industrial counter c1';
  static props = [TAG('C1'), { key: 'preset', label: 'Preset', unit: '', def: 5, min: 1, max: 9999, knob: true },
    ...CoilRelay.props.map((p) => ({ ...p, def: { vcoil: 230, rcoil: 4000, lcoil: 5, ac: true }[p.key] ?? p.def }))];
  static description = 'Count input of an industrial preset counter, drawn as a ladder coil: every time it is energised the count goes up by one. When the count reaches the preset, its contacts (NO / NC Contact parts with the same tag) switch over and stay switched until the counter is reset — by a Counter Reset Coil with the same tag, or by tapping the counter.';
  interactive = true;
  reset() { super.reset(); this.count = 0; this.out = false; }
  onChange(s) {
    if (this.on) this.count++;
    const done = this.count >= this.p.preset;
    if (done !== this.out) { this.out = done; s.markEvent(); }
  }
  digitalSettle() { return false; }
  contactsClosed() { return !!this.out; }
  onTap() { this.count = 0; this.out = false; return true; }
  valueLabel() { return `${this.count || 0} / ${this.p.preset}`; }
  readings(s) { return [['Count', this.count || 0, ''], ['Preset', this.p.preset, ''], ['Contacts', this.out ? 'Switched (preset reached)' : 'Normal', ''], ['Coil current', this.il || 0, 'A'], ['Coil voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V']]; }
  draw(g) { this.drawCoil(g, 'CTR'); }
}
register(LadderCounter);

export class LadderCounterReset extends asLadderCoil(CoilRelay) {
  static type = 'lcreset'; static title = 'Counter Reset Coil (ladder)'; static category = 'Switches';
  static keywords = 'counter reset coil reset input preset counter ladder diagram';
  static props = [TAG('C1'), ...CoilRelay.props.map((p) => ({ ...p, def: { vcoil: 230, rcoil: 4000, lcoil: 5, ac: true }[p.key] ?? p.def }))];
  static description = 'Reset input of the Counter Coil with the same tag: energising it sets the count back to zero and returns the counter contacts to normal.';
  linkTag() { return ''; }
  reset(s) { super.reset(s); if (s) this.counter = findMaster(s, this, tagOf(this)); }
  onChange(s) {
    this.out = this.on;
    const c = this.counter;
    if (this.on && c && c.count !== undefined) { c.count = 0; if (c.out) c.out = false; }
    s.markEvent();
  }
  valueLabel() { return ''; }
  draw(g) { this.drawCoil(g, 'RESET'); }
}
register(LadderCounterReset);

// ------------------------------------------------- carriage / cylinder + limit switches
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** No terminals: a mechanical model that the coils drive and the limit switches watch. */
class Mechanism extends Element {
  static category = 'Switches';
  static noName = true;
  constructor(x, y) { super(x, y); this.postCurrents = []; }
  localPosts() { return []; }
  leads() { return []; }
  connectivity() { return []; }
  branchCount() { return 0; }
  readings() { return []; }
  linkTag() { return tagOf(this); }
  operated() { return false; }
}

export class LadderCart extends Mechanism {
  static type = 'lcart'; static title = 'Carriage / Cylinder (ladder)';
  static keywords = 'carriage trolley conveyor travel cylinder pneumatic piston actuator limit switch auto forward reverse electro pneumatic';
  static props = [TAG('CART'),
    { key: 'mode', label: 'Type', type: 'select', def: 'motor', options: [['motor', 'Carriage: driven forward / back by two coils'], ['cyl', 'Cylinder: extends while its valve coil is on, springs back']] },
    { key: 'fwd', label: 'Forward / extend coil tag', type: 'text', def: 'KF' },
    { key: 'rev', label: 'Reverse coil tag', type: 'text', def: 'KR' },
    { key: 'speed', label: 'Travel speed', unit: '%/s', def: 25, min: 0.1, max: 1000, log: true },
    { key: 'pos', label: 'Start position', unit: '%', def: 0, min: 0, max: 100, knob: true }];
  static description = 'A moving machine part for ladder-diagram examples: a carriage (or conveyor table) that travels forward while the coil tagged "Forward" is energised and back while the "Reverse" coil is, or a single-acting pneumatic cylinder that extends while its solenoid-valve coil is on and springs back when it is off. Limit Switch contacts with its tag operate at set positions (0 % = home, 100 % = far end).';
  localBox() { return [-4 * G, -1.3 * G, 4 * G, 1 * G]; }
  labelSide() { return [0, 1]; }
  reset(s) {
    this.travel = clamp(+this.p.pos || 0, 0, 100);
    if (!s) return;
    this.f = findMaster(s, this, String(this.p.fwd || '').trim());
    this.r = this.p.mode === 'cyl' ? null : findMaster(s, this, String(this.p.rev || '').trim());
  }
  pos() { return this.travel ?? clamp(+this.p.pos || 0, 0, 100); }
  dir() {
    const f = !!(this.f && this.f.operated()), r = this.p.mode === 'cyl' ? !f : !!(this.r && this.r.operated());
    return f && !r ? 1 : r && !f ? -1 : 0;
  }
  accept(s) { if (s.mode !== 'dc') this.travel = clamp(this.pos() + this.dir() * this.p.speed * s.dt, 0, 100); }
  valueLabel() { return `${Math.round(this.pos())} %`; }
  draw(g) {
    const x = this.pos(), cyl = this.p.mode === 'cyl', L = -3.6 * G, R = 3.6 * G;
    if (cyl) {
      const px = -3.4 * G + 3 * G * (x / 100);
      g.box(-3.8 * G, -0.55 * G, -0.2 * G, 0.55 * G, { stroke: g.body, width: g.lw * 0.8, fill: g.fill });
      g.box(px - 0.15 * G, -0.5 * G, px + 0.15 * G, 0.5 * G, { fill: g.body });
      g.box(px, -0.14 * G, px + 3.6 * G, 0.14 * G, { fill: g.muted });
      g.box(px + 3.6 * G, -0.45 * G, px + 3.9 * G, 0.45 * G, { fill: g.text2 });
      g.line(-3.4 * G, 0.75 * G, -3.4 * G + 0.6 * G, 0.75 * G, g.muted, g.lw * 0.5);
    } else {
      g.line(L, 0.45 * G, R, 0.45 * G, g.body, g.lw * 0.8);
      g.line(L, 0.1 * G, L, 0.8 * G, g.body, g.lw * 0.8); g.line(R, 0.1 * G, R, 0.8 * G, g.body, g.lw * 0.8);
      const cx = L + 0.6 * G + (R - L - 1.2 * G) * (x / 100), d = g.running ? this.dir() : 0;
      g.box(cx - 0.6 * G, -0.5 * G, cx + 0.6 * G, 0.3 * G, { stroke: d ? g.accent : g.body, width: g.lw * 0.8, fill: g.fill, r: 3 });
      g.circle(cx - 0.35 * G, 0.38 * G, 2.2, { fill: g.body }); g.circle(cx + 0.35 * G, 0.38 * G, 2.2, { fill: g.body });
      if (d) g.text(d > 0 ? '▶' : '◀', cx, -0.12 * G, { size: 7, color: g.accent, follow: false });
    }
    g.text(tagOf(this) || '?', 0, -1.0 * G, { size: 8.5, color: g.text1, bold: true, follow: false });
  }
}
register(LadderCart);

/** Limit switch operated by the carriage or cylinder with the same tag at a set position. */
class LadderLimit extends LadderContact {
  static props = [TAG('CART'), { key: 'name', label: 'Name', type: 'text', def: 'LS1' },
    { key: 'at', label: 'Operates at position', unit: '%', def: 100, min: 0, max: 100 },
    { key: 'side', label: 'Operated when the position is', type: 'select', def: 'high', options: [['high', 'at or beyond it (far end)'], ['low', 'at or below it (home end)']] }];
  interactive = true;
  operated() {
    const c = this.master;
    if (!c || c.pos === undefined) return !!this.held; // no carriage: press and hold it by hand
    const x = c.pos();
    return this.p.side === 'low' ? x <= +this.p.at + 1e-6 : x >= +this.p.at - 1e-6;
  }
  onPress() { this.held = true; return true; }
  onRelease() { this.held = false; return true; }
  accept(s) {
    super.accept(s);
    const op = this.operated();
    if (op !== this.lastOp) { this.lastOp = op; if (s.mode !== 'dc') s.markEvent(); }
  }
  readings() { return [['Operated', this.operated() ? 'Yes' : 'No', ''], ['State', this.closedAt(0) ? 'Closed' : 'Open', ''], ['Current', this.i || 0, 'A']]; }
  draw(g) {
    const nc = this.constructor.paths[0][2] === 'NC', c = this.closedAt(0), col = c ? g.accent : g.body;
    g.circle(-G, 0, 2.5, { fill: g.vc(g.pv(0)) });
    g.circle(G, 0, 2.5, { fill: g.vc(g.pv(1)) });
    let tip;
    if (nc) { g.line(0.7 * G, -0.42 * G, 0.7 * G, 0.02 * G, g.body, g.lw); tip = c ? [G, 0] : [0.75 * G, 0.36 * G]; }
    else tip = c ? [G, 0] : [0.85 * G, -0.55 * G];
    g.line(-G, 0, tip[0], tip[1], col, g.lw * 1.3);
    // the roller lever that the machine pushes
    g.line(-0.1 * G, (tip[1]) * 0.55, -0.1 * G, -0.75 * G, g.body, g.lw * 0.7);
    g.circle(-0.1 * G, -0.85 * G, 3, { stroke: g.body, width: g.lw * 0.7 });
    g.text(String(this.p.name || ''), 0.62 * G, -0.85 * G, { size: 8.5, color: c ? g.accent : g.text1, bold: true, follow: false, align: 'left' });
    g.text(`${this.p.side === 'low' ? '≤' : '≥'}${Math.round(this.p.at)}%`, 0, 0.62 * G, { size: 6, color: g.muted, follow: false });
  }
}

export class LadderLimitNO extends LadderLimit {
  static type = 'llsno'; static title = 'Limit Switch NO (ladder)';
  static keywords = 'limit switch no normally open position switch roller lever end stop travel auto reverse';
  static paths = [[0, 1, 'NO']];
  static description = 'Normally-open limit switch: closes when the Carriage / Cylinder with the same tag reaches the set position (or while you press and hold it, if no carriage has the tag). Use it to start the next movement (auto reverse, sequence).';
}
register(LadderLimitNO);

export class LadderLimitNC extends LadderLimit {
  static type = 'llsnc'; static title = 'Limit Switch NC (ladder)';
  static keywords = 'limit switch nc normally closed position switch end stop over travel stop at end';
  static paths = [[0, 1, 'NC']];
  static description = 'Normally-closed limit switch: opens when the Carriage / Cylinder with the same tag reaches the set position (or while you press and hold it). Put it in series with a coil to stop the movement at the end of travel.';
}
register(LadderLimitNC);

// ---------------------------------------------------- water tank + floatless level relay
export class LadderTank extends Mechanism {
  static type = 'ltank'; static title = 'Water Tank (ladder)';
  static keywords = 'water tank overhead tank sump reservoir level pump fill water level control automation';
  static props = [TAG('TANK'),
    { key: 'fill', label: 'Filled while this coil is on (tag; empty = always)', type: 'text', def: 'K' },
    { key: 'from', label: 'Draws its water from tank (tag; empty = mains line)', type: 'text', def: '' },
    { key: 'inflow', label: 'Filling rate', unit: '%/s', def: 10, min: 0, max: 1000 },
    { key: 'outflow', label: 'Water use (outflow)', unit: '%/s', def: 3, min: 0, max: 1000, knob: true },
    { key: 'level', label: 'Start level', unit: '%', def: 50, min: 0, max: 100 }];
  static description = 'A water tank for level-control examples: it fills at the filling rate while the coil with the "filled by" tag is energised (taking the water from another tank, if one is named, which then empties), and empties at the water-use rate. Floatless Level Relays with its tag watch its level with their probes.';
  localBox() { return [-1.6 * G, -2.6 * G, 1.6 * G, 2 * G]; }
  labelSide() { return [0, 1]; }
  reset(s) {
    this.lv = clamp(+this.p.level || 0, 0, 100);
    if (!s) return;
    const f = String(this.p.fill || '').trim();
    this.pump = f ? findMaster(s, this, f) : null;
    this.always = !f;
    this.src = findMaster(s, this, String(this.p.from || '').trim());
  }
  level() { return this.lv ?? clamp(+this.p.level || 0, 0, 100); }
  filling() { return (this.always || !!(this.pump && this.pump.operated())) && !(this.src && this.src.level && this.src.level() <= 0); }
  accept(s) {
    if (s.mode === 'dc') return;
    const q = this.filling() ? this.p.inflow * s.dt : 0;
    if (q && this.src && this.src.lv !== undefined) this.src.lv = clamp(this.src.lv - q, 0, 100);
    this.lv = clamp(this.level() + q - this.p.outflow * s.dt, 0, 100);
  }
  valueLabel() { return `${Math.round(this.level())} %`; }
  draw(g) {
    const x = this.level(), top = -1.8 * G, bot = 1.8 * G, h = (bot - top) * (x / 100);
    g.box(-1.4 * G, bot - h, 1.4 * G, bot, { fill: 'rgba(56,140,255,0.45)' });
    g.poly([[-1.4 * G, top], [-1.4 * G, bot], [1.4 * G, bot], [1.4 * G, top]], { stroke: g.body, width: g.lw * 0.9 });
    if (g.running && this.filling()) g.text('▼', 0, top + 0.3 * G, { size: 8, color: g.accent, follow: false });
    g.text(tagOf(this) || '?', 0, -2.25 * G, { size: 8.5, color: g.text1, bold: true, follow: false });
  }
}
register(LadderTank);

export class LadderLevel extends asLadderCoil(CoilRelay) {
  static type = 'llevel'; static title = 'Floatless Level Relay (ladder)'; static category = 'Switches';
  static keywords = 'floatless level relay level controller water level relay electrode probe pump control dry run protection 61f';
  static props = [TAG('KL'), { key: 'tank', label: 'Tank it watches (tag)', type: 'text', def: 'TANK' },
    { key: 'mode', label: 'Function', type: 'select', def: 'fill', options: [['fill', 'Fill: operated below LOW until HIGH (pump on)'], ['dry', 'Dry-run: operated while water is above LOW (resets above HIGH)']] },
    { key: 'low', label: 'LOW probe', unit: '%', def: 20, min: 0, max: 100 },
    { key: 'high', label: 'HIGH probe', unit: '%', def: 90, min: 0, max: 100 },
    ...CoilRelay.props.map((p) => ({ ...p, def: { vcoil: 230, rcoil: 8000, lcoil: 2, ac: true }[p.key] ?? p.def }))];
  static description = 'Floatless (electrode) level relay with LOW and HIGH probes in the tank with the tag it watches. Its supply is the coil A1–A2. Fill mode: its contacts operate when the water falls below LOW and stay operated until it reaches HIGH — an NO contact in the pump contactor rung fills the tank automatically. Dry-run mode: operated while there is water above LOW (an NO contact protects the pump from running dry).';
  reset(s) {
    super.reset(s);
    this.state = false;
    if (!s) return;
    this.tankEl = findMaster(s, this, String(this.p.tank || '').trim());
    const lv = this.tankEl && this.tankEl.level ? this.tankEl.level() : 50;
    this.state = this.p.mode === 'dry' ? lv > this.p.low : lv < this.p.low;
  }
  accept(s) {
    super.accept(s);
    if (s.mode === 'dc' || !this.tankEl || !this.tankEl.level) return;
    const lv = this.tankEl.level(), was = this.state;
    if (this.p.mode === 'dry') this.state = was ? lv > this.p.low : lv >= this.p.high;
    else this.state = was ? lv < this.p.high : lv < this.p.low;
    if (this.state !== was && this.on) s.markEvent();
  }
  contactsClosed() { return !!this.on && !!this.state; }
  onChange(s) { s.markEvent(); }
  digitalSettle(s) {
    const i = Math.abs(s.x[this.branches[0]]), n = i > 0.7 * this.irated();
    if (n !== this.on) { this.on = n; s.dirty = true; return true; }
    return false;
  }
  valueLabel() { return `L${Math.round(this.p.low)} H${Math.round(this.p.high)}`; }
  draw(g) { this.drawCoil(g, this.p.mode === 'dry' ? 'DRY' : 'LEVEL'); }
}
register(LadderLevel);
