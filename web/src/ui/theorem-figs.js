// Circuits drawn for the theorem steps. A "board" figure is the user's own drawing, changed for
// the step (load taken out, sources turned off, a–b shorted, nodes named); a "ladder" figure is a
// network redrawn as a ladder with the load on the right (final equivalents, source
// transformation stages). Both are drawn by the board's own renderer, then annotated.

import { spTree, flipTree } from '../engine/theorem.js';
import { getType, GRID } from '../elements/index.js';
import { CircuitDoc } from './doc.js';
import { Renderer, WireGraph } from './render.js';

const C = 6 * GRID; // one ladder cell: an 80-unit part with a short lead at each end

// ------------------------------------------------------------------ board figures
/** The user's circuit as the step sees it. Returns { doc, hi, notes } (notes: annotations in world coordinates). */
export function boardFigure(src, fig, net) {
  const doc = CircuitDoc.fromJSON(JSON.parse(JSON.stringify(src.toJSON())));
  const els = [...doc.elements];
  const posts = net.posts;
  const T = net.elems.find((e) => e.src === fig.target && e.kind === 'R' && !e.internal);
  const notes = [];
  const gone = new Set([...(fig.hide || []), ...(fig.wire || []), ...(fig.ground || []), ...(fig.open || [])]);
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
  doc.elements = doc.elements.filter((e, i) => !(i < els.length && gone.has(i)));
  const [pa, pb] = T.n[0] === fig.a ? [posts[T.src][0], posts[T.src][1]] : [posts[T.src][1], posts[T.src][0]];
  if (fig.shortAB) { doc.addWire([pa, pb]); notes.push({ t: 'short', from: pa, to: pb }); }
  const hi = new Set([...(fig.highlight || []), ...(fig.keep != null ? [fig.keep] : [])].map((i) => els[i]).filter((e) => doc.elements.includes(e)));
  if (fig.ab) notes.push({ t: 'term', at: pa, text: 'a', away: pb }, { t: 'term', at: pb, text: 'b', away: pa });
  // the question sits beside the a–b gap, on the side away from the rest of the circuit
  const mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  const bb = doc.bounds() || [mid[0], mid[1], mid[0], mid[1]];
  let nx = -(pb[1] - pa[1]), ny = pb[0] - pa[0];
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl; ny /= nl;
  if (nx * (mid[0] - (bb[0] + bb[2]) / 2) + ny * (mid[1] - (bb[1] + bb[3]) / 2) < 0) { nx = -nx; ny = -ny; }
  const side = [mid[0] + nx * 62, mid[1] + ny * 62];
  if (fig.show === 'Rth' || fig.show === 'RN') notes.push({ t: 'ask', at: side, text: `${fig.show === 'Rth' ? 'Rth' : 'RN'} = ?`, from: pa, to: pb });
  if (fig.show === 'Vth') notes.push({ t: 'ask', at: side, text: 'Vth = ?', from: pa, to: pb, volt: [nx, ny] });
  if (fig.show === 'IN') notes.push({ t: 'flow', from: pa, to: pb, text: 'IN' });
  if (fig.arrow) notes.push({ t: 'flow', from: pa, to: pb, text: 'IL', side: true });
  for (const tg of fig.tags || []) if (net.nodePos.has(tg.node)) notes.push({ t: 'node', at: net.nodePos.get(tg.node), text: tg.text });
  return { doc, hi, notes };
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
    el.name = e.name;
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
function ladderItems(t, items) {
  if (t.k === 'P') {
    const cont = t.kids.filter((k) => k.k === 'S').sort((x, y) => size(y) - size(x))[0] || null;
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
    ladderItems(sp.tree, items);
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
  const notes = [
    { t: 'term', at: [0, 0], text: 'a', away: [-C, 0], right: true },
    { t: 'term', at: [0, D * C], text: 'b', away: [-C, D * C], right: true },
  ];
  return { doc: b.doc, hi, notes };
}

// ------------------------------------------------------------------ drawing
/**
 * Draw a built figure on a canvas that is already laid out (its CSS width set). The canvas
 * height follows the figure's shape. Returns the renderer (for hit testing).
 */
export function drawFigure(cv, built, theme, settings, maxH = 320) {
  const { doc, hi, notes } = built;
  let [x1, y1, x2, y2] = doc.bounds() || [0, 0, 100, 100];
  for (const n of notes) {
    const p = n.at || n.from;
    if (!p) continue;
    x1 = Math.min(x1, p[0] - 30); y1 = Math.min(y1, p[1] - 22); x2 = Math.max(x2, p[0] + (n.left ? 80 : 30)); y2 = Math.max(y2, p[1] + 22);
  }
  x1 -= 16; x2 += 30; // labels carry the part's name too, so they run wider than doc.bounds() allows for
  const W = cv.clientWidth || 320, pad = 18;
  const k0 = Math.min(1.2, (W - 2 * pad) / Math.max(1, x2 - x1));
  const H = Math.round(Math.max(150, Math.min(maxH, (y2 - y1) * k0 + 2 * pad)));
  cv.style.height = H + 'px';
  const r = new Renderer(cv);
  r.resize();
  const k = Math.min(1.2, (W - 2 * pad) / Math.max(1, x2 - x1), (H - 2 * pad) / Math.max(1, y2 - y1));
  r.scale = k; r.ox = W / 2 - ((x1 + x2) / 2) * k; r.oy = H / 2 - ((y1 + y2) / 2) * k;
  r.draw({
    doc, sim: null, running: false, theme, t: 0, probes: [],
    settings: { ...settings, grid: 'none', showValues: true, showNames: true, currentDots: false },
    selection: hi, selWires: new Set(), graph: new WireGraph(doc),
  });
  annotate(r, notes, theme);
  return r;
}

function annotate(r, notes, th) {
  const ctx = r.ctx;
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  const S = (p) => r.toScreen(p[0], p[1]);
  const pill = (x, y, text, { fill, color, size = 11, bold = true, left = false } = {}) => {
    ctx.font = `${bold ? 700 : 600} ${size}px Inter, system-ui, sans-serif`;
    const w = ctx.measureText(text).width + 10, h = size + 7;
    if (left) x += w / 2;
    ctx.fillStyle = fill; roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5);
  };
  const arrow = (ax, ay, bx, by, col) => {
    const L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx - ux * 6, by - uy * 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - ux * 9 - uy * 5, by - uy * 9 + ux * 5); ctx.lineTo(bx - ux * 9 + uy * 5, by - uy * 9 - ux * 5); ctx.closePath(); ctx.fill();
  };
  const accent = th.accent || '#22d3ee';
  for (const n of notes) {
    if (n.t === 'tag') { const [x, y] = S(n.at); pill(x, y, n.text, { fill: th.bg, color: th.muted || '#94a3b8', size: 10, bold: false, left: n.left }); }
    else if (n.t === 'node') { const [x, y] = S(n.at); pill(x + 9, y - 11, n.text, { fill: '#a855f7', color: '#fff', size: 10 }); }
    else if (n.t === 'term') {
      const [x, y] = S(n.at), [ax, ay] = S(n.away);
      // the label sits on the side away from the other terminal (or to the right of a ladder's load)
      let dx = x - ax, dy = y - ay;
      const L = Math.hypot(dx, dy) || 1;
      dx /= L; dy /= L;
      const [ox, oy] = n.right ? [16, 0] : [dx * 15, dy * 15];
      ctx.fillStyle = th.bg; ctx.strokeStyle = accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      pill(x + ox, y + oy, n.text, { fill: accent, color: '#04121a', size: 12 });
    } else if (n.t === 'ask') {
      const [x, y] = S(n.at);
      pill(x, y, n.text, { fill: n.volt ? '#f59e0b' : '#ec4899', color: '#fff', size: 12 });
      if (n.volt) { // + beside a, − beside b, on the question's side
        const [ax, ay] = S(n.from), [bx, by] = S(n.to), [ox, oy] = n.volt;
        ctx.font = '800 16px Inter, system-ui, sans-serif'; ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', ax + ox * 18, ay + oy * 18);
        ctx.fillText('−', bx + ox * 18, by + oy * 18);
      }
    } else if (n.t === 'short') {
      const [ax, ay] = S(n.from), [bx, by] = S(n.to);
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    } else if (n.t === 'flow') {
      const [ax, ay] = S(n.from), [bx, by] = S(n.to);
      let px = -(by - ay), py = bx - ax;
      const L = Math.hypot(px, py) || 1;
      px = (px / L) * 16; py = (py / L) * 16;
      const mx = (ax + bx) / 2 + px, my = (ay + by) / 2 + py, ux = (bx - ax) / (Math.hypot(bx - ax, by - ay) || 1), uy = (by - ay) / (Math.hypot(bx - ax, by - ay) || 1);
      arrow(mx - ux * 14, my - uy * 14, mx + ux * 14, my + uy * 14, '#f59e0b');
      pill(mx + px * 1.3, my + py * 1.3, n.text, { fill: '#f59e0b', color: '#1c1300', size: 11 });
    }
  }
}

/** ctx.roundRect is missing in older Android WebViews */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
