// Component library bottom sheet: categories, recent items and search.

import { CATEGORIES, getType, allTypes } from '../elements/index.js';
import { Renderer } from './render.js';
import { icon } from './icons.js';
import { store } from './store.js';
import { iosScroll } from './scroller.js';

export class Palette {
  constructor(editor, host) {
    this.ed = editor;
    this.host = host;
    this.cache = new Map();
    this.tab = 'Recent';
    this.query = '';
  }

  iconUrl(C) {
    const k = C.type + ':' + this.ed.settings.theme;
    if (!this.cache.has(k)) this.cache.set(k, Renderer.iconFor(C, this.ed.theme, 64));
    return this.cache.get(k);
  }

  open() {
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
      <div class="pal-grid"><div class="pal-inner"></div></div>`;
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
      ? items.map((C) => `<button class="pal-item" data-type="${C.type}"><img src="${this.iconUrl(C)}" alt=""><span>${C.title}</span></button>`).join('')
      : '<p class="muted pad">No components match your search.</p>';
    grid.querySelectorAll('.pal-item').forEach((b) => b.addEventListener('click', () => {
      // the menu stays open so several parts can be added in a row; only ✕ closes it
      store.pushRecent(b.dataset.type);
      this.ed.addComponent(b.dataset.type);
      b.classList.remove('added'); void b.offsetWidth; b.classList.add('added');
    }));
  }
}
