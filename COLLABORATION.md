# Local LLM Pair Programming Record

## 分工邊界

- **本地模型（v1）**：視覺方向提案、Three.js／互動方案、初版程式碼、修正提案、截圖審查。
- **Codex 主協作者（v1）**：需求定義、角色拆分、衝突取捨、patch 驗證、跨檔整合、瀏覽器驗收、第二次失敗後救場。
- **Codex 單獨完成（v2）**：使用者否決 v1 美感後，重新設計 shader、氣象造型、構圖、介面層級與逐張截圖審美；這一階段沒有呼叫本地模型，也沒有把美感交給子 agent。
- **執行限制**：所有委派均直接呼叫 `http://10.11.1.67:11434` 的 Ollama；雲端子 agent 數量為 0。

## 非同步角色波次

1. **設計波次（4 個並行角色）**
   - Art director — `qwen3-vl:30b-a3b-instruct`
   - Shader engineer — `qwen3.6:35b-a3b-coding-nvfp4`
   - Interaction architect — `qwen3.6:35b-a3b-coding-nvfp4`
   - Bilingual editor — `qwen3-vl:tw`
2. **初版實作波次（3 個並行角色）**
   - Weather engine、experience layer、integration — `qwen3.6:35b-a3b-coding-nvfp4`
3. **缺陷修正波次（2 個並行角色）**
   - Rendering/audio repair、UX/RWD repair — `qwen3.6:35b-a3b-coding-nvfp4`
4. **視覺驗收波次（2 個並行角色）**
   - Desktop/lab review — `qwen3-vl:30b-a3b-instruct`
   - Mobile/Traditional Chinese review — `qwen3-vl:tw`

## v1 採用的本地模型決策

- 以持續存在的「天氣冷凝器」作為跨章節 3D 焦點。
- 一個自訂 shader 粒子場承載四種氣象狀態，不使用後製套件。
- 原生垂直捲動搭配 IntersectionObserver。
- 音效預設關閉、只在點擊後建立 AudioContext。
- DPR 與手機粒子量上限、reduced-motion 靜態畫面、WebGL fallback。
- 博物館編目、儀器讀數與中英雙語策展語氣。

## 駁回或改寫的決策

- 付費／外部字型與 generic Inter。
- 手機刪除副標或內容以換取空間。
- `role="application"`、自訂滑動／縮放手勢與只有 3D 實體旋鈕的控制。
- 僅黑藍單色的視覺方案；改為礦物琥珀、氧化薄荷與光譜紫作模式色。
- 本地 coding 模型兩輪仍未修正的 shader、生命週期、語言狀態與 RWD 問題。

完整逐次證據與失敗分類見 [LOCAL_MODEL_EVALUATION.md](LOCAL_MODEL_EVALUATION.md)。

## v2 美感重製邊界

v1 的「黑球＋圓環＋高亮粒子＋霧面卡片」雖通過功能驗收，仍未通過使用者的美感驗收。v2 將本地模型輸出視為歷史測試資料，不沿用其造型決策：全螢幕大氣 shader 取代物件展示台，四種天氣各有不同的場、運動與材質，文字介面退到邊緣。藝術指導、實作與人工視覺取捨均由 Codex 親自完成。

這次追加的結論是：RWD、WebGL、無錯誤與 VL 分數只能證明系統可用，不能證明設計好看；美感必須保留獨立的人類最終驗收。

## 驗收閘門

```text
模型輸出
  → patch 格式／檔案範圍
  → node --check
  → npm production build + audit
  → headless Chrome WebGL runtime
  → 1440 / 820 / 390 RWD
  → 功能互動與 PNG
  → no-WebGL / reduced-motion / keyboard
  → 本地 VL 截圖初篩（v1）
  → 人工美感最終驗收
```

HTTP 200、模型自稱「已修正」與單純 build 成功都不算通過；每一層都需要獨立證據。
