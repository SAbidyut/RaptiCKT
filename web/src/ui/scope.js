// Multichannel oscilloscope with measurements, FFT spectrum and XY mode.

import { fmtSI } from '../engine/units.js';
import { icon } from './icons.js';

export const CH_COLORS = ['#facc15', '#22d3ee', '#f472b6', '#4ade80', '#fb923c', '#a78bfa'];
const N = 4096;

export class Scope {
  constructor(editor, host) {
    this.ed = editor;
    this.host = host;
    this.channels = []; // {probe, buf: Float64Array, color}
    this.tbuf = new Float64Array(N);
    this.head = 0; this.count = 0;
    this.window = 0.1;
    this.lastT = -Infinity;
    this.mode = 'time';
    this.frozen = false;
    this.build();
  }

  build() {
    this.host.innerHTML = `
      <div class="scope-head">
        <div class="scope-chips"></div>
        <div class="scope-tools">
          <button class="icon-btn sm" data-a="zin" title="Zoom in time">${icon('plus', 18)}</button>
          <button class="icon-btn sm" data-a="zout" title="Zoom out time"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
          <button class="icon-btn sm" data-a="mode" title="Time / FFT / XY">${icon('fft', 18)}</button>
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
      if (a === 'zin') this.window = Math.max(1e-9, this.window / 2);
      if (a === 'zout') this.window = Math.min(1e4, this.window * 2);
      if (a === 'mode') {
        this.mode = this.mode === 'time' ? 'fft' : this.mode === 'fft' ? (this.channels.length >= 2 ? 'xy' : 'time') : 'time';
        this.ed.toast(this.mode === 'fft' ? 'Spectrum (FFT) view' : this.mode === 'xy' ? 'XY view: CH1 → X, CH2 → Y' : 'Time view');
      }
      if (a === 'freeze') { this.frozen = !this.frozen; b.innerHTML = icon(this.frozen ? 'play' : 'pause', 16); }
      if (a === 'csv') this.exportCSV();
      this.userWindow = true;
      this.draw();
    });
    // pinch / drag on scope to change timebase
    let pts = new Map(), d0 = 0, w0 = 0;
    this.cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, e.clientX); this.cv.setPointerCapture(e.pointerId); if (pts.size === 2) { const v = [...pts.values()]; d0 = Math.abs(v[0] - v[1]); w0 = this.window; } });
    this.cv.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, e.clientX);
      if (pts.size === 2) { const v = [...pts.values()]; const d = Math.abs(v[0] - v[1]); if (d0 > 10 && d > 10) { this.window = Math.min(1e4, Math.max(1e-9, (w0 * d0) / d)); this.userWindow = true; } }
    });
    const up = (e) => pts.delete(e.pointerId);
    this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', up);
    this.cv.addEventListener('wheel', (e) => { e.preventDefault(); this.window *= e.deltaY > 0 ? 1.25 : 0.8; this.userWindow = true; }, { passive: false });
  }

  setAutoWindow(w) { if (!this.userWindow) this.window = w; }

  setProbes(probes) {
    const old = new Map(this.channels.map((c) => [c.probe.id, c]));
    this.channels = probes.map((p) => old.get(p.id) || { probe: p, buf: new Float64Array(N) });
    this.channels.forEach((c) => { c.probe = probes.find((p) => p.id === c.probe.id); });
    this.renderChips();
  }

  renderChips() {
    this.chipsEl.innerHTML = this.channels.map((c, i) => `<button class="chip" data-i="${i}" style="--c:${c.probe.color}"><i></i>${c.probe.label}<span>${icon('x', 12)}</span></button>`).join('');
    this.chipsEl.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => this.ed.removeProbe(this.channels[+b.dataset.i].probe)));
    this.emptyEl.style.display = this.channels.length ? 'none' : '';
  }

  reset() { this.head = 0; this.count = 0; this.lastT = -Infinity; for (const c of this.channels) c.buf.fill(0); }

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

  /** iterate samples within [t0, t1] oldest → newest */
  *visible(t0) {
    for (let k = this.count; k >= 1; k--) {
      const idx = (this.head - k + N) % N;
      if (this.tbuf[idx] >= t0) yield idx;
    }
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cv.width = Math.max(1, Math.round(r.width * dpr));
    this.cv.height = Math.max(1, Math.round(r.height * dpr));
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
    return { mn, mx, avg, rms, freq, pp: mx - mn };
  }

  draw() {
    const { ctx } = this;
    if (!this.w) this.resize();
    const W = this.w, H = this.h, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = this.ed.theme;
    ctx.fillStyle = th.bg === '#f6f8fc' ? '#eef2f9' : '#070b14';
    ctx.fillRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = 'rgba(120,160,220,0.13)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 10; i++) { const x = Math.round((W * i) / 10) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let j = 1; j < 8; j++) { const y = Math.round((H * j) / 8) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,160,220,0.28)';
    ctx.beginPath(); ctx.moveTo(0, Math.round(H / 2) + 0.5); ctx.lineTo(W, Math.round(H / 2) + 0.5); ctx.stroke();
    if (!this.channels.length || !this.count) { this.measEl.innerHTML = ''; return; }

    const tNow = this.tbuf[(this.head - 1 + N) % N];
    const t0 = tNow - this.window;
    const idxs = [...this.visible(t0)];
    ctx.font = '10px JetBrains Mono, ui-monospace, monospace';
    if (this.mode === 'fft') return this.drawFFT(idxs);
    if (this.mode === 'xy' && this.channels.length >= 2) return this.drawXY(idxs);

    const meas = [];
    this.channels.forEach((c, ci) => {
      const st = this.stats(c, idxs);
      if (!st) return;
      // symmetric-ish auto scale per channel with nice numbers
      let lo = st.mn, hi = st.mx;
      if (hi - lo < 1e-12) { lo -= Math.max(1e-3, Math.abs(lo) * 0.1); hi += Math.max(1e-3, Math.abs(hi) * 0.1); }
      const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
      if (lo > 0 && lo < (hi - lo) * 0.6) lo = 0;
      if (hi < 0 && -hi < (hi - lo) * 0.6) hi = 0;
      const col = c.probe.color;
      ctx.beginPath();
      let first = true;
      for (const i of idxs) {
        const x = ((this.tbuf[i] - t0) / this.window) * W;
        const y = H - ((c.buf[i] - lo) / (hi - lo)) * H;
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.shadowColor = col; ctx.shadowBlur = 6;
      ctx.stroke(); ctx.shadowBlur = 0;
      // live dot
      const li = idxs[idxs.length - 1];
      const ly = H - ((c.buf[li] - lo) / (hi - lo)) * H;
      ctx.beginPath(); ctx.arc(W - 3, ly, 3.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      // axis labels for this channel
      const u = c.probe.unit;
      ctx.fillStyle = col; ctx.textAlign = 'right';
      ctx.fillText(fmtSI(hi, u, 3), W - 8, 48 + ci * 12);
      ctx.fillText(fmtSI(lo, u, 3), W - 8, H - 20 - (this.channels.length - 1 - ci) * 12);
      meas.push(`<span style="color:${col}">● ${c.probe.label}</span> ${fmtSI(c.buf[li], u, 4)} <em>pp</em> ${fmtSI(st.pp, u, 3)} <em>rms</em> ${fmtSI(st.rms, u, 3)}${st.freq ? ` <em>f</em> ${fmtSI(st.freq, 'Hz', 4)}` : ''}`);
    });
    ctx.fillStyle = 'rgba(200,215,240,0.7)'; ctx.textAlign = 'right';
    ctx.fillText(`${fmtSI(this.window / 10, 's', 3)}/div`, W - 6, H - 5);
    this.measEl.innerHTML = meas.join('<br>');
  }

  drawXY(idxs) {
    const { ctx } = this;
    const W = this.w, H = this.h;
    const [a, b] = this.channels;
    const sa = this.stats(a, idxs), sb = this.stats(b, idxs);
    if (!sa || !sb) return;
    const rx = Math.max(sa.pp, 1e-9), ry = Math.max(sb.pp, 1e-9);
    ctx.beginPath();
    let f = true;
    for (const i of idxs) {
      const x = 10 + ((a.buf[i] - sa.mn) / rx) * (W - 20), y = H - 10 - ((b.buf[i] - sb.mn) / ry) * (H - 20);
      if (f) { ctx.moveTo(x, y); f = false; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.8; ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
    this.measEl.innerHTML = `XY: X = ${a.probe.label} (${fmtSI(sa.mn, a.probe.unit, 3)} … ${fmtSI(sa.mx, a.probe.unit, 3)}), Y = ${b.probe.label} (${fmtSI(sb.mn, b.probe.unit, 3)} … ${fmtSI(sb.mx, b.probe.unit, 3)})`;
  }

  drawFFT(idxs) {
    const { ctx } = this;
    const W = this.w, H = this.h;
    let n = 1;
    while (n * 2 <= idxs.length && n < 2048) n *= 2;
    if (n < 32) return;
    const sel = idxs.slice(idxs.length - n);
    const dtS = (this.tbuf[sel[n - 1]] - this.tbuf[sel[0]]) / (n - 1);
    const fs = 1 / dtS;
    const meas = [];
    this.channels.forEach((c) => {
      const re = new Float64Array(n), im = new Float64Array(n);
      let mean = 0;
      for (let k = 0; k < n; k++) mean += c.buf[sel[k]];
      mean /= n;
      for (let k = 0; k < n; k++) re[k] = (c.buf[sel[k]] - mean) * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (n - 1)));
      fft(re, im);
      const half = n / 2;
      const mag = new Float64Array(half);
      let peak = 1, pk = 1;
      for (let k = 1; k < half; k++) { mag[k] = (Math.hypot(re[k], im[k]) * 4) / n; if (mag[k] > peak * 0 && mag[k] > mag[pk]) pk = k; }
      peak = mag[pk] || 1e-12;
      ctx.beginPath();
      for (let k = 1; k < half; k++) {
        const x = (Math.log10(k) / Math.log10(half)) * W;
        const db = 20 * Math.log10(Math.max(mag[k] / peak, 1e-5));
        const y = (-db / 100) * H;
        if (k === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = c.probe.color; ctx.lineWidth = 1.6; ctx.stroke();
      meas.push(`<span style="color:${c.probe.color}">● ${c.probe.label}</span> peak ${fmtSI((pk * fs) / n, 'Hz', 4)} @ ${fmtSI(mag[pk], c.probe.unit, 3)}`);
    });
    ctx.fillStyle = 'rgba(200,215,240,0.7)'; ctx.textAlign = 'right';
    ctx.fillText(`FFT ${n} pts · 0…−100 dB · ${fmtSI(fs / n, 'Hz', 3)} … ${fmtSI(fs / 2, 'Hz', 3)} (log)`, W - 6, H - 5);
    this.measEl.innerHTML = meas.join('<br>');
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
