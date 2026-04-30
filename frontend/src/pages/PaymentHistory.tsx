import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { paymentsAPI } from '../services/api'

interface PaymentHistoryItem {
  _id: string
  title: string
  finalPrice: number
  driverAmount: number
  platformFee: number
  paidAt: string
  pickupLocation: { address: string }
  dropoffLocation: { address: string }
  createdAt: string
}

interface PaymentHistoryResponse {
  data: PaymentHistoryItem[]
  summary: { totalEarnings: number; totalRides: number }
  pagination: { page: number; limit: number; total: number; pages: number }
}

function PaymentHistory() {
  const { getToken } = useAuth()
  const [history, setHistory] = useState<PaymentHistoryItem[]>([])
  const [summary, setSummary] = useState({ totalEarnings: 0, totalRides: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadHistory()
  }, [page])

  async function loadHistory() {
    try {
      const token = await getToken()
      const data: PaymentHistoryResponse = await paymentsAPI.getPaymentHistory({ page, limit: 20 }, token || undefined)
      setHistory(data.data || [])
      setSummary(data.summary || { totalEarnings: 0, totalRides: 0 })
      setTotalPages(data.pagination?.pages || 1)
    } catch (error) {
      console.error('Error loading payment history:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <span className="material-symbols-rounded" style={{ fontSize: '3rem', animation: 'spin 1s linear infinite' }}>
          sync
        </span>
        <p style={{ marginTop: '1rem', color: '#64748B' }}>Cargando historial...</p>
      </div>
    )
  }

  return (
    <div>
      <Link to="/driver" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
        <span className="material-symbols-rounded">arrow_back</span>
        Volver al Panel del Conductor
      </Link>

      <h1 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="material-symbols-rounded">account_balance_wallet</span>
        Historial de Pagos
      </h1>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.9 }}>Total Earnings</p>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(summary.totalEarnings)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.9 }}>Total Acarreos Pagados</p>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
              {summary.totalRides}
            </p>
          </div>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#64748B', marginBottom: '1rem', display: 'block' }}>
            receipt_long
          </span>
          <p style={{ color: 'var(--text-muted)' }}>
            No tienes pagos recibidos todavía
          </p>
          <Link to="/driver" className="btn btn-outline" style={{ marginTop: '1rem' }}>
            Volver al Panel
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {history.map((item) => (
              <div key={item._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>local_shipping</span>
                      {item.title}
                    </h3>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>location_on</span>
                        {item.pickupLocation.address}
                      </p>
                      <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>flag</span>
                        {item.dropoffLocation.address}
                      </p>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      Pagado: {formatDate(item.paidAt)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--success)', marginBottom: '0.25rem' }}>
                      +{formatCurrency(item.driverAmount)}
                    </p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <div>Precio total: {formatCurrency(item.finalPrice)}</div>
                      <div>Comisión (10%): {formatCurrency(item.platformFee)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button
                className="btn btn-outline"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <span className="material-symbols-rounded">chevron_left</span>
              </button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', color: 'var(--text-secondary)' }}>
                Página {page} de {totalPages}
              </span>
              <button
                className="btn btn-outline"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <span className="material-symbols-rounded">chevron_right</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default PaymentHistory