export type MarketMappingMode = 'volume-delta' | 'price-fft' | 'multi-dim' | 'stock-daily';

interface MarketResult {
    harmonics: number[];
    phases: number[];
}

export async function fetchMarketData(mode: MarketMappingMode = 'volume-delta', dateStr?: string): Promise<MarketResult> {
    try {
        const dateParam = dateStr ? `?date=${dateStr}` : '';
        // Fetch 5-Minute Index Data (TAIEX Price)
        const resIdx = await fetch(`https://www.twse.com.tw/exchangeReport/MI_5MINS_INDEX${dateParam}${dateStr ? '&' : '?'}response=json`);
        const dataIdx = await resIdx.json();

        // Fetch 5-Minute Volume Data
        const resVol = await fetch(`https://www.twse.com.tw/rwd/zh/afterTrading/MI_5MINS${dateParam}${dateStr ? '&' : '?'}response=json`);
        const dataVol = await resVol.json();

        const numHarmonics = 60;
        const result: MarketResult = {
            harmonics: new Array(numHarmonics).fill(0),
            phases: new Array(numHarmonics).fill(0)
        };

        if (dataIdx && dataIdx.stat === 'OK' && dataVol && dataVol.stat === 'OK') {

            // 1. Process Volume
            const cumulativeValues = dataVol.data.map((row: any) => {
                const val = Number(row[7].replace(/,/g, ''));
                return val > 0 ? val : 0;
            });
            const volDiffs: number[] = [];
            for (let i = 1; i < cumulativeValues.length; i++) {
                let diff = cumulativeValues[i] - cumulativeValues[i - 1];
                volDiffs.push(diff < 0 ? 0 : diff);
            }
            const sampledVol: number[] = [];
            const stepVol = Math.floor(volDiffs.length / numHarmonics);
            for (let i = 0; i < numHarmonics; i++) {
                sampledVol.push(volDiffs[i * stepVol] || 0);
            }

            // 2. Process Prices
            const prices = dataIdx.data.map((row: any) => Number(row[1].replace(/,/g, '')));
            // Since it's 5 min index, there are less elements (about ~54 per day)
            // Interpolate or pad to fit 60 harmonics for DFT or direct mapping
            const paddedPrices: number[] = [];
            const priceCount = prices.length;
            for (let i = 0; i < numHarmonics; i++) {
                const idx = Math.floor((i / numHarmonics) * priceCount);
                if (prices[idx]) paddedPrices.push(prices[idx]);
                else paddedPrices.push(prices[priceCount - 1] || 0); // fallback
            }

            // Route mapping by mode
            if (mode === 'volume-delta') {
                const maxVol = Math.max(...sampledVol, 1);
                for (let i = 0; i < numHarmonics; i++) {
                    result.harmonics[i] = (sampledVol[i] / maxVol) * 80; // Scale 0-80
                    result.phases[i] = 0;
                }
            }
            else if (mode === 'price-fft') {
                // Apply a simple Discrete Fourier Transform (DFT) to the padded prices
                // Wait, if we DFT the price, the fundamental freq will have a massive amplitude.
                // We should detrend the price (subtract the mean) to avoid a massive DC offset
                const meanPrice = paddedPrices.reduce((a, b) => a + b, 0) / paddedPrices.length;
                const detrended = paddedPrices.map(p => p - meanPrice);

                let maxAmp = 0.001;
                for (let k = 1; k <= numHarmonics; k++) { // Skips k=0 (DC offset)
                    let real = 0;
                    let imag = 0;
                    for (let n = 0; n < numHarmonics; n++) {
                        const angle = (2 * Math.PI * k * n) / numHarmonics;
                        real += detrended[n] * Math.cos(angle);
                        imag -= detrended[n] * Math.sin(angle);
                    }
                    const amp = Math.sqrt(real * real + imag * imag);
                    // Phase: atan2(-imag, real) or similar depending on sine basis we use. 
                    // Our fourier.ts uses Math.sin(n*phase + phi), so phi = atan2(real, imag)
                    const phase = Math.atan2(real, -imag);

                    result.harmonics[k - 1] = amp;
                    result.phases[k - 1] = phase;
                    if (amp > maxAmp) maxAmp = amp;
                }

                // Normalize Amplitudes
                for (let i = 0; i < numHarmonics; i++) {
                    // FFT drops off very quickly, we might want to boost higher frequencies logarithmically, 
                    // but let's stick to linear scale for mathematical accuracy first.
                    result.harmonics[i] = (result.harmonics[i] / maxAmp) * 80;
                }
            }
            else if (mode === 'multi-dim') {
                // Amplitude = Volume / Max Volume
                // Phase = Price changes (Up: positive shift, Down: negative shift)
                const maxVol = Math.max(...sampledVol, 1);
                // measure consecutive price diffs
                const priceDiffs = paddedPrices.map((p, i) => i === 0 ? 0 : p - paddedPrices[i - 1]);
                const maxDiff = Math.max(...priceDiffs.map(Math.abs), 1);

                for (let i = 0; i < numHarmonics; i++) {
                    result.harmonics[i] = (sampledVol[i] / maxVol) * 80;

                    // map price diff to phase (0 to PI)
                    const normDiff = priceDiffs[i] / maxDiff; // -1 to 1
                    result.phases[i] = normDiff * Math.PI; // Shifts the wave significantly
                }
            }

            return result;
        }

    } catch (err) {
        console.error("Failed to fetch market data:", err);
    }

    // Dummy fallback data
    return {
        harmonics: new Array(60).fill(10),
        phases: new Array(60).fill(0)
    };
}

export async function fetchStockDailyData(stockNo: string, dateStr?: string): Promise<MarketResult> {
    try {
        const dateParam = dateStr ? `?date=${dateStr}` : '';
        const url = `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY${dateParam}${dateStr ? '&' : '?'}stockNo=${stockNo}&response=json`;
        const res = await fetch(url);
        const data = await res.json();

        if (data && data.stat === 'OK' && data.data) {
            // Price is at index 6 (Closing Price), Volume is at index 1 (Trade Volume)
            const prices = data.data.map((row: any) => Number(row[6].replace(/,/g, '')));
            const volumes = data.data.map((row: any) => Number(row[1].replace(/,/g, '')));

            const numHarmonics = 60;
            const result: MarketResult = {
                harmonics: new Array(numHarmonics).fill(0),
                phases: new Array(numHarmonics).fill(0)
            };

            // Interpolate prices and volumes to 60 nodes
            const paddedPrices: number[] = [];
            const paddedVolumes: number[] = [];
            for (let i = 0; i < numHarmonics; i++) {
                const idx = Math.floor((i / numHarmonics) * prices.length);
                paddedPrices.push(prices[idx] || prices[prices.length - 1]);
                paddedVolumes.push(volumes[idx] || volumes[volumes.length - 1]);
            }

            // FFT on Daily Prices
            const meanPrice = paddedPrices.reduce((a, b) => a + b, 0) / paddedPrices.length;
            const detrended = paddedPrices.map(p => p - meanPrice);

            let maxAmp = 0.001;
            for (let k = 1; k <= numHarmonics; k++) {
                let real = 0;
                let imag = 0;
                for (let n = 0; n < numHarmonics; n++) {
                    const angle = (2 * Math.PI * k * n) / numHarmonics;
                    real += detrended[n] * Math.cos(angle);
                    imag -= detrended[n] * Math.sin(angle);
                }
                const amp = Math.sqrt(real * real + imag * imag);
                const phase = Math.atan2(real, -imag);

                result.harmonics[k - 1] = amp;
                result.phases[k - 1] = phase;
                if (amp > maxAmp) maxAmp = amp;
            }

            // Normalize
            for (let i = 0; i < numHarmonics; i++) {
                result.harmonics[i] = (result.harmonics[i] / maxAmp) * 80;
            }

            return result;
        }
    } catch (err) {
        console.error("Failed to fetch stock daily data:", err);
    }

    return {
        harmonics: new Array(60).fill(5),
        phases: new Array(60).fill(0)
    };
}

