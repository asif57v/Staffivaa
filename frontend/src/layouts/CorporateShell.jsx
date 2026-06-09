import { useMemo } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { CORPORATE_STATUS } from '../constants/userRoles.js'
import { corporateNavigation, getCorporateTitle } from '../config/corporateNavigation.js'
import { PanelShell } from './PanelShell.jsx'

export function CorporateShell() {
  const { user } = useAuth()
  const { headerTagline, bottomNav, drawerNav } = corporateNavigation

  const headerBadge = useMemo(() => {
    const s = user?.corporateProfile?.status
    if (s === CORPORATE_STATUS.PENDING) return { label: 'Approval pending', variant: 'amber' }
    if (s === CORPORATE_STATUS.REJECTED) return { label: 'Not approved', variant: 'rose' }
    if (s === CORPORATE_STATUS.APPROVED) return { label: 'Approved', variant: 'emerald' }
    return null
  }, [user])

  return (
    <PanelShell
      panelId="corporate"
      brandLabel="Corporate"
      headerTagline={headerTagline}
      bottomNav={bottomNav}
      drawerNav={drawerNav}
      getTitle={getCorporateTitle}
      headerBadge={headerBadge}
      accentClass="[--panel-accent:var(--color-brand)]"
    />
  )
}
