import { useEffect, useState } from 'react'
import { subscribe, dismissToast, type ToastData, type ToastType } from '../services/toast'

const ICONS: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
}

const COLORS: Record<ToastType, string> = {
  success: 'var(--success)',
  error: 'var(--error)',
  warning: 'var(--warning)',
  info: 'var(--info)',
}

function ToastItem({ toast, onRemove }: { toast: ToastData; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onRemove(toast.id), 200)
    }, 3500)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  function handleClose() {
    setExiting(true)
    setTimeout(() => onRemove(toast.id), 200)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--surface-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-lg)',
        minWidth: 280,
        maxWidth: 420,
        pointerEvents: 'auto',
        animation: exiting
          ? 'slideOutRight 0.2s var(--ease-out) forwards'
          : 'slideInRight 0.25s var(--ease-out)',
      }}
    >
      <span
        className="material-symbols-rounded"
        style={{ fontSize: '1.25rem', color: COLORS[toast.type], flexShrink: 0 }}
      >
        {ICONS[toast.type]}
      </span>

      <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.4 }}>
        {toast.message}
      </span>

      <button
        onClick={handleClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 2,
          flexShrink: 0,
          borderRadius: 'var(--radius-xs)',
          transition: 'color 0.15s',
        }}
        onMouseOver={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        aria-label="Cerrar"
      >
        <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>
          close
        </span>
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    const unsub = subscribe(setToasts)
    return unsub
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--space-6)',
        right: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={dismissToast} />
      ))}
    </div>
  )
}
