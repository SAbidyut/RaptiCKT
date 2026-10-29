// Reading a label word: the characters' likely classes (glyph.js), touching characters split,
// specks dropped, and the reading that makes sense as a circuit label chosen — a value
// ("20 Ω", "2 kΩ", "0.5 mA"), a dependent source's expression ("0.1vₓ", "4iₓ"), a name
// ("vₓ", "i", "V₀"), a sign (+ or −) or a figure caption ("Figure 4.12").

import { classify, CLASSES, ASPECT, HAND_ASPECT } from './glyph.js';
import { cutGlyph, despeck, word } from './text.js';

const LOG_FLOOR = Math.log(1e-5);

/** Trim a bitmap's columns [a, b) to its ink. */
function slice(bm, a, b) {
  const part = new Uint8Array(bm.w * bm.h);
  for (let y = 0; y < bm.h; y++) for (let x = a; x < b; x++) part[y * bm.w + x] = bm.data[y * bm.w + x];
  // a cut may leave a corner of the next character behind: a speck, not part of this one
  despeck(part, bm.w, bm.h);
  bm = { w: bm.w, h: bm.h, data: part };
  let x0 = b, x1 = a - 1, y0 = bm.h, y1 = -1;
  for (let y = 0; y < bm.h; y++) for (let x = a; x < b; x++) if (bm.data[y * bm.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = bm.data[(y + y0) * bm.w + x + x0];
  return { w, h, data, dy: y0 };
}

/** Where a wide blot may be two (or three) touching characters: cut columns, best first. */
function cuts(bm) {
  const col = new Float32Array(bm.w);
  for (let x = 0; x < bm.w; x++) { let n = 0; for (let y = 0; y < bm.h; y++) n += bm.data[y * bm.w + x]; col[x] = n; }
  const max = Math.max(...col);
  const out = [];
  for (let x = Math.round(bm.w * 0.22); x < Math.round(bm.w * 0.78); x++) {
    if (col[x] > 0.45 * max) continue;
    if (col[x] <= col[x - 1] && col[x] <= col[x + 1]) out.push({ x, v: col[x] });
  }
  out.sort((a, b) => a.v - b.v);
  // keep cuts apart from each other; touching round digits (60, 00) may have no valley at all:
  // try the thinnest column of the middle and the very middle too
  let thin = Math.round(bm.w * 0.35);
  for (let x = thin; x < Math.round(bm.w * 0.65); x++) if (col[x] < col[thin]) thin = x;
  out.push({ x: thin, v: col[thin] + 0.5 }, { x: Math.round(bm.w / 2), v: col[Math.round(bm.w / 2)] + 1 });
  const keep = [];
  for (const c of out) if (!keep.some((k) => Math.abs(k.x - c.x) < bm.w * 0.12)) keep.push(c);
  return keep.slice(0, 3).map((c) => c.x);
}

/** A bitmap (from cutGlyph) cut down to the rows between working y0 and y1, trimmed, or null. */
function rows(bm, y0, y1) {
  if (bm.oy == null) return null;
  const a = Math.max(0, Math.floor(y0 / bm.k) - bm.oy), b = Math.min(bm.h, Math.ceil((y1 + 1) / bm.k) - bm.oy);
  if (b - a < 0.5 * bm.h || (a === 0 && b === bm.h)) return null;
  const part = new Uint8Array(bm.w * bm.h);
  for (let y = a; y < b; y++) for (let x = 0; x < bm.w; x++) part[y * bm.w + x] = bm.data[y * bm.w + x];
  despeck(part, bm.w, bm.h);
  let x0 = bm.w, x1 = -1, t = bm.h, d = -1;
  for (let y = a; y < b; y++) for (let x = 0; x < bm.w; x++) if (part[y * bm.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < t) t = y; if (y > d) d = y; }
  if (x1 < x0) return null;
  const w = x1 - x0 + 1, h = d - t + 1, data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = part[(y + t) * bm.w + x + x0];
  return { w, h, data };
}

/**
 * Where hand-written characters that touch may be cut apart: lines across the blot, upright or
 * leaning like the writing, through as little ink as possible. [{ x, s }]: the line runs through
 * column x at mid-height and moves s columns per row down, best first.
 */
function cutsHand(bm) {
  const { w, h, data } = bm;
  const ink = (x, y) => x >= 0 && x < w && data[y * w + x];
  // ink left of each column, row by row
  const pre = new Int32Array(h * (w + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pre[y * (w + 1) + x + 1] = pre[y * (w + 1) + x] + data[y * w + x];
  let total = 0;
  for (let y = 0; y < h; y++) total += pre[y * (w + 1) + w];
  const out = [];
  for (const s of [-0.35, -0.18, 0, 0.18, 0.35]) {
    for (let k = 4; k <= 16; k++) {
      const x0 = (k / 20) * w;
      let cost = 0, left = 0;
      for (let y = 0; y < h; y++) {
        const xc = Math.round(x0 + s * (y - h / 2));
        if (ink(xc, y) || ink(xc - 1, y)) cost++;
        left += pre[y * (w + 1) + Math.max(0, Math.min(w, xc))];
      }
      // each side keeps a fair share of the ink
      if (left < 0.15 * total || left > 0.85 * total) continue;
      out.push({ x: x0, s, cost: cost / h + 0.15 * Math.abs(s) });
    }
  }
  out.sort((a, b) => a.cost - b.cost);
  const keep = [];
  for (const c of out) if (!keep.some((q) => Math.abs(q.x - c.x) < 0.1 * w && q.s === c.s) && keep.length < 5) keep.push(c);
  return keep;
}

/** A bitmap split along the line { x, s } (see cutsHand): [left, right], each trimmed, or null. */
function splitLine(bm, { x, s }) {
  const { w, h, data } = bm;
  const parts = [new Uint8Array(w * h), new Uint8Array(w * h)];
  for (let y = 0; y < h; y++) {
    const xc = x + s * (y - h / 2);
    for (let X = 0; X < w; X++) if (data[y * w + X]) parts[X < xc ? 0 : 1][y * w + X] = 1;
  }
  return parts.map((part) => {
    despeck(part, w, h);
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) if (part[y * w + X]) { if (X < x0) x0 = X; if (X > x1) x1 = X; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) return null;
    const ww = x1 - x0 + 1, hh = y1 - y0 + 1, out = new Uint8Array(ww * hh);
    for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < ww; xx++) out[yy * ww + xx] = part[(yy + y0) * w + xx + x0];
    return { w: ww, h: hh, data: out };
  });
}

/**
 * The ways to read one glyph: as itself, cut into touching characters, or — when it sticks out
 * of the band [y0, y1] its neighbours share — without what sticks out (a speck of dust stuck on
 * a 4 is not part of it). Hand-written blots are cut along leaning lines too.
 */
function alternatives(g, mainH, band, hand = false) {
  const bm = g.bitmap, low = hand ? g.lowHand : g.low;
  const alts = [[{ bm, small: g.small, low }]];
  if (hand && bm.w >= 0.8 * bm.h && bm.h >= 0.45 * mainH) {
    // (a cut through more ink than the cleanest one is less likely where two characters meet)
    const cs = cutsHand(bm), least = cs.length ? cs[0].cost : 0;
    for (const c of cs) {
      const [a, b] = splitLine(bm, c);
      if (a && b && a.w >= 0.2 * bm.h && b.w >= 0.2 * bm.h) alts.push(Object.assign([{ bm: a, small: g.small, low }, { bm: b, small: g.small, low }], { pen: Math.log(0.6) - 8 * (c.cost - least) }));
    }
  }
  if (band && !low && !g.small) {
    const bh = band[1] - band[0] + 1;
    if (g.y1 > band[1] + 0.15 * bh || g.y0 < band[0] - 0.15 * bh) {
      const c = rows(bm, band[0] - 0.06 * bh, band[1] + 0.06 * bh);
      if (c) alts.push([{ bm: c, small: g.small, low }]);
    }
  }
  if (bm.w >= 0.95 * bm.h && bm.h >= 0.55 * mainH) {
    for (const x of cuts(bm)) {
      const a = slice(bm, 0, x), b = slice(bm, x, bm.w);
      if (a && b && a.w >= 0.25 * bm.h && b.w >= 0.25 * bm.h) alts.push([{ bm: a, small: g.small, low }, { bm: b, small: g.small, low }]);
    }
    if (bm.w >= 1.7 * bm.h) {
      const third = Math.round(bm.w / 3);
      const p = [slice(bm, 0, third), slice(bm, third, 2 * third), slice(bm, 2 * third, bm.w)];
      if (p.every(Boolean)) alts.push(p.map((q) => ({ bm: q, small: g.small, low })));
    }
  }
  return alts;
}

const TWINS = [['1', 'I'], ['0', 'o']].map(([a, b]) => [CLASSES.indexOf(a), CLASSES.indexOf(b)]);
// written by hand, the look-alikes share their usual shapes too (a 1 as thin as a stroke)
const HAND_SHAPE = { ...HAND_ASPECT };
for (const [a, b] of [['1', 'I'], ['0', 'o']]) {
  const A = HAND_ASPECT[a], B = HAND_ASPECT[b];
  if (A && B) HAND_SHAPE[a] = HAND_SHAPE[b] = [Math.min(A[0], B[0]), Math.max(A[1], B[1])];
}

// how common each subscript is in textbook labels (log prior)
const SUB_PRIOR = { x: 0, o: -0.4, 0: -0.6, 1: -0.6, 2: -0.8, s: -0.8, L: -1.1, a: -1.2, b: -1.2, T: -1.4, h: -1.8, i: -1.8, n: -2, c: -2, e: -2.2, r: -3.5 };
const SUBS = new Set(['x', 'o', '0', '1', '2', '3', '4', '5', 'a', 'b', 's', 'L', 'I', 'n', 't', 'c', 'e', 'g', 'u', 'r', 'k', 'm', 'i', 'j', 'v', 'H', 'R', 'M', 'F', 'A']);
const PREFIX = { k: 1e3, M: 1e6, m: 1e-3, μ: 1e-6, n: 1e-9 };
// how common each prefix is with each unit in circuit problems (log prior): coils in mH, rarely
// nH; capacitors in μF, rarely mF
const PREFIX_PRIOR = { H: { μ: -0.7, n: -2 }, F: { n: -0.7, m: -1.5 }, Ω: { M: -0.5, m: -2, μ: -3, n: -3 }, V: { k: -0.5, m: -0.7, μ: -1.5, n: -3 }, A: { μ: -0.7, k: -2, n: -3 } };
const UNIT = { Ω: 'Ω', v: 'V', A: 'A', F: 'F', H: 'H' };

/**
 * Which label a string of classes (with subscript flags) can be, and its meaning, or null.
 * chars: [{ c, sub (bool), small (bool) }].
 */
export function parseLabel(chars) {
  const s = chars.map((x) => x.c).join('');
  if (s === '+' ) return { type: 'sign', sign: '+' };
  if (s === '-') return { type: 'sign', sign: '-' };
  // caption: F i g u r e … 4.12 (a word of letters first, a number with a point at the end)
  const cap = /^[FIilgure]{1,6}([0-9]+\.[0-9]+)\.?$/.exec(s) || /^F[a-zI.]{1,6}?([0-9]+\.[0-9]+)\.?$/.exec(s);
  if (cap) return { type: 'caption', text: `Figure ${cap[1]}` };
  // value: [-][j]number[prefix][unit]
  let m = /^(-)?(j)?([0-9]+(?:[.][0-9]+)?)(k|M|m|μ|n)?(Ω|v|A|F|H)?$/.exec(s);
  // (only a digit written low or small breaks a value: a prefix or unit letter may sit lower)
  if (m && !chars.some((x) => (x.sub || x.small) && /[0-9]/.test(x.c))) {
    const num = +(parseFloat(m[3]) * (m[4] ? PREFIX[m[4]] : 1) * (m[1] ? -1 : 1)).toPrecision(12);
    if (m[4] && !m[5] && m[4] !== 'k' && m[4] !== 'M') return null; // "2m": not a value
    const unit = m[5] ? UNIT[m[5]] : '';
    return { type: 'value', value: num, unit, prefix: m[4] || '', imag: !!m[2], text: `${m[1] ? '−' : ''}${m[2] ? 'j' : ''}${m[3]}${m[4] ? ' ' + m[4] : unit ? ' ' : ''}${unit}`.replace(/ ([kMmμn])/, ' $1') };
  }
  // a dependent source's expression or a name: [number] letter [subscript]
  m = /^([0-9]+(?:[.][0-9]+)?)?(v|μ|i|I|j|R|L|c)(.{0,3})$/.exec(s);
  if (m) {
    const sub = m[3];
    const subChars = chars.slice(chars.length - sub.length);
    if (sub && !subChars.every((x) => SUBS.has(x.c))) return null;
    // a subscript is written small and low; a name without one is a single letter
    if (sub && !subChars.every((x) => x.sub)) return null;
    // an italic i is often taken for a j or an I
    // (and an italic v for a μ)
    const letter = m[2] === 'I' || m[2] === 'j' ? 'i' : m[2] === 'μ' ? 'v' : m[2];
    const name = (letter === 'c' ? 'C' : letter) + sub.replace(/o/g, 'o');
    if (m[1]) {
      if (letter !== 'v' && letter !== 'i') return null;
      // the gain's digits are written full size
      if (chars.slice(0, m[1].length).some((x) => (x.sub || x.small) && /[0-9]/.test(x.c))) return null;
      return { type: 'dep', coef: parseFloat(m[1]), var: letter, sub, name: letter + sub, text: `${m[1]}${letter}${sub}` };
    }
    return { type: 'name', name, var: letter, sub, text: name };
  }
  // a bare number (the unit follows from the part)
  return null;
}

/**
 * Read a figure's words (from text.js): { words, reads: [{ type, …, text, score } | { type: null }],
 * hand }. Specks are no words; a value and its unit written apart become one. Each word is read
 * as print and as hand-writing; the figure is hand-written when most of its words read better
 * so (a printed figure keeps its printed readings: a word that reads as nothing printed is no
 * label, whatever hand-writing it may look like).
 */
export function readWords(all, mainH, img, tilt = 0) {
  const words = all.filter((w) => w.glyphs.some((g) => g.y1 - g.y0 + 1 >= 0.45 * mainH));
  const print = words.map((w) => readWord(w, mainH, img, false));
  const sc = (r) => (r.type ? r.score : -8);
  const clear = (r) => !!r?.type && r.score > -1.5;
  // (a word that reads very clearly as print cannot read better by hand: it is read so only when
  // the others already make the figure look hand-written; a long line of words is a caption or
  // the problem's text, no label, and stays print)
  const short = (k) => words[k].glyphs.length <= 6;
  const hand = words.map((w, k) => (!short(k) || (print[k].type && print[k].score > -0.2) ? null : readWord(w, mainH, img, true)));
  // hand-written: most of the words that tell read better so
  const vote = () => {
    let win = 0, lose = 0, n = 0;
    words.forEach((_, k) => {
      // (a word read alike both ways tells only if print was unsure of it; a sign, too plain a
      // mark, or a unit written apart from its value, half a label, tells nothing; a word
      // tells only if it reads as a label both ways, or clearly one way)
      if (!hand[k] || ((hand[k].text ?? '') === (print[k].text ?? '') && sc(print[k]) > -0.5)) return;
      if (print[k].type === 'sign' || hand[k].type === 'sign' || /^[kMmμn]?[ΩvAFH]$/.test(hand[k].raw)) return;
      // (a value with its unit read by hand where print reads nothing tells, unless very
      // unsure)
      const handOnly = !print[k].type && hand[k].type === 'value' && !!hand[k].unit && hand[k].score > -4;
      if (!handOnly && !(print[k].type && hand[k].type) && !clear(print[k]) && !clear(hand[k])) return;
      n++;
      // (read alike, the hand-writing model's surer reading tells less: it is surer of most)
      const d = sc(hand[k]) - sc(print[k]), m = (hand[k].text ?? '') === (print[k].text ?? '') ? 0.4 : 0.2;
      if (d > m) win++; else if (d < -m) lose++;
    });
    return win >= 2 && win >= 0.5 * n && win >= 2 * lose;
  };
  let handWritten = vote();
  if (handWritten && hand.some((h, k) => !h && short(k))) {
    words.forEach((w, k) => { if (short(k)) hand[k] ??= readWord(w, mainH, img, true); });
    handWritten = vote();
  }
  const reads = handWritten ? hand.map((h, k) => (h && sc(h) >= sc(print[k]) - 0.5 ? h : print[k])) : print;
  return { ...joinUnits(words, reads, mainH, img, handWritten, tilt), hand: handWritten };
}

/**
 * A value and its unit written apart ("2   Ω", the unit small and low, a wide gap before it): a
 * bare number (or nothing readable) and the next word along its line are one label if together
 * they read as a value with its unit, clearly better than each reads alone.
 */
function joinUnits(words, reads, mainH, img, hand, tilt) {
  const gone = new Set();
  // (a word that reads as no label explains nothing, however clear its characters)
  const sc = (r) => (r.type ? r.score : -8);
  words.forEach((A, i) => {
    const r = reads[i];
    if (gone.has(i) || (r.type && !(r.type === 'value' && !r.unit))) return;
    let j = -1, bg = Infinity;
    words.forEach((B, k) => {
      if (k === i || gone.has(k)) return;
      const gap = B.x0 - A.x1 - 1, ov = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) + 1;
      if (gap < -0.2 * mainH || gap > 1.6 * mainH || ov < 0.3 * Math.min(A.y1 - A.y0 + 1, B.y1 - B.y0 + 1)) return;
      if (gap < bg) { bg = gap; j = k; }
    });
    if (j < 0) return;
    // (its characters marked afresh, against each other)
    const M = word([...A.glyphs, ...words[j].glyphs].map((g) => ({ ...g })), mainH, tilt);
    const m = readWord(M, mainH, img, hand);
    if (m.type !== 'value' || !m.unit || m.score <= sc(r) + sc(reads[j]) + 0.5) return;
    words[i] = M; reads[i] = m;
    gone.add(j);
  });
  return { words: words.filter((_, k) => !gone.has(k)), reads: reads.filter((_, k) => !gone.has(k)) };
}

/**
 * Read a word (from text.js): { type, …, text, score } or { type: null } when it reads as nothing
 * a circuit label can be. mainH: the figure's typical character height (working px); hand: read
 * it as hand-writing.
 */
export function readWord(word, mainH, img, hand = false) {
  const glyphs = word.glyphs;
  // a subscript (written by hand, smaller as well as lower)
  const low = (g) => !!(hand ? g.lowHand : g.low);
  const tall = Math.max(...glyphs.map((g) => g.y1 - g.y0 + 1));
  const hs = glyphs.map((g) => g.y1 - g.y0 + 1).filter((v) => v >= 0.5 * tall).sort((a, b) => a - b);
  const top = hs[(hs.length - 1) >> 1];
  const rank = (bm, sub, small) => {
    const pr = Float32Array.from(classify(bm, hand));
    // look-alikes the shape alone cannot tell apart (a bar is a 1 or an I, a ring a 0 or an
    // o, more so written by hand): each is also as likely as half the other, and the rest of
    // the word decides
    for (const [a, b] of TWINS) { const pa = pr[a], pb = pr[b]; pr[a] = Math.max(pa, 0.5 * pb); pr[b] = Math.max(pb, 0.5 * pa); }
    // a reading whose shape is far from the character's usual width/height is unlikely (two
    // touching digits are not an 8)
    const la = Math.log(bm.w / bm.h);
    // a subscript is a few pixels across: its shape says less, what is usual more
    const trust = sub && small ? 0.5 : 1;
    const ranked = [...pr].map((v, i) => {
      const r = (hand ? HAND_SHAPE : ASPECT)[CLASSES[i]];
      const off = r ? Math.max(0, la - r[1] - 0.08, r[0] - 0.08 - la) : 0;
      return { c: CLASSES[i], lp: trust * Math.log(Math.max(v, 1e-5)) - 6 * off };
    }).sort((a, b) => b.lp - a.lp).slice(0, 6);
    return { ranked, sub, small };
  };
  // per glyph: alternatives, each a list of pieces with their class log-probabilities
  const slots = glyphs.map((g, k) => {
    const gh = g.y1 - g.y0 + 1, gw = g.x1 - g.x0 + 1;
    const tiny = gh < 0.3 * top && gw < 0.3 * top;
    // a low flat bit at either end of a word may be a speck of dust (or the next mark's minus)
    const speck = !tiny && gh < 0.45 * top && (k === 0 || k === glyphs.length - 1);
    // the band the other full-size characters share
    const others = glyphs.filter((o, j) => j !== k && !low(o) && !o.small && o.y1 - o.y0 + 1 >= 0.72 * top);
    const mid = (a) => a.sort((x, y) => x - y)[a.length >> 1];
    const band = others.length ? [mid(others.map((o) => o.y0)), mid(others.map((o) => o.y1))] : null;
    return { tiny, speck, alts: alternatives(g, top, band, hand).map((pieces) => Object.assign(pieces.map((p) => rank(p.bm, low(g), !!p.small)), { pen: pieces.pen })) };
  });
  // two neighbours that may be one broken character (an Ω whose arch did not print)
  const merged = glyphs.map((g, k) => {
    const h = glyphs[k + 1];
    if (!h || !img) return null;
    const gap = h.x0 - g.x1 - 1, ov = Math.min(g.y1, h.y1) - Math.max(g.y0, h.y0) + 1;
    const hh = Math.max(g.y1 - g.y0, h.y1 - h.y0) + 1;
    if (gap > 0.15 * top || ov < 0.6 * Math.min(g.y1 - g.y0 + 1, h.y1 - h.y0 + 1) || Math.max(h.x1, g.x1) - Math.min(g.x0, h.x0) + 1 > 1.4 * hh) return null;
    const u = { ids: [...g.ids, ...h.ids], x0: Math.min(g.x0, h.x0), y0: Math.min(g.y0, h.y0), x1: Math.max(g.x1, h.x1), y1: Math.max(g.y1, h.y1) };
    return rank(cutGlyph(img, u), low(g) && low(h), !!(g.small && h.small));
  });
  // beam over the glyphs: an alternative and a class for each piece, or two glyphs read as one;
  // a tiny speck (or a flat one at either end) may be dropped
  // (skip: what dropping specks cost, which says nothing of how well the rest reads; tail: the
  // last character read, linked back to the ones before it, which the readings share)
  let beams = [[{ tail: null, n: 0, score: 0, skip: 0 }]];
  const push = (k, list) => { const to = beams[k] || (beams[k] = []); for (const b of list) to.push(b); };
  const add = (q, r, pc, d) => ({ tail: { c: r.c, sub: pc.sub, small: pc.small, prev: q.tail }, n: q.n + 1, score: q.score + d + Math.max(LOG_FLOOR, r.lp), skip: q.skip });
  for (let k = 0; k < slots.length; k++) {
    const cur = (beams[k] || []).sort((a, c) => c.score - a.score).slice(0, 300);
    const sl = slots[k];
    for (const b of cur) {
      if (sl.tiny || sl.speck) { const d = Math.log(sl.tiny ? 0.25 : 0.2); push(k + 1, [{ tail: b.tail, n: b.n, score: b.score + d, skip: b.skip + d }]); }
      sl.alts.forEach((pieces, ai) => {
        let partial = [{ tail: b.tail, n: b.n, score: b.score + (ai ? pieces.pen ?? Math.log(0.6) : 0), skip: b.skip }];
        for (const pc of pieces) {
          const nx = [];
          for (const q of partial) for (const r of pc.ranked) nx.push(add(q, r, pc, 0));
          nx.sort((a, c) => c.score - a.score);
          partial = nx.slice(0, 60);
        }
        push(k + 1, partial);
      });
      if (merged[k]) push(k + 2, merged[k].ranked.map((r) => add(b, r, merged[k], Math.log(0.5))));
    }
  }
  const chars = (b) => { const out = new Array(b.n); for (let t = b.tail, i = b.n - 1; t; t = t.prev, i--) out[i] = t; return out; };
  const beam = (beams[slots.length] || []).sort((a, c) => c.score - a.score).slice(0, 400).map((b) => ({ chars: chars(b), score: b.score, skip: b.skip }));
  let best = null;
  for (const b of beam) {
    if (!b.chars.length) continue;
    // a reading that needs unlikely characters is grain, not a label
    if ((b.score - b.skip) / b.chars.length < -1.6 || b.score < -5.5) continue;
    const p = parseLabel(b.chars);
    if (!p) continue;
    // values are written full size: a lone little blot reading as a digit is grain; in print, an
    // Ω written low is a subscript (the o of i₀; the F of μF sits as low as the μ, rightly)
    if (p.type === 'value' && (tall < 0.6 * mainH || (!hand && p.unit === 'Ω' && b.chars[b.chars.length - 1].sub))) continue;
    let sc = b.score;
    for (const ch of p.sub || '') sc += SUB_PRIOR[ch] ?? -2.5;
    // a prefix with no unit after it ("4 k") is rarer than a unit or an expression; by hand, a
    // value with a minus before it rarer than a fleck before a value
    if (p.type === 'value' && !p.unit && /[kM]$/.test(p.text)) sc -= 1;
    if (hand && p.type === 'value' && p.value < 0) sc += Math.log(0.15);
    if (p.type === 'value' && p.prefix && p.unit) sc += PREFIX_PRIOR[p.unit]?.[p.prefix] ?? 0;
    if (!best || sc > best.score) best = { ...p, score: sc, chars: b.chars.map((x) => x.c).join('') };
  }
  const raw = beam[0] ? beam[0].chars.map((x) => x.c).join('') : '';
  return best ? { ...best, raw } : { type: null, raw, score: beam[0] ? beam[0].score : -Infinity };
}
