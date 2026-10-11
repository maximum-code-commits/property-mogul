// Bundles src/ into single-file HTML builds:
//   dist/property-mogul.html  standalone page (double-click to play)
//   dist/artifact.html        page body for publishing as a claude.ai artifact
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const order = ['util', 'data', 'mapgen', 'art', 'sim', 'biz', 'render', 'audio', 'ui-core', 'ui-prop', 'ui-panels', 'main'];
const js = order.map((f) => `// ── ${f}.js ──\n` + readFileSync(`src/js/${f}.js`, 'utf8').replace(/^'use strict';\n/, '')).join('\n');
const css = readFileSync('src/style.css', 'utf8');
const body = readFileSync('src/index.html', 'utf8')
  .replace('/*CSS*/', () => css)
  .replace('/*JS*/', () => `'use strict';\n(function () {\n${js}\n})();`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', body);
writeFileSync('dist/property-mogul.html',
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="theme-color" content="#f7b23b">\n' + body + '\n</html>\n');
writeFileSync('dist/bundle.check.js', js);
console.log('built', (body.length / 1024).toFixed(1) + ' KB');
