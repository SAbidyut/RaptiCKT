// Circuits drawn for the theorem steps. A "board" figure is the user's own drawing, changed for
// the step (load taken out, sources turned off, a–b shorted, nodes named); a "ladder" figure is a
// network redrawn as a ladder with the load on the right (final equivalents, source
// transformation stages). Both are drawn by the board's own renderer, then annotated.

import { spTree, flipTree } from '../engine/theorem.js';
import { getType, GRID } from '../elements/index.js';
import { CircuitDoc } from './doc.js';
import { Renderer, WireGraph, measureRich, fillRich } from './render.js';

const C = 6 * GRID; // one ladder cell: an 80-unit part with a short lead at each end
/** The theorems' quantities written with their subscripts: Vth → V_th, IN → I_N, Req1 → R_eq1, RL → R_L. */
const sym = (t) => t.replace(/\b([VIRPZ])(th|max|eq\d*|s\d+|N|M|L)\b/g, '$1_{$2}');

// ------------------------------------------------------------------ board figures
/**
 * The user's circuit as the step sees it. Returns { doc, hi, notes, load }: notes are annotations
 * anchored at world points (laid out in pixels when drawn), load the drawn load if it is shown.
 */
export function boardFigure(src, fig, net, method = 'nodal') {
  const doc = CircuitDoc.fromJSON(JSON.parse(JSON.stringify(src.toJSON())));
  const els = [...doc.elements];
  const posts = net.posts;
  const T = net.elems.find((e) => e.src === fig.target && e.kind === 'R' && !e.internal);
  const notes = [];
  const gone = new Set([...(fig.hide || []), ...(fig.wire || []), ...(fig.ground || []), ...(fig.open || []), ...(fig.meter ? [fig.meter.src] : [])]);
  // a turned-off source is labelled beside where it stood: to the right of an upright one, below a lying one
  const beside = (i, text) => {
    const [x1, y1, x2, y2] = els[i].worldBox(), [p, q] = posts[i];
    return Math.abs(p[0] - q[0]) < Math.abs(p[1] - q[1]) ? { t: 'tag', at: [x2 - 6, (y1 + y2) / 2], text, left: true } : { t: 'tag', at: [(x1 + x2) / 2, y2 + 4], text };
  };
  for (const i of fig.wire || []) { doc.addWire([posts[i][0], posts[i][1]]); notes.push(beside(i, `${els[i].name} → short`)); }
  for (const i of fig.ground || []) {
    const g = new (getType('ground'))(posts[i][0][0], posts[i][0][1]);
    doc.elements.push(g);
    notes.push({ t: 'tag', at: [posts[i][0][0] + 14, posts[i][0][1] - 14], text: `${els[i].name} → 0 V`, left: true });
  }
  for (const i of fig.open || []) notes.push(beside(i, `${els[i].name} → open`));
  if (fig.meter) { // a meter where a source stood (reciprocity): it reads the answer there
    const o = els[fig.meter.src], m = new (getType(fig.meter.type))(o.x, o.y);
    m.rot = o.rot; m.flip = o.flip; m.name = fig.meter.type === 'ammeter' ? 'A' : 'V';
    doc.elements.push(m);
    const [, y1, x2, y2] = m.worldBox();
    notes.push({ t: 'tag', at: [x2 + 4, (y1 + y2) / 2], text: fig.meter.text, left: true });
  }
  doc.elements = doc.elements.filter((e, i) => !(i < els.length && gone.has(i)));
  const [pa, pb] = T.n[0] === fig.a ? [posts[T.src][0], posts[T.src][1]] : [posts[T.src][1], posts[T.src][0]];
  if (fig.shortAB) { doc.addWire([pa, pb]); notes.push({ t: 'short', from: pa, to: pb }); }
  const hi = new Set([...(fig.highlight || []), ...(fig.keep != null ? [fig.keep] : [])].map((i) => els[i]).filter((e) => doc.elements.includes(e)));
  const load = doc.elements.includes(els[T.src]) ? els[T.src] : null;
  // `out`: across the load, pointing away from the rest of the circuit
  const mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  const bb = doc.bounds() || [mid[0], mid[1], mid[0], mid[1]];
  let nx = -(pb[1] - pa[1]), ny = pb[0] - pa[0];
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl; ny /= nl;
  if (nx * (mid[0] - (bb[0] + bb[2]) / 2) + ny * (mid[1] - (bb[1] + bb[3]) / 2) < 0) { nx = -nx; ny = -ny; }
  const out = [nx, ny], ab = { from: pa, to: pb, out, load };
  if (fig.ab) notes.push({ t: 'term', at: pa, other: pb, out, text: 'a' }, { t: 'term', at: pb, other: pa, out, text: 'b' });
  if (fig.show === 'Rth' || fig.show === 'RN') notes.push({ t: 'ask', ...ab, text: `${fig.show} = ?` });
  if (fig.show === 'Vth') notes.push({ t: 'ask', ...ab, text: 'Vth = ?', volt: true });
  if (fig.show === 'IN') notes.push({ t: 'flow', ...ab, text: 'IN' });
  if (fig.arrow) notes.push({ t: 'flow', ...ab, text: fig.arrow === true ? 'IL' : fig.arrow });
  // mesh analysis shows the mesh currents (clockwise loops) instead of the node names
  if ((fig.mode || method) === 'mesh' && fig.meshes && fig.meshes.length) for (const m of fig.meshes) notes.push({ t: 'mesh', at: m.at, box: m.box, text: m.text });
  else for (const tg of fig.tags || []) if (net.nodePos.has(tg.node)) notes.push({ t: 'node', at: net.nodePos.get(tg.node), text: tg.text });
  return { doc, hi, notes, load };
}

// ------------------------------------------------------------------ ladder figures
const isSrc = (e) => e.kind !== 'R';
const size = (t) => (t.k === 'L' ? 1 : t.kids.reduce((s, k) => s + size(k), 0));
const hasSrc = (t) => (t.k === 'L' ? isSrc(t.e) : t.kids.some(hasSrc));
// sizes in cells: a horizontal block (terminals left and right) and a vertical one (top and bottom)
function mH(t) {
  if (t.k === 'L') return { w: 1, h: 1 };
  const m = t.kids.map(mH);
  return t.k === 'S' ? { w: m.reduce((s, x) => s + x.w, 0), h: Math.max(...m.map((x) => x.h)) } : { w: Math.max(...m.map((x) => x.w)), h: m.reduce((s, x) => s + x.h, 0) };
}
function mV(t) { const { w, h } = mH(t); return { w: h, h: w }; }

class Builder {
  constructor(style) { this.doc = new CircuitDoc(); this.byId = new Map(); this.style = style; }
  wire(p, q) { if (p[0] !== q[0] || p[1] !== q[1]) this.doc.addWire([[p[0] * C, p[1] * C], [q[0] * C, q[1] * C]]); }
  /** a part between cells s and t, its n[0] end at s when first */
  part(e, s, t, first) {
    const P = [s[0] * C, s[1] * C], Q = [t[0] * C, t[1] * C], mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
    const el = new (getType(e.kind === 'R' ? 'resistor' : e.kind === 'V' ? 'dcv' : 'dci'))(mx, my);
    if (e.kind === 'R') { el.p.r = e.val; if (this.style) el.p.style = this.style; } else el.p.amp = e.val;
    el.name = sym(e.name);
    el.richName = el.name !== e.name; // drawn with its subscript
    const head = first ? P : Q;
    el.rot = P[1] === Q[1] ? (head[0] < mx ? 0 : 2) : (head[1] < my ? 1 : 3);
    const [p0, p1] = el.getPosts();
    this.doc.addWire([head, p0]);
    this.doc.addWire([p1, first ? Q : P]);
    this.doc.elements.push(el);
    this.byId.set(e.id, el);
  }
  leaf(t, s, u) { this.part(t.e, s, u, !t.rev); }
  /** horizontal block from (x, y) to (x + w, y), stacking parallel branches downward */
  h(t, x, y) {
    if (t.k === 'L') return this.leaf(t, [x, y], [x + 1, y]);
    if (t.k === 'S') { let cx = x; for (const k of t.kids) { this.h(k, cx, y); cx += mH(k).w; } return; }
    const W = mH(t).w, rows = [];
    let oy = 0;
    for (const k of t.kids) { this.h(k, x, y + oy); const { w, h } = mH(k); if (w < W) this.wire([x + w, y + oy], [x + W, y + oy]); rows.push(oy); oy += h; }
    for (let i = 1; i < rows.length; i++) { this.wire([x, y + rows[i - 1]], [x, y + rows[i]]); this.wire([x + W, y + rows[i - 1]], [x + W, y + rows[i]]); }
  }
  /** vertical block from (x, y) down to (x, y + h), parallel branches side by side to the right */
  v(t, x, y) {
    if (t.k === 'L') return this.leaf(t, [x, y], [x, y + 1]);
    if (t.k === 'S') { let cy = y; for (const k of t.kids) { this.v(k, x, cy); cy += mV(k).h; } return; }
    const H = mV(t).h, cols = [];
    let ox = 0;
    for (const k of t.kids) { this.v(k, x + ox, y); const { w, h } = mV(k); if (h < H) this.wire([x + ox, y + h], [x + ox, y + H]); cols.push(ox); ox += w; }
    for (let i = 1; i < cols.length; i++) { this.wire([x + cols[i - 1], y], [x + cols[i], y]); this.wire([x + cols[i - 1], y + H], [x + cols[i], y + H]); }
  }
}

/** Break a one-port (top terminal → bottom terminal) into ladder items, from the port leftwards. */
function ladderItems(t, items, columns = false) {
  if (t.k === 'P') {
    // columns: every parallel branch stands on its own (Millman), none runs along the rails
    const cont = columns ? null : t.kids.filter((k) => k.k === 'S').sort((x, y) => size(y) - size(x))[0] || null;
    const shunts = t.kids.filter((k) => k !== cont).sort((x, y) => hasSrc(x) - hasSrc(y)); // resistors next to the load, sources farther out
    for (const k of shunts) items.push({ type: 'shunt', t: k });
    if (cont) ladderItems(cont, items);
  } else if (t.k === 'S') {
    let j = -1, best = -1;
    t.kids.forEach((k, i) => { if (k.k === 'P' && size(k) > best) { best = size(k); j = i; } });
    if (j < 0) for (let i = t.kids.length - 1; i >= 0 && j < 0; i--) if (t.kids[i].k === 'L' && isSrc(t.kids[i].e)) j = i;
    if (j < 0) j = t.kids.length - 1;
    items.push({ type: 'tb', tops: t.kids.slice(0, j), bots: t.kids.slice(j + 1).reverse() });
    ladderItems(t.kids[j], items);
  } else items.push({ type: 'shunt', t });
}

/**
 * Lay out a network as a ladder: the load standing at the right between a (top) and b (bottom),
 * the rest of the network built leftwards along a top and a bottom rail. Returns null when the
 * network is not series-parallel seen from a–b.
 */
export function ladderFigure(fig) {
  const load = fig.elems.find((e) => e.id === fig.load);
  const rest = fig.elems.filter((e) => e !== load);
  const b = new Builder(fig.style);
  const items = [];
  if (rest.length) {
    const sp = spTree(rest, fig.a, fig.b);
    if (!sp.tree) return null;
    ladderItems(sp.tree, items, fig.columns);
  }
  let D = 1;
  for (const it of items) {
    if (it.type === 'shunt') D = Math.max(D, mV(it.t).h);
    else for (const k of it.tops) D = Math.max(D, mH(k).h);
  }
  b.part(load, [0, 0], [0, 1], load.n[0] === fig.a);
  b.wire([0, 1], [0, D]);
  let topX = 0, botX = 0, topBusy = true, botBusy = true;
  for (const it of items) {
    if (it.type === 'shunt') {
      const { w, h } = mV(it.t);
      const x0 = Math.min(topX - (topBusy ? 1 : 0), botX - (botBusy ? 1 : 0)) - w + 1;
      b.v(it.t, x0, 0);
      if (h < D) b.wire([x0, h], [x0, D]);
      b.wire([x0 + w - 1, 0], [topX, 0]);
      b.wire([h === D ? x0 + w - 1 : x0, D], [botX, D]);
      topX = botX = x0; topBusy = botBusy = true;
      continue;
    }
    // series parts along the rails; a block with parallel rows gets a cell of room on each side
    const run = (list, y, x, flip) => {
      for (const k of list) {
        const { w, h } = mH(k), pad = h > 1 ? 1 : 0;
        const right = x - pad, left = right - w;
        b.wire([right, y], [x, y]);
        b.h(flip ? flipTree(k) : k, left, y);
        x = left - pad;
        b.wire([x, y], [left, y]);
      }
      return x;
    };
    if (it.tops.length) { topX = run(it.tops, 0, topX, true); topBusy = false; }
    if (it.bots.length) { botX = run(it.bots, D, botX, false); botBusy = false; }
  }
  const hi = new Set((fig.hi || []).map((id) => b.byId.get(id)).filter(Boolean));
  const A = [0, 0], B = [0, D * C];
  const notes = [{ t: 'term', at: A, other: B, out: [1, 0], text: 'a' }, { t: 'term', at: B, other: A, out: [1, 0], text: 'b' }];
  return { doc: b.doc, hi, notes, load: b.byId.get(fig.load) };
}

// ------------------------------------------------------------------ drawing
const FONT = 'Inter, system-ui, sans-serif';
const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

/**
 * Draw a built figure on a canvas that is already laid out (its CSS width set). The canvas
 * height follows the figure's shape, and the view takes in every label and annotation.
 * Returns the renderer (for hit testing).
 */
export function drawFigure(cv, built, theme, settings, maxH = 320, { fill = false, maxK = 1.2, readable = 0 } = {}) {
  const { doc, hi, notes, load } = built;
  const st = { ...settings, grid: 'none', showValues: true, showNames: true, currentDots: false };
  const r = new Renderer(cv);
  r.fixedLabels = true;
  // readable: labels drawn at least that many pixels high where there is room for them (a
  // whole circuit shown small, as read from a photo); else at their usual size
  const room = readable ? r.labelRoom(doc, st) : 1;
  let lk = 1, base;
  const lay = () => { r.figLk = lk; r.lk = lk; r._sidesSig = null; r.chooseLabelSides({ doc, settings: st }); base = drawingBox(doc, lk); };
  lay();
  const W = cv.clientWidth || 320, pad = 12;
  const ctx = cv.getContext('2d');
  // annotations are sized in pixels, so the box they need depends on the scale: settle it in
  // rounds, until the scale holds
  let box = base, k = 1;
  for (let round = 0; round < 8; round++) {
    const was = k;
    k = Math.min(maxK, (W - 2 * pad) / Math.max(1, box[2] - box[0]), fill ? (maxH - 2 * pad) / Math.max(1, box[3] - box[1]) : Infinity);
    const want = readable ? Math.round(Math.max(1, Math.min(room, readable / (10.5 * k))) * 10) / 10 : 1;
    if (want !== lk) { lk = want; lay(); } else if (round > 1 && Math.abs(k - was) < 0.005 * was) break;
    box = [...base];
    for (const d of layout(notes, k, load, ctx, doc)) {
      if (!d.w) continue;
      const cx = d.at[0] + d.dx / k, cy = d.at[1] + d.dy / k, hw = d.w / 2 / k, hh = d.h / 2 / k;
      box = [Math.min(box[0], cx - hw), Math.min(box[1], cy - hh), Math.max(box[2], cx + hw), Math.max(box[3], cy + hh)];
    }
  }
  // (filling a given height: the whole drawing as big as it fits, as in the zoomed view)
  const H = fill ? Math.round(maxH) : Math.round(Math.max(140, Math.min(maxH, (box[3] - box[1]) * k + 2 * pad)));
  cv.style.height = H + 'px';
  r.resize();
  k = Math.min(maxK, (W - 2 * pad) / Math.max(1, box[2] - box[0]), (H - 2 * pad) / Math.max(1, box[3] - box[1]));
  r.scale = k; r.ox = W / 2 - ((box[0] + box[2]) / 2) * k; r.oy = H / 2 - ((box[1] + box[3]) / 2) * k;
  r.draw({ doc, sim: null, running: false, theme, t: 0, probes: [], settings: st, selection: hi, selWires: new Set(), graph: new WireGraph(doc) });
  paint(r, layout(notes, k, load, r.ctx, doc), theme);
  return r;
}

/** Parts, wires and the parts' labels (name and value, lk times their usual size) in world units. */
function drawingBox(doc, lk = 1) {
  let b = doc.bounds() || [0, 0, 100, 100];
  for (const e of doc.elements) {
    const val = e.shownLabel(), txt = !e.constructor.noName ? e.name + (val ? ' ' + val : '') : val;
    const q = e.labelRect(txt, undefined, lk);
    if (q) b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])];
  }
  return b;
}

/**
 * Where each annotation goes, in pixels from a world anchor: { at, dx, dy, w, h, kind, … }.
 * Around the load: a and b sit just outside its two ends on the outer side; a current arrow
 * runs alongside it on the side its value label does not use; a question goes beside the gap.
 */
function layout(notes, k, load, ctx, doc) {
  const out = [];
  const pill = (at, dx, dy, text, o = {}) => {
    const size = o.size || 11, font = (px) => `${o.bold === false ? 600 : 700} ${px}px ${FONT}`;
    text = sym(text);
    const w = measureRich(ctx, text, size, font) + 10;
    out.push({ kind: 'pill', at, dx: dx + (o.left ? w / 2 : 0), dy, w, h: size + 7, text, ...o });
  };
  // the load's value label points this way from its centre (null when the load is not drawn)
  let lab = null;
  if (load) {
    const [x1, y1, x2, y2] = load.worldBox(), [lx, ly] = load.labelAnchor();
    lab = unit(lx - (x1 + x2) / 2, ly - (y1 + y2) / 2);
  }
  const meshes = [];
  for (const n of notes) {
    if (n.t === 'tag') pill(n.at, 0, 0, n.text, { left: n.left, size: 10, bold: false, muted: true });
    else if (n.t === 'node') {
      // a node's name beside its point, on the side where it covers nothing
      ctx.font = `700 10px ${FONT}`;
      const pw = ctx.measureText(n.text).width + 10, ph = 17, cost = blockers(doc, k, out);
      let bd = [9, -11], bc = Infinity;
      [[9, -11], [-9, -11], [9, 11], [-9, 11], [16, 0], [-16, 0], [0, -16], [0, 16], [20, -20], [-20, -20], [20, 20], [-20, 20]].forEach(([dx, dy], j) => {
        const c = cost(n.at[0] + dx / k, n.at[1] + dy / k, pw / 2 / k, ph / 2 / k) + j * 2 / (k * k);
        if (c < bc) { bc = c; bd = [dx, dy]; }
      });
      pill(n.at, bd[0], bd[1], n.text, { size: 10, fill: '#a855f7', color: '#fff' });
    }
    else if (n.t === 'mesh') meshes.push(n);
    else if (n.t === 'term') {
      const [ux, uy] = unit(n.at[0] - n.other[0], n.at[1] - n.other[1]), [ox, oy] = n.out;
      out.push({ kind: 'ring', at: n.at, dx: 0, dy: 0, w: 12, h: 12 });
      pill(n.at, ux * 10 + ox * 14, uy * 10 + oy * 14, n.text, { size: 12, accent: true });
    } else if (n.t === 'ask') {
      const mid = [(n.from[0] + n.to[0]) / 2, (n.from[1] + n.to[1]) / 2], [ox, oy] = n.out;
      if (n.volt) { // + just inside the gap at a, − at b
        const [ux, uy] = unit(n.to[0] - n.from[0], n.to[1] - n.from[1]);
        out.push({ kind: 'glyph', at: n.from, dx: ux * 13 + ox * 9, dy: uy * 13 + oy * 9, w: 12, h: 16, text: '+' });
        out.push({ kind: 'glyph', at: n.to, dx: -ux * 13 + ox * 9, dy: -uy * 13 + oy * 9, w: 12, h: 16, text: '−' });
      }
      // out beside the gap where it covers no label, part or wire: a little further out or
      // shifted along first, the inner side of the gap when the outer side is crowded
      const pw = measureRich(ctx, sym(n.text), 12, (px) => `700 ${px}px ${FONT}`) + 10, ph = 19, cost = blockers(doc, k, out);
      let bd = [ox * 44, oy * 44], bc = Infinity;
      for (const dist of [44, 58, 72, 30, -44, -58]) for (const side of [0, 1, -1, 2, -2]) {
        const dx = ox * dist - oy * side * 34, dy = oy * dist + ox * side * 34;
        const c = cost(mid[0] + dx / k, mid[1] + dy / k, pw / 2 / k, ph / 2 / k) + (side * side + Math.abs(Math.abs(dist) - 44) / 14 + (dist < 0 ? 2 : 0)) * 4 / (k * k);
        if (c < bc) { bc = c; bd = [dx, dy]; }
      }
      pill(mid, bd[0], bd[1], n.text, { size: 12, fill: n.volt ? '#f59e0b' : '#ec4899', color: '#fff' });
    } else if (n.t === 'short') out.push({ kind: 'line', at: n.from, to: n.to, dx: 0, dy: 0 });
    else if (n.t === 'flow') {
      const mid = [(n.from[0] + n.to[0]) / 2, (n.from[1] + n.to[1]) / 2];
      let [sx, sy] = [-n.out[0], -n.out[1]]; // inside the circuit, unless the load's label is there
      if (lab && lab[0] * sx + lab[1] * sy > 0.5) { sx = -sx; sy = -sy; }
      const [ux, uy] = unit(n.to[0] - n.from[0], n.to[1] - n.from[1]);
      out.push({ kind: 'arrow', at: mid, dx: sx * 14, dy: sy * 14, ux, uy, w: 30, h: 30 });
      pill(mid, sx * 14 + (Math.abs(ux) > Math.abs(uy) ? 0 : sx * 18), sy * 14 + (Math.abs(ux) > Math.abs(uy) ? sy * 16 : 0), n.text, { fill: '#f59e0b', color: '#1c1300' });
    }
  }
  if (meshes.length) placeMeshes(meshes, out, k, doc);
  return out;
}

/**
 * A mesh current's loop goes where it covers the least: somewhere inside its window, clear of
 * the parts, their name/value labels, the wires and the other annotations (world units).
 */
function placeMeshes(meshes, out, k, doc) {
  const S = 28, half = S / 2 / k, F = [0.5, 0.38, 0.62, 0.28, 0.72, 0.2, 0.8];
  for (const n of meshes) {
    const cost = blockers(doc, k, out); // includes the loops already placed
    let best = n.at, bc = Infinity;
    const [x1, y1, x2, y2] = n.box || [n.at[0], n.at[1], n.at[0], n.at[1]];
    for (const fx of F) for (const fy of F) {
      const x = x1 + (x2 - x1) * fx, y = y1 + (y2 - y1) * fy;
      const c = cost(x, y, half, half) + Math.hypot(x - n.at[0], y - n.at[1]) * 0.02 / k; // nearer the middle when it is a tie
      if (c < bc) { bc = c; best = [x, y]; }
    }
    out.push({ kind: 'loop', at: best, dx: 0, dy: 0, w: S, h: S, text: n.text });
  }
}

/**
 * How much a box (centre x, y, half sizes hw, hh, world units) would cover of what is drawn:
 * parts, their name/value labels (weighted most), wires and the annotations placed so far.
 */
function blockers(doc, k, out) {
  const obs = [];
  const add = (r, wgt) => obs.push([...r, wgt]);
  if (doc) {
    for (const e of doc.elements) {
      add(e.worldBox(), 2);
      const val = e.shownLabel(), txt = !e.constructor.noName ? e.name + (val ? ' ' + val : '') : val;
      const q = e.labelRect(txt);
      if (q) add([q[0] - 2, q[1] - 2, q[2] + 2, q[3] + 2], 4);
    }
    for (const w of doc.wires) for (let i = 1; i < w.pts.length; i++) {
      const [a, b] = [w.pts[i - 1], w.pts[i]], t = 3 / k;
      add([Math.min(a[0], b[0]) - t, Math.min(a[1], b[1]) - t, Math.max(a[0], b[0]) + t, Math.max(a[1], b[1]) + t], 1);
    }
  }
  for (const d of out) if (d.w) add([d.at[0] + (d.dx - d.w / 2) / k, d.at[1] + (d.dy - d.h / 2) / k, d.at[0] + (d.dx + d.w / 2) / k, d.at[1] + (d.dy + d.h / 2) / k], 4);
  return (x, y, hw, hh) => {
    let c = 0;
    for (const [x1, y1, x2, y2, wgt] of obs) {
      const w = Math.min(x + hw, x2) - Math.max(x - hw, x1), h = Math.min(y + hh, y2) - Math.max(y - hh, y1);
      if (w > 0 && h > 0) c += w * h * wgt;
    }
    return c;
  };
}

function paint(r, items, th) {
  const ctx = r.ctx;
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  const accent = th.accent || '#22d3ee';
  for (const d of items) {
    const [ax, ay] = r.toScreen(d.at[0], d.at[1]), x = ax + d.dx, y = ay + d.dy;
    if (d.kind === 'pill') {
      ctx.font = `${d.bold === false ? 600 : 700} ${d.size || 11}px ${FONT}`;
      ctx.fillStyle = d.accent ? accent : d.muted ? th.bg : d.fill;
      roundRect(ctx, x - d.w / 2, y - d.h / 2, d.w, d.h, d.h / 2); ctx.fill();
      ctx.fillStyle = d.accent ? '#04121a' : d.muted ? th.muted || '#94a3b8' : d.color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      fillRich(ctx, d.text, x, y + 0.5, d.size || 11, (px) => `${d.bold === false ? 600 : 700} ${px}px ${FONT}`);
    } else if (d.kind === 'ring') {
      ctx.fillStyle = th.bg; ctx.strokeStyle = accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (d.kind === 'glyph') {
      ctx.font = `800 16px ${FONT}`; ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.text, x, y);
    } else if (d.kind === 'line') {
      const [bx, by] = r.toScreen(d.to[0], d.to[1]);
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bx, by); ctx.stroke();
    } else if (d.kind === 'loop') { // a clockwise mesh current: an open circle with an arrowhead, its name inside
      const R = 10.5, col = '#22c55e', a0 = -Math.PI * 0.35, a1 = a0 + Math.PI * 1.6;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, R, a0, a1); ctx.stroke();
      const hx = x + R * Math.cos(a1), hy = y + R * Math.sin(a1), tx = -Math.sin(a1), ty = Math.cos(a1); // clockwise tangent
      ctx.beginPath(); ctx.moveTo(hx + tx * 5, hy + ty * 5); ctx.lineTo(hx - tx * 2 - ty * 4, hy - ty * 2 + tx * 4); ctx.lineTo(hx - tx * 2 + ty * 4, hy - ty * 2 - tx * 4); ctx.closePath(); ctx.fill();
      ctx.font = `italic 700 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.text.replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[c]), x, y + 0.5);
    } else if (d.kind === 'arrow') {
      const L = 13, col = '#f59e0b';
      const x0 = x - d.ux * L, y0 = y - d.uy * L, x1 = x + d.ux * L, y1 = y + d.uy * L;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - d.ux * 6, y1 - d.uy * 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - d.ux * 9 - d.uy * 5, y1 - d.uy * 9 + d.ux * 5); ctx.lineTo(x1 - d.ux * 9 + d.uy * 5, y1 - d.uy * 9 - d.ux * 5); ctx.closePath(); ctx.fill();
    }
  }
}

/** ctx.roundRect is missing in older Android WebViews */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ------------------------------------------------------------------ AC equivalents
/**
 * The equivalent an AC theorem ends with, in the phasor domain: V_th in series with Z_th (or I_N
 * in parallel with Z_N) and the load, a copy of the user's part.
 */
export function acEquivalentFigure(fig, src) {
  const doc = new CircuitDoc('equivalent');
  doc.domain = 'phasor'; doc.forceOmega = fig.w || 0;
  const w = fig.w || 0, mag = Math.hypot(fig.src[0], fig.src[1]), ph = (Math.atan2(fig.src[1], fig.src[0]) * 180) / Math.PI;
  const source = (kindV) => {
    const t = w > 0 ? (kindV ? 'acv' : 'aci') : (kindV ? 'dcv' : 'dci');
    const e = new (getType(t))(0, 80);
    if (w > 0) Object.assign(e.p, { wave: 'cos', amp: mag, phase: ph, freq: w / (2 * Math.PI) });
    else e.p.amp = fig.src[0];
    e.onParamChange?.();
    return e;
  };
  const zEl = (x, y, rot) => {
    const e = new (getType('resistor'))(x, y);
    e.rot = rot; e.p.style = 'box';
    const z = fig.z, re = Math.abs(z[0]) < 1e-9 ? 0 : z[0], im = Math.abs(z[1]) < 1e-9 ? 0 : z[1];
    const n = (v) => +v.toPrecision(4);
    e.zText = `${re || !im ? n(re) : ''}${im ? `${re ? (im < 0 ? ' − ' : ' + ') : im < 0 ? '−' : ''}j${n(Math.abs(im))}` : ''} Ω`;
    return e;
  };
  const s0 = source(!fig.norton);
  s0.rot = fig.norton ? 3 : 1; // + (or the arrow) at the top
  s0.name = sym(fig.srcName === 'IN' ? 'IN' : 'Vth'); s0.richName = true;
  doc.elements.push(s0);
  const o = src.elements[fig.load];
  const load = new (getType(o.constructor.type))(160, 80);
  Object.assign(load.p, o.p); load.rot = 1; load.name = fig.loadName; load.onParamChange?.();
  if (fig.norton) {
    const z = zEl(80, 80, 1); z.name = sym('ZN'); z.richName = true;
    doc.elements.push(z, load);
    doc.addWire([[0, 40], [160, 40]]); doc.addWire([[0, 120], [160, 120]]);
  } else {
    const z = zEl(80, 40, 0); z.name = sym('Zth'); z.richName = true;
    doc.elements.push(z, load);
    doc.addWire([[0, 40], [40, 40]]); doc.addWire([[120, 40], [160, 40]]); doc.addWire([[0, 120], [160, 120]]);
  }
  const notes = [{ t: 'term', at: [160, 40], other: [160, 120], out: [1, 0], text: 'a' }, { t: 'term', at: [160, 120], other: [160, 40], out: [1, 0], text: 'b' }];
  return { doc, hi: new Set([load]), notes, load };
}
