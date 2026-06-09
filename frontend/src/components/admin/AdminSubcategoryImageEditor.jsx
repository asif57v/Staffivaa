import { useRef, useState } from 'react'
import { Camera, ImageIcon, Loader2 } from 'lucide-react'
import { patchAdminLabourCategory } from '../../api/adminLabourCategoriesApi.js'
import { ApiError } from '../../api/http.js'
import { assetUrlFromUpload, uploadMedia } from '../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import { getCategoryImageUrl } from '../../lib/labourCategoryDisplay.js'

export function AdminSubcategoryImageEditor({ category, onUpdated }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [urlDraft, setUrlDraft] = useState(category.imageUrl || '')

  const preview = getCategoryImageUrl({ ...category, imageUrl: urlDraft || category.imageUrl })

  const saveImage = async (imageUrl) => {
    setErr('')
    setBusy(true)
    try {
      await patchAdminLabourCategory(category._id, { imageUrl: imageUrl || '' })
      setUrlDraft(imageUrl || '')
      onUpdated?.()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save image')
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file) => {
    if (!file?.type?.startsWith('image/')) {
      setErr('Choose a JPG or PNG image.')
      return
    }
    try {
      const uploaded = await uploadMedia(file, UPLOAD_FOLDERS.LABOUR_CATEGORIES)
      const url = assetUrlFromUpload(uploaded)
      if (!url) {
        setErr('Upload succeeded but no URL was returned.')
        return
      }
      await saveImage(url)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not upload image.')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-2 ring-slate-200/90">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageIcon className="h-6 w-6" aria-hidden />
          </span>
        )}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:border-brand/30"
          >
            <Camera className="h-3.5 w-3.5" aria-hidden />
            Upload image
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => saveImage(urlDraft.trim())}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-[11px] font-bold text-brand ring-1 ring-brand/25"
          >
            Save URL
          </button>
          {category.imageUrl || urlDraft ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setUrlDraft('')
                void saveImage('')
              }}
              className="text-[11px] font-bold text-rose-600"
            >
              Remove
            </button>
          ) : null}
        </div>
        <input
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          placeholder="Or paste https:// image URL"
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
        />
        {err ? <p className="text-[11px] font-medium text-rose-700">{err}</p> : null}
        <p className="text-[10px] text-slate-500">Shown on homeowner home — Book by skill tiles.</p>
      </div>
    </div>
  )
}
