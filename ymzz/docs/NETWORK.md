# Network inventory / 新增對外請求

No analytics/telemetry is added. The product composition disables upstream `desktop-product-telemetry` and `product-analytics`; the product source launcher sets `DSH_TELEMETRY_DISABLED=1`. This is not an OS firewall or an assertion that every native DSH network capability has disappeared.

| Surface | Destination / data | Trigger, bounds and disable control |
|---|---|---|
| Native plugin local-provider adapter | Exact user-selected `http://127.0.0.1:<port>/v1/chat/completions` or `[::1]`; selected task prompt, bounded selected-workspace contents and approved tool results; no API keys | Disabled by default. User configures endpoint/model, explicitly enables, chooses workspace and starts task. Settings → plugin dialog → disable local model requests. No redirects/DNS/remote host,20s timeout,256KiB request/128KiB response,24 model steps/16 tools/10min task ceiling. A response is not a model-quality certification. |
| Plugin UI | Same-origin authenticated local DSH `/ymzz/*` state/actions | Open dialog only; state refresh while open, explicit mutation buttons and native DSH approvals. Closing dialog stops state refresh. No external server. |
| Reviewed updater | None | Local signed-manifest/ZIP verification and staging only; no remote polling, download, extraction, code execution or install channel configured. |
| Official website translations/fonts/assets | Same-origin GitHub Pages resources | Ordinary site loading/language selection; fonts are local OFL files, no font CDN. |
| Website release lookup | `https://api.github.com/repos/Ya-MiC/ymzz/releases?per_page=10`; public release metadata only | No request at page load. Off-by-default checkbox plus explicit manual button;8s timeout, credentials/referrer omitted. Uncheck to disable. No automatic installer execution. |
| Optional independent-product hyperlinks | Original public sites, including completed separate Loop project-management product | Only normal explicit link navigation. No Loop code/data/runtime import or migration. |

Maintainer git/gh/pnpm/CI operations contact GitHub/npm and upstream build dependencies as explicitly requested development operations, not shipped telemetry. No secret or local authentication launch token belongs in evidence. No live/paid/NIM inference, payment connection, or private-document import was performed.

Windows distribution is NOT yet cleared. With the owner’s explicit approval on 2026-11-17 15:04 KST, exactly two packaging conditionals now omit mandatory-policy metadata/service requirements for unsigned builds; signed builds still require a valid HTTPS origin. No endpoint or signing credential is invented. Standard NSIS installation, shortcuts/uninstallation and the native `dsh` protocol registration can write ordinary OS/user registry entries; there is no custom registry-edit script or registry-free claim. New NumPy runtime-exception and Office preferred-source verification holds remain; see [Windows blockers](WINDOWS-BLOCKERS.md).
