'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Property { id: string; name: string; address: string | null; prefecture: string | null; property_type: string | null; }
interface Extraction {
  asking_price: number | null; noi: number | null; noi_current: number | null; noi_full_occupancy: number | null;
  cap_rate: number | null; surface_yield: number | null; occupancy_rate: number | null;
  year_built: number | null; building_sqm: number | null; land_sqm: number | null; floors: number | null;
  unit_count: number | null; parking_count: number | null; structure: number | null; usage_type: string | null;
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
  equity_amount: number; loan_amount: number; payback_years: number; yield_on_cost: number;
  valuation_status: string; irr_label: string; irr_description: string;
  dscr: number; dscr_veto: boolean; land_reg_warning: boolean;
  industrial_opportunity: boolean; industrial_hub: string | null;
  investment_memo: string | null;
}
interface MarketRow { data_type: string; value: number; unit: string; source: string; recorded_at: string; }
interface Document { id: string; filename: string; doc_type: string; extracted_at: string | null; created_at: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, unit = '', digits = 2): string {
  if (n === null || n === undefined) return '—';
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PropertyDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

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

  // Financing params
  const [equityRatio, setEquityRatio] = useState(40);
  const [loanRate, setLoanRate] = useState(1.65);
  const [loanYears, setLoanYears] = useState(20);
  const [holdYears, setHoldYears] = useState(5);

  // Edit state
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
      setMarketRows(data.marketRows ?? []);
      setDocuments(data.documents ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', 'brochure');
      const res = await fetch(`/api/properties/${id}/upload`, { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleScore() {
    setScoring(true);
    try {
      const res = await fetch(`/api/properties/${id}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equity_ratio: equityRatio / 100,
          loan_rate: loanRate / 100,
          loan_years: loanYears,
          hold_years: holdYears,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      alert('スコア生成失敗: ' + (e as Error).message);
    } finally {
      setScoring(false);
    }
  }

  async function handleRefreshMarket() {
    setRefreshingMarket(true);
    try {
      const res = await fetch('/api/market/refresh', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      alert('市場データ更新失敗: ' + (e as Error).message);
    } finally {
      setRefreshingMarket(false);
    }
  }

  async function saveEdit(field: string, value: string) {
    setSaving(true);
    try {
      const parsed = isNaN(Number(value)) ? value : Number(value);
      const res = await fetch(`/api/properties/${id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value === '' ? null : parsed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditField(null);
      await load();
    } catch (e) {
      alert('保存失敗: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function EditableMetric({ label, field, displayValue }: { label: string; field: string; displayValue: string }) {
    const isEditing = editField === field;
    return (
      <div className="flex justify-between items-center py-2.5 border-b last:border-0 group" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(field, editValue); if (e.key === 'Escape') setEditField(null); }}
              className="w-28 px-2 py-0.5 rounded text-sm text-right"
              style={{ background: 'var(--surface2)', border: '1px solid var(--accent)', color: 'var(--text)' }}
            />
            <button onClick={() => saveEdit(field, editValue)} disabled={saving} className="text-xs text-blue-400 hover:text-blue-300">保存</button>
            <button onClick={() => setEditField(null)} className="text-xs" style={{ color: 'var(--muted)' }}>✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{displayValue}</span>
            <button
              onClick={() => { setEditField(field); setEditValue(''); }}
              className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 rounded transition-opacity"
              style={{ color: 'var(--muted)', background: 'var(--surface2)' }}
            >編集</button>
          </div>
        )}
      </div>
    );
  }

  const marketMap: Record<string, number> = {};
  for (const r of marketRows) marketMap[r.data_type] = r.value;

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}><span className="text-gray-500">読み込み中...</span></div>;
  if (error || !property) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center"><div className="text-red-400 mb-3">{error ?? '物件が見つかりません'}</div><button onClick={() => router.push('/')} className="text-blue-400 underline text-sm">ダッシュボードへ戻る</button></div>
    </div>
  );

  const isBorrowedLand = extraction?.land_right_type && extraction.land_right_type !== '所有権';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-10" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="text-sm hover:text-white transition-colors" style={{ color: 'var(--muted)' }}>← 一覧</button>
          <span className="text-sm" style={{ color: 'var(--border)' }}>|</span>
          <span className="font-medium truncate">{property.name}</span>
          {property.property_type && <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>{property.property_type}</span>}
          {isBorrowedLand && <span className="text-xs px-2 py-0.5 rounded bg-yellow-900 text-yellow-300 border border-yellow-700">⚠ 借地権</span>}
          {score?.dscr_veto && <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300 border border-red-700">🚫 DSCR不足</span>}
          {score?.land_reg_warning && <span className="text-xs px-2 py-0.5 rounded bg-orange-900 text-orange-300 border border-orange-700">⚠ 土地規制法</span>}
          {score?.industrial_opportunity && <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300 border border-blue-700">🏭 産業立地</span>}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Key Metrics */}
          <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>物件概要</h2>
            {!extraction ? (
              <div className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>ドキュメントをアップロードしてデータを抽出してください</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8">
                <div>
                  <EditableMetric label="取得価格" field="asking_price" displayValue={fmt(extraction.asking_price, '億円')} />
                  <EditableMetric label="Cap Rate" field="cap_rate" displayValue={fmt(extraction.cap_rate, '%')} />
                  <EditableMetric label="表面利回り" field="surface_yield" displayValue={fmt(extraction.surface_yield, '%')} />
                  <EditableMetric label="現況NOI" field="noi_current" displayValue={fmt(extraction.noi_current, '万円')} />
                  <EditableMetric label="満室想定NOI" field="noi_full_occupancy" displayValue={fmt(extraction.noi_full_occupancy, '万円')} />
                  <EditableMetric label="稼働率" field="occupancy_rate" displayValue={fmt(extraction.occupancy_rate, '%')} />
                </div>
                <div>
                  <EditableMetric label="建物面積" field="building_sqm" displayValue={fmt(extraction.building_sqm, 'm²')} />
                  <EditableMetric label="土地面積" field="land_sqm" displayValue={fmt(extraction.land_sqm, 'm²')} />
                  <EditableMetric label="階数" field="floors" displayValue={extraction.floors ? `${extraction.floors}階` : '—'} />
                  <EditableMetric label="築年" field="year_built" displayValue={extraction.year_built ? `${extraction.year_built}年（${new Date().getFullYear() - extraction.year_built}年築）` : '—'} />
                  <EditableMetric label="戸数" field="unit_count" displayValue={extraction.unit_count ? `${extraction.unit_count}戸` : '—'} />
                  <EditableMetric label="構造" field="structure" displayValue={String(extraction.structure ?? '—')} />
                </div>
                <div>
                  <EditableMetric label="最寄駅" field="station" displayValue={extraction.station ?? '—'} />
                  <EditableMetric label="徒歩" field="walk_minutes" displayValue={extraction.walk_minutes ? `${extraction.walk_minutes}分` : '—'} />
                  <EditableMetric label="地権種別" field="land_right_type" displayValue={extraction.land_right_type ?? '所有権'} />
                  {isBorrowedLand && <>
                    <EditableMetric label="地代/月" field="land_lease_monthly" displayValue={fmt(extraction.land_lease_monthly, '円')} />
                    <EditableMetric label="借地期限" field="land_lease_expiry" displayValue={extraction.land_lease_expiry ?? '—'} />
                  </>}
                  <MetricRow label="リース期限リスク" value={extraction.lease_expiry_risk ?? '—'} />
                  <MetricRow label="抽出信頼度" value={extraction.extraction_confidence !== null ? `${Math.round((extraction.extraction_confidence ?? 0) * 100)}%` : '—'} />
                </div>
              </div>
            )}
          </section>

          {/* Upload */}
          <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>ドキュメントアップロード</h2>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <input type="file" accept="application/pdf,image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500 cursor-pointer'} bg-blue-600`}>
                  {uploading ? '⏳ 抽出中...' : '📄 PDF/画像を選択'}
                </span>
              </label>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>PDF・画像 最大20MB・Claude AIで自動抽出</span>
            </div>
            {uploadError && <div className="mt-3 text-sm text-red-400 rounded-lg p-3 bg-red-950 border border-red-800">{uploadError}</div>}
            {documents.length > 0 && (
              <div className="mt-4 space-y-1">
                {documents.map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-xs p-2 rounded" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                    <span>📎</span>
                    <span className="flex-1 truncate">{d.filename}</span>
                    <span>{d.extracted_at ? '✅ 抽出済' : '⏳ 未抽出'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Expenses */}
          {extraction && (
            <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>収支詳細</h2>
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <EditableMetric label="総賃料収入" field="gross_rent" displayValue={fmt(extraction.gross_rent, '万円')} />
                  <EditableMetric label="管理費" field="management_fee" displayValue={fmt(extraction.management_fee, '万円')} />
                  <EditableMetric label="固定資産税" field="fixed_asset_tax" displayValue={fmt(extraction.fixed_asset_tax, '万円')} />
                </div>
                <div>
                  <EditableMetric label="その他経費" field="other_expenses" displayValue={fmt(extraction.other_expenses, '万円')} />
                  <EditableMetric label="経費合計" field="total_expenses" displayValue={fmt(extraction.total_expenses, '万円')} />
                  <EditableMetric label="坪単価" field="price_per_tsubo" displayValue={fmt(extraction.price_per_tsubo, '万円/坪')} />
                </div>
              </div>
              {extraction.special_notes && (
                <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                  <span className="font-medium text-white">備考: </span>{extraction.special_notes}
                </div>
              )}
            </section>
          )}

          {/* Scores */}
          {score && (
            <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>5軸評価</h2>
              <div className="space-y-4">
                <ScoreBar label="取得 (Acquisition)" value={score.acquisition_score} rec={score.acquisition_rec} />
                <ScoreBar label="売却 (Disposition)" value={score.disposition_score} rec={score.disposition_rec} />
                <ScoreBar label="開発 (Development)" value={score.development_score} rec={score.development_rec} />
                <ScoreBar label="リーシング (Leasing)" value={score.leasing_score} />
                <ScoreBar label="ファイナンス (Financing)" value={score.financing_score} rec={score.financing_rec} />
              </div>
            </section>
          )}

          {/* Investment Memo */}
          {score?.investment_memo && (
            <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>AI 投資メモ</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{score.investment_memo}</p>
            </section>
          )}
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Overall score */}
          <section className="rounded-xl border p-5 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>総合スコア</div>
            {score ? (
              <>
                <div className="text-5xl font-bold mb-1" style={{ color: scoreColor(score.overall_score) }}>
                  {score.overall_score > 0 ? '+' : ''}{score.overall_score.toFixed(1)}
                </div>
                <div className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{score.valuation_status}</div>
                <div className="grid grid-cols-2 gap-2 text-left">
                  <MetricRow label="無レバIRR" value={fmt(score.irr, '%')} />
                  <MetricRow label="レバIRR" value={fmt(score.levered_irr, '%')} />
                  <MetricRow label="自己資金" value={fmt(score.equity_amount / 1e8, '億円')} />
                  <MetricRow label="借入額" value={fmt(score.loan_amount / 1e8, '億円')} />
                  <MetricRow label="年間CF" value={fmt(score.annual_cashflow / 1e4, '万円')} highlight={score.annual_cashflow > 0} />
                  <MetricRow label="回収年数" value={score.payback_years >= 999 ? '—' : `${score.payback_years}年`} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className={`col-span-2 p-2 rounded text-xs border ${score.dscr_veto ? 'bg-red-950 border-red-800 text-red-300' : 'border-gray-700'}`} style={score.dscr_veto ? {} : { background: 'var(--surface2)', color: 'var(--muted)' }}>
                    DSCR: <strong>{score.dscr.toFixed(2)}x</strong> {score.dscr_veto ? '— 融資基準（1.2x）未達、要注意' : '— 融資基準クリア'}
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
                <div className="mt-2 p-2 rounded text-xs" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  {score.irr_label} — {score.irr_description}
                </div>
              </>
            ) : (
              <div className="text-4xl font-bold text-gray-600 mb-3">—</div>
            )}
          </section>

          {/* Financing inputs */}
          <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted)' }}>融資条件</h2>
            <div className="space-y-3">
              {[
                { label: '自己資金比率', value: equityRatio, set: setEquityRatio, suffix: '%', min: 10, max: 100, step: 5 },
                { label: '借入金利', value: loanRate, set: setLoanRate, suffix: '%', min: 0.1, max: 5, step: 0.05 },
                { label: '借入期間', value: loanYears, set: setLoanYears, suffix: '年', min: 5, max: 35, step: 1 },
                { label: '保有期間', value: holdYears, set: setHoldYears, suffix: '年', min: 1, max: 20, step: 1 },
              ].map(f => (
                <div key={f.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{f.label}</span>
                    <span className="text-xs font-medium">{f.value}{f.suffix}</span>
                  </div>
                  <input
                    type="range" min={f.min} max={f.max} step={f.step} value={f.value}
                    onChange={e => f.set(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleScore}
              disabled={scoring || !extraction}
              className="w-full mt-4 py-2.5 rounded-lg font-medium text-sm transition-colors bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scoring ? '⏳ スコア生成中...' : '🧠 AIスコア生成'}
            </button>
            {!extraction && <div className="text-xs text-center mt-2" style={{ color: 'var(--muted)' }}>先にドキュメントをアップロードしてください</div>}
          </section>

          {/* Market data */}
          <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>市場データ</h2>
              <button
                onClick={handleRefreshMarket}
                disabled={refreshingMarket}
                className="text-xs px-2 py-1 rounded transition-colors hover:bg-blue-600"
                style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
              >{refreshingMarket ? '更新中...' : '↻ 更新'}</button>
            </div>
            {marketRows.length === 0 ? (
              <div className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>データなし — 更新ボタンを押してください</div>
            ) : (
              <div className="space-y-0">
                {[
                  { label: '日本10年国債', key: 'jpn_10y', unit: '%' },
                  { label: '米国10年国債', key: 'us_10y', unit: '%' },
                  { label: 'USD/JPY', key: 'usdjpy', unit: '' },
                  { label: 'CNY/JPY', key: 'cnyjpy', unit: '' },
                  { label: 'J-REIT指数', key: 'jreit_index', unit: '' },
                ].map(m => (
                  <MetricRow key={m.key} label={m.label} value={marketMap[m.key] !== undefined ? fmt(marketMap[m.key], m.unit) : '—'} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
