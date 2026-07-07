import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { notificationsAPI } from '../services/api'
import type { AppNotification } from '../types'
import { useNotificationBadge } from '../contexts/NotificationBadgeContext'

const TYPE_ICONS: Record<string, string> = {
  report_response: 'rate_review',
  ride_message: 'chat',
  offer_accepted: 'handshake',
  offer_received: 'request_quote',
  ride_status: 'local_shipping',
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `Hace ${days}d`
  return new Date(dateStr).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' })
}

export default function Notifications() {
  const { getToken } = useAuth()
  const { refreshUnreadCount } = useNotificationBadge()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  async function loadNotifications(p: number) {
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await notificationsAPI.list({ page: p, limit: 20 }, token)
      setNotifications(res.data)
      setTotalPages(res.pagination.pages)
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadNotifications(page) }, [page, getToken])

  async function handleMarkRead(id: string) {
    const token = await getToken()
    if (!token) return
    await notificationsAPI.markRead(id, token)
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
    refreshUnreadCount()
  }

  async function handleMarkAllRead() {
    const token = await getToken()
    if (!token) return
    await notificationsAPI.markAllRead(token)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    refreshUnreadCount()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link
          to="/my-rides"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--text-secondary)' }}
        >
          <span className="material-symbols-rounded">arrow_back</span>
          Volver
        </Link>
        <h1 style={{ flex: 1, fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Notificaciones
        </h1>
        {notifications.some(n => !n.read) && (
          <button
            onClick={handleMarkAllRead}
            className="btn btn-outline"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>done_all</span>
            Marcar todas como leidas
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Cargando notificaciones...
        </div>
      )}

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '3rem', opacity: 0.5 }}>notifications_off</span>
          <p style={{ fontSize: '1.125rem', margin: 0 }}>No tienes notificaciones</p>
          <p style={{ margin: 0 }}>Las notificaciones apareceran aqui cuando recibas mensajes, respuestas a reportes u ofertas aceptadas.</p>
        </div>
      )}

      {/* List */}
      {!loading && notifications.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.map((n) => (
            <div
              key={n._id}
              style={{
                display: 'flex',
                gap: '1rem',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius)',
                background: n.read ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                border: n.read ? '1px solid var(--border)' : '1px solid var(--primary)',
                borderLeft: n.read ? '1px solid var(--border)' : '4px solid var(--primary)',
                transition: 'all 0.2s',
                cursor: n.link ? 'pointer' : 'default',
                alignItems: 'flex-start',
              }}
              onClick={() => {
                if (!n.read) handleMarkRead(n._id)
                if (n.link) window.location.href = n.link
              }}
            >
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: '1.5rem',
                  color: n.read ? 'var(--text-muted)' : 'var(--primary)',
                  flexShrink: 0,
                  marginTop: '0.125rem',
                }}
              >
                {TYPE_ICONS[n.type] || 'notifications'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{n.title}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {timeAgo(n.createdAt)}
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {n.body}
                </p>
                {!n.read && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMarkRead(n._id) }}
                    style={{
                      marginTop: '0.5rem',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      padding: 0,
                    }}
                  >
                    Marcar como leida
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="btn btn-outline"
            style={{ padding: '0.5rem 1rem' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>chevron_left</span>
            Anterior
          </button>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Pagina {page} de {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="btn btn-outline"
            style={{ padding: '0.5rem 1rem' }}
          >
            Siguiente
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>chevron_right</span>
          </button>
        </div>
      )}
    </div>
  )
}
