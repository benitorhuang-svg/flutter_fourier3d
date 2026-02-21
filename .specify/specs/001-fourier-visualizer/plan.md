# 技術實作計畫：Fourier 3D 核心功能重構與建置

## 目標 (Goal)
將原有且龐大的 `fourier.ts` 依據 `.specify/memory/constitution.md` 規定的「原子化模組設計」重構，並確保 3D 渲染與狀態管理分離。

## 專案目錄結構

### Astro 視圖層
- `src/pages/index.astro`: 應用的單一入口點。
- `src/components/VisualizerCanvas.astro`: 負責 3D Canvas 容器。
- `src/components/MarketControls.astro`: 模式切換與歷史回放 UI。

### TypeScript 邏輯層 (src/scripts/)
#### `core/state.ts`
- **職責**: 管理核心應用程式狀態的單一資料來源。
- **實作**: 導出 `CONSTANTS` 與響應式 `state`。

#### `core/geometry.ts`
- **職責**: 封裝所有與 Three.js `BufferGeometry` 和 `Mesh` 物件相關的操作。
- **實作**: `initGeometry(scene)` 並動態更新 `harmonicGeoms` 與 `sumGeom`。

#### `market-fourier.ts` (主控層)
- **職責**: 整合 `geometry.ts`, `state.ts` 與 `market/api.ts`。
- **實作**: 執行 `requestAnimationFrame` 渲染循環。

## 審查與接受標準
- 各腳本層級間僅透過 `state.ts` 共享變數。
- 在切換模式時，波形轉換需平滑。
- 效能必須維持在 60 FPS (使用 Three.js Timer 監控)。
