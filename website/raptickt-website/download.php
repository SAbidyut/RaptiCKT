<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/lang.php';
$page = 'download';
$title = t('Download', 'ডাউনলোড') . ' — ' . SITE_NAME;
require __DIR__ . '/includes/header.php';
?>
<section class="page-head"><div class="wrap"><h1><?= e(t('Get RaptiCKT', 'RaptiCKT নিন')) ?></h1><p class="lead"><?= e(t('Use it in your browser right now, or install it on your Android phone.', 'এখনই ব্রাউজারে চালান, অথবা অ্যান্ড্রয়েড ফোনে ইনস্টল করুন।')) ?></p></div></section>
<section class="wrap block">
  <div class="cards two">
    <article class="card big">
      <i>🖥️</i><h3><?= e(t('On your PC — in the browser', 'পিসিতে — ব্রাউজারে')) ?></h3>
      <p><?= e(t('Works in Chrome, Edge, Firefox and Safari on Windows, Linux and macOS. Nothing to install. Your circuits are saved in the browser.', 'Windows, Linux ও macOS-এ Chrome, Edge, Firefox ও Safari-তে চলে। কিছু ইনস্টল করতে হয় না। আপনার সার্কিট ব্রাউজারেই সেভ থাকে।')) ?></p>
      <a class="btn" href="<?= e(url('simulator/')) ?>" target="_blank" rel="noopener">▶ <?= e(t('Run in browser', 'ব্রাউজারে চালান')) ?></a>
    </article>
    <article class="card big">
      <i>📱</i><h3><?= e(t('On Android', 'অ্যান্ড্রয়েডে')) ?></h3>
      <p><?= e(t('Requires Android 8.0 or newer. Download the APK, open it and allow “Install unknown apps” if Android asks.', 'Android 8.0 বা নতুন লাগবে। APK ডাউনলোড করে খুলুন; Android চাইলে “Install unknown apps” চালু করুন।')) ?></p>
      <a class="btn" href="<?= e(APK_URL) ?>" target="_blank" rel="noopener">⬇ <?= e(t('Download APK', 'APK ডাউনলোড')) ?></a>
    </article>
  </div>
  <h2 class="mt"><?= e(t('Install steps (Android)', 'ইনস্টলের ধাপ (অ্যান্ড্রয়েড)')) ?></h2>
  <ol class="steps">
    <li><?= e(t('Open the Releases page and pick the newest “RaptiCKT v1.0.0 (build N)”.', 'Releases পেজে গিয়ে সবচেয়ে নতুন “RaptiCKT v1.0.0 (build N)” বেছে নিন।')) ?></li>
    <li><?= e(t('Download RaptiCKT-latest.apk to your phone.', 'RaptiCKT-latest.apk ফোনে ডাউনলোড করুন।')) ?></li>
    <li><?= e(t('Open the file and tap Install.', 'ফাইলটি খুলে Install চাপুন।')) ?></li>
  </ol>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
