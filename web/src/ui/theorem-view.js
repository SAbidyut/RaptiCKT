// "Run with theorem": pick Thevenin, Norton, superposition or source transformation, pick the
// resistor whose current or voltage is wanted, then read the solution step by step — each step
// with its own circuit drawn — down to the final equivalent and the answer.

import { prepareTheorem, runTheorem, THEOREMS } from '../engine/theorem.js';
import { fmtSI } from '../engine/units.js';
import { boardFigure, ladderFigure, drawFigure } from './theorem-figs.js';
import { THEMES } from './theme.js';
import { icon } from './icons.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** **bold** and X_sub → X<sub>sub</sub> */
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\b([A-Za-z])_([A-Za-z0-9]+)/g, '$1<sub>$2</sub>');
const BADGE = { thevenin: 'Vth', norton: 'IN', superposition: 'Σ', source: 'V⇄I' };

export class TheoremView {
  constructor(editor, host) {
    this.ed = editor;
    this.host = host;
    this.stage = 'pick';
    this.want = 'I';
  }

  get isOpen() { return this.host.classList.contains('open'); }

  open() {
    const doc = this.ed.doc;
    this.prep = prepareTheorem(doc);
    const sel = this.ed.selected();
    const pre = sel && this.prep.targets.find((t) => doc.elements[t.src] === sel);
    this.target = pre ? pre.src : this.target != null && this.prep.targets.some((t) => t.src === this.target) ? this.target : null;
    this.stage = 'pick';
    this.host.classList.add('open');
    this.ed.overlayOpen('theorem');
    this.render();
  }

  close() { this.host.classList.remove('open'); this.ed.overlayClosed('theorem'); }

  /** Android back: one stage back, then close. */
  back() {
    if (this.stage === 'solve') this.go('target');
    else if (this.stage === 'target') this.go('pick');
    else this.close();
    return true;
  }

  go(stage) { this.stage = stage; this.render(); }

  render() {
    const th = THEOREMS.find((t) => t.id === this.theorem);
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
    else {
      if (prep.bad.length) issues.push(`Network theorems work on <b>linear DC circuits</b>: resistors, DC voltage and current sources, switches and meters. These parts can't be handled: ${esc(prep.bad.join(', '))}.`);
      if (!prep.targets.length) issues.push('Add a resistor: the theorem finds the current or voltage of a resistor (the load).');
      else if (!prep.sources.length) issues.push('There is no DC voltage or current source, so every current is zero.');
    }
    const blocked = !this.ed.doc.elements.length || prep.bad.length > 0 || !prep.targets.length;
    body.innerHTML = `
      <p class="an-help">Solve this circuit by hand, the way it is done in class: pick a network theorem, pick the resistor you want, and follow every step — each one with its circuit drawn — to the final equivalent circuit and the answer.</p>
      ${issues.map((t) => `<div class="th-warn">${icon('info', 16)}<span>${t}</span></div>`).join('')}
      <div class="th-cards">${THEOREMS.map((t) => `
        <button class="th-card" data-th="${t.id}" ${blocked ? 'disabled' : ''}>
          <i class="th-badge">${esc(BADGE[t.id])}</i>
          <span><b>${esc(t.title)}</b><small>${inline(t.desc)}</small></span>
          ${icon('chevLeft', 18)}
        </button>`).join('')}
      </div>`;
    body.querySelectorAll('[data-th]').forEach((b) => b.addEventListener('click', () => { this.theorem = b.dataset.th; this.go('target'); }));
  }

  // ---------------------------------------------------------- 2. component
  targetUI(body) {
    const { prep } = this;
    const els = this.ed.doc.elements;
    if (this.target == null || !prep.targets.some((t) => t.src === this.target)) this.target = prep.targets[prep.targets.length - 1].src;
    body.innerHTML = `
      <p class="th-q">Which resistor? <span>Tap it on the drawing or in the list.</span></p>
      <canvas class="th-fig th-pick"></canvas>
      <div class="th-chips">${prep.targets.map((t) => `<button class="chip2 ${t.src === this.target ? 'on' : ''}" data-t="${t.src}">${esc(t.name)} · ${esc(fmtSI(t.val, 'Ω', 4))}</button>`).join('')}</div>
      <p class="th-q">Find its</p>
      <div class="th-seg">
        <button data-w="I" class="${this.want === 'I' ? 'on' : ''}">Current I</button>
        <button data-w="V" class="${this.want === 'V' ? 'on' : ''}">Voltage V</button>
      </div>
      <div class="btn-row"><button class="btn primary big th-go">${icon('play', 18)} Solve step by step</button></div>`;
    const cv = body.querySelector('.th-pick');
    const draw = () => {
      const built = boardFigure(this.ed.doc, { target: this.target, highlight: [this.target], a: -1 }, prep.net);
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
    const res = runTheorem(prep, this.theorem, this.target, this.want);
    if (!res.ok) {
      body.innerHTML = `<div class="th-warn">${icon('info', 16)}<span>${esc(res.error)}</span></div>
        <div class="btn-row"><button class="btn" data-x="target">${icon('back', 16)} Choose another resistor</button></div>`;
      body.querySelector('[data-x=target]').addEventListener('click', () => this.go('target'));
      return;
    }
    const main = this.want === 'V' ? ['V', res.answer.V, 'V'] : ['I', res.answer.I, 'A'];
    body.innerHTML = `
      <div class="th-answer">
        <span>${esc(THEOREMS.find((x) => x.id === this.theorem).short)} · ${esc(t.name)} (${esc(fmtSI(t.val, 'Ω', 4))})</span>
        <b>${main[0]}<sub>L</sub> = ${esc(fmtSI(main[1], main[2], 4))}</b>
        <small>I<sub>L</sub> = ${esc(fmtSI(res.answer.I, 'A', 4))} · V<sub>L</sub> = ${esc(fmtSI(res.answer.V, 'V', 4))} · P<sub>L</sub> = ${esc(fmtSI(res.answer.P, 'W', 4))}</small>
      </div>
      ${res.steps.map((s) => {
        // "Step 2 — Find V_th": the number goes in the badge
        const m = s.title.match(/^Step (\d+) — (.*)$/);
        return `
        <section class="th-step">
          <h3><i class="${m ? '' : 'dot'}">${m ? m[1] : ''}</i><span>${inline(m ? m[2] : s.title)}</span></h3>
          ${s.fig ? '<canvas class="th-fig"></canvas>' : ''}
          ${s.blocks.map((b) => this.block(b)).join('')}
          ${s.result.length ? `<div class="th-res">${s.result.map(([k, v]) => `<span>${inline(k)} = <b>${esc(v)}</b></span>`).join('')}</div>` : ''}
        </section>`;
      }).join('')}
      <div class="btn-row th-end">
        <button class="btn" data-x="pick">${icon('layers', 16)} Another theorem</button>
        <button class="btn" data-x="target">${icon('target', 16)} Another resistor</button>
        <button class="btn primary" data-x="run">${icon('play', 16)} Run the circuit</button>
      </div>`;
    body.querySelector('[data-x=pick]').addEventListener('click', () => this.go('pick'));
    body.querySelector('[data-x=target]').addEventListener('click', () => this.go('target'));
    body.querySelector('[data-x=run]').addEventListener('click', () => this.runCircuit());
    const cvs = body.querySelectorAll('.th-step');
    requestAnimationFrame(() => res.steps.forEach((s, i) => {
      const cv = cvs[i].querySelector('canvas');
      if (!cv) return;
      const built = s.fig.kind === 'board' ? boardFigure(this.ed.doc, s.fig, prep.net) : ladderFigure(s.fig);
      if (built) drawFigure(cv, built, this.theme(), this.ed.settings);
      else cv.remove();
    }));
  }

  block(b) {
    if (b.t === 'p') return `<p>${inline(b.text)}</p>`;
    if (b.t === 'f') return `<pre class="lf-f">${b.lines.map(esc).join('\n')}</pre>`;
    if (b.t === 'tip') return `<div class="lf-tip">${icon('check', 16)}<span>${inline(b.text)}</span></div>`;
    return '';
  }

  theme() { return THEMES[this.ed.settings.theme] || THEMES.dark; }

  /** Back to the board, running, with the load selected so its live reading shows. */
  runCircuit() {
    const el = this.ed.doc.elements[this.target];
    this.close();
    if (!this.ed.running || this.ed.paused) this.ed.setRunning(true);
    if (el) this.ed.select(el);
  }
}
