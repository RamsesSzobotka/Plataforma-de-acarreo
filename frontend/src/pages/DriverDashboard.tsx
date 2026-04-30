import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import ChatButton from '../components/ChatButton'
import { ridesAPI, usersAPI, paymentsAPI } from '../services/api'

interface Driver {
  _id: string
  verificationStatus: string
  rejectionReason?: string
  phone?: string
  vehicleType?: string
  plate?: string
  rating?: number
  isAvailable?: boolean
  stripeAccountId?: string
  payoutsEnabled?: boolean
}

interface Ride {
  _id: string
  title: string
  type: string
  status: string
  estimatedPrice: number
  finalPrice?: number
  pickupLocation: { address: string; coordinates?: { type: string; coordinates: number[] } }
  dropoffLocation: { address: string; coordinates?: { type: string; coordinates: number[] } }
  description: string
  images?: { url: string; publicId?: string }[]
  packages?: number
  weight?: number
  distance?: number
  driverId?: string
  clientId?: string
  deliveryPhoto?: { url: string }
}

function DriverDashboard() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [availableRides, setAvailableRides] = useState<Ride[]>([])
  const [myRides, setMyRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'available' | 'mine'>('available')

  // NEW: Filters and pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('requested')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [driverLocation, setDriverLocation] = useState<{lat: number; lng: number} | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const refresh = params.get('refresh')
    
    if (connected === '1' || refresh === '1') {
      refreshStripeStatus()
      window.history.replaceState({}, '', window.location.pathname)
    } else {
      loadDriver()
    }
  }, [user])

  async function refreshStripeStatus() {
    try {
      const token = await getToken()
      await paymentsAPI.getConnectStatus(token || undefined)
      loadDriver()
    } catch (error) {
      console.error('Error refreshing Stripe status:', error)
      loadDriver()
    }
  }

  useEffect(() => {
    if (driver?.verificationStatus === 'verified') {
      loadRides()
    }
  }, [tab, driver?.verificationStatus, page, statusFilter, typeFilter])

  // Get driver's current location for proximity filtering
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => console.error('Error getting location:', error),
        { enableHighAccuracy: true }
      )
    }
  }, [])

  async function loadDriver() {
    try {
      const token = await getToken()
      const data = await usersAPI.getDriver('me', token || undefined)
      setDriver(data)
    } catch (error) {
      console.error('Error loading driver:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadRides() {
    try {
      const token = await getToken()
      if (tab === 'available') {
        // Cargar pedidos disponibles usando el endpoint específico
        const params: any = { 
          page,
          limit: 20
        }
        if (typeFilter) params.type = typeFilter
        
        const data = await ridesAPI.listAvailable(params, token || undefined)
        setAvailableRides(data.data || [])
        setTotalPages(data.pagination?.pages || 1)
      } else {
        // Mis acarreos: pedidos donde soy el driver asignado
        const data = await ridesAPI.list({ driverId: user?.id, page, limit: 20 }, token || undefined)
        setMyRides(data.data || [])
        if (data.pagination) {
          setTotalPages(data.pagination.pages)
        }
      }
    } catch (error) {
      console.error('Error loading rides:', error)
    }
  }

  async function handleAcceptRide(rideId: string, price: number) {
    if (!user) return
    
    try {
      const token = await getToken()
      await ridesAPI.accept(rideId, user.id, price, token || undefined)
      loadRides()
    } catch (error) {
      console.error('Error accepting ride:', error)
    }
  }

  async function handleConnectStripe() {
    try {
      const token = await getToken()
      const data = await paymentsAPI.createConnectAccount(token || undefined)
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl
      }
    } catch (error) {
      console.error('Error connecting Stripe:', error)
    }
  }

  function handleStripeHistory() {
    navigate('/driver/payments/history')
  }

  const hasStripeAccount = !!driver?.stripeAccountId
  const canReceivePayments = driver?.payoutsEnabled === true

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
      {/* Back button per rule 16.1 */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
        <span className="material-symbols-rounded">arrow_back</span>
        Volver al inicio
      </Link>
      
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
            {canReceivePayments ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                <span className="material-symbols-rounded">check_circle</span>
                Pagos habilitados en Stripe
              </div>
            ) : hasStripeAccount ? (
              <button 
                className="btn btn-outline"
                onClick={handleStripeHistory}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span className="material-symbols-rounded">history</span>
                Historial
              </button>
            ) : (
              <button 
                className="btn btn-secondary"
                onClick={handleConnectStripe}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span className="material-symbols-rounded">payments</span>
                Activar cuenta para recibir pagos
              </button>
            )}
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

      {/* Filters for available rides */}
      {tab === 'available' && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>Estado:</label>
              <select 
                value={statusFilter} 
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
              >
                <option value="requested">Pendientes</option>
              </select>
            </div>
            
            <div>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>Tipo:</label>
              <select 
                value={typeFilter} 
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
              >
                <option value="">Todos</option>
                <option value="mudanza">Mudanza</option>
                <option value="electrodomésticos">Electrodomésticos</option>
                <option value="muebles">Muebles</option>
                <option value="productos">Productos</option>
                <option value="otros">Otros</option>
              </select>
            </div>
            
            {driverLocation && (
              <div style={{ fontSize: '0.875rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>location_on</span>
                Ubicación detectada
              </div>
            )}
          </div>
        </div>
      )}

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ width: '100%' }}>
                    <Link to={`/ride/${ride._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <span className="material-symbols-rounded">local_shipping</span>
                        {ride.title}
                      </h3>
                    </Link>
                    
                    {/* Images */}
                    {ride.images && ride.images.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1rem' }}>
                        {ride.images.map((img, idx) => (
                          <div key={idx} style={{
                            flexShrink: 0,
                            width: '120px',
                            height: '90px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid var(--border)'
                          }}>
                            <img 
                              key={idx} 
                              src={img.url} 
                              alt={`Imagen ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>location_on</span>
                      {ride.pickupLocation.address}
                      <span style={{ margin: '0 0.5rem' }}>→</span>
                      <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>flag</span>
                      {ride.dropoffLocation.address}
                    </p>
                    
                    <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{ride.description}</p>
                    
                    {/* Packages and Weight */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {ride.packages && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>inventory_2</span>
                          {ride.packages} bultos
                        </span>
                      )}
                      {ride.weight && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>scale</span>
                          {ride.weight} kg
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>category</span>
                        {ride.type}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link to={`/ride/${ride._id}`} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>visibility</span>
                        Ver
                      </Link>
                      <ChatButton rideId={ride._id} variant="outline" />
                    </div>
                    <div>
                      <span style={{ 
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        background: ride.status === 'requested' ? 'var(--warning)' : 'var(--secondary)',
                        color: 'white',
                        fontSize: '0.875rem'
                      }}>
                        {ride.status}
                      </span>
                      <p style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--primary)', marginTop: '0.5rem' }}>
                        ${ride.estimatedPrice}
                      </p>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleAcceptRide(ride._id, ride.estimatedPrice)}
                      >
                        <span className="material-symbols-rounded">check</span>
                        Aceptar
                      </button>
                    </div>
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
            <div key={ride._id} className="card">
              <Link
                to={`/ride/${ride._id}`}
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
              
              {/* Quick actions for driver */}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link to={`/ride/${ride._id}`} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>visibility</span>
                  Ver Detalles
                </Link>
                <Link to={`/chat/${ride._id}`} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>chat</span>
                  Chat
                </Link>
                
                {/* Estado: accepted - iniciar viaje */}
                {ride.status === 'accepted' && (
                  <button
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={async () => {
                      if (!confirm('¿Confirmas que tienes la mercancía cargada?')) return
                      try {
                        const token = await getToken()
                        await ridesAPI.start(ride._id, token || undefined)
                        loadRides()
                      } catch (error) {
                        console.error('Error starting ride:', error)
                      }
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>play_arrow</span>
                    Iniciar Viaje
                  </button>
                )}
                
                {/* Estado: in_progress - subir foto de entrega */}
                {ride.status === 'in_progress' && (
                  <button
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={async () => {
                      const url = prompt('URL de la foto de entrega:')
                      if (!url) return
                      try {
                        const token = await getToken()
                        await ridesAPI.deliveryPhoto(ride._id, url, '', token || undefined)
                        loadRides()
                      } catch (error) {
                        console.error('Error uploading photo:', error)
                      }
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>photo_camera</span>
                    Subir Foto Entrega
                  </button>
                )}
                
                {/* Precio */}
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <p style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                    ${ride.finalPrice || ride.estimatedPrice}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DriverDashboard