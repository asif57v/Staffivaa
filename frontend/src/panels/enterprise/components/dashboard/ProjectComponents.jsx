import React from 'react'
import { Building2, TrendingUp, AlertTriangle, Briefcase, Users, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useGetEnterpriseJobsQuery } from '../../../../store/api/enterpriseApi.js'

export function ActiveProjectsList() {
  const { data: jobsData, isLoading } = useGetEnterpriseJobsQuery()
  const jobs = jobsData?.data || []

  return (
    <div className="bg-white p-5 sm:p-6 rounded-[24px] border border-[#E5E7EB]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[16px] font-extrabold text-[#111827] flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#FFC107]" /> Active Jobs
        </h2>
        <Link
          to="/enterprise/jobs"
          className="text-[12px] font-bold text-slate-500 hover:text-[#111827] transition-colors"
        >
          View All
        </Link>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-[16px] border border-[#E5E7EB] animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
          <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
            <Briefcase className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-slate-800">No jobs right now</p>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Create a job requirement to start hiring.
            </p>
          </div>
          <Link
            to="/enterprise/jobs/new"
            className="mt-2 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold px-4 py-2 rounded-xl transition-colors"
          >
            + Create Requirement
          </Link>
        </div>
      )}

      {/* Real Jobs List */}
      {!isLoading && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => {
            const statusConfig = {
              approved:  { label: 'Approved',  cls: 'bg-emerald-50 text-emerald-600' },
              pending:   { label: 'Pending',   cls: 'bg-amber-50 text-amber-600' },
              rejected:  { label: 'Rejected',  cls: 'bg-rose-50 text-rose-600' },
              closed:    { label: 'Closed',    cls: 'bg-slate-100 text-slate-500' },
            }
            const st = statusConfig[job.status] || { label: job.status, cls: 'bg-slate-100 text-slate-500' }
            const categoryName = job.categoryId?.name || job.department || 'General'

            return (
              <Link
                key={job._id}
                to={`/enterprise/jobs/${job._id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[16px] border border-[#E5E7EB] hover:bg-[#F8FAFC] hover:border-indigo-100 transition-all gap-3 group"
              >
                <div className="min-w-0">
                  <h4 className="text-[14px] font-bold text-[#111827] leading-tight truncate group-hover:text-indigo-700 transition-colors">
                    {job.jobTitle}
                  </h4>
                  <p className="text-[12px] font-medium text-slate-500 mt-0.5">{categoryName}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Vacancies */}
                  <div className="text-right">
                    <p className="text-[14px] font-black text-[#111827]">{job.numberOfWorkers || 1}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vacancies</p>
                  </div>
                  {/* Salary */}
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-slate-700">
                      ₹{Number(job.salary).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      /{job.salaryType || 'month'}
                    </p>
                  </div>
                  {/* Status Badge */}
                  <div className={`px-3 py-1 rounded-full text-[11px] font-bold ${st.cls}`}>
                    {st.label}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ProjectPerformance() {
  const { data: jobsData } = useGetEnterpriseJobsQuery()
  const jobs = jobsData?.data || []

  const approved  = jobs.filter((j) => j.status === 'approved').length
  const pending   = jobs.filter((j) => j.status === 'pending').length
  const total     = jobs.length || 1

  const approvedPct = Math.round((approved / total) * 100)
  const pendingPct  = Math.round((pending  / total) * 100)

  const totalVacancies = jobs.reduce((sum, j) => sum + (j.numberOfWorkers || 1), 0)

  return (
    <div className="bg-white p-5 rounded-[24px] border border-[#E5E7EB] flex flex-col justify-between">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-[18px] h-[18px] text-slate-400" />
        <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest">
          Job Performance
        </h3>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
          <Clock className="w-7 h-7 text-slate-300" />
          <p className="text-[12px] font-bold text-slate-400">No data yet</p>
          <p className="text-[11px] text-slate-400">Post a job to see performance stats.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {/* Approval Rate */}
            <div>
              <div className="flex justify-between text-[12px] font-bold mb-1">
                <span className="text-[#111827]">Approval Rate</span>
                <span className="text-slate-500">{approvedPct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${approvedPct}%` }}
                />
              </div>
            </div>

            {/* Pending Rate */}
            <div>
              <div className="flex justify-between text-[12px] font-bold mb-1">
                <span className="text-[#111827]">Pending Review</span>
                <span className="text-slate-500">{pendingPct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div
                  className="bg-amber-400 h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${pendingPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Summary Footer */}
          <div className="mt-5 p-3 rounded-[12px] bg-indigo-50 border border-indigo-100 flex items-start gap-2">
            <Users className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-indigo-700 leading-snug">
              {totalVacancies} total vacancies across {total} job{total !== 1 ? 's' : ''}.
              {pending > 0
                ? ` ${pending} job${pending !== 1 ? 's' : ''} awaiting admin approval.`
                : ' All jobs are approved.'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
