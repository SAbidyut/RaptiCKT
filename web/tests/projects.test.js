// The big build-along projects must behave like the real circuits, and the
// faults found while building them stay fixed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES, buildExample, exampleCategories } from '../src/ui/examples.js';
import { Simulator } from '../src/engine/sim.js';
import { getType } from '../src/elements/index.js';
import { WireGraph } from '../src/ui/render.js';

function open(id) {
  const doc = buildExample(EXAMPLES.find((e) => e.id === id));
  const sim = new Simulator().build(doc.elements, doc.wires);
  assert.ok(sim.start(), sim.error);
  const of = (type) => doc.elements.filter((e) => e.constructor.type === type);
  const run = (T, dt) => { const t1 = sim.t + T; while (sim.t < t1 - dt * 1e-6) assert.ok(sim.step(dt), sim.error); };
  return { doc, sim, of, run };
}

test('projects are listed first among the example categories', () => {
  assert.equal(exampleCategories()[0], 'Projects');
  assert.ok(EXAMPLES.filter((e) => e.cat === 'Projects').length >= 7);
});

test('house wiring: a leaking appliance trips the RCCB, a short trips only its MCB', () => {
  for (const [app, expect] of [['iron', []], ['fault', ['rccb']], ['short', ['mcb']]]) {
    const { doc, sim, of, run } = open('flat');
    run(0.2, 4.1667e-5);
    const meter = of('acamp')[0];
    if (app === 'iron') assert.ok(Math.abs(meter.display(0) - 6.6) < 0.4, 'total current ' + meter.display(0));
    const so = doc.elements.find((e) => e.name === 'SO1');
    so.p.app = app; sim.dirty = true;
    run(0.3, 4.1667e-5);
    const tripped = doc.elements.filter((e) => e.tripped).map((e) => e.constructor.type);
    assert.deepEqual(tripped, expect, app);
  }
});

test('2-storey house: service main to earthing behaves like the real installation', () => {
  // normal evening load: a few amps; with geyser, AC, pump, microwave and iron on it rises past 25 A without tripping anything
  {
    const { doc, sim, of, run } = open('house');
    run(0.2, 4.1667e-5);
    const meter = of('acamp')[0], i0 = meter.display(0);
    assert.ok(i0 > 3 && i0 < 10, 'evening load ' + i0);
    assert.ok(of('kwh')[0].P() > 600, 'meter power ' + of('kwh')[0].P());
    for (const e of of('oneway')) e.p.on = true;
    sim.dirty = true;
    run(0.3, 4.1667e-5);
    const i1 = meter.display(0);
    assert.ok(i1 > 25 && i1 < 45, 'full load ' + i1);
    assert.deepEqual(doc.elements.filter((e) => e.tripped || e.blown || e.damaged).map((e) => e.name), [], 'nothing trips at full load');
    // the service drop and tails keep the voltage drop small even at full load
    const v = of('kwh')[0], vrms = v.P() / Math.max(1e-9, i1);
    assert.ok(vrms > 200, 'voltage at the meter ' + vrms);
  }
  // a leaking appliance trips the RCCB through the earth electrodes; a short trips only its own MCB
  for (const [app, expect] of [['fault', ['rccb']], ['short', ['mcb']]]) {
    const { doc, sim, of, run } = open('house');
    run(0.2, 4.1667e-5);
    const so = of('socket').find((e) => e.p.app === 'tv');
    so.p.app = app; sim.dirty = true;
    run(0.3, 4.1667e-5);
    const tripped = doc.elements.filter((e) => e.tripped).map((e) => e.constructor.type);
    assert.deepEqual(tripped, expect, app);
    if (app === 'fault') assert.ok(Math.abs(of('earthrod').reduce((a, e) => a + Math.abs(e.i), 0)) < 0.2, 'earth path carried the leak, then nothing');
  }
});

test('2-storey house: staircase (2 places) and corridor (3 places) lamps follow every switch', () => {
  const { doc, sim, of, run } = open('house');
  const lit = (lamp) => { run(0.2, 4.1667e-5); return lamp.T > 2000; };
  const bulbs = of('bulb'), stair = bulbs.find((e) => e.p.w === 40), corridor = bulbs.find((e) => e.p.w === 60);
  const [gf, ff, c1, c2] = of('twoway'), [mid] = of('intermediate');
  let s0 = lit(stair);
  for (const t of [gf, ff, gf]) { t.onTap(); sim.dirty = true; const s1 = lit(stair); assert.notEqual(s1, s0, 'stair lamp follows ' + t.name); s0 = s1; }
  let c0 = lit(corridor);
  for (const t of [c1, mid, c2, mid]) { t.onTap(); sim.dirty = true; const s1 = lit(corridor); assert.notEqual(s1, c0, 'corridor lamp follows ' + t.name); c0 = s1; }
  // the verandah light is on at night and goes off in daylight
  const [pc] = of('photocell');
  assert.equal(pc.on, true, 'verandah light on at night');
  pc.p.lux = 2000; pc.p.delay = 0.05; sim.dirty = true;
  run(0.2, 4.1667e-5);
  assert.equal(pc.on, false, 'off in daylight');
  void doc;
});

test('house wiring: either staircase switch toggles the stair lamp', () => {
  const { doc, sim, of, run } = open('flat');
  const lamp = doc.elements.find((e) => e.name === 'LP3');
  const [down, up] = of('twoway');
  const lit = () => { run(0.2, 4.1667e-5); return lamp.T > 2000; };
  assert.equal(lit(), false);
  down.onTap(); sim.dirty = true; assert.equal(lit(), true, 'downstairs on');
  up.onTap(); sim.dirty = true; assert.equal(lit(), false, 'upstairs off');
});

test('16-bit RAM stores a different word at each address', () => {
  const { of, run } = open('ram16');
  const [hex] = of('hexin'), [out] = of('hexdisp'), ins = of('logicin');
  const write = ins.find((e) => e.p.momentary), [a1, a0] = ins.filter((e) => !e.p.momentary);
  const addr = (k) => { a0.p.on = !!(k & 1); a1.p.on = !!(k & 2); };
  const data = [0xA, 0x3, 0xF, 0x6];
  data.forEach((d, k) => { addr(k); hex.p.v = d; run(5e-4, 2e-6); write.p.on = true; run(5e-4, 2e-6); write.p.on = false; run(5e-4, 2e-6); });
  hex.p.v = 0; run(5e-4, 2e-6); // changing DATA IN without WRITE must not disturb memory
  data.forEach((d, k) => { addr(k); run(5e-4, 2e-6); assert.equal(out.val(), d, 'address ' + k); });
});

test('NOR latch powers up in a stable state and remembers SET / RESET', () => {
  const { of, run } = open('norlatch');
  const [qbar, q] = of('nor'), [reset, set] = of('logicin');
  const states = new Set();
  for (let i = 0; i < 20; i++) { run(2e-6, 2e-6); states.add(`${+q.out[0]}${+qbar.out[0]}`); }
  assert.deepEqual([...states], ['01'], 'no oscillation at power-up');
  set.p.on = true; run(2e-5, 2e-6); set.p.on = false; run(2e-5, 2e-6);
  assert.deepEqual([q.out[0], qbar.out[0]], [true, false], 'SET is remembered');
  reset.p.on = true; run(2e-5, 2e-6); reset.p.on = false; run(2e-5, 2e-6);
  assert.deepEqual([q.out[0], qbar.out[0]], [false, true], 'RESET is remembered');
});

test('cascaded BCD counters count 08, 09, 10 (carry on the 9 → 0 wrap)', () => {
  const C = getType('bcdcounter'), Clk = getType('clock');
  const clk = new Clk(0, 0); clk.p.freq = 100; clk.nodes = [1];
  const u = new C(0, 0), t = new C(0, 0);
  u.nodes = [1, 0, 2, 3, 4, 5, 6]; // CLK RST Q0..Q3 CO
  t.nodes = [6, 0, 7, 8, 9, 10, 11];
  const s = new Simulator().buildNet([clk, u, t]);
  assert.ok(s.start());
  const seen = [];
  for (let i = 0; i < 25000; i++) { s.step(1e-5); const v = t.st * 10 + u.st; if (seen[seen.length - 1] !== v) seen.push(v); }
  // a ripple counter shows 0 for one step between 09 and 10; the tens digit must never tick at 9
  const settled = seen.filter((v, i) => !(v % 10 === 0 && seen[i - 1] % 10 === 9 && seen[i + 1] === seen[i - 1] + 1));
  assert.deepEqual(settled.slice(7, 13), [7, 8, 9, 10, 11, 12]);
  assert.deepEqual(settled.slice(17, 22), [17, 18, 19, 20, 21]);
});

test('seconds counter rolls over 58, 59 → 00', () => {
  const { of, run } = open('clock60');
  of('clock')[0].p.freq = 50;
  const [tens, units] = of('bcdcounter');
  // what the display shows for longer than the 1–2 step ripple of a ripple counter (59 → 50 → 60 → 00)
  const runs = [];
  for (let k = 0; k < 2600; k++) {
    run(5e-4, 5e-4);
    const v = tens.st * 10 + units.st, r = runs[runs.length - 1];
    if (r && r.v === v) r.n++; else runs.push({ v, n: 1 });
  }
  const shown = runs.filter((r) => r.n > 2).map((r) => r.v).filter((v, i, a) => v !== a[i - 1]);
  const i = shown.indexOf(59);
  assert.ok(i > 0 && shown[i - 1] === 58 && shown[i + 1] === 0 && shown[i + 2] === 1, shown.slice(i - 2, i + 4).join(','));
  assert.equal(Math.max(...shown), 59, 'never shows 60');
  assert.ok(runs.every((r) => r.v < 60 || r.n <= 2), 'the reset at 60 is immediate');
});

test('traffic lights: red 5 s, green 4 s, yellow 1 s', () => {
  const { of, run } = open('traffic');
  const leds = Object.fromEntries(of('led').map((e) => [e.p.color, e]));
  const on = () => Object.keys(leds).filter((c) => leds[c].i > 5e-3).join(',');
  const at = (t) => { run(t - (at.t || 0), 5e-4); at.t = t; return on(); };
  assert.equal(at(0.5), 'red'); assert.equal(at(4.5), 'red');
  assert.equal(at(5.5), 'green'); assert.equal(at(8.5), 'green');
  assert.equal(at(9.5), 'yellow'); assert.equal(at(10.5), 'red');
});

test('mains → 5 V supply: steady 5 V from ≈15 V rippling DC', () => {
  const { doc, sim, run } = open('psu5v');
  run(0.4, 2.083e-5);
  let lo = Infinity, hi = -Infinity, vlo = Infinity, vhi = -Infinity;
  const nIn = sim.pointNode(25 * 20, -20), nOut = sim.pointNode(32 * 20, -20);
  for (let k = 0; k < 2000; k++) { run(2.083e-5, 2.083e-5); const a = sim.v(nIn), b = sim.v(nOut); lo = Math.min(lo, a); hi = Math.max(hi, a); vlo = Math.min(vlo, b); vhi = Math.max(vhi, b); }
  assert.ok(lo > 13 && hi < 17 && hi - lo > 0.2 && hi - lo < 1.2, `filter ${lo}..${hi}`);
  assert.ok(Math.abs(vlo - 5) < 0.05 && Math.abs(vhi - 5) < 0.05, `output ${vlo}..${vhi}`);
  void doc;
});

test('4-bit adder: 9 + 5 = 14, 9 + 8 = 17 (carry)', () => {
  const { of, run } = open('adder');
  const [a, bb] = of('hexin'), [disp] = of('hexdisp'), [carry] = of('logicout');
  run(2e-4, 2e-6);
  assert.equal(disp.val(), 14); assert.equal(carry.inState[0], false);
  a.p.v = 9; bb.p.v = 8; run(2e-4, 2e-6);
  assert.equal(disp.val() + (carry.inState[0] ? 16 : 0), 17);
});

test('street light: off in daylight, on at night, no chatter in between', () => {
  const { sim, of, run } = open('streetlight');
  const [ldr] = of('ldr'), [k] = of('relay');
  const at = (lux) => { ldr.p.lux = lux; ldr.onParamChange(); sim.dirty = true; run(0.3, 4.1667e-5); return k.on; };
  assert.equal(at(1000), false);
  assert.equal(at(5), true);
  assert.equal(at(45), true, 'stays on through dusk (hysteresis)');
  assert.equal(at(1000), false);
});

test('current animation: return current flows into ground, not along an idle wire', () => {
  const { doc, run } = open('streetlight');
  run(0.05, 4.1667e-5);
  const g = new WireGraph(doc);
  g.solveCurrents(doc);
  const q = doc.elements.find((e) => e.constructor.type === 'npn');
  const [, , emitter] = q.getPosts();
  // the emitter carries no current in daylight, so no wire touching it may show any
  for (const ed of g.edges) {
    const touches = [ed.a, ed.b].some((p) => p[0] === emitter[0] && p[1] === emitter[1]);
    if (touches) assert.ok(Math.abs(ed.i) < 1e-9, 'emitter wire carries ' + ed.i);
  }
});

test('switching a fan off: no ±kV ringing on its winding, and it runs down at 0 A', () => {
  // the editor calls sim.discontinuity() for every tap; without it the trapezoidal rule rang
  // at ~11 kV on the cut inductive winding and the fan read 346 rpm at 0 A
  const { doc, sim, run } = open('flat');
  const fan = doc.elements.find((e) => e.constructor.type === 'fan');
  const mcb = doc.elements.find((e) => e.name === 'Q3');
  run(0.5, 4.1667e-5);
  assert.ok(fan.speed > 150, 'running ' + fan.speed);
  mcb.onTap(); sim.discontinuity();
  run(0.5, 4.1667e-5);
  let vmax = 0;
  for (let k = 0; k < 2000; k++) { run(4.1667e-5, 4.1667e-5); vmax = Math.max(vmax, Math.abs(fan.voltageDiff(sim))); }
  assert.ok(vmax < 1, 'fan voltage after switch-off ' + vmax);
  run(1.5, 4.1667e-5);
  assert.ok(fan.speed < 10 && fan.irms.v < 1e-3, `fan ${fan.speed} rpm at ${fan.irms.v} A`);
});

test('5 V supply: the output capacitor carries no phantom current, and the 7805 can be turned up', () => {
  const { doc, sim, run } = open('psu5v');
  const reg = doc.elements.find((e) => e.constructor.type === 'reg78');
  const c2 = doc.elements.find((e) => e.name === 'C2');
  run(0.2, 2.0833e-5);
  let sq = 0, n = 0;
  for (let k = 0; k < 1000; k++) { run(2.0833e-5, 2.0833e-5); sq += c2.i * c2.i; n++; }
  assert.ok(Math.sqrt(sq / n) < 5e-3, 'C2 RMS current ' + Math.sqrt(sq / n)); // was 0.22 A of trapezoidal ringing
  reg.p.vout = 10; reg.onParamChange('vout'); sim.discontinuity(); // used to stop with "failed to converge"
  run(0.05, 2.0833e-5);
  const out = sim.pointNode(32 * 20, -20);
  assert.ok(Math.abs(sim.v(out) - 10) < 0.05, 'Vout ' + sim.v(out));
  assert.ok(Math.abs(reg.i - 0.124) < 0.01, 'Iout ' + reg.i); // 100 mA load + 24 mA LED, steady
});
