// Floating digital multimeter with draggable red/black probes.

import { fmtSI } from '../engine/units.js';
import { icon } from './icons.js';

export class Multimeter {
  constructor(editor, host) {
    this.ed = editor;
    this.host = host;
    this.mode = 'V';
    this.avg = 0; this.ms = 0;
    host.innerHTML = `
      <div class="dmm-head"><b>${icon('meter', 16)} Multimeter</b><button class="icon-btn sm" data-a="close">${icon('x', 16)}</button></div>
      <div class="dmm-lcd"><small class="dmm-sub"></small><div class="dmm-val">—</div><small class="dmm-sub2"></small></div>
      <div class="seg">${['V', 'A', 'Ω', 'W'].map((m) => `<button data-m="${m}" class="${m === 'V' ? 'on' : ''}">${m}</button>`).join('')}</div>
      <p class="dmm-hint"></p>`;
    host.querySelector('[data-a=close]').addEventListener('click', () => this.ed.toggleMeter(false));
    host.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
      this.mode = b.dataset.m;
      host.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b));
      this.avg = 0; this.ms = 0; this.zCache = null;
      this.update(0);
    }));
  }

  get open() { return this.host.classList.contains('open'); }

  show(on) {
    this.host.classList.toggle('open', on);
    if (on && !this.ed.meterProbes) {
      const r = this.ed.renderer;
      const [cx, cy] = r.toWorld(r.cw / 2, r.ch / 2);
      const s = (v) => Math.round(v / 20) * 20;
      this.ed.meterProbes = { red: [s(cx - 40), s(cy)], black: [s(cx + 40), s(cy)] };
    }
    this.update(0);
  }

  update(dtReal) {
    if (!this.open) return;
    const ed = this.ed, sim = ed.sim, live = ed.running && sim && sim.ready;
    const val = this.host.querySelector('.dmm-val'), sub = this.host.querySelector('.dmm-sub'), sub2 = this.host.querySelector('.dmm-sub2');
    const hint = this.host.querySelector('.dmm-hint');
    const nodeAt = (p) => (sim && sim.pointNode ? sim.pointNode(p[0], p[1]) : -1);
    const ema = (x) => {
      const a = Math.min(1, dtReal / 0.4) || 1;
      this.avg += (x - this.avg) * a; this.ms += (x * x - this.ms) * a;
    };
    if (this.mode === 'V' || this.mode === 'Ω') {
      hint.textContent = 'Drag the red (+) and black (−) probes onto nodes.';
      const nr = nodeAt(ed.meterProbes.red), nb = nodeAt(ed.meterProbes.black);
      if (!live || nr < 0 || nb < 0) {
        val.textContent = '—'; sub.textContent = !live ? 'Start the simulation' : 'Probe not on a node'; sub2.textContent = '';
        return;
      }
      if (this.mode === 'V') {
        const v = sim.nodeVoltage(nr) - sim.nodeVoltage(nb);
        ema(v);
        val.textContent = fmtSI(this.avg, 'V', 4);
        sub.textContent = 'DC (average)';
        sub2.textContent = `AC RMS ${fmtSI(Math.sqrt(Math.max(0, this.ms - this.avg * this.avg)), 'V', 3)} · inst ${fmtSI(v, 'V', 3)}`;
      } else {
        const now = performance.now();
        if (!this.zCache || now - this.zCache.t > 400 || this.zCache.k !== nr + ':' + nb) {
          const z = sim.impedance(nr, nb, 1e-3);
          this.zCache = { t: now, k: nr + ':' + nb, z };
        }
        const z = this.zCache.z;
        val.textContent = !z ? 'OL' : Math.abs(z.re) > 1e11 ? 'OL' : fmtSI(Math.abs(z.re), 'Ω', 4);
        sub.textContent = 'Small-signal resistance';
        sub2.textContent = 'Sources zeroed, devices linearised at the operating point';
      }
      return;
    }
    const el = ed.selected();
    hint.textContent = 'Select a component to measure it.';
    if (!live || !el || el.nodes.length < 2) {
      val.textContent = '—'; sub.textContent = !live ? 'Start the simulation' : 'No component selected'; sub2.textContent = '';
      return;
    }
    if (this.mode === 'A') {
      ema(el.i);
      val.textContent = fmtSI(this.avg, 'A', 4);
      sub.textContent = `${el.name} · DC (average)`;
      sub2.textContent = `RMS ${fmtSI(Math.sqrt(Math.max(0, this.ms)), 'A', 3)} · inst ${fmtSI(el.i, 'A', 3)}`;
    } else {
      const p = (sim.v(el.nodes[0]) - sim.v(el.nodes[1])) * el.i;
      ema(p);
      val.textContent = fmtSI(this.avg, 'W', 4);
      sub.textContent = `${el.name} · average power`;
      sub2.textContent = `inst ${fmtSI(p, 'W', 3)} (+ = absorbed)`;
    }
  }
}
