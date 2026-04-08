export interface MarketSnapshot {
  jpn_10y: number;
  us_10y: number;
  usdjpy: number;
  cnyjpy?: number;
  chn_10y?: number;
  jreit_index: number;
}

export interface PropertyData {
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
}

export interface FinancingParams {
  equity_ratio: number;   // e.g. 0.4 = 40%
  loan_rate: number;      // e.g. 0.0165 = 1.65%
  loan_years: number;     // e.g. 20
  hold_years: number;     // e.g. 5
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
  valuation_status: string;
  irr_label: string;
  irr_description: string;
}

function clamp(v: number): number {
  return Math.max(-1, Math.min(1, Math.round(v * 10) / 10));
}

// 元利均等返済の年間返済額
function calcAnnualDebtService(principal: number, annualRate: number, years: number): number {
  if (annualRate === 0) return principal / years;
  const r = annualRate / 12;
  const n = years * 12;
  const monthly = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return monthly * 12;
}

export function calculateIRR(
  askingPrice: number,
  noi: number,
  exitCapRate: number,
  financing: FinancingParams
): { irr: number; leveredIrr: number; annualDebtService: number; annualCashflow: number; equityAmount: number; loanAmount: number; paybackYears: number } {
  const { equity_ratio, loan_rate, loan_years, hold_years } = financing;
  const equityAmount = askingPrice * equity_ratio;
  const loanAmount = askingPrice * (1 - equity_ratio);

  const annualDebtService = calcAnnualDebtService(loanAmount, loan_rate, loan_years);
  const annualCashflow = noi - annualDebtService;

  const effectiveExitCap = Math.max(exitCapRate, 3);
  const exitValue = noi / (effectiveExitCap / 100);

  // 残債計算（hold_years後の残高）
  let remainingDebt = loanAmount;
  const monthlyRate = loan_rate / 12;
  const totalMonths = loan_years * 12;
  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
  for (let m = 0; m < hold_years * 12; m++) {
    const interest = remainingDebt * monthlyRate;
    const principal = monthlyPayment - interest;
    remainingDebt = Math.max(0, remainingDebt - principal);
  }
  const exitProceeds = exitValue - remainingDebt;

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

  const unleveredCFs = [-askingPrice, ...Array(hold_years - 1).fill(noi), noi + exitValue];
  const leveredCFs   = [-equityAmount, ...Array(hold_years - 1).fill(annualCashflow), annualCashflow + exitProceeds];

  const irr        = solveIRR(unleveredCFs);
  const leveredIrr = equityAmount > 0 ? solveIRR(leveredCFs) : irr;
  const paybackYears = annualCashflow > 0 ? Math.round((equityAmount / annualCashflow) * 10) / 10 : 999;

  return { irr, leveredIrr, annualDebtService, annualCashflow, equityAmount, loanAmount, paybackYears };
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

export function scoreProperty(
  property: PropertyData,
  market: MarketSnapshot,
  comparables: ComparableData,
  financing: FinancingParams = DEFAULT_FINANCING
): ScoreResult {
  const capRate = property.cap_rate ?? 0;
  const jpn10y = market.jpn_10y;
  const occupancy = property.occupancy_rate ?? 85;
  const leaseRisk = property.lease_expiry_risk;
  const age = property.year_built ? new Date().getFullYear() - property.year_built : 30;
  const avgCapRate = comparables.avg_cap_rate ?? capRate;
  const rentGap = comparables.avg_rent_per_sqm && property.rent_per_sqm
    ? (comparables.avg_rent_per_sqm - property.rent_per_sqm) / comparables.avg_rent_per_sqm
    : 0;
  const spread = capRate - jpn10y;

  let acq = 0;
  acq += capRate > avgCapRate ? 0.3 : capRate > avgCapRate - 0.3 ? 0.1 : -0.2;
  acq += spread > 3 ? 0.4 : spread > 2 ? 0.2 : spread > 1 ? 0 : -0.3;
  acq += occupancy >= 95 ? 0.2 : occupancy >= 85 ? 0 : -0.2;
  acq += leaseRisk === 'low' ? 0.1 : leaseRisk === 'high' ? -0.3 : 0;
  acq += age < 10 ? 0.1 : age > 40 ? -0.2 : 0;

  let disp = 0;
  disp += capRate < avgCapRate - 0.3 ? 0.4 : capRate > avgCapRate + 0.5 ? -0.3 : 0;
  disp += jpn10y > 1.5 ? 0.3 : jpn10y > 1 ? 0.1 : -0.1;
  disp += leaseRisk === 'high' ? 0.4 : leaseRisk === 'medium' ? 0.2 : -0.1;

  let dev = 0;
  dev += age > 35 ? 0.3 : age < 15 ? -0.4 : 0;
  dev += occupancy < 70 ? 0.2 : occupancy > 90 ? -0.3 : 0;

  let lease = 0;
  lease += rentGap > 0.1 ? 0.5 : rentGap > 0.05 ? 0.3 : rentGap > 0 ? 0.1 : -0.1;
  lease += occupancy < 85 ? 0.3 : occupancy > 95 ? -0.1 : 0;

  let fin = 0;
  fin += jpn10y > 1 ? -0.3 : jpn10y < 0.5 ? 0.3 : 0;
  fin += market.us_10y > 4.5 ? -0.2 : 0;
  fin += financing.loan_rate > 0.02 ? -0.2 : financing.loan_rate < 0.01 ? 0.2 : 0;

  const scores = {
    acquisition_score: clamp(acq),
    disposition_score: clamp(disp),
    development_score: clamp(dev),
    leasing_score: clamp(lease),
    financing_score: clamp(fin),
  };

  const overall = clamp(
    scores.acquisition_score * 0.35 +
    scores.leasing_score * 0.25 +
    scores.financing_score * 0.2 +
    scores.disposition_score * 0.1 +
    scores.development_score * 0.1
  );

  const askingPrice = property.asking_price ?? 1;
  const currentNoi = property.noi_current ?? property.noi ?? (askingPrice * (capRate / 100));
  const effectiveCapRate = capRate > 0 ? capRate : (currentNoi / askingPrice * 100);
  const exitCapRate = Math.max(effectiveCapRate + 0.3, 3);

  const { irr, leveredIrr, annualDebtService, annualCashflow, equityAmount, loanAmount, paybackYears } =
    calculateIRR(askingPrice, currentNoi, exitCapRate, financing);

  const { label: irr_label, description: irr_description } = irrLabel(leveredIrr);

  return {
    ...scores,
    overall_score: overall,
    acquisition_rec: scores.acquisition_score >= 0.3 ? 'Aggressive' : scores.acquisition_score >= 0 ? 'Cautious' : 'Pass',
    disposition_rec: scores.disposition_score >= 0.3 ? 'Sell' : 'Hold',
    development_rec: scores.development_score >= 0.3 ? 'Go' : scores.development_score >= 0 ? 'Re-underwrite' : 'Cancel',
    financing_rec: jpn10y > 1.2 ? 'Fix rate' : jpn10y < 0.5 ? 'Float' : 'Wait',
    irr,
    levered_irr: leveredIrr,
    annual_debt_service: Math.round(annualDebtService),
    annual_cashflow: Math.round(annualCashflow),
    equity_amount: Math.round(equityAmount),
    loan_amount: Math.round(loanAmount),
    payback_years: paybackYears,
    yield_on_cost: Math.round((currentNoi / askingPrice) * 10000) / 100,
    valuation_status: capRate > avgCapRate + 0.5 ? 'Undervalued' : capRate < avgCapRate - 0.5 ? 'Overvalued' : 'Fair',
    irr_label,
    irr_description,
  };
}
