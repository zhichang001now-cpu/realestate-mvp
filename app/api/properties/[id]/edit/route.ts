import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const ALLOWED_FIELDS = [
  'station','walk_minutes','land_sqm','building_sqm','floors','structure',
  'unit_count','parking_count','price_per_tsubo','land_right_type',
  'land_lease_monthly','land_lease_expiry','fixed_asset_tax','special_notes',
  'cap_rate','noi','occupancy_rate','asking_price','rent_per_sqm','year_built',
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const { field, value } = await req.json();
  if (!ALLOWED_FIELDS.includes(field)) {
    return NextResponse.json({ error: 'Field not allowed' }, { status: 400 });
  }
  const numericFields = ['walk_minutes','land_sqm','building_sqm','floors','unit_count',
    'parking_count','price_per_tsubo','land_lease_monthly','fixed_asset_tax',
    'cap_rate','noi','occupancy_rate','asking_price','rent_per_sqm','year_built'];
  const parsedValue = numericFields.includes(field) ? parseFloat(value) || null : value || null;

  const existing = db.prepare(`SELECT id FROM property_extractions WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`).get(params.id) as any;
  if (existing) {
    db.prepare(`UPDATE property_extractions SET ${field} = ?, manually_verified = 1 WHERE id = ?`).run(parsedValue, existing.id);
  }
  return NextResponse.json({ ok: true });
}
