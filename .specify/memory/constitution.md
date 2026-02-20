# 專案治理原則 (Governing Principles)

這份文件定義了 **Fourier 3D** 專案的基礎架構設計與開發準則。所有後續的規格 (Specs) 與實作計畫 (Plans) 均須遵守本文件的原則，以維持程式碼品質與專案的一致性。

## 1. 架構與程式碼品質 (Architecture & Code Quality)

- **語言與型別系統**: 全面使用 TypeScript (嚴格模式)，確保靜態型別安全。所有的物件、屬性存取與方法傳遞均應定義介面 (Interfaces) 或型別 (Types) 避免 `any` 的濫用。
- **原子化設計 (Atomic Module Design)**: 專案核心邏輯必須維持模組化分離。
  - `state.ts`: 負責維護全域動態變數與常數設定。
  - `geometry.ts`: 負責封裝 Three.js 群組、BufferGeometry 定義與生命週期。
  - `audio.ts`: 負責 Web Audio API 互動與頻譜資料更新演算法。
  - `ui.ts`: 負責 UI 狀態綁定與事件處理。
  - `fourier.ts` (核心層): 負責整合子模組與觸發主渲染迴圈 (`requestAnimationFrame`)。
- **避免臃腫文件**: 任何過度膨脹的單層邏輯檔案 (超過 300 行) 皆須檢討並拆分重構。

## 2. 技術選型與框架 (Tech Stack & Frameworks)

- **前端框架**: Astro (靜態站點生成與基本元件佈局結構)。
- **樣式與 UI**: Tailwind CSS (原生 Utilities + 自定義變數 `glass-card.css`)，**禁止** 依賴行內樣式 (Inline Styles) 與過多的外部 UI 元件庫以維持輕量化與高效。
- **3D 渲染與特效**: Three.js (負責核心繪圖) 搭配 `EffectComposer` (UnrealBloomPass) 處理後製發光特效。
- **PWA 與離線支援**: PWA 相關配置 (Service Worker, Manifest) 需要維持精簡，確保網頁能像 App 一樣安裝與獨立運作。

## 3. 使用者體驗 (User Experience, UX)

- **高效能渲染**: Three.js 渲染層應盡可能控制在 60 FPS 基準，善用 `InstancedMesh`、`BufferGeometry.attributes.position.needsUpdate`，避免逐影格重建幾何體。
- **響應式設計 (RWD)**: 介面元素 (特別是控制儀表板 Bottom HUD) 必須採用 Mobile-First 策略，實作如 Bottom-Sheet 等適合觸控與螢幕拖曳的互動設計。
- **沈浸式觀看設計**: 所有干擾視覺的控制項目，皆需設計「自動隱藏」或「折疊」的機制 (如 Immersive Mode)，保留最大的立體視覺空間。

## 4. 決策指引 (Decision Governance)

任何新的功能擴充（例如：載入自定義音檔、新的圖形視覺化模組等）均需：
1. 確保不破壞原有的效能平衡 (60fps)。
2. 首選擴充現有的 TypeScript 模組 (e.g. `state.ts`, `geometry.ts`)，減少耦合。
3. 遵循 Spec-Kit 開發流程：先定義 `spec.md` (What/Why) $\rightarrow$ 釐清 `plan.md` (How) $\rightarrow$ 再實作。
