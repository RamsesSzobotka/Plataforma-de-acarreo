import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Search, ToggleLeft, ToggleRight } from 'lucide-react'

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', search, roleFilter, page],
    queryFn: () => api.getUsers({ search: search || undefined, role: roleFilter || undefined, page }) as Promise<any>
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => api.toggleUserActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    }
  })

  const users = data?.users || []
  const pagination = data?.pagination || {}

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem' }}>Usuarios</h1>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
            <Search size={20} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Buscar por email, nombre o apellido..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ flex: 1 }}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          >
            <option value="">Todos los roles</option>
            <option value="client">Cliente</option>
            <option value="driver">Conductor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Cargando...
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', color: 'var(--error)' }}>
            Error cargando usuarios
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay usuarios
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: any) => (
                  <tr key={user.clerkId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {user.imageUrl ? (
                          <img 
                            src={user.imageUrl} 
                            alt="" 
                            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'var(--bg-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 600
                          }}>
                            {user.firstName?.[0] || user.lastName?.[0] || '?'}
                          </div>
                        )}
                        <div>
                          <p style={{ fontWeight: 500 }}>
                            {user.firstName} {user.lastName}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {user.clerkId.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={'badge badge-' + (user.role === 'client' ? 'requested' : user.role === 'driver' ? 'in_progress' : 'verified')}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: user.isActive ? 'var(--success)' : 'var(--error)' }}>
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES') : '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => toggleActiveMutation.mutate(user.clerkId)}
                          className="btn-outline btn-sm"
                          title={user.isActive ? 'Desactivar' : 'Activar'}
                        >
                          {user.isActive ? <ToggleLeft size={18} /> : <ToggleRight size={18} />}
                        </button>
                      </div>
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