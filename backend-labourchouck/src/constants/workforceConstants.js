export const REQUEST_SOURCE = {
  INDIVIDUAL: 'individual',
  CORPORATE: 'corporate',
}

export const REQUEST_STATUS = {
  SEARCHING: 'searching',
  PENDING_REVIEW: 'pending_review',
  CONFIRMED: 'confirmed',
  ALLOCATING: 'allocating',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  PLATFORM_FEE_PENDING: 'platform_fee_pending',
  
  // New Corporate-Vendor B2B Lead Fee flow statuses
  VENDOR_ACCEPTED: 'vendor_accepted',
  VENDOR_PLATFORM_FEE_PENDING: 'vendor_platform_fee_pending',
  VENDOR_PLATFORM_FEE_PAID: 'vendor_platform_fee_paid',
  CORPORATE_PLATFORM_FEE_PENDING: 'corporate_platform_fee_pending',
  CORPORATE_PLATFORM_FEE_PAID: 'corporate_platform_fee_paid',
  QUOTATION_UNLOCKED: 'quotation_unlocked',
  QUOTATION_SENT: 'quotation_sent',
  QUOTATION_ACCEPTED: 'quotation_accepted',
  WORK_STARTED: 'work_started',
  
  IN_PROGRESS: 'in_progress',
  ON_SITE: 'on_site',
  ATTENDANCE: 'attendance_tracking',
  BILLING: 'billing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  PAYMENT_PENDING: 'payment_pending',
  ADVANCE_PAID: 'advance_paid',
  PROJECT_ACTIVE: 'project_active',
  SETTLEMENT_PENDING: 'settlement_pending',
  SETTLEMENT_ON_HOLD: 'settlement_on_hold',
  PARTIALLY_RELEASED: 'partially_released',
  SETTLEMENT_COMPLETED: 'settlement_completed',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed',
}

export const SCHEDULE_TYPE = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  LONG_TERM: 'long_term',
}

export const ASSIGNMENT_STATUS = {
  OFFERED: 'offered',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  ON_SITE: 'on_site',
  COMPLETED: 'completed',
  REPLACED: 'replaced',
}

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  HALF_DAY: 'half_day',
  LATE: 'late',
}

export const PROJECT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
}

export const INVOICE_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
}

export const BILLING_MODE = {
  PREPAID: 'prepaid',
  POSTPAID: 'postpaid',
  MILESTONE: 'milestone',
}
