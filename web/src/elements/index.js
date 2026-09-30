// Loads every element module so they self-register, and defines the palette layout.
import './passive.js';
import './sources.js';
import './semis.js';
import './analog.js';
import './digital.js';
import './switches.js';
import './sensors.js';
import './meters.js';

export { getType, allTypes, Element, GRID } from './base.js';

export const CATEGORIES = [
  { id: 'Sources', icon: 'bolt', items: ['dcv', 'acv', 'rail', 'ground', 'dci', 'aci', 'square', 'pulse', 'triangle', 'sawtooth', 'sweep', 'noise', 'vcvs', 'vccs', 'ccvs', 'cccs'] },
  { id: 'Passive', icon: 'wave', items: ['resistor', 'pot', 'capacitor', 'ecap', 'inductor', 'transformer', 'fuse'] },
  { id: 'Semiconductors', icon: 'chip', items: ['diode', 'zener', 'schottky', 'npn', 'pnp', 'nmos', 'pmos', 'njfet', 'pjfet'] },
  { id: 'Analog ICs', icon: 'amp', items: ['opamp', 'comparator', 'timer555', 'reg78', 'lm317'] },
  { id: 'Digital', icon: 'logic', items: ['logicin', 'logicout', 'clock', 'and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor', 'buffer', 'schmitt', 'dff', 'jkff', 'tff', 'srlatch', 'counter', 'decoder7', 'adc', 'dac'] },
  { id: 'Sensors', icon: 'sensor', items: ['ldr', 'ntc', 'pt100', 'thermocouple', 'lm35', 'photodiode', 'phototransistor', 'solar', 'hall', 'strain', 'fsr', 'flex', 'gas', 'humidity', 'mic', 'pir'] },
  { id: 'Switches', icon: 'switch', items: ['switch', 'spdt', 'pushno', 'pushnc', 'relay'] },
  { id: 'Output', icon: 'bulb', items: ['led', 'lamp', 'sevenseg', 'motor', 'buzzer'] },
  { id: 'Meters', icon: 'meter', items: ['voltmeter', 'ammeter', 'ohmmeter', 'wattmeter', 'label'] },
];
