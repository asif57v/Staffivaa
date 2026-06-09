import {
  ClipboardList,
  Clock,
  Home,
  IndianRupee,
  LifeBuoy,
  UserRound,
  Users,
  FileText,
} from 'lucide-react'

export const vendorNavigation = {
  headerTagline: 'Supply crews & track deployments',
  bottomNav: [
    { id: 'home', to: '/vendor', label: 'Home', icon: Home, end: true },
    { id: 'requests', to: '/vendor/requests', label: 'Requests', icon: FileText },
    { id: 'jobs', to: '/vendor/jobs', label: 'Jobs', icon: ClipboardList },
    { id: 'crew', to: '/vendor/crew', label: 'Crew', icon: Users },
    { id: 'profile', to: '/vendor/profile', label: 'Profile', icon: UserRound },
  ],
  drawerNav: [
    { id: 'home', to: '/vendor', label: 'Dashboard', icon: Home, end: true },
    { id: 'requests', to: '/vendor/requests', label: 'Marketplace', icon: FileText },
    { id: 'jobs', to: '/vendor/jobs', label: 'Supply jobs', icon: ClipboardList },
    { id: 'crew', to: '/vendor/crew', label: 'Workforce', icon: Users },
    { id: 'attendance', to: '/vendor/attendance', label: 'Attendance', icon: Clock },
    { id: 'earnings', to: '/vendor/earnings', label: 'Earnings', icon: IndianRupee },
    { id: 'support', to: '/vendor/support', label: 'Support', icon: LifeBuoy },
    { id: 'profile', to: '/vendor/profile', label: 'Profile', icon: UserRound },
  ],
}

export function getVendorTitle(pathname) {
  if (pathname.startsWith('/vendor/crew/new')) return 'Add crew'
  if (pathname.match(/\/vendor\/crew\/[^/]+$/)) return 'Crew member'
  if (pathname.startsWith('/vendor/crew')) return 'Crew'
  if (pathname.startsWith('/vendor/requests')) return 'Requests'
  if (pathname.match(/\/vendor\/jobs\/[^/]+$/)) return 'Job'
  if (pathname.startsWith('/vendor/jobs')) return 'Jobs'
  if (pathname.startsWith('/vendor/attendance')) return 'Attendance'
  if (pathname.startsWith('/vendor/earnings')) return 'Earnings'
  if (pathname.startsWith('/vendor/support')) return 'Support'
  if (pathname.startsWith('/vendor/profile')) return 'Profile'
  return 'Dashboard'
}
