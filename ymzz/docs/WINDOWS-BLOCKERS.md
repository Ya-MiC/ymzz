# Windows release hold — exact blockers, not a replacement runtime

The full DSH application and native product plugin build and run locally. This does not qualify a Windows installer. No old Tauri/Loop executable is substituted, and no public installer is published.

## 1. Official unsigned Windows policy requirement

The real command `pnpm run package:desktop:win:x64:unsigned --check` on this Linux box rejects with `win-x64 requires a Windows x64 build host`. Actual Windows run44024932861 independently reproduced the same required-policy error on native Windows x64; see evidence/windows-first-qualification.json. Do not call the Linux run a Windows build.

The official `validateDesktopPackageEnvironment` API, invoked with the actual Windows target and the public product ID, also requires `DSH_DESKTOP_MANDATORY_UPDATE_PROD_ORIGIN`. The packager does NOT apply its no-policy unsigned-macOS behavior to unsigned Windows. The source has no supported Windows offline/manual-only switch:
- `apps/desktop/scripts/desktop-package-environment.mjs:124` unconditionally resolves policy for Windows.
- `apps/desktop/scripts/electron-builder-config.mjs:69` omits policy only for unsigned macOS.
- `apps/desktop/src/mandatory-update-policy.ts` disables queries only when policy configuration is absent; configured policy polls automatically.

No endpoint is invented and no upstream protection/configuration check was bypassed. Under v2's allowlist these are not merely display-branding/package-registration changes, so the following narrowly scoped exception needs owner approval before implementation:
1. Change `if (target.platform !== 'darwin' || !options.unsigned) resolveDesktopPolicyEnvironment(environment)` to `if (!options.unsigned) resolveDesktopPolicyEnvironment(environment)`.
2. Change `const policy = packagesMacOS && unsigned ? undefined : resolveDesktopPolicyEnvironment(env)` to `const policy = unsigned ? undefined : resolveDesktopPolicyEnvironment(env)`.

This would extend the existing unsigned-macOS policy to unsigned Windows, not disable signed-release validation. It must gain regression tests proving unsigned Windows omits policy metadata/network polling while signed builds still require the service. It has NOT been applied. Standard installer/OS/protocol writes still need honest assessment; no claim of a registry-free installer is made.

## 2. Actual native dependencies versus strict permissive-only policy

The actual installed production graph is audited, rather than the MIT wrapper alone. Actual native Windows run44024932861 audited666 production packages with no unresolved dependencies: Sharp is Apache-2.0 AND LGPL-3.0-or-later, and LibreOffice API/WASM/Windows engine are MPL-2.0. The unchanged strict gate failed closed. On Linux the666-package graph contains LGPL-3.0-or-later libvips and MPL-2.0 LibreOffice API/WASM; no unresolved dependencies. Exact Windows public metadata is `@img/sharp-win32-x64@0.35.5: Apache-2.0 AND LGPL-3.0-or-later`; LibreOffice0.2.3 is MPL-2.0. Prior exact upstream-version Windows payload research also found Electron FFmpeg LGPL-2.1+; the new Windows payload has not been built/audited yet.

LGPL and MPL are NOT automatically GPL/AGPL, and these findings do not mean the MIT application must be relicensed GPL. They nevertheless do not pass the previously required permissive-only gate. Actual redistribution obligations/notices/corresponding source need review; no policy exception is silently assumed.

Investigated options:
- Removing Sharp's active optional platform binary breaks the first real raster operation. Sharp is used for image metadata, normalization, resize/encoding and provider request images; no feature-preserving exclusion is claimed.
- A permissive image adapter could be separately ported/qualified, but would require replacing the active attachment backend/import and would not resolve Office/FFmpeg.
- Electron's official codec-reduced FFmpeg DLL changes codec flags, not the LGPL license. FFmpeg's own legal page says it is not available under other licensing terms. Dropping it or Office would silently remove functionality and is not done.

Decision needed: either explicitly permit the actual LGPL/MPL components with their full compliance/source materials, or authorize/qualify broader feature-preserving backend replacements beyond v2's current allowlist. Until then strict license enforcement remains failing and no binary release is cleared. See `evidence/native-license-research.json` and `evidence/production-license-*.json`.

## 3. Reviewed updates

The plugin has tested Ed25519 signed-manifest compatibility/hash/license-gated staging and staging rollback only. Production maintainer public key/channel is absent. No private signing key, signature, live update feed, install/restart success or automatic remote code execution is invented.
