// Standard test systems for the load flow section. Powers in MW / Mvar, impedances in
// per unit on baseMVA, B = total line charging. x / y place each bus on the one-line
// diagram (0–100 across, 0–100 down).

const bus = (id, type, o = {}) => ({ id, name: o.name || `Bus ${id}`, type, V: 1, ang: 0, Pg: 0, Qg: 0, Pd: 0, Qd: 0, Qmin: '', Qmax: '', Gs: 0, Bs: 0, kV: 0, ...o });
const br = (from, to, R, X, B = 0, o = {}) => ({ from, to, R, X, B, tap: 0, shift: 0, rate: 0, on: true, ...o });

export const LF_CASES = [
  {
    id: 'saadat3', title: '3-bus system (Gauss–Seidel textbook example)',
    desc: 'Slack bus 1 at 1.05 pu feeding two load buses. The classic first hand-worked Gauss–Seidel example (Saadat, Power System Analysis, Example 6.7).',
    sys: {
      name: '3-bus textbook system', baseMVA: 100,
      buses: [
        bus(1, 'slack', { name: 'Slack', V: 1.05, x: 15, y: 25 }),
        bus(2, 'pq', { Pd: 256.6, Qd: 110.2, x: 85, y: 25 }),
        bus(3, 'pq', { Pd: 138.6, Qd: 45.2, x: 50, y: 80 }),
      ],
      branches: [br(1, 2, 0.02, 0.04), br(1, 3, 0.01, 0.03), br(2, 3, 0.0125, 0.025)],
    },
  },
  {
    id: 'saadat3pv', title: '3-bus system with a PV bus (Newton–Raphson textbook example)',
    desc: 'The same network with a 200 MW generator at bus 3 holding 1.04 pu. Hand-worked Newton–Raphson example (Saadat, Example 6.10).',
    sys: {
      name: '3-bus system with PV bus', baseMVA: 100,
      buses: [
        bus(1, 'slack', { name: 'Slack', V: 1.05, x: 15, y: 25 }),
        bus(2, 'pq', { Pd: 400, Qd: 250, x: 85, y: 25 }),
        bus(3, 'pv', { V: 1.04, Pg: 200, x: 50, y: 80 }),
      ],
      branches: [br(1, 2, 0.02, 0.04), br(1, 3, 0.01, 0.03), br(2, 3, 0.0125, 0.025)],
    },
  },
  {
    id: 'stagg5', title: '5-bus system (Stagg & El-Abiad)',
    desc: 'The 5-bus, 7-line network from Stagg & El-Abiad, Computer Methods in Power System Analysis: slack bus North, a 40 MW generator at South, three load buses.',
    sys: {
      name: 'Stagg 5-bus', baseMVA: 100,
      buses: [
        bus(1, 'slack', { name: 'North', V: 1.06, x: 12, y: 20 }),
        bus(2, 'pq', { name: 'South', Pg: 40, Qg: 30, Pd: 20, Qd: 10, x: 12, y: 80 }),
        bus(3, 'pq', { name: 'Lake', Pd: 45, Qd: 15, x: 55, y: 20 }),
        bus(4, 'pq', { name: 'Main', Pd: 40, Qd: 5, x: 88, y: 30 }),
        bus(5, 'pq', { name: 'Elm', Pd: 60, Qd: 10, x: 70, y: 82 }),
      ],
      branches: [
        br(1, 2, 0.02, 0.06, 0.06), br(1, 3, 0.08, 0.24, 0.05), br(2, 3, 0.06, 0.18, 0.04), br(2, 4, 0.06, 0.18, 0.04),
        br(2, 5, 0.04, 0.12, 0.03), br(3, 4, 0.01, 0.03, 0.02), br(4, 5, 0.08, 0.24, 0.05),
      ],
    },
  },
  {
    id: 'ww6', title: '6-bus system (Wood & Wollenberg)',
    desc: 'Three generators and three 70 MW + 70 Mvar loads, from Wood & Wollenberg, Power Generation, Operation and Control.',
    sys: {
      name: 'Wood & Wollenberg 6-bus', baseMVA: 100,
      buses: [
        bus(1, 'slack', { V: 1.05, x: 10, y: 15 }),
        bus(2, 'pv', { V: 1.05, Pg: 50, Qmin: -100, Qmax: 100, x: 50, y: 12 }),
        bus(3, 'pv', { V: 1.07, Pg: 60, Qmin: -100, Qmax: 100, x: 90, y: 15 }),
        bus(4, 'pq', { Pd: 70, Qd: 70, x: 12, y: 82 }),
        bus(5, 'pq', { Pd: 70, Qd: 70, x: 50, y: 60 }),
        bus(6, 'pq', { Pd: 70, Qd: 70, x: 88, y: 82 }),
      ],
      branches: [
        br(1, 2, 0.10, 0.20, 0.04, { rate: 40 }), br(1, 4, 0.05, 0.20, 0.04, { rate: 60 }), br(1, 5, 0.08, 0.30, 0.06, { rate: 40 }),
        br(2, 3, 0.05, 0.25, 0.06, { rate: 40 }), br(2, 4, 0.05, 0.10, 0.02, { rate: 60 }), br(2, 5, 0.10, 0.30, 0.04, { rate: 30 }),
        br(2, 6, 0.07, 0.20, 0.05, { rate: 90 }), br(3, 5, 0.12, 0.26, 0.05, { rate: 70 }), br(3, 6, 0.02, 0.10, 0.02, { rate: 80 }),
        br(4, 5, 0.20, 0.40, 0.08, { rate: 20 }), br(5, 6, 0.10, 0.30, 0.06, { rate: 40 }),
      ],
    },
  },
  {
    id: 'ieee9', title: 'IEEE 9-bus (WSCC 3-machine) system',
    desc: 'The WSCC 3-machine, 9-bus system (Anderson & Fouad): three generators behind step-up transformers and three loads, 315 MW in all.',
    sys: {
      name: 'WSCC 9-bus', baseMVA: 100,
      buses: [
        bus(1, 'slack', { V: 1.04, kV: 16.5, Qmin: -300, Qmax: 300, x: 50, y: 92 }),
        bus(2, 'pv', { V: 1.025, Pg: 163, kV: 18, Qmin: -300, Qmax: 300, x: 6, y: 18 }),
        bus(3, 'pv', { V: 1.025, Pg: 85, kV: 13.8, Qmin: -300, Qmax: 300, x: 94, y: 18 }),
        bus(4, 'pq', { kV: 230, x: 50, y: 72 }),
        bus(5, 'pq', { name: 'Load A', Pd: 125, Qd: 50, kV: 230, x: 24, y: 55 }),
        bus(6, 'pq', { name: 'Load B', Pd: 90, Qd: 30, kV: 230, x: 76, y: 55 }),
        bus(7, 'pq', { kV: 230, x: 26, y: 18 }),
        bus(8, 'pq', { name: 'Load C', Pd: 100, Qd: 35, kV: 230, x: 50, y: 10 }),
        bus(9, 'pq', { kV: 230, x: 74, y: 18 }),
      ],
      branches: [
        br(1, 4, 0, 0.0576, 0, { rate: 250 }), br(4, 5, 0.01, 0.085, 0.176, { rate: 250 }), br(5, 7, 0.032, 0.161, 0.306, { rate: 250 }),
        br(3, 9, 0, 0.0586, 0, { rate: 300 }), br(9, 8, 0.0119, 0.1008, 0.209, { rate: 250 }), br(8, 7, 0.0085, 0.072, 0.149, { rate: 250 }),
        br(7, 2, 0, 0.0625, 0, { rate: 250 }), br(9, 6, 0.039, 0.17, 0.358, { rate: 150 }), br(6, 4, 0.017, 0.092, 0.158, { rate: 250 }),
      ],
    },
  },
  {
    id: 'ieee14', title: 'IEEE 14-bus system',
    desc: 'The IEEE 14-bus test case (American Electric Power, 1962): 5 generators / synchronous condensers, 11 loads, 20 branches including 3 off-nominal tap transformers and a shunt capacitor at bus 9.',
    sys: {
      name: 'IEEE 14-bus', baseMVA: 100,
      buses: [
        bus(1, 'slack', { V: 1.06, kV: 132, x: 6, y: 16 }),
        bus(2, 'pv', { V: 1.045, Pg: 40, Pd: 21.7, Qd: 12.7, Qmin: -40, Qmax: 50, kV: 132, x: 8, y: 64 }),
        bus(3, 'pv', { V: 1.01, Pd: 94.2, Qd: 19, Qmin: 0, Qmax: 40, kV: 132, x: 34, y: 94 }),
        bus(4, 'pq', { Pd: 47.8, Qd: -3.9, kV: 132, x: 42, y: 66 }),
        bus(5, 'pq', { Pd: 7.6, Qd: 1.6, kV: 132, x: 32, y: 36 }),
        bus(6, 'pv', { V: 1.07, Pd: 11.2, Qd: 7.5, Qmin: -6, Qmax: 24, kV: 33, x: 46, y: 22 }),
        bus(7, 'pq', { kV: 1, x: 70, y: 60 }),
        bus(8, 'pv', { V: 1.09, Qmin: -6, Qmax: 24, kV: 11, x: 94, y: 46 }),
        bus(9, 'pq', { Pd: 29.5, Qd: 16.6, Bs: 19, kV: 33, x: 68, y: 80 }),
        bus(10, 'pq', { Pd: 9, Qd: 5.8, kV: 33, x: 56, y: 50 }),
        bus(11, 'pq', { Pd: 3.5, Qd: 1.8, kV: 33, x: 58, y: 36 }),
        bus(12, 'pq', { Pd: 6.1, Qd: 1.6, kV: 33, x: 44, y: 4 }),
        bus(13, 'pq', { Pd: 13.5, Qd: 5.8, kV: 33, x: 72, y: 12 }),
        bus(14, 'pq', { Pd: 14.9, Qd: 5, kV: 33, x: 90, y: 92 }),
      ],
      branches: [
        br(1, 2, 0.01938, 0.05917, 0.0528), br(1, 5, 0.05403, 0.22304, 0.0492), br(2, 3, 0.04699, 0.19797, 0.0438),
        br(2, 4, 0.05811, 0.17632, 0.034), br(2, 5, 0.05695, 0.17388, 0.0346), br(3, 4, 0.06701, 0.17103, 0.0128),
        br(4, 5, 0.01335, 0.04211, 0), br(4, 7, 0, 0.20912, 0, { tap: 0.978 }), br(4, 9, 0, 0.55618, 0, { tap: 0.969 }),
        br(5, 6, 0, 0.25202, 0, { tap: 0.932 }), br(6, 11, 0.09498, 0.1989, 0), br(6, 12, 0.12291, 0.25581, 0),
        br(6, 13, 0.06615, 0.13027, 0), br(7, 8, 0, 0.17615, 0), br(7, 9, 0, 0.11001, 0),
        br(9, 10, 0.03181, 0.0845, 0), br(9, 14, 0.12711, 0.27038, 0), br(10, 11, 0.08205, 0.19207, 0),
        br(12, 13, 0.22092, 0.19988, 0), br(13, 14, 0.17093, 0.34802, 0),
      ],
    },
  },
  {
    id: 'blank', title: 'New 2-bus system',
    desc: 'A slack bus feeding one load over a line: a starting point for your own network.',
    sys: {
      name: 'My system', baseMVA: 100,
      buses: [bus(1, 'slack', { V: 1.0, x: 20, y: 50 }), bus(2, 'pq', { Pd: 50, Qd: 20, x: 80, y: 50 })],
      branches: [br(1, 2, 0.02, 0.08, 0.02)],
    },
  },
];

export const newBus = bus;
export const newBranch = br;

/** A deep copy of a test system, ready to edit. */
export function loadCase(id) {
  const c = LF_CASES.find((x) => x.id === id) || LF_CASES[0];
  return JSON.parse(JSON.stringify(c.sys));
}
