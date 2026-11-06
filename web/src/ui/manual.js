// The in-app user manual. It opens on a contents page; every chapter opens as its own page,
// long chapters are split into sections that open one level deeper, and the component
// library and examples open category by category, with search.

import { icon } from './icons.js';
import { iosScroll } from './scroller.js';
import { CATEGORIES } from '../elements/index.js';
import { APP } from './brand.js';
import {
  CHAPTERS, UI_TEXT, SUMMARY, expandRefs, libraryData, exampleData, chapterParts,
} from './manual-content.js';
import { esc } from './html.js';

const plain = (s) => String(s).replace(/\*\*|`|\{\{ch:[a-z]+\}\}/g, '');
const chev = () => icon('back', 18, 'flipx man-chev');

/** Inline markup: **bold**, `code`, and {{ch:id}} links to another chapter. */
function inline(s) {
  const html = esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  return expandRefs(html, (id, label) => `<a class="man-ref" data-nav="ch:${id}">${label}</a>`);
}

const catIcon = (id) => CATEGORIES.find((c) => c.id === id)?.icon || 'chip';

function blockHtml(b) {
  switch (b.t) {
    case 'p': return `<p class="man-b">${inline(b.text)}</p>`;
    case 'steps': return `<ol class="man-b man-steps">${b.text.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`;
    case 'ul': return `<ul class="man-b man-list">${b.text.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`;
    case 'tip': return `<div class="man-b man-note tip">${icon('bolt', 18)}<div>${inline(b.text)}</div></div>`;
    case 'warn': return `<div class="man-b man-note warn">${icon('info', 18)}<div>${inline(b.text)}</div></div>`;
    case 'table': {
      const cols = b.head.length;
      return `<div class="man-b man-tablewrap"><table class="man-table c${cols}"><thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    default: return '';
  }
}

// text of a block, for searching
function blockText(b) {
  if (b.t === 'table') return b.rows.map((r) => r.map(plain).join(' ')).join(' ');
  if (Array.isArray(b.text)) return b.text.map(plain).join(' ');
  return plain(b.text || '');
}

const card = (nav, lead, title, sub, extra = '') => `
  <button class="man-card" data-nav="${esc(nav)}">${lead}<div><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>${extra}${chev()}</button>`;

/** Pages of a chapter: [{ id, title, count?, icon?, html() }], after the intro text. */
function sectionsOf(ch) {
  if (ch.generated === 'library') {
    return libraryData().map((cat) => ({
      id: cat.id, title: cat.title, count: cat.items.length, icon: catIcon(cat.id), generated: true,
      html: () => `${cat.note ? `<p class="man-b">${inline(cat.note)}</p>` : ''}
        <div class="man-items">${cat.items.map((it) => `
          <div class="man-item"><b>${esc(it.title)}</b><p>${inline(it.desc)}</p>
          ${it.props.length ? `<small><span>${esc(UI_TEXT.props)}:</span> ${esc(it.props.join(' · '))}</small>` : ''}</div>`).join('')}</div>`,
    }));
  }
  if (ch.generated === 'examples') {
    return exampleData().map((cat) => ({
      id: cat.id, title: cat.title, count: cat.items.length, icon: 'book', generated: true,
      html: () => `<div class="man-items">${cat.items.map((it) => `
        <div class="man-item"><b>${esc(it.title)}</b><p>${inline(it.desc)}</p>
        <button class="btn sm" data-ex="${esc(it.id)}">${icon('play', 14)} ${esc(UI_TEXT.tryIt)}</button></div>`).join('')}</div>`,
    }));
  }
  const { sections } = chapterParts(ch);
  return sections.map((s, i) => ({ id: String(i), title: s.title, html: () => s.blocks.map(blockHtml).join('') }));
}

/** Everything searchable, built once. */
function buildIndex() {
  const out = [];
  CHAPTERS.forEach((ch, n) => {
    const { intro } = chapterParts(ch);
    out.push({ nav: `ch:${ch.id}`, label: ch.title, sub: `Chapter ${n + 1}`, text: `${ch.title} ${SUMMARY[ch.id]} ${intro.map(blockText).join(' ')}` });
    if (ch.generated === 'library') {
      libraryData().forEach((cat) => cat.items.forEach((it) => out.push({ nav: `sec:${ch.id}/${cat.id}`, label: it.title, sub: cat.title, text: `${it.title} ${it.desc} ${cat.title} ${it.props.join(' ')}`, snip: plain(it.desc) })));
    } else if (ch.generated === 'examples') {
      exampleData().forEach((cat) => cat.items.forEach((it) => out.push({ nav: `sec:${ch.id}/${cat.id}`, label: it.title, sub: cat.title, text: `${it.title} ${it.desc} ${cat.title}`, snip: plain(it.desc) })));
    } else {
      const parts = chapterParts(ch);
      parts.sections.forEach((s, i) => out.push({ nav: `sec:${ch.id}/${i}`, label: s.title, sub: ch.title, text: `${s.title} ${s.blocks.map(blockText).join(' ')}` }));
    }
  });
  return out.map((e) => ({ ...e, low: e.text.toLowerCase() }));
}

function snippet(e, q) {
  const text = e.snip || e.text;
  const at = text.toLowerCase().indexOf(q);
  if (at < 0) return text.slice(0, 90);
  const from = Math.max(0, at - 30);
  return (from ? '… ' : '') + text.slice(from, from + 100) + (from + 100 < text.length ? ' …' : '');
}

export class ManualScreen {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.query = '';
    // the Manual tab and the editor's manual screen each remember their own page
    this.stacks = { tab: [{ nav: 'index', y: 0 }], screen: [{ nav: 'index', y: 0 }] };
    this.mode = 'screen'; // 'tab': inside the Home page (its header and bottom bar stay); 'screen': over the editor
    this.delegate(root);
  }

  /** One click handler for every link and button on every page shown in `el`. */
  delegate(el) {
    el.addEventListener('click', (ev) => {
      if ((el === this.root) !== (this.mode === 'screen')) return;
      const n = ev.target.closest('[data-nav]');
      if (n) { this.go(n.dataset.nav); return; }
      const s = ev.target.closest('[data-swap]');
      if (s) { this.swap(s.dataset.swap); return; }
      const ex = ev.target.closest('[data-ex]');
      if (ex) this.app.openExampleFromManual(ex.dataset.ex);
    });
  }

  /** The scroller that moves the manual's pages. */
  sc() { return this.mode === 'tab' ? this.home?.scrollApi : this.scrollApi; }

  /** Show the manual as the Home page's Manual tab (called from HomeScreen.render). */
  mountTab(body, home) {
    this.mode = 'tab';
    this.home = home;
    this.body = body;
    body.classList.add('manual', 'man-tab');
    this.delegate(body);
    this.paint(this.here.y || 0);
  }

  /** Back to the contents page (tapping the Manual tab again). */
  reset() { this.stack = [{ nav: 'index', y: 0 }]; this.query = ''; }

  get stack() { return this.stacks[this.mode]; }
  set stack(v) { this.stacks[this.mode] = v; }

  get here() { return this.stack[this.stack.length - 1]; }

  /** Open the manual on its contents page, or straight at a chapter. */
  open(chapterId) {
    this.mode = 'screen';
    this.stack = [{ nav: 'index', y: 0 }];
    if (chapterId && CHAPTERS.some((c) => c.id === chapterId)) this.stack.push({ nav: `ch:${chapterId}`, y: 0 });
    this.paint();
  }

  /** Android Back / the arrow: one level up. Returns false when already on the contents page. */
  back() {
    if (this.stack.length <= 1) return false;
    this.stack.pop();
    this.paint(this.here.y);
    return true;
  }

  go(nav) {
    this.here.y = this.sc()?.y || 0;
    // a link to a page that is already below us returns to it instead of piling up
    const at = this.stack.findIndex((s) => s.nav === nav);
    if (at >= 0) this.stack.length = at + 1; else this.stack.push({ nav, y: 0 });
    this.paint(at >= 0 ? this.here.y : 0);
  }

  /** Replace the current page by a neighbour (previous / next) without growing the stack. */
  swap(nav) { this.stack[this.stack.length - 1] = { nav, y: 0 }; this.paint(0); }

  // ------------------------------------------------------------------ pages
  resolve(nav) {
    const [kind, rest = ''] = nav.split(':');
    if (kind === 'ch') {
      const n = CHAPTERS.findIndex((c) => c.id === rest);
      return n >= 0 ? this.chapterPage(n) : this.indexPage();
    }
    if (kind === 'sec') {
      const [cid, sid] = rest.split('/');
      const n = CHAPTERS.findIndex((c) => c.id === cid);
      if (n >= 0) {
        const secs = sectionsOf(CHAPTERS[n]), i = secs.findIndex((s) => s.id === sid);
        if (i >= 0) return this.sectionPage(n, secs, i);
      }
    }
    return this.indexPage();
  }

  indexPage() {
    return {
      index: true,
      title: UI_TEXT.title, sub: `${APP.name} ${APP.version}`,
      html: this.query ? this.resultsHtml() : `
        <section class="man-hero"><h2>${esc(UI_TEXT.title)}</h2><p>${esc(UI_TEXT.tagline)}</p></section>
        <div class="man-menu">${CHAPTERS.map((c, n) => card(`ch:${c.id}`, `<span class="n">${n + 1}</span>${icon(c.icon, 20)}`, c.title, SUMMARY[c.id])).join('')}</div>
        <p class="copyright">© ${new Date().getFullYear()} RAPTI · rapti.net</p>`,
    };
  }

  chapterPage(n) {
    const ch = CHAPTERS[n], { intro } = chapterParts(ch), secs = sectionsOf(ch);
    const prev = CHAPTERS[n - 1], next = CHAPTERS[n + 1];
    return {
      title: ch.title, sub: `${UI_TEXT.title} · ${n + 1} / ${CHAPTERS.length}`,
      html: `
        <h2 class="man-h"><span class="n">${n + 1}</span>${icon(ch.icon, 22)}<span>${esc(ch.title)}</span></h2>
        ${intro.map((b) => blockHtml(b)).join('')}
        ${secs.length ? `<div class="man-menu">${secs.map((s) => card(`sec:${ch.id}/${s.id}`, icon(s.icon || 'layers', 20), s.title, s.count ? `${s.count} ${ch.generated === 'library' ? UI_TEXT.parts : UI_TEXT.examplesCount}` : '')).join('')}</div>` : ''}
        <div class="man-pager">
          ${prev ? `<button data-swap="ch:${prev.id}">${icon('back', 18)}<span><small>${esc(UI_TEXT.prev)}</small>${esc(prev.title)}</span></button>` : '<i></i>'}
          ${next ? `<button data-swap="ch:${next.id}" class="r"><span><small>${esc(UI_TEXT.next)}</small>${esc(next.title)}</span>${icon('back', 18, 'flipx')}</button>` : '<i></i>'}
        </div>`,
    };
  }

  sectionPage(n, secs, i) {
    const ch = CHAPTERS[n], s = secs[i], prev = secs[i - 1], next = secs[i + 1];
    return {
      title: s.title, sub: ch.title,
      html: `
        <h2 class="man-h">${s.icon ? icon(s.icon, 22) : `<span class="n">${i + 1}</span>`}<span>${esc(s.title)}${s.count ? ` <em>${s.count}</em>` : ''}</span></h2>
        ${s.html()}
        <div class="man-pager">
          ${prev ? `<button data-swap="sec:${ch.id}/${prev.id}">${icon('back', 18)}<span><small>${esc(UI_TEXT.prev)}</small>${esc(prev.title)}</span></button>` : '<i></i>'}
          ${next ? `<button data-swap="sec:${ch.id}/${next.id}" class="r"><span><small>${esc(UI_TEXT.next)}</small>${esc(next.title)}</span>${icon('back', 18, 'flipx')}</button>` : '<i></i>'}
        </div>`,
    };
  }

  resultsHtml() {
    const q = this.query;
    const idx = this.index || (this.index = buildIndex());
    const hits = idx.filter((e) => e.low.includes(q));
    if (!hits.length) return `<p class="man-empty">${esc(UI_TEXT.noResult)}</p>`;
    // chapter and section pages first, then individual components and examples
    hits.sort((a, b) => (a.snip ? 1 : 0) - (b.snip ? 1 : 0));
    return `<div class="man-menu">${hits.slice(0, 80).map((e) => `
      <button class="man-card res" data-nav="${esc(e.nav)}"><div><b>${esc(e.label)}</b><small>${esc(e.sub)}</small><span>${esc(snippet(e, q))}</span></div>${chev()}</button>`).join('')}</div>
      ${hits.length > 80 ? `<p class="man-small">+ ${hits.length - 80}…</p>` : ''}`;
  }

  // ----------------------------------------------------------------- paint
  bar(page) {
    return `
        <div class="man-bar">
          ${this.stack.length > 1 ? `<button class="icon-btn" data-x="back" title="Back">${icon('back', 22)}</button>` : ''}
          <div class="t"><b>${esc(page.title)}</b><small>${esc(page.sub)}</small></div>
          ${page.index ? '' : `<button class="icon-btn" data-x="home" title="${esc(UI_TEXT.contents)}">${icon('grid', 21)}</button>`}
        </div>`;
  }

  paint(restoreY = 0) {
    const page = this.resolve(this.here.nav);
    const search = page.index ? `<div class="man-search">${icon('search', 18)}<input type="search" placeholder="${esc(UI_TEXT.search)}" value="${esc(this.query)}" enterkeyhint="search"></div>` : '';
    const inner = `<div class="man-inner man-view ${this.stack.length > 1 ? 'deep' : ''}">${page.html}</div>`;
    if (this.mode === 'tab') {
      // inside Home: the RaptiCKT header and the bottom bar stay; only the page below them changes
      const body = this.body;
      body.innerHTML = this.bar(page) + search + inner;
      this.bind(body);
      const api = this.sc();
      if (api) { api.refresh?.(); api.scrollTo(restoreY, false); }
      return;
    }
    this.root.innerHTML = `
      <header class="topbar plain">
        <button class="icon-btn" data-x="back" title="Back">${icon('back', 22)}</button>
        <div class="title"><b>${esc(page.title)}</b><small>${esc(page.sub)}</small></div>
        ${page.index ? '' : `<button class="icon-btn" data-x="home" title="${esc(UI_TEXT.contents)}">${icon('grid', 21)}</button>`}
      </header>
      ${search}
      <div class="man-scroll">${inner}</div>`;
    this.scrollApi = iosScroll(this.root.querySelector('.man-scroll'), this.root.querySelector('.man-inner'));
    this.bind(this.root);
    this.scrollApi?.scrollTo?.(restoreY, false);
  }

  bind(host) {
    host.querySelector('[data-x=back]')?.addEventListener('click', () => { if (!this.back()) this.app.closeManual(); });
    host.querySelector('[data-x=home]')?.addEventListener('click', () => { this.stack = [{ nav: 'index', y: 0 }]; this.paint(); });
    const input = host.querySelector('.man-search input');
    if (input) {
      let t = 0;
      input.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          this.query = input.value.trim().toLowerCase();
          // only the list below changes, so the keyboard stays up
          host.querySelector('.man-inner').innerHTML = this.indexPage().html;
          this.sc()?.refresh?.();
          this.sc()?.scrollTo(0, false);
        }, 140);
      });
    }
  }
}
