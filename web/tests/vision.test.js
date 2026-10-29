// Circuit from photo, read on the phone (no network): textbook-style drawings — clean, as grey,
// grainy, slightly turned photos, and as rough ones (turned further, dusty, small, squeezed hard;
// tests/fixtures, made by tools/glyphs/figures.py) — are read into circuits whose parts, values,
// marked quantities and answers are right.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { readPicture } from '../src/vision/index.js';
import { buildFromDrawing } from '../src/ui/photo-circuit.js';
import { Simulator } from '../src/engine/sim.js';
import { glyphFeatures } from '../src/vision/glyph-features.js';
import { classify, CLASSES } from '../src/vision/glyph.js';

function load(name) {
  const buf = fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
  if (name.endsWith('.png')) { const p = PNG.sync.read(buf); return { width: p.width, height: p.height, data: p.data }; }
  const j = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { width: j.width, height: j.height, data: j.data };
}

/** read the picture, build its (only) circuit and solve the DC operating point */
async function solve(name) {
  const out = await readPicture(load(name));
  assert.equal(out.circuits.length, 1, `${name}: one circuit (${out.problem})`);
  const c = out.circuits[0];
  const { doc, warnings } = buildFromDrawing(c);
  const sim = new Simulator().build(doc.elements, doc.wires);
  assert.ok(sim.start(), sim.error);
  for (let i = 0; i < 30; i++) assert.ok(sim.step(1e-4), sim.error);
  const kinds = c.parts.map((p) => p.kind).sort();
  const texts = c.parts.map((p) => p.text).sort();
  const el = (pred) => doc.elements.find(pred);
  return { c, doc, sim, warnings, kinds, texts, el, v: (name2) => sim.v(el((e) => e.constructor.type === 'netlabel' && e.p.name === name2).nodes[0]) };
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b}`);

for (const name of ['depsource.png', 'depsource-photo.jpg', 'depsource-rough.jpg']) {
  test(`${name}: a 0.1vₓ dependent source controlled by a node voltage — vₓ = 25 V`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.kinds, ['current_source', 'dependent_current_source', 'resistor', 'resistor', 'voltage_source']);
    assert.deepEqual(r.texts, ['0.1vx', '20 V', '20 Ω', '4 A', '4 Ω']);
    assert.deepEqual(r.c.quantities.map((q) => `${q.name}:${q.kind}`), ['vx:node_voltage']);
    near(r.v('vx'), 25, 1e-6, 'vx');
    assert.deepEqual(r.c.notes, []);
  });
}

for (const name of ['meshes.png', 'meshes-photo.jpg', 'meshes-rough.jpg']) {
  test(`${name}: three meshes, the marked i = 2 A down the 3 Ω`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.texts, ['12 V', '24 V', '3 A', '3 Ω', '4 Ω', '4 Ω', '8 Ω']);
    const q = r.c.quantities.find((x) => x.name === 'i');
    assert.ok(q && q.kind === 'current_through', 'the arrow and its i are read');
    assert.equal(r.c.parts[q.part].text, '3 Ω', 'i is the current through the 3 Ω');
    const R3 = r.el((e) => e.constructor.type === 'resistor' && e.p.r === 3);
    near(Math.abs(R3.i), 2, 1e-6, 'i');
  });
}

for (const name of ['rlc.png', 'rlc-photo.jpg']) {
  test(`${name}: battery, resistor, coil and capacitor with their values`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.kinds, ['capacitor', 'inductor', 'resistor', 'voltage_source']);
    const by = (k) => r.c.parts.find((p) => p.kind === k);
    assert.equal(by('capacitor').value, 1e-5);
    assert.equal(by('inductor').value, 2e-3);
    assert.equal(by('resistor').value, 1000);
    assert.equal(by('voltage_source').value, 9);
    // the long plate is +: the capacitor charges to +9 V on its top plate
    const C = r.el((e) => e.constructor.type === 'capacitor');
    const [a, b] = C.nodes.map((n) => r.sim.v(n));
    near(Math.abs(a - b), 9, 1e-3, 'capacitor voltage');
    assert.ok(r.c.ground.length >= 1, 'the ground is read');
  });
}

for (const name of ['ccvs.png', 'ccvs-photo.jpg', 'ccvs-rough.jpg']) {
  test(`${name}: a 4iₓ source in a wire, controlled by the marked iₓ — iₓ = 48/14 A`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.texts, ['2 Ω', '4ix', '6 A', '8 Ω']);
    const dep = r.c.parts.find((p) => p.kind === 'dependent_voltage_source');
    assert.equal(dep.control, 'ix');
    assert.equal(dep.value, 4);
    const R2 = r.el((e) => e.constructor.type === 'resistor' && e.p.r === 2);
    near(Math.abs(R2.i), 48 / 14, 1e-6, 'ix');
  });
}

for (const name of ['thevenin.png', 'thevenin-photo.jpg']) {
  test(`${name}: open terminals a and b are the ends of their wires, not parts`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.kinds, ['resistor', 'resistor', 'voltage_source']);
    assert.deepEqual(r.texts, ['12 V', '4 Ω', '6 Ω']);
    assert.deepEqual(r.warnings, []);
    // nothing across a and b: the 6 Ω takes 12 V × 6 / 10
    const R6 = r.el((e) => e.constructor.type === 'resistor' && e.p.r === 6);
    near(Math.abs(r.sim.v(R6.nodes[0]) - r.sim.v(R6.nodes[1])), 7.2, 1e-6, 'v across the 6 Ω');
  });
}

test('laid out as compactly as drawn by hand, turned or not: parts come out at their own size', async () => {
  const size = async (name) => {
    const c = (await readPicture(load(name))).circuits[0];
    const pts = [...c.parts.flatMap((p) => [p.from, p.to]), ...c.wires.flatMap((w) => [w.from, w.to])];
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  };
  // four branches side by side: three units wide, one tall (each part one unit long, as Claude
  // draws the same figure), the leads and the ground's stub folded away
  assert.deepEqual(await size('depsource.png'), [3, 1]);
  assert.deepEqual(await size('depsource-rough.jpg'), [3, 1]);
  // three meshes; a capacitor and a battery with long leads; open terminals keep their stubs
  assert.deepEqual(await size('meshes.png'), [2, 2]);
  assert.deepEqual(await size('rlc.png'), [2, 1]);
  assert.deepEqual(await size('thevenin.png'), [2, 1]);
});

test('nothing to read: a blank page says so', async () => {
  const w = 400, h = 300, data = new Uint8ClampedArray(w * h * 4).fill(235);
  const out = await readPicture({ width: w, height: h, data });
  assert.equal(out.circuits.length, 0);
  assert.match(out.problem, /No circuit/);
});

test('the character reader knows its classes and reads clean digits', () => {
  assert.ok(CLASSES.includes('Ω') && CLASSES.includes('v') && CLASSES.includes('.'));
  // a plain 1: a bar with a foot and a flag, 24 px tall
  const w = 10, h = 24, data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 4; x < 7; x++) data[y * w + x] = 1;
  for (let x = 1; x < 9; x++) data[(h - 1) * w + x] = data[(h - 2) * w + x] = 1;
  for (let k = 0; k < 4; k++) data[(2 + k) * w + 3 - Math.min(3, k)] = 1;
  const f = glyphFeatures({ w, h, data });
  assert.equal(f.length, 16 * 16 + 2);
  const p = classify({ w, h, data });
  const best = CLASSES[p.indexOf(Math.max(...p))];
  assert.ok(['1', 'I'].includes(best), `read as ${best}`);
});
