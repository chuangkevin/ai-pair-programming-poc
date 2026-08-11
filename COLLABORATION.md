# Local LLM Pair Programming Record

## 分工邊界

- **本地模型**：視覺方向提案、Three.js／互動方案、初版程式碼、修正提案、截圖審查。
- **Codex 主協作者**：需求定義、角色拆分、衝突取捨、patch 驗證、跨檔整合、瀏覽器驗收、第二次失敗後救場。
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

## 採用的本地模型決策

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
  → 本地 VL 截圖審查
```

HTTP 200、模型自稱「已修正」與單純 build 成功都不算通過；每一層都需要獨立證據。
