<?php
// English / Bangla switch: ?lang=bn or ?lang=en (remembered in a cookie).
if (isset($_GET['lang']) && in_array($_GET['lang'], ['en', 'bn'], true)) {
    setcookie('lang', $_GET['lang'], time() + 86400 * 365, '/');
    $_COOKIE['lang'] = $_GET['lang'];
}
define('LANG', ($_COOKIE['lang'] ?? 'en') === 'bn' ? 'bn' : 'en');

/** Pick the English or Bangla text (falls back to English when no Bangla is given). */
function t(string $en, string $bn = ''): string
{
    return LANG === 'bn' && $bn !== '' ? $bn : $en;
}

function e(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Site-relative URL that works in the web root and in a sub-folder (XAMPP htdocs/raptickt-website). */
function url(string $path = ''): string
{
    static $base = null;
    if ($base === null) {
        $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    }
    return $base . '/' . ltrim($path, '/');
}
