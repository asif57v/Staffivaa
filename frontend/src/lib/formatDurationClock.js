/** e.g. 3725 → "1:02:05", 185 → "3:05" (M:SS under 1h). */
export function formatSecondsAsClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  if (h >= 1) return `${h}:${mm}:${ss}`
  return `${m}:${ss}`
}
