# Brand assets — icon applied, product name not yet applied

`icon.svg` is the latest owner-supplied source, stored byte-identical. It is an SVG wrapper around an embedded raster; do not execute it as active XML. `brand.json` records its SHA-256, the exact display name 湛箴_ymzz, and the name meaning.

Previous M1 artwork remains in `archive/previous-m1/` (`icon-source.png` / `icon.svg`). Official DeepSeek Harness icon files were copied, not deleted, to `archive/upstream-dsh-icons/`.

`apply-branding.mjs` (with `rasterize-icon.py`) generates PNG/ICO sizes with Pillow from the extracted raster, then copies them onto the documented desktop, tray, installer-source and web favicon paths listed in the script. It is idempotent: `node ymzz/branding/apply-branding.mjs --dry-run` reports zero changes after a successful apply. This does **not** rename `@deepseek-ai/*` packages, edit runtime/layout, or change `productName` in `electron-builder-config.mjs`. `applicationBrandingApplied` therefore stays `false`. No packaged Windows installer has been rebuilt or verified.

Upstream `apps/desktop/scripts/render-tray-icon.ts` and `apps/web/scripts/render-app-icons.ts` are whale-tile-specific (they require `tray-glyph` / DSH filter group IDs). Do not rerun them against this artwork; regenerate with `apply-branding.mjs` instead. Those upstream scripts were left unchanged.

Preview: `generated/preview-512.png`.
