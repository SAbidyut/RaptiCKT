// Netlist helpers shared by the physics tests.
import assert from 'node:assert/strict';
import { getType } from '../src/elements/index.js';
import { Simulator } from '../src/engine/sim.js';

/** Build a netlist: parts = [[type, [nodes], {props}], ...]; returns {sim, els}. */
export function net(parts, opts = {}) {
  const els = parts.map(([t, nodes, p = {}], i) => {
    const C = getType(t);
    if (!C) throw new Error('unknown type ' + t);
    const e = new C(0, 0);
    Object.assign(e.p, p);
    e.nodes = nodes; e.name = C.prefix + (i + 1);
    e.onParamChange?.();
    return e;
  });
  const sim = new Simulator(opts).buildNet(els);
  return { sim, els };
}
export function run(sim, t, dt = 1e-5, each) {
  const n = Math.round(t / dt);
  for (let i = 0; i < n; i++) { assert.ok(sim.step(dt), 'step failed: ' + sim.error); each?.(sim); }
}
