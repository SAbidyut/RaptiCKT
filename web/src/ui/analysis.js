// Analysis centre: AC frequency sweep (Bode plot), DC sweep, DC operating
// point table and SPICE netlist export.

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
    ({ bode: () => this.bodeUI(body), dc: () => this.dcUI(body), op: () => this.opUI(body), net: () => this.netUI(body) })[this.tab]();
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
        ctx.fillStyle = '#facc15'; ctx.textAlign = 'right'; ctx.fillText(d.toFixed(0) + ' dB', L - 4, Yd(d) + 3);
      }
      for (let k = 0; k <= 4; k++) {
        const p = pmin + ((pmax - pmin) * k) / 4;
        ctx.fillStyle = '#22d3ee'; ctx.textAlign = 'left'; ctx.fillText(p.toFixed(0) + '°', W - R + 4, Yp(p) + 3);
      }
      line(ctx, pts.map((p) => [X(p.f), Yp(p.ph)]), '#22d3ee', 1.6, [5, 4]);
      line(ctx, pts.map((p) => [X(p.f), Yd(p.db)]), '#facc15', 2.4);
      // markers
      const m = bodeMarkers(pts);
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
        body.querySelector('#an-cur').textContent = `f = ${fmtSI(p.f, 'Hz', 4)}   |H| = ${p.db.toFixed(2)} dB (${fmtSI(Math.pow(10, p.db / 20), '', 4)})   ∠ = ${p.ph.toFixed(1)}°`;
      }
      body.querySelector('#an-sum').innerHTML = `<b>${esc(data.label)}</b> / ${esc(data.src)} · ${pts.length} points in ${data.ms.toFixed(0)} ms<br>${m.summary}`;
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

  exportCSV() {
    const d = this.last;
    if (!d) return this.ed.toast('Run an analysis first');
    let csv = '';
    if (d.kind === 'bode') csv = 'frequency_Hz,magnitude_dB,phase_deg\n' + d.pts.map((p) => `${p.f},${p.db},${p.ph}`).join('\n');
    if (d.kind === 'dc') csv = [`${d.xlabel},${d.series.map((s) => s.label).join(',')}`, ...d.series[0].pts.map((p, i) => [p[0], ...d.series.map((s) => s.pts[i][1])].join(','))].join('\n');
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
