// Multichannel oscilloscope with measurements, FFT spectrum and XY mode.

import { fmtSI } from '../engine/units.js';
import { icon } from './icons.js';

export const CH_COLORS = ['#facc15', '#22d3ee', '#f472b6', '#4ade80', '#fb923c', '#a78bfa'];
const N = 4096;

const PRE = 0.1; // triggered view: share of the screen before the trigger point
const DIV_X = 10, DIV_Y = 8;
const HEAD = 40; // chip / button band above the graticule
const GUT_L = 22, GUT_R = 6; // left gutter holds the 0-level markers
const ROW = 14; // line height of the readout table (matches the CSS)
const FONT = '10px JetBrains Mono, ui-monospace, monospace';

/** smallest 1-2-5 step that is ≥ x */
function nice125(x) {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(x))), m = x / e;
  return (m <= 1.0001 ? 1 : m <= 2.0001 ? 2 : m <= 5.0001 ? 5 : 10) * e;
}

/**
 * A real-scope scale for [lo, hi] over `divs` divisions: a 1-2-5 value per
 * division and a centre on a whole division, so grid lines fall on round values.
 */
function niceScale(lo, hi, divs, unit) {
  const level = Math.max(Math.abs(lo), Math.abs(hi));
  if (hi - lo < Math.max(level * 2e-3, 1e-12)) { // steady level: show it against ground, as at a sensible V/div
    if (level < 1e-6) return { d: unit === 'A' ? 1e-3 : 1, c: 0 }; // nothing there (solver dust): a plain default range
    const d = nice125(level / (divs * 0.8));
    return { d, c: Math.sign(lo + hi) * Math.min(3, Math.floor(divs / 2) - 1) * d }; // ground one division above the bottom (below the top if negative)
  }
  // the smallest 1-2-5 step that holds the signal with a little room at both edges
  const mid = (hi + lo) / 2, half = divs / 2;
  let d = nice125((hi - lo) / divs);
  for (let k = 0; k < 12; k++, d = step125(d, 1)) {
    const m = d * 0.15;
    for (const c of [Math.round(mid / d) * d, Math.floor(mid / d) * d, Math.ceil(mid / d) * d]) {
      if (lo >= c - half * d + m && hi <= c + half * d - m) return { d, c };
    }
  }
  return { d, c: Math.round(mid / d) * d };
}

/**
 * Scales for several units with their 0 lines on one shared grid line: picks
 * the grid line (z divisions above the bottom) and a 1-2-5 step per unit so
 * that every signal fits and fills its share of the screen as well as possible.
 */
function alignedScale(range) {
  const M = 0.15; // room left at the edges, in divisions
  let best = null;
  for (let z = 0; z <= DIV_Y; z++) {
    const d = {};
    let cost = Math.abs(z - DIV_Y / 2) * 1e-3, ok = true;
    for (const [u, r] of range) {
      const up = r.mx > 1e-9 ? r.mx / (DIV_Y - z - M) : 0, dn = r.mn < -1e-9 ? -r.mn / (z - M) : 0;
      if ((r.mx > 1e-9 && DIV_Y - z - M <= 0) || (r.mn < -1e-9 && z - M <= 0)) { ok = false; break; }
      const need = Math.max(up, dn);
      d[u] = need > 0 ? nice125(need) : u === 'A' ? 1e-3 : 1;
      if (need > 0) cost += d[u] / Math.max(r.mx - r.mn, Math.abs(r.mx), Math.abs(r.mn));
    }
    if (ok && (!best || cost < best.cost)) best = { z, d, cost };
  }
  return best || { z: DIV_Y / 2, d: Object.fromEntries([...range].map(([u, r]) => [u, nice125(Math.max(Math.abs(r.mn), Math.abs(r.mx), 1e-9) / 3.8)])) };
}

/** the next 1-2-5 step up (dir 1) or down (dir −1) from x */
function step125(x, dir) {
  const n = nice125(x * 0.999);
  if (dir > 0) return nice125(n * 1.001);
  const e = Math.pow(10, Math.floor(Math.log10(n) + 1e-9)), m = Math.round(n / e);
  return (m === 1 ? 0.5 : m === 2 ? 1 : 2) * e;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TRIG_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h6l6-12h6"/><path d="M9.5 10.5L12 8l2.5 2.5" stroke-width="1.6"/></svg>';

export class Scope {
  constructor(editor, host) {
    this.ed = editor;
    this.host = host;
    this.channels = []; // {probe, buf: Float64Array, sc: {d, c}}
    this.tbuf = new Float64Array(N);
    this.head = 0; this.count = 0;
    this.window = 0.1;
    this.lastT = -Infinity;
    this.mode = 'time';
    this.frozen = false;
    this.trigOn = false; // free-running by default; the trigger button holds periodic signals still on CH1 rising edges
    this.ac = false; // AC coupling: the mean of each trace is removed
    this.meas = 'basic'; // readout set: basic (pp, rms, f) or timing (mean, duty, rise, fall, phase)
    this.cursor = null; // x (CSS px) of the touch read-out cursor
    this.scales = new Map(); // unit → shared scale of all channels in that unit
    this.build();
  }

  build() {
    this.host.innerHTML = `
      <div class="scope-head">
        <div class="scope-chips"></div>
        <div class="scope-tools">
          <button class="icon-btn sm" data-a="zin" title="Zoom in time">${icon('plus', 18)}</button>
          <button class="icon-btn sm" data-a="zout" title="Zoom out time"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
          <button class="icon-btn sm" data-a="trig" title="Trigger on CH1 (steady picture)">${TRIG_SVG}</button>
          <button class="scope-mode sm" data-a="cpl" title="Input coupling: DC / AC">DC</button>
          <button class="scope-mode sm" data-a="meas" title="Measurements: basic / timing">Σ</button>
          <button class="scope-mode" data-a="mode" title="Time / FFT / XY">TIME</button>
          <button class="icon-btn sm" data-a="freeze" title="Freeze">${icon('pause', 16)}</button>
          <button class="icon-btn sm" data-a="csv" title="Export CSV">${icon('download', 18)}</button>
        </div>
      </div>
      <canvas class="scope-canvas"></canvas>
      <div class="scope-meas"></div>
      <div class="scope-empty">Select a component or wire and tap <b>Scope</b> to probe it.</div>`;
    this.cv = this.host.querySelector('canvas');
    this.ctx = this.cv.getContext('2d');
    this.chipsEl = this.host.querySelector('.scope-chips');
    this.measEl = this.host.querySelector('.scope-meas');
    this.emptyEl = this.host.querySelector('.scope-empty');
    this.host.querySelector('.scope-tools').addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'zin') { this.window = Math.max(1e-8, step125(this.window / DIV_X, -1) * DIV_X); this.userWindow = true; }
      if (a === 'zout') { this.window = Math.min(1e4, step125(this.window / DIV_X, 1) * DIV_X); this.userWindow = true; }
      if (a === 'trig') {
        this.trigOn = !this.trigOn; b.classList.toggle('on', this.trigOn);
        this.ed.toast(this.trigOn ? 'Trigger on: CH1 rising edge holds the picture still' : 'Trigger off: free-running (roll)');
      }
      if (a === 'mode') {
        this.mode = this.mode === 'time' ? 'fft' : this.mode === 'fft' ? (this.channels.length >= 2 ? 'xy' : 'time') : 'time';
        b.textContent = this.mode.toUpperCase();
        this.ed.toast(this.mode === 'fft' ? 'Spectrum (FFT) view' : this.mode === 'xy' ? 'XY view: CH1 → X, CH2 → Y' : 'Time view');
      }
      if (a === 'cpl') {
        this.ac = !this.ac; b.textContent = this.ac ? 'AC' : 'DC'; b.classList.toggle('on', this.ac); this.scales.clear();
        this.ed.toast(this.ac ? 'AC coupling: the DC level is blocked, only the variation is shown' : 'DC coupling: the full signal is shown');
      }
      if (a === 'meas') {
        this.meas = this.meas === 'basic' ? 'timing' : 'basic'; b.classList.toggle('on', this.meas === 'timing'); this.lastMeas = null;
        this.ed.toast(this.meas === 'timing' ? 'Timing: mean, duty cycle, rise / fall time (10–90 %), phase vs CH1' : 'Basic: now, V/div, peak-peak, RMS, frequency');
      }
      if (a === 'freeze') { this.frozen = !this.frozen; b.innerHTML = icon(this.frozen ? 'play' : 'pause', 16); b.classList.toggle('on', this.frozen); }
      if (a === 'csv') this.exportCSV();
      this.draw();
    });
    // one finger: read-out cursor; two fingers: pinch the timebase
    const pts = new Map();
    let d0 = 0, w0 = 0;
    const cssX = (e) => e.clientX - this.cv.getBoundingClientRect().left;
    this.cv.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, e.clientX);
      try { this.cv.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      if (pts.size === 2) { const v = [...pts.values()]; d0 = Math.abs(v[0] - v[1]); w0 = this.window; this.cursor = null; } else if (pts.size === 1) this.cursor = cssX(e);
      this.draw();
    });
    this.cv.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, e.clientX);
      if (pts.size === 2) { const v = [...pts.values()]; const d = Math.abs(v[0] - v[1]); if (d0 > 10 && d > 10) { this.window = Math.min(1e4, Math.max(1e-9, (w0 * d0) / d)); this.userWindow = true; } } else if (pts.size === 1 && this.cursor !== null) this.cursor = cssX(e);
      this.draw();
    });
    const up = (e) => {
      if (pts.size === 2 && this.userWindow) this.window = nice125(this.window / DIV_X * 0.999) * DIV_X; // a pinch settles on a 1-2-5 time/div
      pts.delete(e.pointerId);
      if (!pts.size) { this.cursor = null; this.draw(); }
    };
    this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', up);
    this.cv.addEventListener('wheel', (e) => { e.preventDefault(); this.window = Math.min(1e4, Math.max(1e-8, step125(this.window / DIV_X, e.deltaY > 0 ? 1 : -1) * DIV_X)); this.userWindow = true; this.draw(); }, { passive: false });
  }

  setAutoWindow(w) { if (!this.userWindow) this.window = nice125(w / DIV_X) * DIV_X; } // a real-scope 1-2-5 time/div

  setProbes(probes) {
    const old = new Map(this.channels.map((c) => [c.probe.id, c]));
    this.channels = probes.map((p) => old.get(p.id) || { probe: p, buf: new Float64Array(N) });
    this.channels.forEach((c) => { c.probe = probes.find((p) => p.id === c.probe.id); });
    if (this.mode === 'xy' && this.channels.length < 2) { this.mode = 'time'; this.host.querySelector('[data-a=mode]').textContent = 'TIME'; }
    this.renderChips();
  }

  renderChips() {
    this.chipsEl.innerHTML = this.channels.map((c, i) => `<button class="chip" data-i="${i}" style="--c:${c.probe.color}"><i>${i + 1}</i>${esc(c.probe.label)}<span>${icon('x', 12)}</span></button>`).join('');
    this.chipsEl.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => this.ed.removeProbe(this.channels[+b.dataset.i].probe)));
    this.emptyEl.style.display = this.channels.length ? 'none' : '';
    this.lastMeas = null;
  }

  reset() { this.head = 0; this.count = 0; this.lastT = -Infinity; this.scales.clear(); for (const c of this.channels) c.buf.fill(0); }

  sample(sim) {
    if (this.frozen || !this.channels.length) return;
    const t = sim.t;
    if (t - this.lastT < this.window / 900) return;
    this.lastT = t;
    const h = this.head;
    this.tbuf[h] = t;
    for (const c of this.channels) c.buf[h] = this.ed.probeValue(c.probe);
    this.head = (h + 1) % N;
    this.count = Math.min(N, this.count + 1);
  }

  /** buffer indices with t0 ≤ t ≤ t1, oldest → newest */
  visible(t0, t1 = Infinity) {
    const out = [];
    for (let k = this.count; k >= 1; k--) {
      const idx = (this.head - k + N) % N, t = this.tbuf[idx];
      if (t >= t0 && t <= t1) out.push(idx);
    }
    return out;
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.cv.width !== w) this.cv.width = w; // reassigning clears it: only when the size really changed
    if (this.cv.height !== h) this.cv.height = h;
    this.w = r.width; this.h = r.height; this.dpr = dpr;
  }

  stats(c, idxs) {
    let mn = Infinity, mx = -Infinity, s = 0, s2 = 0, n = 0;
    for (const i of idxs) { const v = c.buf[i]; mn = Math.min(mn, v); mx = Math.max(mx, v); s += v; s2 += v * v; n++; }
    if (!n) return null;
    const avg = s / n, rms = Math.sqrt(s2 / n);
    // frequency via rising crossings of the mean with hysteresis
    const hy = (mx - mn) * 0.1;
    let armed = false, first = null, last = null, cnt = 0;
    for (const i of idxs) {
      const v = c.buf[i];
      if (v < avg - hy) armed = true;
      if (armed && v > avg + hy) { armed = false; const t = this.tbuf[i]; if (first === null) first = t; else { last = t; cnt++; } }
    }
    const freq = cnt > 0 && mx - mn > 1e-9 ? cnt / (last - first) : 0;
    return { mn, mx, avg, rms, freq, pp: mx - mn, ...this.timing(c, idxs, mn, mx) };
  }

  /**
   * Pulse timing over the window: duty cycle (time above the 50 % level),
   * average 10–90 % rise and 90–10 % fall times, and the times of the rising
   * 50 % crossings (interpolated) for the phase between channels.
   */
  timing(c, idxs, mn, mx) {
    const pp = mx - mn;
    if (!(pp > 1e-9) || idxs.length < 4) return { duty: null, rise: null, fall: null, xs: [] };
    const l10 = mn + 0.1 * pp, l50 = mn + 0.5 * pp, l90 = mn + 0.9 * pp, hy = 0.05 * pp;
    const at = (i0, i1, lvl) => { const v0 = c.buf[i0], v1 = c.buf[i1], t0 = this.tbuf[i0], t1 = this.tbuf[i1]; return v1 === v0 ? t1 : t0 + ((lvl - v0) / (v1 - v0)) * (t1 - t0); };
    let hiT = 0, tot = 0, prev = null, st = null, t10 = null, t90 = null;
    const rises = [], falls = [], xs = [];
    for (const i of idxs) {
      const v = c.buf[i];
      if (prev !== null) {
        const dt = this.tbuf[i] - this.tbuf[prev];
        tot += dt; if ((c.buf[prev] + v) / 2 > l50) hiT += dt;
        const pv = c.buf[prev];
        if (pv < l10 && v >= l10) t10 = at(prev, i, l10);
        if (pv < l50 && v >= l50 && st !== 'hi') xs.push(at(prev, i, l50));
        if (pv < l90 && v >= l90) { if (t10 !== null) rises.push(at(prev, i, l90) - t10); t10 = null; }
        if (pv > l90 && v <= l90) t90 = at(prev, i, l90);
        if (pv > l10 && v <= l10) { if (t90 !== null) falls.push(at(prev, i, l10) - t90); t90 = null; }
        if (v > l50 + hy) st = 'hi'; else if (v < l50 - hy) st = 'lo';
      }
      prev = i;
    }
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    return { duty: tot > 0 ? hiT / tot : null, rise: mean(rises), fall: mean(falls), xs };
  }

  /** phase of channel st relative to ref (degrees, −180…180) from their rising crossings */
  phase(ref, st) {
    if (!ref || !st || !ref.freq || !ref.xs.length || !st.xs.length) return null;
    const T = 1 / ref.freq, tr = ref.xs[ref.xs.length - 1];
    let best = null;
    for (const t of st.xs) { const d = t - tr; if (best === null || Math.abs(d) < Math.abs(best)) best = d; }
    let ph = (-best / T) * 360;
    ph = ((ph + 180) % 360 + 360) % 360 - 180;
    return ph;
  }

  /**
   * Latest rising crossing of CH1 through the middle of its swing that still
   * leaves a full screen after it, like a scope in auto-trigger mode. Only used
   * for signals that repeat within the screen; anything else rolls.
   */
  findTrigger(tNow) {
    const c = this.channels[0], W = this.window;
    const idxs = this.visible(tNow - 4 * W);
    if (idxs.length < 16) return null;
    let mn = Infinity, mx = -Infinity;
    // level from the last screen only, so a start-up transient does not skew it
    for (const i of idxs) if (this.tbuf[i] >= tNow - W) { const v = c.buf[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const pp = mx - mn;
    if (!(pp > 1e-12) || pp < Math.max(Math.abs(mn), Math.abs(mx)) * 1e-3) return null; // flat
    const lvl = (mn + mx) / 2, hy = pp * 0.08;
    let armed = false, pt = 0, pv = 0, prev = -1;
    const xs = [];
    for (const i of idxs) {
      const t = this.tbuf[i], v = c.buf[i];
      if (v < lvl - hy) armed = true;
      else if (armed && v >= lvl && prev >= 0) { xs.push(pv < lvl ? pt + ((lvl - pv) / (v - pv)) * (t - pt) : t); armed = false; }
      pt = t; pv = v; prev = i;
    }
    const lim = tNow - W * (1 - PRE);
    let k = xs.length - 1;
    while (k >= 0 && xs[k] > lim) k--;
    if (k < 1 || xs[k] - xs[k - 1] > 1.5 * W) return null;
    return { t: xs[k], level: lvl };
  }

  /**
   * Keep a scale while the signal still fits it, so the picture does not jump
   * about while it runs; a better fit (smaller signal, settled level) is taken
   * once it has lasted a moment.
   */
  hold(key, want, fits, same) {
    const g = this.scales.get(key) || {};
    this.scales.set(key, g);
    if (!g.sc || !fits(g.sc)) { g.sc = want; g.refitT = 0; return want; }
    if (!same(g.sc, want)) {
      const now = performance.now();
      if (!g.refitT) g.refitT = now;
      else if (now - g.refitT > 450) { g.sc = want; g.refitT = 0; }
    } else g.refitT = 0;
    return g.sc;
  }

  /**
   * Scales for the channels on screen. Channels of the same unit share one
   * scale (all the volts one V/div and one 0 V line, set by the biggest
   * signal). When volts and amps are shown together each unit keeps its own
   * per-division value but both 0 lines sit on the same grid line, so a
   * voltage and its current read against one zero.
   */
  scalesFor(range) {
    const close = (a, b, d) => Math.abs(a - b) <= d * 0.01;
    if (range.size === 1) {
      const [[u, r]] = [...range];
      const eps = (sc) => sc.d * 0.02;
      return new Map([[u, this.hold(u, niceScale(r.mn, r.mx, DIV_Y, u),
        (sc) => r.mn >= sc.c - 4 * sc.d - eps(sc) && r.mx <= sc.c + 4 * sc.d + eps(sc),
        (a, b) => close(a.d, b.d, a.d) && close(a.c, b.c, a.d))]]);
    }
    const units = [...range.keys()];
    const fitsAt = (z, u, d) => { const r = range.get(u), e = d * 0.02; return r.mn >= -z * d - e && r.mx <= (DIV_Y - z) * d + e; };
    const j = this.hold(units.join('+'), alignedScale(range),
      (sc) => units.every((u) => fitsAt(sc.z, u, sc.d[u])),
      (a, b) => a.z === b.z && units.every((u) => close(a.d[u], b.d[u], a.d[u])));
    return new Map(units.map((u) => [u, { d: j.d[u], c: (DIV_Y / 2 - j.z) * j.d[u], z: j.z }]));
  }

  /** [left, top, right, bottom] of the graticule in CSS px */
  plotRect() {
    const W = this.w, H = this.h;
    const rows = !this.channels.length ? 0 : this.mode === 'xy' ? 1 : this.channels.length + 1;
    const meas = rows ? rows * ROW + 9 : 0;
    const bot = Math.min(H - 6, Math.max(HEAD + 90, H - meas - 6));
    return [GUT_L, HEAD, W - GUT_R, bot];
  }

  /** the screen: bezel, CRT-style face, 10 × 8 divisions with fine ticks on the centre axes */
  drawGraticule(L, T, R, B, divX = DIV_X, divY = DIV_Y) {
    const { ctx } = this;
    const W = this.w, H = this.h;
    ctx.fillStyle = '#04070d';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient((L + R) / 2, (T + B) / 2, 0, (L + R) / 2, (T + B) / 2, Math.hypot(R - L, B - T) / 1.6);
    g.addColorStop(0, '#0c1628'); g.addColorStop(1, '#060b15');
    ctx.fillStyle = g;
    ctx.fillRect(L, T, R - L, B - T);
    const dx = (R - L) / divX, dy = (B - T) / divY;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120,165,230,0.11)';
    ctx.beginPath();
    for (let i = 1; i < divX; i++) { const x = Math.round(L + i * dx) + 0.5; ctx.moveTo(x, T); ctx.lineTo(x, B); }
    for (let j = 1; j < divY; j++) { const y = Math.round(T + j * dy) + 0.5; ctx.moveTo(L, y); ctx.lineTo(R, y); }
    ctx.stroke();
    // centre axes with a tick every fifth of a division
    const cx = Math.round(L + (divX / 2) * dx) + 0.5, cy = Math.round(T + (divY / 2) * dy) + 0.5;
    ctx.strokeStyle = 'rgba(140,180,240,0.26)';
    ctx.beginPath();
    ctx.moveTo(cx, T); ctx.lineTo(cx, B); ctx.moveTo(L, cy); ctx.lineTo(R, cy);
    for (let i = 1; i < divX * 5; i++) { if (i % 5 === 0) continue; const x = Math.round(L + (i * dx) / 5) + 0.5; ctx.moveTo(x, cy - 3); ctx.lineTo(x, cy + 3); }
    for (let j = 1; j < divY * 5; j++) { if (j % 5 === 0) continue; const y = Math.round(T + (j * dy) / 5) + 0.5; ctx.moveTo(cx - 3, y); ctx.lineTo(cx + 3, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140,180,240,0.30)';
    ctx.strokeRect(Math.round(L) + 0.5, Math.round(T) + 0.5, Math.round(R - L) - 1, Math.round(B - T) - 1);
  }

  /** a trace with a soft phosphor glow under a crisp core */
  glowStroke(col, width = 1.8) {
    const { ctx } = this;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col; ctx.globalAlpha = 0.14; ctx.lineWidth = width + 5; ctx.stroke();
    ctx.globalAlpha = 0.28; ctx.lineWidth = width + 2; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1; ctx.lineWidth = width; ctx.stroke();
  }

  /** small label on a dark plate so it stays legible over traces */
  plate(txt, x, y, col, align = 'left') {
    const { ctx } = this;
    const w = ctx.measureText(txt).width, x0 = align === 'right' ? x - w : x;
    ctx.fillStyle = 'rgba(4,7,13,0.78)';
    roundRect(ctx, x0 - 4, y - 10, w + 8, 14, 4); ctx.fill();
    ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(txt, x0, y);
  }

  draw() {
    const { ctx } = this;
    if (!this.w) this.resize();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = FONT; ctx.textBaseline = 'alphabetic';
    if (this.mode === 'xy' && this.channels.length >= 2) return this.drawXY();
    if (this.mode === 'fft') return this.drawFFT();
    const [L, T, R, B] = this.plotRect();
    this.drawGraticule(L, T, R, B);
    this.plots = null;
    if (!this.channels.length || !this.count) { this.setMeas(''); return; }

    const Wt = this.window, pw = R - L, ph = B - T;
    const tNow = this.tbuf[(this.head - 1 + N) % N];
    const trig = this.trigOn ? this.findTrigger(tNow) : null;
    const t0 = trig ? trig.t - Wt * PRE : tNow - Wt, t1 = t0 + Wt;
    const idxs = this.visible(t0, t1);
    if (!idxs.length) { this.setMeas(''); return; }
    const kx = pw / Wt;
    const plots = [], rows = [];
    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, pw, ph); ctx.clip();
    // channels of the same unit share one scale and one 0 line, set by the biggest signal
    const sts = this.channels.map((c) => this.stats(c, idxs));
    const range = new Map();
    const offs = sts.map((st) => (this.ac && st ? st.avg : 0)); // AC coupling removes each trace's mean
    this.channels.forEach((c, ci) => {
      const st = sts[ci], u = c.probe.unit;
      if (!st) return;
      const r = range.get(u), mn = st.mn - offs[ci], mx = st.mx - offs[ci];
      if (r) { r.mn = Math.min(r.mn, mn); r.mx = Math.max(r.mx, mx); r.chans.push(ci); } else range.set(u, { mn, mx, chans: [ci] });
    });
    const scaleOf = this.scalesFor(range);
    this.channels.forEach((c, ci) => {
      const st = sts[ci];
      if (!st) return;
      const { d, c: mid } = scaleOf.get(c.probe.unit);
      const lo = mid - 4 * d, ky = ph / (8 * d), col = c.probe.color, off = offs[ci];
      const yOf = (v) => B - (v - off - lo) * ky;
      // min/max decimation: at most two vertices per pixel column keeps the path short
      ctx.beginPath();
      let col0 = null, mn = 0, mx = 0, started = false;
      const flush = () => {
        if (col0 === null) return;
        const ymn = yOf(mn + off), ymx = yOf(mx + off);
        if (!started) { ctx.moveTo(col0, ymn); started = true; } else ctx.lineTo(col0, ymn);
        if (ymx !== ymn) ctx.lineTo(col0, ymx);
      };
      for (const i of idxs) {
        const x = Math.round((L + (this.tbuf[i] - t0) * kx) * 2) / 2, v = c.buf[i] - off;
        if (x !== col0) { flush(); col0 = x; mn = v; mx = v; } else { if (v < mn) mn = v; if (v > mx) mx = v; }
      }
      flush();
      this.glowStroke(col);
      const li = idxs[idxs.length - 1];
      if (!trig) { // rolling: a bright dot rides the newest value
        const ly = yOf(c.buf[li]);
        ctx.beginPath(); ctx.arc(L + (this.tbuf[li] - t0) * kx, ly, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
      }
      plots.push({ c, ci, lo, ky, d, mid, yOf, st, off });
      const u = c.probe.unit;
      if (this.meas === 'timing') {
        const phs = ci > 0 ? this.phase(sts[0], st) : null, pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);
        rows.push([col, ci + 1, c.probe.label, fmtSI(st.avg, u, 4), pct(st.duty), st.rise != null ? fmtSI(st.rise, 's', 3) : '—', st.fall != null ? fmtSI(st.fall, 's', 3) : '—', ci === 0 ? 'ref' : phs == null ? '—' : `${phs.toFixed(1)}°`]);
      } else rows.push([col, ci + 1, c.probe.label, fmtSI(c.buf[li] - off, u, 4), fmtSI(d, u, 2), fmtSI(st.pp, u, 3), fmtSI(this.ac ? Math.sqrt(Math.max(0, st.rms * st.rms - st.avg * st.avg)) : st.rms, u, 3), st.freq ? fmtSI(st.freq, 'Hz', 4) : '—']);
    });
    ctx.restore();
    this.plots = { list: plots, t0, kx, L, T, R, B, trig, idxs, tNow };

    // the 0 level in the left gutter (one line for every unit; an arrow at the edge when it is off screen)
    const groups = [...range].map(([u, r]) => ({ u, sc: scaleOf.get(u), chans: r.chans }));
    const colOf = (g) => (g.chans.length === 1 ? this.channels[g.chans[0]].probe.color : '#e2e8f0');
    const g0 = groups[0], y0 = B - (0 - (g0.sc.c - 4 * g0.sc.d)) * (ph / (8 * g0.sc.d));
    ctx.font = 'bold 9px ui-sans-serif, system-ui, sans-serif';
    this.marker(L - 2, Math.max(T + 7, Math.min(B - 7, y0)), groups.length > 1 ? '#e2e8f0' : colOf(g0), '0', y0 < T + 2 ? -1 : y0 > B - 2 ? 1 : 0);
    ctx.font = FONT;
    if (groups.length === 1) { // top / bottom value of the screen at the right edge
      this.plate(fmtSI(g0.sc.c + 4 * g0.sc.d, g0.u, 3), R - 6, T + 14, colOf(g0), 'right');
      this.plate(fmtSI(g0.sc.c - 4 * g0.sc.d, g0.u, 3), R - 6, B - 6, colOf(g0), 'right');
    } else { // volts and amps: values every other division, first unit along the left edge, the next along the right
      const z = g0.sc.z;
      groups.forEach((g, gi) => {
        for (let k = 1; k < DIV_Y; k++) {
          if ((k - z) % 2) continue;
          const y = B - (k * ph) / DIV_Y + 3.5, txt = fmtSI((k - z) * g.sc.d, g.u, 3);
          if (gi === 0) this.plate(txt, L + 6, y, colOf(g)); else this.plate(txt, R - 6, y + (gi - 1) * 15, colOf(g), 'right');
        }
      });
    }
    // trigger point (top edge) and level (right edge)
    if (trig && plots[0]) {
      const x = L + PRE * pw, col = plots[0].c.probe.color, ty = plots[0].yOf(trig.level);
      ctx.fillStyle = '#e8eef8';
      ctx.beginPath(); ctx.moveTo(x - 5, T + 1); ctx.lineTo(x + 5, T + 1); ctx.lineTo(x, T + 7); ctx.closePath(); ctx.fill();
      if (ty > T && ty < B) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(R, ty); ctx.lineTo(R + GUT_R, ty - 4); ctx.lineTo(R + GUT_R, ty + 4); ctx.closePath(); ctx.fill(); }
    }
    // status: timebase, trigger state
    const status = `${fmtSI(Wt / DIV_X, 's', 3)}/div${this.ac ? ' · AC' : ''}`;
    const mode = this.frozen ? 'STOP' : trig ? 'TRIG ↑ CH1' : this.trigOn ? 'AUTO' : 'ROLL';
    const sw = ctx.measureText(status).width;
    this.plate(status, L + 6, B - 6, '#dbe5f5');
    this.plate(mode, L + 6 + sw + 12, B - 6, this.frozen ? '#f87171' : trig ? '#4ade80' : '#94a3b8');
    if (this.cursor !== null) this.drawCursor();
    this.setMeas(this.table(this.meas === 'timing' ? ['CH', 'mean', 'duty', 'rise', 'fall', 'φ'] : ['CH', 'now', '/div', 'pp', this.ac ? 'ac rms' : 'rms', 'f'], rows));
  }

  /** ground tag pointing at a scale's 0 level (off = −1 above, +1 below the screen) */
  marker(xr, y, col, txt, off) {
    const { ctx } = this;
    const w = Math.max(14, ctx.measureText(txt).width + 6), h = 13, x = xr - w - 4;
    ctx.fillStyle = col;
    roundRect(ctx, x, y - h / 2, w, h, 3); ctx.fill();
    ctx.beginPath();
    if (!off) { ctx.moveTo(x + w - 1, y - 4); ctx.lineTo(xr, y); ctx.lineTo(x + w - 1, y + 4); } else { const s = off < 0 ? -1 : 1; ctx.moveTo(xr - 3, y - 3 * s); ctx.lineTo(xr + 1, y - 3 * s); ctx.lineTo(xr - 1, y + 3 * s); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#05080f'; ctx.textAlign = 'center';
    ctx.fillText(txt, x + w / 2, y + 3.5);
    ctx.textAlign = 'left';
  }

  /** touch read-out: a vertical line with every channel's value at that instant */
  drawCursor() {
    const P = this.plots;
    if (!P || !P.list.length) return;
    const { ctx } = this;
    const x = Math.max(P.L, Math.min(P.R, this.cursor));
    const t = P.t0 + (x - P.L) / P.kx;
    // nearest sample
    let best = P.idxs[0], bd = Infinity;
    for (const i of P.idxs) { const dd = Math.abs(this.tbuf[i] - t); if (dd < bd) { bd = dd; best = i; } }
    ctx.save();
    ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(230,238,250,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, P.T); ctx.lineTo(Math.round(x) + 0.5, P.B); ctx.stroke();
    ctx.restore();
    const ref = P.trig ? P.trig.t : P.tNow;
    const lines = [[`t ${fmtSI(this.tbuf[best] - ref, 's', 4)}`, '#e8eef8']];
    for (const p of P.list) {
      const v = p.c.buf[best], y = p.yOf(v), col = p.c.probe.color, vo = v - (p.off || 0);
      if (y >= P.T && y <= P.B) { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = '#05080f'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke(); }
      lines.push([`${p.ci + 1}  ${fmtSI(vo, p.c.probe.unit, 4)}`, col]);
    }
    const bw = Math.max(...lines.map(([s]) => ctx.measureText(s).width)) + 16, bh = lines.length * 14 + 8;
    const bx = x + 12 + bw > P.R ? x - 12 - bw : x + 12, by = P.T + 8;
    ctx.fillStyle = 'rgba(8,13,24,0.92)'; ctx.strokeStyle = 'rgba(140,180,240,0.35)'; ctx.lineWidth = 1;
    roundRect(ctx, bx, by, bw, bh, 7); ctx.fill(); ctx.stroke();
    lines.forEach(([s, col], k) => { ctx.fillStyle = col; ctx.fillText(s, bx + 8, by + 16 + k * 14); });
  }

  /** readout table: a header row, then one row per channel */
  table(head, rows) {
    if (!rows.length) return '';
    const cls = ['nm', 'v', 'v', 'v', 'v rms', 'v'];
    let h = head.map((x, i) => `<span class="h ${cls[i] || 'v'}">${x}</span>`).join('');
    for (const [col, num, name, ...vals] of rows) {
      h += `<span class="nm" style="--c:${col}"><i>${num}</i>${esc(name)}</span>` + vals.map((v, i) => `<span class="${cls[i + 1] || 'v'}">${v}</span>`).join('');
    }
    return `<div class="sm-grid c${head.length}">${h}</div>`;
  }

  /** measurement text changes the DOM, so throttle it to 4 Hz */
  setMeas(html) {
    const now = performance.now();
    if (html === this.lastMeas || (now - (this.measT || 0) < 250 && html && this.lastMeas)) return;
    this.measT = now; this.lastMeas = html;
    this.measEl.innerHTML = html;
  }

  drawXY() {
    const { ctx } = this;
    const [L, T, R, B] = this.plotRect();
    this.drawGraticule(L, T, R, B);
    if (!this.count) { this.setMeas(''); return; }
    const tNow = this.tbuf[(this.head - 1 + N) % N];
    const idxs = this.visible(tNow - this.window);
    const [a, b] = this.channels;
    const sa = this.stats(a, idxs), sb = this.stats(b, idxs);
    if (!sa || !sb) return;
    const xs = niceScale(sa.mn, sa.mx, DIV_X, a.probe.unit), ys = niceScale(sb.mn, sb.mx, DIV_Y, b.probe.unit);
    const kx = (R - L) / (DIV_X * xs.d), ky = (B - T) / (DIV_Y * ys.d);
    const x0 = xs.c - 5 * xs.d, y0 = ys.c - 4 * ys.d;
    ctx.save(); ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
    ctx.beginPath();
    let f = true;
    for (const i of idxs) {
      const x = L + (a.buf[i] - x0) * kx, y = B - (b.buf[i] - y0) * ky;
      if (f) { ctx.moveTo(x, y); f = false; } else ctx.lineTo(x, y);
    }
    this.glowStroke('#4ade80', 1.6);
    const li = idxs[idxs.length - 1];
    if (li !== undefined) { ctx.beginPath(); ctx.arc(L + (a.buf[li] - x0) * kx, B - (b.buf[li] - y0) * ky, 3.2, 0, Math.PI * 2); ctx.fillStyle = '#d9fbe6'; ctx.fill(); }
    ctx.restore();
    ctx.font = FONT;
    this.plate(`X ${fmtSI(xs.d, a.probe.unit, 2)}/div`, L + 6, B - 6, a.probe.color);
    this.plate(`Y ${fmtSI(ys.d, b.probe.unit, 2)}/div`, L + 6, T + 14, b.probe.color);
    this.setMeas(`<div class="sm-line"><span style="color:${a.probe.color}">X = ${esc(a.probe.label)}</span> ${fmtSI(sa.mn, a.probe.unit, 3)} … ${fmtSI(sa.mx, a.probe.unit, 3)} &nbsp; <span style="color:${b.probe.color}">Y = ${esc(b.probe.label)}</span> ${fmtSI(sb.mn, b.probe.unit, 3)} … ${fmtSI(sb.mx, b.probe.unit, 3)}</div>`);
  }

  drawFFT() {
    const { ctx } = this;
    const [L, T, R, B] = this.plotRect();
    const pw = R - L, ph = B - T;
    ctx.fillStyle = '#04070d'; ctx.fillRect(0, 0, this.w, this.h);
    const g = ctx.createLinearGradient(0, T, 0, B);
    g.addColorStop(0, '#0c1628'); g.addColorStop(1, '#060b15');
    ctx.fillStyle = g; ctx.fillRect(L, T, pw, ph);
    if (!this.channels.length || !this.count) { this.frameFFT(L, T, R, B, 0, 0); this.setMeas(''); return; }
    const tNow = this.tbuf[(this.head - 1 + N) % N];
    const idxs = this.visible(tNow - this.window);
    let n = 1;
    while (n * 2 <= idxs.length && n < 2048) n *= 2;
    if (n < 32) { this.frameFFT(L, T, R, B, 0, 0); return; }
    const sel = idxs.slice(idxs.length - n);
    const dtS = (this.tbuf[sel[n - 1]] - this.tbuf[sel[0]]) / (n - 1);
    const fs = 1 / dtS, half = n / 2;
    const fmin = fs / n, fmax = fs / 2, lmin = Math.log10(fmin), lspan = Math.log10(fmax) - lmin;
    const xOf = (f) => L + ((Math.log10(f) - lmin) / lspan) * pw;
    const yOf = (db) => T + (-db / 100) * ph;
    this.frameFFT(L, T, R, B, fmin, fmax, xOf);
    const rows = [];
    ctx.save(); ctx.beginPath(); ctx.rect(L, T, pw, ph); ctx.clip();
    this.channels.forEach((c, ci) => {
      const re = new Float64Array(n), im = new Float64Array(n);
      let mean = 0;
      for (let k = 0; k < n; k++) mean += c.buf[sel[k]];
      mean /= n;
      for (let k = 0; k < n; k++) re[k] = (c.buf[sel[k]] - mean) * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (n - 1)));
      fft(re, im);
      const mag = new Float64Array(half);
      let pk = 1;
      for (let k = 1; k < half; k++) { mag[k] = (Math.hypot(re[k], im[k]) * 4) / n; if (mag[k] > mag[pk]) pk = k; }
      const peak = mag[pk] || 1e-12, col = c.probe.color;
      ctx.beginPath();
      for (let k = 1; k < half; k++) {
        const x = xOf(k * fmin), y = yOf(20 * Math.log10(Math.max(mag[k] / peak, 1e-5)));
        if (k === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      // soft fill under the first channel's spectrum
      if (ci === 0) {
        ctx.save(); ctx.lineTo(xOf((half - 1) * fmin), B); ctx.lineTo(xOf(fmin), B); ctx.closePath();
        ctx.fillStyle = col; ctx.globalAlpha = 0.13; ctx.fill(); ctx.restore();
        ctx.beginPath();
        for (let k = 1; k < half; k++) { const x = xOf(k * fmin), y = yOf(20 * Math.log10(Math.max(mag[k] / peak, 1e-5))); if (k === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      }
      this.glowStroke(col, 1.5);
      // peak marker
      const px = xOf(pk * fmin), py = yOf(0);
      ctx.beginPath(); ctx.arc(px, py + 1, 3.2, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.font = FONT;
      const lbl = fmtSI(pk * fmin, 'Hz', 3), lw = ctx.measureText(lbl).width;
      this.plate(lbl, Math.min(R - lw - 6, Math.max(L + 6, px + 8)), py + 30 + ci * 15, col);
      rows.push([col, ci + 1, c.probe.label, fmtSI(pk * fmin, 'Hz', 4), fmtSI(mag[pk], c.probe.unit, 3)]);
    });
    ctx.restore();
    this.plate(`FFT ${n} pts · ${fmtSI(fs / n, 'Hz', 3)} res`, R - 6, T + 14, '#94a3b8', 'right');
    this.setMeas(this.table(['CH', 'peak f', 'amplitude'], rows));
  }

  /** FFT frame: dB lines every 20 dB and a line at every decade of frequency */
  frameFFT(L, T, R, B, fmin, fmax, xOf) {
    const { ctx } = this;
    const ph = B - T;
    ctx.font = FONT; ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120,165,230,0.11)';
    ctx.beginPath();
    for (let j = 1; j < 5; j++) { const y = Math.round(T + (j * ph) / 5) + 0.5; ctx.moveTo(L, y); ctx.lineTo(R, y); }
    const decades = [];
    if (xOf && fmax > fmin) {
      for (let e = Math.ceil(Math.log10(fmin)); e <= Math.floor(Math.log10(fmax)); e++) {
        const x = Math.round(xOf(10 ** e)) + 0.5; ctx.moveTo(x, T); ctx.lineTo(x, B); decades.push([x, 10 ** e]);
        for (let m = 2; m < 10; m++) { const f = m * 10 ** e; if (f > fmin && f < fmax) { const xm = Math.round(xOf(f)) + 0.5; ctx.moveTo(xm, B - 4); ctx.lineTo(xm, B); } }
      }
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140,180,240,0.30)';
    ctx.strokeRect(Math.round(L) + 0.5, Math.round(T) + 0.5, Math.round(R - L) - 1, Math.round(B - T) - 1);
    ctx.fillStyle = 'rgba(170,190,225,0.6)'; ctx.textAlign = 'right';
    ctx.font = '9px JetBrains Mono, ui-monospace, monospace';
    for (let j = 0; j < 5; j++) ctx.fillText(j ? `-${j * 20}` : 'dB', L - 3, Math.max(T + 8, T + (j * ph) / 5 + 3));
    ctx.textAlign = 'left';
    for (const [x, f] of decades) if (x > L + 4 && x < R - 40) ctx.fillText(fmtSI(f, 'Hz', 1), x + 3, B - 5);
    ctx.font = FONT;
  }

  exportCSV() {
    if (!this.count) { this.ed.toast('No scope data yet'); return; }
    const rows = [['time_s', ...this.channels.map((c) => `${c.probe.label}_${c.probe.unit}`)].join(',')];
    for (let k = this.count; k >= 1; k--) {
      const i = (this.head - k + N) % N;
      rows.push([this.tbuf[i].toExponential(6), ...this.channels.map((c) => c.buf[i].toExponential(6))].join(','));
    }
    this.ed.app.bridge.saveFile(`${this.ed.doc.name.replace(/\W+/g, '_')}_scope.csv`, 'text/csv', rows.join('\n'));
    this.ed.toast('Scope data exported');
  }
}

/** in-place radix-2 FFT */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
