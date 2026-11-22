#!/usr/bin/env node
// MIT. Run the upstream, already-verified Desktop packaging chain to prepare
// the runtime payload the Tauri shell bundles.
//
// This script mirrors, command for command, the unsigned preparation stages of
// apps/desktop/scripts/package-target.ts without forking upstream logic:
//
//   1. `pnpm run build --profile local`                        (package-target.ts:476, unsigned build)
//   2. `pnpm exec tsx apps/desktop/scripts/pack-local-packages.ts --out <packedDsh>`
//      (package-target.ts:491) — packs @deepseek-ai/dsh AND the private
//      @ymzz/dsh-product tarball (pack-local-packages.ts:27-29). This is the
//      step that makes the plugin loadable in the packaged runtime.
//   3. `pnpm --dir apps/desktop-host pack --pack-destination <packedDsh>` (package-target.ts:493-499)
//   4. `pnpm run release:pack --family vendor --out <packedVendor>` (package-target.ts:500)
//   5. `pnpm --dir native/system run build:ts` (package-target.ts:502) then
//      `pnpm --dir native/system/packages/entry pack --pack-destination <packedLandlock>`
//      (package-target.ts:504-508), with the landlock destination cleared and
//      recreated first exactly like package-target.ts:503-504.
//   6. `pnpm --filter @deepseek-ai/dsh-desktop run prepare:runtime`  (package-target.ts:509 prepareRuntime)
//   7. `pnpm --filter @deepseek-ai/dsh-desktop run prepare:packages` (package-target.ts:511)
//   8. `pnpm --filter @deepseek-ai/dsh-desktop run prepare:dsh`      (package-target.ts:512)
//
// Paths come from the upstream constant module
// apps/desktop/scripts/desktop-build-paths.mjs (desktopTargetBuildPaths /
// desktopTargetPlatform) — nothing here is re-derived or hard-coded. All pack
// destinations are ABSOLUTE so `pnpm --dir <project> pack --pack-destination`
// cannot resolve them against the --dir project by accident (the CI ENOENT on
// targets/win-x64/packed/landlock came from relative-path resolution).
// After this, desktop/scripts/assemble-resources.mjs copies the results into
// desktop/resources/backend. Fail closed on any non-zero exit.

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {desktopTargetBuildPaths, desktopTargetPlatform} from '../../apps/desktop/scripts/desktop-build-paths.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const TARGET = process.argv[2] ?? (process.platform === 'win32' ? 'win-x64' : process.platform === 'darwin' ? (process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64') : undefined);
const SUPPORTED = new Set(['win-x64', 'mac-arm64', 'mac-x64']);
if (TARGET === undefined || !SUPPORTED.has(TARGET)) {
  console.error(`prepare-upstream-runtime: unsupported or missing target ${String(TARGET)}; pass one of win-x64|mac-arm64|mac-x64`);
  process.exit(1);
}
// Upstream path constants (apps/desktop/scripts/desktop-build-paths.mjs).
const buildPaths = desktopTargetBuildPaths(TARGET, process.env);
const target = desktopTargetPlatform(TARGET);

// Mirrors package-target.ts targetEnv (lines 436-440): the unsigned build and
// every prepare stage run with the target pinned explicitly, so a runner whose
// host platform differs from the payload still prepares the right one.
const childEnv = {
  ...process.env,
  DSH_DESKTOP_UNSIGNED: '1',
  DSH_DESKTOP_TARGET_PLATFORM: target.platform,
  DSH_DESKTOP_TARGET_ARCH: target.arch,
};

/** Run one pnpm invocation through corepack; inherit stdio; fail closed. */
function pnpm(args) {
  const command = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  console.log(`prepare-upstream-runtime: corepack pnpm ${args.join(' ')}`);
  execFileSync(command, ['pnpm', ...args], {stdio: 'inherit', cwd: ROOT, env: childEnv, shell: process.platform === 'win32'});
}

/**
 * The stages of package-target.ts's unsigned prepare flow, in order. `before`
 * callbacks run the upstream's destination hygiene (package-target.ts:503-504).
 */
const stages = [
  ['build', ['run', 'build', '--profile', 'local']],
  ['pack-local-packages', ['exec', 'tsx', 'apps/desktop/scripts/pack-local-packages.ts', '--out', buildPaths.packedDsh]],
  ['pack-desktop-host', ['--dir', 'apps/desktop-host', 'pack', '--pack-destination', buildPaths.packedDsh]],
  ['pack-vendor', ['run', 'release:pack', '--family', 'vendor', '--out', buildPaths.packedVendor]],
  ['build-landlock-tools', ['--dir', 'native/system', 'run', 'build:ts'], {
    // package-target.ts:503-504 — the landlock destination is cleared and
    // recreated before the entry tarball is packed into it.
    before() {
      fs.rmSync(buildPaths.packedLandlock, {recursive: true, force: true});
      fs.mkdirSync(buildPaths.packedLandlock, {recursive: true});
    },
  }],
  ['pack-landlock-entry', ['--dir', 'native/system/packages/entry', 'pack', '--pack-destination', buildPaths.packedLandlock]],
  ['prepare-runtime', ['--filter', '@deepseek-ai/dsh-desktop', 'run', 'prepare:runtime']],
  ['prepare-packages', ['--filter', '@deepseek-ai/dsh-desktop', 'run', 'prepare:packages']],
  ['prepare-dsh', ['--filter', '@deepseek-ai/dsh-desktop', 'run', 'prepare:dsh']],
];

for (const [name, args, options] of stages) {
  try {
    options?.before?.();
    pnpm(args);
  } catch (error) {
    console.error(`prepare-upstream-runtime: stage ${name} failed (exit ${error.status ?? '?'}); refusing to continue`);
    process.exit(1);
  }
}
console.log(`prepare-upstream-runtime: payload ready under ${buildPaths.root}`);
