import { NextResponse } from 'next/server';
import { getDb, generateId } from '@/lib/db';
import { fetchAllMarketData } from '@/lib/market';

export async function POST() {
  const db = getDb();
  const data = await fetchAllMarketData();
  const insert = db.prepare(`INSERT INTO market_data (id, data_type, value, unit, source) VALUES (?,?,?,?,?)`);
  const insertMany = db.transaction((items: typeof data) => {
    for (const item of items) insert.run(generateId(), item.data_type, item.value, item.unit, item.source);
  });
  insertMany(data);
  return NextResponse.json({ updated: data.length, data });
}

export async function GET() {
  const db = getDb();
  const types = ['jpn_10y', 'us_10y', 'usdjpy', 'jreit_index'];
  const result: Record<string, any[]> = {};
  for (const type of types) {
    result[type] = db.prepare(
      `SELECT value, recorded_at FROM market_data WHERE data_type = ? ORDER BY recorded_at DESC LIMIT 30`
    ).all(type);
  }
  return NextResponse.json(result);
}
