'use client';
import { useState, useEffect, useRef } from 'react';

interface Property {
  id: string; name: string; address: string; property_type: string; prefecture: string;
  cap_rate?: number; noi?: number; noi_current?: number; noi_full_occupancy?: number;
  surface_yield?: number; asking_price?: number; occupancy_rate?: number;
  year_built?: number; building_sqm?: number; land_sqm?: number; station?: string;
  walk_minutes?: number; price_per_tsubo?: number; rent_per_sqm?: number;
  lease_expiry_risk?: string; extraction_confidence?: number; structure?: string;
  unit_count?: number; parking_count?: number; floors?: number;
  land_right_type?: string; land_lease_monthly?: number; land_lease_expiry?: string;
  fixed_asset_tax?: number; management_fee?: number; special_notes?: string;
  raw_all_fields?: string;
  overall_score?: number; acquisition_score?: number; disposition_score?: number;
  development_score?: number; leasing_score?: number; financing_score?: number;
  acquisition_rec?: string; disposition_rec?: string; development_rec?: string; financing_rec?: string;
  irr?: number; levered_irr?: number; yield_on_cost?: number; valuation_status?: string;
  investment_memo?: string; irr_label?: string; irr_description?: string;
  annual_debt_service?: number; annual_cashflow?: number;
  equity_amount?: number; loan_amount?: number; payback_years?: number;
}

interface Financing {
  equity_ratio: string;
  loan_rate: string;
  loan_years: string;
  hold_years: string;
}

const REC: Record<string, string> = {
  Aggressive: '積極取得', Cautious: '慎重取得', Pass: 'パス',
  Sell: '売却推奨', Hold: '継続保有',
  Go: '実施', 'Re-underwrite': '再検討', Cancel: '中止',
  'Fix rate': '固定化', Wait: '様子見', Float: '変動',
};
const REC_STYLE: Record<string, { bg: string; color: string }> = {
  Aggressive: { bg: '#f0fdf4', color: '#166534' },
  Cautious:   { bg: '#fef3c7', color: '#92400e' },
  Pass:       { bg: '#fee2e2', color: '#991b1b' },
  Sell:       { bg: '#fee2e2', color: '#991b1b' },
  Hold:       { bg: '#eff6ff', color: '#1e40af' },
  Go:         { bg: '#f0fdf4', color: '#166534' },
  'Re-underwrite': { bg: '#fef3c7', color: '#92400e' },
  Cancel:     { bg: '#fee2e2', color: '#991b1b' },
  'Fix rate': { bg: '#f0fdf4', color: '#166534' },
  Wait:       { bg: '#fef3c7', color: '#92400e' },
  Float:      { bg: '#eff6ff', color: '#1e40af' },
};

function scoreColor(s: number | null | undefined) {
  if (s == null) return '#94a3b8';
  if (s >= 0.3) return '#16a34a';
  if (s >= 0)   return '#2563eb';
  return '#dc2626';
}

function fmt(n: number | undefined, unit = '') {
  if (n == null) return '—';
  return n.toLocaleString() + unit;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const pct = ((score + 1) / 2) * 100;
  const color = scoreColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <span style={{ fontSize: 11, color: '#64748b', width: 80, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 2, position: 'relative' }}>
        <div style={{ position: 'absolute', height: 4, borderRadius: 2, background: color, width: pct + '%' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 1, height: 8, transform: 'translateY(-50%)', background: '#e2e8f0' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, width: 36, textAlign: 'right', color }}>
        {score > 0 ? '+' + score.toFixed(1) : score.toFixed(1)}
      </span>
    </div>
  );
}

function Metric({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: '#f8faff', border: '0.5px solid #e8eeff', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: color ?? '#1e1b4b' }}>{value}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{sub}</p>}
    </div>
  );
}

function EditableField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid #f8fafc' }}>
      <span style={{ fontSize: 12, color: '#94a3b8', width: 120, flexShrink: 0 }}>{label}</span>
      {editing ? (
        <>
          <input value={val} onChange={e => setVal(e.target.value)}
            style={{ flex: 1, border: '0.5px solid #4338ca', borderRadius: 6, padding: '3px 8px', fontSize: 12, outline: 'none' }} />
          <button onClick={() => { onSave(val); setEditing(false); }}
            style={{ fontSize: 11, padding: '3px 8px', background: '#4338ca', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>保存</button>
          <button onClick={() => { setVal(value); setEditing(false); }}
            style={{ fontSize: 11, padding: '3px 8px', background: 'transparent', color: '#94a3b8', border: '0.5px solid #e2e8f0', borderRadius: 5, cursor: 'pointer' }}>取消</button>
        </>
      ) : (
        <>
          <span style={{ flex: 1, fontSize: 13, color: val ? '#1e293b' : '#cbd5e1' }}>{val || '—'}</span>
          <button onClick={() => setEditing(true)}
            style={{ fontSize: 10, padding: '2px 8px', background: 'transparent', color: '#94a3b8', border: '0.5px solid #e2e8f0', borderRadius: 5, cursor: 'pointer' }}>編集</button>
        </>
      )}
    </div>
  );
}

function FinancingInput({ value, onChange }: { value: Financing; onChange: (f: Financing) => void }) {
  const field = (label: string, key: keyof Financing, unit: string, hint: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: '#94a3b8' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number"
          value={value[key]}
          onChange={e => onChange({ ...value, [key]: e.target.value })}
          style={{ width: '100%', border: '0.5px solid #e2e8f0', borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none', color: '#1e1b4b' }}
        />
        <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{unit}</span>
      </div>
      <span style={{ fontSize: 10, color: '#cbd5e1' }}>{hint}</span>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
      {field('自己資金比率', 'equity_ratio', '%', '例: 40')}
      {field('借入金利', 'loan_rate', '%', '例: 1.65')}
      {field('借入期間', 'loan_years', '年', '例: 20')}
      {field('保有期間', 'hold_years', '年', '例: 5')}
    </div>
  );
}

export default function PropertyPage({ params }: { params: { id: string } }) {
  const [property, setProperty] = useState<Property | null>(null);
  const [market, setMarket] = useState<Record<string, number>>({});
  const [scoring, setScoring] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshingMarket, setRefreshingMarket] = useState(false);
  const [financing, setFinancing] = useState<Financing>({
    equity_ratio: '40',
    loan_rate: '1.65',
    loan_years: '20',
    hold_years: '5',
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => fetch('/api/properties/' + params.id).then(r => r.json()).then(setProperty).catch(() => {});

  const loadMarket = async () => {
    setRefreshingMarket(true);
    try {
      await fetch('/api/market/refresh', { method: 'POST' });
      const d = await fetch('/api/market/refresh').then(r => r.json());
      const snap: Record<string, number> = {};
      for (const [k, arr] of Object.entries(d)) if ((arr as any[]).length) snap[k] = (arr as any[])[0]?.value;
      setMarket(snap);
    } catch {}
    setRefreshingMarket(false);
  };

  useEffect(() => {
    load();
    fetch('/api/market/refresh').then(r => r.json()).then((d: any) => {
      const snap: Record<string, number> = {};
      for (const [k, arr] of Object.entries(d)) if ((arr as any[]).length) snap[k] = (arr as any[])[0]?.value;
      setMarket(snap);
    }).catch(() => {});
  }, [params.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('doc_type', 'brochure');
    await fetch('/api/properties/' + params.id + '/upload', { method: 'POST', body: fd });
    setUploading(false);
    load();
  };

  const handleScore = async () => {
    setScoring(true);
    try {
      const res = await fetch('/api/properties/' + params.id + '/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financing: {
            equity_ratio: parseFloat(financing.equity_ratio) / 100,
            loan_rate: parseFloat(financing.loan_rate) / 100,
            loan_years: parseInt(financing.loan_years),
            hold_years: parseInt(financing.hold_years),
          }
        })
      });
      const data = await res.json();
      setProperty(prev => prev ? { ...prev, ...data } : null);
    } catch {}
    setScoring(false);
  };

  const handleSaveField = async (field: string, value: string) => {
    await fetch('/api/properties/' + params.id + '/edit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value }),
    }).catch(() => {});
    load();
  };

  if (!property) return (
    <div style={{ minHeight: '100vh', background: '#f0f2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>読み込み中...</div>
    </div>
  );

  const age = property.year_built ? new Date().getFullYear() - property.year_built : null;
  const isBorrowedLand = property.land_right_type && property.land_right_type !== '所有権';
  let rawFields: Record<string, string> = {};
  try { rawFields = JSON.parse(property.raw_all_fields ?? '{}'); } catch {}

  const recItems = [
    { label: '取得', val: property.acquisition_rec },
    { label: '売却', val: property.disposition_rec },
    { label: '開発', val: property.development_rec },
    { label: '資金調達', val: property.financing_rec },
  ];
  const scoreItems = [
    { key: 'acquisition_score', label: '取得' },
    { key: 'disposition_score', label: '売却' },
    { key: 'development_score', label: '開発' },
    { key: 'leasing_score',     label: 'リーシング' },
    { key: 'financing_score',   label: 'ファイナンス' },
  ];
  const irrColor = (property.levered_irr ?? 0) >= 10 ? '#166534' :
                   (property.levered_irr ?? 0) >= 6  ? '#1e40af' : '#92400e';

  const editFields = [
    { label: '最寄駅',        field: 'station',            value: property.station?.toString() ?? '' },
    { label: '徒歩分数',      field: 'walk_minutes',       value: property.walk_minutes?.toString() ?? '' },
    { label: '土地面積 (m²)', field: 'land_sqm',           value: property.land_sqm?.toString() ?? '' },
    { label: '延床面積 (m²)', field: 'building_sqm',       value: property.building_sqm?.toString() ?? '' },
    { label: '階数',          field: 'floors',             value: property.floors?.toString() ?? '' },
    { label: '構造',          field: 'structure',          value: property.structure ?? '' },
    { label: '戸数',          field: 'unit_count',         value: property.unit_count?.toString() ?? '' },
    { label: '駐車場台数',    field: 'parking_count',      value: property.parking_count?.toString() ?? '' },
    { label: '坪単価',        field: 'price_per_tsubo',    value: property.price_per_tsubo ? '¥' + Math.round(property.price_per_tsubo / 10000) + '万' : '' },
    { label: '土地権利',      field: 'land_right_type',    value: property.land_right_type ?? '' },
    { label: '地代 (円/月)',  field: 'land_lease_monthly', value: property.land_lease_monthly?.toString() ?? '' },
    { label: '借地期限',      field: 'land_lease_expiry',  value: property.land_lease_expiry ?? '' },
    { label: '固都税 (円/年)',field: 'fixed_asset_tax',    value: property.fixed_asset_tax?.toString() ?? '' },
    { label: '特記事項',      field: 'special_notes',      value: property.special_notes ?? '' },
  ];
  const filledFields = editFields.filter(f => f.value);
  const emptyFields  = editFields.filter(f => !f.value);

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f8', fontFamily: "'Hiragino Sans', 'Yu Gothic', sans-serif" }}>

      {/* Navbar */}
      <div style={{ background: 'white', borderBottom: '2px solid #4f46e5', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
        <a href="/" style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.03em', textDecoration: 'none' }}>
          Realty<span style={{ color: '#4f46e5' }}>IQ</span>
        </a>
        <a href="/" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>← 一覧に戻る</a>
      </div>

      {/* Title bar */}
      <div style={{ background: 'linear-gradient(90deg, #4338ca, #6d28d9)', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ color: 'white', fontSize: 16, fontWeight: 700, margin: 0 }}>{property.name}</h1>
            {isBorrowedLand && (
              <span style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(251,191,36,0.25)', color: '#fbbf24', border: '0.5px solid rgba(251,191,36,0.4)', borderRadius: 20 }}>
                {property.land_right_type}
              </span>
            )}
          </div>
          <p style={{ color: 'rgba(196,181,253,0.7)', fontSize: 12, margin: '3px 0 0' }}>{property.address} · {property.property_type}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={handleUpload} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.12)', color: 'white', border: '0.5px solid rgba(255,255,255,0.25)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
            {uploading ? 'AI抽出中...' : '書類アップロード'}
          </button>
          <button onClick={handleScore} disabled={scoring}
            style={{ padding: '7px 18px', background: 'white', color: '#4338ca', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700, opacity: scoring ? 0.7 : 1 }}>
            {scoring ? '分析中...' : 'AI分析を実行'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '20px auto', padding: '0 32px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 230px', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Key metrics */}
            <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 14, padding: 18, boxShadow: '0 2px 12px rgba(79,70,229,0.05)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
                <Metric label="想定価格" value={property.asking_price ? '¥' + (property.asking_price / 1e8).toFixed(1) + '億' : '—'} />
                <Metric label="表面利回り" value={property.surface_yield ? property.surface_yield.toFixed(1) + '%' : '—'} />
                <Metric label="NOI Cap rate" value={property.cap_rate ? property.cap_rate.toFixed(1) + '%' : '—'} />
                <Metric label="稼働率" value={property.occupancy_rate ? property.occupancy_rate.toFixed(0) + '%' : '—'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                <Metric label="現況NOI" value={property.noi_current ? '¥' + (property.noi_current / 1e6).toFixed(1) + 'M/年' : '—'} />
                <Metric label="満室想定NOI" value={property.noi_full_occupancy ? '¥' + (property.noi_full_occupancy / 1e6).toFixed(1) + 'M/年' : '—'} />
                <Metric label="延床面積" value={property.building_sqm ? property.building_sqm.toFixed(0) + ' m²' : '—'} />
                <Metric label="築年数" value={age ? age + '年（' + property.year_built + '年築）' : '—'} />
              </div>
            </div>

            {isBorrowedLand && (
              <div style={{ background: '#fffbeb', border: '0.5px solid #fcd34d', borderRadius: 12, padding: '12px 16px' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#92400e' }}>{property.land_right_type}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#b45309' }}>
                  地代 ¥{property.land_lease_monthly?.toLocaleString()}/月
                  {property.land_lease_expiry ? ' · 借地期限 ' + property.land_lease_expiry : ''}
                </p>
              </div>
            )}

            {/* Financing input */}
            <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 14, padding: 18, boxShadow: '0 2px 12px rgba(79,70,229,0.05)' }}>
              <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: '#1e1b4b' }}>融資条件（分析前に設定）</p>
              <FinancingInput value={financing} onChange={setFinancing} />
              {property.asking_price && (
                <div style={{ display: 'flex', gap: 16, marginTop: 12, padding: '10px 12px', background: '#f8faff', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>自己資金 </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b' }}>
                      ¥{Math.round(property.asking_price * parseFloat(financing.equity_ratio) / 100 / 1e6)}M
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>借入額 </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b' }}>
                      ¥{Math.round(property.asking_price * (1 - parseFloat(financing.equity_ratio) / 100) / 1e6)}M
                    </span>
                  </div>
                  {property.annual_debt_service && (
                    <div>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>年間返済額 </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b' }}>
                        ¥{Math.round(property.annual_debt_service / 1e6 * 10) / 10}M/年
                      </span>
                    </div>
                  )}
                  {property.annual_cashflow != null && (
                    <div>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>税前CF </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: property.annual_cashflow >= 0 ? '#166534' : '#991b1b' }}>
                        ¥{Math.round(property.annual_cashflow / 1e6 * 10) / 10}M/年
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Decision scores */}
            {property.overall_score != null && (
              <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 14, padding: 18, boxShadow: '0 2px 12px rgba(79,70,229,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, paddingBottom: 16, borderBottom: '0.5px solid #f1f5f9' }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
                    border: '2px solid ' + scoreColor(property.overall_score),
                    background: property.overall_score >= 0.3 ? '#f0fdf4' : property.overall_score >= 0 ? '#eff6ff' : '#fee2e2',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor(property.overall_score), lineHeight: 1 }}>
                      {property.overall_score > 0 ? '+' + property.overall_score.toFixed(1) : property.overall_score.toFixed(1)}
                    </span>
                    <span style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>/ 1.0</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e1b4b', marginBottom: 4 }}>総合投資スコア</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>+0.5以上：良好　0：標準　-0.5以下：要注意</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
                  {recItems.map(({ label, val }) => {
                    const s = val && REC_STYLE[val] ? REC_STYLE[val] : { bg: '#f8fafc', color: '#94a3b8' };
                    return (
                      <div key={label} style={{ background: s.bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>{label}</p>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: s.color }}>{val ? REC[val] ?? val : '—'}</p>
                      </div>
                    );
                  })}
                </div>
                {scoreItems.map(({ key, label }) => (
                  <ScoreBar key={key} score={(property as any)[key] ?? 0} label={label} />
                ))}
              </div>
            )}

            {/* IRR */}
            {property.irr != null && (
              <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 14, padding: 18, boxShadow: '0 2px 12px rgba(79,70,229,0.05)' }}>
                <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: '#1e1b4b' }}>収益性</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
                  <div style={{ background: '#f8faff', border: '0.5px solid #e8eeff', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>レバレッジIRR</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: irrColor }}>{property.levered_irr?.toFixed(1)}%</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 600, color: irrColor }}>{property.irr_label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>{property.irr_description}</p>
                  </div>
                  <div style={{ background: '#f8faff', border: '0.5px solid #e8eeff', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>アンレバIRR</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#334155' }}>{property.irr?.toFixed(1)}%</p>
                    <p style={{ margin: '3px 0 0', fontSize: 10, color: '#94a3b8' }}>借入なしの場合の収益率</p>
                  </div>
                  <div style={{ background: '#f8faff', border: '0.5px solid #e8eeff', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>バリュエーション</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: property.valuation_status === 'Undervalued' ? '#166534' : property.valuation_status === 'Overvalued' ? '#991b1b' : '#1e40af' }}>
                      {property.valuation_status === 'Undervalued' ? '割安' : property.valuation_status === 'Overvalued' ? '割高' : '適正'}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 10, color: '#94a3b8' }}>市場平均との比較</p>
                  </div>
                </div>
                {property.payback_years != null && property.payback_years < 999 && (
                  <div style={{ background: '#f8faff', border: '0.5px solid #e8eeff', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 24 }}>
                    <div>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>自己資金回収期間 </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1e1b4b' }}>{property.payback_years}年</span>
                    </div>
                    {property.annual_cashflow != null && (
                      <div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>年間税前CF </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: property.annual_cashflow >= 0 ? '#166534' : '#991b1b' }}>
                          ¥{(property.annual_cashflow / 1e6).toFixed(1)}M
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Memo */}
            {property.investment_memo && (
              <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 14, padding: 18, boxShadow: '0 2px 12px rgba(79,70,229,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 4, height: 16, background: '#4338ca', borderRadius: 2 }} />
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e1b4b' }}>投資メモ</p>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.85 }}>{property.investment_memo}</p>
              </div>
            )}

            {/* Editable fields */}
            <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 14, padding: 18, boxShadow: '0 2px 12px rgba(79,70,229,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e1b4b' }}>抽出データ（手動修正可）</p>
                {property.extraction_confidence != null && (
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>精度 {(property.extraction_confidence * 100).toFixed(0)}%</span>
                )}
              </div>
              {filledFields.map(f => (
                <EditableField key={f.field} label={f.label} value={f.value} onSave={v => handleSaveField(f.field, v)} />
              ))}
              {emptyFields.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer', padding: '6px 0' }}>
                    未取得項目 {emptyFields.length}件を表示
                  </summary>
                  <div style={{ marginTop: 4 }}>
                    {emptyFields.map(f => (
                      <EditableField key={f.field} label={f.label} value={f.value} onSave={v => handleSaveField(f.field, v)} />
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Raw data */}
            {Object.keys(rawFields).length > 0 && (
              <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 14, padding: 18, boxShadow: '0 2px 12px rgba(79,70,229,0.05)' }}>
                <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: '#1e1b4b' }}>AI抽出 生データ一覧</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#fafbff' }}>
                      <th style={{ padding: '7px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 500, borderBottom: '0.5px solid #f1f5f9', width: '38%' }}>項目</th>
                      <th style={{ padding: '7px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 500, borderBottom: '0.5px solid #f1f5f9' }}>抽出値</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(rawFields).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: '0.5px solid #f8fafc' }}>
                        <td style={{ padding: '6px 12px', color: '#64748b' }}>{k}</td>
                        <td style={{ padding: '6px 12px', color: '#1e293b' }}>{String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!property.cap_rate && !property.investment_memo && (
              <div style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 14, padding: 18 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>
                  書類をアップロードするとAIが自動でデータを抽出します。その後「AI分析を実行」で投資スコアと投委メモが生成されます。
                </p>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 14, padding: 16, boxShadow: '0 2px 12px rgba(79,70,229,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e1b4b' }}>市場データ</p>
                <button onClick={loadMarket} disabled={refreshingMarket}
                  style={{ fontSize: 10, color: '#4f46e5', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  {refreshingMarket ? '更新中...' : '↺ 更新'}
                </button>
              </div>
              <p style={{ margin: '0 0 6px', fontSize: 10, color: '#94a3b8', letterSpacing: '.06em' }}>日本</p>
              {[
                { label: '10年国債', val: market.jpn_10y, unit: '%', dec: 2 },
                { label: 'J-REIT指数', val: market.jreit_index, unit: '', dec: 0 },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f8fafc' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{m.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: m.val != null ? '#1e1b4b' : '#cbd5e1' }}>
                    {m.val != null ? m.val.toFixed(m.dec) + m.unit : '—'}
                  </span>
                </div>
              ))}
              <p style={{ margin: '10px 0 6px', fontSize: 10, color: '#94a3b8', letterSpacing: '.06em' }}>アメリカ</p>
              {[
                { label: '10年国債', val: market.us_10y, unit: '%', dec: 2 },
                { label: 'USD/JPY', val: market.usdjpy, unit: '', dec: 1 },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f8fafc' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{m.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: m.val != null ? '#1e1b4b' : '#cbd5e1' }}>
                    {m.val != null ? m.val.toFixed(m.dec) + m.unit : '—'}
                  </span>
                </div>
              ))}
              <p style={{ margin: '10px 0 6px', fontSize: 10, color: '#94a3b8', letterSpacing: '.06em' }}>中国</p>
              {[
                { label: '10年国債', val: market.chn_10y, unit: '%', dec: 2 },
                { label: 'CNY/JPY', val: market.cnyjpy, unit: '', dec: 2 },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f8fafc' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{m.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: m.val != null ? '#1e1b4b' : '#cbd5e1' }}>
                    {m.val != null ? m.val.toFixed(m.dec) + m.unit : '—'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 14, padding: 16, boxShadow: '0 2px 12px rgba(79,70,229,0.05)' }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#1e1b4b' }}>物件概要</p>
              {[
                { label: '所在地', val: property.address },
                { label: '最寄駅', val: property.station ? property.station + '駅 ' + property.walk_minutes + '分' : null },
                { label: '用途', val: property.property_type },
                { label: '構造', val: property.structure },
                { label: '階数', val: property.floors ? property.floors + '階建' : null },
                { label: '戸数', val: property.unit_count ? property.unit_count + '戸' : null },
                { label: '土地権利', val: property.land_right_type },
              ].filter(r => r.val).map(({ label, val }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f8fafc' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
                  <span style={{ fontSize: 11, color: '#334155', textAlign: 'right', maxWidth: '60%' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
