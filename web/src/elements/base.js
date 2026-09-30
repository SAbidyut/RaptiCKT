// Base class shared by all circuit elements: geometry, properties, serialisation.

import { fmtQty } from '../engine/units.js';

export const GRID = 20;

const REGISTRY = new Map();
export function register(cls) { REGISTRY.set(cls.type, cls); return cls; }
export function getType(t) { return REGISTRY.get(t); }
export function allTypes() { return [...REGISTRY.values()]; }

let uid = 1;

export class Element {
  // --- static metadata overridden by subclasses
  static type = 'base';
  static title = 'Element';
  static category = 'Misc';
  static prefix = 'X';
  static keywords = '';
  static props = []; // [{key,label,unit,def,min,max,log,type,options,knob}]
  static description = '';

  constructor(x = 0, y = 0) {
    this.id = uid++;
    this.x = x; this.y = y;
    this.rot = 0; this.flip = false;
    this.p = {};
    for (const pr of this.constructor.props) this.p[pr.key] = pr.def;
    this.nodes = []; this.inodes = []; this.branches = [];
    this.postCurrents = [];
    this.dotPhase = [];
    this.i = 0;
    this.name = this.constructor.prefix + '?';
  }

  get cls() { return this.constructor; }

  // ----------------------------------------------------------- geometry
  /** posts in local coordinates (unrotated) */
  localPosts() { return [[-2 * GRID, 0], [2 * GRID, 0]]; }
  /** local bounding box [x1,y1,x2,y2] for hit testing */
  localBox() { return [-2 * GRID, -GRID * 0.75, 2 * GRID, GRID * 0.75]; }

  toWorld(lx, ly) {
    if (this.flip) ly = -ly;
    let x, y;
    switch (this.rot & 3) {
      case 0: x = lx; y = ly; break;
      case 1: x = -ly; y = lx; break;
      case 2: x = -lx; y = -ly; break;
      default: x = ly; y = -lx; break;
    }
    return [this.x + x, this.y + y];
  }

  toLocal(wx, wy) {
    const dx = wx - this.x, dy = wy - this.y;
    let x, y;
    switch (this.rot & 3) {
      case 0: x = dx; y = dy; break;
      case 1: x = dy; y = -dx; break;
      case 2: x = -dx; y = -dy; break;
      default: x = -dy; y = dx; break;
    }
    if (this.flip) y = -y;
    return [x, y];
  }

  getPosts() { return this.localPosts().map(([x, y]) => this.toWorld(x, y)); }

  worldBox() {
    const [a, b, c, d] = this.localBox();
    const p1 = this.toWorld(a, b), p2 = this.toWorld(c, d);
    return [Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]), Math.max(p1[0], p2[0]), Math.max(p1[1], p2[1])];
  }

  hitTest(wx, wy, pad = 4) {
    const [lx, ly] = this.toLocal(wx, wy);
    const [a, b, c, d] = this.localBox();
    return lx >= a - pad && lx <= c + pad && ly >= b - pad && ly <= d + pad;
  }

  /** Leads: [postIndex, x1, y1, x2, y2] local segments from post into body. */
  leads() {
    return [[0, -2 * GRID, 0, -GRID, 0], [1, 2 * GRID, 0, GRID, 0]];
  }

  // -------------------------------------------------------- properties
  propDef(key) { return this.constructor.props.find((p) => p.key === key); }
  /** primary property adjusted by the knob */
  knobProp() { return this.constructor.props.find((p) => p.knob); }
  valueLabel() {
    const k = this.knobProp() || this.constructor.props[0];
    if (!k || k.type === 'select' || k.type === 'bool') return '';
    return fmtQty(this.p[k.key], k.unit || '');
  }
  onParamChange() {}

  // ----------------------------------------------------- serialisation
  toJSON() {
    const out = { t: this.constructor.type, x: this.x, y: this.y };
    if (this.rot) out.r = this.rot;
    if (this.flip) out.f = 1;
    const p = {};
    for (const pr of this.constructor.props) if (this.p[pr.key] !== pr.def) p[pr.key] = this.p[pr.key];
    if (Object.keys(p).length) out.p = p;
    if (this.label) out.l = this.label;
    return out;
  }

  static fromJSON(o) {
    const C = getType(o.t);
    if (!C) return null;
    const e = new C(o.x, o.y);
    e.rot = o.r || 0;
    e.flip = !!o.f;
    if (o.p) Object.assign(e.p, o.p);
    if (o.l) e.label = o.l;
    e.onParamChange();
    return e;
  }

  // -------------------------------------------------- engine interface
  // nonlinear = true enables stampNL
  // internalNodeCount(), branchCount(), connectivity(), reset(sim), stamp(sim),
  // stampStep(sim), stampNL(sim), accept(sim), preStep(sim), stampAC(ac)
  voltageDiff(sim) { return sim.v(this.nodes[0]) - sim.v(this.nodes[1]); }

  /** readings shown in the inspector/multimeter */
  readings(sim) {
    if (this.nodes.length < 2) return [];
    const v = this.voltageDiff(sim);
    return [['Voltage', v, 'V'], ['Current', this.i, 'A'], ['Power', v * this.i, 'W']];
  }

  /** interaction when tapped while simulating (switches etc.). return true if handled */
  onTap() { return false; }
  onPress() { return false; }
  onRelease() { return false; }

  // ----------------------------------------------------------- drawing
  draw(g) {
    g.box(-GRID * 0.8, -GRID * 0.5, GRID * 0.8, GRID * 0.5);
  }
  /** side (local unit vector) on which the value label is placed, outside the part */
  labelSide() { return [0, -1]; }

  /** World anchor for the value label: [x, y, align, baseline]. */
  labelAnchor() {
    const [sx, sy] = this.labelSide();
    const [ox, oy] = this.toWorld(0, 0), [px, py] = this.toWorld(sx, sy);
    const dx = Math.round(px - ox), dy = Math.round(py - oy);
    const [x1, y1, x2, y2] = this.worldBox();
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, m = 7;
    if (dx > 0) return [x2 + m, cy, 'left', 'middle'];
    if (dx < 0) return [x1 - m, cy, 'right', 'middle'];
    if (dy > 0) return [cx, y2 + m, 'center', 'top'];
    return [cx, y1 - m, 'center', 'alphabetic'];
  }

  /** Approximate world rectangle covered by the label text (for Fit). */
  labelRect(txt) {
    if (!txt) return null;
    const [x, y, al, bl] = this.labelAnchor();
    const w = txt.length * 6.4, h = 12;
    const lx = al === 'left' ? x : al === 'right' ? x - w : x - w / 2;
    const ty = bl === 'top' ? y : bl === 'middle' ? y - h / 2 : y - h;
    return [lx, ty, lx + w, ty + h];
  }
}

/** Two-terminal element helper with current stored in this.i (post0 -> post1). */
export class TwoTerm extends Element {
  constructor(x, y) { super(x, y); this.postCurrents = [0, 0]; }
  setCurrent(i) { this.i = i; this.postCurrents[0] = i; this.postCurrents[1] = -i; }
  shortCheck = true;
}
