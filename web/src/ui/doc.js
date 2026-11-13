// Circuit document: elements + wires, serialisation, designators, routing helpers.

import { Element, GRID, getType } from '../elements/index.js';
import { normSpec } from '../elements/cables.js';

let wid = 1;

export class Wire {
  constructor(pts) {
    this.id = wid++; this.pts = pts.map((p) => [p[0], p[1]]); this.dotPhase = [];
    this.cable = null;  // cable spec ({type, size, shape, inst}); null = ideal wire with no limit
    this.burnt = false; // burnt through by overcurrent: drawn charred, no longer connects
    this.heat = null;   // live conductor-temperature model while simulating
  }
  get a() { return this.pts[0]; }
  get b() { return this.pts[this.pts.length - 1]; }
  /** saved form: plain point list for an ideal wire, else {p, c, b} */
  toJSON() {
    const pts = this.pts.map((p) => [p[0], p[1]]); // (its own points: the saved form must not move with the wire)
    return this.cable || this.burnt ? { p: pts, c: this.cable ? { ...this.cable } : undefined, b: this.burnt ? 1 : undefined } : pts;
  }
}

export const snap = (v) => Math.round(v / GRID) * GRID;

/** Orthogonal route between two grid points. hFirst: start horizontally. */
export function route(a, b, hFirst = true) {
  if (a[0] === b[0] || a[1] === b[1]) return [a, b];
  const c = hFirst ? [b[0], a[1]] : [a[0], b[1]];
  return [a, c, b];
}

/** Remove duplicate and collinear intermediate points. */
export function simplify(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q && q[0] === p[0] && q[1] === p[1]) continue;
    out.push([p[0], p[1]]);
  }
  for (let i = out.length - 2; i >= 1; i--) {
    const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    // in line and going on the same way: not a point where the path turns back on itself (taking
    // that out would cut off the stretch beyond it, and whatever is joined there)
    if (cross === 0 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) > 0) out.splice(i, 1);
  }
  return out;
}

export class CircuitDoc {
  constructor(name = 'Untitled circuit') {
    this.name = name;
    this.elements = [];
    this.wires = [];
    this.probes = [];
    this.meta = { created: Date.now() };
    this.simSettings = {};
    this.id = null;
    this.description = '';
    this.folder = null; // My Circuits folder id (not part of the saved file)
    this.bigLabels = false; // values drawn a third bigger (a circuit read from a photo)
    this.domain = 'time';   // AC circuits: 'time' (the usual values) or 'phasor' (20∠0° V, j4 Ω)
    this.omega = 0;         // ω in rad/s for the phasor domain when no source gives one
  }

  add(e) { this.elements.push(e); return e; }
  /** Add a wire; `from` ({cable, burnt} — e.g. the wire it was split from) sets its cable. */
  addWire(pts, from = null) {
    const s = simplify(pts);
    if (s.length < 2) return null;
    const w = new Wire(s);
    if (from) { w.cable = normSpec(from.cable); w.burnt = !!from.burnt; }
    this.wires.push(w);
    return w;
  }
  remove(e) {
    this.elements = this.elements.filter((x) => x !== e);
    this.probes = this.probes.filter((p) => p.el !== e.id);
  }
  removeWire(w) { this.wires = this.wires.filter((x) => x !== w); }

  assignNames() {
    const count = {};
    for (const e of this.elements) {
      const pre = e.constructor.prefix;
      count[pre] = (count[pre] || 0) + 1;
      e.name = pre + count[pre];
    }
  }

  bounds() {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const grow = ([a, b, c, d]) => { x1 = Math.min(x1, a); y1 = Math.min(y1, b); x2 = Math.max(x2, c); y2 = Math.max(y2, d); };
    for (const e of this.elements) {
      grow(e.worldBox());
      const r = e.labelRect(e.shownLabel());
      if (r) grow(r);
      // room for the live current reading on the opposite side
      if (e.liveCurrent() != null) { const [sx, sy] = e.labelSide(); grow(e.labelRect('↓ 000.0 mA', [-sx, -sy])); }
    }
    for (const w of this.wires) for (const [x, y] of w.pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
    if (!Number.isFinite(x1)) return null;
    return [x1, y1, x2, y2];
  }

  toJSON() {
    const idx = new Map(this.elements.map((e, i) => [e.id, i]));
    return {
      app: 'RaptiCKT', v: 1, name: this.name, description: this.description || undefined,
      elements: this.elements.map((e) => e.toJSON()),
      wires: this.wires.map((w) => w.toJSON()),
      // without what the editor works out while drawing (_el is a whole copy of the part, _node, ang)
      probes: this.probes.map((p) => {
        const q = {};
        for (const k in p) if (k[0] !== '_' && k !== 'ang') q[k] = p[k];
        q.el = p.el != null ? idx.get(p.el) : undefined;
        return q;
      }),
      sim: { ...this.simSettings },
      bl: this.bigLabels ? 1 : undefined,
      dm: this.domain === 'phasor' ? 'p' : undefined, // AC circuit shown in the phasor domain
      om: this.omega > 0 ? this.omega : undefined,      // its ω when no source gives one
    };
  }

  static fromJSON(o) {
    if (typeof o === 'string') o = JSON.parse(o);
    if (!o || typeof o !== 'object') o = {};
    const d = new CircuitDoc(o.name ? String(o.name) : 'Imported circuit');
    d.description = o.description ? String(o.description) : '';
    // a damaged or hand-edited file: whatever is not a part, a wire or a probe is left out
    const arr = (a) => (Array.isArray(a) ? a : []);
    const byIndex = []; // the parts as the file counts them (probes point at them by that number), left-out ones included
    for (const eo of arr(o.elements)) {
      let e = null;
      try { e = eo && typeof eo === 'object' ? Element.fromJSON(eo) : null; } catch { e = null; }
      byIndex.push(e);
      if (e) d.elements.push(e);
    }
    const pts = (a) => Array.isArray(a) && a.length >= 2 && a.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    for (const w of arr(o.wires)) {
      if (pts(w)) d.addWire(w);
      else if (w && typeof w === 'object' && pts(w.p)) d.addWire(w.p, { cable: w.c, burnt: w.b });
    }
    // a probe's colour and unit go into the page as they are: only well-formed ones are taken from a
    // file, so a crafted circuit cannot slip HTML or script into the app
    const COLOR = /^#[0-9a-f]{3,8}$/i, PALETTE = ['#facc15', '#22d3ee', '#f472b6', '#4ade80', '#fb923c', '#a78bfa'];
    d.probes = arr(o.probes).filter((p) => p && typeof p === 'object' && ['node', 'cur', 'volt'].includes(p.kind))
      .map((p, i) => ({
        ...p,
        id: String(p.id ?? 'p' + i), label: String(p.label ?? ''),
        color: COLOR.test(String(p.color)) ? p.color : PALETTE[i % PALETTE.length],
        unit: p.kind === 'cur' ? 'A' : 'V',
        pos: Array.isArray(p.pos) && p.pos.length === 2 && p.pos.every(Number.isFinite) ? [...p.pos] : undefined,
        el: p.el != null && byIndex[p.el] ? byIndex[p.el].id : undefined,
      }))
      .filter((p) => (p.kind === 'node' ? !!p.pos : p.el != null));
    d.simSettings = o.sim && typeof o.sim === 'object' && !Array.isArray(o.sim) ? { ...o.sim } : {};
    d.bigLabels = !!o.bl;
    d.domain = o.dm === 'p' ? 'phasor' : 'time';
    d.omega = Number.isFinite(+o.om) && +o.om > 0 ? +o.om : 0;
    d.assignNames();
    return d;
  }

  clone() { const c = CircuitDoc.fromJSON(JSON.parse(JSON.stringify(this.toJSON()))); c.id = this.id; c.folder = this.folder; return c; }
}

export function makeElement(type, x, y) {
  const C = getType(type);
  return C ? new C(x, y) : null;
}
