// Circuit from photo: grid drawings, as the photo reader describes circuits, become board
// circuits that solve to the textbook answers, and dependent sources follow the marked polarity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFromDrawing } from '../src/ui/photo-circuit.js';
import { Simulator } from '../src/engine/sim.js';

const P = (x, y) => ({ x, y });
const part = (kind, text, value, from, to, polarity = 'none', control = '') => ({ kind, text, value, from, to, polarity, control });
const wire = (a, b) => ({ from: a, to: b });
const circuit = (o) => ({ title: 'test', parts: [], wires: [], ground: [], quantities: [], asked: [], ...o });

/** build, solve the DC operating point, and return { doc, warnings, sim, el(name), v(name) } */
function solve(c) {
  const { doc, warnings, asked } = buildFromDrawing(c);
  const sim = new Simulator().build(doc.elements, doc.wires);
  assert.ok(sim.start(), sim.error);
  for (let i = 0; i < 50; i++) assert.ok(sim.step(1e-4), sim.error);
  const el = (n) => doc.elements.find((e) => e.name === n);
  // a node voltage: at its net label when it has one (a dependent source reads it), else at the
  // point the drawing names, on the board (one grid unit is 6 grid steps)
  const label = (n) => doc.elements.find((e) => e.constructor.type === 'netlabel' && e.p.name === n);
  const at = (n) => {
    const q = c.quantities.find((x) => x.name === n), X = q.at.x * 120, Y = q.at.y * 120;
    const e = doc.elements.find((o) => o.getPosts().some(([x, y]) => x === X && y === Y));
    if (e) return e.nodes[e.getPosts().findIndex(([x, y]) => x === X && y === Y)];
    const i = doc.wires.findIndex((w) => w.pts.some(([x, y]) => x === X && y === Y));
    return sim.wireNodes[i];
  };
  return { doc, warnings, asked, sim, el, v: (n) => sim.v(label(n) ? label(n).nodes[0] : at(n)) };
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${msg}: ${a} ≠ ${b}`);

// Fig. 1 of the photos: 20 V, 20 Ω, 4 A, 4 Ω and a 0.1vx dependent current source; vx = 25 V
const FIG1 = circuit({
  title: 'Find vx',
  parts: [
    part('voltage_source', '20 V', 20, P(0, 0), P(0, 1), 'from'),
    part('resistor', '20 Ω', 20, P(0, 0), P(1, 0)),
    part('current_source', '4 A', 4, P(1, 1), P(1, 0), 'to'),
    part('resistor', '4 Ω', 4, P(2, 0), P(2, 1)),
    part('dependent_current_source', '0.1vx', 0.1, P(3, 1), P(3, 0), 'to', 'vx'),
  ],
  wires: [wire(P(1, 0), P(3, 0)), wire(P(0, 1), P(3, 1))],
  ground: [P(2, 1)],
  quantities: [{ name: 'vx', kind: 'node_voltage', at: P(1, 0), part: -1, positive: 'none' }],
  asked: ['vx'],
});

// Fig. 4.12 (Alexander & Sadiku): 24 V, 8 Ω, 4 Ω, 4 Ω, 3 Ω, 12 V, 3 A; i = 2 A down the 3 Ω
const FIG412 = circuit({
  title: 'Figure 4.12',
  parts: [
    part('voltage_source', '24 V', 24, P(0, 0), P(1, 0), 'from'),
    part('resistor', '8 Ω', 8, P(1, 0), P(2, 0)),
    part('resistor', '4 Ω', 4, P(0, 1), P(1, 1)),
    part('resistor', '4 Ω', 4, P(1, 1), P(2, 1)),
    part('resistor', '3 Ω', 3, P(1, 1), P(1, 2)),
    part('voltage_source', '12 V', 12, P(0, 1), P(0, 2), 'from'),
    part('current_source', '3 A', 3, P(2, 2), P(2, 1), 'to'),
  ],
  wires: [wire(P(0, 0), P(0, 1)), wire(P(2, 0), P(2, 1)), wire(P(0, 2), P(2, 2))],
  quantities: [{ name: 'i', kind: 'current_through', at: P(1, 1), part: 4, positive: 'to' }],
  asked: ['i'],
});

test('Fig. 1 from the photo: vx = 25 V, nothing left loose', () => {
  const r = solve(FIG1);
  assert.deepEqual(r.warnings, []);
  near(r.v('vx'), 25, 'vx');
  assert.deepEqual(r.asked, ['vx']);
  const d = r.el('D1');
  assert.equal(d.p.kind, 'vccs');
  assert.equal(d.p.ctrl, 'node:vx');
  near(d.i, 2.5, '0.1vx');
});

test('Fig. 4.12 from the photo: i = 2 A down the 3 Ω, with no ground drawn', () => {
  const r = solve(FIG412);
  assert.deepEqual(r.warnings, []);
  const R = r.doc.elements.filter((e) => e.constructor.type === 'resistor');
  assert.deepEqual(R.map((e) => e.p.r), [8, 4, 4, 3]);
  near(r.el('R4').i, 2, 'i');
  assert.ok(r.doc.elements.some((e) => e.constructor.type === 'ground'), 'a reference was added');
});

// 10 V, R1 = 2 Ω (ix through it), R2 = 4 Ω down, then R3 = 2 Ω to a 2ix dependent voltage source
function ccvs({ arrow = 'right', r1Reversed = false } = {}) {
  const r1 = r1Reversed ? part('resistor', '2 Ω', 2, P(1, 0), P(0, 0)) : part('resistor', '2 Ω', 2, P(0, 0), P(1, 0));
  const toRight = r1Reversed ? 'from' : 'to';
  return circuit({
    parts: [
      part('voltage_source', '10 V', 10, P(0, 0), P(0, 1), 'from'),
      r1,
      part('resistor', '4 Ω', 4, P(1, 0), P(1, 1)),
      part('resistor', '2 Ω', 2, P(1, 0), P(2, 0)),
      part('dependent_voltage_source', '2ix', 2, P(2, 1), P(2, 0), 'to', 'ix'),
    ],
    wires: [wire(P(0, 1), P(2, 1))],
    ground: [P(0, 1)],
    quantities: [
      { name: 'ix', kind: 'current_through', at: r1.from, part: 1, positive: arrow === 'right' ? toRight : toRight === 'to' ? 'from' : 'to' },
      { name: 'va', kind: 'node_voltage', at: P(1, 0), part: -1, positive: 'none' },
    ],
  });
}

test('a current-controlled source follows the direction of the marked current', () => {
  // ix to the right: VA = 5/0.875 V, ix = (10 − VA)/2
  const a = solve(ccvs());
  near(a.v('va'), 5 / 0.875, 'VA');
  assert.equal(a.el('D1').p.kind, 'ccvs');
  // the same drawing with the resistor described the other way round reads the same
  const b = solve(ccvs({ r1Reversed: true }));
  near(b.v('va'), 5 / 0.875, 'VA (R1 drawn right to left)');
  // ix marked to the left is a different circuit: VA = 0, 5 A through R1
  const c = solve(ccvs({ arrow: 'left' }));
  near(c.v('va'), 0, 'VA (ix to the left)');
  near(Math.abs(c.el('R1').i), 5, 'R1 current');
  const d = solve(ccvs({ arrow: 'left', r1Reversed: true }));
  near(d.v('va'), 0, 'VA (ix to the left, R1 right to left)');
});

// 12 V, R1 = 2 Ω, R2 = 4 Ω with Vo across it, R3 = 2 Ω to node B fed by a 0.5Vo current source
function vccs({ plus = 'top', r2Reversed = false } = {}) {
  const r2 = r2Reversed ? part('resistor', '4 Ω', 4, P(1, 1), P(1, 0)) : part('resistor', '4 Ω', 4, P(1, 0), P(1, 1));
  const topEnd = r2Reversed ? 'to' : 'from';
  return circuit({
    parts: [
      part('voltage_source', '12 V', 12, P(0, 0), P(0, 1), 'from'),
      part('resistor', '2 Ω', 2, P(0, 0), P(1, 0)),
      r2,
      part('resistor', '2 Ω', 2, P(1, 0), P(2, 0)),
      part('dependent_current_source', '0.5Vo', 0.5, P(2, 1), P(2, 0), 'to', 'Vo'),
    ],
    wires: [wire(P(0, 1), P(2, 1))],
    ground: [P(1, 1)],
    quantities: [
      { name: 'Vo', kind: 'voltage_across', at: r2.from, part: 2, positive: plus === 'top' ? topEnd : topEnd === 'from' ? 'to' : 'from' },
      { name: 'va', kind: 'node_voltage', at: P(1, 0), part: -1, positive: 'none' },
      { name: 'vb', kind: 'node_voltage', at: P(2, 0), part: -1, positive: 'none' },
    ],
  });
}

test('a voltage-controlled source follows the + of the marked voltage', () => {
  for (const r2Reversed of [false, true]) {
    const a = solve(vccs({ r2Reversed }));
    near(a.v('va'), 24, `VA (+ on top, reversed ${r2Reversed})`);
    near(a.v('vb'), 48, `VB (+ on top, reversed ${r2Reversed})`);
    assert.equal(a.el('D1').p.kind, 'vccs');
    const b = solve(vccs({ plus: 'bottom', r2Reversed }));
    near(b.v('va'), 4.8, `VA (+ at the bottom, reversed ${r2Reversed})`);
    near(b.v('vb'), 0, `VB (+ at the bottom, reversed ${r2Reversed})`);
  }
});

test('what cannot be rebuilt is said, not hidden', () => {
  // a resistor hanging off the circuit by one end, and a control nobody marked
  const c = circuit({
    parts: [
      part('voltage_source', '5 V', 5, P(0, 0), P(0, 1), 'from'),
      part('resistor', '1 kΩ', 1000, P(0, 0), P(1, 0)),
      part('resistor', '1 kΩ', 1000, P(1, 0), P(1, 1)),
      part('resistor', '2 kΩ', 2000, P(1, 0), P(2, 0)),
      part('dependent_current_source', '3ix', 3, P(3, 1), P(3, 0), 'to', 'ix'),
    ],
    wires: [wire(P(0, 1), P(1, 1))],
    ground: [P(0, 1)],
  });
  const { warnings } = buildFromDrawing(c);
  assert.ok(warnings.some((w) => /Not joined.*R3/.test(w)), warnings.join(' | '));
  assert.ok(warnings.some((w) => /"ix".*not marked/.test(w)), warnings.join(' | '));
  // node voltages with no ground drawn: the bottom wire is taken as 0 V
  const g = buildFromDrawing({ ...FIG1, ground: [] });
  assert.ok(g.warnings.some((w) => /No ground/.test(w)), g.warnings.join(' | '));
  assert.ok(g.doc.elements.some((e) => e.constructor.type === 'ground'));
  // a part with both ends on one point is left out
  const z = buildFromDrawing(circuit({ parts: [part('resistor', '1 Ω', 1, P(0, 0), P(0, 0))] }));
  assert.ok(z.warnings.some((w) => /left out/.test(w)));
});

test('an op amp is set on the board pointing as drawn, its − input where drawn: an inverting amplifier gives −3 V, turned and mirrored every way', () => {
  // 1 V into 1 kΩ to the − input, 3 kΩ from it to the output, + input on the bottom wire, 2 kΩ
  // across the output; drawn pointing right, − on top, then turned and mirrored
  const base = {
    parts: [
      part('voltage_source', '1 V', 1, P(0, 1), P(0, 3), 'from'),
      part('resistor', '1 kΩ', 1000, P(0, 1), P(1, 1)),
      part('resistor', '3 kΩ', 3000, P(2, 0), P(3, 0)),
      { kind: 'opamp', text: '', value: 0, from: P(2, 1), to: P(2, 2), out: P(3, 1), polarity: 'none', control: '' },
      part('resistor', '2 kΩ', 2000, P(4, 1), P(4, 3)),
    ],
    wires: [wire(P(1, 1), P(2, 1)), wire(P(2, 1), P(2, 0)), wire(P(3, 0), P(3, 1)), wire(P(3, 1), P(4, 1)), wire(P(2, 2), P(2, 3)), wire(P(0, 3), P(4, 3))],
    ground: [P(0, 3)],
  };
  const turns = [(p) => P(p.x, p.y), (p) => P(-p.y, p.x), (p) => P(-p.x, -p.y), (p) => P(p.y, -p.x)];
  for (const mirror of [false, true]) {
    turns.forEach((turn, k) => {
      const T = (p) => { const q = turn(mirror ? P(-p.x, p.y) : p); return P(q.x + 10, q.y + 10); };
      const c = circuit({
        parts: base.parts.map((p) => ({ ...p, from: T(p.from), to: T(p.to), ...(p.out ? { out: T(p.out) } : {}) })),
        wires: base.wires.map((w) => wire(T(w.from), T(w.to))),
        ground: base.ground.map(T),
      });
      const r = solve(c);
      assert.deepEqual(r.warnings, [], `turn ${k}, mirror ${mirror}`);
      // (the board's ideal op amp has an open-loop gain of a million)
      const u = r.el('U1'), close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-4, `${msg}: ${a} ≠ ${b}`);
      close(r.sim.v(u.nodes[2]), -3, `vo (turn ${k}, mirror ${mirror})`);
      close(r.sim.v(u.nodes[0]), 0, `v− (turn ${k}, mirror ${mirror})`);
    });
  }
});

test('drawn slanting, a part is slanted on the board and a wire runs straight: a delta solves as drawn', () => {
  // 12 V across 4 Ω (a slanting side), 2.5 Ω (the other slanting side) and 3.5 Ω (the base) in
  // series across it too
  const c = circuit({
    parts: [
      part('voltage_source', '12 V', 12, P(0, 0), P(0, 2), 'from'),
      part('resistor', '4 Ω', 4, P(2, 0), P(1, 1)),
      part('resistor', '2.5 Ω', 2.5, P(2, 0), P(3, 1)),
      part('resistor', '3.5 Ω', 3.5, P(1, 2), P(3, 2)),
    ],
    wires: [wire(P(0, 0), P(2, 0)), wire(P(1, 1), P(1, 2)), wire(P(3, 1), P(3, 2)), wire(P(0, 2), P(1, 2))],
    ground: [P(0, 2)],
  });
  const r = solve(c);
  assert.deepEqual(r.warnings, []);
  const R = (n) => r.doc.elements.find((e) => e.constructor.type === 'resistor' && e.p.r === n);
  assert.ok(R(4).sv && R(2.5).sv && !R(3.5).sv, 'the slanting sides slanted');
  for (const e of [R(4), R(2.5)]) for (const [x, y] of e.getPosts()) assert.ok(x % 20 === 0 && y % 20 === 0, 'terminals on grid points');
  // each along the line it was drawn on, at its angle: its leads run on in line to its two points
  for (const e of [R(4), R(2.5)]) {
    const [a, b] = e.getPosts(), leads = r.doc.wires.filter((w) => [a, b].some((p) => w.pts.some((q) => q[0] === p[0] && q[1] === p[1])));
    assert.equal(leads.length, 2, 'two leads');
    for (const w of leads) {
      assert.equal(w.pts.length, 2, 'a straight lead');
      const [p, q] = w.pts;
      assert.ok(Math.abs((q[0] - p[0]) * (b[1] - a[1]) - (q[1] - p[1]) * (b[0] - a[0])) < 1e-6, 'in line with the part');
    }
  }
  near(Math.abs(R(4).i), 3, '4 Ω');
  near(Math.abs(R(2.5).i), 2, '2.5 Ω');
  near(Math.abs(R(3.5).i), 2, '3.5 Ω');
  // a wire drawn slanting is one straight segment
  const s = buildFromDrawing(circuit({ parts: [part('resistor', '1 Ω', 1, P(0, 0), P(1, 0)), part('resistor', '1 Ω', 1, P(2, 1), P(3, 1))], wires: [wire(P(1, 0), P(2, 1))] }));
  assert.ok(s.doc.wires.some((w) => w.pts.length === 2 && w.pts[0][0] !== w.pts[1][0] && w.pts[0][1] !== w.pts[1][1]), 'a straight slanting wire');
});

test('a side drawn straight but bent by the grid comes out as one straight line', () => {
  // a star's arm as the grid gave it: corner (0,5) – wire – (1,4) – part – (2,2) – wire – (3,1),
  // turning 18° at each joint; and a level wire along the bottom from the corner
  const c = circuit({
    parts: [part('voltage_source', '10 V', 10, P(3, 1), P(3, 0), 'from'), part('resistor', '5 Ω', 5, P(2, 2), P(1, 4))],
    wires: [wire(P(3, 1), P(2, 2)), wire(P(1, 4), P(0, 5)), wire(P(0, 5), P(4, 5)), wire(P(3, 0), P(5, 0)), wire(P(5, 0), P(5, 5)), wire(P(5, 5), P(4, 5))],
    ground: [P(0, 5)],
  });
  const r = solve(c);
  const R = r.doc.elements.find((e) => e.constructor.type === 'resistor');
  const A = [3 * 120, 1 * 120], B = [0, 5 * 120];
  const cross = (p) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]);
  for (const p of R.getPosts()) assert.ok(Math.abs(cross(p)) < 1e-6, 'the part on the line from the node to the corner');
  const arm = r.doc.wires.filter((w) => w.pts.every((p) => Math.abs(cross(p)) < 1e-6) && w.pts.length === 2);
  assert.equal(arm.length, 2, 'two straight wires on that line, one at each end of the part');
  assert.ok(R.getPosts().every(([x, y]) => x % 20 === 0 && y % 20 === 0), 'its terminals on grid points');
  near(Math.abs(R.i), 2, 'and it still solves: 10 V across 5 Ω');
});

test('a transistor is set as drawn, its base on either side; a diode points as drawn; a supply terminal is a rail', () => {
  // +10 V at a terminal, 1 kΩ to the collector, 100 kΩ from the supply to the base, the emitter
  // through a diode (anode at the emitter) to ground: IB = (10 − 0.7 − 0.65) / 100 kΩ, IC = β·IB
  for (const side of [-1, 1]) {
    const B = P(2 + side * 2, 1);
    const c = circuit({
      parts: [
        part('resistor', '1 kΩ', 1000, P(2, -1), P(2, 0)),
        { ...part('npn', 'β = 50', 50, P(2, 0), P(2, 2)), out: B },
        part('resistor', '100 kΩ', 1e5, P(B.x, -1), B),
        part('diode', '', 0, P(2, 2), P(2, 3)),
      ],
      wires: [wire(P(B.x, -1), P(2, -1))],
      ground: [P(2, 3)],
      supplies: [{ at: P(2, -1), value: 10 }],
    });
    const r = solve(c);
    assert.deepEqual(r.warnings, [], `base on the ${side < 0 ? 'left' : 'right'}`);
    const q = r.doc.elements.find((e) => e.constructor.type === 'npn');
    assert.equal(q.p.bf, 50);
    const [vb, vc, ve] = q.nodes.map((n) => r.sim.v(n));
    assert.ok(vb - ve > 0.55 && vb - ve < 0.8, `VBE ${vb - ve}`);
    assert.ok(ve > 0.5 && ve < 0.8, `the diode conducts: VE ${ve}`);
    const ib = (10 - vb) / 1e5, ic = (10 - vc) / 1000;
    assert.ok(ic / ib > 45 && ic / ib < 65, `IC/IB ${ic / ib}`);
    // the base pin is on the side its point was drawn
    assert.ok(Math.sign(q.getPosts()[0][0] - q.getPosts()[1][0]) === side, 'base side');
  }
});

test('a MOSFET gets the curve printed by it: an enhancement one its threshold and k, a depletion one its IDSS and VP', () => {
  const build = (p) => {
    const c = circuit({ parts: [part('resistor', '1 kΩ', 1000, P(2, -1), P(2, 0)), { ...p, from: P(2, 0), to: P(2, 2), out: P(0, 1) }, part('resistor', '1 MΩ', 1e6, P(0, 1), P(0, 2))], wires: [wire(P(0, 2), P(2, 2))], ground: [P(2, 2)], supplies: [{ at: P(2, -1), value: 10 }] });
    return buildFromDrawing(c).doc.elements.find((e) => /mos/.test(e.constructor.type));
  };
  const e = build({ ...part('nmos', '', 0), vt: 3, k: 0.24e-3 });
  assert.equal(e.constructor.type, 'nmos');
  assert.equal(e.p.vt, 3);
  near(e.p.kp, 0.48e-3, 'kp is twice k');
  const d = build({ ...part('depnmos', '', 8e-3), vp: -4 });
  assert.equal(d.constructor.type, 'depnmos');
  assert.equal(d.p.vt, -4);
  near(d.p.kp, (2 * 8e-3) / 16, 'kp = 2 IDSS / VP²');
});
