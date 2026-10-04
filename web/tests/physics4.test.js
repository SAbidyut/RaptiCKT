// Physical checks for communication, signal-processing and installation parts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { net, run } from './netlib.js';
import { designFilter, freqResp } from '../src/elements/comm.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const mag = (secs, f) => { const h = freqResp(secs, 2 * Math.PI * f); return Math.hypot(h.re, h.im); };
const dB = (x) => 20 * Math.log10(x);

test('filter design: −3 dB / ripple edge at the cut-off, roll-off per order', () => {
  for (let n = 1; n <= 8; n++) {
    near(dB(mag(designFilter('lp', 'butter', n, 1000, 0), 1000)), -3.01, 0.02, `Butterworth n=${n}`);
    near(dB(mag(designFilter('lp', 'bessel', n, 1000, 0), 1000)), -3.01, 0.02, `Bessel n=${n}`);
    near(dB(mag(designFilter('lp', 'cheby', n, 1000, 0), 1000)), -1, 0.02, `Chebyshev n=${n}`);
    near(dB(mag(designFilter('hp', 'butter', n, 1000, 0), 1000)), -3.01, 0.02, `Butterworth HP n=${n}`);
    near(dB(mag(designFilter('lp', 'butter', n, 1000, 0), 100000)), -40 * n, 0.5, `roll-off n=${n}`);
  }
  // Chebyshev pass band stays within 1 dB
  const ch = designFilter('lp', 'cheby', 5, 1000, 0);
  for (let f = 10; f < 1000; f += 10) assert.ok(dB(mag(ch, f)) > -1.01 && dB(mag(ch, f)) < 0.01, 'ripple at ' + f);
  const bp = designFilter('bp', 'butter', 2, 10000, 1000), bs = designFilter('bs', 'butter', 2, 10000, 1000);
  near(dB(mag(bp, 10000)), 0, 0.01, 'band-pass centre');
  near(dB(mag(bp, 10000 + 500 * 1.0)), -3, 0.5, 'band-pass edge');
  assert.ok(dB(mag(bs, 10000)) < -100, 'notch depth');
  near(dB(mag(bs, 100)), 0, 0.01, 'band-stop pass band');
});

test('filter block in the time domain matches |H|', () => {
  const amp = (f) => {
    const { sim, els } = net([['acv', [1, 0], { amp: 1, freq: f }], ['filterblk', [1, 2], { fc: 1000, order: 4 }]]);
    assert.ok(sim.start(), sim.error);
    const T = 1 / f;
    run(sim, 20 * T, T / 400);
    let m = 0;
    run(sim, 2 * T, T / 400, () => { m = Math.max(m, Math.abs(sim.v(2))); });
    return m;
  };
  near(amp(1000), Math.SQRT1_2, 0.01, 'at fc');
  near(amp(200), 1, 0.01, 'pass band');
  assert.ok(amp(5000) < 0.002, 'stop band');
});

test('UART TX → RS-485 bus → UART RX delivers the text', () => {
  // TX side: uart (EN 1, TX 2) → rs485 DI=2 DE=3(5 V) RO=4 A=5 B=6; RX side rs485 DI=0 DE=0 RO=7, uartrx RX=7
  const { sim, els } = net([['uarttx', [1, 2], { text: 'Hi!', baud: 19200 }], ['dcv', [1, 0], { amp: 5 }], ['dcv', [3, 0], { amp: 5 }],
    ['rs485', [2, 3, 4, 5, 6]], ['resistor', [5, 6], { r: 120 }], ['resistor', [8, 9], { r: 120 }], ['resistor', [5, 8], { r: 1 }], ['resistor', [6, 9], { r: 1 }],
    ['rs485', [0, 0, 7, 8, 9]], ['uartrx', [7, 10], { baud: 19200 }], ['resistor', [10, 0], { r: 1e5 }], ['resistor', [4, 0], { r: 1e5 }]]);
  assert.ok(sim.start(), sim.error);
  let vmax = 0;
  run(sim, 0.01, 2e-6, () => { vmax = Math.max(vmax, sim.v(8) - sim.v(9)); });
  assert.ok(els[9].rx.startsWith('Hi!Hi!'), 'received ' + JSON.stringify(els[9].rx));
  assert.equal(els[9].errs, 0);
  assert.ok(vmax > 1.5 && vmax < 2.5, 'differential on a 60 Ω bus ' + vmax);
});

test('CAN: recessive 0 V, dominant ≈2 V differential, RXD follows', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 5 }], ['can', [1, 2, 3, 4]], ['can', [6, 5, 3, 4]], ['dcv', [6, 0], { amp: 5 }],
    ['resistor', [3, 4], { r: 60 }], ['resistor', [2, 0], { r: 1e5 }], ['resistor', [5, 0], { r: 1e5 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 1e-4, 1e-6);
  near(sim.v(3) - sim.v(4), 0, 0.01, 'recessive');
  assert.ok(sim.v(5) > 4.5, 'RXD high when recessive');
  els[0].p.amp = 0; sim.dirty = true; run(sim, 1e-4, 1e-6);
  near(sim.v(3) - sim.v(4), 2, 0.1, 'dominant');
  near(sim.v(3), 3.5, 0.1, 'CANH'); near(sim.v(4), 1.5, 0.1, 'CANL');
  assert.ok(sim.v(5) < 0.5, 'other node sees dominant');
});

test('wireless link: range limit and latency', () => {
  const { sim, els } = net([['clock', [1], { freq: 200 }], ['wireless', [1, 2], { d: 20 }], ['resistor', [2, 0], { r: 1e5 }]]);
  const w = els[1];
  assert.ok(w.margin() > 0, 'in range at 20 m: margin ' + w.margin());
  assert.ok(sim.start(), sim.error);
  let first = null;
  run(sim, 0.004, 1e-5, () => { if (first == null && sim.v(2) > 2.5) first = sim.t; });
  near(first, 5e-4, 2e-5, 'latency');
  w.p.d = 3000;
  assert.ok(w.margin() < 0, 'out of range at 3 km');
  let hi = 0;
  run(sim, 0.02, 1e-5, () => { if (sim.v(2) > 2.5) hi++; });
  assert.equal(hi, 0, 'no output out of range');
});

test('RFID reader sends the tag ID over UART when the tag is in range', () => {
  const { sim, els } = net([['rfid', [1, 2], { d: 3 }], ['uartrx', [1, 3]], ['resistor', [2, 0], { r: 1e5 }], ['resistor', [3, 0], { r: 1e5 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 0.03, 5e-6);
  assert.ok(sim.v(2) > 4.5, 'TAG high');
  assert.ok(els[1].rx.includes('0A1B2C3D4E'), 'received ' + els[1].rx);
});

test('AM: envelope detector recovers the modulation; mixer makes the difference frequency', () => {
  const { sim } = net([['amsrc', [1, 0], { amp: 2, fc: 20000, fm: 200, m: 0.5 }], ['envdet', [1, 2], { tau: 3e-4 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 0.01, 2e-6);
  let mx = -1e9, mn = 1e9;
  run(sim, 0.01, 2e-6, () => { mx = Math.max(mx, sim.v(2)); mn = Math.min(mn, sim.v(2)); });
  near(mx, 3, 0.1, 'envelope peak = A(1 + m)');
  near(mn, 1, 0.15, 'envelope trough = A(1 − m)');
  const b = net([['acv', [1, 0], { amp: 1, freq: 10000 }], ['acv', [2, 0], { amp: 1, freq: 9000 }], ['mixer', [1, 2, 3]], ['filterblk', [3, 4], { fc: 2000, order: 4 }]]);
  assert.ok(b.sim.start(), b.sim.error);
  run(b.sim, 0.01, 2e-6);
  let m = 0;
  run(b.sim, 0.002, 2e-6, () => { m = Math.max(m, Math.abs(b.sim.v(4))); });
  near(m, 0.5 * 1.0, 0.03, '1 kHz difference tone (|H(1 kHz)| ≈ 1)');
});

test('antenna: open-circuit voltage = E·h_eff', () => {
  const { sim } = net([['antenna', [1], { e: 0.001, f: 1e6 }], ['resistor', [1, 0], { r: 1e9 }]]);
  assert.ok(sim.start(), sim.error);
  let m = 0;
  run(sim, 3e-6, 1e-9, () => { m = Math.max(m, Math.abs(sim.v(1))); });
  near(m, 0.001 * 0.318 * 300, 0.002, 'peak');
});

test('EMI filter passes 50 Hz to the load', () => {
  const { sim, els } = net([['mains', [1, 0]], ['emifilter', [1, 0, 0, 2, 3]], ['resistor', [2, 3], { r: 100 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 0.04, 2e-5);
  let m = 0;
  run(sim, 0.02, 2e-5, () => { m = Math.max(m, sim.v(2) - sim.v(3)); });
  near(m, 325, 5, 'load peak voltage');
});
