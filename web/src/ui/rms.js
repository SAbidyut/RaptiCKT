// Windowed true-RMS of every net voltage and part current over exactly one
// period of the circuit's AC supply. Used for the live labels in AC circuits,
// so a 230 V : 12 V transformer reads 12 V instead of a swinging peak value.

export class RmsTracker {
  /**
   * @param {number} period  window length in seconds (one cycle of the lowest AC frequency)
   * @param {number} nodes   node count of the simulator (node 0 = ground)
   * @param {Array} parts    elements whose liveCurrent() is tracked
   */
  constructor(period, nodes, parts) {
    this.T = period;
    this.nodes = nodes;
    this.parts = parts;
    this.slots = nodes + parts.length;
    this.width = 2 * this.slots; // per slot: [v²·dt, v·dt]
    this.cap = 64;
    this.buf = new Float64Array(this.cap * this.width); // dt-weighted squares per sample
    this.dts = new Float64Array(this.cap);
    this.sum = new Float64Array(this.width);
    this.head = 0; // index of the oldest sample
    this.n = 0;
    this.span = 0; // seconds covered by the window
    this.partIndex = new Map(parts.map((p, i) => [p, nodes + i]));
  }

  grow() {
    const cap = this.cap * 2, w = this.width;
    const buf = new Float64Array(cap * w), dts = new Float64Array(cap);
    for (let k = 0; k < this.n; k++) {
      const src = (this.head + k) % this.cap;
      buf.set(this.buf.subarray(src * w, src * w + w), k * w);
      dts[k] = this.dts[src];
    }
    this.buf = buf; this.dts = dts; this.cap = cap; this.head = 0;
  }

  sample(sim, dt) {
    if (!(dt > 0)) return;
    if (this.n === this.cap) {
      if (this.cap < 65536) this.grow();
      else this.drop();
    }
    const w = this.width, slot = (this.head + this.n) % this.cap, o = slot * w;
    const put = (k, v) => {
      const q = v * v * dt, l = v * dt, a = o + 2 * k;
      this.buf[a] = q; this.buf[a + 1] = l; this.sum[2 * k] += q; this.sum[2 * k + 1] += l;
    };
    for (let k = 1; k < this.nodes; k++) put(k, sim.nodeVoltage(k));
    for (let j = 0; j < this.parts.length; j++) {
      const i = this.parts[j].liveCurrent();
      put(this.nodes + j, Number.isFinite(i) ? i : 0);
    }
    this.dts[slot] = dt;
    this.n++;
    this.span += dt;
    // keep exactly one period (plus the newest step)
    while (this.n > 1 && this.span - this.dts[this.head] >= this.T) this.drop();
  }

  drop() {
    const w = this.width, o = this.head * w;
    for (let k = 0; k < w; k++) this.sum[k] -= this.buf[o + k];
    this.span -= this.dts[this.head];
    this.head = (this.head + 1) % this.cap;
    this.n--;
  }

  /** true once a whole cycle has been simulated */
  get ready() { return this.span >= this.T * 0.999; }

  rmsOf(k) { return this.span > 0 ? Math.sqrt(Math.max(0, this.sum[2 * k]) / this.span) : 0; }
  meanOf(k) { return this.span > 0 ? this.sum[2 * k + 1] / this.span : 0; }
  /**
   * Reading for one slot: mostly-DC quantities (e.g. a smoothed rectifier output) give their
   * average, signed; AC quantities give their RMS. { v, ac }
   */
  reading(k) {
    const r = this.rmsOf(k), m = this.meanOf(k);
    return Math.abs(m) >= 0.7 * r ? { v: m, ac: false } : { v: r, ac: true };
  }
  node(node) { return node > 0 && node < this.nodes ? this.reading(node) : { v: 0, ac: false }; }
  part(el) { const k = this.partIndex.get(el); return k == null ? null : this.reading(k); }
}

/** Lowest frequency of the sinusoidal supplies in a circuit, or 0 when there is none. */
export function acFrequency(elements) {
  let f = Infinity;
  for (const e of elements) {
    const p = e.p, cat = e.constructor.category;
    if (cat !== 'Sources' || !(p.freq > 0)) continue;
    if (p.wave !== undefined && p.wave !== 'sine') continue; // square/pulse/sweep/noise are not "AC supplies"
    f = Math.min(f, p.freq);
  }
  return f < Infinity ? f : 0;
}
