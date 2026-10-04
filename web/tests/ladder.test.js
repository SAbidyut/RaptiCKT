// Industrial control examples drawn as ladder diagrams: coils and their detached
// contacts (linked by tag) must behave like the real starters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES, buildExample } from '../src/ui/examples.js';
import { Simulator } from '../src/engine/sim.js';

function open(id) {
  const doc = buildExample(EXAMPLES.find((e) => e.id === id));
  const sim = new Simulator().build(doc.elements, doc.wires);
  assert.ok(sim.start(), sim.error);
  const of = (type) => doc.elements.filter((e) => e.constructor.type === type);
  const run = (T, dt = 1e-4) => { const t1 = sim.t + T; while (sim.t < t1 - dt * 1e-6) assert.ok(sim.step(dt), sim.error); };
  const press = (btn) => { btn.onPress(); sim.dirty = true; run(0.1); btn.onRelease(); sim.dirty = true; };
  const coil = (tag) => doc.elements.find((e) => e.linkTag && e.linkTag() === tag && e.constructor.type.endsWith('coil') || (e.constructor.type === 'ltimer' && e.p.tag === tag));
  const rpm = (m) => parseFloat(m.valueLabel().replace(/,/g, ''));
  return { doc, sim, of, run, press, coil, rpm };
}

test('the industrial control examples use no net labels', () => {
  for (const id of ['fwdrev', 'waterpump', 'phasefail', 'stardelta']) {
    const doc = buildExample(EXAMPLES.find((e) => e.id === id));
    assert.equal(doc.elements.filter((e) => e.constructor.type === 'netlabel').length, 0, id);
  }
});

test('every ladder contact finds the coil or relay it follows', () => {
  for (const id of ['fwdrev', 'waterpump', 'phasefail', 'stardelta']) {
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
