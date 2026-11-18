// Home, About and Settings screens.

import { icon, LOGO_SVG } from './icons.js';
import { APP, RAPTI } from './brand.js';
import { EXAMPLES, exampleCategories } from './examples.js';
import { store, DEFAULT_SETTINGS } from './store.js';
import { allTypes, CATEGORIES } from '../elements/index.js';
import { THEMES } from './theme.js';
import { fmtSI, parseSI } from '../engine/units.js';
import { iosScroll } from './scroller.js';
import { motion } from './motion.js';
import { esc } from './html.js';

// 01617-345534 style, as printed by RAPTI
const fmtPhone = (p) => p.replace(/^\+880/, '0').replace(/^(\d{5})(\d+)$/, '$1-$2');

function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return new Date(ts).toLocaleDateString();
}

// -------------------------------------------------------------------- home
/** The Home bottom bar; the manual screen shows the same one so the menu never disappears. */
export const NAV_TABS = [['home', 'bolt', 'Home'], ['examples', 'book', 'Examples'], ['library', 'folder', 'My Circuits'], ['manual', 'manual', 'Manual'], ['about', 'info', 'About']];

export class HomeScreen {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.tab = 'home';
    this.cat = 'All';
    this.folder = null; // My Circuits: folder being viewed (null = top level)
    this.sel = null;    // My Circuits: Set of selected 'f:id' / 'c:id' while in select mode
  }

  render() {
    const n = allTypes().filter((t) => t.type !== 'base').length;
    this.root.innerHTML = `
      <div class="home-scroll">
        <header class="home-head">
          <button class="brand" data-h="brand" title="About RAPTI">${LOGO_SVG(44, 'hl')}<div><b>Rapti<span>CKT</span></b><small>${APP.tagline}</small></div></button>
          <button class="icon-btn" data-h="settings" title="Settings">${icon('sliders', 22)}</button>
        </header>
        <div class="home-body"></div>
      </div>
      <nav class="bottom-nav">
        ${NAV_TABS.map(([t, ic, l]) => `<button data-tab="${t}" class="${this.tab === t ? 'on' : ''}">${icon(ic, 22)}<span>${l}</span></button>`).join('')}
      </nav>`;
    this.root.querySelector('[data-h=settings]').addEventListener('click', () => this.app.openSettings());
    this.root.querySelector('[data-h=brand]').addEventListener('click', () => this.openInstitute());
    this.root.querySelectorAll('.bottom-nav button').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.tab === 'manual' && this.tab === 'manual') this.app.manual.reset(); // tapping it again: back to the contents
      this.tab = b.dataset.tab; this.sel = null; this.render();
    }));
    const body = this.root.querySelector('.home-body');
    const scroller = this.root.querySelector('.home-scroll');
    const head = this.root.querySelector('.home-head');
    this.scroller = scroller;
    this.lastScroll = 0;
    let scrolled = false;
    const onScroll = (y) => {
      this.lastScroll = performance.now();
      const s2 = y > 4;
      if (s2 !== scrolled) { scrolled = s2; head.classList.toggle('scrolled', s2); }
    };
    // once the reveal of a card has finished, drop its classes so press feedback works as usual
    body.addEventListener('transitionend', (ev) => {
      const t = ev.target;
      if (ev.propertyName === 'transform' && t.classList.contains('rv') && t.classList.contains('in')) { t.classList.remove('rv', 'in'); t.style.removeProperty('--d'); }
    });
    body.classList.add(this.shown ? 'swap' : 'intro');
    this.shown = true;
    if (this.tab === 'home') this.renderHome(body, n);
    if (this.tab === 'examples') this.renderExamples(body);
    if (this.tab === 'library') this.renderLibrary(body);
    if (this.tab === 'about') renderAbout(this.app, body);
    if (this.tab === 'manual') this.app.manual.mountTab(body, this);
    this.scrollApi = iosScroll(scroller, body, { onScroll });
    this.restore(body);
    this.reveal(body);
  }

  /**
   * Remember where the page is scrolled (and the category chips), so coming back
   * from a circuit or Settings lands on the same card instead of the top.
   */
  remember() {
    if (!this.scrollApi) return;
    const row = this.root.querySelector('.home-body .chips');
    this.kept = { tab: this.tab, folder: this.folder, cat: this.cat, y: this.scrollApi.y, chips: row ? (row._axis ? row._axis.pos : row.scrollLeft) : 0 };
  }

  restore(body) {
    const k = this.kept;
    this.kept = null;
    if (!k || k.tab !== this.tab || k.folder !== this.folder || k.cat !== this.cat) return;
    const row = body.querySelector('.chips');
    if (row && k.chips) {
      const ax = row._axis;
      if (ax) { ax.measure(); ax.pos = ax.bound(k.chips); ax.apply(ax.pos); } else row.scrollLeft = k.chips;
    }
    if (k.y > 0) this.scrollApi.scrollTo(k.y, false);
  }

  /** Open About and bring the RAPTI institute introduction into view. */
  openInstitute() {
    if (this.tab !== 'about') { this.tab = 'about'; this.render(); }
    const go = () => {
      const card = this.root.querySelector('.about-card.rapti'), sc = this.scroller, api = this.scrollApi;
      if (!card || !sc || !api) return;
      const head = this.root.querySelector('.home-head')?.offsetHeight || 0;
      // layout position (not the on-screen one, which an entrance animation may still be shifting)
      let y = -head - 12;
      for (let n = card; n && n !== sc; n = n.offsetParent) y += n.offsetTop;
      api.scrollTo(Math.max(0, y), true);
    };
    requestAnimationFrame(() => requestAnimationFrame(go)); // after the page has laid out
  }

  /**
   * Scroll-in animation: cards below the fold rise and fade in as they scroll
   * into view (transform + opacity only, so it stays on the compositor).
   */
  reveal(body) {
    this.io?.disconnect();
    const scroller = this.scroller;
    if (!scroller || !motion.smooth || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const intro = body.classList.contains('intro');
    const items = [...body.querySelectorAll('.ex-item, .lib-item')];
    if (this.tab === 'home' || this.tab === 'about') items.push(...body.children);
    const top = scroller.getBoundingClientRect().top, bottom = top + scroller.clientHeight;
    const later = [];
    let k = 0;
    for (const el of items) {
      const r = el.getBoundingClientRect();
      if (r.top < bottom && r.bottom > top) {
        if (intro && el.parentElement === body) continue; // already rising in with the page
        el.classList.add('rv');
        el.style.setProperty('--d', `${Math.min(k++ * 0.05, 0.3)}s`);
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
      } else {
        el.classList.add('rv');
        el.style.animation = 'none';
        later.push(el);
      }
    }
    this.io = new IntersectionObserver((entries) => {
      let j = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.style.setProperty('--d', `${Math.min(j++ * 0.06, 0.24)}s`);
        e.target.classList.add('in');
        this.io.unobserve(e.target);
      }
    }, { root: scroller, rootMargin: '0px 0px -4% 0px', threshold: 0.06 });
    later.forEach((el) => this.io.observe(el));
  }

  renderHome(body, n) {
    const lib = store.circuits();
    const auto = store.loadAutosave();
    body.innerHTML = `
      <section class="hero">
        <div class="hero-wave"></div>
        <h1>${APP.slogan}</h1>
        <p>Real-time analog, digital & mixed-signal circuit simulation for electrical and electronic engineers.</p>
        <div class="hero-btns">
          <button class="btn primary big" data-h="new">${icon('plus', 20)} New circuit</button>
          <button class="btn glass big" data-h="open">${icon('upload', 20)} Open file</button>
        </div>
        <div class="hero-stats">
          <div><b>${n}</b><span>components</span></div>
          <div><b>${EXAMPLES.length}</b><span>examples</span></div>
          <div><b>4</b><span>analyses</span></div>
        </div>
      </section>
      ${auto && auto.elements && auto.elements.length ? `
      <button class="resume" data-h="resume">${icon('play', 18)}<div><b>Continue where you left off</b><span>${esc(auto.name)} · ${auto.elements.length} components</span></div>${icon('back', 18, 'flipx')}</button>` : ''}
      <button class="lf-banner" data-h="loadflow"><span class="lf-ico">${icon('tower', 26)}</span><div><b>Load Flow Analysis</b><span>Power-system bus voltages, line flows & losses · Newton–Raphson, Gauss–Seidel, Fast Decoupled, DC · IEEE test systems</span></div>${icon('back', 18, 'flipx')}</button>
      ${lib.length ? `<h3 class="sec-title">Recent circuits <button class="link" data-tab2="library">See all</button></h3>
      <div class="card-row">${lib.slice(0, 6).map((c) => this.circuitCard(c)).join('')}</div>` : `
      <div class="home-empty">${icon('folder', 22)}<div><b>No saved circuits yet</b><span>Tap <b>New circuit</b> to start drawing — your circuits will appear here.</span></div></div>`}
      <section class="rapti-banner" data-h="about">
        ${LOGO_SVG(40, 'rb')}
        <div><b>${RAPTI.full}</b><span>Industrial automation & electrical training · ${esc(RAPTI.city)}</span></div>
        ${icon('back', 18, 'flipx')}
      </section>
      <p class="home-foot">${esc(APP.slogan)} · rapti.net</p>`;
    this.bindCards(body);
    body.querySelector('[data-h=new]').addEventListener('click', () => this.app.newCircuit());
    body.querySelector('[data-h=open]').addEventListener('click', () => this.app.importFile());
    body.querySelector('[data-h=resume]')?.addEventListener('click', () => this.app.resume());
    body.querySelector('[data-h=loadflow]').addEventListener('click', () => this.app.openLoadFlow());
    body.querySelector('[data-h=about]').addEventListener('click', () => this.openInstitute());
    body.querySelectorAll('[data-tab2]').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab2; this.render(); }));
    this.drawThumbs(body);
  }

  renderExamples(body) {
    const cats = ['All', ...exampleCategories()];
    body.innerHTML = `
      <h2 class="page-title">Examples</h2>
      <p class="page-sub">Ready-made circuits with explanations. Open one, press Run and experiment.</p>
      <div class="chips">${cats.map((c) => `<button class="chip2 ${c === this.cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="ex-list">${this.exampleItems()}</div>`;
    // a category only swaps the list below: the chip row stays where it was scrolled to
    body.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.cat === this.cat) { this.showChip(b); return; }
      this.cat = b.dataset.cat;
      body.querySelectorAll('[data-cat]').forEach((c) => c.classList.toggle('on', c === b));
      this.showChip(b);
      const list = body.querySelector('.ex-list');
      list.innerHTML = this.exampleItems();
      this.bindCards(list);
      this.drawThumbs(list);
      this.scrollApi?.refresh();
      this.reveal(body);
    }));
    this.bindCards(body);
    this.drawThumbs(body);
  }

  exampleItems() {
    return EXAMPLES.filter((e) => this.cat === 'All' || e.cat === this.cat).map((e) => `
        <button class="ex-item" data-ex="${e.id}">
          <canvas class="thumb" data-thumb-ex="${e.id}"></canvas>
          <div><span class="tag">${esc(e.cat)}</span><b>${esc(e.title)}</b><p>${esc(e.desc)}</p></div>
        </button>`).join('');
  }

  /** Slide the chip row just enough that a chip cut off at either edge is fully in view. */
  showChip(chip) {
    const row = chip.closest('.chips');
    if (!row) return;
    const pad = 16, w = row.clientWidth, ax = row._axis;
    const x = ax ? chip.offsetLeft - (row.firstElementChild?.offsetLeft || 0) : chip.offsetLeft - row.offsetLeft;
    const cur = ax ? (ax.mode === 'glide' ? ax.target : ax.pos) : row.scrollLeft;
    let to = cur;
    if (x - pad < cur) to = x - pad;
    else if (x + chip.offsetWidth + pad > cur + w) to = x + chip.offsetWidth + pad - w;
    if (Math.abs(to - cur) < 1) return;
    if (ax) { ax.measure(); ax.glideTo(to); } else row.scrollTo({ left: Math.max(0, to), behavior: 'smooth' });
  }

  // ------------------------------------------------- My Circuits: folders and projects
  /** Folder trail from the top down to the folder being viewed. */
  trail() {
    const all = store.folders(), out = [];
    for (let id = this.folder; id; ) { const f = all.find((x) => x.id === id); if (!f) break; out.unshift(f); id = f.parent; }
    return out;
  }

  /** Back button: leave select mode first, then go up one folder. Returns false at the top. */
  upOne() {
    if (this.sel) { this.sel = null; this.render(); return true; }
    if (this.folder) {
      const f = store.folders().find((x) => x.id === this.folder);
      this.folder = f ? f.parent || null : null;
      this.render();
      return true;
    }
    return false;
  }

  /** The shown folder may have been deleted (or never existed after a restore): fall back to the top. */
  checkFolder() { if (this.folder && !store.folders().some((f) => f.id === this.folder)) this.folder = null; }

  renderLibrary(body) {
    this.checkFolder();
    const folders = store.folders().filter((f) => (f.parent || null) === this.folder);
    const circuits = store.circuits().filter((c) => (c.folder || null) === this.folder);
    const all = store.circuits(), allF = store.folders();
    const inFolder = (fid) => { const ids = new Set(store.folderTree(fid)); return all.filter((c) => ids.has(c.folder)).length; };
    const sel = this.sel, here = this.trail();
    const keyOf = (t, id) => `${t}:${id}`;
    const nSel = sel ? sel.size : 0;
    const total = folders.length + circuits.length;
    body.innerHTML = `
      <h2 class="page-title">My Circuits</h2>
      <nav class="crumbs">
        ${here.length ? `<button data-f="">${icon('folder', 15)} My Circuits</button>` : `<span>${icon('folder', 15)} My Circuits</span>`}
        ${here.map((f, i) => `<i>›</i>${i < here.length - 1 ? `<button data-f="${f.id}">${esc(f.name)}</button>` : `<span>${esc(f.name)}</span>`}`).join('')}
      </nav>
      <p class="page-sub">${here.length ? `${folders.length} folder${folders.length === 1 ? '' : 's'}, ${circuits.length} project${circuits.length === 1 ? '' : 's'} here.` : 'Saved on this device. Make folders to keep your projects tidy.'}</p>
      ${sel ? `
      <div class="btn-row sel-bar">
        <b class="sel-count">${nSel} selected</b>
        <button class="btn sm" data-h="selall">${icon('check', 16)} ${nSel === total && total ? 'None' : 'All'}</button>
        <button class="btn sm" data-h="move" ${nSel ? '' : 'disabled'}>${icon('folder', 16)} Move</button>
        <button class="btn sm danger" data-h="delsel" ${nSel ? '' : 'disabled'}>${icon('trash', 16)} Delete</button>
        <button class="btn sm" data-h="selx">${icon('x', 16)}</button>
      </div>` : `
      <div class="btn-row">
        <button class="btn primary" data-h="new">${icon('plus', 18)} New project</button>
        <button class="btn" data-h="newf">${icon('folder', 18)} New folder</button>
        <button class="btn" data-h="open">${icon('upload', 18)} Import</button>
        <button class="btn" data-h="backup">${icon('download', 18)} Backup all</button>
        ${total ? `<button class="btn" data-h="select">${icon('select', 18)} Select</button>` : ''}
      </div>`}
      ${total ? `<div class="lib-list">
        ${folders.map((f) => {
          const n = inFolder(f.id), sub = allF.filter((x) => x.parent === f.id).length;
          return `<div class="lib-item folder ${sel?.has(keyOf('f', f.id)) ? 'sel' : ''}" data-k="${keyOf('f', f.id)}">
            <div class="thumb folder-ico">${icon('folder', 34)}</div>
            <div class="lib-meta"><b>${esc(f.name)}</b><span>${sub ? `${sub} folder${sub === 1 ? '' : 's'}, ` : ''}${n} project${n === 1 ? '' : 's'}</span></div>
            ${sel ? `<span class="sel-box">${icon('check', 16)}</span>` : `<button class="icon-btn" data-act="menu">${icon('more', 20)}</button>`}
          </div>`;
        }).join('')}
        ${circuits.map((c) => `
        <div class="lib-item ${sel?.has(keyOf('c', c.id)) ? 'sel' : ''}" data-k="${keyOf('c', c.id)}">
          ${c.thumb ? `<img class="thumb" src="${c.thumb}" alt="">` : '<div class="thumb"></div>'}
          <div class="lib-meta"><b>${esc(c.name)}</b><span>${c.count || 0} components · ${ago(c.updated)}</span></div>
          ${sel ? `<span class="sel-box">${icon('check', 16)}</span>` : `<button class="icon-btn" data-act="menu">${icon('more', 20)}</button>`}
        </div>`).join('')}
      </div>` : `<div class="empty">${icon('folder', 40)}<b>${here.length ? 'This folder is empty' : 'No saved projects yet'}</b><span>${here.length ? 'Tap New project or New folder to add something here.' : 'Projects you build are saved here automatically.'}</span></div>`}`;

    const on = (sel2, fn) => body.querySelector(sel2)?.addEventListener('click', fn);
    on('[data-h=new]', () => this.newProject());
    on('[data-h=newf]', () => this.newFolder());
    on('[data-h=open]', () => this.app.importFile());
    on('[data-h=backup]', () => this.app.backupAll());
    on('[data-h=select]', () => { this.sel = new Set(); this.render(); });
    on('[data-h=selx]', () => { this.sel = null; this.render(); });
    on('[data-h=selall]', () => {
      const keys = [...folders.map((f) => keyOf('f', f.id)), ...circuits.map((c) => keyOf('c', c.id))];
      // (counted now: rows ticked one by one since this page was drawn are not in nSel)
      this.sel = this.sel && this.sel.size === keys.length ? new Set() : new Set(keys);
      this.render();
    });
    on('[data-h=move]', () => this.moveSheet([...this.sel]));
    on('[data-h=delsel]', () => this.deleteSheet([...this.sel]));
    body.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { this.folder = b.dataset.f || null; this.sel = null; this.render(); }));
    body.querySelectorAll('.lib-item').forEach((it) => {
      const key = it.dataset.k, [t, id] = [key[0], key.slice(2)];
      it.addEventListener('click', (ev) => {
        if (this.sel) {
          this.sel.has(key) ? this.sel.delete(key) : this.sel.add(key);
          // only this row and the bar change, so the list keeps its scroll position
          it.classList.toggle('sel', this.sel.has(key));
          const n = this.sel.size;
          body.querySelector('.sel-count').textContent = `${n} selected`;
          body.querySelectorAll('[data-h=move], [data-h=delsel]').forEach((x) => { x.disabled = !n; });
          body.querySelector('[data-h=selall]').lastChild.textContent = ` ${n === total ? 'None' : 'All'}`;
          return;
        }
        if (ev.target.closest('[data-act=menu]')) { t === 'f' ? this.folderMenu(id) : this.itemMenu(id); return; }
        if (t === 'f') { this.folder = id; this.render(); } else this.app.openSaved(id);
      });
    });
  }

  /**
   * A circuit that is being deleted is not offered again as "Continue where you left off"
   * (opening that brought it straight back into My Circuits).
   */
  forgetAutosave(ids) {
    const a = store.loadAutosave();
    if (!a) return;
    const el = JSON.stringify(a.elements);
    if (store.circuits().some((c) => ids.includes(c.id) && c.name === a.name && JSON.stringify(c.data.elements) === el)) store.clearAutosave();
  }

  newProject() {
    const n = prompt('Project name', 'Untitled project');
    if (n === null) return;
    this.app.newCircuit(this.folder, n.trim().slice(0, 80) || 'Untitled project');
  }

  newFolder() {
    const n = prompt('Folder name', 'New folder');
    if (n === null || !n.trim()) return;
    store.addFolder(this.app.uid(), n.trim().slice(0, 60), this.folder);
    this.render();
  }

  folderMenu(id) {
    const f = store.folders().find((x) => x.id === id);
    if (!f) return;
    this.app.showSheet(esc(f.name), `
      <div class="sheet-actions">
        <button data-x="open">${icon('folder', 18)} Open</button>
        <button data-x="rename">${icon('edit', 18)} Rename</button>
        <button data-x="move">${icon('upload', 18)} Move to…</button>
        <button data-x="del" class="danger">${icon('trash', 18)} Delete folder</button>
      </div>`, (root, close) => {
      root.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => {
        const x = b.dataset.x;
        close();
        if (x === 'open') { this.folder = id; this.render(); }
        if (x === 'rename') { const n = prompt('Rename folder', f.name); if (n && n.trim()) { store.renameFolder(id, n.trim().slice(0, 60)); this.render(); } }
        if (x === 'move') this.moveSheet([`f:${id}`]);
        if (x === 'del') this.deleteSheet([`f:${id}`]);
      }));
    });
  }

  /** Choose where the selected folders / projects go. A folder cannot go into itself or into its own subfolders. */
  moveSheet(keys) {
    const fids = keys.filter((k) => k[0] === 'f').map((k) => k.slice(2)), cids = keys.filter((k) => k[0] === 'c').map((k) => k.slice(2));
    if (!keys.length) return;
    const barred = new Set(fids.flatMap((id) => store.folderTree(id)));
    const all = store.folders();
    const rows = [];
    const walk = (parent, depth) => {
      for (const f of all.filter((x) => (x.parent || null) === parent).sort((a, b) => a.name.localeCompare(b.name))) {
        if (barred.has(f.id)) continue;
        rows.push([f.id, f.name, depth]);
        walk(f.id, depth + 1);
      }
    };
    walk(null, 1);
    const what = `${keys.length} item${keys.length === 1 ? '' : 's'}`;
    this.app.showSheet(`Move ${what} to…`, `
      <div class="sheet-actions move-list">
        <button data-to="" class="${this.folder ? '' : 'here'}">${icon('home', 18)} My Circuits <small>top level</small></button>
        ${rows.map(([id, name, d]) => `<button data-to="${id}" style="padding-left:${10 + d * 18}px" class="${this.folder === id ? 'here' : ''}">${icon('folder', 18)} ${esc(name)}</button>`).join('')}
        <button data-to="__new" class="accent">${icon('plus', 18)} New folder…</button>
      </div>`, (root, close) => {
      root.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', () => {
        let to = b.dataset.to || null;
        if (to === '__new') {
          const n = prompt('Folder name', 'New folder');
          if (!n || !n.trim()) return;
          to = this.app.uid();
          store.addFolder(to, n.trim().slice(0, 60), this.folder);
        }
        close();
        if (cids.length) store.moveCircuits(cids, to);
        if (fids.length) store.moveFolders(fids, to);
        this.sel = null;
        this.app.bridge.vibrate(12);
        this.render();
      }));
    });
  }

  /** Delete the selected folders / projects after asking (with a chance to back everything up first). */
  deleteSheet(keys) {
    const fids = keys.filter((k) => k[0] === 'f').map((k) => k.slice(2)), cids = keys.filter((k) => k[0] === 'c').map((k) => k.slice(2));
    if (!keys.length) return;
    const gone = new Set(fids.flatMap((id) => store.folderTree(id)));
    const inside = store.circuits().filter((c) => gone.has(c.folder) && !cids.includes(c.id)).length;
    const nProj = cids.length + inside, nFold = gone.size;
    const parts = [];
    if (nProj) parts.push(`${nProj} project${nProj === 1 ? '' : 's'}`);
    if (nFold) parts.push(`${nFold} folder${nFold === 1 ? '' : 's'}`);
    this.app.showSheet('Delete selected?', `
      <p class="sheet-note">${parts.join(' and ')} will be removed from this phone${inside ? ` (including ${inside} project${inside === 1 ? '' : 's'} inside the selected folders)` : ''}. This cannot be undone.</p>
      <div class="sheet-actions">
        <button data-x="backup">${icon('download', 18)} Backup all first</button>
        <button data-x="del" class="danger">${icon('trash', 18)} Delete</button>
        <button data-x="cancel">${icon('x', 18)} Cancel</button>
      </div>`, (root, close) => {
      root.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => {
        const x = b.dataset.x;
        if (x === 'backup') { this.app.backupAll(); return; } // stay open: delete after saving
        close();
        if (x === 'del') {
          this.forgetAutosave([...cids, ...store.circuits().filter((c) => gone.has(c.folder)).map((c) => c.id)]);
          if (cids.length) store.deleteCircuits(cids);
          if (fids.length) store.deleteFolders(fids);
          this.sel = null;
          this.app.bridge.vibrate(20);
          this.render();
        }
      }));
    });
  }

  itemMenu(id) {
    const c = store.getCircuit(id);
    if (!c) return;
    this.app.showSheet(esc(c.name), `
      <div class="sheet-actions">
        <button data-x="open">${icon('play', 18)} Open</button>
        <button data-x="rename">${icon('edit', 18)} Rename</button>
        <button data-x="move">${icon('folder', 18)} Move to folder…</button>
        <button data-x="dup">${icon('copy', 18)} Duplicate</button>
        <button data-x="export">${icon('download', 18)} Export file</button>
        <button data-x="share">${icon('share', 18)} Share</button>
        <button data-x="del" class="danger">${icon('trash', 18)} Delete</button>
      </div>`, (root, close) => {
      root.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => {
        const x = b.dataset.x;
        close();
        if (x === 'open') this.app.openSaved(id);
        if (x === 'move') this.moveSheet([`c:${id}`]);
        if (x === 'rename') { const n = prompt('Rename circuit', c.name); if (n && n.trim()) { c.name = n.trim(); c.data.name = c.name; store.saveCircuit(c); this.render(); } }
        if (x === 'dup') { const d = JSON.parse(JSON.stringify(c)); d.id = this.app.uid(); d.name += ' (copy)'; d.data.name = d.name; d.updated = Date.now(); store.saveCircuit(d); this.render(); }
        if (x === 'export') this.app.bridge.saveFile(c.name.replace(/[^\w\- ]+/g, '_') + '.rckt', 'application/json', JSON.stringify(c.data, null, 1));
        if (x === 'share') this.app.bridge.share(c.name + ' – RaptiCKT circuit', JSON.stringify(c.data));
        if (x === 'del' && confirm(`Delete "${c.name}"?`)) { this.forgetAutosave([id]); store.deleteCircuit(id); this.render(); }
      }));
    });
  }

  circuitCard(c) {
    return `<button class="card" data-open="${c.id}">${c.thumb ? `<img class="thumb" src="${c.thumb}" alt="">` : '<div class="thumb"></div>'}<b>${esc(c.name)}</b><span>${ago(c.updated)}</span></button>`;
  }

  bindCards(body) {
    body.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => this.app.openExample(b.dataset.ex)));
    body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => this.app.openSaved(b.dataset.open)));
  }

  /**
   * Example thumbnails are drawn lazily: only when a card comes near the screen,
   * one per idle slot, and never while the list is moving, so scrolling stays smooth.
   * Drawn thumbnails are cached for the session.
   */
  drawThumbs(body) {
    const cvs = [...body.querySelectorAll('canvas[data-thumb-ex]')];
    const place = (cv) => {
      const ex = EXAMPLES.find((e) => e.id === cv.dataset.thumbEx);
      if (!ex || !cv.isConnected) return;
      const img = new Image();
      img.className = 'thumb';
      img.decoding = 'async';
      img.alt = '';
      img.src = this.app.exampleThumb(ex);
      cv.replaceWith(img);
    };
    this.thumbIO?.disconnect();
    const queue = this.thumbQueue = []; // a new page replaces the old queue (its canvases are gone)
    this.placeThumb = place;
    const io = this.thumbIO = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); queue.push(e.target); }
      this.pumpThumbs();
    }, { rootMargin: '300px' }) : null;
    for (const cv of cvs) {
      if (this.app.hasExampleThumb(cv.dataset.thumbEx)) place(cv); // cached: instant
      else if (io) io.observe(cv); else queue.push(cv);
    }
    if (!io) this.pumpThumbs();
    // the rest are drawn ahead only where they are about to be scrolled to: the Examples page
    // (drawing all of them behind the Home page cost seconds of work for pictures never seen)
    if (this.tab === 'examples') this.warmThumbs();
  }

  /** Run fn when the page is idle and has not scrolled for a moment. */
  whenCalm(fn) {
    const go = () => {
      if (performance.now() - (this.lastScroll || 0) < 160) { setTimeout(() => this.whenCalm(fn), 120); return; }
      fn();
    };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 400 }); else setTimeout(go, 30);
  }

  pumpThumbs() {
    if (this.pumping) return;
    this.pumping = true;
    const step = () => {
      const cv = this.thumbQueue.shift();
      if (!cv) { this.pumping = false; return; }
      this.placeThumb(cv);
      this.whenCalm(step);
    };
    this.whenCalm(step);
  }

  /** Pre-draw the remaining example thumbnails in the background, one at a time. */
  warmThumbs() {
    if (this.warming) return;
    this.warming = true;
    const todo = EXAMPLES.filter((e) => !this.app.hasExampleThumb(e.id));
    const step = () => {
      // only while the Examples page is shown: not behind a running circuit, where it took frames from it
      if (this.app.current !== 'home' || this.tab !== 'examples') { this.warming = false; return; }
      const ex = todo.shift();
      if (!ex) { this.warming = false; return; }
      this.app.exampleThumb(ex);
      this.whenCalm(step);
    };
    setTimeout(() => this.whenCalm(step), 900);
  }
}

// ------------------------------------------------------------------- about
export function renderAbout(app, body) {
  body.innerHTML = `
    <section class="about-hero">
      <div class="about-logo">${LOGO_SVG(92, 'ab')}</div>
      <h2>Rapti<span>CKT</span></h2>
      <p class="about-tag">${APP.tagline} · ${APP.subtitle}</p>
      <p class="about-ver">Version ${esc(APP.version)} (${esc(app.bridge.version())})</p>
    </section>
    <section class="about-card">
      <h3>${icon('bolt', 18)} About the app</h3>
      <p><b>RaptiCKT</b> is a real-time circuit simulator built for electrical & electronic engineering students, hobbyists and researchers. Build analog, digital and mixed-signal circuits on an unlimited canvas and watch voltages and currents come alive.</p>
      <p>Under the hood is a SPICE-class engine: Modified Nodal Analysis, Newton–Raphson with junction limiting, trapezoidal / backward-Euler integration, DC operating point with gmin and source stepping, and small-signal AC analysis. Device models include Shockley diodes, Ebers–Moll BJTs with Early effect, level-1 MOSFETs, JFETs, op-amp macromodels with GBW and slew rate, coupled-inductor transformers and electromechanical DC motors.</p>
      <ul class="about-list">
        <li>${icon('chip', 16)} ${allTypes().filter((t) => t.type !== 'base').length} components in ${CATEGORIES.length} categories</li>
        <li>${icon('scope', 16)} 6-channel oscilloscope with FFT & XY modes</li>
        <li>${icon('bode', 16)} Bode plots, DC sweeps, operating-point tables</li>
        <li>${icon('code', 16)} SPICE netlist & CSV export for research work</li>
        <li>${icon('gauge', 16)} Live knob control & interactive switches</li>
      </ul>
    </section>
    <section class="about-card rapti">
      <h3>${icon('star', 18)} ${RAPTI.full}</h3>
      <p class="lead">${esc(RAPTI.mission)}</p>
      <p>${esc(RAPTI.about)}</p>
      <h4>Courses</h4>
      <p class="small course-hint">Tap a course to see what it covers and how long it takes.</p>
      <div class="course-chips">${RAPTI.courseList.map((c, i) => `<button data-course="${i}">${esc(c.name)}</button>`).join('')}</div>
      <h4>Contact</h4>
      <div class="contact">
        <button data-u="${RAPTI.website}">${icon('globe', 18)}<div><b>Website</b><span>rapti.net</span></div></button>
        ${RAPTI.phones.map((p) => `<button data-u="tel:${p}">${icon('phone', 18)}<div><b>Call</b><span>${fmtPhone(p)}</span></div></button>`).join('')}
        <button data-u="https://wa.me/${RAPTI.whatsapp.replace(/\D/g, '')}">${icon('chat', 18)}<div><b>WhatsApp</b><span>${fmtPhone(RAPTI.whatsapp)} · we reply fast</span></div></button>
        <button data-u="mailto:${RAPTI.email}">${icon('mail', 18)}<div><b>Email</b><span>${esc(RAPTI.email)}</span></div></button>
        <button data-u="${RAPTI.mapsUrl}">${icon('pin', 18)}<div><b>Visit</b><span>${esc(RAPTI.address)}</span></div></button>
        <button data-u="${RAPTI.coursesUrl}">${icon('book', 18)}<div><b>Courses & admission</b><span>rapti.net/app-course</span></div></button>
      </div>
    </section>
    <section class="about-card">
      <h3>${icon('info', 18)} Accuracy notes</h3>
      <p class="small">Results follow the documented device models and SPICE-default tolerances (RELTOL 1e-3, VNTOL 1 µV, GMIN 1e-12) and have been verified against analytic solutions. Behavioural blocks (logic, 555, regulators, sensors) are idealised models — always validate critical designs with datasheets and lab measurements. Use <em>Analysis → SPICE netlist</em> to cross-check in ngspice/LTspice.</p>
    </section>
    <p class="copyright">© ${new Date().getFullYear()} ${RAPTI.full} · rapti.net</p>`;
  body.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => app.bridge.openUrl(b.dataset.u)));
  body.querySelectorAll('[data-course]').forEach((b) => b.addEventListener('click', () => {
    const c = RAPTI.courseList[+b.dataset.course];
    app.showSheet(esc(c.name), `
      <div class="course-pop">
        <span class="tag">${esc(c.cat)}</span>
        <h5>What is this course about?</h5>
        <p>${esc(c.about)}</p>
        <h5>Duration</h5>
        <p class="dur">${icon('clock', 18)} <b>${esc(c.months)}</b></p>
        <div class="sheet-actions"><button data-x="site">${icon('globe', 18)} Syllabus, fee & admission on rapti.net</button></div>
      </div>`, (root) => root.querySelector('[data-x=site]').addEventListener('click', () => app.bridge.openUrl(RAPTI.coursesUrl)));
  }));
}

// ---------------------------------------------------------------- settings
export function renderSettings(app, root) {
  const s = app.settings;
  const row = (label, ctl, hint = '') => `<label class="set-row"><div><b>${label}</b>${hint ? `<span>${hint}</span>` : ''}</div>${ctl}</label>`;
  const sel = (k, opts) => `<select data-k="${k}">${opts.map(([v, t]) => `<option value="${v}" ${String(s[k]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const tog = (k) => `<input type="checkbox" class="toggle" data-k="${k}" ${s[k] ? 'checked' : ''}>`;
  const num = (k, u) => `<input type="text" class="num" data-k="${k}" data-num="1" value="${fmtSI(s[k], '', 3).trim()}"><em>${u}</em>`;
  root.innerHTML = `
    <header class="topbar plain"><button class="icon-btn" data-x="back">${icon('back', 22)}</button><div class="title"><b>Settings</b></div></header>
    <div class="set-scroll">
      <h4>Appearance</h4>
      ${row('Theme', sel('theme', Object.entries(THEMES).map(([k, t]) => [k, t.name])))}
      ${row('Grid', sel('grid', [['lines', 'Lines'], ['dots', 'Dots'], ['none', 'None']]))}
      ${row('Voltage colours', tog('voltColors'), 'Wires glow green (+) / red (−)')}
      ${row('Current animation', tog('currentDots'), 'Moving dots show current flow')}
      ${row('Animation speed', sel('dotSpeed', [[0.5, 'Slow'], [1, 'Normal'], [2, 'Fast'], [4, 'Very fast']]))}
      ${row('Capacitor charge', tog('showCharge'), '± signs on capacitor plates')}
      ${row('Animations', sel('animations', [['auto', 'Auto (by phone speed)'], ['on', 'Smooth (always)'], ['off', 'Off (simple, fastest)']]), `Now: ${motion.smooth ? 'smooth' : 'simple'} — ${esc(motion.reason)}`)}
      ${row('Value labels', tog('showValues'))}
      ${row('Component names', tog('showNames'))}
      ${row('Live node voltages', tog('liveVolts'), 'Voltage of every net written on its wire')}
      ${row('Live currents', tog('liveAmps'), 'Current and its direction beside each part')}
      ${row('AC readings', sel('acReadings', [['rms', 'RMS (like a meter)'], ['inst', 'Instantaneous']]), 'Live labels in circuits with an AC supply')}
      <h4>Landscape &amp; full screen</h4>
      ${row('Screen rotation', sel('orientation', [['auto', 'Auto (follow the phone)'], ['landscape', 'Always landscape'], ['portrait', 'Always portrait']]))}
      ${row('Scope beside the circuit', tog('scopeSide'), 'In landscape the oscilloscope sits to the right of the board; off = above it')}
      <h4>Real-life limits</h4>
      ${row('Parts burn out', tog('damage'), 'Over-voltage blows bulbs and LEDs, overloads burn cables and resistors, faults destroy breakers. Replace them like real parts.')}
      ${row('Heating & trip timing', sel('heatClock', [['real', 'Real time (like real life)'], ['fast', '10× faster'], ['sim', 'Simulation time']]), 'Breaker trips, cable heating and burning follow your clock, not the slowed-down waveforms')}
      ${row('New wires', sel('newWire', [['ideal', 'Ideal wire (no limit)'], ['hw1', '1 mm² Cu PVC (RE)'], ['hw1.5', '1.5 mm² Cu PVC (RE)'], ['hw2.5', '2.5 mm² Cu PVC (RE)'], ['hw4', '4 mm² Cu PVC (RE)'], ['hw6', '6 mm² Cu PVC (RE)'], ['hw10', '10 mm² Cu PVC (RM)'], ['flex0.75', '0.75 mm² flexible cord (RF)'], ['custom', 'Custom (set from a wire)']]), 'Cable for wires you draw; tap a wire → Cable to change one')}
      <h4>Simulation</h4>
      ${row('Integration method', sel('method', [['trap', 'Trapezoidal (accurate)'], ['be', 'Backward Euler (damped)']]))}
      ${row('Start from DC operating point', tog('initialDC'), 'Off = power-on from zero state')}
      ${row('Maximum timestep', num('maxStep', 's'))}
      ${row('RELTOL', num('reltol', ''), 'Relative tolerance (SPICE default 1e-3)')}
      ${row('VNTOL', num('vntol', 'V'), 'Absolute voltage tolerance')}
      ${row('ABSTOL', num('abstol', 'A'), 'Absolute current tolerance')}
      ${row('GMIN', num('gmin', 'S'), 'Minimum conductance to ground')}
      ${row('Newton iterations', num('maxIter', ''), 'Per timestep before halving Δt')}
      <h4>Interaction</h4>
      ${row('Haptic feedback', tog('haptics'))}
      ${row('Sound (buzzer)', tog('sound'))}
      <h4>Data</h4>
      <div class="btn-row pad">
        <button class="btn" data-x="backup">${icon('download', 18)} Backup circuits</button>
        <button class="btn" data-x="restore">${icon('upload', 18)} Restore backup</button>
        <button class="btn" data-x="reset">${icon('reset', 18)} Reset settings</button>
      </div>
      <p class="copyright">RaptiCKT ${APP.version} · ${RAPTI.full}</p>
    </div>`;
  const sc = root.querySelector('.set-scroll'), inner = document.createElement('div');
  inner.className = 'set-inner';
  inner.append(...sc.childNodes);
  sc.append(inner);
  iosScroll(sc, inner);
  root.querySelector('[data-x=back]').addEventListener('click', () => app.closeSettings());
  root.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('change', () => {
    const k = inp.dataset.k;
    let v;
    if (inp.type === 'checkbox') v = inp.checked;
    else if (inp.dataset.num) { v = parseSI(inp.value); if (!Number.isFinite(v) || v <= 0) { inp.value = fmtSI(s[k], '', 3).trim(); return; } }
    else v = typeof DEFAULT_SETTINGS[k] === 'number' ? parseFloat(inp.value) : inp.value;
    s[k] = v;
    app.saveSettings();
    if (k === 'theme') app.applyTheme();
    if (k === 'orientation') app.bridge.setOrientation(v);
    if (k === 'animations') { if (v === 'auto') motion.reset(); motion.decide(v); renderSettings(app, root); }
  }));
  root.querySelector('[data-x=backup]').addEventListener('click', () => app.backupAll());
  root.querySelector('[data-x=restore]').addEventListener('click', () => app.importFile());
  root.querySelector('[data-x=reset]').addEventListener('click', () => {
    if (!confirm('Reset all settings to defaults?')) return;
    Object.assign(s, DEFAULT_SETTINGS);
    app.saveSettings(); app.applyTheme();
    // the settings that act on the phone go back too: rotation unlocked, motion decided again
    app.bridge.setOrientation(s.orientation);
    motion.reset(); motion.decide(s.animations);
    renderSettings(app, root);
  });
}

