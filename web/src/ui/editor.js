// Schematic editor: canvas interaction, simulation loop and all editor chrome.

import { Simulator } from '../engine/sim.js';
import { fmtSI } from '../engine/units.js';
import { GRID, Element } from '../elements/index.js';
import { CircuitDoc, Wire, snap, route, simplify, makeElement } from './doc.js';
import { Renderer, WireGraph } from './render.js';
import { THEMES } from './theme.js';
import { icon } from './icons.js';
import { Scope, CH_COLORS } from './scope.js';
import { Inspector, Knob } from './inspector.js';
import { Palette } from './palette.js';
import { Analysis } from './analysis.js';
import { TheoremView } from './theorem-view.js';
import { Multimeter } from './meter.js';
import { store } from './store.js';
import { RmsTracker, acFrequency } from './rms.js';
import { WireHeat } from './wireheat.js';
import { WIRE_PRESETS, cableLabel } from '../elements/cables.js';
import { pickRoute, simpleRoutes, stretchWire, exitAt, wireContext, routeCost, routeScore } from './autoroute.js';

// two-terminal parts outside the Sources / Batteries / Diodes / Meters categories that still have a polarity
const POLAR_TYPES = new Set(['ecap', 'tantalum', 'supercap', 'photodiode', 'solar', 'pvmodule', 'thermocouple', 'led', 'irled', 'laser', 'piezosens', 'tacho', 'ph', 'varactor', 'lm4040', 'buzzer', 'piezobuzz', 'motor', 'dcgen', 'dcsep', 'dcshunt', 'dcseries', 'dualpsu', 'benchpsu']);
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
    this.q('.scrim').addEventListener('click', () => this.inspector.closeSheet());
    this.knob = new Knob(this, this.q('.knob'));
    this.palette = new Palette(this, this.q('.palette'));
    this.analysis = new Analysis(this, this.q('.analysis'));
    this.theorem = new TheoremView(this, this.q('.theorem'));
    this.meter = new Multimeter(this, this.q('.meter-card'));
    this.bindInput();
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    window.addEventListener('resize', () => this.onResize());
    // the board follows its own size (bars hiding in full screen, the scope opening, Android's
    // system bars going away) the moment layout changes, before the frame is painted
    if (window.ResizeObserver) new ResizeObserver(() => { if (this.app.current === 'editor') this.onResize(); }).observe(this.canvas);
    this.updateLayout();
  }

  q(s) { return this.root.querySelector(s); }
  get settings() { return this.app.settings; }
  get theme() { return THEMES[this.settings.theme] || THEMES.dark; }

  // ------------------------------------------------------------------ DOM
  buildDOM() {
    this.root.innerHTML = `
      <div class="ed-head">
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
        <button class="tb" data-a="fullscreen">${icon('fullscreen', 20)}<span>Full</span></button>
      </nav>
      </div>
      <div class="ed-main">
      <div class="scope-panel"></div>
      <div class="stage">
        <canvas class="board"></canvas>
        <div class="fs-rail">
          <button class="fs-btn" data-a="fullscreen" title="Exit full screen">${icon('fullscreenExit', 20)}</button>
          <button class="fs-btn fs-run" data-a="run" title="Run / Pause">${icon('play', 20)}</button>
          <button class="fs-btn" data-a="restart" title="Restart">${icon('reset', 19)}</button>
          <i class="fs-sep"></i>
          <button class="fs-btn" data-a="scope" title="Oscilloscope">${icon('scope', 20)}</button>
          <button class="fs-btn" data-a="meter" title="Multimeter">${icon('meter', 20)}</button>
          <button class="fs-btn" data-a="values" title="Labels">${icon('eye', 20)}</button>
          <i class="fs-sep"></i>
          <button class="fs-btn" data-a="multi" title="Select">${icon('select', 19)}</button>
          <button class="fs-btn" data-a="undo" title="Undo">${icon('undo', 19)}</button>
          <button class="fs-btn" data-a="fit" title="Fit">${icon('fit', 19)}</button>
          <button class="fs-btn fs-hide" data-a="fsui" title="Hide the tools">${icon('chevLeft', 19)}</button>
        </div>
        <button class="fs-handle" data-a="fsui" title="Show the tools">${icon('menu', 20)}</button>
        <button class="hud-status" data-a="speed"></button>
        <div class="mode-seg" role="radiogroup" aria-label="Board mode">
          <button class="mseg" data-a="mode-operate" data-mode="operate" role="radio" title="Operate: tap switches and buttons">${icon('hand', 16)}<span>Operate</span></button>
          <button class="mseg" data-a="mode-wire" data-mode="wire" role="radio" title="Wire: draw wires, move and edit parts">${icon('wire', 16)}<span>Wire</span></button>
        </div>
        <div class="hud-error"></div>
        <div class="hint"></div>
        <div class="selbar"></div>
        <div class="quickbar"></div>
        <div class="knob"></div>
        <div class="meter-card"></div>
        <button class="fab" data-a="add" title="Add component">${icon('plus', 28)}</button>
        <div class="toast"></div>
      </div>
      </div>
      <div class="scrim"></div>
      <div class="sheet inspector"></div>
      <div class="sheet palette"></div>
      <div class="overlay analysis"></div>
      <div class="overlay theorem"></div>
      <div class="menu more-menu"></div>
      <div class="popover speed-pop"></div>`;
    this.canvas = this.q('.board');
    this.root.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-a]');
      if (!b || !this.root.contains(b) || b.closest('.inspector,.palette,.analysis,.theorem,.meter-card,.more-menu,.speed-pop,.scope-panel,.selbar,.quickbar')) return;
      this.command(b.dataset.a, b);
      if (this.fsTools && b.closest('.fs-rail') && b.dataset.a !== 'fsui') this.showFsTools(true); // still in use: keep them up
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
      case 'fullscreen': this.setFullscreen(!this.fullscreen); break;
      case 'fsui': this.showFsTools(!this.fsTools); break;
      case 'add': this.palette.open(); break;
      case 'speed': this.openSpeed(); break;
      case 'mode-operate': this.setMode('operate', true); break;
      case 'mode-wire': this.setMode('wire', true); break;
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
    this.wireFrom = null;
    this.setMode('wire');
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
    this.boardRect = null; // a new circuit: nothing on the screen to hold still
    this.onResize();
    this.fit();
    this.noGlideUntil = performance.now() + 400; // the scope opening right after fits without a glide
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
    if (this.fullscreen) this.setFullscreen(false);
    this.setRunning(false);
    this.stopSound();
    this.palette.close(); this.analysis.close();
    this.closeMenu();
  }

  onResize() {
    this.updateLayout();
    const R = this.renderer, prev = this.boardRect;
    const cleared = R.resize();
    const r = this.canvas.getBoundingClientRect();
    this.boardRect = { left: r.left, top: r.top, width: r.width, height: r.height };
    if (prev && prev.width > 0 && r.width > 0 && (prev.left !== r.left || prev.top !== r.top || prev.width !== r.width || prev.height !== r.height)) {
      // The board changed size (full screen in / out, the scope, the system bars): first hold the
      // circuit exactly where it is on the screen, then glide it so the middle stays in the middle.
      // Without this it jumped by the height of the bars in one frame.
      const g = this.glide;
      const tx = (g ? g.tx : R.ox) + (r.width - prev.width) / 2, ty = (g ? g.ty : R.oy) + (r.height - prev.height) / 2;
      const fx = R.ox + prev.left - r.left, fy = R.oy + prev.top - r.top;
      const now = performance.now();
      this.glide = this.active && now >= (this.noGlideUntil || 0) ? { fx, fy, tx, ty, t0: now } : null;
      R.ox = this.glide ? fx : tx; R.oy = this.glide ? fy : ty;
    }
    this.scope.resize();
    this.dirtyDraw = true;
    // a resized canvas is blank: draw it again now so no empty frame is ever shown
    if (cleared && this.active && this.sim && this.graph) this.renderer.draw(this.drawState());
    if (this.scopeOpen) this.scope.draw();
  }

  /** Step the post-resize glide (see onResize). */
  stepGlide(now) {
    const g = this.glide, R = this.renderer;
    if (!g) return;
    const k = Math.min(1, Math.max(0, now - g.t0) / 320), e = 1 - Math.pow(1 - k, 3);
    R.ox = g.fx + (g.tx - g.fx) * e; R.oy = g.fy + (g.ty - g.fy) * e;
    this.dirtyDraw = true;
    if (k >= 1) this.glide = null;
  }

  /** Something else takes over the view (a finger, a zoom, Fit): put the glide at its end. */
  endGlide() {
    const g = this.glide;
    if (!g) return;
    this.renderer.ox = g.tx; this.renderer.oy = g.ty;
    this.glide = null;
    this.dirtyDraw = true;
  }

  /**
   * Phone sideways (landscape): the bars merge into one row and the
   * oscilloscope sits beside the circuit instead of above it (Settings →
   * Landscape & full screen), so the board keeps its height.
   */
  updateLayout() {
    const w = window.innerWidth, h = window.innerHeight;
    const wide = w > h * 1.15 && h <= 640;
    this.root.classList.toggle('wide', wide);
    this.root.classList.toggle('side-scope', wide && this.settings.scopeSide !== false);
  }

  /** Full screen, as in RaptiAuto: no bars, no system UI, a small tool rail on the left. */
  setFullscreen(on) {
    if (!!on === !!this.fullscreen) return;
    this.fullscreen = !!on;
    // the bars slide away (or back) while the circuit glides into place, all on one 320 ms curve
    clearTimeout(this.fsAnimT);
    this.root.classList.remove('fs-enter', 'fs-exit');
    void this.root.offsetWidth; // restart the animation when toggled quickly
    this.root.classList.add(this.fullscreen ? 'fs-enter' : 'fs-exit');
    this.fsAnimT = setTimeout(() => this.root.classList.remove('fs-enter', 'fs-exit'), 400);
    this.root.classList.toggle('fs', this.fullscreen);
    this.showFsTools(this.fullscreen, 2600); // shown at first, then out of the way
    // re-lay the board out in this same frame (the bars just appeared / went), so the circuit
    // never shows a frame at the old place; later changes (Android's own system bars sliding
    // away) reach onResize through the ResizeObserver
    this.onResize();
    this.app.bridge.setImmersive(this.fullscreen);
    this.haptic(8);
    this.updateToolbar();
    if (this.fullscreen && !store.flag('fsTip2')) { store.setFlag('fsTip2'); this.toast('Full screen: tap ☰ at the top left for the tools · Back exits'); }
  }

  /**
   * Full screen keeps the whole display for the board: the tool rail, the + button and the
   * time chip slide away and only a small ☰ handle stays. Tapping it brings them back; they
   * hide again after a few idle seconds or when the board is touched.
   */
  showFsTools(on, ms = 4500) {
    this.fsTools = !!on && !!this.fullscreen;
    this.root.classList.toggle('fs-ui', this.fsTools);
    clearTimeout(this.fsToolsT);
    if (this.fsTools) this.fsToolsT = setTimeout(() => this.showFsTools(false), ms);
  }

  fit() {
    this.glide = null;
    const top = 0;
    const bottom = 80;
    this.renderer.fit(this.doc.bounds(), 50, top, bottom);
    this.dirtyDraw = true;
  }

  // ------------------------------------------------------------- simulator
  simOptions() {
    const s = this.settings;
    return { method: s.method, initialDC: this.doc.simSettings.initialDC ?? s.initialDC, reltol: s.reltol, vntol: s.vntol, abstol: s.abstol, gmin: s.gmin, maxIter: s.maxIter };
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
    this.wireHeat = new WireHeat(this.doc, this.graph);
    this.resolveProbes();
    this.computeTiming();
    // one supply cycle of RMS history for the live labels and Auto meters
    const fac = acFrequency(this.doc.elements);
    this.sim.acPeriod = fac >= 0.5 ? 1 / fac : 0;
    this.rms = this.sim.acPeriod ? new RmsTracker(this.sim.acPeriod, this.sim.nodeCount, this.doc.elements.filter((e) => e.localPosts().length === 2)) : null;
    if (this.running) {
      this.startSim();
      this.scope.reset();
      this.showError();
    }
    this.inspector.updateReadings();
  }

  /** Start the transient from t = 0: parts and wires cold (burnt parts stay burnt). */
  startSim() {
    WireHeat.resetAll(this.doc);
    this.applyHeatClock();
    this.sim.start();
  }

  /**
   * Thermal effects (trips, cable heating, burning out) follow the real-time clock: the
   * waveforms are shown slowed down (speed s of simulated time per second), so heat runs
   * 1/s times faster than simulated time. 'fast' makes it 10× quicker still, 'sim' uses
   * simulated time throughout.
   */
  applyHeatClock() {
    const sim = this.sim, set = this.settings;
    if (!sim) return;
    const clock = set.heatClock || 'real';
    sim.heatScale = clock === 'sim' ? 1 : Math.max(1, (clock === 'fast' ? 10 : 1) / Math.max(1e-9, this.speed || 1));
    sim.damageOn = set.damage !== false;
  }

  /**
   * Rebuild the circuit while it runs, keeping time and every part's state (a wire just
   * burnt through or was repaired). Node voltages and branch currents carry over per part.
   */
  hotRebuild() {
    const old = this.sim;
    if (!old || !this.running || !old.ready) { this.topologyChanged(); return; }
    const keep = new Map();
    for (const e of this.doc.elements) {
      keep.set(e, { n: e.nodes.map((k) => old.v(k)), i: e.inodes.map((k) => old.v(k)), b: e.branches.map((k) => old.x[k]) });
    }
    const sim = new Simulator(this.simOptions()).build(this.doc.elements, this.doc.wires);
    for (const [e, s] of keep) {
      e.nodes.forEach((k, j) => { if (k > 0) sim.x[k - 1] = s.n[j]; });
      e.inodes.forEach((k, j) => { if (k > 0) sim.x[k - 1] = s.i[j] ?? 0; });
      e.branches.forEach((k, j) => { sim.x[k] = s.b[j] ?? 0; });
    }
    sim.xPrev.set(sim.x);
    Object.assign(sim, { t: old.t, acPeriod: old.acPeriod, mode: 'tran', started: true, beSteps: 2, dirty: true });
    this.sim = sim;
    this.applyHeatClock();
    this.graph = new WireGraph(this.doc);
    this.wireHeat = new WireHeat(this.doc, this.graph);
    this.resolveProbes();
    this.rms = sim.acPeriod ? new RmsTracker(sim.acPeriod, sim.nodeCount, this.doc.elements.filter((e) => e.localPosts().length === 2)) : null;
    this.dirtyDraw = true;
  }

  // ---------------------------------------------------------- damage
  /** Parts that burnt out / blew / were destroyed during the last steps. */
  onDamage(list) {
    const now = performance.now() / 1000;
    for (const e of list) {
      if (!e.damaged) continue;
      e.damaged.wall = now;
      this.toast(`🔥 ${e.name} ${e.constructor.title}: ${e.damaged.why}. Select it and tap Replace.`, 4500);
    }
    this.haptic(60);
    this.playBang();
    const sel = this.inspector.el;
    if (sel && list.includes(sel)) { this.inspector.renderQuick(); if (this.inspector.sheetOpen) this.inspector.render(); }
    this.renderSelBar();
    this.dirtyDraw = true;
    this.scheduleAutosave();
  }

  onWiresBurnt(list) {
    const now = performance.now() / 1000;
    for (const w of list) {
      w.burnt = true; w.burntWall = now;
      const h = w.heat;
      this.toast(`🔥 Wire burnt! ${cableLabel(w.cable)} (rated ${h.info.iz} A) carried ${fmtSI(h.irms, 'A', 3)}. ${h.why}. Select it and tap Repair, or use a thicker cable.`, 5000);
    }
    this.haptic(80);
    this.playBang();
    this.hotRebuild();
    this.renderSelBar();
    this.scheduleAutosave();
  }

  /** Fit a new part in place of a burnt one. */
  replacePart(e) {
    if (!e || !e.damaged) return;
    this.checkpoint();
    e.replace(this.sim);
    if (this.sim) this.sim.discontinuity();
    this.toast(`New ${e.constructor.title.toLowerCase()} fitted as ${e.name}`);
    this.haptic(12);
    this.inspector.renderQuick();
    if (this.inspector.sheetOpen) this.inspector.render();
    this.dirtyDraw = true;
  }

  /** Re-run a burnt wire (optionally with another cable). */
  repairWires(ws, cable) {
    const list = ws.filter((w) => w.burnt || cable !== undefined);
    if (!list.length) return;
    this.checkpoint();
    for (const w of list) {
      if (cable !== undefined) w.cable = cable ? { ...cable } : null;
      w.burnt = false; w.burntWall = null;
      if (w.heat) w.heat.reset();
    }
    if (this.running) this.hotRebuild(); else this.topologyChanged();
    this.renderSelBar();
    this.dirtyDraw = true;
  }

  /** Replace every burnt part and repair every burnt wire. */
  replaceAll() {
    const els = this.doc.elements.filter((e) => e.damaged), ws = this.doc.wires.filter((w) => w.burnt);
    if (!els.length && !ws.length) { this.toast('Nothing is burnt — every part is healthy'); return; }
    this.checkpoint();
    for (const e of els) e.replace(this.sim);
    for (const w of ws) { w.burnt = false; w.burntWall = null; if (w.heat) w.heat.reset(); }
    if (this.sim) this.sim.discontinuity();
    if (ws.length && this.running) this.hotRebuild(); else if (ws.length) this.topologyChanged();
    this.toast(`Replaced ${els.length} part${els.length === 1 ? '' : 's'}${ws.length ? ` and ${ws.length} wire${ws.length === 1 ? '' : 's'}` : ''}`);
    this.inspector.renderQuick?.();
    this.renderSelBar();
    this.dirtyDraw = true;
  }

  /** The cable new wires get (Settings → New wires). */
  defaultCable() {
    const k = this.settings.newWire ?? 'hw1.5';
    const c = k === 'custom' ? this.settings.newWireSpec : WIRE_PRESETS[k];
    return c ? { ...c } : null;
  }

  /** A short bang: a part blowing up. */
  playBang() {
    if (!this.settings.sound) return;
    this.ensureAudio();
    const ac = this.audio;
    if (!ac) return;
    try {
      const n = Math.round(ac.sampleRate * 0.35), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * Math.exp(-k / (ac.sampleRate * 0.045));
      const src = ac.createBufferSource(), gn = ac.createGain(), lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1800; gn.gain.value = 0.5;
      src.buffer = buf; src.connect(lp).connect(gn).connect(ac.destination); src.start();
    } catch { /* no audio */ }
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
    // a circuit may allow a longer step than the global cap (slow digital clocks): ss.maxStep
    dt = Math.min(dt, ss.maxStep || this.settings.maxStep || 1e-4);
    if (ss.dt) dt = ss.dt;
    this.dt = Math.max(1e-12, dt);
  }

  setRunning(on) {
    if (on) {
      this.rebuildNow(true);
      this.running = true;
      this.paused = false;
      this.startSim();
      this.scope.reset();
      this.showError();
      this.app.bridge.keepScreenOn(true);
      this.ensureAudio();
      this.setMode('operate');
    } else {
      this.running = false;
      this.paused = false;
      this.app.bridge.keepScreenOn(false);
      this.stopSound();
      for (const e of this.doc.elements) { e.postCurrents.fill?.(0); e.i = 0; }
      this.showError();
      this.setMode('wire');
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
    this.setMode(this.paused ? 'wire' : 'operate'); // Run → Operate, Pause → back to Wire
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
    this.applyHeatClock();
    let n = 0, burnt = null;
    while (sim.t < target - this.dt * 1e-6) {
      const t0s = sim.t;
      const ok = sim.step(Math.min(this.dt, target - sim.t) > this.dt * 0.01 ? this.dt : this.dt);
      n++;
      if (!ok) { this.showError(); this.paused = true; this.updateToolbar(); break; }
      if (this.rms) this.rms.sample(sim, sim.t - t0s);
      this.scope.sample(sim);
      if (this.meter.open) this.meter.sample(sim);
      if (this.wireHeat && this.wireHeat.active && (burnt = this.wireHeat.step(sim))) break;
      if ((n & 7) === 0 && performance.now() - t0 > budgetMs) break;
    }
    if (sim.damageLog.length) this.onDamage(sim.damageLog.splice(0));
    if (burnt) { this.onWiresBurnt(burnt); return 1; }
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
    this.stepGlide(ts);
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
    if (live || this.dirtyDraw || this.drag || this.wireFrom) {
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
      // while a selection box is dragged, what it would select is shown as selected
      selection: this.marqueePick ? this.marqueePick.els : this.selection, selWires: this.marqueePick ? this.marqueePick.wires : this.selWires, graph: this.graph, t, preview: this.preview,
      probes: this.doc.probes, hoverPost: this.hoverPost, wireFrom: this.wireFrom, marquee: this.marquee, meterProbes: this.meter.open ? this.meterProbes : null,
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
    const fr = this.q('.fs-rail .fs-run');
    fr.innerHTML = icon(playing ? 'pause' : 'play', 20);
    fr.classList.toggle('running', playing);
    this.q('.fs-rail [data-a=undo]').disabled = !this.undoStack.length;
    this.q('.fs-rail [data-a=scope]').classList.toggle('on', !!this.scopeOpen);
    this.q('.fs-rail [data-a=meter]').classList.toggle('on', this.meter.open);
    this.q('[data-a=undo]').disabled = !this.undoStack.length;
    this.q('[data-a=redo]').disabled = !this.redoStack.length;
    this.root.querySelectorAll('[data-a=multi]').forEach((b) => b.classList.toggle('on', this.multi));
    this.q('[data-a=scope]').classList.toggle('on', !!this.scopeOpen);
    this.q('[data-a=meter]').classList.toggle('on', this.meter.open);
    this.updateStatus();
  }

  updateHint() {
    const h = this.q('.hint');
    if (!this.doc.elements.length) {
      h.innerHTML = `<div class="hint-card">${icon('bolt', 28)}<b>Start building</b><span>Tap <b>+</b> to add components. Tap two terminals to draw a wire. Press <b>Run</b> to simulate.</span></div>`;
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
    const onlyWire = nEl === 0 && nW === 1, wiresOnly = nEl === 0 && nW > 0;
    const burnt = [...this.selWires].some((w) => w.burnt);
    const w1 = onlyWire ? [...this.selWires][0] : null;
    bar.innerHTML = `<span>${nEl ? nEl + ' part' + (nEl > 1 ? 's' : '') : ''}${nEl && nW ? ', ' : ''}${nW ? nW + ' wire' + (nW > 1 ? 's' : '') : ''}${w1 && !burnt ? ` · ${esc(cableLabel(w1.cable))}` : ''}</span>
      ${burnt ? `<button data-s="repair" class="hot">${icon('reset', 17)}Repair</button>` : ''}
      ${wiresOnly ? `<button data-s="cable">${icon('wire', 17)}Cable</button>` : ''}
      ${onlyWire && !burnt ? `<button data-s="probe">${icon('scope', 17)}Scope</button>` : ''}
      ${nEl ? `<button data-s="rotate">${icon('rotate', 17)}Rotate</button><button data-s="dup">${icon('copy', 17)}Copy</button>` : ''}
      <button data-s="del" class="danger">${icon('trash', 17)}Delete</button>
      <button data-s="x">${icon('x', 17)}</button>`;
    bar.classList.add('show');
    bar.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
      const s = b.dataset.s;
      if (s === 'probe') { const w = [...this.selWires][0]; this.addProbe({ kind: 'node', pos: this.wireProbePoint(w) }); }
      if (s === 'repair') this.repairWires([...this.selWires]);
      if (s === 'cable') this.inspector.openWires([...this.selWires]);
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

  /**
   * Board mode, as in RaptiAuto. Wire (the default while the circuit is not running): tap two
   * terminals to draw a wire, drag parts to move them, tap to select. Operate (switched on by Run):
   * tap switches, buttons and breakers to work them; terminals never start a wire, but parts can
   * still be dragged to move them (empty space pans). Either one can be picked at any time with the
   * switch on the board.
   */
  setMode(m, byUser) {
    const changed = m !== this.mode;
    this.mode = m;
    this.root.classList.toggle('mode-operate', m === 'operate');
    this.root.classList.toggle('mode-wire', m === 'wire');
    this.root.querySelectorAll('.mseg').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('active', on); b.setAttribute('aria-checked', on); });
    if (m === 'operate') this.cancelTapWire();
    if (!changed) return;
    this.dirtyDraw = true;
    if (byUser) {
      this.haptic(8);
      this.toast(m === 'operate' ? '✋ Operate: tap switches and buttons · drag parts to move them' : '🔌 Wire: tap two terminals to wire · drag parts to move them', 1800);
    }
  }

  /** Has this part something to work with a finger (a switch, button, breaker reset…)? */
  operable(e) { return !!e && (e.onTap !== Element.prototype.onTap || e.onPress !== Element.prototype.onPress); }

  setMulti(on) {
    const changed = on !== this.multi;
    this.multi = on;
    if (!on && this.selection.size + this.selWires.size > 1) this.select(null);
    this.updateToolbar();
    // the how-to is shown once; after that only a short confirmation
    if (!changed) return;
    if (on && !store.flag('selectHelp')) {
      store.setFlag('selectHelp');
      this.toast('Select: drag → right = window (parts fully inside) · drag ← left = crossing (parts it touches) · tap to add/remove');
    } else this.toast(on ? 'Select on' : 'Select off');
  }

  // ------------------------------------------------------------- editing
  makeEl(type, x, y) { return makeElement(type, x, y); }
  newDoc(name) { return new CircuitDoc(name); }

  addComponent(type) {
    // place it in the part of the board that is visible (above the open component menu)
    const palH = this.palette.isOpen ? this.palette.host.offsetHeight : 0;
    const visH = Math.max(120, this.renderer.ch - palH);
    const [cx, cy] = this.renderer.toWorld(this.renderer.cw / 2, palH ? visH * 0.55 : this.renderer.ch * 0.42);
    const e = makeElement(type, snap(cx), snap(cy));
    if (!e) return;
    e.onAdd?.(this.doc); // e.g. a new ladder contact follows the last coil already in the circuit
    const boxes = this.doc.elements.map((o) => o.worldBox());
    const pad = GRID;
    const ctx = this.placementCtx([e], [], true);
    const free = () => {
      const [a, b, c, d] = e.worldBox();
      return !boxes.some(([p, q, r, t]) => a - pad < r && c + pad > p && b - pad < t && d + pad > q) && !this.placementBlocked(ctx);
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
    // keep every part in view above the menu: zoom out (never in) and centre when they no longer fit
    if (palH) this.fitAbove(visH); else this.clearOfKnob(e);
    this.toast(palH ? `${e.name} added` : `${e.constructor.title} added — drag to move, tap two terminals to wire`);
  }

  /** On small screens the value knob can sit on top of a new, dropped or picked part: slide the board up a little. */
  clearOfKnob(e) {
    const host = this.knob?.host;
    if (!host || !host.classList.contains('open')) return;
    const R = this.renderer, cv = R.canvas || this.root.querySelector('canvas.board');
    if (!cv) return;
    const k = host.getBoundingClientRect(), c = cv.getBoundingClientRect();
    const [a, b, cc, d] = e.worldBox();
    const [x0, y0] = R.toScreen(a, b), [x1, y1] = R.toScreen(cc, d);
    const kx0 = k.left - c.left - 8, ky0 = k.top - c.top - 8;
    if (x1 < kx0 || y1 < ky0) return; // already clear
    const dy = Math.min(y1 - ky0, Math.max(0, y0 - 60)); // never above the top bar's room
    if (dy <= 0) return;
    const from = R.oy, t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 220), q = 1 - Math.pow(1 - t, 3);
      R.oy = from - dy * q; this.dirtyDraw = true;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Fit all parts into the board area above the open component menu if any are outside it. */
  fitAbove(visH) {
    const R = this.renderer, b = this.doc.bounds();
    if (!b) return;
    const m = 18, top = 58, x0 = m, x1 = R.cw - m, y0 = top, y1 = visH - m;
    const [sx0, sy0] = R.toScreen(b[0], b[1]), [sx1, sy1] = R.toScreen(b[2], b[3]);
    if (sx0 >= x0 && sx1 <= x1 && sy0 >= y0 && sy1 <= y1) return;
    const bw = Math.max(1, b[2] - b[0]), bh = Math.max(1, b[3] - b[1]);
    const sc = Math.max(0.45, Math.min(R.scale, (x1 - x0) / bw, (y1 - y0) / bh));
    const to = { scale: sc, ox: (x0 + x1) / 2 - ((b[0] + b[2]) / 2) * sc, oy: (y0 + y1) / 2 - ((b[1] + b[3]) / 2) * sc };
    // a short glide rather than a jump
    const from = { scale: R.scale, ox: R.ox, oy: R.oy }, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 220), e = 1 - Math.pow(1 - k, 3);
      R.scale = from.scale + (to.scale - from.scale) * e; R.ox = from.ox + (to.ox - from.ox) * e; R.oy = from.oy + (to.oy - from.oy) * e;
      this.dirtyDraw = true;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  setParam(el, key, val, live = false) {
    if (!live) this.checkpoint();
    el.p[key] = val;
    el.onParamChange(key);
    if (this.sim) this.sim.discontinuity();
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

  /**
   * What a move of `els` (and the selected `movedWires`) must not run into, taken before the
   * move. Parts never join by being dropped on each other: a part may not sit on another part,
   * and its terminals may not land on a terminal or wire they were not already connected to.
   * `fresh`: the parts are new (duplicate, add), so nothing counts as connected or overlapping yet.
   */
  placementCtx(els, movedWires = [], fresh = false) {
    const moving = new Set(els), moved = new Set(movedWires);
    const solid = (e) => e.constructor.type !== 'label'; // a text note is not a part
    const still = this.doc.elements.filter((e) => !moving.has(e) && solid(e));
    const stillBoxes = still.map((e) => [e, e.worldBox()]);
    const stillPosts = new Set(this.doc.elements.filter((e) => !moving.has(e)).flatMap((e) => e.getPosts()).map((p) => p[0] + ',' + p[1]));
    const touches = (w, p) => w.pts.some((q, i) => same(p, q) || (i && onSeg(p, w.pts[i - 1], q)));
    const stillPts = [...stillPosts].map((k) => k.split(',').map(Number));
    // terminals of the parts that stay put, and points of other wires, lying on a wire now
    // (a T-joint is a connection); the moving parts' own terminals do not count
    const onWire = (w) => {
      const mine = new Set(els.flatMap((e) => e.getPosts()).map((p) => p[0] + ',' + p[1]));
      const pts = stillPts.concat(...this.doc.wires.filter((o) => o !== w).map((o) => o.pts));
      return new Set(pts.filter((p) => touches(w, p)).map((p) => p[0] + ',' + p[1]).filter((k) => !mine.has(k)));
    };
    const wireHad = new Map(fresh ? [] : this.doc.wires.map((w) => [w, onWire(w)]));
    const before = new Map(), attached = new Map();
    for (const e of els) {
      const B = e.worldBox();
      before.set(e, new Set(fresh ? [] : stillBoxes.filter(([, b]) => boxesHit(B, b)).map(([o]) => o)));
      attached.set(e, e.getPosts().map((p) => new Set(fresh ? [] : this.doc.wires.filter((w) => touches(w, p)))));
    }
    return { els, solid, moved, stillBoxes, stillPosts, touches, before, attached, onWire, wireHad };
  }

  /** Why the parts in `c` may not stay where they are now ('part', 'terminal', 'wire'), or null. */
  placementBlocked(c, okWires = [], followed = []) {
    // a wire that follows the part must not be bent across a terminal it did not touch before
    for (const w of followed) {
      if (okWires.includes(w)) continue;
      const had = c.wireHad.get(w) || new Set();
      for (const k of c.onWire(w)) if (!had.has(k)) return 'route';
    }
    for (const e of c.els) {
      if (c.solid(e)) {
        const B = e.worldBox(), was = c.before.get(e);
        for (const [o, b] of c.stillBoxes) if (!was.has(o) && boxesHit(B, b)) return 'part';
      }
      const att = c.attached.get(e);
      const posts = e.getPosts();
      for (let k = 0; k < posts.length; k++) {
        const p = posts[k];
        if (c.stillPosts.has(p[0] + ',' + p[1])) return 'terminal';
        for (const w of this.doc.wires) {
          if (c.moved.has(w) || att[k]?.has(w) || okWires.includes(w)) continue;
          if (c.touches(w, p)) return 'wire';
        }
      }
    }
    return null;
  }

  /** Which terminals share a net, as a string: wires join their own points and anything lying on them. */
  connSig() {
    const par = new Map();
    const k = (p) => p[0] + ',' + p[1];
    const f = (x) => { if (!par.has(x)) par.set(x, x); while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
    const pts = [];
    for (const w of this.doc.wires) w.pts.forEach((p, i) => { pts.push(p); if (i) par.set(f(k(w.pts[i - 1])), f(k(p))); });
    for (const e of this.doc.elements) for (const p of e.getPosts()) { pts.push(p); f(k(p)); }
    for (const w of this.doc.wires) for (let i = 1; i < w.pts.length; i++) {
      for (const p of pts) if (onSeg(p, w.pts[i - 1], w.pts[i])) par.set(f(k(p)), f(k(w.pts[i])));
    }
    const lab = new Map();
    return this.doc.elements.map((e) => e.getPosts().map((p) => { const r = f(k(p)); if (!lab.has(r)) lab.set(r, lab.size); return lab.get(r); }).join('.')).join(' ');
  }

  /** Tidy the wires a move bent, unless tidying would join or split a net: then keep them as they are. */
  safeTidy(follow) {
    const keep = this.doc.wires.map((w) => [w, w.pts.map((p) => [...p])]);
    const sig = this.connSig();
    this.tidyWires(follow);
    if (this.connSig() !== sig) this.doc.wires = keep.map(([w, pts]) => { w.pts = pts; return w; });
  }

  blockedToast() {
    this.haptic(18);
    // explained once in the app's lifetime; after that the part just stops (with a buzz)
    if (store.flag('noOverlapTip')) return;
    store.setFlag('noOverlapTip');
    this.toast('Parts cannot sit on top of each other or join by touching — connect them with a wire');
  }


  duplicateSelection() {
    if (!this.selection.size && !this.selWires.size) return;
    this.checkpoint();
    const newEls = [], newWires = [];
    for (const e of this.selection) {
      const o = e.toJSON(); delete o.d; // a copy is a new, undamaged part
      const c = Element.fromJSON(o);
      this.doc.add(c); newEls.push(c);
    }
    const wirePts = [...this.selWires].map((w) => w.pts);
    for (const w of this.selWires) newWires.push(this.doc.addWire(w.pts.map((p) => [...p]), { cable: w.cable }));
    // the copy goes to the nearest free spot (down-right first), never on top of anything
    const home = newEls.map((c) => [c.x, c.y]), live = newWires.filter(Boolean);
    const ctx = this.placementCtx(newEls, live, true);
    const offsets = [];
    for (let r = 1; r <= 12; r++) offsets.push([r, r], [r, 0], [0, r], [r, -r], [-r, r], [-r, 0], [0, -r], [-r, -r]);
    for (const [ox, oy] of offsets) {
      const dx = ox * GRID * 2, dy = oy * GRID * 2;
      newEls.forEach((c, i) => { c.x = home[i][0] + dx; c.y = home[i][1] + dy; });
      live.forEach((w, i) => { w.pts = wirePts[i].map(([x, y]) => [x + dx, y + dy]); });
      if (!this.placementBlocked(ctx)) break;
    }
    this.doc.assignNames();
    this.selection = new Set(newEls); this.selWires = new Set(newWires.filter(Boolean));
    this.afterSelect();
    this.topologyChanged();
  }

  rotateSelection() { this.transformSelection((e) => { e.rot = (e.rot + 1) & 3; }); }

  /** Parts whose two terminals are not interchangeable (+/−, anode/cathode…). */
  static isPolar(e) {
    if (!e || e.localPosts().length !== 2) return false;
    const C = e.constructor;
    if (C.polar !== undefined) return C.polar;
    if (['Sources', 'Batteries', 'Diodes', 'Meters'].includes(C.category)) return true;
    return POLAR_TYPES.has(C.type);
  }

  /**
   * Reverse a polarised part in place: it turns half a turn about its centre so
   * its terminals swap, while the wires stay where they are.
   */
  reversePolarity() {
    const els = [...this.selection].filter((e) => Editor.isPolar(e));
    if (!els.length) return;
    this.checkpoint();
    for (const e of els) {
      const before = e.getPosts().map((p) => p.join(',')).sort().join('|');
      e.rot = (e.rot + 2) & 3;
      const after = e.getPosts().map((p) => p.join(',')).sort().join('|');
      if (after !== before) e.rot = (e.rot + 2) & 3; // terminals not symmetric about the centre: leave it
    }
    this.topologyChanged();
    this.haptic(8);
    this.toast(els.length === 1 ? `${els[0].name}: polarity reversed` : 'Polarity reversed');
  }
  flipSelection() { this.transformSelection((e) => { e.flip = !e.flip; }); }

  transformSelection(fn) {
    if (!this.selection.size) return;
    this.checkpoint();
    for (const e of this.selection) {
      const old = e.getPosts();
      this.splitAtJunctions();
      const ctx = this.placementCtx([e]);
      const fixed = new Set(this.doc.elements.filter((x) => x !== e).flatMap((x) => x.getPosts()).map((p) => p[0] + ',' + p[1]));
      const bridges = old.filter((p) => fixed.has(p[0] + ',' + p[1])).map((p) => new Wire([p, p]));
      this.doc.wires.push(...bridges);
      fn(e);
      const follow = this.followWires(new Map([[e, old]]));
      const why = this.placementBlocked(ctx, bridges, follow);
      if (why) {
        // turning it would put it on another part or join it to something: leave everything as it was
        const keep = [...this.selection].map((x) => this.doc.elements.indexOf(x));
        this.restoreFrom(this.undoStack.pop());
        this.updateToolbar();
        this.selection = new Set(keep.map((i) => this.doc.elements[i]).filter(Boolean));
        this.afterSelect();
        this.blockedToast(why);
        return;
      }
      this.safeTidy(follow);
      this.doc.wires = this.doc.wires.filter((w) => !bridges.includes(w) || !same(w.pts[0], w.pts[w.pts.length - 1]));
    }
    this.topologyChanged();
    this.haptic(6);
  }

  /**
   * Move wire endpoints that were attached to old post positions onto the new posts.
   * Wires keep the shape they were drawn with: only the segment next to a moved
   * end slides with it (a straight wire becomes the natural one- or two-bend
   * route). Returns the wires that changed, so the caller can tidy them.
   */
  followWires(oldPostsByEl, movedWires = new Set()) {
    const moves = [];
    for (const [e, old] of oldPostsByEl) {
      const now = e.getPosts();
      old.forEach((p, i) => { if (!same(p, now[i])) moves.push([p, now[i]]); });
    }
    const changed = [];
    if (!moves.length) return changed;
    for (const w of this.doc.wires) {
      if (movedWires.has(w)) continue;
      const a = w.pts[0], b = w.pts[w.pts.length - 1];
      // a zero-length bridge wire keeps its far end on the part that stays put
      const ma = moves.find(([p]) => same(p, a)), mb = same(a, b) ? null : moves.find(([p]) => same(p, b));
      if (!ma && !mb) continue;
      changed.push(w);
      const na = ma ? ma[1] : a, nb = mb ? mb[1] : b;
      if (ma && mb && na[0] - a[0] === nb[0] - b[0] && na[1] - a[1] === nb[1] - b[1]) {
        const dx = na[0] - a[0], dy = na[1] - a[1];
        w.pts = w.pts.map(([x, y]) => [x + dx, y + dy]);
        continue;
      }
      // a straight wire has no shape to keep: use the cleanest simple shape (cheap, no search while dragging)
      const simple = () => pickRoute(this.doc, simpleRoutes(na, nb, exitAt(this.doc, na), exitAt(this.doc, nb), a[1] === b[1]), { skipWires: new Set([w]), noSearch: true });
      let kept = stretchWire(w.pts, na, nb);
      if (kept) {
        // the kept shape may now run over another terminal — even the moved part's own other pin
        // (a RAM cell's Q wire through its Q̄) — and short them: then take the cleanest simple shape
        const ctx = wireContext(this.doc, new Set([w])), joins = (pts) => routeCost(ctx, simplify(pts), true);
        const bad = joins(kept);
        if (bad > 0) { const alt = simple(); if (alt && joins(alt) < bad) kept = alt; }
      }
      kept = kept || simple();
      w.pts = simplify(kept || [na, nb]);
      if (w.pts.length < 2) w.pts = [na, nb];
    }
    for (const p of this.doc.probes) {
      if (p.kind !== 'node' || !p.pos) continue;
      const m = moves.find(([q]) => same(q, p.pos));
      if (m) p.pos = [...m[1]];
    }
    return changed;
  }

  /**
   * Make every connection sit at a wire end: split wires wherever a terminal or
   * another wire's end touches them part-way along. Electrically nothing changes,
   * but a wire that is later re-shaped can then no longer drop a junction that
   * something else was hanging on.
   */
  splitAtJunctions(exclude) {
    const pts = [];
    for (const e of this.doc.elements) pts.push(...e.getPosts());
    for (const w of this.doc.wires) pts.push(w.pts[0], w.pts[w.pts.length - 1]);
    this.splitWiresAt(pts, exclude);
  }

  /** Split wires at the given points where they pass through them (not at an end), so each point becomes a wire end. */
  splitWiresAt(points, exclude = new Set()) {
    for (const w of [...this.doc.wires]) {
      if (exclude.has(w)) continue;
      let pts = w.pts;
      const pieces = [];
      for (;;) {
        let cut = -1, at = null;
        for (let k = 1; k < pts.length && cut < 0; k++) {
          const [a, b] = [pts[k - 1], pts[k]];
          let bd = Infinity; // the junction nearest the start of the segment comes first
          for (const p of points) {
            if (same(p, pts[0]) || same(p, pts[pts.length - 1]) || same(p, a)) continue;
            if (!same(p, b) && !onSeg(p, a, b)) continue;
            const d = Math.abs(p[0] - a[0]) + Math.abs(p[1] - a[1]);
            if (d < bd) { bd = d; cut = k; at = [p[0], p[1]]; }
          }
        }
        if (cut < 0) break;
        pieces.push(simplify([...pts.slice(0, cut), at]));
        pts = simplify([at, ...pts.slice(same(at, pts[cut]) ? cut + 1 : cut)]);
      }
      if (!pieces.length) continue;
      w.pts = pieces[0];
      for (const q of [...pieces.slice(1), pts]) if (q.length >= 2) this.doc.addWire(q, w);
    }
  }

  /**
   * Re-shape wires that now cut through a part or touch something they should
   * not. First each wire is fixed against the untouched rest of the circuit,
   * then again against each other, so two wires that moved together do not
   * push each other into a bad spot.
   */
  tidyWires(wires) {
    const list = wires.filter((w) => this.doc.wires.includes(w));
    const all = new Set(list);
    for (const pass of [0, 1, 2]) {
      for (const w of list) {
        const skip = pass === 0 ? all : new Set([w]);
        const ctx = wireContext(this.doc, skip);
        const bad = routeCost(ctx, w.pts) > 0;
        const a = w.pts[0], b = w.pts[w.pts.length - 1];
        const ea = exitAt(this.doc, a), eb = exitAt(this.doc, b);
        const r = pickRoute(this.doc, [w.pts, ...simpleRoutes(a, b, ea, eb, a[1] === w.pts[1][1])], { skipWires: skip, noSearch: !bad });
        if (!r) continue;
        // a clean stretched wire keeps its shape unless a simple one is clearly neater (e.g. a loop that is no longer needed)
        if (bad || routeScore(this.doc, ctx, r) < routeScore(this.doc, ctx, w.pts) - 0.75) {
          const t = simplify(r);
          if (t.length >= 2) w.pts = t;
        }
      }
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
          // + / − only make sense for two-terminal parts; other unnamed pins are numbered
          names[n] = e.name + (pins ? '.' + pins[i] : e.nodes.length === 2 ? (i === 0 ? '+' : '−') : e.nodes.length > 2 ? '.' + (i + 1) : '');
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
      ['book', 'theorem', 'Run with theorem'],
      ['save', 'save', 'Save to My Circuits'], ['copy', 'saveas', 'Save as copy'], ['edit', 'info', 'Circuit name & notes'],
      ['download', 'export', 'Export file (.rckt)'], ['upload', 'import', 'Open file…'], ['share', 'share', 'Share circuit'],
      ['code', 'netlist', 'SPICE netlist'], ['camera', 'shot', 'Export image (PNG)'], ['table', 'op', 'Operating point'],
      ['reset', 'repair', 'Replace burnt parts & wires'], ['tower', 'loadflow', 'Load flow analysis'],
      ['sliders', 'settings', 'Settings'], ['manual', 'manual', 'User manual'], ['help', 'help', 'Help & gestures'], ['trash', 'clear', 'Clear circuit'],
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
      case 'theorem': this.theorem.open(); break;
      case 'repair': this.replaceAll(); break;
      case 'loadflow': app.openLoadFlow(); break;
      case 'shot': app.bridge.saveFile(this.doc.name.replace(/\W+/g, '_') + '.png', 'image/png', this.screenshot(), true); break;
      case 'settings': app.openSettings(); break;
      case 'manual': app.openManual(); break;
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
        <li>${icon('wire', 18)}<span><b>Draw wires</b>: tap a terminal (small circle), then tap another terminal or wire — the wire is routed for you.</span></li>
        <li>${icon('hand', 18)}<span><b>Move</b> parts by dragging them – connected wires follow. Pinch to zoom, drag empty space to pan.</span></li>
        <li>${icon('play', 18)}<span><b>Run</b> to simulate: wires glow with voltage, yellow dots show current. Tap switches and buttons to operate them live.</span></li>
        <li>${icon('gauge', 18)}<span><b>Turn the knob</b> of a selected part to change its value while the circuit runs.</span></li>
        <li>${icon('scope', 18)}<span><b>Scope</b>: select a wire or part and tap Scope to probe it. Use FFT and XY views in the scope toolbar.</span></li>
        <li>${icon('bode', 18)}<span><b>Analysis</b>: Bode plots, DC sweeps, operating point and SPICE netlist export for research-grade work.</span></li>
      </ul>
      <div class="sheet-actions"><button data-x="manual">${icon('manual', 18)} Open the full user manual</button></div>`, (root, close) => {
      root.querySelector('[data-x=manual]').addEventListener('click', () => { close(); this.app.openManual(); });
    });
  }

  overlayOpen(n) { this.overlays.add(n); }
  overlayClosed(n) { this.overlays.delete(n); }

  /** Android back button. returns true if handled */
  back() {
    if (this.cancelTapWire()) return true;
    if (this.q('.speed-pop').classList.contains('open')) { this.q('.speed-pop').classList.remove('open'); return true; }
    if (this.q('.more-menu').classList.contains('open')) { this.closeMenu(); return true; }
    if (this.analysis.isOpen) { this.analysis.close(); return true; }
    if (this.theorem.isOpen) return this.theorem.back();
    if (this.palette.isOpen) { this.palette.close(); return true; }
    if (this.inspector.sheetOpen) { this.inspector.closeSheet(); return true; }
    if (this.selection.size || this.selWires.size) { this.select(null); return true; }
    if (this.meter.open) { this.toggleMeter(false); return true; }
    if (this.fullscreen) { this.setFullscreen(false); return true; }
    return false;
  }

  toast(msg, ms = 2200) {
    const t = this.q('.toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), ms);
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
      this.endGlide();
      const r = cv.getBoundingClientRect();
      this.renderer.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
      this.dirtyDraw = true;
    }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (!this.active || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') this.deleteSelection();
      else if (e.key === 'r') this.rotateSelection();
      else if (e.key === 'o') this.setMode('operate', true);
      else if (e.key === 'w') this.setMode('wire', true);
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
    this.zoomAnim = (this.zoomAnim || 0) + 1; // a finger on the board stops a double-tap zoom in flight
    this.endGlide();
    if (this.fsTools) this.showFsTools(false);
    if (this.pointers.size === 2) {
      this.cancelGesture();
      const [a, b] = [...this.pointers.values()];
      const R = this.renderer;
      this.gesture = { type: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]), s0: R.scale, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], w: R.toWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) };
      return;
    }
    if (this.pointers.size > 2) return;
    let hit = this.hitTest(sx, sy);
    // Operate: no wiring, so a finger near a part's terminal means the part itself
    if (this.mode === 'operate' && hit.kind === 'post' && hit.el) hit = { kind: 'element', el: hit.el };
    // Google Maps one-finger zoom: a second tap on the board that stays down, then slide
    const lt = this.lastTap, t0 = performance.now();
    if (lt && t0 - lt.t < 320 && Math.hypot(sx - lt.sx, sy - lt.sy) < 44 && (hit.kind === 'none' || hit.kind === 'wire')) {
      this.lastTap = null;
      this.gesture = { type: 'dzoom', sx, sy, s0: this.renderer.scale, w: this.renderer.toWorld(sx, sy), moved: false };
      return;
    }
    this.gesture = { type: 'pending', hit, sx, sy, w: this.renderer.toWorld(sx, sy), t0 };
    if (hit.kind === 'element' && hit.el.onPress && !this.multi && this.mode === 'operate') {
      if (hit.el.onPress()) { this.gesture.pressed = hit.el; this.pressChanged(hit.el); }
    }
    clearTimeout(this.lpT);
    this.lpT = setTimeout(() => this.longPress(), 480);
  }

  pressChanged(el) {
    if (this.sim) this.sim.discontinuity(); // a switch moved: damp the step, or cut inductors ring
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

  /**
   * AutoCAD-style box selection. Dragged left → right it is a *window*: only
   * parts and wires lying completely inside are picked. Dragged right → left it
   * is a *crossing* box: everything it touches is picked as well.
   */
  pickInBox(box) {
    const [x1, y1, x2, y2] = box, R = this.renderer;
    const crossing = x2 < x1;
    const [a, b] = R.toWorld(Math.min(x1, x2), Math.min(y1, y2)), [c, d] = R.toWorld(Math.max(x1, x2), Math.max(y1, y2));
    const inside = (x, y) => x >= a && x <= c && y >= b && y <= d;
    const els = new Set(this.doc.elements.filter((e) => {
      const [p, q, r, s] = e.worldBox();
      return crossing ? p <= c && r >= a && q <= d && s >= b : p >= a && q >= b && r <= c && s <= d;
    }));
    const wires = new Set(this.doc.wires.filter((w) => (crossing
      ? w.pts.some((pt, i) => i > 0 && segHitsBox(w.pts[i - 1], pt, a, b, c, d))
      : w.pts.every(([x, y]) => inside(x, y)))));
    return { els, wires, crossing };
  }

  cancelGesture() {
    clearTimeout(this.lpT);
    const g = this.gesture;
    if (g && g.pressed) { g.pressed.onRelease(); this.pressChanged(g.pressed); }
    if (g && g.type === 'move' && g.moved) this.topologyChanged();
    this.preview = null; this.marquee = null; this.marqueePick = null; this.drag = false;
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
    if (g.type === 'dzoom') {
      const dy = sy - g.sy;
      if (!g.moved && Math.abs(dy) < 6) return;
      if (!g.moved) { g.moved = true; this.haptic(6); }
      // slide down = zoom in, up = zoom out, around the point that was tapped
      R.scale = Math.min(6, Math.max(0.15, g.s0 * Math.exp(dy * 0.009)));
      R.ox = g.sx - g.w[0] * R.scale; R.oy = g.sy - g.w[1] * R.scale;
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
    if (h.kind !== 'none') this.cancelTapWire(); // panning keeps a pending tap-wire; other drags replace it
    if (h.kind === 'pin') { g.type = 'pin'; return; }
    // operating: a part still moves when dragged (Run must not lock the board), anything else pans
    if (this.mode === 'operate' && h.kind !== 'element') {
      g.type = this.multi && h.kind === 'none' ? 'marquee' : 'pan';
      if (g.type === 'marquee') this.marquee = [g.sx, g.sy, g.sx, g.sy];
      g.ox = this.renderer.ox; g.oy = this.renderer.oy;
      return;
    }
    // wires are drawn by tapping two terminals; dragging a terminal moves its part, dragging a wire pans
    if (h.kind === 'post' && h.el) { h.kind = 'element'; }
    if (h.kind === 'element' || (h.kind === 'wire' && this.multi)) {
      g.type = 'move';
      let els, wires;
      if (h.kind === 'element' && this.selection.has(h.el)) { els = [...this.selection]; wires = [...this.selWires]; } else if (h.kind === 'element') { this.select(h.el); els = [h.el]; wires = []; } else { els = [...this.selection]; wires = this.selWires.has(h.wire) ? [...this.selWires] : [h.wire]; }
      g.undoSnap = this.snapshot();
      // a terminal sitting in the middle of a wire (a T-junction) must drag a wire end
      // with it, or the part would be torn off the wire
      this.splitAtJunctions(new Set(wires));
      g.els = els.map((e) => ({ e, x: e.x, y: e.y, posts: e.getPosts() }));
      g.wires = wires.map((w) => ({ w, pts: w.pts.map((p) => [...p]) }));
      // every wire's shape as the drag began (a cable or burnt wire is not a bare point list in the snapshot)
      g.wirePts = this.doc.wires.map((w) => w.pts.map((p) => [...p]));
      // terminals touching a part that stays put: bridge them with a wire once the move starts
      const moving = new Set(els);
      const fixed = new Set(this.doc.elements.filter((e) => !moving.has(e)).flatMap((e) => e.getPosts()).map((p) => p[0] + ',' + p[1]));
      g.bridges = els.flatMap((e) => e.getPosts()).filter((p) => fixed.has(p[0] + ',' + p[1])).map((p) => ({ p: [...p], w: new Wire([p, p]) }));
      g.place = this.placementCtx(els, wires);
      g.dx = 0; g.dy = 0; g.okDx = 0; g.okDy = 0;
      return;
    }
    g.type = this.multi && h.kind === 'none' ? 'marquee' : 'pan';
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
      case 'move': {
        const dx = snap(wx - g.w[0]), dy = snap(wy - g.w[1]);
        if (dx === g.dx && dy === g.dy) break;
        g.dx = dx; g.dy = dy; g.moved = true;
        this.applyMove(g, dx, dy);
        const why = (dx || dy) && this.placementBlocked(g.place, (g.bridges || []).map((b) => b.w), g.follow || []);
        if (why) {
          // the part stops at the last free spot until the finger reaches free space again
          this.applyMove(g, g.okDx, g.okDy);
          if (g.blocked !== why) { g.blocked = why; this.blockedToast(why); }
        } else { g.okDx = dx; g.okDy = dy; g.blocked = null; }
        break;
      }
      case 'marquee':
        this.marquee = [g.sx, g.sy, sx, sy];
        this.marqueePick = this.pickInBox(this.marquee);
        this.dirtyDraw = true;
        break;
      default:
    }
  }

  /** Put the dragged parts (and selected wires) at offset dx, dy from where the drag began. */
  applyMove(g, dx, dy) {
    this.doc.wires.forEach((w, i) => { if (g.wirePts[i]) w.pts = g.wirePts[i].map((p) => [...p]); });
    for (const o of g.els) { o.e.x = o.x + dx; o.e.y = o.y + dy; }
    const moved = new Set();
    for (const o of g.wires) { o.w.pts = o.pts.map(([x, y]) => [x + dx, y + dy]); moved.add(o.w); }
    for (const b of g.bridges || []) { b.w.pts = [[...b.p], [...b.p]]; if (!this.doc.wires.includes(b.w)) this.doc.wires.push(b.w); }
    g.follow = this.followWires(new Map(g.els.map((o) => [o.e, o.posts])), moved);
    this.graph = new WireGraph(this.doc);
    this.dirtyDraw = true;
  }

  onUp(ev, cancelled) {
    this.pointers.delete(ev.pointerId);
    clearTimeout(this.lpT);
    const g = this.gesture;
    if (!g) return;
    if (g.type === 'pinch') { if (this.pointers.size === 0) this.gesture = null; else this.gesture = { type: 'done' }; return; }
    if (g.type === 'dzoom') { // a plain double tap (no slide) zooms in one step, like Maps
      this.gesture = null;
      if (!g.moved && !cancelled) this.animateZoom(g.sx, g.sy, 2);
      return;
    }
    if (g.pressed) { g.pressed.onRelease(); this.pressChanged(g.pressed); }
    if (cancelled) { this.cancelGesture(); return; }
    switch (g.type) {
      case 'pending':
        this.tap(g);
        this.lastTap = g.hit.kind === 'none' || g.hit.kind === 'wire' ? { t: performance.now(), sx: g.sx, sy: g.sy } : null;
        break;
      case 'move':
        // a bridge wire whose part came back to where it was is not needed
        for (const b of g.bridges || []) if (b.w.pts.length < 2 || same(b.w.pts[0], b.w.pts[b.w.pts.length - 1])) this.doc.wires = this.doc.wires.filter((w) => w !== b.w);
        if (g.moved) {
          this.safeTidy(g.follow || []);
          this.undoStack.push(g.undoSnap); this.redoStack = []; this.updateToolbar();
          this.topologyChanged();
          // dropped under the knob it opened: it could not be picked up again
          if (this.selected()) this.clearOfKnob(this.selected());
        }
        break;
      case 'marquee': {
        const pick = this.pickInBox(this.marquee || [0, 0, 0, 0]);
        this.marqueePick = null;
        if (!this.multi) this.setMulti(true);
        this.selection = pick.els; this.selWires = pick.wires;
        this.afterSelect();
        if (pick.els.size + pick.wires.size) this.toast(`${pick.crossing ? 'Crossing' : 'Window'}: ${pick.els.size} part${pick.els.size === 1 ? '' : 's'}${pick.wires.size ? `, ${pick.wires.size} wire${pick.wires.size === 1 ? '' : 's'}` : ''} selected`);
        break;
      }
      default:
    }
    this.preview = null; this.marquee = null; this.marqueePick = null; this.hoverPost = null; this.drag = false;
    this.gesture = null;
    this.dirtyDraw = true;
  }

  /** smooth zoom by `factor` around a screen point (double tap) */
  animateZoom(sx, sy, factor) {
    const R = this.renderer, s0 = R.scale, s1 = Math.min(6, Math.max(0.15, s0 * factor)), w = R.toWorld(sx, sy), t0 = performance.now();
    const id = this.zoomAnim = (this.zoomAnim || 0) + 1;
    const step = (now) => {
      if (id !== this.zoomAnim) return; // a newer gesture took over
      const k = Math.min(1, (now - t0) / 220), e = 1 - Math.pow(1 - k, 3);
      R.scale = s0 * Math.pow(s1 / s0, e);
      R.ox = sx - w[0] * R.scale; R.oy = sy - w[1] * R.scale;
      this.dirtyDraw = true;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  tap(g) {
    const h = g.hit;
    this.lastTapWorld = g.w;
    // EveryCircuit-style wiring: tap a terminal, then tap another terminal (or a wire) to connect them
    const operate = this.mode === 'operate';
    if (!this.multi && this.wireFrom) { this.finishTapWire(h, g.w); return; }
    if (!this.multi && h.kind === 'post' && !operate) { this.startTapWire(h.pos); return; }
    if (h.kind === 'element') {
      const e = h.el;
      if (this.multi) { this.select(e, { add: true }); return; }
      if (operate) {
        // work the switch / button; it stays unselected so the circuit is not covered by bars
        if (g.pressed) return;
        if (e.onTap && e.onTap()) { this.pressChanged(e); this.checkpointQuiet(); if (this.selected() === e) this.inspector.updateReadings(); return; }
      } else if (this.operable(e)) this.modeHint();
      if (this.selected() !== e) { this.select(e); this.clearOfKnob(e); } else this.inspector.updateReadings();
      return;
    }
    if (h.kind === 'post') {
      if (h.el) { this.select(h.el, { add: this.multi }); return; }
      if (h.wire) { this.selectWire(h.wire, { add: this.multi }); return; }
    }
    if (h.kind === 'wire') { this.selectWire(h.wire, { add: this.multi }); return; }
    if (h.kind === 'none') {
      if (this.selection.size || this.selWires.size) this.select(null);
    }
  }

  checkpointQuiet() { this.scheduleAutosave(); }

  /** A switch tapped in Wire mode: say once in a while how to work it. */
  modeHint() {
    const now = performance.now();
    if (now - (this.modeHintT || -1e9) < 8000) return;
    this.modeHintT = now;
    this.toast('Wire mode: tap ✋ Operate (top right) to flip switches · Run turns it on', 2600);
  }

  /** First tap of a tap-tap wire: remember the terminal and mark it on the board. */
  startTapWire(pos) {
    this.wireFrom = [...pos];
    if (this.selection.size || this.selWires.size) this.select(null);
    this.haptic(8);
    this.dirtyDraw = true;
    // the how-to is shown once; after that the pulsing ring says enough
    if (!store.flag('tapWireHelp')) { store.setFlag('tapWireHelp'); this.toast('Now tap another terminal to connect · tap empty space to cancel'); }
  }

  cancelTapWire() {
    if (!this.wireFrom) return false;
    this.wireFrom = null;
    this.dirtyDraw = true;
    return true;
  }

  /** Second tap: a terminal, a point on a wire, or a part (its nearest terminal). Empty space cancels. */
  finishTapWire(h, w) {
    const a = this.wireFrom;
    let b = null;
    if (h.kind === 'post') b = [...h.pos];
    else if (h.kind === 'wire') b = [snap(h.pos[0]), snap(h.pos[1])];
    else if (h.kind === 'element') b = this.magnet(w[0], w[1], a);
    if (!b || same(a, b)) { this.cancelTapWire(); return; }
    const hFirst = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    const smart = pickRoute(this.doc, simpleRoutes(a, b, exitAt(this.doc, a), exitAt(this.doc, b), hFirst));
    let pts = simplify(smart || route(a, b, hFirst));
    if (pts.length < 2) pts = [a, b];
    this.checkpoint();
    this.doc.addWire(pts, { cable: this.defaultCable() });
    this.wireFrom = null;
    this.topologyChanged();
    this.haptic(12);
  }
}

function closestOnSeg(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  let t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + t * dx, a[1] + t * dy];
}
/** Do two part boxes overlap (more than touching edge to edge)? */
function boxesHit(a, b) { return a[0] + 2 < b[2] && a[2] - 2 > b[0] && a[1] + 2 < b[3] && a[3] - 2 > b[1]; }
function onSeg(p, a, b) {
  const c = closestOnSeg(p[0], p[1], a, b);
  return Math.hypot(c[0] - p[0], c[1] - p[1]) < 0.5;
}
function area(e) { const [a, b, c, d] = e.worldBox(); return (c - a) * (d - b); }

/** Does segment p–q touch the box [a, b]–[c, d]? (Liang–Barsky clipping) */
function segHitsBox(p, q, a, b, c, d) {
  let t0 = 0, t1 = 1;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  for (const [pp, qq] of [[-dx, p[0] - a], [dx, c - p[0]], [-dy, p[1] - b], [dy, d - p[1]]]) {
    if (pp === 0) { if (qq < 0) return false; continue; }
    const r = qq / pp;
    if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}
