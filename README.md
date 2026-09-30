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

- **335 components** in 20 categories:
  - Sources (32): DC/AC/pulse/triangle/saw/noise/chirp, AM/FM, PWM, step, exponential, damped sine, PWL, f(t) expression, single-phase mains presets, 3-phase star/delta supply, bench PSU (CV/CC), dual PSU, PV module, rails, clock, controlled sources, earth/chassis
  - Batteries (8): AA, 9 V, coin cell, NiMH, Li-ion, 2S Li-Po, 12 V lead-acid, each with a state-of-charge model
  - Passive (17): R, pot, rheostat, trimmer, C, electrolytic, non-polar, tantalum, supercapacitor, variable C, real capacitor (ESR/ESL), L, variable and iron-core inductor, ferrite bead, crystal, transmission line, memristor
  - Transformers (11): single-phase, centre-tapped, dual secondary, isolation, step-down/up, autotransformer (variac), 3-phase Dyn11/Yyn0/Yd1/Dd0, CT, PT, coupled inductors
  - Protection (16): fuse, HRC fuse, PTC polyfuse, MCB 1P/2P/3P (B/C/D curves), MCCB, RCCB, RCBO, MOV, lightning arrester, GDT, TVS, overload relay, IDMT relay
  - Switches & Relays (27): one-way, two-way, three-way, intermediate, DPST, DPDT, rotary, selector, push buttons, latching button, emergency stop, limit, reed, float, pressure, thermostat, isolator, changeover, relays, reed relay, contactor, timer relay, SSR
  - Electrical (15): incandescent bulb, lamp, fluorescent tube, choke, starter, LED bulb, neon lamp, ceiling fan, heater, socket + appliance, dimmer, resistive and capacitive fan regulators, bell, earth electrode
  - Power Systems (8): R-L and R-C rated loads, PF-correction capacitor, 3-phase star/delta loads, short line, π line
  - Machines (8): DC motor, separately excited/shunt/series DC machines, DC generator, 3-phase and single-phase induction motors, alternator
  - Diodes, Transistors, Thyristors & Power: tunnel, CRD, varactor, bridge and 3-phase rectifiers, Darlington, IGBT, depletion MOSFET, UJT, optocoupler, SCR, TRIAC, GTO, PUT, DIAC, opto-TRIAC, gate driver, buck/boost modules, charge pump
  - Analog ICs (18): op-amp, comparator, 555, 78xx/79xx, LM317, LDO, instrumentation amp, LM386, AD633 multiplier, sample & hold, VCO, RMS-to-DC, OTA, analog switch, TL431, LM4040
  - Control & Math (22): gain, sum, multiply, divide, limiter, abs, sqrt, power, log, exp, trig, f(u,v), integrator, differentiator, 1st/2nd-order transfer functions, PID, delay, ZOH, rate limiter, relay
  - Logic Gates and Digital ICs (47): 2/3/4-input gates, tri-state, adders, comparator, mux, decoders, encoder, parity, latches, flip-flops, shift register, up/down, decade, BCD and 8-bit counters, register, clock divider, monostable, ADC, DAC
  - Sensors (41): light, temperature (NTC, PTC, Pt100/1000, thermocouple, LM35, LM335), Hall, current (ACS712), voltage, gas, humidity, soil moisture, rain, pressure, accelerometer, IR distance, ultrasonic, flame, UV, wind, flow, encoder, pH, piezo, tacho-generator, load cell, LVDT and more
  - Output (13): RGB/bicolour/IR LEDs, laser, bar graph, 7-segment and hex displays, speaker, buzzers, solenoid, servo
  - Vacuum Tubes (3): vacuum diode, triode, pentode
  - Meters (20): voltmeter, ammeter, ohmmeter, wattmeter, true-RMS AC meters, frequency, phase, power-factor, VAR, kWh, dB, peak, LCR, megger, moving-coil voltmeter/ammeter, galvanometer, test point
- **AC readings like a real meter**: in circuits with a sinusoidal supply (mains, AC sources, 3-phase), live labels show the RMS over one supply cycle (e.g. `12 V~` on a 230 V : 12-0-12 V transformer) and DC nets show their average. Voltmeters and ammeters default to *Auto* (RMS in AC circuits). Switch to instantaneous values in Settings → AC readings.
- **Live readings on the schematic**: while the simulation runs, every net shows its voltage (blue) and every two-terminal part shows its current with a direction arrow (green), placed so they never overlap. Both can be switched off in Settings.
- **Oscilloscope**: 6 channels with auto-scale, frequency/RMS/p-p, FFT spectrum, XY mode and CSV export.
- **Multimeter**: draggable probes for V (DC + true RMS), A, Ω (small-signal) and W.
- **Analyses**:
  - AC sweep (Bode) with automatic −3 dB, f₀, bandwidth, Q and phase margin
  - DC sweep
  - Operating point
  - SPICE netlist
- **Interaction**:
  - Drag from a terminal to wire, and wires follow moved parts
  - Tap switches and buttons live
  - Rotary knob for any value
  - Undo/redo and multi-select
- 29 explained examples (including tube light, staircase wiring, house wiring, dimmer, power-factor correction and a DOL motor starter), save/export/import `.rckt` files, PNG export, 3 themes, and an About section with RAPTI information.

## Simulation engine (web/src/engine)

- Modified Nodal Analysis with dense LU and partial pivoting, plus iterative refinement for badly scaled matrices.
- Newton–Raphson with SPICE `pnjlim` junction limiting. Timesteps are halved automatically when a step does not converge.
- Trapezoidal integration by default, switching to backward Euler right after discontinuities. Capacitors use companion models; inductors and transformers use branch-current formulations.
- DC operating point with gmin stepping and source stepping, and automatic referencing of galvanically isolated islands.
- Small-signal AC analysis: devices are linearised at the operating point and solved with complex MNA.
- SPICE-default tolerances: RELTOL 1e-3, VNTOL 1 µV, ABSTOL 1 nA, GMIN 1e-12. All are adjustable in Settings.

`web/tests` checks the engine against analytic results:
- RC/RL time constants and LC resonance
- Shockley diode, BJT β, MOSFET square law
- Op-amp gain, GBW and saturation
- RC −3 dB/−45°, transformer ratio, logic truth tables
- 555 frequency, 7805/LM317, motor steady state, solar Voc, relay, counter

It also builds every example and checks that it is fully wired, solvable and gives the expected values.

## Project layout

```
web/        Simulator app (vanilla JS + Canvas, bundled with esbuild)
  src/engine    MNA solver, AC/DC analyses
  src/elements  component models + symbols
  src/ui        editor, scope, inspector, palette, analyses, screens
  tests         node:test suites + Playwright screenshot/interaction scripts
  tools         marketing asset generator
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
