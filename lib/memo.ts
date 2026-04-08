import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateInvestmentMemo(
  property: any,
  scores: any,
  market: any,
  comparables: any
): Promise<string> {
  const isBorrowedLand = property.land_right_type && property.land_right_type !== '所有権';

  const prompt = `You are a senior Japanese real estate investment analyst writing a memo for an investment committee.

Property data:
- Name: ${property.name ?? 'N/A'} / Address: ${property.address ?? 'N/A'}
- Type: ${property.property_type} / Structure: ${property.structure ?? 'N/A'}
- Year built: ${property.year_built ? new Date().getFullYear() - property.year_built + '年築（' + property.year_built + '年）' : 'N/A'}
- Land right: ${property.land_right_type ?? '所有権'}${isBorrowedLand ? ` 地代¥${property.land_lease_monthly?.toLocaleString()}/月 期限${property.land_lease_expiry ?? 'N/A'}` : ''}
- Cap rate: ${property.cap_rate}% / Surface yield: ${property.surface_yield ?? 'N/A'}%
- NOI current: ¥${property.noi_current?.toLocaleString() ?? 'N/A'} / Full occupancy NOI: ¥${property.noi_full_occupancy?.toLocaleString() ?? 'N/A'}
- Occupancy: ${property.occupancy_rate}% / Units: ${property.unit_count ?? 'N/A'}
- Special notes: ${property.special_notes ?? 'none'}

Market: JPN10Y=${market.jpn_10y}%, US10Y=${market.us_10y}%, USD/JPY=${market.usdjpy}, CNY/JPY=${market.cnyjpy ?? 'N/A'}
IRR=${scores.irr}%, Levered IRR=${scores.levered_irr}%
Scores: Acquisition=${scores.acquisition_score}, Leasing=${scores.leasing_score}, Financing=${scores.financing_score}
Recommendation: ${scores.acquisition_rec} / Financing: ${scores.financing_rec}

Write a 3-4 sentence investment memo in Japanese following these STRICT rules:
1. NO subject (主語なし) — do NOT use 「〜を推奨する」「〜と判断する」「〜を求める」
2. Objective, factual tone — state facts and implications, not recommendations with subject
3. Format: [Key strength]. [Main risk]. [NOI/cashflow insight if relevant]. [One key condition or action point].
4. Use specific numbers from the data above
5. Output memo text ONLY, no title, no header`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
