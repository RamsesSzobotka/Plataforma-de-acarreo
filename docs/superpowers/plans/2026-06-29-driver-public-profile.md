# Driver Public Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a public driver profile page at `/profile/:clerkId` with rating, reviews, vehicle info, and a popup component to access it from RideDetails/Chat.

**Architecture:** New backend endpoint for fetching driver ratings, new frontend page (DriverPublicProfile) and popup component (DriverProfilePopup). Integrate into existing pages (RideDetails, Chat) and Clerk UserButton menu.

**Tech Stack:** Bun + Hono (backend), React + Vite (frontend), MongoDB, Clerk

---

### Task 1: Backend - New ratings route

**Files:**
- Create: `backend/src/routes/ratings.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create `backend/src/routes/ratings.ts`**

```typescript
import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { Rating } from '../models/rating'

const ratings = new Hono()

// GET /api/ratings/driver/:userId - Obtener reseñas de un conductor (paginated)
ratings.get('/driver/:userId', authMiddleware, async (c) => {
  const userId = c.req.param('userId')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')

  try {
    const skip = (page - 1) * limit

    const [ratings, total] = await Promise.all([
      Rating.find({ ratedId: userId, role: 'driver' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Rating.countDocuments({ ratedId: userId, role: 'driver' }),
    ])

    // Enriquecer con datos de quien calificó (rater)
    const { db } = await import('../db/mongo')
    const enrichedRatings = await Promise.all(
      ratings.map(async (r) => {
        let rater = null
        try {
          const userDoc = await db.collection('users').findOne(
            { clerkId: r.raterId },
            { projection: { firstName: 1, lastName: 1, imageUrl: 1 } }
          )
          if (userDoc) {
            rater = {
              firstName: userDoc.firstName,
              lastName: userDoc.lastName,
              imageUrl: userDoc.imageUrl,
            }
          }
        } catch (err) {
          console.error('Error fetching rater:', err)
        }
        return {
          _id: r._id,
          rideId: r.rideId,
          raterId: r.raterId,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          rater,
        }
      })
    )

    return c.json({
      data: enrichedRatings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('Error fetching driver ratings:', err)
    return c.json({ error: 'Error al obtener reseñas' }, 500)
  }
})

export default ratings
```

- [ ] **Step 2: Register route in `backend/src/index.ts`**

Add import after line 25:
```typescript
import ratings from './routes/ratings'
```

Add route after line 94:
```typescript
app.route('/api/ratings', ratings)
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/ratings.ts backend/src/index.ts
git commit -m "feat: add GET /api/ratings/driver/:userId endpoint"
```

### Task 2: Frontend - Types + API

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add RatingWithRater type to `frontend/src/types/index.ts`**

Add after the `DriverContact` interface:
```typescript
export interface RatingWithRater {
  _id: string
  rideId: string
  raterId: string
  rating: number
  comment?: string
  createdAt: string
  rater: {
    firstName?: string
    lastName?: string
    imageUrl?: string
  } | null
}
```

- [ ] **Step 2: Add ratingsAPI to `frontend/src/services/api.ts`**

Add after `usersAPI` block (before `paymentsAPI`):
```typescript
export const ratingsAPI = {
  getDriverRatings: (userId: string, params?: { page?: number; limit?: number }, token?: string) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return fetchAPI<PaginatedResponse<RatingWithRater>>(
      `/api/ratings/driver/${userId}${query ? `?${query}` : ''}`,
      {},
      token
    )
  },
}
```

Also add the import at the top of api.ts:
```typescript
import type { RatingWithRater } from '../types'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/api.ts
git commit -m "feat: add RatingWithRater type and ratingsAPI"
```

### Task 3: Frontend - DriverPublicProfile page

**Files:**
- Create: `frontend/src/pages/DriverPublicProfile.tsx`

- [ ] **Step 1: Create `frontend/src/pages/DriverPublicProfile.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { usersAPI, ratingsAPI } from '../services/api'
import type { RatingWithRater } from '../types'

function DriverPublicProfile() {
  const { clerkId } = useParams<{ clerkId: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [driverUser, setDriverUser] = useState<any>(null)
  const [driver, setDriver] = useState<any>(null)
  const [ratings, setRatings] = useState<RatingWithRater[]>([])
  const [totalRatings, setTotalRatings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      if (!clerkId) return
      try {
        const token = await getToken()
        const [userData, driverData, ratingsData] = await Promise.all([
          usersAPI.get(clerkId, token),
          usersAPI.getDriver(clerkId, token).catch(() => null),
          ratingsAPI.getDriverRatings(clerkId, { page: 1, limit: 50 }, token),
        ])
        setDriverUser(userData)
        setDriver(driverData)
        setRatings(ratingsData.data)
        setTotalRatings(ratingsData.pagination?.total || 0)
      } catch (err) {
        console.error('Error loading driver profile:', err)
        setError('No se pudo cargar el perfil del conductor')
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [clerkId, getToken])

  if (loading) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: 'var(--space-8) 0' }}>
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }} />
        <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    )
  }

  if (error || !driverUser) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--space-8) 0', textAlign: 'center' }}>
        <div className="card">
          <span className="material-symbols-rounded" style={{ fontSize: '4rem', color: 'var(--error)', marginBottom: 'var(--space-4)' }}>error</span>
          <p style={{ color: 'var(--error)', marginBottom: 'var(--space-5)' }}>{error || 'Conductor no encontrado'}</p>
          <button className="btn btn-outline" onClick={() => navigate(-1)}>
            <span className="material-symbols-rounded">arrow_back</span>
            Volver
          </button>
        </div>
      </div>
    )
  }

  const initials = [driverUser.firstName, driverUser.lastName]
    .filter(Boolean)
    .map((n: string) => n.charAt(0))
    .join('')
    .toUpperCase() || 'D'

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className="material-symbols-rounded"
        style={{
          fontSize: '1.25rem',
          color: i < Math.round(rating) ? 'var(--warning)' : 'var(--border)',
          fontVariationSettings: i < Math.round(rating) ? "'FILL' 1" : "'FILL' 0",
        }}
      >
        star
      </span>
    ))
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="btn btn-ghost"
        style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}
      >
        <span className="material-symbols-rounded">arrow_back</span>
        Volver
      </button>

      {/* Profile Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-5)',
          flexWrap: 'wrap',
        }}>
          {/* Avatar */}
          {driverUser.imageUrl ? (
            <img
              src={driverUser.imageUrl}
              alt={driverUser.firstName}
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid var(--primary-subtle)',
              }}
            />
          ) : (
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--text-3xl)',
              fontWeight: 'var(--font-bold)',
              border: '4px solid var(--primary-subtle)',
            }}>
              {initials}
            </div>
          )}

          {/* Info */}
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
              margin: '0 0 var(--space-1)',
            }}>
              {driverUser.firstName} {driverUser.lastName}
            </h1>

            {/* Rating */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
            }}>
              {driver ? (
                <>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {renderStars(driver.rating)}
                  </div>
                  <strong style={{ fontSize: 'var(--text-lg)' }}>{driver.rating}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    ({driver.totalRides} viajes)
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  Sin calificaciones aún
                </span>
              )}
            </div>

            {/* Vehicle info */}
            {driver && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>local_shipping</span>
                {driver.vehicleType} - {driver.plate}
              </div>
            )}

            {/* Verification badge */}
            {driver?.verificationStatus === 'verified' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                marginTop: 'var(--space-2)',
                color: 'var(--success)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>verified</span>
                Conductor Verificado
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="card">
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)',
          margin: '0 0 var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--warning)' }}>reviews</span>
          Reseñas ({totalRatings})
        </h2>

        {ratings.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            color: 'var(--text-muted)',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: '3rem', marginBottom: 'var(--space-2)', opacity: 0.5 }}>rate_review</span>
            <p>Este conductor aún no tiene reseñas.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {ratings.map((r) => (
              <div
                key={r._id}
                style={{
                  padding: 'var(--space-4)',
                  background: 'var(--surface-1)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-2)',
                }}>
                  {/* Rater avatar */}
                  {r.rater?.imageUrl ? (
                    <img
                      src={r.rater.imageUrl}
                      alt={r.rater.firstName}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'var(--primary-subtle)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-bold)',
                    }}>
                      {r.rater?.firstName?.charAt(0) || '?'}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 'var(--font-semibold)',
                      fontSize: 'var(--text-sm)',
                    }}>
                      {r.rater?.firstName} {r.rater?.lastName || 'Cliente'}
                    </div>
                    <div style={{ display: 'flex', gap: '1px', marginTop: '2px' }}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <span
                          key={i}
                          className="material-symbols-rounded"
                          style={{
                            fontSize: '0.875rem',
                            color: i < r.rating ? 'var(--warning)' : 'var(--border)',
                            fontVariationSettings: i < r.rating ? "'FILL' 1" : "'FILL' 0",
                          }}
                        >
                          star
                        </span>
                      ))}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                  }}>
                    {new Date(r.createdAt).toLocaleDateString('es-PA', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                {r.comment && (
                  <p style={{
                    margin: 'var(--space-2) 0 0',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}>
                    {r.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DriverPublicProfile
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/DriverPublicProfile.tsx
git commit -m "feat: add DriverPublicProfile page"
```

### Task 4: Frontend - DriverProfilePopup component

**Files:**
- Create: `frontend/src/components/DriverProfilePopup.tsx`

- [ ] **Step 1: Create `frontend/src/components/DriverProfilePopup.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '../types'

interface DriverProfilePopupProps {
  driverUser: {
    clerkId?: string
    firstName?: string
    lastName?: string
    imageUrl?: string
  } | null
  driver: {
    rating?: number
    totalRides?: number
  } | null
  rideId?: string
  onClose: () => void
}

function DriverProfilePopup({ driverUser, driver, rideId, onClose }: DriverProfilePopupProps) {
  const navigate = useNavigate()
  const popupRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  if (!driverUser) return null

  const initials = [driverUser.firstName, driverUser.lastName]
    .filter(Boolean)
    .map((n: string) => n.charAt(0))
    .join('')
    .toUpperCase() || 'D'

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className="material-symbols-rounded"
        style={{
          fontSize: '1rem',
          color: i < Math.round(rating) ? 'var(--warning)' : 'var(--border)',
          fontVariationSettings: i < Math.round(rating) ? "'FILL' 1" : "'FILL' 0",
        }}
      >
        star
      </span>
    ))
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease-out',
    }}>
      <div
        ref={popupRef}
        className="card"
        style={{
          width: '320px',
          maxWidth: '90vw',
          animation: 'scaleIn 0.2s ease-out',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'var(--space-3)',
            right: 'var(--space-3)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 'var(--space-1)',
          }}
        >
          <span className="material-symbols-rounded">close</span>
        </button>

        {/* Driver preview */}
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-4) 0',
        }}>
          {driverUser.imageUrl ? (
            <img
              src={driverUser.imageUrl}
              alt={driverUser.firstName}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--primary-subtle)',
                marginBottom: 'var(--space-3)',
              }}
            />
          ) : (
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
              border: '3px solid var(--primary-subtle)',
              margin: '0 auto var(--space-3)',
            }}>
              {initials}
            </div>
          )}

          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            margin: '0 0 var(--space-1)',
          }}>
            {driverUser.firstName} {driverUser.lastName}
          </h3>

          {driver && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-1)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
            }}>
              <div style={{ display: 'flex' }}>
                {renderStars(driver.rating)}
              </div>
              <span>
                {driver.rating} ({driver.totalRides} viajes)
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 'var(--space-3)',
        }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              onClose()
              navigate(`/profile/${driverUser.clerkId}`)
            }}
            style={{ width: '100%' }}
          >
            <span className="material-symbols-rounded">person</span>
            Ver Perfil
          </button>

          {rideId && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                onClose()
                navigate(`/chat/${rideId}`)
              }}
              style={{ width: '100%' }}
            >
              <span className="material-symbols-rounded">chat</span>
              Enviar Mensaje
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default DriverProfilePopup
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/DriverProfilePopup.tsx
git commit -m "feat: add DriverProfilePopup component"
```

### Task 5: Frontend - Route + Integrations

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/RideDetails.tsx`
- Modify: `frontend/src/pages/Chat.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Add route in `App.tsx`** - Add DriverPublicProfile import and route

Add import:
```typescript
import DriverPublicProfile from './pages/DriverPublicProfile'
```

Add route after the driver routes block (after line 129):
```tsx
<Route path="profile/:clerkId" element={
  <ProtectedRoute>
    <DriverPublicProfile />
  </ProtectedRoute>
} />
```

- [ ] **Step 2: Add popup to RideDetails.tsx** - Make driver avatar clickable

Add import:
```typescript
import DriverProfilePopup from '../components/DriverProfilePopup'
```

Add state (with other useState calls around line 47-50):
```typescript
const [showDriverPopup, setShowDriverPopup] = useState(false)
```

In the driver avatar section (around line 832-860), make the avatar clickable:
```tsx
{driverUser.imageUrl ? (
  <img
    src={driverUser.imageUrl}
    alt={driverUser.firstName}
    onClick={() => setShowDriverPopup(true)}
    style={{
      width: '64px',
      height: '64px',
      borderRadius: '50%',
      objectFit: 'cover',
      border: '3px solid var(--primary-subtle)',
      cursor: 'pointer',
      transition: 'opacity 0.2s',
    }}
    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
  />
) : (
  <div
    onClick={() => setShowDriverPopup(true)}
    style={{
      width: '64px',
      height: '64px',
      borderRadius: '50%',
      background: 'var(--primary)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-bold)',
      border: '3px solid var(--primary-subtle)',
      cursor: 'pointer',
    }}
  >
    {driverUser.firstName?.charAt(0) || 'D'}
  </div>
)}
```

Add the popup render near the end of the component (before the closing `</>` or at the end):
```tsx
{showDriverPopup && (
  <DriverProfilePopup
    driverUser={driverUser}
    driver={driver}
    rideId={ride?._id}
    onClose={() => setShowDriverPopup(false)}
  />
)}
```

- [ ] **Step 3: Add clickable driver avatar in Chat.tsx** - For client side

Add import:
```typescript
import DriverProfilePopup from '../components/DriverProfilePopup'
```

Add state (with other useState calls near top):
```typescript
const [showDriverPopup, setShowDriverPopup] = useState(false)
```

Before the chat header section (around line 534), add driver info for the client:
```tsx
{/* Client side - Driver info in chat header */}
{isClient && rideInfo?.driverId && (
  <div className="card" style={{
    marginBottom: 'var(--space-4)',
    padding: 'var(--space-3)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  }}>
    <div
      onClick={() => setShowDriverPopup(true)}
      style={{ cursor: 'pointer' }}
    >
      <img
        src={undefined}
        alt="Conductor"
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          objectFit: 'cover',
          background: 'var(--surface-2)',
        }}
      />
    </div>
    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
      Conductor asignado
    </span>
  </div>
)}

{showDriverPopup && (
  <DriverProfilePopup
    driverUser={/* need driver info */}
    driver={/* need driver info */}
    rideId={rideId}
    onClose={() => setShowDriverPopup(false)}
  />
)}
```

Note: For the chat, we need to load driver user data. This requires additional state and API calls.

- [ ] **Step 4: Add "Ver Perfil Público" to Clerk UserButton in Layout.tsx**

In `components/Layout.tsx`, in the desktop UserButton.MenuItems section (around line 177-188), add:
```tsx
<UserButton.Link
  label="Ver Perfil Público"
  labelIcon={<span className="material-symbols-rounded">person</span>}
  href="/profile/{USER_CLERK_ID}"
/>
```

This needs the user's clerkId. Import `useUser` from Clerk and get the current user's ID to pass as the href.

Add import:
```typescript
import { useAuth, UserButton, useUser } from '@clerk/clerk-react'
```

Get user:
```typescript
const { user } = useUser()
```

Then in the UserButton.Link:
```tsx
<UserButton.Link
  label="Ver Perfil Público"
  labelIcon={<span className="material-symbols-rounded">person</span>}
  href={`/profile/${user?.id}`}
/>
```

Do the same for the mobile UserButton.MenuItems section (around line 381-392).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/RideDetails.tsx frontend/src/pages/Chat.tsx frontend/src/components/Layout.tsx
git commit -m "feat: integrate driver public profile into existing pages"
```
