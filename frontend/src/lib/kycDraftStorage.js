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

// Convert File/Blob to Base64 Data URL if needed
export function fileToDataUrl(file) {
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

// Convert Data URL back to File object
export function dataUrlToFile(dataUrl, filename = 'document.jpg', mimeType = 'image/jpeg') {
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

function getDraftKeys(userKey, role = 'labour') {
  if (role === 'vendor') {
    return {
      textUser: `lc_vendor_kyc_text_${userKey}`,
      textDraft: 'lc_vendor_kyc_text_draft',
      photosUser: `lc_vendor_kyc_photos_${userKey}`,
      photosDraft: 'lc_vendor_kyc_photos_draft',
      idbKeys: [`kyc_draft_vendor_${userKey}`, 'kyc_draft_vendor_current_user', 'kyc_draft_vendor_universal'],
    }
  }
  if (role === 'corporate') {
    return {
      textUser: `lc_corporate_kyc_text_${userKey}`,
      textDraft: 'lc_corporate_kyc_text_draft',
      photosUser: `lc_corporate_kyc_photos_${userKey}`,
      photosDraft: 'lc_corporate_kyc_photos_draft',
      idbKeys: [`kyc_draft_corporate_${userKey}`, 'kyc_draft_corporate_current_user', 'kyc_draft_corporate_universal'],
    }
  }
  // default: labour
  return {
    textUser: `lc_labour_kyc_text_${userKey}`,
    textDraft: 'lc_labour_kyc_text_draft',
    photosUser: `lc_labour_kyc_photos_${userKey}`,
    photosDraft: 'lc_labour_kyc_photos_draft',
    idbKeys: [`kyc_draft_${userKey}`, 'kyc_draft_current_user', 'kyc_draft_universal'],
  }
}

/**
 * Persist KYC form draft (Aadhaar, PAN, form fields, and local photo files/blobs)
 */
export async function saveKycDraft({ aadhaar, pan, photos, form, userId, role = 'labour' }) {
  const userKey = userId || 'current_user'
  const keys = getDraftKeys(userKey, role)

  const hasPhotos = photos && Object.keys(photos).length > 0
  const hasText = Boolean(
    (aadhaar && aadhaar.trim()) ||
    (pan && pan.trim()) ||
    (form && Object.keys(form).some((k) => Boolean(form[k])))
  )
  if (!hasPhotos && !hasText) {
    return
  }

  // 1. Text payload for instant localStorage sync
  const textPayload = {
    aadhaar: aadhaar || '',
    pan: pan || '',
    form: form || null,
    userId: userKey,
    hasPhotos,
    savedAt: Date.now(),
  }

  try {
    const serialized = JSON.stringify(textPayload)
    localStorage.setItem(keys.textDraft, serialized)
    localStorage.setItem(keys.textUser, serialized)
    sessionStorage.setItem(keys.textDraft, serialized)
  } catch (e) {}

  // 2. Prepare serializable photos with guaranteed Data URLs
  const serializablePhotos = {}
  if (photos && typeof photos === 'object') {
    for (const [slotId, slotVal] of Object.entries(photos)) {
      if (!slotVal) continue
      if (typeof slotVal === 'string') {
        serializablePhotos[slotId] = { isRemote: true, url: slotVal }
      } else if (slotVal && typeof slotVal === 'object') {
        const fileName = slotVal.file?.name || `${slotId}.jpg`
        const fileType = slotVal.file?.type || 'image/jpeg'

        let dataUrl = slotVal.dataUrl || (slotVal.previewUrl?.startsWith('data:') ? slotVal.previewUrl : null)
        if (!dataUrl && slotVal.file) {
          dataUrl = await fileToDataUrl(slotVal.file)
        }

        if (dataUrl) {
          serializablePhotos[slotId] = {
            isDataUrl: true,
            dataUrl: dataUrl,
            name: fileName,
            type: fileType,
          }
        } else if (slotVal.previewUrl && !slotVal.previewUrl.startsWith('blob:')) {
          serializablePhotos[slotId] = {
            isRemote: true,
            url: slotVal.previewUrl,
          }
        }
      }
    }
  }

  // 3. Save photos to localStorage & sessionStorage for instant recovery
  if (Object.keys(serializablePhotos).length > 0) {
    try {
      const photosPayload = JSON.stringify(serializablePhotos)
      localStorage.setItem(keys.photosDraft, photosPayload)
      localStorage.setItem(keys.photosUser, photosPayload)
      sessionStorage.setItem(keys.photosDraft, photosPayload)
    } catch (storageErr) {
      console.warn('[kycDraftStorage] localStorage full for photos, falling back to IDB', storageErr)
    }
  }

  // 4. Save to IndexedDB under userKey AND fallback keys
  const db = await openDb()
  if (!db) return

  try {
    const draftData = {
      userId: userKey,
      aadhaar: aadhaar || '',
      pan: pan || '',
      form: form || null,
      photos: serializablePhotos,
      updatedAt: Date.now(),
    }

    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const k of keys.idbKeys) {
      store.put(draftData, k)
    }
  } catch (err) {
    console.warn('[kycDraftStorage] Error saving draft to IDB:', err)
  }
}

/**
 * Load persisted KYC form draft
 */
export async function loadKycDraft(userId, role = 'labour') {
  const userKey = userId || 'current_user'
  const keys = getDraftKeys(userKey, role)

  // Helper to parse stored serializable photos back into { file, previewUrl, dataUrl }
  const parsePhotos = (rawPhotos) => {
    if (!rawPhotos || typeof rawPhotos !== 'object') return {}
    const restored = {}
    for (const [slotId, slotVal] of Object.entries(rawPhotos)) {
      if (!slotVal) continue
      if (slotVal.isRemote && slotVal.url) {
        restored[slotId] = slotVal.url
      } else if (slotVal.dataUrl) {
        try {
          const file = dataUrlToFile(
            slotVal.dataUrl,
            slotVal.name || `${slotId}.jpg`,
            slotVal.type || 'image/jpeg',
          )
          if (file) {
            restored[slotId] = {
              file,
              previewUrl: slotVal.dataUrl,
              dataUrl: slotVal.dataUrl,
            }
          }
        } catch (e) {
          console.warn('[kycDraftStorage] Failed to parse photo:', slotId, e)
        }
      }
    }
    return restored
  }

  // 1. Instant check from localStorage/sessionStorage
  let textDraft = null
  let photosDraft = null

  try {
    const rawText =
      localStorage.getItem(keys.textUser) ||
      localStorage.getItem(keys.textDraft) ||
      sessionStorage.getItem(keys.textDraft)
    if (rawText) textDraft = JSON.parse(rawText)

    const rawPhotos =
      localStorage.getItem(keys.photosUser) ||
      localStorage.getItem(keys.photosDraft) ||
      sessionStorage.getItem(keys.photosDraft)
    if (rawPhotos) photosDraft = parsePhotos(JSON.parse(rawPhotos))
  } catch (e) {}

  // 2. Read from IndexedDB for comprehensive full draft
  const db = await openDb()
  if (!db) {
    return {
      aadhaar: textDraft?.aadhaar || '',
      pan: textDraft?.pan || '',
      form: textDraft?.form || null,
      photos: photosDraft || {},
      updatedAt: textDraft?.savedAt || Date.now(),
    }
  }

  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    let data = null

    for (const k of keys.idbKeys) {
      const res = await new Promise((resolve) => {
        try {
          const req = store.get(k)
          req.onsuccess = () => resolve(req.result || null)
          req.onerror = () => resolve(null)
        } catch (e) {
          resolve(null)
        }
      })
      if (res && (res.aadhaar || res.pan || res.form || (res.photos && Object.keys(res.photos).length > 0))) {
        data = res
        break
      }
    }

    if (!data) {
      return {
        aadhaar: textDraft?.aadhaar || '',
        pan: textDraft?.pan || '',
        form: textDraft?.form || null,
        photos: photosDraft || {},
        updatedAt: textDraft?.savedAt || Date.now(),
      }
    }

    const idbPhotos = parsePhotos(data.photos)
    const mergedPhotos = {
      ...(photosDraft || {}),
      ...(idbPhotos || {}),
    }

    return {
      aadhaar: data.aadhaar || textDraft?.aadhaar || '',
      pan: data.pan || textDraft?.pan || '',
      form: data.form || textDraft?.form || null,
      photos: mergedPhotos,
      updatedAt: data.updatedAt,
    }
  } catch (err) {
    console.warn('[kycDraftStorage] Error loading draft:', err)
    return {
      aadhaar: textDraft?.aadhaar || '',
      pan: textDraft?.pan || '',
      form: textDraft?.form || null,
      photos: photosDraft || {},
      updatedAt: textDraft?.savedAt || Date.now(),
    }
  }
}

/**
 * Clear draft after successful submission
 */
export async function clearKycDraft(userId, role = 'labour') {
  const userKey = userId || 'current_user'
  const keys = getDraftKeys(userKey, role)
  try {
    localStorage.removeItem(keys.textDraft)
    localStorage.removeItem(keys.textUser)
    localStorage.removeItem(keys.photosDraft)
    localStorage.removeItem(keys.photosUser)
    sessionStorage.removeItem(keys.textDraft)
    sessionStorage.removeItem(keys.photosDraft)
  } catch (e) {}

  const db = await openDb()
  if (!db) return

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const k of keys.idbKeys) {
      store.delete(k)
    }
  } catch (e) {}
}

