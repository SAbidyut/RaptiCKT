<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/lang.php';
$page = 'examples';
$title = t('Examples', 'উদাহরণ') . ' — ' . SITE_NAME;
require __DIR__ . '/includes/header.php';
$file = __DIR__ . '/content/examples.json';
$all = is_file($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];
$cats = [];
foreach ($all as $x) $cats[$x['cat']] = ($cats[$x['cat']] ?? 0) + 1;
?>
<section class="page-head"><div class="wrap">
  <h1><?= e(t('Examples', 'উদাহরণ')) ?></h1>
  <p class="lead"><?= e(t('101 explained circuits. Click one to open it in the simulator — it is already wired and runs by itself.', '১০১টি ব্যাখ্যাসহ সার্কিট। যেকোনোটিতে ক্লিক করলে সিমুলেটরে খুলবে — তার লাগানোই আছে, নিজে থেকেই চলবে।')) ?></p>
  <input type="search" id="q" class="search" placeholder="<?= e(t('Search: RC filter, star-delta, 555, house wiring …', 'খুঁজুন: RC filter, star-delta, 555, house wiring …')) ?>" autocomplete="off">
  <div class="chips drag-scroll" id="catchips">
    <button class="chip on" data-cat=""><?= e(t('All', 'সব')) ?> <small><?= count($all) ?></small></button>
    <?php foreach ($cats as $c => $n): ?><button class="chip" data-cat="<?= e($c) ?>"><?= e($c) ?> <small><?= $n ?></small></button><?php endforeach; ?>
  </div>
  <p class="muted small" id="count"></p>
</div></section>
<section class="wrap block">
  <div class="ex-grid" id="exgrid">
    <?php foreach ($all as $x): $thumb = 'assets/img/examples/' . $x['id'] . '.jpg'; ?>
      <a class="ex" href="<?= e(url('simulator/#example=' . $x['id'])) ?>" target="_blank" rel="noopener"
         data-cat="<?= e($x['cat']) ?>" data-text="<?= e(strtolower($x['title'] . ' ' . $x['cat'] . ' ' . $x['desc'])) ?>">
        <?php if (is_file(__DIR__ . '/' . $thumb)): ?><img src="<?= e(url($thumb)) ?>" alt="" loading="lazy" draggable="false"><?php endif; ?>
        <span class="tag"><?= e($x['cat']) ?></span>
        <h3><?= e($x['title']) ?></h3>
        <p><?= e($x['desc']) ?></p>
        <span class="open">▶ <?= e(t('Open in simulator', 'সিমুলেটরে খুলুন')) ?></span>
      </a>
    <?php endforeach; ?>
  </div>
  <p id="none" class="muted" hidden><?= e(t('No example matches your search.', 'কোনো উদাহরণ মেলেনি।')) ?></p>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
