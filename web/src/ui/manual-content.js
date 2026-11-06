// RaptiCKT user manual: the text and the builders that turn it, together with the
// live component library and example list, into the in-app manual screen and into
// docs/MANUAL.md. No DOM here, so it also runs in Node.
//
// Block types: p (paragraph), h (sub-heading), steps (numbered), ul (bullets),
// tip, warn, table. `**bold**` and `code` are the only inline markup.

import { CATEGORIES, getType } from '../elements/index.js';
import { EXAMPLES } from './examples.js';
import { APP, RAPTI } from './brand.js';

const P = (text) => ({ t: 'p', text });
const H = (text) => ({ t: 'h', text });
const S = (text) => ({ t: 'steps', text });
const L = (text) => ({ t: 'ul', text });
const TIP = (text) => ({ t: 'tip', text });
const WARN = (text) => ({ t: 'warn', text });
// head: [left, right, …]; rows: [[left, right, …], …]
const T = (head, rows) => ({ t: 'table', head, rows });

export const UI_TEXT = {
  title: 'User Manual',
  search: 'Search the manual…',
  contents: 'Contents',
  noResult: 'Nothing found. Try another word.',
  tryIt: 'Open this example',
  props: 'Settings',
  parts: 'components',
  examplesCount: 'examples',
  prev: 'Previous',
  next: 'Next',
  version: 'Version',
  tagline: 'Everything in the app, explained step by step.',
};

// ------------------------------------------------------------------------ chapters
export const CHAPTERS = [
  // ------------------------------------------------------------------ 1
  {
    id: 'welcome', icon: 'bolt',
    title: 'Welcome to RaptiCKT',
    blocks: [
      P('**RaptiCKT** is a circuit simulator that runs on your phone. You draw a circuit, press **Run**, and the app calculates what every wire and part is doing, live: voltages glow on the wires, small dots show current flowing, and you can measure with an oscilloscope and a multimeter. Nothing needs an internet connection — even a circuit photo is read on the phone itself.'),
      H('What you can do with it'),
      L([
        'Build analog, digital and mixed circuits on an unlimited canvas.',
        'Pick from **522 components in 22 categories**: sources, batteries, solar and wind, resistors, capacitors, transformers, protection devices, switches, contactors, house-wiring parts, motors and drives, diodes, transistors, power electronics, op-amps, logic ICs, communication blocks, sensors, meters and more.',
        'Watch the circuit work: green wires are positive, red wires are negative, yellow dots move with the current.',
        'Tap switches and push buttons in **✋ Operate** mode (it comes on by itself when you press Run), draw and move in **Wire** mode, and turn a knob to change any value live.',
        'Measure with a **6-channel oscilloscope** (with FFT and XY) and a **multimeter** (V, A, Ω, W).',
        'Run **AC sweep (Bode plot)**, **DC sweep**, **Operating point**, **Harmonics (THD)**, **Impedance**, **Parametric**, **Monte Carlo** and **Power / efficiency** analyses, and export a **SPICE netlist**.',
        'Solve a circuit **step by step with a network theorem** — Thevenin, Norton, superposition, source transformation, maximum power transfer, Millman, reciprocity or Tellegen — or by **nodal** or **mesh analysis**, with every intermediate circuit drawn (**⋮ → Run with theorem**). AC circuits are solved in **phasors**, the textbook way, and can be shown in the **phasor domain** (20∠0° V, j4 Ω, −j2.5 Ω) — see {{ch:phasors}}.',
        'Take a **photo of a circuit diagram** — a textbook figure, an exam question, a neat sketch — and it is redrawn on the board with its values, dependent sources included, ready to run (**Circuit from photo**). Printed diagrams and neat hand sketches are read on the phone itself, offline.',
        'Inject **faults** into any part (open terminal, short circuit, leakage) to practise troubleshooting and to test protection.',
        'Learn from **110 ready-made examples**, including 8 big build-along **projects** (a 2-storey house wired from the service main to the earth pits, a 2-room flat, 16-bit RAM, mains to 5 V supply, traffic lights, 4-bit adder, seconds counter, automatic street light): LED, RC filter, rectifier, amplifier, 555 timer, tube light, staircase wiring, house wiring, DOL and **star-delta** motor starters, forward/reverse and pump control, **VFD**, inverters, SMPS, solar and wind systems, RS-485, I²C, SPI, radio and more.',
        'Save circuits on the phone, share them as `.rckt` files, and export a picture (PNG).',
      ]),
      H('Who it is for'),
      P('Electrical and electronic engineering students, teachers, technicians, hobbyists and researchers. It is made by **RAPTI — Resonance Automation Professional Training Institute**.'),
      H('Requirements'),
      L(['Android 8.0 or newer.', 'No internet needed. **Circuit from photo** reads pictures on the phone itself; everything, including your saved circuits and photos, stays on your phone.']),
      H('How to read this manual'),
      P('If you are new, read chapters 2 to 6 first (about 10 minutes). The rest is a reference: come back when you need a feature. Use the search box at the top, or tap a chapter in the contents.'),
    ],
  },

  // ------------------------------------------------------------------ 2
  {
    id: 'quickstart', icon: 'play',
    title: 'Quick start: your first circuit',
    blocks: [
      P('Let us build the "hello world" of electronics: a battery, a resistor and an LED. It takes about two minutes.'),
      S([
        'On the **Home** screen tap **New circuit**. An empty board opens.',
        'Tap the round **+** button (bottom right). The component menu opens.',
        'Type `dc` in the search box and tap **DC Voltage**. A battery symbol appears on the board. Then search `resistor` and tap **Resistor**, then search `led` and tap **LED**, then search `ground` and tap **Ground**. The menu stays open so you can add several parts in a row. Tap **✕** to close it.',
        'Drag the parts with your finger to arrange them in a row. Pinch with two fingers to zoom, drag on empty space to move the board.',
        '**Draw the wires.** Every part has small circles at its ends: these are the **terminals**. Tap one terminal, then tap a terminal of the next part: the wire is drawn and routed for you. Connect: battery **+** → resistor → LED anode (the flat-triangle side) → LED cathode → ground, and battery **−** → ground.',
        'Tap the battery and use the **knob** that appears (or open its properties) to set the voltage to **9 V**. Tap the resistor and set it to **470 Ω**. You can type values like `470`, `4.7k`, `10u`.',
        'Press **Run** in the toolbar. The wires turn green, yellow dots flow, and the LED lights up. The current (about 15 mA) is written next to the resistor.',
        'Select the wire between the resistor and the LED and tap **Scope**. The oscilloscope opens and draws that voltage.',
        'Press **Run** again to pause. Tap **Undo** if you made a mistake. The circuit is saved automatically; find it later under **My Circuits**.',
      ]),
      TIP('Even faster: open **Home → Examples → LED with switch**. It is already wired. Press Run and tap the switch.'),
      TIP('If the LED does not light, check that every wire end really touches a terminal, and that there is a resistor in series. See **Troubleshooting**.'),
    ],
  },

  // ------------------------------------------------------------------ 3
  {
    id: 'screens', icon: 'home',
    title: 'Home, Examples, My Circuits, About',
    blocks: [
      P('When the app opens you see a short splash, then the **Home** screen. The bar at the bottom switches between the main pages.'),
      H('Home'),
      L([
        '**New circuit**: opens an empty board.',
        '**Open file**: opens a `.rckt` circuit file or a backup file from your phone.',
        '**Continue where you left off**: appears when there is an unfinished circuit. One tap returns to it.',
        '**Load Flow Analysis**: opens the power-system load-flow tool (see the chapter **Load Flow Analysis**).',
        '**Recent circuits**: your last saved circuits; tap a card to open it, **See all** opens My Circuits. Ready-made circuits are on the **Examples** page.',
        'Tap the **RAPTI logo** (top left) or the RAPTI banner to read about the institute.',
        'The **sliders** icon (top right) opens **Settings**.',
      ]),
      H('Examples'),
      P('104 ready-made circuits, each with an explanation. Filter by category with the chips at the top. Opening an example starts it running by itself (press Pause to stop it). If you change an example, it is saved as your own circuit when you go back; the original example is never damaged.'),
      P('The full list is in the chapter **Examples**.'),
      H('My Circuits'),
      P('Your saved **projects** (circuits), kept on this phone and sorted into **folders** like files on a computer. Tap a project to open it; tap a folder to go inside. The path at the top (**My Circuits › Folder › Sub-folder**) shows where you are: tap any name in it to jump up. The Android **Back** button also goes up one folder.'),
      L([
        '**New project**: asks for a name, then opens an empty board. The project is saved **in the folder you are viewing**.',
        '**New folder**: makes a folder here. Folders can hold projects and other folders, as deep as you like.',
        '**Import**: opens a `.rckt` file or a backup; it is added to the folder you are viewing.',
        '**Backup all**: one file with every project **and your folders**. Restoring it brings the folders back too.',
        '**Select**: see below.',
      ]),
      P('Tap the **⋮** button on a project for **Open**, **Rename**, **Move to folder…**, **Duplicate**, **Export file**, **Share** and **Delete**. On a folder it offers **Open**, **Rename**, **Move to…** and **Delete folder**.'),
      H('Select, move and delete many at once'),
      S([
        'Tap **Select**. Round tick boxes appear.',
        'Tap projects and folders to tick them. **All** ticks everything in the current folder (it then reads **None**).',
        '**Move**: choose the destination (**My Circuits** at the top, or any folder, or **New folder…**). A folder cannot be moved into itself.',
        '**Delete**: asks first and shows how many projects and folders will go, including projects inside the folders you picked. **Backup all first** lets you save everything before deleting.',
        'Tap **✕** (or Back) to leave Select mode.',
      ]),
      WARN('Deleting a folder also deletes every project inside it.'),
      H('About'),
      P('Version number, a short description of the app and its engine, information about RAPTI (courses, phone, WhatsApp, email, website, address), and accuracy notes.'),
      H('Back button'),
      P('The Android **Back** button closes the topmost thing: an open dialog, then Settings or Manual, then panels inside the editor, then clears the selection, and finally goes back to Home. Your circuit is saved when you leave the editor or put the app in the background.'),
    ],
  },

  // ------------------------------------------------------------------ 4
  {
    id: 'editor', icon: 'sliders',
    title: 'The editor at a glance',
    blocks: [
      P('The editor is where you build and run circuits. From top to bottom:'),
      H('Top bar'),
      T(['Button', 'What it does'], [
        ['Back arrow', 'Saves and returns to Home.'],
        ['Circuit name', 'Tap to rename. The line below shows your note or the component count.'],
        ['Eye', 'Cycles the labels: values → names + values → hidden.'],
        ['Multimeter', 'Shows or hides the multimeter.'],
        ['Oscilloscope', 'Shows or hides the scope panel.'],
        ['Analysis', 'AC sweep, DC sweep, Operating point, SPICE netlist.'],
        ['⋮ More', 'Save, export, share, netlist, picture, settings, help, clear.'],
      ]),
      H('Toolbar'),
      T(['Button', 'What it does'], [
        ['Run / Pause / Resume', 'Starts the simulation, pauses it, continues it.'],
        ['Restart', 'Starts again from time zero (capacitors empty, etc.).'],
        ['Step', 'Pauses and advances a small slice of time. Press repeatedly to go frame by frame.'],
        ['Select', 'Turns on multi-select mode ({{ch:editing}}).'],
        ['Undo / Redo', 'Goes back or forward through your last 120 changes.'],
        ['Fit', 'Zooms so the whole circuit is visible.'],
        ['Full', 'Full screen: hides the bars and the phone\'s status and navigation bars ({{ch:editor}}, *Landscape & full screen*).'],
      ]),
      H('Landscape & full screen'),
      L([
        'Turn the phone **sideways**: the title, the buttons and the toolbar merge into **one row**, the **oscilloscope sits to the right** of the board instead of above it, and the properties and parts sheets open as a **side panel** on the right, so the circuit keeps its height.',
        'Tap **Full** in the toolbar for **full screen**: the bars and the phone\'s status and navigation bars disappear and the board gets the whole display, edge to edge. The tools stay out of the way: only a small **☰** handle sits at the top left. Tap it for the **tool rail** (Exit full screen, Run / Pause, Restart, Oscilloscope, Multimeter, Labels, Undo, Fit, Hide), the **+** button and the time chip; they slide away again after a few seconds, when you touch the board, or with **‹** at the bottom of the rail. Swipe from the edge to see the phone\'s bars for a moment.',
        'Leave full screen with the top button of the rail or the phone\'s **Back** button.',
        'Settings → *Landscape & full screen*: lock the **screen rotation** (auto, always landscape or always portrait) and choose whether the **scope sits beside the circuit** in landscape.',
      ]),
      H('Operate and Wire mode'),
      P('As in RaptiAuto, the board has two modes. The switch at the top right of the board shows which one is on and changes it with one tap; it stays there in full screen too.'),
      T(['Mode', 'What a finger does'], [
        ['Wire (amber)', 'Tap two terminals to draw a wire, drag a part to move it, tap a part to select it. Switches are **not** flipped, so you can edit a running circuit without changing it. This is the mode while the circuit is not running.'],
        ['✋ Operate (green)', 'Tap switches, push buttons, breakers, keypads and sensors to work them (hold a push button down). Dragging only **pans** the board, so nothing gets moved or wired by accident. Tap any other part to see its readings.'],
      ]),
      L([
        'Pressing **Run** (or Resume) switches to **Operate** by itself; **Pause** goes back to **Wire**.',
        'Pick either mode by hand at any time: **Wire** while it runs to edit, or **✋ Operate** before Run to set the switches first.',
        'A long press on a part opens its properties in both modes. With a keyboard: **O** = Operate, **W** = Wire.',
      ]),
      H('The board'),
      L([
        'The big area with the grid is your **canvas**. It is unlimited: pan and zoom freely. Zoomed out, the values and live readings grow with it, so they stay readable on the screen.',
        'The round **+** button (bottom right) adds a component.',
        'The **✋ Operate | Wire** switch at the top right of the board picks what a finger does ({{ch:editor}}, *Operate and Wire mode*).',
        'The chip at the top of the board shows the simulation time and speed, for example `t = 12.5 ms · 5 ms/s`. Tap it to change the speed ({{ch:running}}). When the phone cannot keep up it shows, in amber, the speed actually reached, for example `1.5 s/s max`.',
        'A red or yellow bar appears at the top when the circuit has a problem ({{ch:troubleshooting}}).',
        'When you select a part, a **quick bar** appears (name, current reading, rotate, scope, edit, delete) and, for parts with a main value, the **knob**.',
        'Messages (toasts) appear briefly at the bottom to confirm what happened.',
      ]),
      H('Gestures'),
      T(['Gesture', 'Result'], [
        ['Tap a part', 'Selects it. On a switch or button, it also operates it.'],
        ['Hold a part (half a second)', 'Opens its properties.'],
        ['Drag a part', 'Moves it. Wires stay attached and follow. A part never lands on another part.'],
        ['Drag a terminal of the selected part', 'Slants and stretches it: that end goes where you drag it, at any angle.'],
        ['Tap a terminal, then another', 'Draws a wire between them (EveryCircuit style).'],
        ['Drag from a terminal to another', 'Draws the wire where your finger goes, in straight runs (no curves): its corners where you turned.'],
        ['Drag empty space', 'Pans the board.'],
        ['Pinch with two fingers', 'Zooms in and out.'],
        ['Double-tap the board and hold, then slide', 'One-finger zoom, like Google Maps: slide **down** to zoom in, **up** to zoom out, around the point you tapped. Works on empty board or a wire.'],
        ['Double-tap empty board', 'Zooms in one step around that point.'],
        ['Hold empty space, then drag', 'Draws a selection box.'],
        ['Tap a wire', 'Selects the wire (then you can scope or delete it).'],
        ['Tap empty space', 'Clears the selection.'],
      ]),
      P('On a computer browser you can also use: **Delete** (remove), **R** (rotate), **T** / **Shift+T** (slant 15° on / back), **Space** (run/pause), **Ctrl+Z / Ctrl+Y** (undo/redo), **Ctrl+D** (copy), and the mouse wheel to zoom.'),
    ],
  },

  // ------------------------------------------------------------------ 5
  {
    id: 'adding', icon: 'plus',
    title: 'Adding components',
    blocks: [
      S([
        'Tap the round **+** button. The component menu slides up.',
        'Choose a category tab: **Recent**, **Sources**, **Batteries**, **Passive**, **Transformers**, **Protection**, **Switches & Relays**, **Electrical**, **Power Systems**, **Machines**, **Diodes**, **Transistors**, **Thyristors & Power**, **Analog ICs**, **Control & Math**, **Logic Gates**, **Digital ICs**, **Sensors**, **Output**, **Vacuum Tubes**, **Meters**. Swipe the tab row sideways to see them all.',
        'Or type in the **search box**. It searches names, keywords and categories, for example `thermistor`, `555`, `3 phase`, `fuse`.',
        'Tap a component. It is placed in a free spot in the middle of the visible board. The menu stays open, so tap more parts if you need them.',
        'Tap **✕** (or the Back button) to close the menu.',
      ]),
      TIP('The **Recent** tab remembers the parts you used last, so common parts are one tap away.'),
      TIP('Always add a **Ground** to your circuit (see {{ch:wiring}}). Many examples show where it goes.'),
      P('The complete list of all 522 components, with what each one does and which values you can change, is in the chapter **Component library**.'),
    ],
  },

  // ------------------------------------------------------------------ 6
  {
    id: 'editing', icon: 'hand',
    title: 'Moving, selecting and editing parts',
    blocks: [
      H('Select a part'),
      P('Tap it. It is highlighted and the **quick bar** appears near the bottom with:'),
      L([
        'Its **name** (R1, C2, D1…), type and a live reading (for example `3.84 V · 816 µA`). Tap this area to open all properties.',
        '**Reverse polarity** (only for polarised parts such as batteries, diodes, LEDs, electrolytic capacitors): swaps the two terminals while the wires stay connected.',
        '**Rotate**: turns the part 90° each tap.',
        '**Slant up / Slant down** (two buttons, only for parts with their two terminals in line, such as resistors, capacitors, coils, sources): turns the part **15°** each tap, up (anticlockwise) or down (clockwise), at any angle round, as the sides of a delta, a star or a bridge are drawn. For any other angle, type it in the properties sheet, or drag one of its terminals (below). Its terminals stay on grid points, so wires join it as usual.',
        '**Scope**: adds the part to the oscilloscope.',
        '**Edit** (sliders icon): opens the properties sheet.',
        '**Delete**.',
      ]),
      H('Properties sheet'),
      P('Hold a part for half a second, or tap its name in the quick bar. A sheet slides up with:'),
      L([
        '**Live readings** while the simulation runs (voltage, current, power, state…).',
        'Action buttons: **Rotate**, **Slant up** / **Slant down** (15° each way), **Flip** (mirror), **Copy**, **Scope V** (voltage across the part), **Scope I** (current through it), **Delete**.',
        '**Angle** (parts that can slant): type any angle in degrees (0° points right, 90° down, −30° up and to the right), or step it with **−15°** / **+15°**. The part takes the nearest angle that keeps its terminals on grid points, within a few degrees.',
        'Every adjustable property: a text box and a slider for numbers, a drop-down for choices (for example the **model** of a transistor or op-amp), a switch for yes/no.',
        'A short description of the part.',
        'Tap the **✓** to close.',
      ]),
      P('Choosing a **model** (for example `2N3904`, `LM741`, `1N4148`) fills in all the matching numbers at once. If you then change one number by hand, the model switches to **custom**.'),
      H('Typing values'),
      P('Number boxes understand engineering prefixes. You can type any of these:'),
      T(['You type', 'Meaning'], [
        ['`4.7k`  or  `4k7`', '4 700'],
        ['`10u`  or  `10µ`', '0.000 01  (10 micro)'],
        ['`2.2M`  or  `2.2meg`', '2 200 000'],
        ['`100n`, `47p`, `5m`', '100 nano, 47 pico, 5 milli'],
        ['`1e-3`', '0.001'],
      ]),
      P('Note: `m` is **milli** and `M` is **mega**. The unit letter (Ω, F, H, V, A) is added by the app; you do not need to type it.'),
      H('Move, rotate, flip, copy, delete'),
      L([
        '**Move**: drag the part. It snaps to the grid. Connected wires follow and re-route neatly. A part cannot be dropped on top of another part, and its terminals never join another terminal or wire just by touching: it stops at the last free spot (drag on into free space to hop over), and you connect parts by drawing a wire. Duplicates are placed on a free spot too. The undo button reverses the move.',
        '**Rotate**: quick bar button (or **R** on a keyboard).',
        '**Slant**: the two quick bar buttons (or **T** / **Shift+T** on a keyboard): 15° down or up each time; **Rotate** turns a slanted part a quarter turn, still slanted. Tapped again and again, the part turns in place: it stays where it is (within half a grid step) and never walks away.',
        '**Any angle, any length**: select the part, then drag one of its **terminals** (they show small squares): that end goes where your finger takes it, at any angle, the other end stays put, and the part stretches or shortens between them (its symbol keeps its size, its leads grow). Dragging a terminal of a part that is not selected draws a wire from it (see Wiring).',
        '**Slanting by itself**: in a circuit drawn slanting (a slanted part or a slanting wire in it, as a circuit read from a photo of a delta or a bridge) a part you move between two straight wires turns to lie along the line between their far ends, and snaps onto that line when you drop it near it, so the wires run on in line with it. Straight wires stay straight at any angle as parts move; where one would cross a part or run along another wire, it takes the neatest clear shape of level, upright and 45° runs instead.',
        '**Flip**: properties sheet (mirrors the part).',
        '**Copy**: properties sheet or selection bar. The copy appears slightly down and right.',
        '**Delete**: quick bar or selection bar.',
      ]),
      H('Selecting many parts'),
      S([
        'Tap **Select** in the toolbar (it turns blue). Or just hold empty space and drag a box.',
        'Drag a box **from left to right** = **window**: only parts and wires **completely inside** are selected.',
        'Drag a box **from right to left** = **crossing**: everything the box **touches** is selected.',
        'While Select is on, tap parts or wires one by one to add or remove them.',
        'A **selection bar** shows how many parts and wires are selected, with **Rotate**, the two **Slant** buttons, **Copy**, **Delete** and **✕** (clear). Dragging any selected part moves them all together.',
        'Tap **Select** again to leave the mode.',
      ]),
      H('Undo and redo'),
      P('Every change (adding, moving, wiring, changing a value, deleting) can be undone. The app remembers your last 120 steps. Undo and Redo are greyed out when there is nothing to undo or redo.'),
    ],
  },

  // ------------------------------------------------------------------ 7
  {
    id: 'wiring', icon: 'wire',
    title: 'Wiring',
    blocks: [
      H('Draw a wire: tap, tap'),
      P('The quickest way, as in EveryCircuit: tap two terminals and the app draws the wire for you.'),
      S([
        '**Tap a terminal** (the small circle at the end of a part). It lights up with a pulsing ring. (The first time, a short hint tells you what to do next.)',
        '**Tap another terminal.** A neat right-angled wire is drawn between them, going round parts where it can.',
        'You can also tap **a point on an existing wire** (to branch from it) or **the body of a part** (the wire goes to its nearest terminal).',
        'Changed your mind? Tap **empty space** or the same terminal again, or press **Back**, to cancel.',
      ]),
      H('Draw a wire with your finger'),
      P('Put your finger on a terminal (or a wire\'s loose end) and drag it to another terminal, a point on a wire or a part: the wire is drawn where your finger went, as **straight runs** — never a curve. Its corners are where you turned (small wobbles of the hand are smoothed away), they sit on grid points, and a run drawn nearly level, upright or at 45° is made exactly so. Let go on empty board and the wire ends there, loose. A path drawn over another terminal or wire would join it, so such a wire is laid round it instead (a message says so). Undo takes a drawn wire away. Dragging a part by its **body** still moves it; a selected part\'s terminal squares still slant and stretch it.'),
      H('Straight (slanting) wires'),
      P('To draw a circuit as a textbook does, with slanting sides (a delta, a star, a bridge drawn as a diamond): slant the parts (**Slant up / Slant down**, the **Angle** field, or a terminal drag, above) and draw the wires with your finger along the sides (above). Once a part is slanted, the circuit wires slanting by itself: tapping two terminals draws one **straight** wire between them where it runs clear, else the neatest clear shape of level, upright and 45° runs (leaving each terminal along its part\'s lead), and only if there is none goes round at right angles; moving parts keeps their straight wires straight at any angle, and a part moved between two straight wires turns to lie along them (see **Slanting by itself** under Moving).'),
      H('Branches and junctions'),
      L([
        'To branch from an existing wire, tap **a point on that wire** as the first or the second end of a new wire. The two are then electrically joined.',
        'A **dot** marks a junction where three or more connections meet.',
        'Two wires that simply **cross** each other are **not** connected. They connect only where one ends on the other, or at a terminal.',
      ]),
      H('Edit wires'),
      L([
        '**Tap a wire** to select it. The selection bar offers **Scope** (probe its voltage) and **Delete**.',
        'Moving a part drags its wires along; they are re-routed so they do not run through other parts.',
        'To redo a wire, delete it and draw it again.',
      ]),
      H('Ground'),
      P('Voltages are measured against **ground (0 V)**. Add a **Ground** symbol (Sources category) and connect it to the point you call 0 V, usually the battery **−**. **Protective Earth** and **Chassis Ground** are also 0 V.'),
      TIP('If you forget ground, the simulator ties each separate part of the circuit to 0 V by itself, so it still runs. But for clear, meaningful readings always add one ground.'),
      H('Wiring checklist'),
      L([
        'Every wire end must sit **on a terminal circle** (or on another wire). A wire that stops near it is not connected.',
        'A closed loop is needed for current to flow: source → parts → back to the source.',
        'Do not connect ideal voltage sources directly across each other, and do not leave a current source with nowhere to push its current.',
        'Check polarity: battery **+**, diode and LED **anode/cathode**, electrolytic capacitor **+**.',
      ]),
    ],
  },

  // ------------------------------------------------------------------ 8
  {
    id: 'values', icon: 'gauge',
    title: 'Changing values and the knob',
    blocks: [
      P('There are three ways to change a value. All of them also work **while the circuit is running**, so you see the effect immediately.'),
      L([
        '**Type it** in the properties sheet (for example `2.2k`).',
        '**Drag the slider** under the number in the properties sheet.',
        '**Turn the knob** that appears next to a selected part.',
      ]),
      H('The knob'),
      P('When you select a part, a round **knob** shows its main value (resistance of a resistor, voltage of a source, temperature of an NTC, light level of an LDR, duty cycle of a PWM source, and so on). The value is written above the dial. There are two kinds:'),
      T(['Kind', 'How it works'], [
        ['**Decade dial** (resistance, capacitance, inductance, frequency…)',
          'The digits 1 to 9 are printed round the ring. Turn the dial: each click goes 1 → 2 → … → 9 → 10 → 20 → … Tap a digit to jump straight to it. The **−** and **+** buttons change the value by one tenth of a digit (for example 4.7 kΩ, 1.5 µF) and roll into the next decade.'],
        ['**Stepped knob** (volts, %, °, °C, …)',
          'Each click moves one whole step that follows the value you see: 1 to 99 move by 1 (5 V → 6 V), 100 to 999 by 10 (230 V → 240 V), 10 mA → 11 mA. **−** and **+** make a finer step.'],
      ]),
      P('You can also drag a finger round the dial to turn it. You feel a small vibration at each click (turn off in Settings → Haptic feedback).'),
      TIP('The knob can cover a small part on a small screen. The board slides up a little to keep the new part visible. You can also pan the board yourself.'),
      H('Which value is on the knob?'),
      P('Each component decides. Resistor → resistance; capacitor → capacitance; DC source → voltage; AC source → frequency or amplitude; potentiometer → wiper position; LDR → light; NTC → temperature; PWM generator → duty cycle; and so on. The other values are always in the properties sheet.'),
      H('Faults: break or short a part on purpose'),
      P('At the bottom of the properties sheet, **⚡ Fault** lets you damage any part to practise fault-finding or to test protection: **Open circuit (broken terminal)** disconnects one terminal; **Short circuit** joins two terminals (≈1 mΩ); **Leakage / partial short** puts a resistance of your choice between two terminals. A faulty part shows a red ⚡ badge on the board; choose **None (healthy)** to repair it. Faults are saved with the circuit.'),
      TIP('For a fault that happens at a set moment while the circuit runs (to watch a breaker trip), use the **Fault (timed short circuit)** part from **Power Systems** — see the example **Short-circuit fault & MCB tripping**.'),
    ],
  },

  // ------------------------------------------------------------------ 9
  {
    id: 'running', icon: 'speed',
    title: 'Running the simulation',
    blocks: [
      H('Run, pause, restart, step'),
      L([
        '**Run** starts the simulation from time zero. The button then becomes **Pause**; after pausing it reads **Resume**.',
        '**Restart** resets time to zero and everything inside parts (capacitor charge, inductor current, counters, motor speed, tripped breakers) to the start.',
        '**Step** advances one small slice of time and stays paused. Use it to watch fast events slowly.',
        'The screen stays awake while the simulation runs.',
        'If the circuit has no components, the app tells you to add some first.',
      ]),
      H('What you see while it runs'),
      T(['Display', 'Meaning'], [
        ['Green wire', 'Positive voltage (stronger colour = higher voltage).'],
        ['Red wire', 'Negative voltage (stronger colour = more negative).'],
        ['Grey wire', 'About 0 V.'],
        ['Yellow moving dots', 'Current. Dots move in the direction of current; faster/denser = more current.'],
        ['Blue number on a wire', 'The voltage of that net (Settings → Live node voltages).'],
        ['Green number with arrow beside a part', 'The current through the part and its direction (Settings → Live currents).'],
        ['+ / − on capacitor plates', 'Stored charge (Settings → Capacitor charge).'],
        ['Glowing LED, lamp, moving motor, lit segment', 'Parts animate to show their state.'],
      ]),
      H('AC circuits: RMS readings'),
      P('In a circuit with a sine supply (AC source, mains, 3-phase), the live labels show the **RMS** over one supply cycle, like a real meter, for example `12 V~` on the secondary of a 230 V : 12-0-12 V transformer. DC nets show their average. Voltmeters and ammeters are set to **Auto** and show RMS in AC circuits. To see instantaneous values instead, use **Settings → AC readings → Instantaneous**.'),
      H('Simulation speed'),
      P('Tap the chip at the top of the board (`t = … · …/s`). A small panel opens:'),
      L([
        '**Simulation speed**: how much circuit time passes per real second. Slide left for slow motion (to see a fast oscillation), right for fast (to see a slow charge).',
        '**Timestep Δt**: the internal step the solver uses (it is chosen automatically from the speed and the highest frequency).',
        '**Automatic**: tick it to let the app choose a speed that suits your sources. Moving the slider switches Automatic off for this circuit.',
      ]),
      P('Running faster than the automatic speed, mains circuits take bigger time steps (down to 40 per cycle, still accurate for RMS values, power and heating), so fast-forwarding a big circuit really is faster.'),
      P('If the chip turns **amber** — for example `1.5 s/s max` — the phone cannot calculate as fast as you asked: the circuit runs at the speed shown, and the Simulation speed panel says so. A higher setting does not help then; simplify the circuit or close the scope. While it is limited the app gives the simulation most of each frame (the board redraws about 30 times a second). It also lowers the drawing sharpness automatically on slow phones to keep animation smooth.'),
      H('Interactive parts'),
      P('While running you can touch the circuit like a real one:'),
      T(['Part', 'Touch'], [
        ['Switches (one-way, two-way, intermediate, DPST, DPDT, isolator, rotary…)', 'Tap to toggle.'],
        ['Push buttons (NO / NC)', 'Hold to press, release to let go.'],
        ['Latching push button, emergency stop', 'Tap to press and latch; tap again to release.'],
        ['MCB, MCCB, RCCB, RCBO', 'Tap to switch on/off. After a trip, tap once to **reset**. A destroyed breaker must be replaced (see {{ch:limits}}).'],
        ['Overload relay, IDMT relay', 'Tap to reset after a trip.'],
        ['Logic input, hex input', 'Tap to flip a bit / step the value.'],
        ['PIR sensor', 'Tap to simulate motion.'],
        ['Capacitive touch sensor', 'Tap to touch / release.'],
        ['Peak meter, kWh meter', 'Tap to reset.'],
      ]),
      H('Errors and warnings'),
      P('If the circuit cannot be solved, a bar at the top tells you what and where, for example **"Circuit cannot be solved (singular matrix) near R3. Check for floating current sources or open circuits."** The part concerned is highlighted. A yellow bar is a warning, for example "D1 is short-circuited". See **Troubleshooting** for what to do.'),
    ],
  },

  // ------------------------------------------------------------------ 9b
  {
    id: 'limits', icon: 'shield',
    title: 'Real-life limits: burning parts, wires and cables',
    blocks: [
      P('Parts in RaptiCKT have the limits of real parts. Too much voltage or current **burns them out**, an overloaded **wire overheats, smokes, catches fire and burns through**, and a breaker that is asked to break more than it can is **destroyed**. A burnt part stays burnt — also after Restart — until you **replace** it, just like changing a fused bulb at home.'),
      H('What can burn'),
      T(['Part', 'Fails when…'], [
        ['Incandescent bulb, lamp', 'About 1.6 × its rated voltage: the filament melts (a 230 V bulb on 400 V, a 12 V lamp on 24 V). It goes open.'],
        ['LED', 'Far above its rated current at once (an LED straight on a battery), or about 2.5 × for a few seconds. Always use a series resistor.'],
        ['Resistor', 'Give it a **Power rating** (1/4 W, 1 W…): above about 2.5 × that power it burns open. "Ideal" has no limit.'],
        ['Electrolytic / tantalum capacitor', 'Over 1.2 × its rated voltage, or connected the wrong way round: it bursts. Electrolytics fail open, tantalums fail **short**.'],
        ['Fuse', 'Blows when its I²t is exceeded, and stays blown until replaced.'],
        ['MCB, MCCB, RCBO', 'Trips on overload or short circuit (tap to reset). A fault current above its **breaking capacity Icn** (6 kA for an MCB) destroys it.'],
        ['RCCB', 'Has no overcurrent protection: a long overload above its In burns it. Always fit an MCB before it.'],
        ['Ceiling fan', 'Its winding burns on a long overload, and within seconds on a much higher supply voltage (on 460 V the core saturates and the current shoots up). ±10 % of 230 V is always fine.'],
        ['Heater, LED bulb, CFL, LED panel', 'More than about 25–35 % above the rated voltage: the element, the driver or the electronic ballast burns within seconds.'],
        ['Socket appliances', 'The appliance plugged into a socket burns on a supply well above its rated voltage: a lamp at once, a TV, computer or microwave within seconds, motors (fan, pump, fridge, washing machine, AC) and heaters a little later.'],
        ['Tube-light ballast, bell, transformer', 'The winding overheats and burns open well above its rating (twice the mains voltage, or a 230 V transformer primary on 460 V).'],
        ['Relay, contactor, ladder coil', 'About 1.5 × its rated coil voltage for a few seconds burns the coil open — the contacts drop out.'],
        ['DC fan, LED strip, speaker', 'A 12 V fan or strip on 24 V burns within seconds; a speaker driven far above its power rating (or straight from a battery) burns its voice coil.'],
        ['Ceramic, film, PF and supercapacitors', 'Held well above the voltage rating the dielectric breaks down: ceramic and mica capacitors fail **short**, film and PF capacitors fail open, a supercapacitor vents.'],
        ['Photocell / PIR switch, LED driver, emergency light', 'Their mains electronics are made for 90–265 V: above about 300 V they burn.'],
        ['Wires and cables', 'Current above the cable rating Iz heats them; far above it they smoke, catch fire and burn through.'],
      ]),
      P('When something burns you see a flash, flames and smoke, hear a bang and get a message saying why. The part turns dark with a red **!** badge.'),
      H('Replacing a burnt part'),
      S([
        'Tap the burnt part. The bar at the bottom shows a red **Replace** button (and the property sheet a **Replace with a new one** button).',
        'Tap it: a new, cold part is fitted in the same place, with the same values.',
        'Fix the cause first (lower the voltage, add a resistor, use a thicker cable), or the new part burns again.',
        'To replace everything at once use **⋮ → Replace burnt parts & wires**.',
      ]),
      H('Wires and cables'),
      P('Every wire you draw is a real cable (Settings → **New wires**, 1.5 mm² copper PVC house wire by default). Select a wire and tap **Cable** to choose:'),
      L([
        '**Cable type**: single-core PVC house wire (BYA / H07V-U), flexible cord (H05VV-F), rubber cable (H07RN-F), PVC or XLPE power cables in copper (NYY, N2XY) or aluminium (NAYY, NA2XY), or an **Ideal wire** with no limit.',
        '**Conductor size**: 0.5 to 400 mm².',
        '**Conductor (IEC 60228)**: **RE** round solid, **RM** round stranded, **SM** sector-shaped stranded, **RF** round flexible.',
        '**Installation method**: in conduit in an insulated wall (A1), in conduit on a wall (B1), clipped direct (C), in free air (E) or buried (D) — a cable that can lose heat easily carries more current.',
      ]),
      P('The sheet shows the current rating **Iz** (IEC 60364-5-52), the resistance per km and, while running, the current, the load in % and the conductor temperature. **Use for all wires** gives every wire this cable; **Make default** uses it for the wires you draw next.'),
      T(['Conductor temperature', 'What you see'], [
        ['Up to the insulation rating (70 °C PVC, 90 °C XLPE)', 'Normal.'],
        ['Above it', 'Overloaded: the wire glows orange.'],
        ['Above 160 °C (PVC)', 'The insulation melts: red glow and smoke.'],
        ['Above 250 °C (PVC)', 'It catches fire and burns through after a few seconds: the circuit opens.'],
      ]),
      P('A burnt wire is drawn charred with a red ✕ where it parted. Select it and tap **Repair** (or pick a thicker size, which also repairs it).'),
      TIP('Protect every cable with an MCB or fuse no larger than its Iz: then the breaker trips before the wire gets hot. That is exactly how house wiring is designed — e.g. 1.5 mm² lights on a 10 A MCB, 2.5 mm² sockets on 16–20 A, 4 mm² geyser on 25 A.'),
      P('Drawn wires have no resistance. To see the **voltage drop** and power loss of a real length of cable, use **Cable (1 core, with length)**, **Cable (2-core, L + N)** or **Cable (4-core, 3-phase + N)** from **Power Systems** and set the length. They heat and burn the same way.'),
      H('Timing: real time'),
      P('To show 50 Hz waveforms the simulation runs slowed down (for example 40 ms per second). Heating, breaker trips and burning do not: they follow **your clock**, so an MCB at 2.5 × its rating trips after about 20 real seconds and an overloaded cable takes minutes, like in real life. Change it in Settings → **Heating & trip timing** (10× faster, or simulation time). Short circuits are fast in both: a breaker or fuse clears them in milliseconds of circuit time.'),
      WARN('Don\'t want anything to burn (for example while you are still building)? Switch off Settings → **Parts burn out**. Fuses still blow and breakers still trip.'),
    ],
  },

  // ------------------------------------------------------------------ 10
  {
    id: 'scope', icon: 'scope',
    title: 'Oscilloscope',
    blocks: [
      P('The oscilloscope draws voltages and currents against time, up to **6 channels** at once, each in its own colour.'),
      H('Add a channel (probe)'),
      L([
        '**A node voltage**: tap a wire, then tap **Scope** in the selection bar. The probe is placed at the point you tapped and measures that net against ground.',
        '**Voltage across a part**: select the part, tap the **scope** icon in the quick bar (or **Scope V** in the properties sheet).',
        '**Current through a part**: select the part and tap **Scope I** in its properties sheet.',
        'The scope panel opens automatically. A coloured pin on the board marks where each probe is.',
      ]),
      P('Channel colours: yellow, cyan, pink, green, orange, purple. Probes are saved with the circuit.'),
      H('Reading the display'),
      L([
        'The screen has **10 × 8 divisions**, like a real scope. The screen **auto-scales** to a round **volts per division** (1-2-5 steps). All voltage channels share **one scale and one 0 V line**, set by the biggest signal (for example the input of a rectifier), so input and output can be compared directly. The top and bottom values of the screen are written at the right edge.',
        'When **voltages and currents** are shown together, currents get their own A/div but **0 V and 0 A sit on the same line**, so a voltage and its current read against one zero: volt values are written along the left edge and amp values along the right.',
        'The **0** tag on the left edge marks the **0 (ground) line**. When it is off the screen, the tag sits at the edge with a small arrow.',
        'The bottom left shows the **time per division** (for example `2 ms/div`) and the trigger state: **TRIG ↑ CH1** (picture held still), **AUTO** (waiting for a repeating signal), **ROLL** (trigger off) or **STOP** (frozen).',
        'Under the graph, a table gives for each channel the **latest value**, **/div**, **pp** (peak-to-peak), **rms** and the **frequency f** (found from the signal).',
        '**Touch and hold** the graph to show a cursor: it reads the time and every channel\'s value at that point. Pinch to change the time scale.',
      ]),
      H('Scope buttons'),
      T(['Button', 'What it does'], [
        ['+  /  −', 'Zoom the time axis in / out, one 1-2-5 step of time per division. You can also pinch on the scope.'],
        ['Trigger', 'Off by default: the picture rolls with the newest value at the right edge. Tap it to turn it on (green): each sweep then starts on a rising edge of **CH1**, so a repeating waveform stands still instead of sliding.'],
        ['TIME / FFT / XY', 'Shows the current view; tap to cycle **Time → FFT → XY → Time**. XY needs at least 2 channels.'],
        ['DC / AC', 'Input coupling. **DC** (default) shows the whole signal. **AC** removes the average (DC) part, like the AC switch of a real scope, so a small ripple riding on a large DC voltage (for example a power-supply output) fills the screen. The rms column then reads **ac rms**.'],
        ['Σ', 'Switches the measurement table between **basic** (now, /div, pp, rms, f) and **timing**: **mean** (average), **duty** cycle, **rise** and **fall** time (10–90 %) and **φ**, the phase of each channel relative to CH1.'],
        ['Freeze', 'Stops recording so you can study the picture. Press again to continue.'],
        ['Download', 'Exports the recorded data as a CSV file (time, then one column per channel).'],
        ['Colour chip with ✕', 'Tap a channel chip to remove that probe.'],
      ]),
      H('Time, FFT and XY views'),
      L([
        '**Time**: normal waveform view.',
        '**FFT** (spectrum): shows how much of each frequency is in the signal, on a log frequency axis and a 0 to −100 dB scale. Under it you see the **peak frequency** of each channel. A pure sine shows one tall peak; a square wave shows odd harmonics; a rectifier shows the ripple frequency.',
        '**XY**: channel 1 is drawn along X and channel 2 along Y, like a real scope in XY mode. Use it for Lissajous figures, phase comparison and I–V curves.',
      ]),
      TIP('The scope keeps the most recent 4096 points. If a signal looks too fast or too slow, change the **time scale** (+ / −) or the **simulation speed** ({{ch:running}}).'),
    ],
  },

  // ------------------------------------------------------------------ 11
  {
    id: 'meter', icon: 'meter',
    title: 'Multimeter',
    blocks: [
      P('Tap the **multimeter** icon in the top bar. A meter card appears on the board with a red (+) and a black (−) probe pin. The simulation must be running.'),
      T(['Mode', 'How to use', 'It shows'], [
        ['**V**', 'Drag the red and black probe pins onto two nodes (a terminal or a wire). The pins snap to connection points.', 'DC (average) voltage between the probes, plus AC RMS and the instantaneous value.'],
        ['**Ω**', 'Place the probes across a part or network. The app switches off all sources and measures what is left.', 'Small-signal resistance (**OL** if open).'],
        ['**A**', 'Select a two-terminal component. Probes are not used.', 'Current through it: average, RMS and instantaneous.'],
        ['**W**', 'Select a two-terminal component.', 'Average power in it (positive = absorbing power, negative = delivering).'],
        ['**Hz**', 'Place the probes like in V mode.', 'Frequency of the voltage between the probes (counted from its cycles).'],
        ['**LC**', 'Place the probes across a capacitor or an inductor (sources switched off, measured at 1 kHz like an LCR meter).', 'Capacitance or inductance, with the impedance.'],
      ]),
      P('In **Ω** mode a reading below about 30 Ω also shows **Continuity**, like the beeper of a real meter — handy for checking a wire or a closed switch.'),
      P('The display reads smoothly (about a 0.4 s average) so numbers do not flicker. Tap **✕** on the card to close the meter.'),
      TIP('For permanent meters inside the circuit, use parts from the **Meters** category (voltmeter, ammeter, wattmeter, power-factor meter, frequency meter, kWh meter…). They stay in the circuit and are saved with it.'),
    ],
  },

  // ------------------------------------------------------------------ 12
  {
    id: 'analysis', icon: 'bode',
    title: 'Analysis: Bode, sweeps, harmonics, Monte Carlo, SPICE',
    blocks: [
      P('Tap the **Analysis** icon (top bar) or use **⋮ → Operating point / SPICE netlist**. There are nine tabs. These tools solve the circuit by themselves and do not need the simulation to be running.'),
      H('1. AC Sweep (Bode plot)'),
      P('Shows how the circuit responds to different frequencies: gain (in dB) and phase (in degrees). The input source is driven with 1 V at 0° and other sources are set to zero.'),
      S([
        'Place a source (voltage or current) and build your circuit. Make sure the output is **probed on the scope**: select the output wire and tap **Scope**.',
        'Open **Analysis → AC Sweep**.',
        'Choose the **Input source** and the **Output (scope probe)**.',
        'Set **Start frequency** (default 1 Hz), **Stop frequency** (default 1 MHz) and **Points per decade** (20, 50, 100 or 200).',
        'Tap **Run AC sweep**. The yellow curve is gain in dB; the cyan dashed curve is phase.',
        'Touch the graph and slide your finger to read the exact frequency, gain and phase at that point.',
        'Tap **CSV** to export the data.',
      ]),
      P('The app marks and reports automatically: the **−3 dB** point(s) (cut-off frequency), the resonance peak **f₀**, the **bandwidth**, the **Q factor** and the **phase margin**, where they exist.'),
      TIP('Try it: open the example **RC low-pass filter**, then Analysis → AC Sweep → Run. You should see −3 dB and −45° at about 1 kHz.'),
      H('2. DC Sweep'),
      P('Changes one value step by step and solves the circuit at each step. Use it for I–V curves of diodes, transfer curves of transistors, sensor calibration or maximum-power-point searches.'),
      S([
        'Add scope probes for whatever you want to measure (a node voltage, a part voltage, or a part current).',
        'Open **Analysis → DC Sweep**.',
        'Choose the **Component** and the **Parameter** to sweep (for example V1 → Voltage).',
        'Enter **From**, **To** and **Steps** (default 100). The app fills a sensible range for you.',
        'Select one or more probes under **Measure** (tap to select several).',
        'Tap **Run DC sweep**. The curves are drawn; touch the graph to read values. **CSV** exports the data.',
      ]),
      TIP('Try it: open **Diode I–V characteristic** and press Run DC sweep. Or in **Solar panel with load**, sweep the load resistance and measure power to find the maximum power point.'),
      H('3. Operating Point'),
      P('A table of every **node voltage** and, for every component, its **voltage, current and power**. If the simulation is not running, you get the **DC operating point** (capacitors treated as open, inductors as short). If it is running, you get the values at the current moment. **Refresh** re-reads; **CSV** exports.'),
      H('4. Harmonics'),
      P('Runs the circuit for a number of cycles of the fundamental and takes the Fourier series of a probed signal: the amplitude of every harmonic as a bar chart, the **THD** (total harmonic distortion), RMS and crest factor. Choose the probe, the fundamental frequency and the number of harmonics, then tap **Analyse harmonics**. Use it for the current of a rectifier, CFL, dimmer or VFD.'),
      H('5. Impedance'),
      P('Measures the impedance between the two terminals of a **voltage probe** versus frequency, like an impedance analyser: |Z| and its phase on a Bode-style graph, with the minimum and maximum marked. Tap **Sweep impedance**. Find resonances, the input impedance of a filter, or check a loudspeaker or motor model.'),
      H('6. Parametric'),
      P('Runs the transient simulation once for each value of one component parameter and overlays the chosen signal — a family of curves, for example RC charging for five resistances or a motor start for several loads. Choose the component, parameter, values and run time, then tap **Run parametric sweep**.'),
      H('7. Monte Carlo'),
      P('A production-tolerance check: every resistor, capacitor and inductor is varied at random within the tolerance you set (default ±5 % for resistors, ±10 % for capacitors and inductors; Gaussian, uniform or worst-case) and the circuit is solved for each run. A histogram, the mean, standard deviation and worst cases show how much real parts move your output. Tap **Run Monte Carlo**.'),
      H('8. Power'),
      P('Runs the circuit and averages the power flowing into every component over the last part of the run: negative = the part supplies power, positive = it consumes it. Choose the useful load to get the **efficiency** (for example of a converter or an inverter). Tap **Measure power**.'),
      TIP('Every tab has a **CSV** button to export its results.'),
      H('9. SPICE Netlist'),
      P('Generates a standard SPICE netlist of your schematic, with `.op` and `.tran` commands, that you can open in **ngspice** or **LTspice** to cross-check results or continue research. Buttons: **Copy**, **Save .cir**, **Share**. Parts without a SPICE equivalent (such as digital blocks) are written as comments.'),
    ],
  },

  // ------------------------------------------------------------------ 12a
  {
    id: 'theorems', icon: 'book',
    title: 'Network theorems, step by step',
    blocks: [
      P('**⋮ → Run with theorem** solves your circuit the way it is done in class and in exams. Pick a theorem, pick the resistor whose current or voltage you want, and read the solution step by step. Every step has its own circuit drawing, the formulas with your values in them, and the result — down to the final equivalent circuit and the answer.'),
      S([
        'Build a circuit with resistors and DC sources (or open **Basics → Network theorems practice**, **Parallel batteries (Millman’s theorem)** or **Unbalanced Wheatstone bridge**).',
        'Tap **⋮ → Run with theorem** and choose a theorem — **Thevenin**, **Norton**, **Superposition**, **Source transformation**, **Maximum power transfer**, **Millman**, **Reciprocity** or **Tellegen** — or, under **Analysis methods**, **Nodal analysis** or **Mesh analysis**.',
        'Choose the resistor (the load): tap it on the drawing or in the list. Choose **Current I** or **Voltage V**.',
        'Tap **Solve step by step**. Scroll through the steps. **Run the circuit** at the end goes back to the board, runs the simulation and selects the load, so you can compare with the live reading.',
        'Tap a step\'s drawing to see it on the whole screen: a wide circuit comes up turned sideways to fill the screen (turn the phone; **⟳** turns it back). Pinch or double-tap to zoom in, drag to move round it, **Fit** to see all of it again. **Back** returns to the steps.',
      ]),
      H('What each theorem shows'),
      T(['Theorem', 'Steps and circuits'], [
        ['Thevenin', '1. R_th: the load is taken out and the sources are turned off (voltage source → wire, current source → open); the resistors are combined in series and parallel, one line per combination. 2. V_th: the open-circuit voltage between a and b, found by node voltages (KCL). 3. The Thevenin equivalent (V_th in series with R_th, the load back on) and I_L = V_th / (R_th + R_L).'],
        ['Norton', '1. R_N (the same as R_th). 2. I_N: a and b are shorted and I_N is the current in that short, found by node voltages and KCL at a. 3. The Norton equivalent (I_N in parallel with R_N and the load) and the current divider I_L = I_N·R_N / (R_N + R_L).'],
        ['Superposition', 'One step per independent source, with the others turned off. Each step finds the resistance the source sees and follows the current to the load with voltage and current dividers. The last step adds the parts (with their signs).'],
        ['Source transformation', 'The circuit is redrawn as a ladder with the load on the right. Then, one figure per step: V in series with R ⇄ I in parallel with R, resistors combined in series and parallel, current sources in parallel added — until one source and one resistor feed the load.'],
        ['Maximum power transfer', 'R_th and V_th as for Thevenin, then the best load R_L = R_th with P_max = V_th² / (4·R_th) drawn as an equivalent circuit, and the power of your present load with a curve of P_L against R_L that peaks at R_th.'],
        ['Millman', 'For branches that all run in parallel between the load’s two ends (batteries with their internal resistances, resistors, current sources): each branch’s E and R, then V_M = (ΣE/R + ΣI) / Σ(1/R), R_M = 1 / Σ(1/R), and the equivalent circuit. A circuit of another shape is named as not a Millman circuit.'],
        ['Reciprocity', 'For a circuit with one source: the current in the load with the source where it is, then the source moved into the load’s branch and an ammeter in its old place — the two currents are equal. (For a current source: the voltages.)'],
        ['Tellegen', 'The circuit solved by node voltages, then a table of every part’s voltage, current and power: the power the sources deliver equals the power the resistors take, so the sum is zero.'],
        ['Nodal analysis', '1. The nodes named on the drawing, the reference at 0 V, and KCL written at each node (a voltage source fixes its node or makes a supernode), solved. 2. V_L = V_a − V_b and I_L = V_L / R_L.'],
        ['Mesh analysis', '1. The meshes (the windows of the circuit) drawn with a clockwise current i₁, i₂, … in each. 2. KVL round each mesh — a current source sets its mesh’s current, or joins two meshes into a supermesh — solved. 3. The load current from the mesh currents through it (their difference when the load is shared by two meshes).'],
      ]),
      H('Nodal or mesh analysis inside a theorem'),
      P('Where a theorem has to solve a circuit — V_th, I_N, Tellegen, a superposition step that is not series–parallel, reciprocity — the step has a **Nodal analysis | Mesh analysis** switch. Nodal writes KCL with the node voltages; mesh writes KVL with the mesh currents (the drawing then shows the clockwise mesh currents instead of the node names), the branch currents and then the node voltages the step needs. Both give the same result; the switch is remembered for the next solution.'),
      P('The ends of the load are named **a** and **b**: a is the end at the higher voltage, so the load current flows from a to b. Other nodes used in the equations are tagged c, d, e … on the drawings. The last step always checks the answer against a direct solution of the whole circuit.'),
      L([
        '**Works with:** resistors, DC voltage sources (with their internal resistance), DC current sources, voltage rails, ground, switches and push buttons (closed = wire, open = gap), ammeters (wire) and voltmeters (open). In DC a capacitor is open and an inductor is a wire.',
        '**Not for:** transistors, diodes, op-amps and other non-linear parts. A circuit with sine or cosine sources (or shown in the phasor domain) is an **AC circuit**: it gets the phasor theorems of {{ch:phasors}} instead. The first screen lists any part that cannot be handled.',
        'If the resistors form a **bridge** (not simply series or parallel), R_th is found with a **delta → star (Δ–Y)** or star → delta swap, each new resistor worked out — or, when no single swap opens the bridge, with a 1 A test current. Source transformation stops when no step applies and says so.',
        'If R_th is infinite (only a current source feeds the load) there is no Thevenin equivalent; if R_N is 0 (a voltage source sits right across the load) there is no Norton equivalent. The solution says which theorem to use instead.',
      ]),
      TIP('Superposition adds currents and voltages, not powers: the last step shows the difference.'),
    ],
  },

  // ------------------------------------------------------------------ 11b
  {
    id: 'phasors', icon: 'wave',
    title: 'AC circuits: phasor domain and time domain',
    blocks: [
      P('An AC circuit can be shown and solved the way a circuits textbook does it (Alexander & Sadiku, *Fundamentals of Electric Circuits*, chapters 9, 10 and 13): the circuit is **transformed to the phasor (frequency) domain**, solved there with complex numbers, and the phasor turned back into a sinusoid.'),
      H('AC circuit: phasor domain'),
      S([
        'Build an AC circuit — sources set to **Cosine** (A cos(ωt + φ), the book’s reference) or **Sine**, resistors, inductors, capacitors, dependent sources, coupled coils — or open one of the **AC Circuits (Phasors)** examples.',
        'Tap **⋮ → AC circuit: phasor domain**. Every part is now labelled as in the book’s frequency-domain drawing: a source as its phasor (**20∠0° V**: peak value ∠ angle), a resistor in ohms, an inductor as **jωL** (j4 Ω), a capacitor as **1/(jωC)** (−j2.5 Ω), a mutual inductance as **jωM**. ω is that of the circuit’s sources.',
        'Press **Run**: the live readings are phasors — every node voltage (13.91∠−161.6° V) and every part’s current with its direction (→ 7.589∠108.4° A). Select a part to see its V and I phasors and its complex power S = ½VI* in its properties.',
        'In the phasor domain the properties take values the book’s way: a source’s **Phasor** (type 10∠30, 10<-45 or 3 + j4) and **ω** (rad/s), an inductor’s or capacitor’s **Impedance** (j4, -j2.5), a mutual inductance’s **jωM** (j2). The henries and farads follow from ω.',
        '**⋮ → AC circuit: time domain** goes back to the usual values. The choice is saved with the circuit.',
      ]),
      TIP('A circuit drawn straight in the phasor domain (j4 Ω, −j2 Ω, no ω given) is built at ω = 1 rad/s, where X ohms is X henries or 1/X farads: the phasors come out the same at any ω.'),
      H('Theorems with phasors'),
      P('On an AC circuit, **⋮ → Run with theorem** offers **Thevenin**, **Norton**, **Superposition**, **Maximum power transfer**, **Nodal analysis** and **Mesh analysis** in phasors. The part asked for can be a resistor, an inductor or a capacitor. The solution is written as the book does:'),
      L([
        '**Step 1 — Transform to the phasor domain:** each source V_m cos(ωt + φ) ⇒ V_m∠φ, each 1 H ⇒ jωL, each 0.1 F ⇒ 1/(jωC), each M ⇒ jωM.',
        '**Nodal analysis:** KCL at each node with the phasor terms ((V1 − 20∠0°)/10 + V1/(−j2.5) + …), a dependent source’s control written out, then the matrix [Y][V] = [I] and **Cramer’s rule** (Δ, Δ1, Δ2) — the node voltages V1, V2.',
        '**Mesh analysis:** KVL round each mesh with the impedances, (4 − j3 + j6)I1 − (j6 + j2)I2 = 100, then simplified, the matrix [Z][I] = [V] and Cramer’s rule — the mesh currents I1, I2. A coupled coil adds ±jωM × the other coil’s current.',
        '**Thevenin / Norton:** Z_th as series–parallel steps ((−j6 ∥ 8) + (4 ∥ j12) = 6.48 − j2.64 Ω), or with a 1∠0° A test source when there is a dependent source; V_th (or I_N); the equivalent drawn with the load.',
        '**Superposition:** one source at a time. Sources at **different frequencies** (a DC source, 10 cos 2t V and 2 sin 5t A) each get their own phasor domain, and their responses are added **in the time domain**: vo = −1 + 2.498 cos(2t − 30.78°) + 2.328 cos(5t − 77.91°) V.',
        '**Maximum average power:** the best load is the conjugate Z_L = Z_th*, with P_max = |V_th|² / (8·R_th) (peak phasors).',
        '**Last step:** the answer as a phasor and as a sinusoid — I_L = 7.589∠108.43° A ⇒ i_L(t) = 7.589 cos(4t + 108.43°) A.',
      ]),
      H('Magnetically coupled circuits'),
      P('Two coils coupled by a **mutual inductance** are drawn as in the book: two **Inductors** anywhere in the circuit, each with a **dot** (its properties → Dot: at terminal 1 or 2), and a **Mutual Inductance (M)** part (Transformers) placed between them — the curved double arrow marked M. It couples the two coils nearest it (or the two named in its properties). With both currents entering the dotted ends the mutual voltage M·di/dt (jωM·I) adds; otherwise it subtracts. It runs in the time domain too.'),
      H('From a photo'),
      P('**Circuit from photo** reads AC figures printed the book’s way: phasors with their angle sign (20∠60° V), reactances (j4 Ω for a coil, −j2.5 Ω for a capacitor), time functions (20 cos 4t V, 10 sin 2t A), coupled coils with their dots and the curved arrow’s jωM. A figure drawn in the phasor domain opens in the phasor domain.'),
      TIP('The examples **AC Circuits (Phasors)** are the book’s worked examples 10.1, 10.3, 10.6, 10.8, 13.1 and 13.2, each with the answer the app reaches in its description.'),
    ],
  },

  // ------------------------------------------------------------------ 12a
  {
    id: 'photo', icon: 'camera',
    title: 'Circuit from photo',
    blocks: [
      P('Take a photo of a circuit diagram — a figure in your textbook, an exam question, a neat sketch on paper — or choose a picture or a screenshot, and the circuit is redrawn on the board with every value, ready to run. Independent and **dependent sources** (the diamonds: 0.1vₓ, 4iₓ, 0.5V₀ …), resistors, capacitors, batteries, coils and grounds are read, and so are the voltages and currents the drawing marks.'),
      P('Open it from **⋮ → Circuit from photo** in the editor, or from **Or start from a photo** on an empty board (tap **New circuit** on Home first).'),
      P('The picture is read **on this phone**: no internet, no account or key, and the picture never leaves the phone. Printed diagrams (textbooks, exam papers, screenshots) and neat hand-drawn sketches are read, usually in a few seconds.'),
      H('Reading a circuit'),
      S([
        'Tap **Take a photo** (the camera opens) or **Choose an image** (a picture or screenshot from the gallery).',
        'Crop it to the circuit: drag the corners of the box round the circuit you want read, leaving out other figures and the problem\'s text (drag the box to move it, or draw a new one; **Whole picture** takes all of it). Tap **Read the circuit**.',
        'Wait while the circuit is read. **Cancel** stops it.',
        'Check the redrawn circuit against the picture (tap **The photo** to see it again). A page with several figures lists them all: tap the one you want.',
        'The drawing shows each part\'s name and value big enough to read. Put right what was read wrong in the **Parts read** list under it: tap a row to see that part highlighted on the drawing (or tap a part on the drawing to find its row); pick another kind for it (a resistor read as a coil, a source read as a resistor; **Just a wire** if it was no part at all), type its value, or tap the bin to remove it. **Back to what was read** undoes all your changes.',
        'Tap **Open on the board**. The circuit opens as a new circuit (also saved in My Circuits), named after the figure, **paused**. Check it once more, then press **Run**: the live labels show every node voltage and branch current, so the asked quantity (vₓ, i, I₀ …) can be read straight off the board.',
      ]),
      WARN('Reading a circuit from a photo is **not always 100 % right**: a part, a value or a wire can be read wrong. After opening it on the board, check it against the picture and fix whatever is wrong there (or in the list before opening), or take a sharper photo and read it again.'),
      H('What the phone reads'),
      L([
        'Straight wires and the joints between them; resistors (zigzags), coils (bumps, or loops like a spring seen from the side), capacitors and batteries of one cell or more (plates: the long plate is +), grounds, and open switches (a lever slanting from one wire end towards the next).',
        'Wires and parts drawn slanting, as in a bridge drawn as a diamond or a delta and a star drawn as triangles: on the board they are drawn slanting too, at the angle they were drawn (each part along its side, its leads in line with it, the wires straight), joined exactly as drawn; a side drawn as one straight line (a corner, a part, a node) comes out as one straight line, without the kinks the grid would put in it; where a slanting line would cross another part or run along another wire, the circuit is laid level and upright instead. Values printed along a slanting side are read too, also with a name before them (**x₁ = 2.5Ω**, and **Z₁ = 5Ω** written level).',
        'Resistors printed small, whose zigzag runs together into a thick bit of the line in a photo, and decimal points that run into the next digit (3.33Ω).',
        '**Op amps** (a triangle with **−** and **+** inside, the output at its point): placed as the board\'s ideal op amp, pointing the way it was drawn, the − and + inputs where they were drawn (told by the signs; unseen, the − is taken as the upper or left input). Its supply rails are ±15 V: change them in its settings if the problem gives others.',
        '**Electronics as a book prints it** (an electronic-devices textbook\'s figures): **diodes** (a filled triangle pointing at a bar; the anode at the triangle\'s base), told apart as **zeners** (the bar\'s ends bent, one each way; the voltage printed by it is its breakdown voltage) and **LEDs** (two little arrows beside it); **bipolar transistors** (a thick base bar, the collector and emitter leaving it at a slant, the arrowhead on the emitter pointing out for an **npn**, in for a **pnp**; the base on either side); **junction FETs** (a thick channel bar, the drain and source leaving it square near its ends, the gate\'s arrowhead pointing in for an **n-channel**, out for a **p-channel**); and **MOSFETs** (the gate plate drawn a little apart from the channel: one solid bar for a **depletion** type, three pieces for an **enhancement** type, the substrate\'s arrowhead telling n from p). Each is placed as the board\'s part, turned and mirrored the way it was drawn. A transistor\'s **β = 90** sets its gain; a JFET\'s or a depletion MOSFET\'s **IDSS = 8 mA** and **VP = −4 V** set its curve; an enhancement MOSFET\'s **VGS(Th) = 3 V** sets its threshold and **k = 0.3 × 10⁻³** (or **ID(on) = 6 mA** at **VGS(on) = 8 V**) its k. Unread, the board\'s defaults are kept: set them in its settings.',
        '**Drawn by hand**: a diode whose triangle is drawn in outline, and a transistor whose base bar is a plain stroke, are read too.',
        '**Supply terminals**: a wire ending in a little ring (or just ending) with a voltage printed by it (**+16 V**, **18 V**, **−12 V**) is a **Voltage Rail** of that voltage, referred to ground.',
        'Circles (or ovals) as independent sources — **+ −** marks make a voltage source, **~** an AC source, an arrow a current source (also one drawn on the wire running on through the circle) — and diamonds as **dependent sources**, with the expression written beside them (0.1vₓ, 4iₓ).',
        'Values with their units and prefixes: 20 Ω, 4.7 kΩ, 2 mH, 10 μF, 9 V, 3 A; values printed as fractions (½ H, ¼ F); a conductance in siemens (2 S) is a resistor of 1/G (0.5 Ω).',
        'Marked quantities: **+ vₓ −** across a part, an arrow with **i** beside a branch (or an arrowhead drawn on the wire itself, named like **I_A**), a name like **vₓ** at a node. A dependent source is tied to the quantity its expression names. Mesh currents drawn as round arrows inside the meshes (i₁, i₂) are left out: they are no parts.',
        'The figure number (**Figure 4.12**) names the circuit; a page with several figures gives each its own.',
        'Sketches drawn by hand in pen, with their values written by hand: wavy lines, corners that overshoot, rings that do not quite close, rounded zigzags, capacitor plates drawn far apart, a unit written a little apart from its value (2  Ω), a decimal point written run into the digit before it (1.67 Ω), a 4 written open at the top, a current arrow drawn with two strokes.',
        'Drawings on ruled or squared paper (the printed lines are left out, a wire drawn along one is kept) and photos taken a little turned (they are straightened first).',
        'Whole textbook pages: coloured headings, shaded boxes behind a figure, thick bus bars or meters drawn beside a circuit seldom upset the reading of its lines and labels.',
        'A MOSFET drawn by hand, other symbols, and untidy or crowded sketches are not read: draw those parts on the board yourself.',
      ]),
      H('Getting a good result'),
      L([
        'Hold the phone flat over the page, with the whole circuit in the frame, in focus and in good light. Crop the photo to the circuit: one circuit at a time reads best.',
        'Every value should be readable in the photo. Notes under the drawing say what was unsure — a part whose value could not be read gets a default value to set on the board.',
        'Drawing it yourself? Use a dark pen, let wires meet at their corners, draw each part clearly bigger than the pen is thick, and write each value next to its part, clear of the wires.',
        'Warnings under the drawing say what could not be rebuilt as read — a part end joined to nothing, a dependent source whose controlling quantity is not marked — so you can fix it on the board.',
        'On the board, a circuit read from a photo shows its **values written big**, not the drawing\'s names (A, B, x₁ …): only a node voltage that drives a dependent source (vₓ) gets a **net label** with its name. Dependent sources are the **Dependent Source (diamond)** part: its **Controlled by** setting says what drives it (`node:vx`, `v:R2` or `i:R4`) and its gain carries the sign the drawing marks.',
        'If the drawing has no ground symbol, the bottom wire is taken as 0 V.',
      ]),
      WARN('Always compare the redrawn circuit with the photo before you trust the answer: a misread value or a missed wire gives a different circuit.'),
      P('Reading handwriting was learned in part from **HASYv2**, a set of hand-written symbols by Martin Thoma, made available under the Open Database License (ODbL) 1.0.'),
    ],
  },

  // ------------------------------------------------------------------ 12b
  {
    id: 'loadflow', icon: 'tower',
    title: 'Load Flow Analysis (power systems)',
    blocks: [
      P('A separate section for **power-system load flow (power flow) studies**: the bus voltages |V|∠δ, the real and reactive power in every line and transformer, the slack-bus generation and the losses of a transmission network. Open it from the **Load Flow Analysis** card on Home, or from **⋮ → Load flow analysis** in the editor. Back returns to where you came from.'),
      P('It works on bus and branch data (like MATPOWER or the IEEE common data format), not on the schematic: powers in MW / Mvar, impedances in per unit on the system MVA base.'),
      H('Tabs'),
      T(['Tab', 'What it does'], [
        ['System', 'Choose a test system, edit buses and branches, set the solver and tap **Run load flow**'],
        ['Results', 'Convergence summary, totals (generation, load, losses, line charging), violations, bus table and line-flow table; **CSV** and **Report**'],
        ['Diagram', 'One-line diagram in two styles: **Textbook** (black on white: bus bars, G1 / G2 generator circles, Line 1 / Line 2 labels, load arrowheads, results in blue) or **Modern** (coloured by voltage and line loading); moving power-flow dots, arrows and MW / Mvar / % labels; pinch, scroll or double-tap to zoom, drag to pan, **+ / − / fit / full screen** buttons; drag a bus to move it, tap it for details'],
        ['Charts', 'Voltage profile with the limits, angle profile, convergence (log scale), branch loading and losses'],
        ['Iterations', 'Every iteration: largest mismatch and the bus voltages; the Newton–Raphson Jacobian'],
        ['Y-bus', 'The bus admittance matrix in rectangular or polar form, and each branch admittance'],
        ['N-1', 'Takes each line / transformer out in turn and reports the lowest voltage and the highest loading'],
        ['Per-unit tools', 'Base values, ohms ↔ per unit, line (Ω/km, nF/km) and transformer (uk %) to per unit, change of base; adds the result as a new branch'],
        ['Theory', 'Bus types, per unit, Y-bus, power-flow equations, Gauss–Seidel, Newton–Raphson, Fast Decoupled, DC load flow, Q limits, line flows'],
      ]),
      H('Test systems'),
      L([
        '**3-bus** textbook systems (Saadat): the hand-worked Gauss–Seidel and Newton–Raphson examples.',
        '**4-bus** Grainger & Stevenson (Birch, Elm, Pine, Maple, with a PV generator bus), **5-bus** Stagg & El-Abiad, **6-bus** Wood & Wollenberg (with line ratings), **WSCC 9-bus** (Anderson & Fouad) and the **IEEE 14-bus** system.',
        '**None — start from scratch** gives an empty system: add buses with **+ Bus** (the first one is the slack bus).',
        'A **2-bus** template to start your own network. **Save** keeps it under My systems; **Import** / **Export** read and write MATPOWER case files (.m) and .json.',
      ]),
      H('Building a system'),
      S([
        'Tap **+ Bus**. Choose the type: **Slack** (|V| and angle held, exactly one), **PV** (generator: P and |V| held) or **PQ** (load: P and Q given).',
        'Enter the load Pd + jQd, the generation Pg, the voltage set-point, and optional Qmin / Qmax and shunt Gs / Bs.',
        'Tap **+ Line** or **+ Transformer**: from and to bus, R, X, total line charging B (per unit), the tap ratio and phase shift of a transformer and an optional MVA rating.',
        'Untick **In service** to study an outage.',
      ]),
      H('Solver options'),
      T(['Option', 'Meaning'], [
        ['Method', '**Newton–Raphson** (3–5 iterations), **Gauss–Seidel** (simple, many iterations), **Fast Decoupled** (constant B′ / B″ matrices) or **DC load flow** (linear, P only)'],
        ['Tolerance', 'Largest allowed power mismatch in per unit (default 10⁻⁶)'],
        ['Max iterations', 'Empty = automatic (30 NR, 100 FDLF, 1000 GS)'],
        ['Acceleration α', 'Gauss–Seidel only; 1.4–1.6 is usually fastest'],
        ['V min / V max', 'Voltage limits for the violation check and the colours (default 0.95–1.10 pu)'],
        ['Enforce generator Q limits', 'A PV bus whose Q passes Qmin / Qmax is held at the limit as a PQ bus'],
        ['Flat start', 'Start from |V| = 1, δ = 0 instead of the entered values'],
      ]),
      TIP('Try it: open the IEEE 14-bus system, tap Run, then switch the method to Gauss–Seidel and run again. The voltages are the same; the iteration count goes from 3 to about 60.'),
    ],
  },

  // ------------------------------------------------------------------ 13
  {
    id: 'saving', icon: 'save',
    title: 'Saving, opening and sharing',
    blocks: [
      H('Automatic saving'),
      P('You never need to press Save. The circuit is saved a moment after every change, when you leave the editor, and when the app goes to the background. It then appears in **My Circuits** with a thumbnail. **Continue where you left off** on Home reopens the last circuit.'),
      H('The ⋮ More menu in the editor'),
      T(['Item', 'What it does'], [
        ['Save to My Circuits', 'Saves now.'],
        ['Save as copy', 'Saves a second copy named "… (copy)" so you can try changes safely.'],
        ['Circuit name & notes', 'Change the name and add a note (up to 500 characters).'],
        ['Export file (.rckt)', 'Saves the circuit as a file you can keep or send.'],
        ['Open file…', 'Opens a `.rckt` circuit or a backup file.'],
        ['Circuit from photo', 'Reads a circuit diagram from a photo or a picture and opens it as a new circuit (see the chapter **Circuit from photo**).'],
        ['Share circuit', 'Sends the circuit through any app on your phone.'],
        ['SPICE netlist', 'Opens Analysis on the netlist tab.'],
        ['Export image (PNG)', 'Saves a picture of the board with the circuit name and RAPTI credit, good for reports.'],
        ['Operating point', 'Opens Analysis on the operating-point tab.'],
        ['Run with theorem', 'Solves the circuit step by step with a network theorem — Thevenin, Norton, superposition, source transformation, maximum power transfer, Millman, reciprocity or Tellegen — or by nodal or mesh analysis (see the chapter on network theorems).'],
        ['Settings', 'Opens Settings.'],
        ['User manual', 'Opens this manual.'],
        ['Help & gestures', 'Shows the short how-to card.'],
        ['Clear circuit', 'Removes all parts, wires and probes after confirmation (Undo brings them back).'],
      ]),
      H('Backup and restore'),
      L([
        '**Backup all** (My Circuits page or Settings → Backup circuits) saves **every** project and folder in one file named `RaptiCKT_backup_<date>.json`.',
        'To restore, tap **Import** or **Restore backup** and choose that file. The circuits are added back to My Circuits.',
        'Keep a backup before you change phones, clear app data or uninstall the app. **Uninstalling the app deletes your saved circuits.**',
      ]),
      WARN('Storage is limited. If the app says "Storage is full", export some circuits as files and delete old ones.'),
      H('Sending a circuit to a friend'),
      S([
        'Open the circuit (or use its **⋮** menu in My Circuits).',
        'Choose **Share** and pick WhatsApp, Messenger, email or any app. Or choose **Export file** and send the `.rckt` file yourself.',
        'Your friend opens the file with **Open file** (or **Import**) in RaptiCKT. It is added to their My Circuits.',
      ]),
    ],
  },

  // ------------------------------------------------------------------ 14
  {
    id: 'settings', icon: 'sliders',
    title: 'Settings reference',
    blocks: [
      P('Open Settings from the sliders icon on Home or from **⋮ → Settings** in the editor. Every change is saved at once.'),
      H('Appearance'),
      T(['Setting', 'What it does'], [
        ['Theme', '**Midnight** (dark blue), **AMOLED Black** (pure black, saves battery on OLED screens) or **Blueprint Light** (for bright rooms and printing).'],
        ['Grid', 'Lines, dots or none.'],
        ['Voltage colours', 'Wires glow green (+) / red (−).'],
        ['Current animation', 'Moving dots show current flow.'],
        ['Animation speed', 'Slow, Normal, Fast, Very fast: how fast the current dots move (not the simulation).'],
        ['Capacitor charge', '± signs on capacitor plates.'],
        ['Animations', '**Auto** (by phone speed), **Smooth** (always) or **Off** (simple and fastest). Use Off on a slow phone.'],
        ['Value labels', 'Show component values (4.7 kΩ…) on the board.'],
        ['Component names', 'Show R1, C1, D1…'],
        ['Live node voltages', 'Voltage of every net written on its wire.'],
        ['Live currents', 'Current and its direction beside each part.'],
        ['AC readings', '**RMS** (like a meter) or **Instantaneous**.'],
      ]),
      H('Landscape & full screen'),
      T(['Setting', 'What it does'], [
        ['Screen rotation', '**Auto** (follow the phone), **Always landscape** or **Always portrait**.'],
        ['Scope beside the circuit', 'On (default): in landscape the oscilloscope sits to the right of the board. Off: above it, as in portrait.'],
      ]),
      H('Real-life limits'),
      T(['Setting', 'What it does'], [
        ['Parts burn out', 'On: over-stressed parts burn out, wires catch fire, breakers can be destroyed (see {{ch:limits}}). Off: nothing burns; fuses still blow and breakers still trip.'],
        ['Heating & trip timing', '**Real time** (default): heating, breaker and relay trips and burning follow the real clock. **10× faster** for quick demonstrations. **Simulation time**: everything follows the slowed-down circuit time.'],
        ['New wires', 'The cable given to wires you draw: Ideal wire, or 1–10 mm² copper PVC house wire, or a flexible cord.'],
      ]),
      H('Simulation (for advanced users)'),
      T(['Setting', 'What it does'], [
        ['Integration method', '**Trapezoidal** (accurate, default) or **Backward Euler** (more damped, can calm a circuit that rings badly).'],
        ['Start from DC operating point', 'On: the circuit starts in its settled DC state. Off: everything starts at zero, like switching on power.'],
        ['Maximum timestep', 'Upper limit of the internal step (default 100 µs).'],
        ['RELTOL', 'Relative tolerance, default 1e-3.'],
        ['VNTOL', 'Absolute voltage tolerance, default 1 µV.'],
        ['ABSTOL', 'Absolute current tolerance, default 1 nA.'],
        ['GMIN', 'Tiny conductance from every node to ground that helps convergence, default 1e-12 S.'],
        ['Newton iterations', 'Tries per step before the step is halved (default 60).'],
      ]),
      P('These are the same defaults SPICE uses. Change them only if you know why; **Reset settings** restores everything.'),
      H('Interaction and data'),
      T(['Setting', 'What it does'], [
        ['Haptic feedback', 'Small vibrations when you add, wire, turn the knob or press a switch.'],
        ['Sound (buzzer)', 'Plays a tone when a buzzer, bell or speaker is active, and a bang when a part burns out.'],
        ['Backup circuits', 'Saves every circuit in one file.'],
        ['Restore backup', 'Loads a backup or circuit file.'],
        ['Reset settings', 'Back to defaults (your circuits are not touched).'],
      ]),
    ],
  },

  // ------------------------------------------------------------------ 15 (library: generated)
  {
    id: 'library', icon: 'chip', generated: 'library',
    title: 'Component library (all 522)',
    blocks: [
      P('Every component in the app, grouped as in the **+** menu. For each part you see what it does and which settings you can change. Use the search box at the top of the manual to find a part quickly.'),
    ],
  },

  // ------------------------------------------------------------------ 16 (examples: generated)
  {
    id: 'examples', icon: 'book', generated: 'examples',
    title: 'Examples (all 110)',
    blocks: [
      P('Open any example, press **Run** (it starts by itself), then experiment: tap switches, turn knobs, add scope probes, run an analysis. You cannot damage the original.'),
    ],
  },

  // ------------------------------------------------------------------ 17
  {
    id: 'formulas', icon: 'sigma',
    title: 'Quick reference: formulas and units',
    blocks: [
      H('Ohm\'s law and power'),
      L(['`V = I × R`   ·   `P = V × I = I²R = V²/R`', 'Series: `R = R1 + R2 + …`   ·   Parallel: `1/R = 1/R1 + 1/R2 + …`', 'Voltage divider: `Vout = Vin × R2 / (R1 + R2)`']),
      H('Capacitors, inductors and time constants'),
      L(['RC time constant: `τ = R × C` (reaches 63 % in one τ, 99 % in 5 τ)', 'RL time constant: `τ = L / R`', 'Reactance: `Xc = 1 / (2πfC)`   ·   `Xl = 2πfL`', 'Cut-off of RC filter: `fc = 1 / (2πRC)`', 'Resonance of L and C: `f₀ = 1 / (2π√(LC))`   ·   Series RLC: `Q = (1/R)·√(L/C)`']),
      H('AC'),
      L(['`Vrms = Vpeak / √2` (230 V RMS = 325 V peak)', 'Frequency and period: `f = 1 / T`', 'Power factor: `PF = cos φ = P / S`   ·   `S = V × I` (VA)   ·   `Q = V × I × sin φ` (VAR)', '3-phase: `V_line = √3 × V_phase`']),
      H('Semiconductors and ICs'),
      L(['LED resistor: `R = (Vsupply − Vf) / I`', 'Inverting op-amp gain: `−Rf / Rin`   ·   Non-inverting: `1 + Rf / Rg`', '555 astable: `f = 1.44 / ((R1 + 2·R2) × C)`', 'Transformer: `Vs / Vp = Ns / Np`', 'Ripple of a rectifier with a capacitor: about `I / (f × C)`']),
      H('Unit prefixes'),
      T(['Letter', 'Name and size'], [
        ['`p`', 'pico, 10⁻¹²'],
        ['`n`', 'nano, 10⁻⁹'],
        ['`u` or `µ`', 'micro, 10⁻⁶'],
        ['`m`', 'milli, 10⁻³'],
        ['`k`', 'kilo, 10³'],
        ['`M` or `meg`', 'mega, 10⁶'],
        ['`G`', 'giga, 10⁹'],
      ]),
      H('Colours used by the app'),
      L(['Green = positive voltage · Red = negative voltage · Yellow dots = current.', 'Blue labels = voltages · Green labels = currents.', 'Scope: yellow, cyan, pink, green, orange, purple channels. Bode: yellow = gain, cyan dashed = phase.']),
    ],
  },

  // ------------------------------------------------------------------ 18
  {
    id: 'troubleshooting', icon: 'help',
    title: 'Troubleshooting and FAQ',
    blocks: [
      H('Nothing happens when I press Run'),
      L(['The board may be empty: add components first.', 'The circuit may have no closed loop: current needs a path from the source, through the parts, and back.', 'The simulation may be **paused**: the button reads **Resume**.', 'The speed may be too slow or too fast for your circuit: tap the speed chip and tick **Automatic**.']),
      H('My LED / lamp does not light'),
      L(['Check polarity: the LED current must flow from anode to cathode. Use **Reverse polarity** in the quick bar.', 'Check that the wires touch the terminal circles. Zoom in to look.', 'Is a switch open? Tap it.', 'Is there enough voltage? An LED needs about 2 V plus a series resistor. A lamp needs its rated voltage.', 'Is a protective device tripped (MCB, fuse, RCCB)? Tap it to reset, or find the cause.']),
      H('"Circuit cannot be solved (singular matrix)"'),
      L(['A **floating** part: something is connected to nothing, or a current source has no path. Connect it, or add a high resistor to ground.', 'A **loop of voltage sources or inductors** with no resistance. Add a small series resistor.', 'Two ideal voltage sources of different value connected in parallel. Add a little internal resistance (every source has an "Internal resistance" setting).', 'The message names the part: it is highlighted. Start there.']),
      H('"Simulation failed to converge" / "did not converge"'),
      L(['Slow the simulation (smaller timestep) with the speed chip.', 'Check for very large or very small values (for example 1 TΩ next to 1 mΩ).', 'Add small series resistances to ideal switches, sources and inductors.', 'In **Settings**, try **Backward Euler**, or switch off **Start from DC operating point**.']),
      H('"… is short-circuited"'),
      P('A warning that both terminals of a part are on the same net. Remove the extra wire, unless you did it on purpose.'),
      H('The scope or meter shows nothing'),
      L(['The simulation must be running.', 'Scope: you must add a probe first (select a wire, tap **Scope**). Up to 6 channels.', 'Meter: the probe pins must sit on a node (a wire or terminal). **Probe not on a node** means move the pin.', 'A or W mode needs a selected two-terminal part.']),
      H('The Bode plot is empty or the button does nothing'),
      L(['Add a source and make sure it is chosen as **Input source**.', 'Probe the output wire with **Scope** so it appears under **Output**.', 'The stop frequency must be larger than the start frequency.']),
      H('The speed chip is amber, or the app feels slow'),
      L(['Lower the **simulation speed**.', 'Settings → **Animations → Off**, and switch off **Live node voltages** and **Live currents**.', 'Close the scope panel and other apps. Very big circuits with many digital parts need more power.']),
      H('I cannot connect two parts'),
      L(['Zoom in (pinch) so the terminals are bigger.', 'Tap exactly on the small circle: it lights up with a ring. A tap in the middle of a part selects the part instead.', 'Then tap the other terminal or a wire. Tapping empty space cancels.']),
      H('I changed something by mistake'),
      P('Tap **Undo** (up to 120 steps). If you changed an example, open it again from Examples: the original is untouched.'),
      H('My circuits disappeared'),
      P('Circuits live inside the app on your phone. Clearing the app\'s data or uninstalling the app removes them. Restore from a backup file if you made one (**Open file / Restore backup**). Make backups regularly.'),
      H('Can I use it without internet?'),
      P('Yes. **Circuit from photo** reads pictures on the phone too. Only the buttons that open the RAPTI website, WhatsApp, email or map need internet.'),
      H('Is the result exactly like a real circuit?'),
      P('The engine follows SPICE methods and has been checked against textbook answers (RC and RL time constants, resonance, diode, BJT and MOSFET equations, op-amp gain, transformer ratio, logic truth tables, 555 frequency and more). Blocks such as logic gates, the 555, regulators, sensors and protection devices are **idealised models**. Always confirm important designs with datasheets and real measurements, and use **SPICE netlist** to cross-check in ngspice or LTspice.'),
    ],
  },

  // ------------------------------------------------------------------ 19
  {
    id: 'about', icon: 'star',
    title: 'About RAPTI and contact',
    blocks: [
      P(`**${RAPTI.full}** (RAPTI) was established in ${RAPTI.founded}. ${RAPTI.mission} ${RAPTI.about}`),
      H('Courses'),
      L(RAPTI.courseList.map((c) => `${c.name} — ${c.months}`)),
      P('Tap a course on the **About** page to see what it covers and how long it takes.'),
      H('Contact'),
      L([
        `Website: ${RAPTI.website.replace('https://', '')}`,
        `Phone / WhatsApp: ${RAPTI.phones.map((p) => p.replace(/^\+880/, '0').replace(/^(\d{5})(\d+)$/, '$1-$2')).join(', ')}`,
        `Email: ${RAPTI.email}`,
        `Address: ${RAPTI.address}`,
        'The **About** page in the app has one-tap buttons for all of these.',
      ]),
    ],
  },
];

// ------------------------------------------------- per-category usage notes (library chapter)
export const CATEGORY_NOTES = {
  Sources: 'Every circuit needs a source. **DC Voltage** is a battery-like source; **AC Voltage**, **Square**, **Pulse**, **Triangle**, **Sawtooth**, **Sweep**, **Noise**, **AM/FM**, **Step**, **Exponential**, **Damped sine**, **Piecewise-linear** and **f(t)** are signal generators for testing. **AC Mains** and the **3-phase** supplies are for power and house-wiring circuits (values are RMS). **Ground**, **Protective Earth** and **Chassis Ground** are all 0 V. The controlled sources (VCVS, VCCS, CCVS, CCCS) copy a measurement from one pair of terminals to another.',
  Batteries: 'Each battery has a **state of charge** (%), a capacity (Ah) and an internal resistance. Its voltage falls as it discharges and a heavy load makes it sag. Current flowing into the + terminal charges it.',
  Renewables: 'Solar panels and arrays, MPPT and PWM charge controllers, off-grid and grid-tie inverters, a wind turbine and a fuel cell. They follow the real curves (the panel\'s I–V curve with irradiance and temperature, the turbine\'s power coefficient), so you can size a solar home system or watch an MPPT controller track the maximum power point. Turn the **irradiance** or **wind** knob while running.',
  Communication: 'Behavioural communication blocks (no firmware or code runs): UART transmitter and terminal, RS-232, RS-485 and CAN transceivers, I²C and SPI masters with real slave chips (PCF8574, 74HC595), wireless links with a link budget (433 MHz, nRF24L01, Bluetooth LE, Wi-Fi, LoRa, Zigbee), an RFID reader, a fibre link, and signal blocks for radio (filters, RF amplifier, mixer, envelope detector, antenna). The messages are typed into the transmitter\'s settings.',
  Passive: 'Resistors, capacitors and inductors, plus variable and real-world versions. The knob changes the main value. Polarised capacitors (electrolytic, tantalum, supercapacitor) must be connected the right way round.',
  Transformers: 'Coupled-coil models with a turns ratio. Use them for isolation and for stepping voltage up or down. The 3-phase transformers have standard vector groups (Dyn11, Yyn0, Yd1, Dd0). CT and PT are instrument transformers for metering.',
  Protection: 'Fuses, breakers, residual-current devices, surge protectors and relays. They really **trip** in the simulation (an MCB follows its B/C/D curve, an RCCB trips on leakage current). After a trip the part shows **TRIPPED** with the cause. Tap it once to reset.',
  'Switches & Relays': 'Tap a switch to toggle it while the circuit runs. Push buttons act only while held. Relays, contactors (with main poles and auxiliary 13-14 / 21-22 contacts), latching and timer relays, the 3-pole overload relay and phase / voltage monitoring relays have a **coil** or sensing side and a **contact** side: when the coil is energised the contacts move. To draw a control circuit as a **ladder diagram** (like a textbook), use the ladder parts: put a **Contactor Coil** or **Timer Coil** in a rung and give it a tag such as `KF`; every **NO Contact**, **NC Contact** and **Main Contacts 3-pole** part with the same tag then follows that coil (a new contact takes the tag of the last coil already in the circuit, and the coils that exist are shown as buttons under its *Follows* field — tap one to link it; while running, a contact whose tag matches no coil shows its tag in amber with a ?), and **Overload Relay Heaters** / **Phase Monitor** work the same way for their 95-96, 97-98 and 11-14 contacts. More ladder parts: **Counter Coil** + **Counter Reset Coil** (preset counter), **Floatless Level Relay** watching a **Water Tank**, **Limit Switch NO / NC** operated by a **Carriage / Cylinder** that the coils drive, and the **MPCB**. Every example in *Industrial Control (Ladder)* is drawn this way — open them from Examples.',
  Electrical: 'Parts for house wiring and lighting: bulbs, tube light with choke and starter, fan with regulators, heater, socket with a selectable appliance (including "Faulty" and "Short circuit" for testing protection), dimmer, bell and earth electrode. Use them with **AC Mains**.',
  'Power Systems': 'Rated loads (R-L, R-C, 3-phase star and delta), a power-factor correction capacitor and transmission-line models. Set the load by its power and power factor.',
  Machines: 'DC motors and generators (shunt, series, compound, universal), single- and 3-phase induction motors (including a 6-terminal motor for star-delta starting), synchronous motor, PMSM, BLDC with hall sensors, stepper motor and alternators. They include electrical and mechanical behaviour: starting current, speed, torque and slip; motors start at rest. Read the live **rpm** and **current** in the properties sheet.',
  Diodes: 'Diodes conduct only one way (anode → cathode). Zener diodes hold a fixed reverse voltage. Bridge and 3-phase rectifiers are ready-made blocks. Pick a **model** to get real-part numbers.',
  Transistors: 'BJTs, MOSFETs, JFETs, IGBT and more. Terminals: BJT = collector, base, emitter; MOSFET = drain, gate, source. Pick a **model** (2N3904, 2N2222, BC547, 2N7000, IRF540N…) for real numbers.',
  'Thyristors & Power': 'SCR, TRIAC, DIAC, GTO and friends for phase control and power switching, a firing unit for SCR bridges, H-bridge and 3-phase inverter bridges, an SPWM modulator (V/f control), BLDC and stepper drivers, gate drivers, and averaged DC-DC converters (buck, boost, buck-boost, Ćuk, SEPIC, flyback, forward, push-pull, half and full bridge).',
  'Analog ICs': 'Op-amps (with gain-bandwidth and slew rate), comparators, the 555 timer, fixed and adjustable regulators and other analog building blocks. Real op-amp models: LM741, LM358, TL071 and more.',
  'Control & Math': 'Signal-flow blocks, as in Simulink: gain, adders, multiplier, integrator, differentiator, transfer functions, PID, limiter, delay and mathematical functions. They work on voltages standing for signals.',
  'Logic Gates': 'Inputs, outputs and gates. **Logic input** is a switch you tap (HIGH/LOW); **Clock** gives a square wave; **Logic output** is an indicator that shows 1 (lit) or 0. Gates give outputs from the logic levels at their inputs.',
  'Digital ICs': 'Adders, comparators, multiplexers, decoders, latches, flip-flops, counters, shift registers, monostable, ADC and DAC. Drive them with a **Clock** and **Logic inputs**, and watch with **Logic output** or a 7-segment display.',
  Sensors: 'Each sensor has an **environment knob**: light for an LDR, temperature for an NTC or LM35, strain for a strain gauge, field for a Hall sensor, and so on. Turn it while running to see the sensor respond. Tap a PIR to simulate motion.',
  Output: 'LEDs (single, RGB, bicolour, infrared, laser), a bar graph, 7-segment and hex displays, buzzers, speaker, solenoid and servo. They light, sound or move to show what the circuit is doing.',
  'Vacuum Tubes': 'Classic valves: vacuum diode, triode and pentode, for vintage audio and radio circuits.',
  Meters: 'Meters that stay in the circuit: voltmeter, ammeter (use **Auto** for RMS in AC), ohmmeter, wattmeter, power-factor, VAR, kWh, frequency, phase, dB, peak, LCR, megger and moving-coil meters. **Test point** and **Label** mark and name places on the schematic.',
};

// One-line description of each chapter, shown on the manual's contents page.
export const SUMMARY = {
  welcome: 'What the app does and who it is for',
  quickstart: 'Build and run your first circuit in 2 minutes',
  limits: 'Parts that burn out, wires that catch fire, and replacing them',
  screens: 'The main pages and how to move between them',
  editor: 'Top bar, toolbar, board and gestures',
  adding: 'Find components and place them on the board',
  editing: 'Select, move, rotate, copy, undo',
  wiring: 'Draw wires, junctions and ground',
  values: 'Type values, sliders and the knob',
  running: 'Run, pause, speed, live colours, errors',
  scope: '6 channels, FFT and XY views',
  meter: 'Voltage, current, resistance and power',
  analysis: 'AC sweep, DC sweep, operating point, SPICE',
  theorems: 'Thevenin, Norton, superposition, source transformation',
  phasors: 'Phasor domain, jωL, Cramer’s rule, coupled coils',
  photo: 'Snap a circuit diagram, get a circuit you can run',
  loadflow: 'Power-system load flow: NR, GS, FDLF, DC, IEEE cases',
  saving: 'Autosave, files, sharing and backup',
  settings: 'Every setting explained',
  library: 'All components, category by category',
  examples: 'Ready-made circuits to learn from',
  formulas: 'Formulas, unit prefixes and colours',
  troubleshooting: 'Fixes for common problems, FAQ',
  about: 'RAPTI courses and contact',
};

/**
 * A chapter split into pages: the text before its first sub-heading, then one
 * section per sub-heading. A chapter with fewer than two sections stays on one page.
 */
export function chapterParts(c) {
  const intro = [], sections = [];
  for (const b of c.blocks) {
    if (b.t === 'h') sections.push({ title: b.text, blocks: [] });
    else (sections.length ? sections[sections.length - 1].blocks : intro).push(b);
  }
  return sections.length >= 2 ? { intro, sections } : { intro: c.blocks, sections: [] };
}

// ---------------------------------------------------------------- chapter references
export const chapterNumber = (id) => CHAPTERS.findIndex((c) => c.id === id) + 1;
/** "chapter 9" */
export const chapterLabel = (id) => `chapter ${chapterNumber(id)}`;
/** Replace {{ch:id}} tokens; link(id, label) may wrap the label (e.g. in an <a>). */
export function expandRefs(text, link = (id, label) => label) {
  return String(text).replace(/\{\{ch:([a-z]+)\}\}/g, (m, id) => (chapterNumber(id) ? link(id, chapterLabel(id)) : ''));
}

// ------------------------------------------------------------ catalogue builders
const strip = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** The component library as data: [{id, title, note, items:[{title, desc, props}]}], read live from the registry. */
export function libraryData() {
  return CATEGORIES.map((c) => ({
    id: c.id,
    title: c.id,
    note: CATEGORY_NOTES[c.id],
    items: c.items.map((t) => getType(t)).filter(Boolean).map((C) => ({
      type: C.type,
      title: C.title,
      desc: strip(C.description),
      props: (C.props || []).filter((p) => !p.hidden).map((p) => p.label + (p.unit ? ` (${p.unit})` : '')),
    })),
  }));
}

export function libraryCount() { return libraryData().reduce((n, c) => n + c.items.length, 0); }

/** The examples as data, grouped by category in the order they appear in the app. */
export function exampleData() {
  const cats = [];
  for (const e of EXAMPLES) {
    let c = cats.find((x) => x.id === e.cat);
    if (!c) { c = { id: e.cat, title: e.cat, items: [] }; cats.push(c); }
    c.items.push({ id: e.id, title: e.title, desc: strip(e.desc) });
  }
  return cats;
}

// ------------------------------------------------------------------ markdown export
const mdInline = (s) => expandRefs(s);
const cell = (s) => mdInline(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function blockMd(b) {
  switch (b.t) {
    case 'p': return `${mdInline(b.text)}\n`;
    case 'h': return `#### ${mdInline(b.text)}\n`;
    case 'steps': return `${b.text.map((x, i) => `${i + 1}. ${mdInline(x)}`).join('\n')}\n`;
    case 'ul': return `${b.text.map((x) => `- ${mdInline(x)}`).join('\n')}\n`;
    case 'tip': return `> **Tip:** ${mdInline(b.text)}\n`;
    case 'warn': return `> **Warning:** ${mdInline(b.text)}\n`;
    case 'table': {
      const n = b.head.length;
      const head = `| ${b.head.map(cell).join(' | ')} |\n| ${Array(n).fill('---').join(' | ')} |`;
      const rows = b.rows.map((r) => `| ${r.map(cell).join(' | ')} |`).join('\n');
      return `${head}\n${rows}\n`;
    }
    default: return '';
  }
}

/** The whole manual as Markdown. */
export function manualMarkdown() {
  const out = [];
  out.push(`# RaptiCKT — ${UI_TEXT.title}`, '', `*${APP.tagline} · ${APP.subtitle} · ${UI_TEXT.version} ${APP.version}*`, '', UI_TEXT.tagline, '');
  out.push(`## ${UI_TEXT.contents}`, '');
  CHAPTERS.forEach((c, i) => out.push(`${i + 1}. [${c.title}](#ch-${c.id})`));
  out.push('');
  CHAPTERS.forEach((c, i) => {
    out.push(`<a id="ch-${c.id}"></a>`, '', `## ${i + 1}. ${c.title}`, '');
    for (const b of c.blocks) out.push(blockMd(b));
    if (c.generated === 'library') {
      for (const cat of libraryData()) {
        out.push(`### ${cat.title} — ${cat.items.length}`, '');
        if (cat.note) out.push(mdInline(cat.note), '');
        out.push('| | |', '| --- | --- |');
        for (const it of cat.items) out.push(`| **${cell(it.title)}** | ${cell(it.desc)}${it.props.length ? ` <br>*${UI_TEXT.props}:* ${cell(it.props.join(', '))}` : ''} |`);
        out.push('');
      }
    }
    if (c.generated === 'examples') {
      for (const cat of exampleData()) {
        out.push(`### ${cat.title}`, '');
        for (const it of cat.items) out.push(`- **${it.title}**: ${mdInline(it.desc)}`);
        out.push('');
      }
    }
  });
  out.push('---', `© ${new Date().getFullYear()} ${RAPTI.full} · rapti.net`, '');
  return out.join('\n');
}
