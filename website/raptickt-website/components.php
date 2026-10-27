<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/lang.php';
$page = 'components';
$title = t('Components', 'কম্পোনেন্ট') . ' — ' . SITE_NAME;
require __DIR__ . '/includes/header.php';
require_once __DIR__ . '/includes/markdown.php';
$ch = manual_chapter('ch-library');
$html = $ch ? md_render($ch['md']) : '<p>content/MANUAL.md is missing.</p>';
// wrap every "### Category — N" section so the search box can hide whole categories
$cats = [];
$html = preg_replace_callback('/<h3 id="([^"]+)">(.+?)<\/h3>(.*?)(?=<h3 id=|\z)/s', function ($m) use (&$cats) {
    $cats[] = [$m[1], strip_tags($m[2])];
    return '<section class="cat" data-cat="' . e($m[1]) . '"><h3 id="' . $m[1] . '">' . $m[2] . '</h3>' . $m[3] . '</section>';
}, $html);
?>
<section class="page-head"><div class="wrap">
  <h1><?= e(t('Component library', 'কম্পোনেন্ট লাইব্রেরি')) ?></h1>
  <p class="lead"><?= e(t('All 520 parts, grouped as in the simulator’s “+” menu.', 'সিমুলেটরের “+” মেনুর মতো সাজানো সব ৫২০টি পার্টস।')) ?></p>
  <input type="search" id="q" class="search" placeholder="<?= e(t('Search a part: LM358, MCB, 555, BLDC, solar …', 'পার্টস খুঁজুন: LM358, MCB, 555, BLDC, solar …')) ?>" autocomplete="off">
  <div class="chips drag-scroll" id="catchips">
    <button class="chip on" data-cat=""><?= e(t('All', 'সব')) ?></button>
    <?php foreach ($cats as [$id, $name]): ?><button class="chip" data-cat="<?= e($id) ?>"><?= e($name) ?></button><?php endforeach; ?>
  </div>
  <p class="muted small" id="count"></p>
</div></section>
<section class="wrap block prose" id="lib">
  <?= preg_replace('/<h2[^>]*>.*?<\/h2>/s', '', $html) ?>
  <p id="none" class="muted" hidden><?= e(t('No part matches your search.', 'কোনো পার্টস মেলেনি।')) ?></p>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
