import { NextResponse } from 'next/server';
import { getDb, generateId, initSchema } from '@/lib/db';
import { fetchAllMarketData, snapshotFromRows } from '@/lib/market';

export async function GET() {
  return handleRefresh();
}

export async function POST() {
  return handleRefresh();
}

async function handleRefresh() {
  await initSchema();
  const sql = getDb();

  const dataPoints = await fetchAllMarketData();

  for (const dp of dataPoints) {
    await sql`
      INSERT INTO market_data (id, data_type, value, unit, source)
      VALUES (${generateId()}, ${dp.data_type}, ${dp.value}, ${dp.unit}, ${dp.source})
    `;
  }

  const rows = await sql`
    SELECT DISTINCT ON (data_type) data_type, value, unit, source, recorded_at
    FROM market_data ORDER BY data_type, recorded_at DESC
  `;

  const snapshot = snapshotFromRows(rows as { data_type: string; value: number }[]);
  return NextResponse.json({ snapshot, raw: rows });
}
