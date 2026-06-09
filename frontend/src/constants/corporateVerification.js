/** Keep in sync with backend `corporateVerification.js` */
export const CORPORATE_DOCUMENT_TYPES = {
  COMPANY_REGISTRATION: 'company_registration',
  GST_CERTIFICATE: 'gst_certificate',
  PAN_CARD: 'pan_card',
  CIN_CERTIFICATE: 'cin_certificate',
  AUTHORIZED_SIGNATORY_ID: 'authorized_signatory_id',
  CANCELLED_CHEQUE: 'cancelled_cheque',
  OTHER: 'other',
}

export const CORPORATE_DOCUMENT_OPTIONS = [
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
