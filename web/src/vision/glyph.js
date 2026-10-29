// Reading one printed character: its bitmap scaled into a 16 × 16 grid of ink coverage, plus
// its shape, into a small neural network trained on characters rendered in textbook fonts and
// spoiled like phone photos (tools/glyphs). The same features train and run the network.

import { MODEL } from './glyph-model.js';
import { glyphFeatures } from './glyph-features.js';

export { glyphFeatures };

export const CLASSES = MODEL.classes;
/** each class's usual log(width / height): [low, high] */
export const ASPECT = MODEL.aspect || {};

let net = null;
function load() {
  if (net) return net;
  const dec = (b64, n, scale) => {
    const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = bin.charCodeAt(i); if (v > 127) v -= 256; out[i] = v * scale; }
    return out;
  };
  net = MODEL.layers.map((L) => ({ inp: L.inp, out: L.out, w: dec(L.w, L.inp * L.out, L.scale), b: Float32Array.from(L.b) }));
  return net;
}

/** Class probabilities of a character bitmap: Float32Array, one per CLASSES entry. */
export function classify(bm) {
  let x = glyphFeatures(bm);
  const layers = load();
  layers.forEach((L, k) => {
    const y = new Float32Array(L.out);
    for (let j = 0; j < L.out; j++) {
      let s = L.b[j];
      const row = j * L.inp;
      for (let i = 0; i < L.inp; i++) s += L.w[row + i] * x[i];
      y[j] = k < layers.length - 1 ? Math.max(0, s) : s;
    }
    x = y;
  });
  let m = -Infinity;
  for (const v of x) m = Math.max(m, v);
  let z = 0;
  for (let i = 0; i < x.length; i++) { x[i] = Math.exp(x[i] - m); z += x[i]; }
  for (let i = 0; i < x.length; i++) x[i] /= z;
  return x;
}

/** The k likeliest classes: [{ c, p }]. */
export function topK(probs, k = 3) {
  return [...probs].map((p, i) => ({ c: CLASSES[i], p })).sort((a, b) => b.p - a.p).slice(0, k);
}
