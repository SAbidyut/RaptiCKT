// Real-life limits: parts burn out and stay burnt until replaced, breakers trip on the
// real-time clock and can be destroyed, cables follow IEC data and burn when overloaded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getType, Element } from '../src/elements/index.js';
import { Simulator } from '../src/engine/sim.js';
import { cableInfo, CableHeat } from '../src/elements/cables.js';
import { CircuitDoc } from '../src/ui/doc.js';
import { WireGraph } from '../src/ui/render.js';
import { WireHeat } from '../src/ui/wireheat.js';

function net() {
  const els = [];
  const el = (type, nodes, p = {}) => {
    const e = new (getType(type))(0, 0);
    Object.assign(e.p, p);
    e.nodes = nodes; e.name = type + els.length;
    e.onParamChange?.();
    els.push(e);
    return e;
  };
  /** run for T seconds of circuit time; scale = heat clock (25 ≈ mains shown at 40 ms/s) */
  const run = (T, dt, { scale = 1, damage = true, each } = {}) => {
    const sim = new Simulator().buildNet(els);
    sim.heatScale = scale; sim.damageOn = damage; sim.acPeriod = 0.02;
    assert.ok(sim.start() || !sim.fatal, sim.error);
    while (sim.t < T - dt * 1e-6) { assert.ok(sim.step(dt), sim.error); each?.(sim); }
    return sim;
  };
  return { el, run };
}

test('a 230 V bulb on 400 V burns out, stays burnt after a restart, and works again once replaced', () => {
  const { el, run } = net();
  el('mains', [1, 0], { vrms: 400 });
  const b = el('bulb', [1, 0]);
  let sim = run(0.2, 5e-5);
  assert.ok(b.damaged && /over-voltage/.test(b.damaged.why), 'burnt');
  assert.equal(b.i, 0, 'open circuit');
  assert.ok(sim.damageLog.includes(b), 'reported to the UI');
  sim = run(0.05, 5e-5);
  assert.ok(b.damaged, 'still burnt after restarting the simulation');
  b.replace(sim);
  assert.equal(b.damaged, null);
});

test('a bulb at its rated voltage never burns', () => {
  const { el, run } = net();
  el('mains', [1, 0]);
  const b = el('bulb', [1, 0]);
  run(0.5, 5e-5, { scale: 25 });
  assert.equal(b.damaged, null);
});

test('an LED straight across an ideal 9 V source burns instead of breaking the solver', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 9 });
  const led = el('led', [1, 0]);
  run(0.01, 1e-5);
  assert.ok(led.damaged && /LED/.test(led.damaged.why));
});

test('an LED with the right series resistor is fine, with too small a one it burns', () => {
  for (const [r, burns] of [[150, false], [30, true]]) {
    const { el, run } = net();
    el('dcv', [1, 0], { amp: 5 });
    el('resistor', [1, 2], { r });
    const led = el('led', [2, 0]);
    run(0.5, 1e-4, { scale: 25 });
    assert.equal(!!led.damaged, burns, `${r} Ω`);
  }
});

test('resistor power rating: 1.44 W in a 1/4 W resistor burns it open, 0.25 W does not', () => {
  for (const [v, burns] of [[12, true], [5, false]]) {
    const { el, run } = net();
    el('dcv', [1, 0], { amp: v });
    const r = el('resistor', [1, 0], { r: 100, pw: '0.25' });
    run(0.5, 1e-4, { scale: 25 });
    assert.equal(!!r.damaged, burns, `${v} V`);
  }
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 100 });
  const ideal = el('resistor', [1, 0], { r: 1 });
  run(0.2, 1e-4, { scale: 25 });
  assert.equal(ideal.damaged, null, 'an ideal resistor has no limit');
});

test('electrolytic capacitor bursts when over-voltaged or reversed; tantalum fails short', () => {
  for (const [type, nodes, v] of [['ecap', [2, 0], 50], ['ecap', [0, 2], 5], ['tantalum', [2, 0], 40]]) {
    const { el, run } = net();
    el('dcv', [1, 0], { amp: v });
    el('resistor', [1, 2], { r: 10 });
    const c = el(type, nodes);
    const sim = run(0.3, 1e-4, { scale: 25 });
    assert.ok(c.damaged, `${type} at ${v} V`);
    if (type === 'tantalum') assert.ok(Math.abs(sim.v(2)) < 1, 'shorted');
  }
});

test('MCB thermal trip at 2.5 × In takes real seconds on the heat clock (IEC 1–60 s)', () => {
  const { el, run } = net();
  el('mains', [1, 0]);
  const q = el('mcb', [1, 2], { in: 10 });
  el('heater', [2, 0], { w: 25 * 230 });
  let tTrip = null;
  run(3, 1e-4, { scale: 25, each: (s) => { if (q.tripped && tTrip === null) tTrip = s.t; } });
  assert.ok(tTrip !== null, 'tripped');
  const wall = tTrip * 25;
  assert.ok(wall > 1 && wall < 60 && /thermal/.test(q.cause), `real-time trip at ${wall} s`);
});

test('a fault above its breaking capacity destroys the MCB; a normal short only trips it', () => {
  for (const [zs, destroyed] of [[0.2, false], [0, true]]) {
    const { el, run } = net();
    el('mains', [1, 0], { zs });
    const q = el('mcb', [1, 2], { in: 16 });
    el('resistor', [2, 0], { r: 0.001 });
    run(0.05, 2e-5);
    assert.ok(q.tripped, 'opened');
    assert.equal(!!q.damaged, destroyed, `Zs = ${zs}`);
    assert.equal(q.onTap(), !destroyed, 'a destroyed breaker cannot be switched back on');
  }
});

test('an RCCB overloaded for long burns (it has no overcurrent release)', () => {
  const { el, run } = net();
  el('mains', [1, 2]);
  const rc = el('rccb', [1, 2, 3, 4]);
  el('heater', [3, 4], { w: 80 * 230 });
  run(4, 1e-4, { scale: 25 });
  assert.ok(rc.damaged && /RCCB/.test(rc.damaged.why));
});

test('a blown fuse stays blown after a restart and in the saved file', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 10 });
  const f = el('fuse', [1, 2], { rating: 1 });
  el('resistor', [2, 0], { r: 1 });
  run(0.1, 1e-4);
  assert.ok(f.blown);
  run(0.01, 1e-4);
  assert.ok(f.blown, 'still blown');
  const copy = Element.fromJSON(JSON.parse(JSON.stringify(f.toJSON())));
  assert.ok(copy.blown, 'saved and loaded blown');
  copy.replace();
  assert.ok(!copy.blown);
});

test('with damage switched off nothing burns, but a fuse still blows', () => {
  const { el, run } = net();
  el('mains', [1, 0], { vrms: 400 });
  const b = el('bulb', [1, 0]);
  el('dcv', [2, 0], { amp: 10 });
  const f = el('fuse', [2, 3], { rating: 1 });
  el('resistor', [3, 0], { r: 1 });
  run(0.2, 5e-5, { damage: false });
  assert.equal(b.damaged, null);
  assert.ok(f.blown);
});

test('cable data follow IEC 60228 / 60364-5-52', () => {
  const cu = (size, inst, type = 'housewire', shape) => cableInfo({ type, size, inst, shape });
  assert.equal(cu(1.5, 'C').iz, 19.5);
  assert.equal(cu(2.5, 'C').iz, 27);
  assert.ok(Math.abs(cu(1.5, 'B1').iz - 17.5) <= 0.5, 'B1 1.5 mm²');
  assert.ok(Math.abs(cu(2.5, 'B1').iz - 24) <= 0.5, 'B1 2.5 mm²');
  assert.ok(Math.abs(cu(2.5, 'C', 'n2xy').iz - 33) <= 2, 'XLPE 2.5 mm²');
  assert.ok(Math.abs(cu(95, 'C', 'na2xy').iz - 0.78 * 1.27 * 258) <= 1, 'Al XLPE');
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a}`);
  near(cu(1.5, 'C').r20, 12.1e-3, 'class 1/2 copper');
  near(cu(1.5, 'C', 'flex', 'RF').r20, 13.3e-3, 'class 5 flexible');
  near(cableInfo({ type: 'nayy', size: 95 }).r20, 0.320e-3, 'aluminium');
  assert.equal(cableInfo({ type: 'flex', size: 1.5, shape: 'RE' }).spec.shape, 'RF', 'a flexible cord is always RF');
});

test('cable heat model: settles at 70 °C at Iz and meets the adiabatic k = 115 limit', () => {
  const h = new CableHeat({ type: 'housewire', size: 2.5, shape: 'RE', inst: 'C' });
  const s = { mode: 'tran', dt: 0.05, acPeriod: 0, heatDt() { return this.dt; }, heatDtAt() { return this.dt; } };
  for (let k = 0; k < 40000; k++) h.step(27, s);
  assert.ok(Math.abs(h.T - 70) < 1, 'steady state ' + h.T);
  // adiabatic: 70 → 160 °C at I²t = k²S² (k = 115 for Cu/PVC)
  const h2 = new CableHeat({ type: 'housewire', size: 2.5, shape: 'RE', inst: 'C' });
  h2.T = 70;
  const I = 1000, s2 = { ...s, dt: 1e-5 };
  let t = 0;
  while (h2.T < 160) { h2.step(I, s2); t += s2.dt; }
  const k = Math.sqrt(I * I * t) / 2.5;
  assert.ok(k > 100 && k < 130, 'k = ' + k);
});

test('cable component: real voltage drop, overload burns it, a breaker in front protects it', () => {
  let { el, run } = net();
  el('dcv', [1, 0], { amp: 230 });
  const c = el('cable1', [1, 2], { len: 10, size: '2.5' });
  el('resistor', [2, 0], { r: 11.5 });
  let sim = run(0.01, 1e-4);
  const drop = sim.v(1) - sim.v(2), I = sim.v(2) / 11.5;
  // 2.5 mm² Cu: 7.41 Ω/km at 20 °C, the cable starts at the 30 °C ambient
  assert.ok(Math.abs(drop - I * 0.0741 * (1 + 0.00393 * 10)) < 0.01, 'ΔV = I·ρL/S: ' + drop);

  ({ el, run } = net());
  el('mains', [1, 0]);
  const c2 = el('cable1', [1, 2], { len: 10, size: '1.5' });
  el('heater', [2, 0], { w: 40 * 230 });
  const seen = new Set();
  run(8, 1e-4, { scale: 25, each: () => seen.add(c2.heat.state) });
  assert.deepEqual([...seen].filter((x) => x !== 'ok'), ['warm', 'hot', 'fire', 'burnt']);
  assert.ok(c2.damaged && /fire/.test(c2.damaged.why));

  ({ el, run } = net());
  el('mains', [1, 0]);
  const q = el('mcb', [1, 2], { in: 16 });
  const c3 = el('cable1', [2, 3], { len: 10, size: '1.5' });
  el('resistor', [3, 0], { r: 0.01 });
  run(0.1, 2e-5, { scale: 25 });
  assert.ok(q.tripped, 'MCB cleared the short');
  assert.equal(c3.damaged, null, 'the cable survived');
  assert.ok(c3.heat.T < 160, 'and its insulation is intact: ' + c3.heat.T);
  void c; void sim;
});

test('drawn wires: cable saved with the circuit; an overloaded wire burns through and opens the circuit', () => {
  const doc = new CircuitDoc('t');
  const mk = (t, x, y, p = {}) => { const e = new (getType(t))(x, y); Object.assign(e.p, p); e.onParamChange(); doc.add(e); return e; };
  mk('mains', 0, 0); const h = mk('heater', 0, 200, { w: 9000 });
  const w = doc.addWire([[-40, 0], [-40, 200]], { cable: { type: 'housewire', size: 1, shape: 'RE', inst: 'B1' } });
  doc.addWire([[40, 0], [40, 200]]);
  const back = CircuitDoc.fromJSON(JSON.parse(JSON.stringify(doc.toJSON())));
  assert.deepEqual(back.wires[0].cable, w.cable, 'cable kept in the file');
  assert.equal(back.wires[1].cable, null, 'an ideal wire stays a plain point list');

  const sim = new Simulator().build(doc.elements, doc.wires);
  sim.heatScale = 25; sim.acPeriod = 0.02;
  assert.ok(sim.start());
  const graph = new WireGraph(doc), heat = new WireHeat(doc, graph);
  assert.ok(heat.active);
  let burnt = null;
  while (!burnt && sim.t < 4) { assert.ok(sim.step(1e-4)); burnt = heat.step(sim); }
  assert.deepEqual(burnt, [w], 'the 1 mm² wire burnt through');
  w.burnt = true;
  const sim2 = new Simulator().build(doc.elements, doc.wires);
  assert.ok(sim2.start());
  for (let k = 0; k < 200; k++) sim2.step(1e-4);
  assert.ok(Math.abs(h.i) < 1e-6, 'no current through the heater once the wire is gone');
  const saved = JSON.parse(JSON.stringify(doc.toJSON()));
  assert.ok(CircuitDoc.fromJSON(saved).wires[0].burnt, 'a burnt wire is saved burnt');
});

test('the 2-core installation cable heats and burns open too', () => {
  const { el, run } = net();
  el('mains', [1, 0]);
  const c = el('cable', [1, 0, 2, 3], { len: 10, size: '1.5' });
  el('heater', [2, 3], { w: 45 * 230 });
  run(8, 1e-4, { scale: 25 });
  assert.ok(c.damaged && /fire|melted/.test(c.damaged.why), 'burnt');
  const ok = net();
  ok.el('mains', [1, 0]);
  const c2 = ok.el('cable', [1, 0, 2, 3], { len: 10, size: '2.5' });
  ok.el('heater', [2, 3], { w: 2000 });
  ok.run(4, 1e-4, { scale: 25 });
  assert.equal(c2.damaged, null, 'a 2 kW load on 2.5 mm² is fine');
  assert.equal(c2.heat.state, 'ok');
});

test('a CFL burns out on over-voltage instead of taking kilowatts, and runs normally at its rating', () => {
  for (const [vrms, why] of [[860, /capacitor burst/], [400, /over-voltage/]]) {
    const { el, run } = net();
    el('mains', [1, 0], { vrms });
    const lamp = el('cfl', [1, 0], { w: 20 });
    const sim = run(3, 1e-4);
    assert.ok(lamp.damaged && why.test(lamp.damaged.why), `${vrms} V: ${lamp.damaged?.why}`);
    assert.ok(Math.abs(lamp.i) < 1e-3 && lamp.readings(sim)[0][1] < 0.5, `${vrms} V: open circuit once burnt`);
    lamp.replace(sim);
    assert.equal(lamp.damaged, null);
  }
  const { el, run } = net();
  el('mains', [1, 0]);
  const lamp = el('cfl', [1, 0], { w: 20 });
  const sim = run(3, 1e-4);
  const P = lamp.readings(sim)[0][1];
  assert.equal(lamp.damaged, null);
  assert.ok(P > 18 && P < 25, 'rated power at 230 V: ' + P);
});
