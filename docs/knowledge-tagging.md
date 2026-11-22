# 標籤化知識（knowledge tagging）

本文件說明 `@ymzz/dsh-product` 新增的「標籤化」能力：把一次 DSH 會話或一段手工文字，
變成帶多維標籤、可編輯、可審批、可撤銷、可檢索的**本地 Obsidian Markdown 知識資產**。

它是原生 DSH 應用上的一個插件增量，不是第二個 runtime，也不改動左側導覽、中間對話、
右側工作區的三欄結構、原生管理面板或既有四套溫潤主題。標籤面板是右側一個可收起的
獨立 dock（寬度 `min(360px, 100vw - 16px)`），收起後只留一個 44px 邊緣把手，
不遮擋原生導覽與聊天輸入；視窗窄於 720px 時改為全寬 overlay。

## 1. 標籤化模型

| 概念 | 說明 |
|---|---|
| 草稿 `draft` | `title`、`summary`、`tags`、`source`、`links`、`sections`、`targetPath` 與狀態（`draft` / `approved` / `committed` / `revoked`）。先寫入本機 ledger，尚未觸碰 Vault。 |
| 標籤 `tag` | 正規化：NFKC → 小寫 → 去 `#` → 空白轉 `-` → 只保留文字／數字／`_-.`／`/` → 去首尾符號 → 上限 40 字元；單篇上限 24 個、去重。 |
| 建議標籤 | 只從你**實際輸入**的 `#tag` 字面抽取（上限 12 個，排除已存在標籤）。不做「AI 自動理解」，也不偽造語意。 |
| 分節 `sections` | 決策 / 事件 / 資源 / 行動，各自上限 20,000 字元；空白分節不會寫入檔案。 |
| 來源 `source` | `manual` 或 `session`（含 session id、標題與有界摘錄）。 |
| 目標路徑 | 一律位於 Vault 的 `ymzz/` 子目錄；未指定時為 `ymzz/<年>/<月>/<slug>-<id8>.md`。 |

## 2. 來源會話（原生 `ctx.sessionQuery`）

- 列出最近會話：`id`、`title`、`cwd`、`createdAt`、`updatedAt`、`live`（最多 20 條，新的在前）。
- 讀取一個會話：只保留使用者／助理／todo 的純文字，從最近 240 個事件中取用，總量上限
  8,000 字元，超出即標記 `truncated`。工具名稱與參數、結果雜訊不會進入知識文本。
- 若 Host 沒有掛載 `ctx.sessionQuery`，面板顯示「此 Host 未提供會話查詢能力」，
  整支插件照常啟動，仍可手工輸入。

## 3. Obsidian 相容格式

```markdown
---
title: "標題"
created: "2026-11-22T03:00:00.000Z"
updated: "2026-11-22T04:00:00.000Z"
tags: ["dsh", "知識-管理"]
ymzz_id: "0f0a…"
source: "session"
source_session: "…"
---

# 標題

摘要（可省略）

## 决策
…
## 事件
…
## 资源
…
## 行动
…

## 来源

- 会话：來源標題 `session-id`
- 关联：[[另一篇筆記]]
```

- 全檔 UTF-8、LF 換行、結尾恰有一個換行；frontmatter 至少含
  `title` / `created` / `updated` / `tags` / `ymzz_id` / `source`。
- 正文固定含 `## 来源`；四個知識分節**無內容即省略**，不會留下空標題。
- 關聯一律寫成 `[[筆記標題]]`。
- 單檔上限 200,000 bytes（渲染時檢查），Vault 讀取上限 64 KiB。

## 4. 本地資料位置

| 路徑 | 內容 |
|---|---|
| `$DSH_HOME/ymzz/knowledge.json` | 草稿、已提交筆記的中繼資料、垃圾桶索引、Vault 設定。原子寫入（同目錄暫存 + rename）、`0600`。 |
| `$DSH_HOME/ymzz/knowledge-trash/` | 撤銷後的筆記實體（不永久刪除），檔名帶時間戳。 |
| `<Vault>/ymzz/…` | 真正寫出的 Markdown 筆記；插件只在此子目錄寫入。 |

`knowledge.json` 若損壞：內容會被改名備份為 `knowledge.json.corrupt-<時間>`，
ledger 以空白狀態啟動，並在面板與 `state` 中回報 `recoveredFrom`。不會靜默丟棄，
也不會讓插件啟動失敗。

假設同一個 profile 只有一個 Host 程序在寫入（與原生 `tasks.json` 相同）；
兩個程序同時寫入時，後寫者覆蓋前寫者。跨裝置請同步 **Vault**，不要同步 ledger。

## 5. 審批與寫入邊界

**所有**知識寫入（儲存／刪除草稿、審批、寫入、撤銷、設定 Vault、標籤庫各寫入操作）都要求
`x-ymzz-action: 1`、非跨站請求與 `consent: true`。例外：MCP 的「檢查／重啟」是唯讀診斷動作，
只要求 `x-ymzz-action` 與非跨站，不要求 `consent`（它不寫入任何資料）。
舊路由維持 8 KiB 上限，知識與標籤庫路由逐路由上限 256 KiB（不是全域放寬）。

1. **草稿**只存在 ledger，不寫 Vault。**配額只統計未完成的草稿**：
   已寫入（committed）與已撤銷（revoked）的記錄不再佔用 200 篇額度，
   因此第 201 篇筆記永遠寫得進去；刪除已寫入草稿的記錄外殼也不會動 Vault 檔案。
2. **審批**（`approve`）把當前渲染結果的 SHA256 綁定到草稿。內容不變的再次儲存
   會保留 `updatedAt` 與審批欄位——`updated` 參與 frontmatter 渲染，若無變動卻推進時間戳，
   會讓有效審批變成 `APPROVAL_STALE`；因此只有真實內容變化才推進時間戳並清除審批。
3. **寫入**（`commit`）要求 `consent: true`，並重新渲染、重新核對雜湊：
   - 草稿在審批後被修改 → 審批失效（`APPROVAL_REQUIRED` / `APPROVAL_STALE`），必須重新審批。
   - **絕不覆寫同名檔案**：目標已存在即 `TARGET_EXISTS`，原有位元組不動。
   - 同目錄暫存檔 + `fsync` + **原子 `linkSync` 佔位**：即使存在檢查與發布之間有另一個
     Host 實例或同步客戶端（Syncthing／OneDrive／iCloud）恢復了同名檔案，
     `linkSync` 也會以 `EEXIST` 失敗，使用者檔案不會被覆蓋；
     不支援硬連結的檔案系統（exFAT 等）回退 `COPYFILE_EXCL`，仍是排他建立。
   - 目標路徑拒絕：絕對路徑、`..`、反斜線、NUL／控制字元、隱藏段（含 `.obsidian`）、
     Windows 保留名、尾隨空白或點、離開 `ymzz/` 根目錄、符號連結、硬連結。
   - 重複 `commit` 直接回傳原本結果（`idempotent: true`），不會產生第二個檔案。

## 6. 撤銷邊界

- 只允許**本插件新發布**且**目前雜湊未變**的筆記。
- 檔案被外部修改或刪除時，撤銷以 `NOTE_CHANGED_EXTERNALLY` 失敗，且完全不動該檔案。
- 撤銷是「移到 `knowledge-trash/`」，不是永久刪除；ledger 保留垃圾桶索引。

## 7. 檢索與重開

- 只檢索「已 commit」且「目前 Vault 中仍存在」的筆記；檔案消失即從圖譜與結果中隱去。
- 對 `title`、`tags`、正文做大小寫不敏感的字面匹配（單次最多 40 條，附單行摘要）。
- 標籤過濾支援 `untagged`（無標籤）。
- 開啟筆記回傳 Markdown 原文與標籤；若磁碟內容與記錄雜湊不同，回報 `modified: true`
  （此時撤銷會被拒絕）。
- 重啟後仍可檢索：狀態全部來自 `knowledge.json` + Vault 檔案。

## 8. 多星雲圖

- 不是一張大網，而是**按頂級標籤分簇**：最多 8 簇（含最後的「未標籤」簇）。
- 每簇中心是標籤節點，周圍是筆記節點；一個筆記有多個標籤時，會同時出現在多個簇，
  並標記為「跨簇共享」。
- 佈局為固定角度的放射式（無隨機抖動），同一份資料每次產生完全相同的座標。
- 全部資料來自本地已提交筆記，不連網。
- 可存取性：每個 SVG 有 `title`/`desc`，另有隱藏的文字替代清單列出「簇 → 筆記」關係；
  節點可用鍵盤 `Enter`/`Space` 開啟；尊重 `prefers-reduced-motion`。

## 9. MCP 狀態面板

- 只用原生 `ctx.mcpManager`：`list()` 顯示 server / `status` / `configured`，
  `probe(name)` 做連線檢查，`restart(name)` 請原生管理器重啟。
- 用 `ctx.tools.definitions()` 統計工具總數與 `mcp__` 命名空間數量。
- **不新增任何寫入設定的介面**：server 的新增、修改、啟停仍在 DSH 原生 Settings。
- `mcpManager` 未掛載時，面板顯示「原生服務未啟用」，插件照常啟動。

## 10. 多端與同步（外部，不在本插件內）

Vault 就是一般資料夾，可用 Syncthing、iCloud Drive、OneDrive 或 Git 在裝置間同步。
本插件**不做**雲端同步、帳號、衝突合併或版本歷史；衝突處理取決於你選用的同步工具。
`$DSH_HOME/ymzz/knowledge.json` 是每台機器各自的 ledger，不同步也不合併。

## 11. 未驗收項（明確界線）

- Windows 桌面 GUI 的實際點擊流程尚未驗收；本文件只描述程式行為。
- 沒有在真實使用者 Vault 上執行；測試使用暫存目錄（含中文與空格路徑）。
- Office 附件的轉換／落地不在本補丁範圍；只說明「輸出可進入 Vault」為後續方向。
- 沒有雲端、帳號、Tauri/Rust 重寫或安裝包發布；桌面仍由 DSH 官方打包鏈提供。
- MCP 面板只讀＋重啟，未驗證任何第三方 server 的實際工具語意。

## 12. 測試

```sh
node --test packages/ymzz/product/tests/*.test.mjs
node --test packages/ymzz/product/tests/integration/*.test.mjs
```

- `tests/knowledge.test.mjs`：標籤正規化、建議標籤、Markdown 渲染、審批綁定、審批後修改失效、
  冪等 commit、不覆蓋同名檔、檢索、撤銷、重啟、ledger 損壞恢復、欄位邊界、面板靜態不變量。
- `tests/knowledge-vault.test.mjs`：路徑拒絕矩陣、Vault 根驗證、原子寫入與無暫存殘留、
  超長／非 UTF-8／符號連結拒絕、垃圾桶雜湊守門。
- `tests/knowledge-graph.test.mjs`：分簇上限、跨簇共享、排序穩定、佈局決定性、文字替代。
- `tests/integration/knowledge-route.test.mjs`：認證路由、consent／`x-ymzz-action`／
  `sec-fetch-site`、舊路由 8 KiB 與知識路由 256 KiB 的逐路由上限、能力缺失降級、重啟後檢索。

整合測試需要 workspace 依賴（`@deepseek-ai/dsh-home-paths`、`@deepseek-ai/dsh-llm`）
與已建置的 `lib/univer` 產物；在未安裝依賴的原始碼目錄中，這些測試與既有基線一樣無法執行。

## 13. 標籤庫（跨會話註冊表，`tag-registry.json`）

- 條目類型：`session / message / thought / web / file / artifact / note / task`。
- 標籤為多對多；List 是使用者的跨會話彙編（類似 GitHub Stars／Lists），一個條目可屬於多個 List。
- 已寫入 Vault 的筆記會**自動**註冊為 `kind: note` 條目（commit 的同一事務內通知，不做掃描）。
- 其餘條目只能由使用者**顯式**在面板登記（標題＋定位＋標籤）；面板提供類型過濾、
  標籤過濾、List 建立／刪除／加入／移出、移除條目、點擊筆記條目直接開啟原文。
- 隱私界線：註冊表**沒有**掃描、爬取、瀏覽歷史讀取或任何聯網入口；定位器（URL／路徑）
  只是被原樣保存的字串，插件不會去讀取其內容。憑證形字串（密碼／token 形態）會被拒絕登記。
- 星雲圖同樣按頂級標籤分簇（≤8 簇），一個條目可同時出現在多簇；佈局確定性、可減少動效。
- 資料位置：`$DSH_HOME/ymzz/tag-registry.json`，與知識帳本一樣是本機單一 JSON，
  損壞時備份後恢復空狀態並在面板標示。

## 14. 已知限制（QA Round 2 记录，均不阻塞）

1. **面板轮询开销**：`knowledge/state` 在 200 篇笔记规模下每 6 秒约 145ms 同步 CPU、
   266KiB 载荷（逐篇 `noteExists` realpath + Host 侧 JSON 签名）。笔记上百篇后建议
   改为 exists 缓存或 Host 侧预算签名；当前规模可用，规模化待优化。
2. **knowledge-ui.css 存在 39 处硬编码色 var() fallback**：与真实 wenrun token 值不符
   （token 总是注入所以正常情况无影响），后续统一清理。
3. **撤销不校验当前 Vault**：`revoke` 用笔记自身记录的 vaultRoot；切换 Vault 后仍可撤销
   旧 Vault 的文件——有 SHA256 守门，不会误删数据，仅语义意外。
4. **公共载荷带绝对路径**（vaultRoot、trashPath、session cwd）：仅本地已认证 UI 可见，
   截图/日志外发时注意脱敏。
5. **`existingDirectory` 目录替换竞态**：已由 realpath 逃逸复查兜底；彻底修复需要 openat
   式目录 fd，Node 不提供，记为残留风险。
6. **审批前不回显 Markdown**：approve 只回传哈希，面板尚未渲染「将要写入的原文」预览；
   想要「看过才批」体验需单独实现（当前边界：审批哈希已绑定最终渲染结果）。
