# RaptiCKT — Resonance Automation Circuit Simulator

<p align="center"><img src="marketing/feature-graphic-1024x500.png" width="720" alt="RaptiCKT"></p>

RaptiCKT is a real-time analog / digital / mixed-signal circuit simulator for Android. It is built for electrical & electronic engineering students and researchers, and made by **RAPTI — Resonance Automation Professional Training Institute** ([rapti.net](https://rapti.net)).

It combines the best of EveryCircuit and VoltSim: an unlimited schematic canvas, live voltage/current animation, a rotary value knob, oscilloscope and multimeter. On top of that it adds research features: Bode plots, DC sweeps, operating-point tables, SPICE netlist export and a verified SPICE-class engine.

## Download the APK

Every push is built by GitHub Actions (`.github/workflows/android.yml`), which publishes a signed APK as a **GitHub Release**:

1. Open the repository's **Releases** page and pick the newest `RaptiCKT v1.0.0 (build N)`.
2. Download `RaptiCKT-v1.0.0-buildN.apk` (or `RaptiCKT-latest.apk`) on your phone.
3. Open it, and allow "Install unknown apps" for your browser or file manager if Android asks. Requires Android 8.0 or newer.

## Features

- **504 components** in 22 categories, each with a physical simulation model:
  - Sources (34): DC/AC/pulse/triangle/saw/noise/chirp, AM/FM, PWM, step, ramp, exponential, damped sine, PWL, f(t) expression, single-phase mains presets, 3-phase star/delta supply, bench PSU (CV/CC), dual PSU, PV module, rails, net labels, controlled sources, earth/chassis
  - Batteries (16): AA, 9 V, coin cell, NiMH, NiCd, Li-ion, 2S Li-Po, LiFePO₄ cell and 12.8 V battery, lead-acid, AGM, gel, configurable S/P pack, supercapacitor, BMS protection board, CC-CV charger — all with state-of-charge models that collapse when exhausted
  - Renewables (7): PV array, MPPT and PWM solar charge controllers, off-grid and grid-tie (anti-islanding) inverters, wind turbine, PEM fuel cell
  - Passive (25): R, shunt, fusible resistor, pots, rheostat, C (electrolytic, non-polar, tantalum, MLCC, film, PET, PP, silver-mica, variable, ESR/ESL model), L (variable, saturating iron core), ferrite bead, crystal, ceramic resonator, transmission line, memristor
  - Transformers (11): single-phase, centre-tapped, dual secondary, isolation, step-down/up, autotransformer (variac), 3-phase Dyn11/Yyn0/Yd1/Dd0, CT, PT, coupled inductors
  - Protection (21): fuse, HRC fuse, thermal fuse, PTC polyfuse, MCB 1P/2P/3P (B/C/D curves), MCCB, ACB (LSI), RCCB, RCBO, overload relays (1- and 3-pole), phase-failure/sequence and over/under-voltage relays, IDMT relay, MOV, arrester, GDT, TVS
  - Switches & Relays (40): house-wiring switches, toggle/slide/rocker/key/DIP/foot switches, push buttons, emergency stop, limit, reed, float, pressure, thermostat, isolator, changeover, voltage/current-controlled switches, relays (SPST/DPST/DPDT, reed, latching, control relay 2NO+2NC), contactors with auxiliary contacts, timer relay, SSR
  - Electrical (23): incandescent, halogen, CFL, LED bulb, LED strip/panel/driver, tube light with choke and starter, neon, fan, heater, socket + appliance, dimmer, fan regulators, bell, earth electrode, photocell and PIR light switches, emergency light
  - Power Systems (13): rated R/L/C and 3-phase loads, PF-correction capacitor, short and π lines, 2- and 4-core cables (resistance from length, size, copper/aluminium), busbar, junction box, timed fault
  - Machines (16): DC motors (PM, separately excited, shunt, series, compound, universal), DC generator, 3-phase induction motor (3- and 6-terminal for star-delta), capacitor motor, synchronous motor, PMSM, BLDC with Hall sensors, stepper, alternators
  - Diodes, Transistors (30): tunnel, CRD, varactor, bridge and 3-phase rectifiers, BJTs, MOSFETs, JFETs, Darlington, IGBT, depletion MOSFET, UJT, optocoupler and more
  - Thyristors & Power (30): SCR, TRIAC, DIAC, SIDAC, SCS, LASCR, GTO, IGCT, PUT, opto-TRIAC/SCR, gate driver, IGBT half-bridge and IPM, H-bridge and 3-phase inverter bridges, SPWM (V/f) modulator, BLDC and stepper drivers, SCR firing unit, buck/boost/buck-boost/Ćuk/SEPIC/flyback/forward/push-pull/half- and full-bridge converters
  - Analog ICs (27): op-amps, buffer, differential/transimpedance/instrumentation amps, TDA2030, comparators (incl. open collector), OTA, LM386, AD633, 555/556, PLL, 78xx/79xx, LM317/337, LDO, TL431, LM4040, ICL7660, CD4066, sample & hold, VCO, true-RMS converter
  - Control & Math (22): gain, sum, multiply, divide, limiter, abs, sqrt, power, log, exp, trig, f(u,v), integrator, differentiator, transfer functions, PID, delay, ZOH, rate limiter, relay
  - Logic Gates and Digital ICs (66): gates, tri-state, adders, comparator, mux, decoders, encoder, parity, latches, flip-flops, shift registers (incl. 74HC595), counters, register, clock divider, monostable, ADC, DAC and more
  - Communication (18): UART TX/terminal, RS-232, RS-485, CAN, SPI and I²C masters, PCF8574 expander, wireless link with link budget (433 MHz, nRF24L01, BLE, Wi-Fi, LoRa, Zigbee), RFID reader, fibre link, antenna, RF amp, mixer, envelope detector, active and SAW filters, EMI filter — behavioural blocks, no firmware or user code is executed
  - Sensors (58): light, temperature, strain/load/force, Hall, current, voltage, accelerometer, gyro, IMU, magnetometer, PIR, IR, ultrasonic (incl. HC-SR04), gas, CO₂, smoke, humidity, soil, rain, water level, pressure, flame, UV, wind, flow, encoders, inductive/capacitive proximity, photo-eye, 4–20 mA transmitters and more
  - Output (23): LEDs (RGB, bicolour, IR, laser), 7- and 14-segment, dot matrix, hex display, bar graph, buzzers, speaker, headphone, preamp, tone control, equaliser, solenoid, servo, Peltier, DC fan, electromagnet
  - Vacuum Tubes (3) and Meters (21): voltmeter, ammeter, ohmmeter, wattmeter, true-RMS meters, frequency, phase, power-factor, VAR, kWh, dB, peak, LCR, megger, panel meter, moving-coil meters, test point
- **AC readings like a real meter**: in circuits with a sinusoidal supply (mains, AC sources, 3-phase), live labels show the RMS over one supply cycle (e.g. `12 V~` on a 230 V : 12-0-12 V transformer) and DC nets show their average. Voltmeters and ammeters default to *Auto* (RMS in AC circuits). Switch to instantaneous values in Settings → AC readings.
- **Live readings on the schematic**: while the simulation runs, every net shows its voltage (blue) and every two-terminal part shows its current with a direction arrow (green), placed so they never overlap one another, a part or a text label (when a crowded net has no free spot, its reading is left out; a probe still reads it). Both can be switched off in Settings.
- **Oscilloscope**: 6 channels on a real 10 × 8 graticule with one shared 1-2-5 V/div scale and 0 V line for all voltage channels (currents on their own A/div with 0 A on the same line), 1-2-5 time/div, CH1 edge trigger (a steady picture), ground markers, a touch cursor read-out, frequency/RMS/p-p, FFT spectrum, XY mode, AC/DC input coupling, timing measurements (mean, duty cycle, rise/fall time, phase) and CSV export.
- **Multimeter**: draggable probes for V (DC + true RMS), A, Ω (small-signal, with continuity), W, Hz and LC (capacitance / inductance at 1 kHz).
- **Analyses**:
  - AC sweep (Bode) with automatic −3 dB, f₀, bandwidth, Q and phase margin
  - DC sweep
  - Operating point
  - Harmonics (Fourier series, THD, crest factor)
  - Impedance vs frequency
  - Parametric sweep (families of transient curves)
  - Monte Carlo tolerance analysis
  - Power / efficiency table
  - SPICE netlist
- **Fault simulation**: break a terminal, short two terminals or add leakage to any part from its properties sheet, or place a timed fault to watch protection trip.
- **Landscape & full screen** (like RaptiAuto): sideways the bars merge into one row, the oscilloscope sits beside the circuit and sheets open as a side panel; **Full** hides every bar (and Android's status and navigation bars) so the board runs edge to edge; the tool rail and + button hide behind a small ☰ handle until you need them. Screen rotation can be locked in Settings.
- **Interaction**:
  - Drag from a terminal to wire, and wires follow moved parts
  - Tap switches and buttons live
  - Rotary knob for any value
  - Pinch to zoom, or one finger like Google Maps: double-tap, hold and slide down (in) or up (out)
  - Undo/redo and multi-select
- **7 big build-along projects** (first chip in Examples → *Projects*), each explained stage by stage:
  - **Complete house wiring (2-room flat)**: energy meter → DP main switch → 30 mA RCCB → one MCB per circuit (lights with one-way and staircase 2-way switches, calling bell, fan with regulator, 2 kW geyser, earthed sockets). Set a socket to *Faulty appliance* to trip the RCCB or *Short circuit* to trip its MCB.
  - **16-bit RAM (4 words × 4 bits)**: 16 D-latch memory cells, an address decoder driving the word lines, bit lines from a hex keypad and a read multiplexer per column — write a digit at each address and read it back.
  - **Mains to 5 V regulated power supply**: fuse → transformer → bridge → smoothing capacitor → 7805, with the ripple and the flat 5 V side by side on the scope.
  - **Traffic light controller** (CD4017 + diode-OR logic), **4-bit binary adder** (two hex keypads, sum + carry), **digital seconds counter 00–59** (cascaded BCD counters, mod-60 reset, 7-segment displays) and an **automatic street light** (LDR → transistor → 12 V relay → 230 V lamp).
- **66 explained examples** in all: also tube light, staircase wiring, house wiring, dimmer, power-factor correction, a DOL motor starter and a 1-bit NOR-latch memory cell, plus
  - **Industrial control**: automatic star-delta starter, forward/reverse with interlocks, automatic water pump, conveyor bottle counter, phase-failure protection, 4–20 mA loop, fire-alarm zone
  - **Power electronics**: VFD for an induction motor, H-bridge DC motor control, SPWM sine inverter, flyback converter, SCR bridge with firing unit, BLDC and stepper drives
  - **Renewables**: solar home system with MPPT, Li-ion charger with BMS, grid-tie and off-grid inverters, wind charger
  - **Communication**: RS-232 null-modem, RS-485 bus, AM receiver chain, 433 MHz remote, I²C expander, SPI shift register, RFID lock, fibre link
  - Wien-bridge oscillator and a short-circuit / MCB tripping demo
- Save/export/import `.rckt` files, PNG export, 3 themes, and an About section with RAPTI information.

## User manual

A complete, step-by-step manual is built into the app: open it from the **Manual** tab on Home or from **⋮ → User manual** inside the editor. It has a searchable contents page, a full tour of every screen and tool, the live list of all 504 components and 66 examples (with an "Open this example" button), formulas, troubleshooting and an FAQ.

The same text is available as Markdown: [docs/MANUAL.md](docs/MANUAL.md). It is generated from `web/src/ui/manual-content.js` with `cd web && npm run manual`; re-run it after editing the manual. `web/tests/manual-content.test.js` fails if a component, example, setting or menu item is added to the app without being covered by the manual.

## Simulation engine (web/src/engine)

- Modified Nodal Analysis with dense LU and partial pivoting, plus iterative refinement for badly scaled matrices.
- Newton–Raphson with SPICE `pnjlim` junction limiting. Timesteps are halved automatically when a step does not converge.
- Trapezoidal integration by default, switching to backward Euler right after discontinuities — switching events, every tap or value change you make while it runs, and any capacitor/inductor that starts zig-zagging from step to step — so a switched-off inductive load never rings at kilovolts. Capacitors use companion models; inductors and transformers use branch-current formulations.
- DC operating point with gmin stepping and source stepping, and automatic referencing of galvanically isolated islands. Logic feedback loops (latches made of gates) are settled one gate at a time, so they power up in a stable state.
- Small-signal AC analysis: devices are linearised at the operating point and solved with complex MNA.
- SPICE-default tolerances: RELTOL 1e-3, VNTOL 1 µV, ABSTOL 1 nA, GMIN 1e-12. All are adjustable in Settings.

`web/tests` checks the engine against analytic results:
- RC/RL time constants and LC resonance
- Shockley diode, BJT β, MOSFET square law
- Op-amp gain, GBW and saturation
- RC −3 dB/−45°, transformer ratio, logic truth tables
- 555 frequency, 7805/LM317, motor steady state, solar Voc, relay, counter

It also builds every example and checks that it is fully wired, solvable and gives the expected values; `tests/projects.test.js` runs the big projects like the real circuits (RCCB/MCB trips, RAM write/read-back, 59 → 00 roll-over, traffic-light timing, 5 V regulation, day/night switching).

## Project layout

```
web/        Simulator app (vanilla JS + Canvas, bundled with esbuild)
  src/engine    MNA solver, AC/DC analyses
  src/elements  component models + symbols
  src/ui        editor, scope, inspector, palette, analyses, screens
  tests         node:test suites + Playwright screenshot/interaction scripts
  tools         marketing asset generator, manual → Markdown exporter
docs/       User manual (English + Bangla Markdown)
android/    Native Android shell (WebView + Java bridge: files, share, haptics)
marketing/  Play Store icon, feature graphic, screenshots, bilingual listing
```

## Building locally

```bash
cd web && npm ci && npm test && npm run build   # bundles into android/app/src/main/assets/www
cd ../android && ./gradlew assembleRelease      # needs the Android SDK (compileSdk 35)
```

For browser development, run `cd web && npm run dev`, then serve `web/dist/`.

## Signing

The release APK is signed with `android/keystore/raptickt-release.jks`. Its passwords are in `android/keystore/keystore.properties`. **Keep this repository private** while the key lives here.

Before publishing on Google Play, move the key into repository secrets and delete it from the repo. The workflow uses these secrets automatically:
- `RAPTI_KEYSTORE_BASE64` (base64 of the .jks)
- `RAPTI_KEYSTORE_PASSWORD`
- `RAPTI_KEY_ALIAS`
- `RAPTI_KEY_PASSWORD`

Always keep a backup of the key: app updates must be signed with the same key.

---
© RAPTI — Resonance Automation Professional Training Institute · 88/A Kamal Shikdar Tower, Signboard, Matuail, Demra, Dhaka-1362 · rapti.net
