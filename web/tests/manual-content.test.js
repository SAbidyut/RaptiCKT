// The user manual stays complete and consistent: every component and
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
const allText = () => strings(CHAPTERS.map((c) => [c.title, c.blocks.map((b) => (b.t === 'table' ? [b.head, b.rows] : b.text))])).join('\n');

test('chapters have unique ids, a title and an icon', () => {
  const ids = new Set();
  for (const c of CHAPTERS) {
    assert.ok(!ids.has(c.id), `duplicate chapter id ${c.id}`);
    ids.add(c.id);
    assert.ok(typeof c.title === 'string' && c.title, `${c.id}: title`);
    assert.ok(c.icon, `${c.id}: icon`);
  }
});

test('every block has text', () => {
  for (const c of CHAPTERS) {
    c.blocks.forEach((b, i) => {
      const where = `${c.id} #${i} (${b.t})`;
      if (b.t === 'table') {
        assert.ok(b.head.length >= 2, where);
        for (const h of b.head) assert.ok(typeof h === 'string' && h, `${where}: header`);
        for (const r of b.rows) {
          assert.equal(r.length, b.head.length, `${where}: columns`);
          for (const cell of r) assert.ok(typeof cell === 'string' && cell, `${where}: empty cell`);
        }
      } else if (b.t === 'steps' || b.t === 'ul') {
        assert.ok(b.text.length > 0, `${where}: no items`);
        for (const x of b.text) assert.ok(x && x.trim(), `${where}: empty item`);
      } else {
        assert.ok(typeof b.text === 'string' && b.text.trim(), `${where}: missing text`);
      }
    });
  }
});

test('the manual is English only', () => {
  const md = manualMarkdown();
  assert.ok(!/[\u0980-\u09FF]/.test(md), 'no Bangla text in the manual');
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
    assert.ok(typeof CATEGORY_NOTES[cat.id] === 'string', `${cat.id}: note is text`);
    for (const it of cat.items) assert.ok(it.title && it.desc, `${it.type}: title and description`);
  }
});

test('every example is listed', () => {
  assert.equal(exampleData().reduce((n, c) => n + c.items.length, 0), EXAMPLES.length);
});

test('counts quoted in the text match the app', () => {
  const lib = CHAPTERS.find((c) => c.id === 'library'), ex = CHAPTERS.find((c) => c.id === 'examples');
  assert.ok(lib.title.includes(String(libraryCount())), 'library title count');
  assert.ok(ex.title.includes(String(EXAMPLES.length)), 'examples title count');
  assert.ok(allText().includes(`${libraryCount()} components in ${CATEGORIES.length} categories`), 'welcome chapter component count');
  assert.ok(allText().includes(`${EXAMPLES.length} ready-made examples`), 'welcome chapter example count');
});

test('every setting on the Settings screen is explained', () => {
  const src = fs.readFileSync(new URL('../src/ui/screens.js', import.meta.url), 'utf8');
  const labels = [...src.matchAll(/\$\{row\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(labels.length >= 20, 'found the settings rows');
  const text = allText();
  for (const l of labels) assert.ok(text.includes(l), `Settings → "${l}" is not in the manual`);
});

test('every editor menu item and toolbar button is explained', () => {
  const src = fs.readFileSync(new URL('../src/ui/editor.js', import.meta.url), 'utf8');
  const menu = src.slice(src.indexOf('const items = ['), src.indexOf('m.innerHTML = items'));
  const labels = [...menu.matchAll(/\['\w+', '\w+', '([^']+)'\]/g)].map((m) => m[1]);
  assert.ok(labels.length >= 12, 'found the menu items');
  const text = allText();
  for (const l of labels) assert.ok(text.includes(l), `⋮ menu → "${l}" is not in the manual`);
  const bar = [...src.matchAll(/<button class="tb[^"]*" data-a="\w+">\$\{icon\('\w+', \d+\)\}<span>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.ok(bar.length >= 7, 'found the toolbar buttons');
  for (const l of bar) assert.ok(text.includes(l), `toolbar → "${l}" is not in the manual`);
});

test('markdown export contains all chapters', () => {
  const md = manualMarkdown();
  for (const c of CHAPTERS) assert.ok(md.includes(c.title), c.id);
  assert.ok(!md.includes('{{ch:'), 'references expanded');
  assert.ok(md.includes(UI_TEXT.title));
  for (const cat of libraryData()) for (const it of cat.items) assert.ok(md.includes(`**${it.title.replace(/\|/g, '\\|')}**`), it.title);
  for (const e of EXAMPLES) assert.ok(md.includes(`**${e.title}**`), e.title);
});

test('every chapter has a one-line summary', () => {
  for (const c of CHAPTERS) assert.ok(typeof SUMMARY[c.id] === 'string' && SUMMARY[c.id], `${c.id}: summary`);
  assert.deepEqual(Object.keys(SUMMARY).sort(), CHAPTERS.map((c) => c.id).sort(), 'no summary for a chapter that does not exist');
});

test('long chapters split into sections, short ones stay on one page', () => {
  let split = 0;
  for (const c of CHAPTERS) {
    const { intro, sections } = chapterParts(c);
    if (sections.length) {
      split++;
      assert.ok(sections.length >= 2);
      for (const s of sections) assert.ok(s.title && s.blocks.length, `${c.id}: empty section ${s.title}`);
      assert.equal(intro.length + sections.reduce((n, s) => n + s.blocks.length + 1, 0), c.blocks.length, `${c.id}: no block lost`);
    } else assert.equal(intro.length, c.blocks.length);
  }
  assert.ok(split >= 8, 'most chapters are split into sections');
});
