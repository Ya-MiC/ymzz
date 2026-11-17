# 湛箴_ymzz

<img src="ymzz/branding/generated/preview-512.png" width="88" alt="湛箴_ymzz 使用者提供的產品圖標">

**A local-first agent distribution of the complete DeepSeek Harness, extended through real plugins—not a rewritten runtime.**

> 深淵的清澈的水，纂刻于竹篾上的痕，珍重微小，有所依據，立傳傳世

[繁體中文](README.zh-Hant.md) · [Releases](https://github.com/Ya-MiC/ymzz/releases) · [Roadmap](ROADMAP.md) · [Preserved 稟冊](https://ya-mic.github.io/ymzz-loop/)

**Completed milestone: M1 repository foundation. No 湛箴_ymzz Windows installer has been qualified or published in this fork.** Original DSH chat, tools, agent runtime and plugin system remain upstream code. The owner-supplied product icon is applied to documented desktop, tray, installer-source and web favicon resources; product name, themes and plugins are not yet applied, and no packaged Windows installer has been rebuilt or verified. The next baseline gate is M2. Do not mistake old Tauri/稟冊 binaries or old-repository fake-transport demonstrations for this product.

## Downloads

| Platform | Status |
|---|---|
| Windows x64 | v0.1.0 發佈後填 Release 連結 — not released or verified yet |
| macOS | 計劃中 / Planned; not guaranteed in v0.1 |
| Linux | 計劃中 / Planned; upstream does not target Linux desktop releases |
| From source (any system) | Commands below; this fork's M2 build/run gate is pending |

## Run from source

Prerequisites: Node ≥24.9 (24.22.1 available on the development box), Git ≥2.26 and Corepack-enabled **pnpm 11.28.5**, pinned by the unchanged upstream `package.json`. Commands run at the repository root:

```sh
pnpm install
pnpm run build:artifacts
pnpm dsh web --no-open --port 3081
```

These are verified upstream entrypoints, **not a claim that M2 has passed in this checkout**. DSH's default data directory is `~/.dsh`; use `DSH_HOME` to choose a product-owned development profile. No model credentials are bundled and no live model inference was performed. Do not enter secrets in issue reports or logs.

## Preinstalled ymzz plugins

**None yet.** M4 must register a minimal real plugin before it appears here. Native DSH layout/component positions and the Wenrun palette are to be retained. The icon is the owner's actual image; no DeepSeek logo is presented as our product logo.

## Existing products are preserved

**稟冊 is a separate Tauri personal-work-report/file-management product**, with nickname onboarding, local conversations/files and review progress. Its repository, sites and drafts remain untouched. It is not renamed into this agent or represented as integrated merely because a link exists.

- [稟冊 / Loop website](https://ya-mic.github.io/ymzz-loop/) · [稟冊 onboarding](https://bingce.yanmingx0215.filegear-sg.me/#onboarding)
- [稟冊 source and draft releases](https://github.com/Ya-MiC/ymzz-loop/releases) — draft visibility requires the appropriate GitHub account.
- [Previous integration repository](https://github.com/Ya-MiC/ymzz-zhanzhen) stays intact; its old PR/builds are historical, not this fork's release.
- [Verified legacy status and limitations](ymzz/docs/LEGACY-PRODUCTS.md) · [All retained resource links](ymzz/docs/RESOURCES.md)

## Maintainer / development

Only `master` is our mainline; all 34 inherited workflows are disabled manually without deleting their files ([actual M1 checks](ymzz/docs/evidence/m1-remote.json)). Preserve upstream files/packages and names (`@deepseek-ai/*`); additions live in `ymzz/` and `packages/ymzz/`. The original root README is retained [byte-for-byte](ymzz/docs/upstream/README.md).

[Upstream sync](ymzz/docs/UPSTREAM-SYNC.md) · [Branding points](ymzz/docs/BRANDING-POINTS.md) · [Network inventory](ymzz/docs/NETWORK.md) · [Skills](ymzz/docs/SKILLS.md) · [Release gates](ymzz/docs/RELEASING.md)

No telemetry is added. Maintainer-reviewed updates and an Agent official site are planned; neither is claimed live. Payment configuration remains owner-managed. Dependencies and native payloads retain their actual licenses; the upstream MIT license is not a claim that every third-party binary is MIT.

Based on DeepSeek Harness (MIT). **Not an official DeepSeek product.** See [LICENSE](LICENSE), [NOTICE.md](NOTICE.md) and unchanged [upstream third-party notices](THIRD_PARTY_NOTICES.md).
