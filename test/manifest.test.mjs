/**
 * Package manifest and metadata tests for xatlas-wasm.
 *
 * Run after `npm run build` so the declared dist files exist:
 *   node test/manifest.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const changelog = readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const license = readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
const notice = readFileSync(path.join(ROOT, 'NOTICE'), 'utf8');

const EXPECTED_FILES = [
  'dist/index.mjs',
  'dist/xatlas.wasm',
  'lib/xatlas.d.ts',
  'README.md',
  'LICENSE',
  'NOTICE',
  'CHANGELOG.md',
];

assert.deepEqual(
  pkg.files,
  EXPECTED_FILES,
  'package.json files must list exactly the shipped package files',
);
for (const file of EXPECTED_FILES) {
  assert.ok(
    existsSync(path.join(ROOT, file)),
    `package.json files entry is missing from the checkout: ${file} (run "npm run build" first)`,
  );
}

assert.equal(pkg.name, 'xatlas-wasm', 'package name must be xatlas-wasm');
assert.equal(pkg.license, 'MIT', 'package license must be MIT');
assert.equal(pkg.sideEffects, false, 'package.json sideEffects must be false');
assert.deepEqual(
  Object.keys(pkg.exports['.']),
  ['types', 'import'],
  'exports["."] must declare types before import',
);
assert.deepEqual(
  pkg.publishConfig,
  { access: 'public' },
  'publishConfig.access must be public',
);
assert.equal(
  pkg.engines.node,
  '>=16.0.0',
  'engines.node must remain >=16.0.0',
);

assert.match(license, /MIT License/, 'LICENSE must contain the MIT license text');
assert.match(
  license,
  /Alexander Klingenbeck/,
  'LICENSE must name the xatlas-wasm copyright holder',
);
assert.match(notice, /xatlas/, 'NOTICE must identify the upstream xatlas project');
assert.match(
  notice,
  /Jonathan Young/,
  'NOTICE must reproduce the upstream xatlas copyright',
);
assert.match(notice, /MIT License/, 'NOTICE must contain the upstream MIT license text');

assert.ok(
  changelog.includes('## [Unreleased]'),
  'CHANGELOG.md must contain an Unreleased section',
);
assert.ok(
  changelog.includes(`## [${pkg.version}]`),
  `CHANGELOG.md must contain a section for package version ${pkg.version}`,
);

const linkPattern = /\[[^\]]*\]\(([^)\s]+)\)/g;
const readmeWithoutCode = readme.replace(/```[\s\S]*?```/g, '');
let match;
while ((match = linkPattern.exec(readmeWithoutCode)) !== null) {
  let target = match[1].trim();
  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) {
    continue;
  }
  const pathPart = target.split('#')[0].split('?')[0];
  if (pathPart === '') continue;
  const resolved = path.resolve(ROOT, pathPart);
  const relative = path.relative(ROOT, resolved).split(path.sep).join('/');
  assert.ok(
    !relative.startsWith('..'),
    `README link escapes the repository: ${target}`,
  );
  assert.ok(
    pkg.files.includes(relative),
    `README relative link must target a packaged file or be absolute: ${target}`,
  );
}

console.log('manifest: all checks passed');
