import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ExtractionResult {
  address_extracted?: string;
  station?: string;
  walk_minutes?: number;
  land_sqm?: number;
  building_sqm?: number;
  floors?: number;
  year_built?: number;
  usage_type?: string;
  structure?: string;
  asking_price?: number;
  noi?: number;
  noi_full_occupancy?: number;
  noi_current?: number;
  cap_rate?: number;
  surface_yield?: number;
  occupancy_rate?: number;
  gross_rent?: number;
  rent_per_sqm?: number;
  price_per_sqm?: number;
  price_per_tsubo?: number;
  unit_count?: number;
  parking_count?: number;
  land_right_type?: string;
  land_lease_monthly?: number;
  land_lease_expiry?: string;
  fixed_asset_tax?: number;
  management_fee?: number;
  other_expenses?: number;
  total_expenses?: number;
  income_items?: Array<{ label: string; amount: number }>;
  expense_items?: Array<{ label: string; amount: number }>;
  tenant_summary?: Array<{ name: string; floor: string; sqm: number; rent: number; expiry: string }>;
  lease_expiry_risk?: 'low' | 'medium' | 'high';
  special_notes?: string;
  raw_all_fields?: Record<string, string>;
  extraction_confidence: number;
}

const EXTRACTION_PROMPT = `You are a Japanese real estate data extraction specialist.

== STEP 1: NORMALIZE ALL MONETARY VALUES TO RAW JPY INTEGERS ==
Before filling any JSON, scan the entire document and convert every monetary expression you find to a raw integer (yen). Use these rules — apply EXACTLY ONE multiplier per value:

  億円  → × 100,000,000   e.g. 1.6億円        = 160,000,000
  百万円 → × 1,000,000     e.g. 160百万円       = 160,000,000
  万円  → × 10,000        e.g. 16,000万円      = 160,000,000
  円    → × 1             e.g. 160,000,000円   = 160,000,000
  Mixed → add parts       e.g. 1億6,000万円    = 100,000,000 + 60,000,000 = 160,000,000

  IMPORTANT: Table column headers like "（百万円）" or "単位：万円" define the unit for ALL values in that column.
  NEVER apply two multipliers to the same number.
  If cap_rate is stated, sanity-check: asking_price ≈ annual_NOI ÷ (cap_rate / 100). If the ratio is off by ×100 or ×10000, you applied the wrong unit — fix it.

== STEP 2: EXTRACT INTO JSON ==
Using the normalized values from Step 1, extract all data into the exact JSON structure below.

OTHER EXTRACTION RULES:
1. Era year: 令和X年=2018+X, 平成X年=1988+X, 昭和X年=1925+X. e.g. 平成2年1月築 → year_built: 1990
2. Area: 1坪=3.3058㎡. Always output in ㎡.
3. Station: "千葉駅徒歩6分" → station:"千葉", walk_minutes:6
4. NOI: extract BOTH 満室想定(noi_full_occupancy) AND 現況(noi_current) separately.
5. surface_yield = 表面利回り or 想定利回り (%). cap_rate = NOIベース利回り (%).
6. occupancy_rate: "36.36%" → 36.36. Calculate if needed: current_rent/full_rent×100.
7. unit_count: 総戸数, 戸数, 総室数 etc.
8. land_right_type: 所有権/借地権/旧法借地権/底地. Default "所有権" if not mentioned.
9. land_lease_monthly: 地代 monthly in JPY. "月額35万円" → 350000.
10. Put EVERY extracted text field in raw_all_fields.
11. extraction_confidence: 0.95 if most numeric fields found, 0.7 if partial, 0.4 if sparse.
4. Station parsing: "千葉駅徒歩6分" → station: "千葉", walk_minutes: 6. "○○駅 徒歩△分" pattern.
5. NOI: extract BOTH 満室想定 (noi_full_occupancy) AND 現況 (noi_current) separately.
6. surface_yield = 表面利回り or 想定利回り (%). cap_rate = NOIベース利回り (%).
7. occupancy_rate: "36.36%" → 36.36. Calculate if needed: current_rent/full_rent×100.
8. unit_count: 総戸数, 戸数, 総室数 etc.
9. land_right_type: look for 所有権/借地権/旧法借地権/底地. Default "所有権" if not mentioned.
10. land_lease_monthly: 地代 monthly amount in JPY. "月額35万円" → 350000.
11. Put EVERY extracted text field in raw_all_fields as key-value pairs.
12. extraction_confidence: 0.95 if most numeric fields found, 0.7 if partial, 0.4 if sparse.

Return ONLY this JSON, no markdown, no explanation:
{
  "address_extracted": "full address string or null",
  "station": "station name only without 駅, or null",
  "walk_minutes": integer or null,
  "land_sqm": number in sqm or null,
  "building_sqm": number in sqm or null,
  "floors": integer or null,
  "year_built": 4-digit integer (western year) or null,
  "usage_type": "office|retail|residential|industrial|mixed" or null,
  "structure": "structure description string or null",
  "asking_price": integer in JPY or null,
  "noi_full_occupancy": integer in JPY/year or null,
  "noi_current": integer in JPY/year or null,
  "noi": integer in JPY/year (prefer current, fallback full) or null,
  "cap_rate": number as percentage or null,
  "surface_yield": number as percentage or null,
  "occupancy_rate": number as percentage (e.g. 36.36) or null,
  "gross_rent": integer in JPY/year or null,
  "rent_per_sqm": number JPY/sqm/month or null,
  "price_per_sqm": number in JPY or null,
  "price_per_tsubo": number in JPY or null,
  "unit_count": integer or null,
  "parking_count": integer or null,
  "land_right_type": "所有権|旧法借地権|新法借地権|底地" or null,
  "land_lease_monthly": integer JPY/month or null,
  "land_lease_expiry": "year or date string" or null,
  "income_items": [{"label": "項目名 (e.g.賃料収入)", "amount": integer_JPY_per_year}, ...],
  "expense_items": [{"label": "項目名 (e.g.管理費)", "amount": integer_JPY_per_year}, ...],
  "fixed_asset_tax": integer JPY/year or null,
  "management_fee": integer JPY/year or null,
  "other_expenses": integer JPY/year or null,
  "total_expenses": integer JPY/year or null,
  "tenant_summary": [],
  "lease_expiry_risk": "low|medium|high",
  "special_notes": "特記事項 full text or null",
  "raw_all_fields": {"日本語フィールド名": "抽出値の文字列"},
  "extraction_confidence": number
}

income_items / expense_items rules:
- Extract EVERY income and expense line item listed in the document as-is.
- Use the EXACT label from the document (Japanese OK).
- Convert amounts using Step 1 unit rules → raw JPY integers.
- income_items: 賃料収入, 駐車場収入, 礼金, 更新料, etc.
- expense_items: 管理費, 固定資産税, 修繕費, 損害保険料, PM費用, etc.
- Do NOT merge or rename items. If the doc has 5 expense rows, output 5 items.
- Also fill fixed_asset_tax / management_fee / other_expenses from these items for backward compatibility.`;

export async function extractFromFile(filePath: string, mimeType: string): Promise<ExtractionResult> {
  const fileData = fs.readFileSync(filePath);
  const base64Data = fileData.toString('base64');

  let contentBlock: any;
  if (mimeType === 'application/pdf') {
    contentBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } };
  } else {
    contentBlock = { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } };
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: EXTRACTION_PROMPT }] }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleaned);
    if (!result.noi && result.noi_current) result.noi = result.noi_current;
    else if (!result.noi && result.noi_full_occupancy) result.noi = result.noi_full_occupancy;

    // Unit sanity check: back-calculate implied asking_price from cap_rate × NOI.
    // Auto-correct if the extracted value is off by a known unit multiplier.
    const noi = result.noi ?? result.noi_full_occupancy ?? result.noi_current;
    if (result.asking_price && result.cap_rate && noi) {
      const implied = noi / (result.cap_rate / 100);
      const ratio = result.asking_price / implied;
      if (ratio < 0.8 || ratio > 1.2) {
        // Try dividing/multiplying by common unit factors: 100, 10000, 1/100, 1/10000
        for (const factor of [100, 10000, 0.01, 0.0001]) {
          const corrected = result.asking_price / factor;
          const newRatio = corrected / implied;
          if (newRatio > 0.8 && newRatio < 1.2) {
            result.asking_price = Math.round(corrected);
            result._unit_correction = `asking_price ÷ ${factor} (cap_rate sanity check)`;
            break;
          }
        }
      }
    }

    return result;
  } catch {
    return { extraction_confidence: 0.1 };
  }
}
