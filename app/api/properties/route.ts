import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId, initSchema } from '@/lib/db';

export async function GET() {
  await initSchema();
  const sql = getDb();
  const rows = await sql`
    SELECT
      p.id, p.name, p.address, p.prefecture, p.city, p.property_type, p.status, p.created_at,
      pe.asking_price, pe.cap_rate, pe.noi_current, pe.noi_full_occupancy, pe.occupancy_rate,
      pe.year_built, pe.building_sqm, pe.land_right_type, pe.unit_count,
      ps.overall_score, ps.acquisition_score, ps.leasing_score, ps.financing_score,
      ps.irr, ps.levered_irr, ps.acquisition_rec, ps.valuation_status
    FROM properties p
    LEFT JOIN LATERAL (
      SELECT * FROM property_extractions WHERE property_id = p.id ORDER BY created_at DESC LIMIT 1
    ) pe ON true
    LEFT JOIN LATERAL (
      SELECT * FROM property_scores WHERE property_id = p.id ORDER BY scored_at DESC LIMIT 1
    ) ps ON true
    WHERE p.status = 'active'
    ORDER BY p.created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await initSchema();
  const sql = getDb();
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const id = generateId();
  await sql`
    INSERT INTO properties (id, name, address, prefecture, city, property_type)
    VALUES (${id}, ${body.name}, ${body.address ?? null}, ${body.prefecture ?? null},
            ${body.city ?? null}, ${body.property_type ?? 'マンション'})
  `;
  return NextResponse.json({ id }, { status: 201 });
}
