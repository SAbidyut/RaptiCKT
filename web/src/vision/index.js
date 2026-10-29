// Reading circuit diagrams from a picture on the phone itself — no network, no key. The answer
// has the same shape as the Claude reader's ({ circuits, problem }), so the photo screen and
// buildFromDrawing() treat both alike.

import { prepare } from './image.js';
import { findFigures } from './figures.js';
import { readStructure } from './circuit.js';
import { findText } from './text.js';
import { readWord } from './labels.js';
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
  const figs = readingOrder(F.figures);
  const circuits = [];
  for (let k = 0; k < figs.length; k++) {
    await step(0.3 + (0.65 * k) / Math.max(1, figs.length), `Reading circuit ${k + 1} of ${figs.length}`);
    const fig = figs[k];
    const S = readStructure(img, fig);
    const parts = S.parts.filter((q) => q.a != null && q.type !== 'loose');
    if (parts.length < 2) continue;
    const T = findText(img, fig, S);
    const words = T.words
      .filter((w) => w.glyphs.some((g) => g.y1 - g.y0 + 1 >= 0.45 * T.height))
      .map((w) => ({ ...w, read: readWord(w, T.height, img) }));
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
