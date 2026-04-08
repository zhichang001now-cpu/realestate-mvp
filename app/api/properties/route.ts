import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId, initSchema } from '@/lib/db';

export async function GET() {
  await initSchema();
  const sql = getDb();
  const rows = await sql`
    SELECT p.*, ps.overall_score, ps.acquisition_rec, ps.valuation_status, ps.irr,
      pe.cap_rate, pe.noi, pe.asking_price, pe.occupancy_rate
    FROM properties p
    LEFT JOIN property_scores ps ON ps.property_id = p.id
      AND ps.scored_at = (SELECT MAX(scored_at) FROM property_scores WHERE property_id = p.id)
    LEFT JOIN property_extractions pe ON pe.property_id = p.id
      AND pe.created_at = (SELECT MAX(created_at) FROM property_extractions WHERE property_id = p.id)
    ORDER BY p.created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await initSchema();
  const sql = getDb();
  const body = await req.json();
  const id = generateId();
  await sql`INSERT INTO properties (id, name, address, prefecture, city, property_type) VALUES (${id}, ${body.name}, ${body.address ?? ''}, ${body.prefecture ?? '東京都'}, ${body.city ?? ''}, ${body.property_type ?? 'office'})`;
  return NextResponse.json({ id }, { status: 201 });
}
