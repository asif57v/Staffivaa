/**
 * Phone-style ring for the admin panel when a new request (individual / corporate / enterprise) arrives.
 * Synthesised with Web Audio so no audio asset is needed. Browsers only allow audio after a user gesture,
 * so the context is unlocked on the admin's first click/tap/key press.
 */
let ctx = null
let unlockBound = false
let lastRingAt = 0

function getContext() {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!ctx) ctx = new AudioCtx()
  return ctx
}

/** Call once (e.g. when the admin layout mounts) so the first ring isn't blocked by autoplay rules. */
export function bindAdminRingUnlock() {
  if (typeof window === 'undefined' || unlockBound) return
  unlockBound = true
  const unlock = () => {
    try {
      const c = getContext()
      if (c && c.state === 'suspended') c.resume()
    } catch {
      /* ignore */
    }
  }
  ;['pointerdown', 'keydown', 'touchstart'].forEach((evt) => window.addEventListener(evt, unlock, { passive: true }))
}

function beep(c, startAt, freq, duration) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.35, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

/** Rings 3 times (two-tone bursts, ~3.5s). Several requests arriving together ring only once. */
export function playAdminRing() {
  try {
    const nowMs = Date.now()
    if (nowMs - lastRingAt < 3000) return
    lastRingAt = nowMs

    const c = getContext()
    if (!c) return
    if (c.state === 'suspended') c.resume().catch(() => {})

    const t0 = c.currentTime + 0.05
    for (let i = 0; i < 3; i += 1) {
      const t = t0 + i * 1.2
      beep(c, t, 880, 0.18)
      beep(c, t + 0.22, 1046.5, 0.18)
      beep(c, t + 0.44, 880, 0.18)
      beep(c, t + 0.66, 1046.5, 0.18)
    }
  } catch {
    /* audio blocked or unsupported — the toast/notification still shows */
  }
}
