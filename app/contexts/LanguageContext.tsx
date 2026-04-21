'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type Lang, createT, LANG_LABELS } from '@/lib/i18n';

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: ReturnType<typeof createT>; }
const Ctx = createContext<LangCtx>({ lang: 'ja', setLang: () => {}, t: createT('ja') });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ja');

  useEffect(() => {
    const saved = localStorage.getItem('riq_lang') as Lang | null;
    if (saved && ['ja', 'en', 'zh'].includes(saved)) setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem('riq_lang', l);
  }

  return <Ctx.Provider value={{ lang, setLang, t: createT(lang) }}>{children}</Ctx.Provider>;
}

export function useLang() { return useContext(Ctx); }

export function LangSwitcher() {
  const { lang, setLang } = useLang();
  const langs: Lang[] = ['ja', 'en', 'zh'];
  return (
    <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
      {langs.map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
          style={lang === l
            ? { background: 'var(--accent)', color: '#fff' }
            : { color: 'var(--muted)' }
          }
        >
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
