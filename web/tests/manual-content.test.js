// The user manual stays complete and consistent: both languages everywhere, every component and
// example listed, every setting and menu item explained, every cross-reference valid.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { allTypes } from '../src/elements/index.js';
import { EXAMPLES } from '../src/ui/examples.js';
import { CHAPTERS, SUMMARY, chapterParts, libraryData, libraryCount, exampleData, manualMarkdown, CATEGORY_NOTES, UI_TEXT } from '../src/ui/manual-content.js';
import { CATEGORIES } from '../src/elements/index.js';

const strings = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
};
const allText = (lang) => strings(CHAPTERS.map((c) => [c.title[lang], c.blocks.map((b) => (b.t === 'table' ? [b.head.map((h) => h[lang === 'bn' ? 1 : 0]), b.rows.map((r) => r.map((c) => c[lang === 'bn' ? 1 : 0]))] : b[lang]))])).join('\n');

test('chapters have unique ids and a title in both languages', () => {
  const ids = new Set();
  for (const c of CHAPTERS) {
    assert.ok(!ids.has(c.id), `duplicate chapter id ${c.id}`);
    ids.add(c.id);
    assert.ok(c.title.en && c.title.bn, `${c.id}: title`);
    assert.ok(c.icon, `${c.id}: icon`);
  }
});

test('every block has English and Bangla text of the same shape', () => {
  for (const c of CHAPTERS) {
    c.blocks.forEach((b, i) => {
      const where = `${c.id} #${i} (${b.t})`;
      if (b.t === 'table') {
        assert.ok(b.head.length >= 2, where);
        for (const h of b.head) assert.ok(h[0] && h[1], `${where}: header`);
        for (const r of b.rows) {
          assert.equal(r.length, b.head.length, `${where}: columns`);
          for (const cell of r) assert.ok(cell[0] && cell[1], `${where}: empty cell`);
        }
      } else if (b.t === 'steps' || b.t === 'ul') {
        assert.ok(b.en.length > 0 && b.en.length === b.bn.length, `${where}: en/bn item counts differ (${b.en.length} vs ${b.bn.length})`);
        for (const x of [...b.en, ...b.bn]) assert.ok(x && x.trim(), `${where}: empty item`);
      } else {
        assert.ok(b.en && b.en.trim() && b.bn && b.bn.trim(), `${where}: missing text`);
      }
    });
  }
});

test('Bangla text is really Bangla (no untranslated English paragraphs)', () => {
  const bengali = /[ঀ-৿]/;
  for (const c of CHAPTERS) {
    assert.ok(bengali.test(c.title.bn) || /^[A-Za-z, ]+$/.test(c.title.bn), `${c.id}: title.bn`);
    for (const b of c.blocks) {
      if (b.t === 'p' || b.t === 'tip' || b.t === 'warn') assert.ok(bengali.test(b.bn) || c.id === 'about', `${c.id}: paragraph not translated: ${b.bn.slice(0, 50)}`);
    }
  }
});

test('{{ch:…}} references point at real chapters', () => {
  const ids = new Set(CHAPTERS.map((c) => c.id));
  for (const s of strings(CHAPTERS)) for (const m of s.matchAll(/\{\{ch:([a-z]+)\}\}/g)) assert.ok(ids.has(m[1]), `unknown chapter ${m[1]}`);
});

test('the library lists every component, once', () => {
  const real = allTypes().filter((C) => C.type !== 'base').map((C) => C.type).sort();
  const listed = CATEGORIES.flatMap((c) => c.items).sort();
  assert.deepEqual(listed, real, 'every registered component is in a palette category (and so in the manual)');
  assert.equal(libraryCount(), real.length);
  for (const cat of libraryData()) {
    assert.ok(CATEGORY_NOTES[cat.id], `${cat.id}: needs a usage note`);
    assert.ok(CATEGORY_NOTES[cat.id].en && CATEGORY_NOTES[cat.id].bn, `${cat.id}: note in both languages`);
    for (const it of cat.items) assert.ok(it.title && it.desc, `${it.type}: title and description`);
  }
});

test('every example is listed', () => {
  assert.equal(exampleData().reduce((n, c) => n + c.items.length, 0), EXAMPLES.length);
});

test('counts quoted in the text match the app', () => {
  const lib = CHAPTERS.find((c) => c.id === 'library'), ex = CHAPTERS.find((c) => c.id === 'examples');
  for (const lang of ['en', 'bn']) {
    assert.ok(lib.title[lang].includes(lang === 'bn' ? String(libraryCount()).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]) : String(libraryCount())), `library title count (${lang})`);
    assert.ok(ex.title[lang].includes(lang === 'bn' ? String(EXAMPLES.length).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]) : String(EXAMPLES.length)), `examples title count (${lang})`);
  }
  assert.ok(allText('en').includes(`${libraryCount()} components in ${CATEGORIES.length} categories`), 'welcome chapter component count');
  assert.ok(allText('en').includes(`${EXAMPLES.length} ready-made examples`), 'welcome chapter example count');
});

test('every setting on the Settings screen is explained', () => {
  const src = fs.readFileSync(new URL('../src/ui/screens.js', import.meta.url), 'utf8');
  const labels = [...src.matchAll(/\$\{row\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(labels.length >= 20, 'found the settings rows');
  const text = allText('en');
  for (const l of labels) assert.ok(text.includes(l), `Settings → "${l}" is not in the manual`);
});

test('every editor menu item and toolbar button is explained', () => {
  const src = fs.readFileSync(new URL('../src/ui/editor.js', import.meta.url), 'utf8');
  const menu = src.slice(src.indexOf('const items = ['), src.indexOf('m.innerHTML = items'));
  const labels = [...menu.matchAll(/\['\w+', '\w+', '([^']+)'\]/g)].map((m) => m[1]);
  assert.ok(labels.length >= 12, 'found the menu items');
  const text = allText('en');
  for (const l of labels) assert.ok(text.includes(l), `⋮ menu → "${l}" is not in the manual`);
  const bar = [...src.matchAll(/<button class="tb[^"]*" data-a="\w+">\$\{icon\('\w+', \d+\)\}<span>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.ok(bar.length >= 7, 'found the toolbar buttons');
  for (const l of bar) assert.ok(text.includes(l), `toolbar → "${l}" is not in the manual`);
});

test('markdown export contains all chapters in both languages', () => {
  for (const lang of ['en', 'bn']) {
    const md = manualMarkdown(lang);
    for (const c of CHAPTERS) assert.ok(md.includes(c.title[lang]), `${lang}: ${c.id}`);
    assert.ok(!md.includes('{{ch:'), 'references expanded');
    assert.ok(md.includes(UI_TEXT.title[lang]));
    for (const cat of libraryData()) for (const it of cat.items) assert.ok(md.includes(`**${it.title.replace(/\|/g, '\\|')}**`), `${lang}: ${it.title}`);
    for (const e of EXAMPLES) assert.ok(md.includes(`**${e.title}**`), `${lang}: ${e.title}`);
  }
});

test('every chapter has a one-line summary in both languages', () => {
  for (const c of CHAPTERS) assert.ok(SUMMARY[c.id]?.en && SUMMARY[c.id]?.bn, `${c.id}: summary`);
  assert.deepEqual(Object.keys(SUMMARY).sort(), CHAPTERS.map((c) => c.id).sort(), 'no summary for a chapter that does not exist');
});

test('long chapters split into sections, short ones stay on one page', () => {
  let split = 0;
  for (const c of CHAPTERS) {
    const { intro, sections } = chapterParts(c);
    if (sections.length) {
      split++;
      assert.ok(sections.length >= 2);
      for (const s of sections) assert.ok(s.title.en && s.title.bn && s.blocks.length, `${c.id}: empty section ${s.title.en}`);
      assert.equal(intro.length + sections.reduce((n, s) => n + s.blocks.length + 1, 0), c.blocks.length, `${c.id}: no block lost`);
    } else assert.equal(intro.length, c.blocks.length);
  }
  assert.ok(split >= 8, 'most chapters are split into sections');
});
