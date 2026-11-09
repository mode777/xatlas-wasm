#!/usr/bin/env node
/**
 * Verify the exact published xatlas-wasm artifact from the npm registry.
 *
 * Usage:
 *   node scripts/verify-published.mjs v0.1.3
 *   node scripts/verify-published.mjs --version 0.1.3 --tarball /path/to.tgz
 *
 * Without --tarball, the script polls `npm view` for the version (up to five
 * minutes by default), downloads the registry tarball with `npm pack`, and runs
 * `scripts/test-package.mjs` against it through TEST_PACKAGE_TARBALL. With
 * --tarball, the registry is not touched.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_PACKAGE = path.join(ROOT, 'scripts', 'test-package.mjs');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function fail(message) {
  console.error(`verify-published: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let tag;
  let version;
  let tarball;
  let attempts = 20;
  let delayMs = 15000;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--version') {
      version = argv[index + 1];
      if (!version) fail('--version requires a value');
      index += 1;
    } else if (arg.startsWith('--version=')) {
      version = arg.slice('--version='.length);
    } else if (arg === '--tarball') {
      tarball = argv[index + 1];
      if (!tarball) fail('--tarball requires a path');
      index += 1;
    } else if (arg.startsWith('--tarball=')) {
      tarball = arg.slice('--tarball='.length);
    } else if (arg === '--attempts') {
      attempts = Number(argv[index + 1]);
      if (!Number.isInteger(attempts) || attempts < 1) fail('--attempts must be a positive integer');
      index += 1;
    } else if (arg === '--delay-ms') {
      delayMs = Number(argv[index + 1]);
      if (!Number.isInteger(delayMs) || delayMs < 0) fail('--delay-ms must be a non-negative integer');
      index += 1;
    } else if (arg.startsWith('-')) {
      fail(`unknown option: ${arg}`);
    } else if (tag === undefined) {
      tag = arg;
    } else {
      fail(`unexpected argument: ${arg}`);
    }
  }

  return { tag, version, tarball, attempts, delayMs };
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRegistry(version, attempts, delayMs) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(
      NPM,
      ['view', `xatlas-wasm@${version}`, 'version', '--json'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    if (result.status === 0) {
      let found;
      try {
        found = JSON.parse(result.stdout);
      } catch {
        found = result.stdout.trim();
      }
      if (found === version) {
        console.log(`verify-published: registry exposes xatlas-wasm@${version}`);
        return;
      }
    }
    if (attempt < attempts) {
      console.log(
        `verify-published: waiting for xatlas-wasm@${version} (${attempt}/${attempts})`,
      );
      await sleep(delayMs);
    }
  }
  fail(
    `xatlas-wasm@${version} did not appear on the npm registry within ${attempts} attempts`,
  );
}

function downloadTarball(version, destination) {
  execFileSync(
    NPM,
    [
      'pack',
      `xatlas-wasm@${version}`,
      '--ignore-scripts',
      '--pack-destination',
      destination,
    ],
    { cwd: ROOT, stdio: 'inherit' },
  );
  const tarball = readdirSync(destination).find((file) => file.endsWith('.tgz'));
  if (!tarball) fail(`npm pack produced no tarball for xatlas-wasm@${version}`);
  return path.join(destination, tarball);
}

function readTarballManifest(tarballPath) {
  try {
    return JSON.parse(
      execFileSync('tar', ['-xOzf', tarballPath, 'package/package.json'], {
        encoding: 'utf8',
      }),
    );
  } catch (error) {
    fail(
      `cannot read package/package.json from ${tarballPath}: ` +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

function runPackageConsumer(tarballPath) {
  const result = spawnSync(process.execPath, [TEST_PACKAGE], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, TEST_PACKAGE_TARBALL: tarballPath },
  });
  if (result.status !== 0) {
    fail(`consumer verification failed for ${tarballPath}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pkg = readJson(path.join(ROOT, 'package.json'));
  const packageVersion = pkg.version;

  let version = args.version;
  if (!version && args.tag) {
    if (!args.tag.startsWith('v')) fail(`release tag must start with v: ${args.tag}`);
    version = args.tag.slice(1);
  }
  if (!version) version = packageVersion;
  if (version !== packageVersion) {
    fail(
      `requested version ${version} does not match package.json version ${packageVersion}`,
    );
  }
  if (args.tag && args.tag !== `v${version}`) {
    fail(`release tag ${args.tag} does not match version ${version}`);
  }

  let tarballPath = args.tarball ? path.resolve(args.tarball) : undefined;
  let temporaryDir;
  try {
    if (tarballPath) {
      if (!existsSync(tarballPath)) fail(`tarball not found: ${tarballPath}`);
      if (!tarballPath.endsWith('.tgz')) fail('--tarball must name a .tgz file');
    } else {
      await waitForRegistry(version, args.attempts, args.delayMs);
      temporaryDir = mkdtempSync(path.join(os.tmpdir(), 'xatlas-verify-published-'));
      tarballPath = downloadTarball(version, temporaryDir);
    }

    const manifest = readTarballManifest(tarballPath);
    if (manifest.name !== 'xatlas-wasm' || manifest.version !== version) {
      fail(
        `tarball manifest is ${manifest.name}@${manifest.version}, expected xatlas-wasm@${version}`,
      );
    }

    runPackageConsumer(tarballPath);
    console.log(`verify-published: xatlas-wasm@${version} verified from ${tarballPath}`);
  } finally {
    if (temporaryDir) {
      rmSync(temporaryDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
