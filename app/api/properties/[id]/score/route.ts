import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId, migrateSchema, migrateScoreColumns, migrateScoreExitColumns } from '@/lib/db';
import { scoreProperty, DEFAULT_FINANCING, type FinancingParams } from '@/lib/scoring';
import { fetchMlitComparables } from '@/lib/comparable';
import { snapshotFromRows } from '@/lib/market';
import { generateInvestmentMemo } from '@/lib/memo';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await migrateSchema();
  await migrateScoreColumns();
  await migrateScoreExitColumns();

  const sql = getDb();

  const [property] = await sql`SELECT * FROM properties WHERE id = ${params.id}`;
  if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

  const [extraction] = await sql`
    SELECT * FROM property_extractions WHERE property_id = ${params.id}
    ORDER BY created_at DESC LIMIT 1
  `;
  if (!extraction) return NextResponse.json({ error: 'No extraction data yet — upload a document first' }, { status: 400 });

  const marketRows = await sql`
    SELECT DISTINCT ON (data_type) data_type, value
    FROM market_data ORDER BY data_type, recorded_at DESC
  `;
  const market = snapshotFromRows(marketRows as { data_type: string; value: number }[]);

  // Fetch MLIT comparable transactions
  const askingPrice = (extraction as Record<string, unknown>).asking_price as number | null;
  const buildingSqm = (extraction as Record<string, unknown>).building_sqm as number | null;
  const subjectUnitPrice = (askingPrice && buildingSqm && buildingSqm > 0)
    ? (askingPrice / buildingSqm) / 10000 : undefined;

  const mlitComp = await fetchMlitComparables(
    property.prefecture ?? '',
    property.city ?? '',
    property.property_type ?? 'マンション',
    subjectUnitPrice,
  ).catch(() => null);

  const comp = {
    avg_cap_rate: undefined as number | undefined,
    avg_rent_per_sqm: undefined as number | undefined,
    avg_price_per_tsubo: mlitComp?.avgPriceTsubo,
    sample_count: mlitComp?.sampleCount ?? 0,
  };

  const body = await req.json().catch(() => ({}));
  const financing: FinancingParams = {
    equity_ratio: body.equity_ratio ?? DEFAULT_FINANCING.equity_ratio,
    loan_rate:    body.loan_rate    ?? DEFAULT_FINANCING.loan_rate,
    loan_years:   body.loan_years   ?? DEFAULT_FINANCING.loan_years,
    hold_years:   body.hold_years   ?? DEFAULT_FINANCING.hold_years,
  };
  const areaSummary: string | undefined = body.area_news ?? undefined;

  const mergedProperty = { ...property, ...extraction };
  const scores = scoreProperty(mergedProperty, market, comp, financing);

  const memo = await generateInvestmentMemo(
    mergedProperty,
    scores as unknown as Record<string, unknown>,
    market as unknown as Record<string, unknown>,
    areaSummary,
  ).catch(() => '');

  const scoreId = generateId();
  await sql`
    INSERT INTO property_scores (
      id, property_id,
      acquisition_score, disposition_score, development_score, leasing_score, financing_score, overall_score,
      acquisition_rec, disposition_rec, development_rec, financing_rec,
      irr, levered_irr, annual_debt_service, annual_cashflow, equity_amount, loan_amount, payback_years,
      dscr, yield_on_cost, valuation_status,
      exit_cap_rate, exit_value, noi_gross, noi_adjusted, annual_capex,
      dscr_veto, land_reg_warning, industrial_opportunity, industrial_hub,
      investment_memo, market_data_snapshot
    ) VALUES (
      ${scoreId}, ${params.id},
      ${scores.acquisition_score}, ${scores.disposition_score}, ${scores.development_score},
      ${scores.leasing_score}, ${scores.financing_score}, ${scores.overall_score},
      ${scores.acquisition_rec}, ${scores.disposition_rec}, ${scores.development_rec}, ${scores.financing_rec},
      ${scores.irr}, ${scores.levered_irr}, ${scores.annual_debt_service}, ${scores.annual_cashflow},
      ${scores.equity_amount}, ${scores.loan_amount}, ${scores.payback_years},
      ${scores.dscr}, ${scores.yield_on_cost}, ${scores.valuation_status},
      ${scores.exit_cap_rate}, ${scores.exit_value}, ${scores.noi_gross}, ${scores.noi_adjusted}, ${scores.annual_capex},
      ${scores.dscr_veto}, ${scores.land_reg_warning}, ${scores.industrial_opportunity}, ${scores.industrial_hub ?? null},
      ${memo}, ${JSON.stringify(market)}
    )
  `;

  return NextResponse.json({ scores, memo, market });
}
