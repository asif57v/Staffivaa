/**
 * B2C app navigation — Individual + Labour only (/app).
 */
import {
  CalendarClock,
  ClipboardList,
  Clock,
  HardHat,
  Home,
  IndianRupee,
  LifeBuoy,
  Package,
  ShieldCheck,
  UserRound,
  Wrench,
} from 'lucide-react'
import { USER_ROLES } from '../constants/userRoles.js'

/** @type {Record<string, { headerTagline: string, bottomNav: object[], drawerNav: object[] }>} */
const byRole = {
  [USER_ROLES.INDIVIDUAL]: {
    headerTagline: 'Hire labour for your home or small site',
    bottomNav: [
      { id: 'home', to: '/app', label: 'Home', icon: Home, end: true },
      { id: 'book', to: '/app/bookings', label: 'History', icon: CalendarClock },
      { id: 'profile', to: '/app/profile', label: 'Profile', icon: UserRound },
    ],
    drawerNav: [
      { id: 'home', to: '/app', label: 'Home', icon: Home, end: true },
      { id: 'book', to: '/app/bookings', label: 'My bookings', icon: ClipboardList },
      { id: 'support', to: '/app/support', label: 'Support & issues', icon: LifeBuoy },
      { id: 'profile', to: '/app/profile', label: 'Profile & settings', icon: UserRound },
    ],
  },
  [USER_ROLES.LABOUR]: {
    headerTagline: 'Jobs, attendance & earnings',
    bottomNav: [
      { id: 'home', to: '/app', label: 'Home', icon: Home, end: true },
      { id: 'jobs', to: '/app/jobs', label: 'Jobs', icon: HardHat },
      { id: 'attendance', to: '/app/attendance', label: 'Attendance', icon: Clock },
      { id: 'earnings', to: '/app/earnings', label: 'Earnings', icon: IndianRupee },
      { id: 'profile', to: '/app/profile', label: 'Profile', icon: UserRound },
    ],
    drawerNav: [
      { id: 'home', to: '/app', label: 'Home', icon: Home, end: true },
      { id: 'jobs', to: '/app/jobs', label: 'Assignments', icon: HardHat },
      { id: 'attendance', to: '/app/attendance', label: 'Attendance', icon: Clock },
      { id: 'earnings', to: '/app/earnings', label: 'Earnings & payouts', icon: IndianRupee },
      { id: 'kyc', to: '/app/kyc', label: 'Aadhaar KYC', icon: ShieldCheck },
      { id: 'workTypes', to: '/app/work-categories', label: 'Work types', icon: Wrench },
      { id: 'support', to: '/app/support', label: 'Support', icon: LifeBuoy },
      { id: 'profile', to: '/app/profile', label: 'Profile', icon: UserRound },
    ],
  },
}

export function getAppNavigation(role) {
  if (role && byRole[role]) return byRole[role]
  return byRole[USER_ROLES.INDIVIDUAL]
}

export function getAppShellTitle(pathname) {
  if (pathname.startsWith('/app/buildmart')) return 'BuildMart'
  if (pathname.startsWith('/app/jobs')) return 'Jobs'
  if (pathname.startsWith('/app/earnings')) return 'Earnings'
  if (pathname.startsWith('/app/attendance')) return 'Attendance'
  if (pathname.startsWith('/app/kyc')) return 'KYC verification'
  if (pathname.startsWith('/app/notifications')) return 'Notifications'
  if (pathname.startsWith('/app/work-categories')) return 'Work types'
  if (pathname.startsWith('/app/booking/flow')) return 'Book labour'
  if (pathname.startsWith('/app/support')) return 'Support'
  if (pathname.startsWith('/app/profile')) return 'Profile'
  if (pathname.startsWith('/app/bookings')) return 'My bookings'
  return 'Home'
}

export function isBuildMartRoute(pathname) {
  return pathname.startsWith('/app/buildmart')
}

export function hideBuildMartShellHeader(pathname) {
  return pathname.startsWith('/app/buildmart/product/')
}
