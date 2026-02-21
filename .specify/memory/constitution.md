# 專案治理原則 (Governing Principles) - v2.0

## 1. 軟體架構與品質 (Architecture & Quality)

*   **TypeScript 第一 (TS First)**：嚴格型別檢查。禁止使用 `any`，所有的 API 回傳結構 (如 `MarketResult`) 必須明確定義。
*   **原子化模組設計 (Atomic Module Design)**：
    *   `src/scripts/core/`：底層渲染、幾何計算與全域狀態分配。
        *   `state.ts`：唯一的狀態來源。
        *   `geometry.ts`：純粹的 Three.js 物件工廠與頂點操作。
    *   `src/scripts/market/`：外部數據橋樑 (Acquisition)。負責從 TWSE 或 SQLite 獲取與精煉原始數據。
    *   `src/scripts/visualizer/`：數據視覺化整合 (Visualization)。將市場數據映射至 3D 空間與 UI 交互。
    *   `src/db/`：資料持久層 (Drizzle + SQLite)。
*   **渲染循環原則**：任何在 `animate()` 內執行的邏輯必須是索引運算 (Indexed Access)，禁止進行 DOM 操作、字串拼接或大量物件垃圾回收 (GC)。

## 2. 數據完整性 (Data Governance)

*   **時間戳一致性**：所有的儲存數據均以 ISO-8601 格式做為 Key，並標註對應的 `marketTime`。
*   **降級方案 (Fallback Strategy)**：若 API 同步失敗或資料庫損壞，必須能自動回退至 `knowledge-base.md` 中定義的「預設諧波陣列」。
*   **持久化路徑**：`sqlite.db` 統一存放於專案根目錄，嚴禁將臨時數據寫入 `public/` 資料夾。

## 3. 視覺設計與 UI 共識 (UI/UX Standards)

*   **玻璃擬態 (Glassmorphism)**：使用 `backdrop-blur` 搭配 `bg-white/10` 與 `border-white/20`。
*   **霓虹色系**：
    *   主要亮點：`emerald-400` (#34d399)。
    *   輔助強調：`cyan-400` (#22d3ee) 或 `indigo-400`。
    *   背景基調：`slate-950` (#020617)。
*   **響應式基準**：所有 UI 元件在 mobile (390px 寬) 下必須能正常互動。

## 4. 決策指引 (Decision Governance)

*   **變更流程**：建立新功能前，必須更新 `specs/` 下的對應文件。
*   **性能基準**：渲染核心必須在 M1/M2 系列或中階行動裝置上維持穩定的 60 FPS。
