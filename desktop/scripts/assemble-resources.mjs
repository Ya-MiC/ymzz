#!/usr/bin/env node
// MIT. Assemble desktop/src-tauri/resources-backend for Tauri bundling — PURE COPY.
// The folder lives INSIDE src-tauri so bundling only needs the documented
// list-glob form ("resources-backend/**", structure preserved relative to
// src-tauri); bare "../" directory entries proved unreliable on NSIS.
//
// The backend payload comes from the upstream, already-verified Desktop
// packaging chain (`apps/desktop`, see desktop/scripts/prepare-upstream-runtime.mjs),
// NOT from a hand-rolled download:
//
//   <targets>/<target>/runtime/primary-runtime/dependencies/node/  →  <backend>/dependencies/node/
//   <targets>/<target>/dsh/*                                       →  <backend>/*
//
// The produced layout matches the plugin contract at
// packages/ymzz/product/index.mjs:18-24: `DSH_PRIMARY_RUNTIME` is the runtime
// ROOT, and the plugin joins `dependencies/node/bin/node(.exe)` itself. The
// DSH runtime directory (node_modules + package.json) merges into the backend
// root, so `node_modules/@deepseek-ai/dsh/lib/bin.js` and
// `node_modules/@ymzz/dsh-product/` live there.
//
// `--from-nodejs-dist` is a NON-DEFAULT fallback branch for environments
// without the upstream prepare (e.g. a future Linux target): it downloads the
// pinned official Node archive, verifies it against the official
// SHASUMS256.txt, and unpacks it into `<backend>/dependencies/node`. In that
// mode the DSH runtime must be supplied with --dsh-dist; the ymzz plugin still
// has to be inside that tree's node_modules or the final assertion fails.
//
// Fail closed: every error aborts with a non-zero exit and a readable message.

import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

/** Pinned official Node.js release for the fallback branch only. */
const NODE_VERSION = '22.14.0';
const NODE_DIST_BASE = 'https://nodejs.org/dist';

/** Upstream Desktop build targets that can supply a payload. */
const UPSTREAM_TARGETS = new Set(['win-x64', 'mac-arm64', 'mac-x64']);
/** Marker files that prove a copied payload is complete and loadable. */
const REQUIRED_BACKEND_FILES = [
  'package.json',
  'node_modules/@deepseek-ai/dsh/package.json',
  'node_modules/@deepseek-ai/dsh/lib/bin.js',
  // The plugin beacon: without this file the shell's /ymzz/state probe would
  // report a missing plugin and refuse to navigate (see lib.rs probe_plugin).
  'node_modules/@ymzz/dsh-product/package.json',
];

/** Parse `--key value` arguments, rejecting anything unknown. */
function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`assemble-resources: unknown argument ${JSON.stringify(argument)}`);
    const key = argument.slice(2);
    const value = argv[index + 1];
    if (value !== undefined && !value.startsWith('--')) {
      values.set(key, value);
      index += 1;
    } else {
      values.set(key, 'true');
    }
  }
  return values;
}

/** Map the upstream Desktop target name to (platform, arch). */
export function targetPlatform(target) {
  const targets = {
    'win-x64': {platform: 'win32', arch: 'x64'},
    'mac-arm64': {platform: 'darwin', arch: 'arm64'},
    'mac-x64': {platform: 'darwin', arch: 'x64'},
  };
  if (!UPSTREAM_TARGETS.has(target)) throw new Error(`assemble-resources: unsupported upstream target ${target}`);
  return targets[target];
}

/** Map (platform, arch) to the official Node archive file name (fallback branch). */
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
        `Run desktop/scripts/prepare-upstream-runtime.mjs first (see desktop/resources/README.md).`,
    );
  }
  removeTree(destination);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.cpSync(source, destination, {recursive: true});
}

/**
 * Merge a source tree's children into an existing destination without clearing
 * it — the DSH runtime merges into the backend root next to the already-copied
 * `dependencies/node`, so a whole-destination reset would destroy that copy.
 */
export function mergeTree(source, destination, label) {
  if (!fs.existsSync(source)) {
    throw new Error(
      `assemble-resources: ${label} source ${source} does not exist. ` +
        `Run desktop/scripts/prepare-upstream-runtime.mjs first (see desktop/resources/README.md).`,
    );
  }
  fs.mkdirSync(destination, {recursive: true});
  for (const entry of fs.readdirSync(source, {withFileTypes: true})) {
    fs.cpSync(path.join(source, entry.name), path.join(destination, entry.name), {recursive: true});
  }
}

/** Assert every marker file exists in the assembled backend. */
export function assertBackendComplete(backend) {
  const missing = REQUIRED_BACKEND_FILES.filter((file) => !fs.existsSync(path.join(backend, ...file.split('/'))));
  if (missing.length > 0) {
    throw new Error(
      `assemble-resources: assembled backend is missing ${missing.join(', ')}. ` +
        `Without node_modules/@ymzz/dsh-product the plugin cannot mount and /ymzz/state will 404; ` +
        `check that pack-local-packages ran before prepare:packages/prepare:dsh.`,
    );
  }
}

async function main() {
  const values = parseArgs(process.argv.slice(2));
  const root = path.resolve(values.get('root') ?? path.join(import.meta.dirname, '..', '..'));
  const backend = path.join(root, 'desktop', 'src-tauri', 'resources-backend');
  // The temp dir must never sit inside the bundled payload: an interrupted CI
  // run would otherwise ship its leftovers to users.
  fs.mkdirSync(backend, {recursive: true});
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ymzz-assemble-temp '));

  if (values.get('from-nodejs-dist') === 'true') {
    // Fallback branch (default OFF): official Node download + SHA256 verify.
    const platform = values.get('platform') ?? process.platform;
    const arch = values.get('arch') ?? process.arch;
    const dshDist = values.get('dsh-dist') ? path.resolve(values.get('dsh-dist')) : null;
    if (!dshDist) throw new Error('assemble-resources: --from-nodejs-dist requires --dsh-dist for the DSH runtime');
    fs.mkdirSync(temp, {recursive: true});
    try {
      const archiveName = nodeArchiveName(platform, arch);
      const archivePath = path.join(temp, archiveName);
      console.log(`assemble-resources: downloading ${archiveName} (v${NODE_VERSION})`);
      const bytes = await downloadWithRetries(`${NODE_DIST_BASE}/v${NODE_VERSION}/${archiveName}`, archivePath);
      const shasumsResponse = await fetch(`${NODE_DIST_BASE}/v${NODE_VERSION}/SHASUMS256.txt`);
      if (!shasumsResponse.ok) throw new Error(`assemble-resources: SHASUMS256.txt fetch failed with HTTP ${shasumsResponse.status}`);
      verifySha256(bytes, archiveName, await shasumsResponse.text());
      const nodeDir = path.join(temp, 'node-extract');
      extract(archivePath, nodeDir);
      const entries = fs.readdirSync(nodeDir);
      if (entries.length !== 1) throw new Error(`assemble-resources: unexpected Node archive layout: ${entries.join(', ')}`);
      copyTree(path.join(nodeDir, entries[0]), path.join(backend, 'dependencies', 'node'), 'node runtime (fallback)');
      mergeTree(dshDist, backend, 'DSH runtime (fallback)');
    } finally {
      removeTree(temp);
    }
  } else {
    // Default branch: pure copy from the upstream Desktop packaging chain.
    const target = values.get('target') ?? (
      process.platform === 'win32' ? 'win-x64'
        : process.platform === 'darwin' ? (process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64')
          : null
    );
    if (!target) {
      throw new Error('assemble-resources: no upstream target for this host; pass --target <win-x64|mac-arm64|mac-x64> or use --from-nodejs-dist');
    }
    targetPlatform(target);
    const targetsRoot = path.join(root, 'apps', 'desktop', '.desktop-build', 'targets', target);
    // Upstream layout: apps/desktop/scripts/desktop-build-paths.mjs (desktopTargetBuildPaths)
    //   runtime: <targetsRoot>/runtime, dsh: <targetsRoot>/dsh
    const primaryRuntime = path.join(targetsRoot, 'runtime', 'primary-runtime');
    const preparedDsh = path.join(targetsRoot, 'dsh');
    const bundledNode = path.join(primaryRuntime, 'dependencies', 'node');
    if (!fs.existsSync(bundledNode)) {
      throw new Error(
        `assemble-resources: bundled node not found at ${bundledNode}. ` +
          `Run desktop/scripts/prepare-upstream-runtime.mjs (prepare:primary-runtime) first.`,
      );
    }
    if (!fs.existsSync(path.join(preparedDsh, 'node_modules'))) {
      throw new Error(
        `assemble-resources: prepared DSH runtime not found at ${preparedDsh}. ` +
          `Run desktop/scripts/prepare-upstream-runtime.mjs (pack → prepare:packages → prepare:dsh) first.`,
      );
    }
    // 1. Bundled Node under the exact hierarchy the plugin contract joins.
    copyTree(bundledNode, path.join(backend, 'dependencies', 'node'), 'bundled node');
    // 2. The self-contained DSH runtime (node_modules, package.json, patches)
    //    merges into the backend root — never a whole-backend reset, which
    //    would destroy the node copy above; the shell boots
    //    node_modules/@deepseek-ai/dsh/lib/bin.js from there with cwd=backend.
    mergeTree(preparedDsh, backend, 'prepared DSH runtime');
  }

  assertBackendComplete(backend);
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
