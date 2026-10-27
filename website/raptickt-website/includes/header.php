<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lang.php';

$page  = $page  ?? 'home';
$title = $title ?? SITE_NAME . ' — ' . t('Circuit Simulator', 'সার্কিট সিমুলেটর');
$desc  = $desc  ?? t('Real-time analog, digital and mixed-signal circuit simulator with 520 components, oscilloscope, multimeter, Bode plots and SPICE export. Runs on Android and in your PC browser.', 'রিয়েল-টাইম অ্যানালগ, ডিজিটাল ও মিক্সড-সিগন্যাল সার্কিট সিমুলেটর — ৫২০টি কম্পোনেন্ট, অসিলোস্কোপ, মাল্টিমিটার, Bode প্লট ও SPICE এক্সপোর্ট। অ্যান্ড্রয়েড ও পিসি ব্রাউজারে চলে।');
$nav = [
    'home'       => ['index.php',      t('Home', 'হোম')],
    'features'   => ['features.php',   t('Features', 'ফিচার')],
    'components' => ['components.php', t('Components', 'কম্পোনেন্ট')],
    'examples'   => ['examples.php',   t('Examples', 'উদাহরণ')],
    'manual'     => ['manual.php',     t('Manual', 'ম্যানুয়াল')],
    'download'   => ['download.php',   t('Download', 'ডাউনলোড')],
    'about'      => ['about.php',      t('About', 'আমাদের সম্পর্কে')],
    'contact'    => ['contact.php',    t('Contact', 'যোগাযোগ')],
];
$other = LANG === 'bn' ? 'en' : 'bn';
$here = strtok($_SERVER['REQUEST_URI'] ?? '', '?');
$qs = $_GET; unset($qs['lang']); $qs['lang'] = $other;
?><!doctype html>
<html lang="<?= LANG ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($title) ?></title>
<meta name="description" content="<?= e($desc) ?>">
<meta name="theme-color" content="#070b14">
<meta property="og:title" content="<?= e($title) ?>">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:image" content="<?= e(url('assets/img/feature-graphic.png')) ?>">
<link rel="icon" href="<?= e(url('assets/img/icon.svg')) ?>" type="image/svg+xml">
<link rel="stylesheet" href="<?= e(url('assets/css/site.css')) ?>?v=<?= SITE_VERSION ?>">
</head>
<body class="page-<?= e($page) ?>">
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="<?= e(url('index.php')) ?>" aria-label="<?= SITE_NAME ?>">
      <img src="<?= e(url('assets/img/icon.svg')) ?>" width="38" height="38" alt="">
      <span>Rapti<b>CKT</b></span>
    </a>
    <button class="burger" aria-label="Menu" aria-expanded="false" data-burger><i></i><i></i><i></i></button>
    <nav class="nav" data-nav>
      <?php foreach ($nav as $key => [$href, $label]): ?>
        <a href="<?= e(url($href)) ?>"<?= $key === $page ? ' class="on" aria-current="page"' : '' ?>><?= e($label) ?></a>
      <?php endforeach; ?>
      <a class="lang" href="<?= e($here . '?' . http_build_query($qs)) ?>" title="English / বাংলা"><?= LANG === 'bn' ? 'EN' : 'বাংলা' ?></a>
      <a class="btn small" href="<?= e(url('simulator/')) ?>" target="_blank" rel="noopener">▶ <?= e(t('Open simulator', 'সিমুলেটর চালান')) ?></a>
    </nav>
  </div>
</header>
<main>
