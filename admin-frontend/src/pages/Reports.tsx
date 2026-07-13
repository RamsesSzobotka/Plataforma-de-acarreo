import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api } from '../services/api'

function fmtMoney(n: number) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const FILTERS = [
  { label: '3 meses', value: 3 },
  { label: '6 meses', value: 6 },
  { label: '12 meses', value: 12 },
  { label: '24 meses', value: 24 },
  { label: '60 meses', value: 60 },
]

const REVENUE_COLORS = {
  revenue: '#22C55E',
  fees: '#F97316',
  driverPayouts: '#3B82F6',
}

const RIDES_COLORS = {
  completed: '#22C55E',
  cancelled: '#EF4444',
  paid: '#3B82F6',
}

const USERS_COLORS = {
  newClients: '#0D9488',
  newDrivers: '#F97316',
}

export default function Reports() {
  const navigate = useNavigate()
  const [months, setMonths] = useState(12)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.adminToken) {
      navigate('/login')
      return
    }
  }, [navigate])

  useEffect(() => {
    const fetchData = () => {
      api.getMonthlyReports(months)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
    fetchData()
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [months])

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    )
  }

  // Backend returns { months: [...], totals: {...} }
  const summary = data?.totals || data?.summary || {}
  const monthlyData = data?.months || []

  // Agrupar por año cuando el filtro es >= 12 meses
  const chartData = months < 24 ? monthlyData : Object.values(
    monthlyData.reduce((acc: any, m: any) => {
      if (!acc[m.year]) acc[m.year] = { year: m.year, label: String(m.year) }
      for (const k of Object.keys(m)) {
        if (typeof m[k] === 'number' && k !== 'year' && k !== 'month')
          acc[m.year][k] = (acc[m.year][k] || 0) + m[k]
      }
      return acc
    }, {})
  )

  const statCards = [
    { label: 'Ingresos Totales', value: fmtMoney(summary.totalRevenue), icon: 'payments', type: 'success' as const },
    { label: 'Comisiones (10%)', value: fmtMoney(summary.totalFees), icon: 'percent', type: 'secondary' as const },
    { label: 'Pagos a Conductores', value: fmtMoney(summary.totalDriverPayouts), icon: 'account_balance', type: 'primary' as const },
    { label: 'Viajes Completados', value: summary.totalRidesCompleted ?? 0, icon: 'check_circle', type: 'success' as const },
    { label: 'Clientes Nuevos', value: summary.totalNewClients ?? 0, icon: 'person_add', type: 'primary' as const },
    { label: 'Conductores Nuevos', value: summary.totalNewDrivers ?? 0, icon: 'local_shipping', type: 'secondary' as const },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>Informes</h2>
      </div>

      {/* Time filter */}
      <div className="filter-bar">
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Período:</span>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`filter-btn ${months === f.value ? 'active' : ''}`}
            onClick={() => { setMonths(f.value); setLoading(true) }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary stat cards */}
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

      {/* Chart row 1 — Monthly Revenue */}
      <div className="chart-card">
        <h4>Ingresos Mensuales</h4>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                fontSize: '0.8125rem',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="revenue" name="Ingresos" stroke={REVENUE_COLORS.revenue} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="fees" name="Comisiones" stroke={REVENUE_COLORS.fees} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="driverPayouts" name="Pago Conductores" stroke={REVENUE_COLORS.driverPayouts} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart row 2 — Monthly Rides */}
      <div className="chart-card">
        <h4>Viajes por Mes</h4>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                fontSize: '0.8125rem',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="ridesCompleted" name="Completados" stroke={RIDES_COLORS.completed} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="ridesCancelled" name="Cancelados" stroke={RIDES_COLORS.cancelled} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="ridesPaid" name="Pagados" stroke={RIDES_COLORS.paid} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart row 3 — New Users */}
      <div className="chart-card">
        <h4>Usuarios Nuevos por Mes</h4>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                fontSize: '0.8125rem',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="newClients" name="Nuevos Clientes" stroke={USERS_COLORS.newClients} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="newDrivers" name="Nuevos Conductores" stroke={USERS_COLORS.newDrivers} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
