import type { APIRoute } from 'astro';
import { db } from '../../db';
import { marketData } from '../../db/schema';
import { fetchMarketData, fetchStockDailyData } from '../../scripts/market/api';
import type { MarketMappingMode } from '../../scripts/market/api';
import { desc, eq } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    try {
        const mode = (url.searchParams.get('mode') as MarketMappingMode) || 'volume-delta';
        const action = url.searchParams.get('action');
        const dateStr = url.searchParams.get('date'); // YYYYMMDD
        const stockNo = url.searchParams.get('stock'); // e.g. 0050

        // Action: Get Timeline (for the slider)
        if (action === 'get-timeline') {
            const history = await db.select({
                id: marketData.id,
                timestamp: marketData.timestamp,
                marketTime: marketData.marketTime,
                mode: marketData.mode
            })
                .from(marketData)
                .orderBy(desc(marketData.id))
                .limit(50);

            return new Response(JSON.stringify(history), { status: 200 });
        }

        // Action: Load specific snapshot
        if (action === 'load-snapshot') {
            const id = parseInt(url.searchParams.get('id') || '0');
            const snapshot = await db.select().from(marketData).where(eq(marketData.id, id)).limit(1);
            if (snapshot.length > 0) {
                return new Response(JSON.stringify({
                    harmonics: JSON.parse(snapshot[0].harmonicsJson || '[]'),
                    phases: JSON.parse(snapshot[0].phasesJson || '[]'),
                    marketTime: snapshot[0].marketTime
                }), { status: 200 });
            }
        }

        // Default: Sync and return fresh
        let fresh;
        let displayTime = dateStr || new Date().toLocaleTimeString();

        if (stockNo) {
            fresh = await fetchStockDailyData(stockNo, dateStr || undefined);
            displayTime = `${stockNo} (${dateStr || 'Latest'})`;
        } else {
            fresh = await fetchMarketData(mode, dateStr || undefined);
        }

        const now = new Date().toISOString();

        // Idempotency: Avoid duplicates for the same market time and subject
        const existing = await db.select()
            .from(marketData)
            .where(eq(marketData.marketTime, displayTime))
            .limit(1);

        if (existing.length === 0) {
            await db.insert(marketData).values({
                timestamp: now,
                marketTime: displayTime,
                mode: stockNo ? 'stock-daily' : mode,
                harmonicsJson: JSON.stringify(fresh.harmonics),
                phasesJson: JSON.stringify(fresh.phases),
            });
        }

        return new Response(JSON.stringify({
            success: true,
            current: fresh,
            lastSync: now
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
    }
};
