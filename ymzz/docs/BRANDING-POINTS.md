# Branding points

Exact name/meaning/icon: `../branding/brand.json`. Native layout/component positions must remain unchanged; no replacement shell/dashboard. Wenrun sole authority is linked in RESOURCES.md, verified current commit `d33fb4bae0af86d30891c273103a9659552a926a`.

## Icon application (done)

`ymzz/branding/apply-branding.mjs` now applies the owner-supplied `icon.svg` to these inspected DSH resource points. Upstream originals are archived under `../branding/archive/upstream-dsh-icons/`. Runtime, package names and `productName` were not edited.

| Path | Why this path |
|---|---|
| `apps/desktop/scripts/electron-builder-config.mjs` | **Not edited.** `win.icon` reads `apps/desktop/resources/icon-windows.png`; `mac.icon` reads `icon-macos.png`; packaged `icon.png` is copied from `icon-windows.png`. Linux has no explicit icon field; that config was left unchanged. |
| `apps/desktop/resources/icon-windows.png` | Windows installer/app icon source used by electron-builder; also the development application icon and the file packed as `icon.png`. |
| `apps/desktop/resources/icon-macos.png` | macOS disk-image / Dock icon source used by electron-builder. |
| `apps/desktop/resources/icon.png` and `icon.svg` | Designer-original slots (1104 canvas with the 1024 tile inset). |
| `apps/desktop/resources/icon-windows.svg` and `icon-macos.svg` | Platform vector slots; filled with the byte-identical source SVG. |
| `apps/desktop/resources/tray-windows.ico` | Windows tray bitmap, and the win32 `BrowserWindow` icon in `apps/desktop/src/main.ts`. |
| `apps/web/index.html` favicons and `apps/web/public/icon-*.png` | Web document favicon and install icons. `index.html` itself was not edited. |
| `website/public/favicon.svg` | Upstream website favicon asset. |

`apps/desktop/src/locale.ts`, `main.ts`, and `packages/client/ui-brand-official/src/client/index.ts` were inspected and **not** edited: they already load icons from the resource paths above, and changing labels would be name branding, not icon application.

Windows PE name/icon in a built installer, the native window of a packaged exe, and a signed Release artifact must still be checked after a later packaging milestone. This commit is a source-tree icon update only.

Do not rerun upstream `render-tray-icon.ts` or `render-app-icons.ts` on the new SVG; those scripts require DSH whale-tile groups and were not modified.
