import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, ArrowRight, UserCheck, CalendarDays } from 'lucide-react'

export function RecruitmentPipeline({ pipeline = {} }) {
  const pipelineData = [
    { stage: 'Applied', count: pipeline.appliedCount || 0, color: 'bg-blue-500' },
    { stage: 'Shortlisted', count: pipeline.shortlistedCount || 0, color: 'bg-amber-500' },
    { stage: 'Interview', count: pipeline.interviewScheduledCount || 0, color: 'bg-purple-500' },
    { stage: 'Offered', count: pipeline.offerSentCount || 0, color: 'bg-emerald-500' },
  ]
  const total = Math.max(1, pipelineData.reduce((acc, p) => acc + p.count, 0))

  return (
    <div className="bg-white p-5 rounded-[24px] border border-[#E5E7EB]">
      <div className="flex items-center gap-2 mb-6">
        <UserPlus className="w-[18px] h-[18px] text-slate-400" />
        <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest">Recruitment Pipeline</h3>
      </div>
      <div className="flex flex-col gap-3">
        {pipelineData.map((item) => (
          <div key={item.stage} className="flex items-center gap-4">
            <span className="w-20 text-[11px] font-bold text-slate-500">{item.stage}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${Math.max((item.count / total) * 100, item.count > 0 ? 8 : 0)}%` }}></div>
            </div>
            <span className="w-8 text-right text-[12px] font-extrabold text-[#111827]">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PendingApprovalsList({ applications = [] }) {
  const navigate = useNavigate()
  const displayApps = applications.slice(0, 4)

  return (
    <div className="bg-white p-5 sm:p-6 rounded-[24px] border border-[#E5E7EB]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[16px] font-extrabold text-[#111827]">Recent Candidate Applications</h2>
        <Link to="/enterprise/applications" className="text-[12px] font-bold text-slate-500 hover:text-slate-900 transition-colors">View All</Link>
      </div>
      {displayApps.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400 font-medium">No recent applications submitted yet.</div>
      ) : (
        <div className="space-y-3">
          {displayApps.map((app) => {
            const workerName = app.workerId?.fullName || 'Worker Applicant'
            const avatar = app.workerId?.profileImageUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${workerName}`
            const jobRole = app.jobId?.jobTitle || 'Requirement'

            return (
              <div key={app._id} className="flex items-center justify-between p-3 rounded-[16px] border border-[#E5E7EB] hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                    <img src={avatar} alt={workerName} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#111827] leading-tight">{workerName}</p>
                    <p className="text-[12px] font-medium text-slate-500 mt-0.5">{jobRole} • <span className="font-extrabold text-indigo-600 capitalize">{app.status?.replace(/_/g, ' ')}</span></p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/enterprise/applications')}
                  className="bg-[#FFC107] hover:bg-[#e0a800] text-[#111827] text-[12px] font-bold px-4 py-2 rounded-[10px] transition-colors active:scale-95 cursor-pointer"
                >
                  Review
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function UpcomingJoining({ upcomingList = [] }) {
  const count = upcomingList.length
  return (
    <div className="bg-white p-5 rounded-[24px] border border-[#E5E7EB] flex flex-col justify-between">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-[18px] h-[18px] text-slate-400" />
        <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest">Upcoming Joining</h3>
      </div>
      <div>
        <div className="text-[32px] font-black text-[#111827] tracking-tight leading-none">{count}</div>
        <p className="text-[13px] font-medium text-slate-500 mt-1">Candidates awaiting joining / payment</p>
      </div>
      <div className="flex -space-x-3 mt-4">
        {upcomingList.slice(0, 4).map((item, i) => (
          <img
            key={item._id || i}
            src={item.workerId?.profileImageUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=w${i}`}
            className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 object-cover"
          />
        ))}
        {count > 4 && (
          <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
            +{count - 4}
          </div>
        )}
      </div>
    </div>
  )
}
