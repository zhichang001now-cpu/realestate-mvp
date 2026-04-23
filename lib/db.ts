import { neon } from '@neondatabase/serverless';

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return neon(url);
}

export async function initSchema() {
  const sql = getDb();
  await sql`CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    prefecture TEXT,
    city TEXT,
    property_type TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS property_documents (
    id TEXT PRIMARY KEY,
    property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
    doc_type TEXT,
    filename TEXT,
    file_path TEXT,
    extracted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS property_extractions (
    id TEXT PRIMARY KEY,
    property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
    document_id TEXT,
    address_extracted TEXT, station TEXT, walk_minutes INTEGER,
    land_sqm REAL, building_sqm REAL, floors INTEGER, year_built INTEGER,
    usage_type TEXT, structure TEXT,
    asking_price REAL, noi REAL, noi_full_occupancy REAL, noi_current REAL,
    cap_rate REAL, surface_yield REAL, occupancy_rate REAL, gross_rent REAL,
    rent_per_sqm REAL, price_per_sqm REAL, price_per_tsubo REAL,
    unit_count INTEGER, parking_count INTEGER,
    land_right_type TEXT, land_lease_monthly REAL, land_lease_expiry TEXT,
    fixed_asset_tax REAL, management_fee REAL, other_expenses REAL, total_expenses REAL,
    tenant_summary TEXT, lease_expiry_risk TEXT, special_notes TEXT,
    raw_all_fields TEXT, extraction_confidence REAL, postal_code TEXT,
    manually_verified INTEGER DEFAULT 0,
    raw_extraction TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS property_scores (
    id TEXT PRIMARY KEY,
    property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
    acquisition_score REAL, disposition_score REAL, development_score REAL,
    leasing_score REAL, financing_score REAL, overall_score REAL,
    acquisition_rec TEXT, disposition_rec TEXT, development_rec TEXT, financing_rec TEXT,
    irr REAL, levered_irr REAL, annual_debt_service REAL, annual_cashflow REAL, equity_amount REAL, loan_amount REAL, payback_years REAL, yield_on_cost REAL, valuation_status TEXT,
    investment_memo TEXT, market_data_snapshot TEXT,
    scored_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS market_data (
    id TEXT PRIMARY KEY,
    data_type TEXT,
    value REAL,
    unit TEXT,
    source TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS comparables (
    id TEXT PRIMARY KEY,
    property_id TEXT,
    source TEXT, prefecture TEXT, city TEXT, district TEXT, property_type TEXT,
    transaction_date DATE, price_per_tsubo REAL, price_per_sqm REAL,
    cap_rate REAL, rent_per_sqm REAL, occupancy_rate REAL,
    building_sqm REAL, year_built INTEGER, raw_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function migrateSchema() {
  const sql = getDb();
  const cols = ['annual_debt_service', 'annual_cashflow', 'equity_amount', 'loan_amount', 'payback_years'];
  for (const col of cols) {
    await sql`ALTER TABLE property_scores ADD COLUMN IF NOT EXISTS ${sql.unsafe(col)} REAL`.catch(() => {});
  }
}

export async function migrateScoreExitColumns() {
  const sql = getDb();
  const cols = ['exit_cap_rate REAL', 'exit_value REAL', 'noi_gross REAL', 'noi_adjusted REAL', 'annual_capex REAL'];
  for (const col of cols) {
    const name = col.split(' ')[0];
    await sql`ALTER TABLE property_scores ADD COLUMN IF NOT EXISTS ${sql.unsafe(name)} REAL`.catch(() => {});
  }
}

export async function migrateExtractionColumns() {
  const sql = getDb();
  await sql`ALTER TABLE property_extractions ADD COLUMN IF NOT EXISTS postal_code TEXT`.catch(() => {});
  await sql`ALTER TABLE property_extractions ADD COLUMN IF NOT EXISTS income_items TEXT`.catch(() => {});
  await sql`ALTER TABLE property_extractions ADD COLUMN IF NOT EXISTS expense_items TEXT`.catch(() => {});
}

export async function migrateScoreColumns() {
  const sql = getDb();
  const newCols = [
    'dscr REAL',
    'dscr_veto BOOLEAN',
    'land_reg_warning BOOLEAN',
    'industrial_opportunity BOOLEAN',
    'industrial_hub TEXT',
  ];
  for (const col of newCols) {
    const name = col.split(' ')[0];
    await sql`ALTER TABLE property_scores ADD COLUMN IF NOT EXISTS ${sql.unsafe(name)} ${sql.unsafe(col.split(' ').slice(1).join(' '))}`.catch(() => {});
  }
}
