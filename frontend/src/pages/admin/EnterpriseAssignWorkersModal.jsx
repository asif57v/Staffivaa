import { useEffect, useState } from 'react'
import { X, Search, UserPlus, Users, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useGetDirectRequestMatchingWorkersQuery,
  useAssignDirectRequestWorkersMutation,
} from '../../store/api/adminEnterpriseApi.js'

const AVAILABILITY_BADGE = {
  available: 'bg-emerald-100 text-emerald-800',
  busy: 'bg-amber-100 text-amber-800',
  offline: 'bg-slate-100 text-slate-600',
}

const emptyExternal = () => ({ name: '', phone: '' })

/** Assign registered (skill-matched) and/or unregistered workers to an enterprise daily/hourly request */
export function EnterpriseAssignWorkersModal({ job, onClose }) {
  const [tab, setTab] = useState('registered')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [externalRows, setExternalRows] = useState([emptyExternal()])

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isFetching } = useGetDirectRequestMatchingWorkersQuery({ id: job._id, search, showAll })
  const [assignWorkers, { isLoading: assigning }] = useAssignDirectRequestWorkersMutation()

  const workers = data?.data ?? []
  const alreadyAssigned = job.assignedWorkers?.length || 0
  const remaining = Math.max(0, (job.numberOfWorkers || 0) - alreadyAssigned)
  const filledExternal = externalRows.filter((r) => r.name.trim() || r.phone.trim())
  const totalPicked = selectedIds.length + filledExternal.length

  const toggleWorker = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length + filledExternal.length >= remaining) {
        toast.error(`Only ${remaining} more worker(s) needed for this request`)
        return prev
      }
      return [...prev, id]
    })
  }

  const updateExternal = (idx, field, value) => {
    setExternalRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  const handleAssign = async () => {
    for (const r of filledExternal) {
      if (!r.name.trim() || r.phone.replace(/\D/g, '').length !== 10) {
        toast.error('Each unregistered worker needs a name and a 10-digit mobile number')
        setTab('external')
        return
      }
    }
    if (totalPicked === 0) {
      toast.error('Select or add at least one worker')
      return
    }
    try {
      const res = await assignWorkers({
        id: job._id,
        workerIds: selectedIds,
        externalWorkers: filledExternal.map((r) => ({ name: r.name.trim(), phone: r.phone.trim() })),
      }).unwrap()
      toast.success(res?.message || 'Workers assigned')
      onClose()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to assign workers')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-900">Assign workers</h3>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              {job.jobTitle} · {job.categoryId?.name || 'General'} · {alreadyAssigned} of {job.numberOfWorkers} assigned
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-4">
          {[
            { key: 'registered', label: 'Registered workers', icon: Users },
            { key: 'external', label: 'Add unregistered worker', icon: UserPlus },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition ${
                tab === key ? 'bg-brand text-white ring-brand' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand/30'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'registered' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search by name or phone"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:bg-white"
                  />
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                  Show all workers (not only matched skill)
                </label>
              </div>

              {isFetching && <p className="py-6 text-center text-xs text-slate-500">Loading workers…</p>}

              {!isFetching && workers.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-500">
                  No {showAll ? '' : 'skill-matched '}workers found. Try “Show all workers” or add an unregistered worker.
                </p>
              )}

              {!isFetching && (
                <ul className="space-y-2">
                  {workers.map((w) => {
                    const checked = selectedIds.includes(w._id)
                    const availability = w.labourProfile?.availabilityStatus || 'available'
                    const skills = [
                      ...(w.labourProfile?.categoryIds || []).map((c) => c?.name).filter(Boolean),
                      ...(w.labourProfile?.skills || []),
                    ]
                    return (
                      <li key={w._id}>
                        <label
                          className={`flex items-center gap-3 rounded-xl p-3 ring-1 transition ${
                            w.isAssigned
                              ? 'cursor-not-allowed bg-slate-50 opacity-60 ring-slate-100'
                              : checked
                              ? 'cursor-pointer bg-brand/5 ring-brand/40'
                              : 'cursor-pointer bg-white ring-slate-100 hover:ring-brand/20'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={w.isAssigned}
                            checked={checked || w.isAssigned}
                            onChange={() => toggleWorker(w._id)}
                          />
                          {w.profileImageUrl ? (
                            <img src={w.profileImageUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-600">
                              {(w.fullName || '?').slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {w.fullName || 'Unnamed worker'}
                              {w.isAssigned && <span className="ml-2 text-[10px] font-bold text-emerald-700">Already assigned</span>}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {w.phone}
                              {skills.length > 0 && ` · ${skills.slice(0, 3).join(', ')}`}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${AVAILABILITY_BADGE[availability] || AVAILABILITY_BADGE.offline}`}>
                              {availability}
                            </span>
                            {w.labourProfile?.kycStatus === 'approved' && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-700">
                                <CheckCircle2 className="h-3 w-3" /> KYC
                              </span>
                            )}
                          </div>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                For workers who are not on the Staffivaa worker app. Name and mobile number are shared with the enterprise.
              </p>
              {externalRows.map((row, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => updateExternal(idx, 'name', e.target.value)}
                    placeholder="Worker name"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand focus:bg-white"
                  />
                  <input
                    value={row.phone}
                    onChange={(e) => updateExternal(idx, 'phone', e.target.value.replace(/[^\d+\s]/g, ''))}
                    placeholder="10-digit mobile"
                    inputMode="tel"
                    maxLength={14}
                    className="w-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setExternalRows((rows) => (rows.length === 1 ? [emptyExternal()] : rows.filter((_, i) => i !== idx)))}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={selectedIds.length + externalRows.length >= remaining}
                onClick={() => setExternalRows((rows) => [...rows, emptyExternal()])}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-brand ring-1 ring-brand/30 hover:bg-brand/5 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Add another
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
          <p className="text-xs font-semibold text-slate-600">
            {totalPicked} selected · {remaining} slot(s) open
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={assigning || totalPicked === 0}
              onClick={handleAssign}
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {assigning ? 'Assigning…' : `Assign ${totalPicked || ''} Worker(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
