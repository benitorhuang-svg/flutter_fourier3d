# Fourier 3D Synthesis 專案章程 (Constitution)

## 核心原則 (Core Principles)

### I. 沉浸式視覺體驗優先 (Immersive Visual Priority)
**使用者意圖**：使用者來到此平台，期望看到的是令人驚豔的現代化視覺藝術，而不僅僅是一個學術工具。
- 所有的 UI/UX 設計都必須以美學與視覺衝擊力為首要考量。
- 必須廣泛運用玻璃擬物化 (Glassmorphism, `glass-card` 樣式類別)、環境光暈 (Glow effects) 以及流暢的微動畫 (Micro-animations)。
- 使用者介面必須呈現極致的質感 (Premium)、現代感，且對使用者的操作有高度的即時反饋。

### II. 集中化的狀態管理與資料流 (State Management & Data Flow)
**使用者意圖**：使用者在調整螢幕上的頻率參數時，期望畫面上的 3D 圖形與 UI 數值能瞬間同步，完全感受不到任何卡頓或不同步的割裂感。
- 應用程式的狀態必須全面交由 `nanostores` 進行嚴格集中管理。
- 介面組件 (Astro 靜態渲染、React 互動組件) 與 3D 引擎 (Three.js WebGL 畫布) 必須「獨立」訂閱這些狀態庫。
- 絕對禁止透過直接操作 DOM (Direct DOM manipulation) 來強制同步不同組件間的狀態。

### III. 關注點分離：Astro 與 Three.js (Separation of Concerns)
**使用者意圖**：確保系統具備高可維護性與擴充性，當開發者未來需要新增 UI 面板時，絕不會干擾或拖慢核心的 3D 渲染運算。
- **Astro**：專職負責網頁總體佈局、靜態路由、SEO 優化、樣式渲染 (Tailwind CSS)，以及基於 HTML DOM 的各項 UI 組件。
- **Three.js**：獨家負責 WebGL 3D 畫布渲染、音頻反應幾何體 (Audio-reactive geometry) 的動態變換算繪，以及高階攝影機鏡頭運鏡控制。
- 兩者之間的唯一溝通橋樑，僅能是 `nanostores` 所共享的全域觀測狀態。

### IV. 音頻反應深度與頂尖效能 (Audio Reactivity & Performance)
**使用者意圖**：使用者在分析複雜的音軌或高頻率的麥克風即時輸入時，期望畫面如絲綢般滑順，任何掉幀都會徹底破壞他們的音樂節奏沉浸感。
- 系統深度依賴 `fft.js` 與瀏覽器原生 Web Audio APIs 來進行快速傅立葉轉換。
- 音訊處理與 Three.js 渲染迴圈必須在數學運算上做到極致最佳化，確保在各種標準裝置上皆能穩定地維持 60 FPS (Frame Per Second)。

### V. 鍵盤操作優先：「把軟體當樂器彈」 (Keyboard-First Navigation)
**使用者意圖**：對於專業視覺藝術家或 VJ 來說，全螢幕展演中動用滑鼠來點擊設定是非常破壞氛圍且極易分心的。他們需要能用語音與肌肉記憶瞬間操作軟體。
- 所有的核心控制功能都必須提供相對應的鍵盤快捷鍵。
- 模式切換：`1` (手動合成模式), `2` (音頻實時分析模式), `3` (自動繞軌/劇院模式)。
- 鏡頭與視角調整：`Space` (2D平視 / 3D立體 切換), `R` (重置相機至初始視角), `O` (開啟/關閉相機自動環繞)。
- 沉浸感與介面控制：`I` (隱藏所有操作 UI 介面), `S` (顯示或收闔控制面板), `F` (切換全螢幕)。

## 技術堆疊與限制條件 (Technology Stack & Constraints)

- **核心框架 (Core Framework)**：Astro v5
- **樣式系統 (Styling)**：Tailwind CSS v4 搭配純 Vanilla CSS 自訂設計系統變數 (`src/styles/tokens.css`)。
- **3D 渲染核心 (3D Engine)**：Three.js v0.183+
- **音訊解析運算 (Audio Processing)**：`fft.js` 擔任演算法核心，負責將時域訊號轉為頻域數據庫。
- **狀態管理與派發 (State Management)**：`nanostores`
- **漸進式網頁應用體驗 (PWA & Offline)**：Vite PWA plugin 與 workbox-window，提供離線快取與本地應用體驗。
- **資料庫 (Database)**：無。**金融市場數據 (Market Data) 相關功能與定位已永久廢棄**。本專案現已嚴格定位為純粹的「數學幾何與視覺音訊合成領域」。

## 開發與迭代工作流程 (Development Workflow)

1. **設計先行 (Design First)**：開發新功能或元件前，必須先使用 Tailwind 建構出靜態模板，驗證其美學設計與動畫細節是否符合系統的頂級質感標準。
2. **全域狀態整合 (Global State Integration)**：撰寫實作邏輯前，必須優先規劃並定義好對應的 `nanostores` store state 結構。
3. **組件橋樑 (Component Bridging)**：實作整合時，確保 Astro/UI 面板與 Three.js 實體端都是透過相同的狀態庫進行「獨立雙向更新」，絕不可互相跨界呼叫。
4. **效能驗證 (Performance Testing)**：在極端的音訊分析負載情境下（如多聲道、高取樣率）進行壓力測試，確保 Three.js 影格更新率不被運算瓶頸中斷。
5. **全尺寸裝置支援 (Universal Support)**：強制驗證桌面版 (能展開雙側浮動面板) 與手機版 (優雅的垂直堆疊收納) 的排版適應能力，排版必須保持完美無瑕。

## 治理與協作規範 (Governance)

- 所有的程式碼交付與審查 (Pull Requests) 都必須嚴格遵循並檢驗 UI 效能標準，絕不允許合併任何可能導致畫面掉幀卡頓 (Frame drops) 或是造成記憶體洩漏 (Memory Leaks) 的實作。
- 任何新增的邏輯、表單或互動介面，**絕對不可以**攔截或破壞既有全域的快捷鍵導覽體驗。
- 一律優先以讀取 `.specify/memory/` 目錄內的文檔來作為 AI 系統的協作上下文核心 (System prompt context)，讓未來每個助手都能快速理解系統演化脈絡，確保開發方向不會偏離軌道。

**文件版本 (Version)**：1.0.1 | **批准定稿日期 (Ratified)**：2026-02-22 | **最後修訂紀錄 (Last Amended)**：2026-02-22
