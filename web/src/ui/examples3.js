// Industrial control course: motor-control and automation circuits drawn as ladder
// diagrams — the power circuit on the left, the control circuit as rungs between two
// rails on the right. Every coil carries a tag (KM, KA, KT, …) and every contact the tag
// of the coil it belongs to, so no net labels are needed.

import { ladderSupply } from './examples2.js';

const C = ['#facc15', '#22d3ee', '#f472b6', '#4ade80'];
const CAT = 'Industrial Control (Ladder)';

// ---------------------------------------------------------------- rung parts
// Each part is 4 grid units wide; make(b, x, y) puts its left terminal at (x, y).
const part = (type, props = {}, label = '', where = 'above') => ({
  make(b, x, y) {
    const e = b.h(type, x + 2, y, props);
    if (label && where === 'left') b.label(x - 0.6 - label.length * 0.3, y - 0.8, label); // on its own rung, just before it
    else if (label) b.label(x + 2, where === 'below' ? y + 1.9 : where === 'high' ? y - 2.4 : y - 1.75, label);
    return e;
  },
});
const NO = (tag, terms = '13-14') => part('lno', { tag, terms });
const NC = (tag, terms = '21-22') => part('lnc', { tag, terms });
const PB = (label, where) => part('pushno', {}, label, where);
const PBNC = (label, where) => part('pushnc', {}, label, where);
const ES = () => part('estop', {}, 'E-STOP', 'high');
const SW = (label, closed = false, where) => part('switch', { closed }, label, where);
const COIL = (tag) => part('lcoil', { tag });
const LAMP = (label) => part('neon', { rb: 150e3 }, label, 'left'); // panel pilot lamp: resistor built in
const TMR = (tag, p) => part('ltimer', { tag, ...p });
const DC = { vcoil: 24, ac: false, rcoil: 300, lcoil: 0.2 };
const DCOIL = (tag) => part('lcoil', { tag, ...DC });
const DTMR = (tag, p) => part('ltimer', { tag, ...p, vcoil: 24, ac: false, rcoil: 1000, lcoil: 0.2 });
const DLAMP = (label) => part('lamp', { v: 24, w: 3 }, label, 'left');
const LS = (type, name, at, side, tag = 'CART') => part(type, { tag, name, at, side });
const LSNO = (name, at, side, tag) => LS('llsno', name, at, side, tag);
const LSNC = (name, at, side, tag) => LS('llsnc', name, at, side, tag);
const CTR = (tag, preset, dc) => part('lcounter', { tag, preset, ...(dc ? { ...DC, rcoil: 1000 } : {}) });
const CRST = (tag, dc) => part('lcreset', { tag, ...(dc ? { ...DC, rcoil: 1000 } : {}) });
const LEVEL = (tag, p) => part('llevel', { tag, ...p });

/** One rung at height y from x0: the parts left to right, then `end` (coil or lamp) against the right rail xn. */
function rung(b, y, x0, xn, items, end) {
  let x = x0;
  for (const it of items) { it.make(b, x, y); x += 4; }
  if (end) { if (x < xn - 4) b.w([x, y], [xn - 4, y]); end.make(b, xn - 4, y); }
}
/** A part in parallel with the stretch xa..xb of rung y, drawn dy below it (hold-in, second START …). */
function par(b, y, xa, xb, dy, it) {
  it.make(b, xa, y + dy);
  b.w([xa, y], [xa, y + dy]); b.w([xb, y], [xb, y + dy]);
  if (xb > xa + 4) b.w([xa + 4, y + dy], [xb, y + dy]);
}

// ---------------------------------------------------------------- power circuits
/** DOL branch below column cx (phases cx−1..cx+1 arriving at y): main contacts, overload heaters, motor. */
function dol(b, cx, y, km, f, motor = { load: 10 }) {
  b.el('lmain3', cx, y + 2, { tag: km });
  for (let k = -1; k <= 1; k++) b.w([cx + k, y + 4], [cx + k, y + 6]);
  const olr = b.el('lolr', cx, y + 8, { tag: f, ir: 8 });
  const mot = b.el('im3', cx, y + 14, motor, 1, true);
  for (let k = 0; k < 3; k++) b.w(b.pin(olr, 3 + k), b.pin(mot, k));
  return mot;
}
/** A second motor branch at column cx, tapped off the supply columns 9..11 above y = 1. */
function tap2(b, cx) {
  b.w([9, -4], [cx - 1, -4], [cx - 1, 1]); b.w([10, -3], [cx, -3], [cx, 1]); b.w([11, -2], [cx + 1, -2], [cx + 1, 1]);
}
/** Phase monitor KP at (20, yc + 1) sensing columns 9..11 at yc..yc+2; its neutral comes from the source. */
function monitor(b, yc, tag = 'KP') {
  b.el('lphase', 20, yc + 1, { tag, delay: 0.3 });
  b.w([9, yc], [18, yc]); b.w([10, yc + 1], [18, yc + 1]); b.w([11, yc + 2], [18, yc + 2]);
  b.w([13, -14], [16, -14], [16, yc + 3], [18, yc + 3]);
}
/** MPCB Q1 → (taps for a phase monitor) → contactor → overload → motor, for the protection examples. */
function protectedPower(b) {
  b.el('lmpcb', 10, 3, { tag: 'Q1', ir: 9 });
  for (let k = -1; k <= 1; k++) b.w([10 + k, 5], [10 + k, 9]);
  monitor(b, 6);
  return dol(b, 10, 9, 'KM', 'F1');
}

// ---------------------------------------------------------------- control supplies
/** 230 V control circuit for examples without a motor: mains, control fuse, L and N rails. */
function acCtrl(b, xl, xn, yTop, yBot) {
  const xs = xl - 7, ys = yTop + 3, yb = Math.max(yBot, ys + 2) + 2;
  b.v('mains', xs, ys);
  b.h('fuse', xl - 2, yTop, { rating: 16 });
  b.w([xs, ys - 2], [xs, yTop], [xl - 4, yTop]);
  b.w([xl, yTop], [xl, yBot]);
  b.w([xs, ys + 2], [xs, yb], [xn, yb], [xn, yTop]);
  b.label(xl - 0.8, yTop + 1.2, 'L'); b.label(xn + 0.9, yTop - 1, 'N');
  b.label((xl + xn) / 2, yTop - 3.4, 'CONTROL CIRCUIT 230 V', 11);
}
/** 24 V DC control circuit (SMPS): + rail on the left, 0 V rail on the right. */
function dcCtrl(b, xl, xn, yTop, yBot, title = 'CONTROL CIRCUIT 24 V DC') {
  const xs = xl - 5, ys = yTop + 3, yb = Math.max(yBot, ys + 2) + 2;
  b.v('dcv', xs, ys, { amp: 24 });
  b.w([xs, ys - 2], [xs, yTop], [xl, yTop], [xl, yBot]);
  b.w([xs, ys + 2], [xs, yb], [xn, yb], [xn, yTop]);
  b.el('ground', xs, yb);
  b.label(xl - 2, yTop + 1.2, '+24 V'); b.label(xn + 1.2, yTop - 1, '0 V');
  b.label((xl + xn) / 2, yTop - 3.4, title, 11);
  b.label(xs - 2.6, ys, 'SMPS');
}
const motorRun = (b, mot) => { b.cur(mot, C[0]); b.doc.simSettings.speed = 0.2; };

// ---------------------------------------------------------------- examples
export const EXAMPLES3 = [
  {
    id: 'pbctrl', cat: CAT, title: 'Push button control (inching)',
    desc: 'The simplest motor control: the START push button is wired straight into the rung of contactor coil KM. Hold START and KM pulls in, its main contacts (left) run the motor and KM 13-14 lights RUN; let go and the motor stops — this is inching. F1 95-96 is the overload contact. Compare with the next example, where a hold-in contact keeps the motor running.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 42, 0);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 42, [NC('F1', '95-96'), PB('START')], COIL('KM'));
      rung(b, 0, 22, 42, [NO('KM')], LAMP('RUN'));
      motorRun(b, mot);
    },
  },
  {
    id: 'selfhold', cat: CAT, title: 'Self-holding (DOL) starter',
    desc: 'Direct-on-line starter with a self-holding (latching, seal-in) circuit. Press START: coil KM pulls in and its own KM 13-14 contact, wired across START, keeps it energised after you let go. STOP (NC) breaks the rung and the motor stops; so does the overload contact F1 95-96. Lamps: RUN (KM 23-24), STOPPED (KM 31-32, NC) and TRIP (F1 97-98). Tap F1 to test-trip it, tap again to reset.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 46, 6);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 46, [NC('F1', '95-96'), PBNC('STOP'), PB('START')], COIL('KM'));
      par(b, -6, 30, 34, 3, NO('KM'));
      rung(b, 0, 22, 46, [NO('KM', '23-24')], LAMP('RUN'));
      rung(b, 3, 22, 46, [NC('KM', '31-32')], LAMP('STOPPED'));
      rung(b, 6, 22, 46, [NO('F1', '97-98')], LAMP('TRIP'));
      motorRun(b, mot);
    },
  },
  {
    id: 'hoa', cat: CAT, title: 'Selector switch control (HAND-OFF-AUTO)',
    desc: 'A HAND-OFF-AUTO selector decides who controls the pump. Tap the selector to step through its positions: HAND runs the pump straight away (for testing or emergencies); OFF stops it; AUTO hands control to the float switch, which runs the pump only while the tank level is low (select the float and lower its level below 20 %). The overload contact F1 95-96 protects the motor in every position.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 46, 3);
      const mot = dol(b, 10, 1, 'KM', 'F1', { load: 8, loadType: 'fan' });
      NC('F1', '95-96').make(b, 22, -6);
      b.h('selector3', 28, -6, { pos: 2 });
      b.h('floatsw', 32, -5, { mode: 'NC', set: 80, hyst: 60, level: 85 });
      b.w([30, -7], [42, -7], [42, -6]); b.w([34, -5], [42, -5], [42, -6]);
      COIL('KM').make(b, 42, -6);
      b.label(28, -8.9, 'HAND-OFF-AUTO'); b.label(36, -7.9, 'HAND'); b.label(32, -3.3, 'AUTO: FLOAT');
      rung(b, 0, 22, 46, [NO('KM')], LAMP('RUN'));
      rung(b, 3, 22, 46, [NO('F1', '97-98')], LAMP('TRIP'));
      motorRun(b, mot);
    },
  },
  {
    id: 'estopckt', cat: CAT, title: 'Emergency stop circuit',
    desc: 'The emergency stop sits first in the control circuit, ahead of everything else, so it always wins. Start the motor with START, then tap E-STOP: the mushroom head latches open, coil KM drops and the motor stops. Tap E-STOP again to release it (twist-to-release) — the motor does NOT restart by itself; the operator must press START again. That is why the hold-in circuit is used instead of a maintained switch.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 50, 3);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 50, [ES(), NC('F1', '95-96'), PBNC('STOP'), PB('START')], COIL('KM'));
      par(b, -6, 34, 38, 3, NO('KM'));
      rung(b, 0, 22, 50, [NO('KM', '23-24')], LAMP('RUN'));
      rung(b, 3, 22, 50, [NO('F1', '97-98')], LAMP('TRIP'));
      motorRun(b, mot);
    },
  },
  {
    id: 'torckt', cat: CAT, title: 'Thermal overload relay (TOR) protection',
    desc: 'The thermal overload relay F1 carries the motor current through three bimetal heaters (left). Setting: Ir = the motor full-load current from its nameplate (here about 7 A, so F1 is set to 8 A); class 10 means it trips within 10 s at 7.2 × Ir. On overload or a lost phase the bimetals bend and F1 trips: F1 95-96 (NC) in the coil rung opens and drops KM, F1 97-98 (NO) lights TRIP and sounds the alarm lamp. Tap F1 to TEST-trip it, tap again to RESET, then press START. Select the motor and raise its load to see the current rise in F1\'s readings.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 46, 3);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 46, [NC('F1', '95-96'), PBNC('STOP'), PB('START')], COIL('KM'));
      par(b, -6, 30, 34, 3, NO('KM'));
      rung(b, 0, 22, 46, [NO('KM', '23-24')], LAMP('RUN'));
      rung(b, 3, 22, 46, [NO('F1', '97-98')], LAMP('OVERLOAD TRIP'));
      motorRun(b, mot);
    },
  },
  {
    id: 'mpcbckt', cat: CAT, title: 'MPCB motor protection',
    desc: 'A motor protection circuit breaker (MPCB) Q1 replaces fuses plus overload relay: it has a thermal release set to the motor current (Ir) and a magnetic release that trips instantly on a short circuit (≈ 13 × Ir). Its auxiliary contact Q1 13-14 is in the control circuit, so the contactor can only be energised while Q1 is ON. Tap Q1 to switch it OFF (the motor stops and "Q1 OFF / TRIP" lights through Q1 21-22), tap again to switch it ON and press START.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 46, 3);
      b.el('lmpcb', 10, 3, { tag: 'Q1', ir: 9 });
      for (let k = -1; k <= 1; k++) b.w([10 + k, 5], [10 + k, 7]);
      b.el('lmain3', 10, 9, { tag: 'KM' });
      const mot = b.el('im3', 10, 15, { load: 10 }, 1, true);
      for (let k = -1; k <= 1; k++) b.w([10 + k, 11], [10 + k, 13]);
      rung(b, -6, 22, 46, [NO('Q1', '13-14'), PBNC('STOP'), PB('START')], COIL('KM'));
      par(b, -6, 30, 34, 3, NO('KM'));
      rung(b, 0, 22, 46, [NO('KM', '23-24')], LAMP('RUN'));
      rung(b, 3, 22, 46, [NC('Q1', '21-22')], LAMP('Q1 OFF / TRIP'));
      motorRun(b, mot);
    },
  },
  {
    id: 'protectall', cat: CAT, title: 'Complete motor protection circuit',
    desc: 'All the usual protections on one motor: MPCB Q1 (short circuit and overload, aux 13-14), a phase-failure / sequence monitor KP (11-14 closed only while all three phases are healthy), the thermal overload relay F1 (95-96) and an emergency stop — every one of them in series in the coil rung of KM, so any fault stops the motor. Lamps show RUN, TRIP (F1 97-98) and PHASE FAULT (KP 11-12). Try: tap E-STOP, tap Q1 OFF, tap F1 (test), or select the supply and change the phase sequence to R-B-Y.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 24, 56, 6);
      const mot = protectedPower(b);
      rung(b, -6, 24, 56, [ES(), NO('Q1', '13-14'), NC('F1', '95-96'), NO('KP', '11-14'), PBNC('STOP'), PB('START')], COIL('KM'));
      par(b, -6, 44, 48, 3, NO('KM'));
      rung(b, 0, 24, 56, [NO('KM', '23-24')], LAMP('RUN'));
      rung(b, 3, 24, 56, [NO('F1', '97-98')], LAMP('TRIP'));
      rung(b, 6, 24, 56, [NC('KP', '11-12')], LAMP('PHASE FAULT'));
      motorRun(b, mot);
    },
  },
  {
    id: 'relaylogic', cat: CAT, title: 'Relay logic circuits (AND, OR, NOT)',
    desc: 'Before PLCs, logic was built with relays — and it is still used in panels. Push buttons A and B energise relays KA and KB (24 V DC). Contacts in series make AND (the lamp lights only with both buttons held), contacts in parallel make OR (either button), and an NC contact makes NOT (the lamp is on until A is pressed). Hold A, B or both and watch the lamps.',
    build(b) {
      dcCtrl(b, 8, 36, 0, 18);
      rung(b, 0, 8, 36, [PB('A')], DCOIL('KA'));
      rung(b, 4, 8, 36, [PB('B')], DCOIL('KB'));
      rung(b, 8, 8, 36, [NO('KA'), NO('KB')], DLAMP('A AND B'));
      rung(b, 12, 8, 36, [NO('KA', '23-24')], DLAMP('A OR B'));
      par(b, 12, 8, 12, 3, NO('KB', '23-24'));
      rung(b, 18, 8, 36, [NC('KA')], DLAMP('NOT A'));
    },
  },
  {
    id: 'relaymotor', cat: CAT, title: 'Motor control using a relay (24 V)',
    desc: 'An interposing relay: the push buttons work at a safe 24 V DC (right) and switch the small relay KA, which holds itself in with KA 23-24. One contact of KA (13-14) sits in the 230 V coil rung of the motor contactor KM (middle) — the same way a PLC output or a remote panel starts a big motor. Press START and STOP on the 24 V side.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 40, 0);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 40, [NC('F1', '95-96'), NO('KA', '13-14')], COIL('KM'));
      rung(b, 0, 22, 40, [NO('KM')], LAMP('RUN'));
      dcCtrl(b, 50, 70, -6, -3, '24 V DC PUSH BUTTONS');
      rung(b, -6, 50, 70, [PBNC('STOP'), PB('START')], DCOIL('KA'));
      par(b, -6, 54, 58, 3, NO('KA', '23-24'));
      motorRun(b, mot);
    },
  },
  {
    id: 'phaseseq', cat: CAT, title: 'Phase sequence protection',
    desc: 'If two supply phases are swapped (after maintenance, or a new cable), a 3-phase motor runs backwards — dangerous for pumps, conveyors, compressors and lifts. The phase monitor KP checks the sequence L1→L2→L3 (and phase loss); its contact KP 11-14 is in the coil rung, so KM can only pull in with the right sequence. Press START, then select the supply (top left) and change its phase sequence to R-B-Y: KP releases after its delay, KM drops and PHASE FAULT lights.',
    build(b) {
      ladderSupply(b, 10, -14, 6, 26, 54, 3);
      b.el('lmain3', 10, 8, { tag: 'K' });
      const olr = b.el('lolr', 10, 14, { tag: 'F1', ir: 8 });
      for (let k = -1; k <= 1; k++) b.w([10 + k, 10], [10 + k, 12]);
      const mot = b.el('im3', 10, 20, { load: 10 }, 1, true);
      for (let k = 0; k < 3; k++) b.w(b.pin(olr, 3 + k), b.pin(mot, k));
      monitor(b, 3);
      rung(b, -6, 26, 54, [NC('F1', '95-96'), PBNC('STOP'), PB('START'), NO('KP', '11-14')], COIL('K'));
      par(b, -6, 34, 38, 3, NO('K'));
      rung(b, 3, 26, 54, [NC('KP', '11-12')], LAMP('PHASE FAULT'));
      motorRun(b, mot);
    },
  },
  {
    id: 'floatless', cat: CAT, title: 'Floatless level relay pump control',
    desc: 'A floatless (electrode) level relay KL watches the tank through probes instead of a float. Its supply is the coil rung at the top. When the water falls below the LOW probe (25 %) its contact KL 11-14 closes and the pump contactor KM starts; KL keeps it closed until the water reaches the HIGH probe (90 %), then the pump stops — the gap between the probes stops the pump from switching on and off all the time. Watch the tank fill and empty; select it and change the water use.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 24, 50, 6);
      const mot = dol(b, 10, 1, 'KM', 'F1', { load: 8, loadType: 'fan' });
      b.el('ltank', 18, 12, { tag: 'TANK', fill: 'KM', inflow: 30, outflow: 10, level: 40 });
      rung(b, -6, 24, 50, [], LEVEL('KL', { tank: 'TANK', mode: 'fill', low: 25, high: 90 }));
      rung(b, -2, 24, 50, [NC('F1', '95-96'), NO('KL', '11-14')], COIL('KM'));
      rung(b, 2, 24, 50, [NO('KM')], LAMP('PUMP ON'));
      rung(b, 6, 24, 50, [NO('F1', '97-98')], LAMP('TRIP'));
      motorRun(b, mot);
    },
  },
  {
    id: 'tankauto', cat: CAT, title: 'Water tank automation (sump + overhead)',
    desc: 'A complete building water system: the pump lifts water from the underground SUMP to the OVERHEAD tank. Level relay KL1 (fill mode, on the overhead tank) asks for water below 25 % and stops at 90 %; level relay KL2 (dry-run mode, on the sump) only allows pumping while the sump has water above its LOW probe — so the pump never runs dry. Both contacts are in series in the coil rung of KM. The sump refills slowly from the mains line; watch SUMP DRY light when it runs out.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 24, 52, 6);
      const mot = dol(b, 10, 1, 'KM', 'F1', { load: 8, loadType: 'fan' });
      b.el('ltank', 18, 11, { tag: 'OVERHEAD', fill: 'KM', from: 'SUMP', inflow: 30, outflow: 10, level: 40 });
      b.el('ltank', 18, 19.5, { tag: 'SUMP', fill: '', inflow: 4, outflow: 0, level: 35 });
      rung(b, -6, 24, 52, [], LEVEL('KL1', { tank: 'OVERHEAD', mode: 'fill', low: 25, high: 90 }));
      rung(b, -3, 24, 52, [], LEVEL('KL2', { tank: 'SUMP', mode: 'dry', low: 10, high: 30 }));
      rung(b, 0, 24, 52, [NC('F1', '95-96'), NO('KL1', '11-14'), NO('KL2', '11-14')], COIL('KM'));
      rung(b, 3, 24, 52, [NO('KM')], LAMP('PUMP ON'));
      rung(b, 6, 24, 52, [NC('KL2', '11-12')], LAMP('SUMP DRY'));
      motorRun(b, mot);
    },
  },
  {
    id: 'ondelay', cat: CAT, title: 'ON-delay timer motor control',
    desc: 'An ON-delay (TON) timer switches its contacts a set time after its coil is energised. Press START: the control relay KA holds itself in and energises the timer coil KT; 3 s later KT 15-18 closes and the motor contactor KM pulls in. STOP drops everything at once (the timer resets). Used for delayed starts, warning periods and staggered starting.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 46, 8);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 46, [NC('F1', '95-96'), PBNC('STOP'), PB('START')], COIL('KA'));
      par(b, -6, 30, 34, 3, NO('KA'));
      rung(b, 0, 22, 46, [NO('KA', '23-24')], TMR('KT', { mode: 'on', t: 3 }));
      rung(b, 4, 22, 46, [NO('KT', '15-18')], COIL('KM'));
      rung(b, 8, 22, 46, [NO('KM')], LAMP('RUN'));
      motorRun(b, mot);
    },
  },
  {
    id: 'offdelay', cat: CAT, title: 'OFF-delay timer (fan run-on)',
    desc: 'An OFF-delay (TOF) timer switches its contacts at once when its coil is energised and keeps them switched for a set time after the coil is de-energised. Here it keeps an exhaust fan running 5 s after the switch is turned off (to clear the air). Tap FAN SWITCH on, then off, and watch KT hold KM.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 46, 2);
      const mot = dol(b, 10, 1, 'KM', 'F1', { load: 6, loadType: 'fan' });
      rung(b, -6, 22, 46, [NC('F1', '95-96'), SW('FAN SWITCH')], TMR('KT', { mode: 'off', t: 5 }));
      rung(b, -2, 22, 46, [NO('KT', '15-18')], COIL('KM'));
      rung(b, 2, 22, 46, [NO('KM')], LAMP('FAN RUN'));
      motorRun(b, mot);
    },
  },
  {
    id: 'twintimer', cat: CAT, title: 'Twin timer (cyclic ON / OFF)',
    desc: 'A twin (cyclic) timer switches its contacts on and off for as long as its coil is energised: ON for T, OFF for T2, over and over. Here it runs a mixer motor 3 s on, 2 s off while the switch is on — typical for mixers, lubrication pumps, flashing beacons and fountains. Tap the switch on.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 46, 2);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 46, [NC('F1', '95-96'), SW('ON / OFF')], TMR('KT', { mode: 'twin', t: 3, t2: 2 }));
      rung(b, -2, 22, 46, [NO('KT', '15-18')], COIL('KM'));
      rung(b, 2, 22, 46, [NO('KM')], LAMP('MIXER ON'));
      motorRun(b, mot);
    },
  },
  {
    id: 'seqmotor', cat: CAT, title: 'Sequential motor control (timer)',
    desc: 'Two motors that must start one after the other — e.g. a conveyor M2 that may only run once the crusher M1 feeding it is running, and never together (to limit the starting current). START pulls in KM1 (held by KM1 13-14); KM1 also starts the timer KT, and 3 s later KT 15-18 starts KM2. Because the KT rung is fed through KM1, M2 can never run without M1. STOP or either overload (F1, F2) stops both.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 28, 54, 11);
      const m1 = dol(b, 10, 1, 'KM1', 'F1');
      tap2(b, 18);
      dol(b, 18, 1, 'KM2', 'F2');
      rung(b, -6, 28, 54, [NC('F1', '95-96'), NC('F2', '95-96'), PBNC('STOP'), PB('START')], COIL('KM1'));
      par(b, -6, 40, 44, 3, NO('KM1'));
      rung(b, 0, 28, 54, [NO('KM1', '23-24')], TMR('KT', { mode: 'on', t: 3 }));
      rung(b, 4, 28, 54, [NO('KT', '15-18')], COIL('KM2'));
      rung(b, 8, 28, 54, [NO('KM1', '33-34')], LAMP('M1 RUN'));
      rung(b, 11, 28, 54, [NO('KM2')], LAMP('M2 RUN'));
      motorRun(b, m1);
    },
  },
  {
    id: 'automachine', cat: CAT, title: 'Automatic machine cycle (cylinder, timer, counter)',
    desc: 'An automatic press: press START and relay KA runs the machine. At home (LS1) the valve coil Y1 pulls in and holds itself, the cylinder extends; at the end of the stroke LS2 starts the dwell timer KT (1.5 s) and adds one to the counter C1. When KT runs out, KT 15-16 drops Y1, the cylinder springs back to LS1 and the next cycle starts by itself. After 5 cycles C1 21-22 stops the machine and "5 CYCLES DONE" lights; press RESET to clear the counter. STOP ends the cycle at any time.',
    build(b) {
      dcCtrl(b, 8, 40, 0, 21);
      b.el('lcart', 24, -6.5, { tag: 'CYL', mode: 'cyl', fwd: 'Y1', speed: 50, pos: 0 });
      rung(b, 0, 8, 40, [PBNC('STOP'), PB('START'), NC('C1', '21-22')], DCOIL('KA'));
      par(b, 0, 12, 16, 3, NO('KA'));
      rung(b, 6, 8, 40, [NO('KA', '23-24'), LSNO('LS1', 0, 'low', 'CYL'), NC('KT', '15-16')], DCOIL('Y1'));
      par(b, 6, 12, 16, 3, NO('Y1'));
      rung(b, 12, 8, 40, [LSNO('LS2', 100, 'high', 'CYL')], DTMR('KT', { mode: 'on', t: 1.5 }));
      rung(b, 15, 8, 40, [LSNO('LS2', 100, 'high', 'CYL')], CTR('C1', 5, true));
      rung(b, 18, 8, 40, [PB('RESET')], CRST('C1', true));
      rung(b, 21, 8, 40, [NO('C1', '13-14')], DLAMP('5 CYCLES DONE'));
    },
  },
  {
    id: 'jogpb', cat: CAT, title: 'Jog (inching) with push buttons',
    desc: 'Jogging (inching) runs a motor only while a button is held — to position a machine or a conveyor belt. RUN starts the control relay KA, which holds itself and keeps KM energised (normal running). JOG energises KM directly, bypassing the hold-in, so the motor stops as soon as JOG is released. STOP stops normal running.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 46, 7);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 46, [NC('F1', '95-96'), PBNC('STOP'), PB('RUN')], COIL('KA'));
      par(b, -6, 30, 34, 3, NO('KA'));
      rung(b, 0, 22, 46, [NO('KA', '23-24')], COIL('KM'));
      par(b, 0, 22, 26, 3, PB('JOG', 'below'));
      rung(b, 7, 22, 46, [NO('KM')], LAMP('RUN'));
      motorRun(b, mot);
    },
  },
  {
    id: 'jogsel', cat: CAT, title: 'Jog with selector switch',
    desc: 'One START button, two behaviours: the RUN / JOG selector sits in series with the hold-in contact KM 13-14. With the selector closed (RUN) START latches the motor on; open it (JOG) and the hold-in is cut, so START only runs the motor while held. Tap the selector, then press START.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 50, 1);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 50, [NC('F1', '95-96'), PBNC('STOP'), PB('START')], COIL('KM'));
      NO('KM').make(b, 30, -3); SW('RUN (closed) / JOG (open)', true, 'below').make(b, 34, -3);
      b.w([30, -6], [30, -3]); b.w([38, -3], [38, -6]);
      rung(b, 1, 22, 50, [NO('KM', '23-24')], LAMP('RUN'));
      motorRun(b, mot);
    },
  },
  {
    id: 'multistart', cat: CAT, title: 'Multiple start, single stop',
    desc: 'The motor can be started from two places (e.g. the machine and the control room): START buttons are wired in PARALLEL, so either one energises KM; the hold-in KM 13-14 is in parallel with them too. A single STOP (in series) stops it.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 46, 3);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 46, [NC('F1', '95-96'), PBNC('STOP'), PB('START 1')], COIL('KM'));
      par(b, -6, 30, 34, 3, PB('START 2'));
      par(b, -6, 30, 34, 6, NO('KM'));
      rung(b, 3, 22, 46, [NO('KM', '23-24')], LAMP('RUN'));
      motorRun(b, mot);
    },
  },
  {
    id: 'multistop', cat: CAT, title: 'Single start, multiple stop',
    desc: 'Several STOP buttons placed around a machine (or a long conveyor) so it can be stopped from anywhere: they are wired in SERIES, so pressing any one of them breaks the coil rung. One START with the usual hold-in.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 54, 1);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 54, [NC('F1', '95-96'), PBNC('STOP 1'), PBNC('STOP 2'), PBNC('STOP 3'), PB('START')], COIL('KM'));
      par(b, -6, 38, 42, 3, NO('KM'));
      rung(b, 1, 22, 54, [NO('KM', '23-24')], LAMP('RUN'));
      motorRun(b, mot);
    },
  },
  {
    id: 'multiboth', cat: CAT, title: 'Multiple start, multiple stop',
    desc: 'Control from two locations: the STOP buttons of both stations are in SERIES (any one stops the motor), the START buttons are in PARALLEL (any one starts it), and the hold-in contact KM 13-14 is in parallel with the STARTs. This is the general rule for any number of control stations.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 50, 3);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 50, [NC('F1', '95-96'), PBNC('STOP 1'), PBNC('STOP 2'), PB('START 1')], COIL('KM'));
      par(b, -6, 34, 38, 3, PB('START 2'));
      par(b, -6, 34, 38, 6, NO('KM'));
      rung(b, 3, 22, 50, [NO('KM', '23-24')], LAMP('RUN'));
      motorRun(b, mot);
    },
  },
  {
    id: 'interlock', cat: CAT, title: 'Electrical interlocking (two motors)',
    desc: 'Duty / standby pumps that must never run together. Each contactor has its own START / STOP rung, and each rung contains an NC contact of the OTHER contactor: KM2 21-22 in the KM1 rung and KM1 21-22 in the KM2 rung. While one pump runs, the other cannot be started. Start pump 1, try pump 2, stop 1, then start 2.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 28, 58, 9);
      const m1 = dol(b, 10, 1, 'KM1', 'F1', { load: 8, loadType: 'fan' });
      tap2(b, 18);
      dol(b, 18, 1, 'KM2', 'F2', { load: 8, loadType: 'fan' });
      rung(b, -6, 28, 58, [NC('F1', '95-96'), PBNC('STOP 1'), PB('START 1'), NC('KM2')], COIL('KM1'));
      par(b, -6, 36, 40, 3, NO('KM1'));
      rung(b, 0, 28, 58, [NC('F2', '95-96'), PBNC('STOP 2'), PB('START 2'), NC('KM1')], COIL('KM2'));
      par(b, 0, 36, 40, 3, NO('KM2'));
      rung(b, 6, 28, 58, [NO('KM1', '23-24')], LAMP('PUMP 1 RUN'));
      rung(b, 9, 28, 58, [NO('KM2', '23-24')], LAMP('PUMP 2 RUN'));
      motorRun(b, m1);
    },
  },
  {
    id: 'ats', cat: CAT, title: 'ATS (automatic transfer switch)',
    desc: 'An automatic transfer switch keeps a load supplied when the mains fails. The phase monitor KP watches the mains (after its MCB). Mains healthy: KP 11-14 closes and the mains contactor KM feeds the load. Tap the mains MCB OFF to simulate a power cut: KM drops, KP 11-12 starts the timer KT (3 s, for the generator to start and settle) and then KT 15-18 closes the generator contactor KG. KM 21-22 and KG 21-22 interlock the two, so mains and generator are never connected together. Switch the mains MCB back ON: the load returns to the mains. The control circuit runs from a 24 V battery supply.',
    build(b) {
      const mains = ladderSupplyless(b, 10, 1, { in: 25, curve: 'C' });
      const gen = ladderSupplyless(b, 24, 1, { in: 25, curve: 'C' });
      b.label(10, -18.2, 'MAINS', 11); b.label(24, -18.2, 'GENERATOR', 11);
      void mains; void gen;
      b.el('lmain3', 10, 3, { tag: 'KM' }); b.el('lmain3', 24, 3, { tag: 'KG' });
      const mot = b.el('im3', 10, 14, { load: 8, loadType: 'fan' }, 1, true);
      for (let k = -1; k <= 1; k++) b.w([10 + k, 5], [10 + k, 12]);
      b.w([23, 5], [23, 7], [9, 7]); b.w([24, 5], [24, 8], [10, 8]); b.w([25, 5], [25, 9], [11, 9]);
      b.el('lphase', 17, -2, { tag: 'KP', delay: 0.3 });
      b.w([9, -3], [15, -3]); b.w([10, -2], [15, -2]); b.w([11, -1], [15, -1]);
      b.w([12, -12], [14, -12], [14, 0], [15, 0]);
      b.label(17, -5.4, 'MAINS MONITOR');
      dcCtrl(b, 38, 62, -6, 12, 'ATS CONTROL 24 V DC');
      rung(b, -6, 38, 62, [NO('KP', '11-14'), NC('KG', '21-22')], DCOIL('KM'));
      rung(b, -1, 38, 62, [NC('KP', '11-12')], DTMR('KT', { mode: 'on', t: 3 }));
      rung(b, 4, 38, 62, [NO('KT', '15-18'), NC('KM', '21-22')], DCOIL('KG'));
      rung(b, 8, 38, 62, [NO('KM', '13-14')], DLAMP('ON MAINS'));
      rung(b, 12, 38, 62, [NO('KG', '13-14')], DLAMP('ON GENERATOR'));
      motorRun(b, mot);
    },
  },
  {
    id: 'lsmotor', cat: CAT, title: 'Motor control using limit switches',
    desc: 'A carriage driven forward and back by a reversing starter must stop at both ends of its track. The far-end limit switch LS2 (NC) is in the FWD rung and the home limit switch LS1 (NC) in the REV rung: when the carriage reaches an end, the switch opens and drops that contactor — the motor stops even if nobody presses STOP. KF and KR also interlock each other. Press FWD and watch the carriage stop at the end; then press REV.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 24, 52, 7);
      fwdRevPower(b);
      rung(b, -6, 24, 52, [NC('F1', '95-96'), PBNC('STOP'), PB('FWD'), LSNC('LS2', 100, 'high'), NC('KR')], COIL('KF'));
      par(b, -6, 32, 36, 3, NO('KF'));
      b.w([32, -3], [32, 1]);
      rung(b, 1, 32, 52, [PB('REV'), LSNC('LS1', 0, 'low'), NC('KF')], COIL('KR'));
      par(b, 1, 32, 36, 3, NO('KR'));
      rung(b, 7, 24, 52, [NO('F1', '97-98')], LAMP('TRIP'));
      b.el('lcart', 38, 12, { tag: 'CART', fwd: 'KF', rev: 'KR', speed: 20, pos: 50 });
      b.cur(b.doc.elements.find((e) => e.constructor.type === 'im3'), C[0]);
      b.doc.simSettings.speed = 0.2;
    },
  },
  {
    id: 'autofr', cat: CAT, title: 'Automatic forward-reverse (limit switches)',
    desc: 'A shuttle that runs back and forth by itself — e.g. a machine table or a car wash. START latches the relay KA. With the carriage at home, LS1 (NO) starts KF; KF holds itself, and at the far end LS2 opens the KF rung and closes the KR rung, so the motor reverses; back home, LS1 does the opposite. The carriage keeps shuttling until STOP. KF and KR interlock each other.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 24, 52, 12);
      fwdRevPower(b);
      autoShuttle(b, 24, 52);
      rung(b, 12, 24, 52, [NO('F1', '97-98')], LAMP('TRIP'));
      b.el('lcart', 38, 16.5, { tag: 'CART', fwd: 'KF', rev: 'KR', speed: 25, pos: 0 });
      b.cur(b.doc.elements.find((e) => e.constructor.type === 'im3'), C[0]);
      b.doc.simSettings.speed = 0.2;
    },
  },
  {
    id: 'ssrload', cat: CAT, title: 'Load control using an SSR',
    desc: 'A solid-state relay (SSR) switches a 230 V load with no moving contacts: a small 24 V DC signal (from a switch, sensor or PLC) lights the LED inside it and its output TRIAC turns on at the next zero crossing — silent, fast and with no contact wear, ideal for heaters switched often. The SMPS gives the 24 V DC. Tap the switch.',
    build(b) {
      b.v('dcv', 2, 3, { amp: 24 }); b.el('ground', 2, 7);
      b.h('switch', 7, 1, { closed: false });
      b.h('ssr', 14, 3);
      b.w([2, 1], [5, 1]); b.w([9, 1], [9, 2], [12, 2]); b.w([12, 4], [12, 7], [2, 7]); b.w([2, 5], [2, 7]);
      b.v('mains', 28, 3);
      b.v('heater', 22, 6, { w: 1000 });
      b.w([16, 2], [16, -1], [28, -1], [28, 1]); b.w([16, 4], [22, 4]); b.w([22, 8], [22, 9], [28, 9], [28, 5]);
      b.label(2, -0.6, 'SMPS 24 V'); b.label(7, -0.8, 'SWITCH'); b.label(14, -0.2, 'SSR'); b.label(30.6, 3, '230 V'); b.label(24.8, 6, 'HEATER');
    },
  },
  {
    id: 'sensorssr', cat: CAT, title: 'Load control using a sensor and SSR',
    desc: 'A 3-wire PNP photoelectric sensor (brown +24 V, blue 0 V, black output) switches an SSR, which switches a 230 V lamp — e.g. a light that comes on when a car or a box is in front of the sensor. Select the sensor and move the object closer than its 300 mm range: the output goes to +24 V, the SSR turns on and the lamp lights.',
    build(b) {
      b.v('dcv', 2, 3, { amp: 24 }); b.el('ground', 2, 9);
      b.h('photoeye', 8, 4);
      b.h('ssr', 16, 4);
      b.w([2, 1], [7, 1], [7, 2]); b.w([7, 6], [7, 9], [2, 9]); b.w([2, 5], [2, 9]);
      b.w([10, 4], [12, 4], [12, 3], [14, 3]); b.w([14, 5], [14, 9], [7, 9]);
      b.v('mains', 30, 4);
      b.v('lamp', 24, 7, { v: 230, w: 60 });
      b.w([18, 3], [18, 0], [30, 0], [30, 2]); b.w([18, 5], [24, 5]); b.w([24, 9], [24, 10], [30, 10], [30, 6]);
      b.label(2, -0.6, 'SMPS 24 V'); b.label(8, -0.6, 'PHOTO SENSOR'); b.label(16, 0.8, 'SSR'); b.label(32.6, 4, '230 V'); b.label(26.4, 7, 'LAMP');
    },
  },
  {
    id: 'prodcounter', cat: CAT, title: 'Production counter with sensor',
    desc: 'Counting products on a conveyor: a photoelectric sensor (right, 24 V DC) gives one pulse for every box that passes, and each pulse adds one to the counter C1. The conveyor motor runs (START / STOP) until the preset (5 boxes) is reached: then C1 21-22 stops the conveyor and C1 13-14 lights BATCH DONE. Press RESET to clear the counter and START again. Select the sensor and move the object in and out of range (under 300 mm) to pass a box.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 46, 0);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 46, [NC('F1', '95-96'), PBNC('STOP'), PB('START'), NC('C1', '21-22')], COIL('KM'));
      par(b, -6, 30, 34, 3, NO('KM'));
      rung(b, 0, 22, 46, [NO('C1', '13-14')], LAMP('BATCH DONE'));
      dcCtrl(b, 58, 80, -6, 3, 'SENSOR + COUNTER 24 V DC');
      b.h('photoeye', 61, -3);
      b.w([58, -6], [60, -6], [60, -5]); b.w([60, -1], [60, 0], [80, 0]);
      b.w([63, -3], [76, -3]); CTR('C1', 5, true).make(b, 76, -3);
      rung(b, 3, 58, 80, [PB('RESET')], CRST('C1', true));
      b.label(61, -7.7, 'PHOTO SENSOR');
      motorRun(b, mot);
    },
  },
  {
    id: 'lscounter', cat: CAT, title: 'Counter with limit switch',
    desc: 'The automatic forward-reverse shuttle with a stroke counter: every time the carriage reaches the far end, LS2 gives a pulse to the counter C1. After 5 strokes C1 21-22 (in the KA rung) stops the machine and BATCH DONE lights. Press RESET to clear the counter, then START for the next batch.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 24, 52, 18);
      fwdRevPower(b);
      autoShuttle(b, 24, 52, [NC('C1', '21-22')]);
      rung(b, 12, 24, 52, [LSNO('LS2', 100, 'high')], CTR('C1', 5));
      rung(b, 15, 24, 52, [PB('RESET')], CRST('C1'));
      rung(b, 18, 24, 52, [NO('C1', '13-14')], LAMP('BATCH DONE'));
      b.el('lcart', 38, 23, { tag: 'CART', fwd: 'KF', rev: 'KR', speed: 25, pos: 0 });
      b.cur(b.doc.elements.find((e) => e.constructor.type === 'im3'), C[0]);
      b.doc.simSettings.speed = 0.2;
    },
  },
  {
    id: 'tempctrl', cat: CAT, title: 'Temperature control (heater and blower)',
    desc: 'An oven or panel temperature controller: thermostat TH1 (heating mode, set to 60 °C) keeps the heater contactor KH on while the temperature is below the set point; thermostat TH2 (cooling mode, set to 80 °C) starts the blower contactor KB if it gets too hot. The main contacts of KH and KB switch the heater and the blower in the lower rungs. Select each thermostat and change its temperature knob to see them work (the differential keeps them from chattering).',
    build(b) {
      acCtrl(b, 10, 40, 0, 16);
      rung(b, 0, 10, 40, [part('thermostat', { mode: 'heat', set: 60, diff: 4, temp: 25 }, 'TH1 HEAT 60°C')], COIL('KH'));
      rung(b, 4, 10, 40, [part('thermostat', { mode: 'cool', set: 80, diff: 4, temp: 25 }, 'TH2 COOL 80°C')], COIL('KB'));
      rung(b, 8, 10, 40, [NO('KH', '1-2')], part('heater', { w: 1000 }, 'HEATER'));
      rung(b, 12, 10, 40, [NO('KB', '1-2')], part('fan', {}, 'BLOWER', 'high'));
      rung(b, 16, 10, 40, [NO('KH', '13-14')], LAMP('HEATING'));
    },
  },
  {
    id: 'pressctrl', cat: CAT, title: 'Pressure control (air compressor)',
    desc: 'An air compressor kept between 6 and 8 bar by a pressure switch. START latches the AUTO relay KA; the pressure switch (cut-in 6 bar, cut-out 8 bar) in the KM rung then starts and stops the compressor motor by itself. Select the pressure switch and change the pressure: above 8 bar the motor stops, below 6 bar it starts again. The same scheme with a flow switch protects pumps against running without flow.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 22, 46, 4);
      const mot = dol(b, 10, 1, 'KM', 'F1');
      rung(b, -6, 22, 46, [NC('F1', '95-96'), PBNC('STOP'), PB('START')], COIL('KA'));
      par(b, -6, 30, 34, 3, NO('KA'));
      rung(b, 0, 22, 46, [NO('KA', '23-24'), part('pressw', { pres: 5, cutin: 6, cutout: 8 }, 'PRESSURE SW')], COIL('KM'));
      rung(b, 4, 22, 46, [NO('KM')], LAMP('COMPRESSOR ON'));
      motorRun(b, mot);
    },
  },
  {
    id: 'pneumatic', cat: CAT, title: 'Electro-pneumatic cylinder control',
    desc: 'A single-acting pneumatic cylinder moved by a 5/2 solenoid valve with spring return. Press START: the valve coil Y1 pulls in and holds itself (Y1 13-14), air extends the cylinder. At the end of the stroke the limit switch LS2 (NC) opens, Y1 drops and the spring pushes the cylinder back — one automatic stroke per press. LS2 (NO) lights END OF STROKE while it is out.',
    build(b) {
      dcCtrl(b, 8, 36, 0, 6);
      b.el('lcart', 22, -6.5, { tag: 'CYL', mode: 'cyl', fwd: 'Y1', speed: 40, pos: 0 });
      rung(b, 0, 8, 36, [PB('START'), LSNC('LS2', 100, 'high', 'CYL')], DCOIL('Y1'));
      par(b, 0, 8, 12, 3, NO('Y1'));
      rung(b, 6, 8, 36, [LSNO('LS2', 100, 'high', 'CYL')], DLAMP('END OF STROKE'));
    },
  },
  {
    id: 'panel', cat: CAT, title: 'Complete industrial control panel',
    desc: 'A full pump control panel, putting the course together. Power: MPCB Q1, phase monitor KP, contactor KM, overload relay F1, motor. Control: E-STOP, Q1 13-14, F1 95-96 and KP 11-14 in series feed a HAND-OFF-AUTO selector. HAND: STOP / START with the KM hold-in. AUTO: a pressure switch runs the pump between 2 and 4 bar. Lamps: RUN, STOPPED, TRIP and PHASE FAULT. Try every position of the selector and every protection.',
    build(b) {
      ladderSupply(b, 10, -14, 1, 24, 64, 9, undefined, -5.4);
      const mot = protectedPower(b);
      rung(b, -6, 24, 64, [ES(), NO('Q1', '13-14'), NC('F1', '95-96'), NO('KP', '11-14')]);
      b.h('selector3', 42, -6, { pos: 2 });
      b.w([44, -7], [44, -9]);
      rung(b, -9, 44, 64, [PBNC('STOP'), PB('START')]);
      par(b, -9, 48, 52, -3, NO('KM'));
      b.w([52, -9], [60, -9], [60, -6]);
      b.w([44, -5], [44, -3]);
      part('pressw', { pres: 3, cutin: 2, cutout: 4 }, 'AUTO: PRESSURE', 'below').make(b, 44, -3);
      b.w([48, -3], [60, -3], [60, -6]);
      COIL('KM').make(b, 60, -6);
      b.label(42, -4, 'H-O-A');
      rung(b, 0, 24, 64, [NO('KM', '23-24')], LAMP('RUN'));
      rung(b, 3, 24, 64, [NC('KM', '31-32')], LAMP('STOPPED'));
      rung(b, 6, 24, 64, [NO('F1', '97-98')], LAMP('TRIP'));
      rung(b, 9, 24, 64, [NC('KP', '11-12')], LAMP('PHASE FAULT'));
      motorRun(b, mot);
    },
  },
];

/** Reversing power circuit: KF (in order) and KR (L1 ↔ L3 swapped), overload F1, motor. */
function fwdRevPower(b) {
  b.el('lmain3', 10, 3, { tag: 'KF' }); b.el('lmain3', 16, 3, { tag: 'KR' });
  b.w([9, -4], [15, -4], [15, 1]); b.w([10, -3], [16, -3], [16, 1]); b.w([11, -2], [17, -2], [17, 1]);
  const olr = b.el('lolr', 10, 11, { tag: 'F1', ir: 8 });
  for (let k = 0; k < 3; k++) b.w([9 + k, 5], [9 + k, 9]);
  b.w([15, 5], [15, 8], [11, 8]); b.w([16, 5], [16, 7], [10, 7]); b.w([17, 5], [17, 6], [9, 6]);
  const mot = b.el('im3', 10, 17, { load: 6 }, 1, true);
  for (let k = 0; k < 3; k++) b.w(b.pin(olr, 3 + k), b.pin(mot, k));
  return mot;
}
/** Auto-reversing ladder: KA (START/STOP + extra), KF started at home by LS1, KR at the far end by LS2. */
function autoShuttle(b, xl, xn, extra = []) {
  rung(b, -6, xl, xn, [NC('F1', '95-96'), PBNC('STOP'), PB('START'), ...extra], COIL('KA'));
  par(b, -6, xl + 8, xl + 12, 3, NO('KA'));
  rung(b, 0, xl, xn, [NO('KA', '23-24'), LSNO('LS1', 0, 'low'), LSNC('LS2', 100, 'high'), NC('KR')], COIL('KF'));
  par(b, 0, xl + 4, xl + 8, 3, NO('KF'));
  rung(b, 6, xl, xn, [NO('KA', '33-34'), LSNO('LS2', 100, 'high'), LSNC('LS1', 0, 'low'), NC('KF')], COIL('KR'));
  par(b, 6, xl + 4, xl + 8, 3, NO('KR'));
}
/** A 3-phase source and MCB whose phases run down columns cx−1..cx+1 to y = yTop (no control feed). */
function ladderSupplyless(b, cx, yTop, mcb) {
  const src = b.el('ac3y', cx + 1, -14, {}, 1, true);
  const cb = b.el('mcb3p', cx, -8, mcb, 1, true);
  b.w(b.pin(src, 0), [cx - 1, -11], [cx - 2, -11], b.pin(cb, 0));
  b.w(b.pin(src, 1), b.pin(cb, 1));
  b.w(b.pin(src, 2), [cx + 1, -11], [cx + 2, -11], b.pin(cb, 2));
  b.w(b.pin(cb, 3), [cx - 2, -5], [cx - 1, -5], [cx - 1, yTop]);
  b.w(b.pin(cb, 4), [cx, yTop]);
  b.w(b.pin(cb, 5), [cx + 2, -5], [cx + 1, -5], [cx + 1, yTop]);
  return { src, cb };
}

// the generator's neutral is not used (the load is a 3-wire motor)
export const ALLOW_OPEN3 = { ats: 1 };
