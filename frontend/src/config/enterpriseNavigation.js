import { Briefcase, LayoutDashboard, Users, FileText, Settings, HelpCircle, UserCircle, Wallet, UserCheck } from 'lucide-react'

export const enterpriseNavigation = {
  headerTagline: 'Enterprise Hiring Portal',
  bottomNav: [
    { label: 'Home', path: '/enterprise', icon: LayoutDashboard },
    { label: 'Jobs', path: '/enterprise/jobs', icon: Briefcase },
    { label: 'Applications', path: '/enterprise/applications', icon: FileText },
    { label: 'Workforce', path: '/enterprise/workforce', icon: Users },
  ],
  drawerNav: [
    {
      group: 'Recruitment & Hiring',
      items: [
        { label: 'Dashboard', path: '/enterprise', icon: LayoutDashboard },
        { label: 'Job Requirements', path: '/enterprise/jobs', icon: Briefcase },
        { label: 'Applications', path: '/enterprise/applications', icon: FileText },
        { label: 'Workforce & Joinings', path: '/enterprise/workforce', icon: Users },
      ],
    },
    {
      group: 'Finance & Payments',
      items: [
        { label: 'Payroll & Salary Slips', path: '/enterprise/payroll', icon: FileText },
        { label: 'Wallet & Ledgers', path: '/enterprise/wallet', icon: Wallet },
      ],
    },
    {
      group: 'Account',
      items: [
        { label: 'Settings & KYC', path: '/enterprise/settings', icon: Settings },
        { label: 'Support', path: '/enterprise/support', icon: HelpCircle },
      ],
    },
  ],
}

export function getEnterpriseTitle(pathname) {
  if (pathname === '/enterprise') return 'Dashboard'
  if (pathname.includes('/enterprise/jobs')) return 'Job Requirements'
  if (pathname.includes('/enterprise/applications') || pathname.includes('/enterprise/applicants')) return 'Applications'
  if (pathname.includes('/enterprise/workforce') || pathname.includes('/enterprise/workers')) return 'Workforce & Joinings'
  if (pathname.includes('/enterprise/payroll')) return 'Payroll & Salary Slips'
  if (pathname.includes('/enterprise/wallet')) return 'Enterprise Wallet'
  if (pathname.includes('/enterprise/settings')) return 'Settings & KYC'
  if (pathname.includes('/enterprise/support')) return 'Support'
  if (pathname.includes('/enterprise/profile')) return 'My Profile'
  return 'Enterprise'
}
