// Component inspector (bottom sheet) and the EveryCircuit-style rotary knob.

import { fmtSI, parseSI } from '../engine/units.js';
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
  constructor(editor, host) {
    this.ed = editor;
    this.host = host;
    this.el = null;
    this.expanded = false;
  }

  show(el) {
    this.el = el;
    this.ed.root.classList.toggle('insp-open', !!el);
    if (!el) { this.host.classList.remove('open'); this.host.innerHTML = ''; this.ed.knob.hide(); return; }
    this.render();
    this.host.classList.add('open');
    const kp = el.knobProp();
    if (kp) this.ed.knob.show(el, kp); else this.ed.knob.hide();
    this.placeKnob();
  }

  placeKnob() {
    requestAnimationFrame(() => {
      const h = this.host.classList.contains('open') && window.innerWidth < 900 ? this.host.getBoundingClientRect().height : 0;
      this.ed.knob.host.style.bottom = h ? `${h + 10}px` : '';
    });
  }

  render() {
    const e = this.el, C = e.constructor;
    const img = Renderer.iconFor(C, this.ed.theme, 44);
    const props = C.props.filter((p) => !p.hidden);
    const posts = e.localPosts().length;
    this.host.innerHTML = `
      <div class="sheet-grip" data-a="toggle"></div>
      <div class="insp-head">
        <img class="insp-ico" src="${img}" alt="">
        <div class="insp-title"><b>${esc(e.name)}</b><span>${esc(C.title)}</span></div>
        <button class="icon-btn add" data-a="add" title="Add component">${icon('plus', 22)}</button>
        <button class="icon-btn" data-a="toggle" title="Properties">${icon('sliders', 20)}</button>
        <button class="icon-btn" data-a="close" title="Close">${icon('x', 20)}</button>
      </div>
      <div class="insp-read"></div>
      <div class="insp-actions">
        <button data-a="rotate">${icon('rotate', 18)}<span>Rotate</span></button>
        <button data-a="flip">${icon('flip', 18)}<span>Flip</span></button>
        <button data-a="dup">${icon('copy', 18)}<span>Copy</span></button>
        ${posts >= 2 ? `<button data-a="scopeV">${icon('scope', 18)}<span>Scope V</span></button>` : ''}
        ${posts >= 1 && C.type !== 'ground' ? `<button data-a="scopeI">${icon('wave', 18)}<span>Scope I</span></button>` : ''}
        <button data-a="del" class="danger">${icon('trash', 18)}<span>Delete</span></button>
      </div>
      <div class="insp-body ${this.expanded ? 'show' : ''}">
        ${props.map((p) => this.propRow(p)).join('')}
        <p class="insp-desc">${esc(C.description || '')}</p>
      </div>`;
    this.host.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => this.action(b.dataset.a)));
    this.host.querySelectorAll('.prop').forEach((row) => this.bindRow(row));
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
    const box = this.host.querySelector('.insp-read');
    if (!box) return;
    const sim = this.ed.sim;
    if (!this.ed.running || !sim || !sim.ready) {
      box.innerHTML = `<div class="read muted">${this.ed.running ? '' : 'Press ▶ to simulate and see live values'}</div>`;
      return;
    }
    let r = [];
    try { r = this.el.readings(sim); } catch { r = []; }
    box.innerHTML = r.map(([k, v, u]) => `<div class="read"><span>${esc(k)}</span><b>${typeof v === 'number' ? esc(fmtSI(v, u, 4)) : esc(v)}</b></div>`).join('');
  }

  action(a) {
    const e = this.el;
    switch (a) {
      case 'close': this.ed.select(null); break;
      case 'add': this.ed.palette.open(); break;
      case 'toggle': this.expanded = !this.expanded; this.host.querySelector('.insp-body').classList.toggle('show', this.expanded); this.placeKnob(); break;
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
export class Knob {
  constructor(editor, host) {
    this.ed = editor;
    this.host = host;
    host.innerHTML = `<div class="knob-dial"><div class="knob-ticks"></div><div class="knob-cap"><i></i></div></div><div class="knob-label"><span></span><b></b></div>`;
    this.dial = host.querySelector('.knob-dial');
    this.cap = host.querySelector('.knob-cap');
    this.lab = host.querySelector('.knob-label span');
    this.val = host.querySelector('.knob-label b');
    const ticks = host.querySelector('.knob-ticks');
    ticks.innerHTML = Array.from({ length: 24 }, (_, i) => `<i style="transform:rotate(${i * 15}deg)"></i>`).join('');
    this.angle = 0;
    let last = null, acc = 0;
    const ang = (ev) => {
      const r = this.dial.getBoundingClientRect();
      return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2));
    };
    this.dial.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this.dial.setPointerCapture(ev.pointerId);
      last = ang(ev); acc = 0;
      this.ed.checkpoint();
      this.host.classList.add('active');
    });
    this.dial.addEventListener('pointermove', (ev) => {
      if (last === null) return;
      const a = ang(ev);
      let d = a - last;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      last = a;
      this.turn(d);
      acc += d;
      if (Math.abs(acc) > Math.PI / 12) { acc = 0; this.ed.haptic(4); }
    });
    const up = () => { last = null; this.host.classList.remove('active'); };
    this.dial.addEventListener('pointerup', up);
    this.dial.addEventListener('pointercancel', up);
    this.dial.addEventListener('wheel', (ev) => { ev.preventDefault(); this.turn(ev.deltaY < 0 ? 0.12 : -0.12); }, { passive: false });
  }

  show(el, prop) {
    this.el = el; this.prop = prop;
    this.lab.textContent = prop.label;
    this.update();
    this.host.classList.add('open');
  }
  hide() { this.host.classList.remove('open'); this.el = null; }

  turn(d) {
    const p = this.prop, e = this.el;
    if (!e) return;
    let v = e.p[p.key];
    const lo = p.min ?? -Infinity, hi = p.max ?? Infinity;
    if (p.log && v > 0) v = v * Math.pow(10, d / (2 * Math.PI));
    else {
      const span = Number.isFinite(hi - lo) ? (hi - lo) : Math.max(1, Math.abs(v) * 2);
      const perTurn = p.unit === '%' ? 50 : p.unit === '°C' ? 50 : Math.min(span / 4, Math.max(1, Math.abs(v)) * 2);
      v = v + (d / (2 * Math.PI)) * perTurn;
    }
    v = Math.min(hi, Math.max(lo, v));
    this.angle += d;
    this.ed.setParam(e, p.key, niceRound(v), true);
    this.update();
  }

  update() {
    if (!this.el) return;
    this.cap.style.transform = `rotate(${this.angle}rad)`;
    this.val.textContent = fmtSI(this.el.p[this.prop.key], this.prop.unit || '', 4);
  }
}
