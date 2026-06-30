/**
 * Admin sidebar — aligned with Work Scope (Super Control Panel modules).
 */
import {
  LayoutDashboard,
  Users,
  IdCard,
  FileCheck,
  Layers,
  ClipboardList,
  Package,
  Network,
  Clock,
  Wallet,
  BadgeIndianRupee,
  BarChart3,
  Settings,
  Home,
  Briefcase,
  HardHat,
  Truck,
  LineChart,
  History,
  CalendarCheck,
} from 'lucide-react'

/**
 * Admin Labour hub (`/admin/labour`) shows links to these routes — a curated slice of Work Scope modules
 * that touch roster, KYC, deployment, and time records. Edit here to expand the hub without touching the page.
 */
export const ADMIN_LABOUR_HUB_PATHS = new Set([
  '/admin/categories',
  '/admin/users',
  '/admin/bookings',
  '/admin/allocations',
  '/admin/attendance',
])

/**
 * @returns {{ title: string | null, items: { to: string, label: string, icon: import('lucide-react').LucideIcon, end?: boolean }[] }[]}
 */
export function getLabourAdminHubNavGroups() {
  return ADMIN_NAV_SECTIONS.map((section) => ({
    title: section.title,
    items: section.items.filter((item) => ADMIN_LABOUR_HUB_PATHS.has(item.to)),
  })).filter((g) => g.items.length > 0)
}

/** @type {{ title: string | null, items: { to: string, label: string, icon: import('lucide-react').LucideIcon, end?: boolean }[] }[]} */
export const ADMIN_NAV_SECTIONS = [
  {
    title: null,
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'User Management',
    items: [
      { to: '/admin/individuals', label: 'Home / Individual', icon: Home },
      { to: '/admin/corporates', label: 'Corporate Client', icon: Briefcase },
      { to: '/admin/labour', label: 'Labour / Worker', icon: HardHat },
      { to: '/admin/contractors', label: 'Contractor / Vendor', icon: Truck },
    ],
  },
  {
    title: 'Users & business',
    items: [
      { to: '/admin/users', label: 'All Users (Combined)', icon: Users },
      { to: '/admin/business-verification', label: 'Corporate & vendor KYC', icon: FileCheck },
    ],
  },
  {
    title: 'Workforce',
    items: [
      { to: '/admin/labour', label: 'Labour & KYC', icon: IdCard },
      { to: '/admin/categories', label: 'Skill categories', icon: Layers },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/admin/bookings', label: 'Bookings & requests', icon: ClipboardList },
      { to: '/admin/allocations', label: 'Workforce allocation', icon: Network },
      { to: '/admin/attendance', label: 'Attendance', icon: Clock },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/admin/wallet', label: 'Admin Wallet', icon: Wallet },
      { to: '/admin/billing', label: 'Payments & billing', icon: ClipboardList },
      { to: '/admin/pricing', label: 'Pricing Management', icon: BadgeIndianRupee },
    ],
  },
  {
    title: 'Insights',
    items: [{ to: '/admin/reports', label: 'Reports & analytics', icon: BarChart3 }],
  },
  {
    title: 'System',
    items: [{ to: '/admin/settings', label: 'Settings', icon: Settings }],
  },
]

const ROUTE_TITLES = [
  { prefix: '/admin/individuals', title: 'Individual Users' },
  { prefix: '/admin/corporates', title: 'Corporate Clients' },
  { prefix: '/admin/contractors', title: 'Contractors & Vendors' },
  { prefix: '/admin/user', title: 'User Details' },
  { prefix: '/admin/settings', title: 'Settings' },
  { prefix: '/admin/reports', title: 'Reports & analytics' },
  { prefix: '/admin/pricing', title: 'Pricing Management' },
  { prefix: '/admin/billing', title: 'Payments & billing' },
  { prefix: '/admin/payments', title: 'Payment Details' },
  { prefix: '/admin/wallet', title: 'Admin Wallet' },
  { prefix: '/admin/attendance', title: 'Attendance' },
  { prefix: '/admin/allocations', title: 'Workforce allocation' },
  { prefix: '/admin/buildmart', title: 'BuildMart leads' },
  { prefix: '/admin/bookings', title: 'Bookings & requests' },
  { prefix: '/admin/categories', title: 'Skill categories' },
  { prefix: '/admin/business-verification', title: 'Corporate & vendor KYC' },
  { prefix: '/admin/labour', title: 'Labour & KYC' },
  { prefix: '/admin/users', title: 'Individuals & corporates' },
  { prefix: '/admin', title: 'Dashboard' },
]

export function getAdminTitle(pathname) {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname
  for (const { prefix, title } of ROUTE_TITLES) {
    if (path === prefix || (prefix !== '/admin' && path.startsWith(prefix + '/'))) return title
  }
  return 'Admin'
}
