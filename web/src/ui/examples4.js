// Real-life relay circuits: 8-pin and 14-pin plug-in relays, the automatic voltage
// stabilizer and the car turn-signal flasher.

const C = ['#facc15', '#22d3ee', '#f472b6', '#4ade80'];

export const EXAMPLES4 = [
  {
    id: 'relay8latch', cat: 'Industrial Control', title: '8-pin relay: start / stop with hold-in (MY2N)',
    desc: 'The classic self-holding circuit built with an 8-pin MY2N relay and its 230 V AC coil (13–14). Press START: the coil pulls in, pole 2 (12 common → 8 NO) closes across the START button, so the relay stays on after you let go. Press STOP to break the coil circuit. Pole 1 shows the state: 9 common → 5 NO lights the green RUN lamp, 9 → 1 NC the red OFF lamp. Pin 4 (NC of pole 2) is not used.',
    build(b) {
      const src = b.vr('mains', 0, 0);
      b.h('pushnc', 3, 6); b.h('pushno', 7, 6);
      const k = b.el('relay8', 12, 0);
      const off = b.v('bulb', 18, -4, { w: 15 }), run = b.v('bulb', 21, -4, { w: 15 });
      void src;
      // neutral to the coil (14) and the lamps
      b.w([0, -2], [0, -6], [8, -6], [8, -1], b.pin(k, 0));
      b.w([8, -6], [21, -6]);
      // live → STOP → START → coil (13)
      b.w([0, 2], [0, 6], [1, 6]);
      b.w([9, 6], b.pin(k, 1));
      // hold-in contact 12–8 across START
      b.w(b.pin(k, 5), [17, 1], [17, 8], [5, 8], [5, 6]);
      b.w(b.pin(k, 7), [16, 3], [16, 7], [9, 7], [9, 6]);
      // pole 1: live to 9, lamps on 1 (NC) and 5 (NO)
      b.w([0, 6], [-2, 6], [-2, -9], [16, -9], [16, -2], b.pin(k, 2));
      b.w(b.pin(k, 3), [18, -1], [18, -2]);
      b.w(b.pin(k, 4), [21, 0], [21, -2]);
      b.label(3, 4.4, 'STOP'); b.label(7, 4.4, 'START'); b.label(18, -7.3, 'OFF'); b.label(21, -7.3, 'RUN'); b.label(-4.5, 0, '230 V');
      b.cur(run, C[0]); b.cur(off, C[1]);
    },
  },
  {
    id: 'relay14four', cat: 'Industrial Control', title: '14-pin relay switching four circuits (MY4N)',
    desc: 'One switch, four separate circuits: the 14-pin MY4N relay has four changeover poles (common 9, 10, 11, 12; NC 1, 2, 3, 4; NO 5, 6, 7, 8) driven by one 230 V AC coil on 13–14. Turn the switch on and all four lamps light together through the NO contacts 5, 6, 7 and 8; turn it off and they all go out. The NC contacts 1–4 are left free — in a panel they would light an OFF lamp or interlock another starter.',
    build(b) {
      b.v('mains', 0, 0);
      b.h('oneway', 5, -6);
      const k = b.el('relay14', 12, 0);
      b.w([0, -2], [0, -6], [3, -6]);
      b.w([7, -6], [8, -6], [8, -1], b.pin(k, 0));
      b.w([0, 2], [0, 12], [27, 12]);
      b.w(b.pin(k, 1), [8, 1], [8, 12]);
      // live to the four commons
      b.w([0, -6], [0, -8], [16, -8], [16, 4], b.pin(k, 11));
      for (const c of [2, 5, 8]) b.w(b.pin(k, c), [16, b.pin(k, c)[1]]);
      // NO contacts → lamps → neutral
      const lamps = [];
      [[4, 27], [7, 24], [10, 21], [13, 18]].forEach(([no, x]) => {
        const y = b.pin(k, no)[1];
        lamps.push(b.v('bulb', x, y + 2, { w: 25 }));
        b.w(b.pin(k, no), [x, y]);
        b.w([x, y + 4], [x, 12]);
      });
      b.label(5, -4.4, 'switch'); b.label(-4.5, 0, '230 V');
      b.cur(lamps[0], C[0]);
    },
  },
  {
    id: 'timer8delay', cat: 'Industrial Control', title: '8-pin timer: on-delay lamp (H3CR-A8 / AH3-3)',
    desc: 'An 8-pin plug-in timer set to on-delay, 3 s. Turn the switch on: the timer is powered on 2–7, its dial runs, and the red WAIT lamp stays lit through 1 → 4 (NC). After 3 s the contacts change over: 1 → 3 (NO) lights the green ON lamp and WAIT goes out. Turn the switch off and it resets at once. Select the timer to change the time with the knob or pick off-delay, interval or flicker. Pole 2 (8 common, 5 NC, 6 NO) is free.',
    build(b) {
      b.v('mains', 0, 0);
      b.h('oneway', 5, -6);
      const k = b.el('timer8', 12, 0, { t: 3, mode: 'on' });
      const on = b.v('bulb', 18, 2, { w: 15 }), wait = b.v('bulb', 21, 1, { w: 15 });
      b.w([0, -2], [0, -6], [3, -6]);
      b.w([7, -6], [8, -6], [8, -1], b.pin(k, 0));
      b.w([0, 2], [0, 8], [8, 8], [8, 1], b.pin(k, 1));
      b.w([8, 8], [21, 8]);
      b.w([0, -6], [0, -8], [16, -8], [16, -2], b.pin(k, 2));
      b.w(b.pin(k, 4), [18, 0]);
      b.w(b.pin(k, 3), [21, -1]);
      b.w([18, 4], [18, 8]); b.w([21, 3], [21, 8]);
      b.label(18, -2.4, 'ON'); b.label(21, -2.4, 'WAIT'); b.label(5, -4.4, 'switch'); b.label(-4.5, 0, '230 V');
      b.cur(on, C[0]); b.cur(wait, C[1]);
    },
  },
  {
    id: 'stabilizer', cat: 'Electrical Wiring', title: 'Automatic voltage stabilizer on low / high mains',
    desc: 'A relay-type stabilizer in front of a 100 W load. Select the mains source and turn its voltage knob: from 230 V down to 180 V or 150 V the stabilizer switches to a boost tap (×1.3, ×1.5) and from 250 V up to the buck tap (×0.88), so the load keeps getting about 220 V. Below its 140 V low cut or above its 280 V high cut it disconnects the load, and when the mains comes back it waits its start delay (1 s here, 3 s to 3 min on real units) before reconnecting — that protects fridge compressors.',
    build(b) {
      b.v('mains', 0, 0);
      const st = b.el('stabilizer', 6, -2, { tdel: 1 });
      const ld = b.v('bulb', 12, 0, { w: 100 });
      const vm = b.v('acvolt', 15, 0);
      b.w([0, -2], b.pin(st, 0));
      b.w([0, 2], [0, 4], [15, 4], [15, 2]);
      b.w(b.pin(st, 2), [6, 4]);
      b.w(b.pin(st, 1), [12, -2], [15, -2]);
      b.w([12, 2], [12, 4]);
      b.label(-4, 0, 'mains'); b.label(12, 5.2, 'load');
      b.volt(ld, C[0]); void vm;
      b.doc.simSettings.speed = 0.5;
    },
  },
  {
    id: 'flasher', cat: 'Switches', title: 'Car turn indicators with a flasher relay',
    desc: 'A 3-pin electronic flasher (B to battery +, E to ground, L to the lamps) flashes two 21 W indicator bulbs about 85 times a minute. Tap the turn switch to stop them. Select a bulb and use the fault menu to open-circuit it (a blown bulb): the lamp current halves and the flasher flashes twice as fast — the warning every driver knows.',
    build(b) {
      b.v('dcv', 0, 0, { amp: 12.6 });
      const f = b.el('flasher', 5, -1);
      b.h('switch', 9, -1, { closed: true });
      const l1 = b.v('lamp', 13, 1, { v: 12, w: 21 }), l2 = b.v('lamp', 16, 1, { v: 12, w: 21 });
      b.el('ground', 0, 4);
      b.w([0, -2], b.pin(f, 0));
      b.w([0, 2], [0, 4], [16, 4], [16, 3]);
      b.w(b.pin(f, 1), [2, 0], [2, 4]);
      b.w([11, -1], [16, -1]);
      b.w([13, 3], [13, 4]);
      b.label(-3.4, 0, '12 V'); b.label(9, -2.6, 'turn switch'); b.label(14.5, 5.2, 'front + rear');
      b.cur(l1, C[0]); void l2;
      b.doc.simSettings.speed = 1; b.doc.simSettings.maxStep = 1e-3;
    },
  },
];

// relay contacts left free on purpose (pin 4 of the MY2N, the four NC contacts of the MY4N)
export const ALLOW_OPEN4 = { relay8latch: 1, relay14four: 4, timer8delay: 3 };
