# Native delivery / 原生安裝交付

This is engineering evidence, not a public installer or legal guarantee. Public binary release remains HOLD. Loop is independent and untouched.

## Source staging / 對應來源進 CI

`python ymzz/scripts/stage_source_materials.py --cache <CAS> --output <materials> --download-missing --report <JSON>`

- `source-staging.lock.json` pins every one of 550 source/text entries across source-only assets04–08, deduplicated to513 objects. Only reviewed original HTTPS origins or original repository text inputs are allowed. No runtime/npm binary bundle is added.
- Historical04/05 archives stay preserved unchanged. ZIP timestamp/compression differences are not a license obligation: reconstruction verifies the complete exact member set, uncompressed bytes/SHA256, original recipes/patches/notices and all existing preferred-source/native bindings. Extra text/runtime, duplicate paths, changed bytes, unsafe URLs and cache symlinks fail.
- Offline `--seed-archives <retained originals>` reuses already obtained materials without downloads. Do not overwrite old evidence or clear broken caches. A changed object fails.
- Dedicated manual `.github/workflows/ymzz-materials.yml` reconstructs from official origins; only JSON hashes are uploaded. Windows qualification now stages materials before packaging and forwards the actual directory to `inspect-installed-payload --source-materials ... --enforce`. This wiring does not change any native/source/license approval.

## Generated PE identity / 產生式 PE 身份

A generated product EXE cannot be equated to an upstream EXE by filename or version alone. `verify_generated_pe.py` compares exact producer code/data/loader/directories and immutable resource entries. Only branding icon/version resource data and exact V1 fuse state bytes may vary; manifest execution behavior cannot change. The one ASAR integrity resource must bind the freshly read real ASAR header. It does not change fuses, signing, integrity policy or application code.

The installed verifier can use the untouched upstream Electron input at `apps/desktop/.desktop-build/targets/win-x64/electron/electron.exe`, pinned to official44.7.0 executable SHA256 `2529b494f4123f152bce346051f7bd855ef95006424a561953cf17c49a3d1ba8`. It only recognizes the exact existing product executable path. Unknown references, changed code, relocated/deleted natives and other unknown executables remain blocked. A successful code-identity proof cannot excuse missing grant/source obligations.

The real246MB upstream-PE resource fixture and mutation tests are NOT a new installed product/GUI result. NSIS-generated uninstaller identity and transient installer native coverage still require their own producer proofs; they are not covered by this Electron rule.

## Primary native producers / 原始 producer

- ConPTY: all four installed x64/ARM64 native identities match official `Microsoft.Windows.Console.ConPTY@1.25.260303002-preview` NuGet. Its native-package MIT declaration, Microsoft copyright and `requireLicenseAcceptance=false` are preserved, alongside the original Terminal MIT text. No SDK agreement was accepted. This is not MIT inheritance from the node-pty JavaScript wrapper.
- fastlist: both original MarkTiedemann v0.3.0 release binaries match. Original source README/C++ are preserved; source README says MIT. Do not invent a vendor copyright notice or mistake this for an unrelated npm fastlist0.3.0.
- reflink: exact root gitHead, native source-repository MIT manifest,74 checksum-matched Cargo source archives and original crate grants are reviewed.152 original notices/manifests include the exact Rust compiler standard-library notices and exact napi source-commit LICENSE files. This is a conservative notice superset, not a claim all lock entries ship on Windows. The copy_on_write source manifest explicitly grants MIT but supplies no standalone license/copyright; the original declaration is preserved without fabricating one. No source/relink duty is invented for these permissive components. Fresh actual installed notices must still match pinned bytes.
- NSIS: compiler and resources archives match the pinned builder hashes, and `elevate.exe` matches. Actual app-builder-lib26.17.0 selects **zlib** (or compression off), so the unused LZMA module's CPL text in original COPYING is not evidence of a shipped CPL module. Do not change product compression or request a spurious CPL waiver. The real StdUtils/embedded7za/transient installer constituents must still be covered individually.
- Electron credit/catalog GPL strings are not a shipped-GPL classifier. Non-Windows build tools, optional components and dual grants must be distinguished from real Windows source obligations.
- Microsoft SDK/CRT redistribution conditions are not a made-up source delivery duty. Read exact applicable native producer terms; do not accept a new agreement or relabel them MIT. No waiver is inferred from a general release request.

## Qualification state / 驗收邊界

Existing Linux44874367654 on57a459 completed successfully at15:15 KST on2026-11-21, including eight artifact gates and actual HTTP/DSH fixtures; not Windows GUI evidence. Existing Sherpa44874363013 completed native CMake build, then failed at a real Python `wave` module-shadowing bug before native transcription parity. The bug is fixed with exact PCM sample preservation/stereo-rejection regressions; Chinese/English original-vs-candidate CPU parity and all actually used DSH APIs still must pass before production selection. No full Sherpa TTS API parity or live paid model inference is claimed.

The prior full installed Windows GUI/Office/Sharp/NumPy evidence remains historical44709191875 only. Current full native rights/materials and installer gates are not declared cleared. Original Google/Univer, owner SVG, four Wenrun themes, auth and native DSH layout are preserved.

Source reconstruction44877601271 exposed a real origin-generation bug: `+spec-1.1.0` semver metadata was incorrectly parsed as part of the crate name. Five affected official URLs are corrected and downloaded bytes match the preexisting original hashes exactly. Version/name regressions now reject this mapping error; hashes were not changed. Source cache objects can be reused only after full pin verification. Temporary downloads are uniquely owned and never delete preexisting partial evidence.
