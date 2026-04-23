import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId, initSchema, migrateExtractionColumns } from '@/lib/db';
import { EXTRACTION_PROMPT } from '@/lib/extraction';

export const maxDuration = 120;

const VERIFY_ITEMS_PROMPT = `You are verifying a Japanese real estate document extraction.
Focus ONLY on the 備考 (remarks), 特記事項, 収支明細, and any income/expense section.

Extract ALL income and expense line items. Return ONLY this JSON, no markdown:
{
  "income_items": [{"label": "exact Japanese label", "amount": integer_JPY_per_year}],
  "expense_items": [{"label": "exact Japanese label", "amount": integer_JPY_per_year}]
}

Rules:
- 月額 (monthly) → multiply by 12 to get annual amount
- 年額 (annual)  → use as-is
- For unit-based rents like "A区画(44.5㎡)/月額238,700円" → label="A区画リース料", amount=238700×12=2864400
- Include ALL: 各区画リース料, 管理費, 修繕積立金, 固定資産税, 共用部清掃費, and any other line item
- Do NOT skip any row. Do NOT merge items.`;

type ItemArray = Array<{ label: string; amount: number }>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callExtract(client: any, contentBlock: any, prompt: string, maxTokens: number): Promise<Record<string, unknown>> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }],
  });
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in response');
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

  // Pass 1: full extraction
  const extraction = await callExtract(client, contentBlock, EXTRACTION_PROMPT, 8000);

  if (!extraction.noi) {
    extraction.noi = extraction.noi_current ?? extraction.noi_full_occupancy ?? null;
  }

  // Pass 2: if income_items empty, run a focused 備考-section re-extraction
  let incomeItems = (extraction.income_items ?? []) as ItemArray;
  let expenseItems = (extraction.expense_items ?? []) as ItemArray;

  if (incomeItems.length === 0) {
    try {
      const verify1 = await callExtract(client, contentBlock, VERIFY_ITEMS_PROMPT, 4000);
      incomeItems = (verify1.income_items ?? []) as ItemArray;
      expenseItems = (verify1.expense_items ?? []) as ItemArray;

      // Pass 3: still empty → one final retry
      if (incomeItems.length === 0) {
        const verify2 = await callExtract(client, contentBlock, VERIFY_ITEMS_PROMPT, 4000);
        incomeItems = (verify2.income_items ?? []) as ItemArray;
        expenseItems = (verify2.expense_items ?? []) as ItemArray;
      }
    } catch {
      // verification failed — keep whatever pass 1 returned
    }
  }

  extraction.income_items = incomeItems;
  extraction.expense_items = expenseItems;

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
      raw_all_fields, extraction_confidence, postal_code, raw_extraction,
      income_items, expense_items
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
      ${JSON.stringify(extraction.raw_all_fields ?? {})}, ${extraction.extraction_confidence ?? 0.5}, ${(extraction.postal_code as string) ?? null}, ${JSON.stringify(extraction)},
      ${JSON.stringify(extraction.income_items ?? [])}, ${JSON.stringify(extraction.expense_items ?? [])}
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
