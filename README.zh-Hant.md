# 湛箴_ymzz

**完整 DSH 智能體＋少量原生插件；換名字、使用者圖標與溫潤四主題，不重寫運行時，不改原生元件位置。**

> 深淵的清澈的水，纂刻于竹篾上的痕，珍重微小，有所依據，立傳傳世

[官網](https://ya-mic.github.io/ymzz/) · [English / 完整插件表](README.md) · [Releases](https://github.com/Ya-MiC/ymzz/releases)

## 下載與真實狀態

- Windows x64：**尚未發佈**。官方 Electron/NSIS 安裝包已實際建置並裝入中文空格路徑，隨包 Node 已執行；完整安裝後 GUI／任務的後續資格驗證仍在進行，授權發佈閘尚未清除。不提供舊 Tauri 安裝包冒充。
- macOS / Linux 桌面版：計劃中，不在 v0.1 保證範圍。
- 已驗證：完整上游8個 artifacts 建置閘、受驗證 HTTP200、真正 DSH Agent Loop 的工具逐次核准／真實測試失敗→修復→通過／差異驗收、還原、確認記憶。模型 transport 明確是假模型，未做 live／付費／NIM 推論。

## 三步從原始碼執行

需要 Node≥24.9、Git≥2.26、Corepack pnpm11.28.5：

```sh
pnpm install
pnpm run build:artifacts
pnpm exec node ymzz/scripts/dev.mjs --no-open --port 3081
```

開啟本機輸出的私人啟動連結；不要公開 token。資料預設放 `~/.ymzz`，可用 `YMZZ_HOME` 指定。原生 `pnpm dsh web` 仍保留其原有 `DSH_HOME` 行為。

## 已接入的插件

單一私有 workspace 包 `@ymzz/dsh-product`，由完整 DSH 原生組合載入：品牌/sidebar 既有插槽、雲箋淺／雲箋暗／陶土淺／陶土暗、9個固定來源的指令技能、官方 agents/tools/approval 的有界任務與人工差異驗收／記憶、本機 OpenAI 相容設定、經簽署清單的更新暫存與暫存還原。

原生對話、檔案／工作區面板、模型設定與插件系統都留在原位。首次啟動可依原生畫面選 **Add API Key → Set up later**，再設定暱稱，不用捏造金鑰。工作區操作不是 OS／網路沙盒；本機真模型、Windows 原生目錄選擇器 GUI 仍未驗證，沒有宣稱 live 推論。更新只有暫存，不冒充已安裝／一鍵重啟；正式公鑰與通道尚未配置。支付由作者自己處理。

## Loop 是另一個已完成的產品

[Loop](https://ya-mic.github.io/ymzz-loop/) 是**獨立、已完成的專案管理產品**；這裡只借鑑其官網呈現風格，不匯入其運行時、不合併其 Tauri 軟體、不遷移資料、不取代下載。既有稟冊等其他軟體仍保留在原處；歷史安裝包不等於本 Agent 安裝包。

## Windows 發佈資格與具體阻擋

[完整證據](ymzz/docs/WINDOWS-BLOCKERS.md)：作者於 **2026-11-17 15:04 KST** 明確批准兩處 unsigned 打包判斷，以及實際 LGPL/MPL 元件合規分發；signed 版本仍嚴格要求有效 HTTPS 政策服務，沒有偽造端點。已準備實際來源／原始授權材料，第三方沒有改標 MIT。

目前仍有兩項**新的精確問題**，不是重複原先 LGPL 異議：

1. 隨包 NumPy 2.3.5 Windows 的 OpenBLAS DLL 含靜態 GCC runtime，原始聲明為 **GPL-3.0-or-later WITH GCC-exception-3.1**。這個例外不等於普通 GPL，也不把產品改成 GPL；但仍超出已批准的 LGPL/MPL 範圍，沒有偷偷放行。原始聲明、確切 wheel／DLL 雜湊與實際包檢查皆已加入。
2. LibreOffice API 0.2.3 的 npm 包只有編譯後 JS／宣告、缺少 TypeScript 實作；可取得的公開 preferred-source 版本仍為 0.1.3，不能拿舊版冒充匹配來源。0.2.3 native engine 已附修改過的 C++ 原始碼，不能誤稱全部缺失；API 對應來源完整性仍未確認。

發佈閘維持 fail-closed；未公開未驗收 EXE，也未發 Release。標準安裝與上游 protocol handler 會產生正常 OS／使用者登錄項，不宣稱完全不寫登錄檔；沒有自訂 registry 修改腳本。

[基線證據](ymzz/docs/evidence/m2-baseline.json) · [真實 DSH 任務證據](ymzz/docs/evidence/full-dsh-product-web.json) · [網路與關閉控制](ymzz/docs/NETWORK.md) · [來源索引](ymzz/docs/RESOURCES.md)

基於 DeepSeek Harness（MIT），**非 DeepSeek 官方產品**。新增程式為 MIT，保留原作者與第三方實際授權聲明。

## 最新 Windows 安裝後 GUI 任務證據

[實際測量與雜湊](ymzz/docs/evidence/windows-44035093932/README.md)：正式 Electron/NSIS 安裝至中文空格路徑，7個真實 PE 圖標 frame、隨包 Node、暱稱／About、**12次 GUI 工具核准、兩次真實失敗→修復→通過、人工驗收、1筆明確記憶與還原均通過**。模型是明確假 transport，不是 live 推論。主題 UIA 選項未提交、原生設定後段未執行，授權與對應來源仍阻擋發佈；不宣稱整體通過，不提供未驗收 EXE。

## 後續資格驗證狀態

[實際安裝44098435114](ymzz/docs/evidence/windows-44098435114/README.md) 已正式建置／安裝新 Agent 的 NSIS 包、再次通過真實 GUI 任務，且**實際隨包 MIT XSL 雜湊及原生 RNG/XSD Schematron 擷取／斷言均通過**。整體 GUI 仍未通過：測試對已收合選單多呼叫 Collapse，在鍵盤選主題前便中止；沒有宣稱主題／設定通過。

[單一後續44101906821](https://github.com/Ya-MiC/ymzz/actions/runs/44101906821)，確切候選 `ff465dd39987ecf14e97e374bf531d622d45b889`，已移除該無效操作，保留真實鍵盤焦點與原色票畫素檢查。另有獨立的 LGPL 來源重建／重連結檢查，不替代 Agent 建置。已準備**沒有安裝包的私人 draft Release**；GUI 與來源／政策閘尚未清除，所以公開安裝包仍不可下載，不冒充交付完成。[精確來源／授權狀態](ymzz/docs/LICENSE-FOLLOWUP.md)。Loop 是另一個獨立產品，未修改。
