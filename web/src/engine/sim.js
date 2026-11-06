// RaptiCKT simulation core: Modified Nodal Analysis with Newton–Raphson for
// nonlinear devices, trapezoidal / backward-Euler companion models for
// transient analysis, DC operating point with gmin- and source-stepping, and
// small-signal AC analysis around the operating point.

import { RealLU, SchurLU, complexSolve } from './matrix.js';

export const DEFAULT_OPTIONS = {
  method: 'trap',        // 'trap' | 'be'
  reltol: 1e-3,        // SPICE default
  vntol: 1e-6,           // V
  abstol: 1e-9,          // A
  gmin: 1e-12,           // S, added from every node to ground
  maxIter: 60,           // Newton iterations per timestep
  dcMaxIter: 150,
  initialDC: true,       // start transient from the DC operating point
};

class UnionFind {
  constructor() { this.p = new Map(); }
  find(k) {
    let p = this.p.get(k);
    if (p === undefined) { this.p.set(k, k); return k; }
    if (p === k) return k;
    const r = this.find(p);
    this.p.set(k, r);
    return r;
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.p.set(ra, rb);
  }
}

const key = (x, y) => Math.round(x) + ',' + Math.round(y);

function onSegment(px, py, ax, ay, bx, by) {
  // strictly inside an axis-aligned or diagonal segment (grid coordinates)
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if (Math.abs(cross) > 1e-6) return false;
  const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
  return dot > 1e-6 && dot < len2 - 1e-6;
}

export class Simulator {
  constructor(options = {}) {
    this.opt = { ...DEFAULT_OPTIONS, ...options };
    this.elements = [];
    this.wires = [];
    this.t = 0;
    this.dt = 5e-6;
    this.error = null;
    this.warnings = [];
    this.ready = false;
    // Slow thermal effects (breaker bimetals, overload relays, cable heating, parts burning
    // out) run on a clock heatScale times faster than simulated time. The editor sets it so
    // that they happen in real wall-clock time while the waveforms are shown slowed down.
    this.heatScale = 1;
    this.damageOn = true;   // parts burn out / cables catch fire when over-stressed
    this.damageLog = [];    // elements damaged since the UI last looked
  }

  /** Time step on the thermal clock (see heatScale). */
  heatDt() { return this.dt * (this.heatScale || 1); }

  /**
   * Heat clock for a part carrying `ratio` × its rated current: overloads (≤ 3×) heat on the
   * thermal clock; fault currents (≥ 8×) heat in simulated time, so a breaker or fuse that
   * clears a short circuit in a few milliseconds still protects the cable behind it.
   */
  heatDtAt(ratio) {
    const k = this.heatScale || 1;
    if (k <= 1 || ratio <= 3) return this.dt * k;
    if (ratio >= 8) return this.dt;
    return this.dt * Math.pow(k, (8 - ratio) / 5);
  }

  // ------------------------------------------------------------------ build
  /**
   * Analyse topology. elements: engine elements exposing getPosts(), wires: {pts:[[x,y]...]}.
   */
  build(elements, wires = []) {
    this.elements = elements;
    this.wires = wires;
    this.error = null;
    this.errorElement = null;
    this.warnings = [];
    const uf = new UnionFind();
    const points = [];
    // a burnt-through wire no longer connects anything
    const live = wires.filter((w) => !w.burnt);
    for (const w of live) {
      for (let i = 0; i < w.pts.length; i++) {
        const k = key(w.pts[i][0], w.pts[i][1]);
        uf.find(k);
        points.push(w.pts[i]);
        if (i > 0) uf.union(key(w.pts[i - 1][0], w.pts[i - 1][1]), k);
      }
    }
    for (const e of elements) {
      e._posts = e.getPosts();
      for (const p of e._posts) { uf.find(key(p[0], p[1])); points.push(p); }
    }
    // T-junctions: any point lying inside a wire segment joins that wire.
    for (const w of live) {
      for (let i = 1; i < w.pts.length; i++) {
        const [ax, ay] = w.pts[i - 1], [bx, by] = w.pts[i];
        for (const p of points) {
          if (onSegment(p[0], p[1], ax, ay, bx, by)) uf.union(key(p[0], p[1]), key(ax, ay));
        }
      }
    }
    // net labels: posts carrying the same net name are connected
    const nets = new Map();
    for (const e of elements) {
      const nm = e.netName ? e.netName() : '';
      if (!nm || !e._posts.length) continue;
      const k = key(e._posts[0][0], e._posts[0][1]);
      if (nets.has(nm)) uf.union(nets.get(nm), k); else nets.set(nm, k);
    }
    // ground
    let groundRoot = null;
    for (const e of elements) {
      if (e.isGround && e.isGround()) {
        const r = uf.find(key(e._posts[0][0], e._posts[0][1]));
        if (groundRoot === null) groundRoot = r; else uf.union(r, groundRoot);
      }
    }
    if (groundRoot !== null) groundRoot = uf.find(groundRoot);
    // number nodes
    const nodeOf = new Map();
    let n = 1;
    this.nodeKeys = [null];
    const nodeFor = (k) => {
      const r = uf.find(k);
      if (r === groundRoot) return 0;
      let id = nodeOf.get(r);
      if (id === undefined) { id = n++; nodeOf.set(r, id); this.nodeKeys.push(r); }
      return id;
    };
    for (const e of elements) e.nodes = e._posts.map((p) => nodeFor(key(p[0], p[1])));
    this.pointNode = (x, y) => {
      const k = key(x, y);
      if (!uf.p.has(k)) return -1;
      return nodeFor(k);
    };
    this.wireNodes = wires.map((w) => (w.burnt ? 0 : nodeFor(key(w.pts[0][0], w.pts[0][1]))));
    this.hasGround = groundRoot !== null;
    n = this.applyFaults(n);
    return this.finishBuild(n);
  }

  /** Build directly from pre-assigned node numbers (e.nodes, 0 = ground). Used by tests & netlists. */
  buildNet(elements) {
    this.elements = elements;
    this.wires = [];
    this.error = null; this.errorElement = null; this.warnings = [];
    let n = 1;
    for (const e of elements) for (const nd of e.nodes) n = Math.max(n, nd + 1);
    this.nodeKeys = new Array(n).fill(null);
    this.hasGround = true;
    n = this.applyFaults(n);
    return this.finishBuild(n);
  }

  /**
   * Component faults (element.fault = {m, a, b, r}): 'open' gives pin a its own
   * node, joined to its net by 1 GΩ; 'short' joins pins a and b with 1 mΩ;
   * 'res' joins them with r ohms (leaky / partial short).
   */
  applyFaults(n) {
    const extra = [];
    const link = (a, b, g, owner) => ({
      name: `${owner.name || owner.constructor.type} (fault)`, nodes: [a, b], inodes: [], branches: [], postCurrents: [0, 0], isFault: true,
      connectivity() { return null; },
      stamp(s) { s.addG(this.nodes[0], this.nodes[1], g); },
      stampAC(ac) { ac.addY(this.nodes[0], this.nodes[1], g); },
      accept(s) { const i = (s.v(this.nodes[0]) - s.v(this.nodes[1])) * g; this.postCurrents = [i, -i]; this.i = i; },
    });
    for (const e of this.elements) {
      const f = e.fault;
      if (!f || !f.m || f.m === 'none' || !e.nodes || e.nodes.length < 2) continue;
      const a = Math.max(0, f.a | 0), b = f.b == null ? 1 : f.b | 0;
      if (f.m === 'open') {
        if (a >= e.nodes.length) continue;
        const orig = e.nodes[a];
        e.nodes[a] = n;
        extra.push(link(n, orig, 1e-9, e));
        n++;
      } else if (a < e.nodes.length && b < e.nodes.length && a !== b) {
        const r = f.m === 'short' ? 1e-3 : Math.max(1e-6, +f.r || 1000);
        extra.push(link(e.nodes[a], e.nodes[b], 1 / r, e));
      }
    }
    if (extra.length) this.elements = this.elements.concat(extra);
    this.faultCount = extra.length;
    return n;
  }

  finishBuild(n) {
    const elements = this.elements;
    const externalNodes = n;
    // internal nodes
    for (const e of elements) {
      const c = e.internalNodeCount ? e.internalNodeCount() : 0;
      e.inodes = [];
      for (let i = 0; i < c; i++) e.inodes.push(n++);
    }
    this.nodeCount = n; // including ground (0)
    // branches
    let m = n - 1;
    for (const e of elements) {
      const c = e.branchCount ? e.branchCount() : 0;
      e.branches = [];
      for (let i = 0; i < c; i++) e.branches.push(m++);
    }
    this.size = m;
    this.externalNodes = externalNodes;
    this.findIslands();
    this.nonlinear = elements.filter((e) => e.nonlinear);
    this.A = new Float64Array(m * m);
    this.Alin = new Float64Array(m * m);
    this.b = new Float64Array(m);
    this.bStep = new Float64Array(m);
    this.x = new Float64Array(m);
    this.xPrev = new Float64Array(m);
    this.xIter = new Float64Array(m);
    this.lu = new RealLU(m);
    this.dirty = true;
    this.ready = true;
    for (const e of elements) {
      if (e.nodes.length >= 2 && e.shortCheck && e.nodes[0] === e.nodes[1]) {
        this.warnings.push(`${e.name} is short-circuited (both terminals on the same node).`);
      }
    }
    return this;
  }

  /** Tie every galvanically isolated island to ground so node voltages are defined. */
  findIslands() {
    const uf = new UnionFind();
    const N = this.nodeCount;
    for (let i = 0; i < N; i++) uf.find(i);
    for (const e of this.elements) {
      const groups = e.connectivity ? e.connectivity() : null;
      const all = [...e.nodes, ...e.inodes];
      if (!groups) { for (let i = 1; i < all.length; i++) uf.union(all[0], all[i]); continue; }
      for (const g of groups) {
        let first = null;
        for (const idx of g) {
          const nd = idx === 'gnd' ? 0 : typeof idx === 'string' && idx[0] === 'i' ? e.inodes[+idx.slice(1)] : e.nodes[idx];
          if (first === null) first = nd; else uf.union(first, nd);
        }
      }
    }
    this.groundTies = [];
    const seen = new Set([uf.find(0)]);
    // prefer the negative terminal of a source as reference
    const pref = [];
    for (const e of this.elements) if (e.refNode !== undefined) pref.push(e.nodes[e.refNode]);
    for (let i = 1; i < this.externalNodes; i++) pref.push(i);
    for (const nd of pref) {
      const r = uf.find(nd);
      if (seen.has(r)) continue;
      seen.add(r);
      this.groundTies.push(nd);
    }
    for (let i = this.externalNodes; i < N; i++) {
      const r = uf.find(i);
      if (!seen.has(r)) { seen.add(r); this.groundTies.push(i); }
    }
  }

  // --------------------------------------------------------------- stamping
  idx(node) { return node - 1; }
  addA(r, c, v) { if (r >= 0 && c >= 0) this.A[r * this.size + c] += v; }
  addB(r, v) { if (r >= 0) this.b[r] += v; }
  /** conductance between two nodes */
  addG(n1, n2, g) {
    const s = this.size, A = this.A, a = n1 - 1, c = n2 - 1;
    if (a >= 0) A[a * s + a] += g;
    if (c >= 0) A[c * s + c] += g;
    if (a >= 0 && c >= 0) { A[a * s + c] -= g; A[c * s + a] -= g; }
  }
  /** current i flowing from node nFrom through the element to node nTo */
  addI(nFrom, nTo, i) {
    if (nFrom > 0) this.b[nFrom - 1] -= i;
    if (nTo > 0) this.b[nTo - 1] += i;
  }
  /** VCCS: current g*(v(cp)-v(cn)) flows from nFrom to nTo through the element */
  addVCCS(nFrom, nTo, cp, cn, g) {
    const s = this.size, A = this.A, f = nFrom - 1, t = nTo - 1, p = cp - 1, q = cn - 1;
    if (f >= 0) { if (p >= 0) A[f * s + p] += g; if (q >= 0) A[f * s + q] -= g; }
    if (t >= 0) { if (p >= 0) A[t * s + p] -= g; if (q >= 0) A[t * s + q] += g; }
  }
  /** Voltage source v(np) - v(nn) = value, branch current k flows np -> source -> nn internally (out of np node). */
  addVSource(np, nn, k, value) {
    this.addBranchKCL(np, nn, k);
    this.addA(k, np - 1, 1); this.addA(k, nn - 1, -1);
    this.b[k] += value;
  }
  /** KCL contribution of a branch current k that leaves node np and enters node nn. */
  addBranchKCL(np, nn, k) {
    this.addA(np - 1, k, 1); this.addA(nn - 1, k, -1);
  }
  /**
   * Linearised nonlinear current I = f(V1..Vk) flowing from nFrom to nTo through the device.
   * ctrl: array of [nodeP, nodeN, g] where g = dI/dVj and Vj = v(nodeP)-v(nodeN) at the
   * linearisation point with values vj0 given in ctrlV.
   */
  addNLCurrent(nFrom, nTo, I0, ctrl) {
    let ieq = I0;
    for (const [p, q, g, v0] of ctrl) {
      this.addVCCS(nFrom, nTo, p, q, g);
      ieq -= g * v0;
    }
    this.addI(nFrom, nTo, ieq);
  }
  v(node) { return node > 0 ? this.x[node - 1] : 0; }
  vPrev(node) { return node > 0 ? this.xPrev[node - 1] : 0; }

  // ---------------------------------------------------------------- solving
  buildLinear() {
    this.A.fill(0);
    this.b.fill(0);
    const n = this.nodeCount;
    const gmin = this.opt.gmin + (this.extraGmin || 0);
    for (let i = 1; i < n; i++) this.A[(i - 1) * this.size + (i - 1)] += gmin;
    for (const nd of this.groundTies) this.addG(nd, 0, 1);
    for (const e of this.elements) if (e.stamp) e.stamp(this);
    this.Alin.set(this.A);
    this.linFactored = false;
    this.schurLin = 0; // the linear part must be eliminated again
    this.aClean = false;
    this.dirty = false;
  }

  /**
   * Matrix rows / columns the nonlinear parts write to: their own terminals, internal nodes
   * and branches, plus anything a trial stamp touches.
   */
  nlIndices() {
    const set = new Set();
    for (const e of this.nonlinear) {
      for (const nd of [...e.nodes, ...(e.inodes || [])]) if (nd > 0) set.add(nd - 1);
      for (const k of e.branches || []) set.add(k);
    }
    const m = this.size, A = this.A, b = this.b, a0 = Float64Array.from(A), b0 = Float64Array.from(b);
    A.fill(0); b.fill(0);
    for (const e of this.nonlinear) e.stampNL(this);
    for (let i = 0; i < m; i++) {
      if (b[i] !== 0) set.add(i);
      for (let j = 0; j < m; j++) if (A[i * m + j] !== 0) { set.add(i); set.add(j); }
    }
    A.set(a0); b.set(b0);
    return [...set].sort((x, y) => x - y);
  }

  /**
   * The Schur-complement solver for Newton iterations, ready for the current linear matrix,
   * or null when the full LU is the better (or only) choice.
   */
  schur() {
    if (this.schurOff || this.size < 24) return null;
    if (!this.tail) {
      this.tail = this.nlIndices();
      if (!this.tail.length || this.tail.length > 0.4 * this.size) { this.schurOff = true; return null; }
      this.sch = new SchurLU(this.size, this.tail);
      this.schurLin = 0; this.schurChecks = 0;
    }
    if (!this.schurLin) this.schurLin = this.sch.factorLinear(this.Alin) ? 1 : -1;
    return this.schurLin > 0 ? this.sch : null;
  }

  /**
   * Now and then make sure the nonlinear stamps stayed inside the tail block (a part could
   * write somewhere new); if not, widen the tail. Returns false when this solve must use the
   * full LU.
   */
  schurValid() {
    if ((this.schurChecks++ & 31) !== 0 && this.schurChecks > 8) return true;
    const m = this.size, A = this.A, L = this.Alin, isT = new Uint8Array(m), extra = new Set();
    for (const t of this.tail) isT[t] = 1;
    for (let i = 0; i < m; i++) {
      if (!isT[i] && this.b[i] !== this.bStep[i]) extra.add(i);
      const ri = i * m;
      for (let j = 0; j < m; j++) if (A[ri + j] !== L[ri + j] && !(isT[i] && isT[j])) { extra.add(i); extra.add(j); }
    }
    if (!extra.size) return true;
    this.tail = [...new Set([...this.tail, ...extra])].sort((x, y) => x - y);
    if (this.tail.length > 0.4 * m) this.schurOff = true;
    else { this.sch = new SchurLU(m, this.tail); this.schurLin = 0; }
    return false;
  }

  buildStepRHS() {
    this.b.fill(0);
    for (const e of this.elements) if (e.stampStep) e.stampStep(this);
    this.bStep.set(this.b);
  }

  /** Solve the MNA system at the current time point. Returns true on convergence. */
  solvePoint(maxIter) {
    const m = this.size;
    // nothing to solve (every part on ground): the parts still take their step values (a source's
    // current), or their readings stay undefined
    if (m === 0) { this.buildStepRHS(); return true; }
    if (this.dirty) this.buildLinear();
    this.buildStepRHS();
    if (this.nonlinear.length === 0) {
      if (!this.linFactored) {
        // a sparse-ordered factorisation for bigger circuits (the dense one names a singular part)
        if (m >= 24) this.linSch = this.linSch || new SchurLU(m, []);
        this.linFactored = m >= 24 && this.linSch.factorLinear(this.Alin) ? 'sparse' : 'dense';
        if (this.linFactored === 'dense' && !this.lu.factor(this.Alin)) { this.linFactored = false; return this.singular(); }
      }
      (this.linFactored === 'sparse' ? this.linSch : this.lu).solveRefined(this.Alin, this.bStep, this.x, 1);
      return this.checkFinite();
    }
    const { reltol, vntol, abstol } = this.opt;
    const nNodes = this.nodeCount - 1;
    const xn = this.xIter;
    for (let it = 0; it < maxIter; it++) {
      // only the nonlinear parts' rows change between iterations: solve through the small
      // Schur complement when that works (and then only its block needs resetting), else
      // factor the whole matrix
      const sch = this.schur();
      if (sch && this.aClean) sch.restoreTail(this.A, this.Alin); else this.A.set(this.Alin);
      this.aClean = !!sch;
      this.b.set(this.bStep);
      this.limited = false;
      for (const e of this.nonlinear) e.stampNL(this);
      if (sch && this.schurValid() && sch.factor(this.A, this.Alin)) sch.solveRefined(this.A, this.b, xn, 2);
      else {
        this.aClean = false;
        if (!this.lu.factor(this.A)) return this.singular();
        this.lu.solveRefined(this.A, this.b, xn, 2);
      }
      let conv = !this.limited && it > 0;
      for (let i = 0; i < m && conv; i++) {
        const tol = i < nNodes ? vntol : abstol;
        if (Math.abs(xn[i] - this.x[i]) > reltol * Math.max(Math.abs(xn[i]), Math.abs(this.x[i])) + tol) conv = false;
      }
      this.x.set(xn);
      if (!this.checkFinite()) return false;
      if (conv) { this.iterations = it + 1; return true; }
    }
    // Newton stalled on the update criterion. This happens when a node is only
    // weakly defined (e.g. every diode of a floating bridge is off) and rounding
    // noise moves its voltage. Accept the point if every equation's residual is
    // negligible relative to the currents / voltages acting in that row.
    return this.residualConverged();
  }

  residualConverged() {
    const m = this.size, n = m, A = this.A, b = this.b, x = this.x;
    const { reltol, abstol, vntol } = this.opt;
    const nNodes = this.nodeCount - 1;
    this.A.set(this.Alin);
    this.b.set(this.bStep);
    this.limited = false;
    for (const e of this.nonlinear) e.stampNL(this);
    if (this.limited) return false;
    for (let i = 0; i < m; i++) {
      let r = -b[i], scale = Math.abs(b[i]);
      const ri = i * n;
      for (let j = 0; j < m; j++) {
        const t = A[ri + j] * x[j];
        r += t; scale += Math.abs(t);
      }
      const tol = reltol * scale + (i < nNodes ? abstol : vntol);
      if (!(Math.abs(r) <= tol)) return false;
    }
    this.iterations = this.opt.maxIter;
    return true;
  }

  checkFinite() {
    for (let i = 0; i < this.size; i++) {
      if (!Number.isFinite(this.x[i]) || Math.abs(this.x[i]) > 1e12) {
        this.error = this.describeUnknown(i, 'Solution diverged near');
        return false;
      }
    }
    return true;
  }

  singular() {
    const row = this.lu.singularRow;
    this.error = this.describeUnknown(row, 'Circuit cannot be solved (singular matrix) near');
    this.fatal = true;
    return false;
  }

  describeUnknown(i, prefix) {
    const nNodes = this.nodeCount - 1;
    if (i < 0) return prefix + ' the circuit.';
    if (i >= nNodes) {
      const e = this.elements.find((el) => el.branches && el.branches.includes(i));
      if (e) {
        this.errorElement = e;
        return `${prefix} ${e.name}. Check for loops of voltage sources/inductors or parallel ideal sources.`;
      }
      return prefix + ' a voltage source.';
    }
    const node = i + 1;
    const e = this.elements.find((el) => el.nodes.includes(node) || (el.inodes && el.inodes.includes(node)));
    if (e) this.errorElement = e;
    return `${prefix} ${e ? e.name : 'node ' + node}. Check for floating current sources or open circuits.`;
  }

  // ------------------------------------------------------------ analyses
  reset() {
    this.t = 0;
    this.error = null;
    this.fatal = false;
    this.errorElement = null;
    this.x.fill(0);
    this.xPrev.fill(0);
    this.beSteps = 0;
    for (const e of this.elements) { e._hav = 0; e.stress = 0; if (e.reset) e.reset(this); }
    this.damageLog = [];
    this.dirty = true;
  }

  /** DC operating point: capacitors open, inductors shorted. */
  dcOperatingPoint() {
    this.mode = 'dc';
    this.dirty = true;
    this.srcScale = 1;
    let ok = false;
    for (let pass = 0; pass < 8; pass++) {
      for (const e of this.elements) if (e.preStep) e.preStep(this);
      if (this.dirty) this.buildLinear();
      ok = this.solvePoint(this.opt.dcMaxIter);
      if (!ok && !this.fatal) ok = this.gminStepping();
      if (!ok && !this.fatal) ok = this.sourceStepping();
      if (!ok) break;
      // settle digital states that depend on the solution
      let changed = false;
      if (pass < 3) {
        for (const e of this.elements) if (e.digitalSettle && e.digitalSettle(this)) changed = true;
      } else {
        // Updating every gate at once never settles a symmetric feedback loop (a NOR latch
        // flips 11 → 00 → 11 … forever). Settle one element at a time, re-solving after each
        // change, so the loop falls into one of its stable states like a real circuit does.
        for (const e of this.elements) {
          if (!e.digitalSettle || !e.digitalSettle(this)) continue;
          changed = true;
          this.dirty = true;
          ok = this.solvePoint(this.opt.dcMaxIter);
          if (!ok) break;
        }
        if (!ok) break;
      }
      if (!changed) break;
    }
    // A node with no DC path (a current source charging a capacitor) is only held by gmin, at
    // I / gmin: gigavolts that would burst every part at t = 0. No real operating point is that
    // far out: start from zero instead, as the circuit would at power-on.
    if (ok) for (let i = 0; i < this.size; i++) if (Math.abs(this.x[i]) > 1e7) { ok = false; this.opNoDcPath = true; break; }
    if (ok) {
      for (const e of this.elements) if (e.accept) e.accept(this);
      this.xPrev.set(this.x);
    }
    this.mode = 'tran';
    this.dirty = true;
    return ok;
  }

  gminStepping() {
    const saved = this.extraGmin;
    let ok = false;
    for (let g = 1e-2; g >= 1e-13; g /= 10) {
      this.extraGmin = g >= 1e-12 ? g : 0;
      this.dirty = true;
      ok = this.solvePoint(this.opt.dcMaxIter);
      if (!ok) break;
    }
    this.extraGmin = saved || 0;
    this.dirty = true;
    if (ok) ok = this.solvePoint(this.opt.dcMaxIter);
    return ok;
  }

  sourceStepping() {
    this.x.fill(0);
    let ok = false;
    for (let s = 1; s <= 20; s++) {
      this.srcScale = s / 20;
      ok = this.solvePoint(this.opt.dcMaxIter * 2);
      if (!ok) break;
    }
    this.srcScale = 1;
    return ok;
  }

  /** Initialise transient analysis at t = 0. */
  start() {
    this.reset();
    let ok = true;
    this.opFallback = false; this.opNoDcPath = false;
    if (this.opt.initialDC) ok = this.dcOperatingPoint();
    if (!ok) {
      if (this.fatal) return false;
      // DC operating point did not converge: fall back to a power-on (zero state) start, which runs
      // (so the start succeeded; opFallback says it is not an operating point)
      this.error = null;
      this.reset();
      this.opFallback = true;
      this.warnings.push(this.opNoDcPath
        ? 'A node has no DC path to ground (a capacitor fed by a current source?); starting from zero initial conditions.'
        : 'DC operating point did not converge; starting from zero initial conditions.');
    }
    this.mode = 'tran';
    this.dirty = true;
    this.started = true;
    this.beSteps = 2; // start with backward Euler: initial capacitor currents are unknown
    return true;
  }

  /** Advance one timestep dt (with automatic step halving on non-convergence). */
  step(dt) {
    if (this.fatal) return false;
    return this.stepInner(dt, 0);
  }

  stepInner(dt, depth) {
    this.mode = 'tran';
    if (dt !== this.dt) { this.dt = dt; this.dirty = true; }
    const method = this.beSteps > 0 ? 'be' : this.opt.method;
    if (method !== this.curMethod) { this.curMethod = method; this.dirty = true; }
    this.method = method;
    this.tNext = this.t + dt;
    for (const e of this.elements) if (e.preStep) e.preStep(this);
    this.x.set(this.xPrev);
    const ok = this.solvePoint(this.opt.maxIter);
    if (!ok) {
      if (this.fatal) return false;
      if (depth < 6) {
        this.x.set(this.xPrev);
        this.error = null;
        if (!this.stepInner(dt / 2, depth + 1)) return false;
        const r = this.stepInner(dt / 2, depth + 1);
        // the step taken is dt (as the meters and the power table count it); the matrix was stamped
        // for dt / 2, so stamp it again
        this.dt = dt; this.dirty = true;
        return r;
      }
      if (!this.error) this.error = 'Simulation failed to converge. Try a smaller timestep.';
      return false;
    }
    this.t += dt;
    this.event = false;
    for (const e of this.elements) if (e.accept) e.accept(this);
    if (method === 'trap') this.watchRinging(); else if (this.zig) this.zig.fill(0);
    this.xPrev.set(this.x);
    if (this.beSteps > 0) this.beSteps--;
    if (this.event) this.beSteps = 2; // damp trapezoidal ringing after discontinuities
    return true;
  }

  /** Called by elements whose discrete state changed (switches, logic). */
  markEvent() { this.dirty = true; this.event = true; }

  /**
   * The trapezoidal rule does not damp a capacitor held by an ideal source (a regulator's
   * output capacitor) or a time constant far below the step (a MOSFET gate): a leftover error
   * then flips sign every step for ever, and RMS labels show currents that are not there.
   * A real signal never zig-zags at the step rate (there are ≥ 200 steps per period), so when
   * an unknown does it for six steps in a row, take two damped backward-Euler steps.
   */
  watchRinging() {
    const m = this.size, x = this.x, xp = this.xPrev, nN = this.nodeCount - 1;
    if (!this.zig || this.zig.length !== m) { this.zig = new Uint8Array(m); this.dLast = new Float64Array(m); }
    const { reltol, vntol, abstol } = this.opt;
    let ring = false;
    for (let j = 0; j < m; j++) {
      const d = x[j] - xp[j], dl = this.dLast[j];
      const tol = 10 * (reltol * Math.abs(x[j]) + (j < nN ? vntol : abstol));
      if (d * dl < 0 && Math.abs(d) > tol && Math.abs(dl) > tol) { if (++this.zig[j] >= 6) ring = true; } else this.zig[j] = 0;
      this.dLast[j] = d;
    }
    if (ring) { this.beSteps = 2; this.zig.fill(0); }
  }

  /**
   * A change made from outside a step (the user tapped a switch or changed a value). Like
   * markEvent, the next steps use backward Euler: the trapezoidal rule never damps an
   * inductor whose current was just cut, so it would ring at ±kV from step to step forever.
   */
  discontinuity() { this.dirty = true; this.beSteps = Math.max(this.beSteps || 0, 2); }

  nodeVoltage(node) { return node > 0 && node < this.nodeCount ? this.x[node - 1] : 0; }

  // -------------------------------------------------------------- AC sweep
  /**
   * Small-signal AC analysis around the present operating point.
   * inputEl: source element driven with 1∠0; outNode(+), refNode(-). Returns array of {f, re, im}.
   */
  acSweep(inputEl, outNode, refNode, fStart, fStop, pointsPerDecade = 40) {
    const res = [];
    const decades = Math.log10(fStop / fStart);
    const N = Math.max(2, Math.round(decades * pointsPerDecade) + 1);
    for (let i = 0; i < N; i++) {
      const f = fStart * Math.pow(10, (decades * i) / (N - 1));
      const sol = this.acSolve(2 * Math.PI * f, inputEl);
      if (!sol) return null;
      const vr = (outNode > 0 ? sol.re[outNode - 1] : 0) - (refNode > 0 ? sol.re[refNode - 1] : 0);
      const vi = (outNode > 0 ? sol.im[outNode - 1] : 0) - (refNode > 0 ? sol.im[refNode - 1] : 0);
      res.push({ f, re: vr, im: vi, sol });
    }
    return res;
  }

  /** Small-signal impedance between two nodes (independent sources zeroed). */
  impedance(nA, nB, f = 1e-3) {
    if (nA === nB) return { re: 0, im: 0 };
    const sol = this.acSolve(2 * Math.PI * f, null, (ac) => ac.addI(nB, nA, 1));
    if (!sol) return null;
    const g = (n) => [n > 0 ? sol.re[n - 1] : 0, n > 0 ? sol.im[n - 1] : 0];
    const [ar, ai] = g(nA), [br, bi] = g(nB);
    return { re: ar - br, im: ai - bi };
  }

  /** The stamping interface of a complex MNA system, writing through addA / addB. */
  acStamper(omega, inputEl, addA, addB, phasor = null) {
    return {
      sim: this, size: this.size, input: inputEl, omega, phasor,
      addA, addB,
      addY(n1, n2, g, bb = 0) {
        const a = n1 - 1, c = n2 - 1;
        this.addA(a, a, g, bb); this.addA(c, c, g, bb);
        this.addA(a, c, -g, -bb); this.addA(c, a, -g, -bb);
      },
      addVCCS(nFrom, nTo, cp, cn, g, gi = 0) {
        const f = nFrom - 1, t = nTo - 1, p = cp - 1, q = cn - 1;
        this.addA(f, p, g, gi); this.addA(f, q, -g, -gi);
        this.addA(t, p, -g, -gi); this.addA(t, q, g, gi);
      },
      addBranchKCL(np, nn, k) { this.addA(np - 1, k, 1); this.addA(nn - 1, k, -1); },
      addVSource(np, nn, k, mag) {
        this.addBranchKCL(np, nn, k);
        this.addA(k, np - 1, 1); this.addA(k, nn - 1, -1);
        this.addB(k, mag);
      },
      addI(nFrom, nTo, mag) { this.addB(nFrom - 1, -mag); this.addB(nTo - 1, mag); },
      v: (n) => this.v(n),
    };
  }

  /**
   * One complex MNA solve at angular frequency omega. inputEl: the one source driven with 1∠0°
   * (a Bode plot); opts.phasor: every independent source at its own phasor instead (sinusoidal
   * steady state, { only: el } for one source alone, as in superposition).
   */
  acSolve(omega, inputEl, extra, opts = {}) {
    const m = this.size;
    const re = new Float64Array(m * m), im = new Float64Array(m * m);
    const br = new Float64Array(m), bi = new Float64Array(m);
    const ac = this.acStamper(omega, inputEl,
      (r, c, a, b = 0) => { if (r >= 0 && c >= 0) { re[r * m + c] += a; im[r * m + c] += b; } },
      (r, a, b = 0) => { if (r >= 0) { br[r] += a; bi[r] += b; } },
      opts.phasor || null);
    for (let k = 1; k < this.nodeCount; k++) re[(k - 1) * m + (k - 1)] += this.opt.gmin;
    for (const nd of this.groundTies) ac.addY(nd, 0, 1);
    for (const e of this.elements) {
      if (e.stampAC) e.stampAC(ac);
      else for (const k of e.branches || []) ac.addA(k, k, 1); // no small-signal model: branch treated as open
    }
    if (extra) extra(ac);
    return complexSolve(m, re, im, br, bi);
  }

  /**
   * Sinusoidal steady state at ω (rad/s; 0 = DC) with every independent source at its phasor
   * (book convention: peak, cosine reference), or only `only`. Returns null when it has no
   * solution, else { omega, node(n) → [re, im], current(e, k = 0) → the phasor current flowing
   * into part e at its terminal k, voltage(e, a = 0, b = 1) → V across two of its terminals }.
   */
  phasorSolve(omega, only = null) {
    const sol = this.acSolve(omega, null, null, { phasor: { only } });
    if (!sol) return null;
    const x = (k) => (k >= 0 ? [sol.re[k], sol.im[k]] : [0, 0]);
    const node = (n) => (n > 0 ? x(n - 1) : [0, 0]);
    const current = (e, k = 0) => {
      const n = e.nodes?.[k];
      if (n == null) return [0, 0];
      if (n === 0) {
        // on ground: what goes in at the others comes out here (two terminals: the other one)
        if (e.nodes.length !== 2) return [NaN, NaN];
        const o = current(e, 1 - k);
        return [-o[0], -o[1]];
      }
      const row = n - 1;
      let cr = 0, ci = 0;
      const rec = this.acStamper(omega, null,
        (r, c, a, b = 0) => { if (r === row && c >= 0) { const [xr, xi] = x(c); cr += a * xr - b * xi; ci += a * xi + b * xr; } },
        (r, a, b = 0) => { if (r === row) { cr -= a; ci -= b; } },
        { only });
      if (e.stampAC) e.stampAC(rec);
      return [cr, ci];
    };
    const voltage = (e, a = 0, b = 1) => { const p = node(e.nodes?.[a] ?? 0), q = node(e.nodes?.[b] ?? 0); return [p[0] - q[0], p[1] - q[1]]; };
    return { omega, node, current, voltage, raw: sol };
  }

  /** DC sweep of an element parameter. Returns [{x, y}] measuring probe(sim). */
  dcSweep(el, param, from, to, steps, probe) {
    const orig = el.p[param];
    const out = [];
    this.reset();
    for (let i = 0; i <= steps; i++) {
      const val = from + ((to - from) * i) / steps;
      el.p[param] = val;
      if (el.onParamChange) el.onParamChange(param);
      this.mode = 'dc';
      this.dirty = true;
      this.srcScale = 1;
      for (const e of this.elements) if (e.preStep) e.preStep(this);
      let ok = this.solvePoint(this.opt.dcMaxIter);
      if (!ok && !this.fatal) ok = this.gminStepping();
      if (!ok) { out.push({ x: val, y: NaN }); this.error = null; continue; }
      for (const e of this.elements) if (e.accept) e.accept(this);
      out.push({ x: val, y: probe(this) });
    }
    el.p[param] = orig;
    if (el.onParamChange) el.onParamChange(param);
    this.mode = 'tran';
    this.dirty = true;
    return out;
  }
}

// --------------------------------------------------------- device helpers
export const VT = 0.025852; // thermal voltage at 300 K

/** SPICE junction voltage limiting (pnjlim). */
export function pnjlim(vnew, vold, vt, vcrit) {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    } else {
      vnew = vt * Math.log(vnew / vt);
    }
    return { v: vnew, limited: true };
  }
  return { v: vnew, limited: false };
}

export function vcrit(n, is) {
  const nvt = n * VT;
  return nvt * Math.log(nvt / (Math.SQRT2 * is));
}
