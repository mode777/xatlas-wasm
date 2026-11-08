#!/usr/bin/env node
/**
 * Prebuild helper: configure CMake when the build directory has no cache.
 *
 * Checks for build/CMakeCache.txt (not merely the directory, so a stale empty
 * build/ still triggers configure), runs `npm run configure` with inherited
 * stdio, and exits with the child's status.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CMAKE_CACHE = path.join(REPO_ROOT, 'build', 'CMakeCache.txt');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// CMake links the Emscripten output into dist/ and does not recreate that
// directory once the build tree is configured, so make sure it exists even
// when only dist/ was removed.
mkdirSync(DIST_DIR, { recursive: true });

if (!existsSync(CMAKE_CACHE)) {
  console.log('build/CMakeCache.txt not found; running npm run configure...');
  const result = spawnSync(NPM, ['run', 'configure'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    console.error(`Failed to run npm run configure: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}
