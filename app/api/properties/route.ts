import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const properties = db.prepare(`
    SELECT p.*,
      ps.overall_score, ps.acquisition_rec, ps.valuation_status, ps.irr,
      pe.cap_rate, pe.noi, pe.asking_price, pe.occupancy_rate,
      COUNT(pd.id) as doc_count
    FROM properties p
    LEFT JOIN property_scores ps ON ps.property_id = p.id
      AND ps.scored_at = (SELECT MAX(scored_at) FROM property_scores WHERE property_id = p.id)
    LEFT JOIN property_extractions pe ON pe.property_id = p.id
      AND pe.created_at = (SELECT MAX(created_at) FROM property_extractions WHERE property_id = p.id)
    LEFT JOIN property_documents pd ON pd.property_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
  return NextResponse.json(properties);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const id = generateId();
  db.prepare(`
    INSERT INTO properties (id, name, address, prefecture, city, property_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, body.name, body.address ?? '', body.prefecture ?? '東京都', body.city ?? '', body.property_type ?? 'office');
  return NextResponse.json({ id }, { status: 201 });
}
