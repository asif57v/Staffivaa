import { KycDocumentUploadField } from './KycDocumentUploadField.jsx'

export const KYC_SLOTS = [
  {
    id: 'aadhaar_front',
    label: 'Aadhaar Card (Front)',
    desc: 'Front side with photo and full details',
    required: true,
    aspectRatio: 1.586,
    cropShape: 'rect',
  },
  {
    id: 'aadhaar_back',
    label: 'Aadhaar Card (Back)',
    desc: 'Back side with address and barcode',
    required: true,
    aspectRatio: 1.586,
    cropShape: 'rect',
  },
  {
    id: 'pan',
    label: 'PAN Card',
    desc: 'Clear photo of your PAN card',
    required: true,
    aspectRatio: 1.586,
    cropShape: 'rect',
  },
  {
    id: 'selfie',
    label: 'Worker Selfie / Live Face Photo',
    desc: 'Clear face photo (optional)',
    required: false,
    aspectRatio: 1.0,
    cropShape: 'rect',
  },
]

export function LabourKycPhotoUploadGrid({
  photos = {},
  onChange,
  disabled = false,
  errors = {},
}) {
  const handleSlotChange = (slotId, stagedData) => {
    onChange?.({
      ...photos,
      [slotId]: stagedData, // { file: File, previewUrl: string }
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
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">KYC Photos & Documents</p>
          <p className="text-xs text-slate-600">
            Select or capture your documents. You can crop, view full size, or adjust them before submitting.
          </p>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {KYC_SLOTS.map((slot) => {
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
