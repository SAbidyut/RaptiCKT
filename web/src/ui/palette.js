// Component library bottom sheet: categories, recent items and search.

import { CATEGORIES, getType, allTypes } from '../elements/index.js';
import { Renderer } from './render.js';
import { icon } from './icons.js';
import { store } from './store.js';

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
      <div class="sheet-grip" data-close></div>
      <div class="pal-head">
        <b>Add component</b>
        <div class="search">${icon('search', 18)}<input type="search" placeholder="Search ${allTypes().length}+ components…" value=""></div>
        <button class="icon-btn" data-close>${icon('x', 20)}</button>
      </div>
      <div class="pal-tabs">
        ${['Recent', ...CATEGORIES.map((c) => c.id)].map((t) => `<button data-t="${t}" class="${t === this.tab ? 'on' : ''}">${icon(t === 'Recent' ? 'clock' : CATEGORIES.find((c) => c.id === t).icon, 16)}<span>${t}</span></button>`).join('')}
      </div>
      <div class="pal-grid"></div>`;
    this.host.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    this.host.querySelectorAll('.pal-tabs button').forEach((b) => b.addEventListener('click', () => {
      this.tab = b.dataset.t; this.query = '';
      this.host.querySelector('input').value = '';
      this.host.querySelectorAll('.pal-tabs button').forEach((x) => x.classList.toggle('on', x === b));
      this.fill();
    }));
    const inp = this.host.querySelector('input');
    inp.addEventListener('input', () => { this.query = inp.value.trim().toLowerCase(); this.fill(); });
    this.fill();
    this.host.classList.add('open');
    this.ed.overlayOpen('palette');
  }

  close() { this.host.classList.remove('open'); this.ed.overlayClosed('palette'); }
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
    const grid = this.host.querySelector('.pal-grid');
    const items = this.items();
    grid.innerHTML = items.length
      ? items.map((C) => `<button class="pal-item" data-type="${C.type}"><img src="${this.iconUrl(C)}" alt=""><span>${C.title}</span></button>`).join('')
      : '<p class="muted pad">No components match your search.</p>';
    grid.querySelectorAll('.pal-item').forEach((b) => b.addEventListener('click', () => {
      store.pushRecent(b.dataset.type);
      this.close();
      this.ed.addComponent(b.dataset.type);
    }));
  }
}
