import { KYC_STATUS } from '../constants/userRoles.js'

export const KYC_WORKFLOW = [
  { id: 'aadhaar', label: 'Enter Aadhaar number', short: 'Aadhaar' },
  { id: 'pan', label: 'Enter PAN number', short: 'PAN' },
  { id: 'photos', label: 'Upload document photos', short: 'Photos' },
  { id: 'review', label: 'Admin verification', short: 'Review' },
  { id: 'verified', label: 'Verified on platform', short: 'Done' },
]

/** Timeline copy when Aadhaar/PAN were already submitted and only photos need redo. */
export const KYC_WORKFLOW_RESUBMIT = [
  { id: 'aadhaar', label: 'Aadhaar saved', short: 'Aadhaar' },
  { id: 'pan', label: 'PAN saved', short: 'PAN' },
  { id: 'photos', label: 'Upload new KYC photos', short: 'Photos' },
  { id: 'review', label: 'Admin verification', short: 'Review' },
  { id: 'verified', label: 'Verified on platform', short: 'Done' },
]

export function hasKycDetailsOnFile(labourProfile) {
  return Boolean(labourProfile?.aadhaarMasked?.trim()) && Boolean(labourProfile?.panMasked?.trim())
}

export function getKycUiState(labourProfile) {
  const kyc = labourProfile?.kycStatus || KYC_STATUS.PENDING
  const submittedAt = labourProfile?.kycSubmittedAt
  const reviewNote = labourProfile?.kycReviewNote

  if (kyc === KYC_STATUS.VERIFIED) {
    return {
      phase: 'verified',
      title: 'KYC verified',
      subtitle: 'You can accept jobs and receive payouts on verified sites.',
      tone: 'emerald',
    }
  }
  if (kyc === KYC_STATUS.PENDING && submittedAt) {
    return {
      phase: 'review',
      title: 'Under admin review',
      subtitle: 'Your KYC photos were submitted and are waiting for manual approval.',
      tone: 'sky',
    }
  }
  if (kyc === KYC_STATUS.FAILED) {
    return {
      phase: 'failed',
      title: 'Verification needs correction',
      subtitle: reviewNote || 'Upload clearer Aadhaar and document photos, then submit again.',
      tone: 'rose',
    }
  }
  return {
    phase: 'submit',
    title: 'Complete your KYC',
    subtitle: 'Upload Aadhaar photos and selfie from camera or gallery to unlock jobs.',
    tone: 'violet',
  }
}

/** 0–4 workflow step for timeline highlight. */
export function kycWorkflowStepIndex({
  kycStatus,
  submittedAt,
  aadhaarDigits,
  panValid,
  detailsOnFile = false,
}) {
  if (kycStatus === KYC_STATUS.VERIFIED) return 4
  if (kycStatus === KYC_STATUS.PENDING && submittedAt) return 3

  const detailsComplete = detailsOnFile || (panValid && aadhaarDigits === 12)
  if (detailsComplete) return 2

  if (aadhaarDigits === 12) return 1
  if (aadhaarDigits >= 4) return 0
  return 0
}

export const KYC_BENEFITS = [
  { title: 'Accept job offers', desc: 'Required before you can accept shifts on Jobs.' },
  { title: 'Trusted on site', desc: 'Contractors see a verified badge on your profile.' },
  { title: 'Faster payouts', desc: 'Payroll and withdrawals link to your verified identity.' },
]
