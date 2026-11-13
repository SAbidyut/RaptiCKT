// "Circuit from photo": take a picture of a circuit diagram (or choose one), crop it to the
// circuit, have it read on the phone itself (no network), check the redrawn circuit, and open it
// on the board ready to run.

import { icon } from './icons.js';
import { bridge, decodeImage } from './store.js';
import { THEMES } from './theme.js';
import { fmtSI, parseSI } from '../engine/units.js';
import { drawFigure } from './theorem-figs.js';
import { buildFromDrawing } from './photo-circuit.js';
import { readPicture } from '../vision/index.js';
import { esc } from './html.js';

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

/** Pixels ({ width, height, data }) as a JPEG picture to show: { data (base64), mediaType }. */
function picture({ width, height, data }) {
  const cv = document.createElement('canvas');
  cv.width = width; cv.height = height;
  cv.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
  return { data: cv.toDataURL('image/jpeg', 0.9).split(',')[1], mediaType: 'image/jpeg' };
}

/**
 * What a part read from the photo can be changed into in the list under the drawing (a part read
 * wrong: a resistor read as a coil, a source read as a resistor …): [kind, name, unit].
 * 'wire': it was no part at all, just a wire.
 */
const KINDS = [
  ['resistor', 'Resistor', 'Ω'], ['inductor', 'Coil (inductor)', 'H'], ['capacitor', 'Capacitor', 'F'],
  ['voltage_source', 'DC voltage source', 'V'], ['current_source', 'DC current source', 'A'],
  ['ac_voltage_source', 'AC voltage source', 'V'], ['ac_current_source', 'AC current source', 'A'],
  ['dependent_voltage_source', 'Dependent voltage source', '×'], ['dependent_current_source', 'Dependent current source', '×'],
  ['open_switch', 'Switch (open)', ''], ['closed_switch', 'Switch (closed)', ''],
  ['wire', 'Just a wire (no part)', ''],
];
// semiconductors: each changes only to its own kind's other forms (a diode to a zener or an
// LED, an npn to a pnp …); the value is a zener's voltage, a transistor's β, a JFET's IDSS (a
// MOSFET's threshold and k are set on the board)
const SEMIS = [
  ['diode', 'Diode', ''], ['zener', 'Zener diode', 'V'], ['led', 'LED', ''],
  ['npn', 'NPN transistor', 'β'], ['pnp', 'PNP transistor', 'β'],
  ['njfet', 'N-channel JFET', 'A'], ['pjfet', 'P-channel JFET', 'A'],
  ['nmos', 'N-channel MOSFET', ''], ['pmos', 'P-channel MOSFET', ''], ['depnmos', 'Depletion N-MOSFET', ''],
];
const PAIR = { diode: ['zener', 'led'], zener: ['diode', 'led'], led: ['diode', 'zener'], npn: ['pnp'], pnp: ['npn'], njfet: ['pjfet'], pjfet: ['njfet'], nmos: ['pmos', 'depnmos'], pmos: ['nmos', 'depnmos'], depnmos: ['nmos', 'pmos'] };
const UNIT = Object.fromEntries([...KINDS, ...SEMIS].map(([k, , u]) => [k, u]));

/** A part in a few words, as it stands on the board: "R1 20 Ω", "V1 20 V", "D1 0.1vx". */
function partLabel(e) {
  const t = e.constructor.type, p = e.p;
  if (t === 'resistor') return `${e.name} ${fmtSI(p.r, 'Ω', 4)}`;
  if (t === 'dcv' || t === 'acv') return `${e.name} ${fmtSI(p.amp, 'V', 4)}`;
  if (t === 'dci' || t === 'aci') return `${e.name} ${fmtSI(p.amp, 'A', 4)}`;
  if (t === 'capacitor') return `${e.name} ${fmtSI(p.c, 'F', 4)}`;
  if (t === 'inductor') return `${e.name} ${fmtSI(p.l, 'H', 4)}`;
  if (t === 'switch') return `${e.name} ${p.closed ? 'closed' : 'open'}`;
  if (t === 'depsrc') return `${e.name} ${e.valueLabel()}`;
  if (t === 'opamp') return `${e.name} op amp`;
  if (t === 'diode') return `${e.name} diode`;
  if (t === 'led') return `${e.name} LED`;
  if (t === 'nmos' || t === 'pmos' || t === 'depnmos') return `${e.name} ${{ nmos: 'n-MOSFET', pmos: 'p-MOSFET', depnmos: 'depletion n-MOSFET' }[t]} VT ${fmtSI(p.vt, 'V', 4)}`;
  if (t === 'zener') return `${e.name} zener ${fmtSI(p.bv, 'V', 4)}`;
  if (t === 'npn' || t === 'pnp') return `${e.name} ${t} β ${p.bf}`;
  if (t === 'njfet' || t === 'pjfet') return `${e.name} ${t === 'njfet' ? 'n' : 'p'}-JFET ${fmtSI(p.idss, 'A', 4)}`;
  return e.name;
}

export class PhotoScreen {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.stage = 'start'; // start | crop | reading | result | error
    this.image = null;    // { data, mediaType }
    this.crop = null;     // the part of it to read: [x0, y0, x1, y1] as fractions of its size
    this.shown = null;    // that part as a picture to show (null: the whole picture)
    this.answer = null;   // { circuits, problem }
    this.pick = 0;        // which circuit of a page with several
    this.error = null;
    this.abort = null;
    this.original = null; // the circuits as read, before any change in the list
    this.hi = -1;         // the part picked in the list (shown on the drawing)
  }

  get settings() { return this.app.settings; }
  theme() { return THEMES[this.settings.theme] || THEMES.light; }

  open() {
    if (this.stage !== 'reading' && this.stage !== 'crop') this.stage = this.answer ? 'result' : 'start';
    this.render();
  }

  /** Back button: cropping, a result or an error goes back to the start first. Returns false to close. */
  back() {
    if (this.stage === 'reading') { this.cancel(); return true; }
    if (this.stage === 'crop' || this.stage === 'result' || this.stage === 'error') { this.stage = 'start'; this.render(); return true; }
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
    else if (this.stage === 'crop') this.renderCrop(body);
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
        <li>One circuit per photo reads best: crop the photo to it. A page with several figures works too — you pick one.</li>
      </ul>
      <div class="ph-sure">${icon('info', 16)}<span><b>Not always 100 % right.</b> A circuit read from a photo can have a part, a value or a wire read wrong. Check it against the picture: change a wrong part or value in the list under the drawing, or fix it on the board after opening it.</span></div>`;
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
    this.crop = [0, 0, 1, 1];
    this.stage = 'crop';
    this.render();
  }

  // ---------------------------------------------------------------- crop
  renderCrop(body) {
    body.innerHTML = `
      <p class="ph-status"><b>Crop to the circuit</b><span>Drag the corners round the circuit to read: leave out other figures and text. Drag the box to move it, or draw a new one.</span></p>
      <div class="ph-cropwrap"><div class="ph-crop">
        <img alt="" src="data:${esc(this.image.mediaType)};base64,${this.image.data}" draggable="false">
        <div class="ph-cropbox">${['nw', 'ne', 'sw', 'se'].map((h) => `<i data-h="${h}"></i>`).join('')}</div>
      </div></div>
      <div class="btn-row ph-cropbtns">
        <button class="btn" data-x="whole">${icon('fit', 18)} Whole picture</button>
        <button class="btn primary big" data-x="readcrop">${icon('check', 18)} Read the circuit</button>
      </div>
      <div class="btn-row"><button class="btn" data-x="again">${icon('camera', 18)} Another photo</button></div>`;
    const frame = body.querySelector('.ph-crop'), box = body.querySelector('.ph-cropbox');
    const show = () => {
      const [x0, y0, x1, y1] = this.crop;
      Object.assign(box.style, { left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` });
    };
    show();
    // drag a corner to size it, the inside to move it, anywhere else to draw a new one
    let drag = null;
    const at = (e) => { const r = frame.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
    frame.addEventListener('pointerdown', (e) => {
      const [x, y] = at(e), [x0, y0, x1, y1] = this.crop;
      const h = e.target.dataset?.h;
      if (h) drag = { fx: h[1] === 'w' ? x1 : x0, fy: h[0] === 'n' ? y1 : y0 };
      else if (x > x0 && x < x1 && y > y0 && y < y1) drag = { move: [x - x0, y - y0] };
      else drag = { fx: x, fy: y };
      frame.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    frame.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const [x, y] = at(e), r = frame.getBoundingClientRect();
      if (drag.move) {
        const [x0, y0, x1, y1] = this.crop, w = x1 - x0, hh = y1 - y0;
        const nx = Math.min(1 - w, Math.max(0, x - drag.move[0])), ny = Math.min(1 - hh, Math.max(0, y - drag.move[1]));
        this.crop = [nx, ny, nx + w, ny + hh];
      } else {
        // (never smaller than a finger can still take hold of)
        const mw = 48 / r.width, mh = 48 / r.height;
        const xa = Math.min(drag.fx, x), xb = Math.max(drag.fx, x), ya = Math.min(drag.fy, y), yb = Math.max(drag.fy, y);
        this.crop = [Math.min(xa, 1 - mw), Math.min(ya, 1 - mh), Math.max(xb, Math.min(1, xa + mw)), Math.max(yb, Math.min(1, ya + mh))];
      }
      show();
    });
    const end = () => { drag = null; };
    frame.addEventListener('pointerup', end);
    frame.addEventListener('pointercancel', end);
    body.querySelector('[data-x=whole]').addEventListener('click', () => { this.crop = [0, 0, 1, 1]; show(); });
    body.querySelector('[data-x=readcrop]').addEventListener('click', () => this.read());
    body.querySelector('[data-x=again]').addEventListener('click', () => { this.stage = 'start'; this.render(); });
  }

  /** Whether a part of the picture is chosen, not (about) all of it. */
  cropped() {
    const c = this.crop;
    return !!c && (c[0] > 0.01 || c[1] > 0.01 || c[2] < 0.99 || c[3] < 0.99);
  }

  /** The chosen part of the picture's pixels (a picture's own pixels: nothing is lost to cropping). */
  cut(pixels) {
    const { width: w, height: h, data } = pixels;
    const x0 = Math.floor(this.crop[0] * w), y0 = Math.floor(this.crop[1] * h);
    const W = Math.max(1, Math.ceil(this.crop[2] * w) - x0), H = Math.max(1, Math.ceil(this.crop[3] * h) - y0);
    const out = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) out.set(data.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + W) * 4), y * W * 4);
    return { width: W, height: H, data: out };
  }

  // ---------------------------------------------------------------- reading
  async read() {
    this.stage = 'reading';
    this.answer = null;
    this.pick = 0;
    this.step = null;
    this.shown = null;
    const ctl = new AbortController();
    this.abort = ctl;
    this.render();
    try {
      const out = await this.readOffline(ctl.signal);
      if (this.abort !== ctl) return;
      this.abort = null;
      this.answer = out;
      this.original = JSON.stringify(out.circuits || []);
      this.hi = -1;
      this.stage = 'result';
      this.render();
    } catch (e) {
      if (this.abort !== ctl) return;
      this.abort = null;
      if (e instanceof PhotoError && e.code === 'cancelled') { this.stage = 'start'; this.render(); return; }
      this.fail(e instanceof PhotoError ? e : new PhotoError('offline', String(e?.message || e)));
    } finally {
      // (not when a newer read has taken over: the ticking status is that one's now)
      if (!this.abort || this.abort === ctl) clearInterval(this.timer);
    }
  }

  /** Read the picture on the phone: its pixels, then the circuits in them. */
  async readOffline(signal) {
    let pixels;
    try { pixels = await decodeImage(this.image); } catch (e) { throw new PhotoError('bad', 'This picture could not be opened.'); }
    if (this.cropped()) {
      pixels = this.cut(pixels);
      this.shown = picture(pixels);
      const img = this.root.querySelector('.ph-shot img');
      if (img) img.src = `data:${this.shown.mediaType};base64,${this.shown.data}`;
    }
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
      <div class="ph-shot reading"><img alt="" src="data:${esc(this.picture().mediaType)};base64,${this.picture().data}"><i class="ph-scan"></i></div>
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

  /** The picture read: the part cropped to, else the whole photo. */
  picture() { return this.shown || this.image; }

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
    const c = list[this.pick];
    const n = b.els.filter(Boolean).length;
    const edited = this.original && JSON.stringify(list) !== this.original;
    body.innerHTML = `
      ${list.length > 1 ? `<p class="th-q">This picture has ${list.length} circuits. <span>Pick one.</span></p>
        <div class="th-chips">${list.map((x, i) => `<button class="chip2 ${i === this.pick ? 'on' : ''}" data-c="${i}">${esc(x.title || 'Circuit ' + (i + 1))}</button>`).join('')}</div>` : ''}
      <div class="ph-title"><b>${esc(this.app.photoName(c.title))}</b><span>${n} part${n === 1 ? '' : 's'} · check it against the picture</span></div>
      <canvas class="th-fig ph-fig"></canvas>
      <details class="ph-orig"><summary>${icon('camera', 16)} The photo</summary><img alt="" src="data:${esc(this.picture().mediaType)};base64,${this.picture().data}"></details>
      <div class="ph-sure">${icon('info', 16)}<span><b>Not always 100 % right.</b> Reading a circuit from a photo can get a part, a value or a wire wrong. Check each part below against the photo and fix what is wrong here, or on the board after opening it.</span></div>
      <div class="ph-edit">
        <div class="ph-edhead"><b>Parts read</b><span>Tap a part to see it on the drawing · change its kind or value · ${icon('trash', 13)} removes it</span></div>
        ${(c.parts || []).map((p, i) => this.partRow(p, i, b.els[i])).join('')}
        ${edited ? `<button class="btn ph-undo" data-x="undo">${icon('undo', 16)} Back to what was read</button>` : ''}
      </div>
      ${[...(c.notes || []), ...b.warnings].map((w) => `<div class="th-warn">${icon('info', 16)}<span>${esc(w)}</span></div>`).join('')}
      ${problem ? `<div class="ph-note">${icon('info', 16)}<span>${esc(problem)}</span></div>` : ''}
      ${b.asked.length ? `<p class="ph-asked">Asked to find <b>${b.asked.map(esc).join(', ')}</b>. Open it on the board and press <b>Run</b>: the live labels show every voltage and current.</p>` : ''}
      <div class="btn-row ph-go">
        <button class="btn primary big" data-x="open">${icon('check', 18)} Open on the board</button>
        <button class="btn" data-x="again">${icon('camera', 18)} Another photo</button>
      </div>
      <p class="ph-by">Read on this phone. It opens on the board paused: press <b>Run</b> when you are ready.</p>`;
    const cv = body.querySelector('.ph-fig');
    const paint = () => {
      const el = b.els[this.hi];
      this.fig = drawFigure(cv, { doc: b.doc, hi: new Set(el ? [el] : []), notes: [], load: null }, this.theme(), this.settings, 400, { readable: 11 });
      body.querySelectorAll('.ph-row').forEach((r) => r.classList.toggle('on', +r.dataset.i === this.hi));
    };
    requestAnimationFrame(paint);
    // tap a part on the drawing: its row in the list
    cv.addEventListener('click', (ev) => {
      if (!this.fig) return;
      const r = cv.getBoundingClientRect(), [wx, wy] = this.fig.toWorld(ev.clientX - r.left, ev.clientY - r.top);
      const i = b.els.findIndex((e) => e && e.hitTest(wx, wy, 8));
      this.hi = i === this.hi ? -1 : i;
      paint();
      if (this.hi >= 0) body.querySelector(`.ph-row[data-i="${this.hi}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    body.querySelectorAll('.ph-row').forEach((row) => {
      const i = +row.dataset.i, p = c.parts[i];
      row.addEventListener('click', (ev) => { if (ev.target.closest('select, input, button')) return; this.hi = this.hi === i ? -1 : i; paint(); });
      row.querySelector('select')?.addEventListener('focus', () => { this.hi = i; paint(); });
      row.querySelector('select')?.addEventListener('change', (ev) => this.changeKind(i, ev.target.value));
      const inp = row.querySelector('input');
      inp?.addEventListener('focus', () => { this.hi = i; paint(); });
      inp?.addEventListener('change', () => {
        const v = parseSI(inp.value.replace(/[ΩΩ]|ohms?/gi, ''));
        if (!Number.isFinite(v) || (v <= 0 && /resistor|inductor|capacitor/.test(p.kind))) { inp.classList.add('bad'); inp.value = this.valueText(p); return; }
        p.value = v;
        this.refresh();
      });
      row.querySelector('[data-x=del]')?.addEventListener('click', () => { this.dropPart(c, i); this.hi = -1; this.refresh(); });
    });
    body.querySelectorAll('[data-c]').forEach((x) => x.addEventListener('click', () => { this.pick = +x.dataset.c; this.hi = -1; this.render(); }));
    body.querySelector('[data-x=undo]')?.addEventListener('click', () => { this.answer.circuits = JSON.parse(this.original); this.hi = -1; this.refresh(); });
    body.querySelector('[data-x=open]').addEventListener('click', () => {
      const { doc } = this.built();
      // every part removed: nothing to put on the board (it saved an empty "Photo circuit")
      if (!doc.elements.length) { alert('No parts are left in this circuit — read the photo again or keep at least one part.'); return; }
      this.app.openFromPhoto(doc);
    });
    body.querySelector('[data-x=again]').addEventListener('click', () => { this.stage = 'start'; this.render(); });
  }

  /** Show the result again after a change in the parts list, scrolled where it was. */
  refresh() {
    const y = this.root.querySelector('.ph-body')?.scrollTop || 0;
    this.render();
    const b = this.root.querySelector('.ph-body');
    if (b) b.scrollTop = y;
  }

  /** A part's value as typed in its row: "2.5", "10k", "4.7µ" (its unit beside it). */
  valueText(p) { return Number.isFinite(p.value) ? fmtSI(p.value, '', 4).trim() : ''; }

  /** One row of the parts list: its name on the board, what it is, its value, and remove. */
  partRow(p, i, el) {
    const name = el ? el.name : '—';
    if (p.kind === 'opamp') {
      return `<div class="ph-row" data-i="${i}" data-sum="${esc(el ? partLabel(el) : '')}"><b>${esc(name)}</b><span class="ph-kind">Op amp</span><span></span><button class="icon-btn ph-del" data-x="del" title="Remove">${icon('trash', 17)}</button></div>`;
    }
    const semi = PAIR[p.kind];
    // (a diode may also have been no part at all: a wire)
    const kinds = semi ? SEMIS.filter(([k]) => k === p.kind || semi.includes(k)).concat(/diode|zener|led/.test(p.kind) ? KINDS.filter(([k]) => k === 'wire') : []) : KINDS.filter(([k]) => !/^dependent/.test(k) || /^dependent/.test(p.kind));
    const unit = /^dependent/.test(p.kind) ? `× ${p.control || '?'}` : UNIT[p.kind] ?? '';
    const hasVal = !/switch|mos/.test(p.kind) && p.kind !== 'diode' && p.kind !== 'led';
    return `<div class="ph-row" data-i="${i}" data-sum="${esc(el ? partLabel(el) : '')}">
      <b>${esc(name)}</b>
      <select aria-label="Kind of part">${kinds.map(([k, t]) => `<option value="${k}" ${k === p.kind ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      ${hasVal ? `<label class="num-in ph-val"><input type="text" inputmode="decimal" value="${esc(this.valueText(p))}" aria-label="Value"><em>${esc(unit)}</em></label>` : '<span></span>'}
      <button class="icon-btn ph-del" data-x="del" title="Remove">${icon('trash', 17)}</button>
    </div>`;
  }

  /**
   * Take part i out of the drawing. What points at parts by their place in the list follows:
   * a marked current or voltage ("ix through the 2 Ω") stays with its part instead of sliding
   * on to the next one — which silently made a dependent source follow the wrong resistor — and
   * one that was marked on the removed part itself now points at nothing (reported when opened).
   */
  dropPart(c, i) {
    c.parts.splice(i, 1);
    for (const q of c.quantities || []) {
      if (typeof q.part !== 'number') continue;
      if (q.part === i) q.part = -1; else if (q.part > i) q.part--;
    }
    if (c.mutuals) {
      c.mutuals = c.mutuals.filter((m) => m.a !== i && m.b !== i)
        .map((m) => ({ ...m, a: m.a > i ? m.a - 1 : m.a, b: m.b > i ? m.b - 1 : m.b }));
    }
  }

  /** A part read as the wrong kind: make it the kind picked (or a plain wire). */
  changeKind(i, kind) {
    const c = this.answer.circuits[this.pick], p = c.parts[i];
    if (kind === 'wire') {
      this.dropPart(c, i);
      (c.wires ||= []).push({ from: p.from, to: p.to });
      this.hi = -1;
    } else {
      const was = UNIT[p.kind];
      p.kind = kind;
      // a value in another unit means nothing for the new kind: keep the number only when it
      // still makes sense (e.g. a voltage source and an AC one), else a usual one to change
      if (UNIT[kind] !== was || !(Number.isFinite(p.value))) p.value = { resistor: 1e3, inductor: 1e-3, capacitor: 1e-6, voltage_source: 10, current_source: 1, ac_voltage_source: 10, ac_current_source: 1, zener: 5.1, diode: 0 }[kind] ?? p.value;
      if (/source/.test(kind) && !p.polarity) p.polarity = 'from';
    }
    this.refresh();
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
