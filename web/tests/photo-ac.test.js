// Circuit from photo, AC circuits drawn the way a circuits book draws them (Alexander & Sadiku,
// ch. 10 and 13; tests/fixtures made by tools/glyphs/figures.py): a circuit in the phasor domain
// (10∠30° V with its angle sign, j4 Ω, −j2 Ω), coupled coils with their dots and the curved
// arrow marked jωM, and a source in the time domain (12 cos 2t V). Each is read into a circuit
// whose phasor solution is the one of the circuit drawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { readPicture } from '../src/vision/index.js';
import { buildFromDrawing } from '../src/ui/photo-circuit.js';
import { prepareAC, runACTheorem } from '../src/engine/theorem-ac.js';
import { parseLabel } from '../src/vision/labels.js';

function load(name) {
  const buf = fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
  if (name.endsWith('.png')) { const p = PNG.sync.read(buf); return { width: p.width, height: p.height, data: p.data }; }
  const j = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { width: j.width, height: j.height, data: j.data };
}

/** read the picture into its board circuit; the phasor current in the resistor of `ohms` */
async function read(name, ohms) {
  const out = await readPicture(load(name));
  assert.equal(out.circuits.length, 1, `${name}: one circuit (${out.problem})`);
  const c = out.circuits[0];
  const { doc } = buildFromDrawing(c);
  doc.assignNames();
  const prep = prepareAC(doc);
  assert.deepEqual(prep.bad, [], `${name}: every part is an AC part`);
  const t = prep.targets.find((x) => x.el.constructor.type === 'resistor' && Math.abs(x.el.p.r - ohms) < 1e-9);
  assert.ok(t, `${name}: the ${ohms} Ω resistor`);
  let r = runACTheorem(prep, 'nodal', t.src);
  if (!r.ok) r = runACTheorem(prep, 'mesh', t.src);
  assert.ok(r.ok, r.error);
  return { c, doc, I: r.answer.I, texts: c.parts.map((p) => p.text).sort() };
}
const mag = (z) => Math.hypot(z[0], z[1]);
const deg = (z) => (Math.atan2(z[1], z[0]) * 180) / Math.PI;
const near = (z, m, a, what) => {
  assert.ok(Math.abs(mag(z) - m) < 1e-3 * m, `${what}: |I| = ${mag(z)}, not ${m}`);
  if (a != null) assert.ok(Math.abs((((deg(z) - a) % 360) + 540) % 360 - 180) < 0.05, `${what}: ∠${deg(z)}, not ${a}`);
};

for (const name of ['phasor-nodal.png', 'phasor-nodal-photo.jpg', 'phasor-nodal-rough.jpg']) {
  test(`${name}: a circuit drawn in the phasor domain (2∠0° A, 6∠−45° V, j3 Ω, −j4 Ω) reads and solves`, async () => {
    const { doc, I, texts } = await read(name, 8);
    // (on the rough photo a unit may not read; the values all must)
    if (!/rough/.test(name)) assert.deepEqual(texts, ['2∠0° A', '5 Ω', '6∠-45° V', '8 Ω', 'j3 Ω', '−j4 Ω'].sort());
    assert.equal(doc.domain, 'phasor', 'opens in the phasor domain, labelled as drawn');
    near(I, 0.07231, -121.39, 'I in the 8 Ω');
  });
}

test('phasor-coupled-photo.jpg: coupled coils with their dots and jωM read, M with the right sign', async () => {
  const { c, doc, I, texts } = await read('phasor-coupled-photo.jpg', 6);
  assert.deepEqual(texts, ['10∠30° V', '4 Ω', '6 Ω', 'j3 Ω', 'j5 Ω', '−j2 Ω'].sort());
  assert.equal(c.mutuals.length, 1, 'the curved arrow is a mutual inductance');
  assert.equal(c.parts.filter((p) => p.dot).length, 2, 'both dots seen');
  const M = doc.elements.find((e) => e.constructor.type === 'mutual');
  assert.ok(M && Math.abs(M.p.m - 2) < 1e-9, 'M = 2 H at ω = 1 rad/s (j2 Ω)');
  near(I, 0.7198, 60.26, 'I in the 6 Ω'); // the dots on the wrong ends would give another answer
});

test('cos-source-photo.jpg: "12 cos 2t V" is a cosine source at ω = 2 rad/s, in the time domain', async () => {
  const { c, doc, I } = await read('cos-source-photo.jpg', 4);
  const src = doc.elements.find((e) => e.constructor.type === 'acv');
  assert.ok(src, 'an AC voltage source');
  assert.equal(src.p.wave, 'cos');
  assert.equal(src.p.amp, 12);
  assert.ok(Math.abs(src.p.freq * 2 * Math.PI - 2) < 1e-9, 'ω = 2 rad/s');
  assert.equal(doc.domain, 'time', 'drawn in the time domain, opened so');
  assert.ok(c.parts.some((p) => p.kind === 'inductor' && p.text === '2 H'));
  near(I, 2.1213, null, 'I in the 4 Ω');
});

test('labels the book’s way: time functions and reactances', () => {
  const chars = (s) => [...s].map((ch) => ({ c: ch, sub: false, small: false }));
  const a = parseLabel(chars('20cos4tv'));
  assert.equal(a.type, 'value'); assert.equal(a.value, 20); assert.equal(a.wave, 'cos'); assert.equal(a.omega, 4); assert.equal(a.unit, 'V');
  const b = parseLabel(chars('10sin2tA'));
  assert.equal(b.wave, 'sin'); assert.equal(b.unit, 'A'); assert.equal(b.omega, 2);
  const z = parseLabel(chars('-j2.5Ω'));
  assert.equal(z.imag, true); assert.equal(z.value, -2.5);
});
