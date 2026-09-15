import { useState, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Circle, Users, Plus, UserPlus, X, Check, Phone } from 'lucide-react'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { 
  useGetVendorJobsQuery, 
  useGetVendorCrewQuery, 
  useAssignWorkforceMutation,
  useAddVendorWorkerMutation
} from '../../../store/api/workforceApi.js'

export function VendorJobAssignPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const { data: jobsData, isLoading: loadingJobs } = useGetVendorJobsQuery()
  const { data: crewData, isLoading: loadingCrew } = useGetVendorCrewQuery()
  const [assignWorkforce, { isLoading: submitting }] = useAssignWorkforceMutation()
  const [addVendorWorker, { isLoading: addingWorker }] = useAddVendorWorkerMutation()

  const [selectedWorkers, setSelectedWorkers] = useState({}) // { [labourId]: categoryId }
  const [workerRates, setWorkerRates] = useState({}) // { [labourId]: number }
  const [localAddedWorkers, setLocalAddedWorkers] = useState([])

  // Add Worker Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newWorkerForm, setNewWorkerForm] = useState({
    fullName: '',
    phone: '',
    categoryId: '',
    perDayRate: ''
  })
  const [addWorkerError, setAddWorkerError] = useState('')
  const [toastMessage, setToastMessage] = useState('')

  const allocation = (jobsData?.allocations ?? []).find((a) => String(a._id) === String(id))
  const req = allocation?.requestId

  const requestedSkills = useMemo(() => {
    if (!req?.lines) return []
    return req.lines.map(line => ({
      categoryId: line.categoryId?._id || line.categoryId,
      categoryName: line.categoryId?.name || 'Unknown Skill',
      quantity: line.quantity
    }))
  }, [req])

  // Combine fetched crew with newly created local crew
  const crew = useMemo(() => {
    const combined = [...(crewData?.crew ?? [])]
    for (const nw of localAddedWorkers) {
      const idx = combined.findIndex(w => String(w._id) === String(nw._id))
      if (idx >= 0) {
        combined[idx] = { ...combined[idx], ...nw }
      } else {
        combined.unshift(nw)
      }
    }
    return combined
  }, [crewData, localAddedWorkers])

  const handleToggleWorker = (labourId, categoryId) => {
    setSelectedWorkers(prev => {
      const next = { ...prev }
      if (next[labourId] === categoryId) {
        delete next[labourId]
        setWorkerRates(r => {
          const nextRates = { ...r }
          delete nextRates[labourId]
          return nextRates
        })
      } else {
        next[labourId] = categoryId
      }
      return next
    })
  }

  const handleRateChange = (labourId, value) => {
    setWorkerRates(prev => ({ ...prev, [labourId]: value }))
  }

  const handleOpenAddModal = (defaultCategoryId = '') => {
    setNewWorkerForm({
      fullName: '',
      phone: '',
      categoryId: defaultCategoryId || requestedSkills[0]?.categoryId || '',
      perDayRate: ''
    })
    setAddWorkerError('')
    setIsAddModalOpen(true)
  }

  const handleCreateWorker = async (e) => {
    e.preventDefault()
    setAddWorkerError('')

    const fullName = newWorkerForm.fullName.trim()
    const phone = newWorkerForm.phone.trim()
    const categoryId = newWorkerForm.categoryId
    const perDayRate = newWorkerForm.perDayRate.trim()

    if (!fullName) {
      setAddWorkerError('Worker name is required')
      return
    }
    if (phone.length !== 10) {
      setAddWorkerError('Enter a valid 10-digit mobile number')
      return
    }
    if (!categoryId) {
      setAddWorkerError('Please select a skill category')
      return
    }

    try {
      const res = await addVendorWorker({
        fullName,
        phone,
        categoryId
      }).unwrap()

      const createdWorker = res?.worker || res?.data?.worker

      if (createdWorker?._id) {
        const categoryObj = requestedSkills.find(s => String(s.categoryId) === String(categoryId))
        const categoryName = categoryObj?.categoryName || 'Skill'

        const normalizedWorker = {
          ...createdWorker,
          labourProfile: {
            ...createdWorker.labourProfile,
            categoryIds: [
              ...(createdWorker.labourProfile?.categoryIds || []),
              { _id: categoryId, name: categoryName }
            ]
          }
        }

        setLocalAddedWorkers(prev => [
          normalizedWorker,
          ...prev.filter(w => String(w._id) !== String(createdWorker._id))
        ])

        // Auto-select for this job
        setSelectedWorkers(prev => ({
          ...prev,
          [createdWorker._id]: categoryId
        }))

        // Prefill daily rate if provided
        if (perDayRate && Number(perDayRate) > 0) {
          setWorkerRates(prev => ({
            ...prev,
            [createdWorker._id]: perDayRate
          }))
        }

        setIsAddModalOpen(false)
        setToastMessage(`${fullName} added and assigned to ${categoryName}!`)
        setTimeout(() => setToastMessage(''), 3500)
      }
    } catch (err) {
      setAddWorkerError(err?.data?.message || err?.message || 'Failed to add worker')
    }
  }

  const handleAssign = async () => {
    try {
      const assignments = Object.entries(selectedWorkers).map(([labourId, categoryId]) => ({
        labourId,
        categoryId,
        perDayRate: Number(workerRates[labourId])
      }))
      
      await assignWorkforce({ id, assignments }).unwrap()
      navigate(`/vendor/jobs/${id}`)
    } catch (err) {
      console.error('Failed to assign workforce:', err)
      alert(err?.data?.message || 'Failed to assign workforce')
    }
  }

  if (loadingJobs || loadingCrew) {
    return (
      <AppSurface>
        <p className="text-sm text-slate-500">Loading...</p>
      </AppSurface>
    )
  }

  if (!allocation) {
    return (
      <AppSurface>
        <p className="text-sm font-semibold text-rose-800">Job not found.</p>
        <Link to="/vendor/jobs" className="mt-3 inline-block text-sm font-bold text-brand">Back</Link>
      </AppSurface>
    )
  }

  // Group selected counts by category
  const assignedCounts = {}
  Object.values(selectedWorkers).forEach(catId => {
    assignedCounts[catId] = (assignedCounts[catId] || 0) + 1
  })

  // Check if all requested quotas are met
  const isQuotaMet = requestedSkills.every(skill => 
    (assignedCounts[skill.categoryId] || 0) === skill.quantity
  )

  // Check if all selected workers have a valid rate > 0
  const allRatesValid = Object.keys(selectedWorkers).every(
    labourId => Number(workerRates[labourId]) > 0
  )

  const isReadyToSubmit = isQuotaMet && allRatesValid

  return (
    <div className="space-y-6 pb-24 relative">
      {/* Success Toast */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3 text-slate-900 bg-amber-400 font-bold text-sm shadow-xl transition-all duration-300 border border-amber-500/30">
          <Check className="h-4 w-4 shrink-0 text-slate-950 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Link to={`/vendor/jobs/${id}`} className="inline-flex items-center gap-2 text-sm font-bold text-brand">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Assign Workforce</h2>
          <p className="text-xs font-semibold text-slate-500">{req.reference} • {req.locationText}</p>
        </div>
      </div>

      {requestedSkills.map(skill => {
        const assignedCount = assignedCounts[skill.categoryId] || 0
        const isComplete = assignedCount === skill.quantity
        
        // Filter crew that have this skill in their labourProfile
        const eligibleCrew = crew.filter(w => {
          if (!skill.categoryId) return false
          return w.labourProfile?.categoryIds?.some(cat => 
            String(cat?._id || cat) === String(skill.categoryId)
          )
        })

        return (
          <div key={skill.categoryId} className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{skill.categoryName}</h3>
                <p className="text-xs text-slate-500">
                  Select {skill.quantity} worker{skill.quantity > 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAddModal(skill.categoryId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 rounded-xl transition-all border border-amber-300 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-900" />
                  <span>Add Worker</span>
                </button>
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {assignedCount} / {skill.quantity} Assigned
                </div>
              </div>
            </div>

            {eligibleCrew.length === 0 ? (
              <AppSurface className="bg-slate-50 border-dashed border-slate-200 p-6 text-center">
                <Users className="h-9 w-9 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No {skill.categoryName} in your registered crew</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Add an external worker by Name & Mobile Number — they don&apos;t need to be registered on the app beforehand.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal(skill.categoryId)}
                  className="mt-3.5 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold text-slate-900 bg-[#FFC107] hover:bg-amber-400 active:bg-amber-500 rounded-xl shadow-sm transition-all"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>+ Add {skill.categoryName} Directly</span>
                </button>
              </AppSurface>
            ) : (
              <ul className="space-y-2">
                {eligibleCrew.map(worker => {
                  const isSelectedForThis = selectedWorkers[worker._id] === skill.categoryId
                  const isSelectedForOther = selectedWorkers[worker._id] && selectedWorkers[worker._id] !== skill.categoryId

                  return (
                    <li key={worker._id}>
                      <button 
                        type="button"
                        disabled={isSelectedForOther || (!isSelectedForThis && assignedCount >= skill.quantity)}
                        onClick={() => handleToggleWorker(worker._id, skill.categoryId)}
                        className={`w-full text-left transition-all ${isSelectedForOther ? 'opacity-50 grayscale' : (!isSelectedForThis && assignedCount >= skill.quantity) ? 'opacity-50' : ''}`}
                      >
                        <AppSurface className={`flex flex-col gap-3 p-3 transition-colors ${isSelectedForThis ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'hover:border-slate-300'}`}>
                          <div className="flex items-center gap-3">
                            {isSelectedForThis ? (
                              <CheckCircle2 className="h-5 w-5 text-brand flex-shrink-0" />
                            ) : (
                              <Circle className="h-5 w-5 text-slate-300 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-slate-900 truncate">{worker.fullName || 'Worker'}</p>
                                {worker.labourProfile?.isExternal && (
                                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 border border-amber-200">
                                    Direct Added
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 truncate">{worker.phone}</p>
                            </div>
                            <div className="flex-shrink-0">
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                                <Users className="h-3 w-3" />
                                {worker.labourProfile?.availabilityStatus || 'Available'}
                              </span>
                            </div>
                          </div>
                          
                          {isSelectedForThis && (
                            <div className="pl-8 pt-2 border-t border-brand/10">
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Per Day Rate (₹)</label>
                              <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                  <span className="text-slate-500 font-medium">₹</span>
                                </div>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="Enter daily wage"
                                  value={workerRates[worker._id] || ''}
                                  onChange={(e) => handleRateChange(worker._id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="block w-full rounded-xl border-0 py-2.5 pl-7 pr-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand bg-white"
                                />
                              </div>
                              {(!workerRates[worker._id] || Number(workerRates[worker._id]) <= 0) && (
                                <p className="mt-1 text-[10px] font-medium text-rose-500">Rate is required and must be greater than 0</p>
                              )}
                            </div>
                          )}
                        </AppSurface>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}

      <div className="mt-8">
        <AppPrimaryButton 
          type="button" 
          className="w-full bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300"
          disabled={!isReadyToSubmit || submitting}
          loading={submitting}
          onClick={handleAssign}
        >
          Assign Selected Workers
        </AppPrimaryButton>
      </div>

      {/* Add Worker Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <UserPlus className="h-5 w-5 text-slate-900" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Add Worker to Crew</h3>
                  <p className="text-[11px] font-semibold text-slate-500">Add external worker & auto-assign</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWorker} className="p-6 space-y-4">
              {addWorkerError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {addWorkerError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Worker Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newWorkerForm.fullName}
                  onChange={(e) => setNewWorkerForm(f => ({ ...f, fullName: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-xs font-bold text-slate-400">
                    +91
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={newWorkerForm.phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setNewWorkerForm(f => ({ ...f, phone: digits }))
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-14 pr-4 py-3 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-brand/40 focus:border-brand transition font-mono tracking-wide"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className={`text-[11px] font-bold ${newWorkerForm.phone.length === 10 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {newWorkerForm.phone.length}/10
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Worker does not need to be registered on the app beforehand
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Skill / Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newWorkerForm.categoryId}
                  onChange={(e) => setNewWorkerForm(f => ({ ...f, categoryId: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                >
                  {requestedSkills.map(sk => (
                    <option key={sk.categoryId} value={sk.categoryId}>
                      {sk.categoryName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Daily Wage Rate (₹/day)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 font-bold text-slate-400">
                    ₹
                  </div>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 500"
                    value={newWorkerForm.perDayRate}
                    onChange={(e) => setNewWorkerForm(f => ({ ...f, perDayRate: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-9 pr-4 py-3 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Will be automatically prefilled for this assignment
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <AppPrimaryButton
                  type="submit"
                  loading={addingWorker}
                  disabled={addingWorker || !newWorkerForm.fullName.trim() || newWorkerForm.phone.length !== 10}
                  className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                >
                  Add & Assign
                </AppPrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
