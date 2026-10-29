// Rated parts behave like the real thing: the normal ±10 % swing of their supply never hurts
// them, but on twice their rated voltage they burn out within seconds and stay dead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getType } from '../src/elements/index.js';
import { Simulator } from '../src/engine/sim.js';

/**
 * Put `type` on a supply of `k` × `rated` volts (mains RMS when ac) and run it for T seconds
 * of circuit time on a heat clock `scale` × faster (25 ≈ mains shown at 40 ms/s).
 * `wire(e)` gives the part's node list; supply between node 1 and ground.
 */
function run(type, { k, rated, ac = true, p = {}, wire, T = 0.8, scale = 25 }) {
  const e = new (getType(type))(0, 0);
  Object.assign(e.p, p); e.onParamChange?.();
  e.name = 'X';
  e.nodes = wire ? wire(e) : [1, 0];
  const src = new (getType(ac ? 'mains' : 'dcv'))(0, 0);
  if (ac) Object.assign(src.p, { vrms: rated * k, zs: 0.01 }); else src.p.amp = rated * k;
  src.onParamChange?.(); src.nodes = [1, 0]; src.name = 'S';
  const sim = new Simulator().buildNet([src, e]);
  sim.heatScale = scale; sim.damageOn = true; sim.acPeriod = 0.02;
  assert.ok(sim.start(), sim.error);
  const dt = ac ? 1e-4 : 2e-4;
  while (sim.t < T && !e.damaged) assert.ok(sim.step(dt), sim.error);
  return e;
}

const coil = (e) => { const n = new Array(e.localPosts().length).fill(0); const [a, b] = e.constructor.coil || [0, 1]; n[a] = 1; n[b] = 0; return n; };
const PARTS = [
  ['fan', { rated: 230 }],
  ['bulb', { rated: 230 }],
  ['ledbulb', { rated: 230 }],
  ['cfl', { rated: 230 }],
  ['ledpanel', { rated: 230 }],
  ['heater', { rated: 230 }],
  ['bell', { rated: 230 }],
  ['pfcap', { rated: 230 }],
  ['socket', { rated: 230, p: { app: 'tv' }, wire: () => [1, 0, 0] }],
  ['socket', { rated: 230, p: { app: 'fridge' }, wire: () => [1, 0, 0] }],
  ['socket', { rated: 230, p: { app: 'iron' }, wire: () => [1, 0, 0] }],
  ['photocell', { rated: 230, wire: () => [1, 0, 0] }],
  ['contactor', { rated: 230, wire: coil }],
  ['lcoil', { rated: 230 }],
  ['xfmrct', { rated: 230, wire: () => [1, 0, 2, 0, 3] }],
  ['filmcap', { rated: 250 / Math.SQRT2 }],
  ['relay', { rated: 5, ac: false, wire: coil }],
  ['relayspst', { rated: 12, ac: false, wire: coil }],
  ['dcfan', { rated: 12, ac: false }],
  ['ceramiccap', { rated: 50, ac: false }],
  ['supercap', { rated: 2.7, ac: false }],
];

for (const [type, o] of PARTS) {
  const what = `${type}${o.p?.app ? ' (' + o.p.app + ')' : ''}`;
  test(`${what}: fine at +10 %, burns within 20 s on twice its rated voltage`, () => {
    const ok = run(type, { ...o, k: 1.1, T: 0.4, scale: 100 });
    assert.equal(ok.damaged, null, `${what} burnt at 1.1 × rated: ${ok.damaged?.why}`);
    assert.ok((ok.stress || 0) < 0.3, `${what} stressed at 1.1 × rated (${ok.stress})`);
    const burnt = run(type, { ...o, k: 2 });
    assert.ok(burnt.damaged, `${what} survived 2 × rated`);
    assert.ok(burnt.damaged.why.length > 10, 'says why');
  });
}

test('a 230 V fan on 460 V burns within seconds of real time, and then stops', () => {
  const e = run('fan', { rated: 230, k: 2, T: 0.4 });
  assert.ok(e.damaged && /over-voltage/.test(e.damaged.why), e.damaged?.why);
  assert.ok(e.damaged.t * 25 < 10, `took ${e.damaged.t * 25} s`);
});

test('a burnt CFL, LED panel, coil and ballast carry no current any more', () => {
  for (const [type, o] of [['cfl', { rated: 230 }], ['ledpanel', { rated: 230 }], ['lcoil', { rated: 230 }], ['ballast', { rated: 230, p: { irated: 0.1 } }], ['speaker', { rated: 9, ac: false }]]) {
    const e = run(type, { ...o, k: o.p?.irated ? 1 : 2 });
    assert.ok(e.damaged, `${type} burnt`);
    const src = new (getType(o.ac === false ? 'dcv' : 'mains'))(0, 0);
    if (o.ac === false) src.p.amp = o.rated; else src.p.vrms = o.rated;
    src.nodes = [1, 0]; src.name = 'S';
    const sim = new Simulator().buildNet([src, e]);
    sim.acPeriod = 0.02;
    assert.ok(sim.start(), sim.error);
    for (let i = 0; i < 400; i++) assert.ok(sim.step(1e-4), sim.error);
    const i = e.postCurrents ? Math.abs(e.postCurrents[0]) : Math.abs(e.i);
    assert.ok(i < 1e-3, `${type} still conducts ${i} A`);
  }
});
