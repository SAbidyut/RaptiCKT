// Writes the user manual as Markdown: ../docs/MANUAL.md (English) and ../docs/MANUAL.bn.md (বাংলা).
// The same text feeds the in-app manual, so this is always in step with the app.
// Usage: npm run manual
import fs from 'node:fs';
import path from 'node:path';
import { manualMarkdown } from '../src/ui/manual-content.js';

const dir = path.resolve('../docs');
fs.mkdirSync(dir, { recursive: true });
for (const [lang, file] of [['en', 'MANUAL.md'], ['bn', 'MANUAL.bn.md']]) {
  const other = lang === 'en' ? '[বাংলায় পড়ুন → MANUAL.bn.md](MANUAL.bn.md)' : '[Read in English → MANUAL.md](MANUAL.md)';
  fs.writeFileSync(path.join(dir, file), `${other}\n\n${manualMarkdown(lang)}`);
  console.log('wrote', path.join('docs', file));
}
