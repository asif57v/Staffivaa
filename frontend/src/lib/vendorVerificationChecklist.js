import { VENDOR_TYPE_LIST } from '../constants/vendorVerification.js'

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

export function getVendorVerificationChecklist(profile = {}) {
  const gst = normalizeGst(profile.gstNumber)
  const hasGst = gst.length > 0
  const docCount = Array.isArray(profile.documents) ? profile.documents.length : 0
  const vendorType = String(profile.vendorType || '').trim()

  return [
    {
      id: 'business_name',
      label: 'Registered business name',
      done: Boolean(String(profile.businessName || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'vendor_type',
      label: 'Business / vendor type',
      done: VENDOR_TYPE_LIST.includes(vendorType),
      required: true,
      section: 'form',
    },
    {
      id: 'business_address',
      label: 'Business address',
      done: Boolean(String(profile.businessAddress || '').trim()),
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
      label: 'Business PAN (10 characters)',
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
      hint: hasGst ? 'Enter a valid 15-character GSTIN or clear the field' : 'Optional',
    },
    {
      id: 'contact_details',
      label: 'Contact person & email',
      done: true,
      required: false,
      section: 'optional',
    },
  ]
}

export function getVendorVerificationProgress(profile = {}) {
  const checklist = getVendorVerificationChecklist(profile)
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

export function buildVendorProfileFromForm(form) {
  return {
    businessName: form.businessName,
    vendorType: form.vendorType,
    gstNumber: form.gstNumber,
    panNumber: form.panNumber,
    businessAddress: form.businessAddress,
    city: form.city,
    state: form.state,
    pincode: form.pincode,
    contactPersonName: form.contactPersonName,
    contactEmail: form.contactEmail,
    contactPhone: form.contactPhone,
    documents: form.documents,
  }
}
