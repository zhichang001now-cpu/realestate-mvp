// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface MarketSnapshot {
  jpn_10y: number;
  us_10y: number;
  usdjpy: number;
  cnyjpy?: number;
  chn_10y?: number;
  jreit_index: number;
}

export interface PropertyData {
  property_type?: string;
  cap_rate?: number;
  noi?: number;
  noi_current?: number;
  noi_full_occupancy?: number;
  asking_price?: number;
  occupancy_rate?: number;
  year_built?: number;
  lease_expiry_risk?: string;
  rent_per_sqm?: number;
  building_sqm?: number;
  prefecture?: string;
  city?: string;
  address_extracted?: string;
  building_sqm?: number;
}

export interface FinancingParams {
  equity_ratio: number;
  loan_rate: number;
  loan_years: number;
  hold_years: number;
}

export interface ComparableData {
  avg_cap_rate?: number;
  avg_price_per_tsubo?: number;
  avg_rent_per_sqm?: number;
  sample_count: number;
}

export interface ScoreResult {
  acquisition_score: number;
  disposition_score: number;
  development_score: number;
  leasing_score: number;
  financing_score: number;
  overall_score: number;
  acquisition_rec: string;
  disposition_rec: string;
  development_rec: string;
  financing_rec: string;
  irr: number;
  levered_irr: number;
  annual_debt_service: number;
  annual_cashflow: number;
  equity_amount: number;
  loan_amount: number;
  payback_years: number;
  yield_on_cost: number;
  dscr: number;
  valuation_status: string;
  irr_label: string;
  irr_description: string;
  exit_cap_rate: number;
  exit_value: number;
  noi_gross: number;
  noi_adjusted: number;
  annual_capex: number;
  // Flags
  dscr_veto: boolean;
  land_reg_warning: boolean;
  industrial_opportunity: boolean;
  industrial_hub: string | null;
}

// ─── Property type parameters ─────────────────────────────────────────────────

interface TypeParams {
  spreadGood: number;   // spread above this → strong buy signal
  spreadOk: number;     // spread above this → neutral
  spreadWeak: number;   // spread below this → negative signal
  capexRate: number;    // annual CapEx as % of asking price
  exitCapAdj: number;   // aging adjustment per 10 years (cap rate expansion)
}

const TYPE_PARAMS: Record<string, TypeParams> = {
  'マンション':   { spreadGood: 2.5, spreadOk: 1.5, spreadWeak: 0.8, capexRate: 0.006, exitCapAdj: 0.25 },
  'オフィス':     { spreadGood: 3.0, spreadOk: 2.0, spreadWeak: 1.0, capexRate: 0.008, exitCapAdj: 0.35 },
  'ホテル':       { spreadGood: 4.0, spreadOk: 2.5, spreadWeak: 1.2, capexRate: 0.012, exitCapAdj: 0.40 },
  '物流施設':     { spreadGood: 3.5, spreadOk: 2.5, spreadWeak: 1.5, capexRate: 0.005, exitCapAdj: 0.20 },
  '商業施設':     { spreadGood: 3.5, spreadOk: 2.2, spreadWeak: 1.0, capexRate: 0.009, exitCapAdj: 0.35 },
  '土地':         { spreadGood: 3.0, spreadOk: 2.0, spreadWeak: 1.0, capexRate: 0.001, exitCapAdj: 0.00 },
  'その他':       { spreadGood: 3.0, spreadOk: 2.0, spreadWeak: 1.0, capexRate: 0.007, exitCapAdj: 0.30 },
};

const DEFAULT_TYPE_PARAMS: TypeParams = TYPE_PARAMS['その他'];

// ─── 土地利用規制法 zones ──────────────────────────────────────────────────────

// Prefectures/cities with significant regulatory risk (bases, borders, critical infra)
const LAND_REG_PREFECTURES = new Set(['沖縄県', '沖縄', '北海道']);
const LAND_REG_CITIES = new Set([
  // US base cities
  '那覇市', '宜野湾市', '沖縄市', '名護市', 'うるま市',
  // Hokkaido border areas
  '稚内市', '根室市', '釧路市',
  // Kanagawa bases
  '座間市', '相模原市', '横須賀市', '厚木市',
  // Tokyo bases
  '福生市', '昭島市',
  // Kyushu
  '佐世保市',
]);

// ─── 産業立地 hubs ────────────────────────────────────────────────────────────

const INDUSTRIAL_HUBS: { city: string; hub: string; types: string[] }[] = [
  { city: '菊陽町', hub: 'TSMC熊本第1・2工場', types: ['物流施設', 'マンション', 'オフィス'] },
  { city: '熊本市', hub: 'TSMC熊本圏', types: ['物流施設', 'マンション', 'オフィス'] },
  { city: '大津町', hub: 'TSMC熊本圏', types: ['物流施設', 'マンション'] },
  { city: '千歳市', hub: 'Rapidus北海道', types: ['物流施設', 'マンション', 'オフィス'] },
  { city: '北広島市', hub: 'Rapidus北海道圏', types: ['物流施設', 'マンション'] },
  { city: 'つくば市', hub: '筑波研究学園都市', types: ['オフィス', 'マンション', '物流施設'] },
  { city: '浜松市', hub: 'スズキ/ヤマハ製造拠点', types: ['物流施設', 'マンション'] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(-1, Math.min(1, Math.round(v * 10) / 10));
}

function calcAnnualDebtService(principal: number, annualRate: number, years: number): number {
  if (annualRate === 0) return principal / years;
  const r = annualRate / 12;
  const n = years * 12;
  const monthly = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return monthly * 12;
}

function solveIRR(cashflows: number[]): number {
  let rate = 0.08;
  for (let i = 0; i < 200; i++) {
    let npv = 0, dnpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      npv  +=  cashflows[t] / Math.pow(1 + rate, t);
      dnpv += -t * cashflows[t] / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(dnpv) < 1e-10) break;
    const newRate = rate - npv / dnpv;
    if (newRate < -0.99 || newRate > 5) break;
    if (Math.abs(newRate - rate) < 1e-8) { rate = newRate; break; }
    rate = newRate;
  }
  return Math.round(rate * 10000) / 100;
}

export function calculateIRR(
  askingPrice: number,
  noi: number,
  exitCapRate: number,
  financing: FinancingParams
) {
  const { equity_ratio, loan_rate, loan_years, hold_years } = financing;
  const equityAmount = askingPrice * equity_ratio;
  const loanAmount = askingPrice * (1 - equity_ratio);

  const annualDebtService = calcAnnualDebtService(loanAmount, loan_rate, loan_years);
  const annualCashflow = noi - annualDebtService;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 999;

  const effectiveExitCap = Math.max(exitCapRate, 3);
  const exitValue = noi / (effectiveExitCap / 100);

  let remainingDebt = loanAmount;
  const monthlyRate = loan_rate / 12;
  const totalMonths = loan_years * 12;
  const monthlyPayment = loanAmount > 0 && loan_rate > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1)
    : loanAmount / (loan_years * 12);
  for (let m = 0; m < hold_years * 12; m++) {
    const interest = remainingDebt * monthlyRate;
    const principal = monthlyPayment - interest;
    remainingDebt = Math.max(0, remainingDebt - principal);
  }
  const exitProceeds = exitValue - remainingDebt;

  const unleveredCFs = [-askingPrice, ...Array(hold_years - 1).fill(noi), noi + exitValue];
  const leveredCFs   = [-equityAmount, ...Array(hold_years - 1).fill(annualCashflow), annualCashflow + exitProceeds];

  const irr        = solveIRR(unleveredCFs);
  const leveredIrr = equityAmount > 0 ? solveIRR(leveredCFs) : irr;
  const paybackYears = annualCashflow > 0 ? Math.round((equityAmount / annualCashflow) * 10) / 10 : 999;

  return { irr, leveredIrr, annualDebtService, annualCashflow, equityAmount, loanAmount, paybackYears, dscr, exitCapRate: effectiveExitCap, exitValue };
}

function irrLabel(irr: number): { label: string; description: string } {
  if (irr >= 15) return { label: '非常に高い',  description: '高リスク・高リターン水準' };
  if (irr >= 10) return { label: '高い',        description: '不動産投資として優良な水準' };
  if (irr >= 6)  return { label: '標準的',      description: '不動産投資として標準的な水準' };
  if (irr >= 3)  return { label: 'やや低い',    description: 'リスクに対してリターンが少ない' };
  return           { label: '低い',          description: '投資判断には慎重な検討が必要' };
}

export const DEFAULT_FINANCING: FinancingParams = {
  equity_ratio: 0.4,
  loan_rate: 0.0165,
  loan_years: 20,
  hold_years: 5,
};

// ─── Main scoring function ────────────────────────────────────────────────────

export function scoreProperty(
  property: PropertyData,
  market: MarketSnapshot,
  comparables: ComparableData,
  financing: FinancingParams = DEFAULT_FINANCING
): ScoreResult {
  const propType = property.property_type ?? 'その他';
  const tp = TYPE_PARAMS[propType] ?? DEFAULT_TYPE_PARAMS;

  const capRate    = property.cap_rate ?? 0;
  const jpn10y     = market.jpn_10y;
  const usdjpy     = market.usdjpy ?? 150;
  const occupancy  = property.occupancy_rate ?? 85;
  const leaseRisk  = property.lease_expiry_risk;
  const age        = property.year_built ? new Date().getFullYear() - property.year_built : 20;
  const avgCapRate = comparables.avg_cap_rate ?? capRate;
  const spread     = capRate - jpn10y;
  const askingPrice = property.asking_price ?? 1;

  const rentGap = comparables.avg_rent_per_sqm && property.rent_per_sqm && comparables.avg_rent_per_sqm > 0
    ? (comparables.avg_rent_per_sqm - property.rent_per_sqm) / comparables.avg_rent_per_sqm
    : 0;

  // ── CapEx-adjusted NOI ──────────────────────────────────────────────────────
  // Opex (日常維持費: 管理費・税・保険・空室損) is assumed to be INCLUDED in
  // noi_current. For gross NOI fallbacks (noi_full_occupancy or cap_rate calc),
  // we apply a property-type expense ratio before adding CapEx reserve.

  const OPEX_RATIO: Record<string, number> = {
    'マンション': 0.20, 'オフィス': 0.28, 'ホテル': 0.40,
    '物流施設': 0.15, '商業施設': 0.25, 'その他': 0.20,
  };
  const opexRatio = OPEX_RATIO[propType] ?? 0.20;

  const rawNoi = property.noi_current
    ?? property.noi_full_occupancy
    ?? property.noi
    ?? (askingPrice * (capRate / 100));

  const isNetNoi = property.noi_current != null;
  const noiAfterOpex = isNetNoi ? rawNoi : rawNoi * (1 - opexRatio);

  // CapEx reserve only (大規模修繕積立) — based on 国交省ガイドライン per-sqm
  // Rates: 0.2% → 0.35% → 0.55% → 0.75% by age tier (less aggressive than flat %)
  const capexReserveRate = age < 10 ? 0.002
                         : age < 25 ? 0.0035
                         : age < 35 ? 0.0055
                         :            0.0075;
  const annualCapex = askingPrice * capexReserveRate;
  const adjustedNoi = Math.max(0, noiAfterOpex - annualCapex);
  const noi_gross = rawNoi;

  // ── Exit cap rate: base + aging correction ──────────────────────────────────
  const effectiveCapRate = capRate > 0 ? capRate : (rawNoi / askingPrice * 100);
  const agingAdj = tp.exitCapAdj * (financing.hold_years / 10);
  // BOJ direction: if rates rising, add further exit cap expansion
  const bojAdj = jpn10y > 1.5 ? 0.5 : jpn10y > 1.0 ? 0.25 : 0;
  const exitCapRate = Math.max(effectiveCapRate + agingAdj + bojAdj, 3);

  // ── DSCR ────────────────────────────────────────────────────────────────────
  const { irr, leveredIrr, annualDebtService, annualCashflow, equityAmount, loanAmount, paybackYears, dscr, exitValue } =
    calculateIRR(askingPrice, adjustedNoi, exitCapRate, financing);

  const dscrVeto = dscr < 1.2; // Banks typically require ≥ 1.2

  // ── 土地利用規制法 check ────────────────────────────────────────────────────
  const prefecture = property.prefecture ?? '';
  // city: use explicit field, or parse from address_extracted
  const _rawCity = property.city ?? (() => {
    const m = (property.address_extracted ?? '').match(/[都道府県](.+?[市区町村])/);
    return m?.[1] ?? '';
  })();
  const city = _rawCity;
  const landRegWarning =
    LAND_REG_PREFECTURES.has(prefecture) ||
    LAND_REG_CITIES.has(city);

  // ── 産業立地 opportunity ────────────────────────────────────────────────────
  const hubMatch = city.trim()
    ? INDUSTRIAL_HUBS.find(h => city.includes(h.city) || h.city.includes(city))
    : undefined;
  const industrialOpportunity = !!hubMatch && (hubMatch.types.includes(propType) || propType === 'その他');
  const industrialHub = hubMatch?.hub ?? null;

  // ── Acquisition score (物件種別別しきい値) ────────────────────────────────
  let acq = 0;
  acq += capRate > avgCapRate ? 0.3 : capRate > avgCapRate - 0.3 ? 0.1 : -0.2;
  acq += spread > tp.spreadGood ? 0.4 : spread > tp.spreadOk ? 0.2 : spread > tp.spreadWeak ? 0 : -0.3;
  acq += occupancy >= 95 ? 0.2 : occupancy >= 85 ? 0 : occupancy >= 70 ? -0.2 : -0.4;
  acq += leaseRisk === 'low' ? 0.1 : leaseRisk === 'high' ? -0.3 : 0;
  acq += age < 10 ? 0.1 : age > 40 ? -0.2 : 0;
  if (dscrVeto) acq -= 0.4; // DSCR penalty

  // ── Disposition score ─────────────────────────────────────────────────────
  let disp = 0;
  disp += capRate < avgCapRate - 0.3 ? 0.4 : capRate > avgCapRate + 0.5 ? -0.3 : 0;
  disp += jpn10y > 1.5 ? 0.4 : jpn10y > 1.0 ? 0.2 : -0.1; // Rising rates = sell pressure
  disp += leaseRisk === 'high' ? 0.4 : leaseRisk === 'medium' ? 0.2 : -0.1;
  // USD/JPY: weak yen = foreign buyers active = easier exit
  disp += usdjpy > 150 ? 0.2 : usdjpy > 135 ? 0 : -0.2;

  // ── Development score ─────────────────────────────────────────────────────
  let dev = 0;
  dev += age > 35 ? 0.3 : age < 15 ? -0.4 : 0;
  dev += occupancy < 70 ? 0.2 : occupancy > 90 ? -0.3 : 0;
  if (industrialOpportunity) dev += 0.3;

  // ── Leasing score ─────────────────────────────────────────────────────────
  let lease = 0;
  lease += rentGap > 0.1 ? 0.5 : rentGap > 0.05 ? 0.3 : rentGap > 0 ? 0.1 : -0.1;
  lease += occupancy < 85 ? 0.3 : occupancy > 95 ? -0.1 : 0;

  // ── Financing score ───────────────────────────────────────────────────────
  let fin = 0;
  // BOJ direction: level as proxy for trend
  fin += jpn10y > 1.5 ? -0.5 : jpn10y > 1.0 ? -0.3 : jpn10y < 0.5 ? 0.3 : 0;
  fin += market.us_10y > 4.5 ? -0.2 : 0;
  fin += financing.loan_rate > 0.02 ? -0.2 : financing.loan_rate < 0.01 ? 0.2 : 0;
  // USD/JPY: strong yen → refinancing risk (foreign debt more expensive)
  fin += usdjpy < 130 ? -0.2 : usdjpy > 155 ? 0.1 : 0;
  if (dscrVeto) fin -= 0.3;

  const scores = {
    acquisition_score: clamp(acq),
    disposition_score: clamp(disp),
    development_score: clamp(dev),
    leasing_score: clamp(lease),
    financing_score: clamp(fin),
  };

  const overall = dscrVeto ? clamp(
    scores.acquisition_score * 0.35 +
    scores.leasing_score * 0.25 +
    scores.financing_score * 0.2 +
    scores.disposition_score * 0.1 +
    scores.development_score * 0.1
  ) - 0.3 : clamp(
    scores.acquisition_score * 0.35 +
    scores.leasing_score * 0.25 +
    scores.financing_score * 0.2 +
    scores.disposition_score * 0.1 +
    scores.development_score * 0.1
  );

  const { label: irr_label, description: irr_description } = irrLabel(leveredIrr);

  return {
    ...scores,
    overall_score: clamp(overall),
    acquisition_rec: dscrVeto ? 'Pass' : scores.acquisition_score >= 0.3 ? 'Aggressive' : scores.acquisition_score >= 0 ? 'Cautious' : 'Pass',
    disposition_rec: scores.disposition_score >= 0.3 ? 'Sell' : 'Hold',
    development_rec: scores.development_score >= 0.3 ? 'Go' : scores.development_score >= 0 ? 'Re-underwrite' : 'Cancel',
    financing_rec: jpn10y > 1.5 ? 'Fix rate (急務)' : jpn10y > 1.2 ? 'Fix rate' : jpn10y < 0.5 ? 'Float' : 'Wait',
    irr,
    levered_irr: leveredIrr,
    annual_debt_service: Math.round(annualDebtService),
    annual_cashflow: Math.round(annualCashflow),
    equity_amount: Math.round(equityAmount),
    loan_amount: Math.round(loanAmount),
    payback_years: paybackYears,
    yield_on_cost: Math.round((adjustedNoi / askingPrice) * 10000) / 100,
    dscr: Math.round(dscr * 100) / 100,
    valuation_status: capRate > avgCapRate + 0.5 ? 'Undervalued' : capRate < avgCapRate - 0.5 ? 'Overvalued' : 'Fair',
    irr_label,
    irr_description,
    exit_cap_rate: exitCapRate,
    exit_value: exitValue,
    noi_gross,
    noi_adjusted: adjustedNoi,
    annual_capex: annualCapex,
    dscr_veto: dscrVeto,
    land_reg_warning: landRegWarning,
    industrial_opportunity: industrialOpportunity,
    industrial_hub: industrialHub,
  };
}
