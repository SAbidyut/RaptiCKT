// "Circuit from photo": take a picture of a circuit diagram (or choose one), let Claude read it,
// check the redrawn circuit, and open it on the board ready to run.

import { icon } from './icons.js';
import { store, bridge } from './store.js';
import { THEMES } from './theme.js';
import { fmtSI } from '../engine/units.js';
import { drawFigure } from './theorem-figs.js';
import { buildFromDrawing } from './photo-circuit.js';
import { readCircuitPhoto, PhotoError } from './photo-ai.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY_URL = 'https://console.anthropic.com/settings/keys';

const ADVICE = {
  key: 'Enter a valid Anthropic API key below.',
  net: 'Reading a photo needs the internet. Connect and try again.',
  busy: 'Wait a minute and try again.',
  big: 'Crop the picture to the one circuit you want and try again.',
  refused: 'Try a clearer picture of the circuit diagram alone.',
  bad: 'Try another picture (JPEG or PNG).',
  api: 'Try again in a moment.',
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
  keyCard() {
    const k = this.settings.claudeKey;
    if (k) {
      return `<div class="ph-key ok">${icon('check', 18)}<div><b>Claude API key saved</b><span>…${esc(k.slice(-4))} · kept on this device only</span></div>
        <button class="btn" data-x="key-change">Change</button></div>`;
    }
    return `<div class="ph-key">
        <b>Your Anthropic API key</b>
        <p>Photos are read by Claude, Anthropic's AI. Paste your own API key once — it is stored only on this device and sent only to Anthropic with the photo. <button class="link" data-x="key-get">Get a key</button></p>
        <div class="ph-key-row"><input type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" data-x="key-in"><button class="btn primary" data-x="key-save">Save</button></div>
      </div>`;
  }

  renderStart(body) {
    body.innerHTML = `
      <div class="ph-hero">
        <span class="ph-ico">${icon('camera', 30)}</span>
        <p>Photograph a circuit diagram — a textbook figure, an exam question, a neat sketch — and it is redrawn on the board with its values, ready to run.</p>
      </div>
      <div class="ph-btns">
        <button class="btn primary big" data-x="camera">${icon('camera', 20)} Take a photo</button>
        <button class="btn big" data-x="gallery">${icon('upload', 20)} Choose an image</button>
      </div>
      ${this.keyCard()}
      <h4>For the best result</h4>
      <ul class="ph-tips">
        <li>Hold the phone flat over the page, with the whole circuit in the frame and in focus.</li>
        <li>Good light and no shadow across the drawing; every value should be readable.</li>
        <li>One circuit per photo reads best. A page with several figures works too — you pick one.</li>
        <li>Always check the redrawn circuit against the picture before trusting the answer.</li>
      </ul>`;
    body.querySelector('[data-x=camera]').addEventListener('click', () => this.take(true));
    body.querySelector('[data-x=gallery]').addEventListener('click', () => this.take(false));
    this.bindKey(body);
  }

  /** after(): what to do once a key is saved (default: show the screen again) */
  bindKey(body, after = () => this.render()) {
    body.querySelector('[data-x=key-get]')?.addEventListener('click', () => bridge.openUrl(KEY_URL));
    body.querySelector('[data-x=key-change]')?.addEventListener('click', () => {
      this.settings.claudeKey = '';
      this.app.saveSettings();
      this.render();
      this.root.querySelector('[data-x=key-in]')?.focus();
    });
    const inp = body.querySelector('[data-x=key-in]');
    const save = () => {
      const v = (inp.value || '').trim();
      if (!v) { inp.focus(); return; }
      this.settings.claudeKey = v;
      this.app.saveSettings();
      after();
    };
    body.querySelector('[data-x=key-save]')?.addEventListener('click', save);
    inp?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); });
  }

  async take(camera) {
    if (!this.settings.claudeKey) {
      const inp = this.root.querySelector('[data-x=key-in]');
      inp?.focus();
      inp?.closest('.ph-key')?.classList.add('need');
      return;
    }
    let img;
    try { img = await bridge.pickImage(camera); } catch (e) {
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
    this.got = 0;
    this.t0 = Date.now();
    const ctl = new AbortController();
    this.abort = ctl;
    this.render();
    try {
      const out = await readCircuitPhoto({
        apiKey: this.settings.claudeKey, data: this.image.data, mediaType: this.image.mediaType, signal: ctl.signal,
        onProgress: (n) => { this.got = n; this.tick(); },
      });
      if (this.abort !== ctl) return;
      this.abort = null;
      this.answer = out;
      this.stage = 'result';
      this.render();
    } catch (e) {
      if (this.abort !== ctl) return;
      this.abort = null;
      if (e instanceof PhotoError && e.code === 'cancelled') { this.stage = 'start'; this.render(); return; }
      this.fail(e instanceof PhotoError ? e : new PhotoError('api', String(e?.message || e)));
    } finally {
      clearInterval(this.timer);
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
      <p class="ph-status"><b>Claude is reading the circuit…</b><span class="ph-sub"></span></p>
      <div class="splash-bar ph-bar"><i></i></div>
      <div class="btn-row"><button class="btn" data-x="cancel">${icon('x', 18)} Cancel</button></div>`;
    body.querySelector('[data-x=cancel]').addEventListener('click', () => this.cancel());
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000);
    this.tick();
  }

  tick() {
    const s = this.root.querySelector('.ph-sub');
    if (!s) return;
    const sec = Math.round((Date.now() - this.t0) / 1000);
    s.textContent = this.got ? `Writing down the parts and wires… ${sec} s` : `Looking at the picture… ${sec} s (this can take a minute)`;
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
      <div class="ph-title"><b>${esc(c.title || 'Circuit from photo')}</b><span>${parts.length} part${parts.length === 1 ? '' : 's'} · check it against the picture</span></div>
      <canvas class="th-fig ph-fig"></canvas>
      <details class="ph-orig"><summary>${icon('camera', 16)} The photo</summary><img alt="" src="data:${esc(this.image.mediaType)};base64,${this.image.data}"></details>
      <div class="ph-parts">${parts.map((e) => `<span>${esc(partLabel(e))}</span>`).join('')}</div>
      ${b.warnings.map((w) => `<div class="th-warn">${icon('info', 16)}<span>${esc(w)}</span></div>`).join('')}
      ${problem ? `<div class="ph-note">${icon('info', 16)}<span>${esc(problem)}</span></div>` : ''}
      ${b.asked.length ? `<p class="ph-asked">Asked to find <b>${b.asked.map(esc).join(', ')}</b>. Press <b>Run</b> on the board: the live labels show every voltage and current.</p>` : ''}
      <div class="btn-row ph-go">
        <button class="btn primary big" data-x="open">${icon('play', 18)} Open on the board</button>
        <button class="btn" data-x="again">${icon('camera', 18)} Another photo</button>
      </div>`;
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
    const e = this.error || new PhotoError('api', 'Something went wrong.');
    const retry = this.image && e.code !== 'key' && e.code !== 'big' && e.code !== 'bad' && e.code !== 'refused';
    body.innerHTML = `
      <div class="ph-empty bad">${icon('info', 22)}<div><b>${esc(e.message)}</b><span>${esc(ADVICE[e.code] || ADVICE.api)}</span></div></div>
      ${e.code === 'key' ? this.keyCard() : ''}
      <div class="btn-row">
        ${retry ? `<button class="btn primary big" data-x="retry">${icon('reset', 18)} Try again</button>` : ''}
        <button class="btn ${retry ? '' : 'primary big'}" data-x="again">${icon('camera', 18)} Another photo</button>
      </div>`;
    body.querySelector('[data-x=retry]')?.addEventListener('click', () => this.read());
    body.querySelector('[data-x=again]').addEventListener('click', () => { this.stage = 'start'; this.render(); });
    // a corrected key goes straight back to reading the same picture
    if (e.code === 'key') this.bindKey(body, () => (this.image ? this.read() : this.render()));
  }
}
