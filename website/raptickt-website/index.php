<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/lang.php';
$page = 'home';
require __DIR__ . '/includes/header.php';
$shots = [
    ['1-home', t('Home screen', 'হোম স্ক্রিন')],
    ['2-lrc-oscillator', t('LRC oscillator', 'LRC অসিলেটর')],
    ['3-555-timer', t('555 timer', '৫৫৫ টাইমার')],
    ['4-amplifier-knob', t('Amplifier with knob', 'নবসহ অ্যামপ্লিফায়ার')],
    ['5-bode-plot', t('Bode plot', 'Bode প্লট')],
    ['6-components', t('Component library', 'কম্পোনেন্ট লাইব্রেরি')],
    ['7-logic', t('Digital logic', 'ডিজিটাল লজিক')],
    ['8-about', t('About RAPTI', 'RAPTI পরিচিতি')],
];
$stats = [['520', t('components', 'কম্পোনেন্ট')], ['22', t('categories', 'ক্যাটাগরি')], ['101', t('explained examples', 'ব্যাখ্যাসহ উদাহরণ')], ['8', t('big projects', 'বড় প্রজেক্ট')]];
?>
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <span class="pill"><?= e(t('Made by RAPTI · Dhaka', 'RAPTI, ঢাকা-র তৈরি')) ?></span>
      <h1><?= e(t('Build, run and understand circuits — live.', 'সার্কিট বানান, চালান, বুঝুন — লাইভ।')) ?></h1>
      <p class="lead"><?= e(t('RaptiCKT is a real-time circuit simulator for electrical and electronic engineering students, electricians and researchers. 520 parts, oscilloscope, multimeter, Bode plots, house wiring, motor control and PLC-style ladder diagrams — in your browser or on your phone.', 'RaptiCKT একটি রিয়েল-টাইম সার্কিট সিমুলেটর — EEE শিক্ষার্থী, ইলেকট্রিশিয়ান ও গবেষকদের জন্য। ৫২০টি কম্পোনেন্ট, অসিলোস্কোপ, মাল্টিমিটার, Bode প্লট, হাউস ওয়্যারিং, মোটর কন্ট্রোল ও ল্যাডার ডায়াগ্রাম — ব্রাউজারে বা ফোনে।')) ?></p>
      <div class="cta">
        <a class="btn" href="<?= e(url('simulator/')) ?>" target="_blank" rel="noopener">▶ <?= e(t('Run in browser', 'ব্রাউজারে চালান')) ?></a>
        <a class="btn ghost" href="<?= e(url('download.php')) ?>">⬇ <?= e(t('Get the Android app', 'অ্যান্ড্রয়েড অ্যাপ নিন')) ?></a>
      </div>
      <p class="muted small"><?= e(t('Free · works offline once loaded · mouse, touch and keyboard', 'ফ্রি · লোড হলে অফলাইনেও চলে · মাউস, টাচ ও কিবোর্ড')) ?></p>
    </div>
    <div class="hero-art" aria-hidden="true">
      <img src="<?= e(url('assets/img/screenshots/2-lrc-oscillator.jpg')) ?>" alt="" class="phone p1" loading="eager">
      <img src="<?= e(url('assets/img/screenshots/3-555-timer.jpg')) ?>" alt="" class="phone p2" loading="eager">
    </div>
  </div>
</section>

<section class="stats wrap">
  <?php foreach ($stats as [$n, $l]): ?><div><b><?= $n ?></b><span><?= e($l) ?></span></div><?php endforeach; ?>
</section>

<section class="wrap block">
  <h2><?= e(t('Everything an electronics lab has', 'ইলেকট্রনিক্স ল্যাবের সবকিছু')) ?></h2>
  <div class="cards">
    <article class="card"><i>⚡</i><h3><?= e(t('SPICE-class engine', 'SPICE-মানের ইঞ্জিন')) ?></h3><p><?= e(t('Modified nodal analysis, Newton–Raphson, trapezoidal integration — checked against analytic results.', 'মডিফাইড নোডাল অ্যানালাইসিস, নিউটন–র‍্যাফসন, ট্র্যাপিজয়ডাল ইন্টিগ্রেশন — গাণিতিক ফলাফলের সাথে যাচাই করা।')) ?></p></article>
    <article class="card"><i>📈</i><h3><?= e(t('Scope & multimeter', 'স্কোপ ও মাল্টিমিটার')) ?></h3><p><?= e(t('6-channel oscilloscope with FFT and XY, draggable multimeter probes for V, A, Ω, W, Hz.', '৬-চ্যানেল অসিলোস্কোপ (FFT ও XY সহ), টেনে নেওয়া যায় এমন প্রোবসহ মাল্টিমিটার।')) ?></p></article>
    <article class="card"><i>🔥</i><h3><?= e(t('Real-life limits', 'বাস্তব সীমাবদ্ধতা')) ?></h3><p><?= e(t('Parts burn, wires catch fire, MCBs trip in real time — learn why protection matters.', 'পার্টস পুড়ে যায়, তারে আগুন ধরে, MCB ট্রিপ করে — সুরক্ষা কেন দরকার তা শিখুন।')) ?></p></article>
    <article class="card"><i>🏠</i><h3><?= e(t('House wiring & motor control', 'হাউস ওয়্যারিং ও মোটর কন্ট্রোল')) ?></h3><p><?= e(t('Complete 2-storey house, DOL and star-delta starters, ladder diagrams, timers and counters.', 'পূর্ণাঙ্গ দোতলা বাড়ি, DOL ও স্টার-ডেল্টা স্টার্টার, ল্যাডার ডায়াগ্রাম, টাইমার ও কাউন্টার।')) ?></p></article>
    <article class="card"><i>🔬</i><h3><?= e(t('Analyses', 'অ্যানালাইসিস')) ?></h3><p><?= e(t('Bode plots, DC sweep, harmonics, impedance, Monte Carlo, power table and SPICE netlist export.', 'Bode প্লট, DC সুইপ, হারমোনিক্স, ইম্পিডেন্স, মন্টে কার্লো, পাওয়ার টেবিল ও SPICE নেটলিস্ট।')) ?></p></article>
    <article class="card"><i>🖱️</i><h3><?= e(t('Made for PC too', 'পিসির জন্যও তৈরি')) ?></h3><p><?= e(t('Drag with the mouse, wheel to zoom, right-drag to pan, keyboard shortcuts. Touch works as well.', 'মাউস দিয়ে ড্র্যাগ, হুইলে জুম, রাইট-ক্লিক ড্র্যাগে প্যান, কিবোর্ড শর্টকাট। টাচও কাজ করে।')) ?></p></article>
  </div>
</section>

<section class="block alt">
  <div class="wrap">
    <h2><?= e(t('See it working', 'চালু অবস্থায় দেখুন')) ?></h2>
    <p class="muted"><?= e(t('Drag the strip with your mouse →', 'মাউস দিয়ে স্ট্রিপটি টেনে দেখুন →')) ?></p>
  </div>
  <div class="strip drag-scroll" tabindex="0">
    <?php foreach ($shots as [$f, $cap]): ?>
      <figure><img src="<?= e(url("assets/img/screenshots/$f.jpg")) ?>" alt="<?= e($cap) ?>" loading="lazy" draggable="false"><figcaption><?= e($cap) ?></figcaption></figure>
    <?php endforeach; ?>
  </div>
</section>

<section class="wrap block">
  <div class="split">
    <div>
      <h2><?= e(t('Try it now — nothing to install', 'এখনই চালান — ইনস্টল লাগবে না')) ?></h2>
      <ol class="steps">
        <li><?= e(t('Click “Run in browser”.', '“ব্রাউজারে চালান”-এ ক্লিক করুন।')) ?></li>
        <li><?= e(t('Open Examples and pick “LED with switch”.', 'Examples থেকে “LED with switch” খুলুন।')) ?></li>
        <li><?= e(t('Press Run, click the switch, turn the knob.', 'Run চাপুন, সুইচে ক্লিক করুন, নব ঘোরান।')) ?></li>
      </ol>
      <a class="btn" href="<?= e(url('simulator/#example=led')) ?>" target="_blank" rel="noopener">▶ <?= e(t('Open the LED example', 'LED উদাহরণ খুলুন')) ?></a>
    </div>
    <div class="kbd-box">
      <h3><?= e(t('Mouse & keyboard', 'মাউস ও কিবোর্ড')) ?></h3>
      <ul class="keys">
        <li><kbd><?= e(t('Drag', 'ড্র্যাগ')) ?></kbd> <?= e(t('move a part · pan the board · scroll lists', 'পার্ট সরান · বোর্ড প্যান · লিস্ট স্ক্রল')) ?></li>
        <li><kbd><?= e(t('Right / middle drag', 'রাইট/মিডল ড্র্যাগ')) ?></kbd> <?= e(t('pan the board', 'বোর্ড প্যান')) ?></li>
        <li><kbd><?= e(t('Wheel', 'হুইল')) ?></kbd> <?= e(t('zoom', 'জুম')) ?></li>
        <li><kbd>Space</kbd> <?= e(t('run / pause', 'চালান / থামান')) ?></li>
        <li><kbd>R</kbd> <?= e(t('rotate', 'ঘোরান')) ?> · <kbd>Del</kbd> <?= e(t('delete', 'মুছুন')) ?> · <kbd>Ctrl+Z/Y</kbd> undo/redo · <kbd>Ctrl+D</kbd> <?= e(t('copy', 'কপি')) ?></li>
      </ul>
    </div>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
