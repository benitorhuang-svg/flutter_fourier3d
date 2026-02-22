# 專案簡介 (Project Brief) - Fourier 3D & Market Data

## 1. 專案核心定位 (Project Essence)
**Fourier 3D** 是一個結合了「純粹數學美學」與「複雜金融動態」的沉浸式實驗平台。
本專案的核心目標是透過 **傅立葉轉換 (Fourier Transform)** 的透鏡，去解構並視覺化股市的混沌數據，將價格的起伏轉化為壯麗的諧波舞蹈。

## 2. 核心敘事 (Core Narrative)
*   **從混沌到秩序**：股市數據通常被視為隨機且不穩定的，但透過傅立葉分解，我們可以捕捉其中的週期性能量。
*   **數據即藝術**：當成交量決定振幅、價格變化決定相位時，每一分鐘的市場動態都寫下了一首獨一無二的「數據交響曲」。

## 3. 主要功能模組 (Major Modules)
*   **Fourier Visualizer (核心引擎)**：基於 Three.js 打造的高效能 3D 渲染器，能同時呈現數十條諧波線條與動態路徑。
*   **Market Intelligence (市場情報)**：深度整合台灣證券交易所 (TWSE) API，支援「台股大盤指數 (5分/日盤)」與「個股歷史數據」的對接。
*   **Persistence Engine (持久化引擎)**：使用 SQLite 記錄每一次的市場快照，實現歷史回放 (Playback) 功能。

## 4. 技術願景 (Technical Vision)
*   **零延遲視覺感**：利用 `BufferGeometry` 更新頂點，確保極致的 60 FPS 流暢度。
*   **全方位 UI 體驗**：結合玻璃擬態 (Glassmorphism) 側邊欄面板與 **深/淺色雙模式 (Hybrid Theme)** 切換，提供不同光學環境下的最佳觀察視野。
*   **數據驅動**：不只是隨機動畫，而是 100% 由真實數據演算生成的幾何藝術。
