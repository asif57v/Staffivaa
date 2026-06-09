import { CORPORATE_STATUS } from '../constants/userRoles.js'

export const BUSINESS_WORKFLOW = [
  { id: 'profile', label: 'Company / business details', short: 'Details' },
  { id: 'documents', label: 'Upload verification documents', short: 'Documents' },
  { id: 'submit', label: 'Submit for admin review', short: 'Submit' },
  { id: 'review', label: 'Admin verification', short: 'Review' },
  { id: 'approved', label: 'Approved on platform', short: 'Done' },
]

export function getBusinessVerificationUiState({ status, submittedAt, reviewNote, isApproved }) {
  if (isApproved) {
    return {
      phase: 'approved',
      title: 'Account verified',
      subtitle: 'You have full access to workforce operations on the platform.',
      tone: 'emerald',
    }
  }
  if (status === CORPORATE_STATUS.REJECTED || status === 'rejected') {
    return {
      phase: 'rejected',
      title: 'Verification needs correction',
      subtitle: reviewNote || 'Update your documents and submit again for review.',
      tone: 'rose',
    }
  }
  if (submittedAt && (status === CORPORATE_STATUS.PENDING || status === 'pending')) {
    return {
      phase: 'review',
      title: 'Under admin review',
      subtitle: 'Your documents were submitted and are waiting for manual approval.',
      tone: 'sky',
    }
  }
  return {
    phase: 'submit',
    title: 'Complete business verification',
    subtitle: 'Fill business details, upload at least one document, then submit for review.',
    tone: 'violet',
  }
}

/** 0–4 workflow step index for timeline highlight. */
export function businessWorkflowStepIndex({ status, submittedAt, hasDetails, docCount, isApproved }) {
  if (isApproved) return 4
  if (submittedAt && (status === CORPORATE_STATUS.PENDING || status === 'pending')) return 3
  if (docCount > 0 && hasDetails) return 2
  if (docCount > 0) return 1
  if (hasDetails) return 0
  return 0
}

export const BUSINESS_VERIFICATION_BENEFITS = {
  corporate: [
    { title: 'Bulk workforce requests', desc: 'Post multi-site labour requirements after approval.' },
    { title: 'Projects & attendance', desc: 'Track deployments and verified attendance billing.' },
    { title: 'GST-ready invoices', desc: 'Receive consolidated invoices for your enterprise account.' },
  ],
  vendor: [
    { title: 'Accept crew jobs', desc: 'Required before you can accept assignments on Jobs.' },
    { title: 'Manage linked crew', desc: 'Link labour workers under your verified vendor account.' },
    { title: 'Settlements', desc: 'Receive payouts for completed verified shifts.' },
  ],
}
