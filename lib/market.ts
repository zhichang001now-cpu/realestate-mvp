export interface MarketDataPoint {
  data_type: string;
  value: number;
  unit: string;
  source: string;
}

const SYMBOLS: Record<string, { symbol: string; unit: string }> = {
  usdjpy:      { symbol: 'USDJPY=X', unit: 'JPY' },
  cnyjpy:      { symbol: 'CNYJPY=X', unit: 'JPY' },
  us_10y:      { symbol: '^TNX',     unit: '%'   },
  jreit_index: { symbol: '1343.T',   unit: 'JPY' },
};

async function fetchYahooQuote(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch { return null; }
}

export async function fetchAllMarketData(): Promise<MarketDataPoint[]> {
  const results: MarketDataPoint[] = [];
  for (const [dataType, config] of Object.entries(SYMBOLS)) {
    const value = await fetchYahooQuote(config.symbol);
    if (value !== null) results.push({ data_type: dataType, value, unit: config.unit, source: 'yahoo_finance' });
    await new Promise(r => setTimeout(r, 200));
  }
  results.push({ data_type: 'jpn_10y', value: 1.05, unit: '%', source: 'manual_fallback' });
  results.push({ data_type: 'chn_10y', value: 1.65, unit: '%', source: 'manual_fallback' });
  return results;
}
