// The in-app user manual: contents, search, English / বাংলা, and the live component library.

import { icon } from './icons.js';
import { iosScroll } from './scroller.js';
import { CATEGORIES } from '../elements/index.js';
import { APP } from './brand.js';
import {
  CHAPTERS, LANGS, UI_TEXT, digits, expandRefs, libraryData, exampleData,
} from './manual-content.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plain = (s) => String(s).replace(/\*\*|`|\{\{ch:[a-z]+\}\}/g, '');

/** Inline markup: **bold**, `code`, and {{ch:id}} links to another chapter. */
function inline(s, lang) {
  const html = esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  return expandRefs(html, lang, (id, label) => `<a class="man-ref" data-go="${id}">${label}</a>`);
}

const catIcon = (id) => CATEGORIES.find((c) => c.id === id)?.icon || 'chip';

function blockHtml(b, lang) {
  const i = lang === 'bn' ? 1 : 0;
  switch (b.t) {
    case 'p': return `<p class="man-b" data-s="${esc(plain(b[lang]).toLowerCase())}">${inline(b[lang], lang)}</p>`;
    case 'h': return `<h3 class="man-b man-sub" data-s="${esc(plain(b[lang]).toLowerCase())}">${inline(b[lang], lang)}</h3>`;
    case 'steps': return `<ol class="man-b man-steps">${b[lang].map((x) => `<li data-s="${esc(plain(x).toLowerCase())}">${inline(x, lang)}</li>`).join('')}</ol>`;
    case 'ul': return `<ul class="man-b man-list">${b[lang].map((x) => `<li data-s="${esc(plain(x).toLowerCase())}">${inline(x, lang)}</li>`).join('')}</ul>`;
    case 'tip': return `<div class="man-b man-note tip" data-s="${esc(plain(b[lang]).toLowerCase())}">${icon('bolt', 18)}<div>${inline(b[lang], lang)}</div></div>`;
    case 'warn': return `<div class="man-b man-note warn" data-s="${esc(plain(b[lang]).toLowerCase())}">${icon('info', 18)}<div>${inline(b[lang], lang)}</div></div>`;
    case 'table': {
      const cols = b.head.length;
      return `<div class="man-b man-tablewrap"><table class="man-table c${cols}"><thead><tr>${b.head.map((h) => `<th>${inline(h[i], lang)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr data-s="${esc(r.map((c) => plain(c[i])).join(' ').toLowerCase())}">${r.map((c) => `<td>${inline(c[i], lang)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    default: return '';
  }
}

function libraryHtml(lang) {
  return `<p class="man-b man-small" data-s="">${esc(UI_TEXT.note[lang])}</p>` + libraryData().map((cat) => `
    <details class="man-cat">
      <summary>${icon(catIcon(cat.id), 18)}<b>${esc(cat.id)}</b><em>${cat.items.length}</em></summary>
      ${cat.note ? `<p class="man-b" data-s="${esc(plain(cat.note[lang]).toLowerCase())}">${inline(cat.note[lang], lang)}</p>` : ''}
      <div class="man-items">${cat.items.map((it) => `
        <div class="man-item" data-s="${esc((it.title + ' ' + it.desc + ' ' + cat.id + ' ' + it.props.join(' ')).toLowerCase())}">
          <b>${esc(it.title)}</b>
          <p>${esc(it.desc)}</p>
          ${it.props.length ? `<small><span>${esc(UI_TEXT.props[lang])}:</span> ${esc(it.props.join(' · '))}</small>` : ''}
        </div>`).join('')}</div>
    </details>`).join('');
}

function examplesHtml(lang) {
  return exampleData().map((cat) => `
    <details class="man-cat" open>
      <summary>${icon('book', 18)}<b>${esc(cat.id)}</b><em>${cat.items.length}</em></summary>
      <div class="man-items">${cat.items.map((it) => `
        <div class="man-item" data-s="${esc((it.title + ' ' + it.desc + ' ' + cat.id).toLowerCase())}">
          <b>${esc(it.title)}</b>
          <p>${esc(it.desc)}</p>
          <button class="btn sm" data-ex="${esc(it.id)}">${icon('play', 14)} ${esc(UI_TEXT.tryIt[lang])}</button>
        </div>`).join('')}</div>
    </details>`).join('');
}

export class ManualScreen {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.query = '';
  }

  get lang() {
    const l = this.app.settings.manualLang;
    if (l === 'en' || l === 'bn') return l;
    return /^bn\b/i.test(navigator.language || '') ? 'bn' : 'en';
  }

  /** Build the screen. `goto` is a chapter id to scroll to once it is on screen. */
  render(goto) {
    const lang = this.lang;
    const other = LANGS.find(([k]) => k !== lang);
    this.root.setAttribute('lang', lang);
    this.root.innerHTML = `
      <header class="topbar plain">
        <button class="icon-btn" data-x="back" title="Back">${icon('back', 22)}</button>
        <div class="title"><b>${esc(UI_TEXT.title[lang])}</b><small>${esc(APP.name)} ${esc(APP.version)}</small></div>
        <button class="icon-btn" data-x="top" title="${esc(UI_TEXT.contents[lang])}">${icon('grid', 21)}</button>
        <button class="btn sm man-lang" data-x="lang" title="${esc(other[1])}">${esc(other[1])}</button>
      </header>
      <div class="man-search">${icon('search', 18)}<input type="search" placeholder="${esc(UI_TEXT.search[lang])}" value="${esc(this.query)}" enterkeyhint="search"></div>
      <div class="man-scroll"><div class="man-inner">
        <section class="man-hero">
          <h2>${esc(UI_TEXT.title[lang])}</h2>
          <p>${esc(UI_TEXT.tagline[lang])}</p>
        </section>
        <nav class="man-toc" aria-label="${esc(UI_TEXT.contents[lang])}">
          ${CHAPTERS.map((c, n) => `<button data-go="${c.id}"><span class="n">${digits(n + 1, lang)}</span>${icon(c.icon, 17)}<span class="t">${esc(c.title[lang])}</span></button>`).join('')}
        </nav>
        ${CHAPTERS.map((c, n) => `
        <section class="man-ch" id="man-${c.id}" data-ch="${c.id}">
          <h2 class="man-h" data-s="${esc(c.title[lang].toLowerCase())}"><span class="n">${digits(n + 1, lang)}</span>${icon(c.icon, 22)}<span>${esc(c.title[lang])}</span></h2>
          ${c.blocks.map((b) => blockHtml(b, lang)).join('')}
          ${c.generated === 'library' ? libraryHtml(lang) : ''}
          ${c.generated === 'examples' ? examplesHtml(lang) : ''}
        </section>`).join('')}
        <p class="man-empty" hidden>${esc(UI_TEXT.noResult[lang])}</p>
        <p class="copyright">© ${new Date().getFullYear()} RAPTI · rapti.net</p>
      </div></div>`;

    const scroller = this.root.querySelector('.man-scroll');
    const inner = this.root.querySelector('.man-inner');
    this.scroller = scroller;
    this.scrollApi = iosScroll(scroller, inner);

    this.root.querySelector('[data-x=back]').addEventListener('click', () => this.app.closeManual());
    this.root.querySelector('[data-x=top]').addEventListener('click', () => { this.setQuery(''); this.jumpTop(); });
    this.root.querySelector('[data-x=lang]').addEventListener('click', () => {
      this.app.settings.manualLang = other[0];
      this.app.saveSettings();
      this.render();
    });
    const input = this.root.querySelector('.man-search input');
    let t = 0;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => this.setQuery(input.value), 140); });
    this.root.addEventListener('click', (ev) => {
      const g = ev.target.closest('[data-go]');
      if (g && this.root.contains(g)) { this.setQuery(''); this.goTo(g.dataset.go); return; }
      const ex = ev.target.closest('[data-ex]');
      if (ex && this.root.contains(ex)) this.app.openExampleFromManual(ex.dataset.ex);
    });
    // a <details> opening or closing changes the page height
    this.root.querySelectorAll('details').forEach((d) => d.addEventListener('toggle', () => this.scrollApi?.refresh?.()));

    if (this.query) this.applyQuery();
    if (goto) requestAnimationFrame(() => requestAnimationFrame(() => this.goTo(goto, false)));
  }

  jumpTop() { this.scrollApi?.scrollTo(0, true); }

  goTo(id, animate = true) {
    const sec = this.root.querySelector(`#man-${id}`);
    if (!sec || !this.scrollApi) return;
    // layout position, not the on-screen one (the page is moved by a transform while scrolling)
    let y = -8;
    for (let n = sec; n && n !== this.scroller; n = n.offsetParent) y += n.offsetTop;
    this.scrollApi.scrollTo(Math.max(0, y), animate);
  }

  setQuery(q) {
    q = q.trim().toLowerCase();
    if (q === this.query) return;
    this.query = q;
    const input = this.root.querySelector('.man-search input');
    if (input && input.value.trim().toLowerCase() !== q) input.value = q;
    this.applyQuery();
  }

  /** Show only what matches; with no query everything is shown again. */
  applyQuery() {
    const q = this.query, root = this.root;
    root.classList.toggle('searching', !!q);
    const matches = (el) => !q || (el.dataset.s || '').includes(q);
    for (const el of root.querySelectorAll('[data-s]:not(.man-h)')) el.hidden = !matches(el);
    // block containers: a list or table stays if any row matches
    for (const el of root.querySelectorAll('ol.man-b, ul.man-b, .man-tablewrap')) {
      el.hidden = !!q && !el.querySelector('[data-s]:not([hidden])');
    }
    // the plain note under the library title has no text to match
    for (const el of root.querySelectorAll('.man-small')) el.hidden = !!q;
    let any = false;
    for (const sec of root.querySelectorAll('.man-ch')) {
      const hit = !q || sec.querySelector('.man-b:not([hidden]), .man-item:not([hidden])');
      // a chapter whose title matches shows its whole text
      const titleHit = q && matches(sec.querySelector('.man-h'));
      if (titleHit) sec.querySelectorAll('[hidden]').forEach((el) => { if (!el.classList.contains('man-small')) el.hidden = false; });
      sec.hidden = !hit && !titleHit;
      if (!sec.hidden) any = true;
    }
    for (const d of root.querySelectorAll('details')) {
      const has = !q || d.querySelector('.man-item:not([hidden]), .man-b:not([hidden])');
      d.hidden = !has;
      if (q && has) d.open = true;
    }
    root.querySelector('.man-toc').hidden = !!q;
    root.querySelector('.man-hero').hidden = !!q;
    root.querySelector('.man-empty').hidden = !q || any;
    this.scrollApi?.scrollTo(0, false);
    this.scrollApi?.refresh?.();
  }
}
