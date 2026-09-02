/** Shared Lenis instance for programmatic scroll outside React components. */
let lenisInstance = null

export function setLenisInstance(instance) {
  lenisInstance = instance || null
}

export function getLenisInstance() {
  return lenisInstance
}

export function clearLenisInstance() {
  lenisInstance = null
}

export function lenisScrollTo(target, options = {}) {
  if (lenisInstance) {
    lenisInstance.scrollTo(target, options)
    return true
  }
  return false
}
