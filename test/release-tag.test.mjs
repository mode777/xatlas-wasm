/**
 * Release-tag validation tests for xatlas-wasm.
 *
 * Run:
 *   node test/release-tag.test.mjs
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'verify-release-tag.mjs');

function makeFixture({ packageVersion = '0.1.3', lockVersion, changelogVersion = '0.1.3' } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'xatlas-release-tag-'));
  writeFileSync(
    path.join(dir, 'package.json'),
    `${JSON.stringify({ name: 'xatlas-wasm', version: packageVersion }, null, 2)}\n`,
  );
  const effectiveLockVersion = lockVersion ?? packageVersion;
  writeFileSync(
    path.join(dir, 'package-lock.json'),
    `${JSON.stringify(
      {
        name: 'xatlas-wasm',
        version: effectiveLockVersion,
        lockfileVersion: 3,
        packages: { '': { name: 'xatlas-wasm', version: effectiveLockVersion } },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    path.join(dir, 'CHANGELOG.md'),
    `# Changelog\n\n## [Unreleased]\n\n## [${changelogVersion}] - 2026-11-09\n`,
  );
  return dir;
}

function run(fixture, tag) {
  return spawnSync(process.execPath, [SCRIPT, tag, '--root', fixture], {
    encoding: 'utf8',
  });
}

const fixtures = [];
try {
  const matching = makeFixture();
  fixtures.push(matching);
  const matchingResult = run(matching, 'v0.1.3');
  assert.equal(matchingResult.status, 0, matchingResult.stderr);
  assert.match(matchingResult.stdout, /v0\.1\.3 matches package\.json/);

  const mismatch = makeFixture();
  fixtures.push(mismatch);
  const mismatchResult = run(mismatch, 'v0.2.0');
  assert.equal(mismatchResult.status, 1);
  assert.match(
    mismatchResult.stderr,
    /does not match package\.json version 0\.1\.3 \(expected "v0\.1\.3"\)/,
  );

  const missingPrefix = makeFixture();
  fixtures.push(missingPrefix);
  const missingPrefixResult = run(missingPrefix, '0.1.3');
  assert.equal(missingPrefixResult.status, 1);
  assert.match(missingPrefixResult.stderr, /does not match package\.json version 0\.1\.3/);

  const lockMismatch = makeFixture({ lockVersion: '0.1.2' });
  fixtures.push(lockMismatch);
  const lockMismatchResult = run(lockMismatch, 'v0.1.3');
  assert.equal(lockMismatchResult.status, 1);
  assert.match(
    lockMismatchResult.stderr,
    /package-lock\.json version 0\.1\.2 does not match package\.json version 0\.1\.3/,
  );

  const missingChangelog = makeFixture({ changelogVersion: '0.1.2' });
  fixtures.push(missingChangelog);
  const missingChangelogResult = run(missingChangelog, 'v0.1.3');
  assert.equal(missingChangelogResult.status, 1);
  assert.match(
    missingChangelogResult.stderr,
    /CHANGELOG\.md has no section for version 0\.1\.3/,
  );

  console.log('release-tag: all checks passed');
} finally {
  for (const dir of fixtures) {
    rmSync(dir, { recursive: true, force: true });
  }
}
