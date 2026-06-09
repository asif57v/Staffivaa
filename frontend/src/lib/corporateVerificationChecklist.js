import { CORPORATE_DOCUMENT_TYPES } from '../constants/corporateVerification.js'

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PINCODE_RE = /^\d{6}$/

export function normalizePan(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
}

export function normalizeGst(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 15)
}

function isPanFieldComplete(pan) {
  return normalizePan(pan).length === 10
}

/** Checklist mirrors backend `corporateVerification.js` and the profile form fields. */
export function getCorporateVerificationChecklist(profile = {}) {
  const gst = normalizeGst(profile.gstNumber)
  const hasGst = gst.length > 0
  const docCount = Array.isArray(profile.documents) ? profile.documents.length : 0

  return [
    {
      id: 'company_name',
      label: 'Legal company name',
      done: Boolean(String(profile.companyName || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'registered_address',
      label: 'Registered office address',
      done: Boolean(String(profile.registeredAddress || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'city',
      label: 'City',
      done: Boolean(String(profile.city || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'state',
      label: 'State',
      done: Boolean(String(profile.state || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'pincode',
      label: 'PIN code (6 digits)',
      done: PINCODE_RE.test(String(profile.pincode || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'pan_number',
      label: 'Company PAN (10 characters)',
      done: isPanFieldComplete(profile.panNumber),
      required: true,
      section: 'form',
      hint: 'Format: ABCDE1234F',
    },
    {
      id: 'doc_any',
      label: 'At least one verification document',
      done: docCount > 0,
      required: true,
      section: 'documents',
      hint: 'Upload any one type — only one document is mandatory',
    },
    {
      id: 'gst_number',
      label: 'GSTIN',
      done: !hasGst || GST_RE.test(gst),
      required: false,
      section: 'optional',
      hint: hasGst ? 'Enter a valid 15-character GSTIN or clear the field' : 'Optional on the form',
    },
    {
      id: 'cin_number',
      label: 'CIN / LLPIN',
      done: true,
      required: false,
      section: 'optional',
    },
    {
      id: 'contact_details',
      label: 'Contact person & billing email',
      done: true,
      required: false,
      section: 'optional',
    },
  ]
}

export function getCorporateVerificationProgress(profile = {}) {
  const checklist = getCorporateVerificationChecklist(profile)
  const required = checklist.filter((i) => i.required)
  const requiredDone = required.filter((i) => i.done).length
  const formItems = required.filter((i) => i.section === 'form')
  const formDone = formItems.filter((i) => i.done).length
  const docCount = Array.isArray(profile.documents) ? profile.documents.length : 0

  return {
    checklist,
    requiredTotal: required.length,
    requiredDone,
    formComplete: formItems.length > 0 && formDone === formItems.length,
    hasDocument: docCount > 0,
    readyToSubmit: required.length > 0 && requiredDone === required.length,
  }
}

export function buildProfileFromForm(form) {
  return {
    companyName: form.companyName,
    gstNumber: form.gstNumber,
    panNumber: form.panNumber,
    cinNumber: form.cinNumber,
    registeredAddress: form.registeredAddress,
    city: form.city,
    state: form.state,
    pincode: form.pincode,
    contactPersonName: form.contactPersonName,
    contactEmail: form.contactEmail,
    website: form.website,
    documents: form.documents,
  }
}
