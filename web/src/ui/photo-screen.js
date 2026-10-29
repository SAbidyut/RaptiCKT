// "Circuit from photo": take a picture of a circuit diagram (or choose one), have it read — on
// the phone itself, or by Claude online — check the redrawn circuit, and open it on the board
// ready to run.

import { icon } from './icons.js';
import { bridge, decodeImage } from './store.js';
import { THEMES } from './theme.js';
import { fmtSI } from '../engine/units.js';
import { drawFigure } from './theorem-figs.js';
import { buildFromDrawing } from './photo-circuit.js';
import { readCircuitPhoto, PhotoError } from './photo-ai.js';
import { readPicture } from '../vision/index.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY_URL = 'https://console.anthropic.com/settings/keys';
// the picture size each reader works on (long side, px)
const SIZE = { offline: 2600, claude: 1568 };

const ADVICE = {
  key: 'Enter a valid Anthropic API key below.',
  net: 'Reading a photo needs the internet. Connect and try again.',
  busy: 'Wait a minute and try again.',
  big: 'Crop the picture to the one circuit you want and try again.',
  refused: 'Try a clearer picture of the circuit diagram alone.',
  bad: 'Try another picture (JPEG or PNG).',
  api: 'Try again in a moment.',
  offline: 'Try a sharper, straighter photo — or let Claude AI read it.',
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
  /** 'offline' (read on this phone) or 'claude' */
  get mode() { return this.settings.photoReader === 'claude' ? 'claude' : 'offline'; }
  setMode(m) { this.settings.photoReader = m; this.app.saveSettings(); }
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
    const off = this.mode === 'offline';
    body.innerHTML = `
      <div class="ph-hero">
        <span class="ph-ico">${icon('camera', 30)}</span>
        <p>Photograph a circuit diagram — a textbook figure, an exam question, a neat drawing — and it is redrawn on the board with its values, ready to run.</p>
      </div>
      <p class="th-q">Read it</p>
      <div class="th-seg ph-mode">
        <button data-mode="offline" class="${off ? 'on' : ''}">On this phone</button>
        <button data-mode="claude" class="${off ? '' : 'on'}">With Claude AI</button>
      </div>
      <p class="ph-mode-note">${off
        ? '<b>Offline</b> — no internet, no key. Reads printed diagrams (textbooks, exam papers, screenshots) and neat sketches drawn by hand: wires, resistors, sources, dependent sources, capacitors, coils, grounds and their values. For untidy sketches use Claude.'
        : '<b>Claude AI</b> — reads any diagram, printed or hand-drawn, and the problem around it. Needs the internet and your own Anthropic API key.'}</p>
      <div class="ph-btns">
        <button class="btn primary big" data-x="camera">${icon('camera', 20)} Take a photo</button>
        <button class="btn big" data-x="gallery">${icon('upload', 20)} Choose an image</button>
      </div>
      ${off ? '' : this.keyCard()}
      <h4>For the best result</h4>
      <ul class="ph-tips">
        <li>Hold the phone flat over the page, with the whole circuit in the frame and in focus.</li>
        <li>Good light and no shadow across the drawing; every value should be readable.</li>
        <li>One circuit per photo reads best. A page with several figures works too — you pick one.</li>
        <li>Always check the redrawn circuit against the picture before trusting the answer.</li>
      </ul>`;
    body.querySelector('[data-x=camera]').addEventListener('click', () => this.take(true));
    body.querySelector('[data-x=gallery]').addEventListener('click', () => this.take(false));
    body.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { this.setMode(b.dataset.mode); this.render(); }));
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
    if (this.mode === 'claude' && !this.settings.claudeKey) {
      const inp = this.root.querySelector('[data-x=key-in]');
      inp?.focus();
      inp?.closest('.ph-key')?.classList.add('need');
      return;
    }
    let img;
    try { img = await bridge.pickImage(camera, SIZE[this.mode]); } catch (e) {
      if (e && e.message && e.message !== 'cancelled') { this.fail(new PhotoError('bad', 'Could not open the picture: ' + e.message)); }
      return;
    }
    if (!img || !img.data) return;
    this.image = img;
    this.read();
  }

  // ---------------------------------------------------------------- reading
  async read(mode = this.mode) {
    this.stage = 'reading';
    this.reading = mode;
    this.answer = null;
    this.pick = 0;
    this.got = 0;
    this.step = null;
    this.t0 = Date.now();
    const ctl = new AbortController();
    this.abort = ctl;
    this.render();
    try {
      const out = mode === 'offline' ? await this.readOffline(ctl.signal) : await readCircuitPhoto({
        apiKey: this.settings.claudeKey, data: this.image.data, mediaType: this.image.mediaType, signal: ctl.signal,
        onProgress: (n) => { this.got = n; this.tick(); },
      });
      out.by = mode;
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
      <p class="ph-status"><b>${this.reading === 'offline' ? 'Reading the circuit on this phone…' : 'Claude is reading the circuit…'}</b><span class="ph-sub"></span></p>
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
    if (this.reading === 'offline') { s.textContent = this.step ? `${this.step.what}… ${Math.round(this.step.f * 100)} %` : 'Opening the picture…'; return; }
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
    const offline = this.answer.by === 'offline';
    // a reading on the phone can always be tried again by Claude, with the same picture
    const alsoClaude = offline ? `<button class="btn" data-x="claude">${icon('chip', 18)} Read with Claude AI</button>` : '';
    if (!list.length) {
      body.innerHTML = `
        <div class="ph-empty">${icon('info', 22)}<div><b>No circuit could be read from this picture</b><span>${esc(problem || 'Try a sharper photo of the circuit diagram.')}</span></div></div>
        <div class="btn-row"><button class="btn primary big" data-x="again">${icon('camera', 18)} Another photo</button>${alsoClaude}</div>`;
      body.querySelector('[data-x=again]').addEventListener('click', () => { this.stage = 'start'; this.render(); });
      this.bindClaude(body);
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
      ${[...(c.notes || []), ...b.warnings].map((w) => `<div class="th-warn">${icon('info', 16)}<span>${esc(w)}</span></div>`).join('')}
      ${problem ? `<div class="ph-note">${icon('info', 16)}<span>${esc(problem)}</span></div>` : ''}
      ${b.asked.length ? `<p class="ph-asked">Asked to find <b>${b.asked.map(esc).join(', ')}</b>. Press <b>Run</b> on the board: the live labels show every voltage and current.</p>` : ''}
      <div class="btn-row ph-go">
        <button class="btn primary big" data-x="open">${icon('play', 18)} Open on the board</button>
        <button class="btn" data-x="again">${icon('camera', 18)} Another photo</button>
        ${alsoClaude}
      </div>
      ${offline ? '<p class="ph-by">Read on this phone. A part or a value read wrong? Fix it on the board, or let Claude AI read the same picture.</p>' : ''}`;
    this.bindClaude(body);
    const cv = body.querySelector('.ph-fig');
    requestAnimationFrame(() => drawFigure(cv, { doc: b.doc, hi: new Set(), notes: [], load: null }, this.theme(), this.settings, 340));
    body.querySelectorAll('[data-c]').forEach((x) => x.addEventListener('click', () => { this.pick = +x.dataset.c; this.render(); }));
    body.querySelector('[data-x=open]').addEventListener('click', () => this.app.openFromPhoto(this.built().doc));
    body.querySelector('[data-x=again]').addEventListener('click', () => { this.stage = 'start'; this.render(); });
  }

  /** "Read with Claude AI": the same picture, online (the key is asked for first when missing). */
  bindClaude(body) {
    body.querySelector('[data-x=claude]')?.addEventListener('click', () => {
      this.setMode('claude');
      if (!this.settings.claudeKey) {
        this.stage = 'start';
        this.render();
        const inp = this.root.querySelector('[data-x=key-in]');
        inp?.focus();
        inp?.closest('.ph-key')?.classList.add('need');
        return;
      }
      this.read('claude');
    });
  }

  // ---------------------------------------------------------------- error
  fail(e) {
    this.error = e;
    this.stage = 'error';
    this.render();
  }

  renderError(body) {
    const e = this.error || new PhotoError('api', 'Something went wrong.');
    const retry = this.image && e.code !== 'key' && e.code !== 'big' && e.code !== 'bad' && e.code !== 'refused' && e.code !== 'offline';
    body.innerHTML = `
      <div class="ph-empty bad">${icon('info', 22)}<div><b>${esc(e.message)}</b><span>${esc(ADVICE[e.code] || ADVICE.api)}</span></div></div>
      ${e.code === 'key' ? this.keyCard() : ''}
      <div class="btn-row">
        ${retry ? `<button class="btn primary big" data-x="retry">${icon('reset', 18)} Try again</button>` : ''}
        <button class="btn ${retry ? '' : 'primary big'}" data-x="again">${icon('camera', 18)} Another photo</button>
        ${e.code === 'offline' && this.image ? `<button class="btn" data-x="claude">${icon('chip', 18)} Read with Claude AI</button>` : ''}
      </div>`;
    body.querySelector('[data-x=retry]')?.addEventListener('click', () => this.read(this.reading || this.mode));
    this.bindClaude(body);
    body.querySelector('[data-x=again]').addEventListener('click', () => { this.stage = 'start'; this.render(); });
    // a corrected key goes straight back to reading the same picture
    if (e.code === 'key') this.bindKey(body, () => (this.image ? this.read() : this.render()));
  }
}
