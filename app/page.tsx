'use client';
import { useState, useEffect, useMemo } from 'react';

interface Property {
  id: string;
  name: string;
  address: string;
  property_type: string;
  overall_score: number | null;
  acquisition_rec: string | null;
  valuation_status: string | null;
  cap_rate: number | null;
  asking_price: number | null;
  doc_count: number;
}

const TYPE_LABELS: Record<string, string> = {
  office: 'オフィス', retail: '商業', residential: '住宅',
  industrial: '工業', mixed: '複合',
};
const REC_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  Aggressive: { label: '積極取得', bg: '#e0f2e9', color: '#166534' },
  Cautious:   { label: '慎重',     bg: '#fef3c7', color: '#92400e' },
  Pass:       { label: 'パス',     bg: '#fee2e2', color: '#991b1b' },
};
const VAL_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  Undervalued: { label: '割安', bg: '#e0f2e9', color: '#166534' },
  Fair:        { label: '適正', bg: '#eff6ff', color: '#1e40af' },
  Overvalued:  { label: '割高', bg: '#fee2e2', color: '#991b1b' },
};

function scoreColor(s: number | null) {
  if (s === null) return '#94a3b8';
  if (s >= 2) return '#16a34a';
  if (s >= 0) return '#2563eb';
  return '#dc2626';
}

export default function Dashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newProp, setNewProp] = useState({
    name: '', address: '', prefecture: '東京都', city: '', property_type: 'office',
  });

  const load = () => fetch('/api/properties').then(r => r.json()).then(setProperties).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    properties.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.address ?? '').toLowerCase().includes(search.toLowerCase())
    ), [properties, search]);

  const create = async () => {
    if (!newProp.name) return;
    setCreating(true);
    const res = await fetch('/api/properties', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProp),
    });
    const { id } = await res.json();
    window.location.href = '/properties/' + id;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f8', fontFamily: "'Hiragino Sans', 'Yu Gothic', sans-serif" }}>

      {/* White navbar */}
      <div style={{ background: 'white', borderBottom: '2px solid #4f46e5', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.03em' }}>
          Realty<span style={{ color: '#4f46e5' }}>IQ</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>ポートフォリオ</span>
          <button onClick={() => setShowNew(v => !v)}
            style={{ padding: '7px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
            + 物件を追加
          </button>
        </div>
      </div>

      {/* Purple search bar */}
      <div style={{ background: 'linear-gradient(90deg, #4338ca, #6d28d9)', padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="5.5" cy="5.5" r="4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
          <path d="M9 9L12 12" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          placeholder="物件名・住所・エリアで検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 360, background: 'rgba(255,255,255,0.12)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 7, padding: '7px 12px', color: 'white', fontSize: 12, outline: 'none' }}
        />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>{filtered.length} 件登録</span>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 1100, margin: '24px auto', padding: '0 32px 48px' }}>

        {/* New property form */}
        {showNew && (
          <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 2px 12px rgba(79,70,229,0.06)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b', margin: '0 0 14px' }}>新規物件</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 12 }}>
              {[{ placeholder: '物件名 *', key: 'name' }, { placeholder: '住所', key: 'address' }, { placeholder: '市区町村', key: 'city' }].map(f => (
                <input key={f.key} placeholder={f.placeholder}
                  value={(newProp as any)[f.key]}
                  onChange={e => setNewProp({ ...newProp, [f.key]: e.target.value })}
                  style={{ border: '0.5px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', color: '#1e293b' }} />
              ))}
              <select value={newProp.property_type} onChange={e => setNewProp({ ...newProp, property_type: e.target.value })}
                style={{ border: '0.5px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#1e293b', background: 'white' }}>
                <option value="office">オフィス</option>
                <option value="retail">商業</option>
                <option value="residential">住宅</option>
                <option value="industrial">工業</option>
                <option value="mixed">複合</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={create} disabled={creating || !newProp.name}
                style={{ padding: '8px 18px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500, opacity: creating ? 0.7 : 1 }}>
                {creating ? '作成中...' : '作成する'}
              </button>
              <button onClick={() => setShowNew(false)}
                style={{ padding: '8px 14px', background: 'transparent', color: '#94a3b8', border: '0.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(79,70,229,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafbff' }}>
                {['物件名', '用途', '想定価格', 'Cap rate', 'バリュエーション', 'スコア', '推奨', '書類'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px',
                    textAlign: h === '物件名' || h === '用途' ? 'left' : 'center',
                    fontSize: 10, color: '#94a3b8', fontWeight: 500, letterSpacing: '.06em',
                    borderBottom: '0.5px solid #f1f5f9',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id}
                  onClick={() => window.location.href = '/properties/' + p.id}
                  style={{ borderBottom: i < filtered.length - 1 ? '0.5px solid #f8fafc' : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{p.address}</div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: '#64748b' }}>{TYPE_LABELS[p.property_type] ?? p.property_type}</td>
                  <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, color: '#334155', fontWeight: 500 }}>
                    {p.asking_price ? '¥' + (p.asking_price / 1e8).toFixed(1) + '億' : <span style={{ color: '#e2e8f0' }}>—</span>}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, color: '#334155' }}>
                    {p.cap_rate ? p.cap_rate.toFixed(1) + '%' : <span style={{ color: '#e2e8f0' }}>—</span>}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                    {p.valuation_status && VAL_CONFIG[p.valuation_status]
                      ? <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: VAL_CONFIG[p.valuation_status].bg, color: VAL_CONFIG[p.valuation_status].color, fontWeight: 500 }}>
                          {VAL_CONFIG[p.valuation_status].label}
                        </span>
                      : <span style={{ color: '#cbd5e1', fontSize: 12 }}>未分析</span>}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: scoreColor(p.overall_score) }}>
                      {p.overall_score != null
                        ? (p.overall_score > 0 ? '+' + p.overall_score : p.overall_score)
                        : <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 400 }}>—</span>}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                    {p.acquisition_rec && REC_CONFIG[p.acquisition_rec]
                      ? <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: REC_CONFIG[p.acquisition_rec].bg, color: REC_CONFIG[p.acquisition_rec].color, fontWeight: 500 }}>
                          {REC_CONFIG[p.acquisition_rec].label}
                        </span>
                      : null}
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>{p.doc_count || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '52px 16px', textAlign: 'center', color: '#cbd5e1', fontSize: 13 }}>
                  {search ? `「${search}」に一致する物件が見つかりません` : '上の「物件を追加」から始めてください'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
