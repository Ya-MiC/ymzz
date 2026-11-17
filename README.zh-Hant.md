# 湛箴_ymzz

**完整 DSH 智能體＋少量原生插件；換名字、使用者圖標與溫潤四主題，不重寫運行時，不改原生元件位置。**

> 深淵的清澈的水，纂刻于竹篾上的痕，珍重微小，有所依據，立傳傳世

[官網](https://ya-mic.github.io/ymzz/) · [English / 完整插件表](README.md) · [Releases](https://github.com/Ya-MiC/ymzz/releases)

## 下載與真實狀態

- Windows x64：**尚未發佈**。v0.1.0 發佈後填 Release 連結；打包、真實 GUI 與授權閘尚未通過，不提供舊 Tauri 安裝包冒充。
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

原生對話、檔案／工作區面板、模型設定與插件系統都留在原位。工作區操作不是 OS／網路沙盒；本機真模型、Windows 目錄選擇器 GUI、EXE/PE圖標與安裝流程仍未完成資格驗證。更新只有暫存，不冒充已安裝／一鍵重啟；正式公鑰與通道尚未配置。支付由作者自己處理。

## Loop 是另一個已完成的產品

[Loop](https://ya-mic.github.io/ymzz-loop/) 是**獨立、已完成的專案管理產品**；這裡只借鑑其官網呈現風格，不匯入其運行時、不合併其 Tauri 軟體、不遷移資料、不取代下載。既有稟冊等其他軟體仍保留在原處；歷史安裝包不等於本 Agent 安裝包。

## 尚待決定的 Windows 發佈阻擋

[完整證據與最小變更提案](ymzz/docs/WINDOWS-BLOCKERS.md)：上游未簽署 Windows 仍強制要求真實 HTTPS 更新政策服務；目前允許清單不含修改此政策。實際圖片／Office／Electron 原生依賴含 LGPL/MPL，不把它們誤稱 GPL/AGPL，但也不能偷偷放寬既有 permissive-only 閘。未驗收、未發 Release。

[基線證據](ymzz/docs/evidence/m2-baseline.json) · [真實 DSH 任務證據](ymzz/docs/evidence/full-dsh-product-web.json) · [網路與關閉控制](ymzz/docs/NETWORK.md) · [來源索引](ymzz/docs/RESOURCES.md)

基於 DeepSeek Harness（MIT），**非 DeepSeek 官方產品**。新增程式為 MIT，保留原作者與第三方實際授權聲明。
