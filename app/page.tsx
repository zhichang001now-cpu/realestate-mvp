'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLang, LangSwitcher } from './contexts/LanguageContext';

interface Property {
  id: string; name: string; address: string | null; property_type: string | null;
  asking_price: number | null; cap_rate: number | null; noi_current: number | null;
  occupancy_rate: number | null; year_built: number | null;
  overall_score: number | null; acquisition_score: number | null;
  levered_irr: number | null; acquisition_rec: string | null;
  valuation_status: string | null; created_at: string;
}

function scoreColor(v: number | null) {
  if (v === null) return 'text-gray-500';
  if (v >= 0.3) return 'text-emerald-400';
  if (v >= 0) return 'text-yellow-400';
  return 'text-red-400';
}
function scoreBg(v: number | null) {
  if (v === null) return 'bg-gray-800';
  if (v >= 0.3) return 'bg-emerald-950 border-emerald-800';
  if (v >= 0) return 'bg-yellow-950 border-yellow-800';
  return 'bg-red-950 border-red-900';
}
function fmt(n: number | null | undefined, unit = '') {
  if (n === null || n === undefined) return '—';
  if (unit === '億円') return (n / 1e8).toFixed(2) + '億円';
  if (unit === '%') return n.toFixed(2) + '%';
  return n.toLocaleString() + (unit ? ' ' + unit : '');
}
function recBadge(rec: string | null) {
  if (!rec) return null;
  const map: Record<string, string> = {
    Aggressive: 'bg-emerald-900 text-emerald-300 border border-emerald-700',
    Cautious:   'bg-yellow-900 text-yellow-300 border border-yellow-700',
    Pass:       'bg-red-900 text-red-300 border border-red-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[rec] ?? 'bg-gray-800 text-gray-300'}`}>{rec}</span>;
}

const PROPERTY_TYPES = ['マンション', 'オフィス', 'ホテル', '物流施設', '商業施設', '土地', 'その他'];

export default function Dashboard() {
  const router = useRouter();
  const { t } = useLang();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('マンション');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    fetch('/api/properties')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setProperties)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

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
    } catch (e) { alert((e as Error).message); }
    finally { setAdding(false); }
  }

  async function deleteProperty(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`「${name}」\n${t('dash.delete.confirm')}`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProperties(prev => prev.filter(p => p.id !== id));
    } catch (e) { alert((e as Error).message); }
    finally { setDeletingId(null); }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="border-b sticky top-0 z-10" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">R</div>
            <span className="font-semibold text-lg tracking-tight">{t('app.title')}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300 border border-blue-700">{t('app.beta')}</span>
          </div>
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('dash.search')}
              className="w-full px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <LangSwitcher />
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
            >{t('dash.add')}</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: t('dash.stat.total'), value: properties.length },
            { label: t('dash.stat.scored'), value: properties.filter(p => p.overall_score !== null).length },
            { label: t('dash.stat.aggressive'), value: properties.filter(p => p.acquisition_rec === 'Aggressive').length },
            { label: t('dash.stat.avg_irr'), value: (() => {
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

        {loading && <div className="text-center py-20 text-gray-500">{t('common.loading')}</div>}
        {error && <div className="rounded-xl p-4 bg-red-950 border border-red-800 text-red-300 mb-4">{t('common.error')}: {error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏢</div>
            <div className="text-gray-400 mb-2">{search ? t('dash.empty_search') : t('dash.empty')}</div>
            {!search && <button onClick={() => setShowAdd(true)} className="text-blue-400 underline text-sm">{t('dash.add_first')}</button>}
          </div>
        )}

        <div className="grid gap-4">
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => router.push(`/properties/${p.id}`)}
              className="rounded-xl border cursor-pointer hover:border-blue-600 transition-all group relative"
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
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-base group-hover:text-blue-300 transition-colors truncate">{p.name}</span>
                    {recBadge(p.acquisition_rec)}
                    {p.valuation_status === 'Undervalued' && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900 text-purple-300 border border-purple-700">割安</span>}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>
                    {[p.property_type, p.address].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>

                {/* Metrics */}
                <div className="hidden md:grid grid-cols-4 gap-6 text-right shrink-0">
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('dash.card.price')}</div>
                    <div className="text-sm font-medium">{fmt(p.asking_price, '億円')}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('dash.card.cap')}</div>
                    <div className="text-sm font-medium">{fmt(p.cap_rate, '%')}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('dash.card.occ')}</div>
                    <div className="text-sm font-medium">{fmt(p.occupancy_rate, '%')}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{t('dash.card.irr')}</div>
                    <div className={`text-sm font-medium ${p.levered_irr !== null && p.levered_irr >= 8 ? 'text-emerald-400' : ''}`}>
                      {fmt(p.levered_irr, '%')}
                    </div>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={e => deleteProperty(p.id, p.name, e)}
                  disabled={deletingId === p.id}
                  className="ml-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-red-900 shrink-0 opacity-40 hover:opacity-100"
                  style={{ color: 'var(--muted)' }}
                  title="削除"
                >
                  {deletingId === p.id ? '⏳' : '🗑'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm mx-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-lg font-semibold mb-4">{t('dash.modal.title')}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>{t('dash.modal.name')}</label>
                <input
                  value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addProperty()}
                  placeholder={t('dash.modal.name_placeholder')}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>{t('dash.modal.type')}</label>
                <select
                  value={newType} onChange={e => setNewType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowAdd(false); setNewName(''); }} className="flex-1 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>{t('common.cancel')}</button>
              <button onClick={addProperty} disabled={!newName.trim() || adding} className="flex-1 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 font-medium disabled:opacity-50 transition-colors">
                {adding ? t('dash.modal.adding') : t('dash.modal.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
