import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import AddressInput from '../components/AddressInput'
import MultiFileUpload from '../components/MultiFileUpload'
import { ridesAPI, usersAPI } from '../services/api'

interface UploadedImage {
  url: string
  publicId?: string
}

interface RideFormData {
  title: string
  description: string
  type: '' | 'mudanza' | 'electrodomesticos' | 'muebles' | 'productos' | 'otros'
  images: UploadedImage[]
  pickupAddress: string
  dropoffAddress: string
  pickupCoordinates: [number, number] | null
  dropoffCoordinates: [number, number] | null
  estimatedPrice: number
  packages?: number
  notes?: string
}

function CreateRide() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)
  const [hasSavedPaymentMethod, setHasSavedPaymentMethod] = useState<boolean | null>(null)
  const [checkingPaymentMethod, setCheckingPaymentMethod] = useState(true)

  const [formData, setFormData] = useState<RideFormData>({
    title: '',
    description: '',
    type: '',
    images: [],
    pickupAddress: '',
    dropoffAddress: '',
    pickupCoordinates: null,
    dropoffCoordinates: null,
    estimatedPrice: 0,
  })

  function updateFormField<K extends keyof RideFormData>(field: K, value: RideFormData[K]) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  // Check for saved payment method on mount
  useEffect(() => {
    async function checkPaymentMethod() {
      try {
        const token = await getToken()
        if (!token) {
          setHasSavedPaymentMethod(false)
          return
        }

        const result = await usersAPI.getPaymentMethod(token || undefined)
        setHasSavedPaymentMethod(result.hasPaymentMethod)
        if (result.stripePaymentMethodId) {
          setPaymentMethodId(result.stripePaymentMethodId)
        }
      } catch (err) {
        console.error('Error checking payment method:', err)
        setHasSavedPaymentMethod(false)
      } finally {
        setCheckingPaymentMethod(false)
      }
    }
    checkPaymentMethod()
  }, [getToken])

  // Check if returned from add-payment-method page with success
  useEffect(() => {
    const paymentAdded = searchParams.get('payment_added')
    if (paymentAdded === 'true') {
      setHasSavedPaymentMethod(true)
      // Re-check to get the paymentMethodId
      getToken().then((token) =>
        usersAPI.getPaymentMethod(token || undefined).then(result => {
          if (result.stripePaymentMethodId) {
            setPaymentMethodId(result.stripePaymentMethodId)
          }
        })
      ).catch((err) => {
        console.error('Error re-checking payment method:', err)
      })
    }
  }, [searchParams, getToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    // Validar que tenga coordenadas
    if (!formData.pickupCoordinates || !formData.dropoffCoordinates) {
      alert('Por favor selecciona una dirección de la lista de sugerencias')
      return
    }

    // Validar que tenga al menos una imagen
    if (formData.images.length === 0) {
      alert('Sube al menos una imagen del pedido')
      return
    }

    if (!formData.type) {
      alert('Selecciona un tipo de pedido')
      return
    }

    const rideType = formData.type

    // Check payment method
    if (!paymentMethodId && !hasSavedPaymentMethod) {
      navigate('/add-payment-method?redirect=create-ride')
      return
    }
    
    setLoading(true)
    
    try {
      const token = await getToken()
      if (!token) {
        throw new Error('Sesion no valida. Inicia sesion nuevamente.')
      }

      await ridesAPI.create({
        clientId: user.id,
        title: formData.title,
        description: formData.description,
        type: rideType,
        pickupLocation: {
          address: formData.pickupAddress,
          type: 'Point',
          coordinates: formData.pickupCoordinates
        },
        dropoffLocation: {
          address: formData.dropoffAddress,
          type: 'Point',
          coordinates: formData.dropoffCoordinates
        },
        estimatedPrice: formData.estimatedPrice,
        images: formData.images,
        packages: formData.packages,
        notes: formData.notes,
        stripePaymentMethodId: paymentMethodId || undefined,
      }, token)

      navigate('/my-rides')
    } catch (error) {
      console.error('Error creating ride:', error)
      const message = error instanceof Error ? error.message : 'Error al crear el pedido'
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Boton volver */}
      <Link 
        to="/my-rides" 
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          marginBottom: '1.5rem',
          color: '#64748B',
          textDecoration: 'none',
        }}
      >
        <span className="material-symbols-rounded">arrow_back</span>
        Volver a Mis Pedidos
      </Link>

      <h1 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="material-symbols-rounded">add_circle</span>
        Crear Nuevo Pedido
      </h1>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Payment Method Status */}
        {checkingPaymentMethod ? (
          <div style={{ padding: '1rem', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#F8FAFC', textAlign: 'center' }}>
            <span style={{ color: '#64748B' }}>Verificando método de pago...</span>
          </div>
        ) : hasSavedPaymentMethod ? (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#DCFCE7', borderRadius: '6px', fontSize: '0.875rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>check_circle</span>
            Método de pago guardado ✓
          </div>
        ) : (
          <div style={{ padding: '1rem', border: '1px solid #FCA5A5', borderRadius: '8px', backgroundColor: '#FEF2F2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991B1B' }}>
                <span className="material-symbols-rounded">warning</span>
                <strong>Método de pago requerido</strong>
              </div>
              <Link to="/add-payment-method?redirect=create-ride" className="btn btn-secondary" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                + Agregar
              </Link>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#7F1D1D' }}>
              Debes agregar un método de pago antes de crear un pedido.
            </p>
          </div>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Titulo *
          </label>
          <input
            type="text"
            className="input"
            placeholder="Ej: Mudanza completa de apartamento"
            value={formData.title}
            onChange={(e) => updateFormField('title', e.target.value)}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Tipo *
          </label>
          <select
            className="input"
            value={formData.type}
            onChange={(e) => updateFormField('type', e.target.value as RideFormData['type'])}
            required
          >
            <option value="">Seleccionar tipo</option>
            <option value="mudanza">Mudanza</option>
            <option value="electrodomesticos">Electrodomesticos</option>
            <option value="muebles">Muebles</option>
            <option value="productos">Productos</option>
            <option value="otros">Otros</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Descripcion *
          </label>
          <textarea
            className="input"
            rows={4}
            placeholder="Describe que necesitas transportar..."
            value={formData.description}
            onChange={(e) => updateFormField('description', e.target.value)}
            required
          />
        </div>

        <MultiFileUpload
          label="Imágenes del Pedido"
          required
          maxFiles={8}
          value={formData.images}
          onChange={(images) => updateFormField('images', images)}
          folder="rides"
        />

        <AddressInput
          label="Direccion de Recogida"
          placeholder="Escribe una direccion en Panama..."
          value={formData.pickupAddress}
          coordinates={formData.pickupCoordinates}
          onAddressChange={(address) => updateFormField('pickupAddress', address)}
          onCoordinatesChange={(coords) => updateFormField('pickupCoordinates', coords)}
          required
        />

        <AddressInput
          label="Direccion de Entrega"
          placeholder="Escribe una direccion en Panama..."
          value={formData.dropoffAddress}
          coordinates={formData.dropoffCoordinates}
          onAddressChange={(address) => updateFormField('dropoffAddress', address)}
          onCoordinatesChange={(coords) => updateFormField('dropoffCoordinates', coords)}
          required
        />

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Precio Sugerido (USD) *
          </label>
          <input
            type="number"
            className="input"
            placeholder="0.00"
            value={formData.estimatedPrice}
            onChange={(e) => updateFormField('estimatedPrice', Number(e.target.value))}
            required
          />
        </div>

        {/* Campos opcionales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Número de Bultos
            </label>
            <input
              type="number"
              className="input"
              placeholder="Ej: 5"
              value={formData.packages || ''}
              onChange={(e) =>
                updateFormField('packages', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Notas Especiales
          </label>
          <textarea
            className="input"
            rows={3}
            placeholder="Ej: Requiere ayuda para cargar, contiene artículos frágiles..."
            value={formData.notes || ''}
            onChange={(e) => updateFormField('notes', e.target.value)}
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={loading || !formData.pickupCoordinates || !formData.dropoffCoordinates || formData.images.length === 0 || !hasSavedPaymentMethod}
        >
          {loading ? 'Creando...' : 'Crear Pedido'}
        </button>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Direcciones proporcionadas por <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>OpenStreetMap</a>
        </p>
      </form>
    </div>
  )
}

export default CreateRide
