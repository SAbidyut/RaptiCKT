// glyphs.bin (from render.py or hand.py) → features + labels.u8 with the app's own feature code:
// features.f32 (the printed-character model's), or features-hand.f32 with "hand" (the
// hand-writing model's).
//   node tools/glyphs/features.mjs DIR [hand]
import fs from 'node:fs';
import path from 'node:path';
import { glyphFeatures, glyphFeaturesHand } from '../../src/vision/glyph-features.js';

const dir = process.argv[2];
const hand = process.argv[3] === 'hand';
const fn = hand ? glyphFeaturesHand : glyphFeatures;
const buf = fs.readFileSync(path.join(dir, 'glyphs.bin'));
const feats = [], labels = [];
for (let i = 0; i < buf.length;) {
  const c = buf[i], w = buf[i + 1], h = buf[i + 2];
  i += 3;
  const data = buf.subarray(i, i + w * h);
  i += w * h;
  feats.push(fn({ w, h, data }));
  labels.push(c);
}
const D = feats[0].length;
const out = new Float32Array(feats.length * D);
feats.forEach((f, k) => out.set(f, k * D));
fs.writeFileSync(path.join(dir, hand ? 'features-hand.f32' : 'features.f32'), Buffer.from(out.buffer));
fs.writeFileSync(path.join(dir, 'labels.u8'), Buffer.from(Uint8Array.from(labels)));
console.log(feats.length, 'samples ×', D);
