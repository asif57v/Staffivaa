export const MIN_NET_WITHDRAW_PAISE = 10000

export const DEFAULT_SERVICE_FEES = {
  platformPercent: 8,
  gstOnPlatformPercent: 18,
  fixedFeePaise: 0,
}

export function computeWithdrawalBreakdown(grossPaise, fees = DEFAULT_SERVICE_FEES) {
  const gross = Math.max(0, Math.round(Number(grossPaise) || 0))
  const platformPercent = Number(fees.platformPercent) || 8
  const gstPercent = Number(fees.gstOnPlatformPercent) || 18
  const fixedFeePaise = Math.max(0, Math.round(Number(fees.fixedFeePaise) || 0))

  const platformFeePaise = Math.round(gross * (platformPercent / 100)) + fixedFeePaise
  const gstOnFeePaise = Math.round(platformFeePaise * (gstPercent / 100))
  const totalDeductionPaise = platformFeePaise + gstOnFeePaise
  const netPaise = Math.max(0, gross - totalDeductionPaise)

  return {
    grossPaise: gross,
    platformFeePaise,
    gstOnFeePaise,
    totalDeductionPaise,
    netPaise,
    platformPercent,
    gstPercent,
    fixedFeePaise,
  }
}

export function maxNetFromAvailableGross(availableGrossPaise, fees = DEFAULT_SERVICE_FEES) {
  return computeWithdrawalBreakdown(availableGrossPaise, fees).netPaise
}
