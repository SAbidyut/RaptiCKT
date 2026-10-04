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

// ------------------------------------------------------------ installation & output devices
import { getType } from '../src/elements/index.js';
import { Simulator } from '../src/engine/sim.js';

test('cable: R = ρL/A at temperature, voltage drop reading', () => {
  const { sim, els } = net([['mains', [1, 0], { zs: 0 }], ['cable', [1, 0, 2, 3], { len: 30, size: '2.5' }], ['resistor', [2, 3], { r: 23 }]]);
  const c = els[1], R = 0.017241 * (1 + 0.00393 * 50) * 30 / 2.5;
  near(c.R(), R, 1e-6, 'conductor resistance');
  assert.ok(sim.start(), sim.error);
  run(sim, 0.4, 1e-4);
  const r = Object.fromEntries(c.readings(sim).map(([k, v]) => [k, v]));
  near(r['Voltage drop'], (2 * R) / (23 + 2 * R) * 100, 0.1, 'drop %');
  near(r['Current (RMS)'], 230 / (23 + 2 * R), 0.1, 'current');
  assert.equal(r['Current-carrying capacity'], 27);
});

test('net labels connect posts with the same name', () => {
  const mk = (t, x, y, p = {}) => { const C = getType(t), e = new C(x, y); Object.assign(e.p, p); e.name = t; return e; };
  // battery at (100,100): + post (60,100), − post (140,100); resistor at (300,100): (260,100)-(340,100)
  const els = [mk('dcv', 100, 100, { amp: 9 }), mk('resistor', 300, 100, { r: 1000 }), mk('netlabel', 80, 100, { name: 'VCC' }), mk('netlabel', 280, 100, { name: 'VCC' }),
    mk('ground', 140, 100), mk('ground', 340, 100)];
  const sim = new Simulator().build(els, []);
  assert.ok(sim.start(), sim.error);
  near(els[1].i, 9e-3, 1e-5, 'current through the resistor via the labels');
});

test('CFL: rated power at a poor power factor; LED driver: constant current at unity PF', () => {
  const { sim, els } = net([['mains', [1, 0]], ['cfl', [1, 0], { w: 15 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 0.3, 2e-5);
  const r = Object.fromEntries(els[1].readings().map(([k, v]) => [k, v]));
  near(r['Power (avg)'], 15 / 0.9 + 0.5, 1.5, 'CFL input power');
  assert.ok(r['Power factor'] > 0.45 && r['Power factor'] < 0.75, 'CFL PF ' + r['Power factor']);
  const d = net([['mains', [1, 0]], ['leddriver', [1, 0, 2, 3], { iset: 0.7 }], ['resistor', [2, 3], { r: 30 }]]);
  assert.ok(d.sim.start(), d.sim.error);
  run(d.sim, 0.3, 5e-5);
  near(d.els[1].io, 0.7, 0.01, 'LED current');
  let p = 0, i2 = 0, n = 0;
  run(d.sim, 0.04, 5e-5, () => { const v = d.sim.v(1), i = -d.els[0].i; p += v * i; i2 += i * i; n++; });
  const pin = p / n, irms = Math.sqrt(i2 / n);
  near(pin, (0.49 * 30) / 0.88, 1, 'input power');
  assert.ok(pin / (230 * irms) > 0.97, 'PFC power factor ' + pin / (230 * irms));
});

test('LED strip current; laser module lases at 5 V', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 12 }], ['ledstrip', [1, 0], { len: 1 }], ['dcv', [2, 0], { amp: 5 }], ['lasermod', [2, 0]]]);
  assert.ok(sim.start(), sim.error);
  const seg = els[1].segI();
  assert.ok(seg > 0.015 && seg < 0.03, 'segment current ' + seg);
  near(els[1].i, 20 * seg, 1e-6, '20 segments per metre');
  const pz = els[3].popt();
  assert.ok(pz > 0.002 && pz < 0.01, 'laser optical power ' + pz);
});

test('photocell, PIR switch and emergency light', () => {
  const { sim, els } = net([['mains', [1, 0]], ['photocell', [1, 0, 2], { lux: 300, delay: 0.1 }], ['resistor', [2, 0], { r: 1000 }],
    ['pirsw', [1, 0, 3], { lux: 5, hold: 0.2 }], ['resistor', [3, 0], { r: 1000 }]]);
  const [, pc, , pir] = els;
  assert.ok(sim.start(), sim.error);
  run(sim, 0.2, 1e-4);
  assert.ok(!pc.on && !pir.on, 'both off');
  pc.p.lux = 5; pir.p.motion = true; run(sim, 0.2, 1e-4);
  assert.ok(pc.on, 'dark: photocell on');
  assert.ok(pir.on, 'motion in the dark: light on');
  pir.p.motion = false; run(sim, 0.3, 1e-4);
  assert.ok(!pir.on, 'off after the hold time');
  const e = net([['mains', [1, 0]], ['emerg', [1, 0]]]);
  assert.ok(e.sim.start(), e.sim.error);
  run(e.sim, 0.1, 1e-4);
  assert.ok(!e.els[1].lit, 'mains present: lamp off');
  e.els[0].p.vrms = 0; e.sim.dirty = true; run(e.sim, 0.3, 1e-4);
  assert.ok(e.els[1].lit, 'mains failed: lamp lit');
});

test('panel meter text, 14-segment decoder and dot matrix', () => {
  const pm = new (getType('panelmeter'))(0, 0);
  pm.p.range = '20'; assert.equal(pm.text(12.34), ' 12.34');
  assert.equal(pm.text(25), ' 1   ');
  pm.p.range = '2'; assert.equal(pm.text(1.2345), ' 1.235'.slice(0, 6));
  pm.p.range = '0.2'; assert.equal(pm.text(-0.0456), '-45.6');
  // 0x41 = 'A' on D0..D6
  const bitsA = [1, 0, 0, 0, 0, 0, 1];
  const parts = [['seg14', [1, 2, 3, 4, 5, 6, 7]], ...bitsA.map((b, k) => ['dcv', [k + 1, 0], { amp: b ? 5 : 0 }])];
  const { sim, els } = net(parts);
  assert.ok(sim.start(), sim.error);
  run(sim, 1e-4, 1e-5);
  assert.equal(els[0].ch(), 'A');
  // dot matrix: R1 = 5 V, C1 through 330 Ω to ground; other pins through 1 MΩ
  const dm = net([['dotmatrix', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]], ['dcv', [1, 0], { amp: 5 }], ['resistor', [9, 0], { r: 330 }],
    ...[2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16].map((n) => ['resistor', [n, 0], { r: 1e6 }])]);
  assert.ok(dm.sim.start(), dm.sim.error);
  run(dm.sim, 0.1, 1e-3);
  near(dm.els[0].ii[0], (5 - 1.85) / 330, 0.0008, 'dot (1,1) current');
  assert.ok(dm.els[0].ii[1] < 1e-5, 'dot (1,2) dark');
});

test('opto-SCR latches; Peltier cools; DC fan speed; electromagnet force', () => {
  const { sim, els } = net([['dcv', [1, 0], { amp: 0 }], ['resistor', [1, 2], { r: 300 }], ['optoscr', [2, 0, 3, 0]], ['dcv', [4, 0], { amp: 12 }], ['resistor', [4, 3], { r: 100 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 1e-3, 1e-5);
  assert.ok(els[4].i < 1e-3, 'off without LED current');
  els[0].p.amp = 5; sim.dirty = true; run(sim, 1e-3, 1e-5);
  assert.ok(Math.abs(els[4].i) > 0.1, 'fired: ' + els[4].i);
  els[0].p.amp = 0; sim.dirty = true; run(sim, 1e-3, 1e-5);
  assert.ok(Math.abs(els[4].i) > 0.1, 'latched on DC');
  const p = net([['dcv', [1, 0], { amp: 12 }], ['peltier', [1, 0], { qload: 5 }]]);
  assert.ok(p.sim.start(), p.sim.error);
  run(p.sim, 40, 5e-3);
  const pe = p.els[1];
  assert.ok(pe.tc - 273.15 < 10, 'cold side well below ambient: ' + (pe.tc - 273.15));
  assert.ok(pe.th > pe.tc + 20, 'ΔT > 20 K');
  const f = net([['dcv', [1, 0], { amp: 12 }], ['dcfan', [1, 0]], ['dcv', [2, 0], { amp: 3 }], ['dcfan', [2, 0]]]);
  assert.ok(f.sim.start(), f.sim.error);
  run(f.sim, 3, 1e-3);
  near(f.els[1].w * 60 / (2 * Math.PI), 2500, 60, 'rated speed at 12 V');
  near(f.els[1].i, 0.15, 0.01, 'rated current');
  assert.ok(f.els[3].w < 1, 'stalled at 3 V');
  const m = net([['dcv', [1, 0], { amp: 12 }], ['electromagnet', [1, 0]]]);
  assert.ok(m.sim.start(), m.sim.error);
  near(m.els[1].force(), (1.5 * 1.5 * 4e-4) / (4e-7 * Math.PI), 1, 'saturated holding force');
});

test('ACB: long-time, short-time and instantaneous trips; thermal fuse', () => {
  const trip = (amps, extra = {}) => {
    const { sim, els } = net([['dcv', [2, 0], { amp: amps * (0.01 + 0.004 / 3) }], ['resistor', [2, 1], { r: 0.01 }], ['acb', [1, 1, 1, 0, 0, 0], { tr: 1, ...extra }]]);
    assert.ok(sim.start(), sim.error);
    let t = null;
    run(sim, 6, 1e-3, () => { if (t == null && els[2].tripped) t = sim.t; });
    return { t, why: els[2].cause };
  };
  const lt = trip(4800 * 3), st = trip(16000 * 3), ins = trip(30000 * 3);
  // three poles in parallel share the current equally
  near(lt.t, -(1 / 0.04807) * Math.log(1 - 1.69 / 9), 0.2, 'long-time at 3 Ir');
  near(st.t, 0.2, 0.03, 'short-time delay'); assert.match(st.why, /short-time/);
  assert.ok(ins.t < 0.005, 'instantaneous'); assert.match(ins.why, /magnetic/);
  const { sim, els } = net([['dcv', [1, 0], { amp: 10 }], ['tco', [1, 2]], ['resistor', [2, 0], { r: 10 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 0.01, 1e-4); near(els[2].i, 1, 0.01, 'closed');
  els[1].p.temp = 160; run(sim, 0.01, 1e-4); assert.ok(els[1].open && Math.abs(els[2].i) < 1e-6, 'opened');
});

test('SPI master → 74HC595 latches each byte; I²C master → PCF8574 port with ACK', () => {
  // spimaster SCK=1 MOSI=2 CS=3 ; 595: SER=2 SRCLK=1 RCLK=3 OE=0, Q0..Q7 = 10..17, Q7' = 18
  const { sim, els } = net([['spimaster', [1, 2, 3], { data: 'A5 3C', clk: 10000, gap: 0.002 }], ['hc595', [2, 1, 3, 0, 10, 11, 12, 13, 14, 15, 16, 17, 18]]]);
  assert.ok(sim.start(), sim.error);
  const seen = new Set();
  run(sim, 0.01, 5e-6, () => seen.add(els[1].lat));
  assert.ok(seen.has(0xa5) && seen.has(0x3c), 'latched ' + [...seen].map((x) => x.toString(16)));
  // I²C: pull-ups 4.7 kΩ to 5 V
  const b = net([['dcv', [9, 0], { amp: 5 }], ['resistor', [9, 1], { r: 4700 }], ['resistor', [9, 2], { r: 4700 }],
    ['i2cmaster', [1, 2], { data: '5A', rate: 20000 }], ['pcf8574', [1, 2, 10, 11, 12, 13, 14, 15, 16, 17]],
    ...[10, 11, 12, 13, 14, 15, 16, 17].map((n) => ['resistor', [n, 0], { r: 1e6 }])]);
  assert.ok(b.sim.start(), b.sim.error);
  run(b.sim, 0.03, 2e-6);
  assert.equal(b.els[4].port, 0x5a, 'port value');
  assert.equal(b.els[3].lastAck, 'ACK');
  assert.ok(b.sim.v(11) > 4 && b.sim.v(10) < 0.5, 'P1 high, P0 low');
  const c = net([['dcv', [9, 0], { amp: 5 }], ['resistor', [9, 1], { r: 4700 }], ['resistor', [9, 2], { r: 4700 }],
    ['i2cmaster', [1, 2], { data: '5A', rate: 20000, addr: 33 }], ['pcf8574', [1, 2, 10, 11, 12, 13, 14, 15, 16, 17]],
    ...[10, 11, 12, 13, 14, 15, 16, 17].map((n) => ['resistor', [n, 0], { r: 1e6 }])]);
  assert.ok(c.sim.start(), c.sim.error);
  run(c.sim, 0.03, 2e-6);
  assert.match(c.els[3].lastAck, /NACK/, 'wrong address is not acknowledged');
  assert.equal(c.els[4].port, 255);
});

test('equaliser band gains; magnetometer heading', async () => {
  const { freqResp } = await import('../src/elements/comm.js');
  const eq = new (getType('equalizer'))(0, 0);
  const g = (f) => { const h = freqResp(eq.secs, 2 * Math.PI * f); return 20 * Math.log10(Math.hypot(h.re, h.im)); };
  near(g(60), 4, 0.6, '60 Hz band');
  near(g(14000), 3, 0.6, '14 kHz band');
  const m = new (getType('magneto'))(0, 0); m.p.hdg = 90;
  const r = Object.fromEntries(m.readings().map(([k, v]) => [k, v]));
  near(r['Heading from X, Y'], 90, 1e-6, 'heading');
});

test('fault injection: open and short terminals, leakage, timed fault switch', () => {
  const mk = (fault) => {
    const { sim, els } = net([['dcv', [1, 0], { amp: 10 }], ['resistor', [1, 2], { r: 1000 }], ['resistor', [2, 0], { r: 1000 }]]);
    els[2].fault = fault; sim.buildNet(els);
    assert.ok(sim.start(), sim.error);
    return sim.v(2);
  };
  near(mk(null), 5, 1e-6, 'healthy divider');
  near(mk({ m: 'open', a: 0 }), 10, 1e-3, 'lower resistor open');
  near(mk({ m: 'short', a: 0, b: 1 }), 10 * 1e-3 / 1000, 1e-4, 'lower resistor shorted');
  near(mk({ m: 'res', a: 0, b: 1, r: 1000 }), 10 * 500 / 1500, 1e-6, 'leakage 1 kΩ in parallel');
  // BJT collector–emitter short keeps the load on with no base drive
  const q = net([['dcv', [1, 0], { amp: 12 }], ['resistor', [1, 2], { r: 1000 }], ['npn', [0, 2, 0]]]);
  q.els[2].fault = { m: 'short', a: 1, b: 2 }; q.sim.buildNet(q.els);
  assert.ok(q.sim.start(), q.sim.error);
  near(q.els[1].i, 12e-3, 1e-4, 'C–E short');
  // timed fault blows the fuse
  const f = net([['mains', [1, 0], { zs: 0.1 }], ['fuse', [1, 2], { rating: 10, i2t: 5 }], ['resistor', [2, 0], { r: 46 }], ['faultsw', [2, 0], { tf: 0.04 }]]);
  assert.ok(f.sim.start(), f.sim.error);
  run(f.sim, 0.2, 5e-5);
  assert.ok(f.els[1].blown, 'fuse cleared the fault');
  assert.ok(f.els[3].peak > 100, 'fault current before the fuse cleared ' + f.els[3].peak);
});

test('faults survive JSON round trip', async () => {
  const { Element } = await import('../src/elements/base.js');
  const r = new (getType('resistor'))(0, 0); r.fault = { m: 'res', a: 0, b: 1, r: 220 };
  const o = JSON.parse(JSON.stringify(r.toJSON()));
  const back = Element.fromJSON(o);
  assert.deepEqual(back.fault, { m: 'res', a: 0, b: 1, r: 220 });
});

// ------------------------------------------------------------ model fixes
test('UART transmitter with EN left unconnected is enabled (pull-up) and is received', () => {
  const { sim, els } = net([['uarttx', [1, 2], { text: 'AB' }], ['uartrx', [2, 3]]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 0.01, 1e-5);
  assert.ok(sim.v(1) > 4, 'EN pulled high: ' + sim.v(1));
  assert.ok(els[1].rx.startsWith('AB'), 'received ' + els[1].rx);
});

test('SCR stays latched while gated, even when an inductive load keeps its current below IH at first', () => {
  for (const dt of [2e-5, 2e-6]) {
    const { sim, els } = net([['dcv', [1, 0], { amp: 100 }], ['scr', [1, 2, 3]], ['inductor', [2, 0], { l: 1 }], ['dcv', [4, 2], { amp: 5 }], ['resistor', [4, 3], { r: 100 }]], { initialDC: false });
    assert.ok(sim.start(), sim.error);
    run(sim, 2e-3, dt); // di/dt = 100 A/s: 0.2 A after 2 ms — but only 2 mA after the first 20 µs
    assert.ok(els[1].on, 'latched at dt ' + dt);
    near(els[2].i, 0.2, 0.01, 'inductor current at dt ' + dt);
  }
});

test('DC motor: starts at rest; a positive load torque never turns an unpowered shaft backwards', () => {
  const { sim, els } = net([['motor', [1, 0], { ra: 2, la: 1e-3, k: 0.02, j: 1e-5, b: 1e-6, load: 0.01 }], ['resistor', [1, 0], { r: 1e6 }]]);
  assert.ok(sim.start(), sim.error);
  assert.equal(els[0].w, 0);
  run(sim, 0.5, 1e-4);
  assert.ok(Math.abs(els[0].w) < 0.6, 'shaft held near standstill: ' + els[0].w);
});

test('battery: an exhausted cell collapses instead of holding its cut-off voltage forever', () => {
  const { sim, els } = net([['liion', [1, 0], { soc: 2, ah: 0.001, rint: 0.05 }], ['resistor', [1, 0], { r: 4 }]]);
  assert.ok(sim.start(), sim.error);
  run(sim, 2, 1e-3); // 0.02 mAh·… left: empty within ≈0.1 s at ≈0.8 A
  assert.ok(sim.v(1) < 1, 'terminal voltage after exhaustion: ' + sim.v(1));
});
