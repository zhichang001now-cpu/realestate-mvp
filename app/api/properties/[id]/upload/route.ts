import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId, initSchema, migrateExtractionColumns } from '@/lib/db';

const EXTRACTION_PROMPT = `Extract all data from this Japanese real estate document.

STEP 1 — Convert ALL monetary values to raw JPY integers before filling JSON:
  億円×100000000, 百万円×1000000, 万円×10000, 円×1
  Mixed: 1億6,000万円 = 160000000. Table header "（百万円）" means all values in that column ×1000000.
  NEVER apply two multipliers to the same number.
  Sanity check: if cap_rate(%) given, asking_price ≈ NOI ÷ (cap_rate/100). Fix unit if mismatch ×100 or ×10000.

STEP 2 — Extract into JSON:
  令和X年=2018+X, 平成X年=1988+X, 昭和X年=1925+X. 1坪=3.3058㎡.
  Extract both 満室想定(noi_full_occupancy) and 現況(noi_current).
Return ONLY valid JSON with NO markdown fences:
{"address_extracted":null,"station":null,"walk_minutes":null,"land_sqm":null,"building_sqm":null,"floors":null,"year_built":null,"usage_type":null,"structure":null,"asking_price":null,"noi_full_occupancy":null,"noi_current":null,"noi":null,"cap_rate":null,"surface_yield":null,"occupancy_rate":null,"gross_rent":null,"rent_per_sqm":null,"price_per_sqm":null,"price_per_tsubo":null,"unit_count":null,"parking_count":null,"land_right_type":null,"land_lease_monthly":null,"land_lease_expiry":null,"fixed_asset_tax":null,"management_fee":null,"other_expenses":null,"total_expenses":null,"tenant_summary":[],"lease_expiry_risk":"low","special_notes":null,"postal_code":null,"raw_all_fields":{},"extraction_confidence":0.5}`;

function parseExtractionJson(text: string): Record<string, unknown> {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  // Find first { and last } to handle any surrounding text
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await initSchema();
  await migrateExtractionColumns();
  const sql = getDb();

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const docType = (formData.get('doc_type') as string) ?? 'brochure';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 });

  const [prop] = await sql`SELECT id FROM properties WHERE id = ${params.id}`;
  if (!prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

  const docId = generateId();
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64Data = buffer.toString('base64');

  await sql`
    INSERT INTO property_documents (id, property_id, doc_type, filename, file_path)
    VALUES (${docId}, ${params.id}, ${docType}, ${file.name}, ${'blob:' + docId})
  `;

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const contentBlock =
    file.type === 'application/pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64Data } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64Data } };

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: EXTRACTION_PROMPT }] }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const extraction = parseExtractionJson(text);

  if (!extraction.noi) {
    extraction.noi = extraction.noi_current ?? extraction.noi_full_occupancy ?? null;
  }

  const eid = generateId();
  await sql`
    INSERT INTO property_extractions (
      id, property_id, document_id,
      address_extracted, station, walk_minutes, land_sqm, building_sqm, floors, year_built,
      usage_type, structure, asking_price, noi, noi_full_occupancy, noi_current,
      cap_rate, surface_yield, occupancy_rate, gross_rent, rent_per_sqm,
      price_per_sqm, price_per_tsubo, unit_count, parking_count,
      land_right_type, land_lease_monthly, land_lease_expiry,
      fixed_asset_tax, management_fee, other_expenses, total_expenses,
      tenant_summary, lease_expiry_risk, special_notes,
      raw_all_fields, extraction_confidence, postal_code, raw_extraction
    ) VALUES (
      ${eid}, ${params.id}, ${docId},
      ${extraction.address_extracted ?? null}, ${extraction.station ?? null}, ${extraction.walk_minutes ?? null},
      ${extraction.land_sqm ?? null}, ${extraction.building_sqm ?? null}, ${extraction.floors ?? null}, ${extraction.year_built ?? null},
      ${extraction.usage_type ?? null}, ${extraction.structure ?? null},
      ${extraction.asking_price ?? null}, ${extraction.noi ?? null}, ${extraction.noi_full_occupancy ?? null}, ${extraction.noi_current ?? null},
      ${extraction.cap_rate ?? null}, ${extraction.surface_yield ?? null}, ${extraction.occupancy_rate ?? null}, ${extraction.gross_rent ?? null},
      ${extraction.rent_per_sqm ?? null}, ${extraction.price_per_sqm ?? null}, ${extraction.price_per_tsubo ?? null},
      ${extraction.unit_count ?? null}, ${extraction.parking_count ?? null},
      ${extraction.land_right_type ?? null}, ${extraction.land_lease_monthly ?? null}, ${extraction.land_lease_expiry ?? null},
      ${extraction.fixed_asset_tax ?? null}, ${extraction.management_fee ?? null}, ${extraction.other_expenses ?? null}, ${extraction.total_expenses ?? null},
      ${JSON.stringify(extraction.tenant_summary ?? [])}, ${extraction.lease_expiry_risk ?? 'low'}, ${extraction.special_notes ?? null},
      ${JSON.stringify(extraction.raw_all_fields ?? {})}, ${extraction.extraction_confidence ?? 0.5}, ${(extraction.postal_code as string) ?? null}, ${JSON.stringify(extraction)}
    )
  `;

  await sql`UPDATE property_documents SET extracted_at = NOW() WHERE id = ${docId}`;

  // Update properties.prefecture and properties.city from extracted address
  if (extraction.address_extracted) {
    const addr = extraction.address_extracted as string;
    const prefMatch = addr.match(/^(.+?[都道府県])/);
    const cityMatch = addr.match(/[都道府県](.+?[市区町村])/);
    const pref = prefMatch?.[1] ?? null;
    const city = cityMatch?.[1] ?? null;
    if (pref || city) {
      await sql`UPDATE properties SET prefecture = ${pref}, city = ${city} WHERE id = ${params.id}`;
    }
  }

  return NextResponse.json({ docId, extraction }, { status: 201 });
}
