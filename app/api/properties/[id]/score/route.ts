import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId, initSchema } from '@/lib/db';
import { scoreProperty, DEFAULT_FINANCING, FinancingParams } from '@/lib/scoring';
import { generateInvestmentMemo } from '@/lib/memo';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await initSchema();
  const sql = getDb();
  let financing: FinancingParams = DEFAULT_FINANCING;
  try {
    const body = await req.json();
    if (body.financing) financing = {
      equity_ratio: parseFloat(body.financing.equity_ratio) || DEFAULT_FINANCING.equity_ratio,
      loan_rate: parseFloat(body.financing.loan_rate) || DEFAULT_FINANCING.loan_rate,
      loan_years: parseInt(body.financing.loan_years) || DEFAULT_FINANCING.loan_years,
      hold_years: parseInt(body.financing.hold_years) || DEFAULT_FINANCING.hold_years,
    };
  } catch {}

  const rows = await sql`SELECT p.*, pe.* FROM properties p LEFT JOIN property_extractions pe ON pe.property_id = p.id WHERE p.id = ${params.id} ORDER BY pe.created_at DESC LIMIT 1`;
  const property = rows[0];
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const marketRows = await sql`SELECT DISTINCT ON (data_type) data_type, value FROM market_data ORDER BY data_type, recorded_at DESC`;
  const market: Record<string, number> = {};
  for (const r of marketRows) market[r.data_type] = r.value;
  if (!market.jpn_10y) market.jpn_10y = 1.05;
  if (!market.us_10y)  market.us_10y  = 4.22;
  if (!market.usdjpy)  market.usdjpy  = 149.5;
  if (!market.cnyjpy)  market.cnyjpy  = 20.5;
  if (!market.chn_10y) market.chn_10y = 1.65;
  if (!market.jreit_index) market.jreit_index = 1842;

  const compRows = await sql`SELECT AVG(cap_rate) as avg_cap_rate, AVG(price_per_tsubo) as avg_price_per_tsubo, AVG(rent_per_sqm) as avg_rent_per_sqm, COUNT(*) as sample_count FROM comparables WHERE prefecture = ${property.prefecture ?? '東京都'} AND property_type = ${property.property_type ?? 'office'}`;
  const comparables = (compRows[0] ?? { sample_count: 0 }) as any;

  const scores = scoreProperty(property, market as any, comparables, financing);
  const memo = await generateInvestmentMemo(property, scores, market, comparables);
  const sid = generateId();

  await sql`INSERT INTO property_scores (id, property_id, acquisition_score, disposition_score, development_score, leasing_score, financing_score, overall_score, acquisition_rec, disposition_rec, development_rec, financing_rec, irr, levered_irr, yield_on_cost, valuation_status, investment_memo, market_data_snapshot) VALUES (${sid}, ${params.id}, ${scores.acquisition_score}, ${scores.disposition_score}, ${scores.development_score}, ${scores.leasing_score}, ${scores.financing_score}, ${scores.overall_score}, ${scores.acquisition_rec}, ${scores.disposition_rec}, ${scores.development_rec}, ${scores.financing_rec}, ${scores.irr}, ${scores.levered_irr}, ${scores.yield_on_cost}, ${scores.valuation_status}, ${memo}, ${JSON.stringify(market)})`;

  return NextResponse.json({ ...scores, investment_memo: memo });
}
