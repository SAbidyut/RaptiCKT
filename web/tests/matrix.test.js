// The Schur-complement solver gives the same answers as the dense LU it speeds up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RealLU, SchurLU } from '../src/engine/matrix.js';

function rnd(seed) { return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); }

/** A sparse, MNA-like random matrix: conductance-style rows plus a few zero-diagonal source rows. */
function sparse(n, r) {
  const A = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    A[i * n + i] = 1e-12;
    for (let k = 0; k < 3; k++) {
      const j = Math.floor(r() * n), g = r() * 10 + 0.1;
      if (j === i) continue;
      A[i * n + i] += g; A[j * n + j] += g; A[i * n + j] -= g; A[j * n + i] -= g;
    }
  }
  // two voltage-source rows: zero on the diagonal, ±1 in the node columns
  for (const [k, p] of [[n - 1, 0], [n - 2, 3]]) { A[k * n + k] = 0; A[k * n + p] = 1; A[p * n + k] = 1; }
  return A;
}

test('SchurLU matches the dense LU, also when the tail block changes', () => {
  const r = rnd(7), n = 60, lin = sparse(n, r), tail = [5, 9, 17, 30, 41];
  const sch = new SchurLU(n, tail);
  assert.ok(sch.factorLinear(lin));
  for (let trial = 0; trial < 5; trial++) {
    const m = Float64Array.from(lin);
    for (const a of tail) for (const b of tail) m[a * n + b] += (a === b ? 2 : -0.3) * r();
    const b = Float64Array.from({ length: n }, () => r() - 0.5);
    const lu = new RealLU(n); assert.ok(lu.factor(m));
    const x1 = lu.solveRefined(m, b, new Float64Array(n), 2);
    assert.ok(sch.factor(m, lin));
    const x2 = sch.solveRefined(m, b, new Float64Array(n), 2);
    for (let i = 0; i < n; i++) assert.ok(Math.abs(x1[i] - x2[i]) <= 1e-9 * (Math.abs(x1[i]) + 1e-6), `x${i}: ${x1[i]} vs ${x2[i]}`);
  }
});

test('with no tail it is a sparse-ordered LU of the whole matrix', () => {
  const r = rnd(11), n = 40, m = sparse(n, r), b = Float64Array.from({ length: n }, () => r());
  const sch = new SchurLU(n, []);
  assert.ok(sch.factorLinear(m));
  const lu = new RealLU(n); lu.factor(m);
  const x1 = lu.solve(b, new Float64Array(n)), x2 = sch.solveRefined(m, b, new Float64Array(n), 1);
  for (let i = 0; i < n; i++) assert.ok(Math.abs(x1[i] - x2[i]) <= 1e-9 * (Math.abs(x1[i]) + 1e-6));
});
