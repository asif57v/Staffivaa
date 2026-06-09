import { useMemo } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { vendorNavigation, getVendorTitle } from '../config/vendorNavigation.js'
import { PanelShell } from './PanelShell.jsx'

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

  return (
    <PanelShell
      panelId="vendor"
      brandLabel="Vendor"
      headerTagline={headerTagline}
      bottomNav={bottomNav}
      drawerNav={drawerNav}
      getTitle={getVendorTitle}
      headerBadge={headerBadge}
      accentClass="[--panel-accent:#d97706]"
    />
  )
}
