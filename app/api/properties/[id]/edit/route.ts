import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const ALLOWED = ['station','walk_minutes','land_sqm','building_sqm','floors','structure',
  'unit_count','parking_count','price_per_tsubo','land_right_type',
  'land_lease_monthly','land_lease_expiry','fixed_asset_tax','special_notes',
  'cap_rate','noi','occupancy_rate','asking_price','rent_per_sqm','year_built'];

const NUMERIC = ['walk_minutes','land_sqm','building_sqm','floors','unit_count',
  'parking_count','land_lease_monthly','fixed_asset_tax','cap_rate','noi',
  'occupancy_rate','asking_price','rent_per_sqm','year_built','price_per_tsubo'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sql = getDb();
  const { field, value } = await req.json();
  if (!ALLOWED.includes(field)) return NextResponse.json({ error: 'Not allowed' }, { status: 400 });
  const val = NUMERIC.includes(field) ? parseFloat(value) || null : value || null;
  await sql`UPDATE property_extractions SET manually_verified = 1 WHERE property_id = ${params.id}`;
  return NextResponse.json({ ok: true, field, value: val });
}
