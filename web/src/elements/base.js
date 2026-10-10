// Base class shared by all circuit elements: geometry, properties, serialisation.

import { fmtQty, fmtShort } from '../engine/units.js';

export const GRID = 20;

const REGISTRY = new Map();
const LIMITS = new Map();
/**
 * Ratings of a part type (elements/limits.js): fn(element) → { rules: [...], fail } or null.
 * The simulator checks every rated part after each step and destroys it when a rule is broken.
 */
export function setLimits(type, fn) { LIMITS.set(type, fn); }
export function hasLimits(type) { return LIMITS.has(type); }
export function getLimits(type) { return LIMITS.get(type); }
export function register(cls) {
  if (REGISTRY.has(cls.type)) throw new Error(`duplicate component type '${cls.type}'`); // a second part must never silently replace the first
  REGISTRY.set(cls.type, cls);
  return cls;
}
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
    this.damaged = null; // { why } once burnt out / blown / destroyed — kept until replaced
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
    if (this.fault && this.fault.m && this.fault.m !== 'none') out.fl = { ...this.fault };
    if (this.damaged) out.d = this.damaged.why;
    if (this.damaged && this.damaged.fail) out.dq = this.damaged.fail;
    if (this.damaged?.partial) out.dp = 1; // part of it failed (a fan's burst capacitor), the rest still conducts
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
    if (o.fl) e.fault = { ...o.fl };
    if (o.d) e.damaged = o.dp ? { why: String(o.d), partial: true } : { why: String(o.d) };
    if (o.dq && e.damaged) e.damaged.fail = Array.isArray(o.dq) ? o.dq : [];
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
    // a part inside a composite (an LED of an RGB LED…): the whole package is the burnt part
    const o = this.owner;
    if (o && !o.damaged) o.damaged = { why, t: this.damaged.t, inner: true };
    if (s) { s.markEvent(); s.damageLog.push(o || this); }
    return true;
  }
  /** Put in a new part: clear the damage and start from a cold, unstressed state. */
  replace(s) {
    this.damaged = null;
    this.stress = 0; this._hav = 0; this._lim = null;
    for (const x of this.subs || []) { x.el.damaged = null; x.el.stress = 0; x.el._hav = 0; }
    try { if (this.reset) this.reset(s); } catch { /* reset again at the next run */ }
  }
  /**
   * Running average of a load ratio on the thermal clock (time constant tau, seconds of real
   * time). Parts use it to decide when a sustained overload has cooked them.
   */
  heatAvg(s, x, tau) { this._hav = (this._hav || 0) + (x - (this._hav || 0)) * Math.min(1, s.heatDt() / tau); return this._hav; }
  /** 0 … 1: how close the part is to failing (drawn as a warning glow). */
  stressLevel() { return this.stress || 0; }

  // ---------------------------------------------------------- ratings
  /** This part's ratings (see setLimits), re-read when its values change. */
  ratings() {
    const f = LIMITS.get(this.constructor.type);
    if (!f) return null;
    const sig = JSON.stringify(this.p);
    if (sig !== this._limSig) { this._limSig = sig; this._limSpec = f(this) || null; this._lim = null; }
    return this._limSpec;
  }

  /**
   * Check the ratings after an accepted step. Rules:
   *  pd   — power dissipated in the part, Σ v·i over its pins (W)
   *  irms — RMS current at the given pins (A);  vrms — RMS voltage across a pin pair (V)
   *  vpk  — instantaneous voltage across a pin pair ('span' = between any two pins)
   *  cfg  — a setting that destroys it at power-up (logic VDD 12 V, op-amp on ±25 V…)
   *  vpin — any pin against ground outside lo … hi (a chip's pins beyond its supply rails)
   * Models: 'life' — wear accumulates at 1 / (T2·(2/r)^m) per second of the thermal clock above
   * the rating (r = value / rating, T2 = life at twice the rating), as semiconductors and LEDs age;
   * 'therm' — first-order heating (time constant tau) failing at lim × the rating, as windings
   * and insulation do; plus an instant failure at inst × the rating.
   */
  checkLimits(s) {
    const spec = this._limSpec;
    if (!spec || s.mode === 'dc') return;
    const R = spec.rules, n = R.length, N = this.nodes, I = this.postCurrents;
    let st = this._lim;
    if (!st || st.w.length !== n) st = this._lim = { q: new Float64Array(n), f: new Float64Array(n), w: new Float64Array(n), t: new Float64Array(n), h: R.map(() => ({ ft: 0 })) };
    const dt = s.dt, hdt = s.heatDt(), aq = Math.min(1, dt / Math.max(0.02, s.acPeriod || 0)), af = Math.min(1, dt / 1e-3);
    const v = (k) => (k === 'g' ? 0 : s.v(N[k]));
    let stress = 0;
    for (let j = 0; j < n; j++) {
      const r = R[j];
      let x, slow, fast;
      if (r.q === 'cfg') {
        const msg = r.fn(this);
        if (msg) return this.fail(s, msg, r.fail ?? spec.fail, spec);
        continue;
      }
      if (r.q === 'vpin') {
        // every pin against ground: beyond lo … hi the input-protection diodes and the
        // junctions behind them burn
        let worst = 0, u0 = 0;
        for (let k = 0; k < N.length; k++) { const u = v(k), d = Math.max(u - r.hi, r.lo - u); if (d > worst) { worst = d; u0 = u; } }
        st.t[j] = worst > 0 ? st.t[j] + dt : 0;
        if (st.t[j] >= (r.tf ?? 1e-3)) return this.fail(s, r.why ? r.why(u0, this) : `Destroyed — ${fmtShort(u0, 'V')} on a pin (it allows ${fmtShort(r.lo, 'V')} … ${fmtShort(r.hi, 'V')})`, r.fail ?? spec.fail, spec);
        continue;
      }
      if (r.q === 'pd') {
        x = 0;
        const posts = r.posts || N.map((_, k) => k);
        for (const k of posts) x += v(k) * (I[k] || 0);
        st.q[j] += (x - st.q[j]) * aq; slow = Math.max(0, st.q[j]);
        st.f[j] += (x - st.f[j]) * af; fast = st.f[j];
      } else if (r.q === 'irms') {
        x = 0;
        for (const k of r.posts || N.map((_, kk) => kk)) x = Math.max(x, r.sign ? r.sign * (I[k] || 0) : Math.abs(I[k] || 0));
        st.q[j] += (x * x - st.q[j]) * aq; slow = Math.sqrt(st.q[j]);
        st.f[j] += (x - st.f[j]) * af; fast = st.f[j];
      } else if (r.q === 'vrms') {
        x = v(r.pair[0]) - v(r.pair[1]);
        st.q[j] += (x * x - st.q[j]) * aq; slow = Math.sqrt(st.q[j]);
        st.f[j] += (Math.abs(x) - st.f[j]) * af; fast = st.f[j] / Math.SQRT2;
      } else { // vpk
        if (r.pair === 'span') { let lo = Infinity, hi = -Infinity; for (let k = 0; k < N.length; k++) { const u = v(k); if (u < lo) lo = u; if (u > hi) hi = u; } x = hi - lo; } else x = v(r.pair[0]) - v(r.pair[1]);
        if (r.dir) x *= r.dir; else x = Math.abs(x);
        st.t[j] = x > r.max ? st.t[j] + dt : 0;
        if (st.t[j] >= (r.tf ?? 2e-4)) return this.fail(s, r.why ? r.why(x, this) : `Over-voltage — ${fmtShort(x, 'V')} across ${r.what || 'it'} (maximum ${fmtShort(r.max, 'V')})`, r.fail ?? spec.fail, spec);
        if (x > 0.8 * r.max) stress = Math.max(stress, Math.min(0.9, (x / r.max - 0.8) * 4));
        continue;
      }
      const rated = r.rated, ratio = slow / rated;
      if (r.inst && fast > r.inst * rated) return this.fail(s, this.limitWhy(r, Math.max(fast, slow)), r.fail ?? spec.fail, spec);
      if (r.model === 'therm') {
        // fault currents (≥ 8 × rating) heat in circuit time, so a breaker clearing a short in
        // milliseconds still protects the switches and meters in its path (see heatDtAt). A battery
        // heats itself: nothing upstream can clear its fault, so it always uses the thermal clock.
        st.w[j] += (ratio * ratio - st.w[j]) * Math.min(1, (r.selfHeat ? hdt : s.heatDtAt(ratio, st.h[j])) / (r.tau || 30));
        const lim = (r.lim || 1.5) ** 2;
        stress = Math.max(stress, Math.min(1, Math.max(0, (st.w[j] - 1) / (lim - 1))));
        if (st.w[j] >= lim) return this.fail(s, this.limitWhy(r, slow), r.fail ?? spec.fail, spec);
      } else {
        if (ratio > 1) st.w[j] += hdt / ((r.T2 || 5) * Math.pow(2 / ratio, r.m || 6));
        stress = Math.max(stress, Math.min(1, st.w[j]));
        if (st.w[j] >= 1) return this.fail(s, this.limitWhy(r, slow), r.fail ?? spec.fail, spec);
      }
    }
    this.stress = stress;
  }

  /** The ratings in words, for the property sheet (e.g. "Power 625 mW · collector–emitter ≤ 46 V"). */
  ratingText() {
    const spec = this.ratings();
    if (!spec) return '';
    const out = [];
    for (const r of spec.rules) {
      if (r.q === 'cfg') { if (r.label) out.push(r.label); continue; }
      if (r.q === 'vpin') { out.push(`Pins ${fmtShort(r.lo, 'V')} … ${fmtShort(r.hi, 'V')}`); continue; }
      if (r.q === 'pd') out.push(`Power ${fmtShort(r.rated, 'W')}`);
      else if (r.q === 'irms') out.push(`Current ${fmtShort(r.rated, 'A')}`);
      else if (r.q === 'vrms') out.push(`Voltage ${fmtShort(r.rated, 'V')} RMS`);
      else out.push(`${r.what ? r.what[0].toUpperCase() + r.what.slice(1) : 'Voltage'} ≤ ${fmtShort(r.show ?? r.max, 'V')}`);
    }
    return [...new Set(out)].join(' · ');
  }

  limitWhy(r, x) {
    if (r.why) return r.why(x, this);
    const u = { pd: 'W', irms: 'A', vrms: 'V' }[r.q];
    const what = r.what ? ` ${r.what}` : '';
    if (r.q === 'pd') return `Overheated — dissipating ${fmtShort(x, 'W')}${what} (rated ${fmtShort(r.rated, 'W')})`;
    if (r.q === 'irms') return `Over-current — ${fmtShort(x, 'A')}${what} (rated ${fmtShort(r.rated, 'A')})`;
    return `Over-voltage — ${fmtShort(x, u)} RMS${what} (rated ${fmtShort(r.rated, u)})`;
  }

  /** Destroyed by a broken rating: what is left behind (open, or shorted pins [a, b, R]). */
  fail(s, why, fail, spec) {
    if (!this.setDamage(s, why)) return;
    this.damaged.fail = Array.isArray(fail) ? fail : [];
    if (spec && spec.flame) this.damaged.flame = true; // lithium cells burn
    this.stress = 0;
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
  /** Current (post 0 → post 1) shown as a live annotation; null for parts that have none. */
  liveCurrent() { return this.localPosts().length === 2 && this.postCurrents.length === 2 ? this.postCurrents[0] : null; }

  /** side (local unit vector) on which the value label is placed, outside the part */
  labelSide() { return [0, -1]; }

  /** World anchor for the value label: [x, y, align, baseline]. */
  labelAnchor(side = this.chosenSide || this.labelSide()) {
    const [sx, sy, extra = 0] = side; // extra: further out, when the spot next to the part is taken
    const [ox, oy] = this.toWorld(0, 0), [px, py] = this.toWorld(sx, sy);
    const dx = Math.round(px - ox), dy = Math.round(py - oy);
    const [x1, y1, x2, y2] = this.worldBox();
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, m = 7 + extra;
    if (dx > 0) return [x2 + m, cy, 'left', 'middle'];
    if (dx < 0) return [x1 - m, cy, 'right', 'middle'];
    if (dy > 0) return [cx, y2 + m, 'center', 'top'];
    return [cx, y1 - m, 'center', 'alphabetic'];
  }

  /** Approximate world rectangle covered by the label text (for Fit). */
  labelRect(txt, side) {
    if (!txt) return null;
    const [x, y, al, bl] = this.labelAnchor(side);
    const w = txt.length * 6.8, h = 12;
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
