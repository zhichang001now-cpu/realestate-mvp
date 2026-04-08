import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateId } from '@/lib/db';
import { extractFromFile } from '@/lib/extraction';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const propertyId = params.id;
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const docType = (formData.get('doc_type') as string) ?? 'brochure';
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const uploadDir = path.join(process.cwd(), 'data', 'uploads', propertyId);
  fs.mkdirSync(uploadDir, { recursive: true });
  const docId = generateId();
  const ext = file.name.split('.').pop();
  const filePath = path.join(uploadDir, `${docId}.${ext}`);
  fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));
  db.prepare(`INSERT INTO property_documents (id, property_id, doc_type, filename, file_path) VALUES (?,?,?,?,?)`)
    .run(docId, propertyId, docType, file.name, filePath);

  let extraction = null;
  try {
    extraction = await extractFromFile(filePath, file.type);
    const eid = generateId();
    db.prepare(`
      INSERT INTO property_extractions (
        id, property_id, document_id,
        address_extracted, station, walk_minutes, land_sqm, building_sqm, floors,
        year_built, usage_type, structure,
        asking_price, noi, noi_full_occupancy, noi_current, cap_rate, surface_yield,
        occupancy_rate, gross_rent, rent_per_sqm, price_per_sqm, price_per_tsubo,
        unit_count, parking_count,
        land_right_type, land_lease_monthly, land_lease_expiry,
        fixed_asset_tax, management_fee, other_expenses, total_expenses,
        tenant_summary, lease_expiry_risk, special_notes, raw_all_fields,
        extraction_confidence, raw_extraction
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      eid, propertyId, docId,
      extraction.address_extracted ?? null, extraction.station ?? null, extraction.walk_minutes ?? null,
      extraction.land_sqm ?? null, extraction.building_sqm ?? null, extraction.floors ?? null,
      extraction.year_built ?? null, extraction.usage_type ?? null, extraction.structure ?? null,
      extraction.asking_price ?? null, extraction.noi ?? null,
      extraction.noi_full_occupancy ?? null, extraction.noi_current ?? null,
      extraction.cap_rate ?? null, extraction.surface_yield ?? null,
      extraction.occupancy_rate ?? null, extraction.gross_rent ?? null,
      extraction.rent_per_sqm ?? null, extraction.price_per_sqm ?? null, extraction.price_per_tsubo ?? null,
      extraction.unit_count ?? null, extraction.parking_count ?? null,
      extraction.land_right_type ?? null, extraction.land_lease_monthly ?? null, extraction.land_lease_expiry ?? null,
      extraction.fixed_asset_tax ?? null, extraction.management_fee ?? null,
      extraction.other_expenses ?? null, extraction.total_expenses ?? null,
      JSON.stringify(extraction.tenant_summary ?? []),
      extraction.lease_expiry_risk ?? 'low',
      extraction.special_notes ?? null,
      JSON.stringify(extraction.raw_all_fields ?? {}),
      extraction.extraction_confidence ?? 0.5,
      JSON.stringify(extraction)
    );
    db.prepare(`UPDATE property_documents SET extracted_at = CURRENT_TIMESTAMP WHERE id = ?`).run(docId);
  } catch (err) {
    console.error('Extraction error:', err);
  }
  return NextResponse.json({ docId, extraction }, { status: 201 });
}
