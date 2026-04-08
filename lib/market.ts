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
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch {
    return null;
  }
}

export async function fetchAllMarketData(): Promise<MarketDataPoint[]> {
  const results: MarketDataPoint[] = [];
  for (const [dataType, config] of Object.entries(SYMBOLS)) {
    const value = await fetchYahooQuote(config.symbol);
    if (value !== null) {
      results.push({ data_type: dataType, value, unit: config.unit, source: 'yahoo_finance' });
    }
    await new Promise(r => setTimeout(r, 200));
  }
  // Fallbacks for rates not available on Yahoo
  results.push({ data_type: 'jpn_10y', value: 1.05, unit: '%', source: 'manual_fallback' });
  results.push({ data_type: 'chn_10y', value: 1.65, unit: '%', source: 'manual_fallback' });
  return results;
}

export async function getLatestMarketSnapshot(db: any): Promise<Record<string, number>> {
  const types = ['jpn_10y', 'us_10y', 'usdjpy', 'cnyjpy', 'jreit_index', 'chn_10y'];
  const snapshot: Record<string, number> = {};
  for (const type of types) {
    const row = db.prepare(
      `SELECT value FROM market_data WHERE data_type = ? ORDER BY recorded_at DESC LIMIT 1`
    ).get(type) as { value: number } | undefined;
    if (row) snapshot[type] = row.value;
  }
  if (!snapshot.jpn_10y)     snapshot.jpn_10y     = 1.05;
  if (!snapshot.us_10y)      snapshot.us_10y      = 4.22;
  if (!snapshot.usdjpy)      snapshot.usdjpy      = 149.5;
  if (!snapshot.cnyjpy)      snapshot.cnyjpy      = 20.5;
  if (!snapshot.chn_10y)     snapshot.chn_10y     = 1.65;
  if (!snapshot.jreit_index) snapshot.jreit_index = 1842;
  return snapshot;
}
