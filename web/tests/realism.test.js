// Realism audit: every physical part is destroyed by over-voltage / over-current the way the real
// one is, in about real time on screen, while normal use (and every example) stays safe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getType, allTypes } from '../src/elements/index.js';
import { Simulator } from '../src/engine/sim.js';
import { CircuitDoc } from '../src/ui/doc.js';
import { WireGraph } from '../src/ui/render.js';
import { WireHeat } from '../src/ui/wireheat.js';
import { buildExample, EXAMPLES } from '../src/ui/examples.js';

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
  /** run until `done` or T seconds of circuit time; k = heat clock (25 = mains in the editor, 200 = DC) */
  const run = (T, dt, { k = 25, until } = {}) => {
    const sim = new Simulator().buildNet(els);
    sim.heatScale = k; sim.acPeriod = 0.02;
    assert.ok(sim.start(), sim.error);
    while (sim.t < T - dt * 1e-6) { assert.ok(sim.step(dt), sim.error); if (until && until()) break; }
    return sim;
  };
  return { el, run };
}
/** seconds on screen (the editor shows circuit time slowed down by the heat clock factor) */
const wall = (sim) => sim.t * sim.heatScale;

test('an unprotected short on the mains burns the drawn wire within a few seconds on screen', () => {
  const doc = new CircuitDoc('t');
  const mk = (t, x, y, p = {}) => { const e = new (getType(t))(x, y); Object.assign(e.p, p); e.onParamChange(); doc.add(e); return e; };
  mk('mains', 0, 0);
  const w = doc.addWire([[-40, 0], [-40, 100], [40, 100], [40, 0]], { cable: { type: 'housewire', size: 1.5, shape: 'RE', inst: 'B1' } });
  // 230 V / 0.2 Ω source impedance: ≈ 1 kA, about 60 × the wire's rating — but not a dead short
  // in a few milliseconds of circuit time, so this also checks the fault does not crawl
  const sim = new Simulator().build(doc.elements, doc.wires);
  sim.heatScale = 25; sim.acPeriod = 0.02;
  assert.ok(sim.start());
  const heat = new WireHeat(doc, new WireGraph(doc));
  let burnt = null;
  while (!burnt && sim.t < 1) { assert.ok(sim.step(5e-5)); burnt = heat.step(sim); }
  assert.deepEqual(burnt, [w], 'burnt');
  assert.ok(wall(sim) < 6, `burnt after ${wall(sim).toFixed(2)} s on screen (it burns for a moment before it opens)`);
});

test('a moderate fault nothing clears (12 × rating) still burns a wire in seconds, not minutes', () => {
  // 6 mm² wire, about 12 × its rating: heats in circuit time only for the fault window, then
  // on the thermal clock — on a DC circuit (heat clock 200) it used to take many minutes
  const doc = new CircuitDoc('t');
  const mk = (t, x, y, p = {}) => { const e = new (getType(t))(x, y); Object.assign(e.p, p); e.onParamChange(); doc.add(e); return e; };
  mk('dcv', 0, 0, { amp: 24 }); mk('resistor', 0, 200, { r: 0.05, pw: '0' });
  const w = doc.addWire([[-40, 0], [-40, 200]], { cable: { type: 'housewire', size: 6, shape: 'RE', inst: 'B1' } });
  doc.addWire([[40, 0], [40, 200]]);
  const sim = new Simulator().build(doc.elements, doc.wires);
  sim.heatScale = 200;
  assert.ok(sim.start());
  const heat = new WireHeat(doc, new WireGraph(doc));
  let burnt = null;
  while (!burnt && sim.t < 1) { assert.ok(sim.step(1e-4)); burnt = heat.step(sim); }
  assert.deepEqual(burnt, [w], 'burnt');
  assert.ok(wall(sim) < 60, `burnt after ${wall(sim).toFixed(1)} s on screen`);
});

test('a wire straight across a battery or bench supply burns instead of breaking the solver', () => {
  const doc = new CircuitDoc('t');
  const v = new (getType('dcv'))(0, 0); v.p.amp = 12; v.onParamChange(); doc.add(v);
  const [a, b] = v.getPosts();
  const w = doc.addWire([a, [a[0], a[1] - 60], [b[0], b[1] - 60], b], { cable: { type: 'housewire', size: 1.5, shape: 'RE', inst: 'B1' } });
  const sim = new Simulator().build(doc.elements, doc.wires);
  sim.heatScale = 200;
  assert.ok(sim.start(), sim.error);
  assert.ok(sim.warnings.some((x) => /short-circuited/.test(x)), 'warned');
  const heat = new WireHeat(doc, new WireGraph(doc));
  let burnt = null;
  while (!burnt && sim.t < 0.05) { assert.ok(sim.step(1e-5), sim.error); burnt = heat.step(sim); }
  assert.deepEqual(burnt, [w]);
  assert.ok(wall(sim) < 3, `after ${wall(sim).toFixed(2)} s`);
});

test('example wires are real wires (1.5 mm² unless the example chose a cable)', () => {
  const doc = buildExample(EXAMPLES.find((e) => e.id === 'led'));
  assert.ok(doc.wires.length && doc.wires.every((w) => w.cable && w.cable.size === 1.5));
});

test('a plain resistor is ¼ W: 1.44 W burns it open in seconds, 0.14 W never', () => {
  for (const [r, burns] of [[100, true], [1000, false]]) {
    const { el, run } = net();
    el('dcv', [1, 0], { amp: 12 });
    const R = el('resistor', [1, 0], { r });
    const sim = run(0.2, 1e-4, { k: 200, until: () => R.damaged });
    assert.equal(!!R.damaged, burns, `${r} Ω: ${R.damaged?.why}`);
    if (burns) assert.ok(wall(sim) < 15, `after ${wall(sim).toFixed(1)} s`);
  }
});

test('a circuit saved before the ratings keeps its ideal R, C and L', () => {
  const v1 = { app: 'RaptiCKT', v: 1, name: 'old', elements: [{ t: 'resistor', x: 0, y: 0 }, { t: 'capacitor', x: 0, y: 100 }, { t: 'inductor', x: 0, y: 200, p: { l: 0.1 } }], wires: [] };
  const [r, c, l] = CircuitDoc.fromJSON(v1).elements;
  assert.equal(r.p.pw, '0'); assert.equal(c.p.vr, '0'); assert.equal(l.p.irate, '0'); assert.equal(l.p.l, 0.1);
  const now = CircuitDoc.fromJSON(JSON.parse(JSON.stringify(new CircuitDoc('n').toJSON())));
  assert.equal(now.elements.length, 0);
  const fresh = new (getType('resistor'))(0, 0);
  const back = CircuitDoc.fromJSON({ ...new CircuitDoc('n').toJSON(), elements: [fresh.toJSON()] }).elements[0];
  assert.equal(back.p.pw, '0.25', 'a new file keeps the ¼ W default');
});

test('a 50 V capacitor on the mains cracks and shorts; a 2 A inductor on a stiff supply burns open', () => {
  let { el, run } = net();
  el('mains', [1, 0]);
  const c = el('capacitor', [1, 0], { c: 1e-7 });
  run(0.05, 2e-5);
  assert.ok(c.damaged && /shorted/.test(c.damaged.why), c.damaged?.why);
  ({ el, run } = net());
  el('dcv', [1, 0], { amp: 12 });
  const l = el('inductor', [1, 0], { l: 1e-3, rs: 1 });
  const sim = run(0.5, 1e-4, { k: 200, until: () => l.damaged });
  assert.ok(l.damaged && /Winding/.test(l.damaged.why), l.damaged?.why);
  assert.ok(wall(sim) < 30, `after ${wall(sim).toFixed(1)} s`);
});

test('chips: 12 V on a 5 V logic input destroys it, 5 V does not; an op-amp input on the mains dies', () => {
  for (const [v, dies] of [[12, true], [5, false]]) {
    const { el, run } = net();
    el('dcv', [1, 0], { amp: v });
    const g = el('not', [1, 2]);
    el('resistor', [2, 0], { r: 1e4 });
    run(0.01, 1e-5);
    assert.equal(!!g.damaged, dies, `${v} V: ${g.damaged?.why}`);
  }
  const { el, run } = net();
  el('mains', [1, 0]);
  const o = el('opamp', [1, 0, 2]); // the ideal model too
  el('resistor', [2, 0], { r: 1e4 });
  run(0.02, 2e-5);
  assert.ok(o.damaged && /supply rails/.test(o.damaged.why), o.damaged?.why);
});

test('a 12 V DC motor on 48 V burns; on 12 V it runs', () => {
  for (const [v, burns] of [[48, true], [12, false]]) {
    const { el, run } = net();
    el('dcv', [1, 0], { amp: v });
    const m = el('motor', [1, 0], { ra: 8, k: 0.02 });
    const sim = run(0.3, 1e-4, { k: 200, until: () => m.damaged });
    assert.equal(!!m.damaged, burns, `${v} V: ${m.damaged?.why}`);
    if (burns) assert.ok(wall(sim) < 40, `after ${wall(sim).toFixed(1)} s`);
  }
});

test('appliances burn on over-voltage within seconds, and are fine on their rating', () => {
  for (const [type, p] of [['bulb', {}], ['heater', {}], ['ledbulb', {}], ['cfl', {}], ['fan', {}], ['rload', {}], ['socket', {}]]) {
    for (const [vrms, burns] of [[440, true], [230, false]]) {
      const { el, run } = net();
      el('mains', [1, 0], { vrms });
      const a = el(type, [1, 0], p);
      const sim = run(1.6, 1e-4, { k: 25, until: () => a.damaged });
      assert.equal(!!a.damaged, burns, `${type} on ${vrms} V: ${a.damaged?.why}`);
      if (burns) assert.ok(wall(sim) < 40, `${type}: ${wall(sim).toFixed(1)} s`);
    }
  }
});

test('every physical part has a limit (only sources, wires, logic tools, ideal blocks and ladder symbols are exempt)', () => {
  const EXEMPT_CATS = new Set(['Sources', 'Control & Math']);
  const EXEMPT = new Set([
    // tools and markers, not parts
    'label', 'testpoint', 'logicin', 'logicout', 'hexin', 'clock', 'probe', 'faultsw', 'earthrod',
    // explicitly ideal / mathematical models
    'tline', 'memristor', 'coupledl', 'vcsw', 'ccsw',
    // sources of their own (the panel, turbine and fuel cell set the limits of what they feed)
    'pvarray', 'windgen', 'fuelcell', 'antenna',
    // devices that protect by tripping or opening rather than burning
    'mcb', 'mcb2p', 'mcb3p', 'mccb', 'rccb', 'rcbo', 'acb', 'arrester',
    // built from LEDs that burn on their own
    'rgbled', 'bicolor',
    // ladder-diagram symbols (the real parts are the contactor, relay, MPCB…)
  ]);
  const missing = [];
  for (const C of allTypes()) {
    if (EXEMPT_CATS.has(C.category) || EXEMPT.has(C.type) || /\(ladder\)/.test(C.title)) continue;
    const e = new C(0, 0);
    if (e.localPosts().length < 2) continue;
    if (!(e.ratings && e.ratings()) && !hasOwnDamage(C)) missing.push(C.type);
  }
  assert.deepEqual(missing, [], 'parts with no way to fail');
});

function hasOwnDamage(C) {
  for (let P = C.prototype; P && P.constructor.name !== 'Element'; P = Object.getPrototypeOf(P)) {
    for (const k of Object.getOwnPropertyNames(P)) {
      const d = Object.getOwnPropertyDescriptor(P, k);
      if (typeof d.value === 'function' && /setDamage|heat\.step|\.fail\(s/.test(d.value.toString())) return true;
    }
  }
  return false;
}
