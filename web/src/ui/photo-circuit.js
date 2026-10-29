// Circuit from a photo: the drawing that Claude reads off a picture of a circuit diagram (a
// textbook figure, a sketch), described on a grid, turned into a board circuit. The format is
// what the JSON schema below asks for; buildFromDrawing() is pure (no network) so it can be
// tested on hand-written drawings.
//
// Grid: x to the right, y down, one unit between neighbouring junctions or parts. Every part
// runs from one grid point to another along a horizontal or vertical line; wires join grid
// points; a point where a part ends, a wire bends or wires meet is one node.

import { getType, GRID } from '../elements/index.js';
import { CircuitDoc } from './doc.js';

const G = GRID;
const U = 6 * G; // one grid unit on the board: an 80-unit part with a 20-unit lead at each end

// ------------------------------------------------------------------ what Claude returns
const PT = { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'], additionalProperties: false };
export const KINDS = ['resistor', 'voltage_source', 'current_source', 'dependent_voltage_source', 'dependent_current_source', 'capacitor', 'inductor', 'ac_voltage_source', 'ac_current_source', 'open_switch', 'closed_switch'];
const CIRCUIT = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    parts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: KINDS },
          text: { type: 'string' },
          value: { type: 'number' },
          from: PT,
          to: PT,
          polarity: { type: 'string', enum: ['from', 'to', 'none'] },
          control: { type: 'string' },
        },
        required: ['kind', 'text', 'value', 'from', 'to', 'polarity', 'control'],
        additionalProperties: false,
      },
    },
    wires: { type: 'array', items: { type: 'object', properties: { from: PT, to: PT }, required: ['from', 'to'], additionalProperties: false } },
    ground: { type: 'array', items: PT },
    quantities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kind: { type: 'string', enum: ['node_voltage', 'voltage_across', 'current_through'] },
          at: PT,
          part: { type: 'integer' },
          positive: { type: 'string', enum: ['from', 'to', 'none'] },
        },
        required: ['name', 'kind', 'at', 'part', 'positive'],
        additionalProperties: false,
      },
    },
    asked: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'parts', 'wires', 'ground', 'quantities', 'asked'],
  additionalProperties: false,
};
export const PHOTO_SCHEMA = {
  type: 'object',
  properties: {
    circuits: { type: 'array', items: CIRCUIT },
    problem: { type: 'string' },
  },
  required: ['circuits', 'problem'],
  additionalProperties: false,
};

export const PHOTO_PROMPT = `You read circuit diagrams from photos and screenshots (textbook figures, exam papers, hand sketches) and describe each circuit exactly, so that it can be rebuilt and simulated.

Describe every circuit diagram in the image in "circuits" (a page with several figures gives several circuits, in reading order; give each the figure caption or number as its title, else a short description). If the image shows no circuit diagram, or it is too blurred to read, return no circuits and say why in "problem". Use "problem" also to mention anything you were unsure of; otherwise leave it empty.

Coordinates: put the circuit on a grid of integer points, x to the right and y downwards, (0, 0) at the top-left corner. Give every corner, junction dot, T-junction and end of a part its own grid point, keeping the layout of the drawing: parts side by side in the drawing get neighbouring columns or rows, and the grid follows the drawing's rows and columns (the top wire is one y, the bottom wire another; each vertical branch is its own x). Every part runs between two grid points on one horizontal or vertical line ("from" and "to"), usually one unit apart; two parts in series on one line need three points. Wires are straight horizontal or vertical segments between grid points ("wires"); add one for every stretch of plain wire, including short ones joining a part to a corner. Do not leave a part end unconnected unless the drawing really leaves it open (an output terminal).

Parts:
- resistor: value in ohms (2 kΩ → 2000).
- voltage_source: an independent source drawn with + and − (a circle with ±, or a battery: the long plate is +). value in volts; polarity = the end ("from" or "to") where its + is.
- current_source: a circle with an arrow. value in amperes; polarity = the end its arrow points to.
- dependent_current_source / dependent_voltage_source: a diamond. value = the number in front of the controlling quantity (0.1 in "0.1vx", 4 in "4ix"; 1 if there is none); control = the name of that quantity exactly as written ("vx", "ix", "Vo"); polarity as for the independent sources. Every control name must also be described in "quantities".
- capacitor (farads), inductor (henries), ac_voltage_source / ac_current_source (amplitude), open_switch / closed_switch (value 0).
- text = the part's label as printed ("20 Ω", "0.1vx", "12 V").

Quantities ("quantities"): every named voltage or current marked on the drawing (vx, Vo, i, ix, io …), and every control name of a dependent source.
- node_voltage: a voltage written at a node with no + / − marks (it is that node's voltage to ground); "at" = a grid point on that node; part = -1; positive = "none".
- voltage_across: a voltage shown with + and − across a part; part = the index of that part in "parts" (from 0); positive = the end of that part ("from" or "to") marked +; "at" = the part's "from" point.
- current_through: a current shown by an arrow beside or on a part; part = its index; positive = the end of the part the arrow points towards; "at" = the part's "from" point. If the arrow is on a plain wire, name the part in series with that wire.

ground: the grid points of ground symbols (empty if the drawing has none). asked: the names of the quantities the problem text asks to find, if any is visible.`;

// ------------------------------------------------------------------ drawing → board
const key = (p) => p.x + ',' + p.y;
const W = (p) => [p.x * U, p.y * U];

const TYPE = { resistor: 'resistor', voltage_source: 'dcv', current_source: 'dci', capacitor: 'capacitor', inductor: 'inductor', ac_voltage_source: 'acv', ac_current_source: 'aci', open_switch: 'switch', closed_switch: 'switch', dependent_current_source: 'depsrc', dependent_voltage_source: 'depsrc' };
const PREFIX = { resistor: 'R', dcv: 'V', dci: 'I', capacitor: 'C', inductor: 'L', acv: 'V', aci: 'I', switch: 'S', depsrc: 'D' };

/**
 * Build a board circuit from one described circuit. Returns { doc, warnings }: warnings say what
 * could not be rebuilt as described (a part end left open, a control that names nothing …).
 */
export function buildFromDrawing(c) {
  const doc = new CircuitDoc(c.title || 'Circuit from photo');
  doc.description = 'Read from a photo.';
  const warnings = [];
  const parts = (c.parts || []).filter((p) => p && TYPE[p.kind] && p.from && p.to && key(p.from) !== key(p.to));
  if (parts.length < (c.parts || []).length) warnings.push('Some parts could not be placed (both ends on one point, or an unknown kind) and were left out.');
  const count = {};
  const made = [];
  const quantities = c.quantities || [];
  // every point that must be a connection: part ends, ground, node-voltage labels
  const points = new Map();
  const mark = (p) => points.set(key(p), p);
  for (const p of parts) { mark(p.from); mark(p.to); }
  for (const g of c.ground || []) mark(g);
  for (const q of quantities) if (q.kind === 'node_voltage' && q.at) mark(q.at);
  for (const w of c.wires || []) { mark(w.from); mark(w.to); }

  parts.forEach((p) => {
    const type = TYPE[p.kind];
    const C = getType(type);
    const P = W(p.from), Q = W(p.to), mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
    const el = new C(mx, my);
    count[type] = (count[type] || 0) + 1;
    el.name = `${PREFIX[type]}${count[type]}`;
    const v = Number.isFinite(p.value) ? p.value : 0;
    if (type === 'resistor') el.p.r = v > 0 ? v : 1;
    else if (type === 'dcv' || type === 'dci' || type === 'acv' || type === 'aci') el.p.amp = v;
    else if (type === 'capacitor') el.p.c = v > 0 ? v : 1e-6;
    else if (type === 'inductor') el.p.l = v > 0 ? v : 1e-3;
    else if (type === 'switch') el.p.closed = p.kind === 'closed_switch';
    // the first terminal goes at: + of a voltage source, the tail of a current source's arrow
    let head = p.from;
    const isV = p.kind === 'voltage_source' || p.kind === 'ac_voltage_source' || p.kind === 'dependent_voltage_source';
    const isI = p.kind === 'current_source' || p.kind === 'ac_current_source' || p.kind === 'dependent_current_source';
    if (isV && p.polarity === 'to') head = p.to;
    if (isI) head = p.polarity === 'from' ? p.to : p.from;
    const tail = head === p.from ? p.to : p.from;
    const H = W(head), horiz = P[1] === Q[1], vert = P[0] === Q[0];
    if (!horiz && !vert) warnings.push(`${el.name} (${p.text || p.kind}) is drawn at a slant; it was laid straight.`);
    el.rot = horiz || !vert ? (H[0] < mx ? 0 : 2) : H[1] < my ? 1 : 3;
    el.onParamChange?.();
    doc.elements.push(el);
    const [p0, p1] = el.getPosts();
    const lead = (from, post) => { if (from[0] !== post[0] || from[1] !== post[1]) doc.addWire(from[0] === post[0] || from[1] === post[1] ? [from, post] : [from, [post[0], from[1]], post]); };
    lead(W(head), p0); lead(W(tail), p1);
    made.push({ part: p, el, head, tail });
  });

  // plain wires, split at every connection point on them so each junction is explicit
  for (const w of c.wires || []) {
    if (!w.from || !w.to || key(w.from) === key(w.to)) continue;
    const segs = w.from.x === w.to.x || w.from.y === w.to.y ? [[w.from, w.to]] : [[w.from, { x: w.to.x, y: w.from.y }], [{ x: w.to.x, y: w.from.y }, w.to]];
    for (const [a, b] of segs) {
      if (key(a) === key(b)) continue;
      const inside = [...points.values()].filter((p) => {
        if (key(p) === key(a) || key(p) === key(b)) return false;
        if (a.x === b.x) return p.x === a.x && p.y > Math.min(a.y, b.y) && p.y < Math.max(a.y, b.y);
        return p.y === a.y && p.x > Math.min(a.x, b.x) && p.x < Math.max(a.x, b.x);
      }).sort((p, q) => (Math.abs(p.x - a.x) + Math.abs(p.y - a.y)) - (Math.abs(q.x - a.x) + Math.abs(q.y - a.y)));
      let at = a;
      for (const p of [...inside, b]) { doc.addWire([W(at), W(p)]); at = p; }
    }
  }

  // ground: as drawn, else at the lowest-left point of the circuit (the usual reference)
  const grounds = (c.ground || []).length ? c.ground : [];
  for (const g of grounds) doc.elements.push(new (getType('ground'))(...W(g)));

  // named quantities: node voltages get a net label (dependent sources and the reader use it)
  const byName = new Map();
  for (const q of quantities) {
    if (!q || !q.name) continue;
    byName.set(q.name, q);
    if (q.kind === 'node_voltage' && q.at) {
      const nl = new (getType('netlabel'))(0, 0);
      nl.p.name = q.name;
      const [x, y] = W(q.at);
      // its terminal on the point, the tag pointing where nothing else leaves it
      const [dx, dy, rot] = freeSide(c, parts, q.at, points);
      nl.rot = rot; nl.x = x + dx * G; nl.y = y + dy * G;
      nl.onParamChange?.();
      doc.elements.push(nl);
    }
  }
  const needGround = !grounds.length && made.some(({ part }) => part.control && byName.get(part.control)?.kind === 'node_voltage');
  if (needGround || (!grounds.length && made.length)) {
    // the bottom wire is the reference in a textbook drawing: its leftmost point
    const pts = [...points.values()];
    const maxY = Math.max(...pts.map((p) => p.y));
    const g = pts.filter((p) => p.y === maxY).sort((p, q) => p.x - q.x)[0];
    if (g) doc.elements.push(new (getType('ground'))(...W(g)));
    if (needGround) warnings.push('No ground was drawn: the bottom wire was taken as 0 V for the node voltages.');
  }

  // dependent sources: what controls them
  for (const { part, el } of made) {
    if (el.constructor.type !== 'depsrc') continue;
    const q = byName.get(part.control);
    const isI = part.kind === 'dependent_current_source';
    el.p.gain = Number.isFinite(part.value) ? part.value : 1;
    el.p.sym = part.control || '';
    if (!q) { warnings.push(`${el.name} (${part.text}) is controlled by "${part.control}", which is not marked on the drawing: set its control in the part's settings.`); el.p.kind = isI ? 'vccs' : 'vcvs'; el.p.ctrl = ''; continue; }
    if (q.kind === 'node_voltage') { el.p.kind = isI ? 'vccs' : 'vcvs'; el.p.ctrl = `node:${q.name}`; continue; }
    const ref = made[q.part];
    if (!ref) { warnings.push(`${el.name}: the part that "${q.name}" refers to is missing.`); continue; }
    // the reference part's first terminal is its head: flip the gain when the marking runs the other way
    const posEnd = q.positive === 'to' ? ref.part.to : ref.part.from;
    const sameWay = q.kind === 'voltage_across' ? key(posEnd) === key(ref.head) : key(posEnd) === key(ref.tail);
    if (!sameWay) el.p.gain = -el.p.gain;
    if (q.kind === 'voltage_across') { el.p.kind = isI ? 'vccs' : 'vcvs'; el.p.ctrl = `v:${ref.el.name}`; } else { el.p.kind = isI ? 'cccs' : 'ccvs'; el.p.ctrl = `i:${ref.el.name}`; }
    el.onParamChange?.();
  }

  // a part end that nothing joins
  const used = new Map();
  const bump = (p) => used.set(key(p), (used.get(key(p)) || 0) + 1);
  for (const p of parts) { bump(p.from); bump(p.to); }
  for (const w of c.wires || []) { bump(w.from); bump(w.to); }
  for (const g of grounds) bump(g);
  const loose = [];
  for (const { part, el } of made) for (const p of [part.from, part.to]) if ((used.get(key(p)) || 0) < 2 && !wireThrough(c.wires || [], p)) loose.push(el.name);
  if (loose.length) warnings.push(`Not joined to anything at one end: ${[...new Set(loose)].join(', ')}. Check the photo and add the missing wire.`);
  return { doc, warnings, asked: c.asked || [] };
}

/**
 * Which way a label can stick out of point p without lying on a part or wire: [dx, dy, rot] of
 * a net label whose terminal sits on p. Up on the top row, down on the bottom row, else the
 * first free side.
 */
function freeSide(c, parts, p, points) {
  const used = new Set();
  const dir = (a, b) => (b.x > a.x ? 'r' : b.x < a.x ? 'l' : b.y > a.y ? 'd' : 'u');
  for (const s of [...parts, ...(c.wires || [])]) {
    if (!s.from || !s.to) continue;
    if (key(s.from) === key(p)) used.add(dir(p, s.to));
    else if (key(s.to) === key(p)) used.add(dir(p, s.from));
    else if (wireThrough([s], p)) { used.add(dir(s.from, s.to)); used.add(dir(s.to, s.from)); }
  }
  const ys = [...points.values()].map((q) => q.y);
  const order = p.y === Math.min(...ys) ? ['u', 'r', 'l', 'd'] : p.y === Math.max(...ys) ? ['d', 'r', 'l', 'u'] : ['u', 'r', 'l', 'd'];
  const side = order.find((d) => !used.has(d)) || 'u';
  return { r: [1, 0, 0], d: [0, 1, 1], l: [-1, 0, 2], u: [0, -1, 3] }[side];
}

/** a point lying on the middle of a wire segment counts as joined */
function wireThrough(wires, p) {
  return wires.some((w) => {
    const [a, b] = [w.from, w.to];
    if (a.x === b.x) return p.x === a.x && p.y > Math.min(a.y, b.y) && p.y < Math.max(a.y, b.y);
    if (a.y === b.y) return p.y === a.y && p.x > Math.min(a.x, b.x) && p.x < Math.max(a.x, b.x);
    return false;
  });
}
