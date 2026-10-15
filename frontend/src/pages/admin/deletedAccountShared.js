export const ROLE_LABEL = {
  individual: 'Individual',
  corporate: 'Corporate',
  enterprise: 'Enterprise',
  contractor: 'Vendor',
  labour: 'Worker',
}

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
