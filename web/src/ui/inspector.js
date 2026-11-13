// Component inspector (bottom sheet) and the EveryCircuit-style rotary knob.

import { fmtSI, parseSI, fmtQty, isPlainUnit } from '../engine/units.js';
import { icon } from './icons.js';
import { Renderer } from './render.js';
import { CABLE_TYPES, SIZES, SHAPES, INSTALL, WIRE_PRESETS, normSpec, cableInfo, cableLabel } from '../elements/cables.js';
import { phasorFields, phasorReadings, docOmega } from './phasor-view.js';
import { esc } from './html.js';


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
    this.wires = null;
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
    const dmg = e.damaged ? `<button data-q="replace" class="hot" title="Replace with a new one">${icon('reset', 19)}<span>Replace</span></button>` : '';
    this.quick.classList.toggle('damaged', !!e.damaged);
    this.quick.innerHTML = `
      ${dmg}
      <button class="qb-main" data-q="edit">
        <img src="${this.icon(C)}" alt="">
        <div><b>${esc(e.name)} <small>${esc(C.title)}</small></b></div>
      </button>
      ${!e.damaged && this.ed.constructor.isPolar(e) ? `<button data-q="reverse" title="Reverse polarity">${icon('polarity', 19)}</button>` : ''}
      ${e.damaged ? '' : `<button data-q="rotate" title="Rotate">${icon('rotate', 19)}</button>`}
      ${!e.damaged && e.canSlant() ? `<button data-q="slantup" title="Slant 15° up (anticlockwise)">${icon('slant', 19)}</button><button data-q="slantdown" title="Slant 15° down (clockwise)">${icon('slant', 19, 'flipx')}</button>` : ''}
      ${canScope && !e.damaged ? `<button data-q="scope" title="Add to oscilloscope">${icon('scope', 19)}</button>` : ''}
      <button data-q="edit" title="Edit properties">${icon('sliders', 19)}</button>
      <button data-q="del" class="danger" title="Delete">${icon('trash', 19)}</button>`;
    this.quick.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.q;
      if (a === 'edit') this.openSheet();
      if (a === 'rotate') this.ed.rotateSelection();
      if (a === 'slantup') this.ed.slantSelection(-15);
      if (a === 'slantdown') this.ed.slantSelection(15);
      if (a === 'reverse') this.ed.reversePolarity();
      if (a === 'del') this.ed.deleteSelection();
      if (a === 'scope') this.ed.addProbe({ kind: posts >= 2 ? 'volt' : 'cur', el: this.el.id });
      if (a === 'replace') this.ed.replacePart(this.el);
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
  }

  closeSheet() {
    if (!this.sheetOpen) return;
    this.sheetOpen = false;
    this.wires = null;
    this.host.classList.remove('open');
    this.ed.root.classList.remove('sheet-open');
    const kp = this.el && this.el.knobProp();
    if (kp) this.ed.knob.show(this.el, kp);
  }

  render() {
    if (this.wires) { this.renderWires(); return; }
    const e = this.el, C = e.constructor;
    const props = C.props.filter((p) => !p.hidden && (!p.when || p.when(e.p))); // `when`: only for some settings of the part (a waveform's)
    const posts = e.localPosts().length;
    this.host.innerHTML = `
      <div class="sheet-grip" data-a="close"></div>
      <div class="insp-head">
        <img class="insp-ico" src="${this.icon(C)}" alt="">
        <div class="insp-title"><b>${esc(e.name)}</b><span>${esc(C.title)}</span></div>
        <button class="icon-btn" data-a="close" title="Done">${icon('check', 22)}</button>
      </div>
      <div class="insp-scroll">
        ${e.damaged ? `<div class="insp-dmg"><b>🔥 ${esc(e.constructor.title)} is burnt out</b><span>${esc(e.damaged.why)}</span><button class="btn" data-a="replace">${icon('reset', 18)} Replace with a new one</button></div>` : ''}
        <div class="insp-read"></div>
        <div class="insp-actions">
          <button data-a="rotate">${icon('rotate', 18)}<span>Rotate</span></button>
          ${e.canSlant() ? `<button data-a="slantup">${icon('slant', 18)}<span>Slant up</span></button><button data-a="slantdown">${icon('slant', 18, 'flipx')}<span>Slant down</span></button>` : ''}
          <button data-a="flip">${icon('flip', 18)}<span>Flip</span></button>
          <button data-a="dup">${icon('copy', 18)}<span>Copy</span></button>
          ${posts >= 2 ? `<button data-a="scopeV">${icon('scope', 18)}<span>Scope V</span></button>` : ''}
          ${posts >= 1 && C.type !== 'ground' ? `<button data-a="scopeI">${icon('wave', 18)}<span>Scope I</span></button>` : ''}
          <button data-a="del" class="danger">${icon('trash', 18)}<span>Delete</span></button>
        </div>
        <div class="insp-body">
          ${e.canSlant() && !e.damaged ? `<div class="prop num insp-angle"><span>Angle</span><div class="num-in"><button data-ang="-15" title="15° back">−15°</button><input type="text" inputmode="decimal" value="${esc(this.ed.angleText(e).replace('°', ''))}"><em>°</em><button data-ang="15" title="15° on">+15°</button></div></div>` : ''}
          ${this.phasorRows()}
          ${props.map((p) => this.propRow(p)).join('')}
          ${this.faultRows()}
          ${this.aboutRows()}
        </div>
      </div>`;
    this.host.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => this.action(b.dataset.a)));
    this.host.querySelectorAll('.prop[data-k]').forEach((row) => this.bindRow(row));
    this.host.querySelectorAll('.prop[data-pk]').forEach((row) => this.bindPhasorRow(row));
    // any angle: typed (to the nearest the grid allows, within a few degrees), or ±15°
    const ang = this.host.querySelector('.insp-angle');
    if (ang) {
      const again = () => { if (this.sheetOpen && this.ed.selection.has(this.el)) this.render(); };
      ang.querySelector('input').addEventListener('change', (ev) => {
        const d = parseFloat(String(ev.target.value).replace(',', '.'));
        if (!Number.isFinite(d)) { this.ed.toast('Type an angle in degrees, e.g. 30'); again(); return; }
        this.ed.setAngleSelection(d);
        again();
      });
      ang.querySelectorAll('[data-ang]').forEach((b) => b.addEventListener('click', () => { this.ed.slantSelection(+b.dataset.ang); again(); }));
    }
    this.host.querySelectorAll('[data-fk]').forEach((row) => this.bindFault(row));
    // tapping a suggested tag links the part to that coil / relay
    this.host.querySelectorAll('.prop-sug').forEach((d) => d.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-tag]');
      if (!b) return;
      this.ed.setParam(this.el, d.dataset.k, b.dataset.tag);
      this.render();
    }));
    this.readKey = null;
    this.updateReadings();
  }

  /**
   * Everything about the part, at the bottom of its sheet (scroll down): what it is and how it
   * works, the settings with their usual values, ranges and choices, its numbered terminals.
   */
  aboutRows() {
    const e = this.el, C = e.constructor;
    const pins = e.localPosts().length, names = e.pinNames ? e.pinNames() : null;
    const val = (pr, v) => (pr.type === 'select' ? (pr.options.find(([k]) => String(k) === String(v)) || [v, v])[1] : pr.type === 'bool' ? (v ? 'on' : 'off') : pr.type === 'text' ? String(v) : fmtSI(v, pr.unit && pr.unit !== '%' ? pr.unit : '', 3).trim() + (pr.unit === '%' ? ' %' : ''));
    const props = (C.props || []).filter((pr) => !pr.hidden && (!pr.when || pr.when(e.p)));
    const range = (pr) => (pr.type === 'select' ? pr.options.slice(0, 6).map(([, t]) => t).join(' · ') + (pr.options.length > 6 ? ' …' : '') : pr.min !== undefined && pr.max !== undefined && !pr.type ? `${fmtSI(pr.min, pr.unit || '', 2).trim()} … ${fmtSI(pr.max, pr.unit || '', 2).trim()}` : '');
    return `<div class="insp-about">
      <h5>About this part</h5>
      <p class="insp-desc">${esc(C.description || 'No description yet.')}</p>
      <p class="about-meta"><span>${esc(C.category)}</span>${pins ? `<span>${pins} terminal${pins > 1 ? 's' : ''}</span>` : '<span>no terminals</span>'}</p>
      ${props.length ? `<h5>Settings</h5><ul class="about-props">${props.map((pr) => `<li><b>${esc(pr.label)}</b><span>usual: ${esc(val(pr, pr.def))}</span>${range(pr) ? `<em>${esc(range(pr))}</em>` : ''}</li>`).join('')}</ul>` : ''}
      ${pins > 1 ? `<h5>Terminals</h5><p class="about-pins">${Array.from({ length: pins }, (_, i) => `<span><i>${i + 1}</i>${esc((names && names[i]) || (pins === 2 ? `Terminal ${i + 1}` : `Pin ${i + 1}`))}</span>`).join('')}</p>` : ''}
      <p class="about-tip">Press <b>Run</b> to see it work: its live voltage, current and power are shown above.</p>
    </div>`;
  }

  /** In the phasor domain: the part's phasor / impedance, typed the book's way (20∠30, j4, −j2.5). */
  phasorRows() {
    if (this.ed.doc.domain !== 'phasor') return '';
    this.pfields = phasorFields(this.el, docOmega(this.ed.doc));
    if (!this.pfields.length) return '';
    return `<div class="insp-phasor">${this.pfields.map((f) => `<div class="prop num" data-pk="${f.key}"><span>${esc(f.label)}</span><div class="num-in"><input type="text" value="${esc(f.text)}"><em>${esc(f.unit)}</em></div></div>`).join('')}</div>`;
  }

  bindPhasorRow(row) {
    const f = (this.pfields || []).find((x) => x.key === row.dataset.pk), inp = row.querySelector('input');
    if (!f) return;
    inp.addEventListener('change', () => {
      const out = f.apply(inp.value);
      if (typeof out === 'string') { this.ed.toast(out); inp.value = f.text; return; }
      this.ed.checkpoint(); // one undo step for all the values it sets
      for (const [k, v] of Object.entries(out)) this.ed.setParam(this.el, k, v, true);
      this.ed.computeTiming?.();
      this.render();
    });
  }

  /** terminal names for the fault selector */
  pinLabels() {
    const e = this.el, n = e.localPosts().length, t = e.constructor.type;
    const fam = /^(npn|pnp|darl|photot)/.test(t) ? ['Base', 'Collector', 'Emitter'] : /^(nmos|pmos|depnmos|hemt)$/.test(t) ? ['Gate', 'Drain', 'Source'] : /^(njfet|pjfet)$/.test(t) ? ['Gate', 'Drain', 'Source']
      : t === 'igbt' ? ['Gate', 'Collector', 'Emitter'] : /^(scr|gto|lascr)$/.test(t) ? ['Anode', 'Cathode', 'Gate'] : null;
    const names = fam || (e.pinNames ? e.pinNames() : null);
    return Array.from({ length: n }, (_, i) => (names && names[i] ? names[i] : n === 2 ? `Terminal ${i + 1}` : `Pin ${i + 1}`));
  }

  /** fault injection: open terminal, short or leakage between two terminals */
  faultRows() {
    const e = this.el, C = e.constructor, n = e.localPosts().length;
    if (n < 2 || C.noFault || /^(ground|earth|chassis|netlabel|label|testpoint)$/.test(C.type)) return '';
    const f = e.fault || { m: 'none' }, pins = this.pinLabels();
    const opt = (v, t, cur) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(t)}</option>`;
    const pinSel = (k, label, cur) => `<label class="prop" data-fk="${k}"><span>${label}</span><select>${pins.map((p, i) => opt(i, p, cur)).join('')}</select></label>`;
    let h = `<div class="insp-fault"><label class="prop" data-fk="m"><span>⚡ Fault</span><select>${[['none', 'None (healthy)'], ['open', 'Open circuit (broken terminal)'], ['short', 'Short circuit'], ['res', 'Leakage / partial short']].map(([v, t]) => opt(v, t, f.m)).join('')}</select></label>`;
    if (f.m === 'open') h += pinSel('a', 'Broken terminal', f.a ?? 0);
    if (f.m === 'short' || f.m === 'res') { h += pinSel('a', 'Between', f.a ?? 0) + pinSel('b', 'and', f.b ?? 1); }
    if (f.m === 'res') h += `<div class="prop num" data-fk="r"><span>Fault resistance</span><div class="num-in"><input type="text" inputmode="decimal" value="${esc(fmtSI(f.r ?? 1000, '', 4).trim())}"><em>Ω</em></div></div>`;
    return h + '</div>';
  }

  bindFault(row) {
    const k = row.dataset.fk, inp = row.querySelector('select, input');
    inp.addEventListener('change', () => {
      const e = this.el, f = { m: 'none', a: 0, b: 1, ...(e.fault || {}) };
      if (k === 'r') { const v = parseSI(inp.value); if (!(v > 0)) { this.ed.toast('Invalid resistance'); return; } f.r = v; } else if (k === 'm') f.m = inp.value; else f[k] = +inp.value;
      if (f.m !== 'open' && f.a === f.b) f.b = f.a === 0 ? 1 : 0;
      this.ed.checkpoint();
      e.fault = f.m === 'none' ? null : f;
      this.ed.topologyChanged();
      this.ed.toast(f.m === 'none' ? `${e.name}: fault cleared` : `${e.name}: fault injected — run the simulation to see its effect`);
      this.render();
    });
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
      // tag fields offer the coil / relay tags that exist in the circuit
      const sug = typeof p.suggest === 'function' ? p.suggest(this.ed.doc).filter((t) => t !== v) : [];
      const id = sug.length ? `sug-${p.key}-${this.el.id}` : '';
      return `<label class="prop" data-k="${p.key}"><span>${esc(p.label)}</span><input type="text" value="${esc(v)}" ${id ? `list="${id}"` : ''}>${id ? `<datalist id="${id}">${sug.map((t) => `<option value="${esc(t)}"></option>`).join('')}</datalist>` : ''}</label>${sug.length ? `<div class="prop-sug" data-k="${p.key}">${sug.map((t) => `<button class="tag-chip" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}`;
    }
    const hasRange = p.min !== undefined && p.max !== undefined;
    return `<div class="prop num" data-k="${p.key}"><span>${esc(p.label)}</span>
      <div class="num-in"><input type="text" inputmode="decimal" value="${esc(fmtSI(v, '', 4).trim())}"><em>${esc(p.unit || '')}</em></div>
      ${hasRange ? `<input type="range" min="0" max="1000" value="${Math.round(toSlider(p, v) * 1000)}">` : ''}</div>`;
  }

  bindRow(row) {
    const key = row.dataset.k, p = this.el.propDef(key);
    const commit = (val) => this.ed.setParam(this.el, key, val);
    // one undo step for a change that sets several values (a model preset, a value marking the model
    // custom): the step is taken first, then the values go in without more steps
    const commitOne = (val) => { this.ed.checkpoint(); this.markCustom(key); this.ed.setParam(this.el, key, val, true); };
    if (p.type === 'select') {
      row.querySelector('select').addEventListener('change', (ev) => {
        const v = ev.target.value;
        this.ed.checkpoint();
        if (p.preset && p.preset[v]) Object.assign(this.el.p, p.preset[v]);
        this.ed.setParam(this.el, key, v, true);
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
      commitOne(v);
      txt.value = fmtSI(v, '', 4).trim();
      if (rng) rng.value = Math.round(toSlider(p, v) * 1000);
    });
    if (rng) {
      // one undo step per slide, not one per movement (60 of them pushed the rest of the history out)
      let sliding = false;
      rng.addEventListener('input', () => {
        const v = fromSlider(p, rng.value / 1000);
        if (!sliding) { sliding = true; this.ed.checkpoint(); }
        this.markCustom(key);
        this.ed.setParam(this.el, key, v, true);
        txt.value = fmtSI(v, '', 4).trim();
      });
      rng.addEventListener('change', () => { sliding = false; });
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
    if (this.wires) { this.updateWireReadings(); return; }
    if (!this.el) return;
    const sim = this.ed.sim;
    const live = this.ed.running && sim && sim.ready;
    let r = [];
    if (live) { try { r = this.el.readings(sim); } catch { r = []; } }
    // the phasor domain: the part's voltage and current phasors first
    if (live && this.ed.doc.domain === 'phasor') { const ph = this.ed.phasorNow(); if (ph) r = [...phasorReadings(this.el, ph).map(([k, t]) => [k, t, '']), ...r]; }
    const fmt = ([, v, u]) => (typeof v !== 'number' ? String(v) : isPlainUnit(u) ? fmtQty(v, u) : fmtSI(v, u, 4));
    // (the quick bar shows the part's name only: its value and readings are on the board and in its sheet)
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
      // long text values (e.g. what a contact follows) get a full-width card instead of spilling over
      box.innerHTML = r.map(([k, v]) => `<div class="read${typeof v === 'string' && v.length > 13 ? ' wide' : ''}"><span>${esc(k)}</span><b></b></div>`).join('');
      this.readKey = key;
    }
    const bs = box.querySelectorAll('b');
    r.forEach((x, i) => { if (bs[i]) bs[i].textContent = fmt(x); });
  }

  action(a) {
    const e = this.el;
    switch (a) {
      case 'close': this.closeSheet(); break;
      case 'rotate': this.ed.rotateSelection(); if (e.canSlant() && this.sheetOpen && this.ed.selection.has(e)) this.render(); break; // (its angle shown anew)
      case 'slantup': case 'slantdown': this.ed.slantSelection(a === 'slantup' ? -15 : 15); if (this.sheetOpen && this.ed.selection.has(e)) this.render(); break;
      case 'flip': this.ed.flipSelection(); break;
      case 'dup': this.ed.duplicateSelection(); break;
      case 'del': this.ed.deleteSelection(); break;
      case 'scopeV': this.ed.addProbe({ kind: 'volt', el: e.id }); break;
      case 'scopeI': this.ed.addProbe({ kind: 'cur', el: e.id }); break;
      case 'replace': this.ed.replacePart(e); break;
      default:
    }
  }

  // ------------------------------------------------------------ wires
  /** Cable sheet for one or more selected wires: type, size, conductor, installation, live heat. */
  openWires(ws) {
    if (!ws.length) return;
    this.el = null;
    this.wires = ws;
    this.ed.knob.hide();
    this.quick.classList.remove('open');
    this.sheetOpen = true;
    this.render();
    this.host.classList.add('open');
    this.ed.root.classList.add('sheet-open');
  }

  renderWires() {
    const ws = this.wires, w = ws[0], sp = w.cable ? normSpec(w.cable) : null;
    const T = sp ? CABLE_TYPES[sp.type] : null, info = sp ? cableInfo(sp) : null;
    const opt = (list, v) => list.map(([k, t]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('');
    const burnt = ws.some((x) => x.burnt);
    this.host.innerHTML = `
      <div class="sheet-grip" data-a="close"></div>
      <div class="insp-head">
        <div class="insp-ico wire-ico">${icon('wire', 30)}</div>
        <div class="insp-title"><b>${ws.length > 1 ? ws.length + ' wires' : 'Wire'}</b><span>${esc(cableLabel(sp))}${info ? ` · Iz ${info.iz} A` : ''}</span></div>
        <button class="icon-btn" data-a="close" title="Done">${icon('check', 22)}</button>
      </div>
      <div class="insp-scroll">
        ${burnt ? `<div class="insp-dmg"><b>🔥 Burnt through</b><span>${esc(w.heat?.why || 'Too much current for this cable')}. A thicker cable (or a smaller MCB / fuse in front of it) stops it happening again.</span><button class="btn" data-a="repair">${icon('reset', 18)} Repair (new wire)</button></div>` : ''}
        <div class="insp-read"></div>
        <div class="insp-body">
          <label class="prop" data-w="type"><span>Cable type</span><select>${opt([['ideal', 'Ideal wire (no resistance, no limit)'], ...Object.entries(CABLE_TYPES).map(([k, v]) => [k, v.name])], sp ? sp.type : 'ideal')}</select></label>
          ${sp ? `
          <label class="prop" data-w="size"><span>Conductor size</span><select>${opt(SIZES.map((s) => [s, s + ' mm²']), sp.size)}</select></label>
          <label class="prop" data-w="shape"><span>Conductor (IEC 60228)</span><select>${opt(T.shapes.map((k) => [k, SHAPES[k]]), sp.shape)}</select></label>
          <label class="prop" data-w="inst"><span>Installation method</span><select>${opt(Object.entries(INSTALL).map(([k, v]) => [k, v.name]), sp.inst)}</select></label>
          <div class="wire-facts">
            <div><span>Current rating Iz</span><b>${info.iz} A</b></div>
            <div><span>Resistance (20 °C)</span><b>${fmtSI(info.r20 * 1000, 'Ω', 3)}/km</b></div>
            <div><span>Insulation</span><b>${esc(info.ins.name)}</b></div>
            <div><span>Conductor</span><b>${esc(info.mat.name)}</b></div>
          </div>` : ''}
          <div class="insp-actions">
            <button data-a="allwires">${icon('copy', 18)}<span>Use for all wires</span></button>
            <button data-a="setdef">${icon('check', 18)}<span>Make default</span></button>
            <button data-a="delwire" class="danger">${icon('trash', 18)}<span>Delete</span></button>
          </div>
          <p class="insp-desc">Every drawn wire can be given a real cable. It has no resistance in the schematic, but it heats with the current through it: above its rating Iz it overheats (orange glow), far above it the insulation smokes, catches fire and the wire burns through — the circuit opens. Fit an MCB or fuse no bigger than the cable's Iz to protect it. RE = solid round, RM = stranded round, SM = stranded sector-shaped, RF = flexible. For voltage drop over a real length use the Cable parts (Wires & Cables).</p>
        </div>
      </div>`;
    this.host.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => this.wireAction(b.dataset.a)));
    this.host.querySelectorAll('[data-w]').forEach((row) => row.querySelector('select').addEventListener('change', (ev) => {
      const k = row.dataset.w, v = ev.target.value;
      let c;
      if (k === 'type') c = v === 'ideal' ? null : normSpec({ ...(sp || { size: 1.5, inst: 'B1' }), type: v, shape: null });
      else c = normSpec({ ...sp, [k]: k === 'size' ? +v : v });
      this.ed.repairWires(this.wires, c);
      this.render();
    }));
    this.readKey = null;
    this.updateWireReadings();
  }

  wireAction(a) {
    const ws = this.wires;
    switch (a) {
      case 'close': this.closeSheet(); this.wires = null; break;
      case 'repair': this.ed.repairWires(ws); this.render(); break;
      case 'allwires': this.ed.repairWires(this.ed.doc.wires.filter((x) => x.pts.length >= 2), ws[0].cable); this.ed.toast(`All wires: ${cableLabel(ws[0].cable)}`); this.render(); break;
      case 'setdef': {
        const c = ws[0].cable ? normSpec(ws[0].cable) : null;
        const hit = Object.entries(WIRE_PRESETS).find(([, p]) => (p ? c && p.type === c.type && p.size === c.size && p.shape === c.shape && p.inst === c.inst : !c));
        this.ed.settings.newWire = hit ? hit[0] : 'custom';
        if (!hit) this.ed.settings.newWireSpec = c;
        this.ed.app.saveSettings();
        this.ed.toast(`New wires: ${cableLabel(c)}`);
        break;
      }
      case 'delwire': this.closeSheet(); this.wires = null; this.ed.deleteSelection(); break;
      default:
    }
  }

  updateWireReadings() {
    if (!this.sheetOpen) return;
    const box = this.host.querySelector('.insp-read');
    if (!box) return;
    const w = this.wires[0], sim = this.ed.sim, live = this.ed.running && sim && sim.ready;
    let r;
    if (!w.cable) r = [['Ideal wire', 'no resistance and no current limit', '']];
    else if (!live || !w.heat) r = null;
    else r = w.heat.readings();
    if (!r) {
      if (this.readKey !== 'idle') box.innerHTML = '<div class="read muted">Press ▶ Run to see the current and temperature</div>';
      this.readKey = 'idle';
      return;
    }
    if (w.burnt) r[0] = ['State', 'BURNT THROUGH (open circuit)', ''];
    const key = r.map((x) => x[0]).join('|');
    if (key !== this.readKey) { box.innerHTML = r.map(([k, v]) => `<div class="read${typeof v !== 'number' ? ' wide' : ''}"><span>${esc(k)}</span><b></b></div>`).join(''); this.readKey = key; }
    const bs = box.querySelectorAll('b');
    r.forEach(([, v, u], i) => { if (bs[i]) bs[i].textContent = typeof v !== 'number' ? String(v) : isPlainUnit(u) ? fmtQty(v, u) : fmtSI(v, u, 4); });
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
      this.gesture = true; // the undo step is taken by the first change the turn makes (apply)
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
      this.gesture = false;
    };
    this.dial.addEventListener('pointerup', up);
    this.dial.addEventListener('pointercancel', () => { last = null; this.gesture = false; this.host.classList.remove('active'); });
    this.dial.addEventListener('wheel', (ev) => { ev.preventDefault(); this.gesture = true; this.step(ev.deltaY < 0 ? 1 : -1); this.gesture = false; }, { passive: false });
    host.querySelectorAll('.knob-btn').forEach((b) => {
      b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      b.addEventListener('click', (ev) => { ev.stopPropagation(); this.gesture = true; this.bump(b.dataset.k === '+' ? 1 : -1); this.gesture = false; });
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
  parts(v) { let e = Math.floor(Math.log10(v) + 1e-9), m = v / Math.pow(10, e); if (m >= 9.9995) { e += 1; m /= 10; } return [m, e]; } // (only rounding noise counts as the next decade: 9.6 k is 9.6 × 10³, not 0.96 × 10⁴)
  digit() { const v = this.el.p[this.prop.key]; return v > 0 ? Math.min(9, Math.max(1, Math.round(this.parts(v)[0]))) : 1; }
  digitAngle(d) { return ((d - 0.5) * 40 * Math.PI) / 180; }
  /**
   * Steps of a linear knob follow the value as it is shown (with its m / k prefix),
   * not the allowed range: 1–99 of a unit move one at a time, 100–999 ten at a
   * time — 5 V → 6 V, 230 V → 240 V, 10 mA → 11 mA. Going down from 100 (or 1 k)
   * uses the smaller step, so the dial gives 100 → 99 and not 100 → 90. − / + move
   * a tenth of that; whole-number quantities (counts, β…) move by whole numbers.
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
    // one undo step per turn, tap or press, and none when the value stays as it was
    if (this.gesture) { this.gesture = false; this.ed.checkpoint(); }
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
