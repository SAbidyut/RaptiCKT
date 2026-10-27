<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/lang.php';
$page = 'about';
$title = t('About', 'আমাদের সম্পর্কে') . ' — ' . SITE_NAME;
require __DIR__ . '/includes/header.php';
$courses = [
  ['Industrial Automation (PLC)', '3 Months'], ['Industrial Electrical Control', '3 Months'], ['General Electrician', '3 Months'],
  ['House Wiring', '3 Months'], ['CC Camera', '15 Days'], ['Computer Office Application', '3 Months'],
  ['Graphic Design & Multimedia', '3 Months'], ['Web Design & Development', '3 Months'], ['App Development', '3 Months'],
];
?>
<section class="page-head"><div class="wrap"><h1><?= e(t('About RAPTI', 'RAPTI সম্পর্কে')) ?></h1><p class="lead"><?= e(ORG_NAME) ?></p></div></section>
<section class="wrap block">
  <div class="split">
    <div class="prose">
      <p><?= e(t('RAPTI was established in 2019 with one goal: developing skilled manpower for the automation industry. Courses are designed by experienced, competent engineers so that every student can work independently in any industry after finishing — with the knowledge and skills that real job positions demand.', '২০১৯ সালে RAPTI-র যাত্রা শুরু একটি লক্ষ্য নিয়ে — অটোমেশন শিল্পের জন্য দক্ষ জনশক্তি তৈরি। অভিজ্ঞ ও দক্ষ ইঞ্জিনিয়ারদের তৈরি কোর্সের মাধ্যমে প্রতিটি শিক্ষার্থী কোর্স শেষে যেকোনো শিল্পে স্বাধীনভাবে কাজ করার মতো জ্ঞান ও দক্ষতা অর্জন করে।')) ?></p>
      <p><?= e(t('RaptiCKT is RAPTI’s circuit simulator, built so students can practise wiring, control circuits and electronics safely before touching real equipment.', 'RaptiCKT হলো RAPTI-র সার্কিট সিমুলেটর — যাতে শিক্ষার্থীরা আসল যন্ত্রে হাত দেওয়ার আগে নিরাপদে ওয়্যারিং, কন্ট্রোল সার্কিট ও ইলেকট্রনিক্স অনুশীলন করতে পারে।')) ?></p>
      <h3><?= e(t('Courses', 'কোর্স')) ?></h3>
      <ul class="ticks"><?php foreach ($courses as [$n, $d]): ?><li><?= e($n) ?> — <?= e($d) ?></li><?php endforeach; ?></ul>
      <a class="btn ghost" href="<?= e(ORG_SITE) ?>" target="_blank" rel="noopener">rapti.net →</a>
    </div>
    <aside class="card">
      <h3><?= e(t('Contact', 'যোগাযোগ')) ?></h3>
      <p><b><?= e(t('Phone / WhatsApp', 'ফোন / হোয়াটসঅ্যাপ')) ?></b><br><?php foreach (ORG_PHONES as $p): ?><a href="tel:<?= e($p) ?>"><?= e($p) ?></a><br><?php endforeach; ?></p>
      <p><b>Email</b><br><a href="mailto:<?= e(ORG_EMAIL) ?>"><?= e(ORG_EMAIL) ?></a></p>
      <p><b><?= e(t('Address', 'ঠিকানা')) ?></b><br><?= e(ORG_ADDRESS) ?><br><a href="<?= e(ORG_MAP) ?>" target="_blank" rel="noopener"><?= e(t('Open in Maps', 'ম্যাপে দেখুন')) ?></a></p>
    </aside>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
