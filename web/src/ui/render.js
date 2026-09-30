// Canvas renderer: grid, wires, components, animated current, overlays.

import { GRID } from '../elements/index.js';
import { fmtShort, fmtSI } from '../engine/units.js';

const key = (x, y) => Math.round(x) + ',' + Math.round(y);

// Pre-rendered glow sprites: radial gradients and shadowBlur are very slow on
// mobile GPUs, so every glow is a cached bitmap drawn with drawImage.
const SPRITES = new Map();
function glowSprite(rgb) {
  let c = SPRITES.get(rgb);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.45, `rgba(${rgb},0.35)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  SPRITES.set(rgb, c);
  return c;
}
function dotSprite(color) {
  const k = 'dot' + color;
  let c = SPRITES.get(k);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.28, color);
  gr.addColorStop(0.5, color + '88');
  gr.addColorStop(1, color + '00');
  x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  SPRITES.set(k, c);
  return c;
}
export const MAX_DPR = 2;

// -------------------------------------------------------------- wire graph
/** Graph of wire sub-segments used for current animation (KCL on each node's wire tree). */
export class WireGraph {
  constructor(doc) {
    this.edges = [];
    const pointsOf = [];
    for (const e of doc.elements) for (const p of e.getPosts()) pointsOf.push(p);
    for (const w of doc.wires) for (const p of w.pts) pointsOf.push(p);
    const uniq = new Map();
    for (const p of pointsOf) uniq.set(key(p[0], p[1]), p);
    const pts = [...uniq.values()];
    for (const w of doc.wires) {
      for (let s = 1; s < w.pts.length; s++) {
        const a = w.pts[s - 1], b = w.pts[s];
        const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
        const inner = [];
        for (const p of pts) {
          const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
          if (t <= 1e-9 || t >= 1 - 1e-9) continue;
          const cx = a[0] + t * dx - p[0], cy = a[1] + t * dy - p[1];
          if (cx * cx + cy * cy < 0.25) inner.push([t, p]);
        }
        inner.sort((u, v) => u[0] - v[0]);
        const chain = [a, ...inner.map((q) => q[1]), b];
        for (let i = 1; i < chain.length; i++) {
          this.edges.push({ a: chain[i - 1], b: chain[i], ka: key(chain[i - 1][0], chain[i - 1][1]), kb: key(chain[i][0], chain[i][1]), i: 0, phase: 0, wire: w });
        }
      }
    }
    // adjacency + spanning forest
    this.adj = new Map();
    this.edges.forEach((ed, idx) => {
      if (!this.adj.has(ed.ka)) this.adj.set(ed.ka, []);
      if (!this.adj.has(ed.kb)) this.adj.set(ed.kb, []);
      this.adj.get(ed.ka).push(idx); this.adj.get(ed.kb).push(idx);
    });
    this.order = []; // [vertexKey, parentEdgeIdx, parentKey]
    const seen = new Set();
    for (const start of this.adj.keys()) {
      if (seen.has(start)) continue;
      seen.add(start);
      const q = [start];
      this.order.push([start, -1, null]);
      while (q.length) {
        const v = q.shift();
        for (const ei of this.adj.get(v)) {
          const ed = this.edges[ei];
          const u = ed.ka === v ? ed.kb : ed.ka;
          if (seen.has(u)) continue;
          seen.add(u);
          this.order.push([u, ei, v]);
          q.push(u);
        }
      }
    }
    // junction dots: vertices with ≥3 connections (edges + posts)
    const deg = new Map();
    for (const ed of this.edges) { deg.set(ed.ka, (deg.get(ed.ka) || 0) + 1); deg.set(ed.kb, (deg.get(ed.kb) || 0) + 1); }
    for (const e of doc.elements) for (const p of e.getPosts()) { const k = key(p[0], p[1]); deg.set(k, (deg.get(k) || 0) + 1); }
    this.junctions = [];
    for (const [k, d] of deg) if (d >= 3) this.junctions.push(uniq.get(k));
    this.degree = deg;
  }

  /** compute edge currents from element terminal currents */
  solveCurrents(doc) {
    const inj = new Map();
    for (const e of doc.elements) {
      const posts = e._posts || e.getPosts();
      posts.forEach((p, i) => {
        const k = key(p[0], p[1]);
        inj.set(k, (inj.get(k) || 0) - (e.postCurrents[i] || 0));
      });
    }
    for (const ed of this.edges) ed.i = 0;
    const sub = new Map();
    for (let n = this.order.length - 1; n >= 0; n--) {
      const [v, pe] = this.order[n];
      const total = (inj.get(v) || 0) + (sub.get(v) || 0);
      if (pe < 0) continue;
      const ed = this.edges[pe];
      // current flows from child v to parent: total injection must leave via parent edge
      ed.i = ed.ka === v ? total : -total;
      const parent = this.order[n][2];
      sub.set(parent, (sub.get(parent) || 0) + total);
    }
  }
}

// ---------------------------------------------------------- graphics helper
export function makeGraphics(ctx, theme, opts) {
  const vcCache = new Map();
  const g = {
    ctx, theme,
    body: theme.body, fill: theme.fill, accent: theme.accent, muted: theme.muted, text1: theme.text1, text2: theme.text2,
    pos: theme.pos, neg: theme.neg, bg: theme.bg, hi: theme.hi, lo: theme.lo, hiFill: theme.hiFill, loFill: theme.loFill, hiRGB: theme.hiRGB,
    lw: 2.2, running: false, t: 0, vScale: 5, iScale: 0.01, showCharge: true, voltColors: true,
    rot: 0, flip: false,
    pv: () => 0,
    vc(v) {
      if (!g.voltColors || !g.running) return theme.body;
      let t = v / g.vScale;
      t = t > 1 ? 1 : t < -1 ? -1 : t;
      const q = Math.round(t * 24);
      let c = vcCache.get(q);
      if (!c) {
        const k = Math.abs(q) / 24, to = q >= 0 ? theme.posRGB : theme.negRGB, n = theme.neutral;
        c = `rgb(${Math.round(n[0] + (to[0] - n[0]) * k)},${Math.round(n[1] + (to[1] - n[1]) * k)},${Math.round(n[2] + (to[2] - n[2]) * k)})`;
        vcCache.set(q, c);
      }
      return c;
    },
    grad(x1, y1, x2, y2, v1, v2) {
      const c1 = g.vc(v1), c2 = g.vc(v2);
      if (c1 === c2) return c1;
      const gr = ctx.createLinearGradient(x1, y1, x2, y2);
      gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      return gr;
    },
    line(x1, y1, x2, y2, color = theme.body, width = g.lw) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
    },
    poly(pts, o = {}) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (o.close) ctx.closePath();
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) {
        ctx.strokeStyle = o.stroke; ctx.lineWidth = o.width || g.lw;
        ctx.lineJoin = o.join || 'round'; ctx.lineCap = 'round';
        if (o.dash) ctx.setLineDash(o.dash);
        ctx.stroke();
        if (o.dash) ctx.setLineDash([]);
      }
    },
    circle(x, y, r, o = {}) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.width || g.lw; ctx.stroke(); }
    },
    box(x1, y1, x2, y2, o = {}) {
      const r = o.r ?? 0;
      ctx.beginPath();
      if (r > 0 && ctx.roundRect) ctx.roundRect(x1, y1, x2 - x1, y2 - y1, r); else ctx.rect(x1, y1, x2 - x1, y2 - y1);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.width || g.lw; ctx.stroke(); }
    },
    /** run fn in an upright (unrotated, unmirrored) frame centred on the part */
    upright(fn, cx = 0, cy = 0) {
      const r = g.rot, f = g.flip;
      ctx.save();
      ctx.translate(cx, cy);
      if (f) ctx.scale(1, -1);
      if (r) ctx.rotate((-r * Math.PI) / 2);
      g.rot = 0; g.flip = false;
      try { fn(); } finally { ctx.restore(); g.rot = r; g.flip = f; }
    },
    /** upright text at local (lx, ly), anchored so it extends away from the part in that direction */
    textSide(str, lx, ly, o = {}) {
      let x = lx, y = g.flip ? -ly : ly;
      [x, y] = [[x, y], [-y, x], [-x, -y], [y, -x]][g.rot & 3];
      let align = 'center', baseline = 'middle';
      if (Math.abs(x) > Math.abs(y)) align = x > 0 ? 'left' : 'right';
      else baseline = y < 0 ? 'alphabetic' : 'top';
      g.text(str, lx, ly, { ...o, align, baseline, follow: false });
    },
    glow(x, y, r, rgb, a) {
      if (a <= 0.01) return;
      const ga = ctx.globalAlpha;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(glowSprite(rgb), x - r, y - r, 2 * r, 2 * r);
      ctx.globalAlpha = ga;
    },
    text(str, x, y, o = {}) {
      ctx.save();
      ctx.translate(x, y);
      if (g.flip) ctx.scale(1, -1);
      let align = o.align || 'center';
      const follow = o.follow ?? (align !== 'center');
      if (!follow) {
        if (g.rot) ctx.rotate((-g.rot * Math.PI) / 2);
      } else if (g.rot === 1 || g.rot === 2) {
        // keep pin labels readable: rotate a half turn instead of reading upside down
        ctx.rotate(Math.PI);
        align = align === 'left' ? 'right' : align === 'right' ? 'left' : align;
      }
      ctx.font = `${o.bold ? '600 ' : ''}${o.size || 10}px ${o.mono ? 'JetBrains Mono, ui-monospace, monospace' : 'Inter, system-ui, sans-serif'}`;
      ctx.fillStyle = o.color || theme.text1;
      ctx.textAlign = align;
      ctx.textBaseline = o.baseline || 'middle';
      if (o.maxW) ctx.fillText(str, 0, 0, o.maxW); else ctx.fillText(str, 0, 0);
      ctx.restore();
    },
  };
  Object.assign(g, opts);
  return g;
}

// ---------------------------------------------------------------- renderer
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1.4; this.ox = 0; this.oy = 0;
    this.dpr = 1;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr || MAX_DPR);
    this.cw = r.width; this.ch = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
  }

  toWorld(sx, sy) { return [(sx - this.ox) / this.scale, (sy - this.oy) / this.scale]; }
  toScreen(wx, wy) { return [wx * this.scale + this.ox, wy * this.scale + this.oy]; }

  zoomAt(sx, sy, factor) {
    const ns = Math.min(6, Math.max(0.15, this.scale * factor));
    const [wx, wy] = this.toWorld(sx, sy);
    this.scale = ns;
    this.ox = sx - wx * ns; this.oy = sy - wy * ns;
  }

  fit(bounds, pad = 60, topInset = 0, bottomInset = 0) {
    if (!bounds) { this.scale = 1.8; this.ox = this.cw / 2; this.oy = (this.ch + topInset - bottomInset) / 2; return; }
    const [x1, y1, x2, y2] = bounds;
    const w = x2 - x1 + pad * 2, h = y2 - y1 + pad * 2;
    const avail = this.ch - topInset - bottomInset;
    this.scale = Math.min(3, Math.max(0.2, Math.min(this.cw / w, avail / h)));
    this.ox = this.cw / 2 - ((x1 + x2) / 2) * this.scale;
    this.oy = topInset + avail / 2 - ((y1 + y2) / 2) * this.scale;
  }

  /**
   * st: { doc, sim, running, theme, settings, selection:Set, selWires:Set, graph, t, preview, probes, hoverPost,
   *       marquee, meterProbes, errorEl }
   */
  draw(st) {
    const { ctx, dpr } = this;
    const th = st.theme;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, this.cw, this.ch);
    if (st.settings.grid !== 'none') this.drawGrid(th, st.settings.grid);
    ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * this.ox, dpr * this.oy);

    const sim = st.sim;
    const running = !!st.running && sim && sim.ready;
    const nodeV = (n) => (running ? sim.nodeVoltage(n) : 0);
    const g = makeGraphics(ctx, th, {
      running, t: st.t, vScale: st.vScale || 5, iScale: st.iScale || 0.01,
      voltColors: st.settings.voltColors !== false, showCharge: st.settings.showCharge !== false,
      lw: Math.max(2.2, 1.3 / this.scale),
    });
    this.g = g;

    // wires
    const wireW = Math.max(2.4, 1.4 / this.scale);
    const vs = st.sim && st.sim.wireNodes && st.sim.wireNodes.length === st.doc.wires.length ? st.sim.wireNodes : null;
    st.doc.wires.forEach((w, i) => {
      const sel = st.selWires && st.selWires.has(w);
      const col = vs ? g.vc(nodeV(vs[i])) : th.body;
      ctx.beginPath();
      w.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (sel) { ctx.strokeStyle = th.select; ctx.globalAlpha = 0.35; ctx.lineWidth = wireW * 4; ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = col; ctx.lineWidth = wireW; ctx.stroke();
    });

    // elements
    for (const e of st.doc.elements) {
      const nodes = e.nodes || [];
      g.pv = (i) => (running && nodes[i] !== undefined ? nodeV(nodes[i]) : 0);
      const sel = st.selection && st.selection.has(e);
      const err = st.errorEl === e;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(((e.rot & 3) * Math.PI) / 2);
      if (e.flip) ctx.scale(1, -1);
      g.rot = e.rot & 3; g.flip = e.flip;
      if (sel || err) {
        const [a, b, c, d] = e.localBox();
        g.box(a - 5, b - 5, c + 5, d + 5, { fill: err ? 'rgba(248,113,113,0.12)' : 'rgba(34,211,238,0.08)', stroke: err ? '#f87171' : th.select, width: 1.2, r: 6 });
      }
      for (const [pi, x1, y1, x2, y2] of e.leads()) g.line(x1, y1, x2, y2, g.vc(g.pv(pi)), g.lw);
      e.draw(g);
      ctx.restore();
      g.rot = 0; g.flip = false;
    }

    // current dots
    if (running && st.settings.currentDots !== false) this.drawDots(st, g);

    // posts & junctions
    const r = Math.max(2.6, 2.2 / this.scale);
    for (const e of st.doc.elements) {
      for (const [x, y] of e._posts || e.getPosts()) {
        const d = st.graph ? st.graph.degree.get(key(x, y)) || 0 : 0;
        if (d <= 1) g.circle(x, y, r * 1.15, { fill: th.bg, stroke: th.muted, width: 1.3 });
      }
    }
    if (st.graph) {
      for (const p of st.graph.junctions) g.circle(p[0], p[1], Math.max(3, wireW * 1.25), { fill: th.junction });
      // dangling wire ends
      for (const w of st.doc.wires) for (const p of [w.a, w.b]) {
        if ((st.graph.degree.get(key(p[0], p[1])) || 0) <= 1) g.circle(p[0], p[1], r, { fill: th.bg, stroke: th.accent, width: 1.3 });
      }
    }

    // labels
    if (st.settings.showValues !== false) {
      this.drawLabels(st, g);
      if (running) this.drawLive(st, sim);
    }

    // probes
    for (const pr of st.probes || []) this.drawProbe(pr, g, st);

    // meter probes
    if (st.meterProbes) {
      for (const [p, col] of [[st.meterProbes.red, '#ef4444'], [st.meterProbes.black, '#e5e7eb']]) {
        if (!p) continue;
        this.drawPin(p[0], p[1], col, g);
      }
    }

    // previews
    if (st.preview) {
      ctx.setLineDash([6, 5]);
      g.poly(st.preview, { stroke: th.accent, width: wireW });
      ctx.setLineDash([]);
      const e = st.preview[st.preview.length - 1];
      g.circle(e[0], e[1], r * 1.6, { fill: th.accent });
    }
    if (st.hoverPost) g.circle(st.hoverPost[0], st.hoverPost[1], 9 / this.scale + 3, { stroke: th.accent, width: 1.5 });

    // marquee
    if (st.marquee) {
      const [x1, y1, x2, y2] = st.marquee;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgba(34,211,238,0.08)'; ctx.strokeStyle = th.accent; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
      ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.setLineDash([]);
    }
  }

  drawGrid(th, style) {
    const { ctx } = this;
    const step = GRID * this.scale;
    if (step < 5) return;
    const x0 = ((this.ox % step) + step) % step, y0 = ((this.oy % step) + step) % step;
    const majorEvery = 5;
    const ix0 = Math.round((x0 - this.ox) / step), iy0 = Math.round((y0 - this.oy) / step);
    if (style === 'dots') {
      ctx.fillStyle = th.gridMajor;
      const s = Math.max(1, Math.min(2, step / 14));
      for (let x = x0, i = ix0; x < this.cw; x += step, i++) {
        for (let y = y0, j = iy0; y < this.ch; y += step, j++) {
          const major = i % majorEvery === 0 && j % majorEvery === 0;
          ctx.globalAlpha = major ? 1 : 0.55;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
      return;
    }
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0, i = ix0; x < this.cw; x += step, i++) if (i % majorEvery) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, this.ch); }
    for (let y = y0, j = iy0; y < this.ch; y += step, j++) if (j % majorEvery) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(this.cw, Math.round(y) + 0.5); }
    ctx.strokeStyle = th.grid; ctx.stroke();
    ctx.beginPath();
    for (let x = x0, i = ix0; x < this.cw; x += step, i++) if (!(i % majorEvery)) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, this.ch); }
    for (let y = y0, j = iy0; y < this.ch; y += step, j++) if (!(j % majorEvery)) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(this.cw, Math.round(y) + 0.5); }
    ctx.strokeStyle = th.gridMajor; ctx.stroke();
  }

  drawDots(st, g) {
    const ctx = this.ctx, th = st.theme;
    const spacing = 16;
    const rr = Math.max(1.8, 1.6 / this.scale);
    const spr = dotSprite(th.dot), d = rr * 4.2, h = d / 2;
    const dotsAlong = (ax, ay, bx, by, phase) => {
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      if (len < 1) return;
      const ux = dx / len, uy = dy / len;
      let s = ((phase % spacing) + spacing) % spacing;
      for (; s < len; s += spacing) ctx.drawImage(spr, ax + ux * s - h, ay + uy * s - h, d, d);
    };
    if (st.graph) for (const ed of st.graph.edges) if (Math.abs(ed.i) > st.iMin) dotsAlong(ed.a[0], ed.a[1], ed.b[0], ed.b[1], ed.phase);
    for (const e of st.doc.elements) {
      e.leads().forEach(([pi, x1, y1, x2, y2], li) => {
        const cur = e.postCurrents[pi] || 0;
        if (Math.abs(cur) <= st.iMin) return;
        const [ax, ay] = e.toWorld(x1, y1), [bx, by] = e.toWorld(x2, y2);
        dotsAlong(ax, ay, bx, by, e.dotPhase[li] || 0);
      });
    }
  }

  /** advance dot phases; speed in world units per second per ampere-scale */
  advanceDots(st, dtReal) {
    const k = (st.settings.dotSpeed ?? 1) * 60 * dtReal;
    const f = (i) => {
      const x = i / st.iScale;
      const s = Math.sign(x) * Math.min(3, Math.sqrt(Math.abs(x)));
      return s * k;
    };
    if (st.graph) for (const ed of st.graph.edges) ed.phase += f(ed.i);
    for (const e of st.doc.elements) {
      e.leads().forEach(([pi], li) => { e.dotPhase[li] = (e.dotPhase[li] || 0) + f(e.postCurrents[pi] || 0); });
    }
  }

  /**
   * Put each value label on the side of its part where it does not sit on a wire
   * or another part (e.g. a transformer rating above a primary wire). Cached per geometry.
   */
  chooseLabelSides(st) {
    const doc = st.doc;
    let sig = doc.wires.length + '|' + (st.settings.showNames ? 1 : 0);
    for (const w of doc.wires) sig += '|' + w.pts.join(';');
    for (const e of doc.elements) sig += '|' + e.x + ',' + e.y + ',' + e.rot + (e.flip ? 'f' : '') + e.valueLabel();
    if (this._sidesSig === sig) return;
    this._sidesSig = sig;
    const segs = [];
    for (const w of doc.wires) for (let k = 1; k < w.pts.length; k++) {
      const [a, b] = [w.pts[k - 1], w.pts[k]];
      segs.push([Math.min(a[0], b[0]) - 2, Math.min(a[1], b[1]) - 2, Math.max(a[0], b[0]) + 2, Math.max(a[1], b[1]) + 2]);
    }
    const boxes = doc.elements.map((e) => e.worldBox());
    const placed = []; // labels already positioned, so two labels never share a spot
    const hit = (r, own) => {
      let a = 0;
      const add = (o, wgt = 1) => {
        const w = Math.min(r[2], o[2]) - Math.max(r[0], o[0]), h = Math.min(r[3], o[3]) - Math.max(r[1], o[1]);
        if (w > 0 && h > 0) a += w * h * wgt;
      };
      for (const o of segs) add(o);
      boxes.forEach((o, i) => { if (i !== own) add(o); });
      for (const o of placed) add(o, 3);
      return a;
    };
    doc.elements.forEach((e, i) => {
      e.chosenSide = null;
      const val = e.valueLabel();
      const txt = st.settings.showNames && !e.constructor.noName ? e.name + (val ? ' ' + val : '') : val;
      if (!txt) return;
      const [sx, sy] = e.labelSide();
      const sides = [[sx, sy], [-sx, -sy], [sy, sx], [-sy, -sx]];
      let best = null, bestScore = Infinity;
      sides.forEach((sd, k) => {
        const r = e.labelRect(txt, sd);
        if (!r) return;
        const sc = hit(r, i) + k * 4; // keep the part's usual side unless it collides
        if (sc < bestScore) { bestScore = sc; best = sd; }
      });
      if (best && (best[0] !== sx || best[1] !== sy)) e.chosenSide = best;
      const r = e.labelRect(txt);
      if (r) placed.push(r);
    });
  }

  drawLabels(st, g) {
    const th = st.theme;
    this.chooseLabelSides(st);
    for (const e of st.doc.elements) {
      const val = e.valueLabel();
      const txt = st.settings.showNames && !e.constructor.noName ? e.name + (val ? ' ' + val : '') : val;
      if (!txt) continue;
      const o = e.labelAnchor();
      g.text(txt, o[0], o[1], { size: 10.5, color: th.text2, align: o[2], baseline: o[3], bold: true, follow: false });
    }
  }

  /** EveryCircuit-style live annotations: net voltages on wires, part currents beside parts. */
  drawLive(st, sim) {
    const ctx = this.ctx, th = st.theme, set = st.settings;
    const volts = set.liveVolts !== false, amps = set.liveAmps !== false;
    if (!volts && !amps) return;
    const lay = this.liveLayout(st, sim);
    ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = th.bg;
    const put = (txt, x, y, align, base, col) => {
      ctx.textAlign = align; ctx.textBaseline = base;
      ctx.strokeText(txt, x, y); // halo keeps text legible over wires and grid
      ctx.fillStyle = col; ctx.fillText(txt, x, y);
    };
    // AC circuits: show the RMS over one supply cycle (what a meter reads), marked with "~"
    const rms = st.rms && st.rms.ready && set.acReadings !== 'inst' ? st.rms : null;
    if (volts) {
      for (const L of lay.volts) {
        if (rms) {
          const r = rms.node(L.node), v = Math.abs(r.v) < 1e-9 ? 0 : r.v;
          put(fmtSI(v, 'V', 3) + (r.ac && v ? '~' : ''), L.x, L.y, L.align, L.base, th.vLabel);
          continue;
        }
        const v = sim.nodeVoltage(L.node);
        put(fmtSI(Math.abs(v) < 1e-9 ? 0 : v, 'V', 3), L.x, L.y, L.align, L.base, th.vLabel);
      }
    }
    if (amps) {
      for (const L of lay.amps) {
        if (rms && L.el.liveCurrent() != null) {
          const r = rms.part(L.el);
          if (r) {
            const a = Math.abs(r.v) < 1e-10 ? 0 : r.v;
            if (r.ac) { put(fmtSI(a, 'A', 3) + (a ? '~' : ''), L.x, L.y, L.align, L.base, th.iLabel); continue; }
            const arrow = !a ? '' : (a > 0 ? L.fwd : L.back) + ' ';
            put(arrow + fmtSI(Math.abs(a), 'A', 3), L.x, L.y, L.align, L.base, th.iLabel);
            continue;
          }
        }
        const i = L.el.liveCurrent();
        if (i == null || !Number.isFinite(i)) continue;
        const a = Math.abs(i) < 1e-10 ? 0 : i; // gmin-level residue reads as zero
        const arrow = !a ? '' : (a > 0 ? L.fwd : L.back) + ' ';
        put(arrow + fmtSI(Math.abs(a), 'A', 3), L.x, L.y, L.align, L.base, th.iLabel);
      }
    }
  }

  /** Placement of live labels; recomputed only when the circuit geometry or the solver changes. */
  liveLayout(st, sim) {
    const doc = st.doc;
    let sig = doc.wires.length + '|' + (st.settings.showNames ? 1 : 0);
    // value-label text and side matter too: turning a knob changes the label's length
    for (const e of doc.elements) sig += '|' + e.x + ',' + e.y + ',' + e.rot + (e.flip ? 'f' : '') + e.valueLabel() + (e.chosenSide ? e.chosenSide.join(':') : '');
    for (const p of st.probes || []) if (p.pos) sig += '|p' + p.pos[0] + ',' + p.pos[1];
    if (this._live && this._live.sim === sim && this._live.sig === sig) return this._live;

    const VW = 58, VH = 13, AW = 66; // text extents for layout (widest typical reading, e.g. "→ 188.5 mA~")
    const obs = [];
    const box = (r, pad = 0, py = pad) => obs.push([r[0] - pad, r[1] - py, r[2] + pad, r[3] + py]);
    const overlap = (r) => {
      let a = 0;
      for (const o of obs) {
        const w = Math.min(r[2], o[2]) - Math.max(r[0], o[0]), h = Math.min(r[3], o[3]) - Math.max(r[1], o[1]);
        if (w > 0 && h > 0) a += w * h;
      }
      return a;
    };
    const rectOf = (x, y, w, h, align, base) => {
      const x1 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
      const y1 = base === 'top' ? y : base === 'bottom' ? y - h : y - h / 2;
      return [x1, y1, x1 + w, y1 + h];
    };

    for (const e of doc.elements) {
      box(e.worldBox(), 2);
      const val = e.valueLabel();
      const txt = st.settings.showNames && !e.constructor.noName ? e.name + (val ? ' ' + val : '') : val;
      const r = e.labelRect(txt);
      if (r) box(r, 9, 1); // a clear gap so two readings on one line never run together
    }
    // probe pins stand above their point; keep readings out from under them
    for (const p of st.probes || []) if (p.pos) box([p.pos[0] - 14, p.pos[1] - 30, p.pos[0] + 14, p.pos[1] + 12]);
    for (const w of doc.wires) for (let k = 1; k < w.pts.length; k++) {
      const [a, b] = [w.pts[k - 1], w.pts[k]];
      box([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])], 1.5);
    }

    // currents: opposite the value label, or stacked under it when that side is crowded
    const amps = [];
    for (const e of doc.elements) {
      if (e.liveCurrent() == null) continue;
      const [sx, sy] = e.chosenSide || e.labelSide();
      const val = e.valueLabel();
      const cands = [];
      const push = (x, y, align, base, pen) => cands.push({ x, y, align, base: base === 'alphabetic' ? 'bottom' : base, pen });
      const [ox, oy, oa, ob] = e.labelAnchor([-sx, -sy]);
      push(ox, oy, oa, ob, 0);
      if (ob === 'middle') { push(ox, oy + 14, oa, 'middle', 6); push(ox, oy - 14, oa, 'middle', 7); }
      const [vx, vy, va, vb] = e.labelAnchor();
      if (!val) push(vx, vy, va, vb, 2);
      else if (vb === 'middle') { push(vx, vy + 14, va, 'middle', 3); push(vx, vy - 14, va, 'middle', 4); }
      else if (vb === 'top') push(vx, vy + 14, va, 'top', 4);
      else push(vx, vy - 14, va, 'bottom', 5);
      let best = null, bestScore = Infinity;
      for (const c of cands) {
        const r = rectOf(c.x, c.y, AW, VH, c.align, c.base);
        const sc = overlap(r) * 2 + c.pen;
                if (sc < bestScore) { bestScore = sc; best = { ...c, r }; }
      }
      const [p0, p1] = e.getPosts();
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      const dir = (ux, uy) => Math.abs(ux) >= Math.abs(uy) ? (ux > 0 ? '→' : '←') : (uy > 0 ? '↓' : '↑');
      amps.push({ el: e, x: best.x, y: best.y, align: best.align, base: best.base, fwd: dir(dx, dy), back: dir(-dx, -dy) });
      box(best.r, 9, 1);
    }

    // one voltage label per net, on the free-est stretch of its wiring
    const nets = new Map();
    const net = (n) => { if (!nets.has(n)) nets.set(n, { segs: [], posts: [] }); return nets.get(n); };
    const wn = sim.wireNodes && sim.wireNodes.length === doc.wires.length ? sim.wireNodes : null;
    if (wn) doc.wires.forEach((w, i) => {
      if (wn[i] < 0) return;
      for (let k = 1; k < w.pts.length; k++) net(wn[i]).segs.push([w.pts[k - 1], w.pts[k]]);
    });
    for (const e of doc.elements) {
      const ps = e.getPosts();
      (e.nodes || []).forEach((n, k) => { if (n >= 0 && ps[k]) net(n).posts.push(ps[k]); });
    }
    const volts = [];
    const order = [...nets.keys()].sort((a, b) => a - b);
    for (const n of order) {
      const { segs, posts } = nets.get(n);
      if (!segs.length && posts.length < 2) continue; // an unconnected terminal: no reading to show
      const cands = [];
      for (const [a, b] of segs) {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < GRID * 0.9) continue;
        const horiz = a[1] === b[1];
        for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) {
          const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
          if (horiz) {
            const room = len >= VW + 8 ? 0 : 12; // prefer stretches wide enough for the text
            cands.push({ x, y: y - 5, align: 'center', base: 'bottom', pen: room + Math.abs(t - 0.5) * 6 });
            cands.push({ x, y: y + 5, align: 'center', base: 'top', pen: room + 4 + Math.abs(t - 0.5) * 6 });
          } else {
            cands.push({ x: x + 6, y, align: 'left', base: 'middle', pen: 10 + Math.abs(t - 0.5) * 6 });
            cands.push({ x: x - 6, y, align: 'right', base: 'middle', pen: 12 + Math.abs(t - 0.5) * 6 });
          }
        }
      }
      for (const [x, y] of posts) {
        cands.push({ x: x + 5, y: y - 5, align: 'left', base: 'bottom', pen: 30 });
        cands.push({ x: x - 5, y: y - 5, align: 'right', base: 'bottom', pen: 32 });
        cands.push({ x: x + 5, y: y + 5, align: 'left', base: 'top', pen: 34 });
        cands.push({ x: x - 5, y: y + 5, align: 'right', base: 'top', pen: 36 });
      }
      let best = null, bestScore = Infinity;
      for (const c of cands) {
        const r = rectOf(c.x, c.y, VW, VH, c.align, c.base);
        const sc = overlap(r) * 2 + c.pen;
        if (sc < bestScore) { bestScore = sc; best = { ...c, r }; }
      }
      if (!best) continue;
      box(best.r, 2);
      volts.push({ node: n, x: best.x, y: best.y, align: best.align, base: best.base });
    }
    this._live = { sim, sig, volts, amps };
    return this._live;
  }

  drawProbe(pr, g, st) {
    if (!pr.pos) return;
    const [x, y] = pr.pos;
    this.drawPin(x, y, pr.color, g, null, pr.kind === 'node' ? 0 : pr.ang || 0);
  }

  drawPin(x, y, col, g, label, ang = 0) {
    const ctx = this.ctx, s = 1 / Math.max(0.6, this.scale) * 1.2;
    ctx.save();
    ctx.translate(x, y);
    if (ang) ctx.rotate(ang);
    ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, -12); ctx.arc(0, -15, 6.5, Math.PI * 0.8, Math.PI * 0.2); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -15, 2.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    if (label) {
      ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, 9, -16);
    }
    ctx.restore();
  }

  /** Render an element type into a small canvas for palette icons. */
  static iconFor(C, theme, size = 64) {
    const cv = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = size * dpr; cv.height = size * dpr;
    const ctx = cv.getContext('2d');
    const e = new C(0, 0);
    const [a, b, c, d] = e.localBox();
    const w = c - a, h = d - b;
    const sc = Math.min((size - 10) / w, (size - 10) / h, 1.1);
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (size / 2 - ((a + c) / 2) * sc), dpr * (size / 2 - ((b + d) / 2) * sc));
    const g = makeGraphics(ctx, theme, { running: false, lw: 2.4 / Math.max(sc, 0.5) * 0.8 });
    for (const [, x1, y1, x2, y2] of e.leads()) g.line(x1, y1, x2, y2, theme.body, g.lw);
    e.draw(g);
    for (const [x, y] of e.localPosts()) g.circle(x, y, 2.5 / sc, { fill: theme.accent });
    return cv.toDataURL();
  }
}

export function labelFor(e) { return e.name + (e.valueLabel() ? ' · ' + e.valueLabel() : ''); }
export { fmtShort };
