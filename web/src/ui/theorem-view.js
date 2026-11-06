// "Run with theorem": pick Thevenin, Norton, superposition or source transformation, pick the
// resistor whose current or voltage is wanted, then read the solution step by step — each step
// with its own circuit drawn — down to the final equivalent and the answer.

import { prepareTheorem, runTheorem, THEOREMS } from '../engine/theorem.js';
import { isACDoc, prepareAC, runACTheorem, AC_THEOREMS } from '../engine/theorem-ac.js';
import { fmtSI } from '../engine/units.js';
import { boardFigure, ladderFigure, drawFigure, acEquivalentFigure } from './theorem-figs.js';
import { THEMES } from './theme.js';
import { icon } from './icons.js';
import { esc } from './html.js';

/** **bold** and X_sub → X<sub>sub</sub> */
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\b([A-Za-z])_([A-Za-z0-9]+)/g, '$1<sub>$2</sub>');
const BADGE = { thevenin: 'V_th', norton: 'I_N', superposition: 'Σ', source: 'V⇄I', maxpower: 'P_max', millman: 'V_M', reciprocity: 'x⇄y', tellegen: 'Σp=0', nodal: 'KCL', mesh: 'KVL' };
const METHOD_KEY = 'raptickt.theorem.method';

export class TheoremView {
  constructor(editor, host) {
    this.ed = editor;
    this.host = host;
    this.stage = 'pick';
    this.want = 'I';
    // how node voltages are found inside a theorem's steps: 'nodal' or 'mesh' (remembered)
    try { this.method = localStorage.getItem(METHOD_KEY) === 'mesh' ? 'mesh' : 'nodal'; } catch { this.method = 'nodal'; }
  }

  get isOpen() { return this.host.classList.contains('open'); }

  open() {
    const doc = this.ed.doc;
    // an AC circuit (sine / cosine sources, or the phasor domain on): the theorems in phasors
    this.ac = isACDoc(doc);
    this.prep = this.ac ? prepareAC(doc) : prepareTheorem(doc);
    const sel = this.ed.selected();
    const pre = sel && this.prep.targets.find((t) => doc.elements[t.src] === sel);
    this.target = pre ? pre.src : this.target != null && this.prep.targets.some((t) => t.src === this.target) ? this.target : null;
    this.stage = 'pick';
    this.host.classList.add('open');
    this.render();
  }

  close() { this.host.classList.remove('open'); }

  /** Android back: a zoomed drawing first, then one stage back, then close. */
  back() {
    if (this.zoomed) this.unzoom();
    else if (this.stage === 'solve') this.go('target');
    else if (this.stage === 'target') this.go('pick');
    else this.close();
    return true;
  }

  go(stage) { this.stage = stage; this.render(); }

  /**
   * A step's drawing on the whole screen, as big as it fits: pinch or double-tap to zoom in
   * further, drag to move round it; Back (or ✕) returns to the steps.
   */
  zoom(built, title) {
    this.unzoom();
    const z = document.createElement('div');
    z.className = 'th-zoom';
    z.innerHTML = `
      <div class="an-head">
        <button class="icon-btn" data-z="close" title="Back">${icon('back', 22)}</button>
        <b>${inline(title)}</b>
        <span class="grow"></span>
        <button class="icon-btn" data-z="turn" title="Turn sideways">${icon('rotate', 20)}</button>
        <button class="icon-btn" data-z="fit" title="Fit">${icon('fit', 20)}</button>
      </div>
      <div class="th-zoom-body"><canvas class="th-zoom-cv"></canvas></div>
      <p class="th-zoom-hint">Pinch or double-tap to zoom · drag to move</p>`;
    this.host.appendChild(z);
    this.zoomed = z;
    const body = z.querySelector('.th-zoom-body'), cv = z.querySelector('canvas');
    // the drawing fills the screen; zooming further scales and moves it
    // (turned a quarter round, a wide drawing takes the tall screen's length: turn the phone)
    let s = 1, tx = 0, ty = 0, turned = false;
    const apply = () => { cv.style.transform = `translate(${tx}px, ${ty}px)${turned ? ' rotate(90deg)' : ''} scale(${s})`; };
    const paint = () => {
      const W = body.clientWidth, H = body.clientHeight;
      cv.style.width = (turned ? H : W) + 'px';
      cv.style.left = (turned ? (W - H) / 2 : 0) + 'px';
      cv.style.top = (turned ? (H - W) / 2 : 0) + 'px';
      // (measured untransformed: the canvas takes its pixel size from its box on screen)
      cv.style.transform = 'none';
      drawFigure(cv, built, this.theme(), this.ed.settings, turned ? W : H, { fill: true, maxK: 3 });
      s = 1; tx = ty = 0;
      apply();
    };
    const clamp = () => {
      s = Math.max(1, Math.min(5, s));
      const mx = (body.clientWidth * (s - 1)) / 2, my = (body.clientHeight * (s - 1)) / 2;
      tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty));
      apply();
    };
    // zoom by f keeping the point (px, py) of the view (from its centre) where it is
    const zoomAt = (f, px, py) => { const ns = Math.max(1, Math.min(5, s * f)); f = ns / s; tx = px - (px - tx) * f; ty = py - (py - ty) * f; s = ns; clamp(); };
    requestAnimationFrame(() => {
      // a wide drawing on an upright screen starts turned: it comes out biggest so
      const b = built.doc.bounds();
      turned = !!b && body.clientHeight > body.clientWidth && b[2] - b[0] > 1.2 * (b[3] - b[1]);
      z.querySelector('[data-z=turn]').classList.toggle('on', turned);
      paint();
    });
    const pts = new Map();
    let last = null, tap = 0;
    const centre = (e) => { const r = body.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; };
    body.addEventListener('pointerdown', (e) => {
      body.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, centre(e));
      last = null;
      if (pts.size === 1) {
        const now = Date.now();
        if (now - tap < 300) { const [px, py] = centre(e); if (s > 1.05) { s = 1; tx = ty = 0; clamp(); } else zoomAt(2.5, px, py); tap = 0; } else tap = now;
      }
    });
    body.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId), cur = centre(e);
      pts.set(e.pointerId, cur);
      if (pts.size === 1) { tx += cur[0] - prev[0]; ty += cur[1] - prev[1]; clamp(); return; }
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (last) { zoomAt(d / Math.max(1, last.d), mid[0], mid[1]); tx += mid[0] - last.mid[0]; ty += mid[1] - last.mid[1]; clamp(); }
      last = { d, mid };
    });
    const up = (e) => { pts.delete(e.pointerId); last = null; };
    body.addEventListener('pointerup', up);
    body.addEventListener('pointercancel', up);
    body.addEventListener('wheel', (e) => { e.preventDefault(); const [px, py] = centre(e); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, px, py); }, { passive: false });
    z.querySelector('[data-z=close]').addEventListener('click', () => this.unzoom());
    z.querySelector('[data-z=fit]').addEventListener('click', () => { s = 1; tx = ty = 0; clamp(); });
    z.querySelector('[data-z=turn]').addEventListener('click', (e) => { turned = !turned; e.currentTarget.classList.toggle('on', turned); paint(); });
  }

  unzoom() {
    if (!this.zoomed) return;
    this.zoomed.remove();
    this.zoomed = null;
  }

  render() {
    this.unzoom();
    const th = this.list().find((t) => t.id === this.theorem);
    const title = this.stage === 'pick' ? 'Run with theorem' : th.title;
    this.host.innerHTML = `
      <div class="an-head">
        <button class="icon-btn" data-x="back" title="Back">${icon('back', 22)}</button>
        <b>${esc(title)}</b>
        <span class="grow"></span>
        <div class="th-crumbs">${['Theorem', 'Component', 'Solution'].map((s, i) => `<i class="${['pick', 'target', 'solve'].indexOf(this.stage) >= i ? 'on' : ''}">${i + 1}</i>`).join('')}</div>
      </div>
      <div class="an-body th-body"></div>`;
    this.host.querySelector('[data-x=back]').addEventListener('click', () => this.back());
    const body = this.host.querySelector('.th-body');
    ({ pick: () => this.pickUI(body), target: () => this.targetUI(body), solve: () => this.solveUI(body) })[this.stage]();
    body.scrollTop = 0;
  }

  // ---------------------------------------------------------- 1. theorem
  pickUI(body) {
    const { prep } = this;
    const issues = [];
    if (!this.ed.doc.elements.length) issues.push('The board is empty. Build a circuit with resistors and DC sources first.');
    else if (this.ac) {
      if (prep.bad.length) issues.push(`AC theorems work on <b>linear circuits in the sinusoidal steady state</b>: R, L, C, mutual inductances, sine / cosine / DC sources, dependent sources, switches and meters. These parts can't be handled: ${esc(prep.bad.join(', '))}.`);
      if (!prep.targets.length) issues.push('Add a resistor, inductor or capacitor: the theorem finds the current or voltage of one of them (the load).');
      else if (!prep.sources.length) issues.push('There is no independent source, so every current is zero.');
    } else {
      if (prep.bad.length) issues.push(`Network theorems work on <b>linear DC circuits</b>: resistors, DC voltage and current sources, switches and meters. These parts can't be handled: ${esc(prep.bad.join(', '))}.`);
      if (!prep.targets.length) issues.push('Add a resistor: the theorem finds the current or voltage of a resistor (the load).');
      else if (!prep.sources.length) issues.push('There is no DC voltage or current source, so every current is zero.');
    }
    const blocked = !this.ed.doc.elements.length || prep.bad.length > 0 || !prep.targets.length;
    body.innerHTML = `
      <p class="an-help">${this.ac ? 'This is an <b>AC circuit</b>: it is solved in the <b>phasor domain</b>, the way Alexander &amp; Sadiku do it — transform the circuit (V<sub>m</sub>∠φ, jωL, 1/(jωC)), solve it, and turn the phasor back into a sinusoid. Pick a method and the part you want.' : 'Solve this circuit by hand, the way it is done in class: pick a network theorem, pick the resistor you want, and follow every step — each one with its circuit drawn — to the final equivalent circuit and the answer.'}</p>
      ${issues.map((t) => `<div class="th-warn">${icon('info', 16)}<span>${t}</span></div>`).join('')}
      ${[['Network theorems', this.list().filter((t) => !t.method)], ['Analysis methods', this.list().filter((t) => t.method)]].map(([head, list]) => `
      <h4 class="th-group">${head}</h4>
      <div class="th-cards">${list.map((t) => `
        <button class="th-card" data-th="${t.id}" ${blocked ? 'disabled' : ''}>
          <i class="th-badge"><span>${inline(BADGE[t.id])}</span></i>
          <span><b>${esc(t.title)}</b><small>${inline(t.desc)}</small></span>
          ${icon('chevLeft', 18)}
        </button>`).join('')}
      </div>`).join('')}`;
    body.querySelectorAll('[data-th]').forEach((b) => b.addEventListener('click', () => { this.theorem = b.dataset.th; this.go('target'); }));
  }

  // ---------------------------------------------------------- 2. component
  targetUI(body) {
    const { prep } = this;
    const els = this.ed.doc.elements;
    if (this.target == null || !prep.targets.some((t) => t.src === this.target)) this.target = prep.targets[prep.targets.length - 1].src;
    body.innerHTML = `
      <p class="th-q">${this.ac ? 'Which part?' : 'Which resistor?'} <span>Tap it on the drawing or in the list.</span></p>
      <canvas class="th-fig th-pick"></canvas>
      <div class="th-chips">${prep.targets.map((t) => `<button class="chip2 ${t.src === this.target ? 'on' : ''}" data-t="${t.src}">${esc(t.name)} · ${esc(t.valText ?? fmtSI(t.val, 'Ω', 4))}</button>`).join('')}</div>
      <p class="th-q">Find its</p>
      <div class="th-seg">
        <button data-w="I" class="${this.want === 'I' ? 'on' : ''}">Current I</button>
        <button data-w="V" class="${this.want === 'V' ? 'on' : ''}">Voltage V</button>
      </div>
      <div class="btn-row"><button class="btn primary big th-go">${icon('play', 18)} Solve step by step</button></div>`;
    const cv = body.querySelector('.th-pick');
    const draw = () => {
      const built = this.ac ? this.figure({ kind: 'board', phasor: true, omega: prep.omegas.length === 1 ? prep.omegas[0] : null, target: this.target, highlight: [this.target], a: -1 })
        : boardFigure(this.ed.doc, { target: this.target, highlight: [this.target], a: -1 }, prep.net);
      this.pickView = drawFigure(cv, built, this.theme(), this.ed.settings, 300);
    };
    requestAnimationFrame(draw);
    const choose = (src) => {
      this.target = src;
      body.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', +b.dataset.t === src));
      draw();
    };
    body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => choose(+b.dataset.t)));
    cv.addEventListener('click', (ev) => {
      const r = this.pickView, rect = cv.getBoundingClientRect();
      if (!r) return;
      const [wx, wy] = r.toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
      const hit = prep.targets.find((t) => els[t.src].hitTest(wx, wy, 6 / r.scale));
      if (hit) choose(hit.src);
    });
    body.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => {
      this.want = b.dataset.w;
      body.querySelectorAll('[data-w]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    body.querySelector('.th-go').addEventListener('click', () => this.go('solve'));
  }

  // ---------------------------------------------------------- 3. solution
  solveUI(body) {
    const prep = this.prep;
    const t = prep.targets.find((x) => x.src === this.target);
    prep.style = this.ed.doc.elements[this.target]?.p.style;
    const res = this.ac ? runACTheorem(prep, this.theorem, this.target, this.want) : runTheorem(prep, this.theorem, this.target, this.want);
    if (!res.ok) {
      body.innerHTML = `<div class="th-warn">${icon('info', 16)}<span>${esc(res.error)}</span></div>
        <div class="btn-row"><button class="btn" data-x="target">${icon('back', 16)} ${this.ac ? 'Choose another part' : 'Choose another resistor'}</button></div>`;
      body.querySelector('[data-x=target]').addEventListener('click', () => this.go('target'));
      return;
    }
    const main = this.want === 'V' ? ['V', res.answer.V, 'V'] : ['I', res.answer.I, 'A'];
    // a theorem whose result is not the load current (maximum power, Tellegen) says what it found
    const head = res.head
      ? `<b>${inline(res.head.main)}</b><small>${inline(res.head.sub)}</small>`
      : `<b>${main[0]}<sub>L</sub> = ${esc(fmtSI(main[1], main[2], 4))}</b>
        <small>I<sub>L</sub> = ${esc(fmtSI(res.answer.I, 'A', 4))} · V<sub>L</sub> = ${esc(fmtSI(res.answer.V, 'V', 4))} · P<sub>L</sub> = ${esc(fmtSI(res.answer.P, 'W', 4))}</small>`;
    body.innerHTML = `
      <div class="th-answer">
        <span>${esc(this.list().find((x) => x.id === this.theorem).short)} · ${esc(t.name)} (${esc(t.valText ?? fmtSI(t.val, 'Ω', 4))})</span>
        ${head}
      </div>
      ${res.steps.map((s) => {
        // "Step 2 — Find V_th": the number goes in the badge
        const m = s.title.match(/^Step (\d+) — (.*)$/);
        return `
        <section class="th-step">
          <h3><i class="${m ? '' : 'dot'}">${m ? m[1] : ''}</i><span>${inline(m ? m[2] : s.title)}</span></h3>
          ${s.fig ? `<div class="th-figwrap"><canvas class="th-fig th-zoomable" title="Tap to zoom"></canvas><i class="th-zoomtag">${icon('fullscreen', 14)}</i></div>` : ''}
          ${s.blocks.map((b) => this.block(b)).join('')}
          ${s.result.length ? `<div class="th-res">${s.result.map(([k, v]) => `<span>${inline(k)} = <b>${esc(v)}</b></span>`).join('')}</div>` : ''}
        </section>`;
      }).join('')}
      <div class="btn-row th-end">
        <button class="btn" data-x="pick">${icon('layers', 16)} Another theorem</button>
        <button class="btn" data-x="target">${icon('target', 16)} ${this.ac ? 'Another part' : 'Another resistor'}</button>
        <button class="btn primary" data-x="run">${icon('play', 16)} Run the circuit</button>
      </div>`;
    body.querySelector('[data-x=pick]').addEventListener('click', () => this.go('pick'));
    body.querySelector('[data-x=target]').addEventListener('click', () => this.go('target'));
    body.querySelector('[data-x=run]').addEventListener('click', () => this.runCircuit());
    const cvs = body.querySelectorAll('.th-step');
    const draw = (i) => {
      const s = res.steps[i], cv = cvs[i].querySelector('canvas');
      if (!cv) return;
      const built = this.figure(s.fig);
      if (!built) { cv.remove(); return; }
      drawFigure(cv, built, this.theme(), this.ed.settings);
      // a tap shows it on the whole screen
      cv.onclick = () => this.zoom(built, s.title.replace(/^Step \d+ — /, ''));
    };
    requestAnimationFrame(() => res.steps.forEach((s, i) => draw(i)));
    // Nodal ⇄ Mesh: every switch on the page follows, and the drawings show node names or mesh currents
    body.querySelectorAll('.th-alt [data-m]').forEach((b) => b.addEventListener('click', () => {
      const m = b.dataset.m;
      if (m === this.method) return;
      this.method = m;
      try { localStorage.setItem(METHOD_KEY, m); } catch { /* not kept */ }
      body.querySelectorAll('.th-alt [data-m]').forEach((x) => x.classList.toggle('on', x.dataset.m === m));
      body.querySelectorAll('.th-alt-b').forEach((x) => { x.hidden = x.dataset.b !== m; });
      res.steps.forEach((s, i) => { if (s.fig && s.fig.meshes) draw(i); });
    }));
  }

  block(b) {
    if (b.t === 'p') return `<p>${inline(b.text)}</p>`;
    if (b.t === 'f') return `<div class="th-math">${b.lines.map((l) => `<div class="ml${/^\s/.test(l) ? ' cont' : ''}">${mathHTML(l.trim())}</div>`).join('')}</div>`;
    if (b.t === 'tip') return `<div class="lf-tip">${icon('check', 16)}<span>${inline(b.text)}</span></div>`;
    if (b.t === 'table') {
      return `<div class="th-tw"><table class="th-tbl"><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${b.rows.map((r, i) => `<tr class="${i === b.mark ? 'mark' : ''}">${r.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    if (b.t === 'curve') return curveSVG(b);
    if (b.t === 'matrix') {
      const col = (cells) => `<span class="mx"><table>${cells.map((r) => `<tr>${(Array.isArray(r) ? r : [r]).map((x) => `<td>${mathHTML(x)}</td>`).join('')}</tr>`).join('')}</table></span>`;
      return `<div class="th-math th-mx">${col(b.A)}${col(b.x)}<span class="mx-eq">=</span>${col(b.b)}</div>`;
    }
    if (b.t === 'alt') {
      return `<div class="th-alt"><div class="th-seg th-mseg">${b.opts.map((o) => `<button data-m="${o.id}" class="${o.id === this.method ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div>
        ${b.opts.map((o) => `<div class="th-alt-b" data-b="${o.id}" ${o.id === this.method ? '' : 'hidden'}>${o.blocks.map((x) => this.block(x)).join('')}</div>`).join('')}</div>`;
    }
    return '';
  }

  theme() { return THEMES[this.ed.settings.theme] || THEMES.dark; }

  /** the theorems for this circuit: the DC ones, or the phasor ones for an AC circuit */
  list() { return this.ac ? AC_THEOREMS : THEOREMS; }

  /** a step's drawing: the board changed (in the phasor domain for an AC step), or an equivalent */
  figure(fig) {
    const prep = this.prep;
    if (fig.kind === 'equiv') return acEquivalentFigure(fig, this.ed.doc);
    if (fig.kind !== 'board') return ladderFigure(fig);
    if (!prep.ac) return boardFigure(this.ed.doc, fig, prep.net, this.method);
    // the AC network seen as boardFigure expects it: the load and the drawing's points
    const T = prep.net.elems.find((e) => e.src === fig.target && e.kind === 'Z');
    const net = { posts: prep.net.posts, nodePos: prep.net.nodePos, elems: T ? [{ src: T.src, kind: 'R', n: T.n }] : [] };
    const built = boardFigure(this.ed.doc, fig, net, this.method);
    if (fig.phasor) { built.doc.domain = 'phasor'; built.doc.forceOmega = fig.omega ?? null; }
    return built;
  }

  /** Back to the board, running, with the load selected so its live reading shows. */
  runCircuit() {
    const el = this.ed.doc.elements[this.target];
    this.close();
    if (!this.ed.running || this.ed.paused) this.ed.setRunning(true);
    if (el) this.ed.select(el);
  }
}

/** P_L against R_L (log scale) with the peak at R_th and the present load marked. */
function curveSVG({ pts, now, best, xl, yl }) {
  const W = 320, H = 170, L = 44, R = 34, T = 16, B = 30;
  const x0 = Math.log10(pts[0][0]), x1 = Math.log10(pts[pts.length - 1][0]);
  const ymax = best[1] * 1.12;
  const X = (x) => L + ((Math.log10(Math.min(Math.max(x, pts[0][0]), pts[pts.length - 1][0])) - x0) / (x1 - x0)) * (W - L - R);
  const Y = (y) => T + (1 - y / ymax) * (H - T - B);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('');
  const f = (v, u) => esc(fmtSI(v, u, 3));
  const sub = (t) => esc(t).replace(/_(\w+)/g, '<tspan baseline-shift="sub" font-size="80%">$1</tspan>');
  const ticks = [pts[0][0], best[0], pts[pts.length - 1][0]];
  return `<svg class="th-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="Load power against load resistance">
    <line x1="${L}" y1="${Y(0)}" x2="${W - R}" y2="${Y(0)}" class="ax"/><line x1="${L}" y1="${T}" x2="${L}" y2="${Y(0)}" class="ax"/>
    <line x1="${X(best[0])}" y1="${T}" x2="${X(best[0])}" y2="${Y(0)}" class="grid"/>
    ${ticks.map((x) => `<text x="${X(x)}" y="${H - 14}" text-anchor="middle">${f(x, 'Ω')}</text>`).join('')}
    <text x="${W - R}" y="${Y(0) - 6}" text-anchor="end">${sub(xl)}</text>
    <text x="${L - 4}" y="${Y(best[1]) + 4}" text-anchor="end">${f(best[1], 'W')}</text>
    <text x="${L - 4}" y="${T - 2}" text-anchor="end">${sub(yl)}</text>
    <path d="${d}" class="line"/>
    <circle cx="${X(best[0])}" cy="${Y(best[1])}" r="5" class="best"/>
    <text x="${X(best[0]) + 8}" y="${Y(best[1]) - 6}" class="lbest">${sub('max at R_th')}</text>
    <circle cx="${X(now[0])}" cy="${Y(now[1])}" r="5" class="now"/>
    <text x="${X(now[0]) + (X(now[0]) > W / 2 ? -8 : 8)}" y="${Y(now[1]) + 17}" text-anchor="${X(now[0]) > W / 2 ? 'end' : 'start'}" class="lnow">now ${f(now[0], 'Ω')}</text>
  </svg>`;
}

/**
 * Typeset formula markup the way a textbook prints it: \frac{a}{b} stacked over a bar,
 * x_{s} with the letter in italics and s below, x^{2} above, \t{words} as plain words.
 */
function mathHTML(src) {
  // a number keeps its unit and a product its factors on one line; minus signs are true minus signs
  src = src.replace(/(^|[\s(=])-(?=\d)/g, '$1−').replace(/(\d) (?=[A-Za-zΩµμ°%])/g, '$1\u00a0').replace(/ × /g, '\u00a0×\u00a0');
  let i = 0;
  const parse = (inGroup) => {
    let out = '';
    while (i < src.length) {
      const c = src[i];
      if (c === '}' && inGroup) { i++; return out; }
      if (src.startsWith('\\frac{', i)) {
        i += 6;
        const num = parse(true);
        let den = '';
        if (src[i] === '{') { i++; den = parse(true); }
        out += `<span class="mf"><span class="mn">${num}</span><span class="md">${den}</span></span>`;
        continue;
      }
      if (src.startsWith('\\t{', i)) { i += 3; out += `<span class="mt">${parse(true)}</span>`; continue; }
      if ((c === '_' || c === '^') && i + 1 < src.length) {
        let g;
        if (src[i + 1] === '{') { i += 2; g = parse(true); } else { g = esc(src[i + 1]); i += 2; }
        if (c === '_') out = out.replace(/(^|[^A-Za-z])([A-Za-z])$/, '$1<i>$2</i>'); // a variable: its letter in italics
        out += c === '_' ? `<sub>${g}</sub>` : `<sup>${g}</sup>`;
        continue;
      }
      out += esc(c);
      i++;
    }
    return out;
  };
  return parse(false);
}
