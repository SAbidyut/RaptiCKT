// "Circuit from photo": take a picture of a circuit diagram (or choose one), have it read on the
// phone itself (no network), check the redrawn circuit, and open it on the board ready to run.

import { icon } from './icons.js';
import { bridge, decodeImage } from './store.js';
import { THEMES } from './theme.js';
import { fmtSI } from '../engine/units.js';
import { drawFigure } from './theorem-figs.js';
import { buildFromDrawing } from './photo-circuit.js';
import { readPicture } from '../vision/index.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// the picture's long side (px): detail enough for small labels
const SIZE = 2600;

/** A failure the reader can act on: `code` picks the advice shown. */
class PhotoError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const ADVICE = {
  bad: 'Try another picture (JPEG or PNG).',
  offline: 'Try a sharper, straighter photo, with the whole circuit in the frame.',
};

/** what a part shows in the summary chips: "R1 20 Ω", "V1 20 V", "D1 0.1vx" */
function partLabel(e) {
  const t = e.constructor.type, p = e.p;
  if (t === 'resistor') return `${e.name} ${fmtSI(p.r, 'Ω', 4)}`;
  if (t === 'dcv' || t === 'acv') return `${e.name} ${fmtSI(p.amp, 'V', 4)}`;
  if (t === 'dci' || t === 'aci') return `${e.name} ${fmtSI(p.amp, 'A', 4)}`;
  if (t === 'capacitor') return `${e.name} ${fmtSI(p.c, 'F', 4)}`;
  if (t === 'inductor') return `${e.name} ${fmtSI(p.l, 'H', 4)}`;
  if (t === 'switch') return `${e.name} ${p.closed ? 'closed' : 'open'}`;
  if (t === 'depsrc') return `${e.name} ${e.valueLabel()}`;
  return e.name;
}
const PARTS = new Set(['resistor', 'dcv', 'acv', 'dci', 'aci', 'capacitor', 'inductor', 'switch', 'depsrc']);

export class PhotoScreen {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.stage = 'start'; // start | reading | result | error
    this.image = null;    // { data, mediaType }
    this.answer = null;   // { circuits, problem }
    this.pick = 0;        // which circuit of a page with several
    this.error = null;
    this.abort = null;
  }

  get settings() { return this.app.settings; }
  theme() { return THEMES[this.settings.theme] || THEMES.dark; }

  open() {
    if (this.stage !== 'reading') this.stage = this.answer ? 'result' : 'start';
    this.render();
  }

  /** Back button: a result or an error goes back to the start first. Returns false to close. */
  back() {
    if (this.stage === 'reading') { this.cancel(); return true; }
    if (this.stage === 'result' || this.stage === 'error') { this.stage = 'start'; this.render(); return true; }
    return false;
  }

  render() {
    this.root.innerHTML = `
      <header class="an-head ph-head">
        <button class="icon-btn" data-x="back" title="Back">${icon('back', 22)}</button>
        <div class="lf-title"><b>Circuit from photo</b><span>A picture of a circuit diagram → a circuit you can run</span></div>
      </header>
      <div class="an-body ph-body"></div>`;
    this.root.querySelector('[data-x=back]').addEventListener('click', () => { if (!this.back()) this.app.closePhoto(); });
    const body = this.root.querySelector('.ph-body');
    if (this.stage === 'reading') this.renderReading(body);
    else if (this.stage === 'result') this.renderResult(body);
    else if (this.stage === 'error') this.renderError(body);
    else this.renderStart(body);
  }

  // ---------------------------------------------------------------- start
  renderStart(body) {
    body.innerHTML = `
      <div class="ph-hero">
        <span class="ph-ico">${icon('camera', 30)}</span>
        <p>Photograph a circuit diagram — a textbook figure, an exam question, a neat drawing — and it is redrawn on the board with its values, ready to run.</p>
      </div>
      <p class="ph-intro">Read on this phone — no internet needed. Printed diagrams (textbooks, exam papers, screenshots) and neat sketches drawn by hand: wires, resistors, sources, dependent sources, capacitors, coils, grounds and their values.</p>
      <div class="ph-btns">
        <button class="btn primary big" data-x="camera">${icon('camera', 20)} Take a photo</button>
        <button class="btn big" data-x="gallery">${icon('upload', 20)} Choose an image</button>
      </div>
      <h4>For the best result</h4>
      <ul class="ph-tips">
        <li>Hold the phone flat over the page, with the whole circuit in the frame and in focus.</li>
        <li>Good light and no shadow across the drawing; every value should be readable.</li>
        <li>One circuit per photo reads best. A page with several figures works too — you pick one.</li>
        <li>Always check the redrawn circuit against the picture before trusting the answer.</li>
      </ul>`;
    body.querySelector('[data-x=camera]').addEventListener('click', () => this.take(true));
    body.querySelector('[data-x=gallery]').addEventListener('click', () => this.take(false));
  }

  async take(camera) {
    let img;
    try { img = await bridge.pickImage(camera, SIZE); } catch (e) {
      if (e && e.message && e.message !== 'cancelled') { this.fail(new PhotoError('bad', 'Could not open the picture: ' + e.message)); }
      return;
    }
    if (!img || !img.data) return;
    this.image = img;
    this.read();
  }

  // ---------------------------------------------------------------- reading
  async read() {
    this.stage = 'reading';
    this.answer = null;
    this.pick = 0;
    this.step = null;
    const ctl = new AbortController();
    this.abort = ctl;
    this.render();
    try {
      const out = await this.readOffline(ctl.signal);
      if (this.abort !== ctl) return;
      this.abort = null;
      this.answer = out;
      this.stage = 'result';
      this.render();
    } catch (e) {
      if (this.abort !== ctl) return;
      this.abort = null;
      if (e instanceof PhotoError && e.code === 'cancelled') { this.stage = 'start'; this.render(); return; }
      this.fail(e instanceof PhotoError ? e : new PhotoError('offline', String(e?.message || e)));
    } finally {
      clearInterval(this.timer);
    }
  }

  /** Read the picture on the phone: its pixels, then the circuits in them. */
  async readOffline(signal) {
    let pixels;
    try { pixels = await decodeImage(this.image); } catch (e) { throw new PhotoError('bad', 'This picture could not be opened.'); }
    try {
      return await readPicture(pixels, { signal, onProgress: (f, what) => { this.step = { f, what }; this.tick(); } });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new PhotoError('cancelled', 'Cancelled.');
      throw new PhotoError('offline', 'The picture could not be read on the phone.');
    }
  }

  cancel() {
    const c = this.abort;
    this.abort = null;
    clearInterval(this.timer);
    c?.abort();
    this.stage = 'start';
    this.render();
  }

  renderReading(body) {
    body.innerHTML = `
      <div class="ph-shot reading"><img alt="" src="data:${esc(this.image.mediaType)};base64,${this.image.data}"><i class="ph-scan"></i></div>
      <p class="ph-status"><b>Reading the circuit on this phone…</b><span class="ph-sub"></span></p>
      <div class="splash-bar ph-bar"><i></i></div>
      <div class="btn-row"><button class="btn" data-x="cancel">${icon('x', 18)} Cancel</button></div>`;
    body.querySelector('[data-x=cancel]').addEventListener('click', () => this.cancel());
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000);
    this.tick();
  }

  tick() {
    const s = this.root.querySelector('.ph-sub');
    if (s) s.textContent = this.step ? `${this.step.what}… ${Math.round(this.step.f * 100)} %` : 'Opening the picture…';
  }

  // ---------------------------------------------------------------- result
  built() {
    const c = this.answer.circuits[this.pick];
    return c ? buildFromDrawing(c) : null;
  }

  renderResult(body) {
    const list = this.answer.circuits || [];
    const problem = (this.answer.problem || '').trim();
    if (!list.length) {
      body.innerHTML = `
        <div class="ph-empty">${icon('info', 22)}<div><b>No circuit could be read from this picture</b><span>${esc(problem || 'Try a sharper photo of the circuit diagram.')}</span></div></div>
        <div class="btn-row"><button class="btn primary big" data-x="again">${icon('camera', 18)} Another photo</button></div>`;
      body.querySelector('[data-x=again]').addEventListener('click', () => { this.stage = 'start'; this.render(); });
      return;
    }
    if (this.pick >= list.length) this.pick = 0;
    const b = this.built();
    const parts = b.doc.elements.filter((e) => PARTS.has(e.constructor.type));
    const c = list[this.pick];
    body.innerHTML = `
      ${list.length > 1 ? `<p class="th-q">This picture has ${list.length} circuits. <span>Pick one.</span></p>
        <div class="th-chips">${list.map((x, i) => `<button class="chip2 ${i === this.pick ? 'on' : ''}" data-c="${i}">${esc(x.title || 'Circuit ' + (i + 1))}</button>`).join('')}</div>` : ''}
      <div class="ph-title"><b>${esc(this.app.photoName(c.title))}</b><span>${parts.length} part${parts.length === 1 ? '' : 's'} · check it against the picture</span></div>
      <canvas class="th-fig ph-fig"></canvas>
      <details class="ph-orig"><summary>${icon('camera', 16)} The photo</summary><img alt="" src="data:${esc(this.image.mediaType)};base64,${this.image.data}"></details>
      <div class="ph-parts">${parts.map((e) => `<span>${esc(partLabel(e))}</span>`).join('')}</div>
      ${[...(c.notes || []), ...b.warnings].map((w) => `<div class="th-warn">${icon('info', 16)}<span>${esc(w)}</span></div>`).join('')}
      ${problem ? `<div class="ph-note">${icon('info', 16)}<span>${esc(problem)}</span></div>` : ''}
      ${b.asked.length ? `<p class="ph-asked">Asked to find <b>${b.asked.map(esc).join(', ')}</b>. Press <b>Run</b> on the board: the live labels show every voltage and current.</p>` : ''}
      <div class="btn-row ph-go">
        <button class="btn primary big" data-x="open">${icon('play', 18)} Open on the board</button>
        <button class="btn" data-x="again">${icon('camera', 18)} Another photo</button>
      </div>
      <p class="ph-by">Read on this phone. A part or a value read wrong? Fix it on the board.</p>`;
    const cv = body.querySelector('.ph-fig');
    requestAnimationFrame(() => drawFigure(cv, { doc: b.doc, hi: new Set(), notes: [], load: null }, this.theme(), this.settings, 340));
    body.querySelectorAll('[data-c]').forEach((x) => x.addEventListener('click', () => { this.pick = +x.dataset.c; this.render(); }));
    body.querySelector('[data-x=open]').addEventListener('click', () => this.app.openFromPhoto(this.built().doc));
    body.querySelector('[data-x=again]').addEventListener('click', () => { this.stage = 'start'; this.render(); });
  }

  // ---------------------------------------------------------------- error
  fail(e) {
    this.error = e;
    this.stage = 'error';
    this.render();
  }

  renderError(body) {
    const e = this.error || new PhotoError('offline', 'Something went wrong.');
    body.innerHTML = `
      <div class="ph-empty bad">${icon('info', 22)}<div><b>${esc(e.message)}</b><span>${esc(ADVICE[e.code] || ADVICE.offline)}</span></div></div>
      <div class="btn-row"><button class="btn primary big" data-x="again">${icon('camera', 18)} Another photo</button></div>`;
    body.querySelector('[data-x=again]').addEventListener('click', () => { this.stage = 'start'; this.render(); });
  }
}
