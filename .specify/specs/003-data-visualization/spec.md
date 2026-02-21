# 規格說明：數據視覺化與交互 (Data Visualization) - v2.1

## 概述 (Overview)
本模組負責將從 `002` 模組獲取的精煉頻譜參數，轉化為壯麗的 3D 幾何動態。它定義了「數據至形態」的映射邏輯、響應式控制介面，以及為了追求極致視覺體驗而實作的後製特效。

## 使用者故事 (User Stories)
1. **數據的物理反應**：我希望波形的振幅能直觀反映市場的成交熱度，相位的變化反映價格的波動節奏。
2. **平滑的時光倒流**：當我滑動歷史滑桿時，波形不應該突然閃爍，而是平滑地「變形 (Morphing)」到歷史狀態。
3. **場景自動導覽**：即使我不操作滑鼠，相機也能優雅地圍繞著資料波旋轉，展現出 3D 空間的深度感。

## 功能性需求 (Functional Requirements)

### 1. 數據映射與動態 Morphing
*   **頂點解析**：渲染主迴圈須依據 `state.harmonics` 與 `state.phases` 即時計算 `sumGeom` 頂點。
*   **過渡動畫 (Transition)**：當載入 Snapshot 時，實作數值緩動 (Ease-in/out)，使諧波參數在 0.5 秒內平滑抵達目標值。

### 2. 進階 UI 控制系統
*   **交互式 Timeline滑桿**：動態對接快照歷程，並在 Drag 過程中即時預覽。
*   **指標可視化 (Legends)**：在 UI 邊緣顯示當前模式（如：Price FFT Dominated）與標記參數。

### 3. 高端視覺特效 (High-End VFX)
*   **自定義 Bloom**：針對 emerald 與 cyan 色系進行輝光增益，強化「FinTech 數位感」。
*   **動態粒子場 (Nebula Field)**：背景點雲 (Stardust) 須與時間偏移同步，產生輕微的流動感。
*   **智慧鏡頭 (Smart Camera)**：實作自動環繞模式與手動 OrbitControls 的無縫切換。

## 非功能性需求 (Non-Functional Requirements)
*   **渲染效能**：在所有 60 條諧波全開且開啟 Bloom 的情況下，穩定維持 60 FPS。
*   **低延遲反饋**：滑桿拖曳與幾何體變化的視覺延遲須低於 16ms。
