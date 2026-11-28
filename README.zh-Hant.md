# 湛箴_ymzz

**完整 DSH 智能體＋少量原生插件；換名字、使用者圖標與溫潤四主題，不重寫運行時，不改原生元件位置。**

> 深淵的清澈的水，纂刻于竹篾上的痕，珍重微小，有所依據，立傳傳世

[官網](https://ya-mic.github.io/ymzz/) · [English / 完整插件表](README.md) · [Releases](https://github.com/Ya-MiC/ymzz/releases)

## 內容綁定的驗收 Harness

真正測試 → 人工驗收收據 → 記憶前檢查內容未變 → 可離線檢查的 metadata 膠囊。增量在既有 DSH 插件內，保留原生版面／逐次授權與四 Wenrun 主題；不另造 AGH runtime、不加付費模型或自動執行。[已實作流程、安全界限與重現測試](ymzz/docs/HARNESS.zh-Hant.md)。Windows Release 的對應源碼材料門禁仍獨立保留。

## 普通用戶：安裝與首次使用

**目前沒有已驗收、已公開的桌面安裝包可下載。** [Releases](https://github.com/Ya-MiC/ymzz/releases) 現有公開項目是 `plugin-v0.1.0`（插件包，不是桌面安裝程式）與 `v0.1.0-alpha.1`（源碼階段預覽，無安裝包）。未驗收的桌面 canary 已改為 draft，不是公開下載入口；GitHub「Source code (zip)」也不是安裝程式。正常交付應是通過發版閘的 Windows x64 NSIS `.exe`、SHA256 與匹配的第三方聲明／源碼材料，**不是叫普通用戶先裝 Git、Node、pnpm**。不要把獨立 Loop／稟冊的安裝包拿來安裝本 Agent。

待真正發佈合格安裝包後：安裝並開啟「湛箴_ymzz」→ 沒有 provider 可先依原生畫面選 **Add API Key → Set up later** → 設暱稱、選工作區 → 要執行真人模型任務時，再於原生 Settings/Models 明確配置 provider。跳過設定不會自動產生可用模型；Google 指南與本機 Sheets 是離線功能，不取代既有 Office 轉換。

### 現在的資格狀態

- Windows x64：**尚未發佈**。官方 Electron/NSIS 安裝包已實際建置並裝入中文空格路徑，隨包 Node 已執行；舊基線44709191875的實際 GUI／四主題／設定／插件、正式選入的來源版 Office／Sharp／NumPy 已通過，但整輪 source/material 閘失敗；它不能驗收新增 Sheets／harness，最新版本仍需獨立 Windows 與完整材料資格。不提供舊 Tauri 安裝包冒充。
- macOS / Linux 桌面版：計劃中，不在 v0.1 保證範圍。
- 已驗證：完整上游8個 artifacts 建置閘、受驗證 HTTP200、真正 DSH Agent Loop 的工具逐次核准／真實測試失敗→修復→通過／差異驗收、還原、確認記憶。模型 transport 明確是假模型，未做 live／付費／NIM 推論。

## 僅開發者：從原始碼執行

建議 Node **24.22.1**（上游最低24.9）、Git≥2.26、Corepack pnpm11.28.5。這是開發者 source run，**不是普通用戶安裝包**：

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build:artifacts
corepack pnpm exec node ymzz/scripts/dev.mjs --no-open --port 3081
```

開啟本機輸出的私人啟動連結；不要公開 token。資料預設放 `~/.ymzz`，可用 `YMZZ_HOME` 指定。原生 `pnpm dsh web` 仍保留其原有 `DSH_HOME` 行為。

## 已接入的插件

單一私有 workspace 包 `@ymzz/dsh-product`，由完整 DSH 原生組合載入：品牌/sidebar 既有插槽、雲箋淺／雲箋暗／陶土淺／陶土暗、9個固定來源的指令技能、官方 agents/tools/approval 的有界任務與人工差異驗收／記憶、本機 OpenAI 相容設定、經簽署清單的更新暫存與暫存還原。

原生對話、檔案／工作區面板、模型設定與插件系統都留在原位。首次啟動可依原生畫面選 **Add API Key → Set up later**，再設定暱稱，不用捏造金鑰。工作區操作不是 OS／網路沙盒；本機真模型、Windows 原生目錄選擇器 GUI 仍未驗證，沒有宣稱 live 推論。更新只有暫存，不冒充已安裝／一鍵重啟；正式公鑰與通道尚未配置。支付由作者自己處理。

## Google 網頁指南與 Univer 本機試算表

在既有「湛箴_ymzz 插件」內展開「Google 網頁指南與 Univer 試算表」。Google Modern Web Guidance 原已內附 209 份鎖定版本指南；新增離線搜尋、分段查閱及兩個仍逐次核准的代理唯讀工具，不執行上游的 `npx @latest`。Univer 1.5.2 開源 Sheets Core 提供可編輯試算表、公式與本機 JSON 開啟／下載；無自動儲存或上傳，不把 XLSX/PDF、協作伺服器與 Pro 功能算作此次接入。

[來源、授權、操作與驗收範圍](ymzz/docs/GOOGLE-UNIVER.zh-Hant.md)。Sure 只作產品參考，不搬入其 AGPL 程式。既有 Office 轉換工具、原生 DSH 與獨立 Loop 均不替換。

## Loop 是另一個已完成的產品

[Loop](https://ya-mic.github.io/ymzz-loop/) 是**獨立、已完成的專案管理產品**；這裡只借鑑其官網呈現風格，不匯入其運行時、不合併其 Tauri 軟體、不遷移資料、不取代下載。既有稟冊等其他軟體仍保留在原處；歷史安裝包不等於本 Agent 安裝包。

## Windows 發佈資格與具體阻擋

[完整證據](ymzz/docs/WINDOWS-BLOCKERS.md)：作者於 **2026-11-17 15:04 KST** 明確批准兩處 unsigned 打包判斷，以及實際 LGPL/MPL 元件合規分發；signed 版本仍嚴格要求有效 HTTPS 政策服務，沒有偽造端點。已準備實際來源／原始授權材料，第三方沒有改標 MIT。

目前不再把舊 NumPy GCC runtime 或 Office0.2.3 API 當作正在發行的版本：實包已採來源建置、無 GNU runtime 的 NumPy，與來源建置0.1.3＋明示 MPL resolver patch 的 Office；不代表官方未改動0.1.3，也不是把0.1.3冒充0.2.3來源。

本輪真正補齊並 rehash：libvips28個實際 constituent、原始 recipe 與353個 Rust crate；Core下載清單98個 external 原始碼 archive，另51個由原生 configure 明確停用的 fonts／Java／Python／lxml 項逐一核對；85個 native preferred source 比對原 manifest。來源材料實體已保留，並接入可選的 installed/source 驗證；**這不是全局商用許可蓋章、新版 Windows GUI 成功或已能公開下載**。正式閘已改查 post-selector 真實安裝依賴圖，完整 native／材料條件不放寬。[重現方法／實際 hash 與界限](ymzz/compliance/REBUILD.md)。

發佈閘維持 fail-closed；目前沒有已驗收、已公開的桌面安裝包。公開 Releases 現有 `plugin-v0.1.0` 與 `v0.1.0-alpha.1`，前者是插件包、後者是無安裝包的源碼預覽；未驗收的桌面 canary 已改為 draft，不再公開下載。標準安裝與上游 protocol handler 會產生正常 OS／使用者登錄項，不宣稱完全不寫登錄檔；沒有自訂 registry 修改腳本。

[基線證據](ymzz/docs/evidence/m2-baseline.json) · [真實 DSH 任務證據](ymzz/docs/evidence/full-dsh-product-web.json) · [網路與關閉控制](ymzz/docs/NETWORK.md) · [來源索引](ymzz/docs/RESOURCES.md)

基於 DeepSeek Harness（MIT），**非 DeepSeek 官方產品**。新增程式為 MIT，保留原作者與第三方實際授權聲明。

<details>
<summary>歷史資格紀錄（已被上方最新狀態取代，保留作證據）</summary>

## 歷史 Windows 安裝後 GUI 任務證據

[實際測量與雜湊](ymzz/docs/evidence/windows-44035093932/README.md)：正式 Electron/NSIS 安裝至中文空格路徑，7個真實 PE 圖標 frame、隨包 Node、暱稱／About、**12次 GUI 工具核准、兩次真實失敗→修復→通過、人工驗收、1筆明確記憶與還原均通過**。模型是明確假 transport，不是 live 推論。主題 UIA 選項未提交、原生設定後段未執行，授權與對應來源仍阻擋發佈；不宣稱整體通過，不提供未驗收 EXE。

## 後續資格驗證狀態

[實際安裝44098435114](ymzz/docs/evidence/windows-44098435114/README.md) 已正式建置／安裝新 Agent 的 NSIS 包、再次通過真實 GUI 任務，且**實際隨包 MIT XSL 雜湊及原生 RNG/XSD Schematron 擷取／斷言均通過**。整體 GUI 仍未通過：測試對已收合選單多呼叫 Collapse，在鍵盤選主題前便中止；沒有宣稱主題／設定通過。

[單一後續44101906821](https://github.com/Ya-MiC/ymzz/actions/runs/44101906821)，確切候選 `ff465dd39987ecf14e97e374bf531d622d45b889`，已移除該無效操作，保留真實鍵盤焦點與原色票畫素檢查。另有獨立的 LGPL 來源重建／重連結檢查，不替代 Agent 建置。已準備**沒有安裝包的私人 draft Release**；GUI 與來源／政策閘尚未清除，所以公開安裝包仍不可下載，不冒充交付完成。[精確來源／授權狀態](ymzz/docs/LICENSE-FOLLOWUP.md)。Loop 是另一個獨立產品，未修改。


##2026-11-18 KST 最新實測，不冒充交付完成

[安裝後44210430029證據](ymzz/docs/evidence/windows-44210430029/README.md)：四套主題的真實滑鼠／鍵盤操作，以及原色票背景、強調色畫素均已通過；實際完整 DSH GUI 任務、驗收／記憶／還原再次通過。**Office 原生0.2.3亦用實際 app.asar 與隨包 Node24.21.0 通過 PDF、PNG、ODT 文字與 Excel 公式0→5四項真實測試**，不是 mocked converter。

仍未宣稱完整 GUI／Release 通過：暗色正文的實際截圖仍低對比，已追加同步的 body/dialog 主題標記與「真正繪出原色票文字畫素」斷言；設定入口的實際 Account menu 按鈕存在，但不提供測試假定的 InvokePattern，改以真實可見且命中檢查的原生滑鼠點擊。後續原生模型／插件清單仍待這次資格驗證。

MPL 本身可商用、可收費，亦可組合不同授權；目前阻擋的是**這個確切0.2.3對應 preferred source 尚未驗證完整**，不是 Office 一概不能商用。原 NumPy DLL 的 GCC 例外範圍也未獲另行批准；另有不改正式包、保留 linalg 的 NumPy 官方內建 C fallback 候選測試，但部分線性代數可能慢至100倍，未偷偷替換。詳見 [Office 功能／商用邊界](ymzz/docs/OFFICE-COMMERCIAL.md)；公開安裝包仍不能下載，私人 draft 無附件。Loop 獨立且未修改。

</details>
