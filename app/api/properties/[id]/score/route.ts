import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId } from '@/lib/db';
import { scoreProperty, DEFAULT_FINANCING, FinancingParams } from '@/lib/scoring';
import { generateInvestmentMemo } from '@/lib/memo';
import { getLatestMarketSnapshot } from '@/lib/market';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  
  // Accept optional financing params from request body
  let financing: FinancingParams = DEFAULT_FINANCING;
  try {
    const body = await req.json();
    if (body.financing) {
      financing = {
        equity_ratio: parseFloat(body.financing.equity_ratio) || DEFAULT_FINANCING.equity_ratio,
        loan_rate: parseFloat(body.financing.loan_rate) || DEFAULT_FINANCING.loan_rate,
        loan_years: parseInt(body.financing.loan_years) || DEFAULT_FINANCING.loan_years,
        hold_years: parseInt(body.financing.hold_years) || DEFAULT_FINANCING.hold_years,
      };
    }
  } catch {}

  const property = db.prepare(`
    SELECT p.*, pe.* FROM properties p
    LEFT JOIN property_extractions pe ON pe.property_id = p.id
    WHERE p.id = ? ORDER BY pe.created_at DESC LIMIT 1
  `).get(params.id) as any;
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const market = await getLatestMarketSnapshot(db);
  const comparables = db.prepare(`
    SELECT AVG(cap_rate) as avg_cap_rate, AVG(price_per_tsubo) as avg_price_per_tsubo,
           AVG(rent_per_sqm) as avg_rent_per_sqm, COUNT(*) as sample_count
    FROM comparables WHERE prefecture = ? AND property_type = ?
    AND transaction_date >= date('now', '-2 years')
  `).get(property.prefecture ?? '東京都', property.property_type ?? 'office') as any;

  const scores = scoreProperty(property, market as any, comparables ?? { sample_count: 0 }, financing);
  const memo = await generateInvestmentMemo(property, scores, market, comparables);

  const sid = generateId();
  db.prepare(`
    INSERT INTO property_scores (
      id, property_id,
      acquisition_score, disposition_score, development_score, leasing_score, financing_score,
      overall_score, acquisition_rec, disposition_rec, development_rec, financing_rec,
      irr, levered_irr, yield_on_cost, valuation_status, investment_memo, market_data_snapshot
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    sid, params.id,
    scores.acquisition_score, scores.disposition_score, scores.development_score,
    scores.leasing_score, scores.financing_score, scores.overall_score,
    scores.acquisition_rec, scores.disposition_rec, scores.development_rec, scores.financing_rec,
    scores.irr, scores.levered_irr, scores.yield_on_cost,
    scores.valuation_status, memo, JSON.stringify(market)
  );

  return NextResponse.json({
    ...scores,
    investment_memo: memo,
    financing_used: financing,
  });
}
