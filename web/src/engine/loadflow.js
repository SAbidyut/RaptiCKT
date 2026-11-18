// Load flow (power flow) analysis of a power system given as bus and branch data.
//
// Methods: Gauss–Seidel (with acceleration), Newton–Raphson (polar form),
// Fast Decoupled (XB) and DC load flow. Powers are entered in MW / Mvar,
// impedances in per unit on the system MVA base, as in MATPOWER and the
// IEEE common data format.
//
// Branch model (MATPOWER): series ys = 1/(R + jX), total line charging B split
// as jB/2 at each end, off-nominal tap t = ratio·e^{jφ} on the from side:
//   Yff = (ys + jB/2) / |t|²   Yft = -ys / t*   Ytf = -ys / t   Ytt = ys + jB/2
// Bus shunts Gs + jBs are the MW / Mvar drawn at 1 pu voltage.

export const METHODS = [
  { id: 'nr', name: 'Newton–Raphson', short: 'NR' },
  { id: 'gs', name: 'Gauss–Seidel', short: 'GS' },
  { id: 'fd', name: 'Fast Decoupled', short: 'FDLF' },
  { id: 'dc', name: 'DC load flow', short: 'DC' },
];

export const DEFAULT_OPTIONS = { method: 'nr', tol: 1e-6, maxIter: 0, accel: 1.6, qLimits: false, flatStart: true, vMin: 0.95, vMax: 1.1 };

const D2R = Math.PI / 180;
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// ------------------------------------------------------------ dense solver
/** LU factorisation with partial pivoting of an n×n matrix stored as an array of rows. */
export function luFactor(A) {
  const n = A.length, a = A.map((r) => Float64Array.from(r)), piv = new Int32Array(n);
  for (let k = 0; k < n; k++) {
    let p = k, m = Math.abs(a[k][k]);
    for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > m) { m = Math.abs(a[i][k]); p = i; }
    if (m < 1e-14) throw new Error('singular matrix (an isolated bus or a part of the network with no path to the slack bus)');
    piv[k] = p;
    if (p !== k) { const t = a[p]; a[p] = a[k]; a[k] = t; }
    const rk = a[k], d = rk[k];
    for (let i = k + 1; i < n; i++) {
      const ri = a[i], f = (ri[k] /= d);
      if (f) for (let j = k + 1; j < n; j++) ri[j] -= f * rk[j];
    }
  }
  return { n, a, piv };
}

export function luSolve({ n, a, piv }, b) {
  const x = Float64Array.from(b);
  for (let k = 0; k < n; k++) { const p = piv[k]; if (p !== k) { const t = x[p]; x[p] = x[k]; x[k] = t; } }
  for (let i = 0; i < n; i++) { let s = x[i]; const r = a[i]; for (let j = 0; j < i; j++) s -= r[j] * x[j]; x[i] = s; }
  for (let i = n - 1; i >= 0; i--) { let s = x[i]; const r = a[i]; for (let j = i + 1; j < n; j++) s -= r[j] * x[j]; x[i] = s / r[i]; }
  return x;
}

// ------------------------------------------------------------ checking input
/** Problems that stop a load flow from being run; an empty list means the data is usable. */
export function validate(sys) {
  const errs = [];
  const buses = sys.buses || [], br = sys.branches || [];
  if (!(num(sys.baseMVA) > 0)) errs.push('Base MVA must be positive.');
  if (buses.length < 2) errs.push('Add at least two buses.');
  const ids = new Set();
  for (const b of buses) {
    if (ids.has(b.id)) errs.push(`Bus number ${b.id} is used twice.`);
    ids.add(b.id);
    if (b.type !== 'pq' && !(num(b.V) > 0)) errs.push(`Bus ${b.id}: the specified voltage must be positive.`);
  }
  const slack = buses.filter((b) => b.type === 'slack');
  if (slack.length === 0) errs.push('One bus must be the slack (swing) bus.');
  if (slack.length > 1) errs.push(`Only one slack bus is allowed (found ${slack.length}: buses ${slack.map((b) => b.id).join(', ')}).`);
  br.forEach((l, i) => {
    if (l.on === false) return;
    const n = `Branch ${i + 1} (${l.from}–${l.to})`;
    if (!ids.has(l.from) || !ids.has(l.to)) errs.push(`${n}: connects a bus that does not exist.`);
    if (l.from === l.to) errs.push(`${n}: both ends are on the same bus.`);
    if (!num(l.R) && !num(l.X)) errs.push(`${n}: R and X cannot both be zero.`);
  });
  if (!errs.length) {
    const isl = islands(sys);
    if (isl.length > 1) errs.push(`The network is split into ${isl.length} separate parts; buses ${isl.slice(1).flat().join(', ')} have no path to the slack bus.`);
  }
  return errs;
}

/** Groups of bus ids joined by in-service branches; the group holding the slack bus comes first. */
export function islands(sys) {
  const adj = new Map(sys.buses.map((b) => [b.id, []]));
  for (const l of sys.branches) if (l.on !== false && adj.has(l.from) && adj.has(l.to)) { adj.get(l.from).push(l.to); adj.get(l.to).push(l.from); }
  const seen = new Set(), out = [];
  const slack = sys.buses.find((b) => b.type === 'slack');
  const order = slack ? [slack.id, ...sys.buses.map((b) => b.id)] : sys.buses.map((b) => b.id);
  for (const s of order) {
    if (seen.has(s)) continue;
    const g = [], st = [s];
    seen.add(s);
    while (st.length) { const u = st.pop(); g.push(u); for (const v of adj.get(u)) if (!seen.has(v)) { seen.add(v); st.push(v); } }
    out.push(g.sort((a, b) => a - b));
  }
  return out;
}

// ------------------------------------------------------------ admittance matrix
function branchY(l) {
  const r = num(l.R), x = num(l.X), d = r * r + x * x;
  const gs = r / d, bs = -x / d, bc = num(l.B) / 2;
  const ratio = num(l.tap) || 1, ph = num(l.shift) * D2R;
  const tr = ratio * Math.cos(ph), ti = ratio * Math.sin(ph), t2 = ratio * ratio;
  // ys / t*  and  ys / t
  const a = { re: (gs * tr - bs * ti) / t2, im: (bs * tr + gs * ti) / t2 }; // ys / conj(t)
  const b = { re: (gs * tr + bs * ti) / t2, im: (bs * tr - gs * ti) / t2 }; // ys / t
  return {
    ff: { re: gs / t2, im: (bs + bc) / t2 },
    ft: { re: -a.re, im: -a.im },
    tf: { re: -b.re, im: -b.im },
    tt: { re: gs, im: bs + bc },
  };
}

/** Bus admittance matrix in per unit: { n, G, B } with G, B arrays of rows, in bus-list order. */
export function buildYbus(sys) {
  const n = sys.buses.length, idx = new Map(sys.buses.map((b, i) => [b.id, i]));
  const G = Array.from({ length: n }, () => new Float64Array(n)), B = Array.from({ length: n }, () => new Float64Array(n));
  const base = num(sys.baseMVA, 100);
  sys.buses.forEach((b, i) => { G[i][i] += num(b.Gs) / base; B[i][i] += num(b.Bs) / base; });
  for (const l of sys.branches) {
    if (l.on === false) continue;
    const f = idx.get(l.from), t = idx.get(l.to);
    if (f === undefined || t === undefined) continue;
    const y = branchY(l);
    G[f][f] += y.ff.re; B[f][f] += y.ff.im;
    G[f][t] += y.ft.re; B[f][t] += y.ft.im;
    G[t][f] += y.tf.re; B[t][f] += y.tf.im;
    G[t][t] += y.tt.re; B[t][t] += y.tt.im;
  }
  return { n, G, B, idx };
}

// injections P + jQ at every bus for voltages (Vm, Va)
function injections(Y, Vm, Va) {
  const n = Y.n, P = new Float64Array(n), Q = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const Gi = Y.G[i], Bi = Y.B[i];
    let p = 0, q = 0;
    for (let k = 0; k < n; k++) {
      if (!Gi[k] && !Bi[k]) continue;
      const d = Va[i] - Va[k], c = Math.cos(d), s = Math.sin(d);
      p += Vm[k] * (Gi[k] * c + Bi[k] * s);
      q += Vm[k] * (Gi[k] * s - Bi[k] * c);
    }
    P[i] = Vm[i] * p; Q[i] = Vm[i] * q;
  }
  return { P, Q };
}

// ------------------------------------------------------------ problem set-up
function setup(sys, opts) {
  const base = num(sys.baseMVA, 100), buses = sys.buses, n = buses.length;
  const type = buses.map((b) => b.type);
  const Psp = new Float64Array(n), Qsp = new Float64Array(n), Vm = new Float64Array(n), Va = new Float64Array(n);
  buses.forEach((b, i) => {
    Psp[i] = (num(b.Pg) - num(b.Pd)) / base;
    Qsp[i] = (num(b.Qg) - num(b.Qd)) / base;
    const vs = num(b.V, 1) || 1;
    Vm[i] = b.type === 'pq' ? (opts.flatStart ? 1 : vs) : vs;
    Va[i] = b.type === 'slack' ? num(b.ang) * D2R : (opts.flatStart ? num(buses.find((x) => x.type === 'slack')?.ang) * D2R : num(b.ang) * D2R);
  });
  return { base, n, type, Psp, Qsp, Vm, Va };
}

const maxAbs = (a) => { let m = 0; for (const v of a) if (Math.abs(v) > m) m = Math.abs(v); return m; };

// largest power mismatch (pu) of the current state
function mismatch(Y, st) {
  const { P, Q } = injections(Y, st.Vm, st.Va);
  let m = 0;
  for (let i = 0; i < st.n; i++) {
    if (st.type[i] === 'slack') continue;
    m = Math.max(m, Math.abs(st.Psp[i] - P[i]));
    if (st.type[i] === 'pq') m = Math.max(m, Math.abs(st.Qsp[i] - Q[i]));
  }
  return m;
}

const snap = (it, mis, st, extra) => ({ it, mis, Vm: Array.from(st.Vm), Va: Array.from(st.Va, (a) => a / D2R), ...extra });

// ------------------------------------------------------------ Gauss–Seidel
function gaussSeidel(Y, st, opts) {
  const { n, type, Psp, Vm, Va } = st, G = Y.G, B = Y.B, alpha = opts.accel || 1, history = [];
  const vr = new Float64Array(n), vi = new Float64Array(n);
  for (let i = 0; i < n; i++) { vr[i] = Vm[i] * Math.cos(Va[i]); vi[i] = Vm[i] * Math.sin(Va[i]); }
  const vSpec = Float64Array.from(Vm);
  const sync = () => { for (let i = 0; i < n; i++) { Vm[i] = Math.hypot(vr[i], vi[i]); Va[i] = Math.atan2(vi[i], vr[i]); } };
  history.push(snap(0, mismatch(Y, st), st, { dV: NaN }));
  for (let it = 1; it <= opts.maxIter; it++) {
    let dV = 0;
    for (let i = 0; i < n; i++) {
      if (type[i] === 'slack') continue;
      // Σ_{k≠i} Y_ik V_k
      let sr = 0, si = 0;
      const Gi = G[i], Bi = B[i];
      for (let k = 0; k < n; k++) {
        if (k === i || (!Gi[k] && !Bi[k])) continue;
        sr += Gi[k] * vr[k] - Bi[k] * vi[k];
        si += Gi[k] * vi[k] + Bi[k] * vr[k];
      }
      let q = st.Qsp[i];
      if (type[i] === 'pv') {
        // Q_i = -Im{ V_i* Σ_k Y_ik V_k }
        const tr = sr + Gi[i] * vr[i] - Bi[i] * vi[i], ti = si + Gi[i] * vi[i] + Bi[i] * vr[i];
        q = -(vr[i] * ti - vi[i] * tr);
        st.Qsp[i] = q;
      }
      // V_i = [ (P - jQ) / V_i*  - Σ ] / Y_ii
      const m2 = vr[i] * vr[i] + vi[i] * vi[i];
      const ar = (Psp[i] * vr[i] + q * vi[i]) / m2 - sr; // (P - jQ)/conj(V) = (P - jQ) V / |V|²
      const ai = (Psp[i] * vi[i] - q * vr[i]) / m2 - si;
      const d = Gi[i] * Gi[i] + Bi[i] * Bi[i];
      // Y_ii = 0 (a line's charging cancelling its reactance): Gauss–Seidel cannot divide by it
      if (!(d > 1e-20)) throw new Error(`Gauss–Seidel cannot solve this system: the self-admittance Y_ii of bus number ${i + 1} is zero (the line charging cancels the line reactance)`);
      let nr = (ar * Gi[i] + ai * Bi[i]) / d, ni = (ai * Gi[i] - ar * Bi[i]) / d;
      if (type[i] === 'pv') { const m = Math.hypot(nr, ni) || 1; nr *= vSpec[i] / m; ni *= vSpec[i] / m; } else { nr = vr[i] + alpha * (nr - vr[i]); ni = vi[i] + alpha * (ni - vi[i]); }
      dV = Math.max(dV, Math.hypot(nr - vr[i], ni - vi[i]));
      vr[i] = nr; vi[i] = ni;
    }
    sync();
    const mis = mismatch(Y, st);
    history.push(snap(it, mis, st, { dV }));
    if (dV < opts.tol && mis < Math.max(opts.tol * 100, 1e-4)) return { converged: true, iterations: it, history };
    if (!Number.isFinite(dV) || dV > 1e6) break;
  }
  return { converged: false, iterations: history.length - 1, history };
}

// ------------------------------------------------------------ Newton–Raphson
/** Polar-form Jacobian [[∂P/∂θ, ∂P/∂V], [∂Q/∂θ, ∂Q/∂V]] for the non-slack angles and PQ magnitudes. */
export function jacobian(Y, Vm, Va, type) {
  const n = Y.n, G = Y.G, B = Y.B;
  const ang = [], mag = [];
  for (let i = 0; i < n; i++) { if (type[i] !== 'slack') ang.push(i); if (type[i] === 'pq') mag.push(i); }
  const { P, Q } = injections(Y, Vm, Va);
  const na = ang.length, m = na + mag.length;
  const J = Array.from({ length: m }, () => new Float64Array(m));
  const dP_dth = (i, k) => (i === k ? -Q[i] - B[i][i] * Vm[i] * Vm[i] : Vm[i] * Vm[k] * (G[i][k] * Math.sin(Va[i] - Va[k]) - B[i][k] * Math.cos(Va[i] - Va[k])));
  const dP_dV = (i, k) => (i === k ? P[i] / Vm[i] + G[i][i] * Vm[i] : Vm[i] * (G[i][k] * Math.cos(Va[i] - Va[k]) + B[i][k] * Math.sin(Va[i] - Va[k])));
  const dQ_dth = (i, k) => (i === k ? P[i] - G[i][i] * Vm[i] * Vm[i] : -Vm[i] * Vm[k] * (G[i][k] * Math.cos(Va[i] - Va[k]) + B[i][k] * Math.sin(Va[i] - Va[k])));
  const dQ_dV = (i, k) => (i === k ? Q[i] / Vm[i] - B[i][i] * Vm[i] : Vm[i] * (G[i][k] * Math.sin(Va[i] - Va[k]) - B[i][k] * Math.cos(Va[i] - Va[k])));
  for (let r = 0; r < na; r++) {
    const i = ang[r];
    for (let c = 0; c < na; c++) J[r][c] = dP_dth(i, ang[c]);
    for (let c = 0; c < mag.length; c++) J[r][na + c] = dP_dV(i, mag[c]);
  }
  for (let r = 0; r < mag.length; r++) {
    const i = mag[r];
    for (let c = 0; c < na; c++) J[na + r][c] = dQ_dth(i, ang[c]);
    for (let c = 0; c < mag.length; c++) J[na + r][na + c] = dQ_dV(i, mag[c]);
  }
  return { J, ang, mag, P, Q };
}

function newtonRaphson(Y, st, opts) {
  const { type, Psp, Qsp, Vm, Va } = st, history = [];
  let jac = null;
  for (let it = 0; it <= opts.maxIter; it++) {
    jac = jacobian(Y, Vm, Va, type);
    const { J, ang, mag, P, Q } = jac, na = ang.length;
    const F = new Float64Array(na + mag.length);
    ang.forEach((i, r) => { F[r] = Psp[i] - P[i]; });
    mag.forEach((i, r) => { F[na + r] = Qsp[i] - Q[i]; });
    const mis = maxAbs(F);
    history.push(snap(it, mis, st));
    if (mis < opts.tol) return { converged: true, iterations: it, history, jacobian: jac };
    if (it === opts.maxIter || !Number.isFinite(mis)) break;
    const dx = luSolve(luFactor(J), F);
    ang.forEach((i, r) => { Va[i] += dx[r]; });
    mag.forEach((i, r) => { Vm[i] += dx[na + r]; });
  }
  return { converged: false, iterations: history.length - 1, history, jacobian: jac };
}

// ------------------------------------------------------------ Fast Decoupled (XB)
function fdMatrices(sys, st, dc = false) {
  const idx = new Map(sys.buses.map((b, i) => [b.id, i])), n = st.n;
  const Bp = Array.from({ length: n }, () => new Float64Array(n));
  for (const l of sys.branches) {
    if (l.on === false) continue;
    const f = idx.get(l.from), t = idx.get(l.to), x = num(l.X) || 1e-6;
    const b = 1 / (dc ? x * (num(l.tap) || 1) : x);
    Bp[f][f] += b; Bp[t][t] += b; Bp[f][t] -= b; Bp[t][f] -= b;
  }
  return Bp;
}

function fastDecoupled(sys, Y, st, opts) {
  const { n, type, Psp, Qsp, Vm, Va } = st, history = [];
  const ang = [], mag = [];
  for (let i = 0; i < n; i++) { if (type[i] !== 'slack') ang.push(i); if (type[i] === 'pq') mag.push(i); }
  const Bp = fdMatrices(sys, st);
  const B1 = luFactor(ang.map((i) => ang.map((k) => Bp[i][k])));
  const B2 = mag.length ? luFactor(mag.map((i) => mag.map((k) => -Y.B[i][k]))) : null;
  for (let it = 0; it <= opts.maxIter; it++) {
    let { P, Q } = injections(Y, Vm, Va);
    const dP = ang.map((i) => Psp[i] - P[i]), dQ = mag.map((i) => Qsp[i] - Q[i]);
    const mis = Math.max(maxAbs(dP), maxAbs(dQ));
    history.push(snap(it, mis, st));
    if (mis < opts.tol) return { converged: true, iterations: it, history };
    if (it === opts.maxIter || !Number.isFinite(mis) || mis > 1e6) break;
    const dth = luSolve(B1, ang.map((i, r) => dP[r] / Vm[i]));
    ang.forEach((i, r) => { Va[i] += dth[r]; });
    if (B2) {
      ({ P, Q } = injections(Y, Vm, Va));
      const dv = luSolve(B2, mag.map((i) => (Qsp[i] - Q[i]) / Vm[i]));
      mag.forEach((i, r) => { Vm[i] += dv[r]; });
    }
  }
  return { converged: false, iterations: history.length - 1, history };
}

// ------------------------------------------------------------ DC load flow
function dcFlow(sys, st) {
  const { n, type, Psp, Vm, Va } = st;
  const Bp = fdMatrices(sys, st, true);
  // phase shifters inject equivalent powers
  const idx = new Map(sys.buses.map((b, i) => [b.id, i])), Pshift = new Float64Array(n);
  for (const l of sys.branches) {
    if (l.on === false || !num(l.shift)) continue;
    const f = idx.get(l.from), t = idx.get(l.to), p = (num(l.shift) * D2R) / ((num(l.X) || 1e-6) * (num(l.tap) || 1));
    Pshift[f] -= p; Pshift[t] += p;
  }
  const ang = [];
  for (let i = 0; i < n; i++) { Vm[i] = 1; if (type[i] !== 'slack') ang.push(i); }
  const s = type.indexOf('slack');
  const th = luSolve(luFactor(ang.map((i) => ang.map((k) => Bp[i][k]))), ang.map((i) => Psp[i] - Pshift[i] - Bp[i][s] * Va[s]));
  ang.forEach((i, r) => { Va[i] = th[r]; });
  return { converged: true, iterations: 1, history: [snap(1, 0, st)] };
}

// ------------------------------------------------------------ results
function results(sys, Y, st, dc) {
  const base = st.base, buses = sys.buses, idx = Y.idx, n = st.n;
  let P, Q;
  if (dc) {
    P = new Float64Array(n); Q = new Float64Array(n);
  } else ({ P, Q } = injections(Y, st.Vm, st.Va));
  const branches = [];
  const busOut = buses.map((b, i) => ({
    id: b.id, name: b.name || `Bus ${b.id}`, type: st.type[i], origType: b.type,
    V: st.Vm[i], ang: st.Va[i] / D2R,
    Pg: num(b.Pg), Qg: num(b.Qg), Pd: num(b.Pd), Qd: num(b.Qd),
    Pinj: P[i] * base, Qinj: Q[i] * base,
    Psh: dc ? 0 : num(b.Gs) * st.Vm[i] * st.Vm[i], // MW drawn by the bus shunt
    Qsh: dc ? 0 : num(b.Bs) * st.Vm[i] * st.Vm[i], // Mvar delivered by a shunt capacitor (Bs > 0)
  }));
  let lossP = 0, lossQ = 0, charging = 0;
  sys.branches.forEach((l, k) => {
    const f = idx.get(l.from), t = idx.get(l.to);
    if (l.on === false || f === undefined || t === undefined) { branches.push({ k, from: l.from, to: l.to, on: false, Pf: 0, Qf: 0, Pt: 0, Qt: 0, lossP: 0, lossQ: 0, If: 0, It: 0, loading: 0, rate: num(l.rate) }); return; }
    let Pf, Qf, Pt, Qt, If, It;
    if (dc) {
      const x = num(l.X) || 1e-6, tap = num(l.tap) || 1;
      Pf = ((st.Va[f] - st.Va[t] - num(l.shift) * D2R) / (x * tap)) * base;
      Pt = -Pf; Qf = 0; Qt = 0; If = Math.abs(Pf) / base; It = If;
    } else {
      const y = branchY(l);
      const vf = { re: st.Vm[f] * Math.cos(st.Va[f]), im: st.Vm[f] * Math.sin(st.Va[f]) };
      const vt = { re: st.Vm[t] * Math.cos(st.Va[t]), im: st.Vm[t] * Math.sin(st.Va[t]) };
      const mul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
      const add = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
      const ifr = add(mul(y.ff, vf), mul(y.ft, vt)), itr = add(mul(y.tf, vf), mul(y.tt, vt));
      Pf = (vf.re * ifr.re + vf.im * ifr.im) * base; Qf = (vf.im * ifr.re - vf.re * ifr.im) * base;
      Pt = (vt.re * itr.re + vt.im * itr.im) * base; Qt = (vt.im * itr.re - vt.re * itr.im) * base;
      If = Math.hypot(ifr.re, ifr.im); It = Math.hypot(itr.re, itr.im);
      const bc = num(l.B) / 2, tap = num(l.tap) || 1;
      charging += bc * ((st.Vm[f] / tap) ** 2 + st.Vm[t] ** 2) * base;
    }
    const rate = num(l.rate), sMax = Math.max(Math.hypot(Pf, Qf), Math.hypot(Pt, Qt));
    lossP += Pf + Pt; lossQ += Qf + Qt;
    branches.push({ k, from: l.from, to: l.to, on: true, Pf, Qf, Pt, Qt, lossP: Pf + Pt, lossQ: Qf + Qt, If, It, S: sMax, loading: rate > 0 ? (sMax / rate) * 100 : 0, rate, xfmr: (num(l.tap) && num(l.tap) !== 1) || !!num(l.shift) });
  });
  // generation follows from the solved injections: slack P and Q, Q at PV buses
  busOut.forEach((b, i) => {
    if (dc) {
      if (b.type === 'slack') {
        let pg = 0;
        for (const x of busOut) if (x !== b) pg += x.Pd - x.Pg;
        b.Pg = pg + b.Pd;
      }
      b.Pinj = b.Pg - b.Pd; b.Qinj = 0;
      return;
    }
    if (b.type === 'slack') { b.Pg = P[i] * base + b.Pd; b.Qg = Q[i] * base + b.Qd; } else if (b.type === 'pv') b.Qg = Q[i] * base + b.Qd;
    else if (b.origType === 'pv') b.Qg = st.Qsp[i] * base + b.Qd; // PV bus held at a Q limit
  });
  const sum = (f) => busOut.reduce((s, b) => s + f(b), 0);
  const totals = {
    Pg: sum((b) => b.Pg), Qg: sum((b) => b.Qg), Pd: sum((b) => b.Pd), Qd: sum((b) => b.Qd),
    lossP, lossQ, charging, Qsh: sum((b) => b.Qsh),
  };
  return { buses: busOut, branches, totals };
}

/**
 * Run a load flow. Returns { ok, method, converged, iterations, history, buses, branches,
 * totals, events, violations, Y, jacobian?, ms } or { ok: false, errors }.
 */
export function solveLoadFlow(sys, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!opts.maxIter) opts.maxIter = opts.method === 'gs' ? 1000 : opts.method === 'fd' ? 100 : 30;
  if (!Array.isArray(sys.branches)) sys = { ...sys, branches: [] }; // (a system given without the list)
  const errors = validate(sys);
  if (errors.length) return { ok: false, errors };
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const Y = buildYbus(sys);
  const st = setup(sys, opts);
  const events = [];
  let run, history = [];
  try {
    // Q limits: solve, move every PV bus that is past a limit to PQ at that limit, solve again
    for (let pass = 0; pass < 20; pass++) {
      if (opts.method === 'gs') run = gaussSeidel(Y, st, opts);
      else if (opts.method === 'fd') run = fastDecoupled(sys, Y, st, opts);
      else if (opts.method === 'dc') run = dcFlow(sys, st);
      else run = newtonRaphson(Y, st, opts);
      const off = history.length ? history[history.length - 1].it + 1 : 0;
      history = history.concat(run.history.map((h) => ({ ...h, it: h.it + off, pass })));
      if (!run.converged || !opts.qLimits || opts.method === 'dc') break;
      const { Q } = injections(Y, st.Vm, st.Va);
      let changed = false;
      sys.buses.forEach((b, i) => {
        if (st.type[i] !== 'pv') return;
        const qg = Q[i] * st.base + num(b.Qd), qmax = b.Qmax === '' || b.Qmax == null ? Infinity : num(b.Qmax, Infinity), qmin = b.Qmin === '' || b.Qmin == null ? -Infinity : num(b.Qmin, -Infinity);
        const lim = qg > qmax + 1e-6 ? qmax : qg < qmin - 1e-6 ? qmin : null;
        if (lim === null) return;
        st.type[i] = 'pq';
        st.Qsp[i] = (lim - num(b.Qd)) / st.base;
        events.push(`Bus ${b.id}: generator Q = ${qg.toFixed(2)} Mvar is beyond its ${lim === qmax ? 'Qmax' : 'Qmin'} = ${lim} Mvar → held at the limit (PV → PQ); voltage no longer regulated.`);
        changed = true;
      });
      if (!changed) break;
    }
  } catch (e) {
    return { ok: false, errors: [`The solution failed: ${e.message}.`] };
  }
  const res = results(sys, Y, st, opts.method === 'dc');
  const violations = [];
  for (const b of res.buses) {
    if (b.V < opts.vMin - 1e-9) violations.push({ kind: 'under', bus: b.id, text: `Bus ${b.id} under-voltage: ${b.V.toFixed(4)} pu < ${opts.vMin}` });
    if (b.V > opts.vMax + 1e-9) violations.push({ kind: 'over', bus: b.id, text: `Bus ${b.id} over-voltage: ${b.V.toFixed(4)} pu > ${opts.vMax}` });
  }
  for (const l of res.branches) if (l.rate > 0 && l.loading > 100) violations.push({ kind: 'overload', branch: l.k, text: `Branch ${l.from}–${l.to} overloaded: ${l.loading.toFixed(1)} % of ${l.rate} MVA` });
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    ok: true, method: opts.method, options: opts, converged: run.converged, iterations: history.length ? history[history.length - 1].it : 0,
    history, events, violations, Y, jacobian: run.jacobian || null, ms: t1 - t0, ...res,
  };
}

/** N-1 contingency screening: take each in-service branch out in turn and re-run the load flow. */
export function contingencies(sys, options = {}) {
  const out = [];
  sys.branches.forEach((l, k) => {
    if (l.on === false) return;
    const s2 = { ...sys, branches: sys.branches.map((b, j) => (j === k ? { ...b, on: false } : b)) };
    const isl = islands(s2);
    if (isl.length > 1) { out.push({ k, from: l.from, to: l.to, status: 'islanded', text: `buses ${isl.slice(1).flat().join(', ')} cut off` }); return; }
    const r = solveLoadFlow(s2, { ...options, method: options.method === 'gs' ? 'nr' : options.method || 'nr' });
    if (!r.ok || !r.converged) { out.push({ k, from: l.from, to: l.to, status: 'diverged', text: 'no solution (voltage collapse)' }); return; }
    let vmin = Infinity, vb = null, lmax = 0, lb = null;
    for (const b of r.buses) if (b.V < vmin) { vmin = b.V; vb = b.id; }
    for (const b of r.branches) if (b.on && b.loading > lmax) { lmax = b.loading; lb = `${b.from}–${b.to}`; }
    out.push({ k, from: l.from, to: l.to, status: r.violations.length ? 'violation' : 'ok', vmin, vminBus: vb, lmax, lmaxBranch: lb, lossP: r.totals.lossP, violations: r.violations.length });
  });
  const rank = { islanded: 0, diverged: 1, violation: 2, ok: 3 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || (a.vmin ?? 9) - (b.vmin ?? 9));
}

// ------------------------------------------------------------ import / export
/**
 * Read a MATPOWER case file (mpc.baseMVA, mpc.bus, mpc.gen, mpc.branch). Several
 * generators on one bus are added together; gen status 0 is skipped.
 */
export function parseMatpower(text) {
  const src = String(text).replace(/%[^\n]*/g, '');
  const mat = (name) => {
    const m = src.match(new RegExp(`mpc\\.${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
    if (!m) return null;
    // MATPOWER writes an unlimited value as Inf (a generator's Qmax): a number, not a broken row
    const tok = (t) => (/^[+-]?inf$/i.test(t) ? (t[0] === '-' ? -Infinity : Infinity) : Number(t));
    return m[1].split(/;|\n/).map((r) => r.trim().split(/[\s,]+/).filter(Boolean).map(tok)).filter((r) => r.length && r.every((x) => !Number.isNaN(x)));
  };
  const baseM = src.match(/mpc\.baseMVA\s*=\s*([\d.eE+-]+)/);
  const bus = mat('bus'), gen = mat('gen') || [], branch = mat('branch');
  if (!bus || !branch) throw new Error('No mpc.bus and mpc.branch matrices found');
  const nameM = src.match(/function\s+mpc\s*=\s*(\w+)/);
  const T = { 1: 'pq', 2: 'pv', 3: 'slack', 4: 'pq' };
  const buses = bus.filter((r) => r[1] !== 4).map((r) => ({
    id: r[0], name: `Bus ${r[0]}`, type: T[r[1]] || 'pq', Pd: r[2], Qd: r[3], Gs: r[4], Bs: r[5], V: r[7] || 1, ang: r[8] || 0,
    Pg: 0, Qg: 0, Qmin: '', Qmax: '', kV: r[9] || 0,
  }));
  const byId = new Map(buses.map((b) => [b.id, b]));
  for (const g of gen) {
    const b = byId.get(g[0]);
    if (!b || g[7] === 0) continue;
    b.Pg += g[1]; b.Qg += g[2];
    // an infinite limit is no limit ('')
    b.Qmax = !Number.isFinite(g[3]) || b.Qmax === null ? null : (b.Qmax === '' ? 0 : b.Qmax) + g[3];
    b.Qmin = !Number.isFinite(g[4]) || b.Qmin === null ? null : (b.Qmin === '' ? 0 : b.Qmin) + g[4];
    if (g[5]) b.V = g[5];
  }
  for (const b of buses) { if (b.Qmax === null) b.Qmax = ''; if (b.Qmin === null) b.Qmin = ''; }
  const branches = branch.map((r) => ({ from: r[0], to: r[1], R: r[2], X: r[3], B: r[4], rate: r[5] || 0, tap: r[8] || 0, shift: r[9] || 0, on: r[10] !== 0 }));
  return { name: nameM ? nameM[1] : 'Imported case', baseMVA: baseM ? +baseM[1] : 100, buses, branches };
}

/** The system as a MATPOWER case file. */
export function toMatpower(sys) {
  const T = { pq: 1, pv: 2, slack: 3 };
  const fn = (sys.name || 'case').replace(/\W+/g, '_').replace(/^(\d)/, 'c$1');
  const r = (a) => '\t' + a.join('\t') + ';';
  const gens = sys.buses.filter((b) => b.type !== 'pq' || num(b.Pg) || num(b.Qg));
  return [
    `function mpc = ${fn}`,
    `% ${sys.name || ''} — exported from RaptiCKT Load Flow`,
    `mpc.version = '2';`,
    `mpc.baseMVA = ${num(sys.baseMVA, 100)};`,
    '%\tbus_i\ttype\tPd\tQd\tGs\tBs\tarea\tVm\tVa\tbaseKV\tzone\tVmax\tVmin',
    'mpc.bus = [',
    ...sys.buses.map((b) => r([b.id, T[b.type], num(b.Pd), num(b.Qd), num(b.Gs), num(b.Bs), 1, num(b.V, 1), num(b.ang), num(b.kV), 1, 1.1, 0.9])),
    '];',
    '%\tbus\tPg\tQg\tQmax\tQmin\tVg\tmBase\tstatus\tPmax\tPmin',
    'mpc.gen = [',
    ...gens.map((b) => r([b.id, num(b.Pg), num(b.Qg), b.Qmax === '' ? 9999 : num(b.Qmax), b.Qmin === '' ? -9999 : num(b.Qmin), num(b.V, 1), num(sys.baseMVA, 100), 1, 9999, 0])),
    '];',
    '%\tfbus\ttbus\tr\tx\tb\trateA\trateB\trateC\tratio\tangle\tstatus\tangmin\tangmax',
    'mpc.branch = [',
    ...sys.branches.map((l) => r([l.from, l.to, num(l.R), num(l.X), num(l.B), num(l.rate), 0, 0, num(l.tap), num(l.shift), l.on === false ? 0 : 1, -360, 360])),
    '];',
    '',
  ].join('\n');
}

// ------------------------------------------------------------ per-unit helpers
/** Ohms → per unit on (kV, MVA) base. */
/** Per unit from one base to another: Z_new = Z_old · (kV_old/kV_new)² · (MVA_new/MVA_old). */
export const changeBase = (z, kVold, MVAold, kVnew, MVAnew) => z * (kVold / kVnew) ** 2 * (MVAnew / MVAold);
/** Base current (A) and impedance (Ω) of a 3-phase base. */
export const baseValues = (kV, mva) => ({ I: (mva * 1e3) / (Math.sqrt(3) * kV), Z: (kV * kV) / mva });
