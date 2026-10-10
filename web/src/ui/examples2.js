// More built-in examples: industrial motor control, power electronics,
// renewable energy, communication links and oscillators.
// Coordinates are in grid units (1 = 20 px); b.pin(e, k) gives a part's post.

const C = ['#facc15', '#22d3ee', '#f472b6', '#4ade80'];

/** net label whose flag points left (body to the right of the post) or right (rot 2) */
const tagR = (b, x, y, name) => b.el('netlabel', x + 1, y, { name }); // post at (x, y), text to the right
const tagL = (b, x, y, name) => b.el('netlabel', x - 1, y, { name }, 2); // post at (x, y), text to the left


/**
 * 400 V supply (ac3y, neutral tagged N) with a 3-pole MCB, drawn vertically:
 * the three outputs run down columns cx−1, cx, cx+1 and end at y = yTop.
 */
function supply3(b, cx, y0, yTop, mcb = { in: 16, curve: 'D' }, tags = true) {
  const src = b.el('ac3y', cx + 1, y0, {}, 1, true);
  const cb = b.el('mcb3p', cx, y0 + 6, mcb, 1, true);
  b.w(b.pin(src, 0), [cx - 1, y0 + 3], [cx - 2, y0 + 3], b.pin(cb, 0));
  b.w(b.pin(src, 1), b.pin(cb, 1));
  b.w(b.pin(src, 2), [cx + 1, y0 + 3], [cx + 2, y0 + 3], b.pin(cb, 2));
  if (tags) tagR(b, ...b.pin(src, 3), 'N');
  b.w(b.pin(cb, 3), [cx - 2, y0 + 9], [cx - 1, y0 + 9], [cx - 1, yTop]);
  b.w(b.pin(cb, 4), [cx, yTop]);
  b.w(b.pin(cb, 5), [cx + 2, y0 + 9], [cx + 1, y0 + 9], [cx + 1, yTop]);
  if (tags) tagL(b, ...b.pin(cb, 3), 'L1');
  return { src, cb };
}

/**
 * Supply for a ladder-diagram example (no net labels): 400 V 3-phase source and 3-pole MCB,
 * the phases running down columns cx−1, cx, cx+1 to y = yTop. The control ladder sits to the
 * right between an L rail at x = xl (fed from L3 after the MCB) and an N rail at x = xn (fed
 * from the source neutral over the top); both rails run down to y = yBot.
 */
export function ladderSupply(b, cx, y0, yTop, xl, xn, yBot, mcb, titleDy = 0) {
  const { src, cb } = supply3(b, cx, y0, yTop, mcb, false);
  const [lx, ly] = b.pin(cb, 5), [nx, ny] = b.pin(src, 3);
  b.w([lx, ly], [xl, ly], [xl, yBot]); // L rail
  b.w([nx, ny], [nx + 1, ny], [nx + 1, y0 - 2], [xn, y0 - 2], [xn, yBot]); // N rail
  b.label(xl - 1.3, ly - 0.9, 'L3'); b.label(xn + 1, y0 - 2.9, 'N');
  b.label(cx, y0 - 4.2, 'POWER CIRCUIT', 11); b.label((xl + xn) / 2, ly - 3.2 + titleDy, 'CONTROL CIRCUIT', 11);
  return { src, cb, top: ly };
}
/** NO / NC contact or coil of the ladder, centred at grid (x, y), terminals at x ± 2. */
const lno = (b, x, y, tag, terms = '13-14') => b.h('lno', x, y, { tag, terms });
const lnc = (b, x, y, tag, terms = '21-22') => b.h('lnc', x, y, { tag, terms });
const lcoil = (b, x, y, tag) => b.h('lcoil', x, y, { tag });
/** motor below an overload relay: OLR at (cx, oy), motor 3 rows under its outputs */
function olrMotor(b, cx, oy, olrP, motorType, motorP) {
  const olr = b.el('olr3', cx, oy, olrP);
  const mot = b.el(motorType, cx, oy + 6, motorP, 1, true);
  for (let k = 0; k < 3; k++) b.w(b.pin(olr, 3 + k), b.pin(mot, k));
  tagL(b, ...b.pin(olr, 6), 'L1'); tagL(b, ...b.pin(olr, 7), 'L1 ctrl');
  return { olr, mot };
}
/** TRIP pilot lamp on the overload relay's 97-98 contact */
function tripLamp(b, olr) {
  const [x, y] = b.pin(olr, 9);
  tagR(b, ...b.pin(olr, 8), 'L1 ctrl');
  const l = b.h('neon', x + 3, y + 1, { rb: 150e3 });
  b.w([x, y], [x, y + 1], b.pin(l, 0)); tagR(b, ...b.pin(l, 1), 'N');
  b.label(x + 3, y + 2.6, 'TRIP');
  return l;
}

export const EXAMPLES2 = [
  // ======================================================= industrial control
  {
    id: 'stardelta', cat: 'Industrial Control (Ladder)', title: 'Star-delta starter (automatic)',
    desc: 'The standard way to start a large induction motor with reduced current, drawn as a power circuit (left) and a ladder diagram (right). Press START: coils KM and KY pull in (KM holds itself with KM 13-14), so the main contacts KM feed the motor and KY joins the winding ends U2-V2-W2 into a star — each winding gets 400/√3 = 230 V, and starting current and torque are one third of a direct start. The timer coil KT starts at the same time; after 1.5 s its KT 15-16 contact drops KY and its KT 15-18 contact picks up KΔ, which connects the windings in delta: each now gets the full 400 V. KΔ 21-22 in the KY rung and KY 21-22 in the KΔ rung make it impossible for both to close together (that would short the supply). The overload contact F1 95-96 feeds the whole control circuit; the lamps show STAR, DELTA and TRIP.',
    build(b) {
      const yb = 15;
      ladderSupply(b, 10, -14, 1, 24, 58, yb, { in: 25, curve: 'D' });
      // ---- power circuit
      b.el('lmain3', 10, 3, { tag: 'KM' });
      for (let k = 0; k < 3; k++) b.w([9 + k, 5], [9 + k, 9]);
      const olr = b.el('lolr', 10, 11, { tag: 'F1', ir: 4.5 });
      const mot = b.el('im3d', 10, 17, { load: 20, loadType: 'fan' }, 1, true);
      for (let k = 0; k < 3; k++) b.w(b.pin(olr, 3 + k), b.pin(mot, k));
      b.el('lmain3', 10, 25, { tag: 'KY' });
      for (let k = 0; k < 3; k++) b.w(b.pin(mot, 3 + k), [9 + k, 23]);
      b.w([9, 27], [11, 27]); // star point
      // delta contactor fed from the KM outputs: L1 → W2, L2 → U2, L3 → V2
      b.el('lmain3', 17, 13, { tag: 'KΔ' });
      b.w([9, 6], [16, 6], [16, 11]); b.w([10, 7], [17, 7], [17, 11]); b.w([11, 8], [18, 8], [18, 11]);
      b.w([16, 15], [16, 20], [11, 20]); b.w([17, 15], [17, 21], [9, 21]); b.w([18, 15], [18, 22], [10, 22]);
      // ---- control circuit (ladder)
      lnc(b, 26, -6, 'F1', '95-96'); b.h('pushnc', 30, -6); b.h('pushno', 34, -6);
      b.w([36, -6], [50, -6]); lcoil(b, 52, -6, 'KM'); b.w([54, -6], [58, -6]);
      lno(b, 34, -3, 'KM'); b.w([32, -6], [32, -3]); b.w([36, -6], [36, -3]); // hold-in
      b.w([38, -6], [38, 6]); // everything below runs while KM is held in
      b.w([38, 0], [50, 0]); b.h('ltimer', 52, 0, { tag: 'KT', t: 1.5 }); b.w([54, 0], [58, 0]);
      lnc(b, 40, 3, 'KT', '15-16'); lnc(b, 44, 3, 'KΔ'); b.w([46, 3], [50, 3]); lcoil(b, 52, 3, 'KY'); b.w([54, 3], [58, 3]);
      lno(b, 40, 6, 'KT', '15-18'); lnc(b, 44, 6, 'KY'); b.w([46, 6], [50, 6]); lcoil(b, 52, 6, 'KΔ'); b.w([54, 6], [58, 6]);
      const lamp = (y, tag, terms, text) => { lno(b, 26, y, tag, terms); b.w([28, y], [50, y]); b.h('neon', 52, y, { rb: 150e3 }); b.w([54, y], [58, y]); b.label(46, y - 0.9, text); };
      lamp(9, 'KY', '13-14', 'STAR'); lamp(12, 'KΔ', '13-14', 'DELTA'); lamp(yb, 'F1', '97-98', 'TRIP');
      b.label(30, -7.7, 'STOP'); b.label(34, -7.7, 'START');
      b.cur(mot, C[0]);
      b.doc.simSettings.speed = 0.2;
    },
  },
  {
    id: 'fwdrev', cat: 'Industrial Control (Ladder)', title: 'Forward / reverse motor control',
    desc: 'Reversing a 3-phase motor = swapping two phases. Left, the power circuit: main contacts KF connect L1-L2-L3 to the motor in order, KR swaps L1 and L3; F1 is the overload relay. Right, the control circuit as a ladder diagram between L3 and N: press FWD and coil KF pulls in, its KF 13-14 contact across FWD holds it in after you let go, and its KF 21-22 contact in the KR rung blocks reverse (electrical interlock) — so KF and KR can never close together and short two phases. REV works the same way for KR. STOP or an overload (F1 95-96) drops the coil; F1 97-98 lights TRIP. Every contact carries the tag of the coil it belongs to. To reverse, press STOP first and watch the speed change sign.',
    build(b) {
      const yb = 8;
      ladderSupply(b, 10, -14, 1, 24, 52, yb);
      // power circuit
      b.el('lmain3', 10, 3, { tag: 'KF' }); b.el('lmain3', 16, 3, { tag: 'KR' });
      b.w([9, -4], [15, -4], [15, 1]); b.w([10, -3], [16, -3], [16, 1]); b.w([11, -2], [17, -2], [17, 1]);
      const olr = b.el('lolr', 10, 11, { tag: 'F1', ir: 8 });
      for (let k = 0; k < 3; k++) b.w([9 + k, 5], [9 + k, 9]);
      b.w([15, 5], [15, 8], [11, 8]); b.w([16, 5], [16, 7], [10, 7]); b.w([17, 5], [17, 6], [9, 6]); // KR: L1 ↔ L3 swapped
      const mot = b.el('im3', 10, 17, { load: 10 }, 1, true);
      for (let k = 0; k < 3; k++) b.w(b.pin(olr, 3 + k), b.pin(mot, k));
      // control circuit (ladder)
      lnc(b, 26, -6, 'F1', '95-96'); b.h('pushnc', 30, -6); b.h('pushno', 34, -6); lnc(b, 38, -6, 'KR');
      b.w([40, -6], [44, -6]); lcoil(b, 46, -6, 'KF'); b.w([48, -6], [52, -6]);
      lno(b, 34, -3, 'KF'); b.w([32, -6], [32, -3]); b.w([36, -6], [36, -3]); // hold-in
      b.w([32, -3], [32, 1]); b.h('pushno', 34, 1); lnc(b, 38, 1, 'KF');
      b.w([40, 1], [44, 1]); lcoil(b, 46, 1, 'KR'); b.w([48, 1], [52, 1]);
      lno(b, 34, 4, 'KR'); b.w([32, 1], [32, 4]); b.w([36, 1], [36, 4]);
      lno(b, 26, yb, 'F1', '97-98'); b.w([28, yb], [44, yb]); b.h('neon', 46, yb, { rb: 150e3 }); b.w([48, yb], [52, yb]);
      b.label(30, -7.7, 'STOP'); b.label(34, -7.7, 'FWD'); b.label(34, -0.7, 'REV'); b.label(46, yb - 1.6, 'TRIP');
      b.cur(mot, C[0]);
      b.doc.simSettings.speed = 0.2;
    },
  },
  {
    id: 'waterpump', cat: 'Industrial Control (Ladder)', title: 'Automatic water pump (float switch)',
    desc: 'Overhead-tank pump control, drawn as a power circuit (left) and a ladder diagram (right). A tethered float switch (NC) sits in the rung of contactor coil K: it opens when the water rises above 80 % and — because of its 60 % hysteresis — only closes again when the level falls below 20 %, like the classic low/high electrodes with a hold-in contact. Select the float and drag its level knob down below 20 %: coil K pulls in, the main contacts K start the pump and K 13-14 lights RUN; raise the level above 80 % and it stops. The overload relay F1 protects the motor: its 95-96 contact drops the coil, 97-98 lights TRIP.',
    build(b) {
      const yb = 8;
      ladderSupply(b, 10, -14, 1, 22, 46, yb);
      b.el('lmain3', 10, 3, { tag: 'K' });
      const olr = b.el('lolr', 10, 9, { tag: 'F1', ir: 8 });
      for (let k = 0; k < 3; k++) b.w([9 + k, 5], [9 + k, 7]);
      const mot = b.el('im3', 10, 15, { load: 8, loadType: 'fan' }, 1, true);
      for (let k = 0; k < 3; k++) b.w(b.pin(olr, 3 + k), b.pin(mot, k));
      lnc(b, 24, -6, 'F1', '95-96'); b.h('floatsw', 30, -6, { mode: 'NC', set: 80, hyst: 60, level: 85 });
      b.w([26, -6], [28, -6]); b.w([32, -6], [38, -6]); lcoil(b, 40, -6, 'K'); b.w([42, -6], [46, -6]);
      lno(b, 24, 1, 'K'); b.w([26, 1], [38, 1]); b.h('neon', 40, 1, { rb: 150e3 }); b.w([42, 1], [46, 1]);
      lno(b, 24, yb, 'F1', '97-98'); b.w([26, yb], [38, yb]); b.h('neon', 40, yb, { rb: 150e3 }); b.w([42, yb], [46, yb]);
      b.label(30, -7.8, 'FLOAT (NC)'); b.label(40, -0.6, 'RUN'); b.label(40, yb - 1.6, 'TRIP');
      b.cur(mot, C[0]);
      b.doc.simSettings.speed = 0.2;
    },
  },
  {
    id: 'conveyor', cat: 'Industrial Control', title: 'Conveyor bottle counter (photo-eye)',
    desc: 'A 24 V photoelectric sensor (diffuse, PNP, light-on) watches the conveyor. When a bottle passes within its 300 mm range the BK output switches +24 V; a 10 k / 2.7 k divider turns that into a 5 V logic pulse that clocks a BCD counter, decoded onto a 7-segment display. Select the photo-eye and move its Object-distance knob below 300 mm and back again to pass a bottle — each pass adds one.',
    build(b) {
      b.v('dcv', 0, 4, { amp: 24 });
      const pe = b.el('photoeye', 6, 2, { d: 1000, sn: 300 });
      b.w([0, 2], [0, -2], [5, -2], b.pin(pe, 0));
      b.w([0, 6], [0, 8], [24, 8]); b.w(b.pin(pe, 2), [5, 8]);
      const r1 = b.h('resistor', 10, 2, { r: 10000 }), r2 = b.v('resistor', 12, 5, { r: 2700 });
      b.w(b.pin(pe, 1), b.pin(r1, 0)); b.w(b.pin(r1, 1), b.pin(r2, 0)); b.w(b.pin(r2, 1), [12, 8]);
      const ctr = b.el('bcdcounter', 18, 1), dec = b.el('decoder7', 24, 1), seg = b.el('sevenseg', 30, 1);
      b.w([12, 2], [14, 2], [14, 0], b.pin(ctr, 0)); b.w(b.pin(ctr, 1), [16, 8]);
      for (let k = 0; k < 4; k++) b.w(b.pin(ctr, 2 + k), b.pin(dec, k));
      for (let k = 0; k < 7; k++) b.w(b.pin(dec, 4 + k), b.pin(seg, k));
      b.el('ground', 0, 8);
      b.label(6.8, -0.6, 'photo-eye'); b.label(2.5, -3.4, '+24 V');
      b.node(14, 2, C[0]);
    },
  },
  {
    id: 'phasefail', cat: 'Industrial Control (Ladder)', title: 'Phase-failure protection relay',
    desc: 'A 3-phase motor must never run on two phases (single-phasing): it overheats within seconds. The phase monitor KP watches L1-L2-L3 after the fuses; while all three phases are present, in the right sequence and balanced, its contact KP 11-14 in the coil rung of the ladder (right) is closed. Press START: coil K pulls in and holds itself with K 13-14, and the main contacts K run the motor. Now open the "blown fuse" switch in L3: KP releases after its delay, KP 11-14 opens, coil K drops and the motor is disconnected, while KP 11-12 lights PHASE FAULT. Close the switch again and restart. F1 is the overload relay (95-96 in the coil rung, 97-98 for TRIP).',
    build(b) {
      const yb = 5;
      ladderSupply(b, 10, -14, -3, 26, 54, yb);
      const fuse = b.v('switch', 11, -1, { closed: true });
      b.w([9, -3], [9, 6]); b.w([10, -3], [10, 6]); b.w(b.pin(fuse, 1), [11, 6]);
      b.el('lmain3', 10, 8, { tag: 'K' });
      const olr = b.el('lolr', 10, 14, { tag: 'F1', ir: 8 });
      for (let k = 0; k < 3; k++) b.w([9 + k, 10], [9 + k, 12]);
      const mot = b.el('im3', 10, 20, { load: 10 }, 1, true);
      for (let k = 0; k < 3; k++) b.w(b.pin(olr, 3 + k), b.pin(mot, k));
      // phase monitor senses the lines after the fuses; its neutral comes from the source
      b.el('lphase', 20, 4, { tag: 'KP', delay: 0.3 });
      b.w([9, 3], [18, 3]); b.w([10, 4], [18, 4]); b.w([11, 5], [18, 5]);
      b.w([13, -14], [16, -14], [16, 6], [18, 6]);
      // control circuit (ladder)
      lnc(b, 28, -6, 'F1', '95-96'); b.h('pushnc', 32, -6); b.h('pushno', 36, -6); lno(b, 40, -6, 'KP', '11-14');
      b.w([42, -6], [46, -6]); lcoil(b, 48, -6, 'K'); b.w([50, -6], [54, -6]);
      lno(b, 36, -3, 'K'); b.w([34, -6], [34, -3]); b.w([38, -6], [38, -3]); // hold-in
      lnc(b, 28, 1, 'KP', '11-12'); b.w([30, 1], [46, 1]); b.h('neon', 48, 1, { rb: 150e3 }); b.w([50, 1], [54, 1]);
      lno(b, 28, yb, 'F1', '97-98'); b.w([30, yb], [46, yb]); b.h('neon', 48, yb, { rb: 150e3 }); b.w([50, yb], [54, yb]);
      b.label(32, -7.7, 'STOP'); b.label(36, -7.7, 'START'); b.label(14, -1, 'blown fuse');
      b.label(48, -0.6, 'PHASE FAULT'); b.label(48, yb - 1.6, 'TRIP');
      b.cur(mot, C[0]);
      b.doc.simSettings.speed = 0.2;
    },
  },
  {
    id: 'loop420', cat: 'Industrial Control', title: '4–20 mA pressure transmitter loop',
    desc: 'The industry-standard analog signal. A 2-wire, loop-powered pressure transmitter (0–10 bar) regulates the loop current between 4 mA (0 bar) and 20 mA (10 bar); a 250 Ω receiver resistor turns it into 1–5 V for the panel meter or a PLC input. Turn the pressure knob and watch the current; a broken wire would give 0 mA, which the receiver can tell apart from a real 0 bar (4 mA).',
    build(b) {
      b.v('dcv', 0, 3, { amp: 24 });
      const tx = b.h('ptx', 4, -1, { x: 5 });
      const r = b.v('resistor', 10, 1, { r: 250 });
      const pm = b.el('panelmeter', 15, 2, { range: '20' });
      b.w([0, 1], [0, -1], b.pin(tx, 0)); b.w(b.pin(tx, 1), b.pin(r, 0)); b.w(b.pin(r, 0), [13, -1], b.pin(pm, 0));
      b.w(b.pin(r, 1), [10, 5], [0, 5]); b.w(b.pin(r, 1), b.pin(pm, 1));
      b.el('ground', 0, 5);
      b.label(4, -2.6, 'PT 0–10 bar'); b.label(8.8, 4.2, '250 Ω'); b.label(-2.6, 3, '24 V');
      b.cur(tx, C[0]);
    },
  },
  {
    id: 'firealarm', cat: 'Industrial Control', title: 'Fire alarm zone (smoke detectors)',
    desc: 'A conventional fire-alarm zone: 24 V through a 470 Ω zone resistor feeds two smoke detectors in parallel and a 4.7 kΩ end-of-line resistor (which lets the panel see a broken cable). Normal: the zone sits at ≈21.8 V. Raise the smoke density on either detector above 3 %/m: it latches into alarm and clamps the line to ≈6 V; the comparator (zone below 15 V) sounds the buzzer and lights the LED. Clearing the smoke does not reset it — hold RESET to remove the zone power.',
    build(b) {
      b.v('dcv', 0, 4, { amp: 24 });
      const rst = b.h('pushnc', 4, -3);
      const rz = b.v('resistor', 8, 0, { r: 470 });
      b.w([0, 2], [0, -3], b.pin(rst, 0)); b.w(b.pin(rst, 1), [8, -3], b.pin(rz, 0));
      b.w(b.pin(rz, 1), [20, 2]);
      const sd1 = b.v('smoke', 12, 5), sd2 = b.v('smoke', 16, 5), eol = b.v('resistor', 20, 5, { r: 4700 });
      for (const [e, x] of [[sd1, 12], [sd2, 16], [eol, 20]]) { b.w([x, 2], b.pin(e, 0)); b.w(b.pin(e, 1), [x, 9]); }
      b.w([0, 6], [0, 9], [36, 9]); b.el('ground', 0, 9);
      const cmp = b.el('comparator', 28, 4, {}, 0, true); // flipped: V+ on top
      b.el('rail', 25, 1, { amp: 15 }); b.w([25, 1], [25, 3], b.pin(cmp, 1)); // V+ = 15 V reference
      b.w([20, 2], [22, 2], [22, 5], b.pin(cmp, 0)); // V− = zone voltage
      const r = b.h('resistor', 34, 4, { r: 330 }), led = b.v('led', 36, 6, { color: 'red' }), bz = b.v('buzzer', 30, 7);
      b.w(b.pin(cmp, 2), b.pin(r, 0)); b.w(b.pin(r, 1), b.pin(led, 0)); b.w(b.pin(led, 1), [36, 9]);
      b.w(b.pin(cmp, 2), b.pin(bz, 0));
      b.label(4, -4.6, 'RESET'); b.label(16, 10.6, 'detectors + end-of-line resistor'); b.label(28, 1.6, 'zone < 15 V ?');
      b.node(22, 2, C[0]);
    },
  },
  // ======================================================= power electronics
  {
    id: 'vfd', cat: 'Power Electronics', title: 'Variable-frequency drive (VFD) for an induction motor',
    desc: 'How a VFD works: the 400 V 3-phase supply is rectified by a 6-diode bridge into a ≈540 V DC bus, smoothed by the 2.2 mF capacitor bank. A 3-phase IGBT inverter then chops the DC bus into a variable-frequency, variable-voltage output: the sine-triangle PWM modulator (2 kHz carrier) ramps the frequency from 0 to 50 Hz in 1 s and keeps V/f constant, so the motor accelerates smoothly with no inrush. Select the PWM modulator and change the output frequency (try 25 Hz → half speed) or reverse the phase sequence; switch EN off to coast the motor. Watch the stepped PWM line current turn into a near-sine current in the scope.',
    build(b) {
      const src = b.el('ac3d', 0, -6);
      const rec = b.el('rect3', 6, -6);
      for (let k = 0; k < 3; k++) b.w(b.pin(src, k), b.pin(rec, k));
      const cap = b.v('ecap', 12, -6, { c: 2.2e-3, vmax: 800 });
      const vm = b.v('voltmeter', 16, -6, { mode: 'avg', tau: 0.02 });
      b.w(b.pin(rec, 3), [10, -7], [10, -8], b.pin(cap, 0)); b.w(b.pin(rec, 4), [10, -5], [10, -4], b.pin(cap, 1));
      b.w(b.pin(cap, 0), b.pin(vm, 0)); b.w(b.pin(cap, 1), b.pin(vm, 1));
      tagR(b, ...b.pin(vm, 0), 'DC+'); tagR(b, ...b.pin(vm, 1), 'DC−');
      b.el('ground', 10, -4);
      const pwm = b.el('spwm', 10, 2, { f: 50, ramp: 1, fc: 2000 });
      const inv = b.el('inv3', 16, 2);
      for (let k = 0; k < 3; k++) b.w(b.pin(pwm, k), b.pin(inv, k));
      b.el('logicin', 11, 6, { on: true }); b.w([12, 6], [13, 6], [13, 4], b.pin(inv, 3));
      b.w(b.pin(inv, 4), [18, -1]); tagR(b, 18, -1, 'DC+');
      b.w(b.pin(inv, 8), [18, 5]); tagR(b, 18, 5, 'DC−');
      const mot = b.el('im3', 24, 2, { load: 15, loadType: 'fan' });
      for (let k = 0; k < 3; k++) b.w(b.pin(inv, 5 + k), b.pin(mot, k));
      b.label(0, -3.2, '400 V 3~'); b.label(6, -2.8, 'rectifier'); b.label(14, -2.8, 'DC bus');
      b.label(10, -1.4, 'SPWM V/f'); b.label(16.4, -2.4, 'inverter'); b.label(10, 7.6, 'EN');
      b.cur(mot, C[0]);
      b.doc.simSettings.speed = 0.1; b.doc.simSettings.maxStep = 1e-5;
    },
  },
  {
    id: 'hbridgemotor', cat: 'Power Electronics', title: 'H-bridge DC motor speed & direction (L298N)',
    desc: 'An L298N H-bridge drives a 12 V DC motor. IN1/IN2 choose the direction (10 = forward, 01 = reverse, 00 or 11 = brake — both motor terminals tied together, the motor stops quickly), and a 1 kHz PWM signal on EN sets the speed: the average motor voltage is duty × (12 V − the bridge\'s ≈2 V drop). Toggle IN1 and IN2, and change the PWM duty cycle; the motor current reverses with the direction. The motor inductance smooths the chopped current.',
    build(b) {
      const hb = b.el('hbridge', 8, 1);
      const m = b.v('motor', 14, 3, { k: 0.02, ra: 2, la: 0.002, j: 1e-5, b: 2e-6, load: 0.005 });
      b.w(b.pin(hb, 4), b.pin(m, 0)); b.w(b.pin(hb, 5), [12, 2], [12, 5], b.pin(m, 1));
      const bat = b.v('dcv', 20, 2, { amp: 12 });
      b.w(b.pin(hb, 3), [10, -2], [20, -2], b.pin(bat, 0));
      b.w(b.pin(hb, 6), [11, 3], [11, 7], [20, 7], b.pin(bat, 1)); b.el('ground', 20, 7);
      b.el('logicin', 3, -1, { on: true }); b.w([4, -1], [5, -1], [5, 0], b.pin(hb, 0));
      b.el('logicin', 3, 1); b.w([4, 1], b.pin(hb, 1));
      b.el('pwm', 2, 3, { duty: 70, freq: 1000 }, 2); b.w([4, 3], [5, 3], [5, 2], b.pin(hb, 2)); b.el('ground', 0, 3);
      b.label(1, -1, 'IN1'); b.label(1, 1, 'IN2'); b.label(2, 4.6, 'EN (PWM)'); b.label(8, -2.6, 'L298N'); b.label(22.6, 2, '12 V');
      b.cur(m, C[0]);
      b.doc.simSettings.speed = 0.05; b.doc.simSettings.maxStep = 2e-5;
    },
  },
  {
    id: 'sineinv', cat: 'Power Electronics', title: 'Single-phase sine-wave inverter (SPWM + LC filter)',
    desc: 'A pure-sine inverter from a 350 V DC link: two half-bridge legs of an IGBT bridge are switched by unipolar sine-triangle PWM (5 kHz carrier, m = 0.9), so the bridge output is a 3-level pulse train whose average follows a 50 Hz sine. The 5 mH / 10 µF LC low-pass filter (corner ≈ 710 Hz) removes the 10 kHz switching ripple and leaves ≈ 0.9 × 350 / √2 ≈ 223 V RMS across the 50 Ω load (≈1 kW). Compare the inductor current (with ripple) with the smooth load voltage; change the modulation index to regulate the output voltage.',
    build(b) {
      const bat = b.v('dcv', 0, 2, { amp: 350 });
      const pwm = b.el('spwm', 6, 2, { f: 50, m: 0.9, ramp: 0, boost: 0, mode: '1uni', fc: 5000, thi: false });
      const inv = b.el('inv3', 12, 2);
      for (let k = 0; k < 3; k++) b.w(b.pin(pwm, k), b.pin(inv, k));
      b.el('logicin', 8, 6, { on: true }); b.w([9, 6], [9, 4], b.pin(inv, 3));
      b.w(b.pin(bat, 0), [0, -2], [14, -2], b.pin(inv, 4));
      b.w(b.pin(bat, 1), [0, 7], [14, 7], b.pin(inv, 8)); b.el('ground', 0, 7);
      const l = b.h('inductor', 18, 1, { l: 5e-3, rs: 0.1, irate: '10' });
      const c = b.v('capacitor', 22, 3, { c: 10e-6, vr: '630' }), r = b.v('resistor', 26, 3, { r: 50, pw: '0' }), vm = b.v('voltmeter', 30, 3, { mode: 'rms' });
      b.w(b.pin(inv, 5), b.pin(l, 0)); b.w(b.pin(l, 1), b.pin(c, 0)); b.w(b.pin(c, 0), b.pin(r, 0)); b.w(b.pin(r, 0), b.pin(vm, 0));
      b.w(b.pin(inv, 6), [15, 2], [15, 5], b.pin(c, 1)); b.w(b.pin(c, 1), b.pin(r, 1)); b.w(b.pin(r, 1), b.pin(vm, 1));
      b.label(-2.6, 2, '350 V'); b.label(6, -1.4, 'SPWM'); b.label(12, -3.4, 'H-bridge'); b.label(20, -0.4, 'LC filter'); b.label(26, 6, '50 Ω');
      b.cur(l, C[0]); b.volt(r, C[1]);
      b.doc.simSettings.speed = 0.02; b.doc.simSettings.maxStep = 4e-6;
    },
  },
  {
    id: 'flyback', cat: 'Power Electronics', title: 'Flyback converter (switch level)',
    desc: 'The simplest isolated SMPS, as used in phone chargers. While the MOSFET is on, the primary current ramps up and stores energy in the coupled inductor\'s core (the output diode is reverse-biased by the winding polarity). When it turns off, the winding voltages reverse and the stored energy flies back through the diode into the output capacitor. Vout ≈ n·Vin·D/(1−D) − V_diode = 12 × 0.33/0.67 − 0.4 ≈ 5.5 V in continuous mode (≈5 V with the winding and switch losses). The 36 V Zener clamps the spike caused by the leakage inductance (k = 0.99). Change the PWM duty cycle and watch the output; the drain voltage shows Vin + reflected Vout while the switch is off.',
    build(b) {
      const bat = b.v('dcv', 0, 2, { amp: 12 });
      const t = b.el('coupledl', 6, 2, { l1: 200e-6, l2: 200e-6, k: 0.99, r1: 0.05, r2: 0.05 });
      b.w(b.pin(bat, 0), [0, -2], [4, -2], b.pin(t, 0));
      const q = b.el('nmos', 3, 6, { model: 'IRF540N' });
      b.w(b.pin(bat, 1), [0, 8], b.pin(q, 2)); b.el('ground', 0, 8);
      const z = b.vr('zener', 6, 6, { bv: 36 });
      b.w(b.pin(q, 1), b.pin(z, 1)); b.w(b.pin(q, 2), b.pin(z, 0));
      b.el('pwm', -3, 6, { duty: 33, freq: 20000, vhigh: 10 }, 2); b.w([-1, 6], b.pin(q, 0)); b.el('ground', -5, 6);
      const d = b.h('diode', 11, 4, { model: '1N5819' });
      b.w(b.pin(t, 3), b.pin(d, 0)); b.w(b.pin(t, 2), [11, 0]); b.el('ground', 11, 0);
      const co = b.v('ecap', 15, 6, { c: 470e-6, vmax: 16 }), rl = b.v('resistor', 19, 6, { r: 10, pw: '25' }), vm = b.v('voltmeter', 23, 6, { mode: 'avg', tau: 0.005 });
      b.w(b.pin(d, 1), b.pin(co, 0)); b.w(b.pin(co, 0), b.pin(rl, 0)); b.w(b.pin(rl, 0), b.pin(vm, 0));
      b.w(b.pin(co, 1), b.pin(rl, 1)); b.w(b.pin(rl, 1), b.pin(vm, 1)); b.el('ground', 15, 8);
      b.label(-2.6, 2, '12 V'); b.label(6, -2.6, '200 µH 1:1'); b.label(-3, 7.6, '20 kHz'); b.label(8.4, 6, '36 V'); b.label(19, 9.4, '10 Ω');
      b.node(4, 4, C[0]); b.volt(rl, C[1]);
      b.doc.simSettings.speed = 0.005; b.doc.simSettings.maxStep = 1e-6;
    },
  },
  {
    id: 'scrbridge', cat: 'Power Electronics', title: 'Fully-controlled SCR bridge (phase-angle firing)',
    desc: 'Controlled rectifier for DC motor drives and battery chargers. The firing unit synchronises to the mains zero crossings and fires T1+T4 at the angle α in the positive half-cycle and T2+T3 at α in the negative half-cycle (gate-cathode pairs joined by the net labels G1…G4, P, L, N). Each SCR keeps conducting until its current falls to zero, so with the inductive load the output voltage even goes negative for a while after the zero crossing. Average output ≈ 0.9 × 230 V × cos α (continuous current). Change the firing angle (0–180°): small α → full voltage, 90° → about zero.',
    build(b) {
      const ac = b.v('mains', -6, 1);
      const fu = b.el('firing', 0, 0, { alpha: 60 });
      b.w(b.pin(ac, 0), [-4, -1], [-4, 0], b.pin(fu, 0)); b.w(b.pin(ac, 1), [-4, 3], [-4, 1], b.pin(fu, 1));
      tagL(b, ...b.pin(ac, 0), 'L'); tagL(b, ...b.pin(ac, 1), 'N');
      ['G1', 'P', 'G2', 'P', 'G3', 'L', 'G4', 'N'].forEach((n, k) => tagR(b, ...b.pin(fu, 2 + k), n));
      const t1 = b.vr('scr', 10, 2), t2 = b.vr('scr', 16, 2), t3 = b.vr('scr', 10, 6), t4 = b.vr('scr', 16, 6);
      tagR(b, ...b.pin(t1, 2), 'G1'); tagR(b, ...b.pin(t2, 2), 'G2'); tagR(b, ...b.pin(t3, 2), 'G3'); tagR(b, ...b.pin(t4, 2), 'G4');
      tagL(b, ...b.pin(t1, 0), 'L'); b.w(b.pin(t2, 0), [19, 4]); tagR(b, 19, 4, 'N');
      b.w(b.pin(t1, 1), [10, -2], [16, -2]); b.w(b.pin(t2, 1), [16, -2]); tagL(b, 10, -2, 'P');
      const r = b.v('resistor', 24, 1, { r: 20, pw: '0' }), l = b.v('inductor', 24, 5, { l: 0.2, rs: 0.5, irate: '20' }), vm = b.v('voltmeter', 28, 3, { mode: 'avg', tau: 0.04 });
      b.w([16, -2], [24, -2], b.pin(r, 0)); b.w(b.pin(r, 1), b.pin(l, 0));
      b.w(b.pin(t3, 0), b.pin(t4, 0)); b.w(b.pin(t4, 0), [24, 8], b.pin(l, 1));
      b.w([24, -2], [28, -2], b.pin(vm, 0)); b.w([24, 8], [28, 8], b.pin(vm, 1));
      b.label(-8.6, 1, '230 V'); b.label(0, -5, 'firing unit'); b.label(13, 9.4, 'T1–T4 bridge'); b.label(21.4, 3, 'R-L load');
      b.volt(r, C[0]); b.cur(l, C[1]);
      b.doc.simSettings.speed = 0.02; b.doc.simSettings.maxStep = 2e-5;
    },
  },
  {
    id: 'bldcdrive', cat: 'Power Electronics', title: 'BLDC motor with hall-sensor commutation',
    desc: 'A brushless DC motor has its magnets on the rotor and three windings on the stator, so something must switch the windings in step with the rotor: three hall sensors report the rotor position in 60° sectors and the driver energises the matching pair of phases (six-step / trapezoidal commutation), chopping the high-side switch at 10 kHz to set the speed. Change the driver duty cycle to change speed, or its direction setting to reverse. The hall signals loop back from the motor to the driver.',
    build(b) {
      const drv = b.el('bldcdrv', 10, 2, { duty: 60 });
      const m = b.el('bldc', 18, 2);
      for (let k = 0; k < 3; k++) b.w(b.pin(drv, 5 + k), b.pin(m, k));
      for (let k = 0; k < 3; k++) b.w(b.pin(m, 3 + k), [22 + k, 1 + k], [22 + k, -2 - k], [6 - k, -2 - k], [6 - k, 1 + k], b.pin(drv, k));
      b.el('logicin', 6, 6, { on: true }); b.w([7, 6], [7, 4], b.pin(drv, 3));
      b.w(b.pin(drv, 4), [13, 0], [13, -1]); tagR(b, 13, -1, '+24V');
      b.w(b.pin(drv, 8), [12, 6]); b.el('ground', 12, 6);
      const bat = b.v('dcv', 28, 6, { amp: 24 }); tagL(b, ...b.pin(bat, 0), '+24V'); b.el('ground', 28, 8);
      b.label(10, -5.4, 'hall signals H1 H2 H3'); b.label(4, 7.6, 'EN'); b.label(30.6, 6, '24 V');
      b.cur(m, C[0]);
      b.doc.simSettings.speed = 0.02; b.doc.simSettings.maxStep = 2e-6;
    },
  },
  {
    id: 'stepperdrive', cat: 'Power Electronics', title: 'Stepper motor with a chopper driver',
    desc: 'A bipolar stepper motor (200 steps/rev) driven by a STEP/DIR driver like the A4988/DRV8825: every rising edge on STEP advances the coil currents one step in the sequence, DIR sets the direction and ¬EN (tied low) enables the outputs. The driver chops the 24 V supply to hold the coil current at the set limit (1 A) — much faster current rise than a resistor-limited drive, so more torque at speed. In half-step mode 400 pulses/s = 200 full steps/s = 1 rev/s = 60 rpm. Change the clock frequency or the microstep mode, or toggle DIR to reverse.',
    build(b) {
      const drv = b.el('stepdrv', 10, 2, { ilim: 1, mode: 'half' });
      const m = b.el('stepper', 18, 3);
      b.w(b.pin(drv, 4), b.pin(m, 0)); b.w(b.pin(drv, 5), b.pin(m, 1));
      b.w(b.pin(drv, 6), [14, 3], [14, 4], b.pin(m, 2)); b.w(b.pin(drv, 7), [13, 4], [13, 5], b.pin(m, 3));
      b.w(b.pin(drv, 8), [12, 7]); b.el('ground', 12, 7);
      b.w(b.pin(drv, 3), [12, -2]); tagR(b, 12, -2, '+24V');
      b.el('clock', 5, 1, { freq: 400 }); b.w([5, 1], b.pin(drv, 0));
      b.el('logicin', 4, 3); b.w([5, 3], [6, 3], [6, 2], b.pin(drv, 1));
      b.w(b.pin(drv, 2), [7, 3], [7, 5]); b.el('ground', 7, 5);
      const bat = b.v('dcv', 24, 8, { amp: 24 }); tagL(b, ...b.pin(bat, 0), '+24V'); b.el('ground', 24, 10);
      b.label(5, -1.6, 'STEP 400 Hz'); b.label(2, 3, 'DIR'); b.label(10, -2.4, 'driver'); b.label(26.6, 8, '24 V');
      b.cur(m, C[0]);
      b.doc.simSettings.speed = 0.05; b.doc.simSettings.maxStep = 5e-6;
    },
  },
  // ======================================================= renewable energy
  {
    id: 'solarmppt', cat: 'Renewables', title: 'Solar home system with MPPT charge controller',
    desc: 'A 300 W panel (60 cells, Voc ≈ 40 V, Vmp ≈ 32 V) charges a 12 V 100 Ah AGM battery through an MPPT charge controller. The controller hunts for the panel\'s maximum-power point (perturb & observe) and converts that power down to the battery voltage — so the battery receives almost twice the panel current. A 21 W 12 V lamp runs from the LOAD output, which disconnects if the battery falls below 11.5 V. Change the irradiance (clouds!) and the panel temperature and watch the panel and battery currents; compare with the PWM controller, which just connects the panel to the battery.',
    build(b) {
      const pv = b.v('pvarray', 0, 2, { ns: 1, irr: 1000 });
      const cc = b.el('mpptcc', 6, 2, { imax: 30 });
      b.w(b.pin(pv, 0), [2, 0], [2, 1], b.pin(cc, 0)); b.w(b.pin(pv, 1), [2, 4], [2, 3], b.pin(cc, 1)); b.el('ground', 0, 4);
      const bat = b.v('agm', 12, 2, { soc: 50 });
      b.w(b.pin(cc, 2), [10, 1], [10, 0], b.pin(bat, 0)); b.el('ground', 12, 4);
      tagR(b, ...b.pin(cc, 3), 'LOAD');
      const lamp = b.v('bulb', 18, 2, { v: 12, w: 21 }); tagL(b, ...b.pin(lamp, 0), 'LOAD'); b.el('ground', 18, 4);
      b.label(-2.8, 2, 'PV 300 W'); b.label(6, -1.4, 'MPPT'); b.label(14.8, 2, '12 V AGM');
      b.cur(pv, C[0]); b.cur(bat, C[1]);
      b.doc.simSettings.speed = 0.5; b.doc.simSettings.maxStep = 5e-4;
    },
  },
  {
    id: 'charger', cat: 'Renewables', title: 'Li-ion charger (CC-CV) with protection board',
    desc: 'A USB-powered TP4056-style charger fills a lithium-ion cell through a DW01-style protection board (BMS). Constant current (1 A) until the cell reaches 4.2 V, then constant voltage while the current tapers; it stops at 10 % of the set current. The cell here is only 3 mAh so a whole charge takes seconds. Then unplug the USB switch and close the LOAD switch to discharge it at ≈2 A: when the cell falls to 2.5 V the BMS opens its discharge MOSFET and the load goes dead, protecting the cell from deep discharge; open the load, plug the USB back in and the charger revives it (with the charger plugged in, it supplies 1 A of the load current itself). Watch the cell voltage and current.',
    build(b) {
      const usb = b.v('dcv', 0, 2, { amp: 5 });
      const ch = b.el('cccv', 6, 1, { icc: 1 });
      b.h('switch', 2, 0, { closed: true }); b.w(b.pin(ch, 1), [4, 4], b.pin(usb, 1)); b.el('ground', 0, 4);
      const bms = b.el('bms', 14, 2, {}, 2, true);
      b.w(b.pin(ch, 2), b.pin(bms, 2)); b.w(b.pin(bms, 3), [12, 4]); b.el('ground', 12, 4);
      const cell = b.v('liion', 20, 2, { soc: 20, ah: 0.003 });
      // a 3 mAh cell (so the whole charge takes seconds) at 300 mA is ≈100 C: time is compressed
      // here, so the real-life limits are off for this demonstration
      b.doc.simSettings.noDamage = true;
      b.w(b.pin(bms, 0), [18, 1], [18, 0], b.pin(cell, 0)); b.w(b.pin(bms, 1), [18, 3], [18, 4], b.pin(cell, 1));
      const sw = b.v('switch', 10, 4, { closed: false }), rl = b.v('resistor', 10, 8, { r: 2 });
      b.w([10, 1], b.pin(sw, 0)); b.w(b.pin(sw, 1), b.pin(rl, 0)); b.w(b.pin(rl, 1), [10, 10]); b.el('ground', 10, 10);
      b.label(-2.6, 2, 'USB 5 V'); b.label(2, -1.6, 'USB'); b.label(6, -2.4, 'CC-CV'); b.label(14, -1.4, 'BMS'); b.label(22.8, 2, 'Li-ion'); b.label(7.4, 4, 'LOAD'); b.label(7.6, 8, '2 Ω');
      b.volt(cell, C[0]); b.cur(cell, C[1]);
      b.doc.simSettings.speed = 1; b.doc.simSettings.maxStep = 1e-3;
    },
  },
  {
    id: 'gridtie', cat: 'Renewables', title: 'Grid-tie solar inverter with house load',
    desc: 'Ten 300 W panels in series (≈320 V DC at the maximum-power point) feed a 3 kW grid-tie inverter. It waits until the grid has been healthy for 0.2 s, then tracks the array\'s maximum power and injects it into the grid as a sine current in phase with the voltage. The house load (1 kW) is supplied first; the surplus flows back out through the meter, so the grid current is in anti-phase with the voltage (export). Lower the irradiance and the grid starts supplying the difference. Open the GRID switch: the anti-islanding protection stops the inverter at once, so a line worker is never shocked by a "dead" line.',
    build(b) {
      const pv = b.v('pvarray', 0, 2, { ns: 10, irr: 1000 });
      const inv = b.el('invgrid', 6, 2);
      b.w(b.pin(pv, 0), [2, 0], [2, 1], b.pin(inv, 0)); b.w(b.pin(pv, 1), [2, 4], [2, 3], b.pin(inv, 1));
      b.w(b.pin(inv, 2), [10, 1], [10, -1], [18, -1]); b.w(b.pin(inv, 3), [10, 3], [10, 5], [29, 5]);
      const load = b.v('rload', 14, 2, { p: 1000 }); b.w([14, -1], b.pin(load, 0)); b.w(b.pin(load, 1), [14, 5]);
      const am = b.h('acamp', 20, -1), sw = b.h('switch', 25, -1, { closed: true }), grid = b.v('mains', 29, 2);
      b.w(b.pin(am, 1), b.pin(sw, 0)); b.w(b.pin(sw, 1), [29, -1], b.pin(grid, 0)); b.w(b.pin(grid, 1), [29, 5]);
      b.label(-3, 2, 'PV 3 kW'); b.label(6, -1.4, 'grid-tie'); b.label(16.6, 2, 'house'); b.label(20, -2.6, 'grid meter'); b.label(25, -2.6, 'GRID'); b.label(31.6, 2, '230 V');
      b.cur(am, C[0]); b.volt(load, C[1]);
      b.doc.simSettings.speed = 0.1;
    },
  },
  {
    id: 'offgrid', cat: 'Renewables', title: 'Off-grid inverter (IPS) from a 12 V battery',
    desc: 'A pure-sine inverter makes 230 V 50 Hz from a 12 V 100 Ah battery — the classic home IPS. Switch on the lamp and the fan: the battery current follows the AC power (≈ P / (12 V × 0.9)), pulsing at 100 Hz because AC power itself pulses at twice the line frequency. The inverter shuts down if the battery falls below 10.5 V (and restarts above 12.5 V) and trips on overload (> 150 % of 1 kW for 0.5 s). Lower the battery state of charge to see the low-voltage cut-off.',
    build(b) {
      const bat = b.v('agm', 0, 2, { soc: 90 });
      const inv = b.el('invoff', 6, 2);
      b.w(b.pin(bat, 0), [2, 0], [2, 1], b.pin(inv, 0)); b.w(b.pin(bat, 1), [2, 4], [2, 3], b.pin(inv, 1)); b.el('ground', 0, 4);
      b.w(b.pin(inv, 2), [10, 1], [10, -3], [14, -3]); b.w([14, -3], [20, -3]); b.w(b.pin(inv, 3), [10, 3], [10, 7], [14, 7]); b.w([14, 7], [20, 7]);
      const s1 = b.v('switch', 14, -1, { closed: true }), lamp = b.v('bulb', 14, 3, { w: 100 });
      const s2 = b.v('switch', 20, -1, { closed: false }), fan = b.v('fan', 20, 3);
      b.w(b.pin(s1, 1), b.pin(lamp, 0)); b.w(b.pin(lamp, 1), [14, 7]);
      b.w(b.pin(s2, 1), b.pin(fan, 0)); b.w(b.pin(fan, 1), [20, 7]);
      b.label(-2.8, 2, '12 V AGM'); b.label(6, -1.4, 'inverter'); b.label(16.8, 3, '100 W'); b.label(22.8, 3, 'fan');
      b.cur(bat, C[0]); b.volt(lamp, C[1]);
      b.doc.simSettings.speed = 0.1;
    },
  },
  {
    id: 'windcharge', cat: 'Renewables', title: 'Wind turbine charging a 48 V battery bank',
    desc: 'A 1.5 kW wind turbine (1.2 m blades, permanent-magnet generator with built-in rectifier) charges a 48 V lead-acid bank (24 cells). The heavy rotor takes several seconds to speed up until the generator EMF exceeds the battery voltage; then the battery loads the generator and the rotor settles where the aerodynamic torque equals the electrical torque. Power rises with the cube of the wind speed: change the wind knob from 5 to 12 m/s and watch the charging current. Below ≈5.5 m/s the EMF never reaches the battery voltage, so nothing flows (cut-in speed); above 25 m/s the turbine brakes itself (cut-out).',
    build(b) {
      const wt = b.v('windgen', 0, 2, { wind: 9 });
      const am = b.h('ammeter', 4, 0, { mode: 'avg', tau: 0.2 });
      const bat = b.v('batpack', 10, 2, { chem: 'leadacid', s: 24, np: 1, cah: 100, cr: 0.002, soc: 50 });
      const vm = b.v('voltmeter', 14, 2);
      b.w(b.pin(wt, 0), b.pin(am, 0)); b.w(b.pin(am, 1), b.pin(bat, 0)); b.w(b.pin(bat, 0), b.pin(vm, 0));
      b.w(b.pin(wt, 1), [0, 5], [14, 5], b.pin(vm, 1)); b.w(b.pin(bat, 1), [10, 5]); b.el('ground', 0, 5);
      b.label(-3, 2, 'wind turbine'); b.label(10, 6.6, '48 V bank');
      b.cur(am, C[0]);
      b.doc.simSettings.speed = 2; b.doc.simSettings.maxStep = 1e-3;
    },
  },
  // ======================================================= communication
  {
    id: 'rs232link', cat: 'Communication', title: 'UART over RS-232 (null-modem, full duplex)',
    desc: 'Two devices talk over a serial cable. Each UART transmitter idles high and sends every character as a start bit, 8 data bits (LSB first) and a stop bit at 9600 baud. The MAX232 transceivers turn the 0/5 V logic into ±9 V RS-232 levels (inverted: logic 1 = −9 V) so the signal survives a long cable, and back again. The cable is crossed (null-modem): TX of one side goes to RX of the other, so both directions work at once. The left terminal receives "OK", the right one "HELLO". Probe the cable to see the ±9 V frames.',
    build(b) {
      const t1 = b.el('uarttx', 0, 0, { text: 'HELLO ' }), x1 = b.el('rs232', 6, 0), x2 = b.el('rs232', 14, 0, {}, 2, true);
      const r1 = b.el('uartrx', 0, 3, {}, 2, true), t2 = b.el('uarttx', 20, 0, { text: 'OK ' }, 2, true), r2 = b.el('uartrx', 20, 3);
      b.w(b.pin(t1, 1), b.pin(x1, 0)); b.w(b.pin(x1, 1), [3, 1], [3, 3], b.pin(r1, 0));
      b.w(b.pin(t2, 1), b.pin(x2, 0)); b.w(b.pin(x2, 1), [17, 1], [17, 3], b.pin(r2, 0));
      b.w(b.pin(x1, 2), [9, 0], [9, 3], [11, 3], [11, 1], b.pin(x2, 3)); b.w(b.pin(x2, 2), [10, 0], [10, 1], b.pin(x1, 3));
      b.label(10, 4.6, 'null-modem cable'); b.label(6, -1.8, 'MAX232'); b.label(14, -1.8, 'MAX232');
      b.node(9, 0, C[0]); b.node(4, 0, C[1]);
      b.doc.simSettings.speed = 0.005; b.doc.simSettings.maxStep = 1e-5;
    },
  },
  {
    id: 'rs485bus', cat: 'Communication', title: 'RS-485 differential bus with termination',
    desc: 'Industrial sensors and PLCs talk over RS-485: one twisted pair, the data carried as the difference A − B (≈ ±2 V on the loaded bus), so common-mode noise picked up along the cable cancels — runs of a kilometre are normal. The left transceiver drives the bus (DE = 1); the right one only listens (DE = 0) and its receiver turns the differential signal back into logic for the UART terminal. Both ends of the bus are terminated with 120 Ω to stop reflections. Switch DE off: the bus idles, the fail-safe receiver reads 1 and the text stops.',
    build(b) {
      const tx = b.el('uarttx', 0, -1, { text: 'TEMP=25.3C ' }), t1 = b.el('rs485', 6, 0), t2 = b.el('rs485', 22, 0, {}, 2, true);
      b.w(b.pin(tx, 1), b.pin(t1, 0));
      b.el('logicin', 2, 3, { on: true }); b.w([3, 3], [3, 0], b.pin(t1, 1));
      b.w(b.pin(t1, 3), [9, 0], [9, -2], [12, -2]); b.w([12, -2], [16, -2]); b.w([16, -2], [19, -2], [19, 0], b.pin(t2, 3));
      b.w(b.pin(t1, 4), [10, 1], [10, 3], [12, 3]); b.w([12, 3], [16, 3]); b.w([16, 3], [18, 3], [18, 1], b.pin(t2, 4));
      const rt1 = b.v('resistor', 12, 0, { r: 120 }), rt2 = b.v('resistor', 16, 0, { r: 120 });
      b.w(b.pin(rt1, 1), [12, 3]); b.w(b.pin(rt2, 1), [16, 3]);
      b.w(b.pin(t2, 0), [25, -1]); b.w(b.pin(t2, 1), [25, 0], [25, -1]); b.el('ground', 25, -1, {}, 2);
      const rx = b.el('uartrx', 28, 1); b.w(b.pin(t2, 2), b.pin(rx, 0));
      b.label(14, 4.6, 'twisted pair A / B'); b.label(0, 4.6, 'DE'); b.label(6, -2.8, 'driver'); b.label(22, -2.8, 'receiver');
      b.node(12, -2, C[0]); b.node(12, 3, C[1]);
      b.doc.simSettings.speed = 0.005; b.doc.simSettings.maxStep = 1e-5;
    },
  },
  {
    id: 'amradio', cat: 'Communication', title: 'AM radio receiver chain',
    desc: 'The signal path of an AM receiver (frequencies scaled down so it runs in real time: a 20 kHz carrier modulated 50 % by a 500 Hz tone, instead of a 531–1602 kHz broadcast station). The tuned RF amplifier selects and amplifies the carrier; the envelope detector (diode + RC, τ = 0.3 ms: much longer than one carrier cycle, much shorter than one audio cycle) recovers the modulation; a 2 kHz low-pass filter removes the remaining carrier ripple and the coupling capacitor blocks the DC so only the 500 Hz tone reaches the speaker. Probe each stage; change the modulation depth or the detector time constant (too long → diagonal clipping).',
    build(b) {
      const src = b.v('amsrc', 0, 2, { amp: 0.1, fc: 20000, fm: 500, m: 0.5 });
      const rf = b.h('rfamp', 4, 0, { gdb: 26, f0: 20000, bw: 4000, vsat: 5 }), det = b.h('envdet', 10, 0, { tau: 3e-4 });
      const lp = b.h('filterblk', 16, 0, { fc: 2000, order: 4 }), cap = b.h('ecap', 22, 0, { c: 100e-6, vmax: 16 }), spk = b.v('speaker', 26, 2);
      b.w(b.pin(src, 0), b.pin(rf, 0)); b.w(b.pin(rf, 1), b.pin(det, 0)); b.w(b.pin(det, 1), b.pin(lp, 0)); b.w(b.pin(lp, 1), b.pin(cap, 0)); b.w(b.pin(cap, 1), b.pin(spk, 0));
      b.w(b.pin(spk, 1), [26, 5], [0, 5], b.pin(src, 1)); b.el('ground', 0, 5);
      b.label(4, 2.2, 'tuned RF amp'); b.label(10, 2.2, 'detector'); b.label(16, 2.6, 'low-pass'); b.label(28.6, 2, 'speaker');
      b.node(6, 0, C[0]); b.node(12, 0, C[1]); b.volt(spk, C[2]);
      b.doc.simSettings.speed = 0.005; b.doc.simSettings.maxStep = 1e-6;
    },
  },
  {
    id: 'wireless433', cat: 'Communication', title: '433 MHz wireless remote (link budget)',
    desc: 'A 433 MHz ASK transmitter/receiver pair as used in remote doorbells and gate openers. Press the button: the transmitter sends while it is held and the receiver output switches the buzzer. The link works only while the received power — transmit power minus the path loss, which grows with 10·n·log(distance) — is above the receiver sensitivity: increase the distance (or choose the urban environment) until the margin goes negative and the remote stops working. Try the other radio presets too (nRF24L01, Bluetooth LE, Wi-Fi, LoRa, Zigbee): compare their ranges and latencies.',
    build(b) {
      b.el('logicin', 0, 0, { momentary: true });
      const rf = b.el('wireless', 5, 0, { d: 20 });
      b.w([1, 0], b.pin(rf, 0));
      const bz = b.v('buzzer', 9, 2); b.w(b.pin(rf, 1), b.pin(bz, 0)); b.el('ground', 9, 4);
      b.el('logicout', 12, 0); b.w(b.pin(bz, 0), [11, 0]);
      b.label(0, 1.6, 'button'); b.label(5, -1.8, 'TX ~~~ RX'); b.label(11.4, 2, 'buzzer');
      b.doc.simSettings.speed = 0.05; b.doc.simSettings.maxStep = 2e-5;
    },
  },
  {
    id: 'i2cexp', cat: 'Communication', title: 'I²C bus: running light on a PCF8574',
    desc: 'I²C needs only two wires for many chips: SCL (clock) and SDA (data), both open-drain with 4.7 kΩ pull-ups, so any device can pull a line low but none ever drives it high. The master sends START, the 7-bit address 0x20 + write, waits for the slave to acknowledge (it pulls SDA low on the 9th clock), sends one data byte and STOP. The PCF8574 copies each byte to its eight port pins — here a pattern with one 0 that walks along, a running light. Probe SCL and SDA to see the clock and the address/data/ACK bits; change the slave address of the master to see NACK.',
    build(b) {
      const m = b.el('i2cmaster', 0, 0), x = b.el('pcf8574', 12, 0);
      b.w(b.pin(m, 0), [4, -1]); b.w([4, -1], [9, -1], [9, 0], b.pin(x, 0));
      b.w(b.pin(m, 1), [7, 1]); b.w([7, 1], b.pin(x, 1));
      const r1 = b.v('resistor', 4, -4, { r: 4700 }), r2 = b.v('resistor', 7, -4, { r: 4700 });
      b.w(b.pin(r1, 1), [4, -1]); b.w(b.pin(r2, 1), [7, 1]);
      b.el('rail', 4, -6, { amp: 5 }); b.el('rail', 7, -6, { amp: 5 });
      for (let k = 0; k < 8; k++) { const [px, py] = b.pin(x, 2 + k); if (k % 2) { b.w([px, py], [px + 2, py]); b.el('logicout', px + 3, py); } else b.el('logicout', px + 1, py); }
      b.label(0, -2.8, 'I²C master'); b.label(12, -5.2, 'PCF8574'); b.label(5.5, -8, '4.7 kΩ pull-ups');
      b.node(2, -1, C[0]); b.node(2, 1, C[1]);
      b.doc.simSettings.speed = 0.02; b.doc.simSettings.maxStep = 2e-6;
    },
  },
  {
    id: 'spi595', cat: 'Communication', title: 'SPI: 74HC595 shift register outputs',
    desc: 'SPI is a fast synchronous bus: the master pulls ¬CS low, puts each bit on MOSI and pulses SCK; the slave samples MOSI on the rising edge. A 74HC595 shifts the eight bits in (SCK → SRCLK, MOSI → SER) and the rising edge of ¬CS at the end (→ RCLK) copies them to the outputs all at once, so the LEDs never flicker while shifting. The master sends 81, 42, 24, 18 (hex) in turn — two lights moving towards the middle. Probe SCK and MOSI; edit the data bytes of the SPI master.',
    build(b) {
      const m = b.el('spimaster', 0, 0), sr = b.el('hc595', 8, 0);
      b.w(b.pin(m, 0), [4, -1], [4, 0], b.pin(sr, 1)); b.w(b.pin(m, 1), [3, 0], [3, -2], [5, -2], [5, -1], b.pin(sr, 0)); b.w(b.pin(m, 2), b.pin(sr, 2));
      b.w(b.pin(sr, 3), [5, 2], [5, 4]); b.el('ground', 5, 4);
      for (let k = 0; k < 8; k++) { const [px, py] = b.pin(sr, 4 + k); if (k % 2) { b.w([px, py], [px + 2, py]); b.el('logicout', px + 3, py); } else b.el('logicout', px + 1, py); }
      b.label(0, -2.8, 'SPI master'); b.label(8, -6.2, '74HC595');
      b.node(2, -1, C[0]); b.node(2, 0, C[1]);
      b.doc.simSettings.speed = 0.02; b.doc.simSettings.maxStep = 5e-6;
    },
  },
  {
    id: 'rfidlock', cat: 'Communication', title: 'RFID door lock (125 kHz reader)',
    desc: 'An RDM6300-style 125 kHz RFID reader: bring the tag closer than 5 cm (select the reader and turn the tag-distance knob down) and its TAG output goes high while the tag ID is sent as 9600-baud UART text — shown on the terminal. TAG drives an NPN transistor that energises the 12 V door-lock solenoid; the diode across the solenoid absorbs the inductive kick when the transistor switches off. Move the tag away and the lock closes again.',
    build(b) {
      const rd = b.el('rfid', 0, 0, { d: 10 }), term = b.el('uartrx', 8, -1);
      b.w(b.pin(rd, 0), b.pin(term, 0));
      const rb = b.h('resistor', 8, 4, { r: 1000 }), q = b.el('npn', 12, 4, { model: '2N2222' });
      b.w(b.pin(rd, 1), [3, 1], [3, 4], b.pin(rb, 0));
      const sol = b.v('solenoid', 13, 0), d = b.vr('diode', 16, 0, { model: '1N4007' }), bat = b.v('dcv', 20, 0, { amp: 12 });
      b.w(b.pin(sol, 0), b.pin(d, 1)); b.w(b.pin(sol, 1), b.pin(d, 0)); b.w(b.pin(d, 1), b.pin(bat, 0));
      b.w(b.pin(bat, 1), [20, 6], b.pin(q, 2)); b.el('ground', 20, 6);
      b.label(0, -2.8, 'RFID reader'); b.label(8, -3.2, 'terminal'); b.label(13, -3.4, 'lock'); b.label(22.6, 0, '12 V');
      b.cur(sol, C[0]);
      b.doc.simSettings.speed = 0.05; b.doc.simSettings.maxStep = 1e-5;
    },
  },
  {
    id: 'fiberlink', cat: 'Communication', title: 'Fibre-optic serial link',
    desc: 'A UART message travels as light through a 20 m plastic optical fibre: an LED transmitter, the fibre and a photodiode receiver with a comparator. It is immune to electrical noise and isolates the two ends. The link budget decides whether it works: received power = −3 dBm − 0.2 dB/m × length − 2 × connector loss. Lengthen the fibre past ≈ 100 m (or switch to multimode glass and back) and see when the received power drops below the −25 dBm sensitivity and the text stops.',
    build(b) {
      const tx = b.el('uarttx', 0, 0, { text: 'LIGHT ' }), f = b.el('fiber', 6, 0), rx = b.el('uartrx', 12, 0);
      b.w(b.pin(tx, 1), b.pin(f, 0)); b.w(b.pin(f, 1), b.pin(rx, 0));
      b.el('logicout', 15, 0);
      b.label(6, -1.8, 'POF 20 m'); b.label(0, -1.8, 'UART TX'); b.label(12, -1.8, 'terminal');
      b.node(4, 0, C[0]); b.node(10, 0, C[1]);
      b.doc.simSettings.speed = 0.005; b.doc.simSettings.maxStep = 1e-5;
    },
  },
  // ======================================================= oscillators & protection
  {
    id: 'wien', cat: 'Op-Amps', title: 'Wien-bridge sine oscillator (1 kHz)',
    desc: 'A classic low-distortion sine oscillator. The RC series-parallel network (10 kΩ, 16 nF) passes exactly one frequency, f = 1/(2πRC) ≈ 1 kHz, with zero phase shift and 1/3 attenuation, back to the non-inverting input; the amplifier needs a gain of exactly 3. For small signals the gain is 1 + 28k/10k = 3.8, so the oscillation grows from a tiny start-up kick; as the amplitude grows, the two diodes start to conduct, shorting part of the feedback resistance and pulling the gain down towards 3 — the amplitude settles. (This circuit starts from zero rather than the DC operating point, so it can start up.)',
    build(b) {
      const op = b.el('opamp', 10, 0, { model: 'TL071' });
      b.w(b.pin(op, 0), [5, -1], [5, 0]); b.w([7, -1], [7, -4]);
      const rf1 = b.h('resistor', 9, -4, { r: 18000 }), rf2 = b.h('resistor', 15, -4, { r: 10000 });
      const d1 = b.h('diode', 15, -6), d2 = b.el('diode', 15, -8, {}, 2);
      b.w(b.pin(rf1, 1), b.pin(rf2, 0)); b.w([13, -4], [13, -6]); b.w([13, -6], [13, -8]); b.w([17, -4], [17, -6]); b.w([17, -6], [17, -8]);
      b.w(b.pin(rf2, 1), [22, -4], [22, 0]); b.w(b.pin(op, 2), [22, 0]);
      const rg = b.v('resistor', 5, 2, { r: 10000 });
      b.w(b.pin(rg, 1), [5, 8], [8, 8]); b.el('ground', 8, 8);
      b.w(b.pin(op, 1), [8, 3]);
      const rs = b.h('resistor', 14, 3, { r: 10000 }), cs = b.h('capacitor', 20, 3, { c: 16e-9, ic: 0.05 });
      b.w([8, 3], b.pin(rs, 0)); b.w(b.pin(rs, 1), b.pin(cs, 0)); b.w(b.pin(cs, 1), [22, 3], [22, 0]);
      const rp = b.v('resistor', 8, 6, { r: 10000 }), cp = b.v('capacitor', 11, 6, { c: 16e-9 });
      b.w([8, 3], b.pin(rp, 0)); b.w(b.pin(rp, 0), b.pin(cp, 0)); b.w(b.pin(rp, 1), b.pin(cp, 1));
      b.label(3, 2, 'Rg 10k'); b.label(15, -9.6, 'amplitude control'); b.label(17, 4.6, 'series RC'); b.label(13.6, 6, 'parallel RC');
      b.node(22, 0, C[0]); b.node(8, 3, C[1]);
      b.doc.simSettings.speed = 0.002; b.doc.simSettings.maxStep = 5e-6; b.doc.simSettings.initialDC = false;
    },
  },
  {
    id: 'faultdemo', cat: 'Power Systems', title: 'Short-circuit fault & MCB tripping',
    desc: 'Why every circuit has a breaker. A 2 kW heater is fed through a C16 MCB and 30 m of 2.5 mm² cable (≈ 0.43 Ω there and back). At t = 0.2 s the fault element applies a short circuit at the far end: the current shoots up towards the prospective fault current — limited only by the supply and cable impedance, ≈ 230 V / 0.63 Ω ≈ 365 A — but as soon as it passes the MCB\'s magnetic trip level (5–10 × In = 80–160 A for a C curve) the breaker opens, within a few milliseconds. Watch the current trace. Try a longer or thinner cable (higher loop impedance, lower fault current) or a D-curve breaker: if the fault current falls below the magnetic threshold, only the slow thermal trip acts — a dangerous situation the electrician must design out.',
    build(b) {
      const ac = b.v('mains', 0, 2);
      const cb = b.h('mcb', 4, 0, { in: 16, curve: 'C' }), am = b.h('acamp', 10, 0, { mode: 'inst' });
      const cab = b.el('cable', 16, 1, { len: 30, size: '2.5' });
      b.w(b.pin(ac, 0), b.pin(cb, 0)); b.w(b.pin(cb, 1), b.pin(am, 0)); b.w(b.pin(am, 1), b.pin(cab, 0));
      b.w(b.pin(ac, 1), [0, 4], [12, 4], [12, 2], b.pin(cab, 1));
      const heater = b.v('rload', 22, 2, { p: 2000 }), f = b.v('faultsw', 27, 2, { tf: 0.2 });
      b.w(b.pin(cab, 2), b.pin(heater, 0)); b.w(b.pin(heater, 0), b.pin(f, 0));
      b.w(b.pin(cab, 3), [20, 2], [20, 4], b.pin(heater, 1)); b.w(b.pin(heater, 1), b.pin(f, 1));
      b.label(-2.6, 2, '230 V'); b.label(16, -1.2, '30 m 2.5 mm²'); b.label(24.6, 2, '2 kW'); b.label(29.8, 2, 'fault');
      b.cur(am, C[0]);
      b.doc.simSettings.speed = 0.05;
    },
  },
];

// pins legitimately left unconnected
export const ALLOW_OPEN2 = { conveyor: 1, phasefail: 1, sineinv: 1, rs232link: 4, rs485bus: 3, spi595: 1, rfidlock: 1, fiberlink: 1 };
