#!/usr/bin/env node
// MIT. Assemble desktop/resources/backend for Tauri bundling.
//
// Layout produced (relative to the repository root):
//   desktop/resources/backend/node/   official Node.js runtime (downloaded, SHA256-verified)
//   desktop/resources/backend/dsh/    DeepSeek Harness build artifacts (copied from a completed build)
//   desktop/resources/backend/plugins/ymzz-product/  ymzz plugin runtime files (copied)
//
// Nothing in the repository is a binary; this script is the only step that
// introduces one, and it runs in CI immediately before `tauri build`.
// Fail closed: every error aborts with a non-zero exit and a readable message.

import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

/** Pinned official Node.js release. Change deliberately, never silently. */
const NODE_VERSION = '22.14.0';
const NODE_DIST_BASE = 'https://nodejs.org/dist';

const KNOWN_PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const KNOWN_ARCHS = new Set(['x64', 'arm64']);

/** Parse `--key value` arguments, rejecting anything unknown. */
function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`assemble-resources: unknown argument ${JSON.stringify(argument)}`);
    const key = argument.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`assemble-resources: --${key} needs a value`);
    values.set(key, value);
    index += 1;
  }
  return values;
}

/** Map (platform, arch) to the official Node archive file name. */
export function nodeArchiveName(platform, arch) {
  const platformPrefix = platform === 'win32' ? 'win' : platform;
  const extension = platform === 'win32' ? 'zip' : 'tar.gz';
  return `node-v${NODE_VERSION}-${platformPrefix}-${arch}.${extension}`;
}

/** Download with bounded retries; still fail closed when all attempts fail. */
async function downloadWithRetries(url, destination, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await download(url, destination);
    } catch (error) {
      lastError = error;
      console.warn(`assemble-resources: attempt ${attempt}/${attempts} failed: ${error.message ?? error}`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw lastError;
}

async function download(url, destination) {
  const response = await fetch(url, {redirect: 'follow'});
  if (!response.ok) throw new Error(`assemble-resources: downloading ${url} failed with HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, bytes);
  return bytes;
}

/** Verify a downloaded file against the official SHASUMS256.txt. */
export function verifySha256(bytes, fileName, shasums) {
  const line = shasums.split('\n').find((entry) => entry.trimEnd().endsWith(`  ${fileName}`));
  if (!line) throw new Error(`assemble-resources: ${fileName} is absent from the official SHASUMS256.txt; refusing to continue`);
  const expected = line.trim().split(/\s+/u)[0].toLowerCase();
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) throw new Error(`assemble-resources: SHA256 mismatch for ${fileName}: expected ${expected}, got ${actual}`);
}

/**
 * Extract an archive with the system `tar` binary (bsdtar reads zip on Windows).
 * Both paths are handed to tar relative to the archive's parent so drive-letter
 * colons (`E:/…`) can never be misread as a remote host by GNU tar.
 */
export function extract(archivePath, destination) {
  fs.mkdirSync(destination, {recursive: true});
  const parent = path.dirname(archivePath);
  execFileSync(
    'tar',
    ['-xf', path.basename(archivePath), '-C', path.relative(parent, destination) || '.'],
    {stdio: 'inherit', cwd: parent},
  );
}

/** Remove a directory tree if it exists. */
function removeTree(directory) {
  fs.rmSync(directory, {recursive: true, force: true});
}

/** Copy a source tree into place, refusing silently stale or missing sources. */
export function copyTree(source, destination, label) {
  if (!fs.existsSync(source)) {
    throw new Error(
      `assemble-resources: ${label} source ${source} does not exist. ` +
        `Run the repository build first (see desktop/resources/README.md) or pass the matching --* flag.`,
    );
  }
  removeTree(destination);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.cpSync(source, destination, {recursive: true});
}

async function main() {
  const values = parseArgs(process.argv.slice(2));
  const platform = values.get('platform') ?? process.platform;
  const arch = values.get('arch') ?? process.arch;
  const root = path.resolve(values.get('root') ?? path.join(import.meta.dirname, '..', '..'));
  const dshDist = values.get('dsh-dist') ? path.resolve(values.get('dsh-dist')) : path.join(root, 'dist');
  const pluginDist = values.get('plugin-dist')
    ? path.resolve(values.get('plugin-dist'))
    : path.join(root, 'packages', 'ymzz', 'product');
  const backend = path.join(root, 'desktop', 'resources', 'backend');
  const temp = path.join(backend, '.assemble-temp');

  if (!KNOWN_PLATFORMS.has(platform)) throw new Error(`assemble-resources: unsupported platform ${platform}`);
  if (!KNOWN_ARCHS.has(arch)) throw new Error(`assemble-resources: unsupported arch ${arch}`);
  if (platform === 'darwin' && arch !== 'arm64' && arch !== 'x64') throw new Error(`assemble-resources: darwin arch must be x64 or arm64, got ${arch}`);

  fs.mkdirSync(temp, {recursive: true});
  try {
    // 1. Official Node runtime, verified byte-for-byte against SHASUMS256.txt.
    const archiveName = nodeArchiveName(platform, arch);
    const archivePath = path.join(temp, archiveName);
    console.log(`assemble-resources: downloading ${archiveName} (v${NODE_VERSION})`);
    const bytes = await downloadWithRetries(`${NODE_DIST_BASE}/v${NODE_VERSION}/${archiveName}`, archivePath);
    const shasumsResponse = await fetch(`${NODE_DIST_BASE}/v${NODE_VERSION}/SHASUMS256.txt`);
    if (!shasumsResponse.ok) throw new Error(`assemble-resources: SHASUMS256.txt fetch failed with HTTP ${shasumsResponse.status}`);
    const shasums = await shasumsResponse.text();
    verifySha256(bytes, archiveName, shasums);
    const nodeDir = path.join(temp, 'node-extract');
    extract(archivePath, nodeDir);
    const entries = fs.readdirSync(nodeDir);
    if (entries.length !== 1) throw new Error(`assemble-resources: unexpected Node archive layout: ${entries.join(', ')}`);
    copyTree(path.join(nodeDir, entries[0]), path.join(backend, 'node'), 'node runtime');

    // 2. DeepSeek Harness build artifacts (from `pnpm build:artifacts`).
    copyTree(dshDist, path.join(backend, 'dsh'), 'DSH artifacts');

    // 3. ymzz plugin runtime files.
    copyTree(pluginDist, path.join(backend, 'plugins', 'ymzz-product'), 'ymzz plugin');
  } finally {
    removeTree(temp);
  }

  console.log(`assemble-resources: backend assembled at ${backend}`);
  for (const entry of fs.readdirSync(backend)) console.log(`  - ${entry}`);
}

// Only execute when run directly, so importing the helpers never starts a download.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
