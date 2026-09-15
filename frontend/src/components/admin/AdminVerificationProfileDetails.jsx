import { VENDOR_TYPE_LABELS } from '../../constants/vendorVerification.js'

function DetailRow({ label, value, mono }) {
  if (value == null || String(value).trim() === '') return null
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 gap-y-0.5 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`text-sm text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}

function DetailSection({ title, children }) {
  return (
    <section>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
      <dl className="rounded-xl border border-slate-200/90 bg-slate-50/50 px-3">{children}</dl>
    </section>
  )
}

export function AdminVerificationProfileDetails({ user, variant }) {
  const isCorporate = variant === 'corporate'
  const profile = isCorporate ? user?.corporateProfile : user?.contractorProfile

  if (!profile) {
    return <p className="text-sm text-slate-500">No profile data on file.</p>
  }

  const locationLine = [profile.city, profile.state, profile.pincode].filter(Boolean).join(', ')
  const address = isCorporate ? profile.registeredAddress : profile.businessAddress

  return (
    <div className="space-y-4">
      <DetailSection title={isCorporate ? 'Company' : 'Business'}>
        <DetailRow
          label={isCorporate ? 'Company' : 'Business'}
          value={isCorporate ? profile.companyName : profile.businessName}
        />
        {!isCorporate && profile.vendorType ? (
          <DetailRow label="Type" value={VENDOR_TYPE_LABELS[profile.vendorType] || profile.vendorType} />
        ) : null}
        <DetailRow label="PAN" value={profile.panNumber} mono />
        <DetailRow label="GSTIN" value={profile.gstNumber} mono />
        {isCorporate ? <DetailRow label="CIN / LLPIN" value={profile.cinNumber} mono /> : null}
      </DetailSection>

      <DetailSection title="Address">
        <DetailRow label="Street" value={address} />
        <DetailRow label="City / state" value={locationLine || undefined} />
      </DetailSection>

      <DetailSection title="Contact">
        <DetailRow label="Person" value={profile.contactPersonName || user?.fullName} />
        <DetailRow label="Email" value={profile.contactEmail || user?.email} />
        {!isCorporate ? (
          <DetailRow label="Mobile" value={profile.contactPhone ? `+91 ${profile.contactPhone}` : undefined} />
        ) : null}
        <DetailRow label="Account phone" value={user?.phone ? `+91 ${user.phone}` : undefined} mono />
        {isCorporate ? <DetailRow label="Website" value={profile.website} /> : null}
      </DetailSection>

      {!isCorporate && (
        <DetailSection title="Workforce Trades & Capabilities">
          {(() => {
            const cats = profile.categoryIds || []
            const catNames = cats
              .map((c) => (c && typeof c === 'object' && c.name ? c.name : (typeof c === 'string' ? c : null)))
              .filter(Boolean)
            const skills = Array.isArray(profile.skills) ? profile.skills : []
            const all = Array.from(new Set([...catNames, ...skills]))
            if (all.length === 0) {
              return <p className="text-xs text-slate-400 italic">No workforce trades selected yet</p>
            }
            return (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {all.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FFC107] shrink-0" />
                    {s}
                  </span>
                ))}
              </div>
            )
          })()}
        </DetailSection>
      )}

      <DetailSection title="Verification timeline">
        <DetailRow label="Status" value={isCorporate ? profile.status : profile.verificationStatus} />
        <DetailRow
          label="Submitted"
          value={
            profile.documentsSubmittedAt
              ? new Date(profile.documentsSubmittedAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : undefined
          }
        />
        <DetailRow
          label="Reviewed"
          value={
            profile.reviewedAt
              ? new Date(profile.reviewedAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : undefined
          }
        />
      </DetailSection>
    </div>
  )
}
