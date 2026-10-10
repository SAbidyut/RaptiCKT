// Fans on the wrong voltage fail like real ones: a ceiling fan's run capacitor bursts and its
// winding burns, a DC fan's driver chip dies, a capacitor-run motor's winding burns.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getType, Element } from '../src/elements/index.js';
import { Simulator } from '../src/engine/sim.js';

function net() {
  const els = [];
  const el = (type, nodes, p = {}) => {
    const e = new (getType(type))(0, 0);
    Object.assign(e.p, p);
    if (type === 'resistor' && p.pw === undefined) e.p.pw = '0'; // test loads stay ideal (a new resistor is ¼ W)
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

test('a 230 V ceiling fan on 500 V: the run capacitor bursts, then the winding burns within seconds', () => {
  const { el, run } = net();
  el('mains', [1, 0], { vrms: 500 });
  const f = el('fan', [1, 0]);
  let capAt = null, burntAt = null;
  // heat clock as on screen (mains shown at 40 ms/s): 0.4 s of circuit time = 10 s of real time
  const sim = run(0.4, 4.1667e-5, { scale: 25, each: (s) => {
    if (capAt === null && f.capGone()) capAt = s.t * 25;
    if (burntAt === null && f.burnt()) burntAt = s.t * 25;
  } });
  assert.ok(capAt !== null && capAt < 4, `capacitor burst after ${capAt} s`);
  assert.ok(burntAt !== null && burntAt > capAt && burntAt < 8, `winding burnt after ${burntAt} s`);
  assert.match(f.damaged.why, /Winding burnt.*saturated the core/);
  assert.ok(sim.damageLog.filter((e) => e === f).length === 2, 'both failures reported to the UI');
  for (let k = 0; k < 4000; k++) sim.step(4.1667e-5);
  assert.ok(Math.abs(f.i) < 1e-6 && f.speed < 30, `open winding, running down: ${f.i} A, ${f.speed} rpm`);
  // stays burnt in a saved file and after a restart, works again once replaced
  const saved = Element.fromJSON(JSON.parse(JSON.stringify(f.toJSON())));
  assert.ok(saved.burnt(), 'saved burnt');
  f.replace(sim);
  assert.equal(f.damaged, null);
});

test('a ceiling fan with a burst capacitor only hums, and that state survives saving', () => {
  const { el, run } = net();
  el('mains', [1, 0], { vrms: 230 });
  const f = el('fan', [1, 0]);
  f.damaged = { why: 'Run capacitor burst', partial: true };
  run(1, 1e-4);
  assert.equal(f.speed, 0, 'does not turn');
  assert.ok(f.irms.v > 1.5 * f.irated(), `locked-rotor current ${f.irms.v} A`);
  const o = JSON.parse(JSON.stringify(f.toJSON()));
  assert.ok(Element.fromJSON(o).capGone(), 'partial damage saved');
});

test('a ceiling fan at 230 V and at +10 % runs for good; on 400 V it still burns, only slower', () => {
  for (const v of [230, 253]) {
    const { el, run } = net();
    el('mains', [1, 0], { vrms: v });
    const f = el('fan', [1, 0]);
    run(3, 1e-4, { scale: 25 });
    assert.equal(f.damaged, null, `${v} V`);
    assert.ok(f.speed > 300, `${v} V: ${f.speed} rpm`);
  }
  const { el, run } = net();
  el('mains', [1, 0], { vrms: 400 });
  const f = el('fan', [1, 0]);
  let at = null;
  run(2.4, 1e-4, { scale: 25, each: (s) => { if (at === null && f.damaged) at = s.t * 25; } });
  assert.ok(at !== null && at > 15 && at < 60, `first failure after ${at} s`);
});

test('a 12 V DC fan: fine at 12 V, its driver burns at once on 24 V', () => {
  const { el, run } = net();
  el('dcv', [1, 0], { amp: 12 });
  const ok = el('dcfan', [1, 0]);
  el('dcv', [2, 0], { amp: 24 });
  const bad = el('dcfan', [2, 0]);
  run(1, 1e-4, { scale: 25 });
  assert.equal(ok.damaged, null);
  assert.ok(bad.damaged && /Driver chip/.test(bad.damaged.why));
  assert.ok(Math.abs(bad.i) < 1e-6, 'dead fan draws nothing');
});

test('a 230 V capacitor-run motor burns on 500 V but runs for good at 230 V', () => {
  for (const [v, burns] of [[230, false], [500, true]]) {
    const { el, run } = net();
    el('mains', [1, 0], { vrms: v });
    const m = el('im1', [1, 2, 0]);
    el('capacitor', [1, 2], { c: 10e-6, vr: '450' }); // a motor-run capacitor
    run(1.5, 5e-5, { scale: 25 });
    assert.equal(!!m.damaged, burns, `${v} V: ${m.damaged?.why}`);
  }
});
