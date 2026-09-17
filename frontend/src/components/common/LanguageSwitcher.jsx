import React from 'react'
import { Languages, Check } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext.jsx'

export function LanguageSwitcher({ className = '' }) {
  const { lang, setLanguage } = useLanguage()

  return (
    <div className={`rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/15">
          <Languages className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Language Settings / भाषा चुनें</h3>
          <p className="text-xs font-extrabold text-slate-800">
            {lang === 'hi' ? 'वर्तमान भाषा: हिंदी' : 'Current Language: English'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`flex items-center justify-between rounded-xl px-3.5 py-3 text-xs font-bold transition border ${
            lang === 'en'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-1 ring-slate-900'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="text-base leading-none">🇬🇧</span>
            <span>English</span>
          </span>
          {lang === 'en' && <Check className="h-4 w-4 text-amber-400" />}
        </button>

        <button
          type="button"
          onClick={() => setLanguage('hi')}
          className={`flex items-center justify-between rounded-xl px-3.5 py-3 text-xs font-bold transition border ${
            lang === 'hi'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-1 ring-slate-900'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="text-base leading-none">🇮🇳</span>
            <span>हिंदी (Hindi)</span>
          </span>
          {lang === 'hi' && <Check className="h-4 w-4 text-amber-400" />}
        </button>
      </div>
    </div>
  )
}
