<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/lang.php';
$page = 'manual';
require __DIR__ . '/includes/header.php';
require_once __DIR__ . '/includes/markdown.php';
$chapters = manual_chapters();
$id = $_GET['ch'] ?? ($chapters[0]['id'] ?? '');
$cur = 0;
foreach ($chapters as $k => $c) if ($c['id'] === $id) $cur = $k;
$ch = $chapters[$cur] ?? null;
$body = $ch ? md_render($ch['md']) : '<p>content/MANUAL.md is missing.</p>';
// links to other chapters (#ch-…) become real page links
$body = preg_replace('/href="#(ch-[^"]+)"/', 'href="' . e(url('manual.php')) . '?ch=$1"', $body);
$prev = $chapters[$cur - 1] ?? null;
$next = $chapters[$cur + 1] ?? null;
?>
<section class="page-head"><div class="wrap">
  <h1><?= e(t('User manual', 'ইউজার ম্যানুয়াল')) ?></h1>
  <p class="lead"><?= e(t('Everything in the app, step by step. (English)', 'অ্যাপের সবকিছু ধাপে ধাপে। (ইংরেজি)')) ?></p>
</div></section>
<section class="wrap block manual">
  <aside class="toc">
    <input type="search" id="tocq" class="search" placeholder="<?= e(t('Filter chapters', 'অধ্যায় খুঁজুন')) ?>">
    <nav id="toc">
      <?php foreach ($chapters as $c): ?>
        <a href="<?= e(url('manual.php')) ?>?ch=<?= e($c['id']) ?>"<?= $c['id'] === ($ch['id'] ?? '') ? ' class="on"' : '' ?>><?= e($c['title']) ?></a>
      <?php endforeach; ?>
    </nav>
  </aside>
  <article class="prose">
    <h2><?= e($ch['title'] ?? '') ?></h2>
    <?= $body ?>
    <div class="pager">
      <?php if ($prev): ?><a class="btn ghost" href="<?= e(url('manual.php')) ?>?ch=<?= e($prev['id']) ?>">← <?= e($prev['title']) ?></a><?php else: ?><span></span><?php endif; ?>
      <?php if ($next): ?><a class="btn ghost" href="<?= e(url('manual.php')) ?>?ch=<?= e($next['id']) ?>"><?= e($next['title']) ?> →</a><?php endif; ?>
    </div>
  </article>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
