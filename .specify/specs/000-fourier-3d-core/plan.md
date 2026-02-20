# 技術實作計畫：Fourier 3D 核心功能重構與建置

## 目標 (Goal)
將原有且龐大的 `fourier.ts` 依據 `.specify/memory/constitution.md` 規定的「原子化模組設計 (Atomic Design)」重構為清晰、高內聚低耦合的多個子檔案架構，並確保所有在 `spec.md` 中提及的功能都能正確地由 Astro + Tailwind + Three.js + TypeScript 環境提供支援。

## 專案目錄結構設計

### Astro 視圖層
- `src/pages/index.astro`: 應用的單一入口點，匯入全域樣式與模組化的 UI Astro Component。
- `src/components/TopNav.astro`: 負責上方全局導覽列 (標題、模式切換按鈕、全螢幕、2D/3D 特效切換)。
- `src/components/BottomHUD.astro`: 負責存放視圖特定的互動儀表版 (Cinematic/Audio/Manual Panels)。
- `src/styles/global.css`, `src/styles/glass-card.css`: 基於 Tailwind CSS 與 CSS Variables 實作的玻璃擬態 (Glassmorphism) 共用樣式。

### TypeScript 邏輯層 (src/scripts/)
以下是規劃拆分的職責：

#### `core/state.ts`
- **職責**: 管理核心應用程式狀態的單一資料來源 (Single Source of Truth)。
- **實作重點**:
  - 導出 `CONSTANTS` 包含最大諧波數量、取樣點數量。
  - 導出響應式的 `state` 物件：包含所有目前參數 `harmonics`, `phases`, `timeOffset`, 以及模式布林值 `isRadioMode`, `is2DMode` 等。

#### `core/geometry.ts`
- **職責**: 封裝所有與 Three.js `BufferGeometry` 和 `Mesh` 物件相關的操作。
- **實作重點**:
  - 導出初始化函數 `initGeometry(scene)`。
  - 維護用於 `animate` 更新之參考矩陣：`harmonicGeoms`, `sumGeom`, `epicycleSpheres` 以及 `connLines`。
  - 提供輔助函數 `updateHarmonicVisibility()` 來控制 2D/3D 切換時的顯示狀態。

#### `audio/audioManager.ts (audio.ts)`
- **職責**: Web Audio API 的擷取、播放、以及快速傅立葉變換 (FFT) 與波形映射處理。
- **實作重點**:
  - 導出綁定了 Audio element DOM 的狀態。
  - `initAudio()`, `resumeAudioContext()`, `switchStation()` 管理串流。
  - `updateAudioAnalysis()`：提取音頻資料並將之映射回 `state.harmonics` 的動態數值演算法，回傳整體能量值供時間軸偏移使用。

#### `ui/ui.ts`
- **職責**: 瀏覽器 DOM 操作、事件監聽 (Events)、以及依狀態生成動態控制面板。
- **實作重點**:
  - `setupUI(callbacks)`：傳入事件鉤子並初始化所有 `addEventListener`。
  - `createSliders()` / `updateSlidersUI()`：動態重新配置手動模式下的頻率振幅拉桿。
  - `switchMode()`：負責調配各 UI 面板的顯示隱藏和動畫。

#### `fourier.ts` (主層)
- **職責**: 將所有分離的元件結合在一起，初始化 Three.js 場景，處理畫面更新循環 (`requestAnimationFrame`)。
- **實作重點**:
  - 建立 `Scene`, `Camera`, `Renderer`, 與 `EffectComposer` (後處理發光)。
  - 呼叫 `setupUI` 並註冊 `onSwitchMode`, `onToggle2D` 等回呼行為邏輯結合 camera 移動。
  - 在 `animate()` 中：呼叫時間推移 (`timer.getDelta`)、音頻變化 (`updateAudioAnalysis`)、相機更新與幾何頂點數據改動。

## 檢查工具 (Tooling & Environment)
- 開發環境：Vite / CLI 驅動。
- 包裝工具：使用 `astro build` 將 TypeScript 編譯成純靜態網頁與 ES Modules 資產。
- 發布流程：透過 Git commit 提交並佈署。

## 審查與接受標準
- 各腳本層級間僅透過 `state.ts` 共享變數或回呼 (callbacks) 雙向溝通，嚴禁循環依賴。
- 專案使用 `npm run build` 時不能出現任何 TypeScript 編譯錯誤。
- 重構後的程式碼行為，必須與 `spec.md` 中的 User Stories 在畫面上呈現 1:1 的完美相容。
