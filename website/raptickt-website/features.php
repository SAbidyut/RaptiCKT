<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/lang.php';
$page = 'features';
$title = t('Features', 'ফিচার') . ' — ' . SITE_NAME;
require __DIR__ . '/includes/header.php';
$groups = [
  [t('Build', 'তৈরি করুন'), [
    t('Unlimited canvas with zoom, pan, snap-to-grid and automatic wire routing', 'জুম, প্যান, স্ন্যাপ-টু-গ্রিড ও অটো ওয়্যার রাউটিংসহ সীমাহীন ক্যানভাস'),
    t('520 components in 22 categories — sources, batteries, renewables, passives, transformers, protection, switches, machines, semiconductors, ICs, logic, communication, sensors, outputs, meters', '২২টি ক্যাটাগরিতে ৫২০টি কম্পোনেন্ট — সোর্স, ব্যাটারি, নবায়নযোগ্য, প্যাসিভ, ট্রান্সফরমার, প্রোটেকশন, সুইচ, মেশিন, সেমিকন্ডাক্টর, আইসি, লজিক, কমিউনিকেশন, সেন্সর, আউটপুট, মিটার'),
    t('Operate / Wire modes: wire while stopped, tap switches and push buttons while running', 'Operate / Wire মোড: থামানো অবস্থায় ওয়্যারিং, চলন্ত অবস্থায় সুইচ ও বাটন চাপা'),
    t('Rotary knob for any value · undo / redo · multi-select (window and crossing boxes)', 'যেকোনো মানের জন্য ঘূর্ণি নব · undo / redo · মাল্টি-সিলেক্ট (উইন্ডো ও ক্রসিং বক্স)'),
  ]],
  [t('Measure', 'মাপুন'), [
    t('6-channel oscilloscope: 1-2-5 scales, trigger, FFT, XY mode, measurements, CSV export', '৬-চ্যানেল অসিলোস্কোপ: 1-2-5 স্কেল, ট্রিগার, FFT, XY মোড, মেজারমেন্ট, CSV এক্সপোর্ট'),
    t('Multimeter with draggable probes: V (DC + true RMS), A, Ω, W, Hz, L, C', 'টেনে নেওয়া যায় এমন প্রোবসহ মাল্টিমিটার: V (DC + true RMS), A, Ω, W, Hz, L, C'),
    t('Live voltage and current labels on the schematic, RMS readings in AC circuits', 'স্কিম্যাটিকে লাইভ ভোল্টেজ ও কারেন্ট লেবেল, AC সার্কিটে RMS রিডিং'),
  ]],
  [t('Analyse', 'বিশ্লেষণ করুন'), [
    t('AC sweep (Bode) with −3 dB, f₀, bandwidth, Q and phase margin', 'AC সুইপ (Bode) — −3 dB, f₀, ব্যান্ডউইথ, Q ও ফেজ মার্জিনসহ'),
    t('DC sweep, operating point, harmonics (THD), impedance vs frequency, parametric sweep, Monte Carlo, power / efficiency table', 'DC সুইপ, অপারেটিং পয়েন্ট, হারমোনিক্স (THD), ইম্পিডেন্স বনাম ফ্রিকোয়েন্সি, প্যারামেট্রিক সুইপ, মন্টে কার্লো, পাওয়ার / এফিশিয়েন্সি টেবিল'),
    t('SPICE netlist export for ngspice / LTspice cross-checks', 'ngspice / LTspice-এ মিলিয়ে দেখার জন্য SPICE নেটলিস্ট এক্সপোর্ট'),
  ]],
  [t('Real-life behaviour', 'বাস্তব আচরণ'), [
    t('Over-stressed parts burn out and stay broken until replaced — bulbs, LEDs, resistors, capacitors, fuses, breakers', 'অতিরিক্ত চাপে পার্টস পুড়ে যায় এবং বদলানো পর্যন্ত নষ্ট থাকে — বাল্ব, LED, রেজিস্টর, ক্যাপাসিটর, ফিউজ, ব্রেকার'),
    t('Every wire is a real cable (IEC 60228 / 60364-5-52): it heats, glows, smokes and burns through', 'প্রতিটি তার বাস্তব ক্যাবল (IEC 60228 / 60364-5-52): গরম হয়, জ্বলে, ধোঁয়া ছাড়ে ও পুড়ে যায়'),
    t('MCB / RCCB tripping and relay timing run on the real-time clock', 'MCB / RCCB ট্রিপিং ও রিলে টাইমিং রিয়েল-টাইম ঘড়িতে চলে'),
    t('Fault simulation: open terminals, shorts, leakage, timed faults', 'ফল্ট সিমুলেশন: ওপেন টার্মিনাল, শর্ট, লিকেজ, টাইমড ফল্ট'),
  ]],
  [t('Learn', 'শিখুন'), [
    t('101 explained examples and 8 big build-along projects (2-storey house wiring, 16-bit RAM, 5 V power supply, traffic light, counters …)', '১০১টি ব্যাখ্যাসহ উদাহরণ ও ৮টি বড় প্রজেক্ট (দোতলা বাড়ির ওয়্যারিং, ১৬-বিট RAM, ৫ V পাওয়ার সাপ্লাই, ট্রাফিক লাইট, কাউন্টার …)'),
    t('Industrial control: DOL, star-delta, forward/reverse, timers, interlocks, ladder diagrams', 'ইন্ডাস্ট্রিয়াল কন্ট্রোল: DOL, স্টার-ডেল্টা, ফরওয়ার্ড/রিভার্স, টাইমার, ইন্টারলক, ল্যাডার ডায়াগ্রাম'),
    t('Complete built-in manual with search, formulas and FAQ', 'সার্চ, ফর্মুলা ও FAQ সহ সম্পূর্ণ বিল্ট-ইন ম্যানুয়াল'),
  ]],
  [t('Everywhere', 'সব জায়গায়'), [
    t('Runs in any modern browser on Windows, Linux and macOS — no install, works offline once loaded', 'Windows, Linux ও macOS-এর যেকোনো আধুনিক ব্রাউজারে চলে — ইনস্টল ছাড়া, লোড হলে অফলাইনেও'),
    t('Native Android app (8.0+) with the same engine', 'একই ইঞ্জিনসহ নেটিভ অ্যান্ড্রয়েড অ্যাপ (8.0+)'),
    t('Save / export / import .rckt files, PNG export, 3 themes', '.rckt ফাইল সেভ / এক্সপোর্ট / ইমপোর্ট, PNG এক্সপোর্ট, ৩টি থিম'),
  ]],
];
?>
<section class="page-head"><div class="wrap"><h1><?= e(t('Features', 'ফিচার')) ?></h1><p class="lead"><?= e(t('A complete circuit lab that fits in a browser tab.', 'ব্রাউজারের একটি ট্যাবে পূর্ণাঙ্গ সার্কিট ল্যাব।')) ?></p></div></section>
<section class="wrap block">
  <div class="cards two">
    <?php foreach ($groups as [$h, $items]): ?>
      <article class="card"><h3><?= e($h) ?></h3><ul class="ticks"><?php foreach ($items as $it): ?><li><?= e($it) ?></li><?php endforeach; ?></ul></article>
    <?php endforeach; ?>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
