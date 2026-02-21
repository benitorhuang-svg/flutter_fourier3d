# 技術實作計畫：數據視覺化與 UI 整合

## 目標 (Goal)
將數據獲取層與 3D 渲染層完美橋接，提供沉浸式的數據回放體驗。

## 實作步驟

### 1. 3D 核心參數對齊
- **檔案**: `src/scripts/core/state.ts`, `src/scripts/core/geometry.ts`
- **任務**: 
  - 確保 `state` 物件具備接收 60 支諧波的能力。
  - 初始化 `sumGeom` 與 `harmonicGeoms` 以應對大盤分盤數據。

### 2. 數據對接與應用 (Application)
- **檔案**: `src/scripts/market-fourier.ts`
- **任務**: 
  - 實作 `loadData()` 異步函數，整合 `/api/sync` API。
  - 實作 `applyMarketData()`，將 JSON 數據解構至 `state.harmonics`。

### 3. UI 交互實作 (Interaction)
- **檔案**: `src/components/MarketControls.astro` (或 index.astro 下的腳本區塊)
- **任務**: 
  - **歷史滑桿**：串接 `get-timeline` API 並根據長度設置 Slider `max` 值。
  - **事件監聽**：實現 `history-slider` 對 `load-snapshot` 的觸發。
  - **狀態提示**：更新 `legend-amp-val` 與 `legend-phase-val` 的標記。

### 4. 渲染迴圈優化 (Animation)
- **檔案**: `src/scripts/market-fourier.ts` 中的 `animate()`
- **任務**: 
  - **數值平滑 (Lerp)**：實作 `state.harmonics` 向 `targetHarmonics` 的線性插值，確保切換快照時波形不跳變。
  - **相機環繞 (AutoOrbit)**：調整速度與半徑，營造優雅的劇場感。
  - **頂點解析更新**：使用最新的 `state.harmonics` 值驅動 `BufferGeometry`。

## 審查標準
- [x] 拖動歷史滑桿時，頂部的時間標籤會跟著跳動（如：09:05, 09:10...）。
- [x] 3D 畫面的波形動態與成交量強度成正比。
- [x] 發光特效無明顯掉幀。
