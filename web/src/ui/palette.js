// Component library bottom sheet: categories, recent items and search.

import { CATEGORIES, getType, allTypes } from '../elements/index.js';
import { Renderer } from './render.js';
import { icon } from './icons.js';
import { store } from './store.js';
import { iosScroll } from './scroller.js';
import { fmtSI } from '../engine/units.js';
import { esc } from './html.js';


export class Palette {
  constructor(editor, host) {
    this.ed = editor;
    this.host = host;
    this.cache = new Map();
    this.tab = 'Recent';
    this.query = '';
    this.sel = null; // the component whose details are shown under the grid
  }

  iconUrl(C) {
    const k = C.type + ':' + this.ed.settings.theme;
    if (!this.cache.has(k)) this.cache.set(k, Renderer.iconFor(C, this.ed.theme, 64));
    return this.cache.get(k);
  }

  open() {
    this.sel = null;
    this.host.innerHTML = `
      <div class="sheet-grip"></div>
      <div class="pal-head">
        <b>Add component</b>
        <div class="search">${icon('search', 18)}<input type="search" placeholder="Search components…" value=""></div>
        <button class="icon-btn" data-close>${icon('x', 20)}</button>
      </div>
      <div class="pal-tabs">
        ${['Recent', ...CATEGORIES.map((c) => c.id)].map((t) => `<button data-t="${t}" class="${t === this.tab ? 'on' : ''}">${icon(t === 'Recent' ? 'clock' : CATEGORIES.find((c) => c.id === t).icon, 16)}<span>${t}</span></button>`).join('')}
      </div>
      <div class="pal-grid"><div class="pal-inner"></div></div>
      <div class="pal-detail" hidden></div>`;
    this.host.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    this.host.querySelectorAll('.pal-tabs button').forEach((b) => b.addEventListener('click', () => {
      this.tab = b.dataset.t; this.query = '';
      this.host.querySelector('input').value = '';
      this.host.querySelectorAll('.pal-tabs button').forEach((x) => x.classList.toggle('on', x === b));
      this.fill();
    }));
    const inp = this.host.querySelector('input');
    inp.addEventListener('input', () => { this.query = inp.value.trim().toLowerCase(); this.fill(); });
    // slide in first, then build the grid on the next frame so the animation never stutters
    this.host.querySelector('.pal-inner').innerHTML = '<div class="pal-loading"></div>';
    this.scroll = iosScroll(this.host.querySelector('.pal-grid'), this.host.querySelector('.pal-inner'));
    this.host.classList.add('open');
    this.ed.root.classList.add('pal-open');
    requestAnimationFrame(() => requestAnimationFrame(() => this.fill()));
  }

  close() { this.host.classList.remove('open'); this.ed.root.classList.remove('pal-open'); }

  /** Render all component icons ahead of time during idle frames. */
  prewarm() {
    const types = allTypes().filter((C) => C.type !== 'base');
    let i = 0;
    const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 50));
    const work = (dl) => {
      while (i < types.length && dl.timeRemaining() > 2) this.iconUrl(types[i++]);
      if (i < types.length) idle(work);
    };
    idle(work);
  }
  get isOpen() { return this.host.classList.contains('open'); }

  items() {
    if (this.query) {
      const q = this.query;
      return allTypes().filter((C) => C.type !== 'base' && (C.title.toLowerCase().includes(q) || (C.keywords || '').includes(q) || C.category.toLowerCase().includes(q)));
    }
    if (this.tab === 'Recent') return store.recent().map(getType).filter(Boolean);
    return CATEGORIES.find((c) => c.id === this.tab).items.map(getType).filter(Boolean);
  }

  fill() {
    const grid = this.host.querySelector('.pal-inner');
    this.scroll?.scrollTo(0, false);
    const items = this.items();
    grid.innerHTML = items.length
      ? items.map((C) => `<button class="pal-item${C.type === this.sel ? ' sel' : ''}" data-type="${C.type}"><img src="${this.iconUrl(C)}" alt=""><span>${C.title}</span></button>`).join('')
      : '<p class="muted pad">No components match your search.</p>';
    // tap a part: its details open under the grid (what it is, how it works, its settings and
    // terminals); tap the same part again, or "Add to board", to put it on the board. The menu
    // stays open so several parts can be added in a row; only ✕ closes it.
    grid.querySelectorAll('.pal-item').forEach((b) => b.addEventListener('click', () => {
      if (this.sel === b.dataset.type) { this.add(b.dataset.type, b); return; }
      this.show(b.dataset.type);
    }));
    this.mark(); // (the details stay while another tab is shown: the menu does not change height)
  }

  add(type, btn) {
    store.pushRecent(type);
    this.ed.addComponent(type);
    const b = btn || this.host.querySelector(`.pal-item[data-type="${type}"]`);
    if (b) { b.classList.remove('added'); void b.offsetWidth; b.classList.add('added'); }
  }

  mark() {
    this.host.querySelectorAll('.pal-item').forEach((x) => x.classList.toggle('sel', x.dataset.type === this.sel));
  }

  /** The details of one part under the grid: description, settings, terminals. null hides them. */
  show(type) {
    this.sel = type;
    const box = this.host.querySelector('.pal-detail'), C = type && getType(type);
    this.host.classList.toggle('has-detail', !!C);
    this.mark();
    if (!C) { box.hidden = true; box.innerHTML = ''; return; }
    let pins = [];
    try { const e = new C(0, 0); const n = e.localPosts().length, names = e.pinNames ? e.pinNames() : null; pins = Array.from({ length: n }, (_, i) => (names && names[i]) || (n === 2 ? `Terminal ${i + 1}` : `Pin ${i + 1}`)); } catch { pins = []; }
    const val = (pr, v) => (pr.type === 'select' ? (pr.options.find(([k]) => String(k) === String(v)) || [v, v])[1] : pr.type === 'bool' ? (v ? 'on' : 'off') : pr.type === 'text' ? String(v) : fmtSI(v, pr.unit && pr.unit !== '%' ? pr.unit : '', 3).trim() + (pr.unit === '%' ? ' %' : ''));
    const props = (C.props || []).filter((pr) => !pr.hidden).slice(0, 8);
    const range = (pr) => (pr.min !== undefined && pr.max !== undefined && !pr.type ? `${fmtSI(pr.min, pr.unit || '', 2).trim()} … ${fmtSI(pr.max, pr.unit || '', 2).trim()}` : '');
    box.hidden = false;
    box.innerHTML = `
      <div class="pd-head"><img src="${this.iconUrl(C)}" alt=""><div><b>${esc(C.title)}</b><small>${esc(C.category)}${pins.length ? ` · ${pins.length} terminal${pins.length > 1 ? 's' : ''}` : ''}</small></div>
        <button class="btn primary pd-add">${icon('plus', 16)} Add to board</button></div>
      <p class="pd-desc">${esc(C.description || 'No description yet.')}</p>
      ${props.length ? `<h5>Settings you can change</h5><ul class="pd-props">${props.map((pr) => `<li><span>${esc(pr.label)}</span><b>${esc(val(pr, pr.def))}</b>${range(pr) ? `<em>${esc(range(pr))}</em>` : ''}</li>`).join('')}</ul>` : ''}
      ${pins.length > 1 ? `<h5>Terminals</h5><p class="pd-pins">${pins.map((n, i) => `<span><i>${i + 1}</i>${esc(n)}</span>`).join('')}</p>` : ''}
      <p class="pd-tip">Tap the part again (or <b>Add to board</b>) to place it. On the board, tap it and open ⚙ to change these settings; press Run to see how it behaves.</p>`;
    box.querySelector('.pd-add').addEventListener('click', () => this.add(type));
    box.scrollTop = 0;
    // the grid is shorter now: keep the tapped part in view
    const it = this.host.querySelector(`.pal-item[data-type="${type}"]`), grid = this.host.querySelector('.pal-grid');
    if (it && this.scroll) requestAnimationFrame(() => {
      const y = this.scroll.y || 0, top = it.offsetTop, h = grid.clientHeight;
      if (top < y || top + it.offsetHeight > y + h) this.scroll.scrollTo(Math.max(0, top - 6), true);
    });
  }
}
