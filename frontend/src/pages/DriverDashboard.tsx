import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'

interface Driver {
  _id: string
  verificationStatus: string
  rejectionReason?: string
  phone?: string
  vehicleType?: string
  plate?: string
  rating?: number
  isAvailable?: boolean
}

interface Ride {
  _id: string
  title: string
  type: string
  status: string
  estimatedPrice: number
  pickupLocation: { address: string }
  dropoffLocation: { address: string }
  description: string
}

function DriverDashboard() {
  const { user } = useUser()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [availableRides, setAvailableRides] = useState<Ride[]>([])
  const [myRides, setMyRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'available' | 'mine'>('available')

  useEffect(() => {
    loadDriver()
  }, [user])

  useEffect(() => {
    if (driver?.verificationStatus === 'verified') {
      loadRides()
    }
  }, [tab, driver?.verificationStatus])

  async function loadDriver() {
    try {
      const response = await fetch('/api/users/driver/me')
      if (response.ok) {
        const data = await response.json()
        setDriver(data)
      }
    } catch (error) {
      console.error('Error loading driver:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadRides() {
    try {
      if (tab === 'available') {
        const response = await fetch('/api/rides?status=requested')
        const data = await response.json()
        setAvailableRides(data.data || [])
      } else {
        const response = await fetch('/api/rides?driverId=' + user?.id)
        const data = await response.json()
        setMyRides(data.data || [])
      }
    } catch (error) {
      console.error('Error loading rides:', error)
    }
  }

  async function handleAcceptRide(rideId: string, price: number) {
    if (!user) return
    
    try {
      await fetch(`/api/rides/${rideId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: user.id, agreedPrice: price }),
      })
      loadRides()
    } catch (error) {
      console.error('Error accepting ride:', error)
    }
  }

  // Estado de verificación
  const verificationStatus = driver?.verificationStatus

  // No está registrado como driver
  if (!driver && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h1 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-symbols-rounded">directions_car</span>
          Panel del Conductor
        </h1>
        <div className="card" style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#64748B', marginBottom: '1rem', display: 'block' }}>
            how_to_reg
          </span>
          <h2 style={{ marginBottom: '1rem' }}>Regístrate como Conductor</h2>
          <p style={{ color: '#64748B', marginBottom: '1.5rem' }}>
            Para comenzar a aceptar acarreos, necesitas completar tu registro y verificación.
          </p>
          <Link to="/register-driver" className="btn btn-primary" style={{ padding: '1rem 2rem' }}>
            <span className="material-symbols-rounded">add</span>
            Registrarse como Conductor
          </Link>
        </div>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <span className="material-symbols-rounded" style={{ fontSize: '3rem', animation: 'spin 1s linear infinite' }}>
          sync
        </span>
        <p style={{ marginTop: '1rem', color: '#64748B' }}>Cargando...</p>
      </div>
    )
  }

  // Mostrar estado de verificación
  if (verificationStatus !== 'verified') {
    return (
      <div>
        <h1 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-symbols-rounded">directions_car</span>
          Panel del Conductor
        </h1>

        {/* Estado: pending */}
        {verificationStatus === 'pending' && (
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', borderLeft: '4px solid #F59E0B' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#F59E0B' }}>hourglass_empty</span>
              <div>
                <h2 style={{ color: '#F59E0B', marginBottom: '0' }}>Verificación Pendiente</h2>
                <p style={{ color: '#64748B', marginTop: '0.25rem' }}>Estado: En revisión</p>
              </div>
            </div>
            <p style={{ color: '#334155', marginBottom: '1rem' }}>
              Tus documentos están en revisión. No podrás aceptar encargos hasta que un admin apruebe tu perfil.
            </p>
            <p style={{ color: '#64748B', fontSize: '0.875rem' }}>
              Tiempo estimado: 24-48 horas.
            </p>
            <Link 
              to="/driver/profile" 
              className="btn btn-outline" 
              style={{ marginTop: '1.5rem' }}
            >
              <span className="material-symbols-rounded">edit</span>
              Ver mi perfil
            </Link>
          </div>
        )}

        {/* Estado: in_review */}
        {verificationStatus === 'in_review' && (
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', borderLeft: '4px solid #3B82F6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#3B82F6' }}>search</span>
              <div>
                <h2 style={{ color: '#3B82F6', marginBottom: '0' }}>En Revisión</h2>
                <p style={{ color: '#64748B', marginTop: '0.25rem' }}>Estado: Siendo revisado</p>
              </div>
            </div>
            <p style={{ color: '#334155', marginBottom: '1rem' }}>
              Un administrador está revisando tus documentos.
            </p>
            <p style={{ color: '#64748B', fontSize: '0.875rem' }}>
              Te notificaremos cuando termine la revisión.
            </p>
            <Link 
              to="/driver/profile" 
              className="btn btn-outline" 
              style={{ marginTop: '1.5rem' }}
            >
              <span className="material-symbols-rounded">edit</span>
              Ver mi perfil
            </Link>
          </div>
        )}

        {/* Estado: rejected */}
        {verificationStatus === 'rejected' && (
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', borderLeft: '4px solid #EF4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#EF4444' }}>cancel</span>
              <div>
                <h2 style={{ color: '#EF4444', marginBottom: '0' }}>Verificación Rechazada</h2>
                <p style={{ color: '#64748B', marginTop: '0.25rem' }}>Estado: Rechazado</p>
              </div>
            </div>
            
            {driver?.rejectionReason && (
              <div style={{ background: '#FEF2F2', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <p style={{ fontWeight: 600, color: '#EF4444', marginBottom: '0.5rem' }}>Motivo:</p>
                <p style={{ color: '#334155' }}>{driver.rejectionReason}</p>
              </div>
            )}
            
            <p style={{ color: '#334155', marginBottom: '1.5rem' }}>
              Por favor, corrige los documentos y vuelve a enviar para revisión.
            </p>
            
            <Link 
              to="/driver/profile" 
              className="btn btn-primary"
              style={{ padding: '1rem 1.5rem' }}
            >
              <span className="material-symbols-rounded">edit</span>
              Corregir y Reenviar
            </Link>
          </div>
        )}

        {/* Estado: suspended */}
        {verificationStatus === 'suspended' && (
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', borderLeft: '4px solid #EF4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#EF4444' }}>block</span>
              <div>
                <h2 style={{ color: '#EF4444', marginBottom: '0' }}>Cuenta Suspendida</h2>
                <p style={{ color: '#64748B', marginTop: '0.25rem' }}>Estado: Suspendido</p>
              </div>
            </div>
            <p style={{ color: '#334155', marginBottom: '1rem' }}>
              Tu cuenta ha sido suspendida. Contacta al administrador para más información.
            </p>
          </div>
        )}

        {/* Tabs deshabilitadas */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '2rem', opacity: 0.5 }}>
          <button className="btn btn-outline" disabled>
            <span className="material-symbols-rounded">search</span>
            Pedidos Disponibles
          </button>
          <button className="btn btn-outline" disabled>
            <span className="material-symbols-rounded">work_history</span>
            Mis Acarreos
          </button>
        </div>
      </div>
    )
  }

  // Ya está verificado - mostrar dashboard normal
  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="material-symbols-rounded">directions_car</span>
        Panel del Conductor
      </h1>

      {/* Info del driver */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontWeight: 600 }}>
              {driver?.vehicleType} • {driver?.plate}
            </p>
            <p style={{ color: '#64748B', fontSize: '0.875rem' }}>
              {driver?.phone}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span className="material-symbols-rounded" style={{ color: '#F59E0B' }}>star</span>
              <span style={{ fontWeight: 600 }}>{driver?.rating?.toFixed(1) || '0.0'}</span>
            </div>
            <Link to="/driver/profile" className="btn btn-outline">
              <span className="material-symbols-rounded">edit</span>
              Editar Perfil
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={`btn ${tab === 'available' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('available')}
        >
          <span className="material-symbols-rounded">search</span>
          Pedidos Disponibles ({availableRides.length})
        </button>
        <button
          className={`btn ${tab === 'mine' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('mine')}
        >
          <span className="material-symbols-rounded">work_history</span>
          Mis Acarreos ({myRides.length})
        </button>
      </div>

      {/* Rides list */}
      {tab === 'available' ? (
        availableRides.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#64748B', marginBottom: '1rem', display: 'block' }}>
              search_off
            </span>
            <p style={{ color: 'var(--text-muted)' }}>
              No hay pedidos disponibles
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {availableRides.map((ride) => (
              <div key={ride._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="material-symbols-rounded">local_shipping</span>
                      {ride.title}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>location_on</span>
                      {ride.pickupLocation.address}
                      <span style={{ margin: '0 0.5rem' }}>→</span>
                      <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>flag</span>
                      {ride.dropoffLocation.address}
                    </p>
                    <p style={{ fontSize: '0.9rem' }}>{ride.description}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                      ${ride.estimatedPrice}
                    </p>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '0.5rem' }}
                      onClick={() => handleAcceptRide(ride._id, ride.estimatedPrice)}
                    >
                      <span className="material-symbols-rounded">check</span>
                      Aceptar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : myRides.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#64748B', marginBottom: '1rem', display: 'block' }}>
            work_off
          </span>
          <p style={{ color: 'var(--text-muted)' }}>
            No tienes acarreos aceptados
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {myRides.map((ride) => (
            <Link
              key={ride._id}
              to={`/ride/${ride._id}`}
              className="card"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-rounded">local_shipping</span>
                    {ride.title}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>location_on</span>
                    {ride.pickupLocation.address}
                    <span style={{ margin: '0 0.5rem' }}>→</span>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>flag</span>
                    {ride.dropoffLocation.address}
                  </p>
                </div>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  background: 'var(--primary)',
                  color: 'white',
                }}>
                  {ride.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default DriverDashboard