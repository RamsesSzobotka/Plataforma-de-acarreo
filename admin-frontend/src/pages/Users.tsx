import { useEffect, useState } from 'react'

import { api } from '../services/api'

function downloadCSV(url: string) {
  const token = localStorage.getItem('adminToken')
  if (!token) return
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = url.includes('/rides') ? 'rides.csv' : url.includes('/users') ? 'usuarios.csv' : 'pagos.csv'
      a.click()
      URL.revokeObjectURL(a.href)
    })
    .catch(console.error)
}

interface User {
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
  role: string
  isActive: boolean
  createdAt: string
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState('todos')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })

  useEffect(() => {
    setLoading(true)
    api
      .getUsers({ role: roleFilter || 'todos', page })
      .then((res) => {
        setUsers(res.data)
        setPagination(res.pagination)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, roleFilter])

  function getInitials(firstName?: string, lastName?: string) {
    if (firstName) return firstName[0].toUpperCase()
    if (lastName) return lastName[0].toUpperCase()
    return '?'
  }

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2>Usuarios</h2>
      </div>
      <div className="data-table-wrap">
        <div className="table-header">
          <h3>Todos los usuarios</h3>
          <div className="table-filters">
            <select
              className="filter-select"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="todos">Todos</option>
              <option value="client">Clientes</option>
              <option value="driver">Conductores</option>
              <option value="admin">Admins</option>
            </select>
            <button className="action-btn secondary" onClick={() => downloadCSV(`/api/admin/export/users${roleFilter && roleFilter !== 'todos' ? `?role=${roleFilter}` : ''}`)}>
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>download</span>
              Exportar CSV
            </button>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Fecha de registro</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.clerkId}
                onClick={() => window.location.href = `/users/${user.clerkId}`}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <div className="user-cell">
                    {user.imageUrl ? (
                      <img
                        src={user.imageUrl}
                        alt="Avatar"
                        className="user-avatar"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="user-avatar">
                        {getInitials(user.firstName, user.lastName)}
                      </div>
                    )}
                    <div className="user-info">
                      <span className="name">
                        {user.firstName || user.lastName
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                          : 'Sin nombre'}
                      </span>
                      <span className="email">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${user.role}`}>
                    {user.role === 'client'
                      ? 'Cliente'
                      : user.role === 'driver'
                        ? 'Conductor'
                        : 'Admin'}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${user.isActive ? 'verified' : 'cancelled'}`}>
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  {new Date(user.createdAt).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <span className="pagination-info">
            Página {pagination.page} de {pagination.pages} (
            {pagination.total} usuarios)
          </span>
          <div className="pagination-buttons">
            <button
              disabled={pagination.page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => i + 1).map(
              (p) => (
                <button
                  key={p}
                  className={pagination.page === p ? 'active' : ''}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}
            <button
              disabled={pagination.page === pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}