import { NextResponse } from 'next/server';
import { getDb, generateId, initSchema } from '@/lib/db';
import { fetchAllMarketData } from '@/lib/market';

export async function POST() {
  await initSchema();
  const sql = getDb();
  const data = await fetchAllMarketData();
  for (const item of data) {
    await sql`INSERT INTO market_data (id, data_type, value, unit, source) VALUES (${generateId()}, ${item.data_type}, ${item.value}, ${item.unit}, ${item.source})`;
  }
  return NextResponse.json({ updated: data.length, data });
}

export async function GET() {
  await initSchema();
  const sql = getDb();
  const types = ['jpn_10y', 'us_10y', 'usdjpy', 'cnyjpy', 'jreit_index', 'chn_10y'];
  const result: Record<string, any[]> = {};
  for (const type of types) {
    const rows = await sql`SELECT value, recorded_at FROM market_data WHERE data_type = ${type} ORDER BY recorded_at DESC LIMIT 30`;
    result[type] = rows;
  }
  return NextResponse.json(result);
}
