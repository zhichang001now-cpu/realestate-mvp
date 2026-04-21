import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fetchMlitComparables } from '@/lib/comparable';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get('property_id');
  if (!propertyId) return NextResponse.json({ error: 'property_id required' }, { status: 400 });

  const sql = getDb();

  const [property] = await sql`SELECT prefecture, city, property_type FROM properties WHERE id = ${propertyId}`;
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [extraction] = await sql`
    SELECT asking_price, building_sqm FROM property_extractions
    WHERE property_id = ${propertyId} ORDER BY created_at DESC LIMIT 1
  `;

  const prefecture = (property.prefecture as string | null) ?? '';
  const city = (property.city as string | null) ?? '';
  const propertyType = (property.property_type as string | null) ?? 'マンション';

  if (!prefecture || !city) {
    return NextResponse.json({ error: 'Prefecture/city not set — upload a document first' }, { status: 422 });
  }

  // Compute subject price per sqm if available
  const askingPrice = extraction?.asking_price as number | null;
  const buildingSqm = extraction?.building_sqm as number | null;
  const subjectUnitPrice = (askingPrice && buildingSqm && buildingSqm > 0)
    ? (askingPrice / buildingSqm) / 10000  // 万円/㎡
    : undefined;

  const summary = await fetchMlitComparables(prefecture, city, propertyType, subjectUnitPrice);
  if (!summary) {
    return NextResponse.json({ error: 'No MLIT data available for this area' }, { status: 404 });
  }

  return NextResponse.json({
    prefecture,
    city,
    propertyType,
    subjectUnitPriceSqm: subjectUnitPrice ?? null,
    subjectPriceTsubo: subjectUnitPrice ? Math.round(subjectUnitPrice * 3.30578 * 10) / 10 : null,
    ...summary,
  });
}
