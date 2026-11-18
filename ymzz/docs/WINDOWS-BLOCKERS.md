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


## 2026-11-18 KST: real native focus/contrast follow-up; actual Office operations

44101906821 failed because UIA focus was not identical to the combo after a popup had opened; dark/failure identical PNGs are not independent success proof. The bounded input fix physically clicks the real hit-tested combo, checks actual focused combo/known popup option and process, and uses Home/Down/Enter on the opened list. No DOM assignment or success injection. All four themes require immutable authority background AND accent pixels and preserve per-theme partial JSON checkpoints. Settings/Models/native plugin inventory are still required, not marked passed in advance.

The original palette file remains unchanged; owned consumption fixes prose/filled-button contrast without moving DSH panels. Six new palette/input regression tests pass, including normal-text AA for four original palettes. Full product tests66, packaging32 and signed/unsigned policy25 pass locally; this does not replace installed Windows proof.

The real DSH Office provider/actual WASM0.2.3 passed all four new unmocked conversion/render/recalculation probes. A separate installed native step is now in the same Windows workflow, using actual app.asar bytes and bundled Node. [Actual evidence and precise commercial/source boundary](OFFICE-COMMERCIAL.md). Licensing is NOT cleared and the draft remains asset-free; approved LGPL/MPL use does not waive missing preferred source or silently approve GCC exceptions.


##44210430029 terminal result: four palette interactions + actual installed Office pass, real prose defect remains

[Measured evidence](evidence/windows-44210430029/README.md): all four physical combo selections genuinely changed background AND accent to authority values. Actual native Office0.2.3 with bundled Node24.21.0 independently passed all four real operations. GUI tasks/acceptance/memory/rollback and actual MIT XSL resources pass again. Overall CI remains failed.

Visual inspection correctly caught that dark prose STILL painted low contrast: therefore this is not called complete theme qualification despite successful selection. Owned body/dialog scheme markers are now explicitly synchronized and direct dark prose consumes original dusk-paper; the next test MUST find20 actual authority-ink pixels in the real visible paragraph, not just a dark background. Native settings stopped at `Account menu` because the test assumed InvokePattern although the real enabled control exists; use genuine visible hit-tested physical menu/disclosure clicks instead. Native Models/plugin inventory remain unqualified until the follow-up succeeds. Licensing gates remain unchanged and block publication.


## 2026-11-18 10:22 KST bounded source-probe outcome

The exact MSVC/CPython3.12 NumPy2.3.5 internal-C-BLAS/LAPACK candidate was actually built in [44214196297](https://github.com/Ya-MiC/ymzz/actions/runs/44214196297). [Measured JSON](evidence/numpy-source-44214196297.json) proves its original wheel notices and every actual PE imported-DLL scan pass without OpenBLAS/GNU runtime. Wheel6915566bytes, SHA256 `69b0a43f8bb2ce71673f854d806ddb07b4c4443f0de88ae66b84f7c8ae1a1a3c`. **The candidate is NOT qualified or integrated**: its numerical acceptance stopped before executing on a probe `KeyError: found`. Exact upstream `numpy/__config__.py.in` recursively removes false values. The bounded fix requires the explicit backend name `none`, rejects found/unknown/missing schemas, and has four local fail-closed regression tests. It does not weaken native-import/license/numerical gates. No duplicate full build is dispatched for this helper correction. A future source-only run must still pass real numerical suites; upstream warns some linear algebra can be up to100x slower. The current production NumPy DLL and GCC-exception hold remain unchanged.

The sole in-flight full product run is [44214187521](https://github.com/Ya-MiC/ymzz/actions/runs/44214187521), application `8591c1d798f31fff29c22d65daa4c8d326627538`. Its real source-web task gate and official packaging preflight passed; the expected strict production-license gate failed. The new actual dark-prose painted-ink assertion and physical native Account-menu/settings/model/plugin inventory checks remain pending while the official installer builds. Do not call this a complete GUI pass or upload its executable.


## 2026-11-18 bounded implementation follow-up (t186)

- [44214187521](evidence/windows-44214187521/README.md) terminal: official installer/native task/Office proof passed again, but actual dark prose ink0 pixels failed. Native settings/inventory were not reached. New owned consumption resolves actual authority colors at host boundary and never changes layout; actual installed CSS/JS/helper bytes must match exact source. The painted-pixel gate is retained, not bypassed. Readonly computed-style/asset diagnostics are enabled only in qualification.
- [44215886581](https://github.com/Ya-MiC/ymzz/actions/runs/44215886581): genuine explicit solve/Cholesky/SVD/QR/eigen/lstsq/FFT/random acceptance passed and1967 upstream cases passed,15 skipped,2 xfailed. The remaining failure is upstream's fresh `sys.executable -c` subprocess unable to import the `--target` NumPy. No math failure or missing linalg was disguised. The parent-isolated process still imports the exact candidate explicitly; child `PYTHONPATH` is now exactly that candidate directory. A real fresh-interpreter Chinese-space sentinel regression proves this path propagation; no upstream test is skipped or altered. Full source numerical qualification remains required.
- [Office alternative source/function findings](OFFICE-COMMERCIAL.md): actual public preferred TS source, a minimal MPL resolver backport, official build recipe and four genuine operations now pass twice, with identical adapter entry bytes. This is a candidate, not a production downgrade/feature deletion or relabeling0.2.3. New Windows candidate step is explicitly separated from actual installed0.2.3 qualification.

Original product graph, GCC-exception owner hold and0.2.3 matching-source hold remain until a truly qualified replacement/material route is selected. No installer artifact is uploaded. Loop untouched.


## Measured NumPy source candidate PASS —2026-11-18 10:54 KST

[44218703576](https://github.com/Ya-MiC/ymzz/actions/runs/44218703576), exact code `88ee2bf2998ee3ca3881441c1fc44f152bd2c790`: **PASS**. Actual explicit solve/Cholesky/SVD/QR/eigen/lstsq/FFT/random acceptance AND the complete selected upstream linalg/fft/random suites: **1968 passed,15 skipped,2 expected failures**,23.69seconds. No tests removed/skipped by the repair; optional/upstream-marked cases remain accurately reported. This does not claim every NumPy namespace or a packaged-runtime test passed.

[Original measured JSON](evidence/numpy-source-44218703576-passed.json): original wheel notices and every actual PE imported-DLL scan pass without OpenBLAS/GNU runtime; wheel6915551bytes, SHA256 `962ff3436a6daf4b22e70f2c201745d9bded6f25a9a382fec12a3a6793b8518d`. Successful internal cache is now saved as `ymzz-numpy-235-cp312-vs17-source784db1dc-internal-c-blas-lapack-v1`; reuse it rather than rebuilding. No downloadable wheel or installer was published.

**Candidate only:** actual product still contains the original NumPy/OpenBLAS DLL. Production selection must replace the whole matching NumPy wheel namespace/metadata, preserve the immutable upstream runtime archive, audit actual prepared dependencies, exercise actual packaged Python/pandas/Office tasks and retain the disclosed potential100x linalg slowdown. Do not just delete/rename a DLL or clear the original GCC-exception gate. The full GUI/native Office candidate run remains44218711664 at application88ee2bf2998ee3ca3881441c1fc44f152bd2c790; no duplicate was dispatched.
