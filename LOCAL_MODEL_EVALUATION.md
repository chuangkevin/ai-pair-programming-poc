# 本地模型評測與踩雷紀錄

> 範圍：本文件只記錄《THE WEATHER THAT NEVER WAS》專案的本地 Ollama 委派。
>
> 原始素材：各模型的 HTTP 回應、生成檔案與瀏覽器截圖。
>
> 驗收判讀：由 Codex 依可重現檢查得出；與模型原文分開標示。

## 摘要

- 本次使用 3 個本地模型、12 次角色呼叫，全部 HTTP 完成，雲端子 agent 為 0。
- 這 12 次呼叫全部屬於後來被使用者否決的 v1；v2 美感重製沒有再呼叫或委派任何本地模型。
- 設計／互動提案的有效率明顯高於可直接落地的 coding patch。
- 4 次初版 coding 回應中，只有整合重試符合 patch 語法；仍需端到端驗收才抓到錯入口。
- 2 次修正角色都聲稱處理指定問題，但實際未滿足核心條件，故依「同類修正最多兩次」停止重派，由主協作者救場。
- 視覺模型能指出小字與觸控 affordance，但也會對截圖中不可見的 focus、中文字級及字型類別做錯誤推論。

## 逐次紀錄

### D01 — Art direction

- 模型：`qwen3-vl:30b-a3b-instruct`
- 任務：博物館級視覺語言、色彩、排版與 3D 焦點。
- 原始輸出事實：提出持續存在的天氣冷凝器、編目式版面、近黑／藍視覺；同時建議外部商業字型。
- 驗收判讀：**部分採用**。冷凝器與策展編目可形成獨特主題；外部字型、過度單色與行動版刪內容不符規格。
- 後續調整：改用系統字型，加入琥珀、薄荷、光譜紫，保留手機完整內容。

### D02 — Shader engineering

- 模型：`qwen3.6:35b-a3b-coding-nvfp4`
- 任務：Three.js 場景架構、shader、效能與 fallback。
- 原始輸出事實：建議單一 shader 粒子場、DPR cap、手機粒子預算、reduced motion、WebGL fallback、避免 EffectComposer。
- 驗收判讀：**方案採用**。這是本次 coding 之前最有價值的技術輸出；但後續同模型實作未忠實落實自己的方案。

### D03 — Interaction architecture

- 模型：`qwen3.6:35b-a3b-coding-nvfp4`
- 任務：捲動、模式切換、控制與無障礙。
- 原始輸出事實：提出原生捲動、IntersectionObserver、聲音預設關閉、PNG 擷取；另含 `role="application"`、自訂 gesture 與實體式 3D 控制。
- 驗收判讀：**部分採用**。採用原生捲動、Observer、聲音與擷取；駁回會破壞瀏覽器／輔具預期的角色與自訂手勢。

### D04 — Bilingual editing

- 模型：`qwen3-vl:tw`
- 任務：中英標本命名與策展語氣。
- 原始輸出事實：交付四種氣象的繁中命名與短文方向。
- 驗收判讀：**方向採用、文案重寫**。命名可用，但最終文字需統一博物館語氣、數據欄位與中英節奏。

### C01 — Weather engine initial code

- 模型：`qwen3.6:35b-a3b-coding-nvfp4`
- 任務：`src/weather-lens.js`
- 原始輸出事實：
  - 回應使用 unified diff，而非指定的 `*** Add File:`，只能機械轉換後套用。
  - GLSL 將 `vec4` 的 `floor(p)` 指派給 `vec3`。
  - `uSpectrum` 宣告後沒有作用；密度用來縮放整個座標；玻璃雨速度沒有乘上時間。
  - 模式先等待 blend 計時結束才離散切換；reduced motion 重啟可能建立多個 RAF。
- 驗收判讀：**不合格**。JavaScript 語法通過不能代表 shader 可編譯；核心四模式、參數語意與生命週期均不符規格。

### C02 — Experience initial code

- 模型：`qwen3.6:35b-a3b-coding-nvfp4`
- 任務：HTML、CSS、UI、sound、content。
- 原始輸出事實：
  - 再次使用 unified diff，非指定 patch 格式。
  - HTML 載入 `ui.js` 而非 `main.js`。
  - cleanup 用新建的空 arrow function 呼叫 `removeEventListener`，無法移除原 listener。
  - fallback／sound／lens 不完全 null-safe；中英 description 沒有完整的預設隱藏規則。
  - 視覺仍是一般 frosted card，未達指定的 editorial asymmetry。
- 驗收判讀：**不合格，僅保留局部語意結構**。

### C03 — Integration initial code

- 模型：`qwen3.6:35b-a3b-coding-nvfp4`
- 任務：package、main、favicon、gitignore。
- 原始輸出事實：使用無效 `*** File:` 指令，且漏掉 `src/main.js`。
- 驗收判讀：**直接退回**；不可套用。

### C04 — Integration retry

- 模型：`qwen3.6:35b-a3b-coding-nvfp4`
- 任務：針對 C03 的格式與缺檔重做。
- 原始輸出事實：第二次正確使用 4 個 `*** Add File:`，補齊 `main.js`。
- 驗收判讀：**patch 合格，但端到端仍未合格**。它遵守自己的檔案邊界，卻沒有發現 C02 的 HTML 仍載入 `ui.js`。
- 可重現證據：第一個 production build 的 JS 只有 0.71 kB、只轉換 5 個 modules；這是「build 成功但應用沒有進 bundle」的假成功訊號。
- 調整建議：整合角色不能只看自己負責的檔案，harness 應加 bundle 大小／Three.js import 與瀏覽器啟動檢查。

### R01 — Rendering/audio repair

- 模型：`qwen3.6:35b-a3b-coding-nvfp4`
- 任務：修正 C01 的 shader、四模式、RAF、capture 與聲場。
- 原始輸出事實：
  - 缺 `*** Begin Patch`／`*** End Patch`，含 markdown fence，且把完整檔案放在無 hunk 的 `*** Update File:` 後。
  - 聲稱「Valid GLSL」，實際仍保留同一段 `vec4 → vec3` 錯誤。
  - 仍保留模式延遲、座標乘密度、未使用 spectrum 與重複 RAF 問題。
  - 聲音仍是三個 oscillator，參數只是改頻率，沒有交付指定的生成式濾波聲場。
- 驗收判讀：**完全駁回**。這是「修正宣稱與實際 diff 不一致」的高風險案例。

### R02 — UX/RWD repair

- 模型：`qwen3.6:35b-a3b-coding-nvfp4`
- 任務：修正入口、語言、cleanup、fallback、RWD 與視覺。
- 原始輸出事實：
  - 同樣缺 patch 起訖與 hunk。
  - 仍使用模組層全域狀態；scroll/input listeners 未完整清理。
  - pointer 傳 0–1，但渲染器需要 −1–1。
  - fallback 仍以高 z-index 覆蓋整頁；中文 description 仍可能同時顯示。
  - CSS 保留一般霧面卡片、圓角與 header 漸層，和明確的 art direction 不一致。
- 驗收判讀：**駁回，僅採用展品編號與部分語意標記**。

### V01 — Desktop visual review

- 模型：`qwen3-vl:30b-a3b-instruct`
- 原始輸出事實：評分 6.8／10、`REVISE`；指出微型文字、版面重量、保存按鈕 affordance；同時聲稱看不到 focus indicator。
- 驗收判讀：
  - **採用**：提高微型資訊的可讀性、強化保存按鈕底色。
  - **駁回**：靜態截圖無法判定 keyboard focus；實測 first focus 有 2 px solid outline。主標與背景的對比也沒有模型描述的問題。

### V02 — Mobile／繁中 visual review

- 模型：`qwen3-vl:tw`
- 原始輸出事實：評分 7／10、`REVISE`；確認無水平溢出或裁切；建議 48 px 觸控目標與提高繁中標識；另聲稱 catalog 壓到主標、英文主標是無襯線，並從英文截圖推測中文主標不平衡。
- 驗收判讀：
  - **採用**：手機按鈕 46 → 48 px、提高繁中 wordmark 與數據字級。
  - **駁回**：實拍無文字重疊；主標是 serif；模型沒有看到中文主標，不能據此判定大小。
  - **補驗證**：另拍 `mobile-zh.png`，繁中／英文狀態互斥、寬度 390 = viewport 390。

## 主協作者救場內容

兩輪同類 coding 修正後停止重派，Codex 重寫：

- 合法 GLSL 粒子場與四模式時間運動。
- 可靠的 RAF／reduced-motion／dispose 生命週期。
- 程序式 Web Audio 濾波聲場。
- 無全域狀態且可完整 cleanup 的 UI。
- 明確 WebGL 探測與不遮內容的 fallback。
- 策展式非卡片化視覺系統、三斷點 RWD 與繁中實拍。

這些不是本地模型成功產出，不能歸功給模型；模型貢獻集中在概念、局部結構與審查提示。

## v1 視覺否決與 v2 重製

> 原始素材：使用者對 v1 的直接驗收結果為「很醜」；v1 截圖與上述 D／C／R／V 呼叫紀錄。
>
> 驗收判讀：以下原因分析與改善方向為 Codex 的判讀，不是使用者或本地模型原話。

v1 雖通過 build、WebGL、RWD、操作與本地 VL 截圖檢查，仍被最終人工美感驗收否決。主要問題是：高亮菱形粒子像碎紙、中央不透光黑球與圓環像通用 3D demo、閃電由方塊／線段拼成、大片霧面卡片遮住氣象主體。這證明「能執行」與「看起來高級」是兩個獨立閘門，也證明 VL 的 6.8／7 分與局部修正建議不足以驗證品味。

v2 美感重製由 Codex 單獨完成，沒有把藝術指導、shader 造型、版面取捨或截圖審美再委派給本地模型。具體替換如下：

- 移除黑球、圓環與亮色菱形；改為全螢幕程序式大氣 shader。
- 玻璃雨改成細線雨痕、低雲與折射；磁性霧改成流場霧；逆向閃電改成向上分岔的銳利光核；潮汐極光改成低飽和簾幕。
- 介面退到邊緣，移除焦點區的大型霧面卡片，以方向性暗幕維持文字可讀性。
- 修正 transition 真實時間、殘影清除、低 FPS 下前一模式殘留、方格星點與 shader 負擔。
- 重新以 1440、820、390 三種 viewport 逐張人工檢查，並保留 no-WebGL、reduced-motion、keyboard 與繁中互斥驗證。

後續 harness 必須新增一個不能被自動分數取代的人工美感閘門：先判斷主視覺是否具有明確構圖與材質語言，再看功能分數。若使用者要求美感由主協作者負責，該階段不得外包給模型；本地模型紀錄只能作為歷史證據，不能包裝成 v2 貢獻。

## 最終可重現驗收

- `npm run build`：11 modules，Three.js 進入正式 bundle；JS 138.45 kB gzip。
- `npm audit`：0 vulnerabilities。
- 1440 × 900、820 × 1180、390 × 844：document／scroll container 寬度等於 viewport。
- WebGL 2.0、0 page errors、0 shader compile errors。
- 模式切換、繁中、聲音、三參數與 PNG capture 通過。
- 無 WebGL：fallback 顯示但 `pointer-events: none`，HTML 展覽與語言仍可用。
- Reduced motion：700 ms 閒置畫面一致；切到模式 3 後畫面更新。
- Keyboard：第一個焦點為 skip link，2 px solid outline 且位於 viewport。

證據：

- [browser-results.json](screenshots/browser-results.json)
- [edge-results.json](screenshots/edge-results.json)
- [desktop.png](screenshots/desktop.png)
- [mobile-zh.png](screenshots/mobile-zh.png)

## 下次 prompt／harness 調整

1. 不再把「輸出 patch」與「寫完整大檔」同時交給模型；先要求 JSON 檔案內容，再由 harness 產生 patch。
2. 嚴格 parser：無 patch 起訖、非法 directive、markdown fence 立即 fail，不做人工猜測。
3. Shader 必須在真實 WebGL context 編譯；`node --check` 不足。
4. Build gate 加上 module 數與 bundle 下限，避免 0.71 kB 假成功。
5. 修正任務要要求模型逐條引用「修前問題 → 修後行號／行為」，再由 deterministic check 對照。
6. 視覺模型只能評論畫面中可見狀態；focus、hover、未切換語言不得靠推測。
7. 對本模型較合適的任務：art direction、方案比較、局部函式、截圖初篩；完整多檔整合必須有強 harness。
