import { useState, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Circle, Users } from 'lucide-react'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useGetVendorJobsQuery, useGetVendorCrewQuery, useAssignWorkforceMutation } from '../../../store/api/workforceApi.js'

export function VendorJobAssignPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const { data: jobsData, isLoading: loadingJobs } = useGetVendorJobsQuery()
  const { data: crewData, isLoading: loadingCrew } = useGetVendorCrewQuery()
  const [assignWorkforce, { isLoading: submitting }] = useAssignWorkforceMutation()

  const [selectedWorkers, setSelectedWorkers] = useState({}) // { [labourId]: categoryId }
  const [workerRates, setWorkerRates] = useState({}) // { [labourId]: number }

  const allocation = (jobsData?.allocations ?? []).find((a) => String(a._id) === String(id))
  const req = allocation?.requestId
  const crew = crewData?.crew ?? []

  const requestedSkills = useMemo(() => {
    if (!req?.lines) return []
    return req.lines.map(line => ({
      categoryId: line.categoryId?._id || line.categoryId,
      categoryName: line.categoryId?.name || 'Unknown Skill',
      quantity: line.quantity
    }))
  }, [req])

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
    <div className="space-y-6 pb-24">
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
          if (!skill.categoryId) return false;
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
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {assignedCount} / {skill.quantity} Assigned
              </div>
            </div>

            {eligibleCrew.length === 0 ? (
              <AppSurface className="bg-slate-50 border-dashed border-slate-200">
                <p className="text-xs text-slate-500 text-center py-4">No matching workers in your crew.</p>
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
                              <p className="text-sm font-bold text-slate-900 truncate">{worker.fullName || 'Worker'}</p>
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
    </div>
  )
}
