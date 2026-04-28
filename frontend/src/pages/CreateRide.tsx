import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import AddressInput from '../components/AddressInput'

interface RideFormData {
  title: string
  description: string
  type: string
  images: File[]
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
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
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
    
    setLoading(true)
    
    try {
      // TODO: Upload images first
      
      const response = await fetch('/api/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: user.id,
          title: formData.title,
          description: formData.description,
          type: formData.type,
          pickupLocation: { 
            address: formData.pickupAddress, 
            coordinates: { type: 'Point', coordinates: formData.pickupCoordinates }
          },
          dropoffLocation: { 
            address: formData.dropoffAddress, 
            coordinates: { type: 'Point', coordinates: formData.dropoffCoordinates }
          },
          estimatedPrice: formData.estimatedPrice,
          images: [],
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

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={loading || !formData.pickupCoordinates || !formData.dropoffCoordinates}
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