/** Keep in sync with backend `corporateVerification.js` */
export const CORPORATE_DOCUMENT_TYPES = {
  AADHAAR_FRONT: 'aadhaar_front',
  AADHAAR_BACK: 'aadhaar_back',
  PAN: 'pan',
  SELFIE: 'selfie',
  COMPANY_REGISTRATION: 'company_registration',
  GST_CERTIFICATE: 'gst_certificate',
  PAN_CARD: 'pan_card',
  CIN_CERTIFICATE: 'cin_certificate',
  AUTHORIZED_SIGNATORY_ID: 'authorized_signatory_id',
  CANCELLED_CHEQUE: 'cancelled_cheque',
  OTHER: 'other',
}

/** Corporate KYC takes a single Aadhaar card photo (stored as `aadhaar_front` / `kycFrontImageUrl`).
 *  Back / PAN / selfie types stay listed only so older uploads still resolve a label. */
export const CORPORATE_DOCUMENT_OPTIONS = [
  { value: CORPORATE_DOCUMENT_TYPES.AADHAAR_FRONT, label: 'Authorized Signatory Aadhaar Card' },
  { value: CORPORATE_DOCUMENT_TYPES.AADHAAR_BACK, label: 'Authorized Signatory Aadhaar (Back)' },
  { value: CORPORATE_DOCUMENT_TYPES.PAN, label: 'Company / Director PAN Card' },
  { value: CORPORATE_DOCUMENT_TYPES.SELFIE, label: 'Authorized Representative Selfie / Live Face Photo' },
  { value: CORPORATE_DOCUMENT_TYPES.COMPANY_REGISTRATION, label: 'Company registration / COI' },
  { value: CORPORATE_DOCUMENT_TYPES.GST_CERTIFICATE, label: 'GST registration certificate' },
  { value: CORPORATE_DOCUMENT_TYPES.PAN_CARD, label: 'Company PAN card' },
  { value: CORPORATE_DOCUMENT_TYPES.CIN_CERTIFICATE, label: 'CIN / LLPIN certificate' },
  { value: CORPORATE_DOCUMENT_TYPES.AUTHORIZED_SIGNATORY_ID, label: 'Authorized signatory ID' },
  { value: CORPORATE_DOCUMENT_TYPES.CANCELLED_CHEQUE, label: 'Cancelled cheque / bank proof' },
  { value: CORPORATE_DOCUMENT_TYPES.OTHER, label: 'Other supporting document' },
]

export const CORPORATE_DOCUMENT_LABELS = Object.fromEntries(
  CORPORATE_DOCUMENT_OPTIONS.map((o) => [o.value, o.label]),
)

/** Types captured by the KYC photo slot — not offered again in the "additional documents" picker. */
const CORPORATE_KYC_PHOTO_TYPES = new Set([
  CORPORATE_DOCUMENT_TYPES.AADHAAR_FRONT,
  CORPORATE_DOCUMENT_TYPES.AADHAAR_BACK,
  CORPORATE_DOCUMENT_TYPES.PAN,
  CORPORATE_DOCUMENT_TYPES.SELFIE,
])

export const CORPORATE_ADDITIONAL_DOCUMENT_OPTIONS = CORPORATE_DOCUMENT_OPTIONS.filter(
  (o) => !CORPORATE_KYC_PHOTO_TYPES.has(o.value),
)


export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Puducherry',
  'Chandigarh',
]
