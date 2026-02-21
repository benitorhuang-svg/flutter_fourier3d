# 技術實作計畫：股市數據獲取系統 (Acquisition)

## 目標 (Goal)
建立穩定、高效的數據抓取與預處理管線。

## 實作步驟

### 1. 資料庫層與 Schema 佈署
- **檔案**: `src/db/schema.ts`, `src/db/index.ts`
- **任務**: 
  - 確保 table 具備 `harmonicsJson` 與 `phasesJson` 欄位。
  - 實作防重複寫入邏輯（基於日期與標的）。

### 2. 核心精煉邏輯 (Refinement Algorithm)
- **檔案**: `src/scripts/market/api.ts`
- **任務**: 
  - **差分 (Delta)**：將累計額轉化為區間量。
  - **FFT 解析**：將時域價格轉化為頻域諧波係數 (Amp, Phase)。
  - **插值 (Interpolation)**：將數據點對齊至 60 支諧波。

### 3. 同步服務端點 (Sync Engine)
- **檔案**: `src/pages/api/sync.ts`
- **任務**: 
  - 封裝 TWSE API 獲取邏輯。
  - 實作快照查詢 API (`action=get-timeline`) 與 單點載入 API (`action=load-snapshot`)。

## 審查標準
- [x] `sqlite.db` 檔案中存在經計算過的精煉數據。
- [x] API 測試 (Postman/Curl) 能在 2s 內獲取預處理後的 JSON。
- [x] 離線狀態下 API 具備基本的代位(fallback)能力。
