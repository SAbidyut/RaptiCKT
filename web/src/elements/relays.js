// Real-life relays and the parts that go with them:
//  - 8-pin square plug-in relay (Omron MY2N type, DPDT, LED indicator)
//  - 8-pin octal relay (Omron MK2P type, DPDT, round 8-pin base)
//  - 14-pin square plug-in relay (Omron MY4N type, 4PDT, LED indicator)
//  - automotive relays, 4-pin (SPST, 30–87) and 5-pin (changeover, 30–87/87a)
//  - 1-channel 5 V relay module (SRD-05VDC relay, optocoupler input, low/high trigger)
//  - ULN2003 seven-channel Darlington driver with the flyback clamp diodes to COM
//  - 8-pin and 14-pin plug-in timers (H3CR-A8 / AH3-3, H3Y-4): on-delay, off-delay,
//    interval and flicker
//  - automatic voltage stabilizer (relay tap-changing autotransformer, low/high cut,
//    start delay) as used on fridges and TVs
//  - electronic turn-signal flasher (85 flashes/min, flashes twice as fast when a
//    lamp is out)

import { Element, register, GRID } from './base.js';
import { withChip } from './kit.js';
import { CoilRelay, stampSw, stampSwAC } from './switches2.js';
import { fmtShort } from '../engine/units.js';

const G = GRID;

/** smooth ramp: y = s·ln(1 + e^(x/s)) ≈ max(0, x), d = dy/dx */
function ramp(x, s) {
  const u = x / s;
  const y = u > 30 ? x : u < -30 ? s * Math.exp(u) : s * Math.log1p(Math.exp(u));
  const d = 1 / (1 + Math.exp(-Math.max(-60, Math.min(60, u))));
  return { y, d };
}

/**
 * Coil and changeover poles drawn inside the relay body: the coil on the left, each pole's
 * moving contact pivoting at its COM terminal and resting on NC (released) or NO
 * (energised), and a dashed mechanical link from the coil to the contacts.
 * poles = [[com, nc|null, no|null], …] post indices; coil = [a, b] post indices.
 */
function drawRelayBody(el, g, title, coil, poles, o = {}) {
  const { bw, top, bot, posts } = el.geom();
  const on = el.contactsClosed ? el.contactsClosed() : el.on;
  const hot = on ? g.accent : g.body;
  el.drawChip(g, null, { fill: o.fill });
  g.text(title, -bw + 0.22 * G, top + 0.45 * G, { size: 8, color: g.accent, bold: true, align: 'left' });
  // coil
  const ya = posts[coil[0]][1], yb = posts[coil[1]][1];
  const cx = -bw + 1.05 * G, cy1 = Math.min(ya, yb) + 0.25 * G, cy2 = Math.max(ya, yb) - 0.25 * G;
  for (const y of [ya, yb]) g.line(-bw + 0.55 * G, y, cx, y, g.body, g.lw * 0.5);
  g.line(cx, ya, cx, cy1, g.body, g.lw * 0.5); g.line(cx, yb, cx, cy2, g.body, g.lw * 0.5);
  g.box(cx - 0.22 * G, cy1, cx + 0.22 * G, cy2, { stroke: hot, width: g.lw * 0.75, fill: on ? 'rgba(90,170,255,0.35)' : null });
  g.line(cx - 0.22 * G, cy2, cx + 0.22 * G, cy1, hot, g.lw * 0.5);
  // poles
  const xl = bw - 0.62 * G, xc = bw - 1.0 * G, xp = bw - 1.9 * G;
  const mids = [];
  for (const [com, nc, no] of poles) {
    const y0 = posts[com][1];
    g.line(xp, y0, xl, y0, g.body, g.lw * 0.6);
    g.circle(xp, y0, 1.8, { fill: g.body });
    for (const [k, t] of [[nc, 'NC'], [no, 'NO']]) {
      if (k == null) continue;
      const y = posts[k][1];
      g.line(xc, y, xl, y, g.body, g.lw * 0.6);
      g.text(t, xc - 0.12 * G, y, { size: 5.5, color: g.muted, align: 'right', follow: true });
    }
    const tgt = on ? no : nc, yt = tgt != null ? posts[tgt][1] : y0 + (posts[no ?? nc][1] - y0) * 0.55;
    const xe = tgt != null ? xc : xc - 0.15 * G;
    g.line(xp, y0, xe, tgt != null ? yt : yt, on && tgt != null ? g.accent : g.body, g.lw * 0.9);
    mids.push([(xp + xe) / 2, (y0 + yt) / 2]);
  }
  if (mids.length) {
    const xm = mids[0][0], ylo = Math.min(...mids.map((m) => m[1])), yhi = Math.max(...mids.map((m) => m[1]));
    g.poly([[cx + 0.22 * G, (cy1 + cy2) / 2], [xm, (cy1 + cy2) / 2]], { stroke: g.muted, width: g.lw * 0.45, dash: [3, 3] });
    g.poly([[xm, Math.min(ylo, (cy1 + cy2) / 2)], [xm, Math.max(yhi, (cy1 + cy2) / 2)]], { stroke: g.muted, width: g.lw * 0.45, dash: [3, 3] });
  }
  // LED indicator (MY-N types) or state lamp
  const lx = bw - 0.4 * G, ly = top + 0.4 * G;
  if (o.led) {
    g.circle(lx, ly, 3.2, { fill: on && g.running ? '#ef4444' : '#5b1d1d' });
    if (on && g.running) g.glow(lx, ly, 0.5 * G, '255,70,70', 0.5);
  } else g.circle(lx, ly, 3, { fill: on ? g.hi : g.lo });
  if (o.base) g.text(o.base, 0, bot - 0.3 * G, { size: 6, color: g.muted, follow: true });
}

// ---------------------------------------------------- plug-in relay family
// coil data of real plug-in relays (rated voltage, resistance, inductance, AC coil):
// Omron MY / MK datasheets, rounded; AC coils at 50 Hz
const MY_COILS = {
  '230 V AC': { vcoil: 230, rcoil: 10750, lcoil: 140, ac: true, freq: 50 },
  '110 V AC': { vcoil: 110, rcoil: 2350, lcoil: 34, ac: true, freq: 50 },
  '24 V AC': { vcoil: 24, rcoil: 125, lcoil: 1.4, ac: true, freq: 50 },
  '24 V DC': { vcoil: 24, rcoil: 650, lcoil: 1.2, ac: false },
  '12 V DC': { vcoil: 12, rcoil: 160, lcoil: 0.3, ac: false },
};
const MK_COILS = {
  '230 V AC': { vcoil: 230, rcoil: 4500, lcoil: 55, ac: true, freq: 50 },
  '110 V AC': { vcoil: 110, rcoil: 1100, lcoil: 14, ac: true, freq: 50 },
  '24 V AC': { vcoil: 24, rcoil: 55, lcoil: 0.65, ac: true, freq: 50 },
  '24 V DC': { vcoil: 24, rcoil: 450, lcoil: 0.9, ac: false },
  '12 V DC': { vcoil: 12, rcoil: 113, lcoil: 0.22, ac: false },
};
const AUTO_COILS = {
  '12 V DC': { vcoil: 12, rcoil: 85, lcoil: 0.08, ac: false },
  '24 V DC': { vcoil: 24, rcoil: 320, lcoil: 0.3, ac: false },
};
const coilProps = (presets, def) => [
  { key: 'model', label: 'Coil', type: 'select', def, options: Object.keys(presets).map((k) => [k, k]).concat([['custom', 'Custom']]), preset: presets },
  { key: 'vcoil', label: 'Coil rated voltage', unit: 'V', def: presets[def].vcoil, min: 0.5, max: 1000 },
  { key: 'rcoil', label: 'Coil resistance', unit: 'Ω', def: presets[def].rcoil, min: 0.1, max: 1e6, log: true },
  { key: 'lcoil', label: 'Coil inductance', unit: 'H', def: presets[def].lcoil, min: 1e-6, max: 1000, log: true },
  { key: 'ac', label: 'AC coil', type: 'bool', def: !!presets[def].ac },
  { key: 'freq', label: 'AC coil frequency', unit: 'Hz', def: 50, min: 1, max: 1000 },
];

class PlugRelay extends CoilRelay {
  static chipOpts = { w: 2.3 * G };
  static coilPins = [0, 1];
  static poles = [];
  static glyph = 'K';
  static led = false;
  static base = '';
  draw(g) { drawRelayBody(this, g, this.constructor.glyph, this.constructor.coilPins, this.constructor.poles, { led: this.constructor.led, base: this.constructor.base }); }
}
/** contacts list ([a, b, 'NC'|'NO']) of changeover poles */
const poleContacts = (poles) => poles.flatMap(([c, nc, no]) => [...(nc != null ? [[c, nc, 'NC']] : []), ...(no != null ? [[c, no, 'NO']] : [])]);

export class Relay8 extends PlugRelay {
  static type = 'relay8'; static title = '8-Pin Relay (DPDT, MY2N)';
  static keywords = 'relay 8 pin 8pin my2n my2 omron dpdt plug in square relay 220v 230v 12v 24v socket pyf08a panel control relay led';
  static props = coilProps(MY_COILS, '230 V AC');
  // base terminals as printed on the PYF08A socket: coil 13–14, pole 1: 9 COM / 1 NC / 5 NO, pole 2: 12 COM / 4 NC / 8 NO
  static pins = [['14', 'L'], ['13', 'L'], ['9', 'R'], ['1', 'R'], ['5', 'R'], ['12', 'R'], ['4', 'R'], ['8', 'R']];
  static poles = [[2, 3, 4], [5, 6, 7]];
  static contacts = poleContacts(Relay8.poles);
  static glyph = 'MY2N'; static led = true; static base = '8-pin';
  static description = 'The common 8-pin square plug-in relay (Omron MY2N type) with its LED indicator, as used in control panels. Coil 13–14; two changeover poles: 9 common, 1 NC, 5 NO and 12 common, 4 NC, 8 NO (the numbers on the PYF08A socket). Contacts 5 A at 250 V AC. Pick the coil (230 V AC, 110 V AC, 24 V AC/DC or 12 V DC) — a coil on the wrong voltage either does not pull in or burns. Pull-in at 70 %, drop-out at 35 % of the rated coil current.';
}
register(Relay8);

export class Relay8Octal extends PlugRelay {
  static type = 'relay8oct'; static title = '8-Pin Octal Relay (DPDT, MK2P)';
  static keywords = 'relay 8 pin octal round mk2p mk2pi 11 pin dpdt plug in pf083a socket 220v 230v 12v 24v industrial relay';
  static props = coilProps(MK_COILS, '230 V AC');
  // round octal base: coil 2–7, pole 1: 1 COM / 4 NC / 3 NO, pole 2: 8 COM / 5 NC / 6 NO
  static pins = [['2', 'L'], ['7', 'L'], ['1', 'R'], ['4', 'R'], ['3', 'R'], ['8', 'R'], ['5', 'R'], ['6', 'R']];
  static poles = [[2, 3, 4], [5, 6, 7]];
  static contacts = poleContacts(Relay8Octal.poles);
  static glyph = 'MK2P'; static base = 'octal';
  static description = 'Heavy-duty 8-pin octal (round base) relay, Omron MK2P type, on a PF083A socket. Coil 2–7; pole 1: 1 common, 4 NC, 3 NO; pole 2: 8 common, 5 NC, 6 NO. Contacts 10 A at 250 V AC — enough for a pump or heater contactor coil or small loads directly. Pick the coil voltage; pull-in at 70 %, drop-out at 35 % of the rated coil current.';
}
register(Relay8Octal);

export class Relay14 extends PlugRelay {
  static type = 'relay14'; static title = '14-Pin Relay (4PDT, MY4N)';
  static keywords = 'relay 14 pin 14pin my4n my4 omron 4pdt four pole plug in square relay 220v 230v 12v 24v socket pyf14a panel control relay led';
  static props = coilProps(MY_COILS, '230 V AC');
  // PYF14A socket: coil 13–14; pole k: 8+k COM, k NC, 4+k NO
  static pins = [['14', 'L'], ['13', 'L'], ['9', 'R'], ['1', 'R'], ['5', 'R'], ['10', 'R'], ['2', 'R'], ['6', 'R'], ['11', 'R'], ['3', 'R'], ['7', 'R'], ['12', 'R'], ['4', 'R'], ['8', 'R']];
  static poles = [[2, 3, 4], [5, 6, 7], [8, 9, 10], [11, 12, 13]];
  static contacts = poleContacts(Relay14.poles);
  static glyph = 'MY4N'; static led = true; static base = '14-pin';
  static description = 'The common 14-pin square plug-in relay (Omron MY4N type) with LED indicator: four changeover poles for interlocking and signalling. Coil 13–14; pole 1: 9 common, 1 NC, 5 NO; pole 2: 10, 2, 6; pole 3: 11, 3, 7; pole 4: 12, 4, 8 (PYF14A socket numbers). Contacts 3 A at 250 V AC per pole. Pick the coil voltage; pull-in at 70 %, drop-out at 35 % of the rated coil current.';
}
register(Relay14);

export class AutoRelay4 extends PlugRelay {
  static type = 'relayauto4'; static title = 'Automotive Relay 4-Pin (SPST)';
  static keywords = 'automotive relay car relay 4 pin 30 87 85 86 bosch 12v 24v horn headlight fan spst 30a 40a';
  static props = coilProps(AUTO_COILS, '12 V DC');
  static pins = [['85', 'L'], ['86', 'L'], ['30', 'R'], ['87', 'R']];
  static poles = [[2, null, 3]];
  static contacts = poleContacts(AutoRelay4.poles);
  static chipOpts = { w: 2.3 * G };
  static glyph = 'AUTO';
  static description = 'Standard 4-pin car (Bosch-type) relay: coil 85–86 (12 V, ≈85 Ω, ≈140 mA), contact 30 → 87 closes when energised. Contacts 30 A — horns, headlights, fuel pumps and radiator fans are switched through it so that the dashboard switch only carries the coil current.';
}
register(AutoRelay4);

export class AutoRelay5 extends PlugRelay {
  static type = 'relayauto5'; static title = 'Automotive Relay 5-Pin (changeover)';
  static keywords = 'automotive relay car relay 5 pin 30 87 87a 85 86 bosch 12v 24v changeover spdt 30a 40a';
  static props = coilProps(AUTO_COILS, '12 V DC');
  static pins = [['85', 'L'], ['86', 'L'], ['30', 'R'], ['87a', 'R'], ['87', 'R']];
  static poles = [[2, 3, 4]];
  static contacts = poleContacts(AutoRelay5.poles);
  static glyph = 'AUTO';
  static description = 'Standard 5-pin car (Bosch-type) changeover relay: coil 85–86 (12 V, ≈85 Ω), common 30 connected to 87a (NC) when released and to 87 (NO) when energised. Contacts 30 A.';
}
register(AutoRelay5);

// ------------------------------------------------------- plug-in timers
// supply of electronic multi-mode timers (Omron H3CR-A8 / H3Y-4, AH3-3): nearly resistive
const TIMER_COILS = {
  '230 V AC': { vcoil: 230, rcoil: 24000, lcoil: 1, ac: true, freq: 50 },
  '110 V AC': { vcoil: 110, rcoil: 5500, lcoil: 0.3, ac: true, freq: 50 },
  '24 V AC': { vcoil: 24, rcoil: 260, lcoil: 0.02, ac: true, freq: 50 },
  '24 V DC': { vcoil: 24, rcoil: 600, lcoil: 0.02, ac: false },
  '12 V DC': { vcoil: 12, rcoil: 150, lcoil: 0.01, ac: false },
};
const TIMER_MODES = [['on', 'On-delay (TON)'], ['off', 'Off-delay (TOF)'], ['int', 'Interval (ON for T)'], ['flk', 'Flicker (OFF T / ON T, repeats)']];
const MODE_TAG = { on: 'TON', off: 'TOF', int: 'INT', flk: 'FLK' };
/**
 * Plug-in electronic timer: the supply terminals take the place of the coil, and the output
 * relay's changeover poles follow the timing function instead of the supply directly.
 */
class PlugTimer extends PlugRelay {
  static led = false;
  contactsClosed() { return !!this.out; }
  setOut(s, v) { if (!!this.out !== v) { this.out = v; s.markEvent(); } }
  onChange(s) {
    this.timer = 0;
    const m = this.p.mode;
    if (m === 'on' || m === 'flk') { if (!this.on) this.setOut(s, false); } else if (m === 'off') { if (this.on) this.setOut(s, true); } else this.setOut(s, this.on);
    s.markEvent();
  }
  tick(s) {
    if (s.mode === 'dc') return;
    const m = this.p.mode, T = this.p.t;
    const timing = m === 'on' ? this.on && !this.out : m === 'off' ? !this.on && this.out : m === 'int' ? this.on && this.out : this.on;
    if (!timing) return;
    this.timer += s.dt;
    if (this.timer < T) return;
    this.timer = 0;
    this.setOut(s, m === 'on' ? true : m === 'flk' ? !this.out : false);
  }
  digitalSettle() { return false; }
  timing() {
    const m = this.p.mode;
    return m === 'on' ? this.on && !this.out : m === 'off' ? !this.on && this.out : m === 'int' ? this.on && this.out : this.on;
  }
  valueLabel() { return `${MODE_TAG[this.p.mode] || ''} ${fmtShort(this.p.t, 's')}`; }
  readings(s) { return [['Output', this.out ? 'ON' : 'OFF', ''], ['Powered', this.on ? 'yes' : 'no', ''], ['Elapsed', this.timer || 0, 's'], ['Set time', this.p.t, 's'], ['Supply voltage', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V']]; }
  draw(g) {
    super.draw(g);
    const { bw, top, bot } = this.geom();
    // dial: set time and progress
    const cx = -bw + 1.05 * G, cy = bot - 0.95 * G, r = 0.42 * G, f = this.timing() && g.running ? Math.min(1, (this.timer || 0) / this.p.t) : 0;
    g.circle(cx, cy, r, { stroke: g.muted, width: g.lw * 0.5, fill: g.fill });
    if (f > 0) { const c = g.ctx; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + f * 2 * Math.PI); c.closePath(); c.fillStyle = 'rgba(245,158,11,0.75)'; c.fill(); }
    g.line(cx, cy, cx + Math.sin(f * 2 * Math.PI) * r, cy - Math.cos(f * 2 * Math.PI) * r, g.body, g.lw * 0.6);
    // power (green) and output (red) LEDs
    g.circle(bw - 0.85 * G, top + 0.4 * G, 2.6, { fill: g.running && this.on ? '#22c55e' : '#14532d' });
    g.circle(bw - 0.4 * G, top + 0.4 * G, 2.6, { fill: g.running && this.out ? '#ef4444' : '#5b1d1d' });
  }
}
const timerProps = (def) => [
  { key: 't', label: 'Set time', unit: 's', def: 5, min: 0.05, max: 36000, log: true, knob: true },
  { key: 'mode', label: 'Function', type: 'select', def: 'on', options: TIMER_MODES },
  ...coilProps(TIMER_COILS, def),
];

export class Timer8 extends PlugTimer {
  static type = 'timer8'; static title = '8-Pin Timer (DPDT, H3CR-A8 / AH3-3)';
  static keywords = 'timer 8 pin 8pin octal h3cr h3cr-a8 ah3-3 ah3 analog timer on delay off delay star delta timer relay 220v 24v plug in pf083a';
  static props = timerProps('230 V AC');
  // octal base like the MK2P: supply 2–7; timed pole 1: 1 COM / 4 NC / 3 NO, pole 2: 8 COM / 5 NC / 6 NO
  static pins = [['2', 'L'], ['7', 'L'], ['1', 'R'], ['4', 'R'], ['3', 'R'], ['8', 'R'], ['5', 'R'], ['6', 'R']];
  static poles = [[2, 3, 4], [5, 6, 7]];
  static contacts = poleContacts(Timer8.poles);
  static glyph = 'TIMER'; static base = '8-pin';
  static description = 'The common 8-pin plug-in timer (Omron H3CR-A8 / AH3-3 type) on an octal PF083A socket. Supply on 2–7; two timed changeover poles: 1 common, 4 NC, 3 NO and 8 common, 5 NC, 6 NO. Set the time with the knob and choose the function: on-delay (contacts change T seconds after power is applied — star-delta, staircase, motor start delay), off-delay (they return T seconds after power is removed), interval (ON for T) or flicker (OFF T, ON T, repeating). Contacts 5 A at 250 V AC.';
}
register(Timer8);

export class Timer14 extends PlugTimer {
  static type = 'timer14'; static title = '14-Pin Timer (4PDT, H3Y-4)';
  static keywords = 'timer 14 pin 14pin h3y-4 h3y square timer 4pdt on delay off delay timer relay 220v 24v plug in pyf14a';
  static props = timerProps('230 V AC');
  // MY4 base: supply 13–14; timed pole k: 8+k COM, k NC, 4+k NO
  static pins = Relay14.pins;
  static poles = Relay14.poles;
  static contacts = poleContacts(Timer14.poles);
  static glyph = 'TIMER'; static base = '14-pin';
  static description = 'The 14-pin square plug-in timer (Omron H3Y-4 type) on a PYF14A socket, same base as the MY4N relay. Supply on 13–14; four timed changeover poles: 9/1/5, 10/2/6, 11/3/7, 12/4/8 (common/NC/NO). Functions: on-delay, off-delay, interval or flicker. Contacts 3 A at 250 V AC.';
}
register(Timer14);

// ---------------------------------------------------------- relay module
/**
 * 1-channel 5 V relay module (SRD-05VDC-SL-C relay, PC817 optocoupler, driver transistor,
 * flyback diode, power and status LEDs). The coil (70 Ω, 71 mA at 5 V) is fed from VCC–GND;
 * the input LED chain (1 kΩ + status LED + opto LED ≈ 2.9 V) draws ≈2 mA from VCC into IN
 * when IN is pulled low (low-level trigger), or from IN to GND (high-level trigger).
 */
export class RelayModule extends withChip(Element) {
  static type = 'relaymod'; static title = 'Relay Module 5 V (1-channel)'; static category = 'Switches';
  static prefix = 'K'; static keywords = 'relay module 5v 1 channel arduino esp32 raspberry pi srd-05vdc songle optocoupler low level trigger high level trigger in vcc gnd com no nc';
  static props = [
    { key: 'trig', label: 'Trigger', type: 'select', def: 'low', options: [['low', 'Low level (IN to GND switches it on)'], ['high', 'High level (IN to VCC switches it on)']] },
    { key: 'vcoil', label: 'Module supply (VCC)', type: 'select', def: '5', options: [['5', '5 V module (SRD-05VDC)'], ['12', '12 V module (SRD-12VDC)']] },
  ];
  static pins = [['VCC', 'L'], ['GND', 'L'], ['IN', 'L'], ['NO', 'R'], ['COM', 'R'], ['NC', 'R']];
  static chipOpts = { w: 2.3 * G };
  static description = 'Ready-made relay board for Arduino / ESP / Raspberry Pi: VCC–GND power the relay coil (5 V module: 70 Ω, 71 mA), IN is the logic input through an optocoupler (≈2 mA). Most modules are low-level trigger: IN pulled to GND (a low output pin) switches the relay on and the red LED lights; set it to high-level trigger for the other kind. Screw terminals NO, COM, NC switch up to 10 A at 250 V AC.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = new Array(6).fill(0); this.on = false; }
  connectivity() { return [[0, 1, 2], [3, 4, 5]]; }
  branchCount() { return 2; }
  reset() { this.on = false; this.iin = 0; this.postCurrents.fill(0); }
  vr() { return +this.p.vcoil || 5; }
  rc() { return this.vr() === 12 ? 400 : 70; }
  contactsClosed() { return this.on; }
  /** input current and its slope against the control voltage */
  input(s) {
    const [vcc, gnd, inp] = this.nodes;
    const low = this.p.trig !== 'high';
    const v = low ? s.v(vcc) - s.v(inp) : s.v(inp) - s.v(gnd);
    const r = ramp(v - (low ? 2.9 : 1.6), 0.05);
    return { v, i: r.y / 1000, g: r.d / 1000 + 1e-9, low };
  }
  stamp(s) {
    const [vcc, gnd, , no, com, nc] = this.nodes, [k1, k2] = this.branches;
    s.addG(vcc, gnd, 1 / (this.vr() === 12 ? 5600 : 2200) + (this.on ? 1 / this.rc() : 0)); // power LED (+ coil)
    stampSw(s, com, no, k1, this.on, 0.01);
    stampSw(s, com, nc, k2, !this.on, 0.01);
  }
  stampNL(s) {
    const [vcc, gnd, inp] = this.nodes, x = this.input(s);
    if (x.low) s.addNLCurrent(vcc, inp, x.i, [[vcc, inp, x.g, x.v]]);
    else s.addNLCurrent(inp, gnd, x.i, [[inp, gnd, x.g, x.v]]);
  }
  stampAC(ac) {
    const [vcc, gnd, , no, com, nc] = this.nodes, [k1, k2] = this.branches;
    ac.addY(vcc, gnd, 1 / 2200 + (this.on ? 1 / this.rc() : 0));
    stampSwAC(ac, com, no, k1, this.on, 0.01);
    stampSwAC(ac, com, nc, k2, !this.on, 0.01);
  }
  accept(s) {
    const [vcc, gnd] = this.nodes, [k1, k2] = this.branches, x = this.input(s);
    const vs = s.v(vcc) - s.v(gnd);
    this.iin = x.i; this.vs = vs;
    const next = this.on ? x.i > 0.3e-3 && vs > 0.35 * this.vr() : x.i > 0.6e-3 && vs > 0.75 * this.vr();
    if (next !== this.on) { this.on = next; if (s.mode === 'dc') s.dirty = true; else s.markEvent(); }
    const isup = vs * (1 / (this.vr() === 12 ? 5600 : 2200) + (this.on ? 1 / this.rc() : 0));
    const c1 = s.x[k1], c2 = s.x[k2];
    this.postCurrents = [isup + (x.low ? x.i : 0), -isup - (x.low ? 0 : x.i), x.low ? -x.i : x.i, -c1, c1 + c2, -c2];
    this.i = x.i;
  }
  valueLabel() { return `${this.vr()} V ${this.p.trig === 'high' ? 'H' : 'L'}`; }
  readings(s) {
    return [['Relay', this.on ? 'ON (energised)' : 'OFF', ''], ['Input current', this.iin || 0, 'A'], ['Supply (VCC–GND)', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V'],
      ['Coil current', this.on ? (this.vs || 0) / this.rc() : 0, 'A'], ['Load current (COM)', this.postCurrents[4], 'A']];
  }
  draw(g) {
    drawRelayBody(this, g, 'RELAY', [0, 1], [[4, 5, 3]], { fill: 'rgba(37,99,235,0.16)' });
    const { bw, top } = this.geom();
    g.circle(bw - 0.85 * G, top + 0.4 * G, 2.6, { fill: g.running && this.vs > 0.5 * this.vr() ? '#22c55e' : '#14532d' }); // power LED
  }
}
register(RelayModule);

// --------------------------------------------------------------- ULN2003
/**
 * ULN2003A: seven Darlington sinks. Input: 2.7 kΩ in series with two base–emitter drops
 * (≈1.35 V) to GND, so 5 V logic gives ≈1.3 mA. Output: saturates at ≈0.65 V + 1.7 Ω
 * (0.9 V at 100 mA, 1.25 V at 350 mA), limited to hFE (≈800) × the input current. Each
 * output has a clamp diode to COM — tie COM to the relay supply and the coil's turn-off
 * kick is absorbed.
 */
export class ULN2003 extends withChip(Element) {
  static type = 'uln2003'; static title = 'ULN2003 Darlington Array (7-ch)'; static category = 'Analog ICs';
  static prefix = 'U'; static keywords = 'uln2003 uln2003a uln2803 darlington array driver relay driver stepper motor 28byj-48 sink 500ma 7 channel';
  static props = [];
  static pins = [['1B', 'L'], ['2B', 'L'], ['3B', 'L'], ['4B', 'L'], ['5B', 'L'], ['6B', 'L'], ['7B', 'L'], ['GND', 'L'],
    ['1C', 'R'], ['2C', 'R'], ['3C', 'R'], ['4C', 'R'], ['5C', 'R'], ['6C', 'R'], ['7C', 'R'], ['COM', 'R']];
  static description = 'Seven Darlington transistor sinks in one 16-pin chip, the standard way to drive relays, solenoids, stepper motors (28BYJ-48) and lamps from a microcontroller. A high input (5 V logic, ≈1.3 mA) pulls its output nC down to ≈0.9 V at 100 mA; up to 500 mA per output and 50 V. Connect COM to the load supply: the built-in diodes then clamp the inductive kick of relay coils.';
  nonlinear = true;
  constructor(x, y) { super(x, y); this.postCurrents = new Array(16).fill(0); }
  connectivity() { return [Array.from({ length: 16 }, (_, k) => k)]; }
  reset() { this.postCurrents.fill(0); this.io = new Array(7).fill(0); }
  ch(s, k) {
    const n = this.nodes, gnd = n[7], vin = s.v(n[k]) - s.v(gnd), vce = s.v(n[8 + k]) - s.v(gnd), vcl = s.v(n[8 + k]) - s.v(n[15]);
    const a = ramp(vin - 1.35, 0.04), iin = a.y / 2700, gin = a.d / 2700;
    const b = ramp(vce - 0.65, 0.04), isat = b.y / 1.7 + 1e-15, gs = b.d / 1.7;
    const ib = 800 * iin + 1e-15, gib = 800 * gin;
    // smooth minimum of the saturation and the hFE limit: m = (a⁻⁴ + b⁻⁴)^(−¼)
    const m = Math.pow(isat ** -4 + ib ** -4, -0.25), da = (m / isat) ** 5, db = (m / ib) ** 5;
    const c = ramp(vcl - 0.75, 0.03), sb = ramp(-vce - 0.75, 0.03);
    return { vin, vce, vcl, iin, gin, io: m, gos: da * gs, goi: db * gib, icl: c.y / 0.5, gcl: c.d / 0.5, isb: sb.y / 0.5, gsb: sb.d / 0.5 };
  }
  stamp(s) { const n = this.nodes; for (let k = 0; k < 7; k++) s.addG(n[8 + k], n[7], 1e-9); }
  stampNL(s) {
    const n = this.nodes, gnd = n[7], com = n[15];
    for (let k = 0; k < 7; k++) {
      const c = this.ch(s, k), inp = n[k], out = n[8 + k];
      s.addNLCurrent(inp, gnd, c.iin, [[inp, gnd, c.gin, c.vin]]);
      s.addNLCurrent(out, gnd, c.io, [[out, gnd, c.gos, c.vce], [inp, gnd, c.goi, c.vin]]);
      s.addNLCurrent(out, com, c.icl, [[out, com, c.gcl, c.vcl]]);
      s.addNLCurrent(gnd, out, c.isb, [[out, gnd, -c.gsb, c.vce]]);
    }
  }
  stampAC(ac) { const n = this.nodes; for (let k = 0; k < 7; k++) { ac.addY(n[k], n[7], 1e-6); ac.addY(n[8 + k], n[7], 1e-9); } }
  accept(s) {
    const P = this.postCurrents; P.fill(0);
    if (!this.io) this.io = new Array(7).fill(0);
    for (let k = 0; k < 7; k++) {
      const c = this.ch(s, k);
      P[k] += c.iin; P[7] -= c.iin;
      P[8 + k] += c.io + c.icl - c.isb; P[7] -= c.io - c.isb; P[15] -= c.icl;
      this.io[k] = c.io;
    }
    this.i = this.io[0];
  }
  valueLabel() { return ''; }
  readings() { return this.io ? this.io.map((x, k) => [`Output ${k + 1} sink`, x, 'A']) : []; }
  draw(g) {
    this.drawChip(g, 'ULN2003');
    const { posts } = this.geom();
    for (let k = 0; k < 7; k++) {
      const y = posts[k][1], on = g.running && (this.io?.[k] || 0) > 1e-3;
      g.poly([[-0.55 * G, y - 0.22 * G], [-0.2 * G, y], [-0.55 * G, y + 0.22 * G]], { stroke: g.muted, width: g.lw * 0.5, close: true });
      g.circle(-0.12 * G, y, 1.6, { stroke: g.muted, width: g.lw * 0.4 });
      g.line(0, y, 0.75 * G, y, on ? g.accent : g.muted, g.lw * 0.5);
    }
  }
}
register(ULN2003);

// ------------------------------------------------- automatic voltage stabilizer
// boost / buck taps of a relay-type stabilizer (output / input)
const TAPS = [1.5, 1.3, 1.15, 1.0, 0.88];
/**
 * Relay-type automatic voltage stabilizer: an autotransformer whose output tap is chosen by
 * relays from the measured input RMS voltage, so the output stays near 220 V for 140–270 V in.
 * Outside the working range (low cut / high cut) the output relay opens; after the input is
 * back in range it reconnects only after the start delay, which protects fridge compressors.
 */
export class Stabilizer extends withChip(Element) {
  static type = 'stabilizer'; static title = 'Automatic Voltage Stabilizer'; static category = 'Electrical';
  static prefix = 'AVS'; static keywords = 'voltage stabilizer stabiliser avr automatic voltage regulator relay type fridge tv refrigerator 1kva low cut high cut time delay servo';
  static props = [
    { key: 'vset', label: 'Output voltage', unit: 'V', def: 220, min: 100, max: 250 },
    { key: 'va', label: 'Rating', unit: 'VA', def: 1000, min: 100, max: 20000, log: true },
    { key: 'vlo', label: 'Low cut (input)', unit: 'V', def: 140, min: 50, max: 220 },
    { key: 'vhi', label: 'High cut (input)', unit: 'V', def: 280, min: 230, max: 350 },
    { key: 'tdel', label: 'Start delay', unit: 's', def: 3, min: 0.1, max: 300, log: true },
  ];
  static pins = [['IN', 'L'], ['OUT', 'R'], ['N', 'B']];
  static chipOpts = { w: 1.8 * G, h: 1.6 * G };
  static description = 'Relay-type automatic voltage stabilizer (the box behind a fridge or TV): an autotransformer with boost and buck taps (×1.5, ×1.3, ×1.15, ×1, ×0.88) switched by relays as the input RMS voltage changes, so the output stays near 220 V while the mains wanders between ≈140 and 270 V. Each tap change waits 0.3 s; an output more than 10 % high is bucked after one cycle, and a sudden swell opens the output relay at once until the next cycle has been measured. Below the low cut or above the high cut the output relay opens; when the mains comes back it waits the start delay before reconnecting. IN and OUT are the live terminals, N is the common neutral.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; }
  connectivity() { return [[0, 1, 2]]; }
  branchCount() { return 1; }
  reset() { this.vr = 0; this.acc = 0; this.tacc = 0; this.vprev = 0; this.fresh = false; this.hold = false; this.tap = 3; this.run = false; this.t = 0; this.want = 3; this.tw = 0; this.postCurrents.fill(0); this.iout = 0; this.mi = 0; this.mo = 0; }
  k() { return TAPS[this.tap ?? 3]; }
  rs() { return 0.02 * (this.p.vset ** 2) / this.p.va; } // ≈2 % regulation at full load
  /** output relay closed */
  live() { return this.run && !this.hold; }
  stamp(s) {
    const [inp, out, n] = this.nodes, k = this.branches[0];
    s.addG(inp, n, (0.01 * this.p.va) / 230 ** 2); // magnetising / no-load loss ≈1 %
    s.addBranchKCL(out, n, k);
    if (this.live()) {
      // v(out) − v(n) − a·(v(in) − v(n)) − R·x = 0;  x = current into OUT; the primary draws a·(−x)
      const a = this.k();
      s.addA(k, out - 1, 1); s.addA(k, n - 1, -1 + a); s.addA(k, inp - 1, -a); s.addA(k, k, -this.rs());
      s.addA(inp - 1, k, -a); s.addA(n - 1, k, a);
    } else s.addA(k, k, 1);
  }
  stampAC(ac) {
    const [inp, out, n] = this.nodes, k = this.branches[0];
    ac.addY(inp, n, (0.01 * this.p.va) / 230 ** 2);
    ac.addBranchKCL(out, n, k);
    if (this.live()) {
      const a = this.k();
      ac.addA(k, out - 1, 1); ac.addA(k, n - 1, -1 + a); ac.addA(k, inp - 1, -a); ac.addA(k, k, -this.rs());
      ac.addA(inp - 1, k, -a); ac.addA(n - 1, k, a);
    } else ac.addA(k, k, 1);
  }
  /** input RMS of the last full mains cycle */
  vin() { return this.vr || 0; }
  /** tap that brings the output closest to the set voltage */
  best(v) { let b = 0; for (let j = 1; j < TAPS.length; j++) if (Math.abs(TAPS[j] * v - this.p.vset) < Math.abs(TAPS[b] * v - this.p.vset)) b = j; return b; }
  accept(s) {
    const [inp, out, n] = this.nodes, x = s.x[this.branches[0]], v = s.v(inp) - s.v(n);
    const a = this.live() ? this.k() : 0, ig = (v * 0.01 * this.p.va) / 230 ** 2;
    this.postCurrents = [ig - a * x, x, -ig + a * x - x];
    this.iout = -x; this.i = -x;
    const vo = s.v(out) - s.v(n);
    if (s.mode === 'dc') { this.vr = Math.abs(v); this.mi = x * x; this.mo = vo * vo; return; }
    const f = Math.min(1, s.dt / 0.1);
    this.mi += (x * x - (this.mi || 0)) * f; this.mo += (vo * vo - (this.mo || 0)) * f;
    // true RMS over each mains cycle (from one rising zero crossing to the next; 0.1 s on DC)
    this.acc += v * v * s.dt; this.tacc += s.dt;
    if ((this.vprev < 0 && v >= 0 && this.tacc >= 0.015) || this.tacc >= 0.1) { this.vr = Math.sqrt(this.acc / this.tacc); this.acc = 0; this.tacc = 0; this.fresh = true; }
    this.vprev = v;
    // a sudden swell: open the output relay at once, re-tap on the next measured cycle
    if (this.live() && Math.abs(v * this.k()) > 1.3 * Math.SQRT2 * this.p.vset) { this.hold = true; this.fresh = false; s.markEvent(); return; }
    const vr = this.vin(), ok = vr > this.p.vlo && vr < this.p.vhi;
    if (this.run && !ok) { this.run = false; this.hold = false; this.t = 0; s.markEvent(); return; }
    if (!this.run) {
      this.t = ok ? this.t + s.dt : 0;
      if (this.t >= this.p.tdel) { this.run = true; this.tap = this.best(vr); this.tw = 0; s.markEvent(); }
      return;
    }
    if (this.hold) {
      if (this.fresh) { this.tap = this.best(vr); this.hold = false; this.tw = 0; s.markEvent(); }
      return;
    }
    // tap changing with a 4 V dead band and a 0.3 s confirmation time — but an output more
    // than 10 % high is bucked after one cycle, before it can hurt the load
    const b = this.best(vr);
    const better = Math.abs(TAPS[b] * vr - this.p.vset) < Math.abs(this.k() * vr - this.p.vset) - 4;
    if (b !== this.tap && better) {
      if (b !== this.want) { this.want = b; this.tw = 0; }
      this.tw += s.dt;
      if (this.tw >= (this.k() * vr > 1.1 * this.p.vset ? 0.02 : 0.3)) { this.tap = b; this.tw = 0; s.markEvent(); }
    } else this.tw = 0;
  }
  valueLabel() { return fmtShort(this.p.va, 'VA'); }
  readings() {
    const st = this.hold && this.run ? 'Surge — re-tapping' : this.run ? (this.k() > 1 ? `Boost ×${this.k()}` : this.k() < 1 ? `Buck ×${this.k()}` : 'Direct ×1') : (this.vin() <= this.p.vlo ? 'LOW CUT' : this.vin() >= this.p.vhi ? 'HIGH CUT' : `Delay ${Math.max(0, this.p.tdel - (this.t || 0)).toFixed(1)} s`);
    return [['Status', st, ''], ['Input (RMS)', this.vin(), 'V'], ['Output (RMS)', Math.sqrt(this.mo || 0), 'V'], ['Output current (RMS)', Math.sqrt(this.mi || 0), 'A']];
  }
  draw(g) {
    const { bw, top, bot } = this.geom();
    this.drawChip(g, 'STABILIZER', { titleSize: 6.5 });
    const st = !this.live() ? 'OFF' : this.k() > 1 ? 'BOOST' : this.k() < 1 ? 'BUCK' : 'NORMAL';
    g.box(-bw + 0.3 * G, -0.35 * G, bw - 0.3 * G, 0.45 * G, { fill: '#0b1f12', stroke: g.muted, width: g.lw * 0.4, r: 2 });
    g.text(g.running ? `${Math.round(Math.sqrt(this.mo || 0))}V` : '---', 0, 0.06 * G, { size: 8, color: '#4ade80', bold: true, follow: true });
    g.text(g.running ? st : '', 0, 0.9 * G, { size: 5.5, color: this.live() ? g.muted : '#f87171', follow: true });
    g.circle(bw - 0.35 * G, top + 0.35 * G, 2.6, { fill: g.running && this.live() ? '#22c55e' : g.running && this.vin() > 20 ? '#f59e0b' : '#3f3f46' });
  }
}
register(Stabilizer);

// ------------------------------------------------------------- flasher
/**
 * Electronic turn-signal flasher (3-pin: B battery +, L lamps, E ground). Its oscillator runs
 * while it is powered and switches the lamps at ≈85 flashes per minute, 50 % on; if the lamp
 * current during a flash is below 70 % of the rated lamp load (a bulb has blown) it flashes
 * twice as fast, like a real one.
 */
export class Flasher extends withChip(Element) {
  static type = 'flasher'; static title = 'Flasher Relay (turn signal)'; static category = 'Switches';
  static prefix = 'FL'; static keywords = 'flasher relay turn signal indicator blinker car motorcycle hazard 12v 3 pin b l e electronic flasher';
  static props = [
    { key: 'rate', label: 'Flash rate', unit: '/min', def: 85, min: 30, max: 200 },
    { key: 'load', label: 'Rated lamp load', unit: 'W', def: 42, min: 1, max: 300 },
  ];
  static pins = [['B', 'L'], ['E', 'L'], ['L', 'R']];
  static description = 'Electronic flasher for car and motorcycle turn signals (12 V): B to battery +, E to ground, L to the indicator lamps through the turn switch. It switches the lamps on and off ≈85 times a minute. If a bulb blows the lamp current drops below 70 % of the rated load (2 × 21 W) and it flashes twice as fast — the dashboard warning drivers know.';
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0, 0]; this.on = false; }
  connectivity() { return [[0, 1, 2]]; }
  branchCount() { return 1; }
  reset() { this.on = false; this.t = 0; this.fast = false; this.ipk = 0; this.postCurrents.fill(0); }
  contactsClosed() { return this.on; }
  stamp(s) { const [b, e, l] = this.nodes; s.addG(b, e, 1 / 1200); stampSw(s, b, l, this.branches[0], this.on, 0.02); }
  stampAC(ac) { const [b, e, l] = this.nodes; ac.addY(b, e, 1 / 1200); stampSwAC(ac, b, l, this.branches[0], this.on, 0.02); }
  accept(s) {
    const [b, e] = this.nodes, il = s.x[this.branches[0]], vs = s.v(b) - s.v(e), ie = vs / 1200;
    this.postCurrents = [ie + il, -ie, -il]; this.i = il; this.vs = vs;
    if (s.mode === 'dc') return;
    if (vs < 8) { if (this.on) { this.on = false; s.markEvent(); } this.t = 0; return; }
    if (this.on) this.ipk = Math.max(this.ipk, Math.abs(il));
    const half = 30 / this.p.rate / (this.fast ? 2 : 1);
    this.t += s.dt;
    if (this.t >= half) {
      this.t = 0;
      if (this.on) { this.fast = this.ipk < 0.7 * this.p.load / 12; this.ipk = 0; }
      this.on = !this.on; s.markEvent();
    }
  }
  valueLabel() { return `${Math.round(this.p.rate)}/min`; }
  readings(s) { return [['Lamps', this.on ? 'ON' : 'OFF', ''], ['Lamp current', this.i, 'A'], ['Flashing', this.fast ? 'FAST (lamp out!)' : 'normal', ''], ['Supply', s.v(this.nodes[0]) - s.v(this.nodes[1]), 'V']]; }
  draw(g) {
    this.drawChip(g, 'FLASH');
    const lit = g.running && this.on;
    g.circle(0, 0.15 * G, 0.32 * G, { fill: lit ? '#f59e0b' : g.fill, stroke: g.body, width: g.lw * 0.6 });
    if (lit) g.glow(0, 0.15 * G, 0.8 * G, '255,180,40', 0.5);
  }
}
register(Flasher);
