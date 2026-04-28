import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Users, Truck, FileCheck, DollarSign, Package, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.getStats() as Promise<any>
  })

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Cargando...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'var(--error)' }}>
        Error cargando estadísticas
      </div>
    )
  }

  const stats = data?.stats || {}
  const ridesByStatus = data?.ridesByStatus || {}
  const driversByStatus = data?.driversByStatus || {}
  const ridesByMonth = data?.ridesByMonth || []

  const statCards = [
    { 
      label: 'Total Usuarios', 
      value: stats.totalUsers || 0, 
      icon: Users, 
      color: '#0D9488' 
    },
    { 
      label: 'Total Conductores', 
      value: stats.totalDrivers || 0, 
      icon: Truck, 
      color: '#F97316' 
    },
    { 
      label: 'Pendientes Verificación', 
      value: stats.pendingDrivers || 0, 
      icon: FileCheck, 
      color: '#F59E0B' 
    },
    { 
      label: 'Ingresos Plataforma', 
      value: '$' + ((stats.platformRevenue || 0) / 100).toFixed(2), 
      icon: DollarSign, 
      color: '#22C55E' 
    },
    { 
      label: 'Total Pedidos', 
      value: stats.totalRides || 0, 
      icon: Package, 
      color: '#8B5CF6' 
    },
    { 
      label: 'Pedidos Completados', 
      value: stats.completedRides || 0, 
      icon: TrendingUp, 
      color: '#06B6D4' 
    }
  ]

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Dashboard</h1>
      
      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {statCards.map((card) => (
          <div key={card.label} className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  {card.label}
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {card.value}
                </p>
              </div>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-sm)',
                background: card.color + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <card.icon size={24} color={card.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rides by Status */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Pedidos por Estado</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {Object.entries(ridesByStatus).map(([status, count]: [string, any]) => (
            <div 
              key={status} 
              className={'badge badge-' + status}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              {status}: {String(count)}
            </div>
          ))}
        </div>
      </div>

      {/* Drivers by Status */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Conductores por Verificación</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {Object.entries(driversByStatus).map(([status, count]: [string, any]) => (
            <div 
              key={status} 
              className={'badge badge-' + status}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              {status}: {String(count)}
            </div>
          ))}
        </div>
      </div>

      {/* Rides by Month */}
      {ridesByMonth.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Pedidos por Mes</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Pedidos</th>
                <th>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {ridesByMonth.map((item: any) => (
                <tr key={item.month}>
                  <td>{item.month}</td>
                  <td>{item.count}</td>
                  <td className="font-mono">${item.revenue || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}