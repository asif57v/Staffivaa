/** Calendar date in India — enterprise check-ins are recorded once per worker per day. */
export function istDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date)
}

/** Today's check-in for an admin-assigned enterprise job (from /enterprise/my-direct-assignments), if any. */
export function todayCheckInOf(job) {
  return (job?.checkIns || []).find((c) => c.dateKey === istDateKey()) || null
}
