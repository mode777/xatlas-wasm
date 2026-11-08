#!/usr/bin/env node
/**
 * Packed-package consumer test (XW-020).
 *
 * Packs the real npm tarball, installs it into a scratch project, runs a Node
 * consumer, typechecks a TypeScript consumer against the packaged declarations
 * and builds a small Vite app that imports the installed package. The scratch
 * install uses only the local tarball; no registry access is required.
 *
 * Usage: node scripts/test-package.mjs
 * Keep the scratch tree for inspection: KEEP_PACKAGE_TEST=1
 * Break the installed copy on purpose (local hook): TEST_PACKAGE_DROP=<file>
 */

import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ENTRY = path.join(REPO_ROOT, 'dist', 'index.mjs');
const DIST_WASM = path.join(REPO_ROOT, 'dist', 'xatlas.wasm');
const DIST_TYPES = path.join(REPO_ROOT, 'lib', 'xatlas.d.ts');
const TSC = path.join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const VITE = path.join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const SCRATCH = path.join(os.tmpdir(), 'xatlas-wasm-package-test');
const PACK_DIR = path.join(SCRATCH, 'pack');
const PROJECT = path.join(SCRATCH, 'project');
const INSTALLED = path.join(PROJECT, 'node_modules', 'xatlas-wasm');

function fail(message) {
  console.error(`test-package: ${message}`);
  process.exit(1);
}

function failStage(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    stdio: options.stdio ?? 'inherit',
    env: process.env,
  });
}

// --- Preflight ------------------------------------------------------------
if (!existsSync(DIST_ENTRY)) {
  fail('dist/index.mjs is missing; run "npm run build" first.');
}
if (!existsSync(DIST_WASM)) {
  fail('dist/xatlas.wasm is missing; run "npm run build" first.');
}
if (!existsSync(DIST_TYPES)) {
  fail('lib/xatlas.d.ts is missing; run "npm run build" first.');
}
if (!existsSync(TSC) || !existsSync(VITE)) {
  fail('typescript and vite are required; run "npm ci" first.');
}

rmSync(SCRATCH, { recursive: true, force: true });
mkdirSync(PACK_DIR, { recursive: true });
mkdirSync(path.join(PROJECT, 'src'), { recursive: true });
console.log(`test-package: scratch ${SCRATCH}`);

let keep = process.env.KEEP_PACKAGE_TEST === '1';
let stage = 'pack';

try {
  // --- Pack and inspect the tarball --------------------------------------
  run(NPM, ['pack', '--ignore-scripts', '--pack-destination', PACK_DIR]);
  const tarball = readdirSync(PACK_DIR).find((file) => file.endsWith('.tgz'));
  if (!tarball) failStage(`npm pack produced no tarball in ${PACK_DIR}`);
  console.log(`test-package: packed ${tarball}`);

  stage = 'tarball contents';
  const tarballPath = path.join(PACK_DIR, tarball);
  const listing = execFileSync('tar', ['tzf', tarballPath], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim());
  for (const required of [
    'package/dist/index.mjs',
    'package/dist/xatlas.wasm',
    'package/lib/xatlas.d.ts',
    'package/README.md',
    'package/package.json',
  ]) {
    if (!listing.includes(required)) {
      failStage(`tarball is missing ${required}`);
    }
  }

  // --- Scratch install ----------------------------------------------------
  stage = 'install';
  writeFileSync(
    path.join(PROJECT, 'package.json'),
    `${JSON.stringify(
      { name: 'xatlas-wasm-package-consumer', private: true, type: 'module' },
      null,
      2,
    )}\n`,
  );
  run(
    NPM,
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      tarballPath,
    ],
    { cwd: PROJECT },
  );

  // --- Optional negative-test hook ---------------------------------------
  const drop = process.env.TEST_PACKAGE_DROP;
  if (drop) {
    stage = 'negative drop';
    const target = path.resolve(INSTALLED, drop);
    if (!target.startsWith(`${INSTALLED}${path.sep}`)) {
      failStage(`TEST_PACKAGE_DROP must name a file inside the installed package: ${drop}`);
    }
    if (!existsSync(target)) {
      failStage(`TEST_PACKAGE_DROP file not found in the installed package: ${drop}`);
    }
    rmSync(target, { force: true });
    console.log(`test-package: dropped ${drop} from the installed package`);
  }

  // --- Installed package contents -----------------------------------------
  stage = 'installed contents';
  for (const required of ['dist/index.mjs', 'dist/xatlas.wasm', 'lib/xatlas.d.ts']) {
    if (!existsSync(path.join(INSTALLED, required))) {
      failStage(`installed package is missing ${required}`);
    }
  }

  // --- Node consumer ------------------------------------------------------
  stage = 'node consumer';
  writeFileSync(
    path.join(PROJECT, 'check.mjs'),
    `import createXAtlas from 'xatlas-wasm';

const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

const xatlas = await createXAtlas();
const atlas = xatlas.createAtlas();
const error = atlas.addMesh({ positions, indices });
if (error !== xatlas.AddMeshError.Success) {
  throw new Error('addMesh failed: ' + xatlas.addMeshErrorString(error));
}
atlas.generate();
if (!(atlas.width > 0)) throw new Error('atlas width is zero');
if (!(atlas.height > 0)) throw new Error('atlas height is zero');
const mesh = atlas.getMesh(0);
if (!(mesh.vertexCount > 0)) throw new Error('no output vertices');
if (!(mesh.indexCount > 0)) throw new Error('no output indices');

const imageAtlas = xatlas.createAtlas();
imageAtlas.addMesh({ positions, indices });
imageAtlas.generate({}, { createImage: true });
const image = imageAtlas.getImage();
if (!image || !image.data || image.data.length === 0) {
  throw new Error('getImage() returned no data');
}
imageAtlas.destroy();

console.log(
  'node consumer: ' + atlas.width + 'x' + atlas.height +
  ', ' + mesh.vertexCount + ' vertices, ' + mesh.indexCount + ' indices, ' +
  image.data.length + ' image texels',
);
atlas.destroy();
`,
  );
  run(process.execPath, ['check.mjs'], { cwd: PROJECT });
  console.log('test-package: Node consumer passed');

  // --- TypeScript consumer ------------------------------------------------
  stage = 'typecheck';
  writeFileSync(
    path.join(PROJECT, 'check.ts'),
    `import createXAtlas from 'xatlas-wasm';
import type { AtlasImage, CreateXAtlasOptions, Mesh, XAtlas } from 'xatlas-wasm';

export async function run(): Promise<number> {
  const options: CreateXAtlasOptions = {
    wasmBinary: new Uint8Array(),
    locateFile: (path) => path,
    print: () => {},
    printErr: () => {},
  };
  const xatlas = await createXAtlas(options);
  const atlas: XAtlas = xatlas.createAtlas();
  atlas.addMesh({
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
  atlas.generate({}, { createImage: true });
  const mesh: Mesh = atlas.getMesh(0);
  const image: AtlasImage | null = atlas.getImage();
  const count: number = mesh.vertexCount + mesh.indexCount + (image?.data.length ?? 0);
  atlas.destroy();
  return count;
}
`,
  );
  writeFileSync(
    path.join(PROJECT, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'es2022',
          module: 'nodenext',
          moduleResolution: 'nodenext',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
        },
        include: ['check.ts'],
      },
      null,
      2,
    )}\n`,
  );
  run(process.execPath, [TSC, '-p', path.join(PROJECT, 'tsconfig.json')]);
  console.log('test-package: TypeScript consumer typechecks');

  // --- Vite consumer ------------------------------------------------------
  stage = 'vite build';
  writeFileSync(
    path.join(PROJECT, 'index.html'),
    '<!doctype html><html><body><script type="module" src="/src/main.js"></script></body></html>\n',
  );
  writeFileSync(
    path.join(PROJECT, 'src', 'main.js'),
    `import createXAtlas from 'xatlas-wasm';

async function main() {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const xatlas = await createXAtlas();
  const atlas = xatlas.createAtlas();
  atlas.addMesh({ positions, indices });
  atlas.generate();
  globalThis.__xatlasResult = {
    width: atlas.width,
    height: atlas.height,
    vertexCount: atlas.getMesh(0).vertexCount,
  };
  atlas.destroy();
}

main();
`,
  );
  const vite = spawnSync(process.execPath, [VITE, 'build', '--logLevel', 'warn'], {
    cwd: PROJECT,
    encoding: 'utf8',
  });
  if (vite.status !== 0) {
    failStage(`Vite build failed:\n${vite.stdout ?? ''}\n${vite.stderr ?? ''}`);
  }
  const viteLog = `${vite.stdout ?? ''}\n${vite.stderr ?? ''}`;
  if (/externalized for browser compatibility/.test(viteLog)) {
    failStage(`Vite reported a Node built-in externalization warning:\n${viteLog.trim()}`);
  }

  stage = 'vite assertions';
  const distDir = path.join(PROJECT, 'dist');
  const assetsDir = path.join(distDir, 'assets');
  const emitted = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
  const jsAssets = emitted.filter((file) => /\.m?js$/.test(file));
  if (jsAssets.length === 0) {
    failStage(`Vite build emitted no JS asset (assets: ${emitted.join(', ')})`);
  }
  const wasmAssets = emitted.filter((file) => file.endsWith('.wasm'));
  if (wasmAssets.length === 0) {
    failStage(`Vite build emitted no WASM asset (assets: ${emitted.join(', ')})`);
  }
  const extraModuleChunks = emitted.filter((file) => file.endsWith('.mjs'));
  if (extraModuleChunks.length > 0) {
    failStage(
      `Vite emitted unexpected extra module chunk(s): ${extraModuleChunks.join(', ')}`
    );
  }
  const jsContents = jsAssets
    .map((file) => readFileSync(path.join(assetsDir, file), 'utf8'))
    .join('\n');
  if (!jsContents.includes('.wasm')) {
    failStage(`Vite JS does not reference a WASM asset (assets: ${emitted.join(', ')})`);
  }
  const html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  if (!html.includes('assets/') || !jsAssets.some((file) => html.includes(file))) {
    failStage(`Vite build did not reference an emitted JS asset (assets: ${jsAssets.join(', ')})`);
  }
  console.log(`test-package: Vite build emitted ${emitted.join(', ')}`);
  console.log('test-package: all checks passed');
} catch (err) {
  keep = true;
  console.error(`test-package: FAILED at stage "${stage}" (scratch kept at ${SCRATCH})`);
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  if (!keep) {
    rmSync(SCRATCH, { recursive: true, force: true });
  } else {
    console.log(`test-package: scratch kept at ${SCRATCH}`);
  }
}
