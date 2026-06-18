import { useMemo } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { vendorNavigation, getVendorTitle } from '../config/vendorNavigation.js'
import { PanelShell } from './PanelShell.jsx'
import { useVendorNotificationCount } from '../hooks/useVendorNotificationCount.js'

export function VendorShell() {
  const { user } = useAuth()
  const { headerTagline, bottomNav, drawerNav } = vendorNavigation

  const headerBadge = useMemo(() => {
    const v = user?.contractorProfile?.verificationStatus
    if (v === 'pending') return { label: 'Verification pending', variant: 'amber' }
    if (v === 'rejected') return { label: 'Not verified', variant: 'rose' }
    if (v === 'approved') return { label: 'Verified vendor', variant: 'emerald' }
    return null
  }, [user])

  const notifCounts = useVendorNotificationCount()

  const navWithBadges = useMemo(() => {
    return bottomNav.map(item => {
      if (item.id === 'requests' && notifCounts.requests > 0) {
        return { ...item, badge: notifCounts.requests }
      }
      if (item.id === 'jobs' && notifCounts.jobs > 0) {
        return { ...item, badge: notifCounts.jobs }
      }
      return item
    })
  }, [bottomNav, notifCounts])

  return (
    <PanelShell
      panelId="vendor"
      brandLabel="Vendor"
      headerTagline={headerTagline}
      bottomNav={navWithBadges}
      drawerNav={drawerNav}
      getTitle={getVendorTitle}
      headerBadge={headerBadge}
      accentClass="[--panel-accent:#d97706]"
    />
  )
}
