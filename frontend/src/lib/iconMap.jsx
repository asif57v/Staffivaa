import {
  Banknote,
  Bell,
  BrickWall,
  Building2,
  CalendarClock,
  CheckCircle,
  Droplets,
  Fingerprint,
  Flame,
  Grid3x3,
  Hammer,
  HardHat,
  Headphones,
  Home,
  IdCard,
  IndianRupee,
  Landmark,
  Languages,
  Layers,
  LifeBuoy,
  Lock,
  MapPin,
  MapPinned,
  Paintbrush,
  Search,
  Shield,
  ShieldCheck,
  Siren,
  Star,
  StarHalf,
  Tractor,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  Zap,
  HelpCircle,
} from 'lucide-react'

const map = {
  shield: Shield,
  zap: Zap,
  wallet: Wallet,
  fingerprint: Fingerprint,
  layers: Layers,
  'map-pin': MapPin,
  'check-circle': CheckCircle,
  truck: Truck,
  'user-plus': UserPlus,
  'id-card': IdCard,
  bell: Bell,
  banknote: Banknote,
  'brick-wall': BrickWall,
  paintbrush: Paintbrush,
  hammer: Hammer,
  droplets: Droplets,
  flame: Flame,
  'grid-3x3': Grid3x3,
  'hard-hat': HardHat,
  tractor: Tractor,
  'map-pinned': MapPinned,
  'calendar-clock': CalendarClock,
  'indian-rupee': IndianRupee,
  siren: Siren,
  users: Users,
  languages: Languages,
  star: Star,
  'shield-check': ShieldCheck,
  headphones: Headphones,
  home: Home,
  'building-2': Building2,
  landmark: Landmark,
  'user-check': UserCheck,
  search: Search,
  'star-half': StarHalf,
  lock: Lock,
  'life-buoy': LifeBuoy,
}

export function LandingIcon({ name, className, strokeWidth = 1.75 }) {
  const Cmp = map[name] ?? HelpCircle
  return <Cmp className={className} strokeWidth={strokeWidth} aria-hidden />
}

const pastelStyles = {
  plans: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]' },
  schedule: { bg: 'bg-[#D1FAE5]', text: 'text-[#059669]' },
  delivery: { bg: 'bg-[#DBEAFE]', text: 'text-[#2563EB]' },
  orders: { bg: 'bg-[#EDE9FE]', text: 'text-[#7C3AED]' },
  reviews: { bg: 'bg-[#FEF9C3]', text: 'text-[#CA8A04]' },
  customers: { bg: 'bg-[#FCE7F3]', text: 'text-[#DB2777]' },
  analytics: { bg: 'bg-[#CCFBF1]', text: 'text-[#0D9488]' },
  settings: { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]' },
  home: { bg: 'bg-[#DBEAFE]', text: 'text-[#2563EB]' },
  worker: { bg: 'bg-[#D1FAE5]', text: 'text-[#059669]' },
  booking: { bg: 'bg-[#EDE9FE]', text: 'text-[#7C3AED]' },
  profile: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]' },
}

export function getPastelStyles(icon) {
  if (!icon) return pastelStyles.settings
  let name = ''
  if (typeof icon === 'string') {
    name = icon
  } else if (icon.name) {
    name = icon.name
  } else if (icon.displayName) {
    name = icon.displayName
  } else if (typeof icon === 'function') {
    name = icon.name || ''
  } else if (typeof icon === 'object' && icon !== null) {
    name = icon.name || icon.render?.name || ''
  }

  const normalise = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  if (normalise.includes('layer') || normalise.includes('list') || normalise.includes('file')) return pastelStyles.plans
  if (normalise.includes('calendar') || normalise.includes('clock') || normalise.includes('time')) return pastelStyles.schedule
  if (normalise.includes('truck') || normalise.includes('pin') || normalise.includes('map')) return pastelStyles.delivery
  if (normalise.includes('bag') || normalise.includes('box') || normalise.includes('container') || normalise.includes('zap') || normalise.includes('pipette') || normalise.includes('brick')) return pastelStyles.orders
  if (normalise.includes('star') || normalise.includes('thumb') || normalise.includes('message') || normalise.includes('review')) return pastelStyles.reviews
  if (normalise.includes('user') || normalise.includes('customer') || normalise.includes('people') || normalise.includes('group')) return pastelStyles.customers
  if (normalise.includes('trend') || normalise.includes('chart') || normalise.includes('activity') || normalise.includes('analytic')) return pastelStyles.analytics
  if (normalise.includes('setting') || normalise.includes('slider') || normalise.includes('lock') || normalise.includes('shield')) return pastelStyles.settings
  if (normalise.includes('home') || normalise.includes('grid') || normalise.includes('layout')) return pastelStyles.home
  if (normalise.includes('hat') || normalise.includes('wrench') || normalise.includes('hammer') || normalise.includes('paint') || normalise.includes('roller')) return pastelStyles.worker
  if (normalise.includes('check') || normalise.includes('flame') || normalise.includes('spark') || normalise.includes('book')) return pastelStyles.booking
  if (normalise.includes('id') || normalise.includes('finger') || normalise.includes('profile')) return pastelStyles.profile
  
  return pastelStyles.settings
}
