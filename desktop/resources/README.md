# desktop/resources/ — CI-assembled backend payload

This directory is what the Tauri bundle packs into the installed application's
resource directory. **The repository never commits binaries here.** The only
committed contents are this README, the tiny start page in `shell/` that the
desktop window shows while the local service boots, and the 0-byte
`backend/.keep` placeholder that keeps the bundle's resource path valid before
assembly.

## Where the payload comes from

The upstream, already-verified Desktop packaging chain — **not** a hand-rolled
download:

1. `desktop/scripts/prepare-upstream-runtime.mjs` mirrors the unsigned
   preparation stages of `apps/desktop/scripts/package-target.ts` (build →
   `pack-local-packages` → host/vendor/landlock packs → `prepare:runtime` →
   `prepare:packages` → `prepare:dsh`), producing
   `apps/desktop/.desktop-build/targets/<target>/` (path constants:
   `apps/desktop/scripts/desktop-build-paths.mjs`, `desktopTargetBuildPaths`).
2. `desktop/scripts/assemble-resources.mjs` is a **pure copy** step:
   | Source (upstream targets) | Destination (backend) |
   |---|---|
   | `targets/<target>/runtime/primary-runtime/dependencies/node/` | `backend/dependencies/node/` (keeps the `bin/` hierarchy) |
   | `targets/<target>/dsh/*` (self-contained runtime: `node_modules`, `package.json`) | `backend/*` |

## Layout produced

| Path | Content |
|---|---|
| `backend/dependencies/node/bin/node(.exe)` | Bundled Node runtime, at exactly the hierarchy the plugin contract joins (`packages/ymzz/product/index.mjs:18-24`: `DSH_PRIMARY_RUNTIME` is the runtime ROOT). |
| `backend/node_modules/@deepseek-ai/dsh/…` | The DeepSeek Harness CLI the shell boots (`lib/bin.js web …`). |
| `backend/node_modules/@ymzz/dsh-product/…` | The ymzz plugin, mounted by the web-app bundle layer. **`assemble-resources.mjs` hard-fails if it is missing.** |
| `backend/package.json` | Runtime descriptor written by upstream `prepare:dsh`. |

The desktop shell sets `PORT`, `DSH_PRIMARY_RUNTIME=<backend root>`,
`DSH_TELEMETRY_DISABLED=1`, and runs
`node <backend>/dependencies/node/bin/node(.exe)
node_modules/@deepseek-ai/dsh/lib/bin.js web --no-open --host 127.0.0.1 --port <port>`
with `cwd=<backend>`.

**How the plugin loads** (verified mechanism, not an assumption): the `web`
profile's bundle stack is `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`
(`packages/util/official-bundles/src/bundles.ts:14-16`); the web-app layer
inserts `@ymzz/dsh-product` (`packages/bundle/web-app/cordis.patch.yml:638`),
which resolves from the runtime's own `node_modules`
(`apps/cli/package.json:96` → `packages/bundle/web-app/package.json:61`
`workspace:*` → packed into `targets/<target>/dsh/node_modules` by
`apps/desktop/scripts/pack-local-packages.ts:27-29`, wired at
`apps/desktop/scripts/package-target.ts:491`).

## Who runs these scripts

- **CI** (`.github/workflows/ymzz-desktop.yml`): per platform, immediately
  before `tauri build`.
- **Local rebuilds**: run the two scripts in the same order after `pnpm
  install --frozen-lockfile`. A missing upstream payload is a hard error —
  the assembler never fabricates content.

## Fallback branch (default OFF)

`--from-nodejs-dist` downloads the pinned official Node archive
(`nodejs.org/dist`, SHA256-verified against the official `SHASUMS256.txt`)
into `backend/dependencies/node` for environments without the upstream
prepare (e.g. a future Linux target); it requires `--dsh-dist` for the DSH
runtime and still asserts the plugin tarball is inside it.

## Not committed, on purpose

Node runtime binaries, DSH build outputs, and the upstream
`.desktop-build/` working tree are downloaded/built per run;
`backend/.assemble-temp/` (fallback-branch scratch) is removed on every exit.
