/** Keep in sync with backend `vendorVerification.js` */
export const VENDOR_TYPES = {
  SOLE_PROPRIETOR: 'sole_proprietor',
  PARTNERSHIP: 'partnership_firm',
  PRIVATE_LIMITED: 'private_limited',
  LABOUR_CONTRACTOR: 'labour_contractor',
  MANPOWER_SUPPLIER: 'manpower_supplier',
  SUB_CONTRACTOR: 'sub_contractor',
  OTHER: 'other',
}

export const VENDOR_TYPE_OPTIONS = [
  { value: VENDOR_TYPES.SOLE_PROPRIETOR, label: 'Sole proprietor / individual contractor' },
  { value: VENDOR_TYPES.PARTNERSHIP, label: 'Partnership firm' },
  { value: VENDOR_TYPES.PRIVATE_LIMITED, label: 'Private limited company' },
  { value: VENDOR_TYPES.LABOUR_CONTRACTOR, label: 'Registered labour contractor (CLRA)' },
  { value: VENDOR_TYPES.MANPOWER_SUPPLIER, label: 'Manpower / staffing supplier' },
  { value: VENDOR_TYPES.SUB_CONTRACTOR, label: 'Sub-contractor / work order vendor' },
  { value: VENDOR_TYPES.OTHER, label: 'Other business type' },
]

export const VENDOR_TYPE_LIST = VENDOR_TYPE_OPTIONS.map((o) => o.value)

export const VENDOR_TYPE_LABELS = Object.fromEntries(VENDOR_TYPE_OPTIONS.map((o) => [o.value, o.label]))

export const VENDOR_DOCUMENT_TYPES = {
  SHOP_ESTABLISHMENT: 'shop_establishment',
  GST_CERTIFICATE: 'gst_certificate',
  PAN_CARD: 'pan_card',
  LABOUR_LICENSE: 'labour_contractor_license',
  MSME_UDYAM: 'msme_udyam',
  PARTNERSHIP_DEED: 'partnership_deed',
  PROPRIETOR_ID: 'proprietor_kyc',
  PF_ESI: 'pf_esi_registration',
  CANCELLED_CHEQUE: 'cancelled_cheque',
  OTHER: 'other',
}

export const VENDOR_DOCUMENT_OPTIONS = [
  { value: VENDOR_DOCUMENT_TYPES.SHOP_ESTABLISHMENT, label: 'Shop & establishment / business registration' },
  { value: VENDOR_DOCUMENT_TYPES.GST_CERTIFICATE, label: 'GST registration certificate' },
  { value: VENDOR_DOCUMENT_TYPES.PAN_CARD, label: 'Business PAN card' },
  { value: VENDOR_DOCUMENT_TYPES.LABOUR_LICENSE, label: 'Labour contractor licence (CLRA)' },
  { value: VENDOR_DOCUMENT_TYPES.MSME_UDYAM, label: 'MSME / Udyam certificate' },
  { value: VENDOR_DOCUMENT_TYPES.PARTNERSHIP_DEED, label: 'Partnership deed' },
  { value: VENDOR_DOCUMENT_TYPES.PROPRIETOR_ID, label: 'Proprietor / partner ID (Aadhaar–PAN)' },
  { value: VENDOR_DOCUMENT_TYPES.PF_ESI, label: 'PF / ESI registration (if applicable)' },
  { value: VENDOR_DOCUMENT_TYPES.CANCELLED_CHEQUE, label: 'Cancelled cheque / bank proof' },
  { value: VENDOR_DOCUMENT_TYPES.OTHER, label: 'Other supporting document' },
]

export const VENDOR_DOCUMENT_LABELS = Object.fromEntries(
  VENDOR_DOCUMENT_OPTIONS.map((o) => [o.value, o.label]),
)

/** Suggested document types per vendor category */
export const VENDOR_TYPE_DOCUMENT_HINTS = {
  [VENDOR_TYPES.SOLE_PROPRIETOR]: [
    VENDOR_DOCUMENT_TYPES.SHOP_ESTABLISHMENT,
    VENDOR_DOCUMENT_TYPES.PAN_CARD,
    VENDOR_DOCUMENT_TYPES.PROPRIETOR_ID,
  ],
  [VENDOR_TYPES.PARTNERSHIP]: [
    VENDOR_DOCUMENT_TYPES.PARTNERSHIP_DEED,
    VENDOR_DOCUMENT_TYPES.PAN_CARD,
    VENDOR_DOCUMENT_TYPES.GST_CERTIFICATE,
  ],
  [VENDOR_TYPES.PRIVATE_LIMITED]: [
    VENDOR_DOCUMENT_TYPES.SHOP_ESTABLISHMENT,
    VENDOR_DOCUMENT_TYPES.GST_CERTIFICATE,
    VENDOR_DOCUMENT_TYPES.PAN_CARD,
  ],
  [VENDOR_TYPES.LABOUR_CONTRACTOR]: [
    VENDOR_DOCUMENT_TYPES.LABOUR_LICENSE,
    VENDOR_DOCUMENT_TYPES.PAN_CARD,
    VENDOR_DOCUMENT_TYPES.PF_ESI,
  ],
  [VENDOR_TYPES.MANPOWER_SUPPLIER]: [
    VENDOR_DOCUMENT_TYPES.SHOP_ESTABLISHMENT,
    VENDOR_DOCUMENT_TYPES.GST_CERTIFICATE,
    VENDOR_DOCUMENT_TYPES.PF_ESI,
  ],
  [VENDOR_TYPES.SUB_CONTRACTOR]: [
    VENDOR_DOCUMENT_TYPES.SHOP_ESTABLISHMENT,
    VENDOR_DOCUMENT_TYPES.PAN_CARD,
    VENDOR_DOCUMENT_TYPES.GST_CERTIFICATE,
  ],
  [VENDOR_TYPES.OTHER]: [VENDOR_DOCUMENT_TYPES.OTHER],
}

export { INDIAN_STATES } from './corporateVerification.js'
