// Circuit from photo, read on the phone (no network): textbook-style drawings — clean, as grey,
// grainy, slightly turned photos, and as rough ones (turned further, dusty, small, squeezed hard)
// — and drawings made by hand, in pen, labels written by hand (tests/fixtures, made by
// tools/glyphs/figures.py) are read into circuits whose parts, values, marked quantities and
// answers are right; so are they on ruled or squared paper and photographed well turned, a
// practice problem printed in a book's own style, a bridge drawn as a diamond, conductances in
// siemens, mesh currents drawn as round arrows, values printed as fractions, and a circuit drawn
// here with an open switch and a coil drawn in loops.
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

for (const name of ['sketch-divider.png', 'sketch-divider-photo.jpg']) {
  test(`${name}: a divider drawn by hand, + Vₒ − written across the 3 Ω — Vₒ = 9 V`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.kinds, ['resistor', 'resistor', 'resistor', 'voltage_source']);
    assert.deepEqual(r.texts, ['18 V', '2 Ω', '3 Ω', '6 Ω']);
    const q = r.c.quantities.find((x) => x.kind === 'voltage_across');
    assert.ok(q && /^v[o0]$/.test(q.name), 'the + Vₒ − marking is read');
    assert.equal(r.c.parts[q.part].text, '3 Ω');
    const R3 = r.el((e) => e.constructor.type === 'resistor' && e.p.r === 3);
    near(Math.abs(r.sim.v(R3.nodes[0]) - r.sim.v(R3.nodes[1])), 9, 1e-6, 'Vo');
  });
}

for (const name of ['sketch-mesh.png', 'sketch-mesh-photo.jpg']) {
  test(`${name}: a battery and a current source drawn by hand, i marked down the 4 Ω — i = 7/3 A`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.kinds, ['current_source', 'resistor', 'resistor', 'voltage_source']);
    assert.deepEqual(r.texts, ['10 V', '2 A', '2 Ω', '4 Ω']);
    const q = r.c.quantities.find((x) => x.name === 'i');
    assert.ok(q && q.kind === 'current_through', 'the hand-drawn arrow and its i are read');
    assert.equal(r.c.parts[q.part].text, '4 Ω');
    const R4 = r.el((e) => e.constructor.type === 'resistor' && e.p.r === 4);
    near(Math.abs(R4.i), 7 / 3, 1e-6, 'i');
  });
}

for (const name of ['sketch-rlc.png', 'sketch-rlc-photo.jpg']) {
  test(`${name}: a coil and a capacitor drawn by hand, with their units written by hand`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.kinds, ['capacitor', 'inductor', 'resistor', 'voltage_source']);
    const by = (k) => r.c.parts.find((p) => p.kind === k);
    assert.equal(by('capacitor').value, 1e-5);
    assert.equal(by('inductor').value, 2e-3);
    assert.equal(by('resistor').value, 1000);
    assert.equal(by('voltage_source').value, 5);
    assert.ok(r.c.ground.length >= 1, 'the ground is read');
  });
}

/** The picture on a page of ruled (or squared) paper: blue lines, a little aslant, under the ink. */
function onPaper(pic, gap, squared) {
  const { width: w, height: h } = pic, data = Uint8ClampedArray.from(pic.data);
  const lay = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = 4 * (y * w + x);
    [110, 140, 200].forEach((v, c) => { data[i + c] = Math.min(data[i + c], v); });
  };
  for (let y0 = gap / 2; y0 < h + 0.02 * w; y0 += gap) for (let x = 0; x < w; x++) { const y = Math.round(y0 - 0.02 * x); lay(x, y); lay(x, y + 1); }
  if (squared) for (let x0 = gap / 2; x0 < w + 0.02 * h; x0 += gap) for (let y = 0; y < h; y++) { const x = Math.round(x0 + 0.02 * y - 0.02 * h); lay(x, y); lay(x + 1, y); }
  return { width: w, height: h, data };
}

/** The picture photographed turned by deg degrees: white beyond its edges. */
function turned(pic, deg) {
  const { width: w, height: h, data } = pic, a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const W = Math.ceil(Math.abs(w * c) + Math.abs(h * s)), H = Math.ceil(Math.abs(w * s) + Math.abs(h * c));
  const out = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const dx = X - W / 2, dy = Y - H / 2, x = Math.round(c * dx + s * dy + w / 2), y = Math.round(-s * dx + c * dy + h / 2);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      for (let k = 0; k < 4; k++) out[4 * (Y * W + X) + k] = data[4 * (y * w + x) + k];
    }
  }
  return { width: W, height: H, data: out };
}

const parts = (c) => c.parts.map((p) => `${p.kind} ${p.text}`).sort();
for (const [name, what, make] of [
  ['sketch-rlc.png', 'on ruled paper', (p) => onPaper(p, 40, false)],
  ['sketch-divider.png', 'on squared paper', (p) => onPaper(p, 40, true)],
  ['meshes.png', 'on ruled paper', (p) => onPaper(p, 40, false)],
  ['meshes.png', 'on squared paper', (p) => onPaper(p, 40, true)],
  ['sketch-rlc.png', 'photographed turned by 12°', (p) => turned(p, 12)],
  ['meshes.png', 'photographed turned by −15°', (p) => turned(p, -15)],
]) {
  test(`${name} ${what}: read as on a clean page, straight`, async () => {
    const clean = (await readPicture(load(name))).circuits[0];
    const out = await readPicture(make(load(name)));
    assert.equal(out.circuits.length, 1, out.problem);
    const c = out.circuits[0];
    assert.deepEqual(parts(c), parts(clean));
    assert.deepEqual(c.quantities.map((q) => q.name), clean.quantities.map((q) => q.name));
  });
}

test('drawn in code: a switch left open and a coil drawn in loops (a spring seen from the side)', async () => {
  const w = 820, h = 600, data = new Uint8ClampedArray(w * h * 4).fill(255);
  const dot = (x, y) => {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const X = Math.round(x + dx), Y = Math.round(y + dy);
      if (dx * dx + dy * dy <= 6.25 && X >= 0 && Y >= 0 && X < w && Y < h) data.fill(30, 4 * (Y * w + X), 4 * (Y * w + X) + 3);
    }
  };
  const stroke = (pts) => {
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let t = 0; t <= n; t++) dot(x0 + ((x1 - x0) * t) / n, y0 + ((y1 - y0) * t) / n);
    }
  };
  const coil = [];
  for (let t = 0; t <= 8 * Math.PI; t += 0.05) coil.push([700 + 24 * Math.sin(t), 246 + (30 * t) / (2 * Math.PI) - 16 * Math.cos(t)]);
  const end = coil[coil.length - 1];
  const zig = [[340, 500]];
  for (let k = 0; k < 6; k++) zig.push([350 + 20 * k, 500 + (k % 2 ? 16 : -16)]);
  zig.push([460, 500]);
  for (const s of [
    [[100, 280], [100, 100], [300, 100]], [[300, 100], [392, 58]], [[400, 100], [700, 100], [700, 230]], coil,
    [end, [700, 500], [460, 500]], zig, [[340, 500], [100, 500], [100, 312]], [[60, 280], [140, 280]], [[80, 312], [120, 312]],
  ]) stroke(s);
  const out = await readPicture({ width: w, height: h, data });
  assert.equal(out.circuits.length, 1, out.problem);
  const c = out.circuits[0];
  assert.deepEqual(c.parts.map((p) => p.kind).sort(), ['inductor', 'open_switch', 'resistor', 'voltage_source']);
  const { doc } = buildFromDrawing(c);
  const sw = doc.elements.find((e) => e.constructor.type === 'switch');
  assert.equal(sw.p.closed, false, 'the switch is drawn open');
});

for (const name of ['practice.png', 'practice-photo.jpg']) {
  test(`${name}: a book's practice problem — a two-cell battery, a current source drawn on its wire, the asked currents marked by arrowheads on the wires and named I_A, I_B — I_A = 2 A, I_B = −0.5 A`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.texts, ['1 Ω', '1 Ω', '2 Ω', '2 Ω', '3 Ω', '7 A', '7 V']);
    assert.deepEqual(r.c.quantities.map((q) => `${q.name}:${q.kind}`).sort(), ['IA:current_through', 'IB:current_through']);
    // the current through a marked resistor, the way its arrowhead points
    const resistors = r.doc.elements.filter((e) => e.constructor.type === 'resistor'), drawn = r.c.parts.filter((p) => p.kind === 'resistor');
    const current = (name2) => {
      const q = r.c.quantities.find((x) => x.name === name2);
      const el = resistors[drawn.indexOf(r.c.parts[q.part])];
      const [v0, v1] = el.nodes.map((n) => r.sim.v(n));
      return (q.positive === 'to' ? v0 - v1 : v1 - v0) / el.p.r;
    };
    near(current('IA'), 2, 1e-6, 'I_A');
    near(current('IB'), -0.5, 1e-6, 'I_B');
  });
}

// the current through each resistor, by its value (size only)
const currents = (r) => new Map(r.doc.elements.filter((e) => e.constructor.type === 'resistor').map((e) => [e.p.r, Math.abs(r.sim.v(e.nodes[0]) - r.sim.v(e.nodes[1])) / e.p.r]));

for (const name of ['bridge.png', 'bridge-photo.jpg']) {
  test(`${name}: a bridge drawn as a diamond, its sides slanting, is laid along the grid joined as drawn — 71/46 A through the 2 Ω, 9/23 A across the middle`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.texts, ['10 V', '2 Ω', '3 Ω', '4 Ω', '5 Ω', '6 Ω']);
    const I = currents(r);
    near(I.get(6), 53 / 46, 1e-6, '6 Ω');
    near(I.get(3), 38 / 23, 1e-6, '3 Ω');
    near(I.get(2), 71 / 46, 1e-6, '2 Ω');
    near(I.get(4), 29 / 23, 1e-6, '4 Ω');
    near(I.get(5), 9 / 23, 1e-6, '5 Ω');
    // every part and wire level or upright on the board
    for (const e of [...r.c.parts, ...r.c.wires]) assert.ok(e.from.x === e.to.x || e.from.y === e.to.y, 'laid along the grid');
  });
}

for (const name of ['siemens.png', 'siemens-photo.jpg']) {
  test(`${name}: conductances in siemens are resistors of 1/G — 6 A into 2 S and 4 S, 1 V across`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.texts, ['2 S', '4 S', '6 A']);
    const I = currents(r);
    near(I.get(0.5), 2, 1e-6, '2 S');
    near(I.get(0.25), 4, 1e-6, '4 S');
  });
}

for (const name of ['meshcurrents.png', 'meshcurrents-photo.jpg']) {
  test(`${name}: mesh currents drawn as round arrows inside their meshes are no parts, and the evenly spaced wires of a figure cut close round it stay — 2.4 A from the 12 V`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.kinds, ['resistor', 'resistor', 'resistor', 'resistor', 'voltage_source']);
    assert.deepEqual(r.texts, ['12 V', '2 Ω', '3 Ω', '3 Ω', '6 Ω']);
    const I = currents(r);
    near(I.get(2), 2.4, 1e-6, '2 Ω');
    near(I.get(6), 1.2, 1e-6, '6 Ω');
    near(I.get(3), 1.2, 1e-6, '3 Ω');
  });
}

for (const name of ['fractions.png', 'fractions-photo.jpg']) {
  test(`${name}: values printed as fractions — ½ H, ¼ F — are read as their quotients`, async () => {
    const r = await solve(name);
    assert.deepEqual(r.texts, ['1/2 H', '1/4 F', '2 Ω', '6 V']);
    near(r.c.parts.find((p) => p.kind === 'inductor').value, 0.5, 1e-12, 'L');
    near(r.c.parts.find((p) => p.kind === 'capacitor').value, 0.25, 1e-12, 'C');
  });
}

test('laid out as compactly as drawn by hand, turned or not: parts come out at their own size', async () => {
  const size = async (name) => {
    const c = (await readPicture(load(name))).circuits[0];
    const pts = [...c.parts.flatMap((p) => [p.from, p.to]), ...c.wires.flatMap((w) => [w.from, w.to])];
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  };
  // four branches side by side: three units wide, one tall (each part one unit long, as the
  // figure is drawn by hand), the leads and the ground's stub folded away
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
