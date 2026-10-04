// Text labels placed by the examples must not sit on a part, a value label, a wire or each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES, buildExample } from '../src/ui/examples.js';
import { Renderer } from '../src/ui/render.js';

const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

test('example text labels never overlap parts, value labels or wires', () => {
  const bad = [];
  for (const ex of EXAMPLES) {
    const doc = buildExample(ex);
    Renderer.prototype.chooseLabelSides.call({}, { doc, settings: { showNames: false } });
    for (const t of doc.elements.filter((e) => e.constructor.type === 'label')) {
      const r = t.worldBox();
      for (const e of doc.elements) {
        if (e === t) continue;
        if (ov(r, e.worldBox()) > 8) bad.push(`${ex.id}: "${t.p.text}" on ${e.name}`);
        const v = e.valueLabel();
        const lr = v && e.labelRect(v);
        if (lr && ov(r, lr) > 8) bad.push(`${ex.id}: "${t.p.text}" on ${e.name} "${v}"`);
      }
      const crosses = doc.wires.some((w) => w.pts.some((b, k) => {
        if (!k) return false;
        const a = w.pts[k - 1];
        return ov(r, [Math.min(a[0], b[0]) - 1, Math.min(a[1], b[1]) - 1, Math.max(a[0], b[0]) + 1, Math.max(a[1], b[1]) + 1]) > 4;
      }));
      if (crosses) bad.push(`${ex.id}: "${t.p.text}" crosses a wire`);
    }
  }
  assert.deepEqual(bad, []);
});
