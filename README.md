# 湛箴_ymzz

<img src="ymzz/branding/generated/preview-512.png" width="88" alt="Owner-supplied 湛箴_ymzz product icon">

**The complete DeepSeek Harness application, with a small native ymzz plugin extension, our name/icon and four Wenrun themes. Not a rewritten agent runtime.**

> 深淵的清澈的水，纂刻于竹篾上的痕，珍重微小，有所依據，立傳傳世

[Official website](https://ya-mic.github.io/ymzz/) · [繁體中文](README.zh-Hant.md) · [Releases](https://github.com/Ya-MiC/ymzz/releases) · [Separate completed Loop product](https://ya-mic.github.io/ymzz-loop/)

## Content-bound acceptance harness

A focused plugin increment inspired by public harness evidence patterns: protected real test → human acceptance receipt → recheck content before explicit memory → metadata-only offline-verifiable capsule. Native DSH layout/approvals remain; no AGH runtime, paid model or automatic execution is added. [Implemented flow, security limits and reproducible tests](ymzz/docs/HARNESS.md). Windows installer release remains independently held by source/material closure.

## Install / first use — ordinary users

**There is currently no accepted public desktop installer to download.** The [Releases page](https://github.com/Ya-MiC/ymzz/releases) currently has `plugin-v0.1.0` (a plugin tarball, not a desktop installer) and `v0.1.0-alpha.1` (a source-only preview with no installer). There is no qualified Windows, macOS or Linux desktop package. Draft or unpublished canary `.exe` / `.dmg` files are not a public download. GitHub **Source code (zip)** and the commands below are developer paths, not a normal installation. Do not use a Loop/稟冊 installer for this Agent.

The ordinary-user delivery is a verified Windows x64 NSIS `.exe`, SHA256 checksums and matching third-party notices/source materials. It is **not available yet**; this README does not require ordinary users to install Git/Node/pnpm instead.

Once a qualified installer is actually released: install and open **湛箴_ymzz**, use native **Add API Key → Set up later** if no provider is configured, choose a nickname and a workspace, then configure a provider explicitly in native Settings/Models before expecting real model inference. Skipping setup does not create a working model; local Sheets/Google guidance are offline features, not a substitute for Office's conversion tools.

### Current qualification status

| Platform | Availability |
|---|---|
| Windows x64 | **Not released.** Baseline44709191875 installed tasks, all four painted themes, native Settings/Models, selected source-built Office, Sharp and embedded NumPy passed. That older build does not qualify the latest Sheets/harness changes; full final material/native gates remain. |
| macOS / Linux desktop | Planned; not guaranteed in v0.1. |
| From source | Full DSH eight-gate artifact build and authenticated HTTP200 passed on Linux; actual native-agent tool/task tests passed. |

[Measured baseline](ymzz/docs/evidence/m2-baseline.json) · [Real full-DSH task evidence](ymzz/docs/evidence/full-dsh-product-web.json) · [Windows release hold](ymzz/docs/WINDOWS-BLOCKERS.md)

No old Tauri/Loop installer is presented as this product. No live/paid/NIM inference has been performed. A deterministic fake model is explicitly labeled fake; its real DSH agent loop, tool approvals, file patches and failing→repair→passing Node tests are not mocks.

## Developers only: run from source

Use Node **24.22.1** (upstream minimum24.9), Git≥2.26 and Corepack-enabled **pnpm11.28.5**, exactly pinned upstream. This builds a developer source run, **not an installer**. From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build:artifacts
corepack pnpm exec node ymzz/scripts/dev.mjs --no-open --port 3081
```

Open the private launch link printed locally; never publish its authentication token. The launcher runs the official DSH CLI and isolates source-run data under `~/.ymzz` (`YMZZ_HOME` overrides it); no registry edits or alternate runtime. The original `pnpm dsh web` remains available and uses upstream `DSH_HOME` behavior.

## Native plugin map

One private workspace package, [`@ymzz/dsh-product`](packages/ymzz/product), is loaded by the **full** DSH web/desktop composition. Original DSH navigation, chat, workspace/file panels, model settings, tools and plugin system remain in their native positions.

| Extension | What actually exists |
|---|---|
| Brand / Wenrun | Original user SVG and generated icons; exact product title/EXE resource branding; native sidebar brand/footer slots and four registered themes: 雲箋淺、雲箋暗、陶土淺、陶土暗. Native PE ProductName/installation, all7 exact owner ICO resources and four-theme/settings baseline passed; new exact-build qualification is still separate. |
| Bounded task / gates | Official `ctx.agents`, `ctx.tools`, `ctx.approval`; explicit proposals, selected-workspace read/write/patch, fixed Node test command, failure feedback, human diff accept/rollback, persistent tasks and confirmed memory. Not an OS/network sandbox. |
| Local provider | Off-by-default loopback OpenAI-compatible adapter/settings; no API key handling or remote URLs. Protocol tests use labeled fake HTTP responses. A working real model is not claimed. General project picking uses the actual native DSH directory-picker service; Windows picker GUI remains unqualified. |
| Local Sheets / guidance | Univer1.5.2 open-source editable Sheets/JSON and209 pinned Google web guidance documents. Actual private tarball membership, hashes and isolated HTTP serving are checked; no new Windows GUI/formula result is claimed. [Scope/licenses](ymzz/docs/GOOGLE-UNIVER.zh-Hant.md). |
| Skills |9 integrity-pinned instruction skills registered with official `ctx.skills`; third-party licenses retained. Scripts/CLI installs/network permission are NOT granted by installing instructions. |
| Reviewed updates | Tested signature/hash/compatibility/license-checked local staging and staging rollback only. No live channel, installer/restart or maintainer signing key configured. |
| Tag-based knowledge | Local Obsidian Markdown notes from a DSH session or pasted text: normalised multi-tag drafts, explicit approval binding the rendered SHA256, no-overwrite atomic commit into `<Vault>/ymzz/`, reversible move to `$DSH_HOME/ymzz/knowledge-trash/`, case-insensitive retrieval and a tag-clustered multi-nebula graph. A collapsible 360px right-hand dock keeps native columns, navigation and chat input unchanged. MCP is status/probe/restart only via `ctx.mcpManager`; configuration stays in native Settings. No cloud sync, account, Office attachment transaction or installer is added. [Model and boundaries](docs/knowledge-tagging.md). Windows GUI behaviour for this increment is not yet qualified. |
| Desktop (Tauri shell) | Rust + Tauri 2 window/lifecycle shell (`desktop/`) that launches the bundled, unmodified DeepSeek Harness web service on a local port; CI (`desktop-v*` tags) produces **unreviewed canary installers** (Windows nsis, macOS dmg, Linux appimage) marked as prerelease. No review/acceptance claim, no updater, no signing key. [Local build](desktop/README.md). |

On Windows first-run, use native **Add API Key → Set up later** to enter without credentials; no model is thereby configured. First plugin opening asks for a nickname; without a consented real phone suffix the default is simply 用戶, never invented digits. User model setup remains explicit. Payment is owner-managed and outside this work.

## Separate products stay separate

**Loop is a completed, independent project-management product.** Its website is a visual reference only; no Loop runtime, Tauri app, data, installer or migration is imported into this Agent. Existing 稟冊 and other prior software/sites/downloads remain in their own repositories, unchanged.

[Loop](https://ya-mic.github.io/ymzz-loop/) · [Independent evaluation site](https://bingce.yanmingx0215.filegear-sg.me/#onboarding) · [Preserved previous repository](https://github.com/Ya-MiC/ymzz-zhanzhen) · [Historical read-only asset verification](ymzz/docs/LEGACY-PRODUCTS.md)

## Development / provenance

Only `master`. All34 inherited workflows stay disabled; only narrowly scoped ymzz workflows are enabled. No upstream file is deleted, no `@deepseek-ai/*` package is renamed, and no custom agent core replaces DSH. Added code is under `ymzz/` and `packages/ymzz/`; upstream changes are documented branding, necessary package registrations and the owner-approved two unsigned Windows policy conditionals (signed validation retained).

```sh
node --test packages/ymzz/product/tests/*.test.mjs
node ymzz/scripts/check-site.mjs
node ymzz/scripts/audit-production.mjs --enforce
```

The last command **fails closed until actual native payload/source compliance clears**, even when the exact owner-approved LGPL/MPL graph passes. The exact source-built NumPy replacement now passes in the actual installed CPython/pandas runtime without GNU runtime or a category waiver. Original upstream inputs remain preserved, not silently relicensed. [Approved scope and remaining compliance qualification](ymzz/docs/WINDOWS-BLOCKERS.md).

[Actual source/compliance materials](ymzz/compliance/REBUILD.md) · [Branding points](ymzz/docs/BRANDING-POINTS.md) · [Network/disable controls](ymzz/docs/NETWORK.md) · [Skills/provenance](ymzz/docs/SKILLS.md) · [Upstream sync](ymzz/docs/UPSTREAM-SYNC.md) · [Original README](ymzz/docs/upstream/README.md) · [All source links](ymzz/docs/RESOURCES.md)

Based on DeepSeek Harness (MIT). **Not an official DeepSeek product.** New ymzz product code is MIT; third-party code and the explicitly labeled MPL Office compatibility patch retain their actual licenses. [LICENSE](LICENSE) · [NOTICE](NOTICE.md) · [Upstream notices](THIRD_PARTY_NOTICES.md).

### Native Windows packaging (qualification, not publication)

```powershell
node ymzz/scripts/stage-notices.mjs
pnpm run package:desktop:win:x64:unsigned --check
pnpm run package:desktop:win:x64:unsigned
```

Use a Windows x64 build host and documented public `.env.windows` product settings. No mandatory-update endpoint is required for unsigned builds; signed HTTPS validation remains. Normal upstream NSIS install/uninstall/protocol registrations are not called “registry free”. [Latest completed full Windows baseline44709191875](https://github.com/Ya-MiC/ymzz/actions/runs/44709191875) built/installed and exercised the actual selected production app, but its strict source/material gate failed. It predates current Sheets/harness changes. There is deliberately no executable download; a successful Linux source/pack check is not a new Windows qualification.

### Current measured result / 目前實測

[Installed baseline44709191875](https://github.com/Ya-MiC/ymzz/actions/runs/44709191875), exact `d1a5da26c9c08919c5a12ea10732273ec85ea5bd`, passed Chinese-space NSIS installation, native GUI tasks/themes/settings/plugins, **selected production source-built Office0.1.3**, Sharp SVG/shared-library replacement mechanism and embedded GNU-free NumPy/pandas. Model transport was explicitly fake, provider unconfigured; the overall run **failed the source/material gate**.

Current source material work physically collected and rehashed all28 actual Windows libvips constituents +353 patched-lock Rust crates and98 exact Core external source archives, with85 preferred native Office files rechecked against the original manifest. [Reproducible checks and current limitations](ymzz/compliance/REBUILD.md). These are matching-source inventory proofs bound to the older installed baseline, **not a new application GUI result or global license/release clearance**. The strict gate now runs against the actual post-selector installed graph rather than repository Office0.2.3; its native/material completeness requirements remain unchanged.

<details>
<summary>Historical qualification records — superseded status text retained as evidence</summary>

### Latest actual installed GUI task evidence

[Exact-code Windows proof](ymzz/docs/evidence/windows-44035093932/README.md): **12 real GUI tool approvals, two actual failing→repair→passing Node test sequences, human acceptance,1 explicit memory and rollback passed** in the official NSIS-installed full DSH, with Chinese-space paths, real bundled Node and all7 actual PE owner-icon resources verified. Model transport is explicitly fake, not live inference. Native theme-selection/settings GUI and license/source qualification remain incomplete; overall CI is not green and there is no installer download or Release.

![Actual installed full DSH human diff review, not full release qualification](ymzz/docs/evidence/windows-44035093932/full-dsh-review.png)

### Current follow-up qualification

[Actual installed run44098435114](ymzz/docs/evidence/windows-44098435114/README.md) built/installed the official branded NSIS app in a Chinese-space path, passed real GUI tasks again, and **qualified the actual production MIT XSL resource hashes plus native RNG/XSD Schematron extraction/assertions**. Full GUI still failed before theme keyboard input because the test redundantly called Collapse on an already collapsed native select; no theme/settings pass is claimed.

[Follow-up44101906821](https://github.com/Ya-MiC/ymzz/actions/runs/44101906821), exact candidate `ff465dd39987ecf14e97e374bf531d622d45b889`, again passed real installed GUI tasks and MIT XSL checks but **failed native combo focus**; native Settings/plugin inventory were not reached. The next regression physically clicks the hit-tested real combo, accepts its genuinely focused popup option, and retains actual background plus four-palette accent pixel assertions. Owned Wenrun foreground consumption now uses readable paper text and warm-dark ink on dark-mode pastel buttons; all original palette tokens/native layout remain intact. A separate source-only LGPL relink check does not replace the Agent build. A private draft release is prepared **without an installer**; public installer downloads remain unavailable until qualification and remaining source/policy holds clear. [Precise source/compliance findings](ymzz/docs/LICENSE-FOLLOWUP.md). Loop is independent and untouched.

**Office/commercial:** real upstream DSH Office provider passed DOCX→PDF/PNG/ODT and actual XLSX formula recalculation on Linux/WASM0.2.3, without mocks or inference. Actual installed Windows/native0.2.3 passed the same four operations; this does not establish every format/font/fidelity. MPL permits commercial use with obligations; exact0.2.3 preferred-source completeness and the separate GCC-exception owner policy still block binary release. [Precise functional and commercial finding](ymzz/docs/OFFICE-COMMERCIAL.md).


### Latest measured milestone —2026-11-18 KST

[Installed44210430029](ymzz/docs/evidence/windows-44210430029/README.md) now passed **all four physical native theme background/accent assertions** and **real installed native Office0.2.3 PDF/PNG/ODT/formula operations with bundled Node**. Actual DSH GUI task acceptance/memory/rollback passes again. This is still NOT a Release: dark prose remains visibly low-contrast and native Settings validation stopped at an unsupported assumed menu Invoke pattern. Follow-up44214187521 correctly FAILED the stricter dark painted-ink assertion (0 authority-color pixels), before native settings; the host-boundary token consumption/installed-asset-byte fix is now pending genuine installed qualification. No theme/readability success is prefilled. [Commercial permission vs exact remaining source obligations](ymzz/docs/OFFICE-COMMERCIAL.md).


**Source alternatives, not a finished Release:** the preferred-source-built MPL Office0.1.3 + documented native-resolver backport passed real unchanged DSH provider operations twice on WASM; independent build entry bytes match. Native/full compatibility and source coverage remain separate pending checks. [NumPy source candidate44218703576](ymzz/docs/evidence/numpy-source-44218703576-passed.json) now passed explicit numerical acceptance and all selected upstream linalg/fft/random suites:1968 passed,15 skipped,2 expected failures. Original wheel notices and every PE imported-DLL audit pass without GNU runtime. This is not production integration, a complete application license clearance or a performance-equivalence claim; no production graph was substituted. [Current blocker/proof detail](ymzz/docs/WINDOWS-BLOCKERS.md).

</details>
