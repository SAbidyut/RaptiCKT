# RaptiCKT — User Manual

*Resonance Automation · Circuit Simulator · Version 1.0.0*

Everything in the app, explained step by step.

## Contents

1. [Welcome to RaptiCKT](#ch-welcome)
2. [Quick start: your first circuit](#ch-quickstart)
3. [Home, Examples, My Circuits, About](#ch-screens)
4. [The editor at a glance](#ch-editor)
5. [Adding components](#ch-adding)
6. [Moving, selecting and editing parts](#ch-editing)
7. [Wiring](#ch-wiring)
8. [Changing values and the knob](#ch-values)
9. [Running the simulation](#ch-running)
10. [Real-life limits: burning parts, wires and cables](#ch-limits)
11. [Oscilloscope](#ch-scope)
12. [Multimeter](#ch-meter)
13. [Analysis: Bode, sweeps, harmonics, Monte Carlo, SPICE](#ch-analysis)
14. [Saving, opening and sharing](#ch-saving)
15. [Settings reference](#ch-settings)
16. [Component library (all 520)](#ch-library)
17. [Examples (all 101)](#ch-examples)
18. [Quick reference: formulas and units](#ch-formulas)
19. [Troubleshooting and FAQ](#ch-troubleshooting)
20. [About RAPTI and contact](#ch-about)

<a id="ch-welcome"></a>

## 1. Welcome to RaptiCKT

**RaptiCKT** is a circuit simulator that runs on your phone. You draw a circuit, press **Run**, and the app calculates what every wire and part is doing, live: voltages glow on the wires, small dots show current flowing, and you can measure with an oscilloscope and a multimeter. Nothing needs an internet connection.

#### What you can do with it

- Build analog, digital and mixed circuits on an unlimited canvas.
- Pick from **520 components in 22 categories**: sources, batteries, solar and wind, resistors, capacitors, transformers, protection devices, switches, contactors, house-wiring parts, motors and drives, diodes, transistors, power electronics, op-amps, logic ICs, communication blocks, sensors, meters and more.
- Watch the circuit work: green wires are positive, red wires are negative, yellow dots move with the current.
- Tap switches and push buttons in **✋ Operate** mode (it comes on by itself when you press Run), draw and move in **Wire** mode, and turn a knob to change any value live.
- Measure with a **6-channel oscilloscope** (with FFT and XY) and a **multimeter** (V, A, Ω, W).
- Run **AC sweep (Bode plot)**, **DC sweep**, **Operating point**, **Harmonics (THD)**, **Impedance**, **Parametric**, **Monte Carlo** and **Power / efficiency** analyses, and export a **SPICE netlist**.
- Inject **faults** into any part (open terminal, short circuit, leakage) to practise troubleshooting and to test protection.
- Learn from **101 ready-made examples**, including 8 big build-along **projects** (a 2-storey house wired from the service main to the earth pits, a 2-room flat, 16-bit RAM, mains to 5 V supply, traffic lights, 4-bit adder, seconds counter, automatic street light): LED, RC filter, rectifier, amplifier, 555 timer, tube light, staircase wiring, house wiring, DOL and **star-delta** motor starters, forward/reverse and pump control, **VFD**, inverters, SMPS, solar and wind systems, RS-485, I²C, SPI, radio and more.
- Save circuits on the phone, share them as `.rckt` files, and export a picture (PNG).

#### Who it is for

Electrical and electronic engineering students, teachers, technicians, hobbyists and researchers. It is made by **RAPTI — Resonance Automation Professional Training Institute**.

#### Requirements

- Android 8.0 or newer.
- No internet needed. Everything, including your saved circuits, stays on your phone.

#### How to read this manual

If you are new, read chapters 2 to 6 first (about 10 minutes). The rest is a reference: come back when you need a feature. Use the search box at the top, or tap a chapter in the contents.

<a id="ch-quickstart"></a>

## 2. Quick start: your first circuit

Let us build the "hello world" of electronics: a battery, a resistor and an LED. It takes about two minutes.

1. On the **Home** screen tap **New circuit**. An empty board opens.
2. Tap the round **+** button (bottom right). The component menu opens.
3. Type `dc` in the search box and tap **DC Voltage**. A battery symbol appears on the board. Then search `resistor` and tap **Resistor**, then search `led` and tap **LED**, then search `ground` and tap **Ground**. The menu stays open so you can add several parts in a row. Tap **✕** to close it.
4. Drag the parts with your finger to arrange them in a row. Pinch with two fingers to zoom, drag on empty space to move the board.
5. **Draw the wires.** Every part has small circles at its ends: these are the **terminals**. Tap one terminal, then tap a terminal of the next part: the wire is drawn and routed for you. Connect: battery **+** → resistor → LED anode (the flat-triangle side) → LED cathode → ground, and battery **−** → ground.
6. Tap the battery and use the **knob** that appears (or open its properties) to set the voltage to **9 V**. Tap the resistor and set it to **470 Ω**. You can type values like `470`, `4.7k`, `10u`.
7. Press **Run** in the toolbar. The wires turn green, yellow dots flow, and the LED lights up. The current (about 15 mA) is written next to the resistor.
8. Select the wire between the resistor and the LED and tap **Scope**. The oscilloscope opens and draws that voltage.
9. Press **Run** again to pause. Tap **Undo** if you made a mistake. The circuit is saved automatically; find it later under **My Circuits**.

> **Tip:** Even faster: open **Home → Examples → LED with switch**. It is already wired. Press Run and tap the switch.

> **Tip:** If the LED does not light, check that every wire end really touches a terminal, and that there is a resistor in series. See **Troubleshooting**.

<a id="ch-screens"></a>

## 3. Home, Examples, My Circuits, About

When the app opens you see a short splash, then the **Home** screen. The bar at the bottom switches between the main pages.

#### Home

- **New circuit**: opens an empty board.
- **Open file**: opens a `.rckt` circuit file or a backup file from your phone.
- **Continue where you left off**: appears when there is an unfinished circuit. One tap returns to it.
- Feature tiles (Oscilloscope, Multimeter, Bode plots, DC sweep, SPICE export) open a new board; **Sensors** opens the Examples page.
- **Recent circuits** and **Start with an example**: tap a card to open it.
- Tap the **RAPTI logo** (top left) or the RAPTI banner to read about the institute.
- The **sliders** icon (top right) opens **Settings**.

#### Examples

37 ready-made circuits, each with an explanation. Filter by category with the chips at the top. Opening an example starts it running by itself (press Pause to stop it). If you change an example, it is saved as your own circuit when you go back; the original example is never damaged.

The full list is in the chapter **Examples**.

#### My Circuits

Your saved **projects** (circuits), kept on this phone and sorted into **folders** like files on a computer. Tap a project to open it; tap a folder to go inside. The path at the top (**My Circuits › Folder › Sub-folder**) shows where you are: tap any name in it to jump up. The Android **Back** button also goes up one folder.

- **New project**: asks for a name, then opens an empty board. The project is saved **in the folder you are viewing**.
- **New folder**: makes a folder here. Folders can hold projects and other folders, as deep as you like.
- **Import**: opens a `.rckt` file or a backup; it is added to the folder you are viewing.
- **Backup all**: one file with every project **and your folders**. Restoring it brings the folders back too.
- **Select**: see below.

Tap the **⋮** button on a project for **Open**, **Rename**, **Move to folder…**, **Duplicate**, **Export file**, **Share** and **Delete**. On a folder it offers **Open**, **Rename**, **Move to…** and **Delete folder**.

#### Select, move and delete many at once

1. Tap **Select**. Round tick boxes appear.
2. Tap projects and folders to tick them. **All** ticks everything in the current folder (it then reads **None**).
3. **Move**: choose the destination (**My Circuits** at the top, or any folder, or **New folder…**). A folder cannot be moved into itself.
4. **Delete**: asks first and shows how many projects and folders will go, including projects inside the folders you picked. **Backup all first** lets you save everything before deleting.
5. Tap **✕** (or Back) to leave Select mode.

> **Warning:** Deleting a folder also deletes every project inside it.

#### About

Version number, a short description of the app and its engine, information about RAPTI (courses, phone, WhatsApp, email, website, address), and accuracy notes.

#### Back button

The Android **Back** button closes the topmost thing: an open dialog, then Settings or Manual, then panels inside the editor, then clears the selection, and finally goes back to Home. Your circuit is saved when you leave the editor or put the app in the background.

<a id="ch-editor"></a>

## 4. The editor at a glance

The editor is where you build and run circuits. From top to bottom:

#### Top bar

| Button | What it does |
| --- | --- |
| Back arrow | Saves and returns to Home. |
| Circuit name | Tap to rename. The line below shows your note or the component count. |
| Eye | Cycles the labels: values → names + values → hidden. |
| Multimeter | Shows or hides the multimeter. |
| Oscilloscope | Shows or hides the scope panel. |
| Analysis | AC sweep, DC sweep, Operating point, SPICE netlist. |
| ⋮ More | Save, export, share, netlist, picture, settings, help, clear. |

#### Toolbar

| Button | What it does |
| --- | --- |
| Run / Pause / Resume | Starts the simulation, pauses it, continues it. |
| Restart | Starts again from time zero (capacitors empty, etc.). |
| Step | Pauses and advances a small slice of time. Press repeatedly to go frame by frame. |
| Select | Turns on multi-select mode (chapter 6). |
| Undo / Redo | Goes back or forward through your last 120 changes. |
| Fit | Zooms so the whole circuit is visible. |
| Full | Full screen: hides the bars and the phone's status and navigation bars (chapter 4, *Landscape & full screen*). |

#### Landscape & full screen

- Turn the phone **sideways**: the title, the buttons and the toolbar merge into **one row**, the **oscilloscope sits to the right** of the board instead of above it, and the properties and parts sheets open as a **side panel** on the right, so the circuit keeps its height.
- Tap **Full** in the toolbar for **full screen**: the bars and the phone's status and navigation bars disappear and the board gets the whole display, edge to edge. The tools stay out of the way: only a small **☰** handle sits at the top left. Tap it for the **tool rail** (Exit full screen, Run / Pause, Restart, Oscilloscope, Multimeter, Labels, Undo, Fit, Hide), the **+** button and the time chip; they slide away again after a few seconds, when you touch the board, or with **‹** at the bottom of the rail. Swipe from the edge to see the phone's bars for a moment.
- Leave full screen with the top button of the rail or the phone's **Back** button.
- Settings → *Landscape & full screen*: lock the **screen rotation** (auto, always landscape or always portrait) and choose whether the **scope sits beside the circuit** in landscape.

#### Operate and Wire mode

As in RaptiAuto, the board has two modes. The switch at the top right of the board shows which one is on and changes it with one tap; it stays there in full screen too.

| Mode | What a finger does |
| --- | --- |
| Wire (amber) | Tap two terminals to draw a wire, drag a part to move it, tap a part to select it. Switches are **not** flipped, so you can edit a running circuit without changing it. This is the mode while the circuit is not running. |
| ✋ Operate (green) | Tap switches, push buttons, breakers, keypads and sensors to work them (hold a push button down). Dragging only **pans** the board, so nothing gets moved or wired by accident. Tap any other part to see its readings. |

- Pressing **Run** (or Resume) switches to **Operate** by itself; **Pause** goes back to **Wire**.
- Pick either mode by hand at any time: **Wire** while it runs to edit, or **✋ Operate** before Run to set the switches first.
- A long press on a part opens its properties in both modes. With a keyboard: **O** = Operate, **W** = Wire.

#### The board

- The big area with the grid is your **canvas**. It is unlimited: pan and zoom freely.
- The round **+** button (bottom right) adds a component.
- The **✋ Operate | Wire** switch at the top right of the board picks what a finger does (chapter 4, *Operate and Wire mode*).
- The chip at the top of the board shows the simulation time and speed, for example `t = 12.5 ms · 5 ms/s`. Tap it to change the speed (chapter 9). It says **CPU-limited** when the phone cannot keep up.
- A red or yellow bar appears at the top when the circuit has a problem (chapter 19).
- When you select a part, a **quick bar** appears (name, current reading, rotate, scope, edit, delete) and, for parts with a main value, the **knob**.
- Messages (toasts) appear briefly at the bottom to confirm what happened.

#### Gestures

| Gesture | Result |
| --- | --- |
| Tap a part | Selects it. On a switch or button, it also operates it. |
| Hold a part (half a second) | Opens its properties. |
| Drag a part | Moves it. Wires stay attached and follow. A part never lands on another part. |
| Tap a terminal, then another | Draws a wire between them (EveryCircuit style). |
| Drag empty space | Pans the board. |
| Pinch with two fingers | Zooms in and out. |
| Double-tap the board and hold, then slide | One-finger zoom, like Google Maps: slide **down** to zoom in, **up** to zoom out, around the point you tapped. Works on empty board or a wire. |
| Double-tap empty board | Zooms in one step around that point. |
| Hold empty space, then drag | Draws a selection box. |
| Tap a wire | Selects the wire (then you can scope or delete it). |
| Tap empty space | Clears the selection. |

On a computer browser you can also use: **Delete** (remove), **R** (rotate), **Space** (run/pause), **Ctrl+Z / Ctrl+Y** (undo/redo), **Ctrl+D** (copy), and the mouse wheel to zoom.

<a id="ch-adding"></a>

## 5. Adding components

1. Tap the round **+** button. The component menu slides up.
2. Choose a category tab: **Recent**, **Sources**, **Batteries**, **Passive**, **Transformers**, **Protection**, **Switches & Relays**, **Electrical**, **Power Systems**, **Machines**, **Diodes**, **Transistors**, **Thyristors & Power**, **Analog ICs**, **Control & Math**, **Logic Gates**, **Digital ICs**, **Sensors**, **Output**, **Vacuum Tubes**, **Meters**. Swipe the tab row sideways to see them all.
3. Or type in the **search box**. It searches names, keywords and categories, for example `thermistor`, `555`, `3 phase`, `fuse`.
4. Tap a component. It is placed in a free spot in the middle of the visible board. The menu stays open, so tap more parts if you need them.
5. Tap **✕** (or the Back button) to close the menu.

> **Tip:** The **Recent** tab remembers the parts you used last, so common parts are one tap away.

> **Tip:** Always add a **Ground** to your circuit (see chapter 7). Many examples show where it goes.

The complete list of all 520 components, with what each one does and which values you can change, is in the chapter **Component library**.

<a id="ch-editing"></a>

## 6. Moving, selecting and editing parts

#### Select a part

Tap it. It is highlighted and the **quick bar** appears near the bottom with:

- Its **name** (R1, C2, D1…), type and a live reading (for example `3.84 V · 816 µA`). Tap this area to open all properties.
- **Reverse polarity** (only for polarised parts such as batteries, diodes, LEDs, electrolytic capacitors): swaps the two terminals while the wires stay connected.
- **Rotate**: turns the part 90° each tap.
- **Scope**: adds the part to the oscilloscope.
- **Edit** (sliders icon): opens the properties sheet.
- **Delete**.

#### Properties sheet

Hold a part for half a second, or tap its name in the quick bar. A sheet slides up with:

- **Live readings** while the simulation runs (voltage, current, power, state…).
- Action buttons: **Rotate**, **Flip** (mirror), **Copy**, **Scope V** (voltage across the part), **Scope I** (current through it), **Delete**.
- Every adjustable property: a text box and a slider for numbers, a drop-down for choices (for example the **model** of a transistor or op-amp), a switch for yes/no.
- A short description of the part.
- Tap the **✓** to close.

Choosing a **model** (for example `2N3904`, `LM741`, `1N4148`) fills in all the matching numbers at once. If you then change one number by hand, the model switches to **custom**.

#### Typing values

Number boxes understand engineering prefixes. You can type any of these:

| You type | Meaning |
| --- | --- |
| `4.7k`  or  `4k7` | 4 700 |
| `10u`  or  `10µ` | 0.000 01  (10 micro) |
| `2.2M`  or  `2.2meg` | 2 200 000 |
| `100n`, `47p`, `5m` | 100 nano, 47 pico, 5 milli |
| `1e-3` | 0.001 |

Note: `m` is **milli** and `M` is **mega**. The unit letter (Ω, F, H, V, A) is added by the app; you do not need to type it.

#### Move, rotate, flip, copy, delete

- **Move**: drag the part. It snaps to the grid. Connected wires follow and re-route neatly. A part cannot be dropped on top of another part, and its terminals never join another terminal or wire just by touching: it stops at the last free spot (drag on into free space to hop over), and you connect parts by drawing a wire. Duplicates are placed on a free spot too. The undo button reverses the move.
- **Rotate**: quick bar button (or **R** on a keyboard).
- **Flip**: properties sheet (mirrors the part).
- **Copy**: properties sheet or selection bar. The copy appears slightly down and right.
- **Delete**: quick bar or selection bar.

#### Selecting many parts

1. Tap **Select** in the toolbar (it turns blue). Or just hold empty space and drag a box.
2. Drag a box **from left to right** = **window**: only parts and wires **completely inside** are selected.
3. Drag a box **from right to left** = **crossing**: everything the box **touches** is selected.
4. While Select is on, tap parts or wires one by one to add or remove them.
5. A **selection bar** shows how many parts and wires are selected, with **Rotate**, **Copy**, **Delete** and **✕** (clear). Dragging any selected part moves them all together.
6. Tap **Select** again to leave the mode.

#### Undo and redo

Every change (adding, moving, wiring, changing a value, deleting) can be undone. The app remembers your last 120 steps. Undo and Redo are greyed out when there is nothing to undo or redo.

<a id="ch-wiring"></a>

## 7. Wiring

#### Draw a wire: tap, tap

The quickest way, as in EveryCircuit: tap two terminals and the app draws the wire for you.

1. **Tap a terminal** (the small circle at the end of a part). It lights up with a pulsing ring. (The first time, a short hint tells you what to do next.)
2. **Tap another terminal.** A neat right-angled wire is drawn between them, going round parts where it can.
3. You can also tap **a point on an existing wire** (to branch from it) or **the body of a part** (the wire goes to its nearest terminal).
4. Changed your mind? Tap **empty space** or the same terminal again, or press **Back**, to cancel.

#### Branches and junctions

- To branch from an existing wire, tap **a point on that wire** as the first or the second end of a new wire. The two are then electrically joined.
- A **dot** marks a junction where three or more connections meet.
- Two wires that simply **cross** each other are **not** connected. They connect only where one ends on the other, or at a terminal.

#### Edit wires

- **Tap a wire** to select it. The selection bar offers **Scope** (probe its voltage) and **Delete**.
- Moving a part drags its wires along; they are re-routed so they do not run through other parts.
- To redo a wire, delete it and draw it again.

#### Ground

Voltages are measured against **ground (0 V)**. Add a **Ground** symbol (Sources category) and connect it to the point you call 0 V, usually the battery **−**. **Protective Earth** and **Chassis Ground** are also 0 V.

> **Tip:** If you forget ground, the simulator ties each separate part of the circuit to 0 V by itself, so it still runs. But for clear, meaningful readings always add one ground.

#### Wiring checklist

- Every wire end must sit **on a terminal circle** (or on another wire). A wire that stops near it is not connected.
- A closed loop is needed for current to flow: source → parts → back to the source.
- Do not connect ideal voltage sources directly across each other, and do not leave a current source with nowhere to push its current.
- Check polarity: battery **+**, diode and LED **anode/cathode**, electrolytic capacitor **+**.

<a id="ch-values"></a>

## 8. Changing values and the knob

There are three ways to change a value. All of them also work **while the circuit is running**, so you see the effect immediately.

- **Type it** in the properties sheet (for example `2.2k`).
- **Drag the slider** under the number in the properties sheet.
- **Turn the knob** that appears next to a selected part.

#### The knob

When you select a part, a round **knob** shows its main value (resistance of a resistor, voltage of a source, temperature of an NTC, light level of an LDR, duty cycle of a PWM source, and so on). The value is written above the dial. There are two kinds:

| Kind | How it works |
| --- | --- |
| **Decade dial** (resistance, capacitance, inductance, frequency…) | The digits 1 to 9 are printed round the ring. Turn the dial: each click goes 1 → 2 → … → 9 → 10 → 20 → … Tap a digit to jump straight to it. The **−** and **+** buttons change the value by one tenth of a digit (for example 4.7 kΩ, 1.5 µF) and roll into the next decade. |
| **Stepped knob** (volts, %, °, °C, …) | Each click moves one whole step that follows the value you see: 1 to 99 move by 1 (5 V → 6 V), 100 to 999 by 10 (230 V → 240 V), 10 mA → 11 mA. **−** and **+** make a finer step. |

You can also drag a finger round the dial to turn it. You feel a small vibration at each click (turn off in Settings → Haptic feedback).

> **Tip:** The knob can cover a small part on a small screen. The board slides up a little to keep the new part visible. You can also pan the board yourself.

#### Which value is on the knob?

Each component decides. Resistor → resistance; capacitor → capacitance; DC source → voltage; AC source → frequency or amplitude; potentiometer → wiper position; LDR → light; NTC → temperature; PWM generator → duty cycle; and so on. The other values are always in the properties sheet.

#### Faults: break or short a part on purpose

At the bottom of the properties sheet, **⚡ Fault** lets you damage any part to practise fault-finding or to test protection: **Open circuit (broken terminal)** disconnects one terminal; **Short circuit** joins two terminals (≈1 mΩ); **Leakage / partial short** puts a resistance of your choice between two terminals. A faulty part shows a red ⚡ badge on the board; choose **None (healthy)** to repair it. Faults are saved with the circuit.

> **Tip:** For a fault that happens at a set moment while the circuit runs (to watch a breaker trip), use the **Fault (timed short circuit)** part from **Power Systems** — see the example **Short-circuit fault & MCB tripping**.

<a id="ch-running"></a>

## 9. Running the simulation

#### Run, pause, restart, step

- **Run** starts the simulation from time zero. The button then becomes **Pause**; after pausing it reads **Resume**.
- **Restart** resets time to zero and everything inside parts (capacitor charge, inductor current, counters, motor speed, tripped breakers) to the start.
- **Step** advances one small slice of time and stays paused. Use it to watch fast events slowly.
- The screen stays awake while the simulation runs.
- If the circuit has no components, the app tells you to add some first.

#### What you see while it runs

| Display | Meaning |
| --- | --- |
| Green wire | Positive voltage (stronger colour = higher voltage). |
| Red wire | Negative voltage (stronger colour = more negative). |
| Grey wire | About 0 V. |
| Yellow moving dots | Current. Dots move in the direction of current; faster/denser = more current. |
| Blue number on a wire | The voltage of that net (Settings → Live node voltages). |
| Green number with arrow beside a part | The current through the part and its direction (Settings → Live currents). |
| + / − on capacitor plates | Stored charge (Settings → Capacitor charge). |
| Glowing LED, lamp, moving motor, lit segment | Parts animate to show their state. |

#### AC circuits: RMS readings

In a circuit with a sine supply (AC source, mains, 3-phase), the live labels show the **RMS** over one supply cycle, like a real meter, for example `12 V~` on the secondary of a 230 V : 12-0-12 V transformer. DC nets show their average. Voltmeters and ammeters are set to **Auto** and show RMS in AC circuits. To see instantaneous values instead, use **Settings → AC readings → Instantaneous**.

#### Simulation speed

Tap the chip at the top of the board (`t = … · …/s`). A small panel opens:

- **Simulation speed**: how much circuit time passes per real second. Slide left for slow motion (to see a fast oscillation), right for fast (to see a slow charge).
- **Timestep Δt**: the internal step the solver uses (it is chosen automatically from the speed and the highest frequency).
- **Automatic**: tick it to let the app choose a speed that suits your sources. Moving the slider switches Automatic off for this circuit.

If the chip says **CPU-limited**, the phone cannot calculate as fast as you asked: lower the speed, or simplify the circuit. The app also lowers the drawing sharpness automatically on slow phones to keep animation smooth.

#### Interactive parts

While running you can touch the circuit like a real one:

| Part | Touch |
| --- | --- |
| Switches (one-way, two-way, intermediate, DPST, DPDT, isolator, rotary…) | Tap to toggle. |
| Push buttons (NO / NC) | Hold to press, release to let go. |
| Latching push button, emergency stop | Tap to press and latch; tap again to release. |
| MCB, MCCB, RCCB, RCBO | Tap to switch on/off. After a trip, tap once to **reset**. A destroyed breaker must be replaced (see chapter 10). |
| Overload relay, IDMT relay | Tap to reset after a trip. |
| Logic input, hex input | Tap to flip a bit / step the value. |
| PIR sensor | Tap to simulate motion. |
| Capacitive touch sensor | Tap to touch / release. |
| Peak meter, kWh meter | Tap to reset. |

#### Errors and warnings

If the circuit cannot be solved, a bar at the top tells you what and where, for example **"Circuit cannot be solved (singular matrix) near R3. Check for floating current sources or open circuits."** The part concerned is highlighted. A yellow bar is a warning, for example "D1 is short-circuited". See **Troubleshooting** for what to do.

<a id="ch-limits"></a>

## 10. Real-life limits: burning parts, wires and cables

Parts in RaptiCKT have the limits of real parts. Too much voltage or current **burns them out**, an overloaded **wire overheats, smokes, catches fire and burns through**, and a breaker that is asked to break more than it can is **destroyed**. A burnt part stays burnt — also after Restart — until you **replace** it, just like changing a fused bulb at home.

#### What can burn

| Part | Fails when… |
| --- | --- |
| Incandescent bulb, lamp | About 1.6 × its rated voltage: the filament melts (a 230 V bulb on 400 V, a 12 V lamp on 24 V). It goes open. |
| LED | Far above its rated current at once (an LED straight on a battery), or about 2.5 × for a few seconds. Always use a series resistor. |
| Resistor | Give it a **Power rating** (1/4 W, 1 W…): above about 2.5 × that power it burns open. "Ideal" has no limit. |
| Electrolytic / tantalum capacitor | Over 1.2 × its rated voltage, or connected the wrong way round: it bursts. Electrolytics fail open, tantalums fail **short**. |
| Fuse | Blows when its I²t is exceeded, and stays blown until replaced. |
| MCB, MCCB, RCBO | Trips on overload or short circuit (tap to reset). A fault current above its **breaking capacity Icn** (6 kA for an MCB) destroys it. |
| RCCB | Has no overcurrent protection: a long overload above its In burns it. Always fit an MCB before it. |
| Ceiling fan | Over-voltage saturates its iron core, so the current climbs much faster than the voltage. Its run capacitor (≈1.2 × the supply across it, rated 440 V) bursts first — the fan then only hums at locked-rotor current — and the winding burns at ≈180 °C. At 500 V: capacitor after ≈10 s, winding after ≈20 s. |
| Heater, LED bulb, CFL, LED panel, loads, sockets | Too high a supply voltage: the element, driver or appliance burns. A socket melts above its current rating. |
| Wires and cables | Current above the cable rating Iz heats them; far above it they smoke, catch fire and burn through. |

#### Every part has real ratings

Every physical part carries the limits of a typical real one (from datasheets): the property sheet shows them under **Real-life ratings**, and while the circuit runs the readings show **Stress (towards failure)** as the part heats or wears. Some ratings are editable properties (contact rating, VA, heatsink, power rating, rated current).

| Parts | What destroys them, and how they fail |
| --- | --- |
| Diodes, bridges, zeners | Power and current above the rating (1N4148 200 mA, 1N4007 1 A, zener 0.5–5 W); a zener needs a series resistor. Rectifiers fail **short**, which then blows the fuse. |
| Transistors (BJT, MOSFET, IGBT, GaN) | Collector / drain current, power (with the chosen **Heatsink**), collector–emitter or drain–source breakdown; a MOSFET gate above ±20 V (GaN: +6 V) punctures at once. They fail **short**. |
| Thyristors, TRIACs, opto-couplers, SSRs | On-state current (IT(RMS)), gate current without a gate resistor, LED current. Thyristors, TRIACs and SSRs fail **short** — the load stays on. |
| ICs | 555 above 18 V, 78xx input above 35 V, LM317 above 40 V, op-amps above their supply limit (±22 V LM741, 32 V LM358…), 74HC logic above VDD 7 V, CD4000 above 20 V, LM393 output above ≈30 mA, TL431, LM4040, L298N, A4988, LM2596, MT3608… |
| 78xx regulators | Too much heat ((Vin − Vout) × I) does not destroy them: like the real chip they go into **thermal shutdown** and switch back on when cooled, cycling. A bigger heatsink fixes it. |
| Capacitors | Electrolytic and tantalum (over-voltage, reverse), MLCC (cracks short), film (opens), mica, PF capacitors, supercapacitors (vent above 2.7 V). |
| Transformers | Primary over-voltage saturates the core and burns the winding; more than the rated VA overheats it; an open CT secondary breaks the insulation. |
| Motors and generators | Winding temperature from the current (time constant ≈5 min): a stalled motor (≈6 × rated current) burns in ≈20 s, an overloaded one in minutes — fit an overload relay. |
| Switches, relays, contactors | Contacts burn above their **Contact rating**; a relay coil burns on too high a coil voltage; a contactor carrying a short circuit **welds shut** and keeps the load on. |
| Batteries | A short circuit or too high a current overheats them (Li-ion: thermal runaway and fire); over-charging; charging a primary (alkaline, coin) cell makes it leak. |
| Speakers, buzzers, solenoids, Peltier, lasers, neon lamps, sensors, meters | Over-power (voice coil), over-voltage, coil current, laser current (a laser dies almost at once), a neon without its resistor, sensors above their supply limit, an ammeter across a supply (fuse), an ohmmeter on a live circuit, a moving-coil meter over its range. |
| Vacuum tubes | Plate dissipation above the rating (12AX7 1 W, EL84 12 W): the plate glows red and the tube fails. |

Ideal parts (ideal sources, the ideal op-amp, ideal capacitors and resistors without a power rating, control and math blocks) have no limits.

When something burns you see a flash, flames and smoke, hear a bang and get a message saying why. The part turns dark with a red **!** badge.

#### Replacing a burnt part

1. Tap the burnt part. The bar at the bottom shows a red **Replace** button (and the property sheet a **Replace with a new one** button).
2. Tap it: a new, cold part is fitted in the same place, with the same values.
3. Fix the cause first (lower the voltage, add a resistor, use a thicker cable), or the new part burns again.
4. To replace everything at once use **⋮ → Replace burnt parts & wires**.

#### Wires and cables

Every wire you draw is a real cable (Settings → **New wires**, 1.5 mm² copper PVC house wire by default). Select a wire and tap **Cable** to choose:

- **Cable type**: single-core PVC house wire (BYA / H07V-U), flexible cord (H05VV-F), rubber cable (H07RN-F), PVC or XLPE power cables in copper (NYY, N2XY) or aluminium (NAYY, NA2XY), or an **Ideal wire** with no limit.
- **Conductor size**: 0.5 to 400 mm².
- **Conductor (IEC 60228)**: **RE** round solid, **RM** round stranded, **SM** sector-shaped stranded, **RF** round flexible.
- **Installation method**: in conduit in an insulated wall (A1), in conduit on a wall (B1), clipped direct (C), in free air (E) or buried (D) — a cable that can lose heat easily carries more current.

The sheet shows the current rating **Iz** (IEC 60364-5-52), the resistance per km and, while running, the current, the load in % and the conductor temperature. **Use for all wires** gives every wire this cable; **Make default** uses it for the wires you draw next.

| Conductor temperature | What you see |
| --- | --- |
| Up to the insulation rating (70 °C PVC, 90 °C XLPE) | Normal. |
| Above it | Overloaded: the wire glows orange. |
| Above 160 °C (PVC) | The insulation melts: red glow and smoke. |
| Above 250 °C (PVC) | It catches fire and burns through after a few seconds: the circuit opens. |

A burnt wire is drawn charred with a red ✕ where it parted. Select it and tap **Repair** (or pick a thicker size, which also repairs it).

> **Tip:** Protect every cable with an MCB or fuse no larger than its Iz: then the breaker trips before the wire gets hot. That is exactly how house wiring is designed — e.g. 1.5 mm² lights on a 10 A MCB, 2.5 mm² sockets on 16–20 A, 4 mm² geyser on 25 A.

Drawn wires have no resistance. To see the **voltage drop** and power loss of a real length of cable, use **Cable (1 core, with length)**, **Cable (2-core, L + N)** or **Cable (4-core, 3-phase + N)** from **Power Systems** and set the length. They heat and burn the same way.

#### Timing: real time

To show 50 Hz waveforms the simulation runs slowed down (for example 40 ms per second). Heating, breaker trips and burning do not: they follow **your clock**, so an MCB at 2.5 × its rating trips after about 20 real seconds and an overloaded cable takes minutes, like in real life. Change it in Settings → **Heating & trip timing** (10× faster, or simulation time). Short circuits are fast in both: a breaker or fuse clears them in milliseconds of circuit time.

> **Warning:** Don't want anything to burn (for example while you are still building)? Switch off Settings → **Parts burn out**. Fuses still blow and breakers still trip.

<a id="ch-scope"></a>

## 11. Oscilloscope

The oscilloscope draws voltages and currents against time, up to **6 channels** at once, each in its own colour.

#### Add a channel (probe)

- **A node voltage**: tap a wire, then tap **Scope** in the selection bar. The probe is placed at the point you tapped and measures that net against ground.
- **Voltage across a part**: select the part, tap the **scope** icon in the quick bar (or **Scope V** in the properties sheet).
- **Current through a part**: select the part and tap **Scope I** in its properties sheet.
- The scope panel opens automatically. A coloured pin on the board marks where each probe is.

Channel colours: yellow, cyan, pink, green, orange, purple. Probes are saved with the circuit.

#### Reading the display

- The screen has **10 × 8 divisions**, like a real scope. The screen **auto-scales** to a round **volts per division** (1-2-5 steps). All voltage channels share **one scale and one 0 V line**, set by the biggest signal (for example the input of a rectifier), so input and output can be compared directly. The top and bottom values of the screen are written at the right edge.
- When **voltages and currents** are shown together, currents get their own A/div but **0 V and 0 A sit on the same line**, so a voltage and its current read against one zero: volt values are written along the left edge and amp values along the right.
- The **0** tag on the left edge marks the **0 (ground) line**. When it is off the screen, the tag sits at the edge with a small arrow.
- The bottom left shows the **time per division** (for example `2 ms/div`) and the trigger state: **TRIG ↑ CH1** (picture held still), **AUTO** (waiting for a repeating signal), **ROLL** (trigger off) or **STOP** (frozen).
- Under the graph, a table gives for each channel the **latest value**, **/div**, **pp** (peak-to-peak), **rms** and the **frequency f** (found from the signal).
- **Touch and hold** the graph to show a cursor: it reads the time and every channel's value at that point. Pinch to change the time scale.

#### Scope buttons

| Button | What it does |
| --- | --- |
| +  /  − | Zoom the time axis in / out, one 1-2-5 step of time per division. You can also pinch on the scope. |
| Trigger | Off by default: the picture rolls with the newest value at the right edge. Tap it to turn it on (green): each sweep then starts on a rising edge of **CH1**, so a repeating waveform stands still instead of sliding. |
| TIME / FFT / XY | Shows the current view; tap to cycle **Time → FFT → XY → Time**. XY needs at least 2 channels. |
| DC / AC | Input coupling. **DC** (default) shows the whole signal. **AC** removes the average (DC) part, like the AC switch of a real scope, so a small ripple riding on a large DC voltage (for example a power-supply output) fills the screen. The rms column then reads **ac rms**. |
| Σ | Switches the measurement table between **basic** (now, /div, pp, rms, f) and **timing**: **mean** (average), **duty** cycle, **rise** and **fall** time (10–90 %) and **φ**, the phase of each channel relative to CH1. |
| Freeze | Stops recording so you can study the picture. Press again to continue. |
| Download | Exports the recorded data as a CSV file (time, then one column per channel). |
| Colour chip with ✕ | Tap a channel chip to remove that probe. |

#### Time, FFT and XY views

- **Time**: normal waveform view.
- **FFT** (spectrum): shows how much of each frequency is in the signal, on a log frequency axis and a 0 to −100 dB scale. Under it you see the **peak frequency** of each channel. A pure sine shows one tall peak; a square wave shows odd harmonics; a rectifier shows the ripple frequency.
- **XY**: channel 1 is drawn along X and channel 2 along Y, like a real scope in XY mode. Use it for Lissajous figures, phase comparison and I–V curves.

> **Tip:** The scope keeps the most recent 4096 points. If a signal looks too fast or too slow, change the **time scale** (+ / −) or the **simulation speed** (chapter 9).

<a id="ch-meter"></a>

## 12. Multimeter

Tap the **multimeter** icon in the top bar. A meter card appears on the board with a red (+) and a black (−) probe pin. The simulation must be running.

| Mode | How to use | It shows |
| --- | --- | --- |
| **V** | Drag the red and black probe pins onto two nodes (a terminal or a wire). The pins snap to connection points. | DC (average) voltage between the probes, plus AC RMS and the instantaneous value. |
| **Ω** | Place the probes across a part or network. The app switches off all sources and measures what is left. | Small-signal resistance (**OL** if open). |
| **A** | Select a two-terminal component. Probes are not used. | Current through it: average, RMS and instantaneous. |
| **W** | Select a two-terminal component. | Average power in it (positive = absorbing power, negative = delivering). |
| **Hz** | Place the probes like in V mode. | Frequency of the voltage between the probes (counted from its cycles). |
| **LC** | Place the probes across a capacitor or an inductor (sources switched off, measured at 1 kHz like an LCR meter). | Capacitance or inductance, with the impedance. |

In **Ω** mode a reading below about 30 Ω also shows **Continuity**, like the beeper of a real meter — handy for checking a wire or a closed switch.

The display reads smoothly (about a 0.4 s average) so numbers do not flicker. Tap **✕** on the card to close the meter.

> **Tip:** For permanent meters inside the circuit, use parts from the **Meters** category (voltmeter, ammeter, wattmeter, power-factor meter, frequency meter, kWh meter…). They stay in the circuit and are saved with it.

<a id="ch-analysis"></a>

## 13. Analysis: Bode, sweeps, harmonics, Monte Carlo, SPICE

Tap the **Analysis** icon (top bar) or use **⋮ → Operating point / SPICE netlist**. There are nine tabs. These tools solve the circuit by themselves and do not need the simulation to be running.

#### 1. AC Sweep (Bode plot)

Shows how the circuit responds to different frequencies: gain (in dB) and phase (in degrees). The input source is driven with 1 V at 0° and other sources are set to zero.

1. Place a source (voltage or current) and build your circuit. Make sure the output is **probed on the scope**: select the output wire and tap **Scope**.
2. Open **Analysis → AC Sweep**.
3. Choose the **Input source** and the **Output (scope probe)**.
4. Set **Start frequency** (default 1 Hz), **Stop frequency** (default 1 MHz) and **Points per decade** (20, 50, 100 or 200).
5. Tap **Run AC sweep**. The yellow curve is gain in dB; the cyan dashed curve is phase.
6. Touch the graph and slide your finger to read the exact frequency, gain and phase at that point.
7. Tap **CSV** to export the data.

The app marks and reports automatically: the **−3 dB** point(s) (cut-off frequency), the resonance peak **f₀**, the **bandwidth**, the **Q factor** and the **phase margin**, where they exist.

> **Tip:** Try it: open the example **RC low-pass filter**, then Analysis → AC Sweep → Run. You should see −3 dB and −45° at about 1 kHz.

#### 2. DC Sweep

Changes one value step by step and solves the circuit at each step. Use it for I–V curves of diodes, transfer curves of transistors, sensor calibration or maximum-power-point searches.

1. Add scope probes for whatever you want to measure (a node voltage, a part voltage, or a part current).
2. Open **Analysis → DC Sweep**.
3. Choose the **Component** and the **Parameter** to sweep (for example V1 → Voltage).
4. Enter **From**, **To** and **Steps** (default 100). The app fills a sensible range for you.
5. Select one or more probes under **Measure** (tap to select several).
6. Tap **Run DC sweep**. The curves are drawn; touch the graph to read values. **CSV** exports the data.

> **Tip:** Try it: open **Diode I–V characteristic** and press Run DC sweep. Or in **Solar panel with load**, sweep the load resistance and measure power to find the maximum power point.

#### 3. Operating Point

A table of every **node voltage** and, for every component, its **voltage, current and power**. If the simulation is not running, you get the **DC operating point** (capacitors treated as open, inductors as short). If it is running, you get the values at the current moment. **Refresh** re-reads; **CSV** exports.

#### 4. Harmonics

Runs the circuit for a number of cycles of the fundamental and takes the Fourier series of a probed signal: the amplitude of every harmonic as a bar chart, the **THD** (total harmonic distortion), RMS and crest factor. Choose the probe, the fundamental frequency and the number of harmonics, then tap **Analyse harmonics**. Use it for the current of a rectifier, CFL, dimmer or VFD.

#### 5. Impedance

Measures the impedance between the two terminals of a **voltage probe** versus frequency, like an impedance analyser: |Z| and its phase on a Bode-style graph, with the minimum and maximum marked. Tap **Sweep impedance**. Find resonances, the input impedance of a filter, or check a loudspeaker or motor model.

#### 6. Parametric

Runs the transient simulation once for each value of one component parameter and overlays the chosen signal — a family of curves, for example RC charging for five resistances or a motor start for several loads. Choose the component, parameter, values and run time, then tap **Run parametric sweep**.

#### 7. Monte Carlo

A production-tolerance check: every resistor, capacitor and inductor is varied at random within the tolerance you set (default ±5 % for resistors, ±10 % for capacitors and inductors; Gaussian, uniform or worst-case) and the circuit is solved for each run. A histogram, the mean, standard deviation and worst cases show how much real parts move your output. Tap **Run Monte Carlo**.

#### 8. Power

Runs the circuit and averages the power flowing into every component over the last part of the run: negative = the part supplies power, positive = it consumes it. Choose the useful load to get the **efficiency** (for example of a converter or an inverter). Tap **Measure power**.

> **Tip:** Every tab has a **CSV** button to export its results.

#### 9. SPICE Netlist

Generates a standard SPICE netlist of your schematic, with `.op` and `.tran` commands, that you can open in **ngspice** or **LTspice** to cross-check results or continue research. Buttons: **Copy**, **Save .cir**, **Share**. Parts without a SPICE equivalent (such as digital blocks) are written as comments.

<a id="ch-saving"></a>

## 14. Saving, opening and sharing

#### Automatic saving

You never need to press Save. The circuit is saved a moment after every change, when you leave the editor, and when the app goes to the background. It then appears in **My Circuits** with a thumbnail. **Continue where you left off** on Home reopens the last circuit.

#### The ⋮ More menu in the editor

| Item | What it does |
| --- | --- |
| Save to My Circuits | Saves now. |
| Save as copy | Saves a second copy named "… (copy)" so you can try changes safely. |
| Circuit name & notes | Change the name and add a note (up to 500 characters). |
| Export file (.rckt) | Saves the circuit as a file you can keep or send. |
| Open file… | Opens a `.rckt` circuit or a backup file. |
| Share circuit | Sends the circuit through any app on your phone. |
| SPICE netlist | Opens Analysis on the netlist tab. |
| Export image (PNG) | Saves a picture of the board with the circuit name and RAPTI credit, good for reports. |
| Operating point | Opens Analysis on the operating-point tab. |
| Settings | Opens Settings. |
| User manual | Opens this manual. |
| Help & gestures | Shows the short how-to card. |
| Clear circuit | Removes all parts, wires and probes after confirmation (Undo brings them back). |

#### Backup and restore

- **Backup all** (My Circuits page or Settings → Backup circuits) saves **every** project and folder in one file named `RaptiCKT_backup_<date>.json`.
- To restore, tap **Import** or **Restore backup** and choose that file. The circuits are added back to My Circuits.
- Keep a backup before you change phones, clear app data or uninstall the app. **Uninstalling the app deletes your saved circuits.**

> **Warning:** Storage is limited. If the app says "Storage is full", export some circuits as files and delete old ones.

#### Sending a circuit to a friend

1. Open the circuit (or use its **⋮** menu in My Circuits).
2. Choose **Share** and pick WhatsApp, Messenger, email or any app. Or choose **Export file** and send the `.rckt` file yourself.
3. Your friend opens the file with **Open file** (or **Import**) in RaptiCKT. It is added to their My Circuits.

<a id="ch-settings"></a>

## 15. Settings reference

Open Settings from the sliders icon on Home or from **⋮ → Settings** in the editor. Every change is saved at once.

#### Appearance

| Setting | What it does |
| --- | --- |
| Theme | **Midnight** (dark blue), **AMOLED Black** (pure black, saves battery on OLED screens) or **Blueprint Light** (for bright rooms and printing). |
| Grid | Lines, dots or none. |
| Voltage colours | Wires glow green (+) / red (−). |
| Current animation | Moving dots show current flow. |
| Animation speed | Slow, Normal, Fast, Very fast: how fast the current dots move (not the simulation). |
| Capacitor charge | ± signs on capacitor plates. |
| Animations | **Auto** (by phone speed), **Smooth** (always) or **Off** (simple and fastest). Use Off on a slow phone. |
| Value labels | Show component values (4.7 kΩ…) on the board. |
| Component names | Show R1, C1, D1… |
| Live node voltages | Voltage of every net written on its wire. |
| Live currents | Current and its direction beside each part. |
| AC readings | **RMS** (like a meter) or **Instantaneous**. |

#### Landscape & full screen

| Setting | What it does |
| --- | --- |
| Screen rotation | **Auto** (follow the phone), **Always landscape** or **Always portrait**. |
| Scope beside the circuit | On (default): in landscape the oscilloscope sits to the right of the board. Off: above it, as in portrait. |

#### Real-life limits

| Setting | What it does |
| --- | --- |
| Parts burn out | On: over-stressed parts burn out, wires catch fire, breakers can be destroyed (see chapter 10). Off: nothing burns; fuses still blow and breakers still trip. |
| Heating & trip timing | **Real time** (default): heating, breaker and relay trips and burning follow the real clock. **10× faster** for quick demonstrations. **Simulation time**: everything follows the slowed-down circuit time. |
| New wires | The cable given to wires you draw: Ideal wire, or 1–10 mm² copper PVC house wire, or a flexible cord. |

#### Simulation (for advanced users)

| Setting | What it does |
| --- | --- |
| Integration method | **Trapezoidal** (accurate, default) or **Backward Euler** (more damped, can calm a circuit that rings badly). |
| Start from DC operating point | On: the circuit starts in its settled DC state. Off: everything starts at zero, like switching on power. |
| Maximum timestep | Upper limit of the internal step (default 100 µs). |
| RELTOL | Relative tolerance, default 1e-3. |
| VNTOL | Absolute voltage tolerance, default 1 µV. |
| ABSTOL | Absolute current tolerance, default 1 nA. |
| GMIN | Tiny conductance from every node to ground that helps convergence, default 1e-12 S. |
| Newton iterations | Tries per step before the step is halved (default 60). |

These are the same defaults SPICE uses. Change them only if you know why; **Reset settings** restores everything.

#### Interaction and data

| Setting | What it does |
| --- | --- |
| Haptic feedback | Small vibrations when you add, wire, turn the knob or press a switch. |
| Sound (buzzer) | Plays a tone when a buzzer, bell or speaker is active, and a bang when a part burns out. |
| Backup circuits | Saves every circuit in one file. |
| Restore backup | Loads a backup or circuit file. |
| Reset settings | Back to defaults (your circuits are not touched). |

<a id="ch-library"></a>

## 16. Component library (all 520)

Every component in the app, grouped as in the **+** menu. For each part you see what it does and which settings you can change. Use the search box at the top of the manual to find a part quickly.

### Sources — 34

Every circuit needs a source. **DC Voltage** is a battery-like source; **AC Voltage**, **Square**, **Pulse**, **Triangle**, **Sawtooth**, **Sweep**, **Noise**, **AM/FM**, **Step**, **Exponential**, **Damped sine**, **Piecewise-linear** and **f(t)** are signal generators for testing. **AC Mains** and the **3-phase** supplies are for power and house-wiring circuits (values are RMS). **Ground**, **Protective Earth** and **Chassis Ground** are all 0 V. The controlled sources (VCVS, VCCS, CCVS, CCCS) copy a measurement from one pair of terminals to another.

| | |
| --- | --- |
| **DC Voltage** | Ideal voltage source. Terminal marked + is the positive side. Optional internal resistance. <br>*Settings:* Voltage (V), Internal resistance (Ω), Waveform |
| **AC Voltage** | Sinusoidal voltage source v = Voff + A·sin(2πft + φ). <br>*Settings:* Amplitude (peak) (V), Frequency (Hz), DC offset (V), Phase (°), Internal resistance (Ω), Waveform |
| **AC Mains (1-phase)** | Single-phase mains supply between L (left) and N (right). The value is RMS (peak = √2·Vrms). Neutral is bonded to earth at the source, so earth faults return through ground — needed for RCD/RCCB tests. <br>*Settings:* Standard, Voltage (RMS) (V), Frequency (Hz), Source impedance (Ω), Neutral earthed at source (TN) |
| **3-Phase Supply (4-wire)** | Balanced star-connected three-phase supply: phases R, Y, B and neutral N. Phase voltage = V_line/√3, displaced by 120°. <br>*Settings:* Line voltage (RMS) (V), Frequency (Hz), Source impedance per phase (Ω), Phase sequence, Neutral earthed |
| **3-Phase Supply (3-wire)** | Balanced three-phase supply without neutral (R, Y, B). Line voltages are 120° apart; use it for delta loads and motors. <br>*Settings:* Line voltage (RMS) (V), Frequency (Hz), Source impedance per phase (Ω), Phase sequence |
| **Voltage Rail** | Single-terminal source referenced to ground (e.g. +5 V supply rail). <br>*Settings:* Voltage (V), Waveform, Frequency (Hz), DC offset (V), Duty cycle (%), Phase (°) |
| **Ground** | Reference node (0 V). All voltages are measured relative to ground. |
| **Protective Earth** | Protective earth (PE). Electrically the same reference as ground (0 V). |
| **Chassis Ground** | Chassis / frame connection. Electrically the same reference as ground (0 V). |
| **Net Label** | Connects every point carrying the same net name, as if a wire joined them — keeps large drawings tidy (e.g. label a 5 V rail “VCC” in several places). Names are case-sensitive. <br>*Settings:* Net name |
| **Bench Power Supply (CV/CC)** | Laboratory supply: constant voltage until the load demands more than the current limit, then constant current (smooth CV→CC crossover). <br>*Settings:* Voltage set (V), Current limit (A), Output resistance (CV) (Ω) |
| **Dual Supply ±V** | Split supply: +V between + and COM, −V between COM and −. Typical for op-amp circuits. <br>*Settings:* Voltage (each rail) (V), Internal resistance (Ω) |
| **Solar Panel (PV Module)** | 36-cell photovoltaic module (≈22 V open circuit, 5.8 A short circuit at 1000 W/m²). Single-diode model; power peaks at the maximum power point (~17.5 V). <br>*Settings:* Irradiance (W/m²), Isc @1000 W/m² (A), Voc (per cell) (V), Cells in series |
| **DC Current** | Ideal current source. Current flows in the direction of the arrow. <br>*Settings:* Current (A), Waveform |
| **AC Current** | Ideal current source. Current flows in the direction of the arrow. <br>*Settings:* Amplitude (peak) (A), Frequency (Hz), DC offset (A), Phase (°), Waveform |
| **Square Wave** | Ideal voltage source. Terminal marked + is the positive side. Optional internal resistance. <br>*Settings:* Amplitude (peak) (V), Frequency (Hz), DC offset (V), Phase (°), Duty cycle (%), Internal resistance (Ω), Waveform |
| **Pulse / PWM** | Ideal voltage source. Terminal marked + is the positive side. Optional internal resistance. <br>*Settings:* Amplitude (peak) (V), Frequency (Hz), DC offset (V), Phase (°), Duty cycle (%), Internal resistance (Ω), Waveform |
| **PWM Generator** | Rectangular PWM signal with the duty cycle on the knob — for driving MOSFET/IGBT gates, motors and LEDs. <br>*Settings:* Duty cycle (%), Frequency (Hz), High level (V), Low level (V), Internal resistance (Ω) |
| **Triangle Wave** | Ideal voltage source. Terminal marked + is the positive side. Optional internal resistance. <br>*Settings:* Amplitude (peak) (V), Frequency (Hz), DC offset (V), Phase (°), Internal resistance (Ω), Waveform |
| **Sawtooth** | Ideal voltage source. Terminal marked + is the positive side. Optional internal resistance. <br>*Settings:* Amplitude (peak) (V), Frequency (Hz), DC offset (V), Phase (°), Internal resistance (Ω), Waveform |
| **Sweep (Chirp)** | Logarithmic frequency sweep – ideal for looking at filter responses on the oscilloscope. <br>*Settings:* Amplitude (peak) (V), Start frequency (Hz), Stop frequency (Hz), Sweep time (s), DC offset (V), Internal resistance (Ω), Waveform |
| **Noise** | Gaussian white noise (bandwidth set by the timestep). <br>*Settings:* Amplitude (peak) (V), Frequency (Hz), DC offset (V), Internal resistance (Ω), Waveform |
| **AM Signal Generator** | Amplitude modulation: v = A·(1 + m·sin 2πfm·t)·sin 2πfc·t. <br>*Settings:* Carrier amplitude (V), Carrier frequency (Hz), Modulating frequency (Hz), Modulation index, Internal resistance (Ω) |
| **FM Signal Generator** | Frequency modulation: v = A·sin(2πfc·t + (Δf/fm)·sin 2πfm·t). <br>*Settings:* Amplitude (V), Carrier frequency (Hz), Modulating frequency (Hz), Frequency deviation (Hz), Internal resistance (Ω) |
| **Step Source** | Step input V0 → V1 at t0 with a linear rise time — for step-response measurements. <br>*Settings:* Final value (V), Initial value (V), Step time (s), Rise time (s), Internal resistance (Ω) |
| **Exponential Source** | SPICE EXP source: exponential rise from V1 towards V2 after td1, then exponential fall back after td2. <br>*Settings:* Pulsed value (V), Initial value (V), Rise delay (s), Rise time constant (s), Fall delay (s), Fall time constant (s), Internal resistance (Ω) |
| **Damped Sine** | v = Voff + A·e^(−α(t−td))·sin(2πf(t−td)) for t > td (SPICE SIN with damping). <br>*Settings:* Amplitude (V), Frequency (Hz), Damping factor α (1/s), Delay (s), DC offset (V), Internal resistance (Ω) |
| **Piecewise-Linear Source** | Voltage defined by (time, value) pairs with linear interpolation, optionally repeating. SI suffixes allowed: "0 0; 1m 5; 2m 0". <br>*Settings:* Points "t v; t v; …", Repeat, Scale (×), Internal resistance (Ω) |
| **Ramp Source** | Linear ramp from the initial to the final value over the ramp time (after the start delay), then holds — or repeats as a sawtooth. Use it for soft-start tests and to sweep a circuit slowly. <br>*Settings:* Final value (V), Initial value (V), Start delay (s), Ramp time (s), Repeat (sawtooth) |
| **Function Source f(t)** | Voltage given by a formula of time t (and the knob parameter k). Functions: sin cos tan exp ln log10 sqrt abs min max pow floor sign step square tri if(c,a,b); constants pi, e; SI suffixes (1k, 2m). <br>*Settings:* v(t) =, Parameter k (use as k), Internal resistance (Ω) |
| **VCVS** | Voltage-controlled voltage source: Vout = gain · Vin (left pair controls right pair). <br>*Settings:* Gain (V/V) |
| **VCCS** | Voltage-controlled current source: Iout = gm · Vin, flowing through the source from + to −. <br>*Settings:* Transconductance (S) |
| **CCVS** | Current-controlled voltage source: Vout = r · Iin, where Iin flows through the left terminals (0 V sense). <br>*Settings:* Transresistance (Ω) |
| **CCCS** | Current-controlled current source: Iout = β · Iin, where Iin flows through the left terminals. <br>*Settings:* Current gain (A/A) |

### Batteries — 16

Each battery has a **state of charge** (%), a capacity (Ah) and an internal resistance. Its voltage falls as it discharges and a heavy load makes it sag. Current flowing into the + terminal charges it.

| | |
| --- | --- |
| **AA Cell 1.5 V** | Alkaline AA cell: 1.58 V fresh, falling to 0.9 V at end of life; about 0.15 Ω internal resistance. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **9 V Battery** | Battery: open-circuit voltage follows the state of charge (chemistry curve), with internal resistance. Charge is integrated while simulating: I·t / capacity. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **Coin Cell CR2032** | CR2032 lithium coin cell: 3 V nominal, high internal resistance (≈15 Ω), so it cannot deliver large currents. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **NiMH Cell 1.2 V** | Battery: open-circuit voltage follows the state of charge (chemistry curve), with internal resistance. Charge is integrated while simulating: I·t / capacity. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **NiCd Cell 1.2 V** | Nickel-cadmium cell: 1.2 V nominal, very low internal resistance and robust — used in emergency lights and power tools. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **Li-ion Cell 3.7 V** | Li-ion 18650 cell: 4.2 V full, 3.7 V nominal, 3.0 V empty. Charging (current into +) raises the state of charge. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **Li-Po Pack 2S 7.4 V** | Battery: open-circuit voltage follows the state of charge (chemistry curve), with internal resistance. Charge is integrated while simulating: I·t / capacity. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **LiFePO₄ Cell 3.2 V** | Lithium-iron-phosphate cell: very flat 3.2–3.3 V plateau over most of the charge (hard to judge SoC from voltage), 3.6 V when full, 2.5 V empty. Safe chemistry with a long cycle life. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **LiFePO₄ Battery 12.8 V (4S)** | Four LiFePO₄ cells in series (12.8 V nominal, 14.4 V charged): the drop-in replacement for a 12 V lead-acid battery in solar systems. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **Lead-Acid Battery 12 V** | 12 V lead-acid (6 cells): 12.7 V full, about 11.6 V discharged. Very low internal resistance, so it can supply high currents. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **AGM Battery 12 V** | Absorbed-glass-mat (VRLA) lead-acid battery: sealed, very low internal resistance (high surge current) — UPS and solar banks. Charge at 14.4 V absorption / 13.6 V float. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **Gel Battery 12 V** | Gel-electrolyte lead-acid battery: deep-cycle, tolerant of heat, with a higher internal resistance than AGM. Charge at 14.1 V absorption / 13.5 V float. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **Battery Pack (configurable S/P)** | Battery pack of S cells in series and P in parallel: voltage = S × cell voltage (state-of-charge curve of the chosen chemistry), capacity = P × cell capacity, internal resistance = S/P × cell resistance. E.g. 13S4P Li-ion = 48 V e-bike pack. <br>*Settings:* State of charge (%), Chemistry, Cells in series (S), Cells in parallel (P), Cell capacity (Ah), Cell internal resistance (Ω) |
| **Supercapacitor** | Electric double-layer capacitor: large C with series ESR and self-discharge (leakage) resistance. <br>*Settings:* Capacitance (F), ESR (Ω), Leakage resistance (Ω), Rated voltage (V) |
| **Battery Protection Board (BMS)** | Li-ion protection board (DW01 + dual MOSFET style). B+/B− go to the cells, P+/P− to the load or charger. Two back-to-back MOSFETs in the negative lead: the discharge FET opens on over-discharge (released only when a charger is connected and the cell recovers) or over-current (released when the load is removed); the charge FET opens on over-charge. Each FET’s body diode still lets current flow the other way, so a cut-off pack can always be charged and an over-charged pack can still be discharged. <br>*Settings:* Cells in series, Over-charge cut-off (per cell) (V), Over-charge release (V), Over-discharge cut-off (per cell) (V), Over-discharge release (charger connected) (V), Over-current trip (A), MOSFET on-resistance (each) (Ω) |
| **CC-CV Battery Charger** | Lithium/lead-acid charger IC: below the pre-charge threshold it trickles at 10 % of the set current; then constant current until the battery reaches the CV voltage; then holds that voltage while the current tapers; charging terminates when the current falls below the termination level and restarts when the battery drops below the recharge threshold. The linear type draws the same current from VIN as it delivers (TP4056); the switching type draws P/η. <br>*Settings:* Battery type, Charge current (CC) (A), Charge voltage (CV) (V), Termination current (% of CC), Pre-charge below (V), Recharge below (V), Type, Efficiency (switching) |

### Renewables — 7

Solar panels and arrays, MPPT and PWM charge controllers, off-grid and grid-tie inverters, a wind turbine and a fuel cell. They follow the real curves (the panel's I–V curve with irradiance and temperature, the turbine's power coefficient), so you can size a solar home system or watch an MPPT controller track the maximum power point. Turn the **irradiance** or **wind** knob while running.

| | |
| --- | --- |
| **Solar PV Array** | Array of identical PV modules (default 60-cell ≈300 W, Voc ≈40 V, Isc 9.8 A): strings of Ns modules in series, Np strings in parallel. Voc falls ≈0.33 %/°C and Isc rises 0.05 %/°C with cell temperature. The maximum power point sits near 80 % of Voc. <br>*Settings:* Irradiance (W/m²), Cell temperature (°C), Modules in series (per string), Parallel strings, Module Isc @STC (A), Voc per cell @STC (V), Cells per module |
| **MPPT Solar Charge Controller** | Buck-type MPPT charge controller: it measures the panel’s open-circuit voltage, then perturbs the panel operating voltage and observes the power (P&O) to sit at the maximum power point, delivering that power (× efficiency) to the battery as current — more current than the panel itself supplies when the panel voltage is higher. When the battery reaches the absorption voltage or the current limit it moves off the MPP to limit power. LOAD output with low-voltage disconnect. <br>*Settings:* Absorption (charge) voltage (V), Load disconnect below (V), Load reconnect above (V), Maximum charge current (A), Efficiency, Tracking interval (s), Perturbation step (V) |
| **PWM Solar Charge Controller** | Simple series (PWM) solar charge controller: a switch connects the panel straight to the battery (with reverse-current blocking at night), so the panel works at the battery voltage — not at its maximum power point. At the absorption voltage it starts pulsing the switch to hold the battery there. LOAD output with low-voltage disconnect. <br>*Settings:* Absorption (charge) voltage (V), Load disconnect below (V), Load reconnect above (V) |
| **Off-Grid Inverter (battery → AC)** | Pure-sine inverter (averaged): makes isolated AC from a battery. The battery current follows the instantaneous output power ÷ efficiency (plus ≈1 % idle), so it pulses at twice the line frequency. Shuts down below the cut-off voltage and restarts above the restart voltage; trips on overload (> 150 % rated for 0.5 s) and retries after 5 s. <br>*Settings:* Output voltage (RMS) (V), Frequency (Hz), Rated power (W), Low-battery cut-off (V), Restart above (V), Efficiency, Output resistance (Ω) |
| **Grid-Tie Solar Inverter** | Grid-connected PV inverter (averaged): tracks the array’s maximum power point (P&O on the DC voltage) and injects that power into the grid as a sinusoidal current in phase with the grid voltage (unity power factor), synchronised from the zero crossings. Anti-islanding: it only connects after the grid has been within 85–110 % voltage and 47.5–52 Hz for the set delay, and stops immediately when the grid goes outside that window or disappears. <br>*Settings:* Rated AC power (W), Grid voltage (nominal) (V), Efficiency, Grid-OK delay before connecting (s), MPPT interval (s), MPPT step (V) |
| **Wind Turbine Generator** | Small wind turbine with a permanent-magnet generator and built-in rectifier (DC output). Aerodynamic power P = ½ρπR²v³·Cp(λ), with the power coefficient Cp peaking at ≈0.48 near tip-speed ratio λ = ωR/v ≈ 8; the generator EMF is Ke·ω and the rectifier only lets current flow out of +. Above rated power the blades stall/furl to hold the rated power; above the cut-out speed the rotor is braked. Load it with a battery to see the operating point settle. <br>*Settings:* Wind speed (m/s), Rotor radius (m), Rated power (W), Generator EMF constant (rectified) (V·s/rad), Generator + rectifier resistance (Ω), Rotor inertia (kg·m²), Cut-out wind speed (m/s) |
| **Fuel Cell Stack (PEM)** | PEM fuel-cell stack: each cell gives ≈1 V open circuit, then the voltage falls with current through activation losses (logarithmic), ohmic losses (linear) and concentration losses that collapse the voltage near the limiting current — the classic polarisation curve. Hydrogen use = N·I / 2F; efficiency ≈ Vcell / 1.25 V (LHV). <br>*Settings:* Cells in series, Open-circuit voltage per cell (V), Activation (Tafel) slope (V), Activation current scale (A), Ohmic resistance per cell (Ω), Limiting current (A) |

### Passive — 25

Resistors, capacitors and inductors, plus variable and real-world versions. The knob changes the main value. Polarised capacitors (electrolytic, tantalum, supercapacitor) must be connected the right way round.

| | |
| --- | --- |
| **Resistor** | Linear resistor obeying Ohm's law V = I·R. Give it a power rating and it overheats above it and burns open at about 2.5 × its rating (real resistors fail open). <br>*Settings:* Resistance (Ω), Symbol, Power rating |
| **Shunt / Current-Sense Resistor** | Four-terminal (Kelvin) shunt: the load current flows I+ → I−, the voltage is read between the sense terminals S+ and S−. The sense taps sit on the resistive element itself, so contact and lead resistance in the current path does not add to the reading: I = V(S+,S−) / R. <br>*Settings:* Shunt resistance (Ω), Force lead / contact resistance (each) (Ω), Power rating (W) |
| **Fusible Resistor** | Resistor that also acts as a fuse: it works as a normal resistor up to its rating, but if the dissipation stays far above it (default 10×) it burns open safely instead of catching fire. Tap a blown one to replace it. <br>*Settings:* Resistance (Ω), Power rating (W), Fuses at (× rating), Thermal time constant (s) |
| **Rheostat (Variable Resistor)** | Two-terminal variable resistor: R = setting × Rmax. Adjust live with the knob (e.g. field rheostat, current limiting). <br>*Settings:* Setting (%), Maximum resistance (Ω), Power rating (W) |
| **Potentiometer** | Three-terminal variable resistor. Adjust the wiper with the knob while simulating. <br>*Settings:* Wiper position (%), Total resistance (Ω), Taper, Power rating (W) |
| **Trimmer Potentiometer** | Preset (trimmer) potentiometer for calibration. Same model as a potentiometer. <br>*Settings:* Wiper position (%), Total resistance (Ω), Taper, Power rating (W) |
| **Capacitor** | Ideal capacitor: i = C·dv/dt. Plates show accumulated charge while simulating. <br>*Settings:* Capacitance (F), Initial voltage (V) |
| **Electrolytic Cap** | Polarised capacitor. Flashes red when reverse-biased or over its rated voltage; kept there (over 1.2 × its rated voltage or more than 1.5 V reversed) it overheats and bursts open. Select it and tap Replace after that. <br>*Settings:* Capacitance (F), Initial voltage (V), Rated voltage (V) |
| **Non-Polar Electrolytic** | Bipolar (non-polarised) electrolytic / motor-run capacitor: can see AC. Typical fan capacitor 2.5 µF. <br>*Settings:* Capacitance (F), Initial voltage (V), Rated voltage (AC RMS) (V) |
| **Tantalum Capacitor** | Polarised tantalum capacitor: small, low ESR. Flashes red if reverse biased or over-voltage — and if kept there it fails SHORT (and may catch fire), as real tantalums do. <br>*Settings:* Capacitance (F), Initial voltage (V), Rated voltage (V) |
| **Variable Capacitor** | Tuning capacitor: C varies from Cmin to Cmax with the setting (e.g. 10–365 pF radio gang). <br>*Settings:* Setting (%), Minimum capacitance (F), Maximum capacitance (F) |
| **Capacitor (ESR, ESL, leakage)** | Capacitor with parasitics: ESR and ESL in series, leakage in parallel. Above its self-resonant frequency f = 1/(2π√(ESL·C)) it behaves like an inductor — see it in a Bode plot. <br>*Settings:* Capacitance (F), ESR (Ω), ESL (H), Leakage resistance (Ω) |
| **Ceramic Capacitor (MLCC)** | Multilayer ceramic capacitor: very low ESR (≈10 mΩ) and ESL (≈0.5 nH), so it is the best decoupling capacitor at high frequency. X7R/Y5V types lose capacitance with DC bias; C0G/NP0 types are stable. <br>*Settings:* Capacitance (F), ESR (Ω), ESL (H), Leakage resistance (Ω), Voltage rating (V) |
| **Film Capacitor** | Metallised-film capacitor: low loss, self-healing, high voltage and very low leakage — used for snubbers, DC links, motor-run and audio coupling. <br>*Settings:* Capacitance (F), ESR (Ω), ESL (H), Leakage resistance (Ω), Voltage rating (V) |
| **Polyester (PET) Capacitor** | Polyester (PET, “Mylar”) film capacitor: small and cheap, good for general coupling, bypass and timing; a little more loss (tan δ ≈ 0.5 %) than polypropylene. <br>*Settings:* Capacitance (F), ESR (Ω), ESL (H), Leakage resistance (Ω), Voltage rating (V) |
| **Polypropylene (PP) Capacitor** | Polypropylene film capacitor (MKP): the lowest dielectric loss (tan δ ≈ 0.02 %) — used in resonant converters, snubbers, X2 mains filters and precision timing. <br>*Settings:* Capacitance (F), ESR (Ω), ESL (H), Leakage resistance (Ω), Voltage rating (V) |
| **Silver-Mica Capacitor** | Silver-mica capacitor: picofarad values with excellent stability and very high Q — used in RF oscillators and filters. <br>*Settings:* Capacitance (F), ESR (Ω), ESL (H), Leakage resistance (Ω), Voltage rating (V) |
| **Inductor** | Ideal inductor v = L·di/dt with optional winding resistance. <br>*Settings:* Inductance (H), Series resistance (Ω), Initial current (A) |
| **Variable Inductor** | Slug-tuned inductor: L = setting × Lmax (minimum 1 % of Lmax). <br>*Settings:* Setting (%), Maximum inductance (H), Series resistance (Ω) |
| **Iron-Core Inductor (saturating)** | Nonlinear inductor: ψ(i) = Lsat·i + (L0 − Lsat)·Isat·tanh(i/Isat). Above Isat the core saturates and the current peaks sharply — see inrush and distorted magnetising current. <br>*Settings:* Unsaturated inductance (H), Saturation current (A), Saturated inductance (H), Winding resistance (Ω) |
| **Ferrite Bead** | Ferrite bead: nearly a short at DC and low frequency, lossy (resistive) at high frequency — model Rdc + (L ∥ R). <br>*Settings:* Impedance at 100 MHz (Ω), DC resistance (Ω) |
| **Quartz Crystal** | Butterworth–Van Dyke model: series Rm–Lm–Cm (Lm = 1/((2πf)²·Cm)) in parallel with C0. Extremely high Q; series and parallel resonances are visible in a Bode plot. <br>*Settings:* Frequency, Series resonance (Hz), Motional resistance Rm (Ω), Motional capacitance Cm (F), Shunt capacitance C0 (F) |
| **Ceramic Resonator** | Piezo-ceramic resonator: same Butterworth–Van Dyke model as a crystal but with a much lower Q (≈1000 instead of ≈100 000), so it starts faster and is cheaper but only about ±0.5 % accurate — used as microcontroller and IF-filter clock. <br>*Settings:* Frequency, Series resonance (Hz), Motional resistance Rm (Ω), Motional capacitance Cm (F), Shunt capacitance C0 (F) |
| **Transmission Line (lossless)** | Ideal lossless line (Branin method of characteristics). Port 1 on the left, port 2 on the right, returns at the bottom. Mismatched terminations produce reflections after 2·Td. <br>*Settings:* Characteristic impedance Z0 (Ω), Delay Td (s) |
| **Memristor (HP model)** | HP TiO₂ memristor (Strukov 2008) with a Joglekar window: R = Ron·w + Roff·(1 − w), dw/dt = k·i·(1 − (2w − 1)^(2p)). A sine drive gives the pinched I–V hysteresis loop. <br>*Settings:* R_on (Ω), R_off (Ω), Mobility factor µv·Ron/D² (1/C), Initial state w0, Joglekar window exponent p |

### Transformers — 11

Coupled-coil models with a turns ratio. Use them for isolation and for stepping voltage up or down. The 3-phase transformers have standard vector groups (Dyn11, Yyn0, Yd1, Dd0). CT and PT are instrument transformers for metering.

| | |
| --- | --- |
| **Transformer** | Two coupled windings. L2 = L1·n², M = k·√(L1·L2). Dots mark in-phase terminals. <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω), Rated primary voltage (RMS) (V), Rated power (VA) |
| **Step-Down Transformer** | Mains step-down transformer, 230 V → 12 V (turns ratio 12/230). <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω), Rated primary voltage (RMS) (V), Rated power (VA) |
| **Step-Up Transformer** | Step-up transformer, turns ratio 1:10. <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω), Rated primary voltage (RMS) (V), Rated power (VA) |
| **Isolation Transformer 1:1** | 1:1 transformer: same voltage, but the secondary is galvanically isolated from the mains and earth. <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω), Rated primary voltage (RMS) (V), Rated power (VA) |
| **Centre-Tap Transformer** | Transformer with a centre-tapped secondary (e.g. 230 V → 12-0-12 V). Terminals: primary (left), secondary top / CT / bottom (right). <br>*Settings:* Primary voltage (RMS) (V), Secondary voltage, each half (RMS) (V), Magnetising inductance (H), Coupling k, Primary resistance (Ω), Secondary resistance (each half) (Ω), Rated power (VA) |
| **Dual-Secondary Transformer** | One primary and two electrically isolated secondaries on the same core. <br>*Settings:* Primary voltage (RMS) (V), Secondary 1 voltage (RMS) (V), Secondary 2 voltage (RMS) (V), Magnetising inductance (H), Coupling k, Primary resistance (Ω), Secondary resistance (Ω), Rated power (VA) |
| **Autotransformer / Variac** | Single tapped winding (variac): input across top–common, output from the sliding tap to common. Vout ≈ tap % × Vin with no isolation. <br>*Settings:* Output (tap position) (%), Winding inductance (H), Coupling k, Winding resistance (Ω), Rated primary voltage (RMS) (V), Rated power (VA) |
| **Current Transformer (CT)** | Current transformer, 1 : 100 turns (e.g. 100 A / 1 A). Put the primary in series with the line and connect an ammeter or burden across the secondary — never leave a loaded CT secondary open. <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω) |
| **Potential Transformer (PT)** | Voltage (potential) transformer, 11 kV → 110 V, for measuring high voltages with a standard voltmeter. <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω) |
| **3-Phase Transformer** | Three single-phase windings pairs (one per limb) connected per the vector group. Primary A, B, C on the left; secondary a, b, c and neutral n on the right. Dyn11: secondary leads primary by 30°. <br>*Settings:* Vector group, Primary line voltage (V), Secondary line voltage (V), Magnetising inductance (per phase, primary) (H), Coupling k, Primary winding resistance (Ω), Secondary winding resistance (Ω), Rated power (VA) |
| **Coupled Inductors (M)** | Two inductors with mutual inductance M = k·√(L1·L2) (dots mark the in-phase ends). Loosely coupled coils, wireless power, tuned transformers. <br>*Settings:* L1 (H), L2 (H), Coupling coefficient k, R1 (Ω), R2 (Ω) |

### Protection — 24

Fuses, breakers, residual-current devices, surge protectors and relays. They really **trip** in the simulation (an MCB follows its B/C/D curve, an RCCB trips on leakage current). After a trip the part shows **TRIPPED** with the cause. Tap it once to reset.

| | |
| --- | --- |
| **Fuse** | Blows (opens) when the let-through energy ∫(i² − I²rated)dt exceeds I²t. A blown fuse stays blown — select it and tap Replace to put in a new one. <br>*Settings:* Current rating (A), Resistance (Ω), Melting I²t (A²s) |
| **HRC Fuse** | High-rupturing-capacity cartridge fuse for power circuits. Melts when ∫(i² − I²rated)dt exceeds its I²t. <br>*Settings:* Current rating (A), Resistance (Ω), Melting I²t (A²s) |
| **Thermal Fuse (TCO)** | One-shot thermal cut-off: conducts (≈5 mΩ) until its body reaches the rated temperature, then opens permanently — the last line of defence in kettles, irons and motors. Tap to replace it after it has opened. <br>*Settings:* Body temperature (°C), Rated functioning temperature (°C) |
| **Resettable Fuse (PTC)** | Polymer PTC fuse: self-heating raises its resistance by orders of magnitude above the trip current (≈2·Ihold); it resets once the fault is removed and it cools. <br>*Settings:* Hold current (A), Cold resistance (Ω), Thermal time constant (s), Maximum voltage (V) |
| **MCB (1-pole)** | Miniature circuit breaker (IEC 60898): thermal trip for overloads (runs in real time: about 20 s at 2.5 × In), magnetic (instantaneous) trip for short circuits. A fault current above its breaking capacity Icn destroys it. Tap to switch ON/OFF or to reset after a trip. <br>*Settings:* Rated current In (A), Trip curve, Breaking capacity Icn (A), Switched on |
| **MCB (2-pole)** | Double-pole MCB: both poles open together when either one trips. <br>*Settings:* Rated current In (A), Trip curve, Breaking capacity Icn (A), Switched on |
| **MCB (3-pole)** | Triple-pole MCB for three-phase circuits: all poles open together. <br>*Settings:* Rated current In (A), Trip curve, Breaking capacity Icn (A), Switched on |
| **MCCB (3-pole, adjustable)** | Moulded-case circuit breaker with adjustable thermal (Ir) and magnetic (Im) settings. <br>*Settings:* Rated current In (A), Thermal setting Ir/In, Magnetic setting Im/Ir, Breaking capacity Icn (A), Switched on |
| **ACB (air circuit breaker, LSI)** | Air circuit breaker with an electronic LSI trip unit, used as the main incomer of LV switchboards: L — long-time (overload, inverse-time, trips in tr seconds at 6×Ir), S — short-time (fault current above Isd held for tsd, so downstream breakers can clear first: selectivity), I — instantaneous above Ii×In. Tap to switch / reset. <br>*Settings:* Frame rating In (A), Long-time pickup Ir/In, Long-time delay (at 6 Ir) (s), Short-time pickup Isd/Ir, Short-time delay (s), Instantaneous Ii/In, Switched on |
| **RCCB / RCD (2-pole)** | Residual-current device: trips when the current going out on L does not return on N (leakage to earth ≥ IΔn, e.g. 30 mA through a person). No overcurrent protection: a sustained overload above In burns it out, so always put an MCB before it. <br>*Settings:* Rated current In (A), Rated residual current IΔn (A), Switched on |
| **RCBO (2-pole)** | RCBO = RCD + MCB: trips on earth leakage (≥ IΔn) and on overload / short circuit. <br>*Settings:* Rated current In (A), Trip curve, Rated residual current IΔn (A), Breaking capacity Icn (A), Switched on |
| **Thermal Overload Relay** | Motor overload relay (IEC 60947-4-1, class 10): the heater carries the motor current; when it trips, the NC control contact (95–96) opens. Tap to reset. <br>*Settings:* Current setting Ir (A) |
| **Thermal Overload Relay (3-pole)** | Three-pole motor overload relay (class 10, IEC 60947-4-1): the three heaters 1–2, 3–4, 5–6 carry the motor currents. On overload — or faster on a lost phase (single phasing) — it trips: the NC contact 95–96 opens (put it in the contactor coil circuit) and the NO contact 97–98 closes (alarm lamp). Tap to reset. <br>*Settings:* Current setting Ir (A) |
| **Phase Failure / Sequence Relay** | Monitors a 3-phase supply (L1, L2, L3 against N): when all phases are present, in the correct sequence (L1→L2→L3) and balanced, its relay is energised (11–14 closed, 11–12 open). On phase loss, low voltage, reversed sequence or unbalance it releases after the delay — put 11–14 in series with the motor contactor coil. <br>*Settings:* Minimum phase voltage (RMS) (V), Maximum unbalance (%), Trip delay (s) |
| **Over / Under-Voltage Relay** | Voltage monitoring relay: energised (11–14 closed) while the RMS voltage between L and N stays between the under- and over-voltage limits; outside them for longer than the delay it releases (11–12 closed) to disconnect sensitive loads. Works on AC (RMS) and DC. <br>*Settings:* Under-voltage trip (RMS) (V), Over-voltage trip (RMS) (V), Trip delay (s) |
| **IDMT Overcurrent Relay** | IEC 60255 inverse-time overcurrent relay (ANSI 51/50). The current coil (left) is fed from a CT secondary; after t = TMS·k/((I/Is)^α − 1) the trip contact (right, NO) closes and latches. Tap to reset. <br>*Settings:* Plug setting (pickup) Is (A), Time multiplier TMS, Curve, Instantaneous element (× Is, 0 = off) |
| **Varistor (MOV)** | Metal-oxide varistor: I ≈ 1 mA·(V/V1mA)^α (exponential approximation). Nearly open at normal voltage, clamps surges. 430 V type suits 230 V mains. <br>*Settings:* Varistor voltage (at 1 mA) (V), Nonlinearity exponent α |
| **Surge / Lightning Arrester** | Metal-oxide surge arrester for power lines (e.g. 11 kV system): conducts heavily above its reference voltage and diverts surges to earth. <br>*Settings:* Varistor voltage (at 1 mA) (V), Nonlinearity exponent α |
| **Gas Discharge Tube** | Gas discharge tube: open until the voltage exceeds the spark-over value, then an arc (≈15 V) conducts until the current falls below the extinction current. <br>*Settings:* Spark-over voltage (V), Arc voltage (V), Extinction current (A) |
| **TVS Diode** | Unidirectional transient-voltage-suppression diode: clamps at its breakdown voltage in reverse, conducts like a diode forward. <br>*Settings:* Model, Breakdown voltage (V) |
| **TVS Diode (bidirectional)** | Bidirectional TVS: two junctions back to back; clamps at about ±V in either polarity. <br>*Settings:* Clamping voltage (V) |
| **Overload Relay Heaters (ladder)** | The three heaters (1–2, 3–4, 5–6) of a thermal overload relay, for the power circuit of a ladder diagram. Its contacts are drawn in the control ladder with the same tag: an NC Contact (95-96) in series with the coil drops the contactor on overload or phase loss, an NO Contact (97-98) lights a TRIP lamp. Tap it once to TEST (trip it by hand), tap again to RESET. <br>*Settings:* Tag (contacts with this tag follow it), Current setting Ir (A) |
| **Phase Monitor (ladder)** | The sensing part of a phase-failure / sequence relay (L1, L2, L3, N). While all phases are present, in sequence and balanced, it is operated: its NO Contact (11-14) with the same tag closes in the control ladder. On phase loss, under-voltage, wrong sequence or unbalance it releases after the delay. <br>*Settings:* Tag (contacts with this tag follow it), Minimum phase voltage (RMS) (V), Maximum unbalance (%), Trip delay (s) |
| **MPCB (ladder)** | Motor protection circuit breaker: a 3-pole switch with a thermal overload release (set to the motor full-load current, Ir) and a magnetic short-circuit release (about 13 × Ir, instant). Tap it to switch OFF / ON; after a trip, tap to reset. Its auxiliary NO Contact (13-14) with the same tag is closed while the breaker is ON — put it in the control circuit. <br>*Settings:* Tag (contacts with this tag follow it), Current setting Ir (A), Switched ON |

### Switches & Relays — 52

Tap a switch to toggle it while the circuit runs. Push buttons act only while held. Relays, contactors (with main poles and auxiliary 13-14 / 21-22 contacts), latching and timer relays, the 3-pole overload relay and phase / voltage monitoring relays have a **coil** or sensing side and a **contact** side: when the coil is energised the contacts move. To draw a control circuit as a **ladder diagram** (like a textbook), use the ladder parts: put a **Contactor Coil** or **Timer Coil** in a rung and give it a tag such as `KF`; every **NO Contact**, **NC Contact** and **Main Contacts 3-pole** part with the same tag then follows that coil (a new contact takes the tag of the last coil already in the circuit, and the coils that exist are shown as buttons under its *Follows* field — tap one to link it; while running, a contact whose tag matches no coil shows its tag in amber with a ?), and **Overload Relay Heaters** / **Phase Monitor** work the same way for their 95-96, 97-98 and 11-14 contacts. More ladder parts: **Counter Coil** + **Counter Reset Coil** (preset counter), **Floatless Level Relay** watching a **Water Tank**, **Limit Switch NO / NC** operated by a **Carriage / Cylinder** that the coils drive, and the **MPCB**. Every example in *Industrial Control (Ladder)* is drawn this way — open them from Examples.

| | |
| --- | --- |
| **Switch (SPST)** | Single-pole single-throw switch. Tap it to open/close — even while the simulation runs. <br>*Settings:* Closed, On resistance (Ω), Contact rating (A) |
| **Toggle Switch (SPDT)** | Lever (bat-handle) toggle switch, single-pole changeover: COM connects to A or B. Tap to flip. <br>*Settings:* Position B, Contact rating (A) |
| **Slide Switch (SPDT)** | Miniature slide switch, single-pole changeover (COM to A or B). Tap to slide it. <br>*Settings:* Position B, Contact rating (A) |
| **Illuminated Rocker Switch** | Mains rocker switch with a built-in indicator lamp: L-IN → L-OUT is switched, and the lamp (between L-OUT and N) glows while the output is live. Tap to switch. <br>*Settings:* On, Indicator lamp resistance (Ω), Contact rating (A) |
| **Key Switch** | Lock-operated on/off switch for panels and machines: only someone with the key can turn it on. Tap to turn the key. <br>*Settings:* On, Contact rating (A) |
| **One-Way Switch** | Household one-way (single-pole) wall switch. Tap to switch the light on/off. <br>*Settings:* On, Contact rating (A) |
| **Two-Way Switch** | Household two-way switch (staircase wiring): COM connects to L1 or L2. Two of them control one lamp from two places; add intermediate switches for more places. <br>*Settings:* Position (L2), Contact rating (A) |
| **Three-Way Switch (US)** | US "three-way" switch: common terminal to either traveler. Identical to a UK/BD two-way switch; use two for staircase lighting and four-way (intermediate) switches in between. <br>*Settings:* Position (L2), Contact rating (A) |
| **Intermediate Switch** | Intermediate (US: four-way) switch between two two-way switches: straight (1→1, 2→2) or crossed (1→2, 2→1). Lets any number of locations control one lamp. <br>*Settings:* Crossed, Contact rating (A) |
| **Switch (SPDT)** | Single-pole double-throw switch: common terminal (left) connects to A (top) or B (bottom). Tap to flip. <br>*Settings:* Position B, On resistance (Ω), Contact rating (A) |
| **Switch (DPST)** | Double-pole single-throw switch: two contacts operated together (e.g. switching both L and N). <br>*Settings:* Closed, Contact rating (A) |
| **Switch (DPDT)** | Double-pole double-throw switch: two changeover contacts operated together — e.g. reversing a DC motor. <br>*Settings:* Position B, Contact rating (A) |
| **Push Button (NO)** | Momentary push button, normally open: conducts only while you hold it. <br>*Settings:* On resistance (Ω), Contact rating (A) |
| **Push Button (NC)** | Momentary push button, normally closed: opens while you hold it. <br>*Settings:* On resistance (Ω), Contact rating (A) |
| **Foot Switch (NO)** | Momentary foot pedal (normally open): closed only while it is pressed — press and hold it. <br>*Settings:* Contact rating (A) |
| **Latching Push Button** | Push-on / push-off button: each press toggles and it stays there. <br>*Settings:* Latched (closed), Contact rating (A) |
| **Emergency Stop** | Normally-closed mushroom-head emergency stop: pressing it latches the contact open; twist to release (tap again). <br>*Settings:* Pressed (latched open), Contact rating (A) |
| **Limit Switch** | Changeover limit / micro switch: COM–NC normally, COM–NO when the lever is actuated. Press and hold (or set "Actuated"). <br>*Settings:* Actuated, Contact rating (A) |
| **Rotary Switch (1P4T)** | Single-pole four-position rotary selector: COM connects to one of positions 1–4. Tap to advance. <br>*Settings:* Position (1–4), Contact rating (A) |
| **DIP Switch (4-way)** | Four independent on/off switches in one package: switch k (pins kL–kR) is ON when bit k of the pattern is set. Tap to count the pattern 0 → 15; set it in the properties or with the knob. <br>*Settings:* Switch pattern (0–15), Contact rating (A) |
| **Selector Switch (ON-OFF-ON)** | Three-position selector with centre OFF: COM → A, open, or COM → B (e.g. HAND–OFF–AUTO). Tap to cycle. <br>*Settings:* Position (1 = A, 2 = OFF, 3 = B), Contact rating (A) |
| **Isolator (Disconnector)** | Off-load isolator: provides a visible break for safe maintenance. Operate only with no load current. <br>*Settings:* Closed, Contact rating (A) |
| **Changeover Switch (Mains/Gen)** | Two-pole, three-position changeover: the load (L, N) is connected to Mains, to nothing, or to the Generator — never both. Tap to cycle. <br>*Settings:* Position (1 = Mains, 2 = Off, 3 = Generator), Contact rating (A) |
| **Reed Switch** | Glass reed contacts closed by a nearby magnet: close when the magnet is nearer than the pull-in distance, re-open ~40 % further away (hysteresis). <br>*Settings:* Magnet distance (mm), Pull-in distance (mm), Contact, Contact rating (A) |
| **Float Switch** | Float-operated level switch: operates when the liquid rises above the switching level (with hysteresis). NC mode is typical for pump control. <br>*Settings:* Liquid level (%), Switching level (%), Hysteresis (%), Contact, Contact rating (A) |
| **Pressure Switch** | Pump pressure switch: contact closes when pressure falls below cut-in and opens above cut-out (runs the pump in between). <br>*Settings:* Pressure (bar), Cut-in pressure (bar), Cut-out pressure (bar), Contact rating (A) |
| **Thermostat** | Bimetal thermostat with differential: in heating mode the contact closes below (set − diff/2) and opens above (set + diff/2). <br>*Settings:* Temperature (°C), Set point (°C), Differential (°C), Mode, Contact rating (A) |
| **Voltage-Controlled Switch** | SPICE-style voltage-controlled switch: S1–S2 closes when V(C+) − V(C−) rises above the turn-on voltage and opens when it falls below the turn-off voltage (hysteresis). The control input draws no current. <br>*Settings:* Turn-on control voltage (V), Turn-off control voltage (V), On resistance (Ω), Off resistance (Ω) |
| **Current-Controlled Switch** | SPICE-style current-controlled switch: the control path C+ → C− is a zero-volt current sensor in series with your circuit; S1–S2 closes when that current exceeds the turn-on value and opens below the turn-off value. <br>*Settings:* Turn-on control current (A), Turn-off control current (A), On resistance (Ω), Off resistance (Ω) |
| **Relay** | Electromechanical relay: coil (left) with inductance; SPDT contacts COM/NO/NC switch when coil current exceeds pull-in. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), Pull-in (% rated I) (%), Drop-out (% rated I) (%), Contact rating (A) |
| **Relay (SPST-NO)** | Single-pole make (normally open) relay: coil A1–A2, contact 13–14 closes when energised. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz), Contact rating (A) |
| **Relay (DPST-NO)** | Double-pole make relay: coil A1–A2, contacts 13–14 and 23–24 close together — switches both line and neutral. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz), Contact rating (A) |
| **Relay (DPDT)** | Two-pole changeover relay (IEC numbering): coil A1–A2; pole 1: 11 common, 12 NC, 14 NO; pole 2: 21, 22, 24. Pull-in at 70 %, drop-out at 35 % of rated coil current. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz), Contact rating (A) |
| **Reed Relay** | Small reed relay: 5 V, 500 Ω coil operating a normally-open reed contact (13–14). Fast and low power — can be driven from logic. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz), Contact rating (A) |
| **Latching Relay (bistable)** | Bistable relay with two coils: a pulse on the SET coil (S1–S2) moves the contact to COM–NO, a pulse on the RESET coil (R1–R2) moves it back to COM–NC. It keeps its position with no coil power — a mechanical memory. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), Contact rating (A) |
| **Control Relay 2NO + 2NC** | Industrial control (auxiliary) relay with a 230 V AC coil: two NO contacts (13–14, 23–24) and two NC contacts (31–32, 41–42) for hold-in, interlock and signalling circuits. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz), Contact rating (A) |
| **Contactor (3-pole)** | Three-pole power contactor with 230 V AC coil (A1–A2), main contacts L1–T1, L2–T2, L3–T3 and an auxiliary NO contact 13–14 for the hold-in (self-latching) circuit of a DOL starter. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz), Contact rating (A) |
| **Contactor 3-pole + NO + NC** | Power contactor with a 230 V AC coil (A1–A2), three main contacts (L1–T1, L2–T2, L3–T3) and two auxiliary contacts: 13–14 NO for the hold-in circuit and 21–22 NC for electrical interlocking (forward/reverse, star/delta). <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz), Contact rating (A) |
| **Timer Relay (TON/TOF)** | Time-delay relay. On-delay: the changeover contact (15 COM, 16 NC, 18 NO) switches T seconds after the coil is energised. Off-delay: it switches immediately and returns T seconds after de-energising. <br>*Settings:* Delay time (s), Function, Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz), Contact rating (A) |
| **Solid-State Relay (SSR)** | Optically isolated AC solid-state relay: input LED (3+/4−, ~1.2 V + 1 kΩ internal) triggers a TRIAC output (1–2) at the next voltage zero crossing; it turns off at current zero after the input is removed. <br>*Settings:* Input trigger current (A), Zero-cross switching, Output holding current (A) |
| **Contactor Coil (ladder)** | The coil (A1–A2) of a contactor or relay, drawn on its own in a rung of a ladder diagram. Every Main Contacts, NO Contact and NC Contact part with the same tag (for example KF) switches with it: they close (NO) or open (NC) when the coil pulls in. 230 V AC coil by default. <br>*Settings:* Tag (contacts with this tag follow it), Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz) |
| **Timer Coil (ladder)** | The coil of a time-delay relay, drawn on its own in a ladder rung. Contacts with the same tag are its timed contacts: on-delay (TON) — an NO contact closes and an NC contact opens T seconds after the coil is energised; off-delay (TOF) — they switch at once and return T seconds after it is de-energised. <br>*Settings:* Tag (contacts with this tag follow it), Delay time T (twin: ON time) (s), Function, Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz), Twin: OFF time T2 (s) |
| **NO Contact (ladder)** | Normally-open contact of the coil or relay with the same tag: it closes when that coil pulls in (or the timer runs out, or the overload relay trips). Use it as the hold-in (seal-in) contact across START, or to switch a pilot lamp. <br>*Settings:* Follows (tag of its coil / relay), Terminal numbers, Contact rating (A) |
| **NC Contact (ladder)** | Normally-closed contact of the coil or relay with the same tag: it opens when that coil pulls in. Use it for electrical interlocking (forward/reverse, star/delta) or, tagged like an overload relay (95-96), to drop the coil when the motor is overloaded. <br>*Settings:* Follows (tag of its coil / relay), Terminal numbers, Contact rating (A) |
| **Main Contacts 3-pole (ladder)** | The three main (power) contacts L1–T1, L2–T2, L3–T3 of the contactor whose coil has the same tag. Draw them in the power circuit; they close together when the coil in the control ladder pulls in. <br>*Settings:* Follows (tag of its contactor coil), Contact rating (A) |
| **Counter Coil (ladder)** | Count input of an industrial preset counter, drawn as a ladder coil: every time it is energised the count goes up by one. When the count reaches the preset, its contacts (NO / NC Contact parts with the same tag) switch over and stay switched until the counter is reset — by a Counter Reset Coil with the same tag, or by tapping the counter. <br>*Settings:* Tag (contacts with this tag follow it), Preset, Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz) |
| **Counter Reset Coil (ladder)** | Reset input of the Counter Coil with the same tag: energising it sets the count back to zero and returns the counter contacts to normal. <br>*Settings:* Resets the counter (tag), Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz) |
| **Floatless Level Relay (ladder)** | Floatless (electrode) level relay with LOW and HIGH probes in the tank with the tag it watches. Its supply is the coil A1–A2. Fill mode: its contacts operate when the water falls below LOW and stay operated until it reaches HIGH — an NO contact in the pump contactor rung fills the tank automatically. Dry-run mode: operated while there is water above LOW (an NO contact protects the pump from running dry). <br>*Settings:* Tag (contacts with this tag follow it), Tank it watches (tag), Function, LOW probe (%), HIGH probe (%), Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz) |
| **Limit Switch NO (ladder)** | Normally-open limit switch: closes when the Carriage / Cylinder with the same tag reaches the set position (or while you press and hold it, if no carriage has the tag). Use it to start the next movement (auto reverse, sequence). <br>*Settings:* Operated by carriage / cylinder (tag), Name, Operates at position (%), Operated when the position is |
| **Limit Switch NC (ladder)** | Normally-closed limit switch: opens when the Carriage / Cylinder with the same tag reaches the set position (or while you press and hold it). Put it in series with a coil to stop the movement at the end of travel. <br>*Settings:* Operated by carriage / cylinder (tag), Name, Operates at position (%), Operated when the position is |
| **Carriage / Cylinder (ladder)** | A moving machine part for ladder-diagram examples: a carriage (or conveyor table) that travels forward while the coil tagged "Forward" is energised and back while the "Reverse" coil is, or a single-acting pneumatic cylinder that extends while its solenoid-valve coil is on and springs back when it is off. Limit Switch contacts with its tag operate at set positions (0 % = home, 100 % = far end). <br>*Settings:* Tag (contacts with this tag follow it), Type, Forward / extend coil tag, Reverse coil tag, Travel speed (%/s), Start position (%) |
| **Water Tank (ladder)** | A water tank for level-control examples: it fills at the filling rate while the coil with the "filled by" tag is energised (taking the water from another tank, if one is named, which then empties), and empties at the water-use rate. Floatless Level Relays with its tag watch its level with their probes. <br>*Settings:* Tag (contacts with this tag follow it), Filled while this coil is on (tag; empty = always), Draws its water from tank (tag; empty = mains line), Filling rate (%/s), Water use (outflow) (%/s), Start level (%) |

### Electrical — 23

Parts for house wiring and lighting: bulbs, tube light with choke and starter, fan with regulators, heater, socket with a selectable appliance (including "Faulty" and "Short circuit" for testing protection), dimmer, bell and earth electrode. Use them with **AC Mains**.

| | |
| --- | --- |
| **Incandescent Bulb** | Tungsten filament lamp with a thermal model: the cold filament has ≈1/15 of its hot resistance, so it draws a large inrush current and brightens over tens of milliseconds. R ∝ T^1.2, radiated power ∝ T⁴. On too high a voltage (about 1.6 × its rating, e.g. a 230 V bulb on 400 V) the filament overheats and burns out — select it and tap Replace. <br>*Settings:* Rated voltage (V), Rated power (W), Filament time constant (s) |
| **Lamp** | Incandescent lamp modelled at its hot resistance R = V²/P; brightness follows dissipated power. <br>*Settings:* Rated voltage (V), Rated power (W) |
| **Halogen Lamp** | Tungsten-halogen lamp (e.g. 12 V 50 W MR16): a hotter filament than an ordinary bulb (≈18 lm/W, whiter light) in a quartz envelope; like any filament it draws ≈10–15× inrush current when cold. <br>*Settings:* Rated voltage (V), Rated power (W), Filament time constant (s) |
| **Fluorescent Tube Light** | Hot-cathode fluorescent tube. Wire: L → ballast → left filament; left & right filaments’ inner ends to the starter; right filament → N. The starter pre-heats the filaments, then opens; the ballast kick strikes the arc, which then runs at ≈100 V. <br>*Settings:* Arc (running) voltage (V), Strike voltage (cold) (V), Strike voltage (pre-heated) (V), Arc resistance (Ω), Filament resistance (each) (Ω), Rated power (W) |
| **Choke / Ballast** | Magnetic ballast (iron-cored choke) for a 40 W tube on 230 V 50 Hz: limits the arc current and produces the high-voltage kick when the starter opens. <br>*Settings:* Inductance (H), Winding resistance (Ω) |
| **Glow Starter** | Glow starter: a neon glow heats a bimetal strip until its contacts close (pre-heating the tube filaments); with the glow gone it cools and snaps open, giving the ballast kick. Stays idle once the tube runs at ~100 V. <br>*Settings:* Glow ignition voltage (V), Bimetal heating time (s), Contact opening time (s) |
| **LED Bulb (AC)** | LED lamp with a linear driver: the LED string only conducts when \|v\| exceeds its string voltage (so the current flows in pulses near the peaks and the power factor is below 1). Sized for rated power at rated voltage. <br>*Settings:* Rated voltage (RMS) (V), Rated power (W), LED string voltage (V) |
| **CFL (energy-saving lamp)** | Compact fluorescent lamp with an electronic ballast: a bridge rectifier charges a small reservoir capacitor, so mains current flows only in short peaks near the voltage maxima (power factor ≈0.6, rich in harmonics) while the ballast takes constant power. ≈60 lm/W. <br>*Settings:* Rated power (W) |
| **LED Strip** | LED tape: cut-able segments of a few LEDs in series with a current-setting resistor, all segments in parallel along the strip. Current (and brightness) collapse quickly below the rated voltage, and long strips need power fed at both ends because of the copper-track voltage drop. <br>*Settings:* Length (m), Strip, LEDs per metre, LEDs per segment, Resistor per segment (Ω) |
| **LED Driver (CC / CV)** | Mains LED driver with active power-factor correction (it draws a sinusoidal current, PF ≈ 1). Constant-current type: regulates the LED current whatever the forward voltage (up to Vmax) — for COB modules and high-power LEDs. Constant-voltage type: a regulated voltage with a current limit — for LED strips. Isolated output; switches off below ≈85 V input. <br>*Settings:* Type, Output current (CC) (A), Maximum output voltage (CC) (V), Output voltage (CV) (V), Current limit (CV) (A), Efficiency |
| **LED Panel Light (PFC driver)** | Flat LED panel with a power-factor-corrected constant-current driver: it draws its rated power as a sinusoidal current in phase with the mains (PF ≈ 0.95+) from about 100 V to 250 V; below ≈90 V the driver drops out. <br>*Settings:* Rated power (W), Efficacy (lm/W) |
| **Neon Indicator Lamp** | Neon glow lamp (NE-2): strikes at ≈90 V, then maintains ≈60 V and must be fed through a series resistor (e.g. 100 kΩ on 230 V) — directly on the mains it burns out. Panel pilot lamps have the resistor built in (set it, e.g. 150 kΩ). Classic relaxation oscillator element. <br>*Settings:* Striking voltage (V), Maintaining voltage (V), Internal resistance (Ω), Built-in series resistor (panel indicator) (Ω) |
| **Ceiling Fan** | Ceiling fan (permanent-split capacitor motor) as an equivalent series R–L load from rated power and power factor. Speed follows the winding current with the fan load curve and the blade inertia; stalls below ≈35 % — try it with a regulator. Over-voltage saturates the iron core, so the current rises much faster than the voltage; the run capacitor (≈1.2 × the supply voltage across it) bursts above its rating and the fan then only hums, drawing locked-rotor current; the winding (class B, ≈100 °C at rated load) burns at ≈180 °C. <br>*Settings:* Rated voltage (RMS) (V), Rated power (W), Power factor, Rated speed (rpm), Rated frequency (Hz), Capacitor rating (AC) (V) |
| **Heater / Iron / Kettle** | Resistive heating element (R = V²/P) with a first-order thermal model: temperature rises towards ΔT ∝ P. <br>*Settings:* Rated voltage (V), Rated power (W), Thermal time constant (s) |
| **Socket Outlet + Appliance** | 3-pin socket (L, N, E) with a selectable appliance modelled as an R–L load of its rated power and power factor. "Faulty appliance" leaks 50 mA to earth — an RCD must trip. <br>*Settings:* Plugged-in appliance, Rated voltage (V), Frequency (Hz), Contact rating (A) |
| **Dimmer / Electronic Regulator** | TRIAC phase-angle controller in series with the load. Each half-cycle it waits for the firing angle α = (1 − level)·180° after the zero crossing, fires, and conducts until the current falls to zero. <br>*Settings:* Level (%), Mains frequency (Hz), TRIAC holding current (A), Load rating (A) |
| **Fan Regulator (resistive)** | Old-style step regulator: a tapped wire-wound resistor in series with the fan (steps 1–4 drop voltage, step 5 is direct). Wastes power as heat — compare with the capacitive regulator. <br>*Settings:* Step (0 = off … 5 = full), Resistance scale (×) |
| **Fan Regulator (capacitive)** | Capacitor-type step regulator: series capacitors (1.5–4.7 µF) drop the fan voltage with almost no power loss (reactive drop), with a 470 kΩ bleeder. Step 5 connects the fan directly. <br>*Settings:* Step (0 = off … 5 = full) |
| **Electric Bell** | Electromagnetic bell: a coil (R–L) that rings when its RMS current exceeds the operating current. <br>*Settings:* Coil resistance (Ω), Coil inductance (H), Operating current (A) |
| **Earth Electrode** | Earth rod: connects its terminal to true earth (0 V) through the soil resistance. Fault current and touch voltage depend on it. <br>*Settings:* Earth resistance (Ω) |
| **Photocell Switch (dusk-to-dawn)** | Dusk-to-dawn photo control for street and garden lights: an LDR-driven relay closes L → LOAD when the ambient light falls below the switch-on level and opens again above the (higher) switch-off level, after a delay that ignores car headlights and lightning. Needs mains (L–N) to work. <br>*Settings:* Ambient light (lx), Switch on below (lx), Switch off above (lx), Delay (s), Contact rating (A) |
| **PIR Light Switch (motion)** | Passive-infrared occupancy switch for corridors and stairs: when it sees motion in the dark (ambient light below the threshold) it closes L → LOAD and keeps the light on for the hold time after the last movement (re-triggerable). Tap it to simulate someone walking past. <br>*Settings:* Motion detected, Ambient light (lx), Works only below (lx), Hold time after last motion (s), Contact rating (A) |
| **Emergency Light (battery backup)** | Self-contained emergency luminaire: while the mains is present it trickle-charges its 3.6 V NiCd pack (≈2 W) and the lamp stays off (non-maintained) or on (maintained); when the mains fails the LED lamp lights from the battery until it is flat (autonomy = capacity × 3.6 V ÷ lamp power, typically 1–3 h). <br>*Settings:* Lamp power (W), Battery capacity (3.6 V NiCd) (Ah), Initial battery charge (%), Maintained (lamp also on with mains) |

### Power Systems — 14

Rated loads (R-L, R-C, 3-phase star and delta), a power-factor correction capacitor and transmission-line models. Set the load by its power and power factor.

| | |
| --- | --- |
| **Resistive Load (P @ V)** | Resistive load specified by its power at rated voltage: R = V²/P. <br>*Settings:* Real power P (at rated V) (W), Rated voltage (RMS) (V), Frequency (Hz) |
| **Inductive Load (P, pf lag)** | Series R–L load specified by real power and lagging power factor at rated voltage and frequency. <br>*Settings:* Real power P (at rated V) (W), Power factor, Rated voltage (RMS) (V), Frequency (Hz) |
| **Capacitive Load (P, pf lead)** | Series R–C load specified by real power and leading power factor at rated voltage and frequency. <br>*Settings:* Real power P (at rated V) (W), Power factor, Rated voltage (RMS) (V), Frequency (Hz) |
| **3-Phase Load (Star)** | Balanced star-connected R–L load (R, Y, B and neutral N). Set "imbalance" to load phase B differently and watch the neutral current. <br>*Settings:* Total real power P (W), Power factor (lag), Rated line voltage (V), Frequency (Hz), Phase B imbalance (%) |
| **3-Phase Load (Delta)** | Balanced delta-connected R–L load across R–Y, Y–B, B–R. Line current = √3 × phase current. <br>*Settings:* Total real power P (W), Power factor (lag), Rated line voltage (V), Frequency (Hz), Phase B imbalance (%) |
| **PF Correction Capacitor (kVAR)** | Shunt capacitor rated in VAR: C = Q / (2πf·V²). Connect across an inductive load to raise the power factor. <br>*Settings:* Reactive power Q (VAR), Rated voltage (RMS) (V), Frequency (Hz) |
| **Short Transmission Line** | Short line model (< 80 km): series impedance Z = (r + jx)·length. Shows voltage drop and losses. <br>*Settings:* Length (km), Resistance per km (Ω), Reactance per km (at f) (Ω), Frequency (Hz) |
| **Medium Line (Nominal-π)** | Nominal-π line: series Z = (r + jx)·ℓ with half the shunt capacitance Y/2 at each end. Sending end on the left, receiving end on the right, common return at the bottom. Try an open receiving end to see the Ferranti effect. <br>*Settings:* Length (km), Resistance per km (Ω), Reactance per km (Ω), Shunt susceptance per km (S), Frequency (Hz) |
| **Cable (1 core, with length)** | One conductor of a real cable: R = ρ·L/S (IEC 60228) rising with temperature, a current rating Iz from IEC 60364-5-52 for the chosen insulation and installation, and a thermal model. Above Iz it overheats; far above, the insulation smokes, catches fire and the cable burns open. Select a burnt cable and tap Replace to put in a new one. <br>*Settings:* Length (m), Cable type, Conductor size, Conductor (IEC 60228), Installation method |
| **Cable (2-core, L + N)** | Two-core installation cable (L and N): each conductor has R = ρ·L/A at the operating temperature (copper or aluminium) plus 0.08 mΩ/m reactance. Readings show the RMS current against the current-carrying capacity (IEC 60364-5-52, PVC, clipped direct) and the voltage drop — keep it under ≈5 % (3 % for lighting). Long runs of thin cable dim the lamps! <br>*Settings:* Length (m), Conductor size, Conductor, Conductor temperature (°C) |
| **Cable (4-core, 3-phase + N)** | Four-core three-phase cable (L1, L2, L3, N): R = ρ·L/A per conductor at the operating temperature plus 0.08 mΩ/m reactance; readings compare the highest line current with the current-carrying capacity for three loaded conductors and show the voltage drop (L1–L2). <br>*Settings:* Length (m), Conductor size, Conductor, Conductor temperature (°C) |
| **Busbar** | Copper busbar with 2 to 24 tap points (choose the number of taps). Pick a standard bar size (width × thickness) or type your own cross-section area: each section between taps has R = ρ·pitch/A (a few µΩ), so the bar distributes current with negligible drop. Readings show the largest section current against the rating; a bar run above its rating turns red. <br>*Settings:* Number of taps, Bar size (copper, W × T), Bar cross-section (area) (mm²), Current rating (A), Tap spacing (mm) |
| **Junction Box** | Junction box: four cable entries joined by a connector (≈1 mΩ each) — a tidy way to branch a circuit. <br>*Settings:* Contact rating (A) |
| **Fault (timed short circuit)** | Applies a short circuit (through the fault resistance) between its terminals at the set time and optionally removes it later — for testing fuses, breakers, relays and protection coordination: connect it line-to-earth or line-to-line where the fault should happen. <br>*Settings:* Fault applied at (s), Fault cleared at (0 = never) (s), Fault resistance (Ω) |

### Machines — 16

DC motors and generators (shunt, series, compound, universal), single- and 3-phase induction motors (including a 6-terminal motor for star-delta starting), synchronous motor, PMSM, BLDC with hall sensors, stepper motor and alternators. They include electrical and mechanical behaviour: starting current, speed, torque and slip; motors start at rest. Read the live **rpm** and **current** in the properties sheet.

| | |
| --- | --- |
| **DC Motor** | Permanent-magnet DC motor: V = R·i + L·di/dt + K·ω and J·dω/dt = K·i − b·ω − T_load, solved simultaneously. The rotor starts at rest; a positive load torque always opposes the rotation (friction-like: it can stop the shaft but never turn it backwards); a negative one drives the shaft. <br>*Settings:* Armature resistance (Ω), Armature inductance (H), Motor constant K (V·s/rad), Rotor inertia J (kg·m²), Friction b (N·m·s), Load torque (N·m), Rated current (A) |
| **DC Motor (separately excited)** | DC machine with separate armature (left: A+ A−) and field (right: F+ F−) terminals. Flux follows a saturating magnetisation curve of the field current; E = K·φ·ω, T = K·φ·Ia. Reversing the torque makes it a generator. <br>*Settings:* Load torque (N·m), EMF constant at rated field (V·s/rad), Armature resistance (Ω), Armature inductance (H), Field resistance (Ω), Field inductance (H), Rated field current (A), Inertia J (kg·m²), Friction b (N·m·s), Rated current (A) |
| **DC Shunt Motor** | DC shunt motor: field winding in parallel with the armature across the two terminals. Nearly constant speed with load. <br>*Settings:* Load torque (N·m), EMF constant at rated field (V·s/rad), Armature resistance (Ω), Armature inductance (H), Field resistance (Ω), Field inductance (H), Rated field current (A), Inertia J (kg·m²), Friction b (N·m·s), Rated current (A) |
| **DC Series Motor** | DC series motor: the field carries the armature current, so torque ∝ I² at low current — very high starting torque; never run it unloaded (speed runs away). <br>*Settings:* Load torque (N·m), EMF constant at rated field (V·s/rad), Armature resistance (Ω), Armature inductance (H), Field resistance (Ω), Field inductance (H), Rated field current (A), Inertia J (kg·m²), Friction b (N·m·s), Rated current (A) |
| **DC Generator (PM)** | Permanent-magnet DC generator driven at a set speed: E = Ke·speed behind Ra + La. The load current produces a braking torque T = E·I/ω. <br>*Settings:* Prime-mover speed (rpm), EMF constant (V/krpm), Armature resistance (Ω), Armature inductance (H), Rated current (A) |
| **3-Phase Induction Motor** | Squirrel-cage induction motor, dynamic model in the stationary αβ frame (3 stator phases in star + rotor αβ circuits, speed as a state). Shows starting current (≈6×), acceleration, slip and torque. Defaults ≈ 3.7 kW, 400 V, 50 Hz, 4-pole. <br>*Settings:* Load torque (N·m), Load type, Poles, Rated frequency (Hz), Stator resistance Rs (Ω), Rotor resistance Rr' (Ω), Stator leakage Lls (H), Rotor leakage Llr' (H), Magnetising Lm (H), Inertia J (kg·m²), Friction b (N·m·s), Rated current (A) |
| **1-Phase Capacitor Motor** | Permanent-split-capacitor motor: main winding M–C and auxiliary winding A–C in quadrature. Connect the run capacitor (e.g. 2.5 µF) between M and A and the supply across M–C. Without the capacitor it cannot start. <br>*Settings:* Load torque (N·m), Load type, Poles, Rated frequency (Hz), Main winding resistance (Ω), Aux winding resistance (Ω), Aux/main turns ratio, Leakage (main) (H), Magnetising Lm (H), Rotor resistance (Ω), Rotor leakage (H), Inertia J (kg·m²), Friction b (N·m·s), Rated current (A) |
| **3-Phase Alternator** | Round-rotor synchronous generator: per-phase EMF E = k·If behind Ra + jXs (star, neutral brought out). Excitation controls terminal voltage and reactive power; watch the voltage regulation with load. <br>*Settings:* Excitation (field current) (%), Open-circuit line voltage at 100 % (V), Frequency (Hz), Synchronous reactance Xs (Ω), Armature resistance Ra (Ω), Rated current (A) |
| **3-Phase Induction Motor (6 terminals)** | Squirrel-cage induction motor with both ends of each winding brought out: U1–U2, V1–V2, W1–W2. Rated 400 V Δ / 690 V Y (3.7 kW): link U2-V2-W2 for star (each winding gets only 230 V from a 400 V supply) or U1-W2, V1-U2, W1-V2 for delta (each winding gets its full 400 V) — the basis of star-delta starting: in star the starting current and torque are one third of delta. Same dynamic model as the 3-terminal motor, with the leakage inductance also in the zero-sequence path so a delta connection is handled correctly. <br>*Settings:* Load torque (N·m), Load type, Poles, Rated frequency (Hz), Stator resistance Rs (Ω), Rotor resistance Rr' (Ω), Stator leakage Lls (H), Rotor leakage Llr' (H), Magnetising Lm (H), Inertia J (kg·m²), Friction b (N·m·s), Rated current (A) |
| **DC Compound Motor** | Long-shunt compound DC motor: the shunt field sits across the supply and a series field carries the armature current. Cumulative compounding adds the series flux — higher starting torque and a speed that drops more with load than a shunt motor; differential compounding subtracts it to hold the speed flat — it needs a weak series field (≈0.003–0.005 here): too strong and the flux collapses with load so the motor runs away or reverses, and at starting current the series field overpowers the shunt field (short the series field while starting). Flux follows a saturating curve of the combined field. <br>*Settings:* Load torque (N·m), Series field, EMF constant at rated field (V·s/rad), Armature resistance (Ω), Armature inductance (H), Series field resistance (Ω), Series field inductance (H), Series field strength (A shunt-equivalent per A), Shunt field resistance (Ω), Shunt field inductance (H), Rated field current (A), Inertia J (kg·m²), Friction b (N·m·s), Rated current (A) |
| **Universal Motor (AC/DC series)** | Series-wound commutator motor that runs on AC as well as DC: field and armature currents reverse together, so the torque (∝ I²) keeps its direction. High speed and high starting torque — used in drills, mixers and vacuum cleaners. Speed falls steeply with load; never run it unloaded on DC. <br>*Settings:* Load torque (N·m), EMF constant at rated field (V·s/rad), Armature resistance (Ω), Armature inductance (H), Field resistance (Ω), Field inductance (H), Rated field current (A), Inertia J (kg·m²), Friction b (N·m·s), Rated current (A) |
| **Synchronous Motor (3-phase)** | Wound-field synchronous motor with a damper (cage) winding: it starts as an induction motor, the DC field is applied near synchronous speed and it pulls into step, then runs at exactly 1500 rpm (4-pole, 50 Hz) whatever the load. The excitation knob sets the power factor: under-excited it draws lagging current, over-excited it delivers reactive power (leading) — the V-curve; unloaded and over-excited it works as a synchronous condenser. <br>*Settings:* Load torque (N·m), Excitation (%), Apply field near synchronous speed, Rated line voltage (V), Poles, Rated frequency (Hz), Stator resistance Rs (Ω), Rotor resistance Rr' (Ω), Stator leakage Lls (H), Rotor leakage Llr' (H), Magnetising Lm (H), Inertia J (kg·m²), Friction b (N·m·s), Load type, Rated current (A) |
| **PMSM (Permanent-Magnet Synchronous Motor)** | Permanent-magnet synchronous motor (sinusoidal back-EMF, no cage): magnets on the rotor make the flux, so it runs at synchronous speed with high efficiency — the motor of servo drives and electric vehicles. It cannot start directly on the mains: feed it from an inverter whose frequency ramps up from zero (or use field-oriented control). Back-EMF constant in V (line RMS) per 1000 rpm. <br>*Settings:* Load torque (N·m), Back-EMF constant (line, RMS per krpm) (V), Poles, Rated frequency (Hz), Stator resistance Rs (Ω), Leakage inductance (H), Magnetising inductance (H), Inertia J (kg·m²), Friction b (N·m·s), Load type, Rated current (A) |
| **BLDC Motor (with Hall sensors)** | Brushless DC motor: three star-connected windings (A, B, C) with trapezoidal back-EMF and three Hall sensors (H1–H3, 5 V logic outputs, 120° apart) that tell the driver where the rotor is. Drive it with the BLDC driver (six-step commutation from the Hall code). T = Ke·Σ f(θ)·i. <br>*Settings:* Load torque (N·m), Torque / EMF constant (per phase) (V·s/rad), Phase resistance (Ω), Phase inductance (L − M) (H), Poles, Inertia J (kg·m²), Friction b (N·m·s), Rated current (A) |
| **Stepper Motor (2-phase bipolar)** | Two-phase hybrid stepper (NEMA-17 class, 1.8° per step): windings A (A+, A−) and B (B+, B−). Energising A, B, −A, −B in turn moves the rotor one full step each; T = Kt·(−iA·sin Nθ + iB·cos Nθ) − detent, with N = steps/4 rotor teeth. Drive it with the stepper driver; too high a step rate or load makes it stall and lose steps. <br>*Settings:* Load torque (N·m), Torque constant (N·m/A), Full steps per revolution, Winding resistance (Ω), Winding inductance (H), Detent torque (N·m), Rotor + load inertia (kg·m²), Viscous damping (N·m·s), Rated current (A) |
| **AC Generator (1-phase)** | Single-phase synchronous generator (portable genset): EMF E = k·If at the set frequency behind the winding resistance and synchronous reactance, so the terminal voltage drops with load (and more with lagging loads). Excitation controls the voltage. <br>*Settings:* Excitation (%), Open-circuit voltage at 100 % (RMS) (V), Frequency (Hz), Synchronous reactance (Ω), Winding resistance (Ω), Rated current (A) |

### Diodes — 17

Diodes conduct only one way (anode → cathode). Zener diodes hold a fixed reverse voltage. Bridge and 3-phase rectifiers are ready-made blocks. Pick a **model** to get real-part numbers.

| | |
| --- | --- |
| **Diode** | Shockley diode I = Is(e^(V/nVt) − 1) with reverse breakdown. Current flows from anode (left) to cathode (bar). <br>*Settings:* Model, Saturation current Is (A), Emission coefficient n, Breakdown voltage (0 = none) (V) |
| **Diode (switching, with recovery)** | SPICE-level diode: Shockley junction with series resistance Rs, diffusion charge TT·I (reverse recovery) and voltage-dependent junction capacitance. Switch it off while it conducts and the scope shows the reverse-recovery current spike (≈TT long). <br>*Settings:* Model, Saturation current Is (A), Emission coefficient n, Breakdown voltage (0 = none) (V), Series resistance Rs (Ω), Transit time TT (reverse recovery) (s), Zero-bias junction capacitance (F) |
| **Fast-Recovery Diode (FR107)** | Fast-recovery rectifier: reverse recovery ≈ 0.3–0.5 µs instead of several µs — for flyback converters, snubbers and freewheeling at a few tens of kHz. <br>*Settings:* Model, Saturation current Is (A), Emission coefficient n, Breakdown voltage (0 = none) (V), Series resistance Rs (Ω), Transit time TT (reverse recovery) (s), Zero-bias junction capacitance (F) |
| **Ultra-Fast Diode (UF4007)** | Ultra-fast recovery rectifier: trr ≈ 50–75 ns — used in switch-mode power supplies at 50–200 kHz. <br>*Settings:* Model, Saturation current Is (A), Emission coefficient n, Breakdown voltage (0 = none) (V), Series resistance Rs (Ω), Transit time TT (reverse recovery) (s), Zero-bias junction capacitance (F) |
| **Power Diode (6A10)** | High-current rectifier diode (6 A): very low series resistance; slow recovery (µs), so it is used at mains frequency. <br>*Settings:* Model, Saturation current Is (A), Emission coefficient n, Breakdown voltage (0 = none) (V), Series resistance Rs (Ω), Transit time TT (reverse recovery) (s), Zero-bias junction capacitance (F) |
| **SiC Schottky Diode (C3D10065)** | Silicon-carbide Schottky diode: 650 V blocking with zero reverse-recovery charge (only junction capacitance), forward drop ≈1.5 V at 10 A. Used in PFC stages and fast inverters. <br>*Settings:* Model, Saturation current Is (A), Emission coefficient n, Breakdown voltage (0 = none) (V), Series resistance Rs (Ω), Transit time TT (reverse recovery) (s), Zero-bias junction capacitance (F) |
| **Avalanche Diode (BYV26)** | Controlled-avalanche rectifier: if a voltage spike exceeds its rating it breaks down safely (like a Zener) instead of being destroyed. Fast recovery (≈30 ns). <br>*Settings:* Model, Saturation current Is (A), Emission coefficient n, Breakdown voltage (0 = none) (V), Series resistance Rs (Ω), Transit time TT (reverse recovery) (s), Zero-bias junction capacitance (F) |
| **Zener Diode** | Zener diode: conducts in reverse above its Zener voltage — used as a voltage reference. <br>*Settings:* Zener voltage (V), Saturation current Is (A), Emission coefficient n, Power rating |
| **Schottky Diode** | Schottky barrier diode with a low forward drop (~0.3 V). <br>*Settings:* Model, Saturation current Is (A), Emission coefficient n, Breakdown voltage (0 = none) (V) |
| **Varactor (Varicap)** | Reverse-biased tuning diode: Cj = Cj0 / (1 + Vr/φ)^m (charge-conserving model). Use it to tune an LC tank or VCO with a DC voltage. <br>*Settings:* Zero-bias capacitance Cj0 (F), Junction potential φ (V), Grading coefficient m, Breakdown voltage (V) |
| **Tunnel Diode** | Esaki tunnel diode: I = Ip·(V/Vp)·e^(1−V/Vp) + Iv·e^(k(V−Vv)) + diffusion current — a negative-resistance region between the peak and valley (for oscillators). <br>*Settings:* Peak current Ip (A), Peak voltage Vp (V), Valley current Iv (A), Valley voltage Vv (V) |
| **Current-Regulator Diode** | Constant-current diode (JFET with gate tied to source): passes ≈Ireg for any forward voltage above the knee; conducts like a diode in reverse. <br>*Settings:* Regulated current (A), Knee voltage (V), Dynamic resistance above knee (Ω) |
| **PIN Diode (RF switch)** | PIN diode: the wide intrinsic layer stores charge Q = I·τ, so at RF (period ≪ τ) it does not rectify but acts as a resistor set by the DC bias current: R ≈ R(1 mA)·(1 mA / I)^0.87 — from kΩ at zero bias to about 1 Ω at 10 mA. Used as RF switch and attenuator. <br>*Settings:* RF resistance at 1 mA (Ω), Minimum resistance (Ω), Zero-bias resistance (Ω), Carrier lifetime (s), Total capacitance (F) |
| **Gunn Diode** | Transferred-electron (Gunn) device: ohmic at low voltage, but above the threshold electrons move to a slower valley, so the current falls as the voltage rises — a negative differential resistance that makes microwave oscillators. I = (V/R0 + Isat·(V/Vth)⁴) / (1 + (V/Vth)⁴). <br>*Settings:* Threshold voltage (V), Low-field resistance (Ω), Valley (saturated) current (A) |
| **IMPATT Diode** | IMPATT diode, run in reverse avalanche breakdown from a current-limited supply (static model: the reverse avalanche knee at the rated voltage). The microwave negative resistance comes from the avalanche and transit-time delay (≈ half a period at tens of GHz), far above what a circuit time step resolves. <br>*Settings:* Avalanche voltage (V), Saturation current Is (A), Emission coefficient n |
| **Bridge Rectifier (1-phase)** | Four-diode full-wave bridge (1N4007-class diodes): AC in on the two ~ pins, DC out on + and −. <br>*Settings:* Diode Is (A), Emission coefficient, Reverse voltage rating (V) |
| **Bridge Rectifier (3-phase)** | Six-pulse three-phase diode bridge: DC output ≈ 1.35 × line voltage (RMS). <br>*Settings:* Diode Is (A), Emission coefficient, Reverse voltage rating (V) |

### Transistors — 13

BJTs, MOSFETs, JFETs, IGBT and more. Terminals: BJT = collector, base, emitter; MOSFET = drain, gate, source. Pick a **model** (2N3904, 2N2222, BC547, 2N7000, IRF540N…) for real numbers.

| | |
| --- | --- |
| **NPN Transistor** | Bipolar junction transistor (Ebers–Moll transport model with Early effect and junction capacitances). Terminals: B (left), C (top), E (bottom). <br>*Settings:* Model, Forward β (hFE), Saturation current Is (A), Reverse β, Early voltage (0 = ∞) (V), B-E capacitance (F), B-C capacitance (F), Heatsink |
| **PNP Transistor** | PNP bipolar transistor. Terminals: B (left), C (top), E (bottom) — for high-side use, flip it so the emitter is on top. <br>*Settings:* Model, Forward β (hFE), Saturation current Is (A), Reverse β, Early voltage (0 = ∞) (V), B-E capacitance (F), B-C capacitance (F), Heatsink |
| **Darlington NPN (TIP120)** | Two transistors in Darlington connection with the internal 8 kΩ / 120 Ω base-emitter resistors of a TIP120: overall gain β₁·β₂ (≈1000+), VBE(on) ≈ 1.4 V. <br>*Settings:* β of each transistor, Is (A), Heatsink |
| **Darlington PNP (TIP125)** | PNP Darlington pair (TIP125-type): overall gain β₁·β₂. Terminals B (left), C (top), E (bottom) — flip it for high-side use. <br>*Settings:* β of each transistor, Is (A), Heatsink |
| **N-MOSFET** | Enhancement MOSFET, Shichman–Hodges (SPICE level 1) model with body diode. Terminals: G (left), D (top), S (bottom). <br>*Settings:* Model, Threshold \|Vth\| (V), Transconductance k (µCox·W/L) (A/V²), Channel-length modulation λ (1/V), Gate-source capacitance (F), Gate-drain capacitance (F), Body diode, Heatsink |
| **P-MOSFET** | P-channel enhancement MOSFET (level 1). Source usually connects to the positive supply — flip it so S is on top. <br>*Settings:* Model, Threshold \|Vth\| (V), Transconductance k (µCox·W/L) (A/V²), Channel-length modulation λ (1/V), Gate-source capacitance (F), Gate-drain capacitance (F), Body diode, Heatsink |
| **Depletion N-MOSFET** | Depletion-mode N-channel MOSFET: conducts at Vgs = 0 and is switched off by making the gate negative (Vgs < Vth < 0). <br>*Settings:* Threshold (negative) (V), Transconductance k (µCox·W/L) (A/V²), Channel-length modulation λ (1/V), Gate-source capacitance (F), Gate-drain capacitance (F), Body diode, Heatsink |
| **N-JFET** | Junction FET (square-law model with gate junction diodes). Terminals: G (left), D (top), S (bottom). <br>*Settings:* IDSS (A), Pinch-off \|Vp\| (V), λ (1/V) |
| **P-JFET** | P-channel junction FET (square-law model). <br>*Settings:* IDSS (A), Pinch-off \|Vp\| (V), λ (1/V) |
| **IGBT** | Insulated-gate bipolar transistor: voltage-driven gate like a MOSFET, bipolar conduction with a ≈0.7 V knee (Vce(sat) ≈ 1.5–2 V). Structure model: MOSFET driving a wide-base PNP. Terminals G (left), C (top), E (bottom). <br>*Settings:* Gate threshold (V), MOS transconductance (A/V²), PNP gain, Heatsink |
| **GaN HEMT (e-mode)** | Enhancement-mode gallium-nitride HEMT (EPC2045-like): a 2-D electron gas channel gives very low on-resistance (≈7 mΩ) with tiny gate charge, so it switches in nanoseconds. No body diode: in reverse it conducts through the channel once V(gate−drain) exceeds Vth (≈2 V drop). Gate limited to about 6 V. Terminals G (left), D (top), S (bottom). <br>*Settings:* Threshold Vth (V), Transconductance k (A/V²), Channel-length modulation λ (1/V), Gate-source capacitance (F), Gate-drain capacitance (F), Heatsink |
| **UJT (2N2646)** | Unijunction transistor: the emitter diode sees η·Vbb; when Ve exceeds η·Vbb + 0.6 V (peak point) the lower base floods with carriers and its resistance collapses, discharging the emitter until the current falls below the valley current. Classic relaxation oscillator f ≈ 1/(R·C·ln(1/(1−η))) and SCR trigger. Terminals E (left), B2 (top), B1 (bottom). <br>*Settings:* Intrinsic stand-off ratio η, Interbase resistance (Ω), Peak-point current Ip (A), Valley current Iv (A), Lower-base resistance when fired (Ω) |
| **Optocoupler (PC817)** | Infrared LED (A–K, ≈1.2 V) optically coupled to a phototransistor (C–E): Ic ≈ CTR × If until the transistor saturates. Input and output are galvanically isolated. <br>*Settings:* Current transfer ratio (%) |

### Thyristors & Power — 30

SCR, TRIAC, DIAC, GTO and friends for phase control and power switching, a firing unit for SCR bridges, H-bridge and 3-phase inverter bridges, an SPWM modulator (V/f control), BLDC and stepper drivers, gate drivers, and averaged DC-DC converters (buck, boost, buck-boost, Ćuk, SEPIC, flyback, forward, push-pull, half and full bridge).

| | |
| --- | --- |
| **SCR (Thyristor)** | Silicon-controlled rectifier: blocks until a gate pulse (≥ IGT) arrives while forward biased, then conducts like a diode until the anode current falls below IH. Terminals: A (left), K (right), G (bottom). <br>*Settings:* Gate trigger current IGT (A), Holding current IH (A), Break-over voltage (V), On-state current rating IT(RMS) (A), Heatsink |
| **TRIAC** | Bidirectional thyristor for AC: triggered by gate current of either polarity (relative to MT1) and conducts both ways until the current crosses zero. Terminals: MT2 (left), MT1 (right), G (bottom). <br>*Settings:* Gate trigger current IGT (A), Holding current IH (A), Break-over voltage (V), On-state current rating IT(RMS) (A), Heatsink |
| **DIAC** | DIAC (DB3): blocks until \|V\| exceeds the break-over voltage (≈32 V), then snaps back by ΔV and conducts — used to trigger TRIACs in dimmers. <br>*Settings:* Break-over voltage (V), Break-back ΔV (V), On resistance (Ω), Holding current (A) |
| **SIDAC** | SIDAC: a high-current DIAC. It blocks until \|V\| reaches the break-over voltage (≈120 V), then snaps to about 1 V and conducts amperes until the current drops below the holding current — used in igniters, fence chargers and surge protectors. <br>*Settings:* Break-over voltage (V), Snap-back ΔV (V), On resistance (Ω), Holding current (A) |
| **SCS (Silicon Controlled Switch)** | Four-terminal thyristor with both gates brought out: a positive current into the cathode gate GK (or out of the anode gate GA) turns it on; a negative GK current of at least I_anode / turn-off gain turns it off again. Terminals A (left), K (right), GK (bottom), GA (top). <br>*Settings:* Gate trigger current IGT (A), Holding current IH (A), Break-over voltage (V), Gate turn-off gain, On-state current rating IT(RMS) (A), Heatsink |
| **LASCR (Light-Activated SCR)** | Light-activated SCR: light falling on the gate region generates a photocurrent that acts as gate current, so it can be fired without an electrical gate connection (optical triggering in HVDC valves and opto-SCRs). Turn the light knob above the trigger level while it is forward biased; it then latches like an SCR. <br>*Settings:* Light on the gate window (%), Photo gate current at 100 % (A), Gate trigger current IGT (A), Holding current IH (A), Break-over voltage (V), On-state current rating IT(RMS) (A), Heatsink |
| **IGCT** | Integrated gate-commutated thyristor: a GTO with a very low-inductance gate drive that pulls the entire anode current out of the gate (turn-off gain ≈ 1), so it turns off fast and uniformly like a transistor while conducting with thyristor losses. Used in multi-MW medium-voltage drives. <br>*Settings:* Gate trigger current IGT (A), Holding current IH (A), Break-over voltage (V), Turn-off gain |
| **IGBT Half-Bridge Module** | Two IGBTs with anti-parallel freewheeling diodes in one package — one inverter leg. Upper switch P→AC is driven by G1 relative to AC (needs an isolated or bootstrap gate driver), lower switch AC→N by G2 relative to N. Never turn both on together (shoot-through). <br>*Settings:* Gate threshold (V), MOS transconductance (A/V²) |
| **Intelligent Power Module (half-bridge)** | Half-bridge IPM: drive HIN/LIN with logic signals (relative to N). Built-in interlock (both high → both off), dead time, freewheeling diodes and over-current protection: above the trip current both switches latch off and the open-drain FO (fault) pin pulls low until both inputs go low. <br>*Settings:* Switch on-resistance (Ω), Over-current trip (A), Dead time (s), Logic threshold (V) |
| **GTO Thyristor** | Gate turn-off thyristor: turned on like an SCR and turned off by a negative gate current of at least I_anode / turn-off gain. <br>*Settings:* Gate trigger current IGT (A), Holding current IH (A), Break-over voltage (V), Turn-off gain, On-state current rating IT(RMS) (A), Heatsink |
| **PUT (Programmable UJT)** | Programmable UJT (2N6027): fires when the anode rises ≈0.6 V above the gate voltage (set by a divider) and conducts until the anode current falls below the valley current. Terminals: A (left), K (right), G (bottom). <br>*Settings:* Valley current (A), Peak current (A) |
| **Opto-TRIAC (MOC3021/3041)** | Optically isolated TRIAC driver: LED current ≥ IFT turns on the photo-TRIAC output (used to fire a power TRIAC gate). The zero-cross version only turns on near a voltage zero. <br>*Settings:* LED trigger current IFT (A), Zero-crossing (MOC3041), Output holding current (A) |
| **Opto-SCR (H11C1)** | Optically coupled SCR: current through the infrared LED (A–K, ≈1.2 V) generates gate current in a sensitive photo-SCR (SA → SK; ≈10 mA LED current triggers it with the internal 27 kΩ gate resistor); once fired it latches and conducts until its current falls below the holding current (so on AC it switches off at each zero crossing). Isolated triggering of thyristors from logic. <br>*Settings:* Photo gate current per LED current |
| **Isolated Gate Driver** | Isolated (floating) gate driver: when V(IN) − V(GND) exceeds the threshold, OUT is driven to Von above COM (connect COM to the MOSFET/IGBT source or emitter — even on the high side of a bridge). <br>*Settings:* Output high (Vgs) (V), Output low (V), Input threshold (V), Output resistance (Ω) |
| **Buck Converter Module** | Averaged step-down DC-DC converter (LM2596-style module): Vout = min(Vset, Vin − headroom); input current from power balance Iin = Vout·Iout / (η·Vin) — so the input current is less than the output current. <br>*Settings:* Output voltage set (V), Efficiency, Output resistance (Ω), Minimum headroom (V) |
| **Boost Converter Module** | Averaged step-up DC-DC converter (MT3608-style): Vout = max(Vset, Vin − diode drop); input current from power balance, so it draws more current than it delivers. <br>*Settings:* Output voltage set (V), Efficiency, Output resistance (Ω), Diode drop (V) |
| **H-Bridge Motor Driver** | Full H-bridge (two legs with freewheeling diodes) with logic inputs referred to GND. EN high: IN1/IN2 high connects OUT1/OUT2 to VS, low connects it to GND — IN1≠IN2 drives the motor one way or the other, IN1 = IN2 brakes it (both ends shorted). EN low turns every switch off and the motor coasts (current freewheels through the diodes). PWM on EN controls the speed. Also usable as a single-phase full-bridge inverter. <br>*Settings:* Model, Switch on-resistance (Ω) |
| **3-Phase Inverter Bridge** | Six-switch voltage-source inverter (IGBTs with freewheeling diodes) between the DC bus P / N. Logic inputs are referred to N: HA high connects output A to P, low connects it to N (complementary, with optional dead time during which only the diodes conduct); EN low turns everything off. Drive it with the SPWM generator to make variable-frequency three-phase AC for an induction motor. <br>*Settings:* Switch on-resistance (Ω), Dead time (s) |
| **BLDC Motor Driver (6-step)** | Six-step (trapezoidal) BLDC controller with a 3-phase MOSFET bridge: the Hall code (H1–H3, logic referred to N) selects which phase is switched to +V (chopped at the PWM duty cycle) and which to 0 V; the third phase floats. 101 → A+B−, 100 → A+C−, 110 → B+C−, 010 → B+A−, 011 → C+A−, 001 → C+B−. Reverse swaps the pair. Invalid codes (000/111) or EN low turn all switches off. <br>*Settings:* Speed command (PWM duty) (%), Direction, PWM frequency (Hz), Switch on-resistance (Ω) |
| **Stepper Motor Driver (A4988 class)** | Bipolar stepper driver: each rising edge on STEP advances the electrical angle by 90° / microsteps (backwards when DIR is low) and the two H-bridges regulate the winding currents to I·cos θ and I·sin θ by fixed-off-time chopping — drive the winding until the current reaches the target, then let it decay (slow decay) for the off time; fast decay through the diodes when the current must fall or reverse. ¬EN high disables the outputs. Inputs are logic levels referred to GND (100 kΩ pull-downs, so leaving ¬EN low enables it). <br>*Settings:* Current limit (per phase, peak) (A), Step mode, Chopper off time (s), Switch on-resistance (Ω) |
| **SPWM / V-f Modulator** | Sine-triangle PWM modulator for inverter bridges: compares sine references with a triangular carrier and outputs the leg commands HA/HB/HC (logic levels). V/f control: the frequency ramps from 0 to the set value over the acceleration time and the modulation index follows m·f/f_base (plus a small boost at low speed), keeping the motor flux constant. The fundamental line voltage of a 3-phase bridge is ≈0.612·m·Vdc RMS; third-harmonic injection lets m reach 1.15 without over-modulation (like space-vector PWM), i.e. up to ≈0.707·Vdc. <br>*Settings:* Output frequency (Hz), Modulation index at base frequency, Base frequency (V/f) (Hz), Low-speed voltage boost, Carrier frequency (Hz), Acceleration time (0 → f) (s), Outputs, Third-harmonic injection (SVPWM-equivalent), Phase sequence, Logic high level (V), Output resistance (Ω) |
| **Thyristor Firing Unit (1-phase bridge)** | Line-synchronised firing unit for a single-phase thyristor bridge: it detects the zero crossings of the sync voltage L–N and fires G1/K1 and G4/K4 at α in the positive half-cycle and G2/K2 and G3/K3 at α + 180°, through isolated pulse outputs (pulse-transformer style, each G–K pair floating). For a half-controlled bridge use outputs 1 and 2. <br>*Settings:* Firing angle α (°), Pulse width (°), Gate pulse voltage (V), Gate source resistance (Ω) |
| **Buck-Boost Converter (inverting)** | Inverting buck-boost: Vout = −Vin·D/(1 − D) — step up or down with reversed polarity (output negative with respect to GND). Averaged (switching-cycle mean) model in continuous conduction: open loop the output follows the conversion ratio; regulated, the duty cycle adjusts to hold Vset until it reaches the maximum duty. Input current follows from power balance. <br>*Settings:* Control, Output voltage set (magnitude) (V), Duty cycle (open loop) (%), Maximum duty cycle (%), Efficiency, Output resistance (Ω) |
| **Ćuk Converter** | Ćuk converter: Vout = −Vin·D/(1 − D) like the buck-boost, but energy passes through a series capacitor and both input and output currents are continuous (low ripple). Averaged (switching-cycle mean) model in continuous conduction: open loop the output follows the conversion ratio; regulated, the duty cycle adjusts to hold Vset until it reaches the maximum duty. Input current follows from power balance. <br>*Settings:* Control, Output voltage set (magnitude) (V), Duty cycle (open loop) (%), Maximum duty cycle (%), Efficiency, Output resistance (Ω) |
| **SEPIC Converter** | SEPIC: non-inverting Vout = Vin·D/(1 − D) — keeps a constant output whether the input is above or below it (e.g. 12 V from a 9–16 V battery). Averaged (switching-cycle mean) model in continuous conduction: open loop the output follows the conversion ratio; regulated, the duty cycle adjusts to hold Vset until it reaches the maximum duty. Input current follows from power balance. <br>*Settings:* Control, Output voltage set (magnitude) (V), Duty cycle (open loop) (%), Maximum duty cycle (%), Efficiency, Output resistance (Ω) |
| **Flyback Converter (isolated)** | Isolated flyback: Vout = Vin·n·D/(1 − D) with n = Ns/Np — the coupled-inductor stores energy while the switch is on and releases it to the output when off. Phone chargers and small adapters. Averaged (switching-cycle mean) model in continuous conduction: open loop the output follows the conversion ratio; regulated, the duty cycle adjusts to hold Vset until it reaches the maximum duty. Input current follows from power balance. <br>*Settings:* Control, Output voltage set (magnitude) (V), Duty cycle (open loop) (%), Turns ratio Ns/Np, Maximum duty cycle (%), Efficiency, Output resistance (Ω) |
| **Forward Converter (isolated)** | Single-switch forward converter: Vout = n·D·Vin; the transformer passes energy while the switch is on, D ≤ 0.5 for core reset. Averaged (switching-cycle mean) model in continuous conduction: open loop the output follows the conversion ratio; regulated, the duty cycle adjusts to hold Vset until it reaches the maximum duty. Input current follows from power balance. <br>*Settings:* Control, Output voltage set (magnitude) (V), Duty cycle (open loop) (%), Turns ratio Ns/Np, Maximum duty cycle (%), Efficiency, Output resistance (Ω) |
| **Push-Pull Converter (isolated)** | Push-pull converter: two switches drive a centre-tapped primary alternately: Vout = 2·n·D·Vin (D per switch ≤ 0.5). Averaged (switching-cycle mean) model in continuous conduction: open loop the output follows the conversion ratio; regulated, the duty cycle adjusts to hold Vset until it reaches the maximum duty. Input current follows from power balance. <br>*Settings:* Control, Output voltage set (magnitude) (V), Duty cycle (open loop) (%), Turns ratio Ns/Np, Maximum duty cycle (%), Efficiency, Output resistance (Ω) |
| **Half-Bridge Converter (isolated)** | Half-bridge converter: the primary sees ±Vin/2 from a split capacitor: Vout = n·D·Vin (D per switch ≤ 0.5). Averaged (switching-cycle mean) model in continuous conduction: open loop the output follows the conversion ratio; regulated, the duty cycle adjusts to hold Vset until it reaches the maximum duty. Input current follows from power balance. <br>*Settings:* Control, Output voltage set (magnitude) (V), Duty cycle (open loop) (%), Turns ratio Ns/Np, Maximum duty cycle (%), Efficiency, Output resistance (Ω) |
| **Full-Bridge Converter (isolated)** | Full-bridge converter: four switches apply ±Vin to the primary: Vout = 2·n·D·Vin (D per diagonal ≤ 0.5) — the high-power choice. Averaged (switching-cycle mean) model in continuous conduction: open loop the output follows the conversion ratio; regulated, the duty cycle adjusts to hold Vset until it reaches the maximum duty. Input current follows from power balance. <br>*Settings:* Control, Output voltage set (magnitude) (V), Duty cycle (open loop) (%), Turns ratio Ns/Np, Maximum duty cycle (%), Efficiency, Output resistance (Ω) |

### Analog ICs — 27

Op-amps (with gain-bandwidth and slew rate), comparators, the 555 timer, fixed and adjustable regulators and other analog building blocks. Real op-amp models: LM741, LM358, TL071 and more.

| | |
| --- | --- |
| **Op-Amp** | Operational amplifier macromodel: finite open-loop gain, single-pole GBW, slew-rate limiting, output swing limited to the supply rails (implicit supply pins). <br>*Settings:* Model, Open-loop gain A₀ (V/V), Gain-bandwidth (0 = ∞) (Hz), Slew rate (0 = ∞) (V/s), Positive supply (V), Negative supply (V), Output headroom (V), Output resistance (Ω) |
| **Voltage Follower (Buffer Amp)** | Op-amp with its output tied to the inverting input: OUT = IN with almost infinite input impedance and very low output impedance, so a weak source can drive a heavy load. Limited by the supply rails and slew rate. <br>*Settings:* Positive supply (V), Negative supply (V), Gain-bandwidth (Hz), Slew rate (V/s) |
| **Differential Amplifier** | Classic four-resistor difference amplifier: OUT = G·(V2 − V1) + REF, with R1 inputs and G·R1 feedback. Rejects the common-mode voltage on both inputs. Input impedance is R1 (V1) and R1 + G·R1 (V2). <br>*Settings:* Differential gain (V/V), Input resistors R1 (Ω), Positive supply (V), Negative supply (V), Gain-bandwidth (Hz), Slew rate (V/s) |
| **Transimpedance Amplifier** | Current-to-voltage converter: the input sits at virtual ground and OUT = −Iin · Rf. Cf across Rf sets the bandwidth (≈ 1/(2π·Rf·Cf)) and keeps it stable — the standard photodiode amplifier. <br>*Settings:* Feedback resistance Rf (Ω), Feedback capacitance Cf (F), Positive supply (V), Negative supply (V), Gain-bandwidth (Hz), Slew rate (V/s) |
| **Power Amplifier (TDA2030)** | Class-AB audio power amplifier (TDA2030-like): non-inverting gain set by internal feedback (default ×32 = 30 dB), split ±16 V supply, swings to about 1.8 V from each rail and drives a 4–8 Ω speaker directly. Clips when the output reaches the rails. <br>*Settings:* Voltage gain (V/V), Positive supply (V), Negative supply (V), Gain-bandwidth (Hz), Slew rate (V/s) |
| **Current Amplifier** | Current amplifier: the input IN+ → IN− is a short (zero-volt sense); OUT sources A × Iin into the load (to ground) as long as the output voltage stays within ±compliance, then it saturates like a real current mirror. <br>*Settings:* Current gain (A/A), Output compliance (V), Output resistance (Ω) |
| **Comparator** | Voltage comparator with hysteresis: output is high when V+ > V−. <br>*Settings:* Output high (V), Output low (V), Hysteresis (V), Output resistance (Ω) |
| **Comparator LM393 / LM339 (open collector)** | LM393/LM339-type comparator with an open-collector output: when V+ < V− the output transistor pulls OUT to ground; when V+ > V− the output is off (high impedance), so you need a pull-up resistor to the logic supply. Several outputs can be wired together (wired-AND). <br>*Settings:* Hysteresis (V), Output saturation resistance (Ω) |
| **Instrumentation Amp (INA128)** | Three-op-amp instrumentation amplifier: Vout = G·(V+ − V−) + Vref with G = 1 + 50 kΩ/RG. Infinite input impedance, output limited to the rails. <br>*Settings:* Gain resistor RG (Ω), Positive supply (V), Negative supply (V) |
| **OTA (LM13700)** | Operational transconductance amplifier: current output Iout = IABC·tanh((V+ − V−)/2Vt), i.e. gm = IABC/(2Vt) for small signals — a voltage-controlled gain element. <br>*Settings:* Bias current IABC (A) |
| **Audio Amp (LM386)** | Low-voltage audio power amplifier: output biased at Vs/2, gain 20–200, clips ≈0.5 V from the rails, ≈0.5 Ω output. Couple the speaker through a capacitor (e.g. 220 µF). <br>*Settings:* Voltage gain, Supply voltage (V) |
| **Analog Multiplier (AD633)** | Four-quadrant multiplier: W = (X1 − X2)·(Y1 − Y2)/10 V + Z. <br>*Settings:* Positive supply (V), Negative supply (V) |
| **555 Timer** | NE555 timer: internal 5k/5k/5k divider, two comparators, SR flip-flop, output stage and discharge transistor. <br>*Settings:* Output resistance (Ω), Output high drop (V) |
| **556 Dual Timer** | Two independent 555 timers sharing VCC and GND (NE556). Each half has its own trigger, threshold, control, reset, output and discharge pins — e.g. one astable driving another monostable. <br>*Settings:* Output resistance (Ω), Output high drop (V) |
| **PLL (CD4046)** | Phase-locked loop: VCO whose frequency goes from fmin (0 V) to fmax (VDD) with VCOIN, phase comparator 1 (XOR of SIG and COMP) and phase comparator 2 (edge-triggered phase-frequency detector with a tri-state output: high = VCO too slow, low = too fast, high-Z = in lock). Close the loop: VCO → COMP, PC2 → RC low-pass filter → VCOIN, and the VCO locks to the frequency on SIG. <br>*Settings:* VCO frequency at 0 V (Hz), VCO frequency at VDD (Hz), Supply / logic level (V), Output resistance (Ω) |
| **78xx Regulator** | Fixed linear regulator (7805 family): Vout = min(Vset, Vin − Vdropout) with current limiting. <br>*Settings:* Output voltage (V), Dropout voltage (V), Current limit (A), Heatsink |
| **79xx Negative Regulator** | Negative fixed regulator (7905 family): OUT = −Vset relative to GND when IN is at least Vset + dropout below ground. <br>*Settings:* Output voltage magnitude (V), Dropout voltage (V), Current limit (A), Heatsink |
| **LM317 Adjustable** | Adjustable regulator: keeps 1.25 V between OUT and ADJ. Vout = 1.25·(1 + R2/R1). <br>*Settings:* Dropout voltage (V), Current limit (A), Heatsink |
| **LM337 Negative Adjustable** | Negative adjustable regulator: keeps OUT 1.25 V below ADJ. With R1 from OUT to ADJ and R2 from ADJ to ground, Vout = −1.25·(1 + R2/R1). The negative partner of the LM317. <br>*Settings:* Dropout voltage (V), Current limit (A), Heatsink |
| **LDO Regulator** | Low-dropout linear regulator: holds Vout down to about 0.25 V of headroom (vs 2 V for a 78xx) — ideal for battery-powered 3.3 V circuits. <br>*Settings:* Output voltage (V), Dropout voltage (V), Current limit (A), Heatsink |
| **Shunt Regulator (TL431)** | Programmable shunt regulator: sinks cathode current until REF − A = 2.495 V (like an adjustable precision zener). Vka = 2.495·(1 + R1/R2) with a divider from K to REF. Terminals: REF (left), K (top), A (bottom). <br>*Settings:* Reference voltage (V) |
| **Precision Reference (LM4040)** | Two-terminal precision shunt reference (2.048/2.5/4.096/5 V): behaves like a very sharp Zener. Bias it with ≥ 60 µA through a resistor. <br>*Settings:* Reference voltage (V) |
| **Charge-Pump Inverter (ICL7660)** | Switched-capacitor voltage inverter (averaged): OUT ≈ −V+ with ≈55 Ω output resistance. <br>*Settings:* Efficiency, Output resistance (Ω) |
| **Analog Switch (CD4066)** | Bilateral CMOS switch: A–B conduct (≈125 Ω) while CTRL is above VDD/2 (with hysteresis); otherwise open. <br>*Settings:* On resistance (Ω), Logic supply (V) |
| **Sample & Hold (LF398)** | Tracks the input while CTRL is high and holds the last value when CTRL goes low. <br>*Settings:* Control threshold (V) |
| **VCO (Voltage-Controlled Osc.)** | Voltage-controlled oscillator: f = f0 + Kv·Vin (never negative). Square, sine or triangle output. <br>*Settings:* Centre frequency (Vin = 0) (Hz), Sensitivity (Hz/V), Output high (V), Output |
| **True-RMS Converter (AD736)** | True-RMS to DC converter: OUT = √(mean(IN²)) with an averaging time constant. <br>*Settings:* Averaging time (s) |

### Control & Math — 22

Signal-flow blocks, as in Simulink: gain, adders, multiplier, integrator, differentiator, transfer functions, PID, limiter, delay and mathematical functions. They work on voltages standing for signals.

| | |
| --- | --- |
| **Gain Block K** | y = K·u <br>*Settings:* Gain K |
| **Summer Σ (2 inputs)** | y = k1·u1 + k2·u2 (default u1 − u2: an error signal). <br>*Settings:* Weight of input 1, Weight of input 2 |
| **Summer Σ (3 inputs)** | y = k1·u1 + k2·u2 + k3·u3 <br>*Settings:* Weight of input 1, Weight of input 2, Weight of input 3 |
| **Multiplier ×** | y = K·u1·u2 (ideal multiplier — mixers, modulators, power calculation). <br>*Settings:* Scale |
| **Divider ÷** | y = K·u1 / u2 (denominator limited to ±ε to avoid division by zero). <br>*Settings:* Scale, Minimum \|denominator\| (V) |
| **Integrator ∫** | y = Ki·∫u dt + y0 (trapezoidal integration, optional output limit with anti-windup). <br>*Settings:* Gain Ki (1/s), Initial output (V), Output limit ± (0 = none) (V) |
| **Differentiator d/dt** | y = Kd·s/(τs + 1)·u — a derivative with a small first-order filter so it stays well-behaved. <br>*Settings:* Gain Kd (s), Filter time constant (s) |
| **Transfer Function (1st order)** | G(s) = K / (τs + 1): first-order lag (e.g. a plant, sensor or low-pass filter). <br>*Settings:* DC gain K, Time constant τ (s) |
| **Transfer Function (2nd order)** | G(s) = K·ωn² / (s² + 2ζωn·s + ωn²): standard second-order system — step response overshoot, resonance. <br>*Settings:* DC gain K, Natural frequency fn (Hz), Damping ratio ζ |
| **PID Controller** | Parallel PID on the error e = SP − PV: u = Kp·e + Ki∫e + Kd·de/dt (filtered), with output limits and integrator anti-windup. <br>*Settings:* Kp, Ki (1/s), Kd (s), Derivative filter τ (s), Output max (V), Output min (V) |
| **Saturation / Limiter** | y = clamp(u, lower, upper). <br>*Settings:* Upper limit (V), Lower limit (V) |
| **Absolute Value \|u\|** | y = \|u\| (ideal full-wave rectifier). |
| **Square Root √u** | y = √u (0 for negative inputs). |
| **Power uⁿ** | y = sign(u)·\|u\|ⁿ (odd-symmetric), or \|u\|ⁿ when "even" is set. <br>*Settings:* Exponent n, Even (\|u\|ⁿ) |
| **Logarithm** | y = K·log(max(u, ε)) — natural or base-10. <br>*Settings:* Scale, Base |
| **Exponential eᵘ** | y = K·e^u (u limited to 80). <br>*Settings:* Scale |
| **Trig Function** | y = K·trig(u) with u in radians. <br>*Settings:* Scale, Function |
| **Function Block f(u,v,t)** | Output from any formula of the inputs u, v, time t and parameter k (same functions as the Function Source). Derivatives are computed numerically for Newton’s method. <br>*Settings:* y =, Parameter k |
| **Transport Delay** | y(t) = u(t − T): pure time delay (dead time). <br>*Settings:* Delay T (s) |
| **Zero-Order Hold (sampler)** | Samples the input every Ts and holds it — models the sampling of a digital controller or ADC. <br>*Settings:* Sample period (s) |
| **Rate Limiter** | Output follows the input but changes no faster than ±R (slew-rate limit / soft start). <br>*Settings:* Max rate (V/s) |
| **Relay (Hysteresis)** | Two-level relay with hysteresis (bang-bang control): turns on when u > on-point, off when u < off-point. <br>*Settings:* Switch-on point (V), Switch-off point (V), Output when on (V), Output when off (V) |

### Logic Gates — 20

Inputs, outputs and gates. **Logic input** is a switch you tap (HIGH/LOW); **Clock** gives a square wave; **Logic output** is an indicator that shows 1 (lit) or 0. Gates give outputs from the logic levels at their inputs.

| | |
| --- | --- |
| **Logic Input** | Tap to toggle between logic HIGH and LOW. <br>*Settings:* State, Momentary (push button), Logic high level (V), Output resistance (Ω) |
| **Logic Probe** | Shows the logic level of a node (threshold at VDD/2). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Hex Keypad (4-bit input)** | Hex thumbwheel: tap to step 0 → F; drives D0–D3 with the binary value. <br>*Settings:* Value (0–15), Logic high level (V), Output resistance (Ω) |
| **Clock** | Digital clock (0 V / high level square wave) referenced to ground. <br>*Settings:* Frequency (Hz), High level (V), Duty cycle (%), Phase (°) |
| **AND Gate** | AND gate. Inputs switch at VDD/2 with hysteresis; output drives VDD or 0 V through its output resistance. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **OR Gate** | OR gate. Inputs switch at VDD/2 with hysteresis; output drives VDD or 0 V through its output resistance. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **NOT Gate** | NOT Gate. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **NAND Gate** | NAND gate. Inputs switch at VDD/2 with hysteresis; output drives VDD or 0 V through its output resistance. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **NOR Gate** | NOR gate. Inputs switch at VDD/2 with hysteresis; output drives VDD or 0 V through its output resistance. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **XOR Gate** | XOR gate. Inputs switch at VDD/2 with hysteresis; output drives VDD or 0 V through its output resistance. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **XNOR Gate** | XNOR gate. Inputs switch at VDD/2 with hysteresis; output drives VDD or 0 V through its output resistance. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Buffer** | Buffer. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Schmitt Inverter** | Inverter with Schmitt-trigger input (thresholds at 33 % and 60 % of VDD) – great for RC oscillators. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Tri-State Buffer** | Buffer with output enable: when EN is high Y follows A; when EN is low the output is high-impedance (disconnected) so several drivers can share a bus. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **AND Gate (3-input)** | 3-input AND gate. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **OR Gate (3-input)** | 3-input OR gate. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **NAND Gate (3-input)** | 3-input NAND gate. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **NOR Gate (3-input)** | 3-input NOR gate. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **AND Gate (4-input)** | 4-input AND gate. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **NAND Gate (4-input)** | 4-input NAND gate. <br>*Settings:* Logic high level (V), Output resistance (Ω) |

### Digital ICs — 46

Adders, comparators, multiplexers, decoders, latches, flip-flops, counters, shift registers, monostable, ADC and DAC. Drive them with a **Clock** and **Logic inputs**, and watch with **Logic output** or a 7-segment display.

| | |
| --- | --- |
| **Half Adder** | S = A ⊕ B, C = A·B. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Full Adder** | S = A ⊕ B ⊕ Cin, Cout = majority(A, B, Cin). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Half Subtractor** | D = A ⊕ B (difference), Bo = Ā·B (borrow out). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Full Subtractor** | D = A ⊕ B ⊕ Bin, Bo = Ā·B + Bin·(A ⊙ B) — computes A − B − Bin. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Subtractor** | D = A − B − Bin (4 bits); Bo = 1 when the result is negative (the D bits then hold the two's-complement value). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Adder (74HC283)** | Adds two 4-bit numbers with carry-in: S = A + B + Cin (carry out on Cout). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Comparator (74HC85)** | Compares two 4-bit numbers A and B. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **2:1 Multiplexer** | Y = S ? I1 : I0. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4:1 Multiplexer** | Y = I[S1S0]. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Demultiplexer 1-to-4** | Routes the data input D to the output selected by S1S0; the other outputs stay low. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **2-to-4 Decoder (74HC139)** | Active-high outputs: Y[A1A0] = 1 while EN is high. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **3-to-8 Decoder (74HC138)** | Active-high one-of-eight decoder with enable. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Priority Encoder 4-to-2** | Outputs the binary index of the highest active input; V = any input active. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Priority Encoder 8-to-3 (74HC148)** | Outputs the binary number of the highest active input (I7 has priority); GS = any input active. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Encoder 4-to-2 (no priority)** | Simple binary encoder made of OR gates: A0 = I1 + I3, A1 = I2 + I3. Exactly one input should be high (I0 gives 00, like no input — use the priority encoder when inputs can overlap). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Parity Generator (4-bit)** | EVEN = parity bit that makes the total count of 1s even; ODD is its complement. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **BCD→7-Seg Decoder** | Hex/BCD to 7-segment decoder (active-high outputs a–g, like the CD4511 for 0–9, extended to A–F). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **D Latch** | Transparent latch: Q follows D while EN is high and holds when EN goes low. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **SR Latch** | Level-sensitive SR latch (NOR type): S sets, R resets, S=R=1 is invalid (both outputs low). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **SR Flip-Flop (clocked)** | On each rising clock edge: S=1 sets Q, R=1 resets Q, S=R=0 holds. S=R=1 is the forbidden input (Q holds here). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **D Flip-Flop** | Positive-edge-triggered D flip-flop: Q takes the value of D on each rising clock edge. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **JK Flip-Flop** | JK flip-flop (rising edge): J=K=1 toggles, J=1 sets, K=1 resets. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **T Flip-Flop** | Toggle flip-flop: Q inverts on each rising clock edge while T is high (frequency divider). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Counter** | 4-bit binary up-counter: increments on rising clock edges; an asynchronous reset holds it at 0 while RST is high. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Up/Down Counter** | Counts up (UP = 1) or down (UP = 0) on rising clock edges; RST clears to 0. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **BCD Counter (74HC390)** | Counts 0–9 in BCD. CO goes high as the count wraps from 9 to 0 (high for 0–4), so wiring CO to the next counter's CLK cascades digits (00 → 99). Drive a 7-segment decoder with Q0–Q3. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Decade Counter (CD4017)** | Ten decoded outputs: exactly one output is high and it advances on every rising clock edge — the classic LED chaser. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **8-bit Counter** | 8-bit binary up-counter (0–255) with reset. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Ring Counter (4-bit)** | A single 1 circulates Q0 → Q1 → Q2 → Q3 → Q0 on each rising clock edge (4 states). RST loads 0001. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Johnson Counter (4-bit)** | Twisted-ring counter: the inverted last bit feeds back, giving 8 states 0000 → 0001 → 0011 → 0111 → 1111 → 1110 → 1100 → 1000 with only one bit changing per step. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Shift Register (SIPO)** | On each rising clock edge the bits shift Q0→Q3 and DATA enters Q0. RST clears. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Shift Register 4-bit (SISO)** | Serial in, serial out: each rising clock edge shifts DATA in; it appears at SOUT four clocks later. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Shift Register 8-bit PISO (74HC165)** | Parallel in, serial out: with SH/LD̄ low the eight inputs are loaded; with it high each rising clock edge shifts the bits towards Q7 (D7 comes out first, SER fills from D0). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Shift Register 74HC595 (latched)** | 8-bit serial-in shift register with an output latch: each rising SRCLK edge shifts SER into the register (Q7′ is the serial output for cascading); a rising RCLK edge copies the register to Q0–Q7 at once, so the outputs never show the shifting. ¬OE high tri-states (here: pulls low) the outputs. With MSB-first SPI, the first bit sent ends on Q7. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Universal Shift Register (74HC194)** | Four modes on S1S0 at each rising clock edge: 00 hold, 01 shift right (DSR enters Q0), 10 shift left (DSL enters Q3), 11 parallel load D0–D3. So it works as SISO, SIPO, PISO or PIPO. CLR (high) clears. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Register (74HC175)** | Stores D0–D3 on each rising clock edge. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Monostable (74HC121)** | One-shot: a rising edge on TRIG produces a single output pulse of width tw (not retriggerable). <br>*Settings:* Pulse width (s), Logic high level (V), Output resistance (Ω) |
| **Programmable Timer (count-down)** | Digital interval timer: a rising edge on START loads N; OUT stays high while it counts N clock pulses down to zero, then DONE goes high. Use a 1 Hz clock for an N-second timer. RST aborts and clears DONE. <br>*Settings:* Count N (clock pulses), Logic high level (V), Output resistance (Ω) |
| **Clock Divider ÷N** | Divides the clock frequency by N (50 % duty for even N). <br>*Settings:* Divide by N, Logic high level (V), Output resistance (Ω) |
| **4-bit ADC** | 4-bit flash ADC: code = floor(16·Vin/Vref), clamped to 0–15. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit DAC** | 4-bit DAC: Vout = Vref · code / 16. <br>*Settings:* Reference voltage (V), Logic high level (V), Output resistance (Ω) |
| **8-bit ADC (ADC0804)** | 8-bit analog-to-digital converter: code = round(256 · Vin / Vref) clamped to 0–255 (1 LSB = Vref/256 ≈ 19.5 mV at 5 V). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **8-bit DAC (R-2R)** | 8-bit R-2R digital-to-analog converter: OUT = Vref · code / 256 behind its output resistance. <br>*Settings:* Reference voltage (V), Logic high level (V), Output resistance (Ω) |
| **Logic Level Converter (4-ch)** | Four-channel level translator: inputs A1–A4 switch at half the low-side level (e.g. 1.65 V for 3.3 V logic) and the B outputs drive the high-side level (e.g. 5 V) — lets 3.3 V and 5 V logic talk to each other. <br>*Settings:* Low-side logic level (A) (V), High-side logic level (B) (V), Output resistance (Ω) |
| **RAM 16×4 (74HC189)** | 16 words × 4 bits of static RAM. A0–A3 select the word; while WE is high the data D0–D3 is written into it; Q0–Q3 always show the stored word at the current address. Contents are cleared when the simulation restarts. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **ROM 16×8 (programmable)** | Read-only memory with 16 bytes you can edit (hex, separated by spaces). While CE is high the byte at address A3–A0 appears on D0–D7. The default contents are the 7-segment patterns for 0–F (D0 = segment a … D6 = g), so it works as a hex-to-7-segment decoder. <br>*Settings:* Contents (16 hex bytes), Logic high level (V), Output resistance (Ω) |

### Communication — 18

Behavioural communication blocks (no firmware or code runs): UART transmitter and terminal, RS-232, RS-485 and CAN transceivers, I²C and SPI masters with real slave chips (PCF8574, 74HC595), wireless links with a link budget (433 MHz, nRF24L01, Bluetooth LE, Wi-Fi, LoRa, Zigbee), an RFID reader, a fibre link, and signal blocks for radio (filters, RF amplifier, mixer, envelope detector, antenna). The messages are typed into the transmitter's settings.

| | |
| --- | --- |
| **Antenna** | Antenna between its feed point and ground: as a receiver it is a source of V = E·h_eff (effective length = fraction × wavelength) behind its radiation resistance; driven by a transmitter, the power in the radiation resistance is radiated. A half-wave dipole: 73 Ω, h_eff = λ/π. <br>*Settings:* Incident field strength (peak) (V/m), Signal frequency (Hz), Type, Radiation resistance (Ω), Effective length (fraction of λ) |
| **RF Amplifier (tuned)** | Tuned (band-pass) RF amplifier with 50 Ω input and output: gain at the centre frequency, 2nd-order band-pass response, and soft compression towards the output limit (gain falls 1 dB near the P1dB point). The noise figure is shown for link-budget work. <br>*Settings:* Gain (dB), Centre frequency (Hz), Bandwidth (Hz), Output limit (≈P1dB) (V), Noise figure (dB) |
| **RF Mixer (RF × LO)** | Ideal double-balanced mixer: IF = k·RF·LO. Two input tones f_RF and f_LO give the sum and difference frequencies (f_RF ± f_LO) — the heart of the superheterodyne receiver; follow it with a filter to keep the IF. <br>*Settings:* Conversion gain (per volt of LO) (1/V) |
| **Envelope Detector** | Diode + RC envelope (peak) detector as an ideal block: the output follows the input peaks and decays with the RC time constant in between. Choose 1/f_carrier ≪ RC ≪ 1/f_audio to recover the audio from an AM signal without diagonal clipping. <br>*Settings:* Discharge time constant RC (s), Diode drop (V), Rectification |
| **Active Filter Block** | Ideal active filter of order 1–8: Butterworth (flat pass band), Chebyshev (1 dB ripple, steepest roll-off) or Bessel (constant group delay, no overshoot). Low/high-pass use the cut-off frequency (−3 dB, or the ripple edge for Chebyshev); band-pass/stop use it as the centre with the given bandwidth. Roll-off = 20 dB/decade per order. Input: high impedance to ground; output: voltage source. Use the AC analysis (Bode plot) to see the exact response. <br>*Settings:* Cut-off / centre frequency (Hz), Type, Response, Order, Bandwidth (band-pass / stop) (Hz), Pass-band gain (dB), Output resistance (Ω) |
| **SAW Band-Pass Filter** | Surface-acoustic-wave band-pass filter (behavioural): a very selective RF band-pass (modelled as 3rd-order Chebyshev) with a few dB insertion loss, 50 Ω in and out — the front-end filter of 433/868/915 MHz receivers and remote controls. <br>*Settings:* Centre frequency (Hz), 3 dB bandwidth (Hz), Insertion loss (dB) |
| **EMI Line Filter** | Mains EMI filter: X capacitors across the line (input and output), a common-mode choke (two tightly coupled windings that cancel for the normal load current but block common-mode noise) and Y capacitors from each output line to PE, with a bleeder resistor. Passes 50 Hz unchanged; attenuates conducted noise above ≈100 kHz (see the AC analysis). <br>*Settings:* Common-mode choke (each winding) (H), X capacitors (F), Y capacitors (F) |
| **UART Transmitter** | Asynchronous serial transmitter (behavioural, no code): sends the message as UART frames — line idles high, each character is a start bit (0), 8 data bits LSB first, optional parity and stop bit(s) — at the set baud rate, then pauses and repeats. EN must be high (100 kΩ pull-up: unconnected = enabled). <br>*Settings:* Message, Baud rate (Bd), Parity, Stop bits, Pause between messages (s), Repeat, Logic high level (V), Output resistance (Ω) |
| **UART Receiver (terminal)** | Serial receiver / terminal: detects each start bit on RX, samples the data bits in the middle of each bit time at the set baud rate and shows the received text (framing and parity errors are counted). RDY pulses high for one bit time after every received character. Baud rate and format must match the transmitter. <br>*Settings:* Baud rate (Bd), Parity, Stop bits, Logic high level (V), Output resistance (Ω) |
| **RS-485 Transceiver** | Half-duplex RS-485 transceiver (MAX485 style). DE high: the driver puts DI on the differential pair (A − B ≈ +3.4 V open, ≥ 1.5 V into a 54 Ω terminated bus for DI = 1; reversed for 0). DE low: the driver is off and A/B present one unit load (12 kΩ to 2.5 V). The receiver output RO = 1 when A − B > −50 mV (fail-safe: idle or terminated bus reads 1), 0 below −200 mV. Terminate both bus ends with 120 Ω. |
| **RS-232 Transceiver (MAX232)** | TTL ⇄ RS-232 level converter with built-in charge pumps: TIN (TTL) → TOUT at ±9 V, inverted (logic 1 = mark = −9 V); RIN (RS-232, 5 kΩ input) → ROUT (TTL, inverted) with thresholds ≈1.0 / 1.7 V. Cross TOUT→RIN between two of them to link two UARTs over a cable. |
| **CAN Bus Transceiver** | High-speed CAN transceiver (TJA1050 style): TXD low = dominant — CANH is driven towards 3.5 V and CANL towards 1.5 V (≈2 V differential on a 60 Ω bus); TXD high = recessive — both lines float at 2.5 V through the bias resistors, so any dominant node wins (wired-AND arbitration). RXD = 0 when CANH − CANL > 0.9 V, 1 below 0.5 V. Terminate both bus ends with 120 Ω. |
| **Wireless Link (TX → RX)** | Behavioural radio link (transmitter + receiver as one part, no firmware): received power = Ptx + antenna gains − path loss, with path loss = free-space loss at 1 m + 10·n·log10(d). If it is above the receiver sensitivity the output reproduces the input after the radio’s latency (digital: pulses shorter than one bit at the data rate are lost; analog: received with noise that grows as the margin shrinks); out of range the output stays low. Presets: 433 MHz ASK, nRF24L01, Bluetooth LE, Wi-Fi, LoRa, Zigbee. <br>*Settings:* Distance (m), Radio, Environment, Frequency (Hz), Transmit power (dBm), Receiver sensitivity (dBm), Data rate (bit/s), Latency (s), Antenna gains (TX + RX) (dBi), Signal, Logic high level (V), Output resistance (Ω) |
| **RFID Reader (125 kHz, UART out)** | Behavioural 125 kHz RFID reader (RDM6300 style): while a tag is within the read range, TAG goes high and the tag ID is sent on TX as UART text (9600 8N1) framed by STX/ETX, repeated every 0.1 s. Connect TX to a UART receiver to see the ID. <br>*Settings:* Tag distance (cm), Tag ID (10 hex digits), Read range (cm), Baud rate (Bd), Logic high level (V), Output resistance (Ω) |
| **Fibre-Optic Link** | Optical link: LED/laser transmitter → fibre → photodiode receiver with a comparator. Received power = Ptx − attenuation × length − connector losses; above the receiver sensitivity the output reproduces the input after the propagation delay (≈4.9 ns per metre, n = 1.47); below it the output stays low. Immune to electrical noise and provides galvanic isolation. <br>*Settings:* Fibre length (m), Fibre, Attenuation (dB/km), Transmitter power (dBm), Receiver sensitivity (dBm), Connector losses (dB), Logic high level (V), Output resistance (Ω) |
| **SPI Master (byte sender)** | Behavioural SPI master (mode 0, MSB first, no code): for each byte it pulls ¬CS low, clocks out eight bits on MOSI (data changes while SCK is low, the slave samples on the rising edge) and releases ¬CS, then pauses — cycling through the list. Drive a 74HC595 (SCK→SRCLK, MOSI→SER, ¬CS→RCLK) to set eight outputs. <br>*Settings:* Bytes to send (hex), Clock frequency (Hz), Pause between bytes (s), Logic high level (V), Output resistance (Ω) |
| **I²C Master (byte writer)** | Behavioural I²C master (no code): repeatedly writes one data byte per transaction to the slave address — START, address + W, ACK, data, ACK, STOP — through open-drain SCL/SDA (add pull-up resistors, e.g. 4.7 kΩ to 5 V). It checks the slave’s acknowledge bits and reports ACK / NACK. <br>*Settings:* 7-bit slave address, Data bytes (hex), Bus speed (Hz), Pause between transactions (s), Logic supply (thresholds) (V) |
| **I²C I/O Expander (PCF8574)** | I²C slave with eight quasi-bidirectional port pins: it watches SCL/SDA for a START, compares the address, acknowledges by pulling SDA low on the 9th clock, and writes each received data byte to P0–P7 (1 = weak pull-up ≈100 µA, 0 = strong sink ≈25 mA — so LEDs are connected from VCC to the pin, active low). Default address 0x20. <br>*Settings:* 7-bit address, Supply (V) |

### Sensors — 58

Each sensor has an **environment knob**: light for an LDR, temperature for an NTC or LM35, strain for a strain gauge, field for a Hall sensor, and so on. Turn it while running to see the sensor respond. Tap a PIR to simulate motion.

| | |
| --- | --- |
| **LDR (Photoresistor)** | Light-dependent resistor (CdS, e.g. GL5528): R = R10·(E/10 lx)^(−γ), limited by the dark resistance. <br>*Settings:* Illuminance (lx), Resistance at 10 lx (Ω), Gamma, Dark resistance (Ω) |
| **Photodiode** | Photodiode: diode in parallel with a light-generated current flowing cathode→anode. Use reverse-biased (photoconductive) or with a transimpedance amplifier. <br>*Settings:* Illuminance (lx), Responsivity (A/lx), Dark saturation current (A), Emission coefficient |
| **Phototransistor** | NPN phototransistor (collector top, emitter bottom). Light generates base current that is amplified by β. <br>*Settings:* Illuminance (lx), Base photocurrent (A/lx), Forward β (hFE), Saturation current Is (A), Reverse β, Early voltage (0 = ∞) (V) |
| **Solar Cell** | Photovoltaic cell/panel (single-diode model): I = Iph − Is(e^(V/(N·n·Vt)) − 1). Connect a load and sweep it to trace the I–V curve. <br>*Settings:* Irradiance (W/m²), Isc @1000 W/m² (A), Voc (per cell) (V), Cells in series |
| **NTC Thermistor** | NTC thermistor, β-model: R = R25·exp(β(1/T − 1/298.15 K)). <br>*Settings:* Temperature (°C), R at 25 °C (Ω), β constant (K) |
| **PTC Thermistor** | Switching PTC thermistor: roughly constant below its Curie temperature, then its resistance rises steeply (≈×10 per 10 °C). <br>*Settings:* Temperature (°C), R at 25 °C (Ω), Switching (Curie) temperature (°C) |
| **RTD (Pt100)** | Platinum RTD, Callendar–Van Dusen (IEC 60751): R = R0(1 + A·T + B·T² [+ C(T−100)T³ for T<0]). <br>*Settings:* Temperature (°C), R at 0 °C (Ω) |
| **RTD (Pt1000)** | Platinum RTD with R0 = 1000 Ω (IEC 60751 Callendar–Van Dusen). <br>*Settings:* Temperature (°C), R at 0 °C (Ω) |
| **Thermocouple (K)** | Type-K thermocouple (linearised, 41 µV/°C): V = S·(Thot − Tcold). Needs amplification — try an op-amp stage. <br>*Settings:* Hot junction (°C), Cold junction (°C), Seebeck coefficient (V/°C), Lead resistance (Ω) |
| **LM35 Temp Sensor** | Precision centigrade temperature sensor: Vout = 10 mV/°C · T (needs 4–30 V supply). <br>*Settings:* Temperature (°C), Scale factor (V/°C) |
| **LM335 Temp Sensor** | Two-terminal temperature sensor that behaves like a Zener of 10 mV/K: 2.98 V at 25 °C. Bias with ≈1 mA through a resistor (cathode = +). <br>*Settings:* Temperature (°C) |
| **Strain Gauge** | Metal-foil strain gauge: R = R0(1 + GF·ε). Use four in a Wheatstone bridge for a load cell. <br>*Settings:* Strain (µε), Nominal resistance (Ω), Gauge factor |
| **Load Cell (bridge)** | Full Wheatstone bridge of four strain gauges: output (S+ − S−) = Vexc × rated mV/V × load / capacity (e.g. 2 mV/V). Needs an instrumentation amplifier. <br>*Settings:* Load (kg), Capacity (kg), Rated output (mV/V), Bridge resistance (Ω) |
| **Force Sensor (FSR)** | Force-sensing resistor (FSR 402-like): R ≈ R1N / F (power-law), open-circuit when unloaded. <br>*Settings:* Force (N), R at 1 N (Ω), No-load resistance (Ω) |
| **Flex Sensor** | Flex/bend sensor: resistance rises linearly with bend angle. <br>*Settings:* Bend angle (°), Flat resistance (Ω), Resistance at 90° (Ω) |
| **LVDT (displacement)** | Linear variable differential transformer: an AC-excited primary and two series-opposed secondaries. The movable core shifts the coupling, so the output amplitude is proportional to displacement and its phase flips at the centre (null) position. <br>*Settings:* Core position (%), Primary inductance (H), Secondary inductance (each) (H), Coupling at centre |
| **Hall Sensor** | Linear ratiometric Hall sensor: Vout = VCC·(0.5 + S·B/5 V), clamped near the rails. <br>*Settings:* Magnetic flux density (G), Sensitivity @5 V (V/G) |
| **Hall Switch (A3144)** | Unipolar Hall switch with open-collector output: pulls OUT low when the south-pole field exceeds the operate point (needs a pull-up resistor). <br>*Settings:* Magnetic field (G), Operate point (G) |
| **Current Sensor (ACS712)** | Hall-effect current sensor: current through IP+ → IP− (1.2 mΩ, isolated) gives Vout = Vcc/2 + S·I (S ratiometric to 5 V). <br>*Settings:* Range |
| **AC Voltage Sensor (ZMPT101B)** | Isolated AC voltage sensor module: high-impedance input (L–N, ≈1 MΩ) and an output biased at Vcc/2 that swings k·Vin around it — feed it to an ADC. <br>*Settings:* Output per input volt (V/V) |
| **Accelerometer (ADXL335)** | Analog accelerometer axis: ratiometric output Vcc/2 at 0 g, sensitivity ≈10 % of Vcc per g (300 mV/g at 3 V). <br>*Settings:* Acceleration (g) |
| **Tilt Switch** | Rolling-ball tilt switch: closed when upright, opens when tilted beyond the switching angle. <br>*Settings:* Tilt angle (°), Switching angle (°) |
| **PIR Motion Sensor** | PIR motion module (HC-SR501-like): tap it to simulate motion; output stays HIGH for the hold time. <br>*Settings:* Motion detected, Hold time (s), Output high (V) |
| **IR Obstacle Sensor (FC-51)** | Reflective IR obstacle sensor: output goes LOW when an object is closer than the set range (active-low module with on-board pull-up). <br>*Settings:* Object distance (cm), Detection range (cm) |
| **IR Distance Sensor (GP2Y0A21)** | Sharp triangulating IR distance sensor (10–80 cm): Vout ≈ 30·d^−1.17 (nonlinear, higher when closer). <br>*Settings:* Distance (cm) |
| **Ultrasonic Range Finder** | Analog ultrasonic range finder (MaxBotix LV style): Vout = (Vcc/512) per inch of distance. <br>*Settings:* Distance (cm) |
| **Gas Sensor (MQ)** | Metal-oxide gas sensor element (MQ-series, heater omitted): Rs = R0·(ppm/1000)^(−slope). <br>*Settings:* Gas concentration (ppm), R0 (at 1000 ppm) (Ω), Log slope |
| **Humidity Sensor** | Capacitive humidity sensor (HS1101-like): C = C55 + S·(RH − 55 %). Use it as the timing capacitor of a 555 to get a frequency output. <br>*Settings:* Relative humidity (%RH), C at 55 %RH (F), Sensitivity (F/%RH) |
| **Soil Moisture Probe** | Two-prong resistive soil probe: resistance falls (logarithmically) from dry to wet. Use it in a divider with a comparator for automatic irrigation. <br>*Settings:* Moisture (%), Resistance when dry (Ω), Resistance when saturated (Ω) |
| **Rain Sensor Plate** | Interleaved-track rain plate: very high resistance when dry, falling to a few kΩ as water bridges the tracks. <br>*Settings:* Wetness (%) |
| **Pressure Sensor (MPX5010)** | Integrated pressure sensor: Vout = Vs·(0.09·P[kPa] + 0.04) (ratiometric). <br>*Settings:* Pressure (kPa) |
| **Flame Sensor (IR)** | IR flame module (analog output): output falls from ≈Vcc towards 0.1·Vcc as the flame intensity rises. <br>*Settings:* Flame intensity (%) |
| **UV Sensor (GUVA-S12SD)** | UV photodiode module: Vout ≈ UV index / 10 (V). <br>*Settings:* UV index |
| **Anemometer (wind speed)** | Cup anemometer with analog output: 0.4 V (calm) to 2.0 V at 32.4 m/s, linear. <br>*Settings:* Wind speed (m/s) |
| **Water Flow Sensor (YF-S201)** | Turbine flow meter with a Hall pulse output: f = 7.5 × Q (L/min) square wave. <br>*Settings:* Flow rate (L/min), Pulses per L/min (Hz) |
| **Rotary Encoder (quadrature)** | Incremental encoder: channels A and B are square waves 90° apart at ppr × rpm / 60 Hz; B leads A when turning backwards (negative rpm). <br>*Settings:* Shaft speed (rpm), Pulses per revolution, Output high (V) |
| **Tachogenerator** | DC tachogenerator for speed feedback: V = K·speed (e.g. 7 V per 1000 rpm), polarity follows the direction. <br>*Settings:* Shaft speed (rpm), Constant (V/krpm), Armature resistance (Ω) |
| **Piezo Vibration Sensor** | Piezoelectric sensor: a sinusoidal charge source (voltage source behind its capacitance). Being capacitive, it has no DC output and needs a high input impedance. <br>*Settings:* Vibration amplitude (g), Vibration frequency (Hz), Sensitivity (V/g), Element capacitance (F) |
| **Microphone** | Microphone modelled as a sinusoidal source: Vpeak = √2·10^(S/20)·p, p = 20 µPa·10^(SPL/20). <br>*Settings:* Sound level (dB SPL), Tone frequency (Hz), Sensitivity (dBV/Pa), Output impedance (Ω) |
| **pH Electrode** | Glass pH electrode (Nernst): E = −(RT ln10 / F)·(pH − 7) ≈ −59.16 mV/pH at 25 °C, with ≈100 MΩ source resistance — it must be read with a high-impedance buffer (op-amp follower). <br>*Settings:* pH, Temperature (°C), Electrode resistance (Ω) |
| **Capacitive Touch Pad** | Touch pad modelled as its capacitance to ground: a finger adds capacitance, which slows an RC charge time or shifts an oscillator. Tap to touch. <br>*Settings:* Touched, Pad capacitance (F), Finger capacitance (F) |
| **Inductive Proximity Sensor** | Three-wire inductive proximity switch (10–30 V DC) for metal targets: switches when the target comes within the real sensing distance Sr = Sn × material factor (steel 1, stainless 0.7, brass 0.45, aluminium 0.4, copper 0.35) and releases at 110 % of it. PNP output sources +V into a load to 0 V; NPN sinks a load from +V to 0 V. BN = +V, BK = output, BU = 0 V. <br>*Settings:* Target distance (mm), Rated sensing distance Sn (mm), Target material, Output |
| **Capacitive Proximity Sensor** | Three-wire capacitive proximity switch: detects metals and non-metals (water, grain, plastic, wood…) through the change in capacitance — used for level detection through a tank wall. The real sensing distance scales with the material’s dielectric effect (water 1, wood 0.6, glass 0.5, plastic 0.4, paper 0.3, oil 0.15). <br>*Settings:* Target distance (mm), Rated sensing distance Sn (sensitivity) (mm), Target material, Output |
| **Photoelectric Sensor** | Three-wire photoelectric sensor. Diffuse: the light reaches the receiver when an object within range reflects it. Retro-reflective / through-beam: an object anywhere closer than the reflector / receiver blocks the beam. Light-on mode switches the output on when light is received, dark-on when it is blocked — the standard choice for conveyor counting and position detection. <br>*Settings:* Object distance (mm), Type, Range / distance to reflector or receiver (mm), Operation, Output |
| **Level Transmitter (4–20 mA)** | Hydrostatic tank level transmitter. Two-wire, loop-powered: it regulates the loop current to 4 mA at the range low and 20 mA at the range high (3.8–20.5 mA limits), as long as at least the lift-off voltage (≈10 V) is left across it. Put it in series with a 24 V supply and a 250 Ω receiver resistor (1–5 V) or a PLC analog input. <br>*Settings:* Level (m), Range low (4 mA) (m), Range high (20 mA) (m), Minimum loop voltage (lift-off) (V) |
| **Pressure Transmitter (4–20 mA)** | Gauge pressure transmitter. Two-wire, loop-powered: it regulates the loop current to 4 mA at the range low and 20 mA at the range high (3.8–20.5 mA limits), as long as at least the lift-off voltage (≈10 V) is left across it. Put it in series with a 24 V supply and a 250 Ω receiver resistor (1–5 V) or a PLC analog input. <br>*Settings:* Pressure (bar), Range low (4 mA) (bar), Range high (20 mA) (bar), Minimum loop voltage (lift-off) (V) |
| **Temperature Transmitter (4–20 mA)** | RTD temperature transmitter. Two-wire, loop-powered: it regulates the loop current to 4 mA at the range low and 20 mA at the range high (3.8–20.5 mA limits), as long as at least the lift-off voltage (≈10 V) is left across it. Put it in series with a 24 V supply and a 250 Ω receiver resistor (1–5 V) or a PLC analog input. <br>*Settings:* Temperature (°C), Range low (4 mA) (°C), Range high (20 mA) (°C), Minimum loop voltage (lift-off) (V) |
| **Flow Transmitter (4–20 mA)** | Flow transmitter (magnetic flow meter). Two-wire, loop-powered: it regulates the loop current to 4 mA at the range low and 20 mA at the range high (3.8–20.5 mA limits), as long as at least the lift-off voltage (≈10 V) is left across it. Put it in series with a 24 V supply and a 250 Ω receiver resistor (1–5 V) or a PLC analog input. <br>*Settings:* Flow (m³/h), Range low (4 mA) (m³/h), Range high (20 mA) (m³/h), Minimum loop voltage (lift-off) (V) |
| **Smoke Detector (2-wire)** | Conventional optical smoke detector for a fire-alarm zone (+ / −, 9–33 V): in standby it draws ≈60 µA; when smoke exceeds the threshold it latches into alarm, clamping the line to ≈6 V and drawing a large current (limited by the panel’s zone resistor) — the panel detects the current rise. The red LED lights in alarm. It resets only when the panel removes the zone power. <br>*Settings:* Smoke density (obscuration) (%/m), Alarm threshold (%/m), Alarm clamp voltage (V), Alarm resistance (Ω), Standby current at 24 V (A) |
| **Gyroscope (analog yaw rate)** | MEMS rate gyro (one axis): ratiometric output Vcc/2 at rest, 5 mV per °/s at 5 V (0.1 % of Vcc per °/s), clamped near the rails beyond ±480 °/s. <br>*Settings:* Rotation rate (°/s) |
| **CO₂ Sensor (NDIR, analog)** | NDIR carbon-dioxide sensor with analog output (MH-Z19 style): 0.4 V at 0 ppm to 2.0 V at 5000 ppm, linear. Fresh air ≈ 420 ppm; above 1000 ppm the room needs ventilation. <br>*Settings:* CO₂ concentration (ppm) |
| **Sound Sensor Module (analog)** | Electret microphone with an amplifier (MAX4466 / KY-038 style): output idles at Vcc/2 and carries the sound waveform; the amplitude (peak) is “Output at 94 dB” × 10^((L − 94)/20), clipped at the rails. 60 dB is speech, 94 dB = 1 Pa. <br>*Settings:* Sound level (dB SPL), Tone frequency (Hz), Output at 94 dB SPL (V) |
| **IMU (6-axis, analog outputs)** | Six-axis inertial sensor with ratiometric analog outputs (Vcc/2 = zero): the accelerometer measures gravity resolved into the board axes — ax = sin(pitch) + forward acceleration, ay = −sin(roll)·cos(pitch), az = cos(roll)·cos(pitch) — at 10 % of Vcc per g; the gyro outputs 0.1 % of Vcc per °/s. Set the tilt and rotation rates to see what a balancing robot or drone controller reads. <br>*Settings:* Roll angle (°), Pitch angle (°), Extra forward acceleration (g), Roll rate (°/s), Pitch rate (°/s), Yaw rate (°/s) |
| **Colour Sensor (TCS3200)** | Light-to-frequency colour sensor: S2/S3 select the photodiode filter (LL red, LH blue, HH green, HL clear) and OUT is a 50 % square wave whose frequency is proportional to that colour’s intensity (full scale at 255). Measure the three frequencies to identify the object colour. <br>*Settings:* Red, Green, Blue, Full-scale frequency (20 % scaling) (Hz), Logic high level (V), Output resistance (Ω) |
| **Ultrasonic Sensor (HC-SR04)** | Ultrasonic range finder: a ≥10 µs high pulse on TRIG sends a 40 kHz burst; ≈0.5 ms later ECHO goes high for the round-trip time of the sound, t = 2·d / c with c = 331 + 0.6·T m/s (≈58 µs per cm). Beyond 4 m it times out with a 38 ms echo. <br>*Settings:* Object distance (cm), Air temperature (°C), Logic high level (V), Output resistance (Ω) |
| **Linear Encoder (quadrature)** | Incremental linear scale (glass or magnetic) as used on CNC machines and DROs: A and B are square waves 90° apart, one full cycle per 4 counts, so the signal period is 4 × resolution of travel; B leads A when moving in the negative direction. <br>*Settings:* Slide speed (mm/s), Resolution (per count, ×4 decoding) (µm), Output high (V) |
| **Magnetometer / Compass (3-axis)** | Three-axis magnetometer with ratiometric analog outputs (Vcc/2 = 0, 1 % of Vcc per µT, ±50 µT range): the horizontal component of the earth’s field B·cos(dip) splits into X = cos(heading) and Y = −sin(heading) parts, Z = B·sin(dip). Heading = atan2(−Y, X) — a digital compass. <br>*Settings:* Heading (from magnetic north) (°), Earth field strength (µT), Inclination (dip) (°) |
| **Water Level Sensor (analog)** | Conductive water-level probe module: the parallel traces conduct through the water, so the output rises (non-linearly) with the immersion depth — 0 when dry, ≈0.25·Vcc when just wet, ≈0.7·Vcc fully immersed (40 mm). <br>*Settings:* Immersion depth (mm) |

### Output — 23

LEDs (single, RGB, bicolour, infrared, laser), a bar graph, 7-segment and hex displays, buzzers, speaker, solenoid and servo. They light, sound or move to show what the circuit is doing.

| | |
| --- | --- |
| **LED** | Light-emitting diode. Forward voltage depends on colour; brightness is proportional to current. <br>*Settings:* Colour, Rated current (A) |
| **RGB LED (common cathode)** | Three LEDs (red ≈2 V, green ≈2.2 V, blue ≈3 V) in one package with a common cathode — the glow mixes the three currents. <br>*Settings:* Rated current (each) (A) |
| **Bi-colour LED (2-lead)** | Red and green LEDs in anti-parallel: red lights for current left→right, green for right→left (yellow-ish on AC). A polarity indicator. <br>*Settings:* Rated current (A) |
| **Infrared LED (940 nm)** | Infrared emitter (≈1.3 V forward): invisible to the eye — the glow here is shown in dark red. Used in remotes and optical sensors. <br>*Settings:* Colour, Rated current (A) |
| **Laser Diode** | Laser diode: below the threshold current it only glows faintly (LED-like); above it, stimulated emission produces a sharp beam whose power rises steeply with current. <br>*Settings:* Rated current (A), Threshold current (A) |
| **Laser Module (5 V)** | 650 nm laser diode with its current-limiting resistor (KY-008 style, run from 5 V): below the threshold current it only glows like an LED; above it lases and the optical power rises steeply, P = η·(I − Ith) (≈5 mW at 5 V). Never look into the beam. <br>*Settings:* Threshold current (A), Slope efficiency (W/A), Built-in resistor (Ω) |
| **7-Segment Display** | Logic-level 7-segment display: a segment lights when its input is above half the logic level. <br>*Settings:* Colour, Threshold ×2 (V) |
| **14-Segment Display (ASCII)** | Alphanumeric 14-segment (starburst) display with a built-in ASCII decoder: the 7-bit code on D0–D6 (e.g. 0x41 = “A”) selects the character — digits, capital letters (lower case shown as capitals) and common symbols. <br>*Settings:* Colour, Logic high level (V), Output resistance (Ω) |
| **LED Dot Matrix 8×8** | 64 LEDs in an 8×8 grid: LED (r, c) has its anode on row pin Rr and cathode on column pin Cc (≈1.8 V red). Drive a row high and pull columns low through resistors to light dots; scan the rows quickly (multiplexing) and persistence of vision (≈20 ms) shows a steady picture. <br>*Settings:* Colour |
| **Hex Display (4-bit)** | Displays the 4-bit input as a hexadecimal digit 0–F (like the TIL311). <br>*Settings:* Logic high level (V) |
| **LED Bar Graph (LM3914)** | Ten-LED level meter driver: segment k lights when Vin ≥ k/10 of full scale (linear) or at 3 dB steps (log, VU-meter style). High-impedance input. <br>*Settings:* Full-scale voltage (V), Mode, Scale |
| **Buzzer** | Active buzzer: sounds (if device sound is enabled) when current exceeds the sounding current. <br>*Settings:* Resistance (Ω), Sounding current (A), Tone (Hz) |
| **Piezo Buzzer (passive)** | Passive piezo transducer: electrically a capacitor. It sounds at the frequency you drive it with (unlike the active buzzer, it needs an AC / PWM signal). <br>*Settings:* Capacitance (F) |
| **Loudspeaker (8 Ω)** | Moving-coil speaker (Re + Le voice coil). Plays the detected fundamental frequency through the device speaker when sound is enabled; the cone moves with the current. <br>*Settings:* Voice-coil resistance (Ω), Voice-coil inductance (H), Power rating (W) |
| **Headphone (32 Ω)** | Dynamic headphone driver: a 32 Ω (typ.) load; the sound level is sensitivity + 10·log10(P / 1 mW). Above ≈85 dB SPL long listening damages hearing; 1 mW already gives 100 dB on sensitive earbuds. <br>*Settings:* Impedance (Ω), Sensitivity (dB SPL/mW) |
| **Audio Preamplifier** | Audio preamplifier: flat gain between the low and high cut-off frequencies (1st-order roll-offs), 47 kΩ input, 100 Ω output, soft clipping near the supply rails. Raises microphone / pickup levels (mV) to line level (≈1 V). <br>*Settings:* Gain (dB), Low cut-off (Hz), High cut-off (Hz), Clipping level (V) |
| **Tone Control (bass / treble)** | Baxandall-style tone control: first-order shelving boost/cut below the bass turnover and above the treble turnover (±15 dB), flat in the middle, plus a volume setting. 47 kΩ input, 100 Ω output. <br>*Settings:* Bass (dB), Treble (dB), Bass turnover (Hz), Treble turnover (Hz), Volume (dB) |
| **Graphic Equaliser (5-band)** | Five-band graphic equaliser: a cascade of peaking (bell) filters at 60 Hz, 230 Hz, 910 Hz, 3.6 kHz and 14 kHz, each ±12 dB with the set Q — boost or cut each part of the audio spectrum independently. See the curve in the AC analysis. <br>*Settings:* 60 Hz band (dB), 230 Hz band (dB), 910 Hz band (dB), 3.6 kHz band (dB), 14 kHz band (dB), Band Q, Output resistance (Ω) |
| **Solenoid Actuator** | Pull-type solenoid: an R–L coil whose plunger pulls in when the current exceeds the pull-in value (drop-out at 50 %). Remember the flyback diode! <br>*Settings:* Coil resistance (Ω), Coil inductance (H), Pull-in current (A), Rated voltage (V) |
| **RC Servo Motor** | Hobby servo: measures the width of each high pulse on SIG (1–2 ms, typically every 20 ms) and turns its arm to 0–180° at a limited speed. Input impedance ≈10 kΩ. <br>*Settings:* Pulse for 0° (s), Pulse for 180° (s), Slew rate (°/s) |
| **Peltier Module (TEC1-12706)** | Thermoelectric (Peltier) module: current I pumps heat Qc = α·I·Tc − ½I²R − K·ΔT from the cold face to the hot face, which must be cooled by a heatsink (Qh = Qc + V·I). Electrically V = I·R + α·(Th − Tc): the Seebeck back-EMF grows with the temperature difference. Too much current heats more than it pumps — there is an optimum. <br>*Settings:* Heat load on the cold side (W), Seebeck coefficient (V/K), Electrical resistance (Ω), Thermal conductance (W/K), Hot-side heatsink (K/W), Cold-side heat capacity (J/K), Hot-side heat capacity (J/K), Ambient (°C) |
| **DC Fan (brushless, 12 V)** | Brushless DC cooling fan (with built-in commutation and reverse-polarity protection): speed and airflow rise roughly in proportion to the voltage, the air load torque ∝ speed², and it stalls below about a third of the rated voltage. Current flows only with the correct polarity. <br>*Settings:* Rated voltage (V), Rated current (A), Rated speed (rpm), Rated airflow (CFM) |
| **Electromagnet** | U-core electromagnet holding an iron armature across two air gaps: the flux density B = μ0·N·I / (2g) (limited by core saturation), the inductance L = μ0·N²·A / (2g), and the holding force F = B²·A/μ0 (both poles). Force rises with the square of the current and falls steeply as the gap opens. <br>*Settings:* Turns, Coil resistance (Ω), Air gap (each pole) (mm), Pole face area (each) (cm²), Core saturation (T), Rated voltage (V) |

### Vacuum Tubes — 3

Classic valves: vacuum diode, triode and pentode, for vintage audio and radio circuits.

| | |
| --- | --- |
| **Vacuum Diode** | Thermionic diode (heater implied): space-charge-limited current I = k·V^1.5 (Child–Langmuir law); no reverse current. <br>*Settings:* Perveance (A/V^1.5) |
| **Vacuum Triode** | Vacuum triode with Norman Koren’s SPICE model (heater implied) plus grid-current conduction when the grid goes positive. Terminals: grid (left), plate/anode (top), cathode (bottom). <br>*Settings:* Type, Amplification factor µ, Exponent, Kg1, Kp, Kvb |
| **Vacuum Pentode (EL84)** | Power pentode (Koren model, EL84 defaults) with its screen grid G2 as a terminal: plate current is set by Vg1k and Vg2k and almost independent of plate voltage. Terminals: G1 (left), plate (top), cathode (bottom), G2 (right). <br>*Settings:* µ (screen), Exponent, Kg1, Kg2, Kp, Kvb |

### Meters — 21

Meters that stay in the circuit: voltmeter, ammeter (use **Auto** for RMS in AC), ohmmeter, wattmeter, power-factor, VAR, kWh, frequency, phase, dB, peak, LCR, megger and moving-coil meters. **Test point** and **Label** mark and name places on the schematic.

| | |
| --- | --- |
| **Voltmeter** | Measures the voltage between + (left) and − (right). Ideal (infinite impedance) unless an input resistance is set. <br>*Settings:* Reading, Averaging time (s), Input resistance (0 = ideal) (Ω) |
| **Ammeter** | Measures current flowing in at + (left) and out at − (right). Place it in series. <br>*Settings:* Reading, Averaging time (s), Shunt resistance (0 = ideal) (Ω) |
| **AC Voltmeter (True RMS)** | Voltmeter preset to true-RMS reading (averaging time 100 ms). <br>*Settings:* Reading, Averaging time (s), Input resistance (0 = ideal) (Ω) |
| **AC Ammeter (True RMS)** | Ammeter preset to true-RMS reading. Place it in series. <br>*Settings:* Reading, Averaging time (s), Shunt resistance (0 = ideal) (Ω) |
| **Ohmmeter** | Measures resistance by injecting a small test current. Only valid in circuits with no other active sources. <br>*Settings:* Test current (A) |
| **Wattmeter** | Series current path (left → right) and voltage sense from the current path to the bottom terminal. Shows average power P = ⟨v·i⟩. <br>*Settings:* Averaging time (s) |
| **Power Factor Meter** | Power factor = P / (Vrms·Irms) with lag/lead indication. Current path left → right, voltage sensed between the output side and the bottom (neutral) terminal. |
| **VAR Meter (Reactive Power)** | Reactive power Q = ±√(S² − P²) (positive for inductive / lagging loads). Same connections as the wattmeter. |
| **Energy Meter (kWh)** | Integrates real power over time: E = ∫v·i dt, shown in Wh / kWh (1 unit = 1 kWh), plus the present power. |
| **Frequency Meter** | Counts the period of the voltage across it (AC coupled, zero-crossing with hysteresis) and shows the frequency and period. <br>*Settings:* Digits |
| **Phase Meter** | Phase of SIG relative to REF (both measured to COM), from zero-crossing times: positive = SIG leads. Also shows the frequency. |
| **dB Meter (AC level)** | True-RMS AC level in decibels: dBV = 20·log10(Vrms / 1 V), dBu relative to 0.775 V. <br>*Settings:* Reference |
| **Peak Voltmeter (hold)** | Holds the largest \|V\| seen since the start (tap to reset). |
| **Digital Panel Meter (3½ digit)** | 3½-digit LCD panel voltmeter (ICL7107 class): ±1999 counts on the selected range, about three readings per second, 10 MΩ input. Above full scale it shows a lone “1” (over-range), exactly like the real thing. <br>*Settings:* Range, Measure |
| **LCR Meter** | Drives a small sinusoidal test current through the component and synchronously detects the voltage: Z = R + jX, shown as C (X < 0) or L (X > 0). Connect it across an isolated component. <br>*Settings:* Test frequency (Hz), Test current (peak) (A) |
| **Insulation Tester (Megger)** | Applies a high DC test voltage (500 V / 1 kV) through its internal resistance and displays the insulation resistance R = V / I (up to GΩ). Use on de-energised circuits only. <br>*Settings:* Test voltage (V), Internal resistance (Ω) |
| **Analog Voltmeter (moving coil)** | PMMC voltmeter with a needle: finite input resistance (Ω/V × full scale) loads the circuit — a classic source of measurement error. Reads the average voltage. <br>*Settings:* Full scale (V), Sensitivity (Ω/V) |
| **Analog Ammeter (moving coil)** | PMMC ammeter with shunt: resistance = burden / full-scale current (75 mV shunt), needle shows the average current. <br>*Settings:* Full scale (A), Burden voltage at FS (V) |
| **Galvanometer (centre-zero)** | Centre-zero galvanometer: deflects either way — the null detector of a Wheatstone bridge or potentiometer. <br>*Settings:* Full scale (±) (A), Coil resistance (Ω) |
| **Test Point (voltage tag)** | Single-terminal tag that displays the node voltage (relative to ground) next to its name. Draws no current. <br>*Settings:* Tag |
| **Text Label** | Free text annotation for documenting your circuit. <br>*Settings:* Text, Size (px) |

<a id="ch-examples"></a>

## 17. Examples (all 101)

Open any example, press **Run** (it starts by itself), then experiment: tap switches, turn knobs, add scope probes, run an analysis. You cannot damage the original.

### Basics

- **LED with switch**: The "hello world" of electronics. Tap the switch to turn the LED on. The resistor limits current to I = (9 V − Vf)/470 Ω ≈ 15 mA.
- **Voltage divider & potentiometer**: Vout = Vin·R2/(R1+R2) = 12 V · 4.7k/14.7k ≈ 3.84 V. Select the potentiometer and turn the knob to vary its wiper voltage continuously.
- **Series–parallel resistors**: Equivalent resistance: 100 Ω + (200‖200) + (300‖300‖300) = 300 Ω, so the source supplies 3 V / 300 Ω = 10 mA. Watch how the current splits at every junction (Kirchhoff's current law).
- **RC charging & discharging**: Close the switch to charge the 100 µF capacitor through 1 kΩ (τ = RC = 0.1 s): after one τ it reaches 63 % of the supply. Open it and hold the push button to discharge through 100 Ω.
- **LRC oscillator**: With the switch closed the inductor carries 50 mA. Open the switch: the stored energy rings between L and C at f = 1/(2π√LC) ≈ 71 Hz, decaying with α = R/2L = 25 s⁻¹.
- **Diode I–V characteristic**: Open Analysis → DC Sweep, sweep V1 from 0 to 3 V and measure I(D1) to trace the exponential Shockley curve. Try the Zener or LED models too.

### AC & Filters

- **RC low-pass filter**: First-order filter with cut-off fc = 1/(2πRC) ≈ 1 kHz. Open Analysis → AC Sweep to draw the Bode plot: −3 dB and −45° at fc, then −20 dB/decade.
- **Series RLC resonance**: L = 10 mH and C = 100 nF resonate at f₀ = 1/(2π√LC) ≈ 5.03 kHz where the output peaks. Q = (1/R)√(L/C) ≈ 3.2. Run an AC sweep, or turn the source frequency knob.

### Power

- **Half-wave rectifier**: The diode conducts only on positive half-cycles; the 470 µF reservoir capacitor holds the voltage up between peaks. Ripple ≈ I/(f·C).
- **Transformer + bridge rectifier**: 230 V mains (325 V peak) stepped down 20:1 by the transformer, full-wave rectified by four diodes and smoothed by 1000 µF. Both half-cycles charge the capacitor, halving the ripple.
- **Zener shunt regulator**: The 5.1 V Zener holds the output nearly constant while the input varies. Turn the source knob: above ~5.5 V the output stays at the Zener voltage while the resistor drops the rest.
- **5 V regulated supply (7805)**: A linear regulator keeps the output at 5 V as long as the input stays ≥ 7 V (2 V dropout). Lower the battery voltage with the knob to watch it drop out of regulation.

### Transistors

- **Common-emitter amplifier**: Voltage-divider biasing (VB ≈ 2.1 V, IC ≈ 1.4 mA) with emitter bypass capacitor. Small-signal gain ≈ −RC‖RL / re ≈ −130: the 10 mV input becomes ~1.3 V at the output. Run an AC sweep to see the pass-band.
- **MOSFET PWM motor control**: A logic-level MOSFET switches the motor with a 1 kHz PWM signal. Motor speed follows the duty cycle – select the pulse source and change its duty. The flyback diode clamps the inductive kick.

### Op-Amps

- **Inverting amplifier**: Gain = −Rf/Rin = −10. The op-amp drives its inverting input to a virtual ground. Switch the op-amp model to LM741 to see finite bandwidth in an AC sweep.
- **Wien-bridge sine oscillator (1 kHz)**: A classic low-distortion sine oscillator. The RC series-parallel network (10 kΩ, 16 nF) passes exactly one frequency, f = 1/(2πRC) ≈ 1 kHz, with zero phase shift and 1/3 attenuation, back to the non-inverting input; the amplifier needs a gain of exactly 3. For small signals the gain is 1 + 28k/10k = 3.8, so the oscillation grows from a tiny start-up kick; as the amplitude grows, the two diodes start to conduct, shorting part of the feedback resistance and pulling the gain down towards 3 — the amplitude settles. (This circuit starts from zero rather than the DC operating point, so it can start up.)

### Sensors

- **Temperature alarm (NTC)**: An NTC thermistor forms a divider with 10 kΩ. When it heats above ≈ 30 °C its voltage exceeds the 2.8 V reference and the comparator sounds the buzzer. Select the NTC and turn the temperature knob.
- **LDR night light**: In bright light the LDR has low resistance, holding the transistor off. As it gets dark its resistance rises, the base voltage climbs and the LED switches on. Select the LDR and turn the light knob.
- **Strain-gauge Wheatstone bridge**: A 350 Ω strain gauge in a balanced bridge. Strain ε changes its resistance by GF·ε, producing a small differential voltage ≈ Vs·GF·ε/4 (≈ 2.5 mV at 1000 µε).
- **Solar panel with load**: 36-cell panel (Voc ≈ 21.6 V, Isc = 3 A). Change the irradiance knob, or run a DC sweep of the load resistance and measure power to find the maximum power point.

### Timers & ICs

- **555 astable LED flasher**: Classic NE555 astable: the capacitor charges through R1 + R2 and discharges through R2. f = 1.44/((R1 + 2R2)·C) ≈ 6.9 Hz, duty ≈ 52 %.

### Digital

- **Logic gates truth table**: Toggle inputs A and B and watch every basic gate respond: NOT, AND, OR, NAND, NOR, XOR and XNOR.
- **Counter & 7-segment display**: A 2 Hz clock drives a 4-bit binary counter; the decoder converts the count to 7-segment patterns (0–F). Toggle RESET to clear the counter.
- **1-bit memory cell (NOR latch)**: The building block of every static RAM: two NOR gates, each feeding the other. Press SET and Q goes high; press RESET and it goes low. Let go and the loop keeps the bit — that is memory. Pressing both at once gives the forbidden state (Q = Q̄ = 0).

### Switches

- **Relay-controlled lamp**: Hold the push button to energise the relay coil; its contact switches the 12 V lamp. The flyback diode absorbs the coil's inductive kick when the button is released.

### Electrical Wiring

- **Tube light (choke + starter)**: Classic fluorescent fitting. Switch on: the starter glows and closes, pre-heating both filaments through the choke. When the bimetal opens, the choke's L·di/dt kick strikes the arc, and the choke then limits the lamp current while the tube runs at ≈100 V.
- **Staircase wiring (2-way + intermediate)**: One lamp controlled from three places: a two-way switch at each end of the stairs and an intermediate switch on the landing. Tap any switch to toggle the lamp.
- **House wiring: meter, RCCB, MCBs**: Energy meter → RCCB (main switch + earth-leakage protection) → MCB per circuit. The lighting circuit has a switch and lamp; the socket feeds a 1 kW heater. Change the socket's appliance to "Faulty" to trip the RCCB, or to "Short circuit" to trip the MCB.
- **TRIAC lamp dimmer & fan regulator**: A TRIAC phase-control dimmer — turn its level knob and watch the RMS lamp voltage follow Vrms = V·√(1 − α/π + sin2α/2π). The top branch is a capacitor-type fan regulator — each step changes the series capacitor and so the fan speed.

### Power Systems

- **Power-factor correction**: A 1 kW inductive load at PF 0.7 draws extra reactive current. Close the switch to add a 700 VAR capacitor: the PF meter rises to ≈0.96 while the real power stays the same.
- **DOL starter: 3-phase motor**: Direct-on-line starter. Press START: the contactor coil pulls in and its auxiliary contact (13–14) seals itself in, so the motor keeps running after you let go. Press STOP to break the coil circuit. Watch the ≈6× starting current settle as the motor reaches ≈1440 rpm.
- **Short-circuit fault & MCB tripping**: Why every circuit has a breaker. A 2 kW heater is fed through a C16 MCB and 30 m of 2.5 mm² cable (≈ 0.43 Ω there and back). At t = 0.2 s the fault element applies a short circuit at the far end: the current shoots up towards the prospective fault current — limited only by the supply and cable impedance, ≈ 230 V / 0.63 Ω ≈ 365 A — but as soon as it passes the MCB's magnetic trip level (5–10 × In = 80–160 A for a C curve) the breaker opens, within a few milliseconds. Watch the current trace. Try a longer or thinner cable (higher loop impedance, lower fault current) or a D-curve breaker: if the fault current falls below the magnetic threshold, only the slow thermal trip acts — a dangerous situation the electrician must design out.

### Projects

- **Complete house wiring: service main to earthing (2-storey house)**: A whole two-storey house, from the street pole to the earth pits, as one ladder diagram. ① Service main: the pole transformer (neutral earthed at the substation) feeds a 25 m overhead service drop of 2 × 16 mm² aluminium. ② Service cut-out: a 63 A HRC fuse in the phase and a solid neutral link. ③ Energy meter (kWh). ④ Double-pole main switch. ⑤ 30 mA RCCB. ⑥ Distribution board: an ammeter shows the total current, the L busbar feeds ten MCBs (B6 for lights and fans, C16 for sockets and the pump, C20 for the kitchen, geyser and air conditioner) and every circuit returns to the N bar. Ground floor: LED and CFL lights, a dusk-to-dawn verandah light, the staircase lamp on two 2-way switches (one on each floor), calling bell, two fans with regulators, TV and fridge sockets, kitchen sockets, water pump. First floor: bedroom and bathroom lights, a corridor lamp switched from three places (2-way – intermediate – 2-way), fans, study and bedroom sockets, 2 kW geyser and a 1.5-ton air conditioner. ⑦ Earthing: every 3-pin socket's earth pin goes over the green earth continuity conductor to the earth bar and on to two earth electrodes (pipe earthing, ≈5 Ω each). Press Run (the board switches to ✋ Operate) and tap switches to watch the total current, the kWh meter and the cables; switch on the geyser, AC, pump and microwave together to load the house. Set a socket to "Faulty appliance" and the RCCB trips through the earth path; set one to "Short circuit" and only its MCB trips. Tap ✋ Operate / Wire at the top right to edit while it runs.
- **Complete house wiring (2-room flat)**: A whole flat as a ladder diagram. Incomer: energy meter → double-pole main switch → 30 mA RCCB. The L bus feeds one MCB per circuit and every load returns to the N bus: lights (bedroom and drawing-room lamps, a staircase lamp on two 2-way switches, calling bell), fan with regulator, 2 kW geyser and two earthed sockets. Tap switches to watch the total current and kWh change; set a socket to "Faulty appliance" to trip the RCCB or to "Short circuit" to trip its MCB. Every wire is a real cable sized like a real installation: 10 mm² meter tails and buses, 1.5 mm² lights and fan, 4 mm² geyser, 2.5 mm² sockets (tap a wire → Cable to see or change it).
- **16-bit RAM (4 words × 4 bits)**: A small static RAM built like a real memory chip: 16 D-latch cells in 4 rows (words) × 4 columns (bits). To write: set DATA IN on the hex keypad, choose the address with A1 A0 and hold WRITE — the address decoder raises one word line and that row of cells copies the bit lines. To read: the multiplexer under each column picks the cell of the addressed row, so DATA OUT shows the word stored at A1 A0. Store a different digit at each of the four addresses, then step through them.
- **Mains to 5 V regulated power supply**: Every stage of a linear DC supply: 230 V mains → fuse → 230 V : 12 V transformer → bridge rectifier → 1000 µF smoothing capacitor → 7805 regulator → steady 5 V with a power LED and a 100 Ω load. The scope compares the rippling ≈15 V on the capacitor with the flat 5 V output. Lower the mains voltage or the capacitor to watch the ripple dip below 7 V and the regulator drop out.
- **Traffic light controller (4017)**: A 1 Hz clock steps a CD4017 decade counter through ten states — exactly one output is high at a time. Diodes combine the outputs (diode-OR logic): Q0–Q4 light RED for 5 s, Q5–Q8 GREEN for 4 s and Q9 YELLOW for 1 s, then the cycle repeats. Rewire the diodes to make your own timing.
- **4-bit binary adder (calculator)**: Adds two 4-bit numbers, like the ALU inside a CPU. Tap keypad A and keypad B to pick 0–F; the 74HC283 adder shows the sum on the hex display. A sum above 15 does not fit in 4 bits, so CARRY lights — it is worth 16 (A = 9, B = 8 → display 1 + CARRY = 17). Cin adds one more, which is how adders are chained into 8, 16 or 64 bits.
- **Digital seconds counter 00–59**: The heart of every digital clock. A 1 Hz clock drives the units BCD counter; each time it wraps 9 → 0 its carry clocks the tens counter. An AND gate watches the tens counter: the moment it reaches 6 (Q1 = Q2 = 1) it resets it, so the display goes 58, 59, 00. Each digit passes through a BCD → 7-segment decoder. Turn the clock up to 10 Hz to see the roll-over sooner.
- **Automatic street light (LDR + relay)**: A low-voltage sensor switching a mains lamp. In daylight the LDR has a low resistance and holds the transistor's base low. At dusk (below ≈30 lux) the divider voltage rises, the BC547 turns on and energises the 12 V relay, whose contact switches the 230 V lamp. The diode absorbs the coil's kick at switch-off, and because the relay drops out at a lower current than it pulls in, the lamp only turns off again above ≈60 lux — no chattering at dusk. Select the LDR and turn the light level down.

### Industrial Control (Ladder)

- **Star-delta starter (automatic)**: The standard way to start a large induction motor with reduced current, drawn as a power circuit (left) and a ladder diagram (right). Press START: coils KM and KY pull in (KM holds itself with KM 13-14), so the main contacts KM feed the motor and KY joins the winding ends U2-V2-W2 into a star — each winding gets 400/√3 = 230 V, and starting current and torque are one third of a direct start. The timer coil KT starts at the same time; after 1.5 s its KT 15-16 contact drops KY and its KT 15-18 contact picks up KΔ, which connects the windings in delta: each now gets the full 400 V. KΔ 21-22 in the KY rung and KY 21-22 in the KΔ rung make it impossible for both to close together (that would short the supply). The overload contact F1 95-96 feeds the whole control circuit; the lamps show STAR, DELTA and TRIP.
- **Forward / reverse motor control**: Reversing a 3-phase motor = swapping two phases. Left, the power circuit: main contacts KF connect L1-L2-L3 to the motor in order, KR swaps L1 and L3; F1 is the overload relay. Right, the control circuit as a ladder diagram between L3 and N: press FWD and coil KF pulls in, its KF 13-14 contact across FWD holds it in after you let go, and its KF 21-22 contact in the KR rung blocks reverse (electrical interlock) — so KF and KR can never close together and short two phases. REV works the same way for KR. STOP or an overload (F1 95-96) drops the coil; F1 97-98 lights TRIP. Every contact carries the tag of the coil it belongs to. To reverse, press STOP first and watch the speed change sign.
- **Automatic water pump (float switch)**: Overhead-tank pump control, drawn as a power circuit (left) and a ladder diagram (right). A tethered float switch (NC) sits in the rung of contactor coil K: it opens when the water rises above 80 % and — because of its 60 % hysteresis — only closes again when the level falls below 20 %, like the classic low/high electrodes with a hold-in contact. Select the float and drag its level knob down below 20 %: coil K pulls in, the main contacts K start the pump and K 13-14 lights RUN; raise the level above 80 % and it stops. The overload relay F1 protects the motor: its 95-96 contact drops the coil, 97-98 lights TRIP.
- **Phase-failure protection relay**: A 3-phase motor must never run on two phases (single-phasing): it overheats within seconds. The phase monitor KP watches L1-L2-L3 after the fuses; while all three phases are present, in the right sequence and balanced, its contact KP 11-14 in the coil rung of the ladder (right) is closed. Press START: coil K pulls in and holds itself with K 13-14, and the main contacts K run the motor. Now open the "blown fuse" switch in L3: KP releases after its delay, KP 11-14 opens, coil K drops and the motor is disconnected, while KP 11-12 lights PHASE FAULT. Close the switch again and restart. F1 is the overload relay (95-96 in the coil rung, 97-98 for TRIP).
- **Push button control (inching)**: The simplest motor control: the START push button is wired straight into the rung of contactor coil KM. Hold START and KM pulls in, its main contacts (left) run the motor and KM 13-14 lights RUN; let go and the motor stops — this is inching. F1 95-96 is the overload contact. Compare with the next example, where a hold-in contact keeps the motor running.
- **Self-holding (DOL) starter**: Direct-on-line starter with a self-holding (latching, seal-in) circuit. Press START: coil KM pulls in and its own KM 13-14 contact, wired across START, keeps it energised after you let go. STOP (NC) breaks the rung and the motor stops; so does the overload contact F1 95-96. Lamps: RUN (KM 23-24), STOPPED (KM 31-32, NC) and TRIP (F1 97-98). Tap F1 to test-trip it, tap again to reset.
- **Selector switch control (HAND-OFF-AUTO)**: A HAND-OFF-AUTO selector decides who controls the pump. Tap the selector to step through its positions: HAND runs the pump straight away (for testing or emergencies); OFF stops it; AUTO hands control to the float switch, which runs the pump only while the tank level is low (select the float and lower its level below 20 %). The overload contact F1 95-96 protects the motor in every position.
- **Emergency stop circuit**: The emergency stop sits first in the control circuit, ahead of everything else, so it always wins. Start the motor with START, then tap E-STOP: the mushroom head latches open, coil KM drops and the motor stops. Tap E-STOP again to release it (twist-to-release) — the motor does NOT restart by itself; the operator must press START again. That is why the hold-in circuit is used instead of a maintained switch.
- **Thermal overload relay (TOR) protection**: The thermal overload relay F1 carries the motor current through three bimetal heaters (left). Setting: Ir = the motor full-load current from its nameplate (here about 7 A, so F1 is set to 8 A); class 10 means it trips within 10 s at 7.2 × Ir. On overload or a lost phase the bimetals bend and F1 trips: F1 95-96 (NC) in the coil rung opens and drops KM, F1 97-98 (NO) lights TRIP and sounds the alarm lamp. Tap F1 to TEST-trip it, tap again to RESET, then press START. Select the motor and raise its load to see the current rise in F1's readings.
- **MPCB motor protection**: A motor protection circuit breaker (MPCB) Q1 replaces fuses plus overload relay: it has a thermal release set to the motor current (Ir) and a magnetic release that trips instantly on a short circuit (≈ 13 × Ir). Its auxiliary contact Q1 13-14 is in the control circuit, so the contactor can only be energised while Q1 is ON. Tap Q1 to switch it OFF (the motor stops and "Q1 OFF / TRIP" lights through Q1 21-22), tap again to switch it ON and press START.
- **Complete motor protection circuit**: All the usual protections on one motor: MPCB Q1 (short circuit and overload, aux 13-14), a phase-failure / sequence monitor KP (11-14 closed only while all three phases are healthy), the thermal overload relay F1 (95-96) and an emergency stop — every one of them in series in the coil rung of KM, so any fault stops the motor. Lamps show RUN, TRIP (F1 97-98) and PHASE FAULT (KP 11-12). Try: tap E-STOP, tap Q1 OFF, tap F1 (test), or select the supply and change the phase sequence to R-B-Y.
- **Relay logic circuits (AND, OR, NOT)**: Before PLCs, logic was built with relays — and it is still used in panels. Push buttons A and B energise relays KA and KB (24 V DC). Contacts in series make AND (the lamp lights only with both buttons held), contacts in parallel make OR (either button), and an NC contact makes NOT (the lamp is on until A is pressed). Hold A, B or both and watch the lamps.
- **Motor control using a relay (24 V)**: An interposing relay: the push buttons work at a safe 24 V DC (right) and switch the small relay KA, which holds itself in with KA 23-24. One contact of KA (13-14) sits in the 230 V coil rung of the motor contactor KM (middle) — the same way a PLC output or a remote panel starts a big motor. Press START and STOP on the 24 V side.
- **Phase sequence protection**: If two supply phases are swapped (after maintenance, or a new cable), a 3-phase motor runs backwards — dangerous for pumps, conveyors, compressors and lifts. The phase monitor KP checks the sequence L1→L2→L3 (and phase loss); its contact KP 11-14 is in the coil rung, so KM can only pull in with the right sequence. Press START, then select the supply (top left) and change its phase sequence to R-B-Y: KP releases after its delay, KM drops and PHASE FAULT lights.
- **Floatless level relay pump control**: A floatless (electrode) level relay KL watches the tank through probes instead of a float. Its supply is the coil rung at the top. When the water falls below the LOW probe (25 %) its contact KL 11-14 closes and the pump contactor KM starts; KL keeps it closed until the water reaches the HIGH probe (90 %), then the pump stops — the gap between the probes stops the pump from switching on and off all the time. Watch the tank fill and empty; select it and change the water use.
- **Water tank automation (sump + overhead)**: A complete building water system: the pump lifts water from the underground SUMP to the OVERHEAD tank. Level relay KL1 (fill mode, on the overhead tank) asks for water below 25 % and stops at 90 %; level relay KL2 (dry-run mode, on the sump) only allows pumping while the sump has water above its LOW probe — so the pump never runs dry. Both contacts are in series in the coil rung of KM. The sump refills slowly from the mains line; watch SUMP DRY light when it runs out.
- **ON-delay timer motor control**: An ON-delay (TON) timer switches its contacts a set time after its coil is energised. Press START: the control relay KA holds itself in and energises the timer coil KT; 3 s later KT 15-18 closes and the motor contactor KM pulls in. STOP drops everything at once (the timer resets). Used for delayed starts, warning periods and staggered starting.
- **OFF-delay timer (fan run-on)**: An OFF-delay (TOF) timer switches its contacts at once when its coil is energised and keeps them switched for a set time after the coil is de-energised. Here it keeps an exhaust fan running 5 s after the switch is turned off (to clear the air). Tap FAN SWITCH on, then off, and watch KT hold KM.
- **Twin timer (cyclic ON / OFF)**: A twin (cyclic) timer switches its contacts on and off for as long as its coil is energised: ON for T, OFF for T2, over and over. Here it runs a mixer motor 3 s on, 2 s off while the switch is on — typical for mixers, lubrication pumps, flashing beacons and fountains. Tap the switch on.
- **Sequential motor control (timer)**: Two motors that must start one after the other — e.g. a conveyor M2 that may only run once the crusher M1 feeding it is running, and never together (to limit the starting current). START pulls in KM1 (held by KM1 13-14); KM1 also starts the timer KT, and 3 s later KT 15-18 starts KM2. Because the KT rung is fed through KM1, M2 can never run without M1. STOP or either overload (F1, F2) stops both.
- **Automatic machine cycle (cylinder, timer, counter)**: An automatic press: press START and relay KA runs the machine. At home (LS1) the valve coil Y1 pulls in and holds itself, the cylinder extends; at the end of the stroke LS2 starts the dwell timer KT (1.5 s) and adds one to the counter C1. When KT runs out, KT 15-16 drops Y1, the cylinder springs back to LS1 and the next cycle starts by itself. After 5 cycles C1 21-22 stops the machine and "5 CYCLES DONE" lights; press RESET to clear the counter. STOP ends the cycle at any time.
- **Jog (inching) with push buttons**: Jogging (inching) runs a motor only while a button is held — to position a machine or a conveyor belt. RUN starts the control relay KA, which holds itself and keeps KM energised (normal running). JOG energises KM directly, bypassing the hold-in, so the motor stops as soon as JOG is released. STOP stops normal running.
- **Jog with selector switch**: One START button, two behaviours: the RUN / JOG selector sits in series with the hold-in contact KM 13-14. With the selector closed (RUN) START latches the motor on; open it (JOG) and the hold-in is cut, so START only runs the motor while held. Tap the selector, then press START.
- **Multiple start, single stop**: The motor can be started from two places (e.g. the machine and the control room): START buttons are wired in PARALLEL, so either one energises KM; the hold-in KM 13-14 is in parallel with them too. A single STOP (in series) stops it.
- **Single start, multiple stop**: Several STOP buttons placed around a machine (or a long conveyor) so it can be stopped from anywhere: they are wired in SERIES, so pressing any one of them breaks the coil rung. One START with the usual hold-in.
- **Multiple start, multiple stop**: Control from two locations: the STOP buttons of both stations are in SERIES (any one stops the motor), the START buttons are in PARALLEL (any one starts it), and the hold-in contact KM 13-14 is in parallel with the STARTs. This is the general rule for any number of control stations.
- **Electrical interlocking (two motors)**: Duty / standby pumps that must never run together. Each contactor has its own START / STOP rung, and each rung contains an NC contact of the OTHER contactor: KM2 21-22 in the KM1 rung and KM1 21-22 in the KM2 rung. While one pump runs, the other cannot be started. Start pump 1, try pump 2, stop 1, then start 2.
- **ATS (automatic transfer switch)**: An automatic transfer switch keeps a load supplied when the mains fails. The phase monitor KP watches the mains (after its MCB). Mains healthy: KP 11-14 closes and the mains contactor KM feeds the load. Tap the mains MCB OFF to simulate a power cut: KM drops, KP 11-12 starts the timer KT (3 s, for the generator to start and settle) and then KT 15-18 closes the generator contactor KG. KM 21-22 and KG 21-22 interlock the two, so mains and generator are never connected together. Switch the mains MCB back ON: the load returns to the mains. The control circuit runs from a 24 V battery supply.
- **Motor control using limit switches**: A carriage driven forward and back by a reversing starter must stop at both ends of its track. The far-end limit switch LS2 (NC) is in the FWD rung and the home limit switch LS1 (NC) in the REV rung: when the carriage reaches an end, the switch opens and drops that contactor — the motor stops even if nobody presses STOP. KF and KR also interlock each other. Press FWD and watch the carriage stop at the end; then press REV.
- **Automatic forward-reverse (limit switches)**: A shuttle that runs back and forth by itself — e.g. a machine table or a car wash. START latches the relay KA. With the carriage at home, LS1 (NO) starts KF; KF holds itself, and at the far end LS2 opens the KF rung and closes the KR rung, so the motor reverses; back home, LS1 does the opposite. The carriage keeps shuttling until STOP. KF and KR interlock each other.
- **Load control using an SSR**: A solid-state relay (SSR) switches a 230 V load with no moving contacts: a small 24 V DC signal (from a switch, sensor or PLC) lights the LED inside it and its output TRIAC turns on at the next zero crossing — silent, fast and with no contact wear, ideal for heaters switched often. The SMPS gives the 24 V DC. Tap the switch.
- **Load control using a sensor and SSR**: A 3-wire PNP photoelectric sensor (brown +24 V, blue 0 V, black output) switches an SSR, which switches a 230 V lamp — e.g. a light that comes on when a car or a box is in front of the sensor. Select the sensor and move the object closer than its 300 mm range: the output goes to +24 V, the SSR turns on and the lamp lights.
- **Production counter with sensor**: Counting products on a conveyor: a photoelectric sensor (right, 24 V DC) gives one pulse for every box that passes, and each pulse adds one to the counter C1. The conveyor motor runs (START / STOP) until the preset (5 boxes) is reached: then C1 21-22 stops the conveyor and C1 13-14 lights BATCH DONE. Press RESET to clear the counter and START again. Select the sensor and move the object in and out of range (under 300 mm) to pass a box.
- **Counter with limit switch**: The automatic forward-reverse shuttle with a stroke counter: every time the carriage reaches the far end, LS2 gives a pulse to the counter C1. After 5 strokes C1 21-22 (in the KA rung) stops the machine and BATCH DONE lights. Press RESET to clear the counter, then START for the next batch.
- **Temperature control (heater and blower)**: An oven or panel temperature controller: thermostat TH1 (heating mode, set to 60 °C) keeps the heater contactor KH on while the temperature is below the set point; thermostat TH2 (cooling mode, set to 80 °C) starts the blower contactor KB if it gets too hot. The main contacts of KH and KB switch the heater and the blower in the lower rungs. Select each thermostat and change its temperature knob to see them work (the differential keeps them from chattering).
- **Pressure control (air compressor)**: An air compressor kept between 6 and 8 bar by a pressure switch. START latches the AUTO relay KA; the pressure switch (cut-in 6 bar, cut-out 8 bar) in the KM rung then starts and stops the compressor motor by itself. Select the pressure switch and change the pressure: above 8 bar the motor stops, below 6 bar it starts again. The same scheme with a flow switch protects pumps against running without flow.
- **Electro-pneumatic cylinder control**: A single-acting pneumatic cylinder moved by a 5/2 solenoid valve with spring return. Press START: the valve coil Y1 pulls in and holds itself (Y1 13-14), air extends the cylinder. At the end of the stroke the limit switch LS2 (NC) opens, Y1 drops and the spring pushes the cylinder back — one automatic stroke per press. LS2 (NO) lights END OF STROKE while it is out.
- **Complete industrial control panel**: A full pump control panel, putting the course together. Power: MPCB Q1, phase monitor KP, contactor KM, overload relay F1, motor. Control: E-STOP, Q1 13-14, F1 95-96 and KP 11-14 in series feed a HAND-OFF-AUTO selector. HAND: STOP / START with the KM hold-in. AUTO: a pressure switch runs the pump between 2 and 4 bar. Lamps: RUN, STOPPED, TRIP and PHASE FAULT. Try every position of the selector and every protection.

### Industrial Control

- **Conveyor bottle counter (photo-eye)**: A 24 V photoelectric sensor (diffuse, PNP, light-on) watches the conveyor. When a bottle passes within its 300 mm range the BK output switches +24 V; a 10 k / 2.7 k divider turns that into a 5 V logic pulse that clocks a BCD counter, decoded onto a 7-segment display. Select the photo-eye and move its Object-distance knob below 300 mm and back again to pass a bottle — each pass adds one.
- **4–20 mA pressure transmitter loop**: The industry-standard analog signal. A 2-wire, loop-powered pressure transmitter (0–10 bar) regulates the loop current between 4 mA (0 bar) and 20 mA (10 bar); a 250 Ω receiver resistor turns it into 1–5 V for the panel meter or a PLC input. Turn the pressure knob and watch the current; a broken wire would give 0 mA, which the receiver can tell apart from a real 0 bar (4 mA).
- **Fire alarm zone (smoke detectors)**: A conventional fire-alarm zone: 24 V through a 470 Ω zone resistor feeds two smoke detectors in parallel and a 4.7 kΩ end-of-line resistor (which lets the panel see a broken cable). Normal: the zone sits at ≈21.8 V. Raise the smoke density on either detector above 3 %/m: it latches into alarm and clamps the line to ≈6 V; the comparator (zone below 15 V) sounds the buzzer and lights the LED. Clearing the smoke does not reset it — hold RESET to remove the zone power.

### Power Electronics

- **Variable-frequency drive (VFD) for an induction motor**: How a VFD works: the 400 V 3-phase supply is rectified by a 6-diode bridge into a ≈540 V DC bus, smoothed by the 2.2 mF capacitor bank. A 3-phase IGBT inverter then chops the DC bus into a variable-frequency, variable-voltage output: the sine-triangle PWM modulator (2 kHz carrier) ramps the frequency from 0 to 50 Hz in 1 s and keeps V/f constant, so the motor accelerates smoothly with no inrush. Select the PWM modulator and change the output frequency (try 25 Hz → half speed) or reverse the phase sequence; switch EN off to coast the motor. Watch the stepped PWM line current turn into a near-sine current in the scope.
- **H-bridge DC motor speed & direction (L298N)**: An L298N H-bridge drives a 12 V DC motor. IN1/IN2 choose the direction (10 = forward, 01 = reverse, 00 or 11 = brake — both motor terminals tied together, the motor stops quickly), and a 1 kHz PWM signal on EN sets the speed: the average motor voltage is duty × (12 V − the bridge's ≈2 V drop). Toggle IN1 and IN2, and change the PWM duty cycle; the motor current reverses with the direction. The motor inductance smooths the chopped current.
- **Single-phase sine-wave inverter (SPWM + LC filter)**: A pure-sine inverter from a 350 V DC link: two half-bridge legs of an IGBT bridge are switched by unipolar sine-triangle PWM (5 kHz carrier, m = 0.9), so the bridge output is a 3-level pulse train whose average follows a 50 Hz sine. The 5 mH / 10 µF LC low-pass filter (corner ≈ 710 Hz) removes the 10 kHz switching ripple and leaves ≈ 0.9 × 350 / √2 ≈ 223 V RMS across the 50 Ω load (≈1 kW). Compare the inductor current (with ripple) with the smooth load voltage; change the modulation index to regulate the output voltage.
- **Flyback converter (switch level)**: The simplest isolated SMPS, as used in phone chargers. While the MOSFET is on, the primary current ramps up and stores energy in the coupled inductor's core (the output diode is reverse-biased by the winding polarity). When it turns off, the winding voltages reverse and the stored energy flies back through the diode into the output capacitor. Vout ≈ n·Vin·D/(1−D) − V_diode = 12 × 0.33/0.67 − 0.4 ≈ 5.5 V in continuous mode (≈5 V with the winding and switch losses). The 36 V Zener clamps the spike caused by the leakage inductance (k = 0.99). Change the PWM duty cycle and watch the output; the drain voltage shows Vin + reflected Vout while the switch is off.
- **Fully-controlled SCR bridge (phase-angle firing)**: Controlled rectifier for DC motor drives and battery chargers. The firing unit synchronises to the mains zero crossings and fires T1+T4 at the angle α in the positive half-cycle and T2+T3 at α in the negative half-cycle (gate-cathode pairs joined by the net labels G1…G4, P, L, N). Each SCR keeps conducting until its current falls to zero, so with the inductive load the output voltage even goes negative for a while after the zero crossing. Average output ≈ 0.9 × 230 V × cos α (continuous current). Change the firing angle (0–180°): small α → full voltage, 90° → about zero.
- **BLDC motor with hall-sensor commutation**: A brushless DC motor has its magnets on the rotor and three windings on the stator, so something must switch the windings in step with the rotor: three hall sensors report the rotor position in 60° sectors and the driver energises the matching pair of phases (six-step / trapezoidal commutation), chopping the high-side switch at 10 kHz to set the speed. Change the driver duty cycle to change speed, or its direction setting to reverse. The hall signals loop back from the motor to the driver.
- **Stepper motor with a chopper driver**: A bipolar stepper motor (200 steps/rev) driven by a STEP/DIR driver like the A4988/DRV8825: every rising edge on STEP advances the coil currents one step in the sequence, DIR sets the direction and ¬EN (tied low) enables the outputs. The driver chops the 24 V supply to hold the coil current at the set limit (1 A) — much faster current rise than a resistor-limited drive, so more torque at speed. In half-step mode 400 pulses/s = 200 full steps/s = 1 rev/s = 60 rpm. Change the clock frequency or the microstep mode, or toggle DIR to reverse.

### Renewables

- **Solar home system with MPPT charge controller**: A 300 W panel (60 cells, Voc ≈ 40 V, Vmp ≈ 32 V) charges a 12 V 100 Ah AGM battery through an MPPT charge controller. The controller hunts for the panel's maximum-power point (perturb & observe) and converts that power down to the battery voltage — so the battery receives almost twice the panel current. A 21 W 12 V lamp runs from the LOAD output, which disconnects if the battery falls below 11.5 V. Change the irradiance (clouds!) and the panel temperature and watch the panel and battery currents; compare with the PWM controller, which just connects the panel to the battery.
- **Li-ion charger (CC-CV) with protection board**: A USB-powered TP4056-style charger fills a lithium-ion cell through a DW01-style protection board (BMS). Constant current (1 A) until the cell reaches 4.2 V, then constant voltage while the current tapers; it stops at 10 % of the set current. The cell here is only 3 mAh so a whole charge takes seconds. Then unplug the USB switch and close the LOAD switch to discharge it at ≈2 A: when the cell falls to 2.5 V the BMS opens its discharge MOSFET and the load goes dead, protecting the cell from deep discharge; open the load, plug the USB back in and the charger revives it (with the charger plugged in, it supplies 1 A of the load current itself). Watch the cell voltage and current.
- **Grid-tie solar inverter with house load**: Ten 300 W panels in series (≈320 V DC at the maximum-power point) feed a 3 kW grid-tie inverter. It waits until the grid has been healthy for 0.2 s, then tracks the array's maximum power and injects it into the grid as a sine current in phase with the voltage. The house load (1 kW) is supplied first; the surplus flows back out through the meter, so the grid current is in anti-phase with the voltage (export). Lower the irradiance and the grid starts supplying the difference. Open the GRID switch: the anti-islanding protection stops the inverter at once, so a line worker is never shocked by a "dead" line.
- **Off-grid inverter (IPS) from a 12 V battery**: A pure-sine inverter makes 230 V 50 Hz from a 12 V 100 Ah battery — the classic home IPS. Switch on the lamp and the fan: the battery current follows the AC power (≈ P / (12 V × 0.9)), pulsing at 100 Hz because AC power itself pulses at twice the line frequency. The inverter shuts down if the battery falls below 10.5 V (and restarts above 12.5 V) and trips on overload (> 150 % of 1 kW for 0.5 s). Lower the battery state of charge to see the low-voltage cut-off.
- **Wind turbine charging a 48 V battery bank**: A 1.5 kW wind turbine (1.2 m blades, permanent-magnet generator with built-in rectifier) charges a 48 V lead-acid bank (24 cells). The heavy rotor takes several seconds to speed up until the generator EMF exceeds the battery voltage; then the battery loads the generator and the rotor settles where the aerodynamic torque equals the electrical torque. Power rises with the cube of the wind speed: change the wind knob from 5 to 12 m/s and watch the charging current. Below ≈5.5 m/s the EMF never reaches the battery voltage, so nothing flows (cut-in speed); above 25 m/s the turbine brakes itself (cut-out).

### Communication

- **UART over RS-232 (null-modem, full duplex)**: Two devices talk over a serial cable. Each UART transmitter idles high and sends every character as a start bit, 8 data bits (LSB first) and a stop bit at 9600 baud. The MAX232 transceivers turn the 0/5 V logic into ±9 V RS-232 levels (inverted: logic 1 = −9 V) so the signal survives a long cable, and back again. The cable is crossed (null-modem): TX of one side goes to RX of the other, so both directions work at once. The left terminal receives "OK", the right one "HELLO". Probe the cable to see the ±9 V frames.
- **RS-485 differential bus with termination**: Industrial sensors and PLCs talk over RS-485: one twisted pair, the data carried as the difference A − B (≈ ±2 V on the loaded bus), so common-mode noise picked up along the cable cancels — runs of a kilometre are normal. The left transceiver drives the bus (DE = 1); the right one only listens (DE = 0) and its receiver turns the differential signal back into logic for the UART terminal. Both ends of the bus are terminated with 120 Ω to stop reflections. Switch DE off: the bus idles, the fail-safe receiver reads 1 and the text stops.
- **AM radio receiver chain**: The signal path of an AM receiver (frequencies scaled down so it runs in real time: a 20 kHz carrier modulated 50 % by a 500 Hz tone, instead of a 531–1602 kHz broadcast station). The tuned RF amplifier selects and amplifies the carrier; the envelope detector (diode + RC, τ = 0.3 ms: much longer than one carrier cycle, much shorter than one audio cycle) recovers the modulation; a 2 kHz low-pass filter removes the remaining carrier ripple and the coupling capacitor blocks the DC so only the 500 Hz tone reaches the speaker. Probe each stage; change the modulation depth or the detector time constant (too long → diagonal clipping).
- **433 MHz wireless remote (link budget)**: A 433 MHz ASK transmitter/receiver pair as used in remote doorbells and gate openers. Press the button: the transmitter sends while it is held and the receiver output switches the buzzer. The link works only while the received power — transmit power minus the path loss, which grows with 10·n·log(distance) — is above the receiver sensitivity: increase the distance (or choose the urban environment) until the margin goes negative and the remote stops working. Try the other radio presets too (nRF24L01, Bluetooth LE, Wi-Fi, LoRa, Zigbee): compare their ranges and latencies.
- **I²C bus: running light on a PCF8574**: I²C needs only two wires for many chips: SCL (clock) and SDA (data), both open-drain with 4.7 kΩ pull-ups, so any device can pull a line low but none ever drives it high. The master sends START, the 7-bit address 0x20 + write, waits for the slave to acknowledge (it pulls SDA low on the 9th clock), sends one data byte and STOP. The PCF8574 copies each byte to its eight port pins — here a pattern with one 0 that walks along, a running light. Probe SCL and SDA to see the clock and the address/data/ACK bits; change the slave address of the master to see NACK.
- **SPI: 74HC595 shift register outputs**: SPI is a fast synchronous bus: the master pulls ¬CS low, puts each bit on MOSI and pulses SCK; the slave samples MOSI on the rising edge. A 74HC595 shifts the eight bits in (SCK → SRCLK, MOSI → SER) and the rising edge of ¬CS at the end (→ RCLK) copies them to the outputs all at once, so the LEDs never flicker while shifting. The master sends 81, 42, 24, 18 (hex) in turn — two lights moving towards the middle. Probe SCK and MOSI; edit the data bytes of the SPI master.
- **RFID door lock (125 kHz reader)**: An RDM6300-style 125 kHz RFID reader: bring the tag closer than 5 cm (select the reader and turn the tag-distance knob down) and its TAG output goes high while the tag ID is sent as 9600-baud UART text — shown on the terminal. TAG drives an NPN transistor that energises the 12 V door-lock solenoid; the diode across the solenoid absorbs the inductive kick when the transistor switches off. Move the tag away and the lock closes again.
- **Fibre-optic serial link**: A UART message travels as light through a 20 m plastic optical fibre: an LED transmitter, the fibre and a photodiode receiver with a comparator. It is immune to electrical noise and isolates the two ends. The link budget decides whether it works: received power = −3 dBm − 0.2 dB/m × length − 2 × connector loss. Lengthen the fibre past ≈ 100 m (or switch to multimode glass and back) and see when the received power drops below the −25 dBm sensitivity and the text stops.

<a id="ch-formulas"></a>

## 18. Quick reference: formulas and units

#### Ohm's law and power

- `V = I × R`   ·   `P = V × I = I²R = V²/R`
- Series: `R = R1 + R2 + …`   ·   Parallel: `1/R = 1/R1 + 1/R2 + …`
- Voltage divider: `Vout = Vin × R2 / (R1 + R2)`

#### Capacitors, inductors and time constants

- RC time constant: `τ = R × C` (reaches 63 % in one τ, 99 % in 5 τ)
- RL time constant: `τ = L / R`
- Reactance: `Xc = 1 / (2πfC)`   ·   `Xl = 2πfL`
- Cut-off of RC filter: `fc = 1 / (2πRC)`
- Resonance of L and C: `f₀ = 1 / (2π√(LC))`   ·   Series RLC: `Q = (1/R)·√(L/C)`

#### AC

- `Vrms = Vpeak / √2` (230 V RMS = 325 V peak)
- Frequency and period: `f = 1 / T`
- Power factor: `PF = cos φ = P / S`   ·   `S = V × I` (VA)   ·   `Q = V × I × sin φ` (VAR)
- 3-phase: `V_line = √3 × V_phase`

#### Semiconductors and ICs

- LED resistor: `R = (Vsupply − Vf) / I`
- Inverting op-amp gain: `−Rf / Rin`   ·   Non-inverting: `1 + Rf / Rg`
- 555 astable: `f = 1.44 / ((R1 + 2·R2) × C)`
- Transformer: `Vs / Vp = Ns / Np`
- Ripple of a rectifier with a capacitor: about `I / (f × C)`

#### Unit prefixes

| Letter | Name and size |
| --- | --- |
| `p` | pico, 10⁻¹² |
| `n` | nano, 10⁻⁹ |
| `u` or `µ` | micro, 10⁻⁶ |
| `m` | milli, 10⁻³ |
| `k` | kilo, 10³ |
| `M` or `meg` | mega, 10⁶ |
| `G` | giga, 10⁹ |

#### Colours used by the app

- Green = positive voltage · Red = negative voltage · Yellow dots = current.
- Blue labels = voltages · Green labels = currents.
- Scope: yellow, cyan, pink, green, orange, purple channels. Bode: yellow = gain, cyan dashed = phase.

<a id="ch-troubleshooting"></a>

## 19. Troubleshooting and FAQ

#### Nothing happens when I press Run

- The board may be empty: add components first.
- The circuit may have no closed loop: current needs a path from the source, through the parts, and back.
- The simulation may be **paused**: the button reads **Resume**.
- The speed may be too slow or too fast for your circuit: tap the speed chip and tick **Automatic**.

#### My LED / lamp does not light

- Check polarity: the LED current must flow from anode to cathode. Use **Reverse polarity** in the quick bar.
- Check that the wires touch the terminal circles. Zoom in to look.
- Is a switch open? Tap it.
- Is there enough voltage? An LED needs about 2 V plus a series resistor. A lamp needs its rated voltage.
- Is a protective device tripped (MCB, fuse, RCCB)? Tap it to reset, or find the cause.

#### "Circuit cannot be solved (singular matrix)"

- A **floating** part: something is connected to nothing, or a current source has no path. Connect it, or add a high resistor to ground.
- A **loop of voltage sources or inductors** with no resistance. Add a small series resistor.
- Two ideal voltage sources of different value connected in parallel. Add a little internal resistance (every source has an "Internal resistance" setting).
- The message names the part: it is highlighted. Start there.

#### "Simulation failed to converge" / "did not converge"

- Slow the simulation (smaller timestep) with the speed chip.
- Check for very large or very small values (for example 1 TΩ next to 1 mΩ).
- Add small series resistances to ideal switches, sources and inductors.
- In **Settings**, try **Backward Euler**, or switch off **Start from DC operating point**.

#### "… is short-circuited"

A warning that both terminals of a part are on the same net. Remove the extra wire, unless you did it on purpose.

#### The scope or meter shows nothing

- The simulation must be running.
- Scope: you must add a probe first (select a wire, tap **Scope**). Up to 6 channels.
- Meter: the probe pins must sit on a node (a wire or terminal). **Probe not on a node** means move the pin.
- A or W mode needs a selected two-terminal part.

#### The Bode plot is empty or the button does nothing

- Add a source and make sure it is chosen as **Input source**.
- Probe the output wire with **Scope** so it appears under **Output**.
- The stop frequency must be larger than the start frequency.

#### "CPU-limited" or the app feels slow

- Lower the **simulation speed**.
- Settings → **Animations → Off**, and switch off **Live node voltages** and **Live currents**.
- Close the scope panel and other apps. Very big circuits with many digital parts need more power.

#### I cannot connect two parts

- Zoom in (pinch) so the terminals are bigger.
- Tap exactly on the small circle: it lights up with a ring. A tap in the middle of a part selects the part instead.
- Then tap the other terminal or a wire. Tapping empty space cancels.

#### I changed something by mistake

Tap **Undo** (up to 120 steps). If you changed an example, open it again from Examples: the original is untouched.

#### My circuits disappeared

Circuits live inside the app on your phone. Clearing the app's data or uninstalling the app removes them. Restore from a backup file if you made one (**Open file / Restore backup**). Make backups regularly.

#### Can I use it without internet?

Yes. Only the buttons that open the RAPTI website, WhatsApp, email or map need internet.

#### Is the result exactly like a real circuit?

The engine follows SPICE methods and has been checked against textbook answers (RC and RL time constants, resonance, diode, BJT and MOSFET equations, op-amp gain, transformer ratio, logic truth tables, 555 frequency and more). Blocks such as logic gates, the 555, regulators, sensors and protection devices are **idealised models**. Always confirm important designs with datasheets and real measurements, and use **SPICE netlist** to cross-check in ngspice or LTspice.

<a id="ch-about"></a>

## 20. About RAPTI and contact

**Resonance Automation Professional Training Institute** (RAPTI) was established in 2019. Established in 2019 with one goal: developing skilled manpower for the automation industry. Courses at RAPTI are designed by experienced, competent engineers so that every student can work independently in any industry after completing a course — with the knowledge and skills that real job positions demand.

#### Courses

- Industrial Automation (PLC) — 3 Months
- Industrial Electrical Control — 3 Months
- General Electrician — 3 Months
- House Wiring — 3 Months
- CC Camera — 15 Days
- Computer Office Application — 3 Months
- Graphic Design & Multimedia — 3 Months
- Web Design & Development — 3 Months
- App Development — 3 Months

Tap a course on the **About** page to see what it covers and how long it takes.

#### Contact

- Website: rapti.net
- Phone / WhatsApp: 01617-345534, 01685-953204, 01766-221733
- Email: raptibd@gmail.com
- Address: 2101, Bhuighar, Rupayan Town, Near Gate-1, Fatullah, Narayanganj - 1420, Bangladesh
- The **About** page in the app has one-tap buttons for all of these.

---
© 2026 Resonance Automation Professional Training Institute · rapti.net
