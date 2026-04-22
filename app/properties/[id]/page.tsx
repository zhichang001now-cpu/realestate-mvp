'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLang, LangSwitcher } from '@/app/contexts/LanguageContext';

interface Property { id: string; name: string; address: string | null; prefecture: string | null; property_type: string | null; }
interface Extraction {
  asking_price: number | null; noi: number | null; noi_current: number | null; noi_full_occupancy: number | null;
  cap_rate: number | null; surface_yield: number | null; occupancy_rate: number | null;
  year_built: number | null; building_sqm: number | null; land_sqm: number | null; floors: number | null;
  unit_count: number | null; parking_count: number | null; structure: unknown; usage_type: string | null;
  station: string | null; walk_minutes: number | null; address_extracted: string | null;
  land_right_type: string | null; land_lease_monthly: number | null; land_lease_expiry: string | null;
  rent_per_sqm: number | null; price_per_sqm: number | null; price_per_tsubo: number | null;
  fixed_asset_tax: number | null; management_fee: number | null; other_expenses: number | null; total_expenses: number | null;
  gross_rent: number | null; lease_expiry_risk: string | null; special_notes: string | null;
  extraction_confidence: number | null; manually_verified: number | null;
}
interface Score {
  overall_score: number; acquisition_score: number; disposition_score: number;
  development_score: number; leasing_score: number; financing_score: number;
  acquisition_rec: string; disposition_rec: string; development_rec: string; financing_rec: string;
  irr: number; levered_irr: number; annual_debt_service: number; annual_cashflow: number;
  equity_amount: number | null; loan_amount: number | null; payback_years: number; yield_on_cost: number;
  dscr: number; valuation_status: string; irr_label: string; irr_description: string;
  exit_cap_rate: number | null; exit_value: number | null;
  noi_gross: number | null; noi_adjusted: number | null; annual_capex: number | null;
  investment_memo: string | null;
  dscr_veto: boolean; land_reg_warning: boolean; industrial_opportunity: boolean; industrial_hub: string | null;
}
interface MarketRow { data_type: string; value: number; unit: string; }
interface AreaNews { location: string; summary: string; source_title: string | null; source_url: string | null; }
interface OshiResult {
  address: string; searchUrl: string; checked: boolean;
  hasRecord: boolean | null; status: 'clean' | 'record_found' | 'manual_check';
}
interface CompData {
  sampleCount: number; avgUnitPriceSqm: number; avgPriceTsubo: number;
  minUnitPrice: number; maxUnitPrice: number; medianUnitPrice: number;
  subjectUnitPriceSqm: number | null; subjectPriceTsubo: number | null;
  prefecture: string; city: string;
}
interface Document { id: string; filename: string; doc_type: string; extracted_at: string | null; created_at: string; }

function fmtVal(n: number | null | undefined, unit = '', digits = 2): string {
  if (n === null || n === undefined || (typeof n === 'number' && !isFinite(n))) return '—';
  if (unit === '億円') return (n / 1e8).toFixed(digits) + ' 億円';
  if (unit === '万円') return Math.round(n / 1e4).toLocaleString() + ' 万円';
  if (unit === '%') return n.toFixed(digits) + '%';
  return n.toLocaleString() + (unit ? ' ' + unit : '');
}

function scoreColor(v: number): string {
  if (v >= 0.3) return '#34d399';
  if (v >= 0) return '#fbbf24';
  return '#f87171';
}

function ScoreBar({ label, value, rec }: { label: string; value: number; rec?: string }) {
  const pct = Math.round(((value + 1) / 2) * 100);
  const color = scoreColor(value);
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
        <div className="flex items-center gap-2">
          {rec && <span className="text-xs" style={{ color: 'var(--muted)' }}>{rec}</span>}
          <span className="text-sm font-semibold" style={{ color }}>{value > 0 ? '+' : ''}{value.toFixed(1)}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'var(--surface2)' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
      <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-emerald-400' : ''}`}>{value}</span>
    </div>
  );
}

export default function PropertyDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();

  const [property, setProperty] = useState<Property | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [marketRows, setMarketRows] = useState<MarketRow[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [refreshingMarket, setRefreshingMarket] = useState(false);
  const [comp, setComp] = useState<CompData | null>(null);
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);
  const [areaNews, setAreaNews] = useState<AreaNews | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  const [equityRatio, setEquityRatio] = useState(40);
  const [loanRate, setLoanRate] = useState(1.65);
  const [loanYears, setLoanYears] = useState(20);
  const [holdYears, setHoldYears] = useState(5);

  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/properties/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProperty(data.property);
      setExtraction(data.extraction);
      setScore(data.score);
      fetchComp();
      setMarketRows(data.marketRows ?? []);
      setDocuments(data.documents ?? []);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('doc_type', 'brochure');
      const res = await fetch(`/api/properties/${id}/upload`, { method: 'POST', body: fd });
      if (!res.ok) { const b = await res.json().catch(() => ({ error: `HTTP ${res.status}` })); throw new Error(b.error); }
      await load();
    } catch (e) { setUploadError((e as Error).message); }
    finally { setUploading(false); e.target.value = ''; }
  }

  async function handleScore() {
    setScoring(true);
    try {
      const res = await fetch(`/api/properties/${id}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equity_ratio: equityRatio / 100, loan_rate: loanRate / 100, loan_years: loanYears, hold_years: holdYears, ...(areaNews?.summary ? { area_news: areaNews.summary } : {}) }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({ error: `HTTP ${res.status}` })); throw new Error(b.error); }
      await load();
    } catch (e) { alert((e as Error).message); }
    finally { setScoring(false); }
  }

  async function fetchComp() {
    if (!id) return;
    setCompLoading(true); setCompError(null);
    try {
      const res = await fetch(`/api/market/comparable?property_id=${id}`);
      if (!res.ok) { const e = await res.json(); setCompError(e.error ?? 'Error'); return; }
      setComp(await res.json());
    } catch { setCompError('Network error'); }
    finally { setCompLoading(false); }
  }

  async function fetchAreaNews() {
    if (!id) return;
    setNewsLoading(true); setNewsError(null);
    try {
      const res = await fetch(`/api/properties/${id}/area-news`);
      if (!res.ok) { const e = await res.json(); setNewsError(e.error ?? 'Error'); return; }
      setAreaNews(await res.json());
    } catch { setNewsError('Network error'); }
    finally { setNewsLoading(false); }
  }

  async function handleRefreshMarket() {
    setRefreshingMarket(true);
    try {
      await fetch('/api/market/refresh', { method: 'POST' });
      await load();
    } catch (e) { alert((e as Error).message); }
    finally { setRefreshingMarket(false); }
  }

  async function saveEdit(field: string, value: string) {
    setSaving(true);
    try {
      const parsed = value === '' ? null : isNaN(Number(value)) ? value : Number(value);
      const res = await fetch(`/api/properties/${id}/edit`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: parsed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditField(null); await load();
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  }

  function EditableMetric({ label, field, displayValue }: { label: string; field: string; displayValue: string }) {
    const isEditing = editField === field;
    return (
      <div className="flex justify-between items-center py-2.5 border-b last:border-0 group" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(field, editValue); if (e.key === 'Escape') setEditField(null); }}
              className="w-28 px-2 py-0.5 rounded text-sm text-right"
              style={{ background: 'var(--surface2)', border: '1px solid var(--accent)', color: 'var(--text)' }}
            />
            <button onClick={() => saveEdit(field, editValue)} disabled={saving} className="text-xs text-blue-400 hover:text-blue-300">{t('common.save')}</button>
            <button onClick={() => setEditField(null)} className="text-xs" style={{ color: 'var(--muted)' }}>✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{displayValue}</span>
            <button onClick={() => { setEditField(field); setEditValue(''); }}
              className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 rounded transition-opacity"
              style={{ color: 'var(--muted)', background: 'var(--surface2)' }}
            >{t('common.edit')}</button>
          </div>
        )}
      </div>
    );
  }

  const marketMap: Record<string, number> = {};
  for (const r of marketRows) marketMap[r.data_type] = r.value;

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}><span className="text-gray-500">{t('common.loading')}</span></div>;
  if (error || !property) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <div className="text-red-400 mb-3">{error ?? t('detail.not_found')}</div>
        <button onClick={() => router.push('/')} className="text-blue-400 underline text-sm">{t('detail.go_back')}</button>
      </div>
    </div>
  );

  const isBorrowedLand = extraction?.land_right_type && extraction.land_right_type !== '所有権';

  // Safe equity/loan display — null or 0 shows as —
  const equityDisplay = (score?.equity_amount && score.equity_amount > 0)
    ? fmtVal(score.equity_amount, '億円')
    : '—';
  const loanDisplay = (score?.loan_amount && score.loan_amount > 0)
    ? fmtVal(score.loan_amount, '億円')
    : '—';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="border-b sticky top-0 z-10" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3 flex-wrap">
          <button onClick={() => router.push('/')} className="text-sm hover:text-white transition-colors shrink-0" style={{ color: 'var(--muted)' }}>{t('common.back')}</button>
          <span className="text-sm shrink-0" style={{ color: 'var(--border)' }}>|</span>
          <span className="font-medium truncate">{property.name}</span>
          {property.property_type && <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>{property.property_type}</span>}
          {isBorrowedLand && <span className="text-xs px-2 py-0.5 rounded bg-yellow-900 text-yellow-300 border border-yellow-700 shrink-0">{t('detail.type.borrowed_land')}</span>}
          {score?.dscr_veto && <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300 border border-red-700 shrink-0">{t('detail.flag.dscr')}</span>}
          {score?.land_reg_warning && <span className="text-xs px-2 py-0.5 rounded bg-orange-900 text-orange-300 border border-orange-700 shrink-0">{t('detail.flag.land_reg')}</span>}
          {score?.industrial_opportunity && <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300 border border-blue-700 shrink-0">{t('detail.flag.industrial')}</span>}
          <button
            onClick={() => window.open(`/properties/${id}/report`, '_blank')}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-600 shrink-0"
            style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >📄 レポート</button>
          <div className="shrink-0"><LangSwitcher /></div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">

          {/* Overview */}
          <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>{t('detail.section.overview')}</h2>
            {!extraction ? (
              <div className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>{t('detail.no_extraction')}</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8">
                <div>
                  <EditableMetric label={t('metric.asking_price')} field="asking_price" displayValue={fmtVal(extraction.asking_price, '億円')} />
                  <EditableMetric label={t('metric.cap_rate')} field="cap_rate" displayValue={fmtVal(extraction.cap_rate, '%')} />
                  <EditableMetric label={t('metric.surface_yield')} field="surface_yield" displayValue={fmtVal(extraction.surface_yield, '%')} />
                  <EditableMetric label={t('metric.noi_current')} field="noi_current" displayValue={fmtVal(extraction.noi_current, '万円')} />
                  <EditableMetric label={t('metric.noi_full')} field="noi_full_occupancy" displayValue={fmtVal(extraction.noi_full_occupancy, '万円')} />
                  <EditableMetric label={t('metric.occupancy')} field="occupancy_rate" displayValue={fmtVal(extraction.occupancy_rate, '%')} />
                </div>
                <div>
                  <EditableMetric label={t('metric.building_sqm')} field="building_sqm" displayValue={fmtVal(extraction.building_sqm, 'm²')} />
                  <EditableMetric label={t('metric.land_sqm')} field="land_sqm" displayValue={fmtVal(extraction.land_sqm, 'm²')} />
                  <EditableMetric label={t('metric.floors')} field="floors" displayValue={extraction.floors ? `${extraction.floors}階` : '—'} />
                  <EditableMetric label={t('metric.year_built')} field="year_built" displayValue={extraction.year_built ? `${extraction.year_built}年（${new Date().getFullYear() - extraction.year_built}年築）` : '—'} />
                  <EditableMetric label={t('metric.units')} field="unit_count" displayValue={extraction.unit_count ? `${extraction.unit_count}戸` : '—'} />
                  <EditableMetric label={t('metric.structure')} field="structure" displayValue={String(extraction.structure ?? '—')} />
                </div>
                <div>
                  <EditableMetric label={t('metric.station')} field="station" displayValue={extraction.station ?? '—'} />
                  <EditableMetric label={t('metric.walk')} field="walk_minutes" displayValue={extraction.walk_minutes ? `${extraction.walk_minutes}分` : '—'} />
                  <EditableMetric label={t('metric.land_right')} field="land_right_type" displayValue={extraction.land_right_type ?? '所有権'} />
                  {isBorrowedLand && <>
                    <EditableMetric label={t('metric.lease_monthly')} field="land_lease_monthly" displayValue={fmtVal(extraction.land_lease_monthly, '円')} />
                    <EditableMetric label={t('metric.lease_expiry')} field="land_lease_expiry" displayValue={extraction.land_lease_expiry ?? '—'} />
                  </>}
                  <MetricRow label={t('metric.lease_risk')} value={extraction.lease_expiry_risk ?? '—'} />
                  <MetricRow label={t('metric.confidence')} value={extraction.extraction_confidence != null ? `${Math.round(extraction.extraction_confidence * 100)}%` : '—'} />
                </div>
              </div>
            )}
          </section>

          {/* Upload */}
          <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>{t('detail.section.upload')}</h2>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <input type="file" accept="application/pdf,image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500 cursor-pointer'} bg-blue-600`}>
                  {uploading ? t('upload.uploading') : t('upload.btn')}
                </span>
              </label>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('upload.hint')}</span>
            </div>
            {uploadError && <div className="mt-3 text-sm text-red-400 rounded-lg p-3 bg-red-950 border border-red-800">{uploadError}</div>}
            {documents.length > 0 && (
              <div className="mt-4 space-y-1">
                {documents.map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-xs p-2 rounded" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                    <span>📎</span>
                    <span className="flex-1 truncate">{d.filename}</span>
                    <span>{d.extracted_at ? t('upload.extracted') : t('upload.pending')}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Expenses */}
          {extraction && (
            <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>{t('detail.section.expenses')}</h2>
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <EditableMetric label={t('metric.gross_rent')} field="gross_rent" displayValue={fmtVal(extraction.gross_rent, '万円')} />
                  <EditableMetric label={t('metric.mgmt_fee')} field="management_fee" displayValue={fmtVal(extraction.management_fee, '万円')} />
                  <EditableMetric label={t('metric.fixed_tax')} field="fixed_asset_tax" displayValue={fmtVal(extraction.fixed_asset_tax, '万円')} />
                </div>
                <div>
                  <EditableMetric label={t('metric.other_exp')} field="other_expenses" displayValue={fmtVal(extraction.other_expenses, '万円')} />
                  <EditableMetric label={t('metric.total_exp')} field="total_expenses" displayValue={fmtVal(extraction.total_expenses, '万円')} />
                  <EditableMetric label={t('metric.price_tsubo')} field="price_per_tsubo" displayValue={fmtVal(extraction.price_per_tsubo, '万円/坪')} />
                </div>
              </div>
              {extraction.special_notes && (
                <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                  <span className="font-medium text-white">{t('detail.notes')}: </span>{extraction.special_notes}
                </div>
              )}
            </section>
          )}

          {/* Scores */}
          {score && (
            <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>{t('detail.section.scores')}</h2>
              <div className="space-y-4">
                <ScoreBar label={t('axis.acquisition')} value={score.acquisition_score} rec={score.acquisition_rec} />
                <ScoreBar label={t('axis.disposition')} value={score.disposition_score} rec={score.disposition_rec} />
                <ScoreBar label={t('axis.development')} value={score.development_score} rec={score.development_rec} />
                <ScoreBar label={t('axis.leasing')} value={score.leasing_score} />
                <ScoreBar label={t('axis.financing')} value={score.financing_score} rec={score.financing_rec} />
              </div>
            </section>
          )}

          {/* Memo */}
          {score?.investment_memo && (
            <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{t('detail.section.memo')}</h2>
              <p className="text-sm leading-relaxed">{score.investment_memo}</p>
            </section>
          )}

          {/* Area News */}
          <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{t('news.title')}</h2>
              <button onClick={fetchAreaNews} disabled={newsLoading}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-blue-600 disabled:opacity-50"
                style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                {newsLoading ? t('news.loading') : t('news.search')}
              </button>
            </div>
            {newsError && <div className="text-sm text-red-400 rounded-lg p-3 bg-red-950 border border-red-800">{newsError}</div>}
            {areaNews ? (
              <div className="space-y-2">
                <p className="text-sm leading-relaxed">{areaNews.summary}</p>
                {areaNews.source_url && (
                  <a href={areaNews.source_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs hover:underline"
                    style={{ color: 'var(--muted)' }}>
                    📰 {areaNews.source_title ?? areaNews.source_url} ↗
                  </a>
                )}
              </div>
            ) : (
              !newsLoading && !newsError && (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>—</p>
              )
            )}
          </section>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">

          {/* Score panel */}
          <section className="rounded-xl border p-5 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>{t('detail.section.score_panel')}</div>
            {score ? (
              <>
                <div className="text-5xl font-bold mb-1" style={{ color: scoreColor(score.overall_score) }}>
                  {score.overall_score > 0 ? '+' : ''}{score.overall_score.toFixed(1)}
                </div>
                <div className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{score.valuation_status}</div>
                <div className="grid grid-cols-2 gap-2 text-left">
                  <MetricRow label={t('score.unlevered_irr')} value={fmtVal(score.irr, '%')} />
                  <MetricRow label={t('score.levered_irr')} value={fmtVal(score.levered_irr, '%')} />
                  <MetricRow label={t('score.equity')} value={equityDisplay} />
                  <MetricRow label={t('score.loan')} value={loanDisplay} />
                  <MetricRow label={t('score.annual_cf')} value={fmtVal(score.annual_cashflow, '万円')} highlight={score.annual_cashflow > 0} />
                  <MetricRow label={t('score.payback')} value={score.payback_years >= 999 ? '—' : `${score.payback_years}年`} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {/* NOI Breakdown */}
                {score.noi_gross != null && (
                  <div className="col-span-2 rounded p-2 text-xs space-y-1" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div className="font-medium mb-1" style={{ color: 'var(--muted)' }}>NOI 内訳</div>
                    <div className="flex justify-between"><span style={{ color: 'var(--muted)' }}>グロスNOI</span><span>{fmtVal(score.noi_gross, '万円')}</span></div>
                    {score.annual_capex != null && <div className="flex justify-between"><span style={{ color: 'var(--muted)' }}>修繕積立控除</span><span className="text-red-400">−{fmtVal(score.annual_capex, '万円')}</span></div>}
                    {score.noi_adjusted != null && <div className="flex justify-between font-medium border-t pt-1 mt-1" style={{ borderColor: 'var(--border)' }}><span>調整後NOI</span><span>{fmtVal(score.noi_adjusted, '万円')}</span></div>}
                  </div>
                )}
                {/* Exit metrics */}
                {score.exit_cap_rate != null && (
                  <div className="col-span-2 rounded p-2 text-xs space-y-1" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div className="font-medium mb-1" style={{ color: 'var(--muted)' }}>出口シナリオ ({score.exit_cap_rate.toFixed(2)}%)</div>
                    <div className="flex justify-between"><span style={{ color: 'var(--muted)' }}>推定出口価格</span><span>{score.exit_value ? fmtVal(score.exit_value, '億円') : '—'}</span></div>
                  </div>
                )}
                <div className={`col-span-2 p-2 rounded text-xs border ${score.dscr_veto ? 'bg-red-950 border-red-800 text-red-300' : 'border-gray-700'}`}
                    style={score.dscr_veto ? {} : { background: 'var(--surface2)', color: 'var(--muted)' }}>
                    DSCR: <strong>{score.dscr.toFixed(2)}x</strong> {score.dscr_veto ? t('score.dscr_ng') : t('score.dscr_ok')}
                  </div>
                  {score.industrial_opportunity && score.industrial_hub && (
                    <div className="col-span-2 p-2 rounded text-xs bg-blue-950 border border-blue-800 text-blue-300">
                      🏭 {score.industrial_hub}
                    </div>
                  )}
                  {score.land_reg_warning && (
                    <div className="col-span-2 p-2 rounded text-xs bg-orange-950 border border-orange-800 text-orange-300">
                      ⚠ 土地利用規制法 — 外資関連LP要確認
                    </div>
                  )}
                </div>
                <div className="mt-2 p-2 rounded text-xs" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                  {score.irr_label} — {score.irr_description}
                </div>
              </>
            ) : (
              <div className="text-4xl font-bold text-gray-600 mb-3">—</div>
            )}
          </section>

          {/* Financing */}
          <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>{t('detail.section.financing')}</h2>
            <div className="space-y-3">
              {[
                { label: t('fin.equity_ratio'), value: equityRatio, set: setEquityRatio, suffix: '%', min: 10, max: 100, step: 5 },
                { label: t('fin.loan_rate'),    value: loanRate,    set: setLoanRate,    suffix: '%', min: 0.1, max: 5, step: 0.05 },
                { label: t('fin.loan_years'),   value: loanYears,   set: setLoanYears,   suffix: '年', min: 5, max: 35, step: 1 },
                { label: t('fin.hold_years'),   value: holdYears,   set: setHoldYears,   suffix: '年', min: 1, max: 20, step: 1 },
              ].map(f => (
                <div key={f.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{f.label}</span>
                    <span className="text-xs font-medium">{f.value}{f.suffix}</span>
                  </div>
                  <input type="range" min={f.min} max={f.max} step={f.step} value={f.value}
                    onChange={e => f.set(Number(e.target.value))} className="w-full accent-blue-500" />
                </div>
              ))}
            </div>
            <button onClick={handleScore} disabled={scoring || !extraction}
              className="w-full mt-4 py-2.5 rounded-lg font-medium text-sm transition-colors bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
              {scoring ? t('fin.generating') : t('fin.generate')}
            </button>
            {!extraction && <div className="text-xs text-center mt-2" style={{ color: 'var(--muted)' }}>{t('fin.need_upload')}</div>}
          </section>

          {/* Market */}
          <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{t('detail.section.market')}</h2>
              <button onClick={handleRefreshMarket} disabled={refreshingMarket}
                className="text-xs px-2 py-1 rounded transition-colors hover:bg-blue-600"
                style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                {refreshingMarket ? t('market.refreshing') : t('market.refresh')}
              </button>
            </div>
            {marketRows.length === 0 ? (
              <div className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>{t('market.no_data')}</div>
            ) : (
              <div>
                {[
                  { label: t('market.jpn10y'), key: 'jpn_10y', unit: '%' },
                  { label: t('market.us10y'),  key: 'us_10y',  unit: '%' },
                  { label: t('market.usdjpy'), key: 'usdjpy',  unit: '' },
                  { label: t('market.cnyjpy'), key: 'cnyjpy',  unit: '' },
                  { label: t('market.jreit'),  key: 'jreit_index', unit: '' },
                ].map(m => (
                  <MetricRow key={m.key} label={m.label} value={marketMap[m.key] !== undefined ? fmtVal(marketMap[m.key], m.unit) : '—'} />
                ))}
              </div>
            )}
          </section>

          {/* Oshimaland */}
          <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{t('oshi.title')}</h2>
            <a
              href={`https://www.oshimaland.co.jp/?address=${encodeURIComponent(extraction?.address_extracted ?? `${property.prefecture ?? ''}${property.address ?? ''}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm py-2.5 rounded-lg transition-colors hover:bg-blue-600 font-medium"
              style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
              🔎 大島てるで確認 ↗
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
