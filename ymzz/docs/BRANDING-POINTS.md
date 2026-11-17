# Branding points

Exact name/meaning/icon: `../branding/brand.json`. Native layout/component positions must remain unchanged; no replacement shell/dashboard. Wenrun sole authority is linked in RESOURCES.md, verified current commit `d33fb4bae0af86d30891c273103a9659552a926a`.

## Icon application (done)

`ymzz/branding/apply-branding.mjs` now applies the owner-supplied `icon.svg` to these inspected DSH resource points. Upstream originals are archived under `../branding/archive/upstream-dsh-icons/`. At the icon-only milestone runtime, package names and `productName` were not edited; subsequent display-name application is listed below.

| Path | Why this path |
|---|---|
| `apps/desktop/scripts/electron-builder-config.mjs` | Icon configuration unchanged; product name/artifact prefix are now branded below. `win.icon` reads `apps/desktop/resources/icon-windows.png`; `mac.icon` reads `icon-macos.png`; packaged `icon.png` is copied from `icon-windows.png`. Linux has no explicit icon field; that config was left unchanged. |
| `apps/desktop/resources/icon-windows.png` | Windows installer/app icon source used by electron-builder; also the development application icon and the file packed as `icon.png`. |
| `apps/desktop/resources/icon-macos.png` | macOS disk-image / Dock icon source used by electron-builder. |
| `apps/desktop/resources/icon.png` and `icon.svg` | Designer-original slots (1104 canvas with the 1024 tile inset). |
| `apps/desktop/resources/icon-windows.svg` and `icon-macos.svg` | Platform vector slots; filled with the byte-identical source SVG. |
| `apps/desktop/resources/tray-windows.ico` | Windows tray bitmap, and the win32 `BrowserWindow` icon in `apps/desktop/src/main.ts`. |
| `apps/web/index.html` favicons and `apps/web/public/icon-*.png` | Web document favicon and install icons. `index.html` itself was not edited. |
| `website/public/favicon.svg` | Upstream website favicon asset. |

`apps/desktop/src/locale.ts`, `main.ts`, and `packages/client/ui-brand-official/src/client/index.ts` were inspected and were not edited in the icon-only milestone: they already load icons from the resource paths above, and changing labels would be name branding, not icon application.

Windows PE name/icon in a built installer, the native window of a packaged exe, and a signed Release artifact must still be checked after a later packaging milestone. This commit is a source-tree icon update only.

Do not rerun upstream `render-tray-icon.ts` or `render-app-icons.ts` on the new SVG; those scripts require DSH whale-tile groups and were not modified.

## Application display name (applied, not Windows-qualified)

`node ymzz/branding/apply-branding.mjs --application` applies `application-branding.mjs` to exactly five inspected text points, with immutable upstream `.source` archives and SHA256 checks:

| Path | Display-only change |
|---|---|
| `scripts/client-build-environment.ts` | Default and local-profile document title `湛箴_ymzz`; native layout unchanged. |
| `apps/desktop/scripts/electron-builder-config.mjs` | `productName` and output artifact name prefix only; no updater/policy/signing or installer behavior change. |
| `apps/desktop/scripts/smoke-packaged-runtime.ts` | Expected `湛箴_ymzz.exe` path, so future real packaged smoke tests the actual product. |
| `apps/desktop/src/locale.ts` | Application display strings only; locale coverage retained. |
| `apps/desktop/src/main.ts` | Native About display name, exact owner meaning and explicit upstream MIT/not-official credit. |

`--application --dry-run` is idempotent and rejects unrecognized target changes. Original text bytes are archived under `ymzz/branding/archive/upstream-text-branding/`; the archive suffix is `.source` so formatters cannot rewrite preserved originals. IDs, package names and existing settings are not renamed. The source-run launcher selects its own data home but performs no migration/deletion of existing DSH data.

Necessary non-branding registrations: `packages/bundle/web-app/{package.json,cordis.patch.yml}`, `tsconfig.client.json`, `pnpm-lock.yaml`, and the private workspace tarball registration in `apps/desktop/scripts/pack-local-packages.ts`. The composition disables upstream telemetry and official sidebar-brand occupant while loading our plugin in the same native slots. No model/tool/agent core code is replaced.

## Portable asset application

The first actual Windows source run44024932861 exposed an unnecessary Pillow dependency in the idempotence check. Normal `apply-branding.mjs` now applies checked-in rendered assets only after verifying the exact owner SVG SHA256 and **all11 output filenames, lengths and hashes**; corrupt/missing assets fail closed. No icon/agent functionality is removed and no integrity gate is waived. `--regenerate` explicitly invokes the maintainer-only Python/Pillow generator (`PYTHON` or platform-correct python/python3); normal Windows source/build verification needs neither Pillow nor a rasterizer. The source-path field in the historical manifest is provenance, not a platform-specific runtime path. Four adversarial integrity tests cover cache success, tamper, wrong owner source and traversal/missing entries.
