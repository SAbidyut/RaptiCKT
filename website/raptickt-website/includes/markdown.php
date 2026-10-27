<?php
// A small Markdown reader, just enough for content/MANUAL.md
// (headings, paragraphs, lists, tables, quotes, bold, italic, code, links).

function md_slug(string $s): string
{
    $s = strtolower(strip_tags($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-') ?: 'section';
}

function md_inline(string $s): string
{
    $s = e($s);
    $s = str_replace(['&lt;br&gt;', '&lt;br/&gt;'], '<br>', $s);
    $s = preg_replace('/`([^`]+)`/', '<code>$1</code>', $s);
    $s = preg_replace('/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $s);
    $s = preg_replace('/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/s', '<em>$1</em>', $s);
    $s = preg_replace_callback('/\[([^\]]+)\]\(([^)\s]+)\)/', function ($m) {
        $href = html_entity_decode($m[2]);
        if ($href !== '' && $href[0] === '#') { // chapter links inside the manual
            return '<a href="' . e($href) . '">' . $m[1] . '</a>';
        }
        return '<a href="' . e($href) . '" target="_blank" rel="noopener">' . $m[1] . '</a>';
    }, $s);
    return $s;
}

function md_cells(string $row): array
{
    $row = trim($row);
    $row = preg_replace('/^\||\|$/', '', $row);
    return array_map('trim', preg_split('/(?<!\\\\)\|/', $row));
}

function md_render(string $text): string
{
    $lines = preg_split('/\R/', $text);
    $out = [];
    $i = 0;
    $n = count($lines);
    while ($i < $n) {
        $line = $lines[$i];
        if (trim($line) === '') { $i++; continue; }
        if (preg_match('/^<a id="([^"]+)"><\/a>\s*$/', $line, $m)) { $out[] = '<a id="' . e($m[1]) . '"></a>'; $i++; continue; }
        if (preg_match('/^(#{1,6})\s+(.*)$/', $line, $m)) {
            $lvl = strlen($m[1]);
            $out[] = "<h$lvl id=\"" . md_slug($m[2]) . "\">" . md_inline($m[2]) . "</h$lvl>";
            $i++; continue;
        }
        if (preg_match('/^---+\s*$/', $line)) { $out[] = '<hr>'; $i++; continue; }
        if (preg_match('/^\s*\|/', $line) && $i + 1 < $n && preg_match('/^\s*\|[\s:|-]+\|\s*$/', $lines[$i + 1])) {
            $head = md_cells($line);
            $i += 2;
            $rows = [];
            while ($i < $n && preg_match('/^\s*\|/', $lines[$i])) { $rows[] = md_cells($lines[$i]); $i++; }
            $hasHead = implode('', $head) !== '';
            $h = '<div class="tablewrap"><table>';
            if ($hasHead) { $h .= '<thead><tr>'; foreach ($head as $c) $h .= '<th>' . md_inline($c) . '</th>'; $h .= '</tr></thead>'; }
            $h .= '<tbody>';
            foreach ($rows as $r) { $h .= '<tr>'; foreach ($r as $c) $h .= '<td>' . md_inline($c) . '</td>'; $h .= '</tr>'; }
            $out[] = $h . '</tbody></table></div>';
            continue;
        }
        if (preg_match('/^>\s?/', $line)) {
            $buf = [];
            while ($i < $n && preg_match('/^>\s?(.*)$/', $lines[$i], $m)) { $buf[] = $m[1]; $i++; }
            $cls = preg_match('/^\*\*(Warning|Danger)/i', $buf[0] ?? '') ? ' class="warn"' : '';
            $out[] = "<blockquote$cls>" . md_inline(implode(' ', $buf)) . '</blockquote>';
            continue;
        }
        if (preg_match('/^\s*([-*]|\d+\.)\s+/', $line)) {
            $ordered = (bool)preg_match('/^\s*\d+\./', $line);
            $items = [];
            while ($i < $n && preg_match('/^\s*(?:[-*]|\d+\.)\s+(.*)$/', $lines[$i], $m)) { $items[] = md_inline($m[1]); $i++; }
            $tag = $ordered ? 'ol' : 'ul';
            $out[] = "<$tag><li>" . implode('</li><li>', $items) . "</li></$tag>";
            continue;
        }
        $buf = [];
        while ($i < $n && trim($lines[$i]) !== '' && !preg_match('/^(#{1,6}\s|>|\s*\||---+\s*$|\s*([-*]|\d+\.)\s)/', $lines[$i])) { $buf[] = $lines[$i]; $i++; }
        if (!$buf) { $buf[] = $lines[$i]; $i++; }
        $out[] = '<p>' . md_inline(implode(' ', $buf)) . '</p>';
    }
    return implode("\n", $out);
}

/** The manual split into chapters: [ ['id'=>'ch-welcome','title'=>'1. Welcome…','md'=>'…'], … ] */
function manual_chapters(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;
    $file = __DIR__ . '/../content/MANUAL.md';
    $text = is_file($file) ? file_get_contents($file) : '';
    $parts = preg_split('/^(?=<a id="ch-[^"]+"><\/a>)/m', $text);
    $cache = [];
    foreach ($parts as $p) {
        if (!preg_match('/^<a id="(ch-[^"]+)"><\/a>\s*\R+##\s+(.+)$/m', $p, $m)) continue;
        $body = preg_replace('/^<a id="[^"]+"><\/a>\s*\R+##\s+.+\R/m', '', $p, 1);
        $cache[] = ['id' => $m[1], 'title' => trim($m[2]), 'md' => $body];
    }
    return $cache;
}

function manual_chapter(string $id): ?array
{
    foreach (manual_chapters() as $c) if ($c['id'] === $id) return $c;
    return null;
}
