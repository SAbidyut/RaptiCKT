// Writes the user manual as Markdown: ../docs/MANUAL.md.
// The same text feeds the in-app manual, so this is always in step with the app.
// Usage: npm run manual
import fs from 'node:fs';
import path from 'node:path';
import { manualMarkdown } from '../src/ui/manual-content.js';

const dir = path.resolve('../docs');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'MANUAL.md'), manualMarkdown());
console.log('wrote', path.join('docs', 'MANUAL.md'));
