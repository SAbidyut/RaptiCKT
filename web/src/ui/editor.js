// Schematic editor: canvas interaction, simulation loop and all editor chrome.

import { Simulator } from '../engine/sim.js';
import { fmtSI } from '../engine/units.js';
import { GRID, Element } from '../elements/index.js';
import { CircuitDoc, snap, route, simplify, makeElement } from './doc.js';
import { Renderer, WireGraph } from './render.js';
import { THEMES } from './theme.js';
import { icon } from './icons.js';
import { Scope, CH_COLORS } from './scope.js';
import { Inspector, Knob } from './inspector.js';
import { Palette } from './palette.js';
import { Analysis } from './analysis.js';
import { Multimeter } from './meter.js';
import { store } from './store.js';
import { RmsTracker, acFrequency } from './rms.js';
import { autoRoute } from './autoroute.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
let probeSeq = 1;

export class Editor {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.doc = new CircuitDoc();
    this.selection = new Set();
    this.selWires = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.running = false;
    this.paused = false;
    this.multi = false;
    this.overlays = new Set();
    this.vScale = 5; this.iScale = 0.01;
    this.buildDOM();
    this.renderer = new Renderer(this.canvas);
    this.scope = new Scope(this, this.q('.scope-panel'));
    this.inspector = new Inspector(this, this.q('.inspector'), this.q('.quickbar'));
    this.q('.scrim').addEventListener('click', () => { this.palette.close(); this.inspector.closeSheet(); });
    this.knob = new Knob(this, this.q('.knob'));
    this.palette = new Palette(this, this.q('.palette'));
    this.analysis = new Analysis(this, this.q('.analysis'));
    this.meter = new Multimeter(this, this.q('.meter-card'));
    this.bindInput();
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    window.addEventListener('resize', () => this.onResize());
  }

  q(s) { return this.root.querySelector(s); }
  get settings() { return this.app.settings; }
  get theme() { return THEMES[this.settings.theme] || THEMES.dark; }

  // ------------------------------------------------------------------ DOM
  buildDOM() {
    this.root.innerHTML = `
      <header class="topbar">
        <button class="icon-btn" data-a="home" title="Back">${icon('back', 22)}</button>
        <div class="title" data-a="rename"><b class="doc-name">Untitled</b><small class="doc-sub">Tap to rename</small></div>
        <button class="icon-btn" data-a="values" title="Labels">${icon('eye', 21)}</button>
        <button class="icon-btn" data-a="meter" title="Multimeter">${icon('meter', 21)}</button>
        <button class="icon-btn" data-a="scope" title="Oscilloscope">${icon('scope', 21)}</button>
        <button class="icon-btn" data-a="analysis" title="Analysis">${icon('bode', 21)}</button>
        <button class="icon-btn" data-a="more" title="More">${icon('more', 21)}</button>
      </header>
      <nav class="toolbar">
        <button class="tb run" data-a="run">${icon('play', 20)}<span>Run</span></button>
        <button class="tb" data-a="restart">${icon('reset', 20)}<span>Restart</span></button>
        <button class="tb" data-a="step">${icon('step', 20)}<span>Step</span></button>
        <i class="sep"></i>
        <button class="tb" data-a="multi">${icon('select', 20)}<span>Select</span></button>
        <button class="tb" data-a="undo">${icon('undo', 20)}<span>Undo</span></button>
        <button class="tb" data-a="redo">${icon('redo', 20)}<span>Redo</span></button>
        <button class="tb" data-a="fit">${icon('fit', 20)}<span>Fit</span></button>
      </nav>
      <div class="scope-panel"></div>
      <div class="stage">
        <canvas class="board"></canvas>
        <button class="hud-status" data-a="speed"></button>
        <div class="hud-error"></div>
        <div class="hint"></div>
        <div class="selbar"></div>
        <div class="quickbar"></div>
        <div class="knob"></div>
        <div class="meter-card"></div>
        <button class="fab" data-a="add" title="Add component">${icon('plus', 28)}</button>
        <div class="toast"></div>
      </div>
      <div class="scrim"></div>
      <div class="sheet inspector"></div>
      <div class="sheet palette"></div>
      <div class="overlay analysis"></div>
      <div class="menu more-menu"></div>
      <div class="popover speed-pop"></div>`;
    this.canvas = this.q('.board');
    this.root.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-a]');
      if (!b || !this.root.contains(b) || b.closest('.inspector,.palette,.analysis,.meter-card,.more-menu,.speed-pop,.scope-panel,.selbar,.quickbar')) return;
      this.command(b.dataset.a, b);
    });
  }

  command(a, btn) {
    switch (a) {
      case 'home': this.app.goHome(); break;
      case 'rename': this.rename(); break;
      case 'values': this.cycleLabels(); break;
      case 'meter': this.toggleMeter(); break;
      case 'scope': this.toggleScope(); break;
      case 'analysis': this.analysis.open(); break;
      case 'more': this.openMenu(btn); break;
      case 'run': this.togglePlay(); break;
      case 'restart': this.restart(); break;
      case 'step': this.stepOnce(); break;
      case 'multi': this.setMulti(!this.multi); break;
      case 'undo': this.undo(); break;
      case 'redo': this.redo(); break;
      case 'fit': this.fit(); break;
      case 'add': this.palette.open(); break;
      case 'speed': this.openSpeed(); break;
      default:
    }
  }

  // -------------------------------------------------------------- lifecycle
  open(doc, { autoRun = false } = {}) {
    this.stopSound();
    this.doc = doc;
    this.doc.assignNames();
    this.selection.clear(); this.selWires.clear();
    this.undoStack = []; this.redoStack = [];
    this.running = false; this.paused = false;
    this.meterProbes = null;
    this.renderer.maxDpr = undefined;
    this.q('.doc-name').textContent = doc.name;
    this.q('.doc-sub').textContent = doc.description ? doc.description.slice(0, 60) : `${doc.elements.length} components`;
    this.inspector.show(null);
    this.setMulti(false);
    this.scope.userWindow = false;
    this.rebuildNow(true);
    for (const p of this.doc.probes) if (!p.label) this.labelProbe(p);
    this.scope.setProbes(this.doc.probes);
    this.toggleScope(this.doc.probes.length > 0);
    this.onResize();
    this.fit();
    this.updateToolbar();
    this.updateHint();
    if (autoRun && doc.elements.length) this.setRunning(true);
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
    this.active = true;
    if (!this.prewarmed) { this.prewarmed = true; setTimeout(() => this.palette.prewarm(), 1200); }
    if (!store.flag('editorTips')) setTimeout(() => this.showTips(), 400);
  }

  close() {
    this.active = false;
    this.setRunning(false);
    this.stopSound();
    this.palette.close(); this.analysis.close();
    this.closeMenu();
  }

  onResize() {
    this.renderer.resize();
    this.scope.resize();
    this.dirtyDraw = true;
  }

  fit() {
    const top = 0;
    const bottom = 80;
    this.renderer.fit(this.doc.bounds(), 50, top, bottom);
    this.dirtyDraw = true;
  }

  // ------------------------------------------------------------- simulator
  simOptions() {
    const s = this.settings;
    return { method: s.method, initialDC: s.initialDC, reltol: s.reltol, vntol: s.vntol, abstol: s.abstol, gmin: s.gmin, maxIter: s.maxIter };
  }

  topologyChanged() {
    this.needRebuild = true; this.dirtyDraw = true; this.scheduleAutosave(); this.updateHint();
    if (!this.doc.description) this.q('.doc-sub').textContent = `${this.doc.elements.length} component${this.doc.elements.length === 1 ? '' : 's'}`;
  }

  rebuildNow(force) {
    if (!this.needRebuild && !force && this.sim) return;
    this.needRebuild = false;
    this.doc.assignNames();
    this.sim = new Simulator(this.simOptions()).build(this.doc.elements, this.doc.wires);
    this.graph = new WireGraph(this.doc);
    this.resolveProbes();
    this.computeTiming();
    // one supply cycle of RMS history for the live labels and Auto meters
    const fac = acFrequency(this.doc.elements);
    this.sim.acPeriod = fac >= 0.5 ? 1 / fac : 0;
    this.rms = this.sim.acPeriod ? new RmsTracker(this.sim.acPeriod, this.sim.nodeCount, this.doc.elements.filter((e) => e.localPosts().length === 2)) : null;
    if (this.running) {
      this.sim.start();
      this.scope.reset();
      this.showError();
    }
    this.inspector.updateReadings();
  }

  computeTiming() {
    let fmax = 0;
    for (const e of this.doc.elements) {
      const p = e.p;
      // waveform sources, and fixed-frequency supplies such as mains and 3-phase (which have no wave)
      const periodic = p.freq > 0 && (p.wave ? p.wave !== 'dc' : e.constructor.category === 'Sources');
      if (periodic) fmax = Math.max(fmax, p.freq);
      if (e.constructor.type === 'mic') fmax = Math.max(fmax, p.freq);
    }
    this.fmax = fmax;
    const ss = this.doc.simSettings;
    const autoSpeed = fmax > 0 ? Math.min(1, 2 / fmax) : 5e-3;
    this.speed = ss.speed || autoSpeed;
    this.updateDt();
    this.scope.setAutoWindow(this.speed * 3);
  }

  updateDt() {
    const ss = this.doc.simSettings;
    let dt = this.speed / 2400;
    if (this.fmax > 0) dt = Math.min(dt, 1 / (this.fmax * 200));
    dt = Math.min(dt, this.settings.maxStep || 1e-4);
    if (ss.dt) dt = ss.dt;
    this.dt = Math.max(1e-12, dt);
  }

  setRunning(on) {
    if (on) {
      this.rebuildNow(true);
      this.running = true;
      this.paused = false;
      this.sim.start();
      this.scope.reset();
      this.showError();
      this.app.bridge.keepScreenOn(true);
      this.ensureAudio();
    } else {
      this.running = false;
      this.paused = false;
      this.app.bridge.keepScreenOn(false);
      this.stopSound();
      for (const e of this.doc.elements) { e.postCurrents.fill?.(0); e.i = 0; }
      this.showError();
    }
    this.updateToolbar();
    this.inspector.updateReadings();
    this.dirtyDraw = true;
  }

  togglePlay() {
    this.haptic(8);
    if (!this.running) { if (!this.doc.elements.length) { this.toast('Add some components first'); return; } this.setRunning(true); return; }
    this.paused = !this.paused;
    if (!this.paused && this.sim.fatal) this.setRunning(true);
    this.updateToolbar();
  }

  restart() {
    this.haptic(8);
    if (!this.running) { this.setRunning(true); return; }
    for (const e of this.doc.elements) if (e.reset) e.reset(this.sim);
    this.rebuildNow(true);
    this.toast('Simulation restarted at t = 0');
  }

  stepOnce() {
    if (!this.running) { this.setRunning(true); this.paused = true; this.updateToolbar(); return; }
    this.paused = true;
    this.advance(this.speed / 30);
    this.updateToolbar();
    this.dirtyDraw = true;
  }

  advance(simTime, budgetMs = 11) {
    const sim = this.sim;
    if (!sim || !sim.ready || sim.fatal) return 1;
    const t0 = performance.now();
    const target = sim.t + simTime;
    let n = 0;
    while (sim.t < target - this.dt * 1e-6) {
      const t0s = sim.t;
      const ok = sim.step(Math.min(this.dt, target - sim.t) > this.dt * 0.01 ? this.dt : this.dt);
      n++;
      if (!ok) { this.showError(); this.paused = true; this.updateToolbar(); break; }
      if (this.rms) this.rms.sample(sim, sim.t - t0s);
      this.scope.sample(sim);
      if ((n & 7) === 0 && performance.now() - t0 > budgetMs) break;
    }
    const done = simTime > 0 ? Math.min(1, (sim.t - (target - simTime)) / simTime) : 1;
    return done;
  }

  showError() {
    const box = this.q('.hud-error');
    const sim = this.sim;
    if (this.running && sim && sim.error) {
      box.innerHTML = `${icon('info', 16)}<span>${esc(sim.error)}</span>`;
      box.classList.add('show');
      this.errorEl = sim.errorElement;
    } else if (this.running && sim && sim.warnings.length) {
      box.innerHTML = `${icon('info', 16)}<span>${esc(sim.warnings[0])}</span>`;
      box.classList.add('show', 'warn');
      clearTimeout(this.warnT);
      this.warnT = setTimeout(() => box.classList.remove('show', 'warn'), 5000);
      this.errorEl = null;
    } else {
      box.classList.remove('show', 'warn');
      this.errorEl = null;
    }
  }

  // ----------------------------------------------------------------- loop
  loop(ts) {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.active) return;
    const dtReal = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
    this.adaptResolution(ts - this.last);
    this.last = ts;
    if (this.needRebuild && !this.drag) this.rebuildNow();
    let frac = 1;
    const live = this.running && this.sim && this.sim.ready;
    if (live && !this.paused) {
      frac = this.advance(this.speed * dtReal, Math.max(3, 10 - (this.drawMs || 0)));
      this.slow = frac < 0.9;
    }
    if (live) {
      this.graph.solveCurrents(this.doc);
      this.autoScale(dtReal);
      if (!this.paused) this.renderer.advanceDots(this.drawState(), dtReal);
      this.updateSound();
    }
    this.frameCount = (this.frameCount || 0) + 1;
    if (live || this.dirtyDraw || this.drag) {
      const t0 = performance.now();
      this.renderer.draw(this.drawState(ts / 1000));
      this.drawMs = 0.8 * (this.drawMs || 0) + 0.2 * (performance.now() - t0);
      this.dirtyDraw = false;
    }
    // scope at 30 fps while running is plenty for the eye and halves its cost
    if (this.scopeOpen && (live ? this.frameCount % 2 === 0 : this.frameCount % 20 === 0)) this.scope.draw();
    if (this.frameCount % 12 === 0) {
      this.updateStatus();
      if (live) this.inspector.updateReadings();
    }
    if (this.meter.open) this.meter.update(dtReal);
  }

  /** Dynamic resolution: lower the canvas pixel density on slow devices to keep ~60 fps. */
  adaptResolution(frameMs) {
    const R = this.renderer;
    if (!(this.running && !this.paused) || frameMs > 250) { this.slowFrames = 0; return; }
    this.frameEma = 0.92 * (this.frameEma || 16.7) + 0.08 * frameMs;
    this.slowFrames = this.frameEma > 24 ? (this.slowFrames || 0) + 1 : 0;
    if (this.slowFrames > 45 && R.dpr > 1.01) {
      R.maxDpr = Math.max(1, R.dpr - 0.5);
      this.slowFrames = 0; this.frameEma = 16.7;
      this.onResize();
    }
  }

  autoScale(dt) {
    const sim = this.sim;
    let vmax = 0.5, imax = 1e-6;
    for (let n = 1; n < sim.externalNodes; n++) vmax = Math.max(vmax, Math.abs(sim.nodeVoltage(n)));
    for (const e of this.doc.elements) for (const c of e.postCurrents) imax = Math.max(imax, Math.abs(c || 0));
    const a = Math.min(1, dt * 1.5);
    this.vScale += (vmax - this.vScale) * (vmax > this.vScale ? 0.5 : a);
    this.iScale += (imax - this.iScale) * (imax > this.iScale ? 0.5 : a);
  }

  drawState(t = performance.now() / 1000) {
    for (const p of this.doc.probes) this.probePos(p);
    return {
      doc: this.doc, sim: this.sim, running: this.running, theme: this.theme, settings: this.settings,
      selection: this.selection, selWires: this.selWires, graph: this.graph, t, preview: this.preview,
      probes: this.doc.probes, hoverPost: this.hoverPost, marquee: this.marquee, meterProbes: this.meter.open ? this.meterProbes : null,
      vScale: this.vScale, iScale: this.iScale, iMin: this.iScale * 1e-3 + 1e-12, errorEl: this.errorEl, rms: this.running ? this.rms : null,
    };
  }

  updateStatus() {
    const s = this.q('.hud-status');
    if (!this.running) { s.innerHTML = `${icon('speed', 14)} ${fmtSI(this.speed, 's', 2)}/s`; return; }
    const t = this.sim ? this.sim.t : 0;
    s.innerHTML = `<i class="dot ${this.paused ? '' : 'live'}"></i>t = ${fmtSI(t, 's', 4)} · ${fmtSI(this.speed, 's', 2)}/s${this.slow ? ' · <em>CPU-limited</em>' : ''}`;
  }

  updateToolbar() {
    const run = this.q('[data-a=run]');
    const playing = this.running && !this.paused;
    run.innerHTML = `${icon(playing ? 'pause' : 'play', 20)}<span>${playing ? 'Pause' : this.running ? 'Resume' : 'Run'}</span>`;
    run.classList.toggle('on', playing);
    this.q('[data-a=undo]').disabled = !this.undoStack.length;
    this.q('[data-a=redo]').disabled = !this.redoStack.length;
    this.q('[data-a=multi]').classList.toggle('on', this.multi);
    this.q('[data-a=scope]').classList.toggle('on', !!this.scopeOpen);
    this.q('[data-a=meter]').classList.toggle('on', this.meter.open);
    this.updateStatus();
  }

  updateHint() {
    const h = this.q('.hint');
    if (!this.doc.elements.length) {
      h.innerHTML = `<div class="hint-card">${icon('bolt', 28)}<b>Start building</b><span>Tap <b>+</b> to add components. Drag from a terminal to draw a wire. Press <b>Run</b> to simulate.</span></div>`;
      h.classList.add('show');
    } else h.classList.remove('show');
  }

  // ------------------------------------------------------------ undo/redo
  snapshot() { return JSON.stringify(this.doc.toJSON()); }
  checkpoint() {
    this.doc.isExample = false;
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 120) this.undoStack.shift();
    this.redoStack = [];
    this.updateToolbar();
    this.scheduleAutosave();
  }
  restoreFrom(json) {
    const d = CircuitDoc.fromJSON(JSON.parse(json));
    d.id = this.doc.id;
    this.doc = d;
    this.selection.clear(); this.selWires.clear();
    this.inspector.show(null);
    this.scope.setProbes(this.doc.probes);
    this.topologyChanged();
    this.rebuildNow(true);
  }
  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.snapshot());
    this.restoreFrom(this.undoStack.pop());
    this.updateToolbar();
    this.haptic(6);
  }
  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.snapshot());
    this.restoreFrom(this.redoStack.pop());
    this.updateToolbar();
    this.haptic(6);
  }

  scheduleAutosave() {
    clearTimeout(this.autoT);
    this.autoT = setTimeout(() => {
      store.autosave(this.doc.toJSON());
      if (this.doc.id) this.app.saveToLibrary(this.doc, true);
    }, 900);
  }

  // ----------------------------------------------------------- selection
  selected() { return this.selection.size === 1 && !this.selWires.size ? [...this.selection][0] : null; }

  select(el, { add = false } = {}) {
    if (!add) { this.selection.clear(); this.selWires.clear(); }
    if (el) { if (add && this.selection.has(el)) this.selection.delete(el); else this.selection.add(el); }
    this.afterSelect();
  }
  selectWire(w, { add = false } = {}) {
    if (!add) { this.selection.clear(); this.selWires.clear(); }
    if (w) { if (add && this.selWires.has(w)) this.selWires.delete(w); else this.selWires.add(w); }
    this.afterSelect();
  }
  afterSelect() {
    const one = this.selected();
    this.inspector.show(one);
    this.renderSelBar();
    this.dirtyDraw = true;
  }

  renderSelBar() {
    const bar = this.q('.selbar');
    const nEl = this.selection.size, nW = this.selWires.size;
    if ((nEl === 0 && nW === 0) || (nEl === 1 && nW === 0)) { bar.classList.remove('show'); return; }
    const onlyWire = nEl === 0 && nW === 1;
    bar.innerHTML = `<span>${nEl ? nEl + ' part' + (nEl > 1 ? 's' : '') : ''}${nEl && nW ? ', ' : ''}${nW ? nW + ' wire' + (nW > 1 ? 's' : '') : ''}</span>
      ${onlyWire ? `<button data-s="probe">${icon('scope', 17)}Scope</button>` : ''}
      ${nEl ? `<button data-s="rotate">${icon('rotate', 17)}Rotate</button><button data-s="dup">${icon('copy', 17)}Copy</button>` : ''}
      <button data-s="del" class="danger">${icon('trash', 17)}Delete</button>
      <button data-s="x">${icon('x', 17)}</button>`;
    bar.classList.add('show');
    bar.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
      const s = b.dataset.s;
      if (s === 'probe') { const w = [...this.selWires][0]; this.addProbe({ kind: 'node', pos: this.wireProbePoint(w) }); }
      if (s === 'rotate') this.rotateSelection();
      if (s === 'dup') this.duplicateSelection();
      if (s === 'del') this.deleteSelection();
      if (s === 'x') this.select(null);
    }));
  }

  wireProbePoint(w) {
    if (this.lastTapWorld) {
      const [x, y] = this.lastTapWorld;
      for (let i = 1; i < w.pts.length; i++) {
        const p = closestOnSeg(x, y, w.pts[i - 1], w.pts[i]);
        if (Math.hypot(p[0] - x, p[1] - y) < 30) return [snap(p[0]), snap(p[1])];
      }
    }
    return [...w.pts[0]];
  }

  setMulti(on) {
    this.multi = on;
    if (!on && this.selection.size + this.selWires.size > 1) this.select(null);
    this.updateToolbar();
    if (on) this.toast('Select mode: drag to box-select, tap to add/remove');
  }

  // ------------------------------------------------------------- editing
  makeEl(type, x, y) { return makeElement(type, x, y); }
  newDoc(name) { return new CircuitDoc(name); }

  addComponent(type) {
    const [cx, cy] = this.renderer.toWorld(this.renderer.cw / 2, this.renderer.ch * 0.42);
    const e = makeElement(type, snap(cx), snap(cy));
    if (!e) return;
    const boxes = this.doc.elements.map((o) => o.worldBox());
    const pad = GRID;
    const free = () => {
      const [a, b, c, d] = e.worldBox();
      return !boxes.some(([p, q, r, t]) => a - pad < r && c + pad > p && b - pad < t && d + pad > q);
    };
    // spiral search for a free spot near the view centre
    const x0 = e.x, y0 = e.y;
    outer: for (let ring = 0; ring < 12; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          e.x = x0 + dx * GRID * 3; e.y = y0 + dy * GRID * 3;
          if (free()) break outer;
        }
      }
    }
    this.checkpoint();
    this.doc.add(e);
    this.doc.assignNames();
    this.select(e);
    this.topologyChanged();
    this.haptic(10);
    this.toast(`${e.constructor.title} added — drag to move, drag a terminal to wire`);
  }

  setParam(el, key, val, live = false) {
    if (!live) this.checkpoint();
    el.p[key] = val;
    el.onParamChange(key);
    if (this.sim) this.sim.dirty = true;
    const def = el.propDef(key);
    if (def && def.structural) this.topologyChanged();
    if (key === 'freq' || key === 'wave') this.computeTiming();
    this.inspector.refreshValue(key);
    if (this.knob.el === el) this.knob.update();
    this.dirtyDraw = true;
    if (live) this.scheduleAutosave();
  }

  deleteSelection() {
    if (!this.selection.size && !this.selWires.size) return;
    this.checkpoint();
    for (const e of this.selection) this.doc.remove(e);
    for (const w of this.selWires) this.doc.removeWire(w);
    this.doc.probes = this.doc.probes.filter((p) => p.kind !== 'node' || this.pointConnected(p.pos));
    this.scope.setProbes(this.doc.probes);
    this.select(null);
    this.topologyChanged();
    this.haptic(12);
  }

  pointConnected(p) {
    return this.doc.wires.some((w) => w.pts.some((q) => same(p, q)) || w.pts.some((q, i) => i && onSeg(p, w.pts[i - 1], q)))
      || this.doc.elements.some((e) => e.getPosts().some((q) => same(p, q)));
  }

  duplicateSelection() {
    if (!this.selection.size && !this.selWires.size) return;
    this.checkpoint();
    const off = GRID * 2;
    const newEls = [], newWires = [];
    for (const e of this.selection) {
      const o = e.toJSON(); o.x += off; o.y += off;
      const c = Element.fromJSON(o);
      this.doc.add(c); newEls.push(c);
    }
    for (const w of this.selWires) newWires.push(this.doc.addWire(w.pts.map(([x, y]) => [x + off, y + off])));
    this.doc.assignNames();
    this.selection = new Set(newEls); this.selWires = new Set(newWires.filter(Boolean));
    this.afterSelect();
    this.topologyChanged();
  }

  rotateSelection() { this.transformSelection((e) => { e.rot = (e.rot + 1) & 3; }); }
  flipSelection() { this.transformSelection((e) => { e.flip = !e.flip; }); }

  transformSelection(fn) {
    if (!this.selection.size) return;
    this.checkpoint();
    for (const e of this.selection) {
      const old = e.getPosts();
      fn(e);
      this.followWires(new Map([[e, old]]));
    }
    this.topologyChanged();
    this.haptic(6);
  }

  /** Move wire endpoints that were attached to old post positions onto the new posts. */
  followWires(oldPostsByEl, movedWires = new Set()) {
    const moves = [];
    for (const [e, old] of oldPostsByEl) {
      const now = e.getPosts();
      old.forEach((p, i) => { if (!same(p, now[i])) moves.push([p, now[i]]); });
    }
    if (!moves.length) return;
    for (const w of this.doc.wires) {
      if (movedWires.has(w)) continue;
      const a = w.pts[0], b = w.pts[w.pts.length - 1];
      const ma = moves.find(([p]) => same(p, a)), mb = moves.find(([p]) => same(p, b));
      if (!ma && !mb) continue;
      const na = ma ? ma[1] : a, nb = mb ? mb[1] : b;
      if (ma && mb && na[0] - a[0] === nb[0] - b[0] && na[1] - a[1] === nb[1] - b[1]) {
        const dx = na[0] - a[0], dy = na[1] - a[1];
        w.pts = w.pts.map(([x, y]) => [x + dx, y + dy]);
        continue;
      }
      // re-route cleanly around parts and other wires; fall back to a plain L
      const smart = autoRoute(this.doc, na, nb, { skipWires: new Set([w]) });
      if (smart) { w.pts = simplify(smart); if (w.pts.length >= 2) continue; }
      // keep the orientation of the segment at the fixed end
      if (!ma) {
        const h = w.pts.length > 1 ? w.pts[1][1] === a[1] : true;
        w.pts = simplify(route(na, nb, h));
      } else if (!mb) {
        const n = w.pts.length;
        const h = n > 1 ? w.pts[n - 2][1] === b[1] : true;
        w.pts = simplify(route(nb, na, h)).reverse();
      } else {
        w.pts = simplify(route(na, nb, true));
      }
      if (w.pts.length < 2) w.pts = [na, nb];
    }
    for (const p of this.doc.probes) {
      if (p.kind !== 'node' || !p.pos) continue;
      const m = moves.find(([q]) => same(q, p.pos));
      if (m) p.pos = [...m[1]];
    }
  }

  // --------------------------------------------------------------- probes
  addProbe(spec) {
    if (this.doc.probes.length >= 6) { this.toast('Maximum 6 scope channels'); return; }
    const used = new Set(this.doc.probes.map((p) => p.color));
    const color = CH_COLORS.find((c) => !used.has(c)) || CH_COLORS[0];
    const p = { id: 'p' + probeSeq++ + '_' + Date.now().toString(36), color, ...spec };
    if (p.kind === 'node') {
      if (this.doc.probes.some((q) => q.kind === 'node' && same(q.pos, p.pos))) { this.toast('Already probed'); return; }
      this.rebuildNow();
    } else if (this.doc.probes.some((q) => q.kind === p.kind && q.el === p.el)) { this.toast('Already on the scope'); return; }
    this.labelProbe(p);
    this.checkpoint();
    this.doc.probes.push(p);
    this.resolveProbes();
    this.scope.setProbes(this.doc.probes);
    this.toggleScope(true);
    this.haptic(8);
    this.toast(`${p.label} added to the oscilloscope`);
  }

  labelProbe(p) {
    if (p.kind === 'node') {
      const nd = this.sim ? this.sim.pointNode(p.pos[0], p.pos[1]) : -1;
      p.label = 'V(' + (this.nodeNames()[nd] || 'node') + ')';
      p.unit = 'V';
    } else {
      const e = this.doc.elements.find((x) => x.id === p.el);
      p.label = (p.kind === 'cur' ? 'I(' : 'V(') + (e ? e.name : '?') + ')';
      p.unit = p.kind === 'cur' ? 'A' : 'V';
    }
  }

  removeProbe(p) {
    this.checkpoint();
    this.doc.probes = this.doc.probes.filter((q) => q !== p);
    this.scope.setProbes(this.doc.probes);
    this.dirtyDraw = true;
  }

  resolveProbes() {
    for (const p of this.doc.probes) {
      if (p.kind === 'node') p._node = this.sim ? this.sim.pointNode(p.pos[0], p.pos[1]) : -1;
      else p._el = this.doc.elements.find((e) => e.id === p.el);
    }
  }

  probePos(p) {
    if (p.kind === 'node') return p.pos;
    const e = p._el || this.doc.elements.find((x) => x.id === p.el);
    if (!e) return null;
    const posts = e.getPosts();
    // pin marks the measured terminal (never covers the symbol itself)
    p.pos = posts[p.kind === 'cur' && posts.length > 1 ? 1 : 0] || e.toWorld(0, 0);
    // lean the pin away from the body so it never covers the symbol
    const c = e.toWorld(0, 0), dx = p.pos[0] - c[0], dy = p.pos[1] - c[1];
    p.ang = dx || dy ? Math.atan2(dx, -dy) + 0.55 : 0;
    return p.pos;
  }

  probeValue(p, sim = this.sim) {
    if (!sim) return 0;
    if (p.kind === 'node') return p._node >= 0 ? sim.nodeVoltage(p._node) : 0;
    const e = p._el;
    if (!e) return 0;
    if (p.kind === 'cur') return e.i || 0;
    return e.nodes.length >= 2 ? sim.v(e.nodes[0]) - sim.v(e.nodes[1]) : sim.v(e.nodes[0]);
  }

  probeNodes(p) {
    if (p.kind === 'node') return [p._node, 0];
    const e = p._el;
    if (!e) return [-1, -1];
    return e.nodes.length >= 2 ? [e.nodes[0], e.nodes[1]] : [e.nodes[0], 0];
  }

  nodeNames() {
    const names = ['GND'];
    for (const e of this.doc.elements) {
      e.nodes.forEach((n, i) => {
        if (n > 0 && !names[n]) {
          const pins = e.pinNames ? e.pinNames() : null;
          names[n] = e.name + (pins ? '.' + pins[i] : e.nodes.length > 1 ? (i === 0 ? '+' : i === 1 ? '−' : '.' + (i + 1)) : '');
        }
      });
    }
    return names;
  }

  spiceNetlist() {
    this.rebuildNow(true);
    const lines = [`* ${this.doc.name}`, `* Exported from RaptiCKT – Resonance Automation (rapti.net)`, `* ${new Date().toISOString()}`, ''];
    for (const e of this.doc.elements) {
      if (!e.spice) { if (e.nodes.length) lines.push(`* ${e.name} (${e.constructor.title}) – no SPICE equivalent`); continue; }
      lines.push(e.spice(e.nodes.map((n) => (n === 0 ? '0' : 'N' + n))));
    }
    const tstop = Math.max(this.speed * 5, this.fmax ? 10 / this.fmax : 0.01);
    lines.push('', '.op', `.tran ${this.dt.toExponential(3)} ${tstop.toExponential(3)}`, '.end');
    return lines.join('\n');
  }

  // --------------------------------------------------------- panels etc.
  toggleScope(on = !this.scopeOpen) {
    this.scopeOpen = on;
    this.root.classList.toggle('with-scope', on);
    requestAnimationFrame(() => { this.onResize(); this.scope.draw(); });
    this.updateToolbar();
  }

  toggleMeter(on = !this.meter.open) {
    this.meter.show(on);
    this.updateToolbar();
    this.dirtyDraw = true;
    if (on && !this.running) this.toast('Run the simulation to read the meter');
  }

  cycleLabels() {
    const s = this.settings;
    if (s.showValues && !s.showNames) { s.showNames = true; this.toast('Showing names + values'); } else if (s.showValues && s.showNames) { s.showValues = false; s.showNames = false; this.toast('Labels hidden'); } else { s.showValues = true; this.toast('Showing values'); }
    this.app.saveSettings();
    this.q('[data-a=values]').innerHTML = icon(s.showValues ? 'eye' : 'eyeoff', 21);
    this.dirtyDraw = true;
  }

  rename() {
    const n = prompt('Circuit name', this.doc.name);
    if (n && n.trim()) {
      this.doc.name = n.trim().slice(0, 80);
      this.q('.doc-name').textContent = this.doc.name;
      this.scheduleAutosave();
    }
  }

  openSpeed() {
    const pop = this.q('.speed-pop');
    if (pop.classList.contains('open')) { pop.classList.remove('open'); return; }
    const lo = -7, hi = 1;
    const v = Math.log10(this.speed);
    pop.innerHTML = `
      <b>Simulation speed</b>
      <div class="speed-val">${fmtSI(this.speed, 's', 3)} per second</div>
      <input type="range" min="${lo * 100}" max="${hi * 100}" value="${Math.round(v * 100)}">
      <div class="speed-row"><span>Timestep Δt</span><b class="dt-val">${fmtSI(this.dt, 's', 3)}</b></div>
      <div class="speed-row"><label><input type="checkbox" class="auto" ${this.doc.simSettings.speed ? '' : 'checked'}> Automatic</label><button class="btn sm" data-x="close">Done</button></div>`;
    const rng = pop.querySelector('input[type=range]');
    rng.addEventListener('input', () => {
      this.speed = Math.pow(10, rng.value / 100);
      this.doc.simSettings.speed = this.speed;
      pop.querySelector('.auto').checked = false;
      this.updateDt();
      this.scope.userWindow = false;
      this.scope.setAutoWindow(this.speed * 3);
      pop.querySelector('.speed-val').textContent = `${fmtSI(this.speed, 's', 3)} per second`;
      pop.querySelector('.dt-val').textContent = fmtSI(this.dt, 's', 3);
      this.updateStatus();
    });
    pop.querySelector('.auto').addEventListener('change', (ev) => {
      if (ev.target.checked) { delete this.doc.simSettings.speed; this.computeTiming(); rng.value = Math.round(Math.log10(this.speed) * 100); pop.querySelector('.speed-val').textContent = `${fmtSI(this.speed, 's', 3)} per second`; pop.querySelector('.dt-val').textContent = fmtSI(this.dt, 's', 3); }
    });
    pop.querySelector('[data-x=close]').addEventListener('click', () => pop.classList.remove('open'));
    pop.classList.add('open');
  }

  openMenu(btn) {
    const m = this.q('.more-menu');
    if (m.classList.contains('open')) { this.closeMenu(); return; }
    const items = [
      ['save', 'save', 'Save to My Circuits'], ['copy', 'saveas', 'Save as copy'], ['edit', 'info', 'Circuit name & notes'],
      ['download', 'export', 'Export file (.rckt)'], ['upload', 'import', 'Open file…'], ['share', 'share', 'Share circuit'],
      ['code', 'netlist', 'SPICE netlist'], ['camera', 'shot', 'Export image (PNG)'], ['table', 'op', 'Operating point'],
      ['sliders', 'settings', 'Settings'], ['help', 'help', 'Help & gestures'], ['trash', 'clear', 'Clear circuit'],
    ];
    m.innerHTML = items.map(([ic, a, t]) => `<button data-m="${a}">${icon(ic, 18)}<span>${t}</span></button>`).join('');
    m.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.closeMenu(); this.menuAction(b.dataset.m); }));
    m.classList.add('open');
    this.menuCloser = (ev) => { if (!m.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)) this.closeMenu(); };
    setTimeout(() => document.addEventListener('pointerdown', this.menuCloser), 0);
  }
  closeMenu() {
    this.q('.more-menu').classList.remove('open');
    if (this.menuCloser) document.removeEventListener('pointerdown', this.menuCloser);
  }

  menuAction(a) {
    const app = this.app;
    switch (a) {
      case 'save': app.saveToLibrary(this.doc); this.toast('Saved to My Circuits'); break;
      case 'saveas': { const c = this.doc.clone(); c.id = null; c.name = this.doc.name + ' (copy)'; app.saveToLibrary(c); this.toast('Copy saved'); break; }
      case 'info': this.editInfo(); break;
      case 'export': app.bridge.saveFile(this.doc.name.replace(/[^\w\- ]+/g, '_') + '.rckt', 'application/json', JSON.stringify(this.doc.toJSON(), null, 1)); break;
      case 'import': app.importFile(); break;
      case 'share': app.bridge.share(this.doc.name + ' – RaptiCKT circuit', JSON.stringify(this.doc.toJSON())); break;
      case 'netlist': this.analysis.open('net'); break;
      case 'op': this.analysis.open('op'); break;
      case 'shot': app.bridge.saveFile(this.doc.name.replace(/\W+/g, '_') + '.png', 'image/png', this.screenshot(), true); break;
      case 'settings': app.openSettings(); break;
      case 'help': this.showTips(true); break;
      case 'clear':
        if (confirm('Remove all components and wires?')) {
          this.checkpoint();
          this.doc.elements = []; this.doc.wires = []; this.doc.probes = [];
          this.scope.setProbes([]); this.select(null); this.topologyChanged(); this.setRunning(false);
        }
        break;
      default:
    }
  }

  editInfo() {
    const n = prompt('Circuit name', this.doc.name);
    if (n === null) return;
    const d = prompt('Notes / description (shown on the home screen)', this.doc.description || '');
    this.doc.name = (n.trim() || this.doc.name).slice(0, 80);
    if (d !== null) this.doc.description = d.slice(0, 500);
    this.q('.doc-name').textContent = this.doc.name;
    this.q('.doc-sub').textContent = this.doc.description ? this.doc.description.slice(0, 60) : `${this.doc.elements.length} components`;
    this.scheduleAutosave();
  }

  screenshot() {
    const r = this.renderer;
    this.renderer.draw(this.drawState());
    const out = document.createElement('canvas');
    out.width = this.canvas.width; out.height = this.canvas.height + 44 * r.dpr;
    const ctx = out.getContext('2d');
    ctx.fillStyle = this.theme.bg; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(this.canvas, 0, 0);
    ctx.fillStyle = 'rgba(34,211,238,0.9)';
    ctx.font = `600 ${14 * r.dpr}px Inter, system-ui, sans-serif`;
    ctx.fillText(`${this.doc.name}  ·  RaptiCKT – Resonance Automation`, 14 * r.dpr, this.canvas.height + 28 * r.dpr);
    return out.toDataURL('image/png');
  }

  showTips(force) {
    if (!force && store.flag('editorTips')) return;
    store.setFlag('editorTips');
    this.app.showSheet('How to use the editor', `
      <ul class="tips">
        <li>${icon('plus', 18)}<span><b>Add parts</b> with the + button. Search 330+ components by name.</span></li>
        <li>${icon('wire', 18)}<span><b>Draw wires</b> by dragging from any terminal (small circle) to another terminal or wire.</span></li>
        <li>${icon('hand', 18)}<span><b>Move</b> parts by dragging them – connected wires follow. Pinch to zoom, drag empty space to pan.</span></li>
        <li>${icon('play', 18)}<span><b>Run</b> to simulate: wires glow with voltage, yellow dots show current. Tap switches and buttons to operate them live.</span></li>
        <li>${icon('gauge', 18)}<span><b>Turn the knob</b> of a selected part to change its value while the circuit runs.</span></li>
        <li>${icon('scope', 18)}<span><b>Scope</b>: select a wire or part and tap Scope to probe it. Use FFT and XY views in the scope toolbar.</span></li>
        <li>${icon('bode', 18)}<span><b>Analysis</b>: Bode plots, DC sweeps, operating point and SPICE netlist export for research-grade work.</span></li>
      </ul>`);
  }

  overlayOpen(n) { this.overlays.add(n); }
  overlayClosed(n) { this.overlays.delete(n); }

  /** Android back button. returns true if handled */
  back() {
    if (this.q('.speed-pop').classList.contains('open')) { this.q('.speed-pop').classList.remove('open'); return true; }
    if (this.q('.more-menu').classList.contains('open')) { this.closeMenu(); return true; }
    if (this.analysis.isOpen) { this.analysis.close(); return true; }
    if (this.palette.isOpen) { this.palette.close(); return true; }
    if (this.inspector.sheetOpen) { this.inspector.closeSheet(); return true; }
    if (this.selection.size || this.selWires.size) { this.select(null); return true; }
    if (this.meter.open) { this.toggleMeter(false); return true; }
    return false;
  }

  toast(msg) {
    const t = this.q('.toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }

  haptic(ms) { if (this.settings.haptics) this.app.bridge.vibrate(ms); }

  // ---------------------------------------------------------------- sound
  ensureAudio() {
    if (!this.settings.sound) return;
    try { if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)(); this.audio.resume?.(); } catch { this.audio = null; }
  }
  updateSound() {
    if (!this.audio || !this.settings.sound) return;
    const bz = this.doc.elements.find((e) => e.sounding); // buzzer, bell, speaker…
    if (bz && !this.paused) {
      if (!this.osc) {
        this.osc = this.audio.createOscillator(); this.gain = this.audio.createGain();
        this.osc.type = 'square'; this.gain.gain.value = 0.04;
        this.osc.connect(this.gain).connect(this.audio.destination); this.osc.start();
      }
      this.osc.frequency.value = bz.soundTone ?? bz.p.tone ?? 800;
    } else this.stopSound();
  }
  stopSound() { try { this.osc?.stop(); } catch { /* ignore */ } this.osc = null; }

  // ---------------------------------------------------------------- input
  bindInput() {
    const cv = this.canvas;
    this.pointers = new Map();
    cv.addEventListener('pointerdown', (e) => this.onDown(e));
    cv.addEventListener('pointermove', (e) => this.onMove(e));
    cv.addEventListener('pointerup', (e) => this.onUp(e));
    cv.addEventListener('pointercancel', (e) => this.onUp(e, true));
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      this.renderer.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
      this.dirtyDraw = true;
    }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (!this.active || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') this.deleteSelection();
      else if (e.key === 'r') this.rotateSelection();
      else if (e.key === ' ') { e.preventDefault(); this.togglePlay(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') this.undo();
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') this.redo();
      else if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); this.duplicateSelection(); }
    });
  }

  local(e) { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  hitTest(sx, sy) {
    const R = this.renderer;
    const [wx, wy] = R.toWorld(sx, sy);
    const tol = 13 / R.scale + 2;
    if (this.meter.open && this.meterProbes) {
      for (const k of ['red', 'black']) {
        const p = this.meterProbes[k];
        const [px, py] = R.toScreen(p[0], p[1]);
        if (Math.hypot(sx - px, sy - (py - 15)) < 18 || Math.hypot(sx - px, sy - py) < 12) return { kind: 'pin', key: k };
      }
    }
    // element bodies first when tapping well inside a part
    let best = null, bestD = Infinity;
    for (const e of this.doc.elements) {
      for (const p of e.getPosts()) {
        const d = Math.hypot(p[0] - wx, p[1] - wy);
        if (d < tol && d < bestD) { best = { kind: 'post', pos: p, el: e }; bestD = d; }
      }
    }
    for (const w of this.doc.wires) {
      for (const p of [w.a, w.b]) {
        const d = Math.hypot(p[0] - wx, p[1] - wy);
        if (d < tol && d < bestD) { best = { kind: 'post', pos: p, wire: w }; bestD = d; }
      }
    }
    const bodies = this.doc.elements.filter((e) => e.hitTest(wx, wy, 3 / R.scale));
    if (best && bodies.length) {
      // prefer the body when the pointer is clearly inside it (away from the terminal)
      const e = bodies[bodies.length - 1];
      if (bestD > tol * 0.55 && best.el !== e) return { kind: 'element', el: e };
      if (bestD > tol * 0.7) return { kind: 'element', el: e };
    }
    if (best) return best;
    if (bodies.length) {
      bodies.sort((a, b) => area(a) - area(b));
      return { kind: 'element', el: bodies[0] };
    }
    let bw = null, bd = 9 / R.scale + 1;
    for (const w of this.doc.wires) {
      for (let i = 1; i < w.pts.length; i++) {
        const p = closestOnSeg(wx, wy, w.pts[i - 1], w.pts[i]);
        const d = Math.hypot(p[0] - wx, p[1] - wy);
        if (d < bd) { bd = d; bw = { kind: 'wire', wire: w, pos: p }; }
      }
    }
    return bw || { kind: 'none' };
  }

  onDown(ev) {
    ev.preventDefault();
    this.canvas.setPointerCapture(ev.pointerId);
    const [sx, sy] = this.local(ev);
    this.pointers.set(ev.pointerId, [sx, sy]);
    this.q('.speed-pop').classList.remove('open');
    if (this.pointers.size === 2) {
      this.cancelGesture();
      const [a, b] = [...this.pointers.values()];
      const R = this.renderer;
      this.gesture = { type: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]), s0: R.scale, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], w: R.toWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) };
      return;
    }
    if (this.pointers.size > 2) return;
    const hit = this.hitTest(sx, sy);
    this.gesture = { type: 'pending', hit, sx, sy, w: this.renderer.toWorld(sx, sy), t0: performance.now() };
    if (hit.kind === 'element' && hit.el.onPress && !this.multi) {
      if (hit.el.onPress()) { this.gesture.pressed = hit.el; this.pressChanged(hit.el); }
    }
    clearTimeout(this.lpT);
    this.lpT = setTimeout(() => this.longPress(), 480);
  }

  pressChanged(el) {
    if (this.sim) this.sim.dirty = true;
    this.haptic(10);
    this.dirtyDraw = true;
    this.inspector.updateReadings();
  }

  longPress() {
    const g = this.gesture;
    if (!g || g.type !== 'pending' || g.pressed) return;
    if (g.hit.kind === 'element') {
      this.gesture = { type: 'done' };
      this.select(g.hit.el);
      this.inspector.openSheet();
      this.haptic(15);
    } else if (g.hit.kind === 'none') {
      this.gesture = { type: 'marquee', sx: g.sx, sy: g.sy };
      this.marquee = [g.sx, g.sy, g.sx, g.sy];
      this.haptic(15);
    }
  }

  cancelGesture() {
    clearTimeout(this.lpT);
    const g = this.gesture;
    if (g && g.pressed) { g.pressed.onRelease(); this.pressChanged(g.pressed); }
    if (g && g.type === 'move' && g.moved) this.topologyChanged();
    this.preview = null; this.marquee = null; this.drag = false;
    this.gesture = null;
  }

  onMove(ev) {
    const [sx, sy] = this.local(ev);
    if (!this.pointers.has(ev.pointerId)) return;
    this.pointers.set(ev.pointerId, [sx, sy]);
    const g = this.gesture;
    if (!g) return;
    const R = this.renderer;
    if (g.type === 'pinch') {
      const [a, b] = [...this.pointers.values()];
      if (!b) return;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      R.scale = Math.min(6, Math.max(0.15, (g.s0 * d) / g.d0));
      R.ox = mid[0] - g.w[0] * R.scale; R.oy = mid[1] - g.w[1] * R.scale;
      this.dirtyDraw = true;
      return;
    }
    if (g.type === 'pending') {
      if (Math.hypot(sx - g.sx, sy - g.sy) < 7) return;
      clearTimeout(this.lpT);
      if (g.pressed) { g.pressed.onRelease(); this.pressChanged(g.pressed); g.pressed = null; }
      this.startDrag(g);
    }
    this.updateDrag(sx, sy);
  }

  startDrag(g) {
    const h = g.hit;
    this.drag = true;
    if (h.kind === 'pin') { g.type = 'pin'; return; }
    if (h.kind === 'post' || (h.kind === 'wire' && !this.multi)) {
      g.type = 'wire';
      g.start = h.kind === 'post' ? [...h.pos] : [snap(h.pos[0]), snap(h.pos[1])];
      return;
    }
    if (h.kind === 'element' || (h.kind === 'wire' && this.multi)) {
      g.type = 'move';
      let els, wires;
      if (h.kind === 'element' && this.selection.has(h.el)) { els = [...this.selection]; wires = [...this.selWires]; } else if (h.kind === 'element') { this.select(h.el); els = [h.el]; wires = []; } else { els = [...this.selection]; wires = this.selWires.has(h.wire) ? [...this.selWires] : [h.wire]; }
      g.els = els.map((e) => ({ e, x: e.x, y: e.y, posts: e.getPosts() }));
      g.wires = wires.map((w) => ({ w, pts: w.pts.map((p) => [...p]) }));
      g.snapshot = this.snapshot();
      g.dx = 0; g.dy = 0;
      return;
    }
    g.type = this.multi ? 'marquee' : 'pan';
    if (g.type === 'marquee') this.marquee = [g.sx, g.sy, g.sx, g.sy];
    g.ox = this.renderer.ox; g.oy = this.renderer.oy;
  }

  magnet(wx, wy, exclude) {
    const R = this.renderer, tol = 16 / R.scale + 2;
    let best = null, bd = tol;
    const consider = (p) => { const d = Math.hypot(p[0] - wx, p[1] - wy); if (d < bd && !(exclude && same(p, exclude))) { bd = d; best = p; } };
    for (const e of this.doc.elements) for (const p of e.getPosts()) consider(p);
    for (const w of this.doc.wires) for (const p of w.pts) consider(p);
    if (best) return [...best];
    // Dropped on a part's body or lead: attach to that part's nearest terminal instead of
    // leaving a wire end sitting on the symbol, unconnected.
    const pad = 4 / R.scale + 2;
    let pick = null, pd = Infinity;
    for (const e of this.doc.elements) {
      const [x1, y1, x2, y2] = e.worldBox();
      if (wx < x1 - pad || wx > x2 + pad || wy < y1 - pad || wy > y2 + pad) continue;
      for (const p of e.getPosts()) {
        if (exclude && same(p, exclude)) continue;
        const d = Math.hypot(p[0] - wx, p[1] - wy);
        if (d < pd) { pd = d; pick = p; }
      }
    }
    return pick ? [...pick] : [snap(wx), snap(wy)];
  }

  updateDrag(sx, sy) {
    const g = this.gesture, R = this.renderer;
    const [wx, wy] = R.toWorld(sx, sy);
    switch (g.type) {
      case 'pan':
        R.ox = g.ox + (sx - g.sx); R.oy = g.oy + (sy - g.sy);
        this.dirtyDraw = true;
        break;
      case 'pin':
        this.meterProbes[g.hit.key] = this.magnet(wx, wy);
        this.meter.zCache = null;
        this.dirtyDraw = true;
        break;
      case 'wire': {
        const end = this.magnet(wx, wy, g.start);
        if (g.hFirst === undefined && (Math.abs(end[0] - g.start[0]) > 0 || Math.abs(end[1] - g.start[1]) > 0)) g.hFirst = Math.abs(wx - g.start[0]) >= Math.abs(wy - g.start[1]);
        // routing is only redone when the snapped end point changes
        if (!g.routedTo || !same(g.routedTo, end)) {
          g.routedTo = end;
          g.smart = same(end, g.start) ? null : autoRoute(this.doc, g.start, end);
        }
        this.preview = simplify(g.smart || route(g.start, end, g.hFirst ?? true));
        if (this.preview.length < 2) this.preview = [g.start, end];
        this.hoverPost = end;
        break;
      }
      case 'move': {
        const dx = snap(wx - g.w[0]), dy = snap(wy - g.w[1]);
        if (dx === g.dx && dy === g.dy) break;
        g.dx = dx; g.dy = dy; g.moved = true;
        // restore original geometry then apply delta
        const cur = JSON.parse(g.snapshot);
        this.doc.wires.forEach((w, i) => { if (cur.wires[i]) w.pts = cur.wires[i].map((p) => [...p]); });
        for (const o of g.els) { o.e.x = o.x + dx; o.e.y = o.y + dy; }
        const moved = new Set();
        for (const o of g.wires) { o.w.pts = o.pts.map(([x, y]) => [x + dx, y + dy]); moved.add(o.w); }
        this.followWires(new Map(g.els.map((o) => [o.e, o.posts])), moved);
        this.graph = new WireGraph(this.doc);
        this.dirtyDraw = true;
        break;
      }
      case 'marquee':
        this.marquee = [g.sx, g.sy, sx, sy];
        this.dirtyDraw = true;
        break;
      default:
    }
  }

  onUp(ev, cancelled) {
    this.pointers.delete(ev.pointerId);
    clearTimeout(this.lpT);
    const g = this.gesture;
    if (!g) return;
    if (g.type === 'pinch') { if (this.pointers.size === 0) this.gesture = null; else this.gesture = { type: 'done' }; return; }
    if (g.pressed) { g.pressed.onRelease(); this.pressChanged(g.pressed); }
    if (cancelled) { this.cancelGesture(); return; }
    switch (g.type) {
      case 'pending': this.tap(g); break;
      case 'wire': {
        const pts = this.preview;
        if (pts && pts.length >= 2 && !same(pts[0], pts[pts.length - 1])) {
          this.checkpoint();
          this.doc.addWire(pts);
          this.topologyChanged();
          this.haptic(8);
        }
        break;
      }
      case 'move':
        if (g.moved) {
          this.undoStack.push(g.snapshot); this.redoStack = []; this.updateToolbar();
          this.topologyChanged();
        }
        break;
      case 'marquee': {
        const [x1, y1, x2, y2] = this.marquee || [0, 0, 0, 0];
        const R = this.renderer;
        const [a, b] = R.toWorld(Math.min(x1, x2), Math.min(y1, y2)), [c, d] = R.toWorld(Math.max(x1, x2), Math.max(y1, y2));
        if (!this.multi) this.setMulti(true);
        this.selection = new Set(this.doc.elements.filter((e) => { const [p, q, r, s] = e.worldBox(); return p >= a && q >= b && r <= c && s <= d; }));
        this.selWires = new Set(this.doc.wires.filter((w) => w.pts.every(([x, y]) => x >= a && x <= c && y >= b && y <= d)));
        this.afterSelect();
        break;
      }
      default:
    }
    this.preview = null; this.marquee = null; this.hoverPost = null; this.drag = false;
    this.gesture = null;
    this.dirtyDraw = true;
  }

  tap(g) {
    const h = g.hit;
    this.lastTapWorld = g.w;
    if (h.kind === 'element') {
      const e = h.el;
      if (this.multi) { this.select(e, { add: true }); return; }
      if (!g.pressed && e.onTap && e.onTap()) { this.pressChanged(e); this.checkpointQuiet(); }
      if (this.selected() !== e) this.select(e);
      else this.inspector.updateReadings();
      return;
    }
    if (h.kind === 'post') {
      if (h.el) { this.select(h.el, { add: this.multi }); return; }
      if (h.wire) { this.selectWire(h.wire, { add: this.multi }); return; }
    }
    if (h.kind === 'wire') { this.selectWire(h.wire, { add: this.multi }); return; }
    if (h.kind === 'none') {
      if (this.selection.size || this.selWires.size) this.select(null);
      if (this.palette.isOpen) this.palette.close();
    }
  }

  checkpointQuiet() { this.scheduleAutosave(); }
}

function closestOnSeg(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  let t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + t * dx, a[1] + t * dy];
}
function onSeg(p, a, b) {
  const c = closestOnSeg(p[0], p[1], a, b);
  return Math.hypot(c[0] - p[0], c[1] - p[1]) < 0.5;
}
function area(e) { const [a, b, c, d] = e.worldBox(); return (c - a) * (d - b); }
