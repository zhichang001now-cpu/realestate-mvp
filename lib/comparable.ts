// MLIT 不動産取引価格情報ライブラリ API utilities
// https://www.land.mlit.go.jp/webland/api.html  (no auth required)

export const PREF_CODES: Record<string, string> = {
  '北海道':'01','青森県':'02','岩手県':'03','宮城県':'04','秋田県':'05',
  '山形県':'06','福島県':'07','茨城県':'08','栃木県':'09','群馬県':'10',
  '埼玉県':'11','千葉県':'12','東京都':'13','神奈川県':'14','新潟県':'15',
  '富山県':'16','石川県':'17','福井県':'18','山梨県':'19','長野県':'20',
  '岐阜県':'21','静岡県':'22','愛知県':'23','三重県':'24','滋賀県':'25',
  '京都府':'26','大阪府':'27','兵庫県':'28','奈良県':'29','和歌山県':'30',
  '鳥取県':'31','島根県':'32','岡山県':'33','広島県':'34','山口県':'35',
  '徳島県':'36','香川県':'37','愛媛県':'38','高知県':'39','福岡県':'40',
  '佐賀県':'41','長崎県':'42','熊本県':'43','大分県':'44','宮崎県':'45',
  '鹿児島県':'46','沖縄県':'47',
};

// Map our property types to MLIT trade types
const TYPE_MAP: Record<string, string> = {
  'マンション': '中古マンション等',
  'オフィス':   '宅地(土地と建物)',
  'ホテル':     '宅地(土地と建物)',
  '物流施設':   '宅地(土地と建物)',
  '商業施設':   '宅地(土地と建物)',
  '土地':       '宅地(土地)',
  'その他':     '宅地(土地と建物)',
};

export interface MlitTransaction {
  type: string;
  tradePrice: number;   // yen
  area: number;         // sqm
  unitPrice: number;    // yen/sqm
  priceTsubo: number;   // 万円/坪
  buildingYear: number | null;
  municipality: string;
}

export interface ComparableSummary {
  sampleCount: number;
  avgUnitPriceSqm: number;   // 万円/㎡
  avgPriceTsubo: number;     // 万円/坪
  minUnitPrice: number;
  maxUnitPrice: number;
  medianUnitPrice: number;
  mlitType: string;
}

// Get city code by matching city name against MLIT city list
async function getCityCode(prefCode: string, cityName: string): Promise<string | null> {
  try {
    const url = `https://www.land.mlit.go.jp/webland/api/CitySearch?area=${prefCode}`;
    const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 1 day
    if (!res.ok) return null;
    const data = await res.json() as { status: string; data: { id: string; name: string }[] };
    if (data.status !== 'OK') return null;
    // Fuzzy match: strip 市区町村 suffix and compare
    const clean = (s: string) => s.replace(/[市区町村郡].*$/, '').replace(/[市区町村郡]/g, '');
    const target = clean(cityName);
    const match = data.data.find(c =>
      c.name === cityName ||
      c.name.includes(cityName) ||
      cityName.includes(c.name) ||
      clean(c.name) === target
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}

// Fetch recent transactions from MLIT (last 2 years, same property type & city)
export async function fetchMlitComparables(
  prefecture: string,
  city: string,
  propertyType: string,
  askingPriceSqm?: number,  // 万円/㎡ of subject property, for outlier filtering
): Promise<ComparableSummary | null> {
  const prefCode = PREF_CODES[prefecture];
  if (!prefCode) return null;

  const cityCode = await getCityCode(prefCode, city);
  if (!cityCode) return null;

  const mlitType = TYPE_MAP[propertyType] ?? '宅地(土地と建物)';

  // Build 8-quarter window ending at current quarter
  const now = new Date();
  const curYear = now.getFullYear();
  const curQ = Math.ceil((now.getMonth() + 1) / 3);
  // from = 2 years ago same quarter
  const fromYear = curYear - 2;
  const from = `${fromYear}${curQ}`;
  const to   = `${curYear}${curQ}`;

  try {
    const url = `https://www.land.mlit.go.jp/webland/api/TradeListSearch?from=${from}&to=${to}&area=${prefCode}&city=${cityCode}`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1h
    if (!res.ok) return null;
    const data = await res.json() as { status: string; data: Record<string, string>[] };
    if (data.status !== 'OK' || !data.data?.length) return null;

    // Filter by property type and parse
    const txs: MlitTransaction[] = data.data
      .filter(r => r.Type === mlitType && r.Area && Number(r.Area) > 0 && r.TradePrice)
      .map(r => {
        const area = Number(r.Area);
        const price = Number(r.TradePrice);
        const unitPrice = price / area;  // yen/sqm
        const priceTsubo = (unitPrice * 3.30578) / 10000; // 万円/坪
        const yearStr = r.BuildingYear ?? '';
        const yearMatch = yearStr.match(/(\d{4})/);
        return {
          type: r.Type,
          tradePrice: price,
          area,
          unitPrice,
          priceTsubo,
          buildingYear: yearMatch ? Number(yearMatch[1]) : null,
          municipality: r.Municipality ?? city,
        };
      })
      .filter(t => t.unitPrice > 0 && t.tradePrice > 0);

    if (txs.length === 0) return null;

    // Filter outliers if we have subject price reference (keep within 3x)
    let filtered = txs;
    if (askingPriceSqm && askingPriceSqm > 0) {
      const refYen = askingPriceSqm * 10000;
      filtered = txs.filter(t => t.unitPrice > refYen / 5 && t.unitPrice < refYen * 5);
    }
    if (filtered.length === 0) filtered = txs;

    const prices = filtered.map(t => t.unitPrice).sort((a, b) => a - b);
    const avg = prices.reduce((s, v) => s + v, 0) / prices.length;
    const mid = prices[Math.floor(prices.length / 2)];

    return {
      sampleCount: filtered.length,
      avgUnitPriceSqm: Math.round(avg / 10000 * 10) / 10,  // 万円/㎡
      avgPriceTsubo: Math.round((avg * 3.30578) / 10000 * 10) / 10,  // 万円/坪
      minUnitPrice: Math.round(prices[0] / 10000 * 10) / 10,
      maxUnitPrice: Math.round(prices[prices.length - 1] / 10000 * 10) / 10,
      medianUnitPrice: Math.round(mid / 10000 * 10) / 10,
      mlitType,
    };
  } catch {
    return null;
  }
}
