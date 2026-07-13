import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { paymentsAPI } from '../services/api'
import { hideLoading, showLoading } from '../services/alerts'

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
  const { t, i18n } = useTranslation()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [history, setHistory] = useState<PaymentHistoryItem[]>([])
  const [summary, setSummary] = useState({ totalEarnings: 0, totalRides: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadHistory()
  }, [page])

  useEffect(() => {
    if (loading) {
      showLoading(t('common.loading'))
    } else {
      hideLoading()
    }

    return () => {
      hideLoading()
    }
  }, [loading])

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

  function formatCurrency(amountInCents: number) {
    const amount = amountInCents / 100
    return new Intl.NumberFormat(i18n.language || 'en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString(i18n.language || 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return null
  }

  return (
    <div>
      <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'inherit', padding: 0 }}>
        <span className="material-symbols-rounded">arrow_back</span>
        {t('common.back')}
      </button>

      <h1 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="material-symbols-rounded">account_balance_wallet</span>
        {t('driver.payment.title')}
      </h1>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.9 }}>{t('driver.payment.total')}</p>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(summary.totalEarnings)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.9 }}>{t('driver.payment.totalRides')}</p>
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
            {t('driver.payment.empty')}
          </p>
          <button onClick={() => navigate(-1)} className="btn btn-outline" style={{ marginTop: '1rem', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'inherit' }}>
            {t('common.back')}
          </button>
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
                      {t('driver.payment.paidOn')} {formatDate(item.paidAt)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--success)', marginBottom: '0.25rem' }}>
                      +{formatCurrency(item.driverAmount)}
                    </p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <div>{t('driver.payment.tripTotal')} ${((item.driverAmount + item.platformFee) / 100).toFixed(2)}</div>
                      <div>{t('driver.payment.yourPayment')} {formatCurrency(item.driverAmount)} | {t('driver.payment.commission')} {formatCurrency(item.platformFee)}</div>
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
                {t('driver.payment.pageOf', { page, totalPages })}
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