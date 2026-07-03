import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtUptime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h}h ${m}m ${s}s`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<any>(null)
  const [systemStats, setSystemStats] = useState<any>(null)
  const [monitoring, setMonitoring] = useState<any>(null)
  const [revenue, setRevenue] = useState<any>(null)

  useEffect(() => {
    if (!localStorage.adminToken) {
      navigate('/login')
      return
    }

    const fetch = () => {
      Promise.all([
        api.getStats(),
        api.getSystemStats().catch(() => null),
        api.getMonitoringMetrics().catch(() => null),
        api.getRevenueStats().catch(() => null),
      ]).then(([s, sys, mon, rev]) => {
        setStats(s); setSystemStats(sys); setMonitoring(mon); setRevenue(rev)
      }).catch(console.error)
    }

    fetch()
    const id = setInterval(fetch, 5000)
    return () => clearInterval(id)
  }, [navigate])

  if (!stats) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    )
  }

  // Build stat cards from stats endpoint
  const statCards = [
    { label: 'Usuarios Totales', value: stats.users.total, icon: 'group', type: 'primary' },
    { label: 'Conductores', value: stats.users.drivers, icon: 'local_shipping', type: 'secondary' },
    { label: 'Verificaciones Pendientes', value: stats.drivers.pending, icon: 'pending_actions', type: 'warning' },
    { label: 'Conductores Verificados', value: stats.drivers.verified, icon: 'verified_user', type: 'success' },
    { label: 'Pedidos Totales', value: stats.rides.total, icon: 'inventory_2', type: 'primary' },
    { label: 'Pedidos Completados', value: stats.rides.completed, icon: 'check_circle', type: 'success' },
  ]

  // Convert monitoring.metrics (object) → array for iteration
  const metricEntries = monitoring?.metrics
    ? Object.entries(monitoring.metrics).map(([endpoint, m]: [string, any]) => ({
        endpoint,
        count: m.count,
        avgMs: m.avgMs,
        errors4xx: m.errors4xx,
        errors5xx: m.errors5xx,
      }))
    : []

  const maxLatency = metricEntries.length > 0
    ? Math.max(...metricEntries.map((e) => e.avgMs), 1)
    : 1

  const memPct = systemStats
    ? Math.min(100, (systemStats.memory.heapUsed / systemStats.memory.heapTotal) * 100)
    : 0

  function latencyClass(avgMs: number) {
    if (avgMs > 500) return 'critical'
    if (avgMs > 200) return 'slow'
    return ''
  }

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>

      {/* === STAT CARDS === */}
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

      {/* === MONITOREO DEL SISTEMA === */}
      {systemStats && (
        <>
          <h3 className="section-title">Monitoreo del Sistema</h3>
          <div className="monitoring-grid">
            <div className="monitoring-card">
              <h4>Memoria (Heap)</h4>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${memPct}%`, background: 'var(--primary)' }}
                />
              </div>
              <div className="progress-label">
                <span>{systemStats.memory.heapUsed.toFixed(1)} MB / {systemStats.memory.heapTotal.toFixed(1)} MB</span>
                <span className="value">{memPct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="monitoring-card">
              <h4>Proceso</h4>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {fmtUptime(systemStats.uptime)}
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Tiempo de actividad
              </p>
            </div>
          </div>
        </>
      )}

      {/* === RENDIMIENTO POR ENDPOINT === */}
      {metricEntries.length > 0 && (
        <>
          <h3 className="section-title">Rendimiento por Endpoint</h3>
          <div className="data-table-wrap endpoint-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Peticiones</th>
                  <th>Tiempo Promedio</th>
                  <th>Errores 4xx</th>
                  <th>Errores 5xx</th>
                </tr>
              </thead>
              <tbody>
                {metricEntries.map((e) => (
                  <tr key={e.endpoint}>
                    <td><code style={{ fontSize: '0.8125rem' }}>{e.endpoint}</code></td>
                    <td>{e.count.toLocaleString()}</td>
                    <td>
                      <div className="latency-bar-wrap">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', minWidth: '3.5rem' }}>
                          {e.avgMs}ms
                        </span>
                        <div className="latency-bar">
                          <div
                            className={`latency-bar-fill ${latencyClass(e.avgMs)}`}
                            style={{ width: `${(e.avgMs / maxLatency) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      {e.errors4xx > 0
                        ? <span className="badge-4xx">{e.errors4xx}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>0</span>
                      }
                    </td>
                    <td>
                      {e.errors5xx > 0
                        ? <span className="badge-5xx">{e.errors5xx}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>0</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {monitoring.summary && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
              {monitoring.summary.totalRequests} peticiones totales · Promedio {monitoring.summary.avgResponseTime}ms ·
              4xx: {monitoring.summary.errorRate4xx}% · 5xx: {monitoring.summary.errorRate5xx}%
            </p>
          )}
        </>
      )}

      {/* === INGRESOS === */}
      {revenue && (
        <>
          <h3 className="section-title">Ingresos</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="icon-wrap primary">
                <span className="material-symbols-rounded">payments</span>
              </div>
              <div className="stat-info">
                <h3>Ingresos Totales</h3>
                <p>{fmtMoney(revenue.totalRevenue)}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="icon-wrap secondary">
                <span className="material-symbols-rounded">percent</span>
              </div>
              <div className="stat-info">
                <h3>Comisiones (10%)</h3>
                <p>{fmtMoney(revenue.totalFees)}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="icon-wrap success">
                <span className="material-symbols-rounded">account_balance</span>
              </div>
              <div className="stat-info">
                <h3>Pagos a Conductores</h3>
                <p>{fmtMoney(revenue.totalDriverPayouts)}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="icon-wrap warning">
                <span className="material-symbols-rounded">today</span>
              </div>
              <div className="stat-info">
                <h3>Viajes Pagados Hoy</h3>
                <p>{revenue.ridesPaidToday}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="icon-wrap primary">
                <span className="material-symbols-rounded">calendar_month</span>
              </div>
              <div className="stat-info">
                <h3>Viajes Pagados Este Mes</h3>
                <p>{revenue.ridesPaidThisMonth}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}