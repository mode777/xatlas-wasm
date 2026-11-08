#!/usr/bin/env node
/*
 * Verify the production showcase emitted and references the hashed xatlas
 * wasm asset. Run after `vite build`; `SITE_BASE` is checked when set.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const dist = path.join(siteRoot, 'dist');

function fail(message) {
  console.error(`showcase build check failed: ${message}`);
  process.exit(1);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

if (!existsSync(path.join(dist, 'index.html'))) {
  fail('site/dist/index.html is missing; run `npm run build` first');
}

const files = walk(dist);
const wasmFiles = files.filter((file) => file.endsWith('.wasm'));
const jsFiles = files.filter((file) => file.endsWith('.js'));

if (wasmFiles.length === 0) {
  fail('xatlas.wasm is missing from site/dist');
}

const js = jsFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
for (const wasm of wasmFiles) {
  const name = path.basename(wasm);
  if (!js.includes(name)) {
    fail(`xatlas.wasm asset ${name} is not referenced by the built JavaScript`);
  }
}

const base = process.env.SITE_BASE;
if (base && base !== '/') {
  const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
  if (!html.includes(base)) {
    fail(`index.html does not use the SITE_BASE path ${base}`);
  }
}

const total = wasmFiles.reduce((sum, file) => sum + statSync(file).size, 0);
console.log(
  `showcase build check passed: ${wasmFiles.length} wasm asset(s), ${total} bytes`,
);
