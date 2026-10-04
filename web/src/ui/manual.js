// The in-app user manual. It opens on a contents page; every chapter opens as its own page,
// long chapters are split into sections that open one level deeper, and the component
// library and examples open category by category. English / বাংলা, with search.

import { icon } from './icons.js';
import { iosScroll } from './scroller.js';
import { CATEGORIES } from '../elements/index.js';
import { APP } from './brand.js';
import {
  CHAPTERS, LANGS, UI_TEXT, SUMMARY, digits, expandRefs, libraryData, exampleData, chapterParts,
} from './manual-content.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plain = (s) => String(s).replace(/\*\*|`|\{\{ch:[a-z]+\}\}/g, '');
const chev = () => icon('back', 18, 'flipx man-chev');

/** Inline markup: **bold**, `code`, and {{ch:id}} links to another chapter. */
function inline(s, lang) {
  const html = esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  return expandRefs(html, lang, (id, label) => `<a class="man-ref" data-nav="ch:${id}">${label}</a>`);
}

const catIcon = (id) => CATEGORIES.find((c) => c.id === id)?.icon || 'chip';

function blockHtml(b, lang) {
  const i = lang === 'bn' ? 1 : 0;
  switch (b.t) {
    case 'p': return `<p class="man-b">${inline(b[lang], lang)}</p>`;
    case 'steps': return `<ol class="man-b man-steps">${b[lang].map((x) => `<li>${inline(x, lang)}</li>`).join('')}</ol>`;
    case 'ul': return `<ul class="man-b man-list">${b[lang].map((x) => `<li>${inline(x, lang)}</li>`).join('')}</ul>`;
    case 'tip': return `<div class="man-b man-note tip">${icon('bolt', 18)}<div>${inline(b[lang], lang)}</div></div>`;
    case 'warn': return `<div class="man-b man-note warn">${icon('info', 18)}<div>${inline(b[lang], lang)}</div></div>`;
    case 'table': {
      const cols = b.head.length;
      return `<div class="man-b man-tablewrap"><table class="man-table c${cols}"><thead><tr>${b.head.map((h) => `<th>${inline(h[i], lang)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c[i], lang)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    default: return '';
  }
}

// text of a block, for searching
function blockText(b, lang) {
  const i = lang === 'bn' ? 1 : 0;
  if (b.t === 'table') return b.rows.map((r) => r.map((c) => plain(c[i])).join(' ')).join(' ');
  if (Array.isArray(b[lang])) return b[lang].map(plain).join(' ');
  return plain(b[lang] || '');
}

const card = (nav, lead, title, sub, extra = '') => `
  <button class="man-card" data-nav="${esc(nav)}">${lead}<div><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>${extra}${chev()}</button>`;

/** Pages of a chapter: [{ id, title, count?, icon?, html(lang) }], after the intro text. */
function sectionsOf(ch) {
  if (ch.generated === 'library') {
    const bn = libraryData('bn');
    return libraryData().map((cat, k) => ({
      id: cat.id, title: { en: cat.title, bn: bn[k].title }, count: cat.items.length, icon: catIcon(cat.id), generated: true,
      html: (lang) => `${cat.note ? `<p class="man-b">${inline(cat.note[lang], lang)}</p>` : ''}
        <div class="man-items">${(lang === 'bn' ? bn[k] : cat).items.map((it) => `
          <div class="man-item"><b>${esc(it.title)}</b><p>${inline(it.desc, lang)}</p>
          ${it.props.length ? `<small><span>${esc(UI_TEXT.props[lang])}:</span> ${esc(it.props.join(' · '))}</small>` : ''}</div>`).join('')}</div>
        <p class="man-small">${esc(UI_TEXT.note[lang])}</p>`,
    }));
  }
  if (ch.generated === 'examples') {
    const bn = exampleData('bn');
    return exampleData().map((cat, k) => ({
      id: cat.id, title: { en: cat.title, bn: bn[k].title }, count: cat.items.length, icon: 'book', generated: true,
      html: (lang) => `<div class="man-items">${(lang === 'bn' ? bn[k] : cat).items.map((it) => `
        <div class="man-item"><b>${esc(it.title)}</b><p>${inline(it.desc, lang)}</p>
        <button class="btn sm" data-ex="${esc(it.id)}">${icon('play', 14)} ${esc(UI_TEXT.tryIt[lang])}</button></div>`).join('')}</div>`,
    }));
  }
  const { sections } = chapterParts(ch);
  return sections.map((s, i) => ({ id: String(i), title: s.title, html: (lang) => s.blocks.map((b) => blockHtml(b, lang)).join('') }));
}

/** Everything searchable, built once per language. */
function buildIndex(lang) {
  const out = [];
  CHAPTERS.forEach((ch, n) => {
    const { intro } = chapterParts(ch);
    out.push({ nav: `ch:${ch.id}`, label: ch.title[lang], sub: `${lang === 'bn' ? 'অধ্যায়' : 'Chapter'} ${digits(n + 1, lang)}`, text: `${ch.title[lang]} ${SUMMARY[ch.id][lang]} ${intro.map((b) => blockText(b, lang)).join(' ')}` });
    if (ch.generated === 'library') {
      libraryData(lang).forEach((cat) => cat.items.forEach((it) => out.push({ nav: `sec:${ch.id}/${cat.id}`, label: it.title, sub: cat.title, text: `${it.title} ${it.desc} ${it.descEn} ${cat.title} ${it.props.join(' ')}`, snip: plain(it.desc) })));
    } else if (ch.generated === 'examples') {
      exampleData(lang).forEach((cat) => cat.items.forEach((it) => out.push({ nav: `sec:${ch.id}/${cat.id}`, label: it.title, sub: cat.title, text: `${it.title} ${it.desc} ${it.descEn} ${cat.title}`, snip: plain(it.desc) })));
    } else {
      const parts = chapterParts(ch);
      parts.sections.forEach((s, i) => out.push({ nav: `sec:${ch.id}/${i}`, label: s.title[lang], sub: ch.title[lang], text: `${s.title[lang]} ${s.blocks.map((b) => blockText(b, lang)).join(' ')}` }));
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
    this.indexCache = {};
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

  get lang() {
    const l = this.app.settings.manualLang;
    if (l === 'en' || l === 'bn') return l;
    return /^bn\b/i.test(navigator.language || '') ? 'bn' : 'en';
  }

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
    const lang = this.lang;
    const [kind, rest = ''] = nav.split(':');
    if (kind === 'ch') {
      const n = CHAPTERS.findIndex((c) => c.id === rest);
      return n >= 0 ? this.chapterPage(n, lang) : this.indexPage(lang);
    }
    if (kind === 'sec') {
      const [cid, sid] = rest.split('/');
      const n = CHAPTERS.findIndex((c) => c.id === cid);
      if (n >= 0) {
        const secs = sectionsOf(CHAPTERS[n]), i = secs.findIndex((s) => s.id === sid);
        if (i >= 0) return this.sectionPage(n, secs, i, lang);
      }
    }
    return this.indexPage(lang);
  }

  indexPage(lang) {
    return {
      index: true,
      title: UI_TEXT.title[lang], sub: `${APP.name} ${APP.version}`,
      html: this.query ? this.resultsHtml(lang) : `
        <section class="man-hero"><h2>${esc(UI_TEXT.title[lang])}</h2><p>${esc(UI_TEXT.tagline[lang])}</p></section>
        <div class="man-menu">${CHAPTERS.map((c, n) => card(`ch:${c.id}`, `<span class="n">${digits(n + 1, lang)}</span>${icon(c.icon, 20)}`, c.title[lang], SUMMARY[c.id][lang])).join('')}</div>
        <p class="copyright">© ${new Date().getFullYear()} RAPTI · rapti.net</p>`,
    };
  }

  chapterPage(n, lang) {
    const ch = CHAPTERS[n], { intro } = chapterParts(ch), secs = sectionsOf(ch);
    const prev = CHAPTERS[n - 1], next = CHAPTERS[n + 1];
    return {
      title: ch.title[lang], sub: `${UI_TEXT.title[lang]} · ${digits(n + 1, lang)} / ${digits(CHAPTERS.length, lang)}`,
      html: `
        <h2 class="man-h"><span class="n">${digits(n + 1, lang)}</span>${icon(ch.icon, 22)}<span>${esc(ch.title[lang])}</span></h2>
        ${intro.map((b) => blockHtml(b, lang)).join('')}
        ${secs.length ? `<div class="man-menu">${secs.map((s) => card(`sec:${ch.id}/${s.id}`, icon(s.icon || 'layers', 20), s.title[lang], s.count ? `${digits(s.count, lang)} ${ch.generated === 'library' ? UI_TEXT.parts[lang] : UI_TEXT.examplesCount[lang]}` : '')).join('')}</div>` : ''}
        <div class="man-pager">
          ${prev ? `<button data-swap="ch:${prev.id}">${icon('back', 18)}<span><small>${esc(UI_TEXT.prev[lang])}</small>${esc(prev.title[lang])}</span></button>` : '<i></i>'}
          ${next ? `<button data-swap="ch:${next.id}" class="r"><span><small>${esc(UI_TEXT.next[lang])}</small>${esc(next.title[lang])}</span>${icon('back', 18, 'flipx')}</button>` : '<i></i>'}
        </div>`,
    };
  }

  sectionPage(n, secs, i, lang) {
    const ch = CHAPTERS[n], s = secs[i], prev = secs[i - 1], next = secs[i + 1];
    return {
      title: s.title[lang], sub: ch.title[lang],
      html: `
        <h2 class="man-h">${s.icon ? icon(s.icon, 22) : `<span class="n">${digits(i + 1, lang)}</span>`}<span>${esc(s.title[lang])}${s.count ? ` <em>${digits(s.count, lang)}</em>` : ''}</span></h2>
        ${s.html(lang)}
        <div class="man-pager">
          ${prev ? `<button data-swap="sec:${ch.id}/${prev.id}">${icon('back', 18)}<span><small>${esc(UI_TEXT.prev[lang])}</small>${esc(prev.title[lang])}</span></button>` : '<i></i>'}
          ${next ? `<button data-swap="sec:${ch.id}/${next.id}" class="r"><span><small>${esc(UI_TEXT.next[lang])}</small>${esc(next.title[lang])}</span>${icon('back', 18, 'flipx')}</button>` : '<i></i>'}
        </div>`,
    };
  }

  resultsHtml(lang) {
    const q = this.query;
    const idx = this.indexCache[lang] || (this.indexCache[lang] = buildIndex(lang));
    const hits = idx.filter((e) => e.low.includes(q));
    if (!hits.length) return `<p class="man-empty">${esc(UI_TEXT.noResult[lang])}</p>`;
    // chapter and section pages first, then individual components and examples
    hits.sort((a, b) => (a.snip ? 1 : 0) - (b.snip ? 1 : 0));
    return `<div class="man-menu">${hits.slice(0, 80).map((e) => `
      <button class="man-card res" data-nav="${esc(e.nav)}"><div><b>${esc(e.label)}</b><small>${esc(e.sub)}</small><span>${esc(snippet(e, q))}</span></div>${chev()}</button>`).join('')}</div>
      ${hits.length > 80 ? `<p class="man-small">+ ${hits.length - 80}…</p>` : ''}`;
  }

  // ----------------------------------------------------------------- paint
  bar(page, lang, other) {
    return `
        <div class="man-bar">
          ${this.stack.length > 1 ? `<button class="icon-btn" data-x="back" title="Back">${icon('back', 22)}</button>` : ''}
          <div class="t"><b>${esc(page.title)}</b><small>${esc(page.sub)}</small></div>
          ${page.index ? '' : `<button class="icon-btn" data-x="home" title="${esc(UI_TEXT.contents[lang])}">${icon('grid', 21)}</button>`}
          <button class="btn sm man-lang" data-x="lang">${esc(other[1])}</button>
        </div>`;
  }

  paint(restoreY = 0) {
    const lang = this.lang, other = LANGS.find(([k]) => k !== lang), page = this.resolve(this.here.nav);
    const search = page.index ? `<div class="man-search">${icon('search', 18)}<input type="search" placeholder="${esc(UI_TEXT.search[lang])}" value="${esc(this.query)}" enterkeyhint="search"></div>` : '';
    const inner = `<div class="man-inner man-view ${this.stack.length > 1 ? 'deep' : ''}">${page.html}</div>`;
    if (this.mode === 'tab') {
      // inside Home: the RaptiCKT header and the bottom bar stay; only the page below them changes
      const body = this.body;
      body.setAttribute('lang', lang);
      body.innerHTML = this.bar(page, lang, other) + search + inner;
      this.bind(body, other);
      const api = this.sc();
      if (api) { api.refresh?.(); api.scrollTo(restoreY, false); }
      return;
    }
    this.root.setAttribute('lang', lang);
    this.root.innerHTML = `
      <header class="topbar plain">
        <button class="icon-btn" data-x="back" title="Back">${icon('back', 22)}</button>
        <div class="title"><b>${esc(page.title)}</b><small>${esc(page.sub)}</small></div>
        ${page.index ? '' : `<button class="icon-btn" data-x="home" title="${esc(UI_TEXT.contents[lang])}">${icon('grid', 21)}</button>`}
        <button class="btn sm man-lang" data-x="lang">${esc(other[1])}</button>
      </header>
      ${search}
      <div class="man-scroll">${inner}</div>`;
    this.scrollApi = iosScroll(this.root.querySelector('.man-scroll'), this.root.querySelector('.man-inner'));
    this.bind(this.root, other);
    this.scrollApi?.scrollTo?.(restoreY, false);
  }

  bind(host, other) {
    host.querySelector('[data-x=back]')?.addEventListener('click', () => { if (!this.back()) this.app.closeManual(); });
    host.querySelector('[data-x=home]')?.addEventListener('click', () => { this.stack = [{ nav: 'index', y: 0 }]; this.paint(); });
    host.querySelector('[data-x=lang]').addEventListener('click', () => {
      this.here.y = this.sc()?.y || 0;
      this.app.settings.manualLang = other[0];
      this.app.saveSettings();
      this.paint(this.here.y);
    });
    const input = host.querySelector('.man-search input');
    if (input) {
      let t = 0;
      input.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          this.query = input.value.trim().toLowerCase();
          // only the list below changes, so the keyboard stays up
          host.querySelector('.man-inner').innerHTML = this.indexPage(this.lang).html;
          this.sc()?.refresh?.();
          this.sc()?.scrollTo(0, false);
        }, 140);
      });
    }
  }
}
