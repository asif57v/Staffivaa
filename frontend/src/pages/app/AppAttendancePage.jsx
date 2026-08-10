import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import {
  useGetLabourAssignmentsQuery,
  useCheckInMutation,
  useCheckOutMutation,
  useGetAttendanceQuery,
  useVerifyCheckInOtpMutation,
} from '../../store/api/workforceApi.js'
import { useGetLabourCurrentEmploymentQuery } from '../../store/api/enterpriseApi.js'
import { useAuth } from '../../hooks/useAuth.js'
import { getSocket } from '../../services/socket.js'
import {
  loadJobDemoState,
  subscribeJobDemo,
  saveJobDemoState,
  nowIso,
} from '../../lib/labourJobDemoStorage.js'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { LogIn, LogOut, MapPin, Clock, Building2, Briefcase, UserCircle, CalendarDays, History, Navigation, AlertTriangle, KeyRound, CheckCircle } from 'lucide-react'

function isApiAssignment(job) {
  return Boolean(job?.requestId) && /^[a-f0-9]{24}$/i.test(String(job.id))
}

// Helper to format date
const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Helper to get YYYY-MM-DD in local time
const getLocalDateStr = (d) => {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Component to handle live duration ticking
function LiveDuration({ checkInAt }) {
  const [elapsedStr, setElapsedStr] = useState('')

  useEffect(() => {
    if (!checkInAt) return
    const update = () => {
      const diffMs = new Date() - new Date(checkInAt)
      if (diffMs < 0) return setElapsedStr('00h 00m')
      const totalMins = Math.floor(diffMs / 60000)
      const h = Math.floor(totalMins / 60)
      const m = totalMins % 60
      setElapsedStr(`${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`)
    }
    update()
    const intv = setInterval(update, 5000) // Update every 5 seconds
    return () => clearInterval(intv)
  }, [checkInAt])

  return <span className="font-bold text-slate-900">{elapsedStr}</span>
}

// Haversine distance in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const GEOFENCE_RADIUS = 400 // meters (400m geofence)

function matchesCurrentAssignment(r, displayAssignment) {
  if (!r || !displayAssignment) return false

  const dispId = String(displayAssignment._id || displayAssignment.id || '')
  const dispReqId = String(displayAssignment.requestId?._id || displayAssignment.requestId || '')
  const dispJobId = String(displayAssignment.jobId?._id || displayAssignment.jobId || displayAssignment.enterpriseJobId || '')
  const dispProjectId = String(displayAssignment.requestId?.projectId?._id || displayAssignment.requestId?.projectId || displayAssignment.projectId || '')

  const recordAssignId = String(r.assignmentId?._id || r.assignmentId || '')
  const recordReqId = String(r.requestId?._id || r.requestId || '')
  const recordEntAppId = String(r.enterpriseApplicationId?._id || r.enterpriseApplicationId || '')
  const recordEntJobId = String(r.enterpriseJobId?._id || r.enterpriseJobId || '')
  const recordProjectId = String(r.projectId?._id || r.projectId || '')

  // 1. Direct Assignment match
  if (recordAssignId && dispId && recordAssignId === dispId) return true

  // 2. Direct Enterprise Application match
  if (recordEntAppId && dispId && recordEntAppId === dispId) return true

  // 3. Request match (for regular jobs under same workforce request)
  if (recordReqId && dispReqId && recordReqId === dispReqId) return true

  // 4. Enterprise Job match (for enterprise jobs)
  if (recordEntJobId && dispJobId && recordEntJobId === dispJobId) return true

  // 5. Project match
  if (recordProjectId && dispProjectId && recordProjectId === dispProjectId) return true

  return false
}

export function AppAttendancePage() {
  const { user } = useAuth()
  const reduce = useReducedMotion()
  const [toast, setToast] = useState('')
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  
  const { data: assignmentsData, isLoading: loadingAssignments, refetch } = useGetLabourAssignmentsQuery()
  const { data: currentEmpData, isLoading: loadingEmp } = useGetLabourCurrentEmploymentQuery()
  const currentEmp = currentEmpData?.data
  
  // Fetch ALL historical attendance records for this worker, without date filtering
  const { data: attendanceData, isLoading: loadingAttendance } = useGetAttendanceQuery()
  
  const [localDemo, setLocalDemo] = useState(() => loadJobDemoState())
  useEffect(() => subscribeJobDemo(setLocalDemo), [])
  
  const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation()
  const [checkOut, { isLoading: isCheckingOut }] = useCheckOutMutation()
  const [verifyCheckInOtp] = useVerifyCheckInOtpMutation()

  // OTP States
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [otpAttendanceId, setOtpAttendanceId] = useState(null)
  const [otpExpiresAt, setOtpExpiresAt] = useState(null)
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [otpError, setOtpError] = useState('')
  const [otpSuccess, setOtpSuccess] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2400)
  }, [])

  // Listen to Socket events for OTP updates
  useEffect(() => {
    const socket = getSocket()
    if (!socket || !showOtpModal || !otpAttendanceId) return

    const handleOtpGenerated = (data) => {
      if (data.attendanceId === otpAttendanceId) {
        setOtpExpiresAt(data.expiresAt)
        setOtpCountdown(Math.max(0, Math.ceil((new Date(data.expiresAt) - new Date()) / 1000)))
        setOtpError('')
        showToast('New OTP generated. Please ask supervisor.')
      }
    }

    const handleCheckedIn = (data) => {
      if (data.attendanceId === otpAttendanceId) {
        setOtpSuccess(true)
        setOtpError('')
        showToast('Checked in successfully.')
        setTimeout(() => {
          setShowOtpModal(false)
          setOtpSuccess(false)
          refetch()
        }, 1500)
      }
    }

    socket.on('attendance:otpGenerated', handleOtpGenerated)
    socket.on('attendance:checkedIn', handleCheckedIn)

    return () => {
      socket.off('attendance:otpGenerated', handleOtpGenerated)
      socket.off('attendance:checkedIn', handleCheckedIn)
    }
  }, [showOtpModal, otpAttendanceId, refetch, showToast])

  // Count down effect for OTP timer
  useEffect(() => {
    if (!showOtpModal || !otpExpiresAt) return

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(otpExpiresAt) - new Date()) / 1000))
      setOtpCountdown(remaining)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [showOtpModal, otpExpiresAt])

  // Live GPS distance tracking
  const [userLat, setUserLat] = useState(null)
  const [userLng, setUserLng] = useState(null)
  const [distanceToSite, setDistanceToSite] = useState(null)
  const [gpsStatus, setGpsStatus] = useState('idle') // idle | watching | error

  const assignments = assignmentsData?.assignments ?? []
  const records = attendanceData?.records ?? []

  const persistDemo = useCallback((next) => {
    saveJobDemoState(next)
    setLocalDemo(next)
  }, [])

  // Watch user GPS and calculate distance to site
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error')
      return
    }
    // We need assignment data loaded to know site coordinates
    if (!assignmentsData) return

    const activeAssigns = (assignmentsData?.assignments ?? []).filter((a) => {
      if (a.status !== 'accepted' && a.status !== 'on_site') return false
      const source = a.requestId?.sourceType
      return source === 'vendor' || source === 'corporate'
    })
    const primary = activeAssigns[0] || (currentEmp ? { isEnterprise: true, jobId: currentEmp.jobId } : null)
    const siteReq = primary?.requestId
    const siteLat = siteReq?.locationLat ?? primary?.jobId?.locationPoint?.coordinates?.[1]
    const siteLng = siteReq?.locationLng ?? primary?.jobId?.locationPoint?.coordinates?.[0]

    if (siteLat == null || siteLng == null) {
      // No site coordinates — skip distance tracking
      setDistanceToSite(null)
      return
    }

    setGpsStatus('watching')
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserLat(latitude)
        setUserLng(longitude)
        const dist = haversineDistance(latitude, longitude, siteLat, siteLng)
        setDistanceToSite(dist != null ? Math.round(dist) : null)
        setGpsStatus('watching')
      },
      () => {
        setGpsStatus('error')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [assignmentsData])

  const handleCheckIn = async (assignmentId, isDemo) => {
    if (isDemo) {
      persistDemo({
        ...localDemo,
        active: localDemo.active.map((a) => (a.id === assignmentId ? { ...a, status: 'on_site', onSiteAt: nowIso() } : a)),
      })
      showToast('Checked in successfully.')
      return
    }
    // Use real GPS location
    if (!navigator.geolocation) {
      showToast('Location is not supported by your browser.')
      return
    }
    showToast('Fetching your location...')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res = await checkIn({ assignmentId, lat, lng }).unwrap()
          if (res?.requiresOtp || res?.data?.requiresOtp) {
            const dataObj = res?.data || res
            setOtpAttendanceId(dataObj.record?._id)
            setOtpExpiresAt(dataObj.expiresAt)
            setOtpValue('')
            setOtpError('')
            setOtpSuccess(false)
            setShowOtpModal(true)
            showToast('OTP verification required.')
          } else {
            refetch()
            showToast('Checked in successfully.')
          }
        } catch (err) {
          showToast(err?.data?.message || 'Failed to check in.')
        }
      },
      (geoErr) => {
        showToast('Could not get your location. Please allow location permission and try again.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const handleCheckOut = async (assignmentId, isDemo) => {
    if (isDemo) {
      const job = localDemo.active.find((a) => a.id === assignmentId)
      if (job) {
        const { acceptedAt, ...rest } = job
        persistDemo({
          ...localDemo,
          active: localDemo.active.filter((a) => a.id !== assignmentId),
          history: [{ ...rest, acceptedAt, completedAt: nowIso() }, ...localDemo.history],
        })
      }
      showToast('Checked out successfully.')
      return
    }
    try {
      await checkOut({ assignmentId }).unwrap()
      refetch()
      showToast('Checked out successfully.')
    } catch (err) {
      showToast(err?.data?.message || 'Failed to check out.')
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpValue || otpValue.trim().length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP.')
      return
    }
    setIsVerifyingOtp(true)
    setOtpError('')
    try {
      await verifyCheckInOtp({ attendanceId: otpAttendanceId, otp: otpValue.trim() }).unwrap()
      setOtpSuccess(true)
      showToast('Checked in successfully.')
      setTimeout(() => {
        setShowOtpModal(false)
        setOtpSuccess(false)
        refetch()
      }, 1500)
    } catch (err) {
      setOtpError(err?.data?.message || 'Verification failed. Please try again.')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handleCancelOtp = () => {
    setShowOtpModal(false)
    setOtpValue('')
    setOtpError('')
    setOtpSuccess(false)
  }

  if (loadingAssignments || loadingAttendance) {
    return <div className="p-4 text-center text-slate-500">Loading attendance...</div>
  }

  const todayStr = getLocalDateStr(new Date())

  // Visibility Rule: Show if accepted/on_site AND current date is not past project end date.
  const activeAssignments = [
    ...(currentEmp ? [{
      _id: currentEmp._id,
      id: currentEmp._id,
      status: 'accepted',
      isEnterprise: true,
      isDemo: false,
      title: currentEmp.jobId?.jobTitle || 'Enterprise Deployment',
      contractor: currentEmp.enterpriseId?.enterpriseProfile?.companyName || currentEmp.enterpriseId?.fullName || 'Enterprise Client',
      vendorName: currentEmp.enterpriseId?.enterpriseProfile?.companyName || 'Staffivaa Enterprise',
      trade: currentEmp.jobId?.jobTitle || 'Worker',
      location: currentEmp.joiningDetails?.siteLocation || currentEmp.jobId?.locationText || 'Main Site Location',
      shiftWindow: currentEmp.jobId?.shift || '09:00 AM - 06:00 PM',
      requestId: {
        projectName: currentEmp.jobId?.jobTitle || 'Enterprise Deployment',
        clientId: currentEmp.enterpriseId,
        locationText: currentEmp.joiningDetails?.siteLocation || currentEmp.jobId?.locationText || 'Main Site Location',
        shiftStart: currentEmp.jobId?.shift?.split('-')?.[0]?.trim() || '09:00 AM',
        shiftEnd: currentEmp.jobId?.shift?.split('-')?.[1]?.trim() || '06:00 PM',
        startDate: currentEmp.joiningDetails?.joiningDate || currentEmp.offerDetails?.joiningDate || currentEmp.createdAt,
        endDate: currentEmp.joiningDetails?.endDate || currentEmp.offerDetails?.endDate || currentEmp.jobId?.timeline?.projectEndDate || currentEmp.jobId?.timeline?.applicationLastDate || null,
      },
      categoryId: { name: currentEmp.jobId?.jobTitle || 'Worker' },
      joiningDetails: currentEmp.joiningDetails,
      jobId: currentEmp.jobId,
      enterpriseId: currentEmp.enterpriseId,
    }] : []),
    ...assignments.filter((a) => {
      if (a.status !== 'accepted' && a.status !== 'on_site') return false

      // If there is an end date, hide it if today is past the end date
      if (a.requestId?.endDate) {
        const endStr = getLocalDateStr(a.requestId.endDate)
        if (todayStr > endStr) return false
      }
      return true
    }).map(a => ({ ...a, isDemo: false }))
  ]

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

  // Primary Assignment Data
  const primaryAssignment = activeAssignments[0]
  
  // Find the most recent completed assignment if no active one
  const completedAssignments = (assignmentsData?.assignments ?? []).filter((a) => {
    if (a.status !== 'completed' && a.status !== 'closed') return false
    return true
  })
  const latestCompleted = completedAssignments.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0]

  const displayAssignment = primaryAssignment || latestCompleted
  const isDemo = displayAssignment?.isDemo
  const req = displayAssignment?.requestId || {}

  let projectName, corporateName, vendorName, roleName, locationStr, shiftStr
  if (displayAssignment) {
    if (isDemo) {
      projectName = displayAssignment.title || 'Demo Project'
      corporateName = displayAssignment.contractor || 'Corporate Client'
      vendorName = displayAssignment.vendorName || 'Vendor'
      roleName = displayAssignment.trade || 'Worker'
      locationStr = displayAssignment.location || displayAssignment.site || 'Location not specified'
      shiftStr = displayAssignment.shiftWindow || '08:00 AM - 06:00 PM'
    } else {
      projectName = req.projectName || req.title || displayAssignment.title || 'Assigned Project'
      corporateName = req.clientId?.corporateProfile?.companyName || req.clientId?.enterpriseProfile?.companyName || req.clientId?.fullName || 'Client Company'
      vendorName = displayAssignment.vendorId?.contractorProfile?.businessName || displayAssignment.vendorId?.fullName || 'Staffivaa Partner'
      roleName = displayAssignment.categoryId?.name || req.lines?.[0]?.categoryId?.name || 'Worker'
      locationStr = req.locationText || req.siteId?.address || displayAssignment.location || 'Location not specified'
      shiftStr = (req.shiftStart && req.shiftEnd) ? `${req.shiftStart} - ${req.shiftEnd}` : '09:00 AM - 06:00 PM'
    }
  }

  let startDateFormatted = '—'
  let endDateFormatted = '—'
  let durationStr = '—'

  if (displayAssignment) {
    if (isDemo) {
      startDateFormatted = '23 Jun 2026'
      endDateFormatted = '30 Jun 2026'
      durationStr = '23 Jun 2026 – 30 Jun 2026'
    } else {
      const jobTimeline = displayAssignment.jobId?.timeline || displayAssignment.timeline || {}
      const joiningDetails = displayAssignment.joiningDetails || {}
      const offerDetails = displayAssignment.offerDetails || {}

      const sRaw =
        req.startDate ||
        joiningDetails.joiningDate ||
        offerDetails.joiningDate ||
        jobTimeline.expectedJoiningDate ||
        jobTimeline.applicationStartDate ||
        displayAssignment.createdAt

      const eRaw =
        req.endDate ||
        joiningDetails.endDate ||
        offerDetails.endDate ||
        jobTimeline.projectEndDate

      startDateFormatted = sRaw ? formatDate(sRaw) : 'Not specified'
      endDateFormatted = eRaw ? formatDate(eRaw) : (displayAssignment.jobId?.contractDuration ? `${displayAssignment.jobId.contractDuration}` : 'Ongoing / Full-Time')
      durationStr = eRaw ? `${startDateFormatted} ➔ ${endDateFormatted}` : `${startDateFormatted} (Ongoing)`
    }
  }

  // Determine Assignment Date
  let assignedDate = new Date(currentYear, currentMonth, 1)
  if (displayAssignment) {
    const created = displayAssignment.createdAt ? new Date(displayAssignment.createdAt) : null
    const accepted = displayAssignment.acceptedAt ? new Date(displayAssignment.acceptedAt) : null
    const start = req.startDate ? new Date(req.startDate) : null
    
    const validDates = [created, accepted, start].filter(Boolean)
    if (validDates.length > 0) {
      assignedDate = new Date(Math.max(...validDates.map(d => d.getTime())))
    }
  }
  assignedDate.setHours(0, 0, 0, 0)

  const todayDateObj = new Date()
  todayDateObj.setHours(0, 0, 0, 0)
  const canCheckInToday = todayDateObj.getTime() >= assignedDate.getTime()

  // Map records for the current month
  const recordMap = {}
  if (records && displayAssignment) {
    const relevantRecords = records.filter(r => matchesCurrentAssignment(r, displayAssignment))
    relevantRecords.forEach(r => {
      const d = new Date(r.shiftDate)
      d.setHours(0, 0, 0, 0)
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        recordMap[d.getDate()] = r
      }
    })
  }

  let totalPresent = 0
  let totalAbsent = 0
  let totalLate = 0
  let totalWeeklyOff = 0
  let totalHoursSum = 0
  let totalOvertimeSum = 0
  let daysWithHours = 0
  let assignedWorkingDays = 0

  const STANDARD_SHIFT_HOURS = 8

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const getDayStatus = (d) => {
    const iterDate = new Date(currentYear, currentMonth, d)
    if (iterDate > now) return null // future
    
    const r = recordMap[d]
    if (r) {
      let st = r.attendanceStatus
      if (!st) {
        if (r.checkInAt && r.checkOutAt) {
          st = 'Present'
        } else if (r.checkInAt && !r.checkOutAt) {
          const shiftDateStr = getLocalDateStr(r.shiftDate)
          st = shiftDateStr === todayStr ? 'Working' : 'Incomplete'
        } else {
          st = 'Absent'
        }
      }
      if (st === 'working' || st === 'Working') st = 'Present'
      
      if (st === 'Present' || st === 'Half Day') return { type: 'Present', color: '#10B981' }
      if (st === 'Absent') return { type: 'Absent', color: '#EF4444' }
      if (st === 'Late' || st === 'Incomplete') return { type: 'Late', color: '#F59E0B' }
      if (st === 'Weekly Off') return { type: 'Off', color: '#8B5CF6' }
      return { type: 'Present', color: '#10B981' }
    }
    
    // Past day, no record
    if (primaryAssignment && iterDate >= assignedDate) {
      return { type: 'Absent', color: '#EF4444' }
    }
    
    return { type: 'Not Assigned', color: '#CBD5E1' }
  }

  calendarDays.forEach(d => {
    const s = getDayStatus(d)
    if (s && s.type !== 'Not Assigned') {
      assignedWorkingDays++
      if (s.type === 'Present') totalPresent++
      else if (s.type === 'Absent') totalAbsent++
      else if (s.type === 'Late') totalLate++
      else if (s.type === 'Off') {
        totalWeeklyOff++
        assignedWorkingDays-- // Exclude off days from assigned working days
      }
    }
    
    const r = recordMap[d]
    if (r && r.totalHours) {
      totalHoursSum += r.totalHours
      daysWithHours++
      // Calculate overtime from real record data
      const recordOT = r.overtimeHours != null && r.overtimeHours > 0 ? r.overtimeHours : Math.max(0, r.totalHours - STANDARD_SHIFT_HOURS)
      totalOvertimeSum += recordOT
    }
  })

  const avgHours = daysWithHours > 0 ? (totalHoursSum / daysWithHours).toFixed(1) : 0

  // Find if there's any ongoing shift (even if it started yesterday)
  const activeOngoingRecord = records.find(r => r.checkInAt && !r.checkOutAt)
  
  // Today's Check In Status
  const todayRecord = activeOngoingRecord || recordMap[now.getDate()] || (isDemo && primaryAssignment?.status === 'on_site' ? { checkInAt: primaryAssignment.onSiteAt || nowIso(), projectStatus: 'working' } : null)
  const isPendingOtp = todayRecord && todayRecord.status === 'otp_pending'
  const isCheckedIn = todayRecord && todayRecord.status !== 'otp_pending' && (todayRecord.projectStatus === 'working' || (todayRecord.checkInAt && !todayRecord.checkOutAt))
  const isCompleted = todayRecord && (todayRecord.status === 'completed' || todayRecord.projectStatus === 'completed' || (todayRecord.checkInAt && todayRecord.checkOutAt))
  
  // Selected Day specific data
  const selectedRecord = recordMap[selectedDay]
  const selectedStatusObj = getDayStatus(selectedDay)
  const isSelectedToday = selectedDay === now.getDate()
  const selectedDateStr = new Date(currentYear, currentMonth, selectedDay).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
  const isSelectedCheckInVerified = selectedRecord
    ? (selectedRecord.status !== 'otp_pending')
    : isCheckedIn

  let selStatusText = selectedStatusObj?.type || 'No Data'
  if (isSelectedToday && isCheckedIn && !isCompleted) {
    selStatusText = 'Working'
  }

  // History Records
  const historyRecords = !displayAssignment ? [] : records
    .filter(r => {
      if (!matchesCurrentAssignment(r, displayAssignment)) {
        return false
      }
      const d = new Date(r.shiftDate)
      d.setHours(0, 0, 0, 0)
      
      const localStr = getLocalDateStr(r.shiftDate)
      if (localStr < todayStr) return true
      if (localStr === todayStr) {
        return r.projectStatus === 'completed' || Boolean(r.checkOutAt)
      }
      return false
    })
    .sort((a, b) => new Date(b.shiftDate) - new Date(a.shiftDate))

  return (
    <div className="space-y-4 pb-8">
      <AnimatePresence>
        {toast ? (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            className="fixed left-4 right-4 top-3 z-[200] mx-auto max-w-md rounded-2xl border border-sky-300/40 bg-sky-900/95 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl backdrop-blur-md"
            role="status"
          >
            {toast}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Project Attendance</h1>
        <p className="mt-2 text-sm text-slate-600">Track your attendance for corporate and client projects.</p>
      </div>

      {!primaryAssignment ? (
        <div style={{
          background: '#FFFFFF', borderRadius: 20, padding: '24px',
          border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#F8FAFC',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Building2 style={{ width: 24, height: 24, color: '#94A3B8' }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>📭 No Active Assignment</h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px', lineHeight: 1.5 }}>
              You are currently not assigned to any Corporate or Client projects by your vendor.
            </p>
          </div>

          {displayAssignment && (
            <div style={{ marginTop: 24, borderTop: '1px solid #F1F5F9', paddingTop: 20 }}>
               <h4 style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
                 Latest Completed Project
               </h4>
               <div style={{ background: '#F8FAFC', borderRadius: 16, padding: '16px', border: '1px solid #E2E8F0' }}>
                 <p style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>{corporateName}</p>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                   <MapPin style={{ width: 14, height: 14 }} /> {locationStr}
                 </div>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>Duration</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#334155', margin: 0 }}>{durationStr}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>Role</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#334155', margin: 0 }}>{roleName}</p>
                    </div>
                 </div>
               </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 1️⃣ Active Project Card */}
          <div style={{
            background: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
            border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <div style={{ background: '#0F172A', padding: '16px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0 }}>
                <Building2 style={{ width: 22, height: 22, color: '#38BDF8' }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{projectName}</h2>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{corporateName}</p>
              </div>
            </div>
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase style={{ width: 12, height: 12 }} /> Role</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>{roleName}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}><Clock style={{ width: 12, height: 12 }} /> Daily Shift</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>{shiftStr}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}><CalendarDays style={{ width: 12, height: 12 }} /> Start Date</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>{startDateFormatted}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}><CalendarDays style={{ width: 12, height: 12 }} /> End Date</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>{endDateFormatted}</p>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin style={{ width: 12, height: 12 }} /> Deployed Site Location</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0, leading: '1.4' }}>{locationStr}</p>
              </div>
            </div>
            <div style={{ padding: '12px 16px', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#10B981', background: '#ECFDF5', padding: '4px 10px', borderRadius: 12, border: '1px solid #A7F3D0' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} /> Active Assignment
              </span>
            </div>
          </div>

          {/* 3️⃣ Today's Attendance Block */}
          <div style={{
            background: '#FFFFFF', borderRadius: 20, padding: '16px',
            border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, color: '#64748B', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Today's Attendance</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Status</p>
                <span style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800,
                  background: isCompleted ? '#ECFDF5' : isPendingOtp ? '#FFFBEB' : isCheckedIn ? '#EFF6FF' : '#F1F5F9',
                  color: isCompleted ? '#10B981' : isPendingOtp ? '#D97706' : isCheckedIn ? '#3B82F6' : '#64748B',
                }}>
                  {isCompleted ? '🟢 Present' : isPendingOtp ? '🟡 OTP Verification Pending' : isCheckedIn ? '🔵 Working' : '⚪ Not Checked In'}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>{isCompleted ? 'Total Hours' : isCheckedIn ? 'Live Time' : ''}</p>
                {isCompleted && todayRecord?.totalHours != null ? (
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>{todayRecord.totalHours}h</p>
                ) : isCheckedIn && todayRecord?.checkInAt ? (
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#3B82F6', margin: 0 }}><LiveDuration checkInAt={todayRecord.checkInAt} /></p>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: 12, border: '1px solid #F1F5F9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>Check In</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {todayRecord?.checkInAt ? new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                </p>
              </div>
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: 12, border: '1px solid #F1F5F9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>Check Out</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {todayRecord?.checkOutAt ? new Date(todayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                </p>
              </div>
            </div>
            {/* Today's Duration & Overtime Row */}
            {(isCompleted || isCheckedIn) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#F0F9FF', padding: '12px', borderRadius: 12, border: '1px solid #BAE6FD' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', marginBottom: 2 }}>Working Duration</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    {isCheckedIn && !todayRecord?.checkOutAt ? (
                      <LiveDuration checkInAt={todayRecord.checkInAt} />
                    ) : todayRecord?.checkInAt && todayRecord?.checkOutAt ? (
                      (() => {
                        const mins = Math.floor((new Date(todayRecord.checkOutAt).getTime() - new Date(todayRecord.checkInAt).getTime()) / 60000)
                        return `${Math.floor(mins / 60)}h ${mins % 60}m`
                      })()
                    ) : todayRecord?.totalHours != null && todayRecord.totalHours > 0 ? (
                      `${Math.floor(todayRecord.totalHours)}h ${Math.round((todayRecord.totalHours % 1) * 60)}m`
                    ) : (
                      '--'
                    )}
                  </p>
                </div>
                <div style={{ background: '#FFFBEB', padding: '12px', borderRadius: 12, border: '1px solid #FDE68A' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', marginBottom: 2 }}>Overtime (OT)</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: todayRecord?.overtimeHours > 0 || (todayRecord?.totalHours > STANDARD_SHIFT_HOURS) ? '#D97706' : '#94A3B8', margin: 0 }}>
                    {(() => {
                      let workedHours = todayRecord?.totalHours || 0
                      if (isCheckedIn && !todayRecord?.checkOutAt && todayRecord?.checkInAt) {
                        workedHours = (Date.now() - new Date(todayRecord.checkInAt).getTime()) / 3600000
                      }
                      const ot = todayRecord?.overtimeHours != null && todayRecord.overtimeHours > 0 
                        ? todayRecord.overtimeHours 
                        : (workedHours > STANDARD_SHIFT_HOURS ? parseFloat((workedHours - STANDARD_SHIFT_HOURS).toFixed(2)) : 0)
                      return ot > 0 ? `+${Math.floor(ot)}h ${Math.round((ot % 1) * 60)}m` : '0h 0m'
                    })()}
                  </p>
                </div>
              </div>
            )}

            {/* Live Distance & Check In / Check Out Actions */}
            {isPendingOtp ? (
              <button
                type="button"
                onClick={() => {
                  setOtpAttendanceId(todayRecord._id)
                  setOtpExpiresAt(todayRecord.expiresAt || new Date(Date.now() + 5 * 60 * 1000))
                  setOtpValue('')
                  setOtpError('')
                  setOtpSuccess(false)
                  setShowOtpModal(true)
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#FFFFFF',
                  fontSize: 14, fontWeight: 800, letterSpacing: '0.3px',
                  boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                <KeyRound style={{ width: 18, height: 18 }} />
                Enter OTP to Check In
              </button>
            ) : canCheckInToday && !isCheckedIn && !isCompleted ? (
              <>
                {/* Live distance indicator */}
                {(req?.locationLat != null && req?.locationLng != null) || (displayAssignment?.jobId?.locationPoint?.coordinates?.[1] != null && displayAssignment?.jobId?.locationPoint?.coordinates?.[0] != null) ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                    borderRadius: 12, marginBottom: 10,
                    background: distanceToSite != null && distanceToSite <= GEOFENCE_RADIUS ? '#ECFDF5' : distanceToSite != null && distanceToSite <= 600 ? '#FFFBEB' : '#FEF2F2',
                    border: `1px solid ${distanceToSite != null && distanceToSite <= GEOFENCE_RADIUS ? '#A7F3D0' : distanceToSite != null && distanceToSite <= 600 ? '#FDE68A' : '#FECACA'}`,
                  }}>
                    <Navigation style={{
                      width: 16, height: 16, flexShrink: 0,
                      color: distanceToSite != null && distanceToSite <= GEOFENCE_RADIUS ? '#10B981' : distanceToSite != null && distanceToSite <= 600 ? '#F59E0B' : '#EF4444',
                    }} />
                    <div style={{ flex: 1 }}>
                      {gpsStatus === 'error' ? (
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', margin: 0 }}>
                          ⚠️ Location access denied. Enable GPS to check in.
                        </p>
                      ) : distanceToSite == null ? (
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', margin: 0 }}>
                          📡 Getting your location...
                        </p>
                      ) : distanceToSite <= GEOFENCE_RADIUS ? (
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#059669', margin: 0 }}>
                          ✅ You are {distanceToSite}m from the site — ready to check in!
                        </p>
                      ) : (
                        <p style={{ fontSize: 11, fontWeight: 700, color: distanceToSite <= 600 ? '#B45309' : '#DC2626', margin: 0 }}>
                          📍 You are <strong>{distanceToSite >= 1000 ? `${(distanceToSite / 1000).toFixed(1)}km` : `${distanceToSite}m`}</strong> away. Move within {GEOFENCE_RADIUS}m to check in.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleCheckIn(primaryAssignment._id || primaryAssignment.id, isDemo)}
                  disabled={isCheckingIn || (((req?.locationLat != null && req?.locationLng != null) || (displayAssignment?.jobId?.locationPoint?.coordinates?.[1] != null)) && (distanceToSite == null || distanceToSite > GEOFENCE_RADIUS))}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: (((req?.locationLat != null && req?.locationLng != null) || (displayAssignment?.jobId?.locationPoint?.coordinates?.[1] != null)) && (distanceToSite == null || distanceToSite > GEOFENCE_RADIUS))
                      ? '#94A3B8' : 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#FFFFFF',
                    fontSize: 14, fontWeight: 800, letterSpacing: '0.3px',
                    boxShadow: (((req?.locationLat != null && req?.locationLng != null) || (displayAssignment?.jobId?.locationPoint?.coordinates?.[1] != null)) && (distanceToSite == null || distanceToSite > GEOFENCE_RADIUS))
                      ? 'none' : '0 4px 14px rgba(16,185,129,0.35)',
                    opacity: isCheckingIn ? 0.7 : 1, transition: 'all 0.2s',
                  }}
                >
                  <LogIn style={{ width: 18, height: 18 }} />
                  {isCheckingIn ? 'Checking In...' : (((req?.locationLat != null && req?.locationLng != null) || (displayAssignment?.jobId?.locationPoint?.coordinates?.[1] != null)) && (distanceToSite == null || distanceToSite > GEOFENCE_RADIUS)) ? 'Move closer to check in (within 400m)' : 'Check In'}
                </button>
              </>
            ) : isCheckedIn && !isCompleted ? (
              <button
                type="button"
                onClick={() => handleCheckOut(primaryAssignment._id || primaryAssignment.id, isDemo)}
                disabled={isCheckingOut}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF',
                  fontSize: 14, fontWeight: 800, letterSpacing: '0.3px',
                  boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
                  opacity: isCheckingOut ? 0.7 : 1, transition: 'all 0.2s',
                }}
              >
                <LogOut style={{ width: 18, height: 18 }} />
                {isCheckingOut ? 'Checking Out...' : 'Check Out'}
              </button>
            ) : isCompleted ? (
              <div style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 0', borderRadius: 14,
                background: '#F0FDF4', border: '1px solid #BBF7D0',
                fontSize: 13, fontWeight: 800, color: '#15803D',
              }}>
                ✅ Shift completed for today
              </div>
            ) : !canCheckInToday ? (
              <div style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 0', borderRadius: 14,
                background: '#FFF7ED', border: '1px solid #FED7AA',
                fontSize: 12, fontWeight: 700, color: '#9A3412',
              }}>
                ⏳ Assignment starts on {formatDate(assignedDate)}
              </div>
            ) : null}
          </div>

        </>
      )}

          {/* 4️⃣ Monthly Summary Cards */}
          {displayAssignment && (
            <>
              <div>
                <h4 style={{ fontSize: 11, fontWeight: 800, color: '#64748B', margin: '0 0 10px 2px', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarDays style={{ width: 14, height: 14 }} /> Monthly Summary
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
              {[
                { label: 'Present', value: totalPresent, color: '#10B981', bg: '#ECFDF5', border: '#D1FAE5' },
                { label: 'Absent', value: totalAbsent, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
                { label: 'Late', value: totalLate, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
                { label: 'Off', value: totalWeeklyOff, color: '#8B5CF6', bg: '#F5F3FF', border: '#E9D5FF' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: '12px 4px', border: `1px solid ${s.border}`, textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: 9, fontWeight: 700, color: s.color, margin: '6px 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
               <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 10px', border: `1px solid #F1F5F9`, textAlign: 'center' }}>
                 <p style={{ fontSize: 9, fontWeight: 700, color: '#64748B', margin: '0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}><Clock style={{ width: 11, height: 11 }} /> Total Hrs</p>
                 <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>{totalHoursSum.toFixed(1)}h</p>
               </div>
               <div style={{ background: '#FFFBEB', borderRadius: 14, padding: '12px 10px', border: `1px solid #FDE68A`, textAlign: 'center' }}>
                 <p style={{ fontSize: 9, fontWeight: 700, color: '#B45309', margin: '0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}><Clock style={{ width: 11, height: 11 }} /> Overtime</p>
                 <p style={{ fontSize: 14, fontWeight: 800, color: totalOvertimeSum > 0 ? '#D97706' : '#94A3B8', margin: 0 }}>{totalOvertimeSum.toFixed(1)}h</p>
               </div>
               <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 10px', border: `1px solid #F1F5F9`, textAlign: 'center' }}>
                 <p style={{ fontSize: 9, fontWeight: 700, color: '#64748B', margin: '0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}><Clock style={{ width: 11, height: 11 }} /> Avg/Day</p>
                 <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>{avgHours}h</p>
               </div>
            </div>
          </div>

          {/* 5️⃣ Monthly Calendar */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '16px', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 4px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0 }}>{now.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', marginBottom: 12 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', paddingBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{d}</div>
              ))}

              {Array.from({ length: (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7 }).map((_, i) => <div key={`blank-${i}`} />)}

              {calendarDays.map((d) => {
                const sObj = getDayStatus(d)
                const dotColor = sObj?.color || 'transparent'
                const isSelected = selectedDay === d
                
                let txtColor = '#334155'
                if (sObj?.type === 'Not Assigned') txtColor = '#CBD5E1'
                else if (d > now.getDate()) txtColor = '#CBD5E1'
                if (isSelected) txtColor = '#FFFFFF'

                // Project start/end day range calculation
                const iterDate = new Date(currentYear, currentMonth, d)
                iterDate.setHours(0, 0, 0, 0)
                
                let isStartDay = false
                let isEndDay = false
                let isInRange = false
                
                const sRawDate = req?.startDate || (displayAssignment?.isEnterprise ? (displayAssignment.joiningDetails?.joiningDate || displayAssignment.createdAt) : null)
                const eRawDate = req?.endDate || (displayAssignment?.joiningDetails?.endDate || displayAssignment?.offerDetails?.endDate || displayAssignment?.jobId?.timeline?.projectEndDate || null)

                if (sRawDate) {
                  const sDate = new Date(sRawDate)
                  sDate.setHours(0, 0, 0, 0)
                  if (iterDate.getTime() === sDate.getTime()) isStartDay = true

                  if (eRawDate) {
                    const eDate = new Date(eRawDate)
                    eDate.setHours(0, 0, 0, 0)
                    if (iterDate.getTime() === eDate.getTime()) isEndDay = true
                    if (iterDate > sDate && iterDate < eDate) isInRange = true
                  }
                }

                // Range highlight styling
                const rangeBg = (isStartDay || isEndDay || isInRange) ? '#F1F5F9' : 'transparent'
                const borderRadius = isStartDay ? '12px 0 0 12px' : isEndDay ? '0 12px 12px 0' : isInRange ? '0' : '12px'

                return (
                  <div key={d} onClick={() => d <= now.getDate() && setSelectedDay(d)} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 0', cursor: d <= now.getDate() ? 'pointer' : 'default', background: rangeBg, borderRadius, margin: '0 -2px' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: isSelected ? 800 : 600, background: isSelected ? '#0F172A' : 'transparent', color: txtColor, border: isSelected ? 'none' : isStartDay ? '1px solid #10B981' : isEndDay ? '1px solid #F97316' : (d <= now.getDate() && sObj?.type !== 'Not Assigned') ? '1px solid #E2E8F0' : '1px solid transparent', transition: 'all 0.2s', zIndex: 2 }}>
                      {d}
                    </div>
                    
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, marginTop: 4, zIndex: 2 }} />
                    
                    {/* Absolutely positioned badges to prevent grid jumping */}
                    {isStartDay && (
                      <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', background: '#10B981', color: '#FFFFFF', fontSize: 7, fontWeight: 800, padding: '2px 4px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px', zIndex: 3, boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}>
                        Start
                      </div>
                    )}
                    {isEndDay && (
                      <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', background: '#F97316', color: '#FFFFFF', fontSize: 7, fontWeight: 800, padding: '2px 4px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px', zIndex: 3, boxShadow: '0 2px 4px rgba(249,115,22,0.2)' }}>
                        End
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
              {[
                { label: 'Present', color: '#10B981' },
                { label: 'Absent', color: '#EF4444' },
                { label: 'Late', color: '#F59E0B' },
                { label: 'Off', color: '#8B5CF6' },
                { label: 'Not Assigned', color: '#CBD5E1' }
              ].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} /> {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* 7️⃣ Selected Date Timeline */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 800, color: '#64748B', margin: '0 0 10px 2px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {isSelectedToday ? "Today's Timeline" : "Timeline"} ({selectedDateStr})
            </h4>
            <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '20px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              {selectedStatusObj?.type === 'Not Assigned' ? (
                <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 14, fontWeight: 600, color: '#94A3B8' }}>Worker was not assigned on this date.</div>
              ) : selectedRecord || (isSelectedToday && isCheckedIn) ? (
                <div style={{ position: 'relative', paddingLeft: 24 }}>
                  <div style={{ position: 'absolute', top: 12, bottom: 12, left: 7, width: 2, background: '#E2E8F0', borderRadius: 2 }} />
                  
                  {/* Check In Event */}
                  <div style={{ position: 'relative', marginBottom: 24 }}>
                     <div style={{ position: 'absolute', left: -24, top: 2, width: 16, height: 16, borderRadius: '50%', background: isSelectedCheckInVerified ? '#ECFDF5' : '#FFFBEB', border: `2px solid ${isSelectedCheckInVerified ? '#10B981' : '#F59E0B'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                       <span style={{ width: 6, height: 6, borderRadius: '50%', background: isSelectedCheckInVerified ? '#10B981' : '#F59E0B' }} />
                     </div>
                     <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                       <div style={{ flexShrink: 0, minWidth: 60 }}>
                         <p style={{ fontSize: 14, fontWeight: 800, color: isSelectedCheckInVerified ? '#0F172A' : '#64748B', margin: 0 }}>
                           {todayRecord?.checkInAt ? new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[0] : selectedRecord?.checkInAt ? new Date(selectedRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[0] : '—'}
                         </p>
                         <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: 0 }}>
                           {todayRecord?.checkInAt ? new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[1] : selectedRecord?.checkInAt ? new Date(selectedRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[1] : ''}
                         </p>
                       </div>
                       <div>
                         <p style={{ fontSize: 14, fontWeight: 800, color: isSelectedCheckInVerified ? '#0F172A' : '#475569', margin: '0 0 6px' }}>
                           {isSelectedCheckInVerified ? 'Checked In' : 'Check-In Pending'}
                         </p>
                         {isSelectedCheckInVerified ? (
                           <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#10B981', border: '1px solid #A7F3D0', borderRadius: 6, padding: '3px 8px', background: '#ECFDF5' }}>
                             <MapPin style={{ width: 10, height: 10 }} /> GPS Verified
                           </span>
                         ) : (
                           <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#B45309', border: '1px solid #FDE68A', borderRadius: 6, padding: '3px 8px', background: '#FFFBEB' }}>
                             <KeyRound style={{ width: 10, height: 10 }} /> OTP Verification Required
                           </span>
                         )}
                       </div>
                     </div>
                  </div>

                  {/* Check Out Event */}
                  <div style={{ position: 'relative' }}>
                     <div style={{ position: 'absolute', left: -24, top: 2, width: 16, height: 16, borderRadius: '50%', background: (isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? '#EFF6FF' : '#F1F5F9', border: `2px solid ${(isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? '#3B82F6' : '#CBD5E1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                       <span style={{ width: 6, height: 6, borderRadius: '50%', background: (isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? '#3B82F6' : '#CBD5E1' }} />
                     </div>
                     <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                       <div style={{ flexShrink: 0, minWidth: 60 }}>
                         <p style={{ fontSize: 14, fontWeight: 800, color: (isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? '#0F172A' : '#94A3B8', margin: 0 }}>
                           {todayRecord?.checkOutAt ? new Date(todayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[0] : selectedRecord?.checkOutAt ? new Date(selectedRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[0] : '—'}
                         </p>
                         <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: 0 }}>
                           {todayRecord?.checkOutAt ? new Date(todayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[1] : selectedRecord?.checkOutAt ? new Date(selectedRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(' ')[1] : ''}
                         </p>
                       </div>
                       <div>
                         <p style={{ fontSize: 14, fontWeight: 800, color: (isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? '#0F172A' : '#94A3B8', margin: '0 0 6px' }}>
                           {(isSelectedToday ? isCompleted : selectedRecord?.checkOutAt) ? 'Checked Out' : 'Not Checked Out'}
                         </p>
                          {(() => {
                            const recTH = isSelectedToday ? todayRecord?.totalHours : selectedRecord?.totalHours
                            const recOT = isSelectedToday ? (todayRecord?.overtimeHours || 0) : (selectedRecord?.overtimeHours || 0)
                            const computedOT = recTH != null && recTH > STANDARD_SHIFT_HOURS ? parseFloat((recTH - STANDARD_SHIFT_HOURS).toFixed(2)) : 0
                            const finalOT = recOT > 0 ? recOT : computedOT
                            return recTH != null ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#64748B' }}>
                                  <Clock style={{ width: 12, height: 12 }} /> Total: <span style={{ fontWeight: 800 }}>{recTH} hrs</span>
                                  {recTH > 0 && <span style={{ color: '#94A3B8' }}>({Math.floor(recTH)}h {Math.round((recTH % 1) * 60)}m)</span>}
                                </span>
                                {finalOT > 0 && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '2px 8px' }}>
                                    ⏱ Overtime: +{finalOT} hrs
                                  </span>
                                )}
                              </div>
                            ) : null
                          })()}
                       </div>
                     </div>
                  </div>
                </div>
              ) : (
                 <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 14, fontWeight: 600, color: '#94A3B8' }}>
                   No records found for {selectedDateStr}. <br/>Status: {selStatusText}
                 </div>
              )}
            </div>
          </div>

          {/* 8️⃣ Attendance History */}
          {historyRecords.length > 0 && (
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 800, color: '#64748B', margin: '0 0 10px 2px', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <History style={{ width: 14, height: 14 }} /> Attendance History
              </h4>
              <div className="space-y-3">
                {historyRecords.map((r, i) => {
                  const d = new Date(r.shiftDate)
                  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                  let st = r.attendanceStatus
                  if (!st) {
                    if (r.checkInAt && r.checkOutAt) {
                      st = 'Present'
                    } else if (r.checkInAt && !r.checkOutAt) {
                      const shiftDateStr = getLocalDateStr(r.shiftDate)
                      st = shiftDateStr === todayStr ? 'Working' : 'Incomplete'
                    } else {
                      st = 'Absent'
                    }
                  }
                  if (st === 'working') st = 'Working'

                  const rColor = (st === 'Present' || st === 'Working') ? '#10B981' : (st === 'Late' || st === 'Incomplete') ? '#F59E0B' : '#EF4444'
                  const rBg = (st === 'Present' || st === 'Working') ? '#ECFDF5' : (st === 'Late' || st === 'Incomplete') ? '#FFFBEB' : '#FEF2F2'

                  const hTotalHrs = r.totalHours != null && r.totalHours > 0 ? r.totalHours : (r.checkInAt && r.checkOutAt ? parseFloat(((new Date(r.checkOutAt) - new Date(r.checkInAt)) / 3600000).toFixed(2)) : 0)
                  const hOtHrs = r.overtimeHours != null && r.overtimeHours > 0 ? r.overtimeHours : Math.max(0, parseFloat((hTotalHrs - STANDARD_SHIFT_HOURS).toFixed(2)))

                  return (
                    <div key={r._id || i} style={{ background: '#FFFFFF', borderRadius: 16, padding: '16px', border: '1px solid #F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{dateStr}</span>
                        <span style={{ background: rBg, color: rColor, padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          {st}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>Check In</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', margin: 0 }}>
                            {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>Check Out</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', margin: 0 }}>
                            {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                      </div>
                      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 2px' }}>Total Duration</p>
                          <p style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                            {hTotalHrs > 0 ? `${Math.floor(hTotalHrs)}h ${Math.round((hTotalHrs % 1) * 60)}m` : '0h 0m'}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', margin: '0 0 2px' }}>Overtime</p>
                          <p style={{ fontSize: 14, fontWeight: 800, color: hOtHrs > 0 ? '#D97706' : '#94A3B8', margin: 0 }}>
                            {hOtHrs > 0 ? `+${Math.floor(hOtHrs)}h ${Math.round((hOtHrs % 1) * 60)}m` : '0h 0m'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {createPortal(
        <AnimatePresence>
          {showOtpModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              zIndex: 9999
            }}>
              <motion.div
                initial={reduce ? false : { y: '100%' }}
                animate={{ y: 0 }}
                exit={reduce ? undefined : { y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                style={{
                  width: '100%', maxWidth: '480px', background: '#FFFFFF',
                  borderRadius: '30px 30px 0 0', padding: '24px 24px max(24px, env(safe-area-inset-bottom))',
                  boxShadow: '0 -8px 30px rgba(0, 0, 0, 0.15)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}
              >
                <div style={{ width: 48, height: 5, background: '#E2E8F0', borderRadius: 10, marginBottom: 20 }} />

                {otpSuccess ? (
                  <div style={{ textAlign: 'center', padding: '30px 0' }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 16px', border: '2.5px solid #10B981'
                    }}>
                      <CheckCircle style={{ width: 32, height: 32, color: '#10B981' }} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>Verified!</h3>
                    <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>Check-in verified successfully.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ textAlign: 'center', width: '100%' }}>
                      <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', margin: '0 0 6px' }}>Verify Check In</h3>
                      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px', lineHeight: 1.5 }}>
                        Ask your Corporate representative for the 6-digit verification code.
                      </p>
                    </div>

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                      <div style={{ position: 'relative', width: '100%' }}>
                        <input
                          type="text"
                          maxLength={6}
                          pattern="\d*"
                          placeholder="Enter 6-digit OTP"
                          value={otpValue}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '')
                            setOtpValue(val)
                            if (val.length === 6) setOtpError('')
                          }}
                          style={{
                            width: '100%', padding: '14px', borderRadius: 16,
                            border: `2px solid ${otpError ? '#EF4444' : '#E2E8F0'}`,
                            textAlign: 'center', fontSize: 20, fontWeight: 800,
                            letterSpacing: '6px', outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      {otpError && (
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', margin: 0, textAlign: 'center' }}>
                          ❌ {otpError}
                        </p>
                      )}

                      {/* Countdown Timer */}
                      <div style={{ fontSize: 12, fontWeight: 800, color: otpCountdown > 0 ? '#64748B' : '#EF4444', display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' }}>
                        <Clock style={{ width: 14, height: 14 }} />
                        {otpCountdown > 0 ? (
                          <span>Expires in {Math.floor(otpCountdown / 60)}:{(otpCountdown % 60).toString().padStart(2, '0')}</span>
                        ) : (
                          <span>OTP Expired. Please request a new OTP.</span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={handleCancelOtp}
                          style={{
                            padding: '14px 0', borderRadius: 14, border: '1.5px solid #E2E8F0',
                            background: '#FFFFFF', color: '#475569', fontSize: 13, fontWeight: 800,
                            cursor: 'pointer', transition: 'all 0.2s'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={isVerifyingOtp || otpCountdown === 0 || otpValue.length !== 6}
                          style={{
                            padding: '14px 0', borderRadius: 14, border: 'none',
                            background: (otpCountdown === 0 || otpValue.length !== 6) ? '#CBD5E1' : 'linear-gradient(135deg, #10B981, #059669)',
                            color: '#FFFFFF', fontSize: 13, fontWeight: 800,
                            cursor: (otpCountdown === 0 || otpValue.length !== 6) ? 'default' : 'pointer',
                            boxShadow: (otpCountdown === 0 || otpValue.length !== 6) ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isVerifyingOtp ? 'Verifying...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
