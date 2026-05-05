import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { ridesAPI } from '../services/api'
import { useNotifications } from '../contexts/NotificationsContext'
import { wsService } from '../services/api'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import type { PaginatedResponse } from '../types'

interface Ride {
  _id: string
  title: string
  type: string
  status: string
  estimatedPrice: number
  images?: Array<{ url: string }>
  pickupLocation: { address: string }
  dropoffLocation: { address: string }
  createdAt: string
  clientId: string
}

const PAGE_LIMIT = 10

const filterOptions = [
  { value: 'all', label: 'Todos', icon: 'list' },
  { value: 'requested', label: 'Pendientes', icon: 'inbox' },
  { value: 'negotiating', label: 'Negociando', icon: 'chat' },
  { value: 'accepted', label: 'Aceptados', icon: 'check_circle' },
  { value: 'in_progress', label: 'En Viaje', icon: 'delivery_truck_speed' },
  { value: 'completed', label: 'Completados', icon: 'task_alt' },
]

function MyRides() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const { unreadCounts } = useNotifications()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [filter])

  useEffect(() => {
    if (user) {
      loadRides()
    }
  }, [user, filter, page])

  useEffect(() => {
    if (!user) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadRides()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    const refreshInterval = setInterval(loadRides, 10000)

    const unsubscribe = wsService.onMessage((data) => {
      if (data.type === 'new_message' && data.data) {
        loadRides()
      }
    })

    return () => {
      unsubscribe()
      clearInterval(refreshInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user])

  async function loadRides() {
    try {
      setLoading(true)
      const token = await getToken()
      const data: PaginatedResponse<Ride> = await ridesAPI.list(
        {
          clientId: user?.id,
          status: filter !== 'all' ? filter : undefined,
          page,
          limit: PAGE_LIMIT,
        },
        token || undefined
      )
      setRides(data.data || [])
      if (data.pagination) {
        setTotal(data.pagination.total)
        setTotalPages(data.pagination.pages)
      }
    } catch (error) {
      console.error('Error loading rides:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  const handleChatClick = (e: React.MouseEvent, rideId: string) => {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/ride/${rideId}`)
  }

  const startRange = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1
  const endRange = Math.min(page * PAGE_LIMIT, total)

  if (loading) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Loading skeleton */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-6)',
        }}>
          <div className="skeleton" style={{ width: '200px', height: '40px' }} />
          <div className="skeleton" style={{ width: '140px', height: '40px', borderRadius: 'var(--radius)' }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ width: '100px', height: '36px', borderRadius: 'var(--radius)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '140px', borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      </div>
    )
  }

  const activeFilterLabel = filterOptions.find(f => f.value === filter)?.label || 'Todos'

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-6)',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-2)',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
          }}>
            <span style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--primary-subtle)',
              color: 'var(--primary)',
              borderRadius: 'var(--radius)',
            }}>
              <span className="material-symbols-rounded">local_shipping</span>
            </span>
            Mis Pedidos
          </h1>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
          }}>
            {total > 0
              ? `Tienes ${total} pedido${total !== 1 ? 's' : ''} en total`
              : 'Gestiona tus pedidos de acarreo'
            }
          </p>
        </div>
        <Link to="/create-ride" className="btn btn-primary" style={{ flexShrink: 0 }}>
          <span className="material-symbols-rounded">add</span>
          Nuevo Pedido
        </Link>
      </div>

      {/* Filter Chips */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-6)',
        overflowX: 'auto',
        paddingBottom: 'var(--space-2)',
      }}>
        {filterOptions.map((option) => {
          const isActive = filter === option.value
          return (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-4)',
                background: isActive ? 'var(--primary)' : 'var(--surface-card)',
                color: isActive ? 'white' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: isActive ? 'var(--primary)' : 'var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) var(--ease-out)',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                {option.icon}
              </span>
              {option.label}
            </button>
          )
        })}
      </div>

      {/* Results info */}
      {total > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
        }}>
          <span>
            Mostrando <strong style={{ color: 'var(--text-primary)' }}>{startRange}-{endRange}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> pedidos
          </span>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>filter_list</span>
            Filtro: {activeFilterLabel}
          </span>
        </div>
      )}

      {/* Rides list */}
      {rides.length === 0 ? (
        <EmptyState
          icon={filter === 'all' ? 'inventory_2' : 'search_off'}
          title={filter === 'all' ? 'No tienes pedidos todavia' : `No hay pedidos ${activeFilterLabel.toLowerCase()}`}
          description={
            filter === 'all'
              ? 'Crea tu primer pedido de acarreo y conecta con conductores cercanos.'
              : `No tienes pedidos en estado "${activeFilterLabel}". Prueba cambiar el filtro.`
          }
          action={{
            label: filter === 'all' ? 'Crear Nuevo Pedido' : 'Ver Todos',
            href: filter === 'all' ? '/create-ride' : undefined,
            onClick: filter !== 'all' ? () => setFilter('all') : undefined,
          }}
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 'var(--space-4)',
        }} className="stagger-children">
          {rides.map((ride) => {
            const unreadCount = unreadCounts[ride._id] || 0
            const firstImage = ride.images?.[0]?.url

            return (
              <Link
                key={ride._id}
                to={`/ride/${ride._id}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div
                  className="card card-hover"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {/* Unread messages badge */}
                  {unreadCount > 0 && (
                    <div
                      onClick={(e) => handleChatClick(e, ride._id)}
                      style={{
                        position: 'absolute',
                        top: 'var(--space-3)',
                        right: 'var(--space-3)',
                        minWidth: '24px',
                        height: '24px',
                        padding: '0 var(--space-2)',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--error)',
                        color: 'white',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--font-bold)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                        zIndex: 10,
                        cursor: 'pointer',
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '0.875rem', marginRight: '2px' }}>
                        chat
                      </span>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}

                  {/* Image */}
                  {firstImage ? (
                    <div style={{
                      height: '160px',
                      background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      <img
                        src={firstImage}
                        alt={ride.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      {/* Status overlay */}
                      <div style={{
                        position: 'absolute',
                        bottom: 'var(--space-3)',
                        left: 'var(--space-3)',
                      }}>
                        <StatusBadge status={ride.status} size="sm" />
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      height: '100px',
                      background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}>
                        image
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div style={{ padding: 'var(--space-4)' }}>
                    <h3 style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--font-semibold)',
                      marginBottom: 'var(--space-3)',
                      lineHeight: 1.3,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {ride.title}
                    </h3>

                    {/* Route */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                      marginBottom: 'var(--space-4)',
                      padding: 'var(--space-3)',
                      background: 'var(--surface-0)',
                      borderRadius: 'var(--radius)',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-xs)',
                      }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--success)' }}>
                          circle
                        </span>
                        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ride.pickupLocation.address}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-xs)',
                      }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--error)' }}>
                          location_on
                        </span>
                        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ride.dropoffLocation.address}
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: 'var(--space-3)',
                      borderTop: '1px solid var(--border-subtle)',
                    }}>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                      }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>
                          schedule
                        </span>
                        {new Date(ride.createdAt).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-lg)',
                        fontWeight: 'var(--font-bold)',
                        color: 'var(--secondary)',
                      }}>
                        ${ride.estimatedPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-8)',
          flexWrap: 'wrap',
        }}>
          <button
            className="btn btn-outline"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>chevron_left</span>
            Anterior
          </button>

          <div style={{
            display: 'flex',
            gap: 'var(--space-1)',
            alignItems: 'center',
          }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= page - 1 && pageNum <= page + 1)
              ) {
                return (
                  <button
                    key={pageNum}
                    className={`btn ${pageNum === page ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => handlePageChange(pageNum)}
                    style={{ minWidth: '40px', padding: 'var(--space-2)' }}
                  >
                    {pageNum}
                  </button>
                )
              }
              if (pageNum === page - 2 || pageNum === page + 2) {
                return (
                  <span key={pageNum} style={{
                    color: 'var(--text-muted)',
                    padding: '0 var(--space-2)',
                  }}>
                    ...
                  </span>
                )
              }
              return null
            })}
          </div>

          <button
            className="btn btn-outline"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            Siguiente
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>chevron_right</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default MyRides