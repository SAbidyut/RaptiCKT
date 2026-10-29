// Reading circuit diagrams from a picture on the phone itself — no network, no key. Each circuit
// comes out as a grid drawing ({ circuits, problem }) that buildFromDrawing() (ui/photo-circuit.js)
// turns into a board circuit.

import { prepare } from './image.js';
import { findFigures } from './figures.js';
import { readStructure, plateGap } from './circuit.js';
import { findText } from './text.js';
import { readWords } from './labels.js';
import { assignLabels } from './assign.js';
import { toDrawing } from './drawing.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Figures in reading order: column by column (a two-column page), each from the top. */
function readingOrder(figs) {
  const cols = [];
  for (const f of [...figs].sort((a, b) => a.box[0] - b.box[0])) {
    const c = cols.find((col) => col.some((g) => Math.min(g.box[2], f.box[2]) - Math.max(g.box[0], f.box[0]) > 0.3 * Math.min(g.box[2] - g.box[0], f.box[2] - f.box[0])));
    if (c) c.push(f); else cols.push([f]);
  }
  cols.sort((a, b) => Math.min(...a.map((f) => f.box[0])) - Math.min(...b.map((f) => f.box[0])));
  return cols.flatMap((c) => c.sort((a, b) => a.box[1] - b.box[1]));
}

/**
 * A capacitor or a battery drawn by hand with its plates wide apart can cut a drawing in two (or
 * more): join the figures whose loose plates face each other, and read the joined one again.
 * figs: [{ box, parts, near }], S: their structures. Returns the joined lists.
 */
export function joinAcrossPlates(img, figs, S) {
  for (;;) {
    const loose = S.map((s) => s.plates.filter((P) => !P.paired));
    let hit = null;
    for (let i = 0; i < figs.length && !hit; i++) {
      for (let j = i + 1; j < figs.length && !hit; j++) if (loose[i].some((P) => loose[j].some((Q) => plateGap(P, Q, img.sw) >= 0))) hit = [i, j];
    }
    if (!hit) return { figs, S };
    const [a, b] = hit.map((k) => figs[k]);
    const f = { box: [Math.min(a.box[0], b.box[0]), Math.min(a.box[1], b.box[1]), Math.max(a.box[2], b.box[2]), Math.max(a.box[3], b.box[3])], parts: [...a.parts, ...b.parts], near: [...a.near, ...b.near] };
    figs = [...figs.filter((_, k) => !hit.includes(k)), f];
    S = [...S.filter((_, k) => !hit.includes(k)), readStructure(img, f)];
  }
}

/**
 * Read every circuit diagram in a picture ({ width, height, data } RGBA, e.g. canvas ImageData).
 * onProgress(fraction, what) is called as it goes; the work yields between figures so the page
 * stays responsive. Returns { circuits: [drawing], problem }.
 */
export async function readPicture(picture, { onProgress, signal } = {}) {
  const step = async (f, what) => { onProgress?.(f, what); await tick(); if (signal?.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); };
  await step(0.05, 'Cleaning up the picture');
  const p = prepare(picture);
  await step(0.25, 'Finding the circuits');
  const F = findFigures(p.ink, p.w, p.h, p.sw);
  const img = { ...p, labels: F.labels, comps: F.comps };
  let figs = readingOrder(F.figures), all = [];
  for (let k = 0; k < figs.length; k++) {
    await step(0.3 + (0.3 * k) / figs.length, 'Finding the parts');
    all.push(readStructure(img, figs[k]));
  }
  ({ figs, S: all } = joinAcrossPlates(img, figs, all));
  const order = readingOrder(figs);
  all = order.map((f) => all[figs.indexOf(f)]);
  figs = order;
  const circuits = [];
  for (let k = 0; k < figs.length; k++) {
    await step(0.6 + (0.35 * k) / Math.max(1, figs.length), `Reading circuit ${k + 1} of ${figs.length}`);
    const fig = figs[k], S = all[k];
    const parts = S.parts.filter((q) => q.a != null && q.type !== 'loose');
    if (parts.length < 2) continue;
    const T = findText(img, fig, S);
    const R = readWords(T.words, T.height, img, T.tilt);
    const words = R.words.map((w, k) => ({ ...w, read: R.reads[k] }));
    const A = assignLabels(S, words, T.arrows, T.height, fig);
    const D = toDrawing(S, p.sw, { title: A.title || `Circuit ${circuits.length + 1}`, labels: A.labels, quantities: A.quantities, asked: A.quantities.map((q) => q.name) });
    D.notes = [...A.notes, ...D.notes];
    circuits.push(D);
  }
  await step(1, 'Done');
  return {
    circuits,
    problem: circuits.length ? '' : 'No circuit diagram was found in this picture. Photograph the drawing straight on, with its wires sharp and the whole circuit in the frame.',
  };
}
