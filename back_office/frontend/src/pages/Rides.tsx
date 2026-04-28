import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { MapPin } from 'lucide-react'

export default function RidesPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-rides', statusFilter, page],
    queryFn: () => api.getRides({ status: statusFilter || undefined, page }) as Promise<any>
  })

  const rides = data?.rides || []
  const pagination = data?.pagination || {}

  const statusLabels: Record<string, string> = {
    requested: 'Solicitado',
    negotiating: 'Negociando',
    accepted: 'Aceptado',
    in_progress: 'En progreso',
    completed: 'Completado',
    paid: 'Pagado',
    cancelled: 'Cancelado'
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Pedidos</h1>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Todos los estados</option>
          <option value="requested">Solicitado</option>
          <option value="negotiating">Negociando</option>
          <option value="accepted">Aceptado</option>
          <option value="in_progress">En progreso</option>
          <option value="completed">Completado</option>
          <option value="paid">Pagado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {/* Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Cargando...
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', color: 'var(--error)' }}>
            Error cargando pedidos
          </div>
        ) : rides.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay pedidos
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Conductor</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((ride: any) => (
                  <tr key={ride._id}>
                    <td>
                      <div>
                        <p style={{ fontWeight: 500 }}>{ride.title}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MapPin size={12} /> {ride.pickupLocation?.address}
                          <span>→</span>
                          {ride.dropoffLocation?.address}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {ride.type}
                        </p>
                      </div>
                    </td>
                    <td>
                      {ride.client ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {ride.client.imageUrl && (
                            <img 
                              src={ride.client.imageUrl} 
                              alt="" 
                              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          )}
                          <span>{ride.client.firstName} {ride.client.lastName}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      {ride.driver ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {ride.driver.imageUrl && (
                            <img 
                              src={ride.driver.imageUrl} 
                              alt="" 
                              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          )}
                          <span>{ride.driver.firstName} {ride.driver.lastName}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className="font-mono">
                        ${ride.finalPrice || ride.estimatedPrice}
                      </span>
                      {ride.finalPrice && ride.finalPrice !== ride.estimatedPrice && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                          (original: ${ride.estimatedPrice})
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={'badge badge-' + ride.status}>
                        {statusLabels[ride.status] || ride.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {ride.createdAt ? new Date(ride.createdAt).toLocaleDateString('es-ES') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-outline btn-sm"
                >
                  Anterior
                </button>
                <span style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                  Página {page} de {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="btn-outline btn-sm"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}