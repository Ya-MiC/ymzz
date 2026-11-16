# 湛箴_ymzz

**以完整 DeepSeek Harness 為底、透過原生插件擴充的本機優先智能體發行版；不重寫 runtime、不改原生元件位置。**

> 深淵的清澈的水，纂刻于竹篾上的痕，珍重微小，有所依據，立傳傳世

[English](README.md) · [發佈頁](https://github.com/Ya-MiC/ymzz/releases) · [路線圖](ROADMAP.md)

目前是 **M1 倉庫基礎**，不是成品交付。本 fork 尚未通過 M2 基線，沒有已驗收的 湛箴_ymzz Windows 安裝包；品牌／四主題／新增插件尚未套入應用程式。預裝 ymzz 插件：**尚無**。

| 平台 | 狀態 |
|---|---|
| Windows x64 | v0.1.0 發佈後填 Release 連結；尚未發佈／驗收 |
| macOS | 計劃中，不在 v0.1 保證範圍 |
| Linux | 計劃中；上游沒有 Linux 桌面發行目標 |
| 從原碼運行（任意系統） | 以下為真實上游入口，但本 checkout 的 M2 尚未驗證 |

需要 Node ≥24.9、Git ≥2.26 與 Corepack 啟用的 pnpm **11.28.5**（依未修改的根 packageManager）。在根目錄執行：

```sh
pnpm install
pnpm run build:artifacts
pnpm dsh web --no-open --port 3081
```

DSH 預設資料在 `~/.dsh`，開發時請設定產品獨立 `DSH_HOME`。沒有附模型金鑰，也沒有做 live／付費推論。未設定 provider 不能說模型已可用。

## 稟冊與舊成果都保留

[稟冊／Loop](https://ya-mic.github.io/ymzz-loop/) 是另一款 Tauri 本機個人工作稟報／檔案管理產品；檔案、對話、復盤進度、暱稱引導與原有安裝包／網站不刪、不搬走、不冒充本 Agent 已整合。

[稟冊引導](https://bingce.yanmingx0215.filegear-sg.me/#onboarding) · [原倉庫及草稿下載](https://github.com/Ya-MiC/ymzz-loop/releases) · [舊整合倉庫](https://github.com/Ya-MiC/ymzz-zhanzhen) · [真實核對結果](ymzz/docs/LEGACY-PRODUCTS.md)

只維護一個 `master`；不改 `@deepseek-ai/*` 包名。新增內容在 `ymzz/` 與 `packages/ymzz/`；[原 README 原文](ymzz/docs/upstream/README.md) 保留。官網與一鍵維護者審核更新尚未上線；支付由作者自己接入。

[全部來源](ymzz/docs/RESOURCES.md) · [同步上游](ymzz/docs/UPSTREAM-SYNC.md) · [網路清單](ymzz/docs/NETWORK.md) · [發版閘](ymzz/docs/RELEASING.md)

基於 DeepSeek Harness（MIT），**非 DeepSeek 官方產品**。DSH LICENSE／第三方 notices 原樣保留；新增程式碼 MIT，使用者原圖不因放進倉庫就被重新授權為 MIT。原生第三方套件不能一律改標 MIT。
