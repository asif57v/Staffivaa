const DB_NAME = 'staffivaa_kyc_draft_db'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

function openDb() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null)
      return
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

/**
 * Persist KYC form draft (Aadhaar, PAN, and local photo files/blobs)
 */
export async function saveKycDraft({ aadhaar, pan, photos, userId }) {
  const userKey = userId || 'current_user'

  // Sync text fields to localStorage
  try {
    localStorage.setItem(
      'lc_labour_kyc_text_draft',
      JSON.stringify({ aadhaar, pan, userId: userKey, savedAt: Date.now() }),
    )
  } catch (e) {}

  const db = await openDb()
  if (!db) return

  try {
    const serializablePhotos = {}
    for (const [slotId, slotVal] of Object.entries(photos || {})) {
      if (!slotVal) continue
      if (typeof slotVal === 'string') {
        serializablePhotos[slotId] = { isRemote: true, url: slotVal }
      } else if (slotVal && typeof slotVal === 'object' && slotVal.file) {
        serializablePhotos[slotId] = {
          file: slotVal.file,
          name: slotVal.file.name || `${slotId}.jpg`,
          type: slotVal.file.type || 'image/jpeg',
        }
      }
    }

    const draftData = {
      userId: userKey,
      aadhaar: aadhaar || '',
      pan: pan || '',
      photos: serializablePhotos,
      updatedAt: Date.now(),
    }

    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(draftData, 'kyc_draft_' + userKey)
  } catch (err) {
    console.warn('[kycDraftStorage] Error saving draft:', err)
  }
}

/**
 * Load persisted KYC form draft
 */
export async function loadKycDraft(userId) {
  const userKey = userId || 'current_user'

  let textDraft = null
  try {
    const raw = localStorage.getItem('lc_labour_kyc_text_draft')
    if (raw) textDraft = JSON.parse(raw)
  } catch (e) {}

  const db = await openDb()
  if (!db) {
    return textDraft
      ? { aadhaar: textDraft.aadhaar || '', pan: textDraft.pan || '', photos: {} }
      : null
  }

  try {
    const draftKey = 'kyc_draft_' + userKey
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(draftKey)

    const data = await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    })

    if (!data) {
      return textDraft
        ? { aadhaar: textDraft.aadhaar || '', pan: textDraft.pan || '', photos: {} }
        : null
    }

    // Restore photos with active Object URLs
    const restoredPhotos = {}
    for (const [slotId, slotVal] of Object.entries(data.photos || {})) {
      if (!slotVal) continue
      if (slotVal.isRemote && slotVal.url) {
        restoredPhotos[slotId] = slotVal.url
      } else if (slotVal.file) {
        try {
          const file =
            slotVal.file instanceof File
              ? slotVal.file
              : new File([slotVal.file], slotVal.name || `${slotId}.jpg`, {
                  type: slotVal.type || 'image/jpeg',
                })
          const previewUrl = URL.createObjectURL(file)
          restoredPhotos[slotId] = {
            file,
            previewUrl,
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
    sessionStorage.removeItem('lc-labour-kyc-draft')
  } catch (e) {}

  const db = await openDb()
  if (!db) return

  try {
    const draftKey = 'kyc_draft_' + userKey
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(draftKey)
  } catch (e) {}
}
