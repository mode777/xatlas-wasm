#!/usr/bin/env node
/**
 * Validate a release tag against the package version, lockfile and changelog.
 *
 * Usage:
 *   node scripts/verify-release-tag.mjs v0.1.3
 *   node scripts/verify-release-tag.mjs v0.1.3 --root /path/to/fixture
 *
 * The git tag object type (annotated vs lightweight) and the GitHub release
 * existence are checked by the publish workflow, which has the git and GitHub
 * context. This script performs the deterministic file-based checks.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`release-tag: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let tag;
  let root = SCRIPT_ROOT;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      if (index + 1 >= argv.length) fail('--root requires a directory');
      root = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--root=')) {
      root = path.resolve(arg.slice('--root='.length));
    } else if (arg.startsWith('-')) {
      fail(`unknown option: ${arg}`);
    } else if (tag === undefined) {
      tag = arg;
    } else {
      fail(`unexpected argument: ${arg}`);
    }
  }
  if (!tag) {
    fail('usage: node scripts/verify-release-tag.mjs <tag> [--root <directory>]');
  }
  return { tag, root };
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    fail(`cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const { tag, root } = parseArgs(process.argv.slice(2));
const packageJsonPath = path.join(root, 'package.json');
const packageLockPath = path.join(root, 'package-lock.json');
const changelogPath = path.join(root, 'CHANGELOG.md');

const packageJson = readJson(packageJsonPath);
const packageLock = readJson(packageLockPath);
const changelog = readText(changelogPath);

const version = packageJson.version;
if (typeof version !== 'string' || version.length === 0) {
  fail(`${packageJsonPath} has no version`);
}

const expectedTag = `v${version}`;
if (tag !== expectedTag) {
  fail(
    `release tag "${tag}" does not match package.json version ${version} ` +
      `(expected "${expectedTag}")`,
  );
}

const lockVersions = new Set(
  [packageLock.version, packageLock.packages?.['']?.version].filter(
    (value) => typeof value === 'string' && value.length > 0,
  ),
);
if (lockVersions.size === 0) {
  fail(`${packageLockPath} has no package version`);
}
for (const lockVersion of lockVersions) {
  if (lockVersion !== version) {
    fail(
      `package-lock.json version ${lockVersion} does not match package.json ` +
        `version ${version}`,
    );
  }
}

if (!changelog.includes(`## [${version}]`)) {
  fail(`CHANGELOG.md has no section for version ${version} (expected "## [${version}]")`);
}

console.log(
  `release-tag: ${tag} matches package.json, package-lock.json and CHANGELOG.md`,
);
