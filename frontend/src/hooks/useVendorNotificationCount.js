import { useEffect, useState, useMemo } from 'react'
import { useGetVendorJobsQuery, useGetVendorMarketplaceRequestsQuery } from '../store/api/workforceApi.js'

export function useVendorNotificationCount(enabled = true) {
  const { data: jobsData } = useGetVendorJobsQuery(undefined, { skip: !enabled })
  const { data: requestsData } = useGetVendorMarketplaceRequestsQuery(undefined, { skip: !enabled })

  const [lastViewedJobs, setLastViewedJobs] = useState(() => localStorage.getItem('last_viewed_vendor_jobs') || 0)
  const [lastViewedRequests, setLastViewedRequests] = useState(() => localStorage.getItem('last_viewed_vendor_requests') || 0)

  useEffect(() => {
    const handleUpdate = () => {
      setLastViewedJobs(localStorage.getItem('last_viewed_vendor_jobs') || 0)
      setLastViewedRequests(localStorage.getItem('last_viewed_vendor_requests') || 0)
    }
    window.addEventListener('vendor-notifications-viewed', handleUpdate)
    return () => window.removeEventListener('vendor-notifications-viewed', handleUpdate)
  }, [])

  const counts = useMemo(() => {
    let jobsCount = 0
    let requestsCount = 0

    if (jobsData?.allocations) {
      jobsCount = jobsData.allocations.filter(a => a.createdAt && new Date(a.createdAt).getTime() > Number(lastViewedJobs)).length
    }
    if (requestsData?.requests) {
      requestsCount = requestsData.requests.filter(r => r.createdAt && new Date(r.createdAt).getTime() > Number(lastViewedRequests)).length
    }
    
    return {
      total: jobsCount + requestsCount,
      jobs: jobsCount,
      requests: requestsCount
    }
  }, [jobsData, requestsData, lastViewedJobs, lastViewedRequests])

  return counts
}

export function markVendorJobsViewed() {
  localStorage.setItem('last_viewed_vendor_jobs', Date.now().toString())
  window.dispatchEvent(new CustomEvent('vendor-notifications-viewed'))
}

export function markVendorRequestsViewed() {
  localStorage.setItem('last_viewed_vendor_requests', Date.now().toString())
  window.dispatchEvent(new CustomEvent('vendor-notifications-viewed'))
}
