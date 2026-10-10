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
  toJSON() { return this.cable || this.burnt ? { p: this.pts, c: this.cable || undefined, b: this.burnt ? 1 : undefined } : this.pts; }
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
    if (cross === 0) out.splice(i, 1);
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
      const r = e.labelRect(e.valueLabel());
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
      app: 'RaptiCKT', v: 2, name: this.name, description: this.description || undefined,
      elements: this.elements.map((e) => e.toJSON()),
      wires: this.wires.map((w) => w.toJSON()),
      probes: this.probes.map((p) => ({ ...p, el: p.el != null ? idx.get(p.el) : undefined })),
      sim: this.simSettings,
    };
  }

  static fromJSON(o) {
    if (typeof o === 'string') o = JSON.parse(o);
    const d = new CircuitDoc(o.name || 'Imported circuit');
    d.description = o.description || '';
    const old = !(o.v >= 2);
    for (let eo of o.elements || []) {
      if (old) eo = migrateV1(eo);
      const e = Element.fromJSON(eo);
      if (e) d.elements.push(e);
    }
    for (const w of o.wires || []) {
      if (Array.isArray(w)) d.addWire(w);
      else if (w && w.p) d.addWire(w.p, { cable: w.c, burnt: w.b });
    }
    d.probes = (o.probes || []).map((p) => ({ ...p, el: p.el != null && d.elements[p.el] ? d.elements[p.el].id : undefined })).filter((p) => p.kind === 'node' || p.el != null);
    d.simSettings = o.sim || {};
    d.assignNames();
    return d;
  }

  clone() { const c = CircuitDoc.fromJSON(JSON.parse(JSON.stringify(this.toJSON()))); c.id = this.id; c.folder = this.folder; return c; }
}

// Version 1 files were saved when the plain resistor, capacitor and inductor were ideal by
// default; they now have real ratings (¼ W, 50 V, 2 A). A circuit saved before keeps working as
// it did: its parts get "Ideal" written in.
const V1_IDEAL = { resistor: { pw: '0' }, capacitor: { vr: '0' }, inductor: { irate: '0' }, varind: { irate: '0' } };
function migrateV1(eo) {
  const add = eo && V1_IDEAL[eo.t];
  if (!add) return eo;
  return { ...eo, p: { ...add, ...(eo.p || {}) } };
}

/** Serialise a selection (elements + wires) for copy/paste. */
export function serializeSelection(elements, wires) {
  return { elements: elements.map((e) => e.toJSON()), wires: wires.map((w) => (w.cable ? { p: w.pts.map((p) => [...p]), c: { ...w.cable } } : w.pts.map((p) => [...p]))) };
}

export function makeElement(type, x, y) {
  const C = getType(type);
  return C ? new C(x, y) : null;
}
