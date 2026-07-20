✅ PLAN COMPLETADO — El sistema de notificaciones está implementado.

# Sistema de Notificaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Add in-app notifications (bell badge + page) for report responses, ride messages, and accepted offers.

**Architecture:** Backend Notification model + service + API routes. Frontend NotificationBadgeContext + `/notifications` page + bell icon in Layout. Real-time updates via existing `/ws/user` WebSocket.

**Tech Stack:** Bun + Hono + MongoDB (backend), React + Vite + Clerk (frontend)

---

### Task 1: Backend — Notification Model + Service + Routes

**Files:**
- Create: `backend/src/models/notification.ts`
- Create: `backend/src/services/notificationService.ts`
- Create: `backend/src/routes/notifications.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create Notification model**

`backend/src/models/notification.ts`:
```typescript
import { mongoose } from '../db/mongo'

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['report_response', 'ride_message', 'offer_accepted', 'offer_received', 'ride_status'],
    required: true
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  read: { type: Boolean, default: false },
  link: { type: String, default: null },
  metadata: {
    rideId: { type: String, default: null },
    reportId: { type: String, default: null },
    offerId: { type: String, default: null },
  },
}, { timestamps: true })

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, createdAt: -1 })

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema)
```

**Step 2: Create NotificationService**

`backend/src/services/notificationService.ts`:
```typescript
import { Notification } from '../models/notification'
import { broadcastToUser } from './websocket'

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string,
  metadata?: { rideId?: string; reportId?: string; offerId?: string }
) {
  const notification = new Notification({ userId, type, title, body, link, metadata })
  await notification.save()

  // Broadcast real-time via WebSocket
  broadcastToUser(userId, {
    type: 'new_notification',
    data: {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      metadata: notification.metadata,
      read: false,
      createdAt: notification.createdAt,
    }
  })

  return notification
}
```

**Step 3: Create notification routes**

`backend/src/routes/notifications.ts`:
```typescript
import { Hono } from 'hono/tiny'
import { Notification } from '../models/notification'
import { authMiddleware } from '../middleware/auth'

const notifications = new Hono()

// GET /api/notifications — list paginated
notifications.get('/', authMiddleware, async (c) => {
  const user = c.get('user')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const skip = (page - 1) * limit

  const [data, total] = await Promise.all([
    Notification.find({ userId: user.clerkId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments({ userId: user.clerkId })
  ])

  return c.json({
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  })
})

// GET /api/notifications/unread-count
notifications.get('/unread-count', authMiddleware, async (c) => {
  const user = c.get('user')
  const count = await Notification.countDocuments({ userId: user.clerkId, read: false })
  return c.json({ count })
})

// PATCH /api/notifications/:id/read
notifications.patch('/:id/read', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  const result = await Notification.findOneAndUpdate(
    { _id: id, userId: user.clerkId },
    { read: true },
    { new: true }
  )

  if (!result) return c.json({ error: 'Notificacion no encontrada' }, 404)
  return c.json(result)
})

// PATCH /api/notifications/read-all
notifications.patch('/read-all', authMiddleware, async (c) => {
  const user = c.get('user')
  await Notification.updateMany(
    { userId: user.clerkId, read: false },
    { read: true }
  )
  return c.json({ success: true })
})

export default notifications
```

**Step 4: Register route in index.ts**

In `backend/src/index.ts`, add after line 28 (`import reports from './routes/reports'`):
```typescript
import notifications from './routes/notifications'
```

After line 149 (`app.route('/api/reports', reports)`):
```typescript
app.route('/api/notifications', notifications)
```

---

### Task 2: Backend — Add notification triggers

**Files:**
- Modify: `backend/src/routes/admin.ts` (report resolved → notify reporter)
- Modify: `backend/src/routes/messages.ts` (new message → notify ride participants)
- Modify: `backend/src/routes/messages.ts` (price accepted → notify driver)
- Modify: `backend/src/routes/rides.ts` (ride accepted → notify client)

**Step 1: Report resolved trigger**

In `backend/src/routes/admin.ts`, after the report resolution (after `return c.json(report)` on line 1185), add the import and notification call.

Add at the top of the file (after existing imports, line 6):
```typescript
import { createNotification } from '../services/notificationService'
```

After `report.save()` block and before `return c.json(report)` (after line 1185, before the closing `})`):
```typescript
  if (status === 'resolved') {
    await createNotification(
      report.reporterId,
      'report_response',
      'Respuesta a tu reporte',
      'Tu reporte ha sido revisado y resuelto por el equipo.',
      undefined,
      { reportId: id }
    )
  }
```

**Step 2: Message received trigger**

In `backend/src/routes/messages.ts`, add at the top (after existing imports, line 6):
```typescript
import { createNotification } from '../services/notificationService'
```

After each message save + broadcast block, add notification to the ride owner (client) when the sender is NOT the client.

After the first message block (lines 62-70, client responding scenario — no notification needed, client is sender):

After the driver message block (lines 99-109), add before `return c.json(message, 201)`:
```typescript
    // Notify client about new message
    if (senderId !== ride.clientId) {
      createNotification(
        ride.clientId,
        'ride_message',
        'Nuevo mensaje en tu publicacion',
        `Recibiste un mensaje en "${ride.title}"`,
        `/ride/${rideId}`,
        { rideId }
      )
    }
```

After the accepted/in_progress client message block (lines 119-129), add notification if the driver exists:
```typescript
    // Notify driver about new message from client
    if (ride.driverId && senderId !== ride.driverId) {
      createNotification(
        ride.driverId,
        'ride_message',
        'Nuevo mensaje',
        `Recibiste un mensaje en "${ride.title}"`,
        `/chat/${rideId}`,
        { rideId }
      )
    }
```

After the accepted/in_progress driver message block (lines 132-142), add notification:
```typescript
    // Notify client about new message from driver
    createNotification(
      ride.clientId,
      'ride_message',
      'Nuevo mensaje de tu conductor',
      `Tu conductor te envio un mensaje en "${ride.title}"`,
      `/chat/${rideId}`,
      { rideId }
    )
    )
```

**Step 3: Price accepted trigger (in messages.ts)**

In `backend/src/routes/messages.ts`, after price accepted broadcast (lines 317-326), add:
```typescript
    // Notify driver that their offer was accepted
    createNotification(
      driverId,
      'offer_accepted',
      'Oferta aceptada',
      `Tu oferta de $${contact.proposedPrice} fue aceptada en "${ride.title}"`,
      `/ride/${rideId}`,
      { rideId }
    )
```

**Step 4: Ride accepted trigger (alternative path in rides.ts)**

In `backend/src/routes/rides.ts`, add import at the top:
```typescript
import { createNotification } from '../services/notificationService'
```

After the WebSocket broadcast (lines 435-444), before `return c.json(ride)`:
```typescript
  // Notify client that a driver accepted
  createNotification(
    ride.clientId,
    'ride_status',
    'Conductor asignado',
    `Un conductor acepto tu pedido "${ride.title}"`,
    `/ride/${ride._id}`,
    { rideId: ride._id.toString() }
  )
```

---

### Task 3: Frontend — Type + API + BadgeContext

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/contexts/NotificationBadgeContext.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Add Notification type**

In `frontend/src/types/index.ts`, add before the last line:
```typescript
export interface AppNotification {
  _id: string
  userId: string
  type: 'report_response' | 'ride_message' | 'offer_accepted' | 'offer_received' | 'ride_status'
  title: string
  body: string
  read: boolean
  link?: string
  metadata?: { rideId?: string; reportId?: string; offerId?: string }
  createdAt: string
}
```

**Step 2: Add notifications API to api.ts**

In `frontend/src/services/api.ts`, add after `reportsAPI` (after line 470):
```typescript
export const notificationsAPI = {
  list: (params?: { page?: number; limit?: number }, token?: string) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<AppNotification>>(`/api/notifications${query ? `?${query}` : ''}`, {}, token)
  },

  unreadCount: (token?: string) =>
    fetchAPI<{ count: number }>('/api/notifications/unread-count', {}, token),

  markRead: (id: string, token?: string) =>
    fetchAPI<AppNotification>(`/api/notifications/${id}/read`, { method: 'PATCH' }, token),

  markAllRead: (token?: string) =>
    fetchAPI<{ success: boolean }>('/api/notifications/read-all', { method: 'PATCH' }, token),
}
```

Add the import for `AppNotification` at the top of api.ts (line 1):
```typescript
import type { Ride, Message, PaginatedResponse, RatingWithRater, AppNotification } from '../types'
```

**Step 3: Create NotificationBadgeContext**

`frontend/src/contexts/NotificationBadgeContext.tsx`:
```typescript
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { userWsService, notificationsAPI } from '../services/api'

interface NotificationBadgeContextType {
  unreadCount: number
  refreshUnreadCount: () => Promise<void>
}

const NotificationBadgeContext = createContext<NotificationBadgeContextType | undefined>(undefined)

export function NotificationBadgeProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    if (!isSignedIn) return
    try {
      const token = await getToken()
      if (!token) return
      const data = await notificationsAPI.unreadCount(token)
      setUnreadCount(data.count)
    } catch { /* silent */ }
  }, [isSignedIn, getToken])

  // Listen for new notifications via WebSocket
  useEffect(() => {
    if (!isSignedIn) return

    const unsubscribe = userWsService.onMessage((data) => {
      if (data.type === 'new_notification') {
        setUnreadCount(prev => prev + 1)
      }
    })

    return unsubscribe
  }, [isSignedIn])

  // Fetch on mount
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setUnreadCount(0)
      return
    }
    refreshUnreadCount()
  }, [isLoaded, isSignedIn, refreshUnreadCount])

  return (
    <NotificationBadgeContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationBadgeContext.Provider>
  )
}

export function useNotificationBadge() {
  const context = useContext(NotificationBadgeContext)
  if (!context) {
    throw new Error('useNotificationBadge must be used within NotificationBadgeProvider')
  }
  return context
}
```

**Step 4: Wrap in App.tsx**

In `frontend/src/App.tsx`, add import:
```typescript
import { NotificationBadgeProvider } from './contexts/NotificationBadgeContext'
```

Wrap the Layout route:
```typescript
<Route path="/" element={
  <NotificationsProvider>
    <NotificationBadgeProvider>
      <Layout />
    </NotificationBadgeProvider>
  </NotificationsProvider>
}>
```

---

### Task 4: Frontend — Notifications page

**Files:**
- Create: `frontend/src/pages/Notifications.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create Notifications page**

`frontend/src/pages/Notifications.tsx`:
```typescript
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
            Marcar todas como leídas
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
          <p style={{ margin: 0 }}>Las notificaciones aparecerán aquí cuando recibas mensajes, respuestas a reportes o ofertas aceptadas.</p>
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
                borderLeft: n.read ? '1px solid var(--border)' : `4px solid var(--primary)`,
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
                    Marcar como leída
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
            Página {page} de {totalPages}
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
```

**Step 2: Register the route**

In `frontend/src/App.tsx`, add import:
```typescript
import Notifications from './pages/Notifications'
```

Add route inside the Layout routes group, before the fallback (`path="*"`):
```typescript
<Route path="notifications" element={
  <ProtectedRoute>
    <Notifications />
  </ProtectedRoute>
} />
```

---

### Task 5: Frontend — Bell icon in Layout

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: Add bell icon with badge**

In `frontend/src/components/Layout.tsx`, add import:
```typescript
import { useNotificationBadge } from '../contexts/NotificationBadgeContext'
import { Link } from 'react-router-dom' // already imported
```

Add inside the component (after the `const [mobileMenuOpen, setMobileMenuOpen] = useState(false)` line):
```typescript
const { unreadCount } = useNotificationBadge()
```

Add the bell icon button between the LanguageSwitcher and UserButton (after `<LanguageSwitcher />` line 141, before the UserButton div line 143):
```tsx
{/* Notifications Bell */}
<Link
  to="/notifications"
  style={{
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    textDecoration: 'none',
    color: 'var(--text-secondary)',
    borderRadius: '50%',
    transition: 'all var(--duration-fast) var(--ease-out)',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.color = 'var(--text-primary)'
    e.currentTarget.style.background = 'var(--surface-1)'
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.color = 'var(--text-secondary)'
    e.currentTarget.style.background = 'transparent'
  }}
>
  <span className="material-symbols-rounded" style={{ fontSize: '1.375rem' }}>notifications</span>
  {unreadCount > 0 && (
    <span style={{
      position: 'absolute',
      top: '4px',
      right: '4px',
      minWidth: '16px',
      height: '16px',
      borderRadius: '8px',
      background: 'var(--error)',
      color: '#fff',
      fontSize: '0.625rem',
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 4px',
      lineHeight: 1,
      boxShadow: '0 0 0 2px var(--surface-0)',
    }}>
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
</Link>
```

Also add a notifications link in the mobile drawer (after the LanguageSwitcher div, before UserButton):
```tsx
<Link
  to="/notifications"
  onClick={() => setMobileMenuOpen(false)}
  style={{
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--font-medium)',
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius)',
    transition: 'all var(--duration-fast) var(--ease-out)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.color = 'var(--text-primary)'
    e.currentTarget.style.background = 'var(--surface-2)'
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.color = 'var(--text-secondary)'
    e.currentTarget.style.background = 'transparent'
  }}
>
  <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>notifications</span>
  Notificaciones
  {unreadCount > 0 && (
    <span style={{
      marginLeft: 'auto',
      background: 'var(--error)',
      color: '#fff',
      borderRadius: '999px',
      padding: '0.125rem 0.5rem',
      fontSize: '0.75rem',
      fontWeight: 600,
    }}>
      {unreadCount}
    </span>
  )}
</Link>
```

Fecha de finalización: Julio 2026. Ver backend/src/services/notificationService.ts, backend/src/routes/notifications.ts, frontend/src/pages/Notifications.tsx
