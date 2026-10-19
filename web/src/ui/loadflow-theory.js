// Theory pages of the Load Flow section: what is solved, how, and how to read the results.
// Blocks: p (paragraph), f (formula lines), ul (bullets), steps (numbered), table, tip.
// `**bold**` is the only inline markup.

const P = (text) => ({ t: 'p', text });
const F = (...lines) => ({ t: 'f', lines });
const L = (text) => ({ t: 'ul', text });
const S = (text) => ({ t: 'steps', text });
const T = (head, rows) => ({ t: 'table', head, rows });
const TIP = (text) => ({ t: 'tip', text });

export const LF_THEORY = [
  {
    id: 'what', title: 'What is load flow analysis?',
    blocks: [
      P('A **load flow** (or **power flow**) study finds the steady-state operating point of a power system: the voltage magnitude |V| and angle δ at every bus, and from them the real and reactive power flowing in every line and transformer, the generation needed at the slack bus and the total losses.'),
      P('It is the most frequently run calculation in power engineering. It is used for planning new lines and substations, operating the grid (is any line overloaded? is any voltage too low?), choosing transformer taps and capacitor banks, and as the starting point for short-circuit and stability studies.'),
      L([
        '**Inputs:** the network (line and transformer impedances in per unit), the loads P + jQ, the generator outputs P and voltage set-points.',
        '**Unknowns:** |V| and δ at load buses, δ at generator buses, Q of generators, P and Q of the slack bus.',
        '**Outputs:** bus voltages, line flows, losses, generator Q, violations of voltage and thermal limits.',
      ]),
      P('The equations are non-linear (power depends on V², V·V·cos δ …), so they are solved by iteration: guess the voltages, compute the power mismatch, correct the voltages, repeat until the mismatch is tiny.'),
    ],
  },
  {
    id: 'bustypes', title: 'Bus types',
    blocks: [
      P('Each bus has four quantities: P, Q, |V| and δ. Two are specified and two are found by the load flow.'),
      T(['Bus type', 'Specified', 'Unknown', 'Typical example'], [
        ['Slack / swing (reference)', '|V|, δ (usually 0°)', 'P, Q', 'The largest power station; it supplies the losses, which are not known in advance'],
        ['PV (generator / voltage-controlled)', 'P, |V|', 'Q, δ', 'Generator with an AVR, synchronous condenser, SVC'],
        ['PQ (load)', 'P, Q', '|V|, δ', 'Substation feeding loads, bus with no generation'],
      ]),
      P('There must be exactly one slack bus: its angle is the reference for all others, and its generation balances the total load plus the losses.'),
      P('A PV bus can only hold its voltage while its generator stays within its reactive limits Qmin ≤ Qg ≤ Qmax. When a limit is reached the bus becomes a PQ bus with Q fixed at the limit (see **Q limits**).'),
      TIP('In this app: generation at a bus is Pg + jQg and load is Pd + jQd, both in MW and Mvar. At a PQ bus a non-zero Pg / Qg is treated as a negative load (for example a small generator with a fixed output).'),
    ],
  },
  {
    id: 'pu', title: 'The per-unit system',
    blocks: [
      P('Power-system quantities are expressed as a fraction of a chosen **base**. One base MVA is chosen for the whole system (usually 100 MVA) and one base kV per voltage level (the nominal line-to-line voltage). The other bases follow:'),
      F('I_base = S_base / (√3 · V_base)            [A]', 'Z_base = V_base² / S_base                [Ω]', 'Y_base = 1 / Z_base                      [S]', 'Z_pu = Z_Ω / Z_base'),
      P('Why per unit? Transformers disappear (a transformer with nominal ratio becomes a simple series impedance), all voltages are close to 1.0, and equipment impedances fall in narrow, familiar ranges.'),
      P('Equipment impedances are given on their own rating. To change to the system base:'),
      F('Z_new = Z_old · (kV_old / kV_new)² · (MVA_new / MVA_old)'),
      L([
        'Transformer with impedance voltage uk % on its rating S_T: Z_pu = (uk / 100) · (S_base / S_T).',
        'Overhead line: R, X in Ω/km and C in nF/km → R_pu = R·ℓ / Z_base, X_pu = X·ℓ / Z_base, B_pu = 2πf·C·ℓ · Z_base (total line charging).',
      ]),
      TIP('The **Per-unit tools** tab does all of these conversions and can add the result straight to your system as a new line or transformer.'),
    ],
  },
  {
    id: 'ybus', title: 'Bus admittance matrix (Y-bus)',
    blocks: [
      P('The network is described by Kirchhoff’s current law at every bus: I = Y_bus · V. Each line is modelled as a nominal π: a series admittance y = 1 / (R + jX) and half the line charging jB/2 at each end.'),
      F('Y_ii = Σ (y_ik + jB_ik/2) + y_sh,i        (diagonal: all admittances connected to bus i)', 'Y_ik = −y_ik                              (off-diagonal: minus the admittance between i and k)'),
      P('An off-nominal tap transformer with ratio t : 1 (tap on the from side) gives an asymmetric π:'),
      F('Y_ff = y / t²     Y_ft = −y / t*     Y_tf = −y / t     Y_tt = y'),
      P('Y-bus is symmetric for networks without phase shifters, and very sparse: a bus is usually connected to only 2–4 others, so most entries are zero. Open the **Y-bus** tab to see it for your system in rectangular (G + jB) or polar form.'),
    ],
  },
  {
    id: 'equations', title: 'Power flow equations',
    blocks: [
      P('The complex power injected at bus i is S_i = V_i · I_i* = V_i · (Σ_k Y_ik V_k)*. Writing Y_ik = G_ik + jB_ik and δ_ik = δ_i − δ_k:'),
      F('P_i = |V_i| Σ_k |V_k| (G_ik cos δ_ik + B_ik sin δ_ik)', 'Q_i = |V_i| Σ_k |V_k| (G_ik sin δ_ik − B_ik cos δ_ik)'),
      P('The **mismatch** is the difference between the specified and the calculated injection:'),
      F('ΔP_i = P_i,sp − P_i(V, δ)      (every bus except the slack)', 'ΔQ_i = Q_i,sp − Q_i(V, δ)      (PQ buses only)', 'P_i,sp = (Pg_i − Pd_i) / S_base     Q_i,sp = (Qg_i − Qd_i) / S_base'),
      P('With N buses of which N_PV are PV buses, there are 2(N − 1) − N_PV equations and as many unknowns. The load flow has converged when the largest |ΔP|, |ΔQ| is below the tolerance (this app: 10⁻⁶ pu by default, i.e. 0.0001 MW on a 100 MVA base).'),
    ],
  },
  {
    id: 'gs', title: 'Gauss–Seidel method',
    blocks: [
      P('Rearrange the current equation at bus i for V_i and sweep through the buses, always using the newest values of the other voltages:'),
      F('V_i(k+1) = (1 / Y_ii) · [ (P_i − jQ_i) / V_i*(k) − Σ_(j<i) Y_ij V_j(k+1) − Σ_(j>i) Y_ij V_j(k) ]'),
      S([
        'Flat start: |V| = 1.0, δ = 0 at load buses; |V| = set-point at generator buses.',
        'For each PQ bus, compute the new V_i with the formula above.',
        'For each PV bus, first compute Q_i = −Im{ V_i* Σ_k Y_ik V_k }, use it in the formula, then scale the new V_i back to the specified |V_i| (only its angle changes).',
        'Accelerate: V_i ← V_i(k) + α (V_i,new − V_i(k)), with α ≈ 1.4–1.6.',
        'Repeat until the largest voltage change |ΔV| is below the tolerance.',
      ]),
      L([
        '**Pros:** very simple, little memory, each iteration is cheap — ideal for hand calculation and learning.',
        '**Cons:** converges slowly (the number of iterations grows with system size), may fail on heavily loaded systems or with series capacitors.',
      ]),
      TIP('Try changing the acceleration factor α on the **System** tab and watch the iteration count on the **Results** tab: α = 1.0 is plain Gauss–Seidel.'),
    ],
  },
  {
    id: 'nr', title: 'Newton–Raphson method',
    blocks: [
      P('Linearise the power equations around the present estimate (Taylor series, first order) and solve for the correction:'),
      F('[ ΔP ]   [ H  N ] [ Δδ  ]', '[ ΔQ ] = [ M  L ] [ Δ|V| ]', '', 'H = ∂P/∂δ    N = ∂P/∂|V|    M = ∂Q/∂δ    L = ∂Q/∂|V|'),
      P('Jacobian elements (polar form):'),
      F('∂P_i/∂δ_i = −Q_i − B_ii |V_i|²         ∂P_i/∂δ_k = |V_i||V_k| (G_ik sin δ_ik − B_ik cos δ_ik)', '∂P_i/∂|V_i| = P_i/|V_i| + G_ii |V_i|    ∂P_i/∂|V_k| = |V_i| (G_ik cos δ_ik + B_ik sin δ_ik)', '∂Q_i/∂δ_i = P_i − G_ii |V_i|²          ∂Q_i/∂δ_k = −|V_i||V_k| (G_ik cos δ_ik + B_ik sin δ_ik)', '∂Q_i/∂|V_i| = Q_i/|V_i| − B_ii |V_i|    ∂Q_i/∂|V_k| = |V_i| (G_ik sin δ_ik − B_ik cos δ_ik)'),
      S([
        'Flat start.',
        'Compute P_i, Q_i and the mismatches ΔP, ΔQ.',
        'If max |ΔP|, |ΔQ| < tolerance: stop.',
        'Build the Jacobian and solve J · Δx = Δf (LU factorisation).',
        'Update δ ← δ + Δδ, |V| ← |V| + Δ|V| and go back to step 2.',
      ]),
      L([
        '**Pros:** quadratic convergence — 3 to 5 iterations for almost any system size; robust. The industry standard.',
        '**Cons:** the Jacobian must be rebuilt and factorised every iteration (more work per iteration); needs a reasonable starting point.',
      ]),
      TIP('The **Iterations** tab shows the mismatch falling roughly as 10⁻¹ → 10⁻³ → 10⁻⁷ (the number of correct digits doubles each step) and the final Jacobian matrix.'),
    ],
  },
  {
    id: 'fd', title: 'Fast Decoupled load flow',
    blocks: [
      P('In transmission networks X ≫ R and angle differences are small, so P depends mainly on δ and Q mainly on |V|: N and M are neglected. With a few more approximations (cos δ ≈ 1, G sin δ ≪ B, Q_i ≪ B_ii V_i²) the Jacobian becomes two constant matrices:'),
      F('ΔP / |V| = B′ · Δδ', 'ΔQ / |V| = B″ · Δ|V|'),
      L([
        '**B′**: built from −1/X of every branch only (resistance, line charging, shunts and taps ignored) — the XB scheme.',
        '**B″**: the negative imaginary part of Y-bus, for PQ buses.',
        'Both are factorised **once**; every iteration is two cheap forward/back substitutions, alternating a P–δ and a Q–V half-iteration.',
      ]),
      P('Convergence is linear (more iterations than Newton–Raphson, typically 5–10) but each iteration is much faster, and the answer is exactly the same because the mismatch is always computed with the full equations. It is used for contingency screening and real-time applications. It can struggle when R/X is large (distribution feeders).'),
    ],
  },
  {
    id: 'dc', title: 'DC load flow',
    blocks: [
      P('A linear approximation for quick studies of active power: all |V| = 1 pu, R neglected, sin δ ≈ δ. Then the flow on a branch and the bus injections are:'),
      F('P_ik = (δ_i − δ_k) / X_ik', 'P = B′ · δ        (one linear solve, no iteration)'),
      P('No reactive power, voltage magnitudes or losses are computed, and the slack bus picks up exactly the load minus the other generation. It is used in market clearing, transmission planning and N-1 screening of thousands of cases. Compare it with an AC method on the same system to see the error in line flows (usually a few percent).'),
    ],
  },
  {
    id: 'qlim', title: 'Generator Q limits (PV–PQ switching)',
    blocks: [
      P('A generator can only produce or absorb a limited amount of reactive power (capability curve). With **Enforce Q limits** on, the app solves the load flow, then checks every PV bus:'),
      L([
        'Qg > Qmax → the bus becomes PQ with Qg = Qmax; its voltage will fall below the set-point.',
        'Qg < Qmin → the bus becomes PQ with Qg = Qmin; its voltage will rise above the set-point.',
      ]),
      P('and solves again until no limit is broken. Every switch is listed on the **Results** tab. Leave the Qmin / Qmax fields empty for an unlimited generator.'),
    ],
  },
  {
    id: 'flows', title: 'Line flows and losses',
    blocks: [
      P('Once the bus voltages are known, the current and power at each end of a branch follow directly from its π model:'),
      F('I_ik = Y_ff V_i + Y_ft V_k          S_ik = V_i · I_ik*', 'I_ki = Y_tf V_i + Y_tt V_k          S_ki = V_k · I_ki*', 'S_loss = S_ik + S_ki'),
      L([
        'Real loss = I² R of the branch; it is always positive.',
        'Reactive loss = I² X minus the Mvar generated by the line charging; a lightly loaded long line generates Mvar (negative reactive loss).',
        'Total losses = total generation − total load (a good check of any result).',
        'Loading % = the larger of |S_ik| and |S_ki| divided by the branch rating (MVA). Enter a rating to have overloads flagged.',
      ]),
    ],
  },
  {
    id: 'compare', title: 'Comparing the methods',
    blocks: [
      T(['', 'Gauss–Seidel', 'Newton–Raphson', 'Fast Decoupled', 'DC'], [
        ['Convergence', 'Linear, slow', 'Quadratic', 'Linear (geometric)', 'Direct (1 solve)'],
        ['Iterations (14-bus)', '≈ 60 (α = 1.6)', '3', '≈ 6', '1'],
        ['Work per iteration', 'Very small', 'Large (new Jacobian)', 'Small (fixed matrices)', '—'],
        ['Memory', 'Least', 'Most', 'Medium', 'Least'],
        ['Accuracy', 'Exact', 'Exact', 'Exact', 'Approximate (P only)'],
        ['Best for', 'Learning, small systems', 'General use, large systems', 'Contingencies, real time', 'Planning, screening'],
      ]),
    ],
  },
  {
    id: 'howto', title: 'How to use this section',
    blocks: [
      S([
        '**System** tab: choose a test system (IEEE 14-bus, 9-bus, …) or start from the 2-bus template.',
        'Tap a bus or a branch to edit it; **+ Bus**, **+ Line** and **+ Transformer** add new ones. Use the **Per-unit tools** tab to convert ohms, Ω/km or transformer % impedance to per unit.',
        'Choose the method, tolerance and options, then tap **Run load flow**.',
        '**Results** shows the convergence summary, bus voltages, generation, line flows, losses and any violations. **CSV** exports the tables; **Report** shares a text report.',
        '**Diagram** draws the one-line diagram coloured by voltage and loading, with moving power-flow dots and arrows. Pinch, scroll or double-tap to zoom, drag the background to pan, use + / − / fit / full screen, and drag a bus to move it.',
        '**Charts** plots the voltage and angle profiles, the convergence and the line loading.',
        '**Iterations** lists every iteration (voltages and mismatch) and the Newton–Raphson Jacobian; **Y-bus** shows the admittance matrix.',
        '**N-1** takes every line out in turn and reports the worst voltage and loading for each outage.',
        '**Save** keeps your system in the app; **Export** writes a MATPOWER case file (.m) and **Import** reads one, so you can exchange cases with MATLAB / Octave / pandapower.',
      ]),
      TIP('Experiment: double the load at one bus and run again; take a line out of service; switch a generator bus to PQ; change a transformer tap from 1.0 to 0.95 and watch the voltage on its from side.'),
    ],
  },
];
