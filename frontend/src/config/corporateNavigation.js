import {
  BarChart3,
  Building2,
  ClipboardList,
  Clock,
  FileText,
  Home,
  LifeBuoy,
  UserRound,
  Wallet,
} from 'lucide-react'

export const corporateNavigation = {
  headerTagline: 'Bulk workforce, billing & projects',
  bottomNav: [
    { id: 'home', to: '/corporate', label: 'Home', icon: Home, end: true },
    { id: 'projects', to: '/corporate/projects', label: 'Projects', icon: Building2 },
    { id: 'requests', to: '/corporate/requests', label: 'Requests', icon: ClipboardList },
    { id: 'attendance', to: '/corporate/attendance', label: 'Attendance', icon: Clock },
    { id: 'profile', to: '/corporate/profile', label: 'Profile', icon: UserRound },
  ],
  drawerNav: [
    { id: 'home', to: '/corporate', label: 'Dashboard', icon: Home, end: true },
    { id: 'projects', to: '/corporate/projects', label: 'Projects & sites', icon: Building2 },
    { id: 'requests', to: '/corporate/requests', label: 'Workforce requests', icon: ClipboardList },
    { id: 'attendance', to: '/corporate/attendance', label: 'Attendance', icon: Clock },
    { id: 'billing', to: '/corporate/billing', label: 'Billing & invoices', icon: FileText },
    { id: 'wallet', to: '/corporate/wallet', label: 'Wallet & Top-up', icon: Wallet },
    { id: 'analytics', to: '/corporate/analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'support', to: '/corporate/support', label: 'Support', icon: LifeBuoy },
    { id: 'profile', to: '/corporate/profile', label: 'Profile & KYC', icon: UserRound },
  ],
}

export function getCorporateTitle(pathname) {
  if (pathname.startsWith('/corporate/projects/new')) return 'New project'
  if (pathname.match(/\/corporate\/projects\/[^/]+$/)) return 'Project'
  if (pathname.startsWith('/corporate/projects')) return 'Projects'
  if (pathname.startsWith('/corporate/requests/new')) return 'New request'
  if (pathname.match(/\/corporate\/requests\/[^/]+$/)) return 'Request'
  if (pathname.startsWith('/corporate/requests')) return 'Requests'
  if (pathname.startsWith('/corporate/attendance')) return 'Attendance'
  if (pathname.startsWith('/corporate/billing')) return 'Billing'
  if (pathname.startsWith('/corporate/wallet')) return 'Wallet'
  if (pathname.startsWith('/corporate/analytics')) return 'Analytics'
  if (pathname.startsWith('/corporate/support')) return 'Support'
  if (pathname.startsWith('/corporate/profile')) return 'Profile'
  return 'Dashboard'
}
