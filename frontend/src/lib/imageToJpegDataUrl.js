/**
 * Resize and encode as JPEG data URL for KYC upload (keeps payload smaller).
 * @param {File} file
 * @param {{ maxWidth?: number, quality?: number }} [opts]
 * @returns {Promise<string>}
 */
export function fileToJpegDataUrl(file, opts = {}) {
  const maxWidth = opts.maxWidth ?? 1600
  const quality = opts.quality ?? 0.82
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        try {
          const w = img.naturalWidth
          const h = img.naturalHeight
          const scale = w > maxWidth ? maxWidth / w : 1
          const cw = Math.round(w * scale)
          const ch = Math.round(h * scale)
          const canvas = document.createElement('canvas')
          canvas.width = cw
          canvas.height = ch
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas not supported'))
            return
          }
          ctx.drawImage(img, 0, 0, cw, ch)
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          resolve(dataUrl)
        } catch (e) {
          reject(e)
        }
      }
      img.onerror = () => reject(new Error('Invalid image file'))
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
