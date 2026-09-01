/** Normalize wallet API / assignments walletPolicy payloads. */
export function readLabourWalletPolicy({ assignmentsData, walletData, user } = {}) {
  const fromAssignments = assignmentsData?.walletPolicy
  const fromWallet = walletData

  const balance = Number(
    fromAssignments?.balance ??
      fromWallet?.balance ??
      user?.walletBalance ??
      0,
  )
  const minimumRequired = Number(
    fromAssignments?.minimumRequired ??
      fromWallet?.minimumLabourWalletBalance ??
      0,
  )
  const isFrozen = Boolean(fromAssignments?.isFrozen)
  const hasMinimumRequirement = minimumRequired > 0
  const meetsMinimum = !hasMinimumRequirement || balance >= minimumRequired

  const canAcceptBookings = !isFrozen && meetsMinimum

  // Only warn/recharge when admin has set a positive minimum balance requirement.
  const isLowBalance = hasMinimumRequirement && !meetsMinimum && !isFrozen

  return {
    balance,
    minimumRequired,
    isFrozen,
    isLowBalance,
    canAcceptBookings,
  }
}

export function readApiErrorPayload(error) {
  return error?.data ?? error ?? {}
}

/** Build wallet gate modal state from accept API errors. */
export function readWalletGateFromError(error, walletPolicy) {
  const payload = readApiErrorPayload(error)
  if (payload?.code !== 'INSUFFICIENT_WALLET_BALANCE') return null

  const balance = Number(payload?.errors?.balance ?? walletPolicy?.balance ?? 0)
  const minimumRequired = Number(payload?.errors?.minimumRequired ?? walletPolicy?.minimumRequired ?? 0)
  const requiredAmount = Number(
    payload?.errors?.requiredBalance ??
      payload?.errors?.platformFee ??
      minimumRequired,
  )

  if (requiredAmount <= 0 && minimumRequired <= 0) return null

  return { balance, minimumRequired, requiredAmount }
}
