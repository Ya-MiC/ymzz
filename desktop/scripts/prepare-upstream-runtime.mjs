#!/usr/bin/env node
// MIT. Run the upstream, already-verified Desktop packaging chain to prepare
// the runtime payload the Tauri shell bundles.
//
// This script mirrors, one command at a time, the unsigned preparation stages
// of apps/desktop/scripts/package-target.ts (see the stage list around lines
// 476-509) without forking upstream logic:
//
//   1. `pnpm run build --profile local`                       (package-target.ts:476, unsigned build)
//   2. `pnpm exec tsx apps/desktop/scripts/pack-local-packages.ts --out <target>/packed/dsh`
//      (package-target.ts:491) — packs @deepseek-ai/dsh AND the private
//      @ymzz/dsh-product tarball (pack-local-packages.ts:27-29). This is the
//      step that makes the plugin loadable in the packaged runtime.
//   3. `pnpm --dir apps/desktop-host pack --pack-destination <target>/packed/dsh`
//   4. `pnpm run release:pack --family vendor --out <target>/packed/vendor`
//   5. landlock pack (native/system build + entry tarball)
//   6. `pnpm --filter @deepseek-ai/dsh-desktop run prepare:runtime`  (Electron + primary runtime)
//   7. `pnpm --filter @deepseek-ai/dsh-desktop run prepare:packages` (closure incl. @ymzz/dsh-product)
//   8. `pnpm --filter @deepseek-ai/dsh-desktop run prepare:dsh`      (targets/<target>/dsh + runtime/primary-runtime)
//
// After this, desktop/scripts/assemble-resources.mjs copies the results into
// desktop/resources/backend. Fail closed on any non-zero exit.

import {execFileSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const TARGET = process.argv[2] ?? (process.platform === 'win32' ? 'win-x64' : process.platform === 'darwin' ? (process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64') : undefined);
if (TARGET === undefined || !['win-x64', 'mac-arm64', 'mac-x64'].includes(TARGET)) {
  console.error(`prepare-upstream-runtime: unsupported or missing target ${String(TARGET)}; pass one of win-x64|mac-arm64|mac-x64`);
  process.exit(1);
}
const TARGETS = path.join('apps', 'desktop', '.desktop-build', 'targets', TARGET);
const packed = (name) => path.join(TARGETS, 'packed', name);

/** Run one pnpm invocation through corepack; inherit stdio; fail closed. */
function pnpm(args, options = {}) {
  const command = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  console.log(`prepare-upstream-runtime: corepack pnpm ${args.join(' ')}`);
  execFileSync(command, ['pnpm', ...args], {stdio: 'inherit', cwd: options.cwd ?? ROOT, shell: process.platform === 'win32'});
}

const stages = [
  ['build', ['run', 'build', '--profile', 'local']],
  ['pack-local-packages', ['exec', 'tsx', 'apps/desktop/scripts/pack-local-packages.ts', '--out', packed('dsh')]],
  ['pack-desktop-host', ['--dir', 'apps/desktop-host', 'pack', '--pack-destination', packed('dsh')]],
  ['pack-vendor', ['run', 'release:pack', '--family', 'vendor', '--out', packed('vendor')]],
  ['build-landlock-tools', ['--dir', 'native/system', 'run', 'build:ts']],
  ['pack-landlock-entry', ['--dir', 'native/system/packages/entry', 'pack', '--pack-destination', packed('landlock')]],
  ['prepare-runtime', ['--filter', '@deepseek-ai/dsh-desktop', 'run', 'prepare:runtime']],
  ['prepare-packages', ['--filter', '@deepseek-ai/dsh-desktop', 'run', 'prepare:packages']],
  ['prepare-dsh', ['--filter', '@deepseek-ai/dsh-desktop', 'run', 'prepare:dsh']],
];

for (const [name, args] of stages) {
  try {
    pnpm(args);
  } catch (error) {
    console.error(`prepare-upstream-runtime: stage ${name} failed (exit ${error.status ?? '?'}); refusing to continue`);
    process.exit(1);
  }
}
console.log(`prepare-upstream-runtime: payload ready under apps/desktop/.desktop-build/targets/${TARGET}`);
