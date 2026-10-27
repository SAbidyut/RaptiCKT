<?php
session_start();
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/lang.php';
$page = 'contact';
$title = t('Contact', 'যোগাযোগ') . ' — ' . SITE_NAME;

$errors = [];
$sent = false;
$v = ['name' => '', 'email' => '', 'subject' => '', 'message' => ''];
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach ($v as $k => $_) $v[$k] = trim((string)($_POST[$k] ?? ''));
    if (!hash_equals($_SESSION['csrf'], (string)($_POST['csrf'] ?? ''))) $errors[] = t('Session expired — please try again.', 'সেশন শেষ — আবার চেষ্টা করুন।');
    if (($_POST['website'] ?? '') !== '') $errors[] = 'spam';           // honeypot field
    if (mb_strlen($v['name']) < 2) $errors[] = t('Please enter your name.', 'আপনার নাম লিখুন।');
    if (!filter_var($v['email'], FILTER_VALIDATE_EMAIL)) $errors[] = t('Please enter a valid e-mail.', 'সঠিক ইমেইল দিন।');
    if (mb_strlen($v['message']) < 5) $errors[] = t('Please write a message.', 'বার্তা লিখুন।');
    if (mb_strlen($v['message']) > 4000 || mb_strlen($v['subject']) > 150) $errors[] = t('Message too long.', 'বার্তা খুব বড়।');
    $last = $_SESSION['last_msg'] ?? 0;
    if (!$errors && time() - $last < 20) $errors[] = t('Please wait a few seconds before sending again.', 'আবার পাঠাতে কয়েক সেকেন্ড অপেক্ষা করুন।');
    if (!$errors) {
        $dir = __DIR__ . '/storage';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $row = ['time' => date('c'), 'ip' => $_SERVER['REMOTE_ADDR'] ?? '', 'name' => $v['name'], 'email' => $v['email'], 'subject' => $v['subject'], 'message' => $v['message']];
        $ok = @file_put_contents($dir . '/messages.log', json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX) !== false;
        if (CONTACT_MAIL) {
            $subj = '[RaptiCKT] ' . preg_replace('/[\r\n]+/', ' ', $v['subject'] ?: 'Message from website');
            $head = 'Reply-To: ' . preg_replace('/[\r\n]+/', '', $v['email']);
            $ok = @mail(ORG_EMAIL, $subj, "From: {$v['name']} <{$v['email']}>\n\n{$v['message']}", $head) || $ok;
        }
        if ($ok) { $sent = true; $_SESSION['last_msg'] = time(); $v = array_map(fn () => '', $v); }
        else $errors[] = t('Could not save your message. Please e-mail us directly.', 'বার্তা সেভ করা যায়নি। সরাসরি ইমেইল করুন।');
    }
}
require __DIR__ . '/includes/header.php';
?>
<section class="page-head"><div class="wrap"><h1><?= e(t('Contact us', 'যোগাযোগ করুন')) ?></h1><p class="lead"><?= e(t('Questions, bug reports, ideas, or training enquiries — we read everything.', 'প্রশ্ন, বাগ রিপোর্ট, আইডিয়া বা ট্রেনিং সংক্রান্ত জিজ্ঞাসা — সবকিছু আমরা পড়ি।')) ?></p></div></section>
<section class="wrap block">
  <div class="split">
    <form method="post" class="form" novalidate>
      <?php if ($sent): ?><div class="alert ok"><?= e(t('Thank you! Your message was sent.', 'ধন্যবাদ! আপনার বার্তা পাঠানো হয়েছে।')) ?></div><?php endif; ?>
      <?php foreach ($errors as $er): if ($er !== 'spam'): ?><div class="alert err"><?= e($er) ?></div><?php endif; endforeach; ?>
      <input type="hidden" name="csrf" value="<?= e($_SESSION['csrf']) ?>">
      <input type="text" name="website" value="" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label><?= e(t('Name', 'নাম')) ?><input name="name" value="<?= e($v['name']) ?>" required></label>
      <label>Email<input type="email" name="email" value="<?= e($v['email']) ?>" required></label>
      <label><?= e(t('Subject', 'বিষয়')) ?><input name="subject" value="<?= e($v['subject']) ?>"></label>
      <label><?= e(t('Message', 'বার্তা')) ?><textarea name="message" rows="7" required><?= e($v['message']) ?></textarea></label>
      <button class="btn" type="submit"><?= e(t('Send message', 'বার্তা পাঠান')) ?></button>
    </form>
    <aside class="card">
      <h3>RAPTI</h3>
      <p><b><?= e(t('Phone / WhatsApp', 'ফোন / হোয়াটসঅ্যাপ')) ?></b><br><?php foreach (ORG_PHONES as $p): ?><a href="tel:<?= e($p) ?>"><?= e($p) ?></a><br><?php endforeach; ?></p>
      <p><b>Email</b><br><a href="mailto:<?= e(ORG_EMAIL) ?>"><?= e(ORG_EMAIL) ?></a></p>
      <p><b><?= e(t('Address', 'ঠিকানা')) ?></b><br><?= e(ORG_ADDRESS) ?></p>
      <p><a href="<?= e(ORG_SITE) ?>" target="_blank" rel="noopener">rapti.net</a></p>
    </aside>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
