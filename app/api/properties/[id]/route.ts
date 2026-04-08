import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await initSchema();
  const sql = getDb();
  const rows = await sql`
    SELECT p.*, pe.address_extracted, pe.station, pe.walk_minutes, pe.land_sqm, pe.building_sqm,
      pe.floors, pe.year_built, pe.usage_type, pe.structure, pe.asking_price, pe.noi,
      pe.noi_full_occupancy, pe.noi_current, pe.cap_rate, pe.surface_yield, pe.occupancy_rate,
      pe.gross_rent, pe.rent_per_sqm, pe.price_per_sqm, pe.price_per_tsubo, pe.unit_count,
      pe.parking_count, pe.land_right_type, pe.land_lease_monthly, pe.land_lease_expiry,
      pe.fixed_asset_tax, pe.management_fee, pe.special_notes, pe.raw_all_fields, pe.extraction_confidence,
      ps.overall_score, ps.acquisition_score, ps.disposition_score, ps.development_score,
      ps.leasing_score, ps.financing_score, ps.acquisition_rec, ps.disposition_rec,
      ps.development_rec, ps.financing_rec, ps.irr, ps.levered_irr, ps.yield_on_cost,
      ps.valuation_status, ps.investment_memo
    FROM properties p
    LEFT JOIN property_extractions pe ON pe.property_id = p.id
    LEFT JOIN property_scores ps ON ps.property_id = p.id
    WHERE p.id = ${params.id}
    ORDER BY pe.created_at DESC, ps.scored_at DESC LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}
