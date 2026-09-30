// More switches & relays: household one-way / two-way / intermediate switches,
// DPST, DPDT, rotary selector, ON-OFF-ON selector, latching button, emergency
// stop, limit switch, reed / float / pressure switches, thermostat, general
// relays (DPDT, reed), solid-state relay, 3-pole contactor, timer relay,
// isolator and changeover switch.

import { Element, register, GRID } from './base.js';
import { withChip } from './kit.js';
import { fmtShort, fmtQty } from '../engine/units.js';

const G = GRID;

function stampSw(s, a, b, k, closed, ron) {
  s.addBranchKCL(a, b, k);
  if (closed) { s.addA(k, a - 1, 1); s.addA(k, b - 1, -1); s.addA(k, k, -Math.max(ron, 1e-6)); } else s.addA(k, k, 1);
}
function stampSwAC(ac, a, b, k, closed, ron) {
  ac.addBranchKCL(a, b, k);
  if (closed) { ac.addA(k, a - 1, 1); ac.addA(k, b - 1, -1); ac.addA(k, k, -Math.max(ron, 1e-6)); } else ac.addA(k, k, 1);
}

/**
 * Generic multi-contact switch: `paths()` lists [postA, postB] pairs, `closedSet()`
 * returns which of them conduct in the current state.
 */
class MultiSwitch extends Element {
  static category = 'Switches';
  static prefix = 'S';
  interactive = true;
  constructor(x, y) { super(x, y); this.postCurrents = new Array(this.localPosts().length).fill(0); }
  paths() { return []; }
  closedSet() { return []; }
  ron() { return this.p.ron ?? 0.005; }
  branchCount() { return this.paths().length; }
  valueLabel() { return ''; }
  stamp(s) { const c = this.closedSet(); this.paths().forEach(([a, b], k) => stampSw(s, this.nodes[a], this.nodes[b], this.branches[k], c[k], this.ron())); }
  stampAC(ac) { const c = this.closedSet(); this.paths().forEach(([a, b], k) => stampSwAC(ac, this.nodes[a], this.nodes[b], this.branches[k], c[k], this.ron())); }
  accept(s) {
    this.postCurrents.fill(0);
    this.paths().forEach(([a, b], k) => { const i = s.x[this.branches[k]]; this.postCurrents[a] += i; this.postCurrents[b] -= i; });
    this.i = this.postCurrents[0];
  }
  stateName() { return ''; }
  readings() { return [['State', this.stateName(), ''], ['Current', this.i, 'A']]; }
  contact(g, x1, y1, x2, y2, closed, pv) {
    g.circle(x1, y1, 2.6, { fill: g.vc(pv) });
    g.circle(x2, y2, 2.6, { fill: g.body });
    if (closed) g.line(x1, y1, x2, y2, g.vc(pv), g.lw * 1.1);
    else { const a = Math.atan2(y2 - y1, x2 - x1) - 0.45, L = Math.hypot(x2 - x1, y2 - y1); g.line(x1, y1, x1 + Math.cos(a) * L, y1 + Math.sin(a) * L, g.body, g.lw * 1.1); }
  }
}

// ------------------------------------------------------ household switches
export class OneWaySwitch extends MultiSwitch {
  static type = 'oneway'; static title = 'One-Way Switch'; static keywords = 'one way switch wall switch light switch piano switch household spst';
  static props = [{ key: 'on', label: 'On', type: 'bool', def: false }];
  static description = 'Household one-way (single-pole) wall switch. Tap to switch the light on/off.';
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.2 * G, 2 * G, 0.6 * G]; }
  leads() { return [[0, -2 * G, 0, -0.8 * G, 0], [1, 2 * G, 0, 0.8 * G, 0]]; }
  paths() { return [[0, 1]]; }
  closedSet() { return [!!this.p.on]; }
  onTap() { this.p.on = !this.p.on; return true; }
  stateName() { return this.p.on ? 'ON' : 'OFF'; }
  draw(g) {
    g.circle(-0.8 * G, 0, 3, { fill: g.vc(g.pv(0)) }); g.circle(0.8 * G, 0, 3, { fill: g.vc(g.pv(1)) });
    const on = !!this.p.on;
    g.line(-0.8 * G, 0, on ? 0.8 * G : 0.55 * G, on ? 0 : -0.75 * G, on ? g.vc(g.pv(0)) : g.body, g.lw * 1.2);
    if (!on) g.line(0.55 * G, -0.75 * G, 0.8 * G, -0.95 * G, g.body, g.lw * 1.2);
  }
}
register(OneWaySwitch);

export class TwoWaySwitch extends MultiSwitch {
  static type = 'twoway'; static title = 'Two-Way Switch'; static keywords = 'two way switch staircase switch changeover 2 way household spdt landing';
  static props = [{ key: 'pos', label: 'Position (L2)', type: 'bool', def: false }];
  static description = 'Household two-way switch (staircase wiring): COM connects to L1 or L2. Two of them control one lamp from two places; add intermediate switches for more places.';
  localPosts() { return [[-2 * G, 0], [2 * G, -G], [2 * G, G]]; }
  localBox() { return [-2 * G, -1.5 * G, 2 * G, 1.5 * G]; }
  leads() { return [[0, -2 * G, 0, -0.8 * G, 0], [1, 2 * G, -G, 0.8 * G, -G], [2, 2 * G, G, 0.8 * G, G]]; }
  paths() { return [[0, 1], [0, 2]]; }
  closedSet() { return [!this.p.pos, !!this.p.pos]; }
  onTap() { this.p.pos = !this.p.pos; return true; }
  stateName() { return this.p.pos ? 'COM–L2' : 'COM–L1'; }
  draw(g) {
    g.circle(-0.8 * G, 0, 3, { fill: g.vc(g.pv(0)) });
    g.circle(0.8 * G, -G, 3, { fill: g.vc(g.pv(1)) }); g.circle(0.8 * G, G, 3, { fill: g.vc(g.pv(2)) });
    const ty = this.p.pos ? G : -G;
    g.line(-0.8 * G, 0, 0.78 * G, ty * 0.95, g.vc(g.pv(0)), g.lw * 1.2);
    g.text('L1', 1.2 * G, -1.45 * G, { size: 7, color: g.muted }); g.text('L2', 1.2 * G, 1.45 * G, { size: 7, color: g.muted });
    g.text('C', -1.2 * G, -0.4 * G, { size: 7, color: g.muted });
  }
}
register(TwoWaySwitch);

export class ThreeWaySwitch extends TwoWaySwitch {
  static type = 'threeway'; static title = 'Three-Way Switch (US)'; static keywords = 'three way switch 3 way us staircase travelers common';
  static description = 'US "three-way" switch: common terminal to either traveler. Identical to a UK/BD two-way switch; use two for staircase lighting and four-way (intermediate) switches in between.';
}
register(ThreeWaySwitch);

export class IntermediateSwitch extends MultiSwitch {
  static type = 'intermediate'; static title = 'Intermediate Switch'; static keywords = 'intermediate switch four way 4 way crossover staircase corridor three location';
  static props = [{ key: 'cross', label: 'Crossed', type: 'bool', def: false }];
  static description = 'Intermediate (US: four-way) switch between two two-way switches: straight (1→1, 2→2) or crossed (1→2, 2→1). Lets any number of locations control one lamp.';
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, -G], [2 * G, G]]; }
  localBox() { return [-2 * G, -1.5 * G, 2 * G, 1.5 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 0.8 * G, y]); }
  paths() { return [[0, 2], [1, 3], [0, 3], [1, 2]]; }
  closedSet() { const c = !!this.p.cross; return [!c, !c, c, c]; }
  onTap() { this.p.cross = !this.p.cross; return true; }
  stateName() { return this.p.cross ? 'Crossed' : 'Straight'; }
  draw(g) {
    for (const [x, y, i] of [[-0.8, -1, 0], [-0.8, 1, 1], [0.8, -1, 2], [0.8, 1, 3]]) g.circle(x * G, y * G, 3, { fill: g.vc(g.pv(i)) });
    if (this.p.cross) { g.line(-0.8 * G, -G, 0.8 * G, G, g.vc(g.pv(0)), g.lw * 1.1); g.line(-0.8 * G, G, 0.8 * G, -G, g.vc(g.pv(1)), g.lw * 1.1); } else { g.line(-0.8 * G, -G, 0.8 * G, -G, g.vc(g.pv(0)), g.lw * 1.1); g.line(-0.8 * G, G, 0.8 * G, G, g.vc(g.pv(1)), g.lw * 1.1); }
    g.box(-1.1 * G, -1.4 * G, 1.1 * G, 1.4 * G, { stroke: g.muted, width: g.lw * 0.5, r: 3 });
  }
}
register(IntermediateSwitch);

// ------------------------------------------------------- multi-pole
export class DPST extends MultiSwitch {
  static type = 'dpst'; static title = 'Switch (DPST)'; static keywords = 'dpst double pole single throw switch mains isolator dp';
  static props = [{ key: 'on', label: 'Closed', type: 'bool', def: false }];
  static description = 'Double-pole single-throw switch: two contacts operated together (e.g. switching both L and N).';
  localPosts() { return [[-2 * G, -G], [2 * G, -G], [-2 * G, G], [2 * G, G]]; }
  localBox() { return [-2 * G, -1.6 * G, 2 * G, 1.4 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 0.8 * G, y]); }
  connectivity() { return [[0, 1], [2, 3]]; }
  paths() { return [[0, 1], [2, 3]]; }
  closedSet() { return [!!this.p.on, !!this.p.on]; }
  onTap() { this.p.on = !this.p.on; return true; }
  stateName() { return this.p.on ? 'Closed' : 'Open'; }
  draw(g) {
    this.contact(g, -0.8 * G, -G, 0.8 * G, -G, !!this.p.on, g.pv(0));
    this.contact(g, -0.8 * G, G, 0.8 * G, G, !!this.p.on, g.pv(2));
    g.poly([[0, -G - (this.p.on ? 0 : 6)], [0, G - (this.p.on ? 0 : 6)]], { stroke: g.muted, width: g.lw * 0.6, dash: [3, 3] });
  }
}
register(DPST);

export class DPDT extends MultiSwitch {
  static type = 'dpdt'; static title = 'Switch (DPDT)'; static keywords = 'dpdt double pole double throw switch reversing motor polarity changeover';
  static props = [{ key: 'pos', label: 'Position B', type: 'bool', def: false }];
  static description = 'Double-pole double-throw switch: two changeover contacts operated together — e.g. reversing a DC motor.';
  // 0: COM1, 1: A1, 2: B1, 3: COM2, 4: A2, 5: B2
  localPosts() { return [[-2 * G, -G], [2 * G, -2 * G], [2 * G, 0], [-2 * G, 2 * G], [2 * G, G], [2 * G, 3 * G]]; }
  localBox() { return [-2 * G, -2.4 * G, 2 * G, 3.4 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 0.8 * G, y]); }
  connectivity() { return [[0, 1, 2], [3, 4, 5]]; }
  paths() { return [[0, 1], [0, 2], [3, 4], [3, 5]]; }
  closedSet() { const b = !!this.p.pos; return [!b, b, !b, b]; }
  onTap() { this.p.pos = !this.p.pos; return true; }
  stateName() { return this.p.pos ? 'B' : 'A'; }
  draw(g) {
    const b = !!this.p.pos;
    for (const [c, a, bb, y0] of [[0, 1, 2, -G], [3, 4, 5, 2 * G]]) {
      g.circle(-0.8 * G, y0, 3, { fill: g.vc(g.pv(c)) });
      g.circle(0.8 * G, y0 - G, 3, { fill: g.vc(g.pv(a)) }); g.circle(0.8 * G, y0 + G, 3, { fill: g.vc(g.pv(bb)) });
      g.line(-0.8 * G, y0, 0.76 * G, y0 + (b ? 0.95 : -0.95) * G, g.vc(g.pv(c)), g.lw * 1.1);
    }
    g.poly([[0, -G + (b ? 0.5 : -0.5) * G], [0, 2 * G + (b ? 0.5 : -0.5) * G]], { stroke: g.muted, width: g.lw * 0.6, dash: [3, 3] });
  }
}
register(DPDT);

export class RotarySwitch extends MultiSwitch {
  static type = 'rotary4'; static title = 'Rotary Switch (1P4T)'; static keywords = 'rotary switch selector 1p4t band selector position switch';
  static props = [{ key: 'pos', label: 'Position (1–4)', unit: '', def: 1, min: 1, max: 4, knob: true }];
  static description = 'Single-pole four-position rotary selector: COM connects to one of positions 1–4. Tap to advance.';
  localPosts() { return [[-2 * G, 0], [2 * G, -2 * G], [2 * G, -G], [2 * G, G], [2 * G, 2 * G]]; }
  localBox() { return [-2 * G, -2.4 * G, 2 * G, 2.4 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, i ? 0.9 * G : -0.8 * G, y]); }
  paths() { return [[0, 1], [0, 2], [0, 3], [0, 4]]; }
  k() { return Math.min(4, Math.max(1, Math.round(this.p.pos))); }
  closedSet() { const k = this.k(); return [1, 2, 3, 4].map((i) => i === k); }
  onTap() { this.p.pos = (this.k() % 4) + 1; return true; }
  valueLabel() { return `Pos ${this.k()}`; }
  stateName() { return 'Position ' + this.k(); }
  draw(g) {
    g.circle(-0.8 * G, 0, 3, { fill: g.vc(g.pv(0)) });
    const ys = [-2, -1, 1, 2];
    ys.forEach((y, i) => g.circle(0.9 * G, y * G, 2.6, { fill: g.vc(g.pv(i + 1)) }));
    g.line(-0.8 * G, 0, 0.85 * G, ys[this.k() - 1] * G * 0.97, g.vc(g.pv(0)), g.lw * 1.1);
    const ctx = g.ctx; ctx.beginPath(); ctx.arc(-0.8 * G, 0, 1.25 * G, -1.1, 1.1); ctx.strokeStyle = g.muted; ctx.lineWidth = g.lw * 0.4; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
  }
}
register(RotarySwitch);

export class SelectorSwitch extends MultiSwitch {
  static type = 'selector3'; static title = 'Selector Switch (ON-OFF-ON)'; static keywords = 'selector switch center off on off on spdt centre off hand off auto';
  static props = [{ key: 'pos', label: 'Position (1 = A, 2 = OFF, 3 = B)', unit: '', def: 2, min: 1, max: 3, knob: true }];
  static description = 'Three-position selector with centre OFF: COM → A, open, or COM → B (e.g. HAND–OFF–AUTO). Tap to cycle.';
  localPosts() { return [[-2 * G, 0], [2 * G, -G], [2 * G, G]]; }
  localBox() { return [-2 * G, -1.5 * G, 2 * G, 1.5 * G]; }
  leads() { return [[0, -2 * G, 0, -0.8 * G, 0], [1, 2 * G, -G, 0.8 * G, -G], [2, 2 * G, G, 0.8 * G, G]]; }
  paths() { return [[0, 1], [0, 2]]; }
  k() { return Math.min(3, Math.max(1, Math.round(this.p.pos))); }
  closedSet() { const k = this.k(); return [k === 1, k === 3]; }
  onTap() { this.p.pos = (this.k() % 3) + 1; return true; }
  valueLabel() { return ['A', 'OFF', 'B'][this.k() - 1]; }
  stateName() { return ['COM–A', 'OFF', 'COM–B'][this.k() - 1]; }
  draw(g) {
    g.circle(-0.8 * G, 0, 3, { fill: g.vc(g.pv(0)) });
    g.circle(0.8 * G, -G, 3, { fill: g.vc(g.pv(1)) }); g.circle(0.8 * G, G, 3, { fill: g.vc(g.pv(2)) });
    const ty = [-0.95, 0, 0.95][this.k() - 1];
    g.line(-0.8 * G, 0, (ty ? 0.76 : 0.55) * G, ty * G, g.vc(g.pv(0)), g.lw * 1.1);
    g.text('A', 1.2 * G, -1.45 * G, { size: 7, color: g.muted }); g.text('B', 1.2 * G, 1.45 * G, { size: 7, color: g.muted });
  }
}
register(SelectorSwitch);

export class LatchingButton extends MultiSwitch {
  static type = 'latchbtn'; static title = 'Latching Push Button'; static keywords = 'latching push button push on push off self locking switch';
  static props = [{ key: 'on', label: 'Latched (closed)', type: 'bool', def: false }];
  static description = 'Push-on / push-off button: each press toggles and it stays there.';
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.2 * G, 2 * G, 0.6 * G]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  paths() { return [[0, 1]]; }
  closedSet() { return [!!this.p.on]; }
  onTap() { this.p.on = !this.p.on; return true; }
  stateName() { return this.p.on ? 'Latched ON' : 'OFF'; }
  draw(g) {
    const c = !!this.p.on, y = c ? -2 : -9;
    g.circle(-G, 0, 3, { fill: g.vc(g.pv(0)) }); g.circle(G, 0, 3, { fill: g.vc(g.pv(1)) });
    g.line(-1.1 * G, y, 1.1 * G, y, c ? g.accent : g.body, g.lw * 1.3);
    g.line(0, y, 0, y - 10, g.body, g.lw);
    g.box(-6, y - 16, 6, y - 10, { stroke: g.body, width: g.lw * 0.8, fill: c ? g.accent : g.fill });
  }
}
register(LatchingButton);

export class EmergencyStop extends MultiSwitch {
  static type = 'estop'; static title = 'Emergency Stop'; static keywords = 'emergency stop e-stop mushroom button nc safety';
  static props = [{ key: 'pressed', label: 'Pressed (latched open)', type: 'bool', def: false }];
  static description = 'Normally-closed mushroom-head emergency stop: pressing it latches the contact open; twist to release (tap again).';
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.6 * G, 2 * G, 0.6 * G]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  paths() { return [[0, 1]]; }
  closedSet() { return [!this.p.pressed]; }
  onTap() { this.p.pressed = !this.p.pressed; return true; }
  stateName() { return this.p.pressed ? 'STOPPED (open)' : 'Released (closed)'; }
  draw(g) {
    const p = !!this.p.pressed;
    g.circle(-G, 0, 3, { fill: g.vc(g.pv(0)) }); g.circle(G, 0, 3, { fill: g.vc(g.pv(1)) });
    g.line(-1.1 * G, p ? 6 : 3, 1.1 * G, p ? 6 : 3, p ? g.body : g.vc(g.pv(0)), g.lw * 1.3);
    g.line(0, p ? 6 : 3, 0, -0.6 * G, g.body, g.lw);
    const ctx = g.ctx; ctx.beginPath(); ctx.arc(0, -0.6 * G, 0.55 * G, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = '#dc2626'; ctx.fill(); ctx.strokeStyle = g.body; ctx.lineWidth = g.lw * 0.7; ctx.stroke();
  }
}
register(EmergencyStop);

export class LimitSwitch extends MultiSwitch {
  static type = 'limitsw'; static title = 'Limit Switch'; static keywords = 'limit switch micro switch roller lever end stop position sensor no nc';
  static props = [{ key: 'act', label: 'Actuated', type: 'bool', def: false }];
  static description = 'Changeover limit / micro switch: COM–NC normally, COM–NO when the lever is actuated. Press and hold (or set "Actuated").';
  localPosts() { return [[-2 * G, 0], [2 * G, -G], [2 * G, G]]; }
  localBox() { return [-2 * G, -1.6 * G, 2 * G, 1.5 * G]; }
  leads() { return [[0, -2 * G, 0, -0.8 * G, 0], [1, 2 * G, -G, 0.8 * G, -G], [2, 2 * G, G, 0.8 * G, G]]; }
  constructor(x, y) { super(x, y); this.held = false; }
  paths() { return [[0, 1], [0, 2]]; } // 1 = NO, 2 = NC
  on() { return !!this.p.act || this.held; }
  closedSet() { return [this.on(), !this.on()]; }
  onTap() { return false; }
  onPress() { this.held = true; return true; }
  onRelease() { this.held = false; return true; }
  stateName() { return this.on() ? 'Actuated (COM–NO)' : 'Rest (COM–NC)'; }
  draw(g) {
    const a = this.on();
    g.circle(-0.8 * G, 0, 3, { fill: g.vc(g.pv(0)) });
    g.circle(0.8 * G, -G, 3, { fill: g.vc(g.pv(1)) }); g.circle(0.8 * G, G, 3, { fill: g.vc(g.pv(2)) });
    g.line(-0.8 * G, 0, 0.76 * G, a ? -0.95 * G : 0.95 * G, g.vc(g.pv(0)), g.lw * 1.1);
    g.circle(-0.1 * G, a ? -0.9 * G : -1.25 * G, 0.22 * G, { stroke: g.body, width: g.lw * 0.7 });
    g.text('NO', 1.25 * G, -1.45 * G, { size: 6.5, color: g.muted }); g.text('NC', 1.25 * G, 1.45 * G, { size: 6.5, color: g.muted });
  }
}
register(LimitSwitch);

// ------------------------------------------------- sensing switches (2-pin)
class SenseSwitch extends MultiSwitch {
  static category = 'Switches';
  interactive = false;
  constructor(x, y) { super(x, y); this.state = false; }
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.1 * G, 2 * G, 0.9 * G]; }
  leads() { return [[0, -2 * G, 0, -0.8 * G, 0], [1, 2 * G, 0, 0.8 * G, 0]]; }
  paths() { return [[0, 1]]; }
  reset() { this.state = this.decide(this.decide(false)); }
  decide(prev) { return prev; }
  closedSet() { return [this.p.mode === 'NC' ? !this.state : this.state]; }
  preStep(s) { const n = this.decide(this.state); if (n !== this.state) { this.state = n; s.markEvent(); } }
  valueLabel() { const k = this.knobProp(); return fmtQty(this.p[k.key], k.unit); }
  stateName() { return this.closedSet()[0] ? 'Closed' : 'Open'; }
  readings() { const k = this.knobProp(); return [[k.label, this.p[k.key], k.unit], ['Contact', this.stateName(), ''], ['Current', this.i, 'A']]; }
  drawBase(g) {
    g.circle(-0.8 * G, 0, 3, { fill: g.vc(g.pv(0)) }); g.circle(0.8 * G, 0, 3, { fill: g.vc(g.pv(1)) });
    const c = this.closedSet()[0];
    g.line(-0.8 * G, 0, c ? 0.8 * G : 0.6 * G, c ? 0 : -0.55 * G, c ? g.vc(g.pv(0)) : g.body, g.lw * 1.1);
  }
}
const MODE = { key: 'mode', label: 'Contact', type: 'select', def: 'NO', options: [['NO', 'Normally open'], ['NC', 'Normally closed']] };

export class ReedSwitch extends SenseSwitch {
  static type = 'reed'; static title = 'Reed Switch'; static keywords = 'reed switch magnetic proximity door sensor magnet';
  static props = [{ key: 'dist', label: 'Magnet distance', unit: 'mm', def: 20, min: 0, max: 100, knob: true },
    { key: 'pull', label: 'Pull-in distance', unit: 'mm', def: 10, min: 0.5, max: 100 }, MODE];
  static description = 'Glass reed contacts closed by a nearby magnet: close when the magnet is nearer than the pull-in distance, re-open ~40 % further away (hysteresis).';
  decide(prev) { return prev ? this.p.dist < this.p.pull * 1.4 : this.p.dist < this.p.pull; }
  draw(g) {
    g.box(-G, -0.45 * G, G, 0.45 * G, { stroke: g.muted, width: g.lw * 0.6, r: 0.45 * G });
    this.drawBase(g);
    const d = Math.min(1, this.p.dist / 50);
    g.box(-0.4 * G, -0.9 * G - d * 0.2 * G, 0.4 * G, -0.65 * G - d * 0.2 * G, { fill: '#dc2626' });
  }
}
register(ReedSwitch);

export class FloatSwitch extends SenseSwitch {
  static type = 'floatsw'; static title = 'Float Switch'; static keywords = 'float switch water level tank pump overhead tank level control';
  static props = [{ key: 'level', label: 'Liquid level', unit: '%', def: 50, min: 0, max: 100, knob: true },
    { key: 'set', label: 'Switching level', unit: '%', def: 70, min: 0, max: 100 },
    { key: 'hyst', label: 'Hysteresis', unit: '%', def: 5, min: 0, max: 50 }, MODE];
  static description = 'Float-operated level switch: operates when the liquid rises above the switching level (with hysteresis). NC mode is typical for pump control.';
  decide(prev) { return prev ? this.p.level > this.p.set - this.p.hyst : this.p.level > this.p.set; }
  draw(g) {
    this.drawBase(g);
    g.circle(0, 0.55 * G, 0.28 * G, { stroke: g.body, width: g.lw * 0.7, fill: 'rgba(96,165,250,0.4)' });
    g.line(0, 0.27 * G, 0, 0.05 * G, g.body, g.lw * 0.6);
  }
}
register(FloatSwitch);

export class PressureSwitch extends SenseSwitch {
  static type = 'pressw'; static title = 'Pressure Switch'; static keywords = 'pressure switch pump cut in cut out compressor water pressure control';
  static props = [{ key: 'pres', label: 'Pressure', unit: 'bar', def: 2, min: 0, max: 100, knob: true },
    { key: 'cutin', label: 'Cut-in pressure', unit: 'bar', def: 1.5, min: 0, max: 100 },
    { key: 'cutout', label: 'Cut-out pressure', unit: 'bar', def: 3, min: 0, max: 100 }];
  static description = 'Pump pressure switch: contact closes when pressure falls below cut-in and opens above cut-out (runs the pump in between).';
  decide(prev) { return prev ? this.p.pres < this.p.cutout : this.p.pres < this.p.cutin; }
  closedSet() { return [this.state]; }
  draw(g) {
    this.drawBase(g);
    const ctx = g.ctx; ctx.beginPath(); ctx.arc(0, 0.62 * G, 0.3 * G, Math.PI, 0); ctx.strokeStyle = g.body; ctx.lineWidth = g.lw * 0.7; ctx.stroke();
    g.line(-0.3 * G, 0.62 * G, 0.3 * G, 0.62 * G, g.body, g.lw * 0.7);
  }
}
register(PressureSwitch);

export class Thermostat extends SenseSwitch {
  static type = 'thermostat'; static title = 'Thermostat'; static keywords = 'thermostat bimetal temperature switch heater iron fridge control';
  static props = [{ key: 'temp', label: 'Temperature', unit: '°C', def: 20, min: -50, max: 300, knob: true },
    { key: 'set', label: 'Set point', unit: '°C', def: 25, min: -50, max: 300 },
    { key: 'diff', label: 'Differential', unit: '°C', def: 2, min: 0, max: 50 },
    { key: 'mode', label: 'Mode', type: 'select', def: 'heat', options: [['heat', 'Heating (closed when cold)'], ['cool', 'Cooling (closed when hot)']] }];
  static description = 'Bimetal thermostat with differential: in heating mode the contact closes below (set − diff/2) and opens above (set + diff/2).';
  decide(prev) {
    const { temp, set, diff } = this.p;
    if (this.p.mode === 'cool') return prev ? temp > set - diff / 2 : temp > set + diff / 2;
    return prev ? temp < set + diff / 2 : temp < set - diff / 2;
  }
  closedSet() { return [this.state]; }
  draw(g) {
    this.drawBase(g);
    g.poly([[-0.5 * G, 0.5 * G], [-0.2 * G, 0.5 * G], [0.2 * G, 0.8 * G], [0.5 * G, 0.8 * G]], { stroke: '#f97316', width: g.lw * 0.8 });
  }
}
register(Thermostat);

// ----------------------------------------------------------------- relays
/**
 * Relay/contactor with an R–L coil. The armature follows the rectified-average
 * coil current (τ ≈ 5 ms), so AC coils hold in through current zero crossings.
 * Pull-in at 70 % and drop-out at 35 % of the rated coil current.
 */
class CoilRelay extends withChip(Element) {
  static category = 'Switches';
  static prefix = 'K';
  static coil = [0, 1];
  static contacts = []; // [postA, postB, 'NO'|'NC']
  static props = [
    { key: 'vcoil', label: 'Coil rated voltage', unit: 'V', def: 12, min: 0.5, max: 1000, knob: true },
    { key: 'rcoil', label: 'Coil resistance', unit: 'Ω', def: 150, min: 0.1, max: 1e6, log: true },
    { key: 'lcoil', label: 'Coil inductance', unit: 'H', def: 0.05, min: 1e-6, max: 100, log: true },
    { key: 'ac', label: 'AC coil', type: 'bool', def: false },
    { key: 'freq', label: 'AC coil frequency', unit: 'Hz', def: 50, min: 1, max: 1000 },
  ];
  constructor(x, y) { super(x, y); this.postCurrents = new Array(this.localPosts().length).fill(0); this.on = false; }
  connectivity() { return [this.constructor.coil, ...this.constructor.contacts.map(([a, b]) => [a, b])]; }
  branchCount() { return 1 + this.constructor.contacts.length; }
  reset() { this.on = false; this.iavg = 0; this.il = 0; this.vl = 0; this.postCurrents.fill(0); this.timer = 0; this.out = false; }
  irated() {
    const z = this.p.ac ? Math.hypot(this.p.rcoil, 2 * Math.PI * this.p.freq * this.p.lcoil) : this.p.rcoil;
    return (this.p.vcoil / z) * (this.p.ac ? 0.9 : 1); // rectified mean for AC
  }
  contactsClosed() { return this.out ?? this.on; }
  stamp(s) {
    const [c1, c2] = this.constructor.coil.map((i) => this.nodes[i]), k = this.branches[0];
    s.addBranchKCL(c1, c2, k); s.addA(k, c1 - 1, 1); s.addA(k, c2 - 1, -1);
    s.addA(k, k, -(this.p.rcoil + (s.mode === 'dc' ? 0 : this.p.lcoil / s.dt)));
    const on = this.contactsClosed();
    this.constructor.contacts.forEach(([a, b, t], j) => stampSw(s, this.nodes[a], this.nodes[b], this.branches[1 + j], t === 'NO' ? on : !on, 0.005));
  }
  stampStep(s) { if (s.mode !== 'dc') s.b[this.branches[0]] += -(this.p.lcoil / s.dt) * this.il; }
  accept(s) {
    const i = s.x[this.branches[0]];
    this.il = i;
    const ir = this.irated();
    if (s.mode === 'dc') this.iavg = Math.abs(i); else this.iavg += (Math.abs(i) - this.iavg) * Math.min(1, s.dt / 0.005);
    const next = this.on ? this.iavg > 0.35 * ir : this.iavg > 0.7 * ir;
    if (next !== this.on) { this.on = next; this.onChange(s); }
    this.tick(s);
    this.postCurrents.fill(0);
    const [p1, p2] = this.constructor.coil;
    this.postCurrents[p1] += i; this.postCurrents[p2] -= i;
    this.constructor.contacts.forEach(([a, b], j) => { const ic = s.x[this.branches[1 + j]]; this.postCurrents[a] += ic; this.postCurrents[b] -= ic; });
    this.i = i;
  }
  onChange(s) { this.out = this.on; s.markEvent(); }
  tick() {}
  digitalSettle(s) {
    const i = Math.abs(s.x[this.branches[0]]), n = i > 0.7 * this.irated();
    if (n !== this.on) { this.on = n; this.out = n; s.dirty = true; return true; }
    return false;
  }
  stampAC(ac) {
    const [c1, c2] = this.constructor.coil.map((i) => this.nodes[i]), k = this.branches[0];
    ac.addBranchKCL(c1, c2, k); ac.addA(k, c1 - 1, 1); ac.addA(k, c2 - 1, -1); ac.addA(k, k, -this.p.rcoil, -ac.omega * this.p.lcoil);
    const on = this.contactsClosed();
    this.constructor.contacts.forEach(([a, b, t], j) => stampSwAC(ac, this.nodes[a], this.nodes[b], this.branches[1 + j], t === 'NO' ? on : !on, 0.005));
  }
  valueLabel() { return fmtShort(this.p.vcoil, 'V') + (this.p.ac ? '~' : ''); }
  readings(s) {
    const [c1, c2] = this.constructor.coil.map((i) => this.nodes[i]);
    return [['State', this.contactsClosed() ? 'Energised' : 'Released', ''], ['Coil current', this.il || 0, 'A'], ['Coil voltage', s.v(c1) - s.v(c2), 'V']];
  }
  drawCoilAndContacts(g, title) {
    this.drawChip(g, title);
    const { bw } = this.geom();
    const on = this.contactsClosed();
    g.box(-bw + 0.35 * G, -0.35 * G, -bw + 0.95 * G, 0.45 * G, { stroke: g.body, width: g.lw * 0.7, fill: on ? 'rgba(90,170,255,0.35)' : null });
    g.line(-bw + 0.35 * G, 0.45 * G, -bw + 0.95 * G, -0.35 * G, g.body, g.lw * 0.5);
    g.circle(bw - 0.4 * G, this.geom().top + 0.4 * G, 3, { fill: on ? g.hi : g.lo });
  }
}

export class RelayDPDT extends CoilRelay {
  static type = 'relaydpdt'; static title = 'Relay (DPDT)';
  static keywords = 'relay dpdt double pole changeover 8 pin coil two contacts';
  static pins = [['A1', 'L'], ['A2', 'L'], ['11', 'R'], ['12', 'R'], ['14', 'R'], ['21', 'R'], ['22', 'R'], ['24', 'R']];
  static contacts = [[2, 3, 'NC'], [2, 4, 'NO'], [5, 6, 'NC'], [5, 7, 'NO']];
  static description = 'Two-pole changeover relay (IEC numbering): coil A1–A2; pole 1: 11 common, 12 NC, 14 NO; pole 2: 21, 22, 24. Pull-in at 70 %, drop-out at 35 % of rated coil current.';
  draw(g) { this.drawCoilAndContacts(g, 'K DPDT'); }
}
register(RelayDPDT);

export class ReedRelay extends CoilRelay {
  static type = 'reedrelay'; static title = 'Reed Relay';
  static keywords = 'reed relay small signal dil relay spst';
  static props = CoilRelay.props.map((p) => ({ ...p, def: { vcoil: 5, rcoil: 500, lcoil: 0.005 }[p.key] ?? p.def }));
  static pins = [['A1', 'L'], ['A2', 'L'], ['13', 'R'], ['14', 'R']];
  static contacts = [[2, 3, 'NO']];
  static description = 'Small reed relay: 5 V, 500 Ω coil operating a normally-open reed contact (13–14). Fast and low power — can be driven from logic.';
  draw(g) { this.drawCoilAndContacts(g, 'REED'); }
}
register(ReedRelay);

export class Contactor extends CoilRelay {
  static type = 'contactor'; static title = 'Contactor (3-pole)';
  static keywords = 'contactor magnetic contactor 3 pole motor starter dol star delta a1 a2 l1 t1 aux';
  static props = CoilRelay.props.map((p) => ({ ...p, def: { vcoil: 230, rcoil: 600, lcoil: 3, ac: true }[p.key] ?? p.def }));
  static pins = [['A1', 'L'], ['A2', 'L'], ['L1', 'T'], ['L2', 'T'], ['L3', 'T'], ['T1', 'B'], ['T2', 'B'], ['T3', 'B'], ['13', 'R'], ['14', 'R']];
  static contacts = [[2, 5, 'NO'], [3, 6, 'NO'], [4, 7, 'NO'], [8, 9, 'NO']];
  static description = 'Three-pole power contactor with 230 V AC coil (A1–A2), main contacts L1–T1, L2–T2, L3–T3 and an auxiliary NO contact 13–14 for the hold-in (self-latching) circuit of a DOL starter.';
  draw(g) {
    this.drawCoilAndContacts(g, 'KM');
    const on = this.contactsClosed(), { posts } = this.geom();
    for (let p = 0; p < 3; p++) {
      const x = posts[2 + p][0];
      g.line(x, -0.5 * G, x + (on ? 0 : 0.25 * G), 0.35 * G, g.body, g.lw * 0.8);
    }
  }
}
register(Contactor);

export class TimerRelay extends CoilRelay {
  static type = 'tdr'; static title = 'Timer Relay (TON/TOF)';
  static keywords = 'timer relay time delay relay on delay off delay star delta timer ton tof';
  static props = [
    { key: 't', label: 'Delay time', unit: 's', def: 1, min: 1e-3, max: 3600, log: true, knob: true },
    { key: 'mode', label: 'Function', type: 'select', def: 'on', options: [['on', 'On-delay (TON)'], ['off', 'Off-delay (TOF)']] },
    ...CoilRelay.props.map((p) => ({ ...p, def: { vcoil: 230, rcoil: 20000, lcoil: 0.5, ac: true }[p.key] ?? p.def })),
  ];
  static pins = [['A1', 'L'], ['A2', 'L'], ['15', 'R'], ['16', 'R'], ['18', 'R']];
  static contacts = [[2, 3, 'NC'], [2, 4, 'NO']];
  static description = 'Time-delay relay. On-delay: the changeover contact (15 COM, 16 NC, 18 NO) switches T seconds after the coil is energised. Off-delay: it switches immediately and returns T seconds after de-energising.';
  onChange(s) {
    this.timer = 0;
    if (this.p.mode === 'off' && this.on) { this.out = true; s.markEvent(); }
    if (this.p.mode === 'on' && !this.on) { this.out = false; s.markEvent(); }
  }
  tick(s) {
    if (s.mode === 'dc') return;
    const want = this.p.mode === 'on' ? this.on : !this.on;
    if (want && this.out !== (this.p.mode === 'on')) {
      this.timer += s.dt;
      if (this.timer >= this.p.t) { this.out = this.p.mode === 'on'; s.markEvent(); }
    }
  }
  digitalSettle() { return false; }
  valueLabel() { return `${this.p.mode === 'on' ? 'TON' : 'TOF'} ${fmtShort(this.p.t, 's')}`; }
  readings(s) { return [...super.readings(s), ['Elapsed', this.timer || 0, 's']]; }
  draw(g) {
    this.drawCoilAndContacts(g, this.p.mode === 'on' ? 'TON' : 'TOF');
    if (g.running && this.timer > 0 && this.timer < this.p.t) {
      const { bw, bot } = this.geom();
      g.box(-bw + 0.2 * G, bot - 0.35 * G, -bw + 0.2 * G + (2 * bw - 0.4 * G) * (this.timer / this.p.t), bot - 0.2 * G, { fill: '#f59e0b' });
    }
  }
}
register(TimerRelay);

// ------------------------------------------------------- solid-state relay
export class SSR extends withChip(Element) {
  static type = 'ssr'; static title = 'Solid-State Relay (SSR)'; static category = 'Switches';
  static prefix = 'K'; static keywords = 'ssr solid state relay zero cross triac optically isolated ac load control';
  static props = [
    { key: 'ift', label: 'Input trigger current', unit: 'A', def: 0.005, min: 1e-4, max: 0.1, log: true },
    { key: 'zc', label: 'Zero-cross switching', type: 'bool', def: true },
    { key: 'ih', label: 'Output holding current', unit: 'A', def: 0.05, min: 1e-4, max: 5 },
  ];
  static pins = [['3+', 'L'], ['4−', 'L'], ['1', 'R'], ['2', 'R']];
  static description = 'Optically isolated AC solid-state relay: input LED (3+/4−, ~1.2 V + 1 kΩ internal) triggers a TRIAC output (1–2) at the next voltage zero crossing; it turns off at current zero after the input is removed.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0, 0]; }
  connectivity() { return [[0, 1], [2, 3]]; }
  reset() { this.on = false; this.vd = 0; this.postCurrents.fill(0); this.iin = 0; }
  led(v) {
    // IR LED (n = 2) in series with 1 kΩ: solve with the diode current directly
    const is = 1e-12, nvt = 2 * 0.02585;
    if (v <= 0) return { i: v * 1e-9, g: 1e-9 };
    const r = 1000;
    let i = Math.max(0, (v - 1.1) / r);
    for (let k = 0; k < 30; k++) { const vd = nvt * Math.log(1 + i / is), f = vd + i * r - v, d = nvt / (i + is) + r; i = Math.max(0, i - f / d); }
    return { i, g: 1 / (nvt / (i + is) + r) };
  }
  stamp(s) { s.addG(this.nodes[2], this.nodes[3], this.on ? 50 : 1e-9); }
  stampNL(s) {
    const [a, k] = this.nodes, v = s.v(a) - s.v(k), { i, g } = this.led(v);
    s.addG(a, k, g); s.addI(a, k, i - g * v);
  }
  accept(s) {
    const [a, k, o1, o2] = this.nodes, v = s.v(a) - s.v(k), vo = s.v(o1) - s.v(o2);
    this.iin = this.led(v).i;
    const io = vo * (this.on ? 50 : 1e-9);
    this.postCurrents = [this.iin, -this.iin, io, -io];
    this.i = this.iin;
    if (s.mode === 'dc') { this.on = this.iin > this.p.ift; return; }
    if (!this.on && this.iin > this.p.ift && (!this.p.zc || Math.abs(vo) < 15)) { this.on = true; s.markEvent(); } else if (this.on && this.iin < this.p.ift && Math.abs(io) < this.p.ih) { this.on = false; s.markEvent(); }
  }
  stampAC(ac) { ac.addY(this.nodes[2], this.nodes[3], this.on ? 50 : 1e-9); ac.addY(this.nodes[0], this.nodes[1], 1e-3); }
  valueLabel() { return this.p.zc ? 'ZC' : ''; }
  readings(s) { return [['Output', this.on ? 'ON' : 'OFF', ''], ['Input current', this.iin || 0, 'A'], ['Load current', this.postCurrents[2], 'A'], ['Output voltage', s.v(this.nodes[2]) - s.v(this.nodes[3]), 'V']]; }
  draw(g) {
    this.drawChip(g, 'SSR');
    g.poly([[-0.55 * G, -0.25 * G], [-0.15 * G, 0], [-0.55 * G, 0.25 * G]], { stroke: g.body, width: g.lw * 0.6, close: true, fill: this.iin > this.p.ift && g.running ? 'rgba(255,80,80,0.6)' : null });
    for (const dy of [-0.2, 0.2]) g.line(0.05 * G, dy * G, 0.35 * G, dy * G + 3, g.muted, g.lw * 0.5);
    g.circle(0.6 * G, 0, 3, { fill: this.on ? g.hi : g.lo });
  }
}
register(SSR);

// ------------------------------------------------------ isolator/changeover
export class Isolator extends MultiSwitch {
  static type = 'isolator'; static title = 'Isolator (Disconnector)'; static keywords = 'isolator disconnector main switch off load switch';
  static props = [{ key: 'on', label: 'Closed', type: 'bool', def: true }];
  static description = 'Off-load isolator: provides a visible break for safe maintenance. Operate only with no load current.';
  localPosts() { return [[-2 * G, 0], [2 * G, 0]]; }
  localBox() { return [-2 * G, -1.1 * G, 2 * G, 0.6 * G]; }
  leads() { return [[0, -2 * G, 0, -G, 0], [1, 2 * G, 0, G, 0]]; }
  paths() { return [[0, 1]]; }
  closedSet() { return [!!this.p.on]; }
  onTap() { this.p.on = !this.p.on; return true; }
  stateName() { return this.p.on ? 'Closed' : 'Open (isolated)'; }
  draw(g) {
    const on = !!this.p.on;
    g.circle(-G, 0, 2.6, { fill: g.vc(g.pv(0)) });
    g.line(-G, 0, on ? G : 0.7 * G, on ? 0 : -0.7 * G, on ? g.vc(g.pv(0)) : g.body, g.lw * 1.2);
    g.line(G, -0.35 * G, G, 0.35 * G, g.vc(g.pv(1)), g.lw * 1.3);
  }
}
register(Isolator);

export class Changeover extends MultiSwitch {
  static type = 'changeover'; static title = 'Changeover Switch (Mains/Gen)'; static keywords = 'changeover switch manual transfer switch generator mains ats ups two pole';
  static props = [{ key: 'pos', label: 'Position (1 = Mains, 2 = Off, 3 = Generator)', unit: '', def: 1, min: 1, max: 3, knob: true }];
  static description = 'Two-pole, three-position changeover: the load (L, N) is connected to Mains, to nothing, or to the Generator — never both. Tap to cycle.';
  // 0: load L, 1: load N, 2: mains L, 3: mains N, 4: gen L, 5: gen N
  localPosts() { return [[-2 * G, -G], [-2 * G, G], [2 * G, -3 * G], [2 * G, -2 * G], [2 * G, 2 * G], [2 * G, 3 * G]]; }
  localBox() { return [-2 * G, -3.5 * G, 2 * G, 3.5 * G]; }
  leads() { return this.localPosts().map(([x, y], i) => [i, x, y, Math.sign(x) * 1.1 * G, y]); }
  paths() { return [[0, 2], [1, 3], [0, 4], [1, 5]]; }
  k() { return Math.min(3, Math.max(1, Math.round(this.p.pos))); }
  closedSet() { const k = this.k(); return [k === 1, k === 1, k === 3, k === 3]; }
  onTap() { this.p.pos = (this.k() % 3) + 1; return true; }
  valueLabel() { return ['MAINS', 'OFF', 'GEN'][this.k() - 1]; }
  stateName() { return ['Mains', 'Off', 'Generator'][this.k() - 1]; }
  draw(g) {
    g.box(-1.1 * G, -3.4 * G, 1.1 * G, 3.4 * G, { stroke: g.body, width: g.lw * 0.9, fill: g.fill, r: 4 });
    const k = this.k();
    for (const [c, y] of [[0, -G], [1, G]]) {
      g.circle(-1.1 * G, y, 2.6, { fill: g.vc(g.pv(c)) });
      const ty = k === 1 ? (c ? -2 : -3) * G : k === 3 ? (c ? 3 : 2) * G : y;
      g.line(-1.1 * G, y, k === 2 ? 0.2 * G : 1.1 * G, k === 2 ? y : ty, g.vc(g.pv(c)), g.lw);
    }
    g.text('MAINS', -0.35 * G, -3 * G, { size: 6.5, color: g.muted });
    g.text('GEN', -0.35 * G, 3 * G, { size: 6.5, color: g.muted });
  }
}
register(Changeover);
