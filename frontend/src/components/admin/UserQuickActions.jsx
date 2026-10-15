import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { Lock, MoreVertical, PauseCircle, PlayCircle, ShieldAlert, Trash2 } from 'lucide-react'
import { patchUserStatusAdmin } from '../../api/adminUsersApi.js'
import { adminDeleteUserAccount } from '../../api/deleteAccountApi.js'
import { ACCOUNT_STATUSES } from '../../constants/userStatuses.js'
import { AdminConfirmActionDialog } from './AdminConfirmActionDialog.jsx'

const S = ACCOUNT_STATUSES

/**
 * Row-level admin actions: Hold / Suspend / Block / Reactivate / Delete.
 * `onDone` is called after a successful change so the list can reload.
 */
export function UserQuickActions({ user, onDone }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const ref = useRef(null)
  const menuRef = useRef(null)
  const status = user.accountStatus || S.ACTIVE

  useEffect(() => {
    if (!menuOpen) return undefined
    const close = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setMenuOpen(false)
    }
    const hide = () => setMenuOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [menuOpen])

  if (status === S.DELETED || user.role === 'admin') return null

  const statusAction = (target, title, description, confirmText, destructive = true) => ({
    title,
    description,
    confirmText,
    isDestructive: destructive,
    run: (reason) => patchUserStatusAdmin(user._id, target, reason),
  })

  const items = [
    status !== S.ACTIVE && {
      label: 'Reactivate',
      icon: PlayCircle,
      color: 'text-emerald-700 hover:bg-emerald-50',
      action: statusAction(S.ACTIVE, 'Reactivate Account', "This will restore the user's access to the platform.", 'Reactivate', false),
    },
    status !== S.HOLD && {
      label: 'Put On Hold',
      icon: PauseCircle,
      color: 'text-orange-700 hover:bg-orange-50',
      action: statusAction(S.HOLD, 'Put Account On Hold', 'User can login but cannot accept new jobs or make withdrawals.', 'Place on Hold'),
    },
    status !== S.SUSPENDED && {
      label: 'Suspend',
      icon: ShieldAlert,
      color: 'text-blue-700 hover:bg-blue-50',
      action: statusAction(S.SUSPENDED, 'Suspend Account', 'User can login but everything is disabled. Support message will be shown.', 'Suspend'),
    },
    status !== S.BLOCKED && {
      label: 'Block',
      icon: Lock,
      color: 'text-rose-700 hover:bg-rose-50',
      action: statusAction(S.BLOCKED, 'Block Account', 'User will be immediately logged out and cannot login again.', 'Block'),
    },
    {
      label: 'Delete Account',
      icon: Trash2,
      color: 'text-rose-700 hover:bg-rose-50',
      action: {
        title: 'Delete Account',
        description:
          'The account will be removed from all active lists and the user logged out. Its full data is kept in Deleted Accounts for security. This cannot be undone.',
        confirmText: 'Delete Account',
        isDestructive: true,
        run: (reason) => adminDeleteUserAccount(user._id, { reason, force: true }),
      },
    },
  ].filter(Boolean)

  const confirm = async ({ reason }) => {
    setBusy(true)
    try {
      await dialog.run(reason)
      toast.success('Done')
      setDialog(null)
      onDone?.()
    } catch (e) {
      toast.error(e?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          // fixed positioning so the menu is not clipped by the table's scroll container
          const r = e.currentTarget.getBoundingClientRect()
          const menuHeight = items.length * 40 + 12
          const openUp = window.innerHeight - r.bottom < menuHeight + 12
          setPos({ top: openUp ? Math.max(8, r.top - menuHeight - 4) : r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) })
          setMenuOpen((o) => !o)
        }}
        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {menuOpen &&
        createPortal(
        <div ref={menuRef} role="menu" style={{ top: pos.top, right: pos.right }} className="fixed z-[110] w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                setDialog(it.action)
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${it.color}`}
            >
              <it.icon className="h-4 w-4" /> {it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
      {dialog &&
        createPortal(
        <AdminConfirmActionDialog
          isOpen
          title={dialog.title}
          description={dialog.description}
          confirmText={dialog.confirmText}
          isDestructive={dialog.isDestructive}
          requireReason
          isLoading={busy}
          onClose={() => !busy && setDialog(null)}
          onConfirm={confirm}
        />,
        document.body,
      )}
    </div>
  )
}
