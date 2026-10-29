// Reading a label word: the characters' likely classes (glyph.js), touching characters split,
// specks dropped, and the reading that makes sense as a circuit label chosen — a value
// ("20 Ω", "2 kΩ", "0.5 mA"), a dependent source's expression ("0.1vₓ", "4iₓ"), a name
// ("vₓ", "i", "V₀"), a sign (+ or −) or a figure caption ("Figure 4.12").

import { classify, CLASSES, ASPECT } from './glyph.js';
import { cutGlyph, despeck } from './text.js';

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
 * The ways to read one glyph: as itself, cut into touching characters, or — when it sticks out
 * of the band [y0, y1] its neighbours share — without what sticks out (a speck of dust stuck on
 * a 4 is not part of it).
 */
function alternatives(g, mainH, band) {
  const bm = g.bitmap;
  const alts = [[{ bm, small: g.small, low: g.low }]];
  if (band && !g.low && !g.small) {
    const bh = band[1] - band[0] + 1;
    if (g.y1 > band[1] + 0.15 * bh || g.y0 < band[0] - 0.15 * bh) {
      const c = rows(bm, band[0] - 0.06 * bh, band[1] + 0.06 * bh);
      if (c) alts.push([{ bm: c, small: g.small, low: g.low }]);
    }
  }
  if (bm.w >= 0.95 * bm.h && bm.h >= 0.55 * mainH) {
    for (const x of cuts(bm)) {
      const a = slice(bm, 0, x), b = slice(bm, x, bm.w);
      if (a && b && a.w >= 0.25 * bm.h && b.w >= 0.25 * bm.h) alts.push([{ bm: a, small: g.small, low: g.low }, { bm: b, small: g.small, low: g.low }]);
    }
    if (bm.w >= 1.7 * bm.h) {
      const third = Math.round(bm.w / 3);
      const p = [slice(bm, 0, third), slice(bm, third, 2 * third), slice(bm, 2 * third, bm.w)];
      if (p.every(Boolean)) alts.push(p.map((q) => ({ bm: q, small: g.small, low: g.low })));
    }
  }
  return alts;
}

// how common each subscript is in textbook labels (log prior)
const SUB_PRIOR = { x: 0, o: -0.4, 0: -0.6, 1: -0.6, 2: -0.8, s: -0.8, L: -1.1, a: -1.2, b: -1.2, T: -1.4, h: -1.8, i: -1.8, n: -2, c: -2, e: -2.2, r: -3.5 };
const SUBS = new Set(['x', 'o', '0', '1', '2', '3', '4', '5', 'a', 'b', 's', 'L', 'I', 'n', 't', 'c', 'e', 'g', 'u', 'r', 'k', 'm', 'i', 'j', 'v', 'H', 'R', 'M', 'F', 'A']);
const PREFIX = { k: 1e3, M: 1e6, m: 1e-3, μ: 1e-6, n: 1e-9 };
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
  // (only a digit written low breaks a value: a prefix or unit letter may sit lower)
  if (m && !chars.some((x) => x.sub && /[0-9]/.test(x.c))) {
    const num = +(parseFloat(m[3]) * (m[4] ? PREFIX[m[4]] : 1) * (m[1] ? -1 : 1)).toPrecision(12);
    if (m[4] && !m[5] && m[4] !== 'k' && m[4] !== 'M') return null; // "2m": not a value
    const unit = m[5] ? UNIT[m[5]] : '';
    return { type: 'value', value: num, unit, imag: !!m[2], text: `${m[1] ? '−' : ''}${m[2] ? 'j' : ''}${m[3]}${m[4] ? ' ' + m[4] : unit ? ' ' : ''}${unit}`.replace(/ ([kMmμn])/, ' $1') };
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
      return { type: 'dep', coef: parseFloat(m[1]), var: letter, sub, name: letter + sub, text: `${m[1]}${letter}${sub}` };
    }
    return { type: 'name', name, var: letter, sub, text: name };
  }
  // a bare number (the unit follows from the part)
  return null;
}

/**
 * Read a word (from text.js): { type, …, text, score } or { type: null } when it reads as nothing
 * a circuit label can be. mainH: the figure's typical character height (working px).
 */
export function readWord(word, mainH, img) {
  const glyphs = word.glyphs;
  const tall = Math.max(...glyphs.map((g) => g.y1 - g.y0 + 1));
  const hs = glyphs.map((g) => g.y1 - g.y0 + 1).filter((v) => v >= 0.5 * tall).sort((a, b) => a - b);
  const top = hs[(hs.length - 1) >> 1];
  const rank = (bm, sub, small) => {
    const pr = classify(bm);
    // a reading whose shape is far from the character's usual width/height is unlikely (two
    // touching digits are not an 8)
    const la = Math.log(bm.w / bm.h);
    // a subscript is a few pixels across: its shape says less, what is usual more
    const trust = sub && small ? 0.5 : 1;
    const ranked = [...pr].map((v, i) => {
      const r = ASPECT[CLASSES[i]];
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
    const others = glyphs.filter((o, j) => j !== k && !o.low && !o.small && o.y1 - o.y0 + 1 >= 0.72 * top);
    const mid = (a) => a.sort((x, y) => x - y)[a.length >> 1];
    const band = others.length ? [mid(others.map((o) => o.y0)), mid(others.map((o) => o.y1))] : null;
    return { tiny, speck, alts: alternatives(g, top, band).map((pieces) => pieces.map((p) => rank(p.bm, !!g.low, !!p.small))) };
  });
  // two neighbours that may be one broken character (an Ω whose arch did not print)
  const merged = glyphs.map((g, k) => {
    const h = glyphs[k + 1];
    if (!h || !img) return null;
    const gap = h.x0 - g.x1 - 1, ov = Math.min(g.y1, h.y1) - Math.max(g.y0, h.y0) + 1;
    const hh = Math.max(g.y1 - g.y0, h.y1 - h.y0) + 1;
    if (gap > 0.15 * top || ov < 0.6 * Math.min(g.y1 - g.y0 + 1, h.y1 - h.y0 + 1) || Math.max(h.x1, g.x1) - Math.min(g.x0, h.x0) + 1 > 1.4 * hh) return null;
    const u = { ids: [...g.ids, ...h.ids], x0: Math.min(g.x0, h.x0), y0: Math.min(g.y0, h.y0), x1: Math.max(g.x1, h.x1), y1: Math.max(g.y1, h.y1) };
    return rank(cutGlyph(img, u), !!(g.low && h.low), !!(g.small && h.small));
  });
  // beam over the glyphs: an alternative and a class for each piece, or two glyphs read as one;
  // a tiny speck (or a flat one at either end) may be dropped
  let beams = [[{ chars: [], score: 0 }]];
  const push = (k, list) => { beams[k] = (beams[k] || []).concat(list); };
  for (let k = 0; k < slots.length; k++) {
    const cur = (beams[k] || []).sort((a, c) => c.score - a.score).slice(0, 300);
    const sl = slots[k];
    for (const b of cur) {
      if (sl.tiny || sl.speck) push(k + 1, [{ chars: b.chars, score: b.score + Math.log(sl.tiny ? 0.25 : 0.2) }]);
      sl.alts.forEach((pieces, ai) => {
        let partial = [{ chars: b.chars, score: b.score + (ai ? Math.log(0.6) : 0) }];
        for (const pc of pieces) {
          const nx = [];
          for (const q of partial) for (const r of pc.ranked) nx.push({ chars: [...q.chars, { c: r.c, sub: pc.sub, small: pc.small }], score: q.score + Math.max(LOG_FLOOR, r.lp) });
          nx.sort((a, c) => c.score - a.score);
          partial = nx.slice(0, 60);
        }
        push(k + 1, partial);
      });
      if (merged[k]) {
        const pc = merged[k];
        push(k + 2, pc.ranked.map((r) => ({ chars: [...b.chars, { c: r.c, sub: pc.sub, small: pc.small }], score: b.score + Math.log(0.5) + Math.max(LOG_FLOOR, r.lp) })));
      }
    }
  }
  const beam = (beams[slots.length] || []).sort((a, c) => c.score - a.score).slice(0, 400);
  let best = null;
  for (const b of beam) {
    if (!b.chars.length) continue;
    // a reading that needs unlikely characters is grain, not a label
    if (b.score / b.chars.length < -1.6 || b.score < -5.5) continue;
    const p = parseLabel(b.chars);
    if (!p) continue;
    // values are written full size: a lone little blot reading as a digit is grain
    if (p.type === 'value' && tall < 0.6 * mainH) continue;
    let sc = b.score;
    for (const ch of p.sub || '') sc += SUB_PRIOR[ch] ?? -2.5;
    // a prefix with no unit after it ("4 k") is rarer than a unit or an expression
    if (p.type === 'value' && !p.unit && /[kM]$/.test(p.text)) sc -= 1;
    if (!best || sc > best.score) best = { ...p, score: sc, chars: b.chars.map((x) => x.c).join('') };
  }
  const raw = beam[0] ? beam[0].chars.map((x) => x.c).join('') : '';
  return best ? { ...best, raw } : { type: null, raw, score: beam[0] ? beam[0].score : -Infinity };
}
