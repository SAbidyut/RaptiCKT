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

- **90+ components** in 9 categories:
  - Sources: DC/AC/pulse/triangle/saw/noise/chirp, rails, clock, VCVS/VCCS/CCVS/CCCS
  - Passives: R, pot, C, electrolytic, L, transformer, fuse
  - Semiconductors: diode, Zener, Schottky, LED, NPN/PNP, N/P-MOSFET, N/P-JFET, with real part presets
  - Analog ICs: op-amp macromodel, comparator, 555, 78xx, LM317
  - Digital: gates, Schmitt trigger, D/JK/T flip-flops, SR latch, counter, 7-segment decoder, ADC, DAC
  - Sensors: LDR, NTC, Pt100, thermocouple, LM35, photodiode, phototransistor, solar cell, Hall, strain gauge, FSR, flex, gas, humidity, microphone, PIR
  - Switches: SPST, SPDT, push buttons, relay
  - Outputs: lamp, LED, 7-segment, DC motor, buzzer
  - Meters: voltmeter, ammeter, ohmmeter, wattmeter
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
- 20+ explained examples, save/export/import `.rckt` files, PNG export, 3 themes, and an About section with RAPTI information.

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
