// Ladder-diagram (detached) parts, drawn the way control circuits are taught: the coil
// of a contactor or timer sits in a rung of the control ladder, and its contacts are
// separate symbols wherever they are needed (main contacts in the power circuit, NO/NC
// auxiliaries in other rungs). Contacts follow the coil, overload relay or monitoring
// relay that carries the same tag (e.g. "KF"), just as on a printed schematic.

import { register, GRID } from './base.js';
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
  static props = [TAG('KT'), ...TimerRelay.props];
  static description = 'The coil of a time-delay relay, drawn on its own in a ladder rung. Contacts with the same tag are its timed contacts: on-delay (TON) — an NO contact closes and an NC contact opens T seconds after the coil is energised; off-delay (TOF) — they switch at once and return T seconds after it is de-energised.';
  valueLabel() { return `${this.p.mode === 'on' ? 'TON' : 'TOF'} ${fmtShort(this.p.t, 's')}`; }
  draw(g) {
    this.drawCoil(g, this.p.mode === 'on' ? 'TON' : 'TOF');
    if (g.running && this.timer > 0 && this.timer < this.p.t) g.box(-G, 0.62 * G, -G + 2 * G * (this.timer / this.p.t), 0.75 * G, { fill: '#f59e0b' });
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
  static description = 'The three heaters (1–2, 3–4, 5–6) of a thermal overload relay, for the power circuit of a ladder diagram. Its contacts are drawn in the control ladder with the same tag: an NC Contact (95-96) in series with the coil drops the contactor on overload or phase loss, an NO Contact (97-98) lights a TRIP lamp. Tap it to reset after a trip.';
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
