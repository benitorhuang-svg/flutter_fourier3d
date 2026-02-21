# 專案知識庫 (Knowledge Base) - v2.0

## 1. 傅立葉視覺化數學邏輯
*   **疊加公式**：`Total_Y = sum( Harmonic[i].Amplitude * sin( (i+1) * phase + Harmonic[i].Phase ) )`
*   **時間軸演進**：`phase` 隨 `timeOffset` 變化。每一點的位移根據 `distFromRight / period` 計算，營造出由右向左流動的波感。
*   **渲染常數**：
    *   `POINTS_PER_LINE`: 512 (點越多曲線越平滑，但更耗效能)。
    *   `NUM_HARMONICS`: 1~60 (對應台灣大盤 API 5分鐘分盤的長度)。

## 2. 市場數據映射規則 (Mapping Strategy)

| 模式 (Mode) | 諧波振幅 (Amplitude) 映射 | 諧波相位 (Phase) 映射 |
| :--- | :--- | :--- |
| **Volume Delta** | 單位時間成交量差值 (Normalized) | 固定 0 |
| **Price FFT** | 價格序列經過 DFT 分解後的能量級數 | 每個頻率對應的 FFT 相位角 |
| **Multi-Dim** | 成交量強度 | 價格變化率 (Price Diff) 映射至 [-PI, PI] |

## 3. 渲染優化與視覺參數
*   **後處理效果 (Post-processing)**:
    *   `UnrealBloomPass`: `strength = 0.8`, `radius = 0.1`, `threshold = 0.85` (高對比霓虹感)。
*   **場景特效**:
    *   `FogExp2`: 密度 `0.0008`，營造深邃空間感。
    *   `OrbitControls`: 開啟 `enableDamping` 增加操作質感。
    *   `AutoOrbit`: 攝影機以半徑 `400` 進行自動圓周旋轉，營造觀賞模式。

## 4. API 與 持久化細節
*   **TWSE API 端點**:
    *   大盤指數：`MI_5MINS_INDEX`
    *   成交量：`MI_5MINS`
*   **DB 核心欄位**:
    *   `harmonicsJson` & `phasesJson`: 存儲經計算後的 Float32 陣列 JSON 字串，避免前端重複進行耗時的 FFT 計算。
