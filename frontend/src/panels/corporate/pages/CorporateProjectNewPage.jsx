import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AppPrimaryButton } from '../../../components/app/AppPrimaryButton.jsx'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useCreateCorporateProjectMutation } from '../../../store/api/workforceApi.js'

const inputClass =
  'w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35'

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  )
}

export function CorporateProjectNewPage() {
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const [createProject, { isLoading }] = useCreateCorporateProjectMutation()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Project name is required')
      return
    }
    if (startDate && startDate < today) {
      setError('Start date cannot be in the past.')
      return
    }
    const minEnd = startDate || today
    if (endDate && endDate < minEnd) {
      setError('End date cannot be before the start date.')
      return
    }
    try {
      const body = {
        name: name.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        notes: notes.trim() || undefined,
      }
      const res = await createProject(body).unwrap()
      const id = res?.project?._id
      navigate(id ? `/corporate/projects/${id}` : '/corporate/projects')
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Could not create project')
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <Link
        to="/corporate/projects"
        className="inline-flex items-center gap-2 text-sm font-bold text-brand"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to projects
      </Link>

      <AppSurface>
        <h2 className="text-lg font-extrabold text-slate-900">New project</h2>
        <p className="mt-1 text-sm text-slate-600">Add a project.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Field label="Project name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input 
                type="date" 
                min={today} 
                className={inputClass} 
                value={startDate} 
                onChange={(e) => {
                  const val = e.target.value
                  if (val && val < today) {
                    setStartDate(today)
                  } else {
                    setStartDate(val)
                    if (endDate && val && endDate < val) {
                      setEndDate(val)
                    }
                  }
                }} 
              />
            </Field>
            <Field label="End date">
              <input 
                type="date" 
                min={startDate || today} 
                className={inputClass} 
                value={endDate} 
                onChange={(e) => {
                  const val = e.target.value
                  const minAllowed = startDate || today
                  if (val && val < minAllowed) {
                    setEndDate(minAllowed)
                  } else {
                    setEndDate(val)
                  }
                }} 
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
          <AppPrimaryButton type="submit" className="w-full" loading={isLoading}>
            Create project
          </AppPrimaryButton>
        </form>
      </AppSurface>
    </div>
  )
}

