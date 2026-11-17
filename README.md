# 湛箴_ymzz

<img src="ymzz/branding/generated/preview-512.png" width="88" alt="Owner-supplied 湛箴_ymzz product icon">

**The complete DeepSeek Harness application, with a small native ymzz plugin extension, our name/icon and four Wenrun themes. Not a rewritten agent runtime.**

> 深淵的清澈的水，纂刻于竹篾上的痕，珍重微小，有所依據，立傳傳世

[Official website](https://ya-mic.github.io/ymzz/) · [繁體中文](README.zh-Hant.md) · [Releases](https://github.com/Ya-MiC/ymzz/releases) · [Separate completed Loop product](https://ya-mic.github.io/ymzz-loop/)

## Download / current status

| Platform | Availability |
|---|---|
| Windows x64 | **Not released.** v0.1.0 發佈後填 Release 連結. Native packaging, GUI and license gates must pass first. |
| macOS / Linux desktop | Planned; not guaranteed in v0.1. |
| From source | Full DSH eight-gate artifact build and authenticated HTTP200 passed on Linux; actual native-agent tool/task tests passed. |

[Measured baseline](ymzz/docs/evidence/m2-baseline.json) · [Real full-DSH task evidence](ymzz/docs/evidence/full-dsh-product-web.json) · [Windows release hold](ymzz/docs/WINDOWS-BLOCKERS.md)

No old Tauri/Loop installer is presented as this product. No live/paid/NIM inference has been performed. A deterministic fake model is explicitly labeled fake; its real DSH agent loop, tool approvals, file patches and failing→repair→passing Node tests are not mocks.

## Three-step source setup

Node≥24.9, Git≥2.26 and Corepack-enabled **pnpm11.28.5**, exactly pinned upstream. From the repository root:

```sh
pnpm install
pnpm run build:artifacts
pnpm exec node ymzz/scripts/dev.mjs --no-open --port 3081
```

Open the private launch link printed locally; never publish its authentication token. The launcher runs the official DSH CLI and isolates source-run data under `~/.ymzz` (`YMZZ_HOME` overrides it); no registry edits or alternate runtime. The original `pnpm dsh web` remains available and uses upstream `DSH_HOME` behavior.

## Native plugin map

One private workspace package, [`@ymzz/dsh-product`](packages/ymzz/product), is loaded by the **full** DSH web/desktop composition. Original DSH navigation, chat, workspace/file panels, model settings, tools and plugin system remain in their native positions.

| Extension | What actually exists |
|---|---|
| Brand / Wenrun | Original user SVG and generated icons; exact product title/EXE resource branding; native sidebar brand/footer slots and four registered themes: 雲箋淺、雲箋暗、陶土淺、陶土暗. Windows rendering/PE identity still needs GUI qualification. |
| Bounded task / gates | Official `ctx.agents`, `ctx.tools`, `ctx.approval`; explicit proposals, selected-workspace read/write/patch, fixed Node test command, failure feedback, human diff accept/rollback, persistent tasks and confirmed memory. Not an OS/network sandbox. |
| Local provider | Off-by-default loopback OpenAI-compatible adapter/settings; no API key handling or remote URLs. Protocol tests use labeled fake HTTP responses. A working real model is not claimed. General project picking uses the actual native DSH directory-picker service; Windows picker GUI remains unqualified. |
| Skills |9 integrity-pinned instruction skills registered with official `ctx.skills`; third-party licenses retained. Scripts/CLI installs/network permission are NOT granted by installing instructions. |
| Reviewed updates | Tested signature/hash/compatibility/license-checked local staging and staging rollback only. No live channel, installer/restart or maintainer signing key configured. |

First plugin opening asks for a nickname; without a consented real phone suffix the default is simply 用戶, never invented digits. User model setup remains explicit. Payment is owner-managed and outside this work.

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

The last command currently **fails closed for distribution policy**; LGPL/MPL native dependencies are not falsely relabeled MIT or confused with GPL/AGPL. [Approved scope and remaining compliance qualification](ymzz/docs/WINDOWS-BLOCKERS.md).

[Branding points](ymzz/docs/BRANDING-POINTS.md) · [Network/disable controls](ymzz/docs/NETWORK.md) · [Skills/provenance](ymzz/docs/SKILLS.md) · [Upstream sync](ymzz/docs/UPSTREAM-SYNC.md) · [Original README](ymzz/docs/upstream/README.md) · [All source links](ymzz/docs/RESOURCES.md)

Based on DeepSeek Harness (MIT). **Not an official DeepSeek product.** Added code is MIT; actual third-party licenses remain applicable. [LICENSE](LICENSE) · [NOTICE](NOTICE.md) · [Upstream notices](THIRD_PARTY_NOTICES.md).
