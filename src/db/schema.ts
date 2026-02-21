import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const marketData = sqliteTable('market_data', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    timestamp: text('timestamp').notNull(), // ISO Datetime
    marketTime: text('market_time').notNull(), // e.g., "09:05:00"
    indexPrice: real('index_price'), // 加權指數
    tradeVolume: real('trade_volume'), // 累積成交金額
    volumeDelta: real('volume_delta'), // 當下成交量 (5min delta)
    mode: text('mode').notNull(), // 'volume-delta' | 'price-fft' | 'multi-dim'
    harmonicsJson: text('harmonics_json'), // 存儲計算好的傅立葉數組
    phasesJson: text('phases_json'), // 存儲相位數組
});
