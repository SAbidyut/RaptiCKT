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
import './power2.js';
import './energy.js';
import './comm.js';
import './misc.js';
import './extras.js';
import './sensors3.js';
import './machines2.js';
import './switches3.js';
import './digital3.js';
import './analog3.js';
import './semis3.js';
import './passive3.js';
import './ladder.js';
import './cables.js';
import './mutual.js';

import { getType } from './base.js';
export { getType, allTypes, Element, GRID, slantFor, slantAlong } from './base.js';

export const CATEGORIES = [
  { id: 'Sources', icon: 'bolt', items: ['dcv', 'acv', 'mains', 'ac3y', 'ac3d', 'rail', 'ground', 'earth', 'chassis', 'netlabel', 'benchpsu', 'dualpsu', 'pvmodule', 'dci', 'aci', 'square', 'pulse', 'pwm', 'triangle', 'sawtooth', 'sweep', 'noise', 'amsrc', 'fmsrc', 'stepsrc', 'expsrc', 'dampsine', 'pwlsrc', 'rampsrc', 'funcsrc', 'vcvs', 'vccs', 'ccvs', 'cccs', 'depsrc'] },
  { id: 'Batteries', icon: 'battery', items: ['cellaa', 'bat9v', 'coincell', 'nimh', 'nicd', 'liion', 'lipo2s', 'lifepo4', 'lifepo12', 'leadacid', 'agm', 'gel', 'batpack', 'supercap', 'bms', 'cccv'] },
  { id: 'Renewables', icon: 'sun', items: ['pvarray', 'mpptcc', 'pwmcc', 'invoff', 'invgrid', 'windgen', 'fuelcell'] },
  { id: 'Passive', icon: 'wave', items: ['resistor', 'shuntr', 'fusibler', 'rheostat', 'pot', 'trimpot', 'capacitor', 'ecap', 'npecap', 'tantalum', 'varcap', 'realcap', 'ceramiccap', 'filmcap', 'polyestercap', 'ppcap', 'micacap', 'inductor', 'varind', 'coreind', 'ferrite', 'crystal', 'ceramicres', 'tline', 'memristor'] },
  { id: 'Transformers', icon: 'coil', items: ['transformer', 'txstepdown', 'txstepup', 'isotx', 'xfmrct', 'xfmr2s', 'autotx', 'ct', 'pt', 'tx3ph', 'coupledl', 'mutual'] },
  { id: 'Protection', icon: 'shield', items: ['fuse', 'hrcfuse', 'tco', 'polyfuse', 'mcb', 'mcb2p', 'mcb3p', 'mccb', 'acb', 'rccb', 'rcbo', 'olr', 'olr3', 'phaserelay', 'voltrelay', 'idmt', 'mov', 'arrester', 'gdt', 'tvs', 'tvsbi', 'lolr', 'lphase', 'lmpcb'] },
  { id: 'Switches & Relays', icon: 'switch', items: ['switch', 'togglesw', 'slidesw', 'rockersw', 'keysw', 'oneway', 'twoway', 'threeway', 'intermediate', 'spdt', 'dpst', 'dpdt', 'pushno', 'pushnc', 'footsw', 'latchbtn', 'estop', 'limitsw', 'rotary4', 'dipsw', 'selector3', 'isolator', 'changeover', 'reed', 'floatsw', 'pressw', 'thermostat', 'vcsw', 'ccsw', 'relay', 'relayspst', 'relaydpst', 'relaydpdt', 'reedrelay', 'latchrelay', 'auxrelay', 'contactor', 'contactor2', 'tdr', 'ssr', 'lcoil', 'ltimer', 'lno', 'lnc', 'lmain3', 'lcounter', 'lcreset', 'llevel', 'llsno', 'llsnc', 'lcart', 'ltank'] },
  { id: 'Electrical', icon: 'home', items: ['bulb', 'lamp', 'halogen', 'tube', 'ballast', 'starter', 'ledbulb', 'cfl', 'ledstrip', 'leddriver', 'ledpanel', 'neon', 'fan', 'heater', 'socket', 'dimmer', 'fanregres', 'fanregcap', 'bell', 'earthrod', 'photocell', 'pirsw', 'emerg'] },
  { id: 'Power Systems', icon: 'tower', items: ['rload', 'rlload', 'rcload', 'load3y', 'load3d', 'pfcap', 'sline', 'piline', 'cable1', 'cable', 'cable4', 'busbar', 'jbox', 'faultsw'] },
  { id: 'Machines', icon: 'motor', items: ['motor', 'dcsep', 'dcshunt', 'dcseries', 'dcgen', 'im3', 'im1', 'alternator', 'im3d', 'dccompound', 'universal', 'syncmotor', 'pmsm', 'bldc', 'stepper', 'acgen1'] },
  { id: 'Diodes', icon: 'diode', items: ['diode', 'diodeq', 'fastdiode', 'ufdiode', 'powerdiode', 'sicdiode', 'avalanche', 'zener', 'schottky', 'varactor', 'tunnel', 'crd', 'pindiode', 'gunn', 'impatt', 'bridge', 'rect3'] },
  { id: 'Transistors', icon: 'transistor', items: ['npn', 'pnp', 'darlnpn', 'darlpnp', 'nmos', 'pmos', 'depnmos', 'njfet', 'pjfet', 'igbt', 'hemt', 'ujt', 'opto'] },
  { id: 'Thyristors & Power', icon: 'thyristor', items: ['scr', 'triac', 'diac', 'sidac', 'scs', 'lascr', 'igct', 'igbtmod', 'ipm', 'gto', 'put', 'optotriac', 'optoscr', 'gatedrv', 'buckmod', 'boostmod', 'hbridge', 'inv3', 'bldcdrv', 'stepdrv', 'spwm', 'firing', 'buckboost', 'cuk', 'sepic', 'flyback', 'forward', 'pushpull', 'halfbridge', 'fullbridge'] },
  { id: 'Analog ICs', icon: 'amp', items: ['opamp', 'follower', 'diffamp', 'tia', 'poweramp', 'curramp', 'comparator', 'comparatoroc', 'instamp', 'ota', 'lm386', 'ad633', 'timer555', 'timer556', 'pll4046', 'reg78', 'reg79', 'lm317', 'lm337', 'ldo', 'tl431', 'lm4040', 'chargepump', 'anaswitch', 'samplehold', 'vco', 'rms2dc'] },
  { id: 'Control & Math', icon: 'sigma', items: ['gain', 'sum2', 'sum3', 'mult', 'div', 'integ', 'deriv', 'tf1', 'tf2', 'pid', 'limiter', 'absb', 'sqrtb', 'powb', 'logb', 'expb', 'trigb', 'fcn', 'delay', 'zoh', 'ratelim', 'hystb'] },
  { id: 'Logic Gates', icon: 'logic', items: ['logicin', 'logicout', 'hexin', 'clock', 'and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor', 'buffer', 'schmitt', 'tristate', 'and3', 'or3', 'nand3', 'nor3', 'and4', 'nand4'] },
  { id: 'Digital ICs', icon: 'chip', items: ['halfadder', 'fulladder', 'halfsub', 'fullsub', 'sub4', 'adder4', 'comp4', 'mux2', 'mux4', 'demux4', 'dec2to4', 'dec3to8', 'enc4to2', 'enc8to3', 'enc4to2s', 'parity', 'decoder7', 'dlatch', 'srlatch', 'srff', 'dff', 'jkff', 'tff', 'counter', 'updown', 'bcdcounter', 'decade', 'counter8', 'ring4', 'johnson4', 'shift4', 'siso4', 'piso8', 'hc595', 'univ194', 'reg4', 'mono', 'dtimer', 'clockdiv', 'adc', 'dac', 'adc8', 'dac8', 'levelshift', 'ram16x4', 'rom16x8'] },
  { id: 'Communication', icon: 'antenna', items: ['antenna', 'rfamp', 'mixer', 'envdet', 'filterblk', 'sawfilter', 'emifilter', 'uarttx', 'uartrx', 'rs485', 'rs232', 'can', 'wireless', 'rfid', 'fiber', 'spimaster', 'i2cmaster', 'pcf8574'] },
  { id: 'Sensors', icon: 'sensor', items: ['ldr', 'photodiode', 'phototransistor', 'solar', 'ntc', 'ptc', 'pt100', 'pt1000', 'thermocouple', 'lm35', 'lm335', 'strain', 'loadcell', 'fsr', 'flex', 'lvdt', 'hall', 'hallswitch', 'acs712', 'vsense', 'accel', 'tilt', 'pir', 'irprox', 'irdist', 'ultrasonic', 'gas', 'humidity', 'soilm', 'rain', 'pressure', 'flame', 'uv', 'anemometer', 'flow', 'encoder', 'tacho', 'piezosens', 'mic', 'ph', 'capsense', 'proxind', 'proxcap', 'photoeye', 'ltx', 'ptx', 'ttx', 'ftx', 'smoke', 'gyro', 'co2', 'soundmod', 'imu', 'colorsens', 'hcsr04', 'linenc', 'magneto', 'waterlevel'] },
  { id: 'Output', icon: 'bulb', items: ['led', 'rgbled', 'bicolor', 'irled', 'laser', 'lasermod', 'sevenseg', 'seg14', 'dotmatrix', 'hexdisp', 'vubar', 'buzzer', 'piezobuzz', 'speaker', 'headphone', 'preamp', 'tonectl', 'equalizer', 'solenoid', 'servo', 'peltier', 'dcfan', 'electromagnet'] },
  { id: 'Vacuum Tubes', icon: 'tube', items: ['vacdiode', 'triode', 'pentode'] },
  { id: 'Meters', icon: 'meter', items: ['voltmeter', 'ammeter', 'acvolt', 'acamp', 'ohmmeter', 'wattmeter', 'pfmeter', 'varmeter', 'kwh', 'freqmeter', 'phasemeter', 'dbmeter', 'peakvolt', 'panelmeter', 'lcr', 'megger', 'mcvolt', 'mcamp', 'galvo', 'testpoint', 'label'] },
];

// keep each part's own category consistent with the palette it appears in
for (const c of CATEGORIES) for (const t of c.items) { const C = getType(t); if (C) C.category = c.id; }
