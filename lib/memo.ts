import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateInvestmentMemo(
  property: Record<string, unknown>,
  scores: Record<string, unknown>,
  market: Record<string, unknown>,
  areaSummary?: string,
): Promise<string> {
  const isBorrowedLand = property.land_right_type && property.land_right_type !== '所有権';
  const yearBuilt = property.year_built as number | null;
  const age = yearBuilt ? new Date().getFullYear() - yearBuilt : null;

  const prompt = `You are a senior Japanese real estate investment analyst writing a memo for an investment committee.

Property:
- Name: ${property.name ?? 'N/A'} / Address: ${property.address ?? 'N/A'}
- Type: ${property.property_type} / Structure: ${property.structure ?? 'N/A'}
- Age: ${age != null ? `${age}年築（${yearBuilt}年）` : 'N/A'}
- Land right: ${property.land_right_type ?? '所有権'}${isBorrowedLand ? ` 地代¥${(property.land_lease_monthly as number)?.toLocaleString()}/月 期限${property.land_lease_expiry ?? 'N/A'}` : ''}
- Cap rate: ${property.cap_rate}% / Surface yield: ${property.surface_yield ?? 'N/A'}%
- NOI current: ¥${(property.noi_current as number)?.toLocaleString() ?? 'N/A'} / Full occupancy NOI: ¥${(property.noi_full_occupancy as number)?.toLocaleString() ?? 'N/A'}
- Occupancy: ${property.occupancy_rate}% / Units: ${property.unit_count ?? 'N/A'}
- Special notes: ${property.special_notes ?? 'none'}

Market: JPN10Y=${market.jpn_10y}%, US10Y=${market.us_10y}%, USD/JPY=${market.usdjpy}
IRR=${scores.irr}%, Levered IRR=${scores.levered_irr}%
Scores: Acquisition=${scores.acquisition_score}, Leasing=${scores.leasing_score}, Financing=${scores.financing_score}
Rec: ${scores.acquisition_rec} / Financing: ${scores.financing_rec}
${areaSummary ? `\nArea development context: ${areaSummary}` : ''}
Write a 3-4 sentence investment memo in Japanese. STRICT rules:
1. 主語なし — do NOT use「〜を推奨する」「〜と判断する」
2. Objective, factual tone
3. Format: [Key strength]. [Main risk]. [NOI/cashflow insight]. [One key condition]
4. Use specific numbers from the data above
5. Output memo text ONLY, no title
${areaSummary ? '6. Incorporate the area development context naturally into the memo' : ''}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.content[0].type !== 'text') throw new Error('Unexpected response type from Claude');
  return response.content[0].text;
}
