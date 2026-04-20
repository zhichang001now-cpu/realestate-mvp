import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sql = getDb();
  const [property] = await sql`SELECT * FROM properties WHERE id = ${params.id}`;
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [extraction] = await sql`
    SELECT * FROM property_extractions WHERE property_id = ${params.id}
    ORDER BY created_at DESC LIMIT 1
  `;
  const [score] = await sql`
    SELECT * FROM property_scores WHERE property_id = ${params.id}
    ORDER BY scored_at DESC LIMIT 1
  `;
  const documents = await sql`
    SELECT * FROM property_documents WHERE property_id = ${params.id}
    ORDER BY created_at DESC
  `;
  const marketRows = await sql`
    SELECT DISTINCT ON (data_type) data_type, value, unit, source, recorded_at
    FROM market_data ORDER BY data_type, recorded_at DESC
  `;

  return NextResponse.json({ property, extraction: extraction ?? null, score: score ?? null, documents, marketRows });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const sql = getDb();
  await sql`UPDATE properties SET status = 'deleted' WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
