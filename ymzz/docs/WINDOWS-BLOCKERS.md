# Windows release hold — exact blockers, not a replacement runtime

The full DSH application and native product plugin build and run locally. This does not qualify a Windows installer. No old Tauri/Loop executable is substituted, and no public installer is published.

## Owner-approved exceptions (2026-11-17 15:04 KST)

The owner explicitly approved the two narrow unsigned-policy conditionals below and actual LGPL/MPL redistribution with full compliance materials. This is not approval to relabel dependencies MIT, permit GPL/AGPL/Commons Clause, or publish an unqualified executable. Implementation and lawful redistribution qualification are separate.

## 1. Official unsigned Windows policy requirement

The real command `pnpm run package:desktop:win:x64:unsigned --check` on this Linux box rejects with `win-x64 requires a Windows x64 build host`. Actual Windows run44024932861 independently reproduced the same required-policy error on native Windows x64; see evidence/windows-first-qualification.json. Do not call the Linux run a Windows build.

The official `validateDesktopPackageEnvironment` API, invoked with the actual Windows target and the public product ID, also requires `DSH_DESKTOP_MANDATORY_UPDATE_PROD_ORIGIN`. The packager does NOT apply its no-policy unsigned-macOS behavior to unsigned Windows. The source has no supported Windows offline/manual-only switch:
- `apps/desktop/scripts/desktop-package-environment.mjs:124` unconditionally resolves policy for Windows.
- `apps/desktop/scripts/electron-builder-config.mjs:69` omits policy only for unsigned macOS.
- `apps/desktop/src/mandatory-update-policy.ts` disables queries only when policy configuration is absent; configured policy polls automatically.

No endpoint is invented and no upstream protection/configuration check was bypassed. Under v2's allowlist these are not merely display-branding/package-registration changes, the owner has now approved and we applied exactly these two narrowly scoped conditionals:
1. Change `if (target.platform !== 'darwin' || !options.unsigned) resolveDesktopPolicyEnvironment(environment)` to `if (!options.unsigned) resolveDesktopPolicyEnvironment(environment)`.
2. Change `const policy = packagesMacOS && unsigned ? undefined : resolveDesktopPolicyEnvironment(env)` to `const policy = unsigned ? undefined : resolveDesktopPolicyEnvironment(env)`.

This extends the existing unsigned-macOS policy to unsigned Windows, not disable signed-release validation. Nine regression tests now pass against the actual builder/validator/native resolver, plus all25 existing policy-environment tests: unsigned Windows omits policy metadata, and the unchanged native main only constructs/polls policy when metadata exists; signed builds still reject absent/non-HTTPS/credential/path/query origins. No live service is invented. Standard installer/OS/protocol writes still need honest assessment; no claim of a registry-free installer is made.

## 2. Actual native dependencies versus strict permissive-only policy

The actual installed production graph is audited, rather than the MIT wrapper alone. Actual native Windows run44024932861 audited666 production packages with no unresolved dependencies: Sharp is Apache-2.0 AND LGPL-3.0-or-later, and LibreOffice API/WASM/Windows engine are MPL-2.0. The unchanged strict gate failed closed. On Linux the666-package graph contains LGPL-3.0-or-later libvips and MPL-2.0 LibreOffice API/WASM; no unresolved dependencies. Exact Windows public metadata is `@img/sharp-win32-x64@0.35.5: Apache-2.0 AND LGPL-3.0-or-later`; LibreOffice0.2.3 is MPL-2.0. Prior exact upstream-version Windows payload research also found Electron FFmpeg LGPL-2.1+; the new Windows payload has not been built/audited yet.

LGPL and MPL are NOT automatically GPL/AGPL, and these findings do not mean the MIT application must be relicensed GPL. They nevertheless do not pass the previously required permissive-only gate. Actual redistribution obligations/notices/corresponding source need review; no policy exception is silently assumed.

Investigated options:
- Removing Sharp's active optional platform binary breaks the first real raster operation. Sharp is used for image metadata, normalization, resize/encoding and provider request images; no feature-preserving exclusion is claimed.
- A permissive image adapter could be separately ported/qualified, but would require replacing the active attachment backend/import and would not resolve Office/FFmpeg.
- Electron's official codec-reduced FFmpeg DLL changes codec flags, not the LGPL license. FFmpeg's own legal page says it is not available under other licensing terms. Dropping it or Office would silently remove functionality and is not done.

Approval received for actual LGPL/MPL components only. Full matching native archives/notices/build recipes and corresponding-source materials are being assembled and verified; this is not a license-list-only waiver. The strict gate remains failing until the scoped approved policy and actual payload/source evidence qualify. No binary release is cleared. See `evidence/native-license-research.json` and `evidence/production-license-*.json`.

## 3. Reviewed updates

The plugin has tested Ed25519 signed-manifest compatibility/hash/license-gated staging and staging rollback only. Production maintainer public key/channel is absent. No private signing key, signature, live update feed, install/restart success or automatic remote code execution is invented.

## Actual installer behavior

The official NSIS installer makes normal per-user installation/uninstall registrations and shortcuts. The preserved upstream app also calls `setAsDefaultProtocolClient('dsh')` on packaged startup. We add no registry-edit script, but do **not** claim registry-free installation or startup. Qualification installs only into an ephemeral CI Windows runner, never the owner's computer. `windows-gui-smoke.ps1` targets the real branded NSIS payload rather than the upstream synthetic installer fixture.

##4. New actual Windows scientific-runtime category and measured package progress

Run44029913700 (commit3cdde61ad9bfb80abfe1d14136bf1cfc4a7064bf) successfully built the **real official unsigned Electron/NSIS installer**, passed the upstream prepared/packaged runtime smoke, installed in a Chinese-space path, passed exact PE ProductName and separately bundled Node checks. This is not an old Tauri executable. Full source HTTP task approval/repair/accept/memory/rollback also passed on Windows. Native GUI qualification stopped at the preserved first-run Welcome screen because the test had not navigated Add API Key → Set up later; the test is fixed to use those genuine UI buttons, without entering any key or bypassing authentication. Native task GUI is not claimed passed yet.

A deeper locked native-wheel audit found NumPy2.3.5's bundled OpenBLAS DLL declares `GPL-3.0-or-later WITH GCC-exception-3.1`. This is **not plain GPL**, and the exception permits eligible non-GPL/proprietary combinations; it does not turn the application GPL. It is still outside the owner-approved LGPL/MPL exceptions and remains blocked, not silently whitelisted. See [exact native evidence](evidence/windows-numpy-license.json), original [license](../compliance/notices/numpy-2.3.5-WINDOWS-LICENSE.txt) and [actual source/compliance preparation](../compliance/REBUILD.md).

21 corresponding-material archives have actually been downloaded/hash-verified. No claim of complete distribution clearance is made: matching API0.2.3 preferred-source verification is still incomplete, unlike its supplied native C++ sources. No release/draft release/download is created before these gates clear.


### Follow-up exact installer evidence (2026-11-17 15:50 KST)

Run [44032750165](https://github.com/Ya-MiC/ymzz/actions/runs/44032750165), code `360850867a3f93a6f2703444337a51f807732992`: official Electron/NSIS built and installed in a Chinese-space path; actual bundled Node v24.21.0 executed; all seven owner ICO frames verified byte-for-byte in actual PE resources. Native offline Welcome skip, nickname and exact About passed. Installed GUI task exposed a stale same-name approval click race; fixed with proposal-ID consumption, synchronous disabled decisions and regressions, awaiting follow-up qualification. The old keyboard-only theme attempt stayed light and is NOT dark-theme proof; follow-up uses actual UIA option selection/assertion. No full installed task success or released binary is claimed. Exact installer/EXE/Node hashes: [measured evidence](evidence/windows-installer-attempt.json).

All four immutable Windows Python wheels were additionally SHA256-verified and inventoried, preserving original Pillow/pandas/lxml notices. Generic lxml GPL `test.py` is absent from the wheel; FreeType’s permissive FTL is selected, not alternative GPL. Actual lxml notice declares iconv LGPL2.1; its exact matching source/build/relinking completeness remains to verify, not silently treated as BSD-only. [Inventory](evidence/windows-python-wheels.json). These checks do not clear distribution.


## Actual installed GUI task milestone — 2026-11-17 16:14 KST

[Run44035093932](https://github.com/Ya-MiC/ymzz/actions/runs/44035093932), exact source `d1985b7fb03f3418e615ff3d3dbc6ca696b0cfc5`: real NSIS installation in Chinese-space path, actual primary Node, all7 exact PE icon frames, native Welcome/nickname/About,12 real GUI approvals, two actual test fail→repair→pass sequences, human acceptance,1 explicit persisted memory and rollback passed. [Raw measured proof and screenshots](evidence/windows-44035093932/README.md). This confirms the stale-approval race fix. Model transport remains explicitly fake.

Overall qualification FAILED afterward: Chromium UIA SelectionItem.Select left the HTML dropdown light; native settings stage was not reached. A real native option click plus actual immutable-authority color assertion is the supported next test repair, NOT yet committed/qualified.

Additional actual-wheel review: lxml6.1.3 explicitly lists two shipped Schematron XSL transforms as unlicensed; their author/date headers contain no permission grant. Exact file hashes and approved LGPL iconv source/build/relinking incompleteness are [recorded](evidence/windows-44035093932/python-license-followup.json). Do not relabel these as BSD/MIT. A verified grant or tested lawful feature-preserving replacement is required; exact libiconv build/version/source also remains unverified. The full exact lxml source sdist was downloaded/hash-verified without executing it, but its Windows recipe selects latest prebuilt dependencies. NumPy GCC-runtime-exception approval and Office0.2.3 preferred TypeScript-source verification remain separate concrete prerequisites.

No draft/Release or executable uploaded. Previously assembled21-archive corresponding materials remain pending, not newly claimed complete. No duplicate CI dispatched after this completed run while these concrete release holds need resolution.

## Source qualification follow-up, not new installed success

Run [44039049852](evidence/windows-44039049852/README.md), source `c4b7668d51f2817a3c74f7e706c322c3f8789808`, passed source/PowerShell syntax/product/policy tests, full DSH artifact gates and actual Windows source task approvals/repair/accept/memory/rollback. Official installer packaging stopped at `TypeError: fetch failed` during `prepare:runtime` at16:38 KST, before a new installer existed. Theme/native-settings GUI checks were skipped, NOT passed. Redacted phase/cause collection now allows supported diagnosis on the follow-up; no unverified binary upload or release. [New exact-source licensing evidence and lawful XSL candidates](LICENSE-FOLLOWUP.md) clarify remaining holds without silently waiving policy.
