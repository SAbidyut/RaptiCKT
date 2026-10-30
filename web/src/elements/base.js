// Base class shared by all circuit elements: geometry, properties, serialisation.

import { fmtQty } from '../engine/units.js';

export const GRID = 20;

const REGISTRY = new Map();
export function register(cls) {
  if (REGISTRY.has(cls.type)) throw new Error(`duplicate component type '${cls.type}'`); // a second part must never silently replace the first
  REGISTRY.set(cls.type, cls);
  return cls;
}
export function getType(t) { return REGISTRY.get(t); }
export function allTypes() { return [...REGISTRY.values()]; }

let uid = 1;

/**
 * The slant (whole grid steps [dx, dy] from first terminal to second) nearest to angle `ang`
 * (radians, clockwise from pointing right) for a part n grid steps long: as close to the angle
 * as small grid steps allow (within a few degrees), at about its usual length.
 */
export function slantFor(ang, n = 4) {
  let best = null, bs = Infinity;
  const c = Math.cos(ang), s = Math.sin(ang), m = Math.ceil(n * 1.75);
  for (let P = -m; P <= m; P++) for (let Q = -m; Q <= m; Q++) {
    const len = Math.hypot(P, Q);
    if (len < n * 0.85 || len > n * 1.75) continue;
    const err = Math.acos(Math.max(-1, Math.min(1, (P * c + Q * s) / len))) * (180 / Math.PI);
    const sc = err + 0.35 * Math.abs(len - n);
    if (sc < bs - 1e-9) { bs = sc; best = [P, Q]; }
  }
  return best;
}

/**
 * A slant that lies exactly along the grid line from a point to one [dx, dy] steps away, about
 * n steps long (a whole number of the smallest grid steps along it), or null when that line has
 * no grid point near enough (then slantFor gives the nearest angle).
 */
export function slantAlong(dx, dy, n = 4) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const k = gcd(Math.abs(dx), Math.abs(dy));
  if (!k) return null;
  const p = dx / k, q = dy / k, u = Math.hypot(p, q);
  if (u > n * 1.75) return null;
  const m = Math.max(1, Math.round((n * 1.05) / u));
  return [p * m, q * m];
}

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
    this.sv = null; // slanted: its second terminal [dx, dy] grid steps from its first, at any angle
    this.p = {};
    for (const pr of this.constructor.props) this.p[pr.key] = pr.def;
    this.nodes = []; this.inodes = []; this.branches = [];
    this.postCurrents = [];
    this.dotPhase = [];
    this.i = 0;
    this.name = this.constructor.prefix + '?';
    this.damaged = null; // { why } once burnt out / blown / destroyed — kept until replaced
  }

  get cls() { return this.constructor; }

  // ----------------------------------------------------------- geometry
  /** posts in local coordinates (unrotated) */
  localPosts() { return [[-2 * GRID, 0], [2 * GRID, 0]]; }
  /** local bounding box [x1,y1,x2,y2] for hit testing */
  localBox() { return [-2 * GRID, -GRID * 0.75, 2 * GRID, GRID * 0.75]; }

  /**
   * Local → world. A slanted part (sv) lies along the line from its first terminal to its
   * second, at any angle: its body is drawn its usual size (smaller only when the terminals are
   * closer than its usual length), and its leads are drawn out to the terminals, which sit
   * exactly on grid points.
   */
  toWorld(lx, ly) {
    if (this.flip) ly = -ly;
    if (this.sv) {
      const f = this.slantFrame();
      if (ly === 0 && Math.abs(lx) === f.h) { const k = (Math.sign(lx) * GRID) / 2; return [this.x + k * f.P, this.y + k * f.Q]; }
      const a = this.slantAxis(lx) * f.s, b = ly * f.s;
      return [this.x + a * f.ux - b * f.uy, this.y + a * f.uy + b * f.ux];
    }
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
    if (this.sv) {
      const f = this.slantFrame(), a = (dx * f.ux + dy * f.uy) / f.s, m = Math.abs(a);
      x = m <= f.inner ? a : Math.sign(a) * (f.inner + (m - f.inner) / f.st);
      y = (dy * f.ux - dx * f.uy) / f.s;
    } else {
      switch (this.rot & 3) {
        case 0: x = dx; y = dy; break;
        case 1: x = dy; y = -dx; break;
        case 2: x = -dx; y = -dy; break;
        default: x = -dy; y = dx; break;
      }
    }
    if (this.flip) y = -y;
    return [x, y];
  }

  /** Can it be slanted at any angle: two terminals on its axis, either side of its middle, on grid steps? */
  canSlant() {
    const p = this.localPosts();
    return p.length === 2 && p[0][1] === 0 && p[1][1] === 0 && p[1][0] > 0 && p[0][0] === -p[1][0] && p[1][0] % GRID === 0;
  }

  /**
   * A slanted part's frame (cached): the unit vector (ux, uy) along it, its angle, the scale s of
   * its body (1, or less when its terminals are closer than its usual length), and how its leads
   * are drawn out: from `inner` (where they meet the body) the axis is stretched by st, so that
   * its terminals at ±h land at ±L in the drawing (before scaling).
   */
  slantFrame() {
    const [P, Q] = this.sv, h = this.localPosts()[1][0], c = this._sf;
    if (c && c.P === P && c.Q === Q && c.h === h) return c;
    const len = Math.hypot(P, Q) * GRID, s = Math.min(1, len / (2 * h)), L = len / (2 * s);
    let inner = 0;
    for (const l of this.leads()) if (!l[2] && Math.abs(l[1]) === h) inner = Math.max(inner, Math.abs(l[3]));
    if (!(inner > 0 && inner < h - 1e-6)) inner = h / 2;
    this._sf = { P, Q, h, len, s, L, inner, st: (L - inner) / (h - inner), ux: (P * GRID) / len, uy: (Q * GRID) / len, ang: Math.atan2(Q, P) };
    return this._sf;
  }

  /** Where a point at lx along a slanted part's axis is drawn (its leads drawn out to its terminals). */
  slantAxis(lx) {
    const f = this.slantFrame(), a = Math.abs(lx);
    return a <= f.inner ? lx : Math.sign(lx) * (f.inner + (a - f.inner) * f.st);
  }

  /** Its angle on the board (radians, clockwise from pointing right), slanted or not. */
  boardAngle() { return this.sv ? this.slantFrame().ang : ((this.rot & 3) * Math.PI) / 2; }

  /**
   * Slant it so that its second terminal is sv = [dx, dy] grid steps from its first (null: set
   * it straight again, turned the way it points). Its middle stays where it is: snapPosts() puts
   * its terminals back on grid points. A slant along a grid line at its usual length is no slant.
   */
  setSlant(sv) {
    if (!sv || !this.canSlant()) { this.sv = null; return; }
    const P = Math.round(sv[0]), Q = Math.round(sv[1]);
    if (!P && !Q) return;
    const n = (2 * this.localPosts()[1][0]) / GRID;
    const turn = (a) => ((Math.round(a / (Math.PI / 2) - 1e-9) % 4) + 4) % 4;
    if ((!P || !Q) && Math.abs(P + Q) === n) { this.sv = null; this.rot = turn(Math.atan2(Q, P)); return; }
    this.sv = [P, Q];
    this.rot = turn(Math.atan2(Q, P)); // the nearest straight way it points (meters keep their faces level by it)
  }

  /** Shift it (by less than a grid step) so its first terminal sits on a grid point. */
  snapPosts() {
    const [p] = this.getPosts();
    if (!p) return;
    this.x += Math.round(p[0] / GRID) * GRID - p[0];
    this.y += Math.round(p[1] / GRID) * GRID - p[1];
  }

  getPosts() { return this.localPosts().map(([x, y]) => this.toWorld(x, y)); }

  worldBox() {
    const q = this.worldPoly();
    return [Math.min(...q.map((p) => p[0])), Math.min(...q.map((p) => p[1])), Math.max(...q.map((p) => p[0])), Math.max(...q.map((p) => p[1]))];
  }

  /** The four corners of its box on the board, turned and slanted with it. */
  worldPoly() {
    const [a, b, c, d] = this.localBox();
    return [this.toWorld(a, b), this.toWorld(c, b), this.toWorld(c, d), this.toWorld(a, d)];
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
    if (this.sv) out.v = [...this.sv];
    const p = {};
    for (const pr of this.constructor.props) if (this.p[pr.key] !== pr.def) p[pr.key] = this.p[pr.key];
    if (Object.keys(p).length) out.p = p;
    if (this.label) out.l = this.label;
    if (this.fault && this.fault.m && this.fault.m !== 'none') out.fl = { ...this.fault };
    if (this.damaged) out.d = this.damaged.why;
    return out;
  }

  static fromJSON(o) {
    const C = getType(o.t);
    if (!C) return null;
    const e = new C(o.x, o.y);
    e.rot = o.r || 0;
    e.flip = !!o.f;
    if (o.v) e.setSlant(o.v);
    else if (o.s && e.canSlant()) { // saved by the 45°-only version: turned 45° beyond its rot
      const n = (2 * e.localPosts()[1][0]) / GRID;
      e.setSlant([[n, n], [-n, n], [-n, -n], [n, -n]][e.rot & 3]);
    }
    if (o.p) Object.assign(e.p, o.p);
    if (o.l) e.label = o.l;
    if (o.fl) e.fault = { ...o.fl };
    if (o.d) e.damaged = { why: String(o.d) };
    e.onParamChange();
    return e;
  }

  // ----------------------------------------------------------- damage
  /**
   * The part is destroyed by over-stress (burnt filament, blown fuse, exploded capacitor…).
   * It stays damaged — also after a restart — until the user replaces it. `always` is for
   * parts whose whole job is to fail (fuses), so they blow even with damage switched off.
   */
  setDamage(s, why, always = false) {
    if (this.damaged) return false;
    if (s && s.damageOn === false && !always) return false;
    this.damaged = { why, t: s ? s.t : 0 };
    if (s) { s.markEvent(); s.damageLog.push(this); }
    return true;
  }
  /** Put in a new part: clear the damage and start from a cold, unstressed state. */
  replace(s) {
    this.damaged = null;
    this.stress = 0; this._hav = 0;
    try { if (this.reset) this.reset(s); } catch { /* reset again at the next run */ }
  }
  /**
   * Running average of a load ratio on the thermal clock (time constant tau, seconds of real
   * time). Parts use it to decide when a sustained overload has cooked them.
   */
  heatAvg(s, x, tau) { this._hav = (this._hav || 0) + (x - (this._hav || 0)) * Math.min(1, s.heatDt() / tau); return this._hav; }
  /**
   * Burn out on a sustained overload. `x` is the heating against the rating (1 = rated, e.g.
   * (V/Vr)² or (I/Ir)²), averaged over `tau` seconds on the heat clock; once the average passes
   * `lim` the part fails with the reason why() gives. The warning glow starts at 1.2 (≈ +10 %),
   * so the normal ±10 % swing of the mains never stresses it. Returns true the step it fails.
   */
  overheat(s, x, tau, lim, why) {
    if (this.damaged) return false;
    const th = this.heatAvg(s, x, tau);
    this.stress = Math.max(0, Math.min(1, (th - 1.2) / (lim - 1.2)));
    return th > lim && this.setDamage(s, why());
  }
  /** 0 … 1: how close the part is to failing (drawn as a warning glow). */
  stressLevel() { return this.stress || 0; }

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
  /** Current (post 0 → post 1) shown as a live annotation; null for parts that have none. */
  liveCurrent() { return this.localPosts().length === 2 && this.postCurrents.length === 2 ? this.postCurrents[0] : null; }

  /** side (local unit vector) on which the value label is placed, outside the part */
  labelSide() { return [0, -1]; }

  /** World anchor for the value label: [x, y, align, baseline]. */
  labelAnchor(side = this.chosenSide || this.labelSide()) {
    const [sx, sy, extra = 0] = side; // extra: further out, when the spot next to the part is taken
    const [ox, oy] = this.toWorld(0, 0), [px, py] = this.toWorld(sx, sy);
    if (this.sv) {
      // slanted: out from the middle of its body, square to it, past its half-width that way
      const f = this.slantFrame(), n = Math.hypot(px - ox, py - oy) || 1, vx = (px - ox) / n, vy = (py - oy) / n;
      const [, b, , d] = this.localBox();
      const r = (Math.abs(sx) > Math.abs(sy) ? f.L : sy < 0 ? -b : d) * f.s + 7 + extra;
      return [ox + vx * r, oy + vy * r, vx > 0.38 ? 'left' : vx < -0.38 ? 'right' : 'center', vy > 0.38 ? 'top' : vy < -0.38 ? 'alphabetic' : 'middle'];
    }
    const dx = Math.round(px - ox), dy = Math.round(py - oy);
    const [x1, y1, x2, y2] = this.worldBox();
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, m = 7 + extra;
    if (dx > 0) return [x2 + m, cy, 'left', 'middle'];
    if (dx < 0) return [x1 - m, cy, 'right', 'middle'];
    if (dy > 0) return [cx, y2 + m, 'center', 'top'];
    return [cx, y1 - m, 'center', 'alphabetic'];
  }

  /** Approximate world rectangle covered by the label text (for Fit). */
  labelRect(txt, side, k = 1) {
    if (!txt) return null;
    const [x, y, al, bl] = this.labelAnchor(side);
    const w = txt.length * 6.8 * k, h = 12 * k; // (k: the label drawn k times its usual size)
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
