'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) { setError('パスワードが違います'); return; }
      router.push('/');
      router.refresh();
    } catch { setError('エラーが発生しました'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold tracking-tight mb-1">RealtyIQ</div>
          <div className="text-xs px-2 py-0.5 rounded inline-block" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>Beta</div>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl border p-6 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--muted)' }}>パスワード</label>
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              autoFocus
              placeholder="••••••••••••"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <button
            type="submit"
            disabled={loading || !pw}
            className="w-full py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '確認中...' : '入室'}
          </button>
        </form>
      </div>
    </div>
  );
}
