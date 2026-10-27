<?php
// Used only by PHP's built-in server:  php -S localhost:8000 router.php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . $path;
// never serve private folders
if (preg_match('#^/(storage|content|includes)(/|$)#', $path)) { http_response_code(403); exit('Forbidden'); }
// simulator/ -> simulator/index.html
if (is_dir($file) && is_file(rtrim($file, '/') . '/index.html') && !is_file(rtrim($file, '/') . '/index.php')) {
    if (substr($path, -1) !== '/') { header('Location: ' . $path . '/'); exit; }
    header('Content-Type: text/html; charset=utf-8');
    readfile(rtrim($file, '/') . '/index.html');
    return true;
}
if ($path !== '/' && is_file($file)) return false;        // real file: let PHP serve it
if (is_file($file . '.php')) { require $file . '.php'; return true; }  // /features -> features.php
require __DIR__ . '/index.php';
