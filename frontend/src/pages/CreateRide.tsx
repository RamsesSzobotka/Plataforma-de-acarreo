import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import AddressInput from '../components/AddressInput'
import MultiFileUpload from '../components/MultiFileUpload'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

const stripeElementsOptions = {
  appearance: {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#0D9488',
      colorBackground: '#FFFFFF',
      colorText: '#0F172A',
      colorDanger: '#EF4444',
      fontFamily: 'Inter, sans-serif',
      borderRadius: '8px',
    },
  },
}

// Componente interno para el formulario de pago
function PaymentMethodForm({ onSuccess, onCancel }: { onSuccess: (pmId: string) => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    try {
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) throw new Error('Card element not found')

      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      })

      if (stripeError) throw new Error(stripeError.message)
      if (!paymentMethod) throw new Error('No payment method created')

      onSuccess(paymentMethod.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '1rem', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#F8FAFC' }}>
      <h4 style={{ margin: '0 0 1rem 0' }}>💳 Método de Pago</h4>
      <div style={{ padding: '1rem', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#FFF', marginBottom: '1rem' }}>
        <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
      </div>
      {error && <div style={{ color: '#EF4444', marginBottom: '0.5rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" className="btn btn-primary" disabled={loading || !stripe} onClick={handleSubmit}>
          {loading ? 'Guardando...' : '💳 Guardar'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

interface UploadedImage {
  url: string
  publicId?: string
}

interface RideFormData {
  title: string
  description: string
  type: string
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
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [addPaymentMethodNow, setAddPaymentMethodNow] = useState(false)
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)
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
    
    setLoading(true)
    
    try {
      const token = await getToken()
      const response = await fetch('/api/rides', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          clientId: user.id,
          title: formData.title,
          description: formData.description,
          type: formData.type,
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
          stripePaymentMethodId: paymentMethodId,
        }),
      })
      
      if (response.ok) {
        navigate('/my-rides')
      } else {
        const error = await response.json()
        alert(error.message || 'Error al crear el pedido')
      }
    } catch (error) {
      console.error('Error creating ride:', error)
      alert('Error al crear el pedido')
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
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Titulo *
          </label>
          <input
            type="text"
            className="input"
            placeholder="Ej: Mudanza completa de apartamento"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </div>

        <MultiFileUpload
          label="Imágenes del Pedido"
          required
          maxFiles={8}
          value={formData.images}
          onChange={(images) => setFormData({ ...formData, images })}
          folder="rides"
        />

        <AddressInput
          label="Direccion de Recogida"
          placeholder="Escribe una direccion en Panama..."
          value={formData.pickupAddress}
          coordinates={formData.pickupCoordinates}
          onAddressChange={(address) => setFormData({ ...formData, pickupAddress: address })}
          onCoordinatesChange={(coords) => setFormData({ ...formData, pickupCoordinates: coords })}
          required
        />

        <AddressInput
          label="Direccion de Entrega"
          placeholder="Escribe una direccion en Panama..."
          value={formData.dropoffAddress}
          coordinates={formData.dropoffCoordinates}
          onAddressChange={(address) => setFormData({ ...formData, dropoffAddress: address })}
          onCoordinatesChange={(coords) => setFormData({ ...formData, dropoffCoordinates: coords })}
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
            onChange={(e) => setFormData({ ...formData, estimatedPrice: Number(e.target.value) })}
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
              onChange={(e) => setFormData({ ...formData, packages: e.target.value ? Number(e.target.value) : undefined })}
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
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>

        {/* Payment Method Section */}
        <div style={{ padding: '1rem', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#F8FAFC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-rounded">credit_card</span>
              <strong>Método de Pago</strong>
            </div>
            {paymentMethodId ? (
              <span style={{ color: '#22C55E', fontSize: '0.875rem' }}>✓Guardado</span>
            ) : addPaymentMethodNow ? (
              <button type="button" className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => { setAddPaymentMethodNow(false); setPaymentMethodId(null) }}>
                Cancelar
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.875rem' }} onClick={() => setAddPaymentMethodNow(true)}>
                + Agregar Ahora
              </button>
            )}
          </div>
          
          {addPaymentMethodNow && !paymentMethodId && (
            <PaymentMethodForm 
              onSuccess={(pmId) => { setPaymentMethodId(pmId); setAddPaymentMethodNow(false) }} 
              onCancel={() => setAddPaymentMethodNow(false)} 
            />
          )}
          
          {paymentMethodId && (
            <div style={{ padding: '0.75rem', backgroundColor: '#DCFCE7', borderRadius: '6px', fontSize: '0.875rem', color: '#166534' }}>
              ✓ Tu méthode de pago ha sido guardado para este pedido
            </div>
          )}
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={loading || !formData.pickupCoordinates || !formData.dropoffCoordinates || formData.images.length === 0}
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