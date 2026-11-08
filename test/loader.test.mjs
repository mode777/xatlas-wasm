/**
 * Loader behaviour tests for xatlas-wasm.
 *
 * Run after `npm run build`:
 *   node test/loader.test.mjs
 */

import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = path.join(ROOT, 'dist', 'index.mjs');
const WASM = path.join(ROOT, 'dist', 'xatlas.wasm');

if (!existsSync(ENTRY) || !existsSync(WASM)) {
  console.error('dist/index.mjs and dist/xatlas.wasm are required. Run "npm run build" first.');
  process.exit(1);
}

const { default: createXAtlas } = await import(pathToFileURL(ENTRY).href);

// --- Default sibling resolution ------------------------------------------
{
  const xatlas = await createXAtlas();
  assert.equal(typeof xatlas.createAtlas, 'function');
  assert.equal(typeof xatlas.addMeshErrorString, 'function');
  assert.equal(typeof xatlas.AddMeshError.Success, 'number');
  console.log('loader: default sibling resolution passed');
}

// --- Custom locateFile ----------------------------------------------------
{
  const calls = [];
  const xatlas = await createXAtlas({
    locateFile: (file, prefix) => {
      calls.push([file, prefix]);
      return pathToFileURL(path.join(ROOT, 'dist', file)).href;
    },
  });
  assert.equal(typeof xatlas.createAtlas, 'function');
  assert.ok(calls.length > 0, 'locateFile should be called');
  assert.equal(calls[0][0], 'xatlas.wasm');
  assert.equal(typeof calls[0][1], 'string');
  console.log('loader: custom locateFile passed');
}

// --- wasmBinary precedence ------------------------------------------------
{
  const bytes = readFileSync(WASM);
  let locatorCalled = false;
  const xatlas = await createXAtlas({
    wasmBinary: bytes,
    locateFile: () => {
      locatorCalled = true;
      throw new Error('locateFile must not be called when wasmBinary is supplied');
    },
  });
  assert.equal(typeof xatlas.createAtlas, 'function');
  assert.equal(locatorCalled, false);
  console.log('loader: wasmBinary precedence passed');
}

// --- ArrayBufferView normalization ---------------------------------------
{
  const bytes = readFileSync(WASM);
  const padded = new Uint8Array(bytes.length + 8);
  padded.set(bytes, 4);
  const view = new DataView(padded.buffer, 4, bytes.length);
  const xatlas = await createXAtlas({ wasmBinary: view });
  assert.equal(typeof xatlas.createAtlas, 'function');
  console.log('loader: ArrayBufferView normalization passed');
}

// --- Logging callbacks ----------------------------------------------------
{
  const xatlas = await createXAtlas({ print: () => {}, printErr: () => {} });
  assert.equal(typeof xatlas.createAtlas, 'function');
  console.log('loader: logging callbacks passed');
}

// --- Option validation ----------------------------------------------------
{
  await assert.rejects(createXAtlas({ wasmBinary: 'not-bytes' }), (error) => {
    assert.ok(error instanceof TypeError);
    assert.match(error.message, /wasmBinary/);
    return true;
  });
  await assert.rejects(createXAtlas({ locateFile: '/xatlas.wasm' }), (error) => {
    assert.ok(error instanceof TypeError);
    assert.match(error.message, /locateFile/);
    return true;
  });
  await assert.rejects(createXAtlas({ print: 'console.log' }), (error) => {
    assert.ok(error instanceof TypeError);
    assert.match(error.message, /print/);
    return true;
  });
  await assert.rejects(createXAtlas({ printErr: 'console.error' }), (error) => {
    assert.ok(error instanceof TypeError);
    assert.match(error.message, /printErr/);
    return true;
  });
  console.log('loader: option validation passed');
}

// --- Missing artifact -----------------------------------------------------
{
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'xatlas-missing-wasm-'));
  try {
    const copy = path.join(scratch, 'index.mjs');
    copyFileSync(ENTRY, copy);
    const { default: createFromCopy } = await import(pathToFileURL(copy).href);

    await assert.rejects(createFromCopy(), (error) => {
      assert.ok(error instanceof Error, 'expected an Error');
      assert.match(error.message, /xatlas\.wasm/, 'error should name xatlas.wasm');
      assert.ok(error.cause, 'error should preserve the underlying cause');
      return true;
    });
    console.log('loader: missing artifact rejection passed');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

console.log('All loader checks passed.');
