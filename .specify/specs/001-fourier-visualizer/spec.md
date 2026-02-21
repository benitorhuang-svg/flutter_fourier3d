# 規格說明：Fourier 3D 核心功能 (Core Features)

## 概述 (Overview)
**Fourier 3D** 是一個以 3D 視覺化工具來呈現「傅立葉數學轉換 (Fourier Transform)」與「合成波」的互動式展示平台。
本平台旨在為使用者提供沉浸且直覺的介面，能夠觀察基礎波形被分解、重組與合成的過程。

## 使用者故事 (User Stories)

做為一個**對聲學/數學感興趣的使用者**或**一般觀眾**：

1. **基礎波形切換**：我希望能夠透過一個按鈕快速切換不同的內建函數 (Square 方波, Sawtooth 鋸齒波, Triangle 三角波)，以觀察它們特定的諧波 (Harmonics) 組合。
2. **手動互動 (Manual Mode)**：我希望可以逐一調整前 N 個諧波的「振幅」與「相位」，以便深入理解單一參數對最終合成波形所造成的影響。
3. **音樂驅動 (Radio/Audio Mode)**：我希望可以選擇不同的線上直播電台 (如：Lofi Beats、Ambient 等)，應用 Web Audio API 擷取目前音樂的頻譜能量，讓 3D 波形會因為音樂的高低音域產生共振變化。
4. **劇院展示 (Cinema/Auto Mode)**：我希望有一個不需操作的展示模式，攝影機可以自動圍繞、旋轉並展示合成波的動態，做為單純的視覺螢幕保護程式。
5. **觀察維度 (2D/3D 切換)**：除了 3D 空間展開每個諧波外，我希望可以切換成 2D 視角，觀察旋轉臂 (Epicycles) 如何推演出單一波形，理解幾何原理解構。
6. **沈浸觀影**：我希望能一鍵隱藏所有的 UI 控制面版、甚至進入全螢幕 (Fullscreen) 享受乾淨視覺，並且打開/關閉輝光 (Bloom) 效果。

## 功能性需求 (Functional Requirements)

- **3D 渲染系統**:
  - 核心繪圖引擎必須使用 Three.js 繪製。
  - 需要有一個主要合成波 (Sum Wave)，以及多條子諧波 (Harmonic Waves) 作為背景。
  - 必須能繪製圓形臂 (Epicycles Spheres) 與半徑線條連接，幫助 2D 理解。
- **介面控制系統**:
  - 能設定總諧波的參與數量 (Harmonic Count, 1 ~ 60)。
  - 對應的調整桿 (Sliders) 應該動態生成並與 `state` 綁定。
  - 在切換模式時 (Manual / Audio / Auto)，不同專屬的控制器區塊需做視覺化展開與折疊，並避免邏輯干涉 (例如進入 Auto 時暫停音樂)。
- **頻譜分析系統 (AnalyserNode)**:
  - 取樣 `fftSize = 128` 或以上之原始數據。
  - 需依對數/倍頻程分區映射至 `NUM_HARMONICS` 個視覺波形。
  - 即時依照整體能量 (Total Energy) 進行時間軸加速 (Time Offset Acceleration)。
- **響應式版面佈局**:
  - 當視窗縮放或使用手機時，Canvas 要自動 Resize 保持長寬比。
  - 介面儀表板需具備 Phone-friendly Bottom Sheet 形式。

## 非功能性需求 (Non-Functional Requirements)
- 動畫更新頻率須保持順暢 (建議 $>= 60fps$)，因此在渲染迴圈中應使用 `Float32Array` 更新 BufferGeometry 而非重複產生實體。
- 無登入、無密碼、無後端儲存依賴的純靜態前端架構，需能支援後續的 PWA (Progressive Web App) 離線封裝。
