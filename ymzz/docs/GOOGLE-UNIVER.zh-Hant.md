# Google Modern Web Guidance 與 Univer 增量接入

首爾時間（UTC+9）：2026-11-21；在既有 ymzz/master，沒有新倉庫或分支。

## 本次實際增加什麼

### Google Modern Web Guidance

[GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) 是代理技能與網頁開發指南，不是 UI 元件庫。既有 `core-skills.lock.json` 已鎖定 `4dd968349e54ca45a05dd5c818fb035c9054b022`，包括 209 份指南。本輪不是重新加入同一批檔案，也不聲稱已更新到最新網頁相容性。

新增 `web-guidance.mjs`：啟動時逐份驗 SHA256，只從已核對的記憶體參考文字搜尋與查閱。最多 8 筆搜尋結果、每次讀取最多 16000 字元；用 `nextOffset` 續讀。輸入 ID 必須是清單內的固定指南，不接受任意路徑、URL 或指令。新增 `ymzz_web_guidance_search` 和 `ymzz_web_guidance_read` 到既有任務工具，仍經 DSH 每次人工核准、選定工作區、16 工具／10 分鐘等原有限制，不寫入工作區，不繼承測試成功。代理登錄內容改指向本機唯讀工具；上游原始指南與其 Apache-2.0 授權保持不變，沒有照上游文字執行未鎖版的 CLI 安裝。

人可在原有插件內直接搜尋，例如 `accessible dialog`，再點結果讀取全文；長文按「讀取下一段」。查閱不會啟動模型。本輪新增試算表對話框亦使用原生 `dialog.showModal()`、可見關閉按鈕與原生 focus/Esc 行為，並按 `ui-components/dialog` 的「stops scroll gestures in the dialog chaining to the page」規則加入對話框與 backdrop 的 overscroll 設定；不重排 DSH 面板。

### Univer

[官方來源](https://github.com/dream-num/univer) 的開源核心採 Apache-2.0。固定 `@univerjs/presets` 與 `@univerjs/preset-sheets-core` 為 **1.5.2**，以及明確版本的 React／ReactDOM／RxJS；獨立 `ymzz/integrations/univer/package-lock.json` 鎖定依賴及 integrity。這是既有 repo 的小型前端建置目錄，不是新 repo、服務或 agent runtime；上游 DSH 的 pnpm graph 逐 byte 保持不變。新的隔離依賴另行明列，不能再宣稱整個產品沒有新增第三方依賴。

建置整合在現有產品 tsdown 的完成 hook；乾淨環境會執行本目錄 `npm ci --ignore-scripts`，只在建置時下載固定 npm 包，不執行其 lifecycle scripts。執行時使用完整本機 bundle，不載 CDN、不裝 Pro／Server SDK、不要求 Univer 帳戶或 API key。產物在 `packages/ymzz/product/lib/univer`，隨原插件的 `lib` 一起打包，含 hash provenance 和真實被 bundle 之依賴的 LICENSE／NOTICE 文字。建置會處理 `LICENCE` 拼法與 README 內的完整授權節；缺漏則使用已固定來源／SHA 的補充上游文字，缺文字或雜湊／版本漂移就拒絕建置。`ot-text-unicode` 的 npm ISC 與 README MIT 記載不一致，原文與差異一併保留；`react-remove-scroll-bar` 2.3.8 的發布 gitHead 無法讀取，補充 MIT 文字取自已釘選的上游提交，不冒稱相同源碼版本。這些補充不代表產品的再分發／發行授權閘已獲核准。

插件內點「開啟 Univer 本機試算表」。獨立於任務卡片輪詢的穩定 iframe 保留編輯狀態；關閉對話框再開不會因刷新任務列表而重建表格。**重新整理或關閉應用程式仍會失去未下載內容**。請使用「下載 JSON 保存」，並自行確認瀏覽器下載完成；「開啟本機 JSON」只讀本人選定的檔案。沒有自動儲存、雲端同步、模型直接改表或任意工作區路徑寫入。本次 JSON 格式不是 Excel／XLSX 匯入匯出；既有 Office/LibreOffice 管線保留，沒有改用本次 SDK 冒充其能力。

JSON 限制：8 MiB、16 張表、每表最多 10000 列／256 欄、共 50000 個非空格，另限制物件深度及節點數；拒絕危險原型鍵、越界座標、異常公式長度。只有通過格式／限制檢查的 JSON 才載入。

HTTP 路由與其他插件同樣要求 DSH 認證。頁面載入後的 iframe 與 CSP 同時設 `sandbox allow-scripts allow-downloads`，**不授予 same-origin／popup／父頁面存取**；每個 HTML 回應有新 nonce，`connect-src 'none'`、worker/object/form 亦封鎖。單一自包含 HTML 避免 opaque-origin 子框架另取帶憑證資產；資產 URL 僅固定白名單且核對建置 SHA。隔離頁面只是試算表，不是 OS 沙盒，不替其他 DSH 工具作安全背書。瀏覽器的系統剪貼簿等受限能力不在承諾範圍。

## Sure 僅供參考

[we-promise/sure](https://github.com/we-promise/sure) 是 AGPL-3.0 的個人財務應用；僅把自託管、直接操作資料與聊天入口作為產品流程參考。其 README 同時記錄前身商業化未能持續，不能把成熟外觀當作付費需求已證明。本輪未複製程式、素材、帳戶模型或商標，未加入 Docker／Rails／銀行同步，不把 ymzz 改造成另一個財務產品。

## 重現與誠實界線

原有 `pnpm run build:artifacts` 包括 Univer 產物建置；再跑產品 unit、`tests/integration/*.test.mjs`、既有 packaging、typecheck 及 `ymzz/scripts/test-harness-local.py`。HTTP 腳本會檢查兩項新路由的認證與 CSP，但不能證明 canvas 上的真實鍵盤編輯；瀏覽器 GUI 需另列紀錄。native route 測試用 mock agent，既有完整 DSH HTTP 使用明確 fixture transport，都不是 live 模型推論。Windows 新增功能 GUI 與所有發行資格、既有對應源碼材料閘仍獨立有效；沒有因新增 SDK 而公開安裝包或發佈 Release。
