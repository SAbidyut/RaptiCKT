// Industrial control examples drawn as ladder diagrams: coils and their detached
// contacts (linked by tag) must behave like the real starters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES, buildExample } from '../src/ui/examples.js';
import { EXAMPLES3 } from '../src/ui/examples3.js';
import { Simulator } from '../src/engine/sim.js';

function open(id) {
  const doc = buildExample(EXAMPLES.find((e) => e.id === id));
  const sim = new Simulator().build(doc.elements, doc.wires);
  assert.ok(sim.start(), sim.error);
  const of = (type) => doc.elements.filter((e) => e.constructor.type === type);
  const run = (T, dt = 1e-4) => { const t1 = sim.t + T; while (sim.t < t1 - dt * 1e-6) assert.ok(sim.step(dt), sim.error); };
  const press = (btn) => { btn.onPress(); sim.dirty = true; run(0.1); btn.onRelease(); sim.dirty = true; };
  const coil = (tag) => doc.elements.find((e) => e.linkTag && e.linkTag() === tag);
  const on = (tag) => coil(tag).operated();
  const btn = (label) => {
    // the push button / switch sitting under a text label
    const l = doc.elements.find((e) => e.constructor.type === 'label' && e.p.text === label);
    assert.ok(l, 'no label ' + label);
    const parts = doc.elements.filter((e) => ['pushno', 'pushnc', 'switch', 'estop', 'selector3', 'pressw', 'thermostat', 'floatsw'].includes(e.constructor.type));
    return parts.reduce((a, e) => (Math.hypot(e.x - l.x, e.y - l.y) < Math.hypot(a.x - l.x, a.y - l.y) ? e : a));
  };
  const tap = (e) => { e.onTap(); sim.dirty = true; };
  const rpm = (m) => parseFloat(m.valueLabel().replace(/,/g, ''));
  return { doc, sim, of, run, press, coil, rpm, on, btn, tap };
}

test('the industrial control examples use no net labels', () => {
  for (const id of ['fwdrev', 'waterpump', 'phasefail', 'stardelta', ...EXAMPLES3.map((e) => e.id)]) {
    const doc = buildExample(EXAMPLES.find((e) => e.id === id));
    assert.equal(doc.elements.filter((e) => e.constructor.type === 'netlabel').length, 0, id);
  }
});

test('every ladder contact finds the coil or relay it follows', () => {
  for (const id of ['fwdrev', 'waterpump', 'phasefail', 'stardelta', ...EXAMPLES3.map((e) => e.id)]) {
    const { of } = open(id);
    for (const t of ['lno', 'lnc', 'lmain3']) for (const c of of(t)) assert.ok(c.master, `${id}: ${t} tagged ${c.p.tag} follows nothing`);
  }
});

test('forward / reverse: hold-in, interlock, stop, reverse', () => {
  const { of, run, press, coil, rpm } = open('fwdrev');
  const [fwd, rev] = of('pushno'), [stop] = of('pushnc'), [mot] = of('im3');
  const KF = coil('KF'), KR = coil('KR');
  run(0.2);
  assert.ok(!KF.contactsClosed() && !KR.contactsClosed(), 'both off at rest');
  press(fwd); run(2);
  assert.ok(KF.contactsClosed(), 'KF holds in after FWD is released');
  assert.ok(rpm(mot) > 1300, 'runs forward: ' + mot.valueLabel());
  press(rev); run(0.3);
  assert.ok(KF.contactsClosed() && !KR.contactsClosed(), 'REV is locked out while KF is on');
  press(stop); run(1.5);
  assert.ok(!KF.contactsClosed(), 'STOP drops KF');
  press(rev); run(3);
  assert.ok(KR.contactsClosed() && rpm(mot) < -1300, 'runs in reverse: ' + mot.valueLabel());
});

test('water pump: the float switch starts and stops the pump', () => {
  const { of, sim, run, coil, rpm } = open('waterpump');
  const [fl] = of('floatsw'), [mot] = of('im3'), K = coil('K');
  run(0.3);
  assert.ok(!K.contactsClosed(), 'tank full: pump off');
  fl.p.level = 10; sim.dirty = true; run(2);
  assert.ok(K.contactsClosed() && rpm(mot) > 1000, 'tank low: pump runs ' + mot.valueLabel());
  fl.p.level = 50; sim.dirty = true; run(0.5);
  assert.ok(K.contactsClosed(), 'keeps filling between the switching levels');
  fl.p.level = 90; sim.dirty = true; run(0.5);
  assert.ok(!K.contactsClosed(), 'tank full again: pump stops');
});

test('phase failure: a blown fuse drops the contactor through the phase monitor', () => {
  const { of, sim, run, press, coil } = open('phasefail');
  const [start] = of('pushno'), [fuse] = of('switch'), [kp] = of('lphase'), K = coil('K');
  run(0.4);
  assert.ok(kp.operated(), 'phases healthy');
  press(start); run(1);
  assert.ok(K.contactsClosed(), 'K holds in after START');
  fuse.p.closed = false; sim.dirty = true; run(1);
  assert.ok(!kp.operated(), 'monitor released on phase loss');
  assert.ok(!K.contactsClosed(), 'K dropped out');
  fuse.p.closed = true; sim.dirty = true; run(0.6);
  assert.ok(!K.contactsClosed(), 'does not restart by itself');
});

test('star-delta: star first, delta after the timer, never both, STOP drops all', () => {
  const { of, run, press, coil, rpm } = open('stardelta');
  const [start] = of('pushno'), [stop] = of('pushnc'), [mot] = of('im3d');
  const KM = coil('KM'), KY = coil('KY'), KD = coil('KΔ');
  run(0.2);
  press(start); run(0.5);
  assert.ok(KM.contactsClosed() && KY.contactsClosed() && !KD.contactsClosed(), 'starts in star');
  let both = false;
  for (let k = 0; k < 30; k++) { run(0.1); if (KY.contactsClosed() && KD.contactsClosed()) both = true; }
  assert.ok(!both, 'KY and KΔ never closed together');
  assert.ok(KM.contactsClosed() && !KY.contactsClosed() && KD.contactsClosed(), 'runs in delta after the timer');
  assert.ok(rpm(mot) > 1300, 'motor at speed ' + mot.valueLabel());
  press(stop); run(0.5);
  assert.ok(!KM.contactsClosed() && !KY.contactsClosed() && !KD.contactsClosed(), 'STOP drops everything');
});

// ------------------------------------------------------------ industrial control course
test('push button control: runs only while START is held', () => {
  const { run, sim, on, btn } = open('pbctrl');
  run(0.2); const s = btn('START');
  s.onPress(); sim.dirty = true; run(0.3); assert.ok(on('KM'), 'held: on');
  s.onRelease(); sim.dirty = true; run(0.3); assert.ok(!on('KM'), 'released: off');
});

for (const id of ['selfhold', 'torckt', 'estopckt', 'mpcbckt', 'protectall', 'multistop', 'multistart', 'multiboth']) {
  test(`${id}: START latches, STOP drops`, () => {
    const { run, press, on, btn, doc } = open(id);
    run(0.4);
    const start = btn(doc.elements.some((e) => e.p?.text === 'START') ? 'START' : 'START 1');
    press(start); run(0.5); assert.ok(on('KM'), 'latched after START');
    press(btn(doc.elements.some((e) => e.p?.text === 'STOP') ? 'STOP' : 'STOP 1')); run(0.3); assert.ok(!on('KM'), 'STOP drops');
  });
}

test('second station START and STOP work too', () => {
  for (const id of ['multistart', 'multiboth']) { const { run, press, on, btn } = open(id); run(0.3); press(btn('START 2')); run(0.4); assert.ok(on('KM'), id); }
  for (const id of ['multistop']) { const { run, press, on, btn } = open(id); run(0.3); press(btn('START')); run(0.4); press(btn('STOP 3')); run(0.3); assert.ok(!on('KM'), id); }
});

test('overload trip, MPCB off and E-stop all stop the motor', () => {
  { const { run, press, on, btn, of, tap } = open('torckt'); run(0.2); press(btn('START')); run(0.5); tap(of('lolr')[0]); run(0.3); assert.ok(!on('KM'), 'F1 trip'); }
  { const { run, press, on, btn, of, tap } = open('mpcbckt'); run(0.2); press(btn('START')); run(0.5); tap(of('lmpcb')[0]); run(0.3); assert.ok(!on('KM'), 'Q1 off'); }
  { const { run, press, on, btn, tap } = open('estopckt'); run(0.2); press(btn('START')); run(0.5); tap(btn('E-STOP')); run(0.3); assert.ok(!on('KM'), 'E-stop');
    tap(btn('E-STOP')); run(0.3); assert.ok(!on('KM'), 'no restart after release'); }
});

test('complete protection and panel: phase fault stops the motor', () => {
  for (const id of ['protectall', 'panel']) {
    const { run, press, on, btn, of, sim, tap } = open(id);
    run(0.4);
    if (id === 'panel') { btn('H-O-A').p.pos = 1; sim.dirty = true; } // HAND
    press(btn('START')); run(0.6); assert.ok(on('KM'), id + ' runs');
    of('ac3y')[0].p.seq = 'RBY'; sim.dirty = true; run(1);
    assert.ok(!on('KM'), id + ' stopped on wrong phase sequence');
  }
});

test('HAND-OFF-AUTO selector', () => {
  const { run, on, btn, tap, sim, of } = open('hoa');
  const sel = btn('HAND-OFF-AUTO');
  run(0.3); assert.ok(!on('KM'), 'OFF');
  sel.p.pos = 1; sim.dirty = true; run(0.4); assert.ok(on('KM'), 'HAND runs');
  sel.p.pos = 3; sim.dirty = true; run(0.4); assert.ok(!on('KM'), 'AUTO, tank full: off');
  of('floatsw')[0].p.level = 10; sim.dirty = true; run(0.4); assert.ok(on('KM'), 'AUTO, tank low: runs');
  void tap;
});

test('relay logic: AND, OR, NOT', () => {
  const { run, sim, btn, of } = open('relaylogic');
  const lamps = Object.fromEntries(['A AND B', 'A OR B', 'NOT A'].map((t) => [t, btn(t)]));
  void lamps;
  const lit = (text) => { const l = of('label').find((e) => e.p.text === text); const lp = of('lamp').reduce((a, e) => (Math.hypot(e.x - l.x, e.y - l.y) < Math.hypot(a.x - l.x, a.y - l.y) ? e : a)); return Math.abs(lp.i || 0) > 0.05; };
  const set = (a, bb) => { const A = btn('A'), B = btn('B'); A.pressed = a; B.pressed = bb; sim.dirty = true; run(0.05, 1e-4); };
  set(false, false); assert.deepEqual([lit('A AND B'), lit('A OR B'), lit('NOT A')], [false, false, true]);
  set(true, false); assert.deepEqual([lit('A AND B'), lit('A OR B'), lit('NOT A')], [false, true, false]);
  set(true, true); assert.deepEqual([lit('A AND B'), lit('A OR B'), lit('NOT A')], [true, true, false]);
  set(false, true); assert.deepEqual([lit('A AND B'), lit('A OR B'), lit('NOT A')], [false, true, true]);
});

test('interposing relay starts the 230 V contactor from 24 V buttons', () => {
  const { run, press, on, btn } = open('relaymotor');
  run(0.2); press(btn('START')); run(0.5); assert.ok(on('KA') && on('KM'));
  press(btn('STOP')); run(0.3); assert.ok(!on('KA') && !on('KM'));
});

test('phase sequence protection blocks a reversed supply', () => {
  const { run, press, on, btn, of, sim } = open('phaseseq');
  run(0.4); press(btn('START')); run(0.6); assert.ok(on('K'));
  of('ac3y')[0].p.seq = 'RBY'; sim.dirty = true; run(1); assert.ok(!on('K'));
  press(btn('START')); run(0.5); assert.ok(!on('K'), 'cannot start with the wrong sequence');
});

test('floatless level relay keeps the tank between its probes', () => {
  const { run, of, on } = open('floatless');
  const tank = of('ltank')[0];
  let lo = 100, hi = 0, starts = 0, was = false;
  for (let k = 0; k < 120; k++) { run(0.1); const lv = tank.level(); if (k > 20) { lo = Math.min(lo, lv); hi = Math.max(hi, lv); } if (on('KM') && !was) starts++; was = on('KM'); }
  assert.ok(starts >= 2, 'pump cycles: ' + starts);
  assert.ok(lo > 15 && hi < 97 && hi > 80, `level stays between the probes: ${lo.toFixed(0)}–${hi.toFixed(0)} %`);
});

test('tank automation: dry sump stops the pump', () => {
  const { run, of, on } = open('tankauto');
  const sump = of('ltank').find((t) => t.p.tag === 'SUMP');
  let stoppedDry = false;
  for (let k = 0; k < 120; k++) { run(0.1); if (sump.level() < 12 && !on('KM')) stoppedDry = true; }
  assert.ok(stoppedDry, 'pump stops when the sump is dry');
});

test('ON-delay, OFF-delay and twin timers', () => {
  { const { run, press, on, btn } = open('ondelay'); run(0.2); press(btn('START')); run(1.5); assert.ok(!on('KM'), 'not yet'); run(2); assert.ok(on('KM'), 'after 3 s'); }
  { const { run, on, btn, tap } = open('offdelay'); run(0.2); const sw = btn('FAN SWITCH'); tap(sw); run(0.5); assert.ok(on('KM'), 'on at once'); tap(sw); run(2); assert.ok(on('KM'), 'still running'); run(4); assert.ok(!on('KM'), 'off after 5 s'); }
  { const { run, on, btn, tap } = open('twintimer'); run(0.2); tap(btn('ON / OFF')); const seq = []; for (let k = 0; k < 24; k++) { run(0.5); seq.push(on('KM') ? 1 : 0); }
    const changes = seq.slice(1).filter((v, i) => v !== seq[i]).length; assert.ok(changes >= 4, 'cycles on and off: ' + seq.join('')); }
});

test('sequential start: M2 follows M1 after the timer', () => {
  const { run, press, on, btn } = open('seqmotor');
  run(0.2); press(btn('START')); run(1); assert.ok(on('KM1') && !on('KM2'));
  run(3); assert.ok(on('KM2'));
  press(btn('STOP')); run(0.3); assert.ok(!on('KM1') && !on('KM2'));
});

test('interlocked pumps never run together', () => {
  const { run, press, on, btn } = open('interlock');
  run(0.2); press(btn('START 1')); run(0.4); press(btn('START 2')); run(0.4);
  assert.ok(on('KM1') && !on('KM2'));
  press(btn('STOP 1')); run(0.3); press(btn('START 2')); run(0.4); assert.ok(!on('KM1') && on('KM2'));
});

test('jog: JOG runs only while held, RUN latches', () => {
  { const { run, sim, on, btn, press } = open('jogpb'); run(0.2); const j = btn('JOG'); j.onPress(); sim.dirty = true; run(0.4); assert.ok(on('KM')); j.onRelease(); sim.dirty = true; run(0.3); assert.ok(!on('KM'));
    press(btn('RUN')); run(0.4); assert.ok(on('KM'), 'RUN latches'); }
  { const { run, press, on, btn, tap } = open('jogsel'); run(0.2); press(btn('START')); run(0.4); assert.ok(on('KM'), 'RUN position latches');
    press(btn('STOP')); run(0.3); tap(btn('RUN (closed) / JOG (open)')); press(btn('START')); run(0.4); assert.ok(!on('KM'), 'JOG position does not latch'); }
});

test('ATS: transfers to the generator on mains failure and back', () => {
  const { run, of, on, sim } = open('ats');
  run(0.5); assert.ok(on('KM') && !on('KG'), 'on mains');
  const mcb = of('mcb3p').find((e) => e.x < 15 * 20);
  mcb.p.on = false; sim.dirty = true; run(1); assert.ok(!on('KM') && !on('KG'), 'mains lost, waiting for KT');
  run(3); assert.ok(on('KG') && !on('KM'), 'on generator');
  mcb.p.on = true; sim.dirty = true; run(1.5); assert.ok(on('KM') && !on('KG'), 'back on mains');
});

test('limit switches stop the carriage at both ends', () => {
  const { run, press, on, btn, of } = open('lsmotor');
  const cart = of('lcart')[0];
  run(0.2); press(btn('FWD')); run(4.5); assert.ok(cart.pos() >= 99.9 && !on('KF'), 'stopped at the far end ' + cart.pos());
  press(btn('REV')); run(7); assert.ok(cart.pos() <= 0.1 && !on('KR'), 'stopped at home ' + cart.pos());
});

test('automatic forward-reverse shuttles until STOP; stroke counter stops a batch', () => {
  { const { run, press, btn, of } = open('autofr'); const cart = of('lcart')[0]; run(0.2); press(btn('START'));
    let ends = 0, homes = 0, was = 'h'; for (let k = 0; k < 260; k++) { run(0.1); const x = cart.pos(); if (x > 95 && was !== 'e') { ends++; was = 'e'; } if (x < 5 && was !== 'h') { homes++; was = 'h'; } }
    assert.ok(ends >= 3 && homes >= 2, `shuttles: ${ends} ends, ${homes} homes`); }
  { const { run, press, btn, of, on } = open('lscounter'); run(0.2); press(btn('START')); run(40);
    assert.equal(of('lcounter')[0].count, 5, 'counted 5 strokes'); assert.ok(!on('KA'), 'batch stopped');
    press(btn('RESET')); run(0.3); assert.equal(of('lcounter')[0].count, 0, 'reset'); }
});

test('automatic machine: 5 cylinder cycles then stop', () => {
  const { run, press, btn, of, on } = open('automachine');
  run(0.1); press(btn('START')); run(32);
  assert.equal(of('lcounter')[0].count, 5); assert.ok(!on('KA'), 'machine stopped after the batch');
  assert.ok(of('lcart')[0].pos() < 1, 'cylinder back home');
});

test('electro-pneumatic: one stroke per START', () => {
  const { run, press, btn, of, on } = open('pneumatic');
  const cyl = of('lcart')[0];
  run(0.1); press(btn('START')); run(1.5); assert.ok(on('Y1') && cyl.pos() > 30, 'extending');
  run(2); assert.ok(!on('Y1'), 'LS2 dropped the valve'); run(3); assert.ok(cyl.pos() < 1, 'sprung back');
});

test('SSR and sensor switch their 230 V loads', () => {
  const peak = (run, e) => { let m = 0; for (let k = 0; k < 40; k++) { run(0.0005); m = Math.max(m, Math.abs(e.i || 0)); } return m; };
  { const { run, of, tap } = open('ssrload'); run(0.1); const h = of('heater')[0]; assert.ok(peak(run, h) < 0.05, 'heater off');
    tap(of('switch')[0]); run(0.1); assert.ok(peak(run, h) > 3, 'heater on'); }
  { const { run, of, sim } = open('sensorssr'); run(0.1); const lamp = of('lamp')[0]; assert.ok(peak(run, lamp) < 0.05, 'lamp off');
    of('photoeye')[0].p.d = 100; sim.dirty = true; run(0.1); assert.ok(peak(run, lamp) > 0.2, 'lamp on'); }
});

test('production counter stops the conveyor after the preset', () => {
  const { run, press, btn, of, on, sim } = open('prodcounter');
  run(0.2); press(btn('START')); run(0.5); assert.ok(on('KM'));
  const pe = of('photoeye')[0];
  for (let k = 0; k < 5; k++) { pe.p.d = 100; sim.dirty = true; run(0.2); pe.p.d = 1000; sim.dirty = true; run(0.2); }
  assert.equal(of('lcounter')[0].count, 5); assert.ok(!on('KM'), 'conveyor stopped');
  press(btn('RESET')); run(0.2); assert.equal(of('lcounter')[0].count, 0);
});

test('temperature and pressure control', () => {
  { const { run, on, btn, sim } = open('tempctrl'); run(0.1); assert.ok(on('KH') && !on('KB'), 'cold: heating');
    const th1 = btn('TH1 HEAT 60°C'), th2 = btn('TH2 COOL 80°C'); th1.p.temp = 70; th2.p.temp = 90; sim.dirty = true; run(0.2); assert.ok(!on('KH') && on('KB'), 'hot: blower'); }
  { const { run, on, btn, press, sim } = open('pressctrl'); run(0.2); press(btn('START')); run(0.4); assert.ok(on('KM'), 'low pressure: runs');
    btn('PRESSURE SW').p.pres = 8.5; sim.dirty = true; run(0.3); assert.ok(!on('KM'), 'cut-out');
    btn('PRESSURE SW').p.pres = 7; sim.dirty = true; run(0.3); assert.ok(!on('KM'), 'stays off in the band');
    btn('PRESSURE SW').p.pres = 5; sim.dirty = true; run(0.3); assert.ok(on('KM'), 'cut-in'); }
});
