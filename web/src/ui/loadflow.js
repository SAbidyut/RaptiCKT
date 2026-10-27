// Load Flow Analysis section: build or pick a power system, solve it with Newton–Raphson,
// Gauss–Seidel, Fast Decoupled or DC load flow, and study the results as tables, a
// one-line diagram, charts, the iteration log, the Y-bus, an N-1 screening, per-unit
// tools and the theory behind it all.

import { icon } from './icons.js';
import { store } from './store.js';
import { motion } from './motion.js';
import {
  solveLoadFlow, contingencies, buildYbus, validate, METHODS, DEFAULT_OPTIONS,
  parseMatpower, toMatpower, baseValues, changeBase,
} from '../engine/loadflow.js';
import { LF_CASES, loadCase, newBus, newBranch } from '../engine/loadflow-cases.js';
import { LF_THEORY } from './loadflow-theory.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fx = (v, d = 3) => (Number.isFinite(v) ? (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d) : '—');
const numIn = (v, def = 0) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : def; };
const optNum = (v) => (String(v).trim() === '' ? '' : numIn(v, ''));
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

const TABS = [
  ['system', 'table', 'System'], ['results', 'check', 'Results'], ['diagram', 'tower', 'Diagram'], ['charts', 'chart', 'Charts'],
  ['iter', 'sigma', 'Iterations'], ['ybus', 'grid', 'Y-bus'], ['n1', 'shield', 'N-1'], ['tools', 'gauge', 'Per-unit tools'], ['learn', 'book', 'Theory'],
];
const TYPE_LABEL = { slack: 'Slack', pv: 'PV', pq: 'PQ' };
const TYPE_LONG = { slack: 'Slack (swing)', pv: 'PV (generator)', pq: 'PQ (load)' };

function css(name, fb) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch { return fb; }
}

/** Size a canvas to its CSS box at device resolution; returns { ctx, w, h }. */
function prep(cv) {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 300, h = cv.clientHeight || 200;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

export class LoadFlowScreen {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    const s = store.lfState();
    this.sys = s?.sys && Array.isArray(s.sys.buses) ? s.sys : loadCase('ieee14');
    this.caseId = s?.caseId || 'ieee14';
    this.opts = { ...DEFAULT_OPTIONS, ...(s?.opts || {}) };
    this.tab = 'system';
    this.res = null;
    this.n1 = null;
    this.flowLabel = 'P';
    this.diagStyle = s?.diagStyle === 'modern' ? 'modern' : 'classic';
    this.ybusPolar = false;
    this.iterBus = 'all';
  }

  persist() { store.saveLfState({ sys: this.sys, opts: this.opts, caseId: this.caseId, diagStyle: this.diagStyle }); }

  open() {
    if (!this.res) this.solve(true);
    this.render();
  }

  /** Back button: from another tab go to System first. Returns false when the screen should close. */
  back() {
    const d = this.root.querySelector('.lf-diag.max');
    if (d) { this.toggleMax(false); return true; }
    if (this.tab !== 'system') { this.tab = 'system'; this.render(); return true; }
    return false;
  }

  toast(msg) {
    let t = this.root.querySelector('.lf-toast');
    if (!t) { t = document.createElement('div'); t.className = 'lf-toast'; this.root.append(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }

  changed() { this.res = null; this.n1 = null; this.persist(); }

  // ---------------------------------------------------------------- frame
  render() {
    this.root.innerHTML = `
      <header class="an-head lf-head">
        <button class="icon-btn" data-x="back" title="Back">${icon('back', 22)}</button>
        <div class="lf-title"><b>Load Flow Analysis</b><span>${esc(this.sys.name || 'System')} · ${this.sys.buses.length} buses · ${this.sys.branches.length} branches</span></div>
        <button class="btn primary lf-runbtn" data-x="run">${icon('play', 16)}<span>Run</span></button>
      </header>
      <nav class="an-tabs lf-tabs">${TABS.map(([id, ic, t]) => `<button data-tab="${id}" class="${this.tab === id ? 'on' : ''}">${icon(ic, 16)}${t}</button>`).join('')}</nav>
      <div class="an-body lf-body"></div>`;
    this.root.querySelector('[data-x=back]').addEventListener('click', () => this.app.closeLoadFlow());
    this.root.querySelector('[data-x=run]').addEventListener('click', () => this.run());
    this.root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
    this.renderTab();
    const on = this.root.querySelector('.lf-tabs .on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  setTab(t) {
    this.tab = t;
    this.root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    this.root.querySelector('.lf-body').scrollTop = 0;
    this.renderTab();
  }

  renderTab() {
    const body = this.root.querySelector('.lf-body');
    const t = this.tab;
    if (t === 'system') this.renderSystem(body);
    else if (t === 'results') this.renderResults(body);
    else if (t === 'diagram') this.renderDiagram(body);
    else if (t === 'charts') this.renderCharts(body);
    else if (t === 'iter') this.renderIter(body);
    else if (t === 'ybus') this.renderYbus(body);
    else if (t === 'n1') this.renderN1(body);
    else if (t === 'tools') this.renderTools(body);
    else if (t === 'learn') this.renderLearn(body);
  }

  updateHead() {
    const s = this.root.querySelector('.lf-title span');
    if (s) s.textContent = `${this.sys.name || 'System'} · ${this.sys.buses.length} buses · ${this.sys.branches.length} branches`;
  }

  // ---------------------------------------------------------------- solving
  solve(quiet) {
    const r = solveLoadFlow(this.sys, this.opts);
    if (!r.ok) {
      this.res = null;
      if (!quiet) this.app.showSheet('Cannot run the load flow', `<ul class="lf-errs">${r.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul><button class="btn" data-close2>OK</button>`, (b, close) => b.querySelector('[data-close2]').addEventListener('click', close));
      return false;
    }
    this.res = r;
    return true;
  }

  run() {
    if (!this.solve(false)) return;
    this.app.bridge.vibrate(10);
    const r = this.res;
    this.toast(r.converged ? `Converged in ${r.iterations} iteration${r.iterations === 1 ? '' : 's'} (${METHODS.find((m) => m.id === r.method).name})` : `Did not converge in ${r.iterations} iterations`);
    if (this.tab === 'system' || this.tab === 'learn' || this.tab === 'tools') this.setTab('results');
    else this.renderTab();
  }

  needRun(body, what = 'results') {
    body.innerHTML = `<div class="lf-empty">${icon('tower', 40)}<b>No ${what} yet</b><p>Tap <b>Run</b> to solve the load flow of “${esc(this.sys.name)}”.</p><button class="btn primary" data-x="run2">${icon('play', 16)} Run load flow</button></div>`;
    body.querySelector('[data-x=run2]').addEventListener('click', () => this.run());
  }

  // ---------------------------------------------------------------- System tab
  renderSystem(body) {
    const sys = this.sys, o = this.opts;
    const saved = store.lfSaved();
    const caseInfo = LF_CASES.find((c) => c.id === this.caseId);
    body.innerHTML = `
      <p class="an-help">Pick a standard test system or build your own, set the solver, then tap <b>Run</b>. Tap any bus or branch to edit it.</p>
      <div class="lf-card">
        <label class="lf-lab">Test system
          <select data-k="case">
            <optgroup label="Standard test systems">${LF_CASES.map((c) => `<option value="${c.id}" ${c.id === this.caseId ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</optgroup>
            ${saved.length ? `<optgroup label="My systems">${saved.map((s) => `<option value="saved:${s.id}" ${'saved:' + s.id === this.caseId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>` : ''}
            ${this.caseId === 'custom' ? '<option value="custom" selected>(edited / imported system)</option>' : ''}
          </select>
        </label>
        ${caseInfo ? `<p class="lf-desc">${esc(caseInfo.desc)}</p>` : ''}
        <div class="form-grid lf-grid2">
          <label>System name<input data-k="name" value="${esc(sys.name)}"></label>
          <label>Base MVA<input data-k="base" type="number" inputmode="decimal" value="${sys.baseMVA}"></label>
        </div>
        <div class="lf-btns">
          <button class="btn sm" data-x="save">${icon('save', 15)} Save</button>
          <button class="btn sm" data-x="import">${icon('upload', 15)} Import</button>
          <button class="btn sm" data-x="export">${icon('download', 15)} Export</button>
          <button class="btn sm" data-x="reset">${icon('reset', 15)} Reload</button>
          ${this.caseId.startsWith('saved:') ? `<button class="btn sm danger" data-x="del">${icon('trash', 15)} Delete</button>` : ''}
        </div>
      </div>

      <h4>Solver</h4>
      <div class="lf-card">
        <div class="lf-seg lf-m">${METHODS.map((m) => `<button data-m="${m.id}" class="${o.method === m.id ? 'on' : ''}">${m.name}</button>`).join('')}</div>
        <div class="form-grid lf-grid3">
          <label>Tolerance (pu)<input data-o="tol" type="number" inputmode="decimal" step="any" value="${o.tol}"></label>
          <label>Max iterations<input data-o="maxIter" type="number" inputmode="numeric" placeholder="auto" value="${o.maxIter || ''}"></label>
          <label class="${o.method === 'gs' ? '' : 'lf-dim'}">Acceleration α (GS)<input data-o="accel" type="number" inputmode="decimal" step="0.1" value="${o.accel}"></label>
          <label>V min (pu)<input data-o="vMin" type="number" inputmode="decimal" step="0.01" value="${o.vMin}"></label>
          <label>V max (pu)<input data-o="vMax" type="number" inputmode="decimal" step="0.01" value="${o.vMax}"></label>
        </div>
        <label class="lf-check"><input type="checkbox" data-c="qLimits" ${o.qLimits ? 'checked' : ''}><span><b>Enforce generator Q limits</b><small>PV bus → PQ when Qg passes Qmin / Qmax</small></span></label>
        <label class="lf-check"><input type="checkbox" data-c="flatStart" ${o.flatStart ? 'checked' : ''}><span><b>Flat start</b><small>|V| = 1, δ = 0 at load buses (off: start from the entered V and angle)</small></span></label>
        <button class="btn primary lf-bigrun" data-x="run3">${icon('play', 18)} Run load flow</button>
      </div>

      <h4 class="lf-h4">Buses <span>${sys.buses.length}</span><button class="btn sm" data-x="addbus">${icon('plus', 15)} Bus</button></h4>
      <div class="lf-list">${sys.buses.map((b, i) => this.busRow(b, i)).join('')}</div>

      <h4 class="lf-h4">Lines & transformers <span>${sys.branches.length}</span><button class="btn sm" data-x="addline">${icon('plus', 15)} Line</button><button class="btn sm" data-x="addxf">${icon('plus', 15)} Transformer</button></h4>
      <div class="lf-list">${sys.branches.map((l, i) => this.branchRow(l, i)).join('')}</div>
      <p class="lf-note">Powers in MW / Mvar; R, X and B (total line charging) in per unit on the base MVA. Bus shunt Gs / Bs = MW / Mvar drawn at 1 pu (Bs > 0 = capacitor).</p>`;

    const q = (s) => body.querySelector(s);
    q('[data-k=case]').addEventListener('change', (e) => this.pickCase(e.target.value));
    q('[data-k=name]').addEventListener('change', (e) => { sys.name = e.target.value.trim() || 'System'; this.persist(); this.updateHead(); });
    q('[data-k=base]').addEventListener('change', (e) => { const v = numIn(e.target.value, 100); sys.baseMVA = v > 0 ? v : 100; e.target.value = sys.baseMVA; this.changed(); });
    body.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      o.method = b.dataset.m; this.res = null; this.persist();
      body.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x === b));
      q('[data-o=accel]').closest('label').classList.toggle('lf-dim', o.method !== 'gs');
    }));
    body.querySelectorAll('[data-o]').forEach((inp) => inp.addEventListener('change', () => {
      const k = inp.dataset.o;
      if (k === 'maxIter') o.maxIter = Math.max(0, Math.round(numIn(inp.value, 0)));
      else if (k === 'tol') o.tol = Math.min(0.1, Math.max(1e-12, numIn(inp.value, 1e-6)));
      else if (k === 'accel') o.accel = Math.min(2, Math.max(0.5, numIn(inp.value, 1.6)));
      else o[k] = numIn(inp.value, DEFAULT_OPTIONS[k]);
      inp.value = k === 'maxIter' ? o.maxIter || '' : o[k];
      this.res = null; this.persist();
    }));
    body.querySelectorAll('[data-c]').forEach((c) => c.addEventListener('change', () => { o[c.dataset.c] = c.checked; this.res = null; this.persist(); }));
    q('[data-x=run3]').addEventListener('click', () => this.run());
    q('[data-x=save]').addEventListener('click', () => this.saveSystem());
    q('[data-x=import]').addEventListener('click', () => this.importSheet());
    q('[data-x=export]').addEventListener('click', () => this.exportSheet());
    q('[data-x=reset]').addEventListener('click', () => { if (confirm('Reload the selected system and lose your changes?')) this.pickCase(this.caseId === 'custom' ? 'ieee14' : this.caseId); });
    q('[data-x=del]')?.addEventListener('click', () => {
      if (!confirm(`Delete “${sys.name}” from My systems?`)) return;
      store.saveLfSaved(saved.filter((s) => 'saved:' + s.id !== this.caseId));
      this.caseId = 'custom'; this.persist(); this.renderSystem(body);
    });
    q('[data-x=addbus]').addEventListener('click', () => this.addBus());
    q('[data-x=addline]').addEventListener('click', () => this.addBranch(false));
    q('[data-x=addxf]').addEventListener('click', () => this.addBranch(true));
    body.querySelectorAll('[data-bus]').forEach((b) => b.addEventListener('click', () => this.editBus(+b.dataset.bus)));
    body.querySelectorAll('[data-br]').forEach((b) => b.addEventListener('click', () => this.editBranch(+b.dataset.br)));
  }

  busRow(b, i) {
    const parts = [];
    if (b.type !== 'pq') parts.push(`V ${fx(+b.V, 3)} pu`);
    if (b.type === 'slack') parts.push(`δ ${fx(+b.ang, 1)}°`);
    if (+b.Pg || b.type === 'pv') parts.push(`Pg ${fx(+b.Pg, 1)} MW`);
    if (b.type === 'pq' && +b.Qg) parts.push(`Qg ${fx(+b.Qg, 1)}`);
    if (+b.Pd || +b.Qd) parts.push(`Load ${fx(+b.Pd, 1)} + j${fx(+b.Qd, 1)}`);
    if (+b.Bs || +b.Gs) parts.push(`Shunt ${+b.Gs ? fx(+b.Gs, 1) + ' MW ' : ''}${fx(+b.Bs, 1)} Mvar`);
    if (b.type === 'pv' && (b.Qmin !== '' || b.Qmax !== '')) parts.push(`Q ${b.Qmin === '' ? '−∞' : b.Qmin}…${b.Qmax === '' ? '∞' : b.Qmax}`);
    return `<button class="lf-row" data-bus="${i}"><span class="lf-badge ${b.type}">${TYPE_LABEL[b.type]}</span><div><b>${esc(b.id)} · ${esc(b.name)}</b><span>${parts.join(' · ') || 'No load or generation'}</span></div>${icon('edit', 16)}</button>`;
  }

  branchRow(l, i) {
    const xf = (+l.tap && +l.tap !== 1) || +l.shift || l.kind === 'xf';
    const parts = [`R ${l.R}`, `X ${l.X}`];
    if (+l.B) parts.push(`B ${l.B}`);
    if (xf) parts.push(`tap ${+l.tap || 1}${+l.shift ? ` ∠${l.shift}°` : ''}`);
    if (+l.rate) parts.push(`${l.rate} MVA`);
    return `<button class="lf-row ${l.on === false ? 'off' : ''}" data-br="${i}"><span class="lf-badge ${xf ? 'xf' : 'ln'}">${xf ? 'XF' : 'Line'}</span><div><b>${esc(l.from)} → ${esc(l.to)}${l.on === false ? ' · out of service' : ''}</b><span>${parts.join(' · ')}</span></div>${icon('edit', 16)}</button>`;
  }

  pickCase(v) {
    if (v.startsWith('saved:')) {
      const s = store.lfSaved().find((x) => 'saved:' + x.id === v);
      if (!s) return;
      this.sys = JSON.parse(JSON.stringify(s.sys));
    } else if (v !== 'custom') this.sys = loadCase(v);
    this.caseId = v;
    this._view = null;
    this.changed();
    this.solve(true);
    this.render();
  }

  markCustom() { if (!this.caseId.startsWith('saved:')) this.caseId = 'custom'; }

  saveSystem() {
    const name = prompt('Save system as', this.sys.name || 'My system');
    if (!name) return;
    this.sys.name = name.trim();
    const list = store.lfSaved();
    const old = list.find((s) => s.name === this.sys.name);
    const id = old ? old.id : 's' + Date.now().toString(36);
    const entry = { id, name: this.sys.name, updated: Date.now(), sys: JSON.parse(JSON.stringify(this.sys)) };
    store.saveLfSaved(old ? list.map((s) => (s.id === id ? entry : s)) : [...list, entry]);
    this.caseId = 'saved:' + id;
    this.persist();
    this.render();
    this.toast('Saved to My systems');
  }

  importSheet() {
    this.app.showSheet('Import a system', `
      <p class="lf-desc">Read a <b>MATPOWER case file</b> (.m, with mpc.bus, mpc.gen and mpc.branch) or a RaptiCKT load-flow .json file. You can also paste the text below.</p>
      <button class="btn primary" data-x="file">${icon('upload', 16)} Choose file…</button>
      <textarea class="lf-paste" placeholder="Paste MATPOWER case text here"></textarea>
      <button class="btn" data-x="paste">${icon('check', 16)} Import pasted text</button>`, (b, close) => {
      const take = (text, name) => {
        try {
          const t = String(text).trim();
          let sys;
          if (t.startsWith('{')) {
            const o = JSON.parse(t);
            sys = o.loadflow || o;
            if (!Array.isArray(sys.buses) || !Array.isArray(sys.branches)) throw new Error('not a load-flow system');
          } else sys = parseMatpower(t);
          if (!sys.name && name) sys.name = name.replace(/\.\w+$/, '');
          this.sys = sys;
          this.caseId = 'custom';
          this.changed();
          close();
          this.solve(true);
          this.render();
          this.toast(`Imported ${sys.buses.length} buses, ${sys.branches.length} branches`);
        } catch (e) { alert('Could not import: ' + e.message); }
      };
      b.querySelector('[data-x=file]').addEventListener('click', async () => {
        try { const { name, text } = await this.app.bridge.openFile('.m,.json,.txt,text/plain,application/json'); take(text, name); } catch (e) { if (e && e.message !== 'No file' && e.message !== 'cancelled') alert(e.message); }
      });
      b.querySelector('[data-x=paste]').addEventListener('click', () => take(b.querySelector('.lf-paste').value));
    });
  }

  exportSheet() {
    const fname = (this.sys.name || 'system').replace(/[^\w\- ]+/g, '_').trim() || 'system';
    this.app.showSheet('Export the system', `
      <p class="lf-desc">A MATPOWER case opens in MATLAB / Octave (MATPOWER), pandapower and PowerModels. The .json file re-opens here, including bus positions on the diagram.</p>
      <div class="lf-btns col">
        <button class="btn" data-x="m">${icon('code', 16)} MATPOWER case (.m)</button>
        <button class="btn" data-x="json">${icon('download', 16)} RaptiCKT system (.json)</button>
        <button class="btn" data-x="share">${icon('share', 16)} Share as text</button>
      </div>`, (b, close) => {
      b.querySelector('[data-x=m]').addEventListener('click', () => { this.app.bridge.saveFile(fname.replace(/\s+/g, '_') + '.m', 'text/plain', toMatpower(this.sys)); close(); });
      b.querySelector('[data-x=json]').addEventListener('click', () => { this.app.bridge.saveFile(fname + '.json', 'application/json', JSON.stringify({ app: 'RaptiCKT', loadflow: this.sys }, null, 1)); close(); });
      b.querySelector('[data-x=share]').addEventListener('click', () => { this.app.bridge.share(this.sys.name, toMatpower(this.sys)); close(); });
    });
  }

  // ---- bus and branch editing
  addBus() {
    const ids = this.sys.buses.map((b) => +b.id);
    const id = (ids.length ? Math.max(...ids) : 0) + 1;
    this.sys.buses.push(newBus(id, 'pq', { Pd: 0, Qd: 0, x: 20 + Math.random() * 60, y: 20 + Math.random() * 60 }));
    this.markCustom(); this.changed();
    this.editBus(this.sys.buses.length - 1, true);
  }

  addBranch(xf) {
    const b = this.sys.buses;
    if (b.length < 2) { alert('Add at least two buses first.'); return; }
    this.sys.branches.push(newBranch(b[0].id, b[1].id, xf ? 0 : 0.01, xf ? 0.1 : 0.05, xf ? 0 : 0.02, xf ? { tap: 1, kind: 'xf' } : {}));
    this.markCustom(); this.changed();
    this.editBranch(this.sys.branches.length - 1, true);
  }

  editBus(i, isNew) {
    const b = this.sys.buses[i];
    const f = (k, label, extra = '') => `<label data-f="${k}">${label}<input data-v="${k}" type="number" inputmode="decimal" step="any" value="${esc(b[k] ?? '')}" ${extra}></label>`;
    this.app.showSheet(isNew ? 'New bus' : `Bus ${esc(b.id)}`, `
      <div class="form-grid lf-grid2">
        <label>Bus number<input data-v="id" type="number" inputmode="numeric" value="${esc(b.id)}"></label>
        <label>Name<input data-v="name" value="${esc(b.name)}"></label>
        <label class="lf-span2">Bus type<select data-v="type">${['slack', 'pv', 'pq'].map((t) => `<option value="${t}" ${b.type === t ? 'selected' : ''}>${TYPE_LONG[t]}</option>`).join('')}</select></label>
        ${f('V', 'Voltage |V| (pu)')}
        ${f('ang', 'Angle δ (deg)')}
        ${f('Pg', 'Generation Pg (MW)')}
        ${f('Qg', 'Generation Qg (Mvar)')}
        ${f('Pd', 'Load Pd (MW)')}
        ${f('Qd', 'Load Qd (Mvar)')}
        ${f('Qmin', 'Qmin (Mvar)', 'placeholder="no limit"')}
        ${f('Qmax', 'Qmax (Mvar)', 'placeholder="no limit"')}
        ${f('Gs', 'Shunt Gs (MW)')}
        ${f('Bs', 'Shunt Bs (Mvar)')}
        ${f('kV', 'Base kV (info)')}
      </div>
      <p class="lf-desc lf-typehelp"></p>
      <div class="lf-btns"><button class="btn primary" data-x="ok">${icon('check', 16)} Done</button><button class="btn danger" data-x="del">${icon('trash', 16)} Delete bus</button></div>`, (el, close) => {
      const typeSel = el.querySelector('[data-v=type]');
      const showFor = () => {
        const t = typeSel.value;
        const vis = { V: t !== 'pq', ang: t === 'slack', Pg: t !== 'slack', Qg: t === 'pq', Qmin: t === 'pv', Qmax: t === 'pv' };
        for (const [k, v] of Object.entries(vis)) el.querySelector(`[data-f=${k}]`).classList.toggle('lf-hide', !v);
        el.querySelector('.lf-typehelp').textContent = {
          slack: 'Slack: |V| and angle are held; P and Q follow from the solution (it supplies the losses).',
          pv: 'PV: P and |V| are held; Q and the angle follow. With Q limits on, it turns into PQ at Qmin / Qmax.',
          pq: 'PQ: P and Q are given (load minus any fixed generation); |V| and the angle follow.',
        }[t];
      };
      typeSel.addEventListener('change', showFor);
      showFor();
      el.querySelector('[data-x=ok]').addEventListener('click', () => {
        const g = (k) => el.querySelector(`[data-v=${k}]`).value;
        const newId = Math.round(numIn(g('id'), b.id));
        if (newId !== +b.id && this.sys.buses.some((x) => +x.id === newId)) { alert(`Bus number ${newId} is already used.`); return; }
        const type = g('type');
        if (type === 'slack' && b.type !== 'slack') {
          const other = this.sys.buses.find((x) => x !== b && x.type === 'slack');
          if (other) { other.type = 'pv'; this.toast(`Bus ${other.id} changed from slack to PV`); }
        }
        if (newId !== +b.id) for (const l of this.sys.branches) { if (+l.from === +b.id) l.from = newId; if (+l.to === +b.id) l.to = newId; }
        Object.assign(b, {
          id: newId, name: g('name').trim() || `Bus ${newId}`, type,
          V: numIn(g('V'), 1) || 1, ang: numIn(g('ang')), Pg: numIn(g('Pg')), Qg: numIn(g('Qg')), Pd: numIn(g('Pd')), Qd: numIn(g('Qd')),
          Qmin: optNum(g('Qmin')), Qmax: optNum(g('Qmax')), Gs: numIn(g('Gs')), Bs: numIn(g('Bs')), kV: numIn(g('kV')),
        });
        this.markCustom(); this.changed(); close(); this.render();
      });
      el.querySelector('[data-x=del]').addEventListener('click', () => {
        const n = this.sys.branches.filter((l) => +l.from === +b.id || +l.to === +b.id).length;
        if (!confirm(`Delete bus ${b.id}${n ? ` and its ${n} branch${n === 1 ? '' : 'es'}` : ''}?`)) return;
        this.sys.branches = this.sys.branches.filter((l) => +l.from !== +b.id && +l.to !== +b.id);
        this.sys.buses.splice(i, 1);
        this.markCustom(); this.changed(); close(); this.render();
      });
    });
  }

  editBranch(i, isNew) {
    const l = this.sys.branches[i];
    const opts = (v) => this.sys.buses.map((b) => `<option value="${b.id}" ${+b.id === +v ? 'selected' : ''}>${esc(b.id)} · ${esc(b.name)}</option>`).join('');
    const f = (k, label, extra = '') => `<label>${label}<input data-v="${k}" type="number" inputmode="decimal" step="any" value="${esc(l[k] ?? '')}" ${extra}></label>`;
    const xf = (+l.tap && +l.tap !== 1) || +l.shift || l.kind === 'xf';
    this.app.showSheet(isNew ? (xf ? 'New transformer' : 'New line') : `Branch ${esc(l.from)} → ${esc(l.to)}`, `
      <div class="form-grid lf-grid2">
        <label>From bus<select data-v="from">${opts(l.from)}</select></label>
        <label>To bus<select data-v="to">${opts(l.to)}</select></label>
        ${f('R', 'R (pu)')}
        ${f('X', 'X (pu)')}
        ${f('B', 'B total charging (pu)')}
        ${f('rate', 'Rating (MVA)', 'placeholder="none"')}
        ${f('tap', 'Tap ratio (from side)', 'placeholder="1 (line)"')}
        ${f('shift', 'Phase shift (deg)')}
      </div>
      <label class="lf-check"><input type="checkbox" data-v="on" ${l.on === false ? '' : 'checked'}><span><b>In service</b><small>Untick to take the branch out (outage study)</small></span></label>
      <p class="lf-desc">Tap ratio 0 or 1 = a line or a transformer at nominal ratio. A tap of 0.95 on the from side raises the voltage on the to side. Use <b>Per-unit tools</b> to convert Ω, Ω/km or % impedance.</p>
      <div class="lf-btns"><button class="btn primary" data-x="ok">${icon('check', 16)} Done</button><button class="btn danger" data-x="del">${icon('trash', 16)} Delete</button></div>`, (el, close) => {
      el.querySelector('[data-x=ok]').addEventListener('click', () => {
        const g = (k) => el.querySelector(`[data-v=${k}]`).value;
        const from = +g('from'), to = +g('to');
        if (from === to) { alert('From and to must be different buses.'); return; }
        const R = numIn(g('R')), X = numIn(g('X'));
        if (!R && !X) { alert('R and X cannot both be zero.'); return; }
        Object.assign(l, { from, to, R, X, B: numIn(g('B')), rate: numIn(g('rate')), tap: numIn(g('tap')), shift: numIn(g('shift')), on: el.querySelector('[data-v=on]').checked });
        this.markCustom(); this.changed(); close(); this.render();
      });
      el.querySelector('[data-x=del]').addEventListener('click', () => {
        if (!confirm(`Delete branch ${l.from} → ${l.to}?`)) return;
        this.sys.branches.splice(i, 1);
        this.markCustom(); this.changed(); close(); this.render();
      });
    });
  }

  // ---------------------------------------------------------------- Results tab
  renderResults(body) {
    const r = this.res;
    if (!r) { this.needRun(body); return; }
    const t = r.totals, m = METHODS.find((x) => x.id === r.method);
    const last = r.history[r.history.length - 1];
    let vmin = r.buses[0], vmax = r.buses[0];
    for (const b of r.buses) { if (b.V < vmin.V) vmin = b; if (b.V > vmax.V) vmax = b; }
    const dc = r.method === 'dc';
    body.innerHTML = `
      <div class="lf-status ${r.converged ? 'ok' : 'bad'}">${icon(r.converged ? 'check' : 'x', 22)}<div><b>${r.converged ? 'Converged' : 'Did not converge'}</b>
        <span>${m.name} · ${r.iterations} iteration${r.iterations === 1 ? '' : 's'}${dc ? '' : ` · max mismatch ${last.mis.toExponential(2)} pu`} · ${r.ms.toFixed(1)} ms</span></div></div>
      ${r.converged ? '' : '<p class="lf-warn">The results below are the last iterate and are not valid. Try Newton–Raphson, a flat start, more iterations, or check the data (very high load, wrong impedances, X = 0).</p>'}
      <div class="lf-tiles">
        ${this.tile('Generation', `${fx(t.Pg, 2)} MW`, dc ? '' : `${fx(t.Qg, 2)} Mvar`)}
        ${this.tile('Load', `${fx(t.Pd, 2)} MW`, `${fx(t.Qd, 2)} Mvar`)}
        ${this.tile('Losses', `${fx(t.lossP, 3)} MW`, dc ? 'DC: lossless' : `${fx(t.lossQ, 3)} Mvar · ${fx(t.Pd ? (t.lossP / t.Pd) * 100 : 0, 2)} %`)}
        ${this.tile('Lowest voltage', `${fx(vmin.V, 4)} pu`, `bus ${esc(vmin.id)}`, vmin.V < r.options.vMin ? 'bad' : '')}
        ${this.tile('Highest voltage', `${fx(vmax.V, 4)} pu`, `bus ${esc(vmax.id)}`, vmax.V > r.options.vMax ? 'warn' : '')}
        ${dc ? '' : this.tile('Line charging', `${fx(t.charging, 2)} Mvar`, t.Qsh ? `shunts ${fx(t.Qsh, 2)} Mvar` : 'generated by lines')}
      </div>
      ${r.violations.length || r.events.length ? `<div class="lf-card lf-alerts">
        ${r.violations.map((v) => `<div class="lf-alert ${v.kind}">${icon('info', 16)}<span>${esc(v.text)}</span></div>`).join('')}
        ${r.events.map((e) => `<div class="lf-alert ev">${icon('bolt', 16)}<span>${esc(e)}</span></div>`).join('')}
      </div>` : `<div class="lf-alert okv">${icon('check', 16)}<span>All bus voltages within ${r.options.vMin}–${r.options.vMax} pu${r.branches.some((b) => b.rate) ? ' and no branch overloaded' : ''}.</span></div>`}
      <div class="lf-btns">
        <button class="btn sm" data-x="csv">${icon('download', 15)} CSV</button>
        <button class="btn sm" data-x="report">${icon('share', 15)} Report</button>
      </div>
      <h4>Bus voltages and power</h4>
      <div class="lf-tw"><table class="tbl lf-tbl">
        <thead><tr><th>Bus</th><th>Type</th><th>|V| pu</th><th>δ deg</th><th>Pg MW</th><th>Qg Mvar</th><th>Pd MW</th><th>Qd Mvar</th></tr></thead>
        <tbody>${r.buses.map((b) => `<tr data-rb="${esc(b.id)}" class="${b.V < r.options.vMin ? 'vlo' : b.V > r.options.vMax ? 'vhi' : ''}"><td><b>${esc(b.id)}</b> <small>${esc(b.name)}</small></td><td>${TYPE_LABEL[b.type]}${b.origType !== b.type ? '*' : ''}</td><td>${fx(b.V, 4)}</td><td>${fx(b.ang, 3)}</td><td>${b.Pg || b.type !== 'pq' ? fx(b.Pg, 2) : ''}</td><td>${dc ? '' : b.Qg || b.type !== 'pq' ? fx(b.Qg, 2) : ''}</td><td>${b.Pd ? fx(b.Pd, 2) : ''}</td><td>${b.Qd ? fx(b.Qd, 2) : ''}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td></td><td></td><td></td><td>${fx(t.Pg, 2)}</td><td>${dc ? '' : fx(t.Qg, 2)}</td><td>${fx(t.Pd, 2)}</td><td>${fx(t.Qd, 2)}</td></tr></tfoot>
      </table></div>
      ${r.buses.some((b) => b.origType !== b.type) ? '<p class="lf-note">* PV bus held at a Q limit (now PQ).</p>' : ''}
      <h4>Line flows and losses</h4>
      <div class="lf-tw"><table class="tbl lf-tbl">
        <thead><tr><th>From → To</th><th>P from MW</th><th>Q from Mvar</th><th>P to MW</th><th>Q to Mvar</th><th>Loss MW</th><th>Loss Mvar</th><th>I pu</th><th>Load %</th></tr></thead>
        <tbody>${r.branches.map((l) => `<tr class="${!l.on ? 'off' : l.loading > 100 ? 'vlo' : ''}"><td><b>${esc(l.from)} → ${esc(l.to)}</b>${l.xfmr ? ' <small>XF</small>' : ''}${!l.on ? ' <small>out</small>' : ''}</td><td>${fx(l.Pf, 2)}</td><td>${dc ? '' : fx(l.Qf, 2)}</td><td>${fx(l.Pt, 2)}</td><td>${dc ? '' : fx(l.Qt, 2)}</td><td>${fx(l.lossP, 3)}</td><td>${dc ? '' : fx(l.lossQ, 3)}</td><td>${fx(Math.max(l.If, l.It), 3)}</td><td>${l.rate ? fx(l.loading, 1) : '—'}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total loss</td><td></td><td></td><td></td><td></td><td>${fx(t.lossP, 3)}</td><td>${dc ? '' : fx(t.lossQ, 3)}</td><td></td><td></td></tr></tfoot>
      </table></div>
      <p class="lf-note">P from / Q from: power leaving the from bus into the branch; P to / Q to: power leaving the to bus. Their sum is the branch loss. Tap a bus row for details.</p>`;
    body.querySelector('[data-x=csv]').addEventListener('click', () => this.app.bridge.saveFile(`${(this.sys.name || 'loadflow').replace(/\W+/g, '_')}_loadflow.csv`, 'text/csv', this.csv()));
    body.querySelector('[data-x=report]').addEventListener('click', () => this.app.bridge.share(`Load flow – ${this.sys.name}`, this.report()));
    body.querySelectorAll('[data-rb]').forEach((tr) => tr.addEventListener('click', () => this.busDetail(tr.dataset.rb)));
  }

  tile(label, big, small, cls = '') {
    return `<div class="lf-tile ${cls}"><span>${label}</span><b>${big}</b>${small ? `<small>${small}</small>` : ''}</div>`;
  }

  busDetail(id) {
    const r = this.res;
    if (!r) return;
    const b = r.buses.find((x) => String(x.id) === String(id));
    if (!b) return;
    const flows = r.branches.filter((l) => l.on && (String(l.from) === String(id) || String(l.to) === String(id))).map((l) => {
      const out = String(l.from) === String(id);
      return { to: out ? l.to : l.from, P: out ? l.Pf : l.Pt, Q: out ? l.Qf : l.Qt };
    });
    const dc = r.method === 'dc';
    this.app.showSheet(`Bus ${esc(b.id)} · ${esc(b.name)}`, `
      <div class="lf-tiles">
        ${this.tile('Voltage', `${fx(b.V, 4)} pu`, `${fx(b.ang, 3)}°`)}
        ${this.tile('Injection', `${fx(b.Pinj, 2)} MW`, dc ? '' : `${fx(b.Qinj, 2)} Mvar`)}
        ${this.tile('Generation', `${fx(b.Pg, 2)} MW`, dc ? '' : `${fx(b.Qg, 2)} Mvar`)}
        ${this.tile('Load', `${fx(b.Pd, 2)} MW`, `${fx(b.Qd, 2)} Mvar`)}
      </div>
      <h4 class="lf-sh">Power leaving the bus</h4>
      <table class="tbl"><thead><tr><th>To bus</th><th>P MW</th><th>Q Mvar</th></tr></thead>
      <tbody>${flows.map((f) => `<tr><td>${esc(f.to)}</td><td>${fx(f.P, 2)}</td><td>${dc ? '' : fx(f.Q, 2)}</td></tr>`).join('')}
      ${b.Qsh || b.Psh ? `<tr><td>Shunt</td><td>${fx(b.Psh, 2)}</td><td>${dc ? '' : fx(-b.Qsh, 2)}</td></tr>` : ''}</tbody></table>
      <p class="lf-note">Generation − load = the sum of the power leaving the bus (Kirchhoff).</p>`);
  }

  csv() {
    const r = this.res, rows = [];
    rows.push(`Load flow,${this.sys.name},${METHODS.find((m) => m.id === r.method).name},${r.converged ? 'converged' : 'not converged'},${r.iterations} iterations,base ${this.sys.baseMVA} MVA`);
    rows.push('');
    rows.push('Bus,Name,Type,V (pu),Angle (deg),Pg (MW),Qg (Mvar),Pd (MW),Qd (Mvar)');
    for (const b of r.buses) rows.push([b.id, `"${b.name}"`, TYPE_LABEL[b.type], b.V.toFixed(6), b.ang.toFixed(4), b.Pg.toFixed(4), b.Qg.toFixed(4), b.Pd, b.Qd].join(','));
    rows.push('');
    rows.push('From,To,P from (MW),Q from (Mvar),P to (MW),Q to (Mvar),Loss P (MW),Loss Q (Mvar),Rating (MVA),Loading (%)');
    for (const l of r.branches) rows.push([l.from, l.to, l.Pf.toFixed(4), l.Qf.toFixed(4), l.Pt.toFixed(4), l.Qt.toFixed(4), l.lossP.toFixed(4), l.lossQ.toFixed(4), l.rate || '', l.rate ? l.loading.toFixed(2) : ''].join(','));
    rows.push('');
    rows.push(`Total generation,${r.totals.Pg.toFixed(4)} MW,${r.totals.Qg.toFixed(4)} Mvar`);
    rows.push(`Total load,${r.totals.Pd.toFixed(4)} MW,${r.totals.Qd.toFixed(4)} Mvar`);
    rows.push(`Total losses,${r.totals.lossP.toFixed(4)} MW,${r.totals.lossQ.toFixed(4)} Mvar`);
    return rows.join('\n');
  }

  report() {
    const r = this.res, pad = (s, n) => String(s).padStart(n), m = METHODS.find((x) => x.id === r.method).name;
    const L = [];
    L.push(`LOAD FLOW REPORT — ${this.sys.name}`);
    L.push(`Method: ${m}   ${r.converged ? 'Converged' : 'NOT converged'} in ${r.iterations} iterations   Base: ${this.sys.baseMVA} MVA`);
    L.push('');
    L.push(' Bus  Type     |V|pu    Angle°      Pg MW    Qg Mvar      Pd MW    Qd Mvar');
    for (const b of r.buses) L.push(`${pad(b.id, 4)}  ${TYPE_LABEL[b.type].padEnd(5)} ${pad(b.V.toFixed(4), 8)} ${pad(b.ang.toFixed(3), 9)} ${pad(b.Pg.toFixed(2), 10)} ${pad(b.Qg.toFixed(2), 10)} ${pad(b.Pd.toFixed(2), 10)} ${pad(b.Qd.toFixed(2), 10)}`);
    L.push('');
    L.push(' From   To    P from    Q from      P to      Q to   Loss MW  Loss Mvar');
    for (const l of r.branches) L.push(`${pad(l.from, 5)} ${pad(l.to, 4)} ${pad(l.Pf.toFixed(2), 9)} ${pad(l.Qf.toFixed(2), 9)} ${pad(l.Pt.toFixed(2), 9)} ${pad(l.Qt.toFixed(2), 9)} ${pad(l.lossP.toFixed(3), 9)} ${pad(l.lossQ.toFixed(3), 9)}`);
    L.push('');
    L.push(`Generation ${r.totals.Pg.toFixed(3)} MW + j${r.totals.Qg.toFixed(3)} Mvar`);
    L.push(`Load       ${r.totals.Pd.toFixed(3)} MW + j${r.totals.Qd.toFixed(3)} Mvar`);
    L.push(`Losses     ${r.totals.lossP.toFixed(3)} MW + j${r.totals.lossQ.toFixed(3)} Mvar`);
    for (const v of r.violations) L.push('! ' + v.text);
    for (const e of r.events) L.push('* ' + e);
    L.push('');
    L.push('RaptiCKT Load Flow · rapti.net');
    return L.join('\n');
  }

  // ---------------------------------------------------------------- Diagram tab
  renderDiagram(body) {
    body.innerHTML = `
      <div class="lf-diagbar">
        <div class="lf-seg sm lf-style">${[['classic', 'Textbook'], ['modern', 'Modern']].map(([k, t]) => `<button data-ds="${k}" class="${this.diagStyle === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="lf-seg sm">${[['P', 'MW'], ['PQ', 'MW + Mvar'], ['load', 'Loading %'], ['none', 'Off']].map(([k, t]) => `<button data-fl="${k}" class="${this.flowLabel === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      </div>
      <div class="lf-diag">
        <canvas></canvas>
        <div class="lf-zoom">
          <button data-z="out" title="Zoom out">${icon('minus', 18)}</button>
          <span class="lf-zpct">100%</span>
          <button data-z="in" title="Zoom in">${icon('plus', 18)}</button>
          <i></i>
          <button data-z="fit" title="Fit to screen">${icon('fit', 17)}</button>
          <button data-z="max" title="Full screen">${icon('fullscreen', 16)}</button>
        </div>
        <button class="lf-diagx" data-z="max" title="Close full screen">${icon('x', 20)}</button>
      </div>
      <div class="lf-legend">${this.diagStyle === 'modern' ? `
        <span><i style="background:#4ade80"></i>V within limits</span><span><i style="background:#f87171"></i>Under-voltage</span><span><i style="background:#fbbf24"></i>Over-voltage</span>
        <span><i class="ln" style="background:#f97316"></i>Line ≥ 70 %</span><span><i class="ln" style="background:#ef4444"></i>Overloaded</span><span><b>~</b> generator</span><span><b>↓</b> load</span>` : `
        <span><b>G1</b> generator</span><span><b>▼</b> load</span><span><i style="background:#1d4ed8"></i>|V|∠δ (pu, deg), flows</span><span><i style="background:#dc2626"></i>Outside V limits</span>
        <span><i class="ln" style="background:#ea580c"></i>Line ≥ 70 %</span><span><i class="ln" style="background:#dc2626"></i>Overloaded</span><span><b>T1</b> transformer</span>`}
      </div>
      <p class="lf-note">${this.res ? 'The moving dots and arrows show the direction of real power. ' : 'Run the load flow to see voltages and flows. '}Pinch, scroll or double-tap to zoom (zooming in also shows labels there is no room for); drag the background to pan; drag a bus to move it; tap a bus for its details.</p>`;
    body.querySelectorAll('[data-ds]').forEach((b) => b.addEventListener('click', () => {
      if (this.diagStyle === b.dataset.ds) return;
      this.diagStyle = b.dataset.ds;
      this.persist();
      this.renderDiagram(body);
    }));
    body.querySelectorAll('[data-fl]').forEach((b) => b.addEventListener('click', () => {
      this.flowLabel = b.dataset.fl;
      body.querySelectorAll('[data-fl]').forEach((x) => x.classList.toggle('on', x === b));
      this.drawDiagram();
    }));
    const cv = body.querySelector('canvas');
    body.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => {
      const z = b.dataset.z, w = cv.clientWidth, h = cv.clientHeight;
      if (z === 'in') this.zoomAt(w / 2, h / 2, 1.5, true);
      else if (z === 'out') this.zoomAt(w / 2, h / 2, 1 / 1.5, true);
      else if (z === 'fit') this.animateView({ s: 1, tx: 0, ty: 0 });
      else this.toggleMax();
    }));
    this.bindDiagram(cv);
    requestAnimationFrame(() => { this.drawDiagram(); this.startFlow(); });
  }

  /** Diagram full screen on/off (the back button also leaves it). */
  toggleMax(on) {
    const d = this.root.querySelector('.lf-diag');
    if (!d) return;
    d.classList.toggle('max', on ?? !d.classList.contains('max'));
    requestAnimationFrame(() => this.drawDiagram());
  }

  get view() { return this._view || (this._view = { s: 1, tx: 0, ty: 0 }); }

  clampView(v) {
    const cv = this.root.querySelector('.lf-diag canvas'), w = cv?.clientWidth || 300, h = cv?.clientHeight || 300;
    v.s = Math.max(0.5, Math.min(8, v.s));
    // keep at least a third of the drawing on screen
    v.tx = Math.max(-w * v.s + w / 3, Math.min(w - w / 3, v.tx));
    v.ty = Math.max(-h * v.s + h / 3, Math.min(h - h / 3, v.ty));
    return v;
  }

  /** Zoom by factor k keeping the screen point (x, y) fixed. */
  zoomAt(x, y, k, animate) {
    const v = this.view, s = Math.max(0.5, Math.min(8, v.s * k)), f = s / v.s;
    const to = this.clampView({ s, tx: x - (x - v.tx) * f, ty: y - (y - v.ty) * f });
    if (animate) this.animateView(to); else { Object.assign(v, to); this.drawDiagram(); }
  }

  animateView(to) {
    const from = { ...this.view }, t0 = performance.now(), dur = 260;
    cancelAnimationFrame(this.viewRaf);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      // the scale moves geometrically so the zoom feels even
      this.view.s = from.s * Math.pow(to.s / from.s, e);
      this.view.tx = from.tx + (to.tx - from.tx) * e;
      this.view.ty = from.ty + (to.ty - from.ty) * e;
      this.drawDiagram();
      if (p < 1) this.viewRaf = requestAnimationFrame(step);
    };
    this.viewRaf = requestAnimationFrame(step);
  }

  /** Bus positions in drawing space (the fitted, unzoomed canvas), from x / y in 0–100. */
  layout(w, h) {
    // the textbook style writes its labels beside the bars, so it keeps a wider margin
    const n = this.sys.buses.length, pad = this.diagStyle === 'modern' ? { l: 44, r: 44, t: 58, b: 74 } : { l: 66, r: 66, t: 70, b: 82 };
    const pos = new Map();
    this.sys.buses.forEach((b, i) => {
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; b.x = 50 + 42 * Math.cos(a); b.y = 50 + 42 * Math.sin(a); }
      pos.set(String(b.id), { wx: pad.l + (b.x / 100) * (w - pad.l - pad.r), wy: pad.t + (b.y / 100) * (h - pad.t - pad.b), b });
    });
    this.diagPad = pad;
    return pos;
  }

  /** Moving dots along the lines, in the direction of the real power, while the diagram is shown. */
  startFlow() {
    cancelAnimationFrame(this.flowRaf);
    const smooth = motion.smooth && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!smooth || !this.res) return;
    const loop = () => {
      const cv = this.root.querySelector('.lf-diag canvas');
      if (!cv || this.tab !== 'diagram' || !this.root.classList.contains('active') || document.hidden) { this.flowRaf = 0; return; }
      this.drawDiagram();
      this.flowRaf = requestAnimationFrame(loop);
    };
    this.flowRaf = requestAnimationFrame(loop);
  }

  drawDiagram() {
    const cv = this.root.querySelector('.lf-diag canvas');
    if (!cv) return;
    const { ctx, w, h } = prep(cv);
    const pos = this.layout(w, h), v = this.view;
    // symbols grow a little when zoomed in, but much less than the spacing, so crowded labels come apart
    const k = Math.max(0.85, Math.min(1.6, Math.pow(v.s, 0.3)));
    for (const p of pos.values()) { p.x = p.wx * v.s + v.tx; p.y = p.wy * v.s + v.ty; }
    this.diagPos = pos;
    const pct = this.root.querySelector('.lf-zpct');
    if (pct) pct.textContent = `${Math.round(v.s * 100)}%`;
    if (this.diagStyle !== 'modern') { this.drawClassic(cv, ctx, w, h, pos, k); return; }
    const r = this.res, opts = this.opts;
    const rb = new Map(r ? r.buses.map((b) => [String(b.id), b]) : []);
    const text = css('--text', '#e8eef8'), muted = css('--muted', '#7f8ca6'), text2 = css('--text2', '#b9c5da'), accent = css('--accent', '#22d3ee'), accent2 = css('--accent2', '#8b5cf6');
    const surface = css('--surface', '#0f1729'), surface2 = css('--surface2', '#16203a'), border = css('--border2', 'rgba(148,178,230,.22)');
    const light = document.documentElement.dataset.theme === 'light';
    const vcol = (val) => (val < opts.vMin - 1e-9 ? (light ? '#dc2626' : '#f87171') : val > opts.vMax + 1e-9 ? (light ? '#d97706' : '#fbbf24') : (light ? '#16a34a' : '#4ade80'));
    const t = performance.now() / 1000;
    const FONT = 'Inter, Roboto, sans-serif', MONO = '"JetBrains Mono", "Roboto Mono", monospace';
    const bw = 54 * k, bh = 8 * k;

    // background: soft glow and a dot grid that pans and zooms with the drawing
    const g = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.max(w, h) * 0.75);
    g.addColorStop(0, light ? 'rgba(8,145,178,0.06)' : 'rgba(34,211,238,0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    let gs = 24 * v.s;
    while (gs < 14) gs *= 2;
    while (gs > 56) gs /= 2;
    ctx.fillStyle = border;
    const ox = ((v.tx % gs) + gs) % gs, oy = ((v.ty % gs) + gs) % gs;
    for (let x = ox; x < w; x += gs) for (let y = oy; y < h; y += gs) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);

    // ---- layout: where every line meets its bus bar, and a free spot for everything around a bus
    // a line meets the bar at the end facing the other bus when it runs sideways, otherwise spread along the bar
    const half = bw / 2 - 6 * k;
    const attach = (p, q) => {
      const dx = q.x - p.x, dy = q.y - p.y;
      if (Math.abs(dy) < Math.abs(dx) * 0.4) return { x: p.x + Math.sign(dx) * half, y: p.y };
      return { x: p.x + Math.max(-half, Math.min(half, dx * 0.35)), y: p.y };
    };
    const flows = [], segs = [];
    let pmax = 1e-9;
    if (r) for (const l of r.branches) if (l.on) pmax = Math.max(pmax, Math.abs(l.Pf));
    this.sys.branches.forEach((l, i) => {
      const pa = pos.get(String(l.from)), pb = pos.get(String(l.to));
      if (!pa || !pb) return;
      const a = attach(pa, pb), b = attach(pb, pa);
      const res = r?.branches[i], live = !!(res && res.on);
      let col = muted;
      if (live) col = res.rate ? (res.loading > 100 ? '#ef4444' : res.loading >= 70 ? '#f97316' : (light ? '#16a34a' : '#4ade80')) : accent;
      flows.push({ a, b, l, res, col, live });
      segs.push([a.x, a.y, b.x, b.y]);
    });
    const taken = [];
    for (const p of pos.values()) taken.push([p.x - bw / 2, p.y - bh / 2, bw, bh]);
    const hitsLine = (x, y, wd, ht, m) => segs.some(([ax, ay, bx, by]) => segRect(ax, ay, bx, by, x - m, y - m, x + wd + m, y + ht + m));
    // half a pixel of slack: boxes that merely touch (a label right under its bar) do not count as overlapping
    const hitsBox = (x, y, wd, ht) => taken.some(([a, b, c, d]) => x < a + c - 0.5 && x + wd > a + 0.5 && y < b + d - 0.5 && y + ht > b + 0.5);
    const onCanvas = (x, y, wd, ht) => x >= 2 && y >= 2 && x + wd <= w - 2 && y + ht <= h - 2;
    const free = (x, y, wd, ht, m = 3 * k) => onCanvas(x, y, wd, ht) && !hitsBox(x, y, wd, ht) && !hitsLine(x, y, wd, ht, m);
    // keep labels out from under the zoom buttons
    const zb = this.root.querySelector('.lf-zoom'), cb = cv.getBoundingClientRect();
    if (zb && zb.offsetParent) { const z = zb.getBoundingClientRect(); taken.push([z.left - cb.left - 4, z.top - cb.top - 4, z.width + 8, z.height + 8]); }
    /**
     * First candidate rectangle [x, y, w, h] clear of lines and of everything placed so far: the near
     * spots, then the far ones; when none is clear it stays near its bus, crossing a line if it must.
     */
    const place = (near, far = []) => {
      const best = near.find((c) => free(...c)) || far.find((c) => free(...c)) || near.find((c) => !hitsBox(...c)) || far.find((c) => !hitsBox(...c)) || near[0];
      taken.push(best);
      return best;
    };

    const deco = new Map();
    for (const [id, p] of pos) {
      const b = p.b, res = rb.get(id), d = {};
      const gen = b.type !== 'pq' || +b.Pg > 0, load = +b.Pd > 0 || +b.Qd > 0;
      d.col = res ? vcol(res.V) : text2;
      if (gen) { // generator circle above or below the bar, on a short stem
        const gr = 12 * k, dy = 34 * k;
        const c = [[0, -1], [-0.6, -1], [0.6, -1], [0, 1], [-0.6, 1], [0.6, 1]].map(([fx, fy]) => {
          const gx = p.x + fx * half, gy = p.y + fy * dy;
          return [gx - gr, Math.min(gy - gr, p.y + bh / 2), 2 * gr, Math.abs(gy - p.y) + gr - bh / 2];
        });
        const box = place(c);
        d.gen = { x: box[0] + gr, y: box[1] < p.y ? box[1] + gr : box[1] + box[3] - gr, r: gr };
        if (b.type === 'slack') {
          ctx.font = `700 ${8.5 * k}px ${FONT}`;
          const tw = ctx.measureText('SLACK').width + 14 * k, th = 15 * k, gx = d.gen.x, gy = d.gen.y;
          d.slack = place([[gx + gr + 5 * k, gy - th / 2, tw, th], [gx - gr - 5 * k - tw, gy - th / 2, tw, th], [gx - tw / 2, gy - gr - 5 * k - th, tw, th], [gx - tw / 2, gy + gr + 5 * k, tw, th]]);
        }
      }
      if (load) { // load arrow hanging from the bar, away from the generator
        const aw = 12 * k, ah = 21 * k, down = !d.gen || d.gen.y < p.y;
        const xs = [half - 4 * k, -half + 4 * k, 0, half * 0.5, -half * 0.5];
        const c = [];
        for (const dir of down ? [1, -1] : [-1, 1]) for (const fx of xs) c.push([p.x + fx - aw / 2, dir > 0 ? p.y + bh / 2 : p.y - bh / 2 - ah, aw, ah]);
        const box = place(c);
        d.load = { x: box[0] + aw / 2, y0: box[1] < p.y ? box[1] + box[3] : box[1], dir: box[1] < p.y ? -1 : 1, len: ah };
      }
      // bus number badge: beside the bar, or above / below one of its ends
      const br = 10.5 * k, s2 = 2 * br, gapx = 4 * k;
      const bc = [
        [p.x - bw / 2 - gapx - s2, p.y - br], [p.x + bw / 2 + gapx, p.y - br],
        [p.x - bw / 2 - s2 * 0.4, p.y - bh / 2 - 4 * k - s2], [p.x - bw / 2 - s2 * 0.4, p.y + bh / 2 + 4 * k],
        [p.x + bw / 2 - s2 * 0.6, p.y - bh / 2 - 4 * k - s2], [p.x + bw / 2 - s2 * 0.6, p.y + bh / 2 + 4 * k],
      ].map(([x, y]) => [x, y, s2, s2]);
      const bb = place(bc);
      d.badge = { x: bb[0] + br, y: bb[1] + br, r: br };
      if (res) { // |V|∠δ label
        const s = `${res.V.toFixed(3)}∠${res.ang.toFixed(1)}°`;
        ctx.font = `600 ${10 * k}px ${MONO}`;
        const tw = ctx.measureText(s).width + 12 * k, th = 17 * k, gp = 5 * k;
        const below = p.y + bh / 2 + gp, above = p.y - bh / 2 - gp - th;
        // under or over the bar: centred, or lined up with its left or right end
        const xs = [p.x - tw / 2, p.x - bw / 2, p.x + bw / 2 - tw];
        const near = [], far = [];
        for (const y of [below, above]) for (const x of xs) near.push([x, y, tw, th]);
        for (const y of [below + 20 * k, above - 20 * k]) for (const x of xs) far.push([x, y, tw, th]);
        const gl = d.badge.x < p.x - bw / 2 ? 2 * br + 8 * k : 5 * k, gr2 = d.badge.x > p.x + bw / 2 ? 2 * br + 8 * k : 5 * k; // step past the badge on its side
        far.push([p.x + bw / 2 + gr2, p.y - th / 2, tw, th], [p.x - bw / 2 - gl - tw, p.y - th / 2, tw, th]);
        d.volt = { box: place(near, far), s };
      }
      if (b.name && b.name !== `Bus ${b.id}` && (v.s >= 1.2 || !gen)) {
        ctx.font = `600 ${10 * k}px ${FONT}`;
        const tw = ctx.measureText(b.name).width + 4 * k, th = 13 * k;
        const c = [[p.x - tw / 2, p.y - bh / 2 - 6 * k - th, tw, th], [p.x - tw / 2, p.y + bh / 2 + 6 * k, tw, th], [p.x + bw / 2 + 28 * k, p.y - th / 2, tw, th], [p.x - bw / 2 - 28 * k - tw, p.y - th / 2, tw, th]];
        const box = c.find((x) => free(...x, 1));
        if (box) { taken.push(box); d.name = { box, s: b.name }; }
      }
      deco.set(id, d);
    }

    // ---- branches: soft halo, then the line itself
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const { a, b, l, col, live } of flows) {
      if (live) {
        ctx.strokeStyle = col; ctx.globalAlpha = 0.16; ctx.lineWidth = 8 * k;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = col; ctx.lineWidth = (live ? 2.6 : 1.8) * k;
      ctx.setLineDash(l.on === false ? [6 * k, 6 * k] : []);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    // power-flow dots, moving from the sending to the receiving end
    if (r) {
      for (const f of flows) {
        if (!f.live || Math.abs(f.res.Pf) < 0.05) continue;
        const fwd = f.res.Pf >= 0, from = fwd ? f.a : f.b, to = fwd ? f.b : f.a;
        const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy);
        if (len < 40) continue;
        const gap = 26 * k, speed = (18 + 70 * Math.min(1, Math.abs(f.res.Pf) / pmax)) * k;
        const off = (t * speed) % gap;
        ctx.fillStyle = light ? f.col : '#ffffff';
        ctx.globalAlpha = 0.85;
        for (let dd = off + 14 * k; dd < len - 14 * k; dd += gap) {
          ctx.beginPath(); ctx.arc(from.x + (dx * dd) / len, from.y + (dy * dd) / len, 1.9 * k, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    // transformers, direction arrows and flow labels (each label slides along its line to a free spot)
    const pills = [];
    for (const f of flows) {
      const { a, b, l, res, col, live } = f;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const xf = (+l.tap && +l.tap !== 1) || +l.shift || l.kind === 'xf';
      if (xf) {
        const mx = a.x + dx * 0.5, my = a.y + dy * 0.5, rr = 7 * k;
        ctx.lineWidth = 2 * k;
        [[-0.6, accent], [0.6, accent2]].forEach(([s, c]) => {
          ctx.fillStyle = surface; ctx.strokeStyle = c;
          ctx.beginPath(); ctx.arc(mx + ux * rr * s, my + uy * rr * s, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        });
        taken.push([mx - 2 * rr, my - 2 * rr, 4 * rr, 4 * rr]);
        if (+l.tap && +l.tap !== 1 && v.s >= 1.4) {
          ctx.font = `600 ${9 * k}px ${FONT}`; ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(`1:${(+l.tap).toFixed(3)}`, mx - uy * 24 * k, my + ux * 24 * k);
        }
      }
      if (!live || this.flowLabel === 'none' || len < 30) continue;
      const fwd = res.Pf >= 0;
      const P = fwd ? res.Pf : res.Pt, Q = fwd ? res.Qf : res.Qt;
      const lab = this.flowLabel === 'load' ? (res.rate ? `${res.loading.toFixed(0)} %` : `${res.S.toFixed(0)} MVA`)
        : this.flowLabel === 'PQ' && r.method !== 'dc' ? `${Math.abs(P).toFixed(1)} ${Q * (fwd ? 1 : -1) >= 0 ? '+' : '−'} j${Math.abs(Q).toFixed(1)}` : `${Math.abs(P).toFixed(1)} MW`;
      const side = Math.abs(uy) < 0.35 ? 1 : (ux * uy > 0 ? -1 : 1); // below horizontal lines, beside steep ones
      const nx = -uy * side, ny = ux * side;
      ctx.font = `600 ${10.5 * k}px ${FONT}`;
      const pw = ctx.measureText(lab).width + 14 * k, ph = 18 * k;
      // clearance from the line so the pill sits beside it, not on it
      const off = Math.abs(nx) * (pw / 2) + Math.abs(ny) * (ph / 2) + 5 * k;
      let tt = xf ? 0.28 : 0.5, lx = 0, ly = 0, found = false;
      for (const c of xf ? [0.28, 0.72, 0.2, 0.8, 0.36, 0.64] : [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78]) {
        for (const sd of [1, -1]) {
          const cx = a.x + dx * c + nx * off * sd, cy = a.y + dy * c + ny * off * sd;
          if (!hitsBox(cx - pw / 2, cy - ph / 2, pw, ph) && !hitsLine(cx - pw / 2, cy - ph / 2, pw, ph, 0)) { tt = c; lx = cx; ly = cy; found = true; break; }
        }
        if (found) break;
      }
      // no spot clear of everything: settle for one that at least hides no other label
      for (const c of found ? [] : [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78, 0.15, 0.85]) {
        for (const sd of [1, -1]) {
          const cx = a.x + dx * c + nx * off * sd, cy = a.y + dy * c + ny * off * sd;
          if (!hitsBox(cx - pw / 2, cy - ph / 2, pw, ph)) { tt = c; lx = cx; ly = cy; found = true; break; }
        }
        if (found) break;
      }
      // still nowhere: leave this label out (it appears once zooming in makes room), keep the arrow
      if (found) taken.push([lx - pw / 2, ly - ph / 2, pw, ph]);
      const mx = a.x + dx * tt, my = a.y + dy * tt, sx = fwd ? ux : -ux, sy = fwd ? uy : -uy, ah = 7 * k;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(mx + sx * ah, my + sy * ah); ctx.lineTo(mx - sx * ah * 0.7 - sy * ah * 0.75, my - sy * ah * 0.7 + sx * ah * 0.75); ctx.lineTo(mx - sx * ah * 0.7 + sy * ah * 0.75, my - sy * ah * 0.7 - sx * ah * 0.75); ctx.closePath(); ctx.fill();
      if (found) pills.push({ x: lx, y: ly, w: pw, h: ph, lab, col });
    }
    for (const p of pills) {
      rrect(ctx, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, p.h / 2);
      ctx.fillStyle = surface2; ctx.globalAlpha = 0.95; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = p.col; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.font = `600 ${10.5 * k}px ${FONT}`; ctx.fillStyle = text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.lab, p.x, p.y + 0.5);
    }

    // ---- buses with their generators, loads, numbers and voltages
    for (const [id, p] of pos) {
      const d = deco.get(id), col = d.col, res = rb.get(id);
      if (d.gen) {
        const { x: gx, y: gy, r: gr } = d.gen, up = gy < p.y;
        ctx.strokeStyle = text2; ctx.lineWidth = 2 * k;
        ctx.beginPath(); ctx.moveTo(gx, p.y + (up ? -bh / 2 : bh / 2)); ctx.lineTo(gx, gy + (up ? gr : -gr)); ctx.stroke();
        const gg = ctx.createLinearGradient(gx - gr, gy - gr, gx + gr, gy + gr);
        gg.addColorStop(0, accent); gg.addColorStop(1, accent2);
        ctx.fillStyle = gg;
        ctx.shadowColor = accent; ctx.shadowBlur = light ? 0 : 10 * k;
        ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8 * k;
        ctx.beginPath(); ctx.moveTo(gx - 6.5 * k, gy); ctx.bezierCurveTo(gx - 3.5 * k, gy - 7 * k, gx - 0.5 * k, gy - 7 * k, gx, gy); ctx.bezierCurveTo(gx + 0.5 * k, gy + 7 * k, gx + 3.5 * k, gy + 7 * k, gx + 6.5 * k, gy); ctx.stroke();
      }
      if (d.slack) {
        const [sx, sy, sw, sh] = d.slack;
        rrect(ctx, sx, sy, sw, sh, sh / 2); ctx.fillStyle = accent; ctx.fill();
        ctx.font = `700 ${8.5 * k}px ${FONT}`; ctx.fillStyle = light ? '#fff' : '#06202a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('SLACK', sx + sw / 2, sy + sh / 2 + 0.5);
      }
      if (d.load) {
        const { x: lx, y0, dir, len } = d.load;
        ctx.strokeStyle = text2; ctx.fillStyle = text2; ctx.lineWidth = 2 * k;
        ctx.beginPath(); ctx.moveTo(lx, y0); ctx.lineTo(lx, y0 + dir * (len - 6 * k)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx - 5 * k, y0 + dir * (len - 7 * k)); ctx.lineTo(lx + 5 * k, y0 + dir * (len - 7 * k)); ctx.lineTo(lx, y0 + dir * len); ctx.closePath(); ctx.fill();
      }
      // the bus bar, glowing in its voltage colour
      ctx.shadowColor = col; ctx.shadowBlur = res && !light ? 12 * k : 0;
      rrect(ctx, p.x - bw / 2, p.y - bh / 2, bw, bh, bh / 2);
      ctx.fillStyle = col; ctx.fill();
      ctx.shadowBlur = 0;
      // number badge
      const { x: bx, y: by, r: br } = d.badge;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = surface2; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.6 * k; ctx.stroke();
      ctx.fillStyle = text; ctx.font = `800 ${String(p.b.id).length > 2 ? 8 * k : 10 * k}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(p.b.id), bx, by + 0.5);
      if (d.name) {
        const [nx, ny, nw, nh] = d.name.box;
        ctx.font = `600 ${10 * k}px ${FONT}`; ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.name.s, nx + nw / 2, ny + nh / 2);
      }
      if (d.volt) {
        const [vx, vy, vw, vh] = d.volt.box;
        rrect(ctx, vx, vy, vw, vh, 6 * k);
        ctx.fillStyle = surface2; ctx.globalAlpha = 0.95; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
        ctx.font = `600 ${10 * k}px ${MONO}`; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.volt.s, vx + vw / 2, vy + vh / 2 + 0.5);
      }
    }
    if (!this.sys.buses.length) { ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.font = `13px ${FONT}`; ctx.fillText('No buses', w / 2, h / 2); }
  }

  /**
   * Textbook one-line diagram: black ink on paper, thin bus bars, lines leaving each bus on a short
   * vertical stub, generators as circles marked G1, G2 …, loads as filled arrowheads, and the
   * results written beside them in small blue type.
   */
  drawClassic(cv, ctx, w, h, pos, k) {
    const r = this.res, opts = this.opts, v = this.view;
    const paper = '#fcfcfa', ink = '#16181d', sub = '#5f6672', blue = '#1d4ed8';
    const SERIF = '"Times New Roman", Times, "Liberation Serif", "Noto Serif", Georgia, serif';
    const SANS = 'Inter, Roboto, sans-serif';
    const rb = new Map(r ? r.buses.map((b) => [String(b.id), b]) : []);
    const vcol = (val) => (val < opts.vMin - 1e-9 ? '#dc2626' : val > opts.vMax + 1e-9 ? '#c2410c' : blue);
    const t = performance.now() / 1000;
    ctx.fillStyle = paper; ctx.fillRect(0, 0, w, h);

    // ---- ports: what leaves each bus upwards (lines to buses above, the generator) and downwards
    const S = 22 * k; // stub length
    const port = new Map([...pos.keys()].map((id) => [id, { top: [], bot: [] }]));
    const lines = [];
    this.sys.branches.forEach((l, i) => {
      const pa = pos.get(String(l.from)), pb = pos.get(String(l.to));
      if (!pa || !pb) return;
      const dy = pb.y - pa.y, dist = Math.hypot(pb.x - pa.x, dy) || 1;
      const level = Math.abs(dy) < Math.max(14 * k, 0.12 * dist); // side by side: both stubs hang down
      const ea = { key: pb.x, side: level || dy > 0 ? 'bot' : 'top' }, eb = { key: pa.x, side: level || dy < 0 ? 'bot' : 'top' };
      port.get(String(l.from))[ea.side].push(ea);
      port.get(String(l.to))[eb.side].push(eb);
      lines.push({ l, i, pa, pb, ea, eb });
    });
    let gN = 0;
    const genNo = new Map();
    for (const [id, p] of pos) {
      const b = p.b;
      if (b.type !== 'pq' || +b.Pg > 0) { genNo.set(id, ++gN); port.get(id).top.push({ gen: true, key: p.x - 0.01 }); }
      if (+b.Pd > 0 || +b.Qd > 0) port.get(id).bot.push({ load: true, key: p.x + 0.01 });
    }
    // bar length from the busiest side; ports spread evenly, ordered by where they lead
    for (const [id, p] of pos) {
      const pt = port.get(id), n = Math.max(pt.top.length, pt.bot.length, 1);
      p.L = Math.max(66 * k, (n + 1) * 23 * k);
      p.half = p.L / 2;
      for (const side of ['top', 'bot']) {
        const list = pt[side].sort((a, b) => a.key - b.key);
        list.forEach((e, j) => { e.x = p.x - p.L / 2 + (p.L * (j + 1)) / (list.length + 1); });
      }
    }
    const segs = [];
    for (const ln of lines) {
      const { pa, pb, ea, eb } = ln;
      ln.a0 = { x: ea.x, y: pa.y }; ln.a1 = { x: ea.x, y: pa.y + (ea.side === 'bot' ? S : -S) };
      ln.b0 = { x: eb.x, y: pb.y }; ln.b1 = { x: eb.x, y: pb.y + (eb.side === 'bot' ? S : -S) };
      segs.push([ln.a0.x, ln.a0.y, ln.a1.x, ln.a1.y], [ln.b0.x, ln.b0.y, ln.b1.x, ln.b1.y], [ln.a1.x, ln.a1.y, ln.b1.x, ln.b1.y]);
    }

    // ---- free-space bookkeeping for the labels
    const taken = [];
    for (const p of pos.values()) taken.push([p.x - p.L / 2, p.y - 3 * k, p.L, 6 * k]);
    const gR = 15 * k, gStem = 24 * k, aStem = 16 * k, aHead = 18 * k;
    for (const [id, p] of pos) {
      for (const e of port.get(id).top) if (e.gen) { taken.push([e.x - gR, p.y - gStem - 2 * gR, 2 * gR, gStem + 2 * gR]); e.cy = p.y - gStem - gR; }
      for (const e of port.get(id).bot) if (e.load) taken.push([e.x - 8 * k, p.y, 16 * k, aStem + aHead]);
    }
    const zb = this.root.querySelector('.lf-zoom'), cb = cv.getBoundingClientRect();
    if (zb && zb.offsetParent) { const z = zb.getBoundingClientRect(); taken.push([z.left - cb.left - 4, z.top - cb.top - 4, z.width + 8, z.height + 8]); }
    const hitsBox = (x, y, wd, ht) => taken.some(([a, b, c, d]) => x < a + c - 0.5 && x + wd > a + 0.5 && y < b + d - 0.5 && y + ht > b + 0.5);
    const hitsLine = (x, y, wd, ht, m) => segs.some(([ax, ay, bx, by]) => segRect(ax, ay, bx, by, x - m, y - m, x + wd + m, y + ht + m));
    const onCanvas = (x, y, wd, ht) => x >= 2 && y >= 2 && x + wd <= w - 2 && y + ht <= h - 2;
    const free = (x, y, wd, ht) => onCanvas(x, y, wd, ht) && !hitsBox(x, y, wd, ht) && !hitsLine(x, y, wd, ht, 3 * k);
    const crossings = (x, y, wd, ht) => segs.reduce((n, [ax, ay, bx, by]) => n + (segRect(ax, ay, bx, by, x, y, x + wd, y + ht) ? 1 : 0), 0);
    /** The first clear spot; failing that, the on-screen spot that crosses the fewest lines. */
    const place = (cands) => {
      let c = cands.find((x) => free(...x));
      if (!c) {
        let best = Infinity;
        for (const x of cands) if (onCanvas(...x) && !hitsBox(...x)) { const n = crossings(...x); if (n < best) { best = n; c = x; } }
      }
      if (c) taken.push(c);
      return c;
    };

    // bus name with its voltage underneath, beside an end of the bar like a textbook
    const busLab = new Map();
    for (const [id, p] of pos) {
      const b = p.b, res = rb.get(id);
      const own = b.name && !/^(bus\s*\d+|slack|swing)$/i.test(String(b.name).trim());
      const name = own ? `Bus ${b.id} · ${b.name}` : `Bus ${b.id}`;
      ctx.font = `${15 * k}px ${SERIF}`;
      let tw = ctx.measureText(name).width;
      const vs = res ? `${res.V.toFixed(3)}∠${res.ang.toFixed(2)}°` : '';
      ctx.font = `600 ${10.5 * k}px ${SANS}`;
      if (vs) tw = Math.max(tw, ctx.measureText(vs).width);
      const th = (vs ? 31 : 17) * k, g = 8 * k, L = p.L;
      const box = place([
        [p.x - L / 2 - g - tw, p.y - th - 2 * k, tw, th], [p.x + L / 2 + g, p.y - th - 2 * k, tw, th],
        [p.x - L / 2 - g - tw, p.y - th / 2, tw, th], [p.x + L / 2 + g, p.y - th / 2, tw, th],
        [p.x - L / 2 - g - tw, p.y + 3 * k, tw, th], [p.x + L / 2 + g, p.y + 3 * k, tw, th],
        [p.x + L / 2 - tw, p.y + S + 4 * k, tw, th], [p.x - L / 2, p.y + S + 4 * k, tw, th],
        [p.x - L / 2, p.y - S - th - 4 * k, tw, th], [p.x + L / 2 - tw, p.y - S - th - 4 * k, tw, th],
      ]);
      if (box) busLab.set(id, { box, name, vs, col: res ? vcol(res.V) : sub, right: box[0] < p.x });
    }
    // load captions beside the arrowheads
    const loadLab = [];
    for (const [id, p] of pos) for (const e of port.get(id).bot) {
      if (!e.load) continue;
      const b = p.b, top = p.y + aStem + aHead * 0.35;
      const s1 = `Load ${b.id}`, s2 = `${(+b.Pd).toFixed(1)} ${+b.Qd < 0 ? '−' : '+'} j${Math.abs(+b.Qd).toFixed(1)}`;
      ctx.font = `${14 * k}px ${SERIF}`; let tw = ctx.measureText(s1).width;
      ctx.font = `${10 * k}px ${SANS}`; tw = Math.max(tw, ctx.measureText(s2).width);
      const th = 28 * k;
      const box = place([[e.x + 10 * k, top, tw, th], [e.x - 10 * k - tw, top, tw, th], [e.x - tw / 2, p.y + aStem + aHead + 3 * k, tw, th]]);
      if (box) loadLab.push({ box, s1, s2, right: box[0] < e.x });
    }

    // ---- lines
    let pmax = 1e-9;
    if (r) for (const l of r.branches) if (l.on) pmax = Math.max(pmax, Math.abs(l.Pf));
    let nLine = 0, nXf = 0;
    const lineLabs = [];
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    for (const ln of lines) {
      const { l, i } = ln, res = r?.branches[i], live = !!(res && res.on);
      const xf = (+l.tap && +l.tap !== 1) || +l.shift || l.kind === 'xf';
      ln.label = xf ? `T${++nXf}` : `Line ${++nLine}`;
      let col = ink;
      if (l.on === false) col = '#9aa1ad';
      else if (live && res.rate) col = res.loading > 100 ? '#dc2626' : res.loading >= 70 ? '#ea580c' : ink;
      ctx.strokeStyle = col; ctx.lineWidth = 1.7 * k;
      ctx.setLineDash(l.on === false ? [6 * k, 5 * k] : []);
      ctx.beginPath(); ctx.moveTo(ln.a0.x, ln.a0.y); ctx.lineTo(ln.a1.x, ln.a1.y); ctx.lineTo(ln.b1.x, ln.b1.y); ctx.lineTo(ln.b0.x, ln.b0.y); ctx.stroke();
      ctx.setLineDash([]);
      ln.col = col; ln.live = live; ln.res = res; ln.xf = xf;
      const a = ln.a1, b = ln.b1, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      if (xf) { // transformer: two interlinked circles on the line
        const ux = dx / len, uy = dy / len, mx = a.x + dx / 2, my = a.y + dy / 2, rr = 7.5 * k;
        ctx.lineWidth = 1.6 * k;
        for (const s of [-0.62, 0.62]) { ctx.beginPath(); ctx.arc(mx + ux * rr * s, my + uy * rr * s, rr, 0, Math.PI * 2); ctx.fillStyle = paper; ctx.fill(); ctx.stroke(); }
        taken.push([mx - 2 * rr, my - 2 * rr, 4 * rr, 4 * rr]);
      }
      // moving dots: direction and size of the real power
      if (live && Math.abs(res.Pf) >= 0.05 && len > 40) {
        const fwd = res.Pf >= 0, fx = fwd ? a.x : b.x, fy = fwd ? a.y : b.y, sx = fwd ? dx : -dx, sy = fwd ? dy : -dy;
        const gap = 24 * k, off = (t * (16 + 60 * Math.min(1, Math.abs(res.Pf) / pmax)) * k) % gap;
        ctx.fillStyle = blue; ctx.globalAlpha = 0.55;
        for (let d = off + 10 * k; d < len - 10 * k; d += gap) { ctx.beginPath(); ctx.arc(fx + (sx * d) / len, fy + (sy * d) / len, 1.7 * k, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
    // line names (and the flow) beside the middle of each line, sliding along it to a free spot
    for (const ln of lines) {
      const { res, live } = ln, a = ln.a1, b = ln.b1, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      let s2 = '';
      if (live && this.flowLabel !== 'none') {
        const fwd = res.Pf >= 0, P = fwd ? res.Pf : res.Pt, Q = fwd ? res.Qf : res.Qt;
        s2 = this.flowLabel === 'load' ? (res.rate ? `${res.loading.toFixed(0)} %` : `${res.S.toFixed(1)} MVA`)
          : this.flowLabel === 'PQ' && r.method !== 'dc' ? `${Math.abs(P).toFixed(1)} MW ${Q * (fwd ? 1 : -1) >= 0 ? '+' : '−'} j${Math.abs(Q).toFixed(1)}` : `${Math.abs(P).toFixed(1)} MW`;
      }
      ctx.font = `${14.5 * k}px ${SERIF}`; let tw = ctx.measureText(ln.label).width;
      ctx.font = `600 ${10 * k}px ${SANS}`; if (s2) tw = Math.max(tw, ctx.measureText(s2).width);
      const th = (s2 ? 29 : 16) * k;
      const nx = -uy, ny = ux, off = Math.abs(nx) * (tw / 2) + Math.abs(ny) * (th / 2) + 6 * k;
      let box = null, tt = 0.5;
      for (const c of ln.xf ? [0.28, 0.72, 0.2, 0.8] : [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78]) {
        for (const sd of [-1, 1]) {
          const cx = a.x + dx * c + nx * off * sd, cy = a.y + dy * c + ny * off * sd, cand = [cx - tw / 2, cy - th / 2, tw, th];
          if (free(...cand)) { box = cand; tt = c; break; }
        }
        if (box) break;
      }
      if (box) taken.push(box);
      // direction arrowhead on the line
      if (live && Math.abs(res.Pf) >= 0.05 && len > 30) {
        const fwd = res.Pf >= 0, mx = a.x + dx * tt, my = a.y + dy * tt, sx = fwd ? ux : -ux, sy = fwd ? uy : -uy, ah = 7 * k;
        ctx.fillStyle = ln.col;
        ctx.beginPath(); ctx.moveTo(mx + sx * ah, my + sy * ah); ctx.lineTo(mx - sx * ah * 0.6 - sy * ah * 0.6, my - sy * ah * 0.6 + sx * ah * 0.6); ctx.lineTo(mx - sx * ah * 0.6 + sy * ah * 0.6, my - sy * ah * 0.6 - sx * ah * 0.6); ctx.closePath(); ctx.fill();
      }
      if (box) lineLabs.push({ box, s1: ln.label, s2, col: ln.col === ink ? blue : ln.col });
    }

    // ---- buses, generators and loads
    for (const [id, p] of pos) {
      const res = rb.get(id), bad = res && (res.V < opts.vMin - 1e-9 || res.V > opts.vMax + 1e-9);
      ctx.strokeStyle = bad ? vcol(res.V) : ink; ctx.lineWidth = 3.4 * k; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(p.x - p.L / 2, p.y); ctx.lineTo(p.x + p.L / 2, p.y); ctx.stroke();
      ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1.7 * k;
      for (const e of port.get(id).top) {
        if (!e.gen) continue;
        ctx.beginPath(); ctx.moveTo(e.x, p.y); ctx.lineTo(e.x, e.cy + gR); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(e.x, e.cy, gR * 1.15, gR, 0, 0, Math.PI * 2); ctx.fillStyle = paper; ctx.fill(); ctx.stroke();
        ctx.fillStyle = ink; ctx.font = `${13 * k}px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`G${genNo.get(id)}`, e.x, e.cy + 0.5);
        if (!res && p.b.type === 'slack') { ctx.font = `italic ${11 * k}px ${SERIF}`; ctx.fillStyle = sub; ctx.textAlign = 'left'; ctx.fillText('slack', e.x + gR * 1.15 + 5 * k, e.cy); }
        if (res && this.flowLabel !== 'none') { // generator output beside the circle
          const s = (r.method === 'dc' ? `${res.Pg.toFixed(1)} MW` : `${res.Pg.toFixed(1)} ${res.Qg < 0 ? '−' : '+'} j${Math.abs(res.Qg).toFixed(1)}`) + (p.b.type === 'slack' ? ' · slack' : '');
          ctx.font = `600 ${10 * k}px ${SANS}`;
          const tw = ctx.measureText(s).width, th = 13 * k;
          const box = place([[e.x + gR * 1.15 + 6 * k, e.cy - th / 2, tw, th], [e.x - gR * 1.15 - 6 * k - tw, e.cy - th / 2, tw, th], [e.x - tw / 2, e.cy - gR - 4 * k - th, tw, th]]);
          if (box) { ctx.fillStyle = blue; ctx.textAlign = 'left'; ctx.strokeStyle = paper; ctx.lineWidth = 4 * k; ctx.lineJoin = 'round'; ctx.strokeText(s, box[0], box[1] + th / 2); ctx.fillText(s, box[0], box[1] + th / 2); }
        }
      }
      for (const e of port.get(id).bot) {
        if (!e.load) continue;
        ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1.7 * k;
        ctx.beginPath(); ctx.moveTo(e.x, p.y); ctx.lineTo(e.x, p.y + aStem); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(e.x - 7.5 * k, p.y + aStem); ctx.lineTo(e.x + 7.5 * k, p.y + aStem); ctx.lineTo(e.x, p.y + aStem + aHead); ctx.closePath(); ctx.fill();
      }
    }
    // ---- text last, on top of everything, each with a paper-coloured outline so a line behind never blurs it
    const ink2 = (s, x, y) => { ctx.strokeStyle = paper; ctx.lineWidth = 4 * k; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); ctx.fillText(s, x, y); };
    const label = (box, s1, f1, c1, s2, f2, c2, alignRight) => {
      const [x, y, wd] = box, ax = alignRight ? x + wd : x;
      ctx.textAlign = alignRight ? 'right' : 'left'; ctx.textBaseline = 'top';
      ctx.font = f1; ctx.fillStyle = c1; ink2(s1, ax, y);
      if (s2) { ctx.font = f2; ctx.fillStyle = c2; ink2(s2, ax, y + 16.5 * k); }
    };
    for (const [, L] of busLab) label(L.box, L.name, `${15 * k}px ${SERIF}`, ink, L.vs, `600 ${10.5 * k}px ${SANS}`, L.col, L.right);
    for (const L of loadLab) label(L.box, L.s1, `${14 * k}px ${SERIF}`, ink, L.s2, `${10 * k}px ${SANS}`, sub, L.right);
    for (const L of lineLabs) {
      const [x, y, wd] = L.box;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = `${14.5 * k}px ${SERIF}`; ctx.fillStyle = ink; ink2(L.s1, x + wd / 2, y);
      if (L.s2) { ctx.font = `600 ${10 * k}px ${SANS}`; ctx.fillStyle = L.col; ink2(L.s2, x + wd / 2, y + 16 * k); }
    }
    if (!this.sys.buses.length) { ctx.fillStyle = sub; ctx.textAlign = 'center'; ctx.font = `14px ${SERIF}`; ctx.fillText('No buses', w / 2, h / 2); }
  }

  bindDiagram(cv) {
    const ptrs = new Map();
    let mode = null, drag = null, pinch = null, lastTap = 0, lastTapAt = null;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const hit = (p) => {
      let best = null, bd = 28;
      for (const [id, q] of this.diagPos || []) {
        const d = Math.hypot(Math.max(0, Math.abs(q.x - p.x) - (q.half || 27) + 4), q.y - p.y);
        if (d < bd) { bd = d; best = id; }
      }
      return best;
    };
    const startPinch = () => {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v: { ...this.view } };
      mode = 'pinch'; drag = null;
    };
    cv.addEventListener('pointerdown', (e) => {
      cancelAnimationFrame(this.viewRaf);
      const p = pt(e);
      ptrs.set(e.pointerId, p);
      cv.setPointerCapture(e.pointerId);
      if (ptrs.size === 2) { startPinch(); return; }
      if (ptrs.size > 2) return;
      const id = hit(p);
      drag = { id, x0: p.x, y0: p.y, moved: false, v: { ...this.view } };
      mode = id ? 'bus' : 'pan';
    });
    cv.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const p = pt(e);
      ptrs.set(e.pointerId, p);
      if (mode === 'pinch' && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const s = Math.max(0.5, Math.min(8, pinch.v.s * (d / pinch.d))), f = s / pinch.v.s;
        Object.assign(this.view, this.clampView({ s, tx: mx - (pinch.mx - pinch.v.tx) * f, ty: my - (pinch.my - pinch.v.ty) * f }));
        this.drawDiagram();
        return;
      }
      if (!drag) return;
      if (!drag.moved && Math.hypot(p.x - drag.x0, p.y - drag.y0) < 6) return;
      drag.moved = true;
      if (mode === 'pan') {
        Object.assign(this.view, this.clampView({ s: drag.v.s, tx: drag.v.tx + p.x - drag.x0, ty: drag.v.ty + p.y - drag.y0 }));
        this.drawDiagram();
        return;
      }
      const pad = this.diagPad, w = cv.clientWidth, h = cv.clientHeight, v = this.view;
      const b = this.sys.buses.find((x) => String(x.id) === drag.id);
      if (!b) return;
      const wx = (p.x - v.tx) / v.s, wy = (p.y - v.ty) / v.s;
      b.x = Math.max(-5, Math.min(105, ((wx - pad.l) / (w - pad.l - pad.r)) * 100));
      b.y = Math.max(-5, Math.min(105, ((wy - pad.t) / (h - pad.t - pad.b)) * 100));
      this.drawDiagram();
    });
    const end = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (mode === 'pinch') { if (ptrs.size < 2) { mode = null; drag = null; } return; }
      if (!drag) return;
      const d = drag;
      drag = null; mode = null;
      if (d.moved) { if (d.id) this.persist(); return; }
      const now = performance.now();
      if (d.id) {
        if (this.res) this.busDetail(d.id);
        else { const i = this.sys.buses.findIndex((x) => String(x.id) === d.id); if (i >= 0) this.editBus(i); }
      } else if (now - lastTap < 320 && lastTapAt && Math.hypot(lastTapAt.x - d.x0, lastTapAt.y - d.y0) < 30) {
        // double-tap on the background: zoom in there, or back out when already well zoomed
        if (this.view.s >= 3.9) this.animateView({ s: 1, tx: 0, ty: 0 });
        else this.zoomAt(d.x0, d.y0, 2, true);
        lastTap = 0;
        return;
      }
      lastTap = now; lastTapAt = { x: d.x0, y: d.y0 };
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); drag = null; mode = null; });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pt(e), dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      this.zoomAt(p.x, p.y, Math.exp(-dy * 0.0015), false);
    }, { passive: false });
    if (this.diagRO) this.diagRO.disconnect();
    if (typeof ResizeObserver === 'function') { this.diagRO = new ResizeObserver(() => this.drawDiagram()); this.diagRO.observe(cv); }
  }

  // ---------------------------------------------------------------- Charts tab
  renderCharts(body) {
    const r = this.res;
    if (!r) { this.needRun(body, 'charts'); return; }
    const rated = r.branches.some((l) => l.rate > 0);
    body.innerHTML = `
      <h4>Voltage profile</h4><div class="lf-chart"><canvas data-ch="v"></canvas></div>
      <h4>Voltage angle</h4><div class="lf-chart"><canvas data-ch="a"></canvas></div>
      ${r.method === 'dc' ? '' : '<h4>Convergence (largest mismatch, log scale)</h4><div class="lf-chart"><canvas data-ch="c"></canvas></div>'}
      <h4>${rated ? 'Branch loading (% of rating)' : 'Branch flow |S| (MVA)'}</h4><div class="lf-chart tall"><canvas data-ch="l"></canvas></div>
      <h4>Branch losses (MW)</h4><div class="lf-chart"><canvas data-ch="p"></canvas></div>`;
    requestAnimationFrame(() => this.drawCharts());
    if (this.chartRO) this.chartRO.disconnect();
    if (typeof ResizeObserver === 'function') { this.chartRO = new ResizeObserver(() => this.drawCharts()); this.chartRO.observe(body.querySelector('canvas')); }
  }

  drawCharts() {
    const r = this.res, body = this.root.querySelector('.lf-body');
    if (!r || this.tab !== 'charts') return;
    const o = r.options, on = r.branches.filter((l) => l.on);
    const vcol = (v) => (v < o.vMin - 1e-9 ? '#f87171' : v > o.vMax + 1e-9 ? '#fbbf24' : '#4ade80');
    const vs = r.buses.map((b) => b.V);
    const lo = Math.min(o.vMin - 0.02, ...vs.map((v) => v - 0.01)), hi = Math.max(o.vMax + 0.02, ...vs.map((v) => v + 0.01));
    const q = (k) => body.querySelector(`[data-ch=${k}]`);
    barChart(q('v'), r.buses.map((b) => ({ label: String(b.id), v: b.V, color: vcol(b.V) })), { min: lo, max: hi, base: lo, fmt: (v) => v.toFixed(3), refs: [{ v: o.vMin, label: `${o.vMin}` }, { v: o.vMax, label: `${o.vMax}` }, { v: 1, label: '1.0', solid: true }] });
    const angs = r.buses.map((b) => b.ang);
    barChart(q('a'), r.buses.map((b) => ({ label: String(b.id), v: b.ang, color: css('--accent', '#22d3ee') })), { min: Math.min(0, ...angs) * 1.1 - 0.5, max: Math.max(0, ...angs) * 1.1 + 0.5, base: 0, fmt: (v) => v.toFixed(1) + '°' });
    if (q('c')) lineLog(q('c'), r.history.map((h) => [h.it, h.mis]), o.tol);
    const rated = r.branches.some((l) => l.rate > 0);
    const lv = on.map((l) => (rated ? (l.rate ? l.loading : 0) : l.S));
    barChart(q('l'), on.map((l, i) => ({ label: `${l.from}-${l.to}`, v: lv[i], color: rated ? (l.loading > 100 ? '#ef4444' : l.loading >= 70 ? '#f97316' : '#4ade80') : css('--accent2', '#8b5cf6') })), { min: 0, max: Math.max(rated ? 110 : 1, ...lv) * 1.08, base: 0, fmt: (v) => v.toFixed(rated ? 0 : 1), refs: rated ? [{ v: 100, label: '100 %' }] : [], rotate: on.length > 8 });
    const lp = on.map((l) => l.lossP);
    barChart(q('p'), on.map((l) => ({ label: `${l.from}-${l.to}`, v: l.lossP, color: '#f472b6' })), { min: Math.min(0, ...lp), max: Math.max(0.001, ...lp) * 1.1, base: 0, fmt: (v) => v.toFixed(2), rotate: on.length > 8 });
  }

  // ---------------------------------------------------------------- Iterations tab
  renderIter(body) {
    const r = this.res;
    if (!r) { this.needRun(body, 'iterations'); return; }
    const sel = this.iterBus;
    const buses = r.buses.map((b, i) => ({ b, i })).filter(({ b }) => sel === 'all' ? r.buses.length <= 6 || b.type !== 'slack' : String(b.id) === sel).slice(0, sel === 'all' ? 8 : 1);
    const H = r.history, gs = r.method === 'gs';
    const rows = H.length > 60 ? [...H.slice(0, 40), null, ...H.slice(-15)] : H;
    const J = r.jacobian;
    body.innerHTML = `
      <p class="an-help">Every iteration of the solution: the largest power mismatch ${gs ? 'and voltage change ' : ''}and the bus voltages |V|∠δ as they move towards the answer${r.method === 'nr' ? ' — note how the mismatch falls quadratically' : ''}.</p>
      <label class="lf-lab inline">Show buses <select data-k="ib"><option value="all" ${sel === 'all' ? 'selected' : ''}>First 8${r.buses.length > 6 ? ' (non-slack)' : ''}</option>${r.buses.map((b) => `<option value="${esc(b.id)}" ${String(b.id) === sel ? 'selected' : ''}>Bus ${esc(b.id)}</option>`).join('')}</select></label>
      <div class="lf-tw"><table class="tbl lf-tbl">
        <thead><tr><th>It.</th><th>Max |ΔP|,|ΔQ| pu</th>${gs ? '<th>Max |ΔV|</th>' : ''}${buses.map(({ b }) => `<th>V${esc(b.id)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((h) => (h ? `<tr><td>${h.it}${h.pass ? `<small> Q${h.pass}</small>` : ''}</td><td>${h.mis.toExponential(3)}</td>${gs ? `<td>${Number.isFinite(h.dV) ? h.dV.toExponential(2) : '—'}</td>` : ''}${buses.map(({ i }) => `<td>${h.Vm[i].toFixed(5)}∠${h.Va[i].toFixed(3)}°</td>`).join('')}</tr>` : `<tr><td colspan="${3 + buses.length}" class="lf-gap">… ${H.length - 55} iterations not shown …</td></tr>`)).join('')}</tbody>
      </table></div>
      ${r.history.some((h) => h.pass) ? '<p class="lf-note">Q1, Q2 …: passes after generator Q limits switched a PV bus to PQ.</p>' : ''}
      ${J ? this.jacobianHtml(J, r) : r.method === 'nr' ? '' : `<p class="lf-note">${r.method === 'gs' ? 'Gauss–Seidel needs no Jacobian: each bus voltage is updated in turn from its neighbours.' : r.method === 'fd' ? 'Fast Decoupled uses the constant matrices B′ (from 1/X) and B″ (from −Im Y-bus) instead of a Jacobian; switch to Newton–Raphson to see the Jacobian.' : 'DC load flow solves P = B′·δ once; no iteration.'}</p>`}`;
    body.querySelector('[data-k=ib]').addEventListener('change', (e) => { this.iterBus = e.target.value; this.renderIter(body); });
  }

  jacobianHtml(jac, r) {
    const { J, ang, mag } = jac, n = J.length;
    const id = (i) => r.buses[i].id;
    const heads = [...ang.map((i) => `δ${id(i)}`), ...mag.map((i) => `|V${id(i)}|`)];
    const rowsH = [...ang.map((i) => `P${id(i)}`), ...mag.map((i) => `Q${id(i)}`)];
    if (n > 30) return `<h4>Jacobian</h4><p class="lf-note">The final Jacobian is ${n} × ${n} (${ang.length} angle and ${mag.length} voltage unknowns) — too large to show here.</p>`;
    return `<h4>Jacobian at the last iteration (${n} × ${n})</h4>
      <p class="lf-note">Rows: mismatch equations; columns: unknowns. Top-left H = ∂P/∂δ, top-right N = ∂P/∂|V|, bottom-left M = ∂Q/∂δ, bottom-right L = ∂Q/∂|V|.</p>
      <div class="lf-tw"><table class="tbl lf-mat">
        <thead><tr><th></th>${heads.map((h, c) => `<th class="${c === ang.length ? 'sep' : ''}">${h}</th>`).join('')}</tr></thead>
        <tbody>${J.map((row, i) => `<tr class="${i === ang.length ? 'sep' : ''}"><th>${rowsH[i]}</th>${Array.from(row).map((v, c) => `<td class="${c === ang.length ? 'sep' : ''} ${Math.abs(v) < 1e-9 ? 'z' : ''}">${Math.abs(v) < 1e-9 ? '0' : v.toFixed(3)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
  }

  // ---------------------------------------------------------------- Y-bus tab
  renderYbus(body) {
    const errs = validate(this.sys).filter((e) => !/separate parts|slack/.test(e));
    if (errs.length) { body.innerHTML = `<ul class="lf-errs">${errs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`; return; }
    const Y = buildYbus(this.sys), n = Y.n, ids = this.sys.buses.map((b) => b.id);
    let nz = 0;
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) if (Y.G[i][k] || Y.B[i][k]) nz++;
    const cell = (g, b) => {
      if (!g && !b) return '<td class="z">0</td>';
      if (this.ybusPolar) { const m = Math.hypot(g, b), a = (Math.atan2(b, g) * 180) / Math.PI; return `<td>${m.toFixed(3)}∠${a.toFixed(1)}°</td>`; }
      return `<td>${g.toFixed(3)}${b < 0 ? '−' : '+'}j${Math.abs(b).toFixed(3)}</td>`;
    };
    body.innerHTML = `
      <p class="an-help">The bus admittance matrix Y = G + jB in per unit (${n} × ${n}, ${nz} non-zero entries, ${((1 - nz / (n * n)) * 100).toFixed(0)} % zeros). Diagonal Y<sub>ii</sub> = sum of everything connected to bus i; off-diagonal Y<sub>ik</sub> = −(series admittance between i and k).</p>
      <div class="lf-seg sm lf-w">${[[false, 'Rectangular G + jB'], [true, 'Polar |Y|∠θ']].map(([p, t]) => `<button data-p="${p}" class="${this.ybusPolar === p ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="lf-tw"><table class="tbl lf-mat">
        <thead><tr><th></th>${ids.map((id) => `<th>${esc(id)}</th>`).join('')}</tr></thead>
        <tbody>${ids.map((id, i) => `<tr><th>${esc(id)}</th>${ids.map((_, k) => cell(Y.G[i][k], Y.B[i][k]).replace('<td', i === k ? '<td class="dg"' : '<td')).join('')}</tr>`).join('')}</tbody>
      </table></div>
      <h4>Branch admittances</h4>
      <div class="lf-tw"><table class="tbl lf-tbl">
        <thead><tr><th>Branch</th><th>y = 1/(R+jX)</th><th>jB/2 each end</th><th>Tap</th></tr></thead>
        <tbody>${this.sys.branches.map((l) => { const d = l.R * l.R + l.X * l.X || 1; return `<tr class="${l.on === false ? 'off' : ''}"><td>${esc(l.from)} → ${esc(l.to)}</td><td>${(l.R / d).toFixed(3)} − j${(l.X / d).toFixed(3)}</td><td>j${((+l.B || 0) / 2).toFixed(4)}</td><td>${+l.tap && +l.tap !== 1 ? l.tap : '—'}${+l.shift ? ` ∠${l.shift}°` : ''}</td></tr>`; }).join('')}</tbody>
      </table></div>`;
    body.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { this.ybusPolar = b.dataset.p === 'true'; this.renderYbus(body); }));
  }

  // ---------------------------------------------------------------- N-1 tab
  renderN1(body) {
    const c = this.n1;
    body.innerHTML = `
      <p class="an-help"><b>N-1 contingency analysis:</b> every in-service line and transformer is taken out in turn and the load flow is solved again (Newton–Raphson${this.opts.method === 'fd' ? ' / Fast Decoupled' : ''}, same options). A secure system keeps every voltage within ${this.opts.vMin}–${this.opts.vMax} pu and every branch within its rating after any single outage. Worst cases are listed first.</p>
      <button class="btn primary" data-x="n1">${icon('shield', 16)} Run N-1 analysis (${this.sys.branches.filter((l) => l.on !== false).length} outages)</button>
      <div class="lf-n1"></div>`;
    body.querySelector('[data-x=n1]').addEventListener('click', () => {
      const errs = validate(this.sys);
      if (errs.length) { alert(errs.join('\n')); return; }
      const t0 = performance.now();
      this.n1 = contingencies(this.sys, this.opts);
      this.n1ms = performance.now() - t0;
      this.renderN1(body);
    });
    if (!c) return;
    const bad = c.filter((x) => x.status !== 'ok').length;
    const st = { ok: 'Secure', violation: 'Violation', islanded: 'Islanding', diverged: 'Diverged' };
    body.querySelector('.lf-n1').innerHTML = `
      <div class="lf-status ${bad ? 'bad' : 'ok'}">${icon(bad ? 'info' : 'check', 22)}<div><b>${bad ? `${bad} of ${c.length} outages cause problems` : 'N-1 secure'}</b><span>${c.length} cases solved in ${this.n1ms.toFixed(0)} ms</span></div></div>
      <div class="lf-tw"><table class="tbl lf-tbl">
        <thead><tr><th>Outage</th><th>Result</th><th>Min V pu (bus)</th><th>Max loading</th><th>Losses MW</th></tr></thead>
        <tbody>${c.map((x) => `<tr class="n1-${x.status}"><td><b>${esc(x.from)} → ${esc(x.to)}</b></td><td>${st[x.status]}${x.violations ? ` (${x.violations})` : ''}</td>${x.status === 'islanded' || x.status === 'diverged' ? `<td colspan="3">${esc(x.text)}</td>` : `<td>${x.vmin.toFixed(4)} (${esc(x.vminBus)})</td><td>${x.lmaxBranch ? `${x.lmax.toFixed(0)} % (${esc(x.lmaxBranch)})` : '—'}</td><td>${x.lossP.toFixed(2)}</td>`}</tr>`).join('')}</tbody>
      </table></div>
      <p class="lf-note">Islanding: the outage separates part of the network from the slack bus (radial branch). Loading needs branch ratings (MVA).</p>`;
  }

  // ---------------------------------------------------------------- Per-unit tools tab
  renderTools(body) {
    const opts = this.sys.buses.map((b) => `<option value="${b.id}">${esc(b.id)} · ${esc(b.name)}</option>`).join('');
    const base = this.sys.baseMVA;
    body.innerHTML = `
      <p class="an-help">Convert real equipment data to per unit on the system base (${base} MVA). Results update as you type; the line and transformer tools can add the result to your system.</p>
      <div class="lf-card" data-tool="base"><h3>${icon('gauge', 18)} Base values</h3>
        <div class="form-grid lf-grid2"><label>Base kV (line-line)<input data-i="kv" type="number" inputmode="decimal" value="132"></label><label>Base MVA<input data-i="mva" type="number" inputmode="decimal" value="${base}"></label></div>
        <div class="lf-out"></div></div>

      <div class="lf-card" data-tool="ohm"><h3>${icon('sigma', 18)} Ohms ↔ per unit</h3>
        <div class="form-grid lf-grid3"><label>Impedance (Ω)<input data-i="z" type="number" inputmode="decimal" value="10"></label><label>Base kV<input data-i="kv" type="number" inputmode="decimal" value="132"></label><label>Base MVA<input data-i="mva" type="number" inputmode="decimal" value="${base}"></label></div>
        <div class="lf-out"></div></div>

      <div class="lf-card" data-tool="line"><h3>${icon('tower', 18)} Overhead line / cable → per unit</h3>
        <div class="form-grid lf-grid3">
          <label>Voltage kV<input data-i="kv" type="number" inputmode="decimal" value="132"></label>
          <label>Length km<input data-i="len" type="number" inputmode="decimal" value="50"></label>
          <label>Frequency Hz<input data-i="f" type="number" inputmode="decimal" value="50"></label>
          <label>R Ω/km<input data-i="r" type="number" inputmode="decimal" step="any" value="0.12"></label>
          <label>X Ω/km<input data-i="x" type="number" inputmode="decimal" step="any" value="0.40"></label>
          <label>C nF/km<input data-i="c" type="number" inputmode="decimal" step="any" value="9"></label>
          <label>Thermal limit A<input data-i="amp" type="number" inputmode="decimal" step="any" value="600"></label>
        </div>
        <div class="lf-out"></div>
        <div class="form-grid lf-grid2"><label>From bus<select data-i="from">${opts}</select></label><label>To bus<select data-i="to">${opts}</select></label></div>
        <button class="btn sm" data-add="line">${icon('plus', 15)} Add as a line</button></div>

      <div class="lf-card" data-tool="xf"><h3>${icon('coil', 18)} Transformer → per unit</h3>
        <div class="form-grid lf-grid3">
          <label>Rating MVA<input data-i="s" type="number" inputmode="decimal" value="50"></label>
          <label>Impedance uk %<input data-i="uk" type="number" inputmode="decimal" step="any" value="10"></label>
          <label>X / R ratio<input data-i="xr" type="number" inputmode="decimal" step="any" value="20"></label>
          <label>Tap ratio<input data-i="tap" type="number" inputmode="decimal" step="any" value="1"></label>
        </div>
        <div class="lf-out"></div>
        <div class="form-grid lf-grid2"><label>From (tap side)<select data-i="from">${opts}</select></label><label>To bus<select data-i="to">${opts}</select></label></div>
        <button class="btn sm" data-add="xf">${icon('plus', 15)} Add as a transformer</button></div>

      <div class="lf-card" data-tool="cb"><h3>${icon('rotate', 18)} Change of base</h3>
        <div class="form-grid lf-grid3">
          <label>Z old (pu)<input data-i="z" type="number" inputmode="decimal" step="any" value="0.2"></label>
          <label>kV old<input data-i="kv1" type="number" inputmode="decimal" value="11"></label>
          <label>MVA old<input data-i="s1" type="number" inputmode="decimal" value="25"></label>
          <label>kV new<input data-i="kv2" type="number" inputmode="decimal" value="11"></label>
          <label>MVA new<input data-i="s2" type="number" inputmode="decimal" value="${base}"></label>
        </div>
        <div class="lf-out"></div></div>`;
    const calc = {
      base: (v) => { const b = baseValues(v.kv, v.mva); return [['I base', `${b.I.toFixed(2)} A`], ['Z base', `${b.Z.toFixed(3)} Ω`], ['Y base', `${(1 / b.Z).toExponential(4)} S`]]; },
      ohm: (v) => { const zb = (v.kv * v.kv) / v.mva; return [['Z base', `${zb.toFixed(3)} Ω`], [`${v.z} Ω =`, `${(v.z / zb).toFixed(6)} pu`], [`${v.z} pu =`, `${(v.z * zb).toFixed(3)} Ω`]]; },
      line: (v) => {
        const zb = (v.kv * v.kv) / base, R = (v.r * v.len) / zb, X = (v.x * v.len) / zb, B = 2 * Math.PI * v.f * v.c * 1e-9 * v.len * zb;
        const mva = Math.sqrt(3) * v.kv * v.amp / 1000;
        return { out: [['R', `${R.toFixed(5)} pu`], ['X', `${X.toFixed(5)} pu`], ['B (total)', `${B.toFixed(5)} pu`], ['Rating', `${mva.toFixed(1)} MVA`], ['Charging', `${(B * base).toFixed(2)} Mvar`], ['SIL', `${((v.kv * v.kv) / Math.sqrt((v.x / (2 * Math.PI * v.f)) / (v.c * 1e-9))).toFixed(1)} MW`]], add: { R, X, B, rate: +mva.toFixed(1) } };
      },
      xf: (v) => {
        const z = (v.uk / 100) * (base / v.s), R = z / Math.sqrt(1 + v.xr * v.xr), X = R * v.xr;
        return { out: [['Z on system base', `${z.toFixed(5)} pu`], ['R', `${R.toFixed(5)} pu`], ['X', `${X.toFixed(5)} pu`]], add: { R, X, B: 0, tap: v.tap, rate: v.s, kind: 'xf' } };
      },
      cb: (v) => [['Z new', `${changeBase(v.z, v.kv1, v.s1, v.kv2, v.s2).toFixed(6)} pu`]],
    };
    body.querySelectorAll('[data-tool]').forEach((card) => {
      const k = card.dataset.tool;
      let last = null;
      const upd = () => {
        const v = {};
        card.querySelectorAll('input[data-i]').forEach((i) => { v[i.dataset.i] = numIn(i.value, 0); });
        let res = calc[k](v);
        if (!Array.isArray(res)) { last = res.add; res = res.out; }
        card.querySelector('.lf-out').innerHTML = res.map(([a, b]) => `<div><span>${a}</span><b>${/NaN|Infinity/.test(b) ? '—' : b}</b></div>`).join('');
      };
      card.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd));
      const sel = card.querySelectorAll('select[data-i]');
      if (sel.length === 2 && this.sys.buses.length > 1) sel[1].selectedIndex = 1;
      upd();
      card.querySelector('[data-add]')?.addEventListener('click', () => {
        const from = +card.querySelector('[data-i=from]').value, to = +card.querySelector('[data-i=to]').value;
        if (!last || from === to) { alert('Choose two different buses.'); return; }
        const r5 = (x) => +x.toFixed(6);
        this.sys.branches.push(newBranch(from, to, r5(last.R), r5(last.X), r5(last.B), { rate: last.rate || 0, tap: last.tap && last.tap !== 1 ? last.tap : 0, kind: last.kind }));
        this.markCustom(); this.changed(); this.updateHead();
        this.toast(`Added ${last.kind === 'xf' ? 'transformer' : 'line'} ${from} → ${to}`);
      });
    });
  }

  // ---------------------------------------------------------------- Theory tab
  renderLearn(body) {
    const block = (b) => {
      if (b.t === 'p') return `<p>${inline(b.text)}</p>`;
      if (b.t === 'f') return `<pre class="lf-f">${b.lines.map(esc).join('\n')}</pre>`;
      if (b.t === 'ul') return `<ul>${b.text.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`;
      if (b.t === 'steps') return `<ol>${b.text.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`;
      if (b.t === 'tip') return `<div class="lf-tip">${icon('bolt', 16)}<span>${inline(b.text)}</span></div>`;
      if (b.t === 'table') return `<div class="lf-tw"><table class="tbl lf-tbl lf-ttext"><thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      return '';
    };
    body.innerHTML = `
      <p class="an-help">The theory behind load flow analysis, from the per-unit system to Newton–Raphson. Tap a topic to open it.</p>
      ${LF_THEORY.map((s, i) => `<details class="lf-det" ${i === 0 ? 'open' : ''}><summary>${i + 1}. ${esc(s.title)}${icon('back', 16, 'flipx lf-chev')}</summary><div class="lf-detb">${s.blocks.map(block).join('')}</div></details>`).join('')}`;
  }
}

// ---------------------------------------------------------------- small charts
function barChart(cv, items, o) {
  if (!cv) return;
  const { ctx, w, h } = prep(cv);
  const muted = css('--muted', '#7f8ca6'), border = css('--border2', 'rgba(148,178,230,.22)'), text2 = css('--text2', '#b9c5da');
  const pad = { l: 46, r: 10, t: 10, b: o.rotate ? 42 : 22 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const span = o.max - o.min || 1, Y = (v) => pad.t + ph - ((v - o.min) / span) * ph;
  ctx.font = '10px Inter, Roboto, sans-serif';
  // grid
  const step = niceStep(span / 4);
  ctx.strokeStyle = border; ctx.fillStyle = muted; ctx.lineWidth = 1; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let v = Math.ceil(o.min / step) * step; v <= o.max + 1e-9; v += step) {
    const y = Y(v);
    ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillText(o.fmt ? o.fmt(v) : String(+v.toFixed(3)), pad.l - 5, y);
  }
  const n = items.length || 1, bw = Math.max(2, Math.min(34, (pw / n) * 0.7)), gap = pw / n;
  const y0 = Y(o.base ?? 0);
  items.forEach((it, i) => {
    const x = pad.l + gap * i + gap / 2, y = Y(it.v);
    ctx.fillStyle = it.color;
    ctx.fillRect(x - bw / 2, Math.min(y, y0), bw, Math.max(1, Math.abs(y0 - y)));
    ctx.fillStyle = text2;
    if (o.rotate) { ctx.save(); ctx.translate(x, h - pad.b + 6); ctx.rotate(-Math.PI / 3); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(it.label, 0, 0); ctx.restore(); } else { ctx.textAlign = 'center'; ctx.textBaseline = 'top'; if (n <= 30 || i % 2 === 0) ctx.fillText(it.label, x, h - pad.b + 5); }
  });
  for (const r of o.refs || []) {
    if (r.v < o.min || r.v > o.max) continue;
    const y = Y(r.v);
    ctx.strokeStyle = r.solid ? muted : '#f87171'; ctx.setLineDash(r.solid ? [] : [5, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.setLineDash([]);
  }
}

function lineLog(cv, pts, tol) {
  if (!cv) return;
  const { ctx, w, h } = prep(cv);
  const muted = css('--muted', '#7f8ca6'), border = css('--border2', 'rgba(148,178,230,.22)'), accent = css('--accent', '#22d3ee');
  const pad = { l: 46, r: 12, t: 10, b: 24 };
  const L = pts.map(([x, y]) => [x, Math.log10(Math.max(y, 1e-16))]);
  const ys = L.map((p) => p[1]).concat([Math.log10(tol)]);
  const ymin = Math.floor(Math.min(...ys)) - 0.2, ymax = Math.ceil(Math.max(...ys)) + 0.2;
  const xmax = Math.max(1, ...L.map((p) => p[0]));
  const X = (x) => pad.l + (x / xmax) * (w - pad.l - pad.r), Y = (y) => pad.t + (1 - (y - ymin) / (ymax - ymin || 1)) * (h - pad.t - pad.b);
  ctx.font = '10px Inter, Roboto, sans-serif'; ctx.lineWidth = 1;
  const ystep = Math.max(1, Math.ceil((ymax - ymin) / 6));
  for (let e = Math.ceil(ymin); e <= ymax; e += ystep) {
    const y = Y(e);
    ctx.strokeStyle = border; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(`1e${e}`, pad.l - 5, y);
  }
  const xstep = niceStep(xmax / 6) || 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let x = 0; x <= xmax; x += Math.max(1, Math.round(xstep))) ctx.fillText(String(x), X(x), h - pad.b + 5);
  const yt = Y(Math.log10(tol));
  ctx.strokeStyle = '#4ade80'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(pad.l, yt); ctx.lineTo(w - pad.r, yt); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath();
  L.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
  ctx.stroke();
  if (L.length <= 60) { ctx.fillStyle = accent; for (const [x, y] of L) { ctx.beginPath(); ctx.arc(X(x), Y(y), 2.6, 0, Math.PI * 2); ctx.fill(); } }
  ctx.fillStyle = '#4ade80'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('tolerance', w - pad.r, yt - 2);
}

/** Does the segment (ax, ay)–(bx, by) cross the box x0..x1 × y0..y1? (Liang–Barsky clipping) */
function segRect(ax, ay, bx, by, x0, y0, x1, y1) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay, P = [-dx, dx, -dy, dy], Q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
  for (let i = 0; i < 4; i++) {
    if (P[i] === 0) { if (Q[i] < 0) return false; continue; }
    const r = Q[i] / P[i];
    if (P[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

/** Rounded-rectangle path (ctx.roundRect is missing on older Android WebViews). */
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
}
