# 內容綁定的驗收 Harness

[English](HARNESS.md) · [產品](../../README.zh-Hant.md)

## 本次真正完成的一條流程

**原生 DSH 任務 → 受保護 Node 測試 → 人工檢查差異驗收 → 內容收據 → 新鮮度檢查後明確記憶 → 可攜式證據膠囊。**

不重做上游已具備的 agent loop、session persistence/resume、tools、approval、provider 或 UI。改進的是既有插件的真實缺口：過去記憶只是一句泛稱成功，驗收與匯出未綁定確切內容；驗收後檔案再變動，仍可直接記住。

- 真實 gate 新增測試檔雜湊、task revision、完整有界工作區 snapshot digest、實際傳回測試輸出的 digest。每個工具照舊經官方 DSH 逐次核准，膠囊不會執行程式。
- 人工驗收照舊要求通過且新鮮的 gate／snapshot／衝突檢查，再把收據 hash 綁進本機驗收事件。事件 payload 深複製，避免日後可變陣列以 reference 改寫歷史。
- 按「記住」時再次核對所有工作區檔案、revision、gate 與事件錨點；新增／刪除／修改檔案均拒絕。記憶帶收據、snapshot 與 model transport 範圍，不再只有泛稱成功。這是本機明確記憶記錄，**不是自動訓練／模型檢索，也不是永久背景監控**。
- 在既有已驗收卡片新增「匯出這次驗收收據（JSON）」。需要原本登入及 CSRF 防護，並在讀檔前要求明確同意。只含相對檔名、雜湊、gate provenance、一個本機驗收錨點；不含檔案內容、絕對工作區路徑、暱稱、prompt 或 credentials。不自動分享／上傳。
- 匯出明示目前工作區匹配、已變動、或無法重新檢查；目錄不在仍可匯出歷史收據，不能冒稱剛測試成功。記憶仍嚴格拒絕無法驗證內容。舊紀錄缺輸出 hash 會標 `legacy-result-output-hash-unavailable`，不補造證據、不刪歷史。

來源倉庫離線檢查：

```sh
node ymzz/scripts/verify-acceptance-capsule.mjs /path/to/ymzz-acceptance-ID.json
```

**這只是未簽章的本機 hash 一致性，不是身分驗證、完整全域 ledger 證明、獨立見證或外部操作完成憑證。** 同帳號惡意程式若重寫全部 hash，不在此保證內。驗證器不執行／import 膠囊內容、不連網、不讀膠囊命名的工作區、不授予工具權限；拒絕過大、格式／雜湊／錨點不符。不能把模型自述當成外部完成事實。

## Agnes 參考與刻意不同處

2026-11-20 KST 查閱：[指定頁面](https://agnes-ai.com/agnes-harness) 的可讀 fetch 為空，不臆測其視覺；改查公開官方 [README](https://github.com/AgnesAI-Labs/agnes-harness)、[FDE／插件思路](https://github.com/AgnesAI-Labs/agnes-harness/blob/main/docs/guide/why-agh.md)、[fact-chain](https://github.com/AgnesAI-Labs/agnes-harness/blob/main/docs/guide/fact-chain.md)、[安全邊界](https://github.com/AgnesAI-Labs/agnes-harness/blob/main/docs/guide/security.md)。這些是會變的 main 文件，不是已安裝受測版本。

| 公開參考方向 | 我們保留／真正新增 |
|---|---|
| 一切皆插件、FDE 整合 | 保留已有完整 DSH 插件骨架；本次做個人本機先行的驗收插件增量，不另造 SaaS |
| 持久任務／恢復 | 上游 DSH 已有，不包一層重複 loop／自動 crash replay |
| 可追溯證據／能力重用 | 人工驗收收據綁定測試內容；記憶提交前重新檢查新鮮度 |
| 交付工作臺 | 相對檔名與 hash 的單任務膠囊；歷史缺口明示，不暗藏文件內容 |
| 視覺 | 原生導覽／面板位置照舊；只在既有卡片加收據文字與按鈕，四 Wenrun 色票不變 |

沒有執行 Agnes／測模型／跑比較 benchmark，沒有複製其 code／art／brand，沒有安裝不相關 Harness8006 connector，也不宣稱 parity、速度或品質勝出。

## 實測與限制

單元回歸涵蓋 snapshot 新增／刪除／修改、test/revision/output 不符、consent／ledger／anchor、舊證據缺口、路徑／大小、收據與膠囊 tampering、unsigned 邊界；既有打包／完整性／簽章／授權測試保留。

完成 `corepack pnpm run build:artifacts` 後，POSIX 來源／CI 可跑：

```sh
python3 ymzz/scripts/test-harness-local.py --port 3092 --output /tmp/ymzz-harness-proof.json
```

使用全新私有 profile，真正完整 DSH HTTP、逐次核准、真 Node 測試失敗→修復→通過、人工驗收、只修改自己的 synthetic project 證明記憶拒絕、還原後記憶、匯出、離線驗證、竄改拒絕，最後只停止自己的 server。模型明確 deterministic fake，非 live／付費推論；不操作瀏覽器，不碰用戶專案，不上傳 token。新手動 `ymzz-harness.yml` 只上傳 synthetic JSON。既有 Windows GUI 證據早於此新功能，不冒稱新功能已通過原生 GUI。

只適用本插件有界 Node-test 任務，不自動替所有 DSH／Office／外部工具背書。沒有新增模型／backend／相依套件或網路 egress，沒有擴大工具／檔案權限、收款或自動發訊息。Loop 仍是另一個獨立已完成產品。

**Release 仍受實際 selected Office/libvips 對應源碼材料閉合門禁阻擋。** 此功能不修改授權／release clearance、不冒發舊二進位、不讓官網虛構安裝下載；商用義務及精確 Windows 完整驗收各自保留。


## 明選收據交接到下一個本機模型任務

工作區任務區預設「不附加歷史收據」。你可以明確選擇一張已驗收收據，按預覽重新讀取有界工作區、核對receipt與ledger錨點；預覽本身不請求模型。相對檔名與hash亦可能敏感，請先查看。

只有你按執行才將該metadata交到原生DSH任務的訊息內容。僅限同一工作區；啟動任務前及原生agent建立後、送出訊息前再重查。改檔、換收據、跨工作區、缺同意、壞ledger或缺anchor均拒絕，不重用預覽快取。此內容是標記為不可信的歷史資料，不是系統指令、工具核准或新任務測試結果；檔名中的文字也不是指令。只含既有相對檔名/hash、gate/model provenance，不含原始檔案、prompt、絕對工作區路徑。每次工具核准、新任務gate與人工驗收保持原樣。

這是明選一張本機收據的metadata交接，不是自動記憶檢索、跨機匯入、模型訓練或永久有效證明。Node/HTTP測試不是真實模型品質、瀏覽器點擊或Windows新功能驗收。

原生路由整合測試須在完整 artifact build 後執行：`node --test packages/ymzz/product/tests/integration/*.test.mjs`。它以 mock agent handle 測真插件，需要已建置的工作區套件；不是實際模型推論測試。
