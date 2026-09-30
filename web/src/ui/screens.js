// Home, About and Settings screens.

import { icon, LOGO_SVG } from './icons.js';
import { APP, RAPTI } from './brand.js';
import { EXAMPLES, exampleCategories, buildExample } from './examples.js';
import { store, DEFAULT_SETTINGS } from './store.js';
import { allTypes } from '../elements/index.js';
import { THEMES } from './theme.js';
import { fmtSI, parseSI } from '../engine/units.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return new Date(ts).toLocaleDateString();
}

// -------------------------------------------------------------------- home
export class HomeScreen {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.tab = 'home';
    this.cat = 'All';
  }

  render() {
    const n = allTypes().filter((t) => t.type !== 'base').length;
    this.root.innerHTML = `
      <div class="home-scroll">
        <header class="home-head">
          <div class="brand">${LOGO_SVG(44, 'hl')}<div><b>Rapti<span>CKT</span></b><small>${APP.tagline}</small></div></div>
          <button class="icon-btn" data-h="settings" title="Settings">${icon('sliders', 22)}</button>
        </header>
        <div class="home-body"></div>
      </div>
      <nav class="bottom-nav">
        ${[['home', 'bolt', 'Home'], ['examples', 'book', 'Examples'], ['library', 'folder', 'My Circuits'], ['about', 'info', 'About']].map(([t, ic, l]) => `<button data-tab="${t}" class="${this.tab === t ? 'on' : ''}">${icon(ic, 22)}<span>${l}</span></button>`).join('')}
      </nav>`;
    this.root.querySelector('[data-h=settings]').addEventListener('click', () => this.app.openSettings());
    this.root.querySelectorAll('.bottom-nav button').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.render(); }));
    const body = this.root.querySelector('.home-body');
    if (this.tab === 'home') this.renderHome(body, n);
    if (this.tab === 'examples') this.renderExamples(body);
    if (this.tab === 'library') this.renderLibrary(body);
    if (this.tab === 'about') renderAbout(this.app, body);
    this.root.querySelector('.home-scroll').scrollTop = 0;
  }

  renderHome(body, n) {
    const lib = store.circuits();
    const auto = store.loadAutosave();
    body.innerHTML = `
      <section class="hero">
        <div class="hero-wave"></div>
        <h1>${APP.slogan}</h1>
        <p>Real-time analog, digital & mixed-signal circuit simulation for electrical and electronic engineers.</p>
        <div class="hero-btns">
          <button class="btn primary big" data-h="new">${icon('plus', 20)} New circuit</button>
          <button class="btn glass big" data-h="open">${icon('upload', 20)} Open file</button>
        </div>
        <div class="hero-stats">
          <div><b>${n}</b><span>components</span></div>
          <div><b>${EXAMPLES.length}</b><span>examples</span></div>
          <div><b>4</b><span>analyses</span></div>
        </div>
      </section>
      ${auto && auto.elements && auto.elements.length ? `
      <button class="resume" data-h="resume">${icon('play', 18)}<div><b>Continue where you left off</b><span>${esc(auto.name)} · ${auto.elements.length} components</span></div>${icon('back', 18, 'flipx')}</button>` : ''}
      <section class="feat-grid">
        ${[
          ['scope', 'Oscilloscope', 'Multichannel, FFT & XY'],
          ['meter', 'Multimeter', 'V · A · Ω · W probes'],
          ['bode', 'Bode plots', 'AC small-signal sweep'],
          ['sweep', 'DC sweep', 'I–V & transfer curves'],
          ['sensor', 'Sensors', 'LDR, NTC, Hall, PV…'],
          ['code', 'SPICE export', 'Validate in ngspice'],
        ].map(([ic, t, s]) => `<div class="feat">${icon(ic, 22)}<b>${t}</b><span>${s}</span></div>`).join('')}
      </section>
      ${lib.length ? `<h3 class="sec-title">Recent circuits <button class="link" data-tab2="library">See all</button></h3>
      <div class="card-row">${lib.slice(0, 6).map((c) => this.circuitCard(c)).join('')}</div>` : ''}
      <h3 class="sec-title">Start with an example <button class="link" data-tab2="examples">All ${EXAMPLES.length}</button></h3>
      <div class="card-row">${EXAMPLES.slice(0, 8).map((e) => this.exampleCard(e)).join('')}</div>
      <section class="rapti-banner" data-h="about">
        ${LOGO_SVG(40, 'rb')}
        <div><b>${RAPTI.full}</b><span>Industrial automation & electrical training · Dhaka</span></div>
        ${icon('back', 18, 'flipx')}
      </section>
      <p class="bangla">${APP.bangla}</p>`;
    this.bindCards(body);
    body.querySelector('[data-h=new]').addEventListener('click', () => this.app.newCircuit());
    body.querySelector('[data-h=open]').addEventListener('click', () => this.app.importFile());
    body.querySelector('[data-h=resume]')?.addEventListener('click', () => this.app.resume());
    body.querySelector('[data-h=about]').addEventListener('click', () => { this.tab = 'about'; this.render(); });
    body.querySelectorAll('[data-tab2]').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab2; this.render(); }));
    this.drawThumbs(body);
  }

  renderExamples(body) {
    const cats = ['All', ...exampleCategories()];
    const list = EXAMPLES.filter((e) => this.cat === 'All' || e.cat === this.cat);
    body.innerHTML = `
      <h2 class="page-title">Examples</h2>
      <p class="page-sub">Ready-made circuits with explanations. Open one, press Run and experiment.</p>
      <div class="chips">${cats.map((c) => `<button class="chip2 ${c === this.cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="ex-list">${list.map((e) => `
        <button class="ex-item" data-ex="${e.id}">
          <canvas class="thumb" data-thumb-ex="${e.id}"></canvas>
          <div><span class="tag">${esc(e.cat)}</span><b>${esc(e.title)}</b><p>${esc(e.desc)}</p></div>
        </button>`).join('')}</div>`;
    body.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { this.cat = b.dataset.cat; this.renderExamples(body); }));
    this.bindCards(body);
    this.drawThumbs(body);
  }

  renderLibrary(body) {
    const lib = store.circuits();
    body.innerHTML = `
      <h2 class="page-title">My Circuits</h2>
      <p class="page-sub">Saved on this device. Export to share them or keep a backup.</p>
      <div class="btn-row"><button class="btn primary" data-h="new">${icon('plus', 18)} New</button><button class="btn" data-h="open">${icon('upload', 18)} Import</button><button class="btn" data-h="backup">${icon('download', 18)} Backup all</button></div>
      ${lib.length ? `<div class="lib-list">${lib.map((c) => `
        <div class="lib-item" data-id="${c.id}">
          ${c.thumb ? `<img class="thumb" src="${c.thumb}" alt="">` : '<div class="thumb"></div>'}
          <div class="lib-meta"><b>${esc(c.name)}</b><span>${c.count || 0} components · ${ago(c.updated)}</span></div>
          <button class="icon-btn" data-act="menu">${icon('more', 20)}</button>
        </div>`).join('')}</div>` : `<div class="empty">${icon('folder', 40)}<b>No saved circuits yet</b><span>Circuits you build are saved here automatically.</span></div>`}`;
    body.querySelector('[data-h=new]').addEventListener('click', () => this.app.newCircuit());
    body.querySelector('[data-h=open]').addEventListener('click', () => this.app.importFile());
    body.querySelector('[data-h=backup]').addEventListener('click', () => this.app.backupAll());
    body.querySelectorAll('.lib-item').forEach((it) => {
      const id = it.dataset.id;
      it.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-act=menu]')) { this.itemMenu(id); return; }
        this.app.openSaved(id);
      });
    });
  }

  itemMenu(id) {
    const c = store.getCircuit(id);
    if (!c) return;
    this.app.showSheet(esc(c.name), `
      <div class="sheet-actions">
        <button data-x="open">${icon('play', 18)} Open</button>
        <button data-x="rename">${icon('edit', 18)} Rename</button>
        <button data-x="dup">${icon('copy', 18)} Duplicate</button>
        <button data-x="export">${icon('download', 18)} Export file</button>
        <button data-x="share">${icon('share', 18)} Share</button>
        <button data-x="del" class="danger">${icon('trash', 18)} Delete</button>
      </div>`, (root, close) => {
      root.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => {
        const x = b.dataset.x;
        close();
        if (x === 'open') this.app.openSaved(id);
        if (x === 'rename') { const n = prompt('Rename circuit', c.name); if (n && n.trim()) { c.name = n.trim(); c.data.name = c.name; store.saveCircuit(c); this.render(); } }
        if (x === 'dup') { const d = JSON.parse(JSON.stringify(c)); d.id = this.app.uid(); d.name += ' (copy)'; d.data.name = d.name; d.updated = Date.now(); store.saveCircuit(d); this.render(); }
        if (x === 'export') this.app.bridge.saveFile(c.name.replace(/[^\w\- ]+/g, '_') + '.rckt', 'application/json', JSON.stringify(c.data, null, 1));
        if (x === 'share') this.app.bridge.share(c.name + ' – RaptiCKT circuit', JSON.stringify(c.data));
        if (x === 'del' && confirm(`Delete "${c.name}"?`)) { store.deleteCircuit(id); this.render(); }
      }));
    });
  }

  circuitCard(c) {
    return `<button class="card" data-open="${c.id}">${c.thumb ? `<img class="thumb" src="${c.thumb}" alt="">` : '<div class="thumb"></div>'}<b>${esc(c.name)}</b><span>${ago(c.updated)}</span></button>`;
  }
  exampleCard(e) {
    return `<button class="card" data-ex="${e.id}"><canvas class="thumb" data-thumb-ex="${e.id}"></canvas><b>${esc(e.title)}</b><span>${esc(e.cat)}</span></button>`;
  }

  bindCards(body) {
    body.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => this.app.openExample(b.dataset.ex)));
    body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => this.app.openSaved(b.dataset.open)));
  }

  drawThumbs(body) {
    const cvs = [...body.querySelectorAll('canvas[data-thumb-ex]')];
    let i = 0;
    const next = () => {
      if (i >= cvs.length) return;
      const cv = cvs[i++];
      const ex = EXAMPLES.find((e) => e.id === cv.dataset.thumbEx);
      if (ex) {
        const url = this.app.exampleThumb(ex);
        const img = new Image();
        img.className = 'thumb';
        img.src = url;
        cv.replaceWith(img);
      }
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }
}

// ------------------------------------------------------------------- about
export function renderAbout(app, body) {
  body.innerHTML = `
    <section class="about-hero">
      <div class="about-logo">${LOGO_SVG(92, 'ab')}</div>
      <h2>Rapti<span>CKT</span></h2>
      <p class="about-tag">${APP.tagline} · ${APP.subtitle}</p>
      <p class="about-ver">Version ${esc(APP.version)} (${esc(app.bridge.version())})</p>
    </section>
    <section class="about-card">
      <h3>${icon('bolt', 18)} About the app</h3>
      <p><b>RaptiCKT</b> is a real-time circuit simulator built for electrical & electronic engineering students, hobbyists and researchers. Build analog, digital and mixed-signal circuits on an unlimited canvas and watch voltages and currents come alive.</p>
      <p>Under the hood is a SPICE-class engine: Modified Nodal Analysis, Newton–Raphson with junction limiting, trapezoidal / backward-Euler integration, DC operating point with gmin and source stepping, and small-signal AC analysis. Device models include Shockley diodes, Ebers–Moll BJTs with Early effect, level-1 MOSFETs, JFETs, op-amp macromodels with GBW and slew rate, coupled-inductor transformers and electromechanical DC motors.</p>
      <ul class="about-list">
        <li>${icon('chip', 16)} 90+ components incl. sensors, logic, 555, regulators</li>
        <li>${icon('scope', 16)} 6-channel oscilloscope with FFT & XY modes</li>
        <li>${icon('bode', 16)} Bode plots, DC sweeps, operating-point tables</li>
        <li>${icon('code', 16)} SPICE netlist & CSV export for research work</li>
        <li>${icon('gauge', 16)} Live knob control & interactive switches</li>
      </ul>
    </section>
    <section class="about-card rapti">
      <h3>${icon('star', 18)} ${RAPTI.full}</h3>
      <p class="lead">${esc(RAPTI.mission)}</p>
      <p>${esc(RAPTI.about)}</p>
      <h4>Courses</h4>
      <div class="course-chips">${RAPTI.courses.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
      <h4>Contact</h4>
      <div class="contact">
        <button data-u="${RAPTI.website}">${icon('globe', 18)}<div><b>Website</b><span>rapti.net</span></div></button>
        ${RAPTI.phones.map((p) => `<button data-u="tel:${p}">${icon('phone', 18)}<div><b>Call</b><span>${p.replace('+880', '0')}</span></div></button>`).join('')}
        <button data-u="${RAPTI.mapsUrl}">${icon('pin', 18)}<div><b>Visit</b><span>${esc(RAPTI.address)}</span></div></button>
        <button data-u="${RAPTI.coursesUrl}">${icon('book', 18)}<div><b>Courses & admission</b><span>rapti.net/app-course</span></div></button>
      </div>
    </section>
    <section class="about-card">
      <h3>${icon('info', 18)} Accuracy notes</h3>
      <p class="small">Results follow the documented device models and SPICE-default tolerances (RELTOL 1e-3, VNTOL 1 µV, GMIN 1e-12) and have been verified against analytic solutions. Behavioural blocks (logic, 555, regulators, sensors) are idealised models — always validate critical designs with datasheets and lab measurements. Use <em>Analysis → SPICE netlist</em> to cross-check in ngspice/LTspice.</p>
    </section>
    <p class="bangla">${APP.bangla}</p>
    <p class="copyright">© ${new Date().getFullYear()} ${RAPTI.full} · rapti.net</p>`;
  body.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => app.bridge.openUrl(b.dataset.u)));
}

// ---------------------------------------------------------------- settings
export function renderSettings(app, root) {
  const s = app.settings;
  const row = (label, ctl, hint = '') => `<label class="set-row"><div><b>${label}</b>${hint ? `<span>${hint}</span>` : ''}</div>${ctl}</label>`;
  const sel = (k, opts) => `<select data-k="${k}">${opts.map(([v, t]) => `<option value="${v}" ${String(s[k]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const tog = (k) => `<input type="checkbox" class="toggle" data-k="${k}" ${s[k] ? 'checked' : ''}>`;
  const num = (k, u) => `<input type="text" class="num" data-k="${k}" data-num="1" value="${fmtSI(s[k], '', 3).trim()}"><em>${u}</em>`;
  root.innerHTML = `
    <header class="topbar plain"><button class="icon-btn" data-x="back">${icon('back', 22)}</button><div class="title"><b>Settings</b></div></header>
    <div class="set-scroll">
      <h4>Appearance</h4>
      ${row('Theme', sel('theme', Object.entries(THEMES).map(([k, t]) => [k, t.name])))}
      ${row('Grid', sel('grid', [['lines', 'Lines'], ['dots', 'Dots'], ['none', 'None']]))}
      ${row('Voltage colours', tog('voltColors'), 'Wires glow green (+) / red (−)')}
      ${row('Current animation', tog('currentDots'), 'Moving dots show current flow')}
      ${row('Animation speed', sel('dotSpeed', [[0.5, 'Slow'], [1, 'Normal'], [2, 'Fast'], [4, 'Very fast']]))}
      ${row('Capacitor charge', tog('showCharge'), '± signs on capacitor plates')}
      ${row('Value labels', tog('showValues'))}
      ${row('Component names', tog('showNames'))}
      ${row('Live node voltages', tog('liveVolts'), 'Voltage of every net written on its wire')}
      ${row('Live currents', tog('liveAmps'), 'Current and its direction beside each part')}
      <h4>Simulation</h4>
      ${row('Integration method', sel('method', [['trap', 'Trapezoidal (accurate)'], ['be', 'Backward Euler (damped)']]))}
      ${row('Start from DC operating point', tog('initialDC'), 'Off = power-on from zero state')}
      ${row('Maximum timestep', num('maxStep', 's'))}
      ${row('RELTOL', num('reltol', ''), 'Relative tolerance (SPICE default 1e-3)')}
      ${row('VNTOL', num('vntol', 'V'), 'Absolute voltage tolerance')}
      ${row('ABSTOL', num('abstol', 'A'), 'Absolute current tolerance')}
      ${row('GMIN', num('gmin', 'S'), 'Minimum conductance to ground')}
      ${row('Newton iterations', num('maxIter', ''), 'Per timestep before halving Δt')}
      <h4>Interaction</h4>
      ${row('Haptic feedback', tog('haptics'))}
      ${row('Sound (buzzer)', tog('sound'))}
      <h4>Data</h4>
      <div class="btn-row pad">
        <button class="btn" data-x="backup">${icon('download', 18)} Backup circuits</button>
        <button class="btn" data-x="restore">${icon('upload', 18)} Restore backup</button>
        <button class="btn" data-x="reset">${icon('reset', 18)} Reset settings</button>
      </div>
      <p class="copyright">RaptiCKT ${APP.version} · ${RAPTI.full}</p>
    </div>`;
  root.querySelector('[data-x=back]').addEventListener('click', () => app.closeSettings());
  root.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('change', () => {
    const k = inp.dataset.k;
    let v;
    if (inp.type === 'checkbox') v = inp.checked;
    else if (inp.dataset.num) { v = parseSI(inp.value); if (!Number.isFinite(v) || v <= 0) { inp.value = fmtSI(s[k], '', 3).trim(); return; } }
    else v = typeof DEFAULT_SETTINGS[k] === 'number' ? parseFloat(inp.value) : inp.value;
    s[k] = v;
    app.saveSettings();
    if (k === 'theme') app.applyTheme();
  }));
  root.querySelector('[data-x=backup]').addEventListener('click', () => app.backupAll());
  root.querySelector('[data-x=restore]').addEventListener('click', () => app.importFile());
  root.querySelector('[data-x=reset]').addEventListener('click', () => {
    if (!confirm('Reset all settings to defaults?')) return;
    Object.assign(s, DEFAULT_SETTINGS);
    app.saveSettings(); app.applyTheme();
    renderSettings(app, root);
  });
}

export { buildExample };
