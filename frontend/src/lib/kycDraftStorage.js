const DB_NAME = 'staffivaa_kyc_draft_db'
const DB_VERSION = 2
const STORE_NAME = 'drafts'

function openDb() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null)
      return
    }
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch (e) {
      resolve(null)
    }
  })
}

// Helper: Convert File/Blob to Base64 Data URL for 100% resilient storage across all mobile webviews
function fileToDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null)
    if (typeof file === 'string') return resolve(file)
    try {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    } catch (err) {
      resolve(null)
    }
  })
}

// Helper: Convert Data URL back to File object
function dataUrlToFile(dataUrl, filename = 'document.jpg', mimeType = 'image/jpeg') {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null
  try {
    const parts = dataUrl.split(',')
    const mimeMatch = parts[0].match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : mimeType
    const byteString = atob(parts[1])
    let n = byteString.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = byteString.charCodeAt(n)
    }
    return new File([u8arr], filename, { type: mime })
  } catch (e) {
    return null
  }
}

/**
 * Persist KYC form draft (Aadhaar, PAN, and local photo files/blobs)
 */
export async function saveKycDraft({ aadhaar, pan, photos, userId }) {
  const userKey = userId || 'current_user'

  // If everything is completely empty, don't overwrite a previous draft
  const hasPhotos = photos && Object.keys(photos).length > 0
  const hasText = Boolean((aadhaar && aadhaar.trim()) || (pan && pan.trim()))
  if (!hasPhotos && !hasText) {
    return
  }

  // 1. Sync text fields to localStorage & sessionStorage immediately
  const textPayload = {
    aadhaar: aadhaar || '',
    pan: pan || '',
    userId: userKey,
    hasPhotos,
    savedAt: Date.now(),
  }

  try {
    localStorage.setItem('lc_labour_kyc_text_draft', JSON.stringify(textPayload))
    localStorage.setItem(`lc_labour_kyc_text_${userKey}`, JSON.stringify(textPayload))
    sessionStorage.setItem('lc_labour_kyc_text_draft', JSON.stringify(textPayload))
  } catch (e) {}

  // 2. Prepare serializable photos (convert File to dataUrl for 100% crash-free IDB storage)
  const serializablePhotos = {}
  if (photos && typeof photos === 'object') {
    for (const [slotId, slotVal] of Object.entries(photos)) {
      if (!slotVal) continue
      if (typeof slotVal === 'string') {
        serializablePhotos[slotId] = { isRemote: true, url: slotVal }
      } else if (slotVal && typeof slotVal === 'object') {
        const fileName = slotVal.file?.name || `${slotId}.jpg`
        const fileType = slotVal.file?.type || 'image/jpeg'
        let dataUrl = slotVal.previewUrl && slotVal.previewUrl.startsWith('data:') ? slotVal.previewUrl : null
        
        if (!dataUrl && slotVal.file) {
          dataUrl = await fileToDataUrl(slotVal.file)
        }

        if (dataUrl || slotVal.previewUrl) {
          serializablePhotos[slotId] = {
            isDataUrl: Boolean(dataUrl),
            dataUrl: dataUrl || slotVal.previewUrl,
            name: fileName,
            type: fileType,
          }
        }
      }
    }
  }

  // 3. Save to IndexedDB under userKey AND fallback current_user key
  const db = await openDb()
  if (!db) return

  try {
    const draftData = {
      userId: userKey,
      aadhaar: aadhaar || '',
      pan: pan || '',
      photos: serializablePhotos,
      updatedAt: Date.now(),
    }

    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(draftData, 'kyc_draft_' + userKey)
    store.put(draftData, 'kyc_draft_current_user')
    store.put(draftData, 'kyc_draft_universal')
  } catch (err) {
    console.warn('[kycDraftStorage] Error saving draft to IDB:', err)
  }
}

/**
 * Load persisted KYC form draft
 */
export async function loadKycDraft(userId) {
  const userKey = userId || 'current_user'

  // First read text draft from localStorage/sessionStorage as fallback
  let textDraft = null
  try {
    const raw =
      localStorage.getItem(`lc_labour_kyc_text_${userKey}`) ||
      localStorage.getItem('lc_labour_kyc_text_draft') ||
      sessionStorage.getItem('lc_labour_kyc_text_draft')
    if (raw) textDraft = JSON.parse(raw)
  } catch (e) {}

  const db = await openDb()
  if (!db) {
    return textDraft
      ? { aadhaar: textDraft.aadhaar || '', pan: textDraft.pan || '', photos: {} }
      : null
  }

  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    // Try keys in priority order: specific user -> current_user -> universal
    const keysToTry = ['kyc_draft_' + userKey, 'kyc_draft_current_user', 'kyc_draft_universal']
    let data = null

    for (const k of keysToTry) {
      const res = await new Promise((resolve) => {
        try {
          const req = store.get(k)
          req.onsuccess = () => resolve(req.result || null)
          req.onerror = () => resolve(null)
        } catch (e) {
          resolve(null)
        }
      })
      if (res && (res.aadhaar || res.pan || (res.photos && Object.keys(res.photos).length > 0))) {
        data = res
        break
      }
    }

    if (!data) {
      return textDraft
        ? { aadhaar: textDraft.aadhaar || '', pan: textDraft.pan || '', photos: {} }
        : null
    }

    // Restore photos with active Object URLs and File instances
    const restoredPhotos = {}
    for (const [slotId, slotVal] of Object.entries(data.photos || {})) {
      if (!slotVal) continue
      if (slotVal.isRemote && slotVal.url) {
        restoredPhotos[slotId] = slotVal.url
      } else if (slotVal.dataUrl) {
        try {
          const file = dataUrlToFile(
            slotVal.dataUrl,
            slotVal.name || `${slotId}.jpg`,
            slotVal.type || 'image/jpeg',
          )
          if (file) {
            const previewUrl = URL.createObjectURL(file)
            restoredPhotos[slotId] = {
              file,
              previewUrl,
            }
          }
        } catch (fileErr) {
          console.warn('[kycDraftStorage] Failed to restore file for slot:', slotId, fileErr)
        }
      }
    }

    return {
      aadhaar: data.aadhaar || textDraft?.aadhaar || '',
      pan: data.pan || textDraft?.pan || '',
      photos: restoredPhotos,
      updatedAt: data.updatedAt,
    }
  } catch (err) {
    console.warn('[kycDraftStorage] Error loading draft:', err)
    return textDraft
      ? { aadhaar: textDraft.aadhaar || '', pan: textDraft.pan || '', photos: {} }
      : null
  }
}

/**
 * Clear draft after successful submission
 */
export async function clearKycDraft(userId) {
  const userKey = userId || 'current_user'
  try {
    localStorage.removeItem('lc_labour_kyc_text_draft')
    localStorage.removeItem(`lc_labour_kyc_text_${userKey}`)
    sessionStorage.removeItem('lc_labour_kyc_text_draft')
  } catch (e) {}

  const db = await openDb()
  if (!db) return

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete('kyc_draft_' + userKey)
    store.delete('kyc_draft_current_user')
    store.delete('kyc_draft_universal')
  } catch (e) {}
}
