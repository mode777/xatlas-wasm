#!/usr/bin/env node
/**
 * Bundle the JavaScript wrapper and the Emscripten glue into dist/index.mjs.
 *
 * The bundle is built for a neutral platform so a single artifact works in
 * Node.js, browsers and workers. Emscripten's Node branch imports the
 * `module` built-in with a literal dynamic import, which makes Vite warn that
 * `module` was externalized for browser compatibility. Rewrite that one
 * import to a non-literal specifier so Vite leaves it alone; the branch only
 * runs in Node, where the specifier still resolves to the built-in.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GLUE = path.join(ROOT, 'dist', 'xatlas.mjs');
const OUTFILE = path.join(ROOT, 'dist', 'index.mjs');
const WASM = path.join(ROOT, 'dist', 'xatlas.wasm');
const MARKER = '__xatlasNodeModuleSpecifier';

if (!existsSync(GLUE)) {
  console.error('bundle: dist/xatlas.mjs is missing; run "npm run build" first.');
  process.exit(1);
}

let rewrites = 0;

await build({
  entryPoints: [path.join(ROOT, 'lib', 'xatlas.mjs')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  external: ['module', 'fs', 'path', 'url'],
  outfile: OUTFILE,
  legalComments: 'none',
  logLevel: 'warning',
  plugins: [
    {
      name: 'xatlas-node-module-import',
      setup(build) {
        build.onLoad({ filter: /[\\/]dist[\\/]xatlas\.mjs$/ }, (args) => {
          let source = readFileSync(args.path, 'utf8');

          const moduleImports = [...source.matchAll(/import\((["'])module\1\)/g)];
          if (moduleImports.length !== 1) {
            throw new Error(
              `expected exactly one import("module") in ${args.path}; found ${moduleImports.length}`
            );
          }
          source = source.replace(
            /import\((["'])module\1\)/g,
            `import(/* @vite-ignore */ ${MARKER})`
          );

          // Vite treats the Node script-directory expression as an asset
          // reference and emits the whole entry as an extra chunk. Give it a
          // non-literal module URL so the asset transform leaves it alone.
          const moduleUrls = [
            ...source.matchAll(/new URL\((["'])\.\/\1\s*,\s*import\.meta\.url\)/g),
          ];
          if (moduleUrls.length !== 1) {
            throw new Error(
              `expected exactly one new URL("./", import.meta.url) in ${args.path}; found ${moduleUrls.length}`
            );
          }
          source = source.replace(
            /new URL\((["'])\.\/\1\s*,\s*import\.meta\.url\)/g,
            'new URL("./", __xatlasModuleUrl)'
          );

          source = `const __xatlasModuleUrl = import.meta.url;\nconst ${MARKER} = "module";\n${source}`;
          rewrites += 1;
          return { contents: source, loader: 'js' };
        });
      },
    },
  ],
});

if (rewrites !== 1) {
  console.error(`bundle: expected one glue rewrite, performed ${rewrites}.`);
  process.exit(1);
}

const output = readFileSync(OUTFILE, 'utf8');
if (/import\((["'])module\1\)/.test(output)) {
  console.error('bundle: dist/index.mjs still contains a static import("module").');
  process.exit(1);
}
if (!existsSync(WASM)) {
  console.error('bundle: dist/xatlas.wasm is missing; the Emscripten build did not emit it.');
  process.exit(1);
}

const kib = (file) => `${(statSync(file).size / 1024).toFixed(1)} KiB`;
console.log(
  `bundle: wrote dist/index.mjs (${kib(OUTFILE)}), wasm ${kib(WASM)} (neutral platform)`
);
