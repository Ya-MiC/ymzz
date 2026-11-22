# Native product plugin / 原生產品插件

[`product`](product) is one private MIT DSH/Cordis workspace package: native brand/footer/theme extension points, pinned instruction skill registry, bounded task/gate tools using the real upstream agent/approval APIs, local-provider settings, manual diff review/memory, tag-based knowledge notes and disabled-by-default signed-update staging. Native DSH chat/navigation/workspace/provider/tool/plugin functionality remains upstream, in its original layout.

## Tag-based knowledge (標籤化知識)

A conversation or pasted text becomes a tagged, editable, approvable, revocable local Obsidian Markdown note. Drafts live in `$DSH_HOME/ymzz/knowledge.json`; nothing touches a Vault until an explicit approval binds the rendered SHA256 and the user consents to the write. Commits re-render and re-check that hash, never overwrite an existing file, and use a same-directory temporary file plus an atomic rename; a repeat commit returns the original result. Revocation only moves a still-unchanged plugin-published note into `$DSH_HOME/ymzz/knowledge-trash/`. A collapsible 360px right-hand dock (four Wenrun themes, full-width under 720px) adds drafts, tag filters/search, committed notes and a multi-nebula graph clustered by top-level tag, plus a read-only native MCP status section (`ctx.mcpManager.list/probe/restart`, `ctx.tools.definitions()` counts). Configuration and enable/disable stay in native DSH Settings; this plugin writes none. Missing `ctx.sessionQuery` or `ctx.mcpManager` degrades to a plain explanation instead of failing the plugin.

[Model, data locations, approval/revocation boundaries and unverified items](../../docs/knowledge-tagging.md). No cloud sync, account system, Office attachment transaction, Tauri/Rust rewrite or installer is added; a Vault may be synchronised externally with Syncthing/iCloud/OneDrive/Git. Windows desktop/GUI behaviour for this increment is not yet qualified.

No standalone runtime, replacement shell, Loop import or Tauri software is introduced. See product `PROVENANCE.json`, root README and exact evidence under `ymzz/docs/evidence`. Source/runtime tests pass; Windows desktop/GUI distribution is not yet qualified.
