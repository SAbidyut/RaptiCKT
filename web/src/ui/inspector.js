// Component inspector (bottom sheet) and the EveryCircuit-style rotary knob.

import { fmtSI, parseSI, fmtQty, isPlainUnit } from '../engine/units.js';
import { icon } from './icons.js';
import { Renderer } from './render.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toSlider(pr, v) {
  const lo = pr.min ?? 0, hi = pr.max ?? 1;
  if (pr.log && lo > 0) return (Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
  return (v - lo) / (hi - lo);
}
function fromSlider(pr, t) {
  const lo = pr.min ?? 0, hi = pr.max ?? 1;
  if (pr.log && lo > 0) return niceRound(Math.pow(10, Math.log10(lo) + t * (Math.log10(hi) - Math.log10(lo))));
  return niceRound(lo + t * (hi - lo));
}
export function niceRound(v) {
  if (v === 0 || !Number.isFinite(v)) return v;
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 2);
  return Math.round(v / p) * p;
}

export class Inspector {
  constructor(editor, host, quick) {
    this.ed = editor;
    this.host = host;     // full property sheet
    this.quick = quick;   // compact floating bar shown on selection
    this.el = null;
    this.sheetOpen = false;
    this.iconCache = new Map();
  }

  icon(C) {
    const k = C.type + this.ed.settings.theme;
    if (!this.iconCache.has(k)) this.iconCache.set(k, Renderer.iconFor(C, this.ed.theme, 44));
    return this.iconCache.get(k);
  }

  /** Select an element: show the compact quick bar (no sheet animation). */
  show(el) {
    const same = el && el === this.el;
    this.el = el;
    if (!el) {
      this.closeSheet();
      this.quick.classList.remove('open');
      this.ed.knob.hide();
      return;
    }
    if (!same) this.renderQuick();
    this.quick.classList.add('open');
    if (this.sheetOpen) this.render();
    const kp = el.knobProp();
    if (kp && !this.sheetOpen) this.ed.knob.show(el, kp); else this.ed.knob.hide();
  }

  renderQuick() {
    const e = this.el, C = e.constructor;
    const posts = e.localPosts().length;
    const canScope = posts >= 1 && C.type !== 'ground' && C.type !== 'label';
    this.quick.innerHTML = `
      <button class="qb-main" data-q="edit">
        <img src="${this.icon(C)}" alt="">
        <div><b>${esc(e.name)} <small>${esc(C.title)}</small></b><span class="qb-read"></span></div>
      </button>
      ${this.ed.constructor.isPolar(e) ? `<button data-q="reverse" title="Reverse polarity">${icon('polarity', 19)}</button>` : ''}
      <button data-q="rotate" title="Rotate">${icon('rotate', 19)}</button>
      ${canScope ? `<button data-q="scope" title="Add to oscilloscope">${icon('scope', 19)}</button>` : ''}
      <button data-q="edit" title="Edit properties">${icon('sliders', 19)}</button>
      <button data-q="del" class="danger" title="Delete">${icon('trash', 19)}</button>`;
    this.quick.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.q;
      if (a === 'edit') this.openSheet();
      if (a === 'rotate') this.ed.rotateSelection();
      if (a === 'reverse') this.ed.reversePolarity();
      if (a === 'del') this.ed.deleteSelection();
      if (a === 'scope') this.ed.addProbe({ kind: posts >= 2 ? 'volt' : 'cur', el: this.el.id });
    }));
    this.updateReadings();
  }

  openSheet() {
    if (!this.el) return;
    this.sheetOpen = true;
    this.render();
    this.host.classList.add('open');
    this.ed.root.classList.add('sheet-open');
    this.ed.knob.hide();
    this.ed.overlayOpen('inspector');
  }

  closeSheet() {
    if (!this.sheetOpen) return;
    this.sheetOpen = false;
    this.host.classList.remove('open');
    this.ed.root.classList.remove('sheet-open');
    this.ed.overlayClosed('inspector');
    const kp = this.el && this.el.knobProp();
    if (kp) this.ed.knob.show(this.el, kp);
  }

  render() {
    const e = this.el, C = e.constructor;
    const props = C.props.filter((p) => !p.hidden);
    const posts = e.localPosts().length;
    this.host.innerHTML = `
      <div class="sheet-grip" data-a="close"></div>
      <div class="insp-head">
        <img class="insp-ico" src="${this.icon(C)}" alt="">
        <div class="insp-title"><b>${esc(e.name)}</b><span>${esc(C.title)}</span></div>
        <button class="icon-btn" data-a="close" title="Done">${icon('check', 22)}</button>
      </div>
      <div class="insp-scroll">
        <div class="insp-read"></div>
        <div class="insp-actions">
          <button data-a="rotate">${icon('rotate', 18)}<span>Rotate</span></button>
          <button data-a="flip">${icon('flip', 18)}<span>Flip</span></button>
          <button data-a="dup">${icon('copy', 18)}<span>Copy</span></button>
          ${posts >= 2 ? `<button data-a="scopeV">${icon('scope', 18)}<span>Scope V</span></button>` : ''}
          ${posts >= 1 && C.type !== 'ground' ? `<button data-a="scopeI">${icon('wave', 18)}<span>Scope I</span></button>` : ''}
          <button data-a="del" class="danger">${icon('trash', 18)}<span>Delete</span></button>
        </div>
        <div class="insp-body">
          ${props.map((p) => this.propRow(p)).join('')}
          <p class="insp-desc">${esc(C.description || '')}</p>
        </div>
      </div>`;
    this.host.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => this.action(b.dataset.a)));
    this.host.querySelectorAll('.prop').forEach((row) => this.bindRow(row));
    this.readKey = null;
    this.updateReadings();
  }

  propRow(p) {
    const v = this.el.p[p.key];
    if (p.type === 'select') {
      return `<label class="prop" data-k="${p.key}"><span>${esc(p.label)}</span><select>${p.options.map(([k, t]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    }
    if (p.type === 'bool') {
      return `<label class="prop" data-k="${p.key}"><span>${esc(p.label)}</span><input type="checkbox" class="toggle" ${v ? 'checked' : ''}></label>`;
    }
    if (p.type === 'text') {
      return `<label class="prop" data-k="${p.key}"><span>${esc(p.label)}</span><input type="text" value="${esc(v)}"></label>`;
    }
    const hasRange = p.min !== undefined && p.max !== undefined;
    return `<div class="prop num" data-k="${p.key}"><span>${esc(p.label)}</span>
      <div class="num-in"><input type="text" inputmode="decimal" value="${esc(fmtSI(v, '', 4).trim())}"><em>${esc(p.unit || '')}</em></div>
      ${hasRange ? `<input type="range" min="0" max="1000" value="${Math.round(toSlider(p, v) * 1000)}">` : ''}</div>`;
  }

  bindRow(row) {
    const key = row.dataset.k, p = this.el.propDef(key);
    const commit = (val) => this.ed.setParam(this.el, key, val);
    if (p.type === 'select') {
      row.querySelector('select').addEventListener('change', (ev) => {
        const v = ev.target.value;
        if (p.preset && p.preset[v]) {
          this.ed.checkpoint();
          Object.assign(this.el.p, p.preset[v]);
        }
        commit(v);
        this.render();
      });
      return;
    }
    if (p.type === 'bool') { row.querySelector('input').addEventListener('change', (ev) => commit(ev.target.checked)); return; }
    if (p.type === 'text') { row.querySelector('input').addEventListener('change', (ev) => commit(ev.target.value)); return; }
    const txt = row.querySelector('input[type=text]'), rng = row.querySelector('input[type=range]');
    txt.addEventListener('change', () => {
      let v = parseSI(txt.value);
      if (Number.isNaN(v)) { this.ed.toast('Invalid number: ' + txt.value); txt.value = fmtSI(this.el.p[key], '', 4).trim(); return; }
      if (p.min !== undefined) v = Math.max(p.min, v);
      if (p.max !== undefined) v = Math.min(p.max, v);
      this.markCustom(key);
      commit(v);
      txt.value = fmtSI(v, '', 4).trim();
      if (rng) rng.value = Math.round(toSlider(p, v) * 1000);
    });
    if (rng) {
      rng.addEventListener('input', () => {
        const v = fromSlider(p, rng.value / 1000);
        this.markCustom(key);
        commit(v);
        txt.value = fmtSI(v, '', 4).trim();
      });
    }
  }

  markCustom(key) {
    const m = this.el.propDef('model');
    if (m && m.preset && key !== 'model' && this.el.p.model !== 'custom' && m.preset[this.el.p.model] && key in m.preset[this.el.p.model]) {
      this.el.p.model = 'custom';
      const sel = this.host.querySelector('[data-k="model"] select');
      if (sel) sel.value = 'custom';
    }
  }

  refreshValue(key) {
    const row = this.host.querySelector(`.prop[data-k="${key}"]`);
    if (!row) return;
    const p = this.el.propDef(key), v = this.el.p[key];
    const txt = row.querySelector('input[type=text]'), rng = row.querySelector('input[type=range]');
    if (txt && document.activeElement !== txt) txt.value = fmtSI(v, '', 4).trim();
    if (rng) rng.value = Math.round(toSlider(p, v) * 1000);
  }

  updateReadings() {
    if (!this.el) return;
    const sim = this.ed.sim;
    const live = this.ed.running && sim && sim.ready;
    let r = [];
    if (live) { try { r = this.el.readings(sim); } catch { r = []; } }
    const fmt = ([, v, u]) => (typeof v !== 'number' ? String(v) : isPlainUnit(u) ? fmtQty(v, u) : fmtSI(v, u, 4));
    // quick bar: value label + first two readings, updated via textContent (no relayout of the bar)
    const q = this.quick.querySelector('.qb-read');
    if (q) {
      const val = this.el.valueLabel();
      // compact: values of the first two readings (e.g. "3.837 V · 816 µA")
      const nums = r.filter((x) => typeof x[1] === 'number').slice(0, 2).map(fmt);
      q.textContent = live && r.length ? (nums.length ? nums.join(' · ') : fmt(r[0])) : val || 'Tap ⚙ to edit';
    }
    if (!this.sheetOpen) return;
    const box = this.host.querySelector('.insp-read');
    if (!box) return;
    if (!live) {
      if (this.readKey !== 'idle') box.innerHTML = '<div class="read muted">Press ▶ Run to see live values</div>';
      this.readKey = 'idle';
      return;
    }
    const key = r.map((x) => x[0]).join('|');
    if (key !== this.readKey) {
      box.innerHTML = r.map(([k]) => `<div class="read"><span>${esc(k)}</span><b></b></div>`).join('');
      this.readKey = key;
    }
    const bs = box.querySelectorAll('b');
    r.forEach((x, i) => { if (bs[i]) bs[i].textContent = fmt(x); });
  }

  action(a) {
    const e = this.el;
    switch (a) {
      case 'close': this.closeSheet(); break;
      case 'rotate': this.ed.rotateSelection(); break;
      case 'flip': this.ed.flipSelection(); break;
      case 'dup': this.ed.duplicateSelection(); break;
      case 'del': this.ed.deleteSelection(); break;
      case 'scopeV': this.ed.addProbe({ kind: 'volt', el: e.id }); break;
      case 'scopeI': this.ed.addProbe({ kind: 'cur', el: e.id }); break;
      default:
    }
  }
}

// --------------------------------------------------------------------- knob
const KNOB_SIZE = 104; // px, matches .knob-dial in styles.css

/**
 * Value knob next to the selected part.
 *
 * Decade dial (log quantities: Ω, F, H, Hz…): the digits 1–9 sit round the
 * ring; turning steps 1 → 2 → … → 9 → 10 → 20 … with a detent per digit,
 * tapping a digit picks it, and − / + fine-tune by 0.1 of a digit (4.7 kΩ,
 * 1.5 µF…), rolling over into the next decade below 1.0 / above 9.9.
 * Stepped knob (linear quantities: %, °, V…): turning snaps to whole steps,
 * − / + move one step. The label with the value sits above the dial.
 */
export class Knob {
  constructor(editor, host) {
    this.ed = editor;
    this.host = host;
    host.innerHTML = `<div class="knob-label"><span></span><b></b></div>
      <div class="knob-row">
        <button class="knob-btn" data-k="-" title="Smaller">${icon('minus', 18)}</button>
        <div class="knob-dial"><div class="knob-ticks"></div><div class="knob-digits"></div><div class="knob-cap"><i></i></div></div>
        <button class="knob-btn" data-k="+" title="Larger">${icon('plus', 18)}</button>
      </div>`;
    this.dial = host.querySelector('.knob-dial');
    this.cap = host.querySelector('.knob-cap');
    this.lab = host.querySelector('.knob-label span');
    this.val = host.querySelector('.knob-label b');
    this.ticks = host.querySelector('.knob-ticks');
    this.digits = host.querySelector('.knob-digits');
    this.ticks.innerHTML = Array.from({ length: 24 }, (_, i) => `<i style="transform:rotate(${i * 15}deg)"></i>`).join('');
    // digits 1…9 clockwise, 1 just right of the top
    this.digits.innerHTML = Array.from({ length: 9 }, (_, k) => {
      const a = ((k + 0.5) * 40 - 90) * (Math.PI / 180), c = KNOB_SIZE / 2, r = KNOB_SIZE * 0.385;
      return `<span data-d="${k + 1}" style="left:${(c + r * Math.cos(a)).toFixed(1)}px;top:${(c + r * Math.sin(a)).toFixed(1)}px">${k + 1}</span>`;
    }).join('');
    this.angle = 0;
    let last = null, acc = 0, moved = 0;
    const ang = (ev) => {
      const r = this.dial.getBoundingClientRect();
      return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2));
    };
    this.dial.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this.dial.setPointerCapture(ev.pointerId);
      last = ang(ev); acc = 0; moved = 0;
      this.ed.checkpoint();
      this.host.classList.add('active');
    });
    this.dial.addEventListener('pointermove', (ev) => {
      if (last === null) return;
      const a = ang(ev);
      let d = a - last;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      last = a; moved += Math.abs(d);
      acc += d;
      const step = this.mode === 'decade' ? (40 * Math.PI) / 180 : Math.PI / 12; // one detent
      while (acc >= step) { acc -= step; this.step(1); }
      while (acc <= -step) { acc += step; this.step(-1); }
    });
    const up = (ev) => {
      if (last === null) return;
      last = null; this.host.classList.remove('active');
      // a tap (no turning) on a digit picks it
      if (this.mode === 'decade' && moved < 0.12) {
        const t = document.elementFromPoint(ev.clientX, ev.clientY);
        const d = t && t.dataset && t.dataset.d;
        if (d) this.pickDigit(+d);
      }
    };
    this.dial.addEventListener('pointerup', up);
    this.dial.addEventListener('pointercancel', () => { last = null; this.host.classList.remove('active'); });
    this.dial.addEventListener('wheel', (ev) => { ev.preventDefault(); this.ed.checkpoint(); this.step(ev.deltaY < 0 ? 1 : -1); }, { passive: false });
    host.querySelectorAll('.knob-btn').forEach((b) => {
      b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      b.addEventListener('click', (ev) => { ev.stopPropagation(); this.ed.checkpoint(); this.bump(b.dataset.k === '+' ? 1 : -1); });
    });
  }

  show(el, prop) {
    this.el = el; this.prop = prop;
    this.mode = prop.log && (prop.min ?? 0) >= 0 && el.p[prop.key] > 0 ? 'decade' : 'linear';
    this.host.classList.toggle('decade', this.mode === 'decade');
    this.lab.textContent = prop.label;
    this.angle = this.mode === 'decade' ? this.digitAngle(this.digit()) : this.angle;
    this.update();
    this.host.classList.add('open');
  }
  hide() { this.host.classList.remove('open'); this.el = null; }

  // ---- decade dial helpers
  parts(v) { let e = Math.floor(Math.log10(v) + 1e-9), m = v / Math.pow(10, e); if (Math.round(m) >= 10) { e += 1; m /= 10; } return [m, e]; }
  digit() { const v = this.el.p[this.prop.key]; return v > 0 ? Math.min(9, Math.max(1, Math.round(this.parts(v)[0]))) : 1; }
  digitAngle(d) { return ((d - 0.5) * 40 * Math.PI) / 180; }
  /**
   * Steps of a linear knob, from the size of the value itself (not the allowed
   * range, which can be ±10 kV): one significant digit below 10 (5 V → 6 V,
   * 0.5 → 0.6), two from 10 up (12 V → 13 V, 230 V → 240 V). − / + move a tenth
   * of that; whole-number quantities (counts, β…) always move by whole numbers.
   */
  /**
   * Steps follow the value as it is shown (with its m / k prefix): 1–99 of a
   * unit move one at a time, 100–999 ten at a time — 5 V → 6 V, 230 V → 240 V,
   * 10 mA → 11 mA. Going down from 100 (or 1 k) uses the smaller step, so the
   * dial gives 100 → 99 and not 100 → 90.
   */
  linSteps(n = 1) {
    const p = this.prop, v = this.el.p[p.key];
    if (p.step) return { coarse: p.step, fine: p.step };
    const whole = !p.unit && Number.isInteger(p.def) && Number.isInteger(v);
    if (whole) { const a = Math.abs(v) - (n < 0 ? 1 : 0); const c = a >= 100 ? Math.pow(10, Math.floor(Math.log10(a)) - 1) : 1; return { coarse: c, fine: 1 }; }
    if (['%', '°', '°C', '%RH', 'dB SPL'].includes(p.unit)) return { coarse: 1, fine: 0.1 };
    let mag = Math.abs(v) > 1e-12 ? Math.abs(v) : Math.abs(p.def) || 1;
    // (but 1 V, 1 mA … keep their own step: 1 V → 0 V, not 1 V → 990 mV)
    if (n < 0 && ((Math.floor(Math.log10(mag) + 1e-9) % 3) + 3) % 3) mag *= 1 - 1e-6;
    const e = Math.floor(Math.log10(mag) + 1e-9);
    const shown = mag / Math.pow(10, 3 * Math.floor(e / 3)); // 1 … 999 after the prefix
    const coarse = Math.pow(10, shown >= 10 ? e - 1 : e);
    return { coarse, fine: coarse / 10 };
  }
  apply(v) {
    const p = this.prop, lo = p.min ?? -Infinity, hi = p.max ?? Infinity;
    v = Math.min(hi, Math.max(lo, v));
    if (v === this.el.p[p.key]) return false;
    this.ed.setParam(this.el, p.key, v, true);
    this.ed.haptic(4);
    this.update();
    return true;
  }

  /** One detent of the dial. */
  step(n) {
    if (!this.el) return;
    const v = this.el.p[this.prop.key];
    if (this.mode === 'decade') {
      let [m, e] = this.parts(v);
      m = n > 0 ? Math.floor(m + 1e-9) + n : Math.ceil(m - 1e-9) + n; // 4.7 → 5 up, → 4 down
      if (m > 9) { m = 1; e += 1; } else if (m < 1) { m = 9; e -= 1; }
      if (this.apply(+(m * Math.pow(10, e)).toPrecision(6))) this.angle += (n * 40 * Math.PI) / 180; // keeps turning the same way: 9 → 1 goes forward
    } else {
      this.linMove(v, n, this.linSteps(n).coarse);
    }
    this.update();
  }

  /** − / + buttons: 0.1 of a digit on the dial (fractions like 4.7), one step on a linear knob. */
  bump(n) {
    if (!this.el) return;
    const v = this.el.p[this.prop.key];
    if (this.mode === 'decade') {
      let [m, e] = this.parts(v);
      m = Math.round(m * 10 + n) / 10;
      if (m >= 10) { m /= 10; e += 1; } else if (m < 1) { m *= 10; e -= 1; }
      this.apply(+(m * Math.pow(10, e)).toPrecision(6));
    } else this.linMove(v, n, this.linSteps(n).fine);
  }

  /** Move a linear value to the next multiple of st in direction n (9.5 → 10, not 11). */
  linMove(v, n, st) {
    const k = n > 0 ? Math.floor(v / st + 1e-9) + n : Math.ceil(v / st - 1e-9) + n;
    if (this.apply(+(k * st).toPrecision(10))) this.angle += n * (Math.PI / 12);
    this.update();
  }

  pickDigit(d) {
    this.ed.checkpoint();
    const [, e] = this.parts(this.el.p[this.prop.key]);
    this.apply(+(d * Math.pow(10, e)).toPrecision(6));
    this.update();
  }

  update() {
    if (!this.el) return;
    if (this.mode === 'decade') {
      const d = this.digit();
      // the pointer turns the short way to the digit from wherever it is, so the
      // dial never spins back round (9 → 1 is one step forward, not eight back)
      const full = 2 * Math.PI;
      const m = this.parts(this.el.p[this.prop.key])[0]; // fractional: 4.7 points between 4 and 5
      let diff = (this.digitAngle(Math.min(9.99, Math.max(1, m))) - this.angle) % full;
      if (diff > Math.PI) diff -= full; else if (diff < -Math.PI) diff += full;
      this.angle += diff;
      this.cap.style.transform = `rotate(${this.angle}rad)`;
      this.digits.querySelectorAll('span').forEach((s) => s.classList.toggle('on', +s.dataset.d === d));
    } else this.cap.style.transform = `rotate(${this.angle}rad)`;
    this.val.textContent = fmtSI(this.el.p[this.prop.key], this.prop.unit || '', 4);
  }
}
