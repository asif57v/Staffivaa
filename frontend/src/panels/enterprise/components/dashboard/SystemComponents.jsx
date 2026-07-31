import React from 'react'
import { CheckCircle2, FileText, Bell, AlertTriangle, Download, FileSpreadsheet, Users, Briefcase } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ActivityTimeline({ recentApplications = [] }) {
  const iconMap = {
    applied: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
    shortlisted: { icon: CheckCircle2, color: 'text-amber-500', bg: 'bg-amber-50' },
    interview_scheduled: { icon: Bell, color: 'text-purple-500', bg: 'bg-purple-50' },
    offered: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    joining_activated: { icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    joined: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    waiting_for_joining_payment: { icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50' },
  }

  const statusLabel = {
    applied: 'New Application Received',
    shortlisted: 'Candidate Shortlisted',
    interview_scheduled: 'Interview Scheduled',
    offered: 'Offer Letter Sent',
    joining_activated: 'Joining Payment Confirmed',
    joined: 'Candidate Joined',
    waiting_for_joining_payment: 'Awaiting Joining Payment',
  }

  return (
    <div className="bg-white p-5 sm:p-6 rounded-[24px] border border-[#E5E7EB]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[16px] font-extrabold text-[#111827]">Recent Activity</h2>
        <Link to="/enterprise/applications" className="text-[12px] font-bold text-slate-500 hover:text-slate-900 transition-colors">View All</Link>
      </div>
      {recentApplications.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400 font-medium">No recent activity yet. Start hiring to see updates here.</div>
      ) : (
        <div className="space-y-6">
          {recentApplications.map((app, i) => {
            const cfg = iconMap[app.status] || { icon: FileText, color: 'text-slate-400', bg: 'bg-slate-50' }
            const IconComp = cfg.icon
            const workerName = app.workerId?.fullName || 'A Candidate'
            const jobTitle = app.jobId?.jobTitle || 'a Requirement'
            const label = statusLabel[app.status] || app.status?.replace(/_/g, ' ')
            const timeAgo = new Date(app.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

            return (
              <div key={app._id} className="flex gap-4 relative">
                {i !== recentApplications.length - 1 && (
                  <div className="absolute left-4 top-8 bottom-[-24px] w-px bg-slate-100" />
                )}
                <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center ${cfg.bg} z-10`}>
                  <IconComp className={`w-4 h-4 ${cfg.color}`} strokeWidth={2.5} />
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-[14px] font-extrabold text-[#111827]">{label}</h4>
                    <span className="text-[11px] font-bold text-slate-400">{timeAgo}</span>
                  </div>
                  <p className="text-[12.5px] font-medium text-slate-500 leading-relaxed max-w-[90%]">
                    {workerName} — {jobTitle}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function NotificationCenter({ kpis = {} }) {
  const pendingCount = kpis.pendingInvoicesCount || 0
  const interviewCount = kpis.pipeline?.interviewScheduledCount || 0

  const alerts = []
  if (pendingCount > 0) {
    alerts.push({ id: 'inv', text: `${pendingCount} joining invoice(s) are pending payment. Clear to activate hiring.`, priority: 'high' })
  }
  if (interviewCount > 0) {
    alerts.push({ id: 'int', text: `${interviewCount} interview(s) have been scheduled. Review candidate profiles.`, priority: 'medium' })
  }
  if (alerts.length === 0) {
    alerts.push({ id: 'ok', text: 'All systems clear. No critical actions required right now.', priority: 'low' })
  }

  return (
    <div className="bg-white p-5 rounded-[24px] border border-[#E5E7EB]">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Bell className="w-[18px] h-[18px] text-slate-400" />
          <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest">Smart Alerts</h3>
        </div>
        {alerts.some(a => a.priority === 'high') && (
          <span className="bg-rose-50 text-rose-500 text-[10px] font-bold px-2 py-0.5 rounded-full">Action Needed</span>
        )}
      </div>
      <div className="space-y-3">
        {alerts.map((n) => (
          <div key={n.id} className="flex items-start gap-3 p-3 rounded-[12px] bg-slate-50 border border-slate-100">
            {n.priority === 'high' ? (
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            ) : n.priority === 'medium' ? (
              <Bell className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-[12px] font-bold text-[#111827] leading-snug">{n.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RecentReports() {
  return (
    <div className="bg-white p-5 rounded-[24px] border border-[#E5E7EB] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-[18px] h-[18px] text-slate-400" />
          <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest">Quick Links</h3>
        </div>
      </div>
      <div className="space-y-3">
        <Link to="/enterprise/applications" className="flex items-center justify-between hover:bg-slate-50 p-2 rounded-xl transition-colors">
          <div>
            <p className="text-[13px] font-bold text-[#111827]">Candidate Applications</p>
            <p className="text-[11px] font-medium text-slate-500">Review & manage pipeline</p>
          </div>
          <FileText className="w-4 h-4 text-slate-400" />
        </Link>
        <Link to="/enterprise/jobs" className="flex items-center justify-between hover:bg-slate-50 p-2 rounded-xl transition-colors">
          <div>
            <p className="text-[13px] font-bold text-[#111827]">Job Requirements</p>
            <p className="text-[11px] font-medium text-slate-500">View all posted jobs</p>
          </div>
          <Briefcase className="w-4 h-4 text-slate-400" />
        </Link>
      </div>
    </div>
  )
}


