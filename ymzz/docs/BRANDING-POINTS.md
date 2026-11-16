# Branding points — inventory only in M1

Exact name/meaning/icon: `../branding/brand.json`. Native layout/component positions must remain unchanged; no replacement shell/dashboard. Wenrun sole authority is linked in RESOURCES.md, verified current commit `d33fb4bae0af86d30891c273103a9659552a926a`.

Verified upstream baseline paths for the future unified branding script:

- `apps/desktop/scripts/electron-builder-config.mjs`: actual productName/icon/package metadata.
- `apps/desktop/resources/`: actual native icon resources.
- `apps/desktop/src/locale.ts` and `main.ts`: native product/About labels; preserve attribution and stable identity.
- `apps/web/index.html` and `scripts/client-build-environment.ts`: actual document/build-profile title. Explicit local profiles strip inherited titles, so parent environment alone is not proof.
- `packages/client/ui-brand-official/src/client/index.ts`: verified native `sidebar.brand.mark`, `sidebar.brand.name`, `conversation.hero.frame` usage. Do not guess private `ctx.shell.overlay`/Office APIs.

No above file is changed in M1. The planned `apply-branding.mjs` must be real, reproducible and reviewable before it is added; it is not replaced with a no-op success stub. Windows PE name/icon/native window and native GUI must be checked after packaging, not inferred from a configuration file.
