</main>
<footer class="site-footer">
  <div class="wrap grid">
    <div>
      <a class="brand" href="<?= e(url('index.php')) ?>"><img src="<?= e(url('assets/img/icon.svg')) ?>" width="34" height="34" alt=""><span>Rapti<b>CKT</b></span></a>
      <p class="muted"><?= e(t('Design. Simulate. Resonate.', 'ডিজাইন। সিমুলেট। রেজোনেট।')) ?></p>
      <p class="muted small">v<?= SITE_VERSION ?></p>
    </div>
    <div>
      <h4><?= e(t('Explore', 'দেখুন')) ?></h4>
      <a href="<?= e(url('features.php')) ?>"><?= e(t('Features', 'ফিচার')) ?></a>
      <a href="<?= e(url('components.php')) ?>"><?= e(t('Components', 'কম্পোনেন্ট')) ?></a>
      <a href="<?= e(url('examples.php')) ?>"><?= e(t('Examples', 'উদাহরণ')) ?></a>
      <a href="<?= e(url('manual.php')) ?>"><?= e(t('User manual', 'ইউজার ম্যানুয়াল')) ?></a>
    </div>
    <div>
      <h4><?= e(t('Get it', 'পান')) ?></h4>
      <a href="<?= e(url('simulator/')) ?>" target="_blank" rel="noopener"><?= e(t('Run in browser', 'ব্রাউজারে চালান')) ?></a>
      <a href="<?= e(url('download.php')) ?>"><?= e(t('Android APK', 'অ্যান্ড্রয়েড APK')) ?></a>
      <a href="<?= e(url('contact.php')) ?>"><?= e(t('Contact', 'যোগাযোগ')) ?></a>
    </div>
    <div>
      <h4>RAPTI</h4>
      <p class="muted small"><?= e(ORG_NAME) ?></p>
      <p class="muted small"><?= e(ORG_ADDRESS) ?></p>
      <a href="<?= e(ORG_SITE) ?>" target="_blank" rel="noopener">rapti.net</a>
    </div>
  </div>
  <div class="wrap copy">© <?= date('Y') ?> <?= e(ORG_NAME) ?> · rapti.net</div>
</footer>
<script src="<?= e(url('assets/js/site.js')) ?>?v=<?= SITE_VERSION ?>"></script>
</body>
</html>
