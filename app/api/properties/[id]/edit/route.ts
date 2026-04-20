import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId } from '@/lib/db';

const ALLOWED_FIELDS = new Set([
  'address_extracted', 'station', 'walk_minutes', 'land_sqm', 'building_sqm', 'floors', 'year_built',
  'usage_type', 'structure', 'asking_price', 'noi', 'noi_full_occupancy', 'noi_current',
  'cap_rate', 'surface_yield', 'occupancy_rate', 'gross_rent', 'rent_per_sqm',
  'price_per_sqm', 'price_per_tsubo', 'unit_count', 'parking_count',
  'land_right_type', 'land_lease_monthly', 'land_lease_expiry',
  'fixed_asset_tax', 'management_fee', 'other_expenses', 'total_expenses',
  'lease_expiry_risk', 'special_notes', 'extraction_confidence',
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sql = getDb();
  const body = await req.json();

  const [existing] = await sql`
    SELECT id FROM property_extractions WHERE property_id = ${params.id}
    ORDER BY created_at DESC LIMIT 1
  `;

  const updates: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) updates[key] = val;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  if (existing) {
    // Build SET clause dynamically using a raw update approach
    // Neon tagged template doesn't support dynamic columns, so we upsert via replace
    await sql`
      UPDATE property_extractions SET manually_verified = 1
      WHERE id = ${existing.id as string}
    `;
    // Apply each field individually (safest approach with neon tagged templates)
    for (const [key, val] of Object.entries(updates)) {
      if (key === 'address_extracted') await sql`UPDATE property_extractions SET address_extracted = ${val as string} WHERE id = ${existing.id as string}`;
      else if (key === 'station') await sql`UPDATE property_extractions SET station = ${val as string} WHERE id = ${existing.id as string}`;
      else if (key === 'walk_minutes') await sql`UPDATE property_extractions SET walk_minutes = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'land_sqm') await sql`UPDATE property_extractions SET land_sqm = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'building_sqm') await sql`UPDATE property_extractions SET building_sqm = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'floors') await sql`UPDATE property_extractions SET floors = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'year_built') await sql`UPDATE property_extractions SET year_built = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'usage_type') await sql`UPDATE property_extractions SET usage_type = ${val as string} WHERE id = ${existing.id as string}`;
      else if (key === 'structure') await sql`UPDATE property_extractions SET structure = ${val as string} WHERE id = ${existing.id as string}`;
      else if (key === 'asking_price') await sql`UPDATE property_extractions SET asking_price = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'noi') await sql`UPDATE property_extractions SET noi = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'noi_full_occupancy') await sql`UPDATE property_extractions SET noi_full_occupancy = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'noi_current') await sql`UPDATE property_extractions SET noi_current = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'cap_rate') await sql`UPDATE property_extractions SET cap_rate = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'surface_yield') await sql`UPDATE property_extractions SET surface_yield = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'occupancy_rate') await sql`UPDATE property_extractions SET occupancy_rate = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'gross_rent') await sql`UPDATE property_extractions SET gross_rent = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'rent_per_sqm') await sql`UPDATE property_extractions SET rent_per_sqm = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'cap_rate') await sql`UPDATE property_extractions SET cap_rate = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'price_per_sqm') await sql`UPDATE property_extractions SET price_per_sqm = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'price_per_tsubo') await sql`UPDATE property_extractions SET price_per_tsubo = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'unit_count') await sql`UPDATE property_extractions SET unit_count = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'parking_count') await sql`UPDATE property_extractions SET parking_count = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'land_right_type') await sql`UPDATE property_extractions SET land_right_type = ${val as string} WHERE id = ${existing.id as string}`;
      else if (key === 'land_lease_monthly') await sql`UPDATE property_extractions SET land_lease_monthly = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'land_lease_expiry') await sql`UPDATE property_extractions SET land_lease_expiry = ${val as string} WHERE id = ${existing.id as string}`;
      else if (key === 'fixed_asset_tax') await sql`UPDATE property_extractions SET fixed_asset_tax = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'management_fee') await sql`UPDATE property_extractions SET management_fee = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'other_expenses') await sql`UPDATE property_extractions SET other_expenses = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'total_expenses') await sql`UPDATE property_extractions SET total_expenses = ${val as number} WHERE id = ${existing.id as string}`;
      else if (key === 'lease_expiry_risk') await sql`UPDATE property_extractions SET lease_expiry_risk = ${val as string} WHERE id = ${existing.id as string}`;
      else if (key === 'special_notes') await sql`UPDATE property_extractions SET special_notes = ${val as string} WHERE id = ${existing.id as string}`;
      else if (key === 'extraction_confidence') await sql`UPDATE property_extractions SET extraction_confidence = ${val as number} WHERE id = ${existing.id as string}`;
    }
  } else {
    // No extraction yet — create a minimal one
    const eid = generateId();
    await sql`
      INSERT INTO property_extractions (id, property_id, manually_verified, special_notes)
      VALUES (${eid}, ${params.id}, 1, ${(updates.special_notes as string) ?? null})
    `;
  }

  return NextResponse.json({ ok: true, updated: Object.keys(updates) });
}
