import { KycDocumentUploadField } from '../labour/kyc/KycDocumentUploadField.jsx'

export const VENDOR_KYC_SLOTS = [
  {
    id: 'aadhaar_front',
    label: 'Aadhaar Card (Front)',
    desc: 'Proprietor / Signatory front side with photo and details',
    required: true,
    aspectRatio: 1.586,
    cropShape: 'rect',
  },
  {
    id: 'aadhaar_back',
    label: 'Aadhaar Card (Back)',
    desc: 'Back side with address and barcode / QR code',
    required: true,
    aspectRatio: 1.586,
    cropShape: 'rect',
  },
  {
    id: 'pan',
    label: 'Business / Proprietor PAN Card',
    desc: 'Clear photo of Business or Proprietor PAN card',
    required: true,
    aspectRatio: 1.586,
    cropShape: 'rect',
  },
  {
    id: 'selfie',
    label: 'Proprietor / Contractor Selfie',
    desc: 'Clear live face photo / selfie of authorized person (optional)',
    required: false,
    aspectRatio: 1.0,
    cropShape: 'rect',
  },
]

export const CORPORATE_KYC_SLOTS = [
  {
    id: 'aadhaar_front',
    label: 'Authorized Signatory Aadhaar (Front)',
    desc: 'Front side with photo and full name of Signatory / Director',
    required: true,
    aspectRatio: 1.586,
    cropShape: 'rect',
  },
  {
    id: 'aadhaar_back',
    label: 'Authorized Signatory Aadhaar (Back)',
    desc: 'Back side with address of Authorized Signatory',
    required: true,
    aspectRatio: 1.586,
    cropShape: 'rect',
  },
  {
    id: 'pan',
    label: 'Company / Corporate PAN Card',
    desc: 'Clear photo of Company / Firm PAN card or certificate',
    required: true,
    aspectRatio: 1.586,
    cropShape: 'rect',
  },
  {
    id: 'selfie',
    label: 'Authorized Person Live Photo / Selfie',
    desc: 'Live face photo / selfie of representative (optional)',
    required: false,
    aspectRatio: 1.0,
    cropShape: 'rect',
  },
]

export function BusinessKycPhotoUploadGrid({
  variant = 'vendor', // 'vendor' | 'corporate' | 'enterprise'
  photos = {},
  onChange,
  disabled = false,
  errors = {},
}) {
  const slots = variant === 'vendor' ? VENDOR_KYC_SLOTS : CORPORATE_KYC_SLOTS

  const handleSlotChange = (slotId, stagedData) => {
    onChange?.({
      ...photos,
      [slotId]: stagedData, // { file: File, previewUrl: string, dataUrl: string }
    })
  }

  const handleSlotDelete = (slotId) => {
    if (disabled) return
    const updated = { ...photos }
    delete updated[slotId]
    onChange?.(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            KYC Identity Photos & Cards
          </p>
          <p className="text-xs text-slate-600">
            Select or capture documents with real-time crop, zoom preview, and direct file upload.
          </p>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {slots.map((slot) => {
          const slotValue = photos[slot.id]
          const slotError = errors[slot.id]

          return (
            <KycDocumentUploadField
              key={slot.id}
              id={slot.id}
              label={slot.label}
              description={slot.desc}
              required={slot.required}
              aspectRatio={slot.aspectRatio}
              cropShape={slot.cropShape}
              value={slotValue}
              onChange={(stagedData) => handleSlotChange(slot.id, stagedData)}
              onDelete={() => handleSlotDelete(slot.id)}
              disabled={disabled}
              error={slotError}
            />
          )
        })}
      </div>
    </div>
  )
}
