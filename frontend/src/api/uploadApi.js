import { apiClient } from './http.js'
import { ApiError } from './http.js'

function unwrapUploadResponse(res) {
  const json = res.data
  if (!json?.success) {
    throw new ApiError(json?.message || 'Upload failed', {
      status: res.status,
      code: json?.code,
    })
  }
  return json
}

/**
 * POST /uploads/media — images & videos (profile, categories, job poster, KYC video).
 * @param {File} file
 * @param {string} folder — e.g. UPLOAD_FOLDERS.PROFILES
 */
export async function uploadMedia(file, folder) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('folder', folder)
  try {
    const res = await apiClient.post('/uploads/media', fd)
    return unwrapUploadResponse(res)
  } catch (err) {
    if (err.response?.data?.message) {
      throw new ApiError(err.response.data.message, {
        status: err.response.status,
        code: err.response.data.code,
      })
    }
    throw err
  }
}

/**
 * POST /uploads/document — Aadhaar / PAN scans, PDFs.
 * @param {File} file
 * @param {string} folder — e.g. UPLOAD_FOLDERS.KYC_DOCUMENTS
 */
export async function uploadDocument(file, folder) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('folder', folder)
  try {
    const res = await apiClient.post('/uploads/document', fd)
    return unwrapUploadResponse(res)
  } catch (err) {
    if (err.response?.data?.message) {
      throw new ApiError(err.response.data.message, {
        status: err.response.status,
        code: err.response.data.code,
      })
    }
    throw err
  }
}

/** GET /uploads/config */
export async function fetchUploadConfig() {
  const res = await apiClient.get('/uploads/config')
  return unwrapUploadResponse(res)
}

/** @param {{ data?: { asset?: { url?: string } } }} envelope — api success body */
export function assetUrlFromUpload(envelope) {
  return envelope?.data?.asset?.url ?? ''
}
