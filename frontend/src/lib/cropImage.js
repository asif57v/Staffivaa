/**
 * Helper to load an image asynchronously from a URL or object URL
 */
export function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}

/**
 * Fast client-side image compression & conversion to Base64 Data URL
 * @param {File|Blob|string} fileOrBlob 
 * @param {number} [maxWidth=1280] 
 * @param {number} [quality=0.78] 
 * @returns {Promise<string>} Data URL
 */
export async function compressImageToDataUrl(fileOrBlob, maxWidth = 1280, quality = 0.78) {
  if (!fileOrBlob) return null
  if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('data:')) return fileOrBlob

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          return resolve(e.target.result)
        }
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.onerror = () => resolve(e.target.result)
      img.src = e.target.result
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(fileOrBlob)
  })
}

/**
 * Generates a cropped File and Data URL from cropAreaPixels
 * @param {string} imageSrc - Source image URL / Data URL / Object URL
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop - Pixel crop dimensions from react-easy-crop
 * @param {string} [fileName='cropped-document.jpg'] - Desired file name
 * @returns {Promise<{ file: File, previewUrl: string, dataUrl: string, blob: Blob }>}
 */
export async function getCroppedImg(imageSrc, pixelCrop, fileName = 'cropped-document.jpg') {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas 2D context is not supported.')
  }

  // Set canvas to cropped area dimensions
  canvas.width = Math.round(pixelCrop.width)
  canvas.height = Math.round(pixelCrop.height)

  // Draw the selected region of the source image to the canvas
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas conversion to blob failed.'))
          return
        }
        const file = new File([blob], fileName, { type: 'image/jpeg' })
        resolve({ file, previewUrl: dataUrl, dataUrl, blob })
      },
      'image/jpeg',
      0.85,
    )
  })
}
