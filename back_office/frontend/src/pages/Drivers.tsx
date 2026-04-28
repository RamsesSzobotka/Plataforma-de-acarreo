import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Link } from 'react-router-dom'

export default function DriversPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-drivers', statusFilter, page],
    queryFn: () => api.getDrivers({ status: statusFilter || undefined, page }) as Promise<any>
  })

  const drivers = data?.drivers || []
  const pagination = data?.pagination || {}

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem' }}>Conductores</h1>
        <Link to="/drivers/pending" className="btn-primary btn-sm">
          Verificar Nuevos
        </Link>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="in_review">En revisión</option>
          <option value="verified">Verificado</option>
          <option value="rejected">Rechazado</option>
          <option value="suspended">Suspendido</option>
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
            Error cargando conductores
          </div>
        ) : drivers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay conductores
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Conductor</th>
                  <th>Vehículo</th>
                  <th>Capacidad</th>
                  <th>Verificación</th>
                  <th>Rating</th>
                  <th>Viajes</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver: any) => (
                  <tr key={driver._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {driver.user?.imageUrl ? (
                          <img 
                            src={driver.user.imageUrl} 
                            alt="" 
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'var(--bg-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 600
                          }}>
                            {driver.user?.firstName?.[0] || '?'}
                          </div>
                        )}
                        <div>
                          <p style={{ fontWeight: 500 }}>
                            {driver.user?.firstName} {driver.user?.lastName}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {driver.user?.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize' }}>
                        {driver.vehicleType}
                      </span>
                      <br />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {driver.plate}
                      </span>
                    </td>
                    <td className="font-mono">{driver.capacityKg} kg</td>
                    <td>
                      <span className={'badge badge-' + driver.verificationStatus}>
                        {driver.verificationStatus}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: driver.rating > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {driver.rating > 0 ? driver.rating.toFixed(1) + ' ★' : '-'}
                      </span>
                    </td>
                    <td>{driver.totalRides}</td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {driver.createdAt ? new Date(driver.createdAt).toLocaleDateString('es-ES') : '-'}
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