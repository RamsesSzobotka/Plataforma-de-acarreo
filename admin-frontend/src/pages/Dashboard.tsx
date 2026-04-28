import { useEffect, useState } from 'react'
import { api } from '../services/api'

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error)
  }, [])

  if (!stats) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Usuarios Totales',
      value: stats.users.total,
      icon: 'group',
      type: 'primary',
    },
    {
      label: 'Conductores',
      value: stats.users.drivers,
      icon: 'local_shipping',
      type: 'secondary',
    },
    {
      label: 'Verificaciones Pendientes',
      value: stats.drivers.pending,
      icon: 'pending_actions',
      type: 'warning',
    },
    {
      label: 'Conductores Verificados',
      value: stats.drivers.verified,
      icon: 'verified_user',
      type: 'success',
    },
    {
      label: 'Pedidos Totales',
      value: stats.rides.total,
      icon: 'inventory_2',
      type: 'primary',
    },
    {
      label: 'Pedidos Completados',
      value: stats.rides.completed,
      icon: 'check_circle',
      type: 'success',
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>
      <div className="stats-grid">
        {statCards.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className={`icon-wrap ${stat.type}`}>
              <span className="material-symbols-rounded">{stat.icon}</span>
            </div>
            <div className="stat-info">
              <h3>{stat.label}</h3>
              <p>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}