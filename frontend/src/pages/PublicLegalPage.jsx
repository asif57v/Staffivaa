import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Clock, FileText, AlertTriangle, Sparkles } from 'lucide-react'
import { useGetPublicLegalPageBySlugQuery } from '../store/api/legalApi.js'

export function PublicLegalPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useGetPublicLegalPageBySlugQuery(slug)
  const page = data?.data

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/20 active:scale-95 cursor-pointer border-0"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-extrabold tracking-tight">Staffivaa Legal & Trust</span>
          </div>

          <div className="w-16" />
        </div>
      </header>

      {/* ── Main Content Container ────────────────────────────────────────── */}
      <main className="flex-1 py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {isLoading ? (
            <div className="rounded-3xl bg-white p-8 border border-slate-100 shadow-sm space-y-4 animate-pulse">
              <div className="h-8 bg-slate-100 rounded-xl w-1/3" />
              <div className="h-4 bg-slate-100 rounded-lg w-1/4" />
              <div className="space-y-2 pt-4">
                <div className="h-4 bg-slate-100 rounded w-full" />
                <div className="h-4 bg-slate-100 rounded w-5/6" />
                <div className="h-4 bg-slate-100 rounded w-4/6" />
              </div>
            </div>
          ) : isError || !page ? (
            <div className="rounded-3xl bg-white p-10 text-center border border-slate-100 shadow-sm space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">Document Unavailable</h2>
              <p className="text-xs font-medium text-slate-500 max-w-md mx-auto">
                The requested legal document is currently unavailable or under revision. Please check back later.
              </p>
              <button
                onClick={() => navigate('/')}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-md transition hover:bg-amber-600"
              >
                Go to Home
              </button>
            </div>
          ) : (
            <article className="overflow-hidden rounded-3xl bg-white border border-slate-100 shadow-sm">
              {/* Document Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 text-white relative overflow-hidden">
                <div className="relative z-10 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-500/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-amber-300 border border-amber-500/30">
                      Official Legal Document
                    </span>
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-slate-300">
                      {page.version || 'v1.0'}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{page.title}</h1>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-amber-400" /> Last Updated:{' '}
                      {new Date(page.updatedAt || page.lastUpdated).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Document HTML Body */}
              <div className="p-6 sm:p-10 space-y-4 text-xs leading-relaxed text-slate-700 font-normal">
                <div
                  className="prose prose-slate max-w-none space-y-4"
                  dangerouslySetInnerHTML={{ __html: page.content }}
                />
              </div>

              {/* Document Footer Disclaimer */}
              <div className="bg-slate-50 border-t border-slate-100 p-6 text-center text-[11px] text-slate-400 font-medium">
                © {new Date().getFullYear()} Staffivaa Workforce OS. All rights reserved. Registered Official Policy.
              </div>
            </article>
          )}
        </div>
      </main>
    </div>
  )
}
