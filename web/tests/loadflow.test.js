// Load flow section: every method against published textbook / IEEE results.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solveLoadFlow, contingencies, validate, buildYbus, parseMatpower, toMatpower, changeBase, baseValues } from '../src/engine/loadflow.js';
import { LF_CASES, loadCase } from '../src/engine/loadflow-cases.js';

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);
const bus = (r, id) => r.buses.find((b) => b.id === id);

test('IEEE 14-bus matches the published solution (NR, GS, FDLF)', () => {
  // |V| and angle from the IEEE common data format solution
  const ref = { 1: [1.06, 0], 2: [1.045, -4.98], 3: [1.01, -12.72], 4: [1.019, -10.33], 5: [1.02, -8.78], 6: [1.07, -14.22], 7: [1.062, -13.37],
    8: [1.09, -13.36], 9: [1.056, -14.94], 10: [1.051, -15.1], 11: [1.057, -14.79], 12: [1.055, -15.07], 13: [1.05, -15.16], 14: [1.036, -16.04] };
  for (const method of ['nr', 'gs', 'fd']) {
    const r = solveLoadFlow(loadCase('ieee14'), { method });
    assert.ok(r.ok && r.converged, method);
    for (const [id, [v, a]] of Object.entries(ref)) {
      near(bus(r, +id).V, v, 0.0015, `${method} V${id}`);
      near(bus(r, +id).ang, a, 0.05, `${method} δ${id}`);
    }
    near(bus(r, 1).Pg, 232.4, 0.1, `${method} slack P`);
    near(r.totals.lossP, 13.39, 0.02, `${method} losses`);
  }
  assert.equal(solveLoadFlow(loadCase('ieee14'), { method: 'nr' }).iterations, 3, 'Newton–Raphson converges in 3 iterations');
});

test('Saadat 3-bus examples (Gauss–Seidel and Newton–Raphson)', () => {
  const g = solveLoadFlow(loadCase('saadat3'), { method: 'gs' });
  assert.ok(g.converged);
  near(bus(g, 2).V, 0.98183, 1e-4, 'V2'); near(bus(g, 2).ang, -3.5035, 0.01, 'δ2');
  near(bus(g, 3).V, 1.00125, 1e-4, 'V3'); near(bus(g, 3).ang, -2.8624, 0.01, 'δ3');
  near(bus(g, 1).Pg, 409.5, 0.1, 'slack P'); near(bus(g, 1).Qg, 189.0, 0.1, 'slack Q');
  const n = solveLoadFlow(loadCase('saadat3pv'), { method: 'nr' });
  near(bus(n, 2).V, 0.971684, 1e-5, 'V2'); near(bus(n, 2).ang, -2.696, 0.002, 'δ2'); near(bus(n, 3).ang, -0.4988, 0.002, 'δ3');
  near(bus(n, 3).Qg, 146.177, 0.01, 'Q3'); near(bus(n, 1).Pg, 218.423, 0.01, 'P1'); near(bus(n, 1).Qg, 140.852, 0.01, 'Q1');
});

test('Stagg 5-bus, Wood & Wollenberg 6-bus and WSCC 9-bus', () => {
  const s = solveLoadFlow(loadCase('stagg5'), { method: 'nr' });
  near(bus(s, 2).V, 1.0474, 2e-4, 'V2'); near(bus(s, 5).ang, -6.15, 0.01, 'δ5'); near(bus(s, 1).Pg, 129.59, 0.05, 'slack P');
  const w = solveLoadFlow(loadCase('ww6'), { method: 'nr' });
  near(bus(w, 1).Pg, 107.9, 0.1, 'gen 1 P'); near(bus(w, 4).V, 0.989, 0.001, 'V4'); near(bus(w, 6).ang, -5.95, 0.02, 'δ6');
  const n = solveLoadFlow(loadCase('ieee9'), { method: 'nr' });
  near(bus(n, 1).Pg, 71.64, 0.02, 'gen 1 P'); near(bus(n, 1).Qg, 27.05, 0.02, 'gen 1 Q');
  near(bus(n, 5).V, 0.9956, 2e-4, 'V5'); near(bus(n, 7).ang, 3.72, 0.01, 'δ7'); near(n.totals.lossP, 4.641, 0.005, 'losses');
});

test('all methods agree on every test system; power balances', () => {
  for (const c of LF_CASES) {
    const nr = solveLoadFlow(loadCase(c.id), { method: 'nr' });
    assert.ok(nr.converged, c.id);
    near(nr.totals.Pg - nr.totals.Pd - nr.totals.lossP, 0, 1e-4, `${c.id} P balance`);
    for (const method of ['gs', 'fd']) {
      const r = solveLoadFlow(loadCase(c.id), { method });
      assert.ok(r.converged, `${c.id} ${method}`);
      r.buses.forEach((b, i) => { near(b.V, nr.buses[i].V, 1e-4, `${c.id} ${method} V${b.id}`); near(b.ang, nr.buses[i].ang, 0.01, `${c.id} ${method} δ${b.id}`); });
    }
    const dc = solveLoadFlow(loadCase(c.id), { method: 'dc' });
    near(dc.totals.Pg, dc.totals.Pd, 1e-6, `${c.id} DC: generation = load`);
  }
});

test('generator Q limits switch a PV bus to PQ', () => {
  const sys = loadCase('ieee14');
  sys.buses.find((b) => b.id === 8).Qmax = 10; // needs 17.6 Mvar to hold 1.09 pu
  const r = solveLoadFlow(sys, { method: 'nr', qLimits: true });
  assert.ok(r.converged);
  assert.equal(r.events.length, 1);
  near(bus(r, 8).Qg, 10, 1e-6, 'Q held at Qmax');
  assert.ok(bus(r, 8).V < 1.09, 'voltage falls below the set-point');
  assert.equal(bus(r, 8).type, 'pq');
});

test('validation and Y-bus', () => {
  const sys = loadCase('stagg5');
  assert.deepEqual(validate(sys), []);
  assert.ok(validate({ ...sys, buses: sys.buses.map((b) => ({ ...b, type: 'pq' })) }).some((e) => /slack/.test(e)));
  assert.ok(validate({ ...sys, branches: sys.branches.filter((l) => l.from !== 5 && l.to !== 5) }).some((e) => /separate parts/.test(e)));
  const Y = buildYbus(sys);
  // row sums of the series part are zero: Σ_k Y_ik = shunt (line charging) at bus i
  for (let i = 0; i < Y.n; i++) near(Y.G[i].reduce((a, b) => a + b, 0), 0, 1e-12, `G row ${i}`);
  near(Y.G[0][1], -5, 1e-9, 'G12 = −Re 1/(0.02 + j0.06)'); near(Y.B[0][1], 15, 1e-9, 'B12');
  near(Y.B[0][0], -15 - 3.75 + (0.06 + 0.05) / 2, 1e-9, 'B11 includes half the line charging');
});

test('N-1 screening flags the radial outages of the 9-bus system', () => {
  const c = contingencies(loadCase('ieee9'));
  assert.equal(c.length, 9);
  // the three generator step-up transformers are radial: losing one islands a generator bus
  assert.equal(c.filter((x) => x.status === 'islanded').length, 3);
  assert.ok(c.filter((x) => x.status !== 'islanded').every((x) => x.vmin > 0.8));
});

test('MATPOWER export and import round-trip', () => {
  const sys = loadCase('ieee14');
  const back = parseMatpower(toMatpower(sys));
  assert.equal(back.buses.length, 14);
  assert.equal(back.branches.length, 20);
  const a = solveLoadFlow(sys), b = solveLoadFlow(back);
  a.buses.forEach((x, i) => near(b.buses[i].V, x.V, 1e-9, `V${x.id}`));
});

test('per-unit helpers', () => {
  near(baseValues(132, 100).Z, 174.24, 1e-9, 'Z base');
  near(baseValues(11, 100).I, 5248.64, 0.01, 'I base');
  near(changeBase(0.1, 11, 25, 11, 100), 0.4, 1e-12, 'MVA change');
});
