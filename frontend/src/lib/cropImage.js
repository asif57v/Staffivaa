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
 * Generates a cropped File and Object URL from cropAreaPixels
 * @param {string} imageSrc - Source image URL / Data URL / Object URL
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop - Pixel crop dimensions from react-easy-crop
 * @param {string} [fileName='cropped-document.jpg'] - Desired file name
 * @returns {Promise<{ file: File, previewUrl: string, blob: Blob }>}
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

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas conversion to blob failed.'))
          return
        }
        const file = new File([blob], fileName, { type: 'image/jpeg' })
        const previewUrl = URL.createObjectURL(blob)
        resolve({ file, previewUrl, blob })
      },
      'image/jpeg',
      0.92,
    )
  })
}
