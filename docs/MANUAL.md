[বাংলায় পড়ুন → MANUAL.bn.md](MANUAL.bn.md)

# RaptiCKT — User Manual

*Resonance Automation · Circuit Simulator · Version 1.0.0*

Everything in the app, explained step by step.

## Contents

1. [Welcome to RaptiCKT](#en-ch-welcome)
2. [Quick start: your first circuit](#en-ch-quickstart)
3. [Home, Examples, My Circuits, About](#en-ch-screens)
4. [The editor at a glance](#en-ch-editor)
5. [Adding components](#en-ch-adding)
6. [Moving, selecting and editing parts](#en-ch-editing)
7. [Wiring](#en-ch-wiring)
8. [Changing values and the knob](#en-ch-values)
9. [Running the simulation](#en-ch-running)
10. [Oscilloscope](#en-ch-scope)
11. [Multimeter](#en-ch-meter)
12. [Analysis: Bode, DC sweep, operating point, SPICE](#en-ch-analysis)
13. [Saving, opening and sharing](#en-ch-saving)
14. [Settings reference](#en-ch-settings)
15. [Component library (all 335)](#en-ch-library)
16. [Examples (all 29)](#en-ch-examples)
17. [Quick reference: formulas and units](#en-ch-formulas)
18. [Troubleshooting and FAQ](#en-ch-troubleshooting)
19. [About RAPTI and contact](#en-ch-about)

<a id="en-ch-welcome"></a>

## 1. Welcome to RaptiCKT

**RaptiCKT** is a circuit simulator that runs on your phone. You draw a circuit, press **Run**, and the app calculates what every wire and part is doing, live: voltages glow on the wires, small dots show current flowing, and you can measure with an oscilloscope and a multimeter. Nothing needs an internet connection.

#### What you can do with it

- Build analog, digital and mixed circuits on an unlimited canvas.
- Pick from **335 components in 20 categories**: sources, batteries, resistors, capacitors, transformers, protection devices, switches, house-wiring parts, motors, diodes, transistors, op-amps, logic ICs, sensors, meters and more.
- Watch the circuit work: green wires are positive, red wires are negative, yellow dots move with the current.
- Tap switches and push buttons while the circuit is running, and turn a knob to change any value live.
- Measure with a **6-channel oscilloscope** (with FFT and XY) and a **multimeter** (V, A, Ω, W).
- Run **AC sweep (Bode plot)**, **DC sweep**, **Operating point** and export a **SPICE netlist**.
- Learn from **29 ready-made examples**: LED, RC filter, rectifier, amplifier, 555 timer, tube light, staircase wiring, house wiring, DOL motor starter and more.
- Save circuits on the phone, share them as `.rckt` files, and export a picture (PNG).

#### Who it is for

Electrical and electronic engineering students, teachers, technicians, hobbyists and researchers. It is made by **RAPTI — Resonance Automation Professional Training Institute**.

#### Requirements

- Android 8.0 or newer.
- No internet needed. Everything, including your saved circuits, stays on your phone.

#### How to read this manual

If you are new, read chapters 2 to 6 first (about 10 minutes). The rest is a reference: come back when you need a feature. Use the search box at the top, or tap a chapter in the contents. The **English / বাংলা** button switches the language.

<a id="en-ch-quickstart"></a>

## 2. Quick start: your first circuit

Let us build the "hello world" of electronics: a battery, a resistor and an LED. It takes about two minutes.

1. On the **Home** screen tap **New circuit**. An empty board opens.
2. Tap the round **+** button (bottom right). The component menu opens.
3. Type `dc` in the search box and tap **DC Voltage**. A battery symbol appears on the board. Then search `resistor` and tap **Resistor**, then search `led` and tap **LED**, then search `ground` and tap **Ground**. The menu stays open so you can add several parts in a row. Tap **✕** to close it.
4. Drag the parts with your finger to arrange them in a row. Pinch with two fingers to zoom, drag on empty space to move the board.
5. **Draw the wires.** Every part has small circles at its ends: these are the **terminals**. Put your finger on a terminal and drag to a terminal of the next part, then lift. A wire is drawn. Connect: battery **+** → resistor → LED anode (the flat-triangle side) → LED cathode → ground, and battery **−** → ground.
6. Tap the battery and use the **knob** that appears (or open its properties) to set the voltage to **9 V**. Tap the resistor and set it to **470 Ω**. You can type values like `470`, `4.7k`, `10u`.
7. Press **Run** in the toolbar. The wires turn green, yellow dots flow, and the LED lights up. The current (about 15 mA) is written next to the resistor.
8. Select the wire between the resistor and the LED and tap **Scope**. The oscilloscope opens and draws that voltage.
9. Press **Run** again to pause. Tap **Undo** if you made a mistake. The circuit is saved automatically; find it later under **My Circuits**.

> **Tip:** Even faster: open **Home → Examples → LED with switch**. It is already wired. Press Run and tap the switch.

> **Tip:** If the LED does not light, check that every wire end really touches a terminal, and that there is a resistor in series. See **Troubleshooting**.

<a id="en-ch-screens"></a>

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

29 ready-made circuits, each with an explanation. Filter by category with the chips at the top. Opening an example starts it running by itself (press Pause to stop it). If you change an example, it is saved as your own circuit when you go back; the original example is never damaged.

The full list is in the chapter **Examples**.

#### My Circuits

All circuits you built, newest first, saved on this phone (up to 200). Tap a circuit to open it. Tap the **⋮** button on a card for:

- **Open**, **Rename**, **Duplicate** (makes "name (copy)").
- **Export file**: saves a `.rckt` file.
- **Share**: sends the circuit through WhatsApp, Messenger, email, etc.
- **Delete**: removes that circuit after confirmation.

Buttons on top of the page: **New**, **Import**, **Backup all** (one file with every circuit) and **Delete all** (asks first and offers a backup before deleting).

#### About

Version number, a short description of the app and its engine, information about RAPTI (courses, phone, WhatsApp, email, website, address), and accuracy notes.

#### Back button

The Android **Back** button closes the topmost thing: an open dialog, then Settings or Manual, then panels inside the editor, then clears the selection, and finally goes back to Home. Your circuit is saved when you leave the editor or put the app in the background.

<a id="en-ch-editor"></a>

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

#### The board

- The big area with the grid is your **canvas**. It is unlimited: pan and zoom freely.
- The round **+** button (bottom right) adds a component.
- The chip at the top of the board shows the simulation time and speed, for example `t = 12.5 ms · 5 ms/s`. Tap it to change the speed (chapter 9). It says **CPU-limited** when the phone cannot keep up.
- A red or yellow bar appears at the top when the circuit has a problem (chapter 18).
- When you select a part, a **quick bar** appears (name, current reading, rotate, scope, edit, delete) and, for parts with a main value, the **knob**.
- Messages (toasts) appear briefly at the bottom to confirm what happened.

#### Gestures

| Gesture | Result |
| --- | --- |
| Tap a part | Selects it. On a switch or button, it also operates it. |
| Hold a part (half a second) | Opens its properties. |
| Drag a part | Moves it. Wires stay attached and follow. |
| Drag from a terminal | Draws a wire. |
| Drag empty space | Pans the board. |
| Pinch with two fingers | Zooms in and out. |
| Hold empty space, then drag | Draws a selection box. |
| Tap a wire | Selects the wire (then you can scope or delete it). |
| Tap empty space | Clears the selection. |

On a computer browser you can also use: **Delete** (remove), **R** (rotate), **Space** (run/pause), **Ctrl+Z / Ctrl+Y** (undo/redo), **Ctrl+D** (copy), and the mouse wheel to zoom.

<a id="en-ch-adding"></a>

## 5. Adding components

1. Tap the round **+** button. The component menu slides up.
2. Choose a category tab: **Recent**, **Sources**, **Batteries**, **Passive**, **Transformers**, **Protection**, **Switches & Relays**, **Electrical**, **Power Systems**, **Machines**, **Diodes**, **Transistors**, **Thyristors & Power**, **Analog ICs**, **Control & Math**, **Logic Gates**, **Digital ICs**, **Sensors**, **Output**, **Vacuum Tubes**, **Meters**. Swipe the tab row sideways to see them all.
3. Or type in the **search box**. It searches names, keywords and categories, for example `thermistor`, `555`, `3 phase`, `fuse`.
4. Tap a component. It is placed in a free spot in the middle of the visible board. The menu stays open, so tap more parts if you need them.
5. Tap **✕** (or the Back button) to close the menu.

> **Tip:** The **Recent** tab remembers the parts you used last, so common parts are one tap away.

> **Tip:** Always add a **Ground** to your circuit (see chapter 7). Many examples show where it goes.

The complete list of all 335 components, with what each one does and which values you can change, is in the chapter **Component library**.

<a id="en-ch-editing"></a>

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

- **Move**: drag the part. It snaps to the grid. Connected wires follow and re-route neatly. The undo button reverses the move.
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

<a id="en-ch-wiring"></a>

## 7. Wiring

#### Draw a wire

1. Put your finger on a **terminal** (the small circle at the end of a part).
2. Drag. A preview wire follows your finger and bends neatly with right angles. It avoids parts when it can.
3. Lift your finger on another terminal. The wire snaps to it. If you lift over the body of a part, the wire attaches to that part's nearest terminal.

#### Branches and junctions

- To branch from an existing wire, start dragging **from a point on that wire**, or end a new wire **on** an existing wire. The two are now electrically joined.
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

<a id="en-ch-values"></a>

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

<a id="en-ch-running"></a>

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
| MCB, MCCB, RCCB, RCBO | Tap to switch on/off. After a trip, tap once to **reset**. |
| Overload relay, IDMT relay | Tap to reset after a trip. |
| Logic input, hex input | Tap to flip a bit / step the value. |
| PIR sensor | Tap to simulate motion. |
| Capacitive touch sensor | Tap to touch / release. |
| Peak meter, kWh meter | Tap to reset. |

#### Errors and warnings

If the circuit cannot be solved, a bar at the top tells you what and where, for example **"Circuit cannot be solved (singular matrix) near R3. Check for floating current sources or open circuits."** The part concerned is highlighted. A yellow bar is a warning, for example "D1 is short-circuited". See **Troubleshooting** for what to do.

<a id="en-ch-scope"></a>

## 10. Oscilloscope

The oscilloscope draws voltages and currents against time, up to **6 channels** at once, each in its own colour.

#### Add a channel (probe)

- **A node voltage**: tap a wire, then tap **Scope** in the selection bar. The probe is placed at the point you tapped and measures that net against ground.
- **Voltage across a part**: select the part, tap the **scope** icon in the quick bar (or **Scope V** in the properties sheet).
- **Current through a part**: select the part and tap **Scope I** in its properties sheet.
- The scope panel opens automatically. A coloured pin on the board marks where each probe is.

Channel colours: yellow, cyan, pink, green, orange, purple. Probes are saved with the circuit.

#### Reading the display

- Each channel **auto-scales** to fit; the highest and lowest values of the screen are written at the right edge in the channel colour.
- The bottom right corner shows the **time per division** (for example `2 ms/div`). There are 10 divisions across.
- Under the graph, one line per channel gives the **latest value**, **pp** (peak-to-peak), **rms** and the **frequency f** (found from the signal).
- A bright dot on the right edge marks the live value.

#### Scope buttons

| Button | What it does |
| --- | --- |
| +  /  − | Zoom the time axis in / out (half or double the time window). You can also pinch on the scope. |
| Mode | Cycles **Time → FFT → XY → Time**. XY needs at least 2 channels. |
| Freeze | Stops recording so you can study the picture. Press again to continue. |
| Download | Exports the recorded data as a CSV file (time, then one column per channel). |
| Colour chip with ✕ | Tap a channel chip to remove that probe. |

#### Time, FFT and XY views

- **Time**: normal waveform view.
- **FFT** (spectrum): shows how much of each frequency is in the signal, on a log frequency axis and a 0 to −100 dB scale. Under it you see the **peak frequency** of each channel. A pure sine shows one tall peak; a square wave shows odd harmonics; a rectifier shows the ripple frequency.
- **XY**: channel 1 is drawn along X and channel 2 along Y, like a real scope in XY mode. Use it for Lissajous figures, phase comparison and I–V curves.

> **Tip:** The scope keeps the most recent 4096 points. If a signal looks too fast or too slow, change the **time scale** (+ / −) or the **simulation speed** (chapter 9).

<a id="en-ch-meter"></a>

## 11. Multimeter

Tap the **multimeter** icon in the top bar. A meter card appears on the board with a red (+) and a black (−) probe pin. The simulation must be running.

| Mode | How to use | It shows |
| --- | --- | --- |
| **V** | Drag the red and black probe pins onto two nodes (a terminal or a wire). The pins snap to connection points. | DC (average) voltage between the probes, plus AC RMS and the instantaneous value. |
| **Ω** | Place the probes across a part or network. The app switches off all sources and measures what is left. | Small-signal resistance (**OL** if open). |
| **A** | Select a two-terminal component. Probes are not used. | Current through it: average, RMS and instantaneous. |
| **W** | Select a two-terminal component. | Average power in it (positive = absorbing power, negative = delivering). |

The display reads smoothly (about a 0.4 s average) so numbers do not flicker. Tap **✕** on the card to close the meter.

> **Tip:** For permanent meters inside the circuit, use parts from the **Meters** category (voltmeter, ammeter, wattmeter, power-factor meter, frequency meter, kWh meter…). They stay in the circuit and are saved with it.

<a id="en-ch-analysis"></a>

## 12. Analysis: Bode, DC sweep, operating point, SPICE

Tap the **Analysis** icon (top bar) or use **⋮ → Operating point / SPICE netlist**. There are four tabs. These tools solve the circuit mathematically and do not need the simulation to be running.

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

#### 4. SPICE Netlist

Generates a standard SPICE netlist of your schematic, with `.op` and `.tran` commands, that you can open in **ngspice** or **LTspice** to cross-check results or continue research. Buttons: **Copy**, **Save .cir**, **Share**. Parts without a SPICE equivalent (such as digital blocks) are written as comments.

<a id="en-ch-saving"></a>

## 13. Saving, opening and sharing

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

- **Backup all** (My Circuits page or Settings → Backup circuits) saves **every** circuit in one file named `RaptiCKT_backup_<date>.json`.
- To restore, tap **Import** or **Restore backup** and choose that file. The circuits are added back to My Circuits.
- Keep a backup before you change phones, clear app data or uninstall the app. **Uninstalling the app deletes your saved circuits.**

> **Warning:** Storage is limited. If the app says "Storage is full", export some circuits as files and delete old ones.

#### Sending a circuit to a friend

1. Open the circuit (or use its **⋮** menu in My Circuits).
2. Choose **Share** and pick WhatsApp, Messenger, email or any app. Or choose **Export file** and send the `.rckt` file yourself.
3. Your friend opens the file with **Open file** (or **Import**) in RaptiCKT. It is added to their My Circuits.

<a id="en-ch-settings"></a>

## 14. Settings reference

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
| Sound (buzzer) | Plays a tone when a buzzer, bell or speaker is active. |
| Backup circuits | Saves every circuit in one file. |
| Restore backup | Loads a backup or circuit file. |
| Reset settings | Back to defaults (your circuits are not touched). |

<a id="en-ch-library"></a>

## 15. Component library (all 335)

Every component in the app, grouped as in the **+** menu. For each part you see what it does and which settings you can change. Use the search box at the top of the manual to find a part quickly.

*Component descriptions are shown in English, exactly as they appear inside the app.*

### Sources (32)

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
| **Function Source f(t)** | Voltage given by a formula of time t (and the knob parameter k). Functions: sin cos tan exp ln log10 sqrt abs min max pow floor sign step square tri if(c,a,b); constants pi, e; SI suffixes (1k, 2m). <br>*Settings:* v(t) =, Parameter k (use as k), Internal resistance (Ω) |
| **VCVS** | Voltage-controlled voltage source: Vout = gain · Vin (left pair controls right pair). <br>*Settings:* Gain (V/V) |
| **VCCS** | Voltage-controlled current source: Iout = gm · Vin, flowing through the source from + to −. <br>*Settings:* Transconductance (S) |
| **CCVS** | Current-controlled voltage source: Vout = r · Iin, where Iin flows through the left terminals (0 V sense). <br>*Settings:* Transresistance (Ω) |
| **CCCS** | Current-controlled current source: Iout = β · Iin, where Iin flows through the left terminals. <br>*Settings:* Current gain (A/A) |

### Batteries (8)

Each battery has a **state of charge** (%), a capacity (Ah) and an internal resistance. Its voltage falls as it discharges and a heavy load makes it sag. Current flowing into the + terminal charges it.

| | |
| --- | --- |
| **AA Cell 1.5 V** | Alkaline AA cell: 1.58 V fresh, falling to 0.9 V at end of life; about 0.15 Ω internal resistance. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **9 V Battery** | Battery: open-circuit voltage follows the state of charge (chemistry curve), with internal resistance. Charge is integrated while simulating: I·t / capacity. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **Coin Cell CR2032** | CR2032 lithium coin cell: 3 V nominal, high internal resistance (≈15 Ω), so it cannot deliver large currents. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **NiMH Cell 1.2 V** | Battery: open-circuit voltage follows the state of charge (chemistry curve), with internal resistance. Charge is integrated while simulating: I·t / capacity. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **Li-ion Cell 3.7 V** | Li-ion 18650 cell: 4.2 V full, 3.7 V nominal, 3.0 V empty. Charging (current into +) raises the state of charge. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **Li-Po Pack 2S 7.4 V** | Battery: open-circuit voltage follows the state of charge (chemistry curve), with internal resistance. Charge is integrated while simulating: I·t / capacity. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **Lead-Acid Battery 12 V** | 12 V lead-acid (6 cells): 12.7 V full, about 11.6 V discharged. Very low internal resistance, so it can supply high currents. <br>*Settings:* State of charge (%), Capacity (Ah), Internal resistance (Ω) |
| **Supercapacitor** | Electric double-layer capacitor: large C with series ESR and self-discharge (leakage) resistance. <br>*Settings:* Capacitance (F), ESR (Ω), Leakage resistance (Ω), Rated voltage (V) |

### Passive (17)

Resistors, capacitors and inductors, plus variable and real-world versions. The knob changes the main value. Polarised capacitors (electrolytic, tantalum, supercapacitor) must be connected the right way round.

| | |
| --- | --- |
| **Resistor** | Linear resistor obeying Ohm's law V = I·R. <br>*Settings:* Resistance (Ω), Symbol |
| **Rheostat (Variable Resistor)** | Two-terminal variable resistor: R = setting × Rmax. Adjust live with the knob (e.g. field rheostat, current limiting). <br>*Settings:* Setting (%), Maximum resistance (Ω) |
| **Potentiometer** | Three-terminal variable resistor. Adjust the wiper with the knob while simulating. <br>*Settings:* Wiper position (%), Total resistance (Ω), Taper |
| **Trimmer Potentiometer** | Preset (trimmer) potentiometer for calibration. Same model as a potentiometer. <br>*Settings:* Wiper position (%), Total resistance (Ω), Taper |
| **Capacitor** | Ideal capacitor: i = C·dv/dt. Plates show accumulated charge while simulating. <br>*Settings:* Capacitance (F), Initial voltage (V) |
| **Electrolytic Cap** | Polarised capacitor. Flashes red when reverse-biased or over its rated voltage. <br>*Settings:* Capacitance (F), Initial voltage (V), Rated voltage (V) |
| **Non-Polar Electrolytic** | Bipolar (non-polarised) electrolytic / motor-run capacitor: can see AC. Typical fan capacitor 2.5 µF. <br>*Settings:* Capacitance (F), Initial voltage (V) |
| **Tantalum Capacitor** | Polarised tantalum capacitor: small, low ESR. Flashes red if reverse biased or over-voltage (tantalums fail short!). <br>*Settings:* Capacitance (F), Initial voltage (V), Rated voltage (V) |
| **Variable Capacitor** | Tuning capacitor: C varies from Cmin to Cmax with the setting (e.g. 10–365 pF radio gang). <br>*Settings:* Setting (%), Minimum capacitance (F), Maximum capacitance (F) |
| **Capacitor (ESR, ESL, leakage)** | Capacitor with parasitics: ESR and ESL in series, leakage in parallel. Above its self-resonant frequency f = 1/(2π√(ESL·C)) it behaves like an inductor — see it in a Bode plot. <br>*Settings:* Capacitance (F), ESR (Ω), ESL (H), Leakage resistance (Ω) |
| **Inductor** | Ideal inductor v = L·di/dt with optional winding resistance. <br>*Settings:* Inductance (H), Series resistance (Ω), Initial current (A) |
| **Variable Inductor** | Slug-tuned inductor: L = setting × Lmax (minimum 1 % of Lmax). <br>*Settings:* Setting (%), Maximum inductance (H), Series resistance (Ω) |
| **Iron-Core Inductor (saturating)** | Nonlinear inductor: ψ(i) = Lsat·i + (L0 − Lsat)·Isat·tanh(i/Isat). Above Isat the core saturates and the current peaks sharply — see inrush and distorted magnetising current. <br>*Settings:* Unsaturated inductance (H), Saturation current (A), Saturated inductance (H), Winding resistance (Ω) |
| **Ferrite Bead** | Ferrite bead: nearly a short at DC and low frequency, lossy (resistive) at high frequency — model Rdc + (L ∥ R). <br>*Settings:* Impedance at 100 MHz (Ω), DC resistance (Ω) |
| **Quartz Crystal** | Butterworth–Van Dyke model: series Rm–Lm–Cm (Lm = 1/((2πf)²·Cm)) in parallel with C0. Extremely high Q; series and parallel resonances are visible in a Bode plot. <br>*Settings:* Frequency, Series resonance (Hz), Motional resistance Rm (Ω), Motional capacitance Cm (F), Shunt capacitance C0 (F) |
| **Transmission Line (lossless)** | Ideal lossless line (Branin method of characteristics). Port 1 on the left, port 2 on the right, returns at the bottom. Mismatched terminations produce reflections after 2·Td. <br>*Settings:* Characteristic impedance Z0 (Ω), Delay Td (s) |
| **Memristor (HP model)** | HP TiO₂ memristor (Strukov 2008) with a Joglekar window: R = Ron·w + Roff·(1 − w), dw/dt = k·i·(1 − (2w − 1)^(2p)). A sine drive gives the pinched I–V hysteresis loop. <br>*Settings:* R_on (Ω), R_off (Ω), Mobility factor µv·Ron/D² (1/C), Initial state w0, Joglekar window exponent p |

### Transformers (11)

Coupled-coil models with a turns ratio. Use them for isolation and for stepping voltage up or down. The 3-phase transformers have standard vector groups (Dyn11, Yyn0, Yd1, Dd0). CT and PT are instrument transformers for metering.

| | |
| --- | --- |
| **Transformer** | Two coupled windings. L2 = L1·n², M = k·√(L1·L2). Dots mark in-phase terminals. <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω) |
| **Step-Down Transformer** | Mains step-down transformer, 230 V → 12 V (turns ratio 12/230). <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω) |
| **Step-Up Transformer** | Step-up transformer, turns ratio 1:10. <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω) |
| **Isolation Transformer 1:1** | 1:1 transformer: same voltage, but the secondary is galvanically isolated from the mains and earth. <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω) |
| **Centre-Tap Transformer** | Transformer with a centre-tapped secondary (e.g. 230 V → 12-0-12 V). Terminals: primary (left), secondary top / CT / bottom (right). <br>*Settings:* Primary voltage (RMS) (V), Secondary voltage, each half (RMS) (V), Magnetising inductance (H), Coupling k, Primary resistance (Ω), Secondary resistance (each half) (Ω) |
| **Dual-Secondary Transformer** | One primary and two electrically isolated secondaries on the same core. <br>*Settings:* Primary voltage (RMS) (V), Secondary 1 voltage (RMS) (V), Secondary 2 voltage (RMS) (V), Magnetising inductance (H), Coupling k, Primary resistance (Ω), Secondary resistance (Ω) |
| **Autotransformer / Variac** | Single tapped winding (variac): input across top–common, output from the sliding tap to common. Vout ≈ tap % × Vin with no isolation. <br>*Settings:* Output (tap position) (%), Winding inductance (H), Coupling k, Winding resistance (Ω) |
| **Current Transformer (CT)** | Current transformer, 1 : 100 turns (e.g. 100 A / 1 A). Put the primary in series with the line and connect an ammeter or burden across the secondary — never leave a loaded CT secondary open. <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω) |
| **Potential Transformer (PT)** | Voltage (potential) transformer, 11 kV → 110 V, for measuring high voltages with a standard voltmeter. <br>*Settings:* Primary inductance (H), Turns ratio (Ns/Np), Coupling k, Primary resistance (Ω), Secondary resistance (Ω) |
| **3-Phase Transformer** | Three single-phase windings pairs (one per limb) connected per the vector group. Primary A, B, C on the left; secondary a, b, c and neutral n on the right. Dyn11: secondary leads primary by 30°. <br>*Settings:* Vector group, Primary line voltage (V), Secondary line voltage (V), Magnetising inductance (per phase, primary) (H), Coupling k, Primary winding resistance (Ω), Secondary winding resistance (Ω) |
| **Coupled Inductors (M)** | Two inductors with mutual inductance M = k·√(L1·L2) (dots mark the in-phase ends). Loosely coupled coils, wireless power, tuned transformers. <br>*Settings:* L1 (H), L2 (H), Coupling coefficient k, R1 (Ω), R2 (Ω) |

### Protection (16)

Fuses, breakers, residual-current devices, surge protectors and relays. They really **trip** in the simulation (an MCB follows its B/C/D curve, an RCCB trips on leakage current). After a trip the part shows **TRIPPED** with the cause. Tap it once to reset.

| | |
| --- | --- |
| **Fuse** | Blows (opens) when the let-through energy ∫(i² − I²rated)dt exceeds I²t. Reset the simulation to replace it. <br>*Settings:* Current rating (A), Resistance (Ω), Melting I²t (A²s) |
| **HRC Fuse** | High-rupturing-capacity cartridge fuse for power circuits. Melts when ∫(i² − I²rated)dt exceeds its I²t. <br>*Settings:* Current rating (A), Resistance (Ω), Melting I²t (A²s) |
| **Resettable Fuse (PTC)** | Polymer PTC fuse: self-heating raises its resistance by orders of magnitude above the trip current (≈2·Ihold); it resets once the fault is removed and it cools. <br>*Settings:* Hold current (A), Cold resistance (Ω), Thermal time constant (s) |
| **MCB (1-pole)** | Miniature circuit breaker (IEC 60898): thermal trip for overloads, magnetic (instantaneous) trip for short circuits. Tap to switch ON/OFF or to reset after a trip. <br>*Settings:* Rated current In (A), Trip curve, Switched on |
| **MCB (2-pole)** | Double-pole MCB: both poles open together when either one trips. <br>*Settings:* Rated current In (A), Trip curve, Switched on |
| **MCB (3-pole)** | Triple-pole MCB for three-phase circuits: all poles open together. <br>*Settings:* Rated current In (A), Trip curve, Switched on |
| **MCCB (3-pole, adjustable)** | Moulded-case circuit breaker with adjustable thermal (Ir) and magnetic (Im) settings. <br>*Settings:* Rated current In (A), Thermal setting Ir/In, Magnetic setting Im/Ir, Switched on |
| **RCCB / RCD (2-pole)** | Residual-current device: trips when the current going out on L does not return on N (leakage to earth ≥ IΔn, e.g. 30 mA through a person). No overcurrent protection. <br>*Settings:* Rated current In (A), Rated residual current IΔn (A), Switched on |
| **RCBO (2-pole)** | RCBO = RCD + MCB: trips on earth leakage (≥ IΔn) and on overload / short circuit. <br>*Settings:* Rated current In (A), Trip curve, Rated residual current IΔn (A), Switched on |
| **Thermal Overload Relay** | Motor overload relay (IEC 60947-4-1, class 10): the heater carries the motor current; when it trips, the NC control contact (95–96) opens. Tap to reset. <br>*Settings:* Current setting Ir (A) |
| **IDMT Overcurrent Relay** | IEC 60255 inverse-time overcurrent relay (ANSI 51/50). The current coil (left) is fed from a CT secondary; after t = TMS·k/((I/Is)^α − 1) the trip contact (right, NO) closes and latches. Tap to reset. <br>*Settings:* Plug setting (pickup) Is (A), Time multiplier TMS, Curve, Instantaneous element (× Is, 0 = off) |
| **Varistor (MOV)** | Metal-oxide varistor: I ≈ 1 mA·(V/V1mA)^α (exponential approximation). Nearly open at normal voltage, clamps surges. 430 V type suits 230 V mains. <br>*Settings:* Varistor voltage (at 1 mA) (V), Nonlinearity exponent α |
| **Surge / Lightning Arrester** | Metal-oxide surge arrester for power lines (e.g. 11 kV system): conducts heavily above its reference voltage and diverts surges to earth. <br>*Settings:* Varistor voltage (at 1 mA) (V), Nonlinearity exponent α |
| **Gas Discharge Tube** | Gas discharge tube: open until the voltage exceeds the spark-over value, then an arc (≈15 V) conducts until the current falls below the extinction current. <br>*Settings:* Spark-over voltage (V), Arc voltage (V), Extinction current (A) |
| **TVS Diode** | Unidirectional transient-voltage-suppression diode: clamps at its breakdown voltage in reverse, conducts like a diode forward. <br>*Settings:* Model, Breakdown voltage (V) |
| **TVS Diode (bidirectional)** | Bidirectional TVS: two junctions back to back; clamps at about ±V in either polarity. <br>*Settings:* Clamping voltage (V) |

### Switches & Relays (27)

Tap a switch to toggle it while the circuit runs. Push buttons act only while held. Relays, contactors and timer relays have a **coil** side and a **contact** side: when the coil is energised the contacts move.

| | |
| --- | --- |
| **Switch (SPST)** | Single-pole single-throw switch. Tap it to open/close — even while the simulation runs. <br>*Settings:* Closed, On resistance (Ω) |
| **One-Way Switch** | Household one-way (single-pole) wall switch. Tap to switch the light on/off. <br>*Settings:* On |
| **Two-Way Switch** | Household two-way switch (staircase wiring): COM connects to L1 or L2. Two of them control one lamp from two places; add intermediate switches for more places. <br>*Settings:* Position (L2) |
| **Three-Way Switch (US)** | US "three-way" switch: common terminal to either traveler. Identical to a UK/BD two-way switch; use two for staircase lighting and four-way (intermediate) switches in between. <br>*Settings:* Position (L2) |
| **Intermediate Switch** | Intermediate (US: four-way) switch between two two-way switches: straight (1→1, 2→2) or crossed (1→2, 2→1). Lets any number of locations control one lamp. <br>*Settings:* Crossed |
| **Switch (SPDT)** | Single-pole double-throw switch: common terminal (left) connects to A (top) or B (bottom). Tap to flip. <br>*Settings:* Position B, On resistance (Ω) |
| **Switch (DPST)** | Double-pole single-throw switch: two contacts operated together (e.g. switching both L and N). <br>*Settings:* Closed |
| **Switch (DPDT)** | Double-pole double-throw switch: two changeover contacts operated together — e.g. reversing a DC motor. <br>*Settings:* Position B |
| **Push Button (NO)** | Momentary push button, normally open: conducts only while you hold it. <br>*Settings:* On resistance (Ω) |
| **Push Button (NC)** | Momentary push button, normally closed: opens while you hold it. <br>*Settings:* On resistance (Ω) |
| **Latching Push Button** | Push-on / push-off button: each press toggles and it stays there. <br>*Settings:* Latched (closed) |
| **Emergency Stop** | Normally-closed mushroom-head emergency stop: pressing it latches the contact open; twist to release (tap again). <br>*Settings:* Pressed (latched open) |
| **Limit Switch** | Changeover limit / micro switch: COM–NC normally, COM–NO when the lever is actuated. Press and hold (or set "Actuated"). <br>*Settings:* Actuated |
| **Rotary Switch (1P4T)** | Single-pole four-position rotary selector: COM connects to one of positions 1–4. Tap to advance. <br>*Settings:* Position (1–4) |
| **Selector Switch (ON-OFF-ON)** | Three-position selector with centre OFF: COM → A, open, or COM → B (e.g. HAND–OFF–AUTO). Tap to cycle. <br>*Settings:* Position (1 = A, 2 = OFF, 3 = B) |
| **Isolator (Disconnector)** | Off-load isolator: provides a visible break for safe maintenance. Operate only with no load current. <br>*Settings:* Closed |
| **Changeover Switch (Mains/Gen)** | Two-pole, three-position changeover: the load (L, N) is connected to Mains, to nothing, or to the Generator — never both. Tap to cycle. <br>*Settings:* Position (1 = Mains, 2 = Off, 3 = Generator) |
| **Reed Switch** | Glass reed contacts closed by a nearby magnet: close when the magnet is nearer than the pull-in distance, re-open ~40 % further away (hysteresis). <br>*Settings:* Magnet distance (mm), Pull-in distance (mm), Contact |
| **Float Switch** | Float-operated level switch: operates when the liquid rises above the switching level (with hysteresis). NC mode is typical for pump control. <br>*Settings:* Liquid level (%), Switching level (%), Hysteresis (%), Contact |
| **Pressure Switch** | Pump pressure switch: contact closes when pressure falls below cut-in and opens above cut-out (runs the pump in between). <br>*Settings:* Pressure (bar), Cut-in pressure (bar), Cut-out pressure (bar) |
| **Thermostat** | Bimetal thermostat with differential: in heating mode the contact closes below (set − diff/2) and opens above (set + diff/2). <br>*Settings:* Temperature (°C), Set point (°C), Differential (°C), Mode |
| **Relay** | Electromechanical relay: coil (left) with inductance; SPDT contacts COM/NO/NC switch when coil current exceeds pull-in. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), Pull-in (% rated I) (%), Drop-out (% rated I) (%) |
| **Relay (DPDT)** | Two-pole changeover relay (IEC numbering): coil A1–A2; pole 1: 11 common, 12 NC, 14 NO; pole 2: 21, 22, 24. Pull-in at 70 %, drop-out at 35 % of rated coil current. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz) |
| **Reed Relay** | Small reed relay: 5 V, 500 Ω coil operating a normally-open reed contact (13–14). Fast and low power — can be driven from logic. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz) |
| **Contactor (3-pole)** | Three-pole power contactor with 230 V AC coil (A1–A2), main contacts L1–T1, L2–T2, L3–T3 and an auxiliary NO contact 13–14 for the hold-in (self-latching) circuit of a DOL starter. <br>*Settings:* Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz) |
| **Timer Relay (TON/TOF)** | Time-delay relay. On-delay: the changeover contact (15 COM, 16 NC, 18 NO) switches T seconds after the coil is energised. Off-delay: it switches immediately and returns T seconds after de-energising. <br>*Settings:* Delay time (s), Function, Coil rated voltage (V), Coil resistance (Ω), Coil inductance (H), AC coil, AC coil frequency (Hz) |
| **Solid-State Relay (SSR)** | Optically isolated AC solid-state relay: input LED (3+/4−, ~1.2 V + 1 kΩ internal) triggers a TRIAC output (1–2) at the next voltage zero crossing; it turns off at current zero after the input is removed. <br>*Settings:* Input trigger current (A), Zero-cross switching, Output holding current (A) |

### Electrical (15)

Parts for house wiring and lighting: bulbs, tube light with choke and starter, fan with regulators, heater, socket with a selectable appliance (including "Faulty" and "Short circuit" for testing protection), dimmer, bell and earth electrode. Use them with **AC Mains**.

| | |
| --- | --- |
| **Incandescent Bulb** | Tungsten filament lamp with a thermal model: the cold filament has ≈1/15 of its hot resistance, so it draws a large inrush current and brightens over tens of milliseconds. R ∝ T^1.2, radiated power ∝ T⁴. <br>*Settings:* Rated voltage (V), Rated power (W), Filament time constant (s) |
| **Lamp** | Incandescent lamp modelled at its hot resistance R = V²/P; brightness follows dissipated power. <br>*Settings:* Rated voltage (V), Rated power (W) |
| **Fluorescent Tube Light** | Hot-cathode fluorescent tube. Wire: L → ballast → left filament; left & right filaments’ inner ends to the starter; right filament → N. The starter pre-heats the filaments, then opens; the ballast kick strikes the arc, which then runs at ≈100 V. <br>*Settings:* Arc (running) voltage (V), Strike voltage (cold) (V), Strike voltage (pre-heated) (V), Arc resistance (Ω), Filament resistance (each) (Ω), Rated power (W) |
| **Choke / Ballast** | Magnetic ballast (iron-cored choke) for a 40 W tube on 230 V 50 Hz: limits the arc current and produces the high-voltage kick when the starter opens. <br>*Settings:* Inductance (H), Winding resistance (Ω) |
| **Glow Starter** | Glow starter: a neon glow heats a bimetal strip until its contacts close (pre-heating the tube filaments); with the glow gone it cools and snaps open, giving the ballast kick. Stays idle once the tube runs at ~100 V. <br>*Settings:* Glow ignition voltage (V), Bimetal heating time (s), Contact opening time (s) |
| **LED Bulb (AC)** | LED lamp with a linear driver: the LED string only conducts when \|v\| exceeds its string voltage (so the current flows in pulses near the peaks and the power factor is below 1). Sized for rated power at rated voltage. <br>*Settings:* Rated voltage (RMS) (V), Rated power (W), LED string voltage (V) |
| **Neon Indicator Lamp** | Neon glow lamp: strikes at ≈90 V, then maintains ≈60 V. Use a series resistor (e.g. 100 kΩ on 230 V). Classic relaxation oscillator element. <br>*Settings:* Striking voltage (V), Maintaining voltage (V), Internal resistance (Ω) |
| **Ceiling Fan** | Ceiling fan as an equivalent series R–L load (from rated power and power factor). Speed follows the applied RMS voltage with the fan load curve and the blade inertia; stalls below ≈35 % voltage — try it with a regulator. <br>*Settings:* Rated voltage (RMS) (V), Rated power (W), Power factor, Rated speed (rpm), Rated frequency (Hz) |
| **Heater / Iron / Kettle** | Resistive heating element (R = V²/P) with a first-order thermal model: temperature rises towards ΔT ∝ P. <br>*Settings:* Rated voltage (V), Rated power (W), Thermal time constant (s) |
| **Socket Outlet + Appliance** | 3-pin socket (L, N, E) with a selectable appliance modelled as an R–L load of its rated power and power factor. "Faulty appliance" leaks 50 mA to earth — an RCD must trip. <br>*Settings:* Plugged-in appliance, Rated voltage (V), Frequency (Hz) |
| **Dimmer / Electronic Regulator** | TRIAC phase-angle controller in series with the load. Each half-cycle it waits for the firing angle α = (1 − level)·180° after the zero crossing, fires, and conducts until the current falls to zero. <br>*Settings:* Level (%), Mains frequency (Hz), TRIAC holding current (A) |
| **Fan Regulator (resistive)** | Old-style step regulator: a tapped wire-wound resistor in series with the fan (steps 1–4 drop voltage, step 5 is direct). Wastes power as heat — compare with the capacitive regulator. <br>*Settings:* Step (0 = off … 5 = full), Resistance scale (×) |
| **Fan Regulator (capacitive)** | Capacitor-type step regulator: series capacitors (1.5–4.7 µF) drop the fan voltage with almost no power loss (reactive drop), with a 470 kΩ bleeder. Step 5 connects the fan directly. <br>*Settings:* Step (0 = off … 5 = full) |
| **Electric Bell** | Electromagnetic bell: a coil (R–L) that rings when its RMS current exceeds the operating current. <br>*Settings:* Coil resistance (Ω), Coil inductance (H), Operating current (A) |
| **Earth Electrode** | Earth rod: connects its terminal to true earth (0 V) through the soil resistance. Fault current and touch voltage depend on it. <br>*Settings:* Earth resistance (Ω) |

### Power Systems (8)

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

### Machines (8)

DC motors and generators, single- and 3-phase induction motors and an alternator. They include electrical and mechanical behaviour: starting current, speed and torque. Read the live **rpm** and **current** in the properties sheet.

| | |
| --- | --- |
| **DC Motor** | Permanent-magnet DC motor: V = R·i + L·di/dt + K·ω and J·dω/dt = K·i − b·ω − T_load, solved simultaneously. <br>*Settings:* Armature resistance (Ω), Armature inductance (H), Motor constant K (V·s/rad), Rotor inertia J (kg·m²), Friction b (N·m·s), Load torque (N·m) |
| **DC Motor (separately excited)** | DC machine with separate armature (left: A+ A−) and field (right: F+ F−) terminals. Flux follows a saturating magnetisation curve of the field current; E = K·φ·ω, T = K·φ·Ia. Reversing the torque makes it a generator. <br>*Settings:* Load torque (N·m), EMF constant at rated field (V·s/rad), Armature resistance (Ω), Armature inductance (H), Field resistance (Ω), Field inductance (H), Rated field current (A), Inertia J (kg·m²), Friction b (N·m·s) |
| **DC Shunt Motor** | DC shunt motor: field winding in parallel with the armature across the two terminals. Nearly constant speed with load. <br>*Settings:* Load torque (N·m), EMF constant at rated field (V·s/rad), Armature resistance (Ω), Armature inductance (H), Field resistance (Ω), Field inductance (H), Rated field current (A), Inertia J (kg·m²), Friction b (N·m·s) |
| **DC Series Motor** | DC series motor: the field carries the armature current, so torque ∝ I² at low current — very high starting torque; never run it unloaded (speed runs away). <br>*Settings:* Load torque (N·m), EMF constant at rated field (V·s/rad), Armature resistance (Ω), Armature inductance (H), Field resistance (Ω), Field inductance (H), Rated field current (A), Inertia J (kg·m²), Friction b (N·m·s) |
| **DC Generator (PM)** | Permanent-magnet DC generator driven at a set speed: E = Ke·speed behind Ra + La. The load current produces a braking torque T = E·I/ω. <br>*Settings:* Prime-mover speed (rpm), EMF constant (V/krpm), Armature resistance (Ω), Armature inductance (H) |
| **3-Phase Induction Motor** | Squirrel-cage induction motor, dynamic model in the stationary αβ frame (3 stator phases in star + rotor αβ circuits, speed as a state). Shows starting current (≈6×), acceleration, slip and torque. Defaults ≈ 3.7 kW, 400 V, 50 Hz, 4-pole. <br>*Settings:* Load torque (N·m), Load type, Poles, Rated frequency (Hz), Stator resistance Rs (Ω), Rotor resistance Rr' (Ω), Stator leakage Lls (H), Rotor leakage Llr' (H), Magnetising Lm (H), Inertia J (kg·m²), Friction b (N·m·s) |
| **1-Phase Capacitor Motor** | Permanent-split-capacitor motor: main winding M–C and auxiliary winding A–C in quadrature. Connect the run capacitor (e.g. 2.5 µF) between M and A and the supply across M–C. Without the capacitor it cannot start. <br>*Settings:* Load torque (N·m), Load type, Poles, Rated frequency (Hz), Main winding resistance (Ω), Aux winding resistance (Ω), Aux/main turns ratio, Leakage (main) (H), Magnetising Lm (H), Rotor resistance (Ω), Rotor leakage (H), Inertia J (kg·m²), Friction b (N·m·s) |
| **3-Phase Alternator** | Round-rotor synchronous generator: per-phase EMF E = k·If behind Ra + jXs (star, neutral brought out). Excitation controls terminal voltage and reactive power; watch the voltage regulation with load. <br>*Settings:* Excitation (field current) (%), Open-circuit line voltage at 100 % (V), Frequency (Hz), Synchronous reactance Xs (Ω), Armature resistance Ra (Ω) |

### Diodes (8)

Diodes conduct only one way (anode → cathode). Zener diodes hold a fixed reverse voltage. Bridge and 3-phase rectifiers are ready-made blocks. Pick a **model** to get real-part numbers.

| | |
| --- | --- |
| **Diode** | Shockley diode I = Is(e^(V/nVt) − 1) with reverse breakdown. Current flows from anode (left) to cathode (bar). <br>*Settings:* Model, Saturation current Is (A), Emission coefficient n, Breakdown voltage (0 = none) (V) |
| **Zener Diode** | Zener diode: conducts in reverse above its Zener voltage — used as a voltage reference. <br>*Settings:* Zener voltage (V), Saturation current Is (A), Emission coefficient n |
| **Schottky Diode** | Schottky barrier diode with a low forward drop (~0.3 V). <br>*Settings:* Model, Saturation current Is (A), Emission coefficient n, Breakdown voltage (0 = none) (V) |
| **Varactor (Varicap)** | Reverse-biased tuning diode: Cj = Cj0 / (1 + Vr/φ)^m (charge-conserving model). Use it to tune an LC tank or VCO with a DC voltage. <br>*Settings:* Zero-bias capacitance Cj0 (F), Junction potential φ (V), Grading coefficient m, Breakdown voltage (V) |
| **Tunnel Diode** | Esaki tunnel diode: I = Ip·(V/Vp)·e^(1−V/Vp) + Iv·e^(k(V−Vv)) + diffusion current — a negative-resistance region between the peak and valley (for oscillators). <br>*Settings:* Peak current Ip (A), Peak voltage Vp (V), Valley current Iv (A), Valley voltage Vv (V) |
| **Current-Regulator Diode** | Constant-current diode (JFET with gate tied to source): passes ≈Ireg for any forward voltage above the knee; conducts like a diode in reverse. <br>*Settings:* Regulated current (A), Knee voltage (V), Dynamic resistance above knee (Ω) |
| **Bridge Rectifier (1-phase)** | Four-diode full-wave bridge (1N4007-class diodes): AC in on the two ~ pins, DC out on + and −. <br>*Settings:* Diode Is (A), Emission coefficient, Reverse voltage rating (V) |
| **Bridge Rectifier (3-phase)** | Six-pulse three-phase diode bridge: DC output ≈ 1.35 × line voltage (RMS). <br>*Settings:* Diode Is (A), Emission coefficient, Reverse voltage rating (V) |

### Transistors (12)

BJTs, MOSFETs, JFETs, IGBT and more. Terminals: BJT = collector, base, emitter; MOSFET = drain, gate, source. Pick a **model** (2N3904, 2N2222, BC547, 2N7000, IRF540N…) for real numbers.

| | |
| --- | --- |
| **NPN Transistor** | Bipolar junction transistor (Ebers–Moll transport model with Early effect and junction capacitances). Terminals: B (left), C (top), E (bottom). <br>*Settings:* Model, Forward β (hFE), Saturation current Is (A), Reverse β, Early voltage (0 = ∞) (V), B-E capacitance (F), B-C capacitance (F) |
| **PNP Transistor** | PNP bipolar transistor. Terminals: B (left), C (top), E (bottom) — for high-side use, flip it so the emitter is on top. <br>*Settings:* Model, Forward β (hFE), Saturation current Is (A), Reverse β, Early voltage (0 = ∞) (V), B-E capacitance (F), B-C capacitance (F) |
| **Darlington NPN (TIP120)** | Two transistors in Darlington connection with the internal 8 kΩ / 120 Ω base-emitter resistors of a TIP120: overall gain β₁·β₂ (≈1000+), VBE(on) ≈ 1.4 V. <br>*Settings:* β of each transistor, Is (A) |
| **Darlington PNP (TIP125)** | PNP Darlington pair (TIP125-type): overall gain β₁·β₂. Terminals B (left), C (top), E (bottom) — flip it for high-side use. <br>*Settings:* β of each transistor, Is (A) |
| **N-MOSFET** | Enhancement MOSFET, Shichman–Hodges (SPICE level 1) model with body diode. Terminals: G (left), D (top), S (bottom). <br>*Settings:* Model, Threshold \|Vth\| (V), Transconductance k (µCox·W/L) (A/V²), Channel-length modulation λ (1/V), Gate-source capacitance (F), Gate-drain capacitance (F), Body diode |
| **P-MOSFET** | P-channel enhancement MOSFET (level 1). Source usually connects to the positive supply — flip it so S is on top. <br>*Settings:* Model, Threshold \|Vth\| (V), Transconductance k (µCox·W/L) (A/V²), Channel-length modulation λ (1/V), Gate-source capacitance (F), Gate-drain capacitance (F), Body diode |
| **Depletion N-MOSFET** | Depletion-mode N-channel MOSFET: conducts at Vgs = 0 and is switched off by making the gate negative (Vgs < Vth < 0). <br>*Settings:* Threshold (negative) (V), Transconductance k (µCox·W/L) (A/V²), Channel-length modulation λ (1/V), Gate-source capacitance (F), Gate-drain capacitance (F), Body diode |
| **N-JFET** | Junction FET (square-law model with gate junction diodes). Terminals: G (left), D (top), S (bottom). <br>*Settings:* IDSS (A), Pinch-off \|Vp\| (V), λ (1/V) |
| **P-JFET** | P-channel junction FET (square-law model). <br>*Settings:* IDSS (A), Pinch-off \|Vp\| (V), λ (1/V) |
| **IGBT** | Insulated-gate bipolar transistor: voltage-driven gate like a MOSFET, bipolar conduction with a ≈0.7 V knee (Vce(sat) ≈ 1.5–2 V). Structure model: MOSFET driving a wide-base PNP. Terminals G (left), C (top), E (bottom). <br>*Settings:* Gate threshold (V), MOS transconductance (A/V²), PNP gain |
| **UJT (2N2646)** | Unijunction transistor: the emitter diode sees η·Vbb; when Ve exceeds η·Vbb + 0.6 V (peak point) the lower base floods with carriers and its resistance collapses, discharging the emitter until the current falls below the valley current. Classic relaxation oscillator f ≈ 1/(R·C·ln(1/(1−η))) and SCR trigger. Terminals E (left), B2 (top), B1 (bottom). <br>*Settings:* Intrinsic stand-off ratio η, Interbase resistance (Ω), Peak-point current Ip (A), Valley current Iv (A), Lower-base resistance when fired (Ω) |
| **Optocoupler (PC817)** | Infrared LED (A–K, ≈1.2 V) optically coupled to a phototransistor (C–E): Ic ≈ CTR × If until the transistor saturates. Input and output are galvanically isolated. <br>*Settings:* Current transfer ratio (%) |

### Thyristors & Power (9)

SCR, TRIAC, DIAC, GTO and friends for phase control and power switching, plus gate drivers and buck/boost converter modules.

| | |
| --- | --- |
| **SCR (Thyristor)** | Silicon-controlled rectifier: blocks until a gate pulse (≥ IGT) arrives while forward biased, then conducts like a diode until the anode current falls below IH. Terminals: A (left), K (right), G (bottom). <br>*Settings:* Gate trigger current IGT (A), Holding current IH (A), Break-over voltage (V) |
| **TRIAC** | Bidirectional thyristor for AC: triggered by gate current of either polarity (relative to MT1) and conducts both ways until the current crosses zero. Terminals: MT2 (left), MT1 (right), G (bottom). <br>*Settings:* Gate trigger current IGT (A), Holding current IH (A), Break-over voltage (V) |
| **DIAC** | DIAC (DB3): blocks until \|V\| exceeds the break-over voltage (≈32 V), then snaps back by ΔV and conducts — used to trigger TRIACs in dimmers. <br>*Settings:* Break-over voltage (V), Break-back ΔV (V), On resistance (Ω), Holding current (A) |
| **GTO Thyristor** | Gate turn-off thyristor: turned on like an SCR and turned off by a negative gate current of at least I_anode / turn-off gain. <br>*Settings:* Gate trigger current IGT (A), Holding current IH (A), Break-over voltage (V), Turn-off gain |
| **PUT (Programmable UJT)** | Programmable UJT (2N6027): fires when the anode rises ≈0.6 V above the gate voltage (set by a divider) and conducts until the anode current falls below the valley current. Terminals: A (left), K (right), G (bottom). <br>*Settings:* Valley current (A), Peak current (A) |
| **Opto-TRIAC (MOC3021/3041)** | Optically isolated TRIAC driver: LED current ≥ IFT turns on the photo-TRIAC output (used to fire a power TRIAC gate). The zero-cross version only turns on near a voltage zero. <br>*Settings:* LED trigger current IFT (A), Zero-crossing (MOC3041), Output holding current (A) |
| **Isolated Gate Driver** | Isolated (floating) gate driver: when V(IN) − V(GND) exceeds the threshold, OUT is driven to Von above COM (connect COM to the MOSFET/IGBT source or emitter — even on the high side of a bridge). <br>*Settings:* Output high (Vgs) (V), Output low (V), Input threshold (V), Output resistance (Ω) |
| **Buck Converter Module** | Averaged step-down DC-DC converter (LM2596-style module): Vout = min(Vset, Vin − headroom); input current from power balance Iin = Vout·Iout / (η·Vin) — so the input current is less than the output current. <br>*Settings:* Output voltage set (V), Efficiency, Output resistance (Ω), Minimum headroom (V) |
| **Boost Converter Module** | Averaged step-up DC-DC converter (MT3608-style): Vout = max(Vset, Vin − diode drop); input current from power balance, so it draws more current than it delivers. <br>*Settings:* Output voltage set (V), Efficiency, Output resistance (Ω), Diode drop (V) |

### Analog ICs (18)

Op-amps (with gain-bandwidth and slew rate), comparators, the 555 timer, fixed and adjustable regulators and other analog building blocks. Real op-amp models: LM741, LM358, TL071 and more.

| | |
| --- | --- |
| **Op-Amp** | Operational amplifier macromodel: finite open-loop gain, single-pole GBW, slew-rate limiting, output swing limited to the supply rails (implicit supply pins). <br>*Settings:* Model, Open-loop gain A₀ (V/V), Gain-bandwidth (0 = ∞) (Hz), Slew rate (0 = ∞) (V/s), Positive supply (V), Negative supply (V), Output headroom (V), Output resistance (Ω) |
| **Comparator** | Voltage comparator with hysteresis: output is high when V+ > V−. <br>*Settings:* Output high (V), Output low (V), Hysteresis (V), Output resistance (Ω) |
| **Instrumentation Amp (INA128)** | Three-op-amp instrumentation amplifier: Vout = G·(V+ − V−) + Vref with G = 1 + 50 kΩ/RG. Infinite input impedance, output limited to the rails. <br>*Settings:* Gain resistor RG (Ω), Positive supply (V), Negative supply (V) |
| **OTA (LM13700)** | Operational transconductance amplifier: current output Iout = IABC·tanh((V+ − V−)/2Vt), i.e. gm = IABC/(2Vt) for small signals — a voltage-controlled gain element. <br>*Settings:* Bias current IABC (A) |
| **Audio Amp (LM386)** | Low-voltage audio power amplifier: output biased at Vs/2, gain 20–200, clips ≈0.5 V from the rails, ≈0.5 Ω output. Couple the speaker through a capacitor (e.g. 220 µF). <br>*Settings:* Voltage gain, Supply voltage (V) |
| **Analog Multiplier (AD633)** | Four-quadrant multiplier: W = (X1 − X2)·(Y1 − Y2)/10 V + Z. <br>*Settings:* Positive supply (V), Negative supply (V) |
| **555 Timer** | NE555 timer: internal 5k/5k/5k divider, two comparators, SR flip-flop, output stage and discharge transistor. <br>*Settings:* Output resistance (Ω), Output high drop (V) |
| **78xx Regulator** | Fixed linear regulator (7805 family): Vout = min(Vset, Vin − Vdropout) with current limiting. <br>*Settings:* Output voltage (V), Dropout voltage (V), Current limit (A) |
| **79xx Negative Regulator** | Negative fixed regulator (7905 family): OUT = −Vset relative to GND when IN is at least Vset + dropout below ground. <br>*Settings:* Output voltage magnitude (V), Dropout voltage (V), Current limit (A) |
| **LM317 Adjustable** | Adjustable regulator: keeps 1.25 V between OUT and ADJ. Vout = 1.25·(1 + R2/R1). <br>*Settings:* Dropout voltage (V), Current limit (A) |
| **LDO Regulator** | Low-dropout linear regulator: holds Vout down to about 0.25 V of headroom (vs 2 V for a 78xx) — ideal for battery-powered 3.3 V circuits. <br>*Settings:* Output voltage (V), Dropout voltage (V), Current limit (A) |
| **Shunt Regulator (TL431)** | Programmable shunt regulator: sinks cathode current until REF − A = 2.495 V (like an adjustable precision zener). Vka = 2.495·(1 + R1/R2) with a divider from K to REF. Terminals: REF (left), K (top), A (bottom). <br>*Settings:* Reference voltage (V) |
| **Precision Reference (LM4040)** | Two-terminal precision shunt reference (2.048/2.5/4.096/5 V): behaves like a very sharp Zener. Bias it with ≥ 60 µA through a resistor. <br>*Settings:* Reference voltage (V) |
| **Charge-Pump Inverter (ICL7660)** | Switched-capacitor voltage inverter (averaged): OUT ≈ −V+ with ≈55 Ω output resistance. <br>*Settings:* Efficiency, Output resistance (Ω) |
| **Analog Switch (CD4066)** | Bilateral CMOS switch: A–B conduct (≈125 Ω) while CTRL is above VDD/2 (with hysteresis); otherwise open. <br>*Settings:* On resistance (Ω), Logic supply (V) |
| **Sample & Hold (LF398)** | Tracks the input while CTRL is high and holds the last value when CTRL goes low. <br>*Settings:* Control threshold (V) |
| **VCO (Voltage-Controlled Osc.)** | Voltage-controlled oscillator: f = f0 + Kv·Vin (never negative). Square, sine or triangle output. <br>*Settings:* Centre frequency (Vin = 0) (Hz), Sensitivity (Hz/V), Output high (V), Output |
| **True-RMS Converter (AD736)** | True-RMS to DC converter: OUT = √(mean(IN²)) with an averaging time constant. <br>*Settings:* Averaging time (s) |

### Control & Math (22)

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

### Logic Gates (20)

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

### Digital ICs (27)

Adders, comparators, multiplexers, decoders, latches, flip-flops, counters, shift registers, monostable, ADC and DAC. Drive them with a **Clock** and **Logic inputs**, and watch with **Logic output** or a 7-segment display.

| | |
| --- | --- |
| **Half Adder** | S = A ⊕ B, C = A·B. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Full Adder** | S = A ⊕ B ⊕ Cin, Cout = majority(A, B, Cin). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Adder (74HC283)** | Adds two 4-bit numbers with carry-in: S = A + B + Cin (carry out on Cout). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Comparator (74HC85)** | Compares two 4-bit numbers A and B. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **2:1 Multiplexer** | Y = S ? I1 : I0. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4:1 Multiplexer** | Y = I[S1S0]. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **2-to-4 Decoder (74HC139)** | Active-high outputs: Y[A1A0] = 1 while EN is high. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **3-to-8 Decoder (74HC138)** | Active-high one-of-eight decoder with enable. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Priority Encoder 4-to-2** | Outputs the binary index of the highest active input; V = any input active. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Parity Generator (4-bit)** | EVEN = parity bit that makes the total count of 1s even; ODD is its complement. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **BCD→7-Seg Decoder** | Hex/BCD to 7-segment decoder (active-high outputs a–g, like the CD4511 for 0–9, extended to A–F). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **D Latch** | Transparent latch: Q follows D while EN is high and holds when EN goes low. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **SR Latch** | Level-sensitive SR latch (NOR type): S sets, R resets, S=R=1 is invalid (both outputs low). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **D Flip-Flop** | Positive-edge-triggered D flip-flop: Q takes the value of D on each rising clock edge. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **JK Flip-Flop** | JK flip-flop (rising edge): J=K=1 toggles, J=1 sets, K=1 resets. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **T Flip-Flop** | Toggle flip-flop: Q inverts on each rising clock edge while T is high (frequency divider). <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Counter** | 4-bit binary up-counter: increments on rising clock edges, synchronous-free reset when RST is high. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Up/Down Counter** | Counts up (UP = 1) or down (UP = 0) on rising clock edges; RST clears to 0. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **BCD Counter (74HC390)** | Counts 0–9 in BCD; CO is high at 9 to cascade the next digit. Drive a 7-segment decoder with Q0–Q3. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Decade Counter (CD4017)** | Ten decoded outputs: exactly one output is high and it advances on every rising clock edge — the classic LED chaser. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **8-bit Counter** | 8-bit binary up-counter (0–255) with reset. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Shift Register (SIPO)** | On each rising clock edge the bits shift Q0→Q3 and DATA enters Q0. RST clears. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit Register (74HC175)** | Stores D0–D3 on each rising clock edge. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **Monostable (74HC121)** | One-shot: a rising edge on TRIG produces a single output pulse of width tw (not retriggerable). <br>*Settings:* Pulse width (s), Logic high level (V), Output resistance (Ω) |
| **Clock Divider ÷N** | Divides the clock frequency by N (50 % duty for even N). <br>*Settings:* Divide by N, Logic high level (V), Output resistance (Ω) |
| **4-bit ADC** | 4-bit flash ADC: code = floor(16·Vin/Vref), clamped to 0–15. <br>*Settings:* Logic high level (V), Output resistance (Ω) |
| **4-bit DAC** | 4-bit DAC: Vout = Vref · code / 16. <br>*Settings:* Reference voltage (V), Logic high level (V), Output resistance (Ω) |

### Sensors (41)

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

### Output (13)

LEDs (single, RGB, bicolour, infrared, laser), a bar graph, 7-segment and hex displays, buzzers, speaker, solenoid and servo. They light, sound or move to show what the circuit is doing.

| | |
| --- | --- |
| **LED** | Light-emitting diode. Forward voltage depends on colour; brightness is proportional to current. <br>*Settings:* Colour, Rated current (A) |
| **RGB LED (common cathode)** | Three LEDs (red ≈2 V, green ≈2.2 V, blue ≈3 V) in one package with a common cathode — the glow mixes the three currents. <br>*Settings:* Rated current (each) (A) |
| **Bi-colour LED (2-lead)** | Red and green LEDs in anti-parallel: red lights for current left→right, green for right→left (yellow-ish on AC). A polarity indicator. <br>*Settings:* Rated current (A) |
| **Infrared LED (940 nm)** | Infrared emitter (≈1.3 V forward): invisible to the eye — the glow here is shown in dark red. Used in remotes and optical sensors. <br>*Settings:* Colour, Rated current (A) |
| **Laser Diode** | Laser diode: below the threshold current it only glows faintly (LED-like); above it, stimulated emission produces a sharp beam whose power rises steeply with current. <br>*Settings:* Rated current (A), Threshold current (A) |
| **7-Segment Display** | Logic-level 7-segment display: a segment lights when its input is above half the logic level. <br>*Settings:* Colour, Threshold ×2 (V) |
| **Hex Display (4-bit)** | Displays the 4-bit input as a hexadecimal digit 0–F (like the TIL311). <br>*Settings:* Logic high level (V) |
| **LED Bar Graph (LM3914)** | Ten-LED level meter driver: segment k lights when Vin ≥ k/10 of full scale (linear) or at 3 dB steps (log, VU-meter style). High-impedance input. <br>*Settings:* Full-scale voltage (V), Mode, Scale |
| **Buzzer** | Active buzzer: sounds (if device sound is enabled) when current exceeds the sounding current. <br>*Settings:* Resistance (Ω), Sounding current (A), Tone (Hz) |
| **Piezo Buzzer (passive)** | Passive piezo transducer: electrically a capacitor. It sounds at the frequency you drive it with (unlike the active buzzer, it needs an AC / PWM signal). <br>*Settings:* Capacitance (F) |
| **Loudspeaker (8 Ω)** | Moving-coil speaker (Re + Le voice coil). Plays the detected fundamental frequency through the device speaker when sound is enabled; the cone moves with the current. <br>*Settings:* Voice-coil resistance (Ω), Voice-coil inductance (H), Power rating (W) |
| **Solenoid Actuator** | Pull-type solenoid: an R–L coil whose plunger pulls in when the current exceeds the pull-in value (drop-out at 50 %). Remember the flyback diode! <br>*Settings:* Coil resistance (Ω), Coil inductance (H), Pull-in current (A) |
| **RC Servo Motor** | Hobby servo: measures the width of each high pulse on SIG (1–2 ms, typically every 20 ms) and turns its arm to 0–180° at a limited speed. Input impedance ≈10 kΩ. <br>*Settings:* Pulse for 0° (s), Pulse for 180° (s), Slew rate (°/s) |

### Vacuum Tubes (3)

Classic valves: vacuum diode, triode and pentode, for vintage audio and radio circuits.

| | |
| --- | --- |
| **Vacuum Diode** | Thermionic diode (heater implied): space-charge-limited current I = k·V^1.5 (Child–Langmuir law); no reverse current. <br>*Settings:* Perveance (A/V^1.5) |
| **Vacuum Triode** | Vacuum triode with Norman Koren’s SPICE model (heater implied) plus grid-current conduction when the grid goes positive. Terminals: grid (left), plate/anode (top), cathode (bottom). <br>*Settings:* Type, Amplification factor µ, Exponent, Kg1, Kp, Kvb |
| **Vacuum Pentode (EL84)** | Power pentode (Koren model, EL84 defaults) with its screen grid G2 as a terminal: plate current is set by Vg1k and Vg2k and almost independent of plate voltage. Terminals: G1 (left), plate (top), cathode (bottom), G2 (right). <br>*Settings:* µ (screen), Exponent, Kg1, Kg2, Kp, Kvb |

### Meters (20)

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
| **LCR Meter** | Drives a small sinusoidal test current through the component and synchronously detects the voltage: Z = R + jX, shown as C (X < 0) or L (X > 0). Connect it across an isolated component. <br>*Settings:* Test frequency (Hz), Test current (peak) (A) |
| **Insulation Tester (Megger)** | Applies a high DC test voltage (500 V / 1 kV) through its internal resistance and displays the insulation resistance R = V / I (up to GΩ). Use on de-energised circuits only. <br>*Settings:* Test voltage (V), Internal resistance (Ω) |
| **Analog Voltmeter (moving coil)** | PMMC voltmeter with a needle: finite input resistance (Ω/V × full scale) loads the circuit — a classic source of measurement error. Reads the average voltage. <br>*Settings:* Full scale (V), Sensitivity (Ω/V) |
| **Analog Ammeter (moving coil)** | PMMC ammeter with shunt: resistance = burden / full-scale current (75 mV shunt), needle shows the average current. <br>*Settings:* Full scale (A), Burden voltage at FS (V) |
| **Galvanometer (centre-zero)** | Centre-zero galvanometer: deflects either way — the null detector of a Wheatstone bridge or potentiometer. <br>*Settings:* Full scale (±) (A), Coil resistance (Ω) |
| **Test Point (voltage tag)** | Single-terminal tag that displays the node voltage (relative to ground) next to its name. Draws no current. <br>*Settings:* Tag |
| **Text Label** | Free text annotation for documenting your circuit. <br>*Settings:* Text, Size (px) |

<a id="en-ch-examples"></a>

## 16. Examples (all 29)

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

<a id="en-ch-formulas"></a>

## 17. Quick reference: formulas and units

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

<a id="en-ch-troubleshooting"></a>

## 18. Troubleshooting and FAQ

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
- Start the drag exactly on the small circle. If you start in the middle of a part you move the part instead.
- End the drag on the other terminal or on a wire.

#### I changed something by mistake

Tap **Undo** (up to 120 steps). If you changed an example, open it again from Examples: the original is untouched.

#### My circuits disappeared

Circuits live inside the app on your phone. Clearing the app's data or uninstalling the app removes them. Restore from a backup file if you made one (**Open file / Restore backup**). Make backups regularly.

#### Can I use it without internet?

Yes. Only the buttons that open the RAPTI website, WhatsApp, email or map need internet.

#### Is the result exactly like a real circuit?

The engine follows SPICE methods and has been checked against textbook answers (RC and RL time constants, resonance, diode, BJT and MOSFET equations, op-amp gain, transformer ratio, logic truth tables, 555 frequency and more). Blocks such as logic gates, the 555, regulators, sensors and protection devices are **idealised models**. Always confirm important designs with datasheets and real measurements, and use **SPICE netlist** to cross-check in ngspice or LTspice.

<a id="en-ch-about"></a>

## 19. About RAPTI and contact

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
