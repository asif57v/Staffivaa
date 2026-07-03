import { useState } from 'react'
import {
  useGetAuditLogsQuery,
  useGetTicketsQuery,
  useReplyTicketMutation,
  useCloseTicketMutation,
  useGetAttendanceQuery
} from '../../store/api/workforceApi.js'
import { useGetTransactionsQuery } from '../../store/api/adminWalletApi.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import {
  FileText, Download, Calendar, ShieldAlert,
  Clock, ShieldCheck, Mail, MessageSquare, AlertCircle, RefreshCw, Send
} from 'lucide-react'

export function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState('attendance') // attendance, transactions, audit, tickets
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Reply ticket state
  const [replyMessage, setReplyMessage] = useState('')
  const [selectedTicketId, setSelectedTicketId] = useState(null)

  // API Queries
  const {
    data: attendanceData,
    isLoading: attLoading,
    isError: attError,
    refetch: refetchAttendance
  } = useGetAttendanceQuery({ page, limit: 10, search, status: statusFilter }, { skip: activeTab !== 'attendance' })

  const {
    data: transData,
    isLoading: transLoading,
    isError: transError,
    refetch: refetchTrans
  } = useGetTransactionsQuery({ page, limit: 10, search, status: statusFilter, dateFrom, dateTo }, { skip: activeTab !== 'transactions' })

  const {
    data: auditData,
    isLoading: auditLoading,
    isError: auditError,
    refetch: refetchAudit
  } = useGetAuditLogsQuery({ page, limit: 10, search }, { skip: activeTab !== 'audit' })

  const {
    data: ticketData,
    isLoading: ticketLoading,
    isError: ticketError,
    refetch: refetchTickets
  } = useGetTicketsQuery({ page, limit: 10, search, status: statusFilter }, { skip: activeTab !== 'tickets' })

  // Mutations
  const [replyTicket] = useReplyTicketMutation()
  const [closeTicket] = useCloseTicketMutation()

  const handleReplySubmit = async (e, id) => {
    e.preventDefault()
    if (!replyMessage.trim()) return
    await replyTicket({ id, message: replyMessage })
    setReplyMessage('')
    setSelectedTicketId(null)
  }

  const handleCloseClick = async (id) => {
    if (window.confirm('Are you sure you want to close this ticket?')) {
      await closeTicket(id)
    }
  }

  // CSV Export utility
  const exportToCSV = (dataList, filename) => {
    if (!dataList || !dataList.length) return
    const headers = Object.keys(dataList[0])
    const csvRows = []
    csvRows.push(headers.join(','))

    for (const row of dataList) {
      const values = headers.map(header => {
        const val = row[header]
        const escaped = ('' + val).replace(/"/g, '\\"')
        return `"${escaped}"`
      })
      csvRows.push(values.join(','))
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', `${filename}.csv`)
    a.click()
  }

  const isLoading = attLoading || transLoading || auditLoading || ticketLoading
  const isError = attError || transError || auditError || ticketError

  const handlePageChange = (newPage) => {
    if (newPage >= 1) setPage(newPage)
  }

  const renderFilterBar = () => (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search records..."
          className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-slate-50/50"
        />
        {activeTab !== 'audit' && (
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-slate-50/50"
          >
            <option value="">All Statuses</option>
            {activeTab === 'attendance' && (
              <>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half Day</option>
                <option value="late">Late</option>
              </>
            )}
            {activeTab === 'transactions' && (
              <>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Failed">Failed</option>
              </>
            )}
            {activeTab === 'tickets' && (
              <>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </>
            )}
          </select>
        )}
        {activeTab === 'transactions' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
        )}
      </div>

      <button
        onClick={() => {
          if (activeTab === 'attendance') {
            const list = attendanceData?.attendance?.map(a => ({
              Worker: a.workerId?.fullName || 'N/A',
              Date: new Date(a.shiftDate).toLocaleDateString(),
              Status: a.attendanceStatus,
              CheckIn: a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString() : 'N/A',
              CheckOut: a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString() : 'N/A',
            }))
            exportToCSV(list, 'Attendance_Report')
          } else if (activeTab === 'transactions') {
            const list = transData?.transactions?.map(t => ({
              TxId: t.transactionId,
              Type: t.type,
              Source: t.source,
              Amount: t.amount,
              Payer: t.payerName || 'N/A',
              Status: t.status,
              Date: new Date(t.createdAt).toLocaleDateString(),
            }))
            exportToCSV(list, 'Financials_Transactions_Report')
          } else if (activeTab === 'audit') {
            const list = auditData?.logs?.map(l => ({
              Admin: l.admin?.email || 'System',
              Action: l.action,
              Module: l.module,
              IP: l.ipAddress || 'N/A',
              Browser: l.browser || 'N/A',
              Date: new Date(l.createdAt).toLocaleString(),
            }))
            exportToCSV(list, 'Audit_Trails_Logs_Report')
          }
        }}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-dark transition disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </button>
    </div>
  )

  const renderPagination = (pagination) => {
    if (!pagination || pagination.pages <= 1) return null
    return (
      <div className="flex items-center justify-between mt-6 bg-white px-4 py-3 rounded-2xl border border-slate-200/60 shadow-sm">
        <span className="text-xs font-semibold text-slate-500">
          Showing page {pagination.page} of {pagination.pages}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === pagination.pages}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Reports & analytics</h1>
        <p className="mt-2 text-sm text-slate-600">
          Live statistics, transaction logs, audit trails, and support tickets queue.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'attendance', label: 'Attendance Roster' },
          { id: 'transactions', label: 'Financial Transactions' },
          { id: 'audit', label: 'Admin Audit Log' },
          { id: 'tickets', label: 'Support Tickets' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setPage(1); setSearch(''); setStatusFilter('') }}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === t.id ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isError && (
        <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-2xl">
          <AlertCircle className="h-8 w-8 text-rose-500 mb-2" />
          <p className="text-sm font-bold text-slate-900">Error loading reports</p>
          <button
            onClick={() => {
              if (activeTab === 'attendance') refetchAttendance()
              if (activeTab === 'transactions') refetchTrans()
              if (activeTab === 'audit') refetchAudit()
              if (activeTab === 'tickets') refetchTickets()
            }}
            className="mt-3 flex items-center gap-2 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-dark"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {renderFilterBar()}

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl"></div>
          ))}
        </div>
      ) : (
        <>
          {activeTab === 'attendance' && (
            <GlassPanel className="p-0 overflow-hidden border border-slate-200/60 shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Worker</th>
                    <th className="px-6 py-4">Shift Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Check-In</th>
                    <th className="px-6 py-4">Check-Out</th>
                    <th className="px-6 py-4">Verified By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!attendanceData?.attendance || attendanceData.attendance.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-400">No attendance records found.</td>
                    </tr>
                  ) : (
                    attendanceData.attendance.map((a) => (
                      <tr key={a._id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-semibold text-slate-900">{a.workerId?.fullName || 'N/A'}</td>
                        <td className="px-6 py-4 text-slate-600">{new Date(a.shiftDate).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                            a.attendanceStatus === 'present' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/25' : 'bg-rose-50 text-rose-700 ring-rose-600/25'
                          }`}>
                            {a.attendanceStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString() : '—'}</td>
                        <td className="px-6 py-4 text-slate-500">{a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString() : '—'}</td>
                        <td className="px-6 py-4 text-slate-500">{a.verifiedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {renderPagination(attendanceData?.pagination)}
            </GlassPanel>
          )}

          {activeTab === 'transactions' && (
            <GlassPanel className="p-0 overflow-hidden border border-slate-200/60 shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Transaction ID</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Source</th>
                    <th className="px-6 py-4">Payer</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!transData?.transactions || transData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-slate-400">No transactions found.</td>
                    </tr>
                  ) : (
                    transData.transactions.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">{t.transactionId}</td>
                        <td className="px-6 py-4 text-slate-600">{t.type}</td>
                        <td className="px-6 py-4 text-slate-600">{t.source}</td>
                        <td className="px-6 py-4 text-slate-600">{t.payerName || 'N/A'}</td>
                        <td className="px-6 py-4 font-bold text-slate-900">₹{t.amount.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                            t.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/25' : 'bg-amber-50 text-amber-700 ring-amber-600/25'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {renderPagination(transData?.pagination)}
            </GlassPanel>
          )}

          {activeTab === 'audit' && (
            <GlassPanel className="p-0 overflow-hidden border border-slate-200/60 shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Administrator</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Module</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4">Browser/Agent</th>
                    <th className="px-6 py-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!auditData?.logs || auditData.logs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-400">No activity logs recorded.</td>
                    </tr>
                  ) : (
                    auditData.logs.map((l) => (
                      <tr key={l._id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-semibold text-slate-950">{l.admin?.email || 'System'}</td>
                        <td className="px-6 py-4 text-slate-800">{l.action}</td>
                        <td className="px-6 py-4 text-slate-500">{l.module}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{l.ipAddress || '—'}</td>
                        <td className="px-6 py-4 text-xs text-slate-400 max-w-xs truncate" title={l.browser}>{l.browser || '—'}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(l.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {renderPagination(auditData?.pagination)}
            </GlassPanel>
          )}

          {activeTab === 'tickets' && (
            <div className="space-y-4">
              {!ticketData?.tickets || ticketData.tickets.length === 0 ? (
                <GlassPanel className="p-8 text-center text-slate-400">No support tickets.</GlassPanel>
              ) : (
                ticketData.tickets.map((t) => (
                  <GlassPanel key={t._id} className="p-6 border border-slate-200/60 shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-slate-400 uppercase">{t.ticketId}</span>
                        <h4 className="text-base font-bold text-slate-900 mt-1">{t.subject}</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Opened by {t.userId?.fullName || 'User'} ({t.userId?.role || 'client'}) on {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          t.status === 'open' ? 'bg-amber-50 text-amber-700 ring-amber-600/25' : t.status === 'resolved' ? 'bg-blue-50 text-blue-700 ring-blue-600/25' : 'bg-slate-50 text-slate-700 ring-slate-600/25'
                        }`}>
                          {t.status}
                        </span>
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          t.priority === 'high' ? 'bg-rose-50 text-rose-700 ring-rose-600/25' : 'bg-slate-50 text-slate-700 ring-slate-600/25'
                        }`}>
                          {t.priority}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">{t.message}</p>

                    {/* Replies */}
                    {t.replies?.length > 0 && (
                      <div className="space-y-2.5 border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Replies</p>
                        {t.replies.map((rep) => (
                          <div key={rep._id} className={`p-3 rounded-xl text-xs max-w-lg ${rep.senderRole === 'admin' ? 'bg-emerald-50/20 border border-emerald-100/50 ml-auto' : 'bg-slate-50 border border-slate-100'}`}>
                            <p className="font-semibold text-slate-900 mb-1">{rep.senderRole === 'admin' ? 'Support Representative' : 'Client'}</p>
                            <p className="text-slate-700">{rep.message}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {t.status !== 'closed' && (
                      <div className="flex gap-2 justify-end border-t border-slate-100 pt-4">
                        {selectedTicketId === t._id ? (
                          <form onSubmit={(e) => handleReplySubmit(e, t._id)} className="flex w-full gap-2 items-center">
                            <input
                              type="text"
                              value={replyMessage}
                              onChange={(e) => setReplyMessage(e.target.value)}
                              placeholder="Type support response message..."
                              className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-slate-50/50"
                            />
                            <button
                              type="submit"
                              className="flex items-center justify-center h-9 w-9 rounded-xl bg-brand text-white hover:bg-brand-dark transition shadow-sm"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedTicketId(null)}
                              className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-500 hover:bg-slate-50 transition"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <>
                            <button
                              onClick={() => { setSelectedTicketId(t._id); setReplyMessage('') }}
                              className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                              Reply
                            </button>
                            {t.status !== 'resolved' && (
                              <button
                                onClick={() => handleCloseClick(t._id)}
                                className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50"
                              >
                                Close Ticket
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </GlassPanel>
                ))
              )}
              {renderPagination(ticketData?.pagination)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
