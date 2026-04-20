export interface MarketDataPoint {
  data_type: string;
  value: number;
  unit: string;
  source: string;
}

export interface MarketSnapshot {
  jpn_10y: number;
  us_10y: number;
  usdjpy: number;
  cnyjpy: number;
  chn_10y: number;
  jreit_index: number;
}

const SYMBOLS: Record<string, { symbol: string; unit: string; fallback: number }> = {
  usdjpy:      { symbol: 'USDJPY=X', unit: 'JPY', fallback: 155.0 },
  cnyjpy:      { symbol: 'CNYJPY=X', unit: 'JPY', fallback: 21.5  },
  us_10y:      { symbol: '^TNX',     unit: '%',   fallback: 4.4   },
  jreit_index: { symbol: '1343.T',   unit: 'JPY', fallback: 1800  },
};

const MANUAL_FALLBACKS: Record<string, { value: number; unit: string }> = {
  jpn_10y: { value: 1.05, unit: '%' },
  chn_10y: { value: 1.65, unit: '%' },
};

async function fetchYahooQuote(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' && isFinite(price) ? price : null;
  } catch {
    return null;
  }
}

export async function fetchAllMarketData(): Promise<MarketDataPoint[]> {
  const results: MarketDataPoint[] = [];

  for (const [dataType, config] of Object.entries(SYMBOLS)) {
    const value = await fetchYahooQuote(config.symbol);
    results.push({
      data_type: dataType,
      value: value ?? config.fallback,
      unit: config.unit,
      source: value !== null ? 'yahoo_finance' : 'fallback',
    });
    await new Promise(r => setTimeout(r, 200));
  }

  for (const [dataType, config] of Object.entries(MANUAL_FALLBACKS)) {
    results.push({ data_type: dataType, value: config.value, unit: config.unit, source: 'manual' });
  }

  return results;
}

export function snapshotFromRows(rows: { data_type: string; value: number }[]): MarketSnapshot {
  const map: Record<string, number> = {};
  for (const r of rows) map[r.data_type] = r.value;
  return {
    jpn_10y:      map.jpn_10y      ?? 1.05,
    us_10y:       map.us_10y       ?? 4.4,
    usdjpy:       map.usdjpy       ?? 155.0,
    cnyjpy:       map.cnyjpy       ?? 21.5,
    chn_10y:      map.chn_10y      ?? 1.65,
    jreit_index:  map.jreit_index  ?? 1800,
  };
}
