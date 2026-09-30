// Every example must be fully wired, solvable and physically sensible.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES, buildExample, EXAMPLE_ALLOW_OPEN } from '../src/ui/examples.js';
import { Simulator } from '../src/engine/sim.js';

const key = (p) => Math.round(p[0]) + ',' + Math.round(p[1]);

function openPins(doc) {
  const deg = new Map();
  const bump = (p) => deg.set(key(p), (deg.get(key(p)) || 0) + 1);
  for (const e of doc.elements) for (const p of e.getPosts()) bump(p);
  for (const w of doc.wires) { bump(w.pts[0]); bump(w.pts[w.pts.length - 1]); }
  // points lying inside wire segments count as connected
  const inside = (p) => doc.wires.some((w) => w.pts.some((a, i) => {
    if (!i) return false;
    const b = w.pts[i - 1];
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(cross) > 1e-6) return false;
    const dot = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
    const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    return dot > 0 && dot < l2;
  }) || doc.wires.some((w) => w.pts.slice(1, -1).some((q) => key(q) === key(p))));
  const open = [];
  for (const e of doc.elements) {
    e.getPosts().forEach((p, i) => { if ((deg.get(key(p)) || 0) < 2 && !inside(p)) open.push(`${e.name}#${i}`); });
  }
  return open;
}

for (const ex of EXAMPLES) {
  test(`example: ${ex.title}`, () => {
    const doc = buildExample(ex);
    const open = openPins(doc);
    assert.ok(open.length <= (EXAMPLE_ALLOW_OPEN[ex.id] || 0), 'unconnected pins: ' + open.join(', '));
    const sim = new Simulator().build(doc.elements, doc.wires);
    assert.ok(sim.start(), 'start failed: ' + sim.error);
    const dt = 1e-5;
    for (let i = 0; i < 3000; i++) assert.ok(sim.step(dt), `step ${i} failed: ${sim.error}`);
    for (const p of doc.probes) if (p.kind === 'node') assert.ok(sim.pointNode(p.pos[0], p.pos[1]) >= 0, 'probe not on node');
    ex._sim = sim; ex._doc = doc;
  });
}

const find = (id) => EXAMPLES.find((e) => e.id === id);
const el = (id, name) => find(id)._doc.elements.find((e) => e.name === name);

test('example values are physically correct', () => {
  const s = find('led')._sim;
  const led = el('led', 'LED1');
  assert.ok(led.i > 0.012 && led.i < 0.017, 'LED current ' + led.i);
  const r1 = el('network', 'R1');
  assert.ok(Math.abs(r1.i - 0.01) < 1e-6, 'network current ' + r1.i);
  const vm = el('divider', 'VM1');
  assert.ok(Math.abs(vm.v - 12 * 4.7 / 14.7) < 1e-3, 'divider ' + vm.v);
  const reg = el('reg7805', 'VM1');
  assert.ok(Math.abs(reg.v - 5) < 0.05, '7805 ' + reg.v);
  const z = el('zener', 'VM1');
  assert.ok(Math.abs(z.v - 5.1) < 0.3, 'zener ' + z.v);
  const q = el('ceamp', 'Q1');
  assert.equal(q.region(), 'Active');
  assert.ok(q.postCurrents[1] > 1e-3 && q.postCurrents[1] < 2e-3, 'Ic ' + q.postCurrents[1]);
  void s;
});

// Robustness: run every example with the same timestep the editor picks
// (and a few awkward multiples of it) for several seconds of screen time.
function appTiming(doc) {
  let fmax = 0;
  for (const e of doc.elements) {
    const p = e.p;
    if (p.wave && p.wave !== 'dc' && p.freq) fmax = Math.max(fmax, p.freq);
    if (e.constructor.type === 'mic') fmax = Math.max(fmax, p.freq);
  }
  const speed = doc.simSettings.speed || (fmax > 0 ? Math.min(1, 2 / fmax) : 5e-3);
  let dt = speed / 2400;
  if (fmax > 0) dt = Math.min(dt, 1 / (fmax * 200));
  return { speed, dt: Math.min(dt, 1e-4) };
}

for (const ex of EXAMPLES) {
  test(`example runs robustly in the editor: ${ex.title}`, () => {
    const base = appTiming(buildExample(ex));
    for (const k of [1, 0.37, 1.7, 3]) {
      const doc = buildExample(ex);
      const sim = new Simulator().build(doc.elements, doc.wires);
      assert.ok(sim.start(), sim.error);
      const dt = base.dt * k, n = Math.min(6000, Math.ceil((base.speed * 3) / dt));
      for (let i = 0; i < n; i++) assert.ok(sim.step(dt), `dt=${dt.toExponential(3)} failed at t=${sim.t.toExponential(3)}: ${sim.error}`);
    }
  });
}
