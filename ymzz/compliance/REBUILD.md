# Current corresponding-source/material preparation —2026-11-21 KST

New ymzz code remains MIT. Third parties keep their actual licenses; the explicit MPL Office resolver modification is not MIT. Owner approval covers actual LGPL/MPL with obligations, not a blanket GPL/AGPL/Commons Clause/unknown waiver. `license-policy.mjs` remains exact-name/version/expression based. **No public installer or new qualified final Windows build is claimed.**

## Current selected production, not superseded blockers

Baseline Windows44709191875 (`d1a5da26c9c08919c5a12ea10732273ec85ea5bd`) passed the actual source-selected Office0.1.3 + MPL resolver patch, all four GUI themes/settings/plugins, Sharp native SVG/replacement mechanism, and source-built GNU-free NumPy/embedded CPython/pandas. Its strict material gate failed. Current Google/Univer/harness changes are newer and **not Windows-qualified by that older run**.

The old NumPy GCC-containing wheel and Office0.2.3 preferred-source discrepancy remain preserved historical findings, **not the selected replacement payload's unresolved identities**. No GCC policy waiver is assumed or needed for the tested GNU-free replacement. All original upstream inputs remain intact.

## Actual local source-only material milestone

| Material | Actual verified contents | Evidence |
|---|---|---|
|04 retained | Full exact Core, full adapter preferred source, original native patches/configuration/notices and30 covered-library archives | `materials-addendum-04.json` |
|05 retained | Exact full Windows MXE recipe archives/patches;353 crates from the actual patched librsvg Cargo.lock | `materials-addendum-05.json` |
|06 new | **All28** actual Windows libvips8.18.7 constituents, including permissive static parts, plus original native notice/versions | [Asset size/SHA](../docs/evidence/materials-addendum-06.json), [rehash/recipe/native identity proof](../docs/evidence/sharp-source-closure-1121.json) |
|07 new | **All98** Core download.lst archives except51 explicitly disabled font/Java/Python/lxml entries; includes exact Skia/PDFium/ICU/Boost/OpenSSL/static prerequisites | [Asset size/SHA](../docs/evidence/materials-addendum-07.json), [Core/preferred source/native identity proof](../docs/evidence/office-source-closure-1121.json) |

06/07 are **local SOURCE-ONLY PENDING** archives, not installers or published assets. Each source archive was actually downloaded or reused and rehashed; this is not a list of links. The conservative07 superset does **not** establish that every optional project, including optional GPL-only projects, is linked or approved for runtime shipment. Final required-material selection must follow the actual configuration and payload; no optional feature is enabled by collecting its source.

`assemble_source_closure.py` assembles from pinned receipts and already downloaded bytes, rejects changed/out-of-cache files and refuses to overwrite old evidence. It does not download/run code, include compiled engines or publish. Large sources stay outside Git. See exact locks `sharp-win32-sources.lock.json` and `office013-all-external-sources.lock.json`.

```sh
python ymzz/packaging/tests/test_source_materials.py
python ymzz/scripts/verify_sharp_sources.py --constituents <06.zip> --rust <05.zip> --inventory <actual-native-payload-inventory.json> --output <sharp.json>
python ymzz/scripts/verify_office_sources.py --base <04.zip> --external <07.zip> --inventory <actual-native-payload-inventory.json> --output <office.json>
```

These verifiers read original sources/recipe archives, not success booleans. Office checks85 preferred files and four generated source/configuration receipts against the original prebuild manifest, the exact Core download.lst and native configure exclusions. Sharp checks28 original recipe VERSION/CHECKSUM pins plus every patched-lock crate. Both can bind to supplied installed-native hashes. **The checked-in reports bind only the old44709191875 installed baseline**, not a new application build.

For a new installed product, `inspect-installed-payload.mjs --installed <dir> --output <inventory.json> --source-materials <material-directory> --enforce` runs real current product/Sharp/native checks, optional source verifiers, then the strict **actual post-selector graph** audit. The source inventory proofs do not bypass the remaining global native/license/material gate. The Windows workflow preserves that strict final gate; repository0.2.3 is only a non-release preflight, never the final selected production graph.

## Replacement/rebuild instructions and original notices

- [Exact Sharp source/recipe/replacement route and limits](SHARP-SOURCE-REBUILD.md).
- [Selected Office full-source/relink route and limits](OFFICE-SOURCE-REBUILD.md).
- **Electron FFmpeg:** retained original sources pin Electron44.7.0/Chromium152.0.7977.130 and FFmpeg2b68d2babae73714846961fb0ee47e3b3d2e39a9. Preserve original LGPL2.1+ notices, Electron's `patches/ffmpeg` and `build/args/ffmpeg.gn`; matching configs have CONFIG_GPL=0/CONFIG_NONFREE=0/CONFIG_VERSION3=0. Use original source-build instructions for an ABI-compatible Windows x64 `ffmpeg.dll`; stop/back up before replacement and requalify playback. No newly modified FFmpeg DLL execution is claimed here.
- **lxml/iconv:** retained addendum03 includes exact lxml6.1.3 and winlibs iconv1.17 source/recipe plus the actual native relink run44102586447 evidence. Production MIT Schematron replacement was genuinely installed/tested. This is not the obsolete “version unknown/unlicensed header unresolved” status. Preserve original notices and actual rebuild/relink instructions; do not label third parties MIT.
- `stage-notices.mjs` stages ORIGINAL production/skills/native license texts; Electron original LICENSE/LICENSES.chromium.html remain. New Sheets uses its own hash-bound bundled original/supplemental notices. Preserve **ot-text-unicode ISC metadata vs MIT README** and **react-remove-scroll-bar supplemental MIT notice, not source-equivalence proof**. Neither is silently promoted to global clearance.

ymzz does not prohibit library modification or reverse engineering to debug such changes. No automatic library/source delivery or maintainer signature restriction against unsigned user replacements is introduced. Normal descriptor/ASAR verification must be regenerated by rebuilding, **never disabled**. No modified full Office/libvips rebuild is claimed by a source inventory or an original-DLL COPY replacement.

## Still required before a downloadable candidate/release

1. Complete the **whole shipped native component/license/source coverage** and final matching source-only distribution selection, not merely the Node graph/two targeted groups. Feed actual material verification into the exact final installed gate; its current native/material flags remain fail-closed. Newly collected sources resolve the targeted archive gaps, not this entire certification by assertion.
2. Qualify the latest exact application head, including real packaged Sheets assets and the existing required installed GUI/Office/Sharp/NumPy checks. Current Linux actual pack/HTTP tests are not a Windows GUI or live model test. Do not rerun the known-failing expensive Windows pipeline until the remaining gate implementation/evidence can genuinely pass.
3. Prepare final installer/checksums/original notices/corresponding sources only after qualification, then obtain the required publication approval. No fake download or early website CTA.

Historical `source-materials.lock.json`/`build-source-materials.py` and the older two-part assembly remain preserved; **the old mixed material bundle includes0.2.3 binary npm inputs and is NOT the final source-only distribution asset**. Addendum03 also includes test-runtime binaries, not an automatic release asset. Regenerate a source-only selected final set rather than blindly upload those archives. The GPL license TEXT required alongside LGPLv3 does not by itself prove a GPL-only runtime component is shipped.
