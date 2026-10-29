// Reading one character: its bitmap scaled into a 16 × 16 grid of ink coverage, plus its shape,
// into a small neural network. Two of them: one trained on characters rendered in textbook fonts
// and spoiled like phone photos, one also on characters written by hand (tools/glyphs). The same
// features train and run the networks.

import { MODEL } from './glyph-model.js';
import { MODEL as HAND } from './glyph-model-hand.js';
import { glyphFeatures, glyphFeaturesHand } from './glyph-features.js';

export { glyphFeatures, glyphFeaturesHand };

export const CLASSES = MODEL.classes;
if (HAND.classes.join() !== CLASSES.join()) throw new Error('glyph models disagree on their classes');
/** each class's usual log(width / height): [low, high], printed and hand-written */
export const ASPECT = MODEL.aspect || {};
export const HAND_ASPECT = HAND.aspect || {};

const nets = new Map();
function load(model) {
  if (nets.has(model)) return nets.get(model);
  const dec = (b64, n, scale) => {
    const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = bin.charCodeAt(i); if (v > 127) v -= 256; out[i] = v * scale; }
    return out;
  };
  const net = model.layers.map((L) => ({ inp: L.inp, out: L.out, w: dec(L.w, L.inp * L.out, L.scale), b: Float32Array.from(L.b) }));
  nets.set(model, net);
  return net;
}

/**
 * Class probabilities of a character bitmap: Float32Array, one per CLASSES entry. hand: read it
 * as hand-writing (the network that has also seen hand-written characters).
 */
export function classify(bm, hand = false) {
  const model = hand ? HAND : MODEL;
  let x = model.features === 'hand' ? glyphFeaturesHand(bm) : glyphFeatures(bm);
  const layers = load(model);
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
