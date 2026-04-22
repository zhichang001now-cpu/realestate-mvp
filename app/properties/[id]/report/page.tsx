'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

function fmt(n: number | null | undefined, unit = '', d = 2): string {
  if (n == null || !isFinite(n)) return '—';
  if (unit === '億円') return (n / 1e8).toFixed(d) + ' 億円';
  if (unit === '万円') return Math.round(n / 1e4).toLocaleString() + ' 万円';
  if (unit === '%') return n.toFixed(d) + '%';
  return n.toLocaleString() + (unit ? ' ' + unit : '');
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e5e7eb', fontSize: 13 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 600, color: highlight ? '#059669' : '#111827' }}>{value}</span>
    </div>
  );
}

function ScoreBar({ label, value, rec }: { label: string; value: number; rec?: string }) {
  const pct = Math.round(((value + 1) / 2) * 100);
  const color = value >= 0.3 ? '#059669' : value >= 0 ? '#d97706' : '#dc2626';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
        <span style={{ color: '#374151' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{rec ? `${rec}  ` : ''}{value > 0 ? '+' : ''}{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3 }}>
        <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/properties/${id}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading...</div>;
  if (!data) return <div style={{ padding: 40 }}>Not found</div>;

  const { property, extraction, score, marketRows } = data;
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const marketMap: Record<string, number> = {};
  (marketRows ?? []).forEach((r: any) => { marketMap[r.data_type] = r.value; });

  return (
    <div style={{ fontFamily: "'Hiragino Sans', 'Yu Gothic', sans-serif", background: '#fff', color: '#111827', maxWidth: 860, margin: '0 auto', padding: '40px 48px' }}>

      {/* Print button — hidden in print */}
      <div className="no-print" style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
        <button onClick={() => window.print()}
          style={{ padding: '8px 20px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
          🖨️ PDF保存 / 印刷
        </button>
        <button onClick={() => window.close()}
          style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
          閉じる
        </button>
      </div>

      {/* Header */}
      <div style={{ borderBottom: '3px solid #1e3a8a', paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Investment Analysis Report</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a' }}>{property?.name ?? '—'}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{property?.address ?? extraction?.address_extracted ?? '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>作成日</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{today}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>RealtyIQ</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Left — property overview */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>物件概要</div>
          <Row label="取得価格" value={fmt(extraction?.asking_price, '億円')} />
          <Row label="Cap Rate" value={fmt(extraction?.cap_rate, '%')} />
          <Row label="満室想定NOI" value={fmt(extraction?.noi_full_occupancy, '万円')} />
          <Row label="現況NOI" value={fmt(extraction?.noi_current, '万円')} />
          <Row label="建物面積" value={fmt(extraction?.building_sqm, 'm²')} />
          <Row label="土地面積" value={fmt(extraction?.land_sqm, 'm²')} />
          <Row label="築年" value={extraction?.year_built ? `${extraction.year_built}年（${new Date().getFullYear() - extraction.year_built}年築）` : '—'} />
          <Row label="構造" value={extraction?.structure ?? '—'} />
          <Row label="戸数" value={extraction?.unit_count ? `${extraction.unit_count}戸` : '—'} />
          <Row label="最寄駅" value={extraction?.station ? `${extraction.station}駅 徒歩${extraction.walk_minutes ?? '?'}分` : '—'} />
          <Row label="地権種別" value={extraction?.land_right_type ?? '所有権'} />
        </div>

        {/* Right — financial results */}
        <div>
          {score ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>財務分析</div>
              {/* Score badge */}
              <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: 8, marginBottom: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>総合スコア</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: score.overall_score >= 0.3 ? '#059669' : score.overall_score >= 0 ? '#d97706' : '#dc2626' }}>
                  {score.overall_score > 0 ? '+' : ''}{score.overall_score?.toFixed(1)}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{score.valuation_status}</div>
              </div>
              <Row label="無レバIRR" value={fmt(score.irr, '%')} />
              <Row label="レバIRR" value={fmt(score.levered_irr, '%')} />
              <Row label="DSCR" value={score.dscr ? `${score.dscr.toFixed(2)}x` : '—'} highlight={!score.dscr_veto} />
              <Row label="自己資金" value={fmt(score.equity_amount, '億円')} />
              <Row label="借入額" value={fmt(score.loan_amount, '億円')} />
              <Row label="年間CF" value={fmt(score.annual_cashflow, '万円')} highlight={(score.annual_cashflow ?? 0) > 0} />
              <Row label="回収年数" value={score.payback_years >= 999 ? '—' : `${score.payback_years}年`} />
              {score.noi_adjusted != null && <Row label="調整後NOI" value={fmt(score.noi_adjusted, '万円')} />}
              {score.annual_capex != null && <Row label="修繕積立控除" value={`−${fmt(score.annual_capex, '万円')}`} />}
              {score.exit_cap_rate != null && <Row label="出口Cap Rate" value={`${score.exit_cap_rate.toFixed(2)}%`} />}
              {score.exit_value != null && <Row label="推定出口価格" value={fmt(score.exit_value, '億円')} />}
            </>
          ) : (
            <div style={{ color: '#9ca3af', fontSize: 13, paddingTop: 20 }}>スコア未生成</div>
          )}
        </div>
      </div>

      {/* 5-axis scores */}
      {score && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#6b7280', textTransform: 'uppercase', marginBottom: 12 }}>5軸評価</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            <ScoreBar label="取得 (Acquisition)" value={score.acquisition_score} rec={score.acquisition_rec} />
            <ScoreBar label="売却 (Disposition)" value={score.disposition_score} rec={score.disposition_rec} />
            <ScoreBar label="開発 (Development)" value={score.development_score} rec={score.development_rec} />
            <ScoreBar label="リーシング (Leasing)" value={score.leasing_score} />
            <ScoreBar label="ファイナンス (Financing)" value={score.financing_score} rec={score.financing_rec} />
          </div>
        </div>
      )}

      {/* AI Memo */}
      {score?.investment_memo && (
        <div style={{ marginTop: 28, padding: '16px 20px', background: '#f8fafc', borderRadius: 8, borderLeft: '4px solid #1e3a8a' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>AI 投資メモ</div>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: '#374151', margin: 0 }}>{score.investment_memo}</p>
        </div>
      )}

      {/* Market data */}
      {marketRows?.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>市場データ</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: '日本10年国債', key: 'jpn_10y', unit: '%' },
              { label: '米国10年国債', key: 'us_10y', unit: '%' },
              { label: 'USD/JPY', key: 'usdjpy', unit: '' },
              { label: 'CNY/JPY', key: 'cnyjpy', unit: '' },
              { label: 'J-REIT指数', key: 'jreit_index', unit: '' },
            ].filter(m => marketMap[m.key] != null).map(m => (
              <div key={m.key} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                <div style={{ color: '#9ca3af', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontWeight: 700 }}>{m.unit === '%' ? `${marketMap[m.key].toFixed(2)}%` : marketMap[m.key].toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flags */}
      {score && (score.dscr_veto || score.land_reg_warning || score.industrial_opportunity) && (
        <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {score.dscr_veto && <span style={{ padding: '3px 10px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 99, fontSize: 11 }}>🚫 DSCR未達</span>}
          {score.land_reg_warning && <span style={{ padding: '3px 10px', background: '#fffbeb', border: '1px solid #fcd34d', color: '#d97706', borderRadius: 99, fontSize: 11 }}>⚠ 土地規制法</span>}
          {score.industrial_opportunity && <span style={{ padding: '3px 10px', background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8', borderRadius: 99, fontSize: 11 }}>🏭 {score.industrial_hub}</span>}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 40, paddingTop: 12, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
        <span>Generated by RealtyIQ — AI Real Estate Investment Analysis</span>
        <span>{today}</span>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>
    </div>
  );
}
