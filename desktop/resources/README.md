# desktop/resources/ — CI-assembled backend payload

This directory is what the Tauri bundle packs into the installed application's
resource directory. **The repository never commits binaries here.** The only
file under version control is this README plus the tiny start page in
`shell/` that the desktop window shows while the local service boots.

## Layout produced by `desktop/scripts/assemble-resources.mjs`

| Path | Content | Source |
|---|---|---|
| `backend/node/` | Official Node.js runtime (`node.exe` on Windows, `bin/node` elsewhere) | Downloaded from `nodejs.org/dist`, SHA256 verified against the official `SHASUMS256.txt` before unpacking. Pinned version lives in the script (`NODE_VERSION`). |
| `backend/dsh/` | DeepSeek Harness build artifacts | Copied from the output of `pnpm build:artifacts` (override with `--dsh-dist <dir>`). |
| `backend/plugins/ymzz-product/` | 湛箴 ymzz plugin runtime files | Copied from `packages/ymzz/product` (override with `--plugin-dist <dir>`). |

The desktop shell resolves the backend directory inside the installed
resources (`backend`, with a `resources/backend` fallback) and launches:

```
<backend>/node(-exec) <args from desktop/ymzz-desktop.json>
```

with the environment:

- `PORT` — the local port the shell picked (43110 upward by default);
- `DSH_PRIMARY_RUNTIME` — absolute path to the bundled Node executable;
- `DSH_TELEMETRY_DISABLED=1`.

## Who runs this script

- **CI** (`\.github/workflows/ymzz-desktop.yml`): after `pnpm install` and
  `pnpm build:artifacts`, immediately before `tauri build`, per platform.
- **Local rebuilds**: `node desktop/scripts/assemble-resources.mjs` after a
  completed repository build. A missing artifact source is a hard error — the
  script never fabricates or silently skips content.

## Not committed, on purpose

The single committed exception is `backend/.keep`, a 0-byte placeholder that
exists only so `tauri build` accepts the resource path before assembly.

- Node runtime binaries and the DSH build outputs (downloaded/built per run);
- `desktop/resources/backend/.assemble-temp/` (download + extraction scratch).
