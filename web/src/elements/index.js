// Loads every element module so they self-register, and defines the palette layout.
import './passive.js';
import './sources.js';
import './semis.js';
import './analog.js';
import './digital.js';
import './switches.js';
import './sensors.js';
import './meters.js';
import './sources2.js';
import './protection.js';
import './electrical.js';
import './transformers.js';
import './machines.js';
import './switches2.js';
import './passive2.js';
import './semis2.js';
import './thyristors.js';
import './blocks.js';
import './analog2.js';
import './digital2.js';
import './sensors2.js';
import './outputs.js';
import './meters2.js';

import { getType } from './base.js';
export { getType, allTypes, Element, GRID } from './base.js';

export const CATEGORIES = [
  { id: 'Sources', icon: 'bolt', items: ['dcv', 'acv', 'mains', 'ac3y', 'ac3d', 'rail', 'ground', 'earth', 'chassis', 'benchpsu', 'dualpsu', 'pvmodule', 'dci', 'aci', 'square', 'pulse', 'pwm', 'triangle', 'sawtooth', 'sweep', 'noise', 'amsrc', 'fmsrc', 'stepsrc', 'expsrc', 'dampsine', 'pwlsrc', 'funcsrc', 'vcvs', 'vccs', 'ccvs', 'cccs'] },
  { id: 'Batteries', icon: 'battery', items: ['cellaa', 'bat9v', 'coincell', 'nimh', 'liion', 'lipo2s', 'leadacid', 'supercap'] },
  { id: 'Passive', icon: 'wave', items: ['resistor', 'rheostat', 'pot', 'trimpot', 'capacitor', 'ecap', 'npecap', 'tantalum', 'varcap', 'realcap', 'inductor', 'varind', 'coreind', 'ferrite', 'crystal', 'tline', 'memristor'] },
  { id: 'Transformers', icon: 'coil', items: ['transformer', 'txstepdown', 'txstepup', 'isotx', 'xfmrct', 'xfmr2s', 'autotx', 'ct', 'pt', 'tx3ph', 'coupledl'] },
  { id: 'Protection', icon: 'shield', items: ['fuse', 'hrcfuse', 'polyfuse', 'mcb', 'mcb2p', 'mcb3p', 'mccb', 'rccb', 'rcbo', 'olr', 'idmt', 'mov', 'arrester', 'gdt', 'tvs', 'tvsbi'] },
  { id: 'Switches & Relays', icon: 'switch', items: ['switch', 'oneway', 'twoway', 'threeway', 'intermediate', 'spdt', 'dpst', 'dpdt', 'pushno', 'pushnc', 'latchbtn', 'estop', 'limitsw', 'rotary4', 'selector3', 'isolator', 'changeover', 'reed', 'floatsw', 'pressw', 'thermostat', 'relay', 'relaydpdt', 'reedrelay', 'contactor', 'tdr', 'ssr'] },
  { id: 'Electrical', icon: 'home', items: ['bulb', 'lamp', 'tube', 'ballast', 'starter', 'ledbulb', 'neon', 'fan', 'heater', 'socket', 'dimmer', 'fanregres', 'fanregcap', 'bell', 'earthrod'] },
  { id: 'Power Systems', icon: 'tower', items: ['rload', 'rlload', 'rcload', 'load3y', 'load3d', 'pfcap', 'sline', 'piline'] },
  { id: 'Machines', icon: 'motor', items: ['motor', 'dcsep', 'dcshunt', 'dcseries', 'dcgen', 'im3', 'im1', 'alternator'] },
  { id: 'Diodes', icon: 'diode', items: ['diode', 'zener', 'schottky', 'varactor', 'tunnel', 'crd', 'bridge', 'rect3'] },
  { id: 'Transistors', icon: 'transistor', items: ['npn', 'pnp', 'darlnpn', 'darlpnp', 'nmos', 'pmos', 'depnmos', 'njfet', 'pjfet', 'igbt', 'ujt', 'opto'] },
  { id: 'Thyristors & Power', icon: 'thyristor', items: ['scr', 'triac', 'diac', 'gto', 'put', 'optotriac', 'gatedrv', 'buckmod', 'boostmod'] },
  { id: 'Analog ICs', icon: 'amp', items: ['opamp', 'comparator', 'instamp', 'ota', 'lm386', 'ad633', 'timer555', 'reg78', 'reg79', 'lm317', 'ldo', 'tl431', 'lm4040', 'chargepump', 'anaswitch', 'samplehold', 'vco', 'rms2dc'] },
  { id: 'Control & Math', icon: 'sigma', items: ['gain', 'sum2', 'sum3', 'mult', 'div', 'integ', 'deriv', 'tf1', 'tf2', 'pid', 'limiter', 'absb', 'sqrtb', 'powb', 'logb', 'expb', 'trigb', 'fcn', 'delay', 'zoh', 'ratelim', 'hystb'] },
  { id: 'Logic Gates', icon: 'logic', items: ['logicin', 'logicout', 'hexin', 'clock', 'and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor', 'buffer', 'schmitt', 'tristate', 'and3', 'or3', 'nand3', 'nor3', 'and4', 'nand4'] },
  { id: 'Digital ICs', icon: 'chip', items: ['halfadder', 'fulladder', 'adder4', 'comp4', 'mux2', 'mux4', 'dec2to4', 'dec3to8', 'enc4to2', 'parity', 'decoder7', 'dlatch', 'srlatch', 'dff', 'jkff', 'tff', 'counter', 'updown', 'bcdcounter', 'decade', 'counter8', 'shift4', 'reg4', 'mono', 'clockdiv', 'adc', 'dac'] },
  { id: 'Sensors', icon: 'sensor', items: ['ldr', 'photodiode', 'phototransistor', 'solar', 'ntc', 'ptc', 'pt100', 'pt1000', 'thermocouple', 'lm35', 'lm335', 'strain', 'loadcell', 'fsr', 'flex', 'lvdt', 'hall', 'hallswitch', 'acs712', 'vsense', 'accel', 'tilt', 'pir', 'irprox', 'irdist', 'ultrasonic', 'gas', 'humidity', 'soilm', 'rain', 'pressure', 'flame', 'uv', 'anemometer', 'flow', 'encoder', 'tacho', 'piezosens', 'mic', 'ph', 'capsense'] },
  { id: 'Output', icon: 'bulb', items: ['led', 'rgbled', 'bicolor', 'irled', 'laser', 'sevenseg', 'hexdisp', 'vubar', 'buzzer', 'piezobuzz', 'speaker', 'solenoid', 'servo'] },
  { id: 'Vacuum Tubes', icon: 'tube', items: ['vacdiode', 'triode', 'pentode'] },
  { id: 'Meters', icon: 'meter', items: ['voltmeter', 'ammeter', 'acvolt', 'acamp', 'ohmmeter', 'wattmeter', 'pfmeter', 'varmeter', 'kwh', 'freqmeter', 'phasemeter', 'dbmeter', 'peakvolt', 'lcr', 'megger', 'mcvolt', 'mcamp', 'galvo', 'testpoint', 'label'] },
];

// keep each part's own category consistent with the palette it appears in
for (const c of CATEGORIES) for (const t of c.items) { const C = getType(t); if (C) C.category = c.id; }
