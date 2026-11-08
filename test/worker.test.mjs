/**
 * Worker smoke test for xatlas-wasm.
 *
 * Run after `npm run build`:
 *   node test/worker.test.mjs
 *
 * Set WORKER_TEST_FAIL=1 to prove a worker error fails the parent.
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = path.join(ROOT, 'dist', 'index.mjs');
const WASM = path.join(ROOT, 'dist', 'xatlas.wasm');

if (!existsSync(ENTRY) || !existsSync(WASM)) {
  console.error('dist/index.mjs and dist/xatlas.wasm are required. Run "npm run build" first.');
  process.exit(1);
}

const worker = new Worker(new URL('./worker-entry.mjs', import.meta.url));

try {
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('worker timed out after 30s'));
    }, 30_000);

    worker.once('message', (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    worker.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    worker.once('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new Error(`worker exited with code ${code}`));
      }
    });
  });

  assert.ok(result.width > 0, `worker atlas width is ${result.width}`);
  assert.ok(result.height > 0, `worker atlas height is ${result.height}`);
  assert.ok(result.vertexCount > 0, `worker vertex count is ${result.vertexCount}`);
  assert.ok(result.indexCount > 0, `worker index count is ${result.indexCount}`);
  console.log(
    `worker: ${result.width}x${result.height}, ${result.vertexCount} vertices, ${result.indexCount} indices`
  );
} finally {
  await worker.terminate();
}

console.log('All worker checks passed.');
