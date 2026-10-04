// Analysis centre: AC frequency sweep (Bode plot), DC sweep, DC operating
// point table, harmonics / THD, impedance vs frequency, parametric transient
// sweep, Monte-Carlo tolerance analysis, power / efficiency table and SPICE
// netlist export.

import { fmtSI, parseSI } from '../engine/units.js';
import { icon } from './icons.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SOURCE_TYPES = new Set(['dcv', 'acv', 'square', 'pulse', 'triangle', 'sawtooth', 'noise', 'sweep', 'dci', 'aci', 'rail', 'mic']);

export class Analysis {
  constructor(editor, host) {
    this.ed = editor;
    this.host = host;
    this.tab = 'bode';
    this.last = null;
  }

  get isOpen() { return this.host.classList.contains('open'); }
  close() { this.host.classList.remove('open'); this.ed.overlayClosed('analysis'); }

  open(tab) {
    if (tab) this.tab = tab;
    this.host.innerHTML = `
      <div class="an-head">
        <button class="icon-btn" data-close>${icon('back', 22)}</button>
        <b>Analysis</b>
        <span class="grow"></span>
      </div>
      <div class="an-tabs">
        <button data-t="bode">${icon('bode', 16)}<span>AC Sweep</span></button>
        <button data-t="dc">${icon('sweep', 16)}<span>DC Sweep</span></button>
        <button data-t="op">${icon('table', 16)}<span>Operating Point</span></button>
        <button data-t="thd">${icon('fft', 16)}<span>Harmonics</span></button>
        <button data-t="z">${icon('bode', 16)}<span>Impedance</span></button>
        <button data-t="par">${icon('layers', 16)}<span>Parametric</span></button>
        <button data-t="mc">${icon('chart', 16)}<span>Monte Carlo</span></button>
        <button data-t="pw">${icon('gauge', 16)}<span>Power</span></button>
        <button data-t="net">${icon('code', 16)}<span>SPICE Netlist</span></button>
      </div>
      <div class="an-body"></div>`;
    this.host.querySelector('[data-close]').addEventListener('click', () => this.close());
    this.host.querySelectorAll('.an-tabs button').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.t; this.renderTab(); }));
    this.host.classList.add('open');
    this.ed.overlayOpen('analysis');
    this.renderTab();
  }

  renderTab() {
    this.host.querySelectorAll('.an-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === this.tab));
    const body = this.host.querySelector('.an-body');
    ({ bode: () => this.bodeUI(body), dc: () => this.dcUI(body), op: () => this.opUI(body), net: () => this.netUI(body),
      thd: () => this.thdUI(body), z: () => this.zUI(body), par: () => this.parUI(body), mc: () => this.mcUI(body), pw: () => this.pwUI(body) })[this.tab]();
  }

  /** Make sure the simulator holds a valid operating point. */
  ensureSim() {
    const ed = this.ed;
    ed.rebuildNow();
    const sim = ed.sim;
    if (!sim || !sim.ready || !ed.doc.elements.length) return null;
    if (!ed.running || !sim.started) {
      sim.opt.initialDC = true;
      sim.start();
    }
    if (sim.fatal) { this.ed.toast(sim.error || 'Circuit cannot be solved'); return null; }
    return sim;
  }

  probeOptions(kinds) {
    return this.ed.doc.probes.filter((p) => kinds.includes(p.kind)).map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
  }

  // ------------------------------------------------------------- AC sweep
  bodeUI(body) {
    const srcs = this.ed.doc.elements.filter((e) => SOURCE_TYPES.has(e.constructor.type));
    const outs = this.probeOptions(['node', 'volt']);
    body.innerHTML = `
      <p class="an-help">Small-signal frequency response around the DC operating point. The input source is driven with 1 V (or 1 A) at 0°; all other independent sources are zeroed.</p>
      <div class="form-grid">
        <label>Input source<select id="an-src">${srcs.map((e) => `<option value="${e.id}">${esc(e.name)} – ${esc(e.constructor.title)}</option>`).join('') || '<option value="">(add a source)</option>'}</select></label>
        <label>Output (scope probe)<select id="an-out">${outs || '<option value="">(add a scope probe)</option>'}</select></label>
        <label>Start frequency<input id="an-f1" value="1 Hz"></label>
        <label>Stop frequency<input id="an-f2" value="1 MHz"></label>
        <label>Points / decade<select id="an-ppd"><option>20</option><option selected>50</option><option>100</option><option>200</option></select></label>
      </div>
      <div class="btn-row"><button class="btn primary" id="an-run">${icon('play', 16)} Run AC sweep</button><button class="btn" id="an-csv">${icon('download', 16)} CSV</button></div>
      <div class="plot-wrap"><canvas id="an-plot"></canvas><div class="plot-cursor" id="an-cur"></div></div>
      <div class="an-summary" id="an-sum"></div>`;
    const outSel = body.querySelector('#an-out');
    if (outSel.options.length > 1) outSel.selectedIndex = outSel.options.length - 1;
    body.querySelector('#an-run').addEventListener('click', () => this.runBode());
    body.querySelector('#an-csv').addEventListener('click', () => this.exportCSV());
    if (this.last && this.last.kind === 'bode') this.plotBode(this.last);
  }

  runBode() {
    const body = this.host.querySelector('.an-body');
    const srcId = +body.querySelector('#an-src').value, outId = body.querySelector('#an-out').value;
    const f1 = parseSI(body.querySelector('#an-f1').value), f2 = parseSI(body.querySelector('#an-f2').value);
    const ppd = +body.querySelector('#an-ppd').value;
    if (!srcId) return this.ed.toast('Add a voltage or current source to drive the circuit');
    if (!outId) return this.ed.toast('Probe the output node first (select a wire → Scope)');
    if (!(f1 > 0 && f2 > f1)) return this.ed.toast('Check the frequency range');
    const sim = this.ensureSim();
    if (!sim) return;
    const src = this.ed.doc.elements.find((e) => e.id === srcId);
    const probe = this.ed.doc.probes.find((p) => p.id === outId);
    const [np, nn] = this.ed.probeNodes(probe);
    if (np < 0) return this.ed.toast('Output probe is not connected');
    const t0 = performance.now();
    const res = sim.acSweep(src, np, nn, f1, f2, ppd);
    if (!res) return this.ed.toast('AC analysis failed (singular matrix)');
    const pts = res.map((r) => ({ f: r.f, db: 20 * Math.log10(Math.max(1e-30, Math.hypot(r.re, r.im))), ph: (Math.atan2(r.im, r.re) * 180) / Math.PI }));
    // unwrap phase
    for (let i = 1; i < pts.length; i++) {
      while (pts[i].ph - pts[i - 1].ph > 180) pts[i].ph -= 360;
      while (pts[i].ph - pts[i - 1].ph < -180) pts[i].ph += 360;
    }
    this.last = { kind: 'bode', pts, label: probe.label, src: src.name, ms: performance.now() - t0 };
    this.plotBode(this.last);
  }

  plotBode(data) {
    const body = this.host.querySelector('.an-body');
    const cv = body.querySelector('#an-plot');
    const { pts } = data;
    const draw = (cursor) => {
      const { ctx, W, H } = prepCanvas(cv);
      const f1 = pts[0].f, f2 = pts[pts.length - 1].f;
      let dmin = Math.min(...pts.map((p) => p.db)), dmax = Math.max(...pts.map((p) => p.db));
      dmax = Math.ceil((dmax + 3) / 10) * 10; dmin = Math.max(dmax - 160, Math.floor((dmin - 3) / 10) * 10);
      let pmin = Math.min(...pts.map((p) => p.ph)), pmax = Math.max(...pts.map((p) => p.ph));
      pmin = Math.floor(pmin / 45) * 45 - 45; pmax = Math.ceil(pmax / 45) * 45 + 45;
      const L = 46, R = 46, T = 14, B = 26;
      const X = (f) => L + ((Math.log10(f) - Math.log10(f1)) / (Math.log10(f2) - Math.log10(f1))) * (W - L - R);
      const Yd = (d) => T + ((dmax - d) / (dmax - dmin)) * (H - T - B);
      const Yp = (p) => T + ((pmax - p) / (pmax - pmin)) * (H - T - B);
      axesLog(ctx, W, H, L, R, T, B, f1, f2, X);
      ctx.font = '10px Inter, system-ui, sans-serif';
      for (let d = dmin; d <= dmax; d += (dmax - dmin) / 8) {
        ctx.fillStyle = '#facc15'; ctx.textAlign = 'right'; ctx.fillText(data.z ? fmtSI(Math.pow(10, d / 20), 'Ω', 2) : d.toFixed(0) + ' dB', L - 4, Yd(d) + 3);
      }
      for (let k = 0; k <= 4; k++) {
        const p = pmin + ((pmax - pmin) * k) / 4;
        ctx.fillStyle = '#22d3ee'; ctx.textAlign = 'left'; ctx.fillText(p.toFixed(0) + '°', W - R + 4, Yp(p) + 3);
      }
      line(ctx, pts.map((p) => [X(p.f), Yp(p.ph)]), '#22d3ee', 1.6, [5, 4]);
      line(ctx, pts.map((p) => [X(p.f), Yd(p.db)]), '#facc15', 2.4);
      // markers
      const m = data.z ? zMarkers(pts) : bodeMarkers(pts);
      for (const mk of m.marks) {
        ctx.fillStyle = mk.color; ctx.beginPath(); ctx.arc(X(mk.f), Yd(mk.db), 4, 0, Math.PI * 2); ctx.fill();
        ctx.font = '600 10px Inter, system-ui'; ctx.textAlign = 'center';
        ctx.fillText(mk.label, X(mk.f), Yd(mk.db) - 9);
      }
      if (cursor) {
        const i = nearest(pts, cursor);
        const p = pts[i];
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(X(p.f), T); ctx.lineTo(X(p.f), H - B); ctx.stroke(); ctx.setLineDash([]);
        body.querySelector('#an-cur').textContent = data.z ? `f = ${fmtSI(p.f, 'Hz', 4)}   |Z| = ${fmtSI(Math.pow(10, p.db / 20), 'Ω', 4)}   θ = ${p.ph.toFixed(1)}°`
          : `f = ${fmtSI(p.f, 'Hz', 4)}   |H| = ${p.db.toFixed(2)} dB (${fmtSI(Math.pow(10, p.db / 20), '', 4)})   ∠ = ${p.ph.toFixed(1)}°`;
      }
      body.querySelector('#an-sum').innerHTML = `<b>${esc(data.label)}</b>${data.src ? ' / ' + esc(data.src) : ''} · ${pts.length} points in ${data.ms.toFixed(0)} ms<br>${m.summary}`;
      return { X, f1, f2, L, R, W };
    };
    let geo = draw();
    const move = (ev) => {
      const r = cv.getBoundingClientRect();
      const x = ev.clientX - r.left;
      const t = (x - geo.L) / (geo.W - geo.L - geo.R);
      const f = Math.pow(10, Math.log10(geo.f1) + t * (Math.log10(geo.f2) - Math.log10(geo.f1)));
      geo = draw(f);
    };
    cv.onpointermove = move; cv.onpointerdown = move;
  }

  // ------------------------------------------------------------- DC sweep
  dcUI(body) {
    const els = this.ed.doc.elements.filter((e) => e.constructor.props.some((p) => !p.type && !p.hidden));
    const outs = this.probeOptions(['node', 'volt', 'cur']);
    body.innerHTML = `
      <p class="an-help">Sweeps one parameter and solves the DC operating point at every step — ideal for I–V curves, transfer characteristics and sensor calibration curves.</p>
      <div class="form-grid">
        <label>Component<select id="dc-el">${els.map((e) => `<option value="${e.id}">${esc(e.name)} – ${esc(e.constructor.title)}</option>`).join('')}</select></label>
        <label>Parameter<select id="dc-par"></select></label>
        <label>From<input id="dc-from"></label>
        <label>To<input id="dc-to"></label>
        <label>Steps<input id="dc-n" value="100"></label>
        <label>Measure (scope probes)<select id="dc-out" multiple size="3">${outs}</select></label>
      </div>
      <div class="btn-row"><button class="btn primary" id="dc-run">${icon('play', 16)} Run DC sweep</button><button class="btn" id="dc-csv">${icon('download', 16)} CSV</button></div>
      <div class="plot-wrap"><canvas id="an-plot"></canvas><div class="plot-cursor" id="an-cur"></div></div>
      <div class="an-summary" id="an-sum">${outs ? '' : 'Tip: add scope probes (voltage or current) to choose what to measure.'}</div>`;
    const elSel = body.querySelector('#dc-el'), parSel = body.querySelector('#dc-par');
    const fillPar = () => {
      const e = this.ed.doc.elements.find((x) => x.id === +elSel.value);
      if (!e) return;
      const ps = e.constructor.props.filter((p) => !p.type && !p.hidden);
      const k = e.knobProp();
      parSel.innerHTML = ps.map((p) => `<option value="${p.key}" ${k && k.key === p.key ? 'selected' : ''}>${esc(p.label)}${p.unit ? ' (' + esc(p.unit) + ')' : ''}</option>`).join('');
      fillRange();
    };
    const fillRange = () => {
      const e = this.ed.doc.elements.find((x) => x.id === +elSel.value);
      const p = e && e.propDef(parSel.value);
      if (!p) return;
      const v = e.p[p.key];
      body.querySelector('#dc-from').value = fmtSI(p.min !== undefined && p.min >= 0 ? p.min : -Math.abs(v || 1), '', 3).trim();
      body.querySelector('#dc-to').value = fmtSI(v > 0 ? v * 2 : p.max ?? 1, '', 3).trim();
    };
    elSel.addEventListener('change', fillPar);
    parSel.addEventListener('change', fillRange);
    fillPar();
    const outSel = body.querySelector('#dc-out');
    if (outSel.options.length) outSel.options[0].selected = true;
    body.querySelector('#dc-run').addEventListener('click', () => this.runDC());
    body.querySelector('#dc-csv').addEventListener('click', () => this.exportCSV());
    if (this.last && this.last.kind === 'dc') this.plotXY(this.last);
  }

  runDC() {
    const body = this.host.querySelector('.an-body');
    const el = this.ed.doc.elements.find((x) => x.id === +body.querySelector('#dc-el').value);
    const key = body.querySelector('#dc-par').value;
    const from = parseSI(body.querySelector('#dc-from').value), to = parseSI(body.querySelector('#dc-to').value);
    const n = Math.max(2, Math.min(2000, parseInt(body.querySelector('#dc-n').value, 10) || 100));
    const probes = [...body.querySelector('#dc-out').selectedOptions].map((o) => this.ed.doc.probes.find((p) => p.id === o.value)).filter(Boolean);
    if (!el || !key) return this.ed.toast('Choose a component and parameter');
    if (!probes.length) return this.ed.toast('Select at least one scope probe to measure');
    if (!Number.isFinite(from) || !Number.isFinite(to)) return this.ed.toast('Check the sweep range');
    const wasRunning = this.ed.running;
    if (wasRunning) this.ed.setRunning(false);
    this.ed.rebuildNow();
    const sim = this.ed.sim;
    const series = probes.map((p) => ({ label: p.label, unit: p.unit, color: p.color, pts: [] }));
    const t0 = performance.now();
    const res = sim.dcSweep(el, key, from, to, n, (s) => probes.map((p) => this.ed.probeValue(p, s)));
    res.forEach((r) => series.forEach((sr, i) => sr.pts.push([r.x, Array.isArray(r.y) ? r.y[i] : NaN])));
    this.ed.sim.dirty = true;
    const pdef = el.propDef(key);
    this.last = { kind: 'dc', series, xlabel: `${el.name} ${pdef.label}`, xunit: pdef.unit || '', ms: performance.now() - t0 };
    this.plotXY(this.last);
    this.ed.rebuildNow(true);
    if (wasRunning) this.ed.setRunning(true);
  }

  plotXY(data) {
    const body = this.host.querySelector('.an-body');
    const cv = body.querySelector('#an-plot');
    const all = data.series.flatMap((s) => s.pts).filter((p) => Number.isFinite(p[1]));
    if (!all.length) { body.querySelector('#an-sum').textContent = 'No converged points.'; return; }
    const draw = (cx) => {
      const { ctx, W, H } = prepCanvas(cv);
      const L = 56, R = 12, T = 12, B = 28;
      let x1 = Math.min(...all.map((p) => p[0])), x2 = Math.max(...all.map((p) => p[0]));
      let y1 = Math.min(...all.map((p) => p[1])), y2 = Math.max(...all.map((p) => p[1]));
      if (y2 - y1 < 1e-15) { y1 -= 1; y2 += 1; }
      const pad = (y2 - y1) * 0.08; y1 -= pad; y2 += pad;
      const X = (x) => L + ((x - x1) / (x2 - x1 || 1)) * (W - L - R), Y = (y) => T + ((y2 - y) / (y2 - y1)) * (H - T - B);
      ctx.strokeStyle = 'rgba(120,160,220,0.15)'; ctx.lineWidth = 1; ctx.font = '10px Inter, system-ui';
      for (let k = 0; k <= 8; k++) {
        const x = L + (k * (W - L - R)) / 8; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, H - B); ctx.stroke();
        ctx.fillStyle = '#9fb0cc'; ctx.textAlign = 'center'; ctx.fillText(fmtSI(x1 + ((x2 - x1) * k) / 8, data.xunit, 3), x, H - B + 14);
      }
      for (let k = 0; k <= 6; k++) {
        const y = T + (k * (H - T - B)) / 6; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke();
        ctx.fillStyle = '#9fb0cc'; ctx.textAlign = 'right'; ctx.fillText(fmtSI(y2 - ((y2 - y1) * k) / 6, data.series[0].unit, 3), L - 4, y + 3);
      }
      for (const s of data.series) line(ctx, s.pts.filter((p) => Number.isFinite(p[1])).map((p) => [X(p[0]), Y(p[1])]), s.color, 2.2);
      if (cx !== undefined) {
        const s0 = data.series[0];
        let bi = 0;
        s0.pts.forEach((p, i) => { if (Math.abs(p[0] - cx) < Math.abs(s0.pts[bi][0] - cx)) bi = i; });
        const x = s0.pts[bi][0];
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(X(x), T); ctx.lineTo(X(x), H - B); ctx.stroke(); ctx.setLineDash([]);
        body.querySelector('#an-cur').textContent = `${data.xlabel} = ${fmtSI(x, data.xunit, 4)}   ` + data.series.map((s) => `${s.label}: ${fmtSI(s.pts[bi][1], s.unit, 4)}`).join('   ');
      }
      return { L, R, W, x1, x2 };
    };
    let geo = draw();
    const move = (ev) => {
      const r = cv.getBoundingClientRect();
      const t = (ev.clientX - r.left - geo.L) / (geo.W - geo.L - geo.R);
      geo = draw(geo.x1 + t * (geo.x2 - geo.x1));
    };
    cv.onpointermove = move; cv.onpointerdown = move;
    body.querySelector('#an-sum').innerHTML = `Swept <b>${esc(data.xlabel)}</b> · ${data.series[0].pts.length} points in ${data.ms.toFixed(0)} ms<br>` + data.series.map((s) => `<span style="color:${s.color}">●</span> ${esc(s.label)}`).join(' &nbsp; ');
  }

  // ------------------------------------------------------- operating point
  opUI(body) {
    const sim = this.ensureSim();
    if (!sim) { body.innerHTML = '<p class="an-help">Add components to see the operating point.</p>'; return; }
    const nodes = this.ed.nodeNames();
    const rowsN = [];
    for (let n = 1; n < sim.externalNodes; n++) rowsN.push([nodes[n] || 'N' + n, sim.nodeVoltage(n)]);
    const rowsE = this.ed.doc.elements.filter((e) => e.nodes.length >= 2 && e.constructor.category !== 'Meters').map((e) => {
      const v = sim.v(e.nodes[0]) - sim.v(e.nodes[1]);
      return [e.name, e.constructor.title, v, e.i, v * e.i];
    });
    this.last = { kind: 'op', rowsN, rowsE };
    body.innerHTML = `
      <p class="an-help">${this.ed.running ? 'Values at the current simulation time' : 'DC operating point (capacitors open, inductors shorted)'} · t = ${fmtSI(sim.t, 's', 4)}</p>
      <div class="btn-row"><button class="btn" id="an-csv">${icon('download', 16)} CSV</button><button class="btn" id="op-ref">${icon('reset', 16)} Refresh</button></div>
      <h4>Node voltages</h4>
      <table class="tbl"><tr><th>Node</th><th>Voltage</th></tr>${rowsN.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${fmtSI(v, 'V', 5)}</td></tr>`).join('')}</table>
      <h4>Components</h4>
      <table class="tbl"><tr><th>Ref</th><th>Type</th><th>V</th><th>I</th><th>P</th></tr>${rowsE.map(([n, t, v, i, p]) => `<tr><td>${esc(n)}</td><td>${esc(t)}</td><td>${fmtSI(v, 'V', 4)}</td><td>${fmtSI(i, 'A', 4)}</td><td>${fmtSI(p, 'W', 3)}</td></tr>`).join('')}</table>`;
    body.querySelector('#an-csv').addEventListener('click', () => this.exportCSV());
    body.querySelector('#op-ref').addEventListener('click', () => this.opUI(body));
  }

  // --------------------------------------------------------------- netlist
  netUI(body) {
    const text = this.ed.spiceNetlist();
    body.innerHTML = `
      <p class="an-help">SPICE-compatible netlist (ngspice / LTspice) generated from your schematic — use it to cross-validate results or continue your research in other tools. Digital blocks are exported as comments.</p>
      <div class="btn-row"><button class="btn primary" id="net-copy">${icon('copy', 16)} Copy</button><button class="btn" id="net-save">${icon('download', 16)} Save .cir</button><button class="btn" id="net-share">${icon('share', 16)} Share</button></div>
      <textarea class="netlist" spellcheck="false" readonly>${esc(text)}</textarea>`;
    body.querySelector('#net-copy').addEventListener('click', () => { navigator.clipboard?.writeText(text).then(() => this.ed.toast('Netlist copied'), () => this.ed.toast('Copy failed')); });
    body.querySelector('#net-save').addEventListener('click', () => this.ed.app.bridge.saveFile(this.ed.doc.name.replace(/\W+/g, '_') + '.cir', 'text/plain', text));
    body.querySelector('#net-share').addEventListener('click', () => this.ed.app.bridge.share(this.ed.doc.name + ' (SPICE)', text));
  }

  // ------------------------------------------------------- shared helpers
  /** run a fresh transient from t = 0 and record probes; restores the editor afterwards */
  transient(tEnd, dt, probes, keep = () => true, each) {
    const ed = this.ed, wasRunning = ed.running;
    if (wasRunning) ed.setRunning(false);
    ed.rebuildNow(true);
    const sim = ed.sim;
    const out = { t: [], y: probes.map(() => []), ok: true };
    if (!sim || !sim.ready || !sim.start()) { out.ok = false; out.err = sim?.error || 'Circuit cannot be solved'; }
    else {
      const n = Math.min(400000, Math.ceil(tEnd / dt - 1e-9));
      for (let i = 0; i < n; i++) {
        if (!sim.step(dt)) { out.ok = false; out.err = sim.error; break; }
        each?.(sim);
        if (keep(sim.t)) { out.t.push(sim.t); probes.forEach((p, k) => out.y[k].push(ed.probeValue(p, sim))); }
      }
    }
    ed.rebuildNow(true);
    if (wasRunning) ed.setRunning(true);
    return out;
  }

  elOptions(filter) { return this.ed.doc.elements.filter(filter).map((e) => `<option value="${e.id}">${esc(e.name)} – ${esc(e.constructor.title)}</option>`).join(''); }
  acFreq() { const T = this.ed.sim?.acPeriod; return T > 0 ? 1 / T : 50; }

  // ----------------------------------------------------- harmonics / THD
  thdUI(body) {
    const outs = this.probeOptions(['node', 'volt', 'cur']);
    body.innerHTML = `
      <p class="an-help">Runs the circuit for a number of cycles of the fundamental, then takes the Fourier series of the chosen signal over the last cycles: the amplitude of every harmonic, total harmonic distortion (THD), RMS and crest factor — e.g. the current drawn by a rectifier, a CFL or a dimmer.</p>
      <div class="form-grid">
        <label>Signal (scope probe)<select id="th-p">${outs || '<option value="">(add a scope probe)</option>'}</select></label>
        <label>Fundamental frequency<input id="th-f" value="${fmtSI(this.acFreq(), 'Hz', 4)}"></label>
        <label>Settling cycles<input id="th-s" value="10"></label>
        <label>Measured cycles<input id="th-m" value="4"></label>
        <label>Samples per cycle<select id="th-n"><option>200</option><option selected>400</option><option>1000</option><option>2000</option></select></label>
        <label>Harmonics shown<input id="th-h" value="25"></label>
      </div>
      <div class="btn-row"><button class="btn primary" id="th-run">${icon('play', 16)} Analyse harmonics</button><button class="btn" id="an-csv">${icon('download', 16)} CSV</button></div>
      <div class="plot-wrap"><canvas id="an-plot"></canvas><div class="plot-cursor" id="an-cur"></div></div>
      <div class="an-summary" id="an-sum"></div>`;
    body.querySelector('#th-run').addEventListener('click', () => this.runTHD());
    body.querySelector('#an-csv').addEventListener('click', () => this.exportCSV());
    if (this.last && this.last.kind === 'thd') this.plotTHD(this.last);
  }

  runTHD() {
    const body = this.host.querySelector('.an-body');
    const probe = this.ed.doc.probes.find((p) => p.id === body.querySelector('#th-p').value);
    const f = parseSI(body.querySelector('#th-f').value), ns = Math.max(0, parseInt(body.querySelector('#th-s').value, 10) || 0);
    const nm = Math.max(1, parseInt(body.querySelector('#th-m').value, 10) || 1), spc = +body.querySelector('#th-n').value;
    const H = Math.max(2, Math.min(100, parseInt(body.querySelector('#th-h').value, 10) || 25));
    if (!probe) return this.ed.toast('Probe the signal first (select it → Scope)');
    if (!(f > 0)) return this.ed.toast('Enter the fundamental frequency');
    const T = 1 / f, dt = T / spc, t0 = performance.now(), tStart = ns * T;
    const r = this.transient((ns + nm) * T, dt, [probe], (t) => t > tStart + dt * 0.5);
    if (!r.ok) return this.ed.toast(r.err || 'Simulation failed');
    const x = r.y[0], N = Math.min(x.length, nm * spc), xs = x.slice(x.length - N), ts = r.t.slice(r.t.length - N);
    const harm = [];
    let dc = 0, sq = 0, pk = 0;
    for (let i = 0; i < N; i++) { dc += xs[i]; sq += xs[i] * xs[i]; pk = Math.max(pk, Math.abs(xs[i])); }
    dc /= N;
    for (let n = 1; n <= H; n++) {
      let a = 0, b = 0;
      for (let i = 0; i < N; i++) { const w = 2 * Math.PI * n * f * ts[i]; a += xs[i] * Math.cos(w); b += xs[i] * Math.sin(w); }
      a *= 2 / N; b *= 2 / N;
      const amp = Math.hypot(a, b);
      harm.push({ n, f: n * f, rms: amp / Math.SQRT2, ph: (Math.atan2(a, b) * 180) / Math.PI });
    }
    const f1 = harm[0].rms, rest = Math.sqrt(harm.slice(1).reduce((s2, h) => s2 + h.rms * h.rms, 0));
    const rms = Math.sqrt(sq / N);
    this.last = { kind: 'thd', harm, unit: probe.unit, label: probe.label, thd: f1 > 0 ? rest / f1 : 0, rms, dc, crest: rms > 0 ? pk / rms : 0, f, ms: performance.now() - t0 };
    this.plotTHD(this.last);
  }

  plotTHD(d) {
    const body = this.host.querySelector('.an-body'), cv = body.querySelector('#an-plot');
    const f1 = d.harm[0].rms || 1e-30;
    const draw = (sel) => {
      const { ctx, W, H } = prepCanvas(cv);
      const L = 44, R = 10, T = 14, B = 26, n = d.harm.length, bw = (W - L - R) / n;
      const vals = d.harm.map((h) => (h.rms / f1) * 100), top = Math.max(10, Math.ceil(Math.max(...vals.slice(1), 0) / 10) * 10 + 10);
      const Y = (v) => T + (1 - Math.min(v, top) / top) * (H - T - B);
      ctx.font = '10px Inter, system-ui';
      for (let k = 0; k <= 5; k++) {
        const v = (top * k) / 5, y = Y(v);
        ctx.strokeStyle = 'rgba(120,160,220,0.15)'; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke();
        ctx.fillStyle = '#9fb0cc'; ctx.textAlign = 'right'; ctx.fillText(v.toFixed(0) + '%', L - 4, y + 3);
      }
      d.harm.forEach((h, i) => {
        const x = L + i * bw, v = vals[i];
        ctx.fillStyle = i === 0 ? '#22d3ee' : i === sel ? '#f472b6' : '#facc15';
        const y = Y(v); ctx.fillRect(x + bw * 0.18, y, bw * 0.64, H - B - y);
        if (n <= 30 || (h.n % 5 === 0)) { ctx.fillStyle = '#9fb0cc'; ctx.textAlign = 'center'; ctx.fillText(String(h.n), x + bw / 2, H - B + 13); }
      });
      if (sel != null) { const h = d.harm[sel]; body.querySelector('#an-cur').textContent = `H${h.n}  ${fmtSI(h.f, 'Hz', 4)}   ${fmtSI(h.rms, d.unit, 4)} RMS   ${vals[sel].toFixed(2)} % of fundamental   φ ${h.ph.toFixed(1)}°`; }
      return { L, bw };
    };
    let geo = draw();
    const move = (ev) => { const r = cv.getBoundingClientRect(), i = Math.floor((ev.clientX - r.left - geo.L) / geo.bw); if (i >= 0 && i < d.harm.length) geo = draw(i); };
    cv.onpointermove = move; cv.onpointerdown = move;
    const odd = d.harm.filter((h) => h.n > 1).sort((a, b) => b.rms - a.rms).slice(0, 4).map((h) => `H${h.n} ${((h.rms / f1) * 100).toFixed(1)}%`).join(', ');
    body.querySelector('#an-sum').innerHTML = `<b>${esc(d.label)}</b> · fundamental ${fmtSI(d.f, 'Hz', 4)}: <b>${fmtSI(d.harm[0].rms, d.unit, 4)}</b> RMS<br>THD <b>${(d.thd * 100).toFixed(2)} %</b> · total RMS ${fmtSI(d.rms, d.unit, 4)} · DC ${fmtSI(d.dc, d.unit, 3)} · crest factor ${d.crest.toFixed(2)}<br>Largest harmonics: ${odd || '—'}<br><span style="opacity:.7">Computed in ${d.ms.toFixed(0)} ms</span>`;
  }

  // ------------------------------------------------ impedance vs frequency
  zUI(body) {
    const outs = this.probeOptions(['volt', 'node']);
    body.innerHTML = `
      <p class="an-help">Impedance seen between two nodes versus frequency, like an impedance analyser (independent sources zeroed, devices linearised at the operating point): find resonances, the input impedance of filters, or check a speaker / motor model. Choose a voltage probe — its two terminals are the measuring points.</p>
      <div class="form-grid">
        <label>Between (voltage probe)<select id="z-p">${outs || '<option value="">(add a voltage probe)</option>'}</select></label>
        <label>Start frequency<input id="an-f1" value="10 Hz"></label>
        <label>Stop frequency<input id="an-f2" value="1 MHz"></label>
        <label>Points / decade<select id="an-ppd"><option>20</option><option selected>50</option><option>100</option></select></label>
      </div>
      <div class="btn-row"><button class="btn primary" id="z-run">${icon('play', 16)} Sweep impedance</button><button class="btn" id="an-csv">${icon('download', 16)} CSV</button></div>
      <div class="plot-wrap"><canvas id="an-plot"></canvas><div class="plot-cursor" id="an-cur"></div></div>
      <div class="an-summary" id="an-sum"></div>`;
    body.querySelector('#z-run').addEventListener('click', () => this.runZ());
    body.querySelector('#an-csv').addEventListener('click', () => this.exportCSV());
    if (this.last && this.last.kind === 'bode' && this.last.z) this.plotBode(this.last);
  }

  runZ() {
    const body = this.host.querySelector('.an-body');
    const probe = this.ed.doc.probes.find((p) => p.id === body.querySelector('#z-p').value);
    const f1 = parseSI(body.querySelector('#an-f1').value), f2 = parseSI(body.querySelector('#an-f2').value), ppd = +body.querySelector('#an-ppd').value;
    if (!probe) return this.ed.toast('Add a voltage probe across the two points');
    if (!(f1 > 0 && f2 > f1)) return this.ed.toast('Check the frequency range');
    const sim = this.ensureSim();
    if (!sim) return;
    const [np, nn] = this.ed.probeNodes(probe);
    if (np < 0) return this.ed.toast('Probe is not connected');
    const t0 = performance.now(), dec = Math.log10(f2 / f1), N = Math.max(2, Math.round(dec * ppd) + 1), pts = [];
    for (let i = 0; i < N; i++) {
      const f = f1 * Math.pow(10, (dec * i) / (N - 1)), z = sim.impedance(np, nn, f);
      if (!z) continue;
      pts.push({ f, db: 20 * Math.log10(Math.max(1e-30, Math.hypot(z.re, z.im))), ph: (Math.atan2(z.im, z.re) * 180) / Math.PI });
    }
    if (pts.length < 2) return this.ed.toast('Impedance analysis failed');
    this.last = { kind: 'bode', z: true, pts, label: `Z(${probe.label})`, src: '', ms: performance.now() - t0 };
    this.plotBode(this.last);
  }

  // -------------------------------------------------- parametric transient
  parUI(body) {
    const els = this.elOptions((e) => e.constructor.props.some((p) => !p.type && !p.hidden));
    const outs = this.probeOptions(['node', 'volt', 'cur']);
    const dur = this.ed.scope?.window || 0.01;
    body.innerHTML = `
      <p class="an-help">Runs the transient simulation once for every value of one component parameter and overlays the chosen signal — a family of curves (e.g. RC charging for several resistances, a motor start for several loads).</p>
      <div class="form-grid">
        <label>Component<select id="pa-el">${els}</select></label>
        <label>Parameter<select id="pa-par"></select></label>
        <label>Values (list)<input id="pa-v"></label>
        <label>Signal (scope probe)<select id="pa-p">${outs || '<option value="">(add a scope probe)</option>'}</select></label>
        <label>Duration<input id="pa-t" value="${fmtSI(dur, 's', 3)}"></label>
        <label>Time step<input id="pa-dt" value="${fmtSI(Math.min(this.ed.dt || 1e-5, dur / 500), 's', 3)}"></label>
      </div>
      <div class="btn-row"><button class="btn primary" id="pa-run">${icon('play', 16)} Run parametric sweep</button><button class="btn" id="an-csv">${icon('download', 16)} CSV</button></div>
      <div class="plot-wrap"><canvas id="an-plot"></canvas><div class="plot-cursor" id="an-cur"></div></div>
      <div class="an-summary" id="an-sum"></div>`;
    const elSel = body.querySelector('#pa-el'), parSel = body.querySelector('#pa-par'), vIn = body.querySelector('#pa-v');
    const fill = () => {
      const e = this.ed.doc.elements.find((x) => x.id === +elSel.value);
      if (!e) return;
      const ps = e.constructor.props.filter((p) => !p.type && !p.hidden), k = e.knobProp();
      parSel.innerHTML = ps.map((p) => `<option value="${p.key}" ${k && k.key === p.key ? 'selected' : ''}>${esc(p.label)}${p.unit ? ' (' + esc(p.unit) + ')' : ''}</option>`).join('');
      fillV();
    };
    const fillV = () => {
      const e = this.ed.doc.elements.find((x) => x.id === +elSel.value), p = e && e.propDef(parSel.value);
      if (!p) return;
      const v = e.p[p.key] || 1;
      vIn.value = [0.5, 1, 2].map((m) => fmtSI(v * m, '', 3).trim()).join(' ');
    };
    elSel.addEventListener('change', fill); parSel.addEventListener('change', fillV); fill();
    body.querySelector('#pa-run').addEventListener('click', () => this.runPar());
    body.querySelector('#an-csv').addEventListener('click', () => this.exportCSV());
    if (this.last && this.last.kind === 'dc' && this.last.par) this.plotXY(this.last);
  }

  runPar() {
    const body = this.host.querySelector('.an-body');
    const el = this.ed.doc.elements.find((x) => x.id === +body.querySelector('#pa-el').value), key = body.querySelector('#pa-par').value;
    const vals = body.querySelector('#pa-v').value.split(/[\s,;]+/).filter(Boolean).map(parseSI).filter(Number.isFinite).slice(0, 8);
    const probe = this.ed.doc.probes.find((p) => p.id === body.querySelector('#pa-p').value);
    const T = parseSI(body.querySelector('#pa-t').value), dt = parseSI(body.querySelector('#pa-dt').value);
    if (!el || !key || !vals.length) return this.ed.toast('Choose a component, a parameter and some values');
    if (!probe) return this.ed.toast('Probe the signal first (select it → Scope)');
    if (!(T > 0 && dt > 0 && T / dt <= 400000)) return this.ed.toast('Check the duration and time step');
    const orig = el.p[key], pdef = el.propDef(key), cols = ['#facc15', '#22d3ee', '#f472b6', '#4ade80', '#fb923c', '#a78bfa', '#f87171', '#e2e8f0'];
    const every = Math.max(1, Math.round(T / dt / 1500)), t0 = performance.now(), series = [];
    try {
      vals.forEach((v, k) => {
        el.p[key] = v; el.onParamChange(key);
        let c = 0;
        const r = this.transient(T, dt, [probe], () => (c++ % every) === 0);
        if (!r.ok) throw new Error(r.err || 'Simulation failed');
        series.push({ label: `${pdef.label} = ${fmtSI(v, pdef.unit || '', 3)}`, unit: probe.unit, color: cols[k % cols.length], pts: r.t.map((t, i) => [t, r.y[0][i]]) });
      });
    } catch (err) { this.ed.toast(String(err.message || err)); }
    finally { el.p[key] = orig; el.onParamChange(key); this.ed.rebuildNow(true); }
    if (!series.length) return;
    this.last = { kind: 'dc', par: true, series, xlabel: 'Time', xunit: 's', ms: performance.now() - t0 };
    this.plotXY(this.last);
  }

  // ---------------------------------------------------------- Monte Carlo
  mcUI(body) {
    const outs = this.probeOptions(['node', 'volt', 'cur']);
    body.innerHTML = `
      <p class="an-help">Production-tolerance check: every resistor, capacitor and inductor is varied at random within its tolerance and the DC operating point is solved for each run. The spread (histogram, mean, standard deviation, worst cases) shows how much real parts move your output.</p>
      <div class="form-grid">
        <label>Measure (scope probe)<select id="mc-p">${outs || '<option value="">(add a scope probe)</option>'}</select></label>
        <label>Runs<input id="mc-n" value="300"></label>
        <label>Resistor tolerance<input id="mc-r" value="5 %"></label>
        <label>Capacitor tolerance<input id="mc-c" value="10 %"></label>
        <label>Inductor tolerance<input id="mc-l" value="10 %"></label>
        <label>Distribution<select id="mc-d"><option value="g">Gaussian (tolerance = 3σ)</option><option value="u">Uniform</option><option value="w">Worst case (± limits)</option></select></label>
      </div>
      <div class="btn-row"><button class="btn primary" id="mc-run">${icon('play', 16)} Run Monte Carlo</button><button class="btn" id="an-csv">${icon('download', 16)} CSV</button></div>
      <div class="plot-wrap"><canvas id="an-plot"></canvas><div class="plot-cursor" id="an-cur"></div></div>
      <div class="an-summary" id="an-sum"></div>`;
    body.querySelector('#mc-run').addEventListener('click', () => this.runMC());
    body.querySelector('#an-csv').addEventListener('click', () => this.exportCSV());
    if (this.last && this.last.kind === 'mc') this.plotMC(this.last);
  }

  runMC() {
    const body = this.host.querySelector('.an-body'), ed = this.ed;
    const probe = ed.doc.probes.find((p) => p.id === body.querySelector('#mc-p').value);
    if (!probe) return ed.toast('Probe the output first (select it → Scope)');
    const n = Math.max(10, Math.min(5000, parseInt(body.querySelector('#mc-n').value, 10) || 300));
    const pct = (id) => (parseFloat(body.querySelector(id).value) || 0) / 100, tol = { r: pct('#mc-r'), c: pct('#mc-c'), l: pct('#mc-l') }, dist = body.querySelector('#mc-d').value;
    const parts = [];
    for (const e of ed.doc.elements) for (const k of ['r', 'c', 'l']) if (e.constructor.props.some((p) => p.key === k && !p.hidden) && tol[k] > 0 && !/meter|rload|rlload|rcload/.test(e.constructor.type)) parts.push({ e, k, v: e.p[k] });
    if (!parts.length) return ed.toast('No resistors, capacitors or inductors to vary');
    const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const dev = () => (dist === 'u' ? 2 * Math.random() - 1 : dist === 'w' ? (Math.random() < 0.5 ? -1 : 1) : Math.max(-1, Math.min(1, gauss() / 3)));
    const wasRunning = ed.running;
    if (wasRunning) ed.setRunning(false);
    const vals = [], t0 = performance.now();
    const solve = () => { ed.rebuildNow(true); const sim = ed.sim; sim.opt.initialDC = true; return sim.start() ? ed.probeValue(probe, sim) : NaN; };
    try {
      const nominal = solve();
      for (let i = 0; i < n; i++) {
        for (const q of parts) { q.e.p[q.k] = q.v * (1 + tol[q.k] * dev()); q.e.onParamChange(q.k); }
        const y = solve();
        if (Number.isFinite(y)) vals.push(y);
      }
      for (const q of parts) { q.e.p[q.k] = q.v; q.e.onParamChange(q.k); }
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length, sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1));
      this.last = { kind: 'mc', vals, nominal, mean, sd, min: Math.min(...vals), max: Math.max(...vals), unit: probe.unit, label: probe.label, parts: parts.length, ms: performance.now() - t0 };
    } finally {
      for (const q of parts) { q.e.p[q.k] = q.v; q.e.onParamChange(q.k); }
      ed.rebuildNow(true);
      if (wasRunning) ed.setRunning(true);
    }
    if (!vals.length) return ed.toast('No run converged');
    this.plotMC(this.last);
  }

  plotMC(d) {
    const body = this.host.querySelector('.an-body'), cv = body.querySelector('#an-plot');
    const { ctx, W, H } = prepCanvas(cv);
    const L = 40, R = 10, T = 12, B = 28, nb = 24, lo = d.min, hi = d.max > d.min ? d.max : d.min + 1e-12;
    const bins = new Array(nb).fill(0);
    for (const v of d.vals) bins[Math.min(nb - 1, Math.floor(((v - lo) / (hi - lo)) * nb))]++;
    const top = Math.max(...bins), bw = (W - L - R) / nb;
    ctx.font = '10px Inter, system-ui';
    bins.forEach((c, i) => { const h = (c / top) * (H - T - B); ctx.fillStyle = '#22d3ee'; ctx.fillRect(L + i * bw + 1, H - B - h, bw - 2, h); });
    for (let k = 0; k <= 4; k++) { ctx.fillStyle = '#9fb0cc'; ctx.textAlign = 'center'; ctx.fillText(fmtSI(lo + ((hi - lo) * k) / 4, d.unit, 4), L + (k * (W - L - R)) / 4, H - B + 14); }
    const X = (v) => L + ((v - lo) / (hi - lo)) * (W - L - R);
    for (const [v, col] of [[d.nominal, '#f472b6'], [d.mean, '#facc15']]) { if (!Number.isFinite(v)) continue; ctx.strokeStyle = col; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(X(v), T); ctx.lineTo(X(v), H - B); ctx.stroke(); ctx.setLineDash([]); }
    body.querySelector('#an-sum').innerHTML = `<b>${esc(d.label)}</b> · ${d.vals.length} runs, ${d.parts} parts varied<br><span style="color:#f472b6">●</span> nominal ${fmtSI(d.nominal, d.unit, 5)} &nbsp; <span style="color:#facc15">●</span> mean ${fmtSI(d.mean, d.unit, 5)} &nbsp; σ ${fmtSI(d.sd, d.unit, 3)} (${d.mean ? ((d.sd / Math.abs(d.mean)) * 100).toFixed(2) : '—'} %)<br>Range ${fmtSI(d.min, d.unit, 5)} … ${fmtSI(d.max, d.unit, 5)} · ±3σ: ${fmtSI(d.mean - 3 * d.sd, d.unit, 4)} … ${fmtSI(d.mean + 3 * d.sd, d.unit, 4)}<br><span style="opacity:.7">${d.ms.toFixed(0)} ms</span>`;
  }

  // ------------------------------------------------- power / efficiency
  pwUI(body) {
    const per = this.ed.sim?.acPeriod || 0;
    body.innerHTML = `
      <p class="an-help">Runs the circuit and averages the power flowing into every component over the last part of the run (Σ V·I at its terminals): negative = it supplies power, positive = it consumes it. Choose the useful load to get the efficiency.</p>
      <div class="form-grid">
        <label>Duration<input id="pw-t" value="${fmtSI(per ? 20 * per : 0.05, 's', 3)}"></label>
        <label>Average over the last<select id="pw-f"><option value="0.25">25 %</option><option value="0.5" selected>50 %</option><option value="0.75">75 %</option></select></label>
        <label>Time step<input id="pw-dt" value="${fmtSI(this.ed.dt || 1e-5, 's', 3)}"></label>
        <label>Useful load (for efficiency)<select id="pw-load"><option value="">—</option>${this.elOptions((e) => e.localPosts().length >= 2)}</select></label>
      </div>
      <div class="btn-row"><button class="btn primary" id="pw-run">${icon('play', 16)} Measure power</button><button class="btn" id="an-csv">${icon('download', 16)} CSV</button></div>
      <div id="pw-out"></div>`;
    body.querySelector('#pw-run').addEventListener('click', () => this.runPW());
    body.querySelector('#an-csv').addEventListener('click', () => this.exportCSV());
    if (this.last && this.last.kind === 'pw') this.showPW(this.last);
  }

  runPW() {
    const body = this.host.querySelector('.an-body'), ed = this.ed;
    const T = parseSI(body.querySelector('#pw-t').value), frac = +body.querySelector('#pw-f').value, dt = parseSI(body.querySelector('#pw-dt').value);
    if (!(T > 0 && dt > 0 && T / dt <= 400000)) return ed.toast('Check the duration and time step');
    const els = ed.doc.elements.filter((e) => e.localPosts().length >= 1 && !e.isGround?.());
    const acc = new Map(els.map((e) => [e, 0]));
    let tAcc = 0;
    const t1 = T * (1 - frac), t0 = performance.now();
    const r = this.transient(T, dt, [], () => false, (sim) => {
      if (sim.t < t1) return;
      for (const e of els) {
        const pc = e.postCurrents || [];
        let p = 0;
        e.nodes.forEach((nd, k) => { p += sim.v(nd) * (pc[k] || 0); });
        acc.set(e, acc.get(e) + p * sim.dt);
      }
      tAcc += sim.dt;
    });
    if (!r.ok) return ed.toast(r.err || 'Simulation failed');
    const rows = els.map((e) => ({ id: e.id, name: e.name, title: e.constructor.title, p: tAcc > 0 ? acc.get(e) / tAcc : 0 })).filter((x) => Math.abs(x.p) > 1e-9).sort((a, b) => a.p - b.p);
    const sup = -rows.filter((x) => x.p < 0).reduce((a, x) => a + x.p, 0), abs = rows.filter((x) => x.p > 0).reduce((a, x) => a + x.p, 0);
    const loadId = +body.querySelector('#pw-load').value, load = rows.find((x) => x.id === loadId);
    this.last = { kind: 'pw', rows, sup, abs, load, ms: performance.now() - t0 };
    this.showPW(this.last);
  }

  showPW(d) {
    const out = this.host.querySelector('#pw-out');
    if (!out) return;
    const eta = d.load && d.sup > 0 ? (d.load.p / d.sup) * 100 : null;
    out.innerHTML = `<div class="an-summary">Supplied <b>${fmtSI(d.sup, 'W', 4)}</b> · absorbed ${fmtSI(d.abs, 'W', 4)} · balance error ${d.sup > 0 ? ((Math.abs(d.sup - d.abs) / d.sup) * 100).toFixed(2) : '—'} %${eta != null ? `<br>Efficiency (${esc(d.load.name)} / supplied): <b>${eta.toFixed(2)} %</b> · losses ${fmtSI(d.sup - d.load.p, 'W', 4)}` : ''}</div>
      <table class="tbl"><tr><th>Ref</th><th>Type</th><th>Average power</th><th>Share</th></tr>${d.rows.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.title)}</td><td style="color:${x.p < 0 ? '#4ade80' : 'inherit'}">${fmtSI(x.p, 'W', 4)}</td><td>${d.sup > 0 ? ((Math.abs(x.p) / d.sup) * 100).toFixed(1) + ' %' : ''}</td></tr>`).join('')}</table>`;
  }

  exportCSV() {
    const d = this.last;
    if (!d) return this.ed.toast('Run an analysis first');
    let csv = '';
    if (d.kind === 'bode') csv = (d.z ? 'frequency_Hz,impedance_ohm,phase_deg\n' : 'frequency_Hz,magnitude_dB,phase_deg\n') + d.pts.map((p) => `${p.f},${d.z ? Math.pow(10, p.db / 20) : p.db},${p.ph}`).join('\n');
    if (d.kind === 'dc' && !d.par) csv = [`${d.xlabel},${d.series.map((s) => s.label).join(',')}`, ...d.series[0].pts.map((p, i) => [p[0], ...d.series.map((s) => s.pts[i][1])].join(','))].join('\n');
    if (d.kind === 'thd') csv = 'harmonic,frequency_Hz,rms,percent_of_fundamental,phase_deg\n' + d.harm.map((h) => `${h.n},${h.f},${h.rms},${(h.rms / (d.harm[0].rms || 1)) * 100},${h.ph}`).join('\n') + `\n\nTHD_percent,${d.thd * 100}\nRMS,${d.rms}`;
    if (d.kind === 'mc') csv = 'run,value\n' + d.vals.map((v, i) => `${i + 1},${v}`).join('\n');
    if (d.kind === 'pw') csv = 'ref,type,average_power_W\n' + d.rows.map((x) => `${x.name},${x.title},${x.p}`).join('\n');
    if (d.kind === 'dc' && d.par) csv = ['time_s,' + d.series.map((s) => s.label).join(','), ...d.series[0].pts.map((p, i) => [p[0], ...d.series.map((s) => s.pts[i]?.[1] ?? '')].join(','))].join('\n');
    if (d.kind === 'op') csv = 'node,voltage_V\n' + d.rowsN.map((r) => r.join(',')).join('\n') + '\n\nref,type,V,I,P\n' + d.rowsE.map((r) => r.join(',')).join('\n');
    this.ed.app.bridge.saveFile(`${this.ed.doc.name.replace(/\W+/g, '_')}_${d.kind}.csv`, 'text/csv', csv);
  }
}

// ------------------------------------------------------------ plot helpers
function prepCanvas(cv) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#070b14'; ctx.fillRect(0, 0, r.width, r.height);
  return { ctx, W: r.width, H: r.height };
}

function axesLog(ctx, W, H, L, R, T, B, f1, f2, X) {
  ctx.lineWidth = 1;
  ctx.font = '10px Inter, system-ui, sans-serif';
  for (let d = Math.floor(Math.log10(f1)); d <= Math.ceil(Math.log10(f2)); d++) {
    for (let m = 1; m < 10; m++) {
      const f = m * Math.pow(10, d);
      if (f < f1 || f > f2) continue;
      const x = X(f);
      ctx.strokeStyle = m === 1 ? 'rgba(120,160,220,0.28)' : 'rgba(120,160,220,0.09)';
      ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, H - B); ctx.stroke();
      if (m === 1) { ctx.fillStyle = '#9fb0cc'; ctx.textAlign = 'center'; ctx.fillText(fmtSI(f, 'Hz', 2), x, H - B + 14); }
    }
  }
  for (let k = 0; k <= 8; k++) {
    const y = T + (k * (H - T - B)) / 8;
    ctx.strokeStyle = 'rgba(120,160,220,0.12)';
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke();
  }
}

function line(ctx, pts, color, w, dash) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.stroke(); ctx.setLineDash([]);
}

function nearest(pts, f) {
  let bi = 0;
  pts.forEach((p, i) => { if (Math.abs(Math.log(p.f / f)) < Math.abs(Math.log(pts[bi].f / f))) bi = i; });
  return bi;
}

function interpF(a, b, target) {
  const t = (target - a.db) / (b.db - a.db);
  return Math.pow(10, Math.log10(a.f) + t * (Math.log10(b.f) - Math.log10(a.f)));
}

/** Detect peak, −3 dB corners and unity-gain crossing. */
export function bodeMarkers(pts) {
  const marks = [];
  let pk = 0;
  pts.forEach((p, i) => { if (p.db > pts[pk].db) pk = i; });
  const ref = pts[pk].db;
  const lows = [], highs = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (a.db < ref - 3 && b.db >= ref - 3 && i <= pk) lows.push(interpF(a, b, ref - 3));
    if (a.db >= ref - 3 && b.db < ref - 3 && i > pk) highs.push(interpF(a, b, ref - 3));
  }
  const parts = [];
  const isPeak = pk > 0 && pk < pts.length - 1 && pts[pk].db - Math.max(pts[0].db, pts[pts.length - 1].db) > 3;
  parts.push(`${isPeak ? 'Peak' : 'Max'} gain ${ref.toFixed(2)} dB (${fmtSI(Math.pow(10, ref / 20), '', 4)}) at ${fmtSI(pts[pk].f, 'Hz', 4)}`);
  if (isPeak) marks.push({ f: pts[pk].f, db: ref, label: 'f₀', color: '#f472b6' });
  const fl = lows.length ? lows[lows.length - 1] : null, fh = highs.length ? highs[0] : null;
  if (fl) { marks.push({ f: fl, db: ref - 3, label: '−3dB', color: '#4ade80' }); parts.push(`Lower −3 dB: ${fmtSI(fl, 'Hz', 4)}`); }
  if (fh) { marks.push({ f: fh, db: ref - 3, label: '−3dB', color: '#4ade80' }); parts.push(`Upper −3 dB: ${fmtSI(fh, 'Hz', 4)}`); }
  if (fl && fh) parts.push(`Bandwidth ${fmtSI(fh - fl, 'Hz', 4)} · Q ≈ ${(pts[pk].f / (fh - fl)).toFixed(2)}`);
  for (let i = 1; i < pts.length; i++) {
    if (pts[i - 1].db >= 0 && pts[i].db < 0 && ref > 3) {
      const f = interpF(pts[i - 1], pts[i], 0);
      marks.push({ f, db: 0, label: '0dB', color: '#fb923c' });
      const ph = pts[i].ph;
      parts.push(`Unity-gain at ${fmtSI(f, 'Hz', 4)} (phase ${ph.toFixed(1)}°, margin ${(180 + ph).toFixed(1)}°)`);
      break;
    }
  }
  return { marks, summary: parts.join('<br>') };
}

/** Series (minimum) and parallel (maximum) resonances of an impedance sweep. */
export function zMarkers(pts) {
  const marks = [], parts = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1].db, b = pts[i].db, c = pts[i + 1].db;
    if (b < a && b <= c && Math.max(a, c) - b > 0.5) { marks.push({ f: pts[i].f, db: b, label: 'min', color: '#4ade80' }); parts.push(`Series resonance (|Z| min ${fmtSI(Math.pow(10, b / 20), 'Ω', 4)}) at ${fmtSI(pts[i].f, 'Hz', 4)}`); }
    if (b > a && b >= c && b - Math.min(a, c) > 0.5) { marks.push({ f: pts[i].f, db: b, label: 'max', color: '#f472b6' }); parts.push(`Parallel resonance (|Z| max ${fmtSI(Math.pow(10, b / 20), 'Ω', 4)}) at ${fmtSI(pts[i].f, 'Hz', 4)}`); }
  }
  const z0 = Math.pow(10, pts[0].db / 20), z1 = Math.pow(10, pts[pts.length - 1].db / 20);
  parts.push(`|Z| = ${fmtSI(z0, 'Ω', 4)} at ${fmtSI(pts[0].f, 'Hz', 3)}, ${fmtSI(z1, 'Ω', 4)} at ${fmtSI(pts[pts.length - 1].f, 'Hz', 3)}`);
  return { marks: marks.slice(0, 6), summary: parts.slice(0, 6).join('<br>') };
}
