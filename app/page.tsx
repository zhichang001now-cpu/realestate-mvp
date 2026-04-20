'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface Property {
  id: string;
  name: string;
  address: string | null;
  property_type: string | null;
  asking_price: number | null;
  cap_rate: number | null;
  noi_current: number | null;
  occupancy_rate: number | null;
  year_built: number | null;
  overall_score: number | null;
  acquisition_score: number | null;
  levered_irr: number | null;
  acquisition_rec: string | null;
  valuation_status: string | null;
  created_at: string;
}

function scoreColor(v: number | null): string {
  if (v === null) return 'text-gray-500';
  if (v >= 0.3) return 'text-emerald-400';
  if (v >= 0) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBg(v: number | null): string {
  if (v === null) return 'bg-gray-800';
  if (v >= 0.3) return 'bg-emerald-950 border-emerald-800';
  if (v >= 0) return 'bg-yellow-950 border-yellow-800';
  return 'bg-red-950 border-red-900';
}

function fmt(n: number | null, unit = ''): string {
  if (n === null || n === undefined) return '—';
  if (unit === '億円') return (n / 1e8).toFixed(2) + '億円';
  if (unit === '%') return n.toFixed(2) + '%';
  return n.toLocaleString() + unit;
}

function recBadge(rec: string | null) {
  if (!rec) return null;
  const map: Record<string, string> = {
    Aggressive: 'bg-emerald-900 text-emerald-300 border border-emerald-700',
    Cautious: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
    Pass: 'bg-red-900 text-red-300 border border-red-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[rec] ?? 'bg-gray-800 text-gray-300'}`}>{rec}</span>;
}

export default function Dashboard() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('マンション');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch('/api/properties')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setProperties)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    properties.filter(p =>
      [p.name, p.address, p.property_type].some(f => f?.toLowerCase().includes(search.toLowerCase()))
    ), [properties, search]);

  async function addProperty() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), property_type: newType }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json();
      router.push(`/properties/${id}`);
    } catch (e) {
      alert('追加失敗: ' + (e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  const PROPERTY_TYPES = ['マンション', 'オフィス', 'ホテル', '物流施設', '商業施設', '土地', 'その他'];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-10" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">R</div>
            <span className="font-semibold text-lg tracking-tight">RealtyIQ</span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300 border border-blue-700">Beta</span>
          </div>
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="物件名・住所で検索..."
              className="w-full px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
          >
            + 新規物件
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: '登録物件', value: properties.length },
            { label: 'スコア済', value: properties.filter(p => p.overall_score !== null).length },
            { label: 'Aggressive', value: properties.filter(p => p.acquisition_rec === 'Aggressive').length },
            { label: '平均IRR', value: (() => {
              const irrs = properties.filter(p => p.levered_irr !== null).map(p => p.levered_irr!);
              return irrs.length ? (irrs.reduce((a, b) => a + b, 0) / irrs.length).toFixed(1) + '%' : '—';
            })() },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {loading && <div className="text-center py-20 text-gray-500">読み込み中...</div>}
        {error && <div className="rounded-xl p-4 bg-red-950 border border-red-800 text-red-300 mb-4">エラー: {error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏢</div>
            <div className="text-gray-400 mb-2">{search ? '検索結果なし' : '物件がまだ登録されていません'}</div>
            {!search && <button onClick={() => setShowAdd(true)} className="text-blue-400 underline text-sm">最初の物件を追加する</button>}
          </div>
        )}

        {/* Property grid */}
        <div className="grid gap-4">
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => router.push(`/properties/${p.id}`)}
              className="rounded-xl border cursor-pointer hover:border-blue-600 transition-all group"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="p-5 flex items-center gap-6">
                {/* Score badge */}
                <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center border shrink-0 ${scoreBg(p.overall_score)}`}>
                  <span className={`text-xl font-bold ${scoreColor(p.overall_score)}`}>
                    {p.overall_score !== null ? (p.overall_score > 0 ? '+' : '') + p.overall_score.toFixed(1) : '—'}
                  </span>
                  <span className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>総合</span>
                </div>

                {/* Name + address */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-base group-hover:text-blue-300 transition-colors truncate">{p.name}</span>
                    {recBadge(p.acquisition_rec)}
                    {p.valuation_status === 'Undervalued' && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900 text-purple-300 border border-purple-700">割安</span>}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>
                    {[p.property_type, p.address].filter(Boolean).join(' · ') || '住所未登録'}
                  </div>
                </div>

                {/* Key metrics */}
                <div className="hidden md:grid grid-cols-4 gap-6 text-right shrink-0">
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>取得価格</div>
                    <div className="text-sm font-medium">{fmt(p.asking_price, '億円')}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Cap Rate</div>
                    <div className="text-sm font-medium">{fmt(p.cap_rate, '%')}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>稼働率</div>
                    <div className="text-sm font-medium">{fmt(p.occupancy_rate, '%')}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>レバIRR</div>
                    <div className={`text-sm font-medium ${p.levered_irr !== null && p.levered_irr >= 8 ? 'text-emerald-400' : ''}`}>
                      {fmt(p.levered_irr, '%')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Add property modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm mx-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-lg font-semibold mb-4">新規物件を追加</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>物件名 *</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addProperty()}
                  placeholder="例: 渋谷区マンション A棟"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>物件種別</label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowAdd(false); setNewName(''); }}
                className="flex-1 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >キャンセル</button>
              <button
                onClick={addProperty}
                disabled={!newName.trim() || adding}
                className="flex-1 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 font-medium disabled:opacity-50 transition-colors"
              >{adding ? '追加中...' : '追加して詳細へ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
