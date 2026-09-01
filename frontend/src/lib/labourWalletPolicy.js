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

  const canAcceptBookings =
    !isFrozen &&
    (fromAssignments?.canAcceptBookings ??
      (minimumRequired > 0 ? balance >= minimumRequired : balance > 0))

  const isLowBalance = !canAcceptBookings

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
