import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'

interface RideFormData {
  title: string
  description: string
  type: string
  images: File[]
  pickupAddress: string
  dropoffAddress: string
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
    estimatedPrice: 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
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
          pickupLocation: { address: formData.pickupAddress, coordinates: [0, 0] },
          dropoffLocation: { address: formData.dropoffAddress, coordinates: [0, 0] },
          estimatedPrice: formData.estimatedPrice,
          images: [],
        }),
      })
      
      if (response.ok) {
        navigate('/my-rides')
      }
    } catch (error) {
      console.error('Error creating ride:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Crear Nuevo Pedido</h1>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Título *
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
            <option value="electrodomésticos">Electrodomésticos</option>
            <option value="muebles">Muebles</option>
            <option value="productos">Productos</option>
            <option value="otros">Otros</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Descripción *
          </label>
          <textarea
            className="input"
            rows={4}
            placeholder="Describe qué necesitas transportar..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Dirección de Recogida *
          </label>
          <input
            type="text"
            className="input"
            placeholder="Dirección donde recogida"
            value={formData.pickupAddress}
            onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Dirección de Entrega *
          </label>
          <input
            type="text"
            className="input"
            placeholder="Dirección de entrega"
            value={formData.dropoffAddress}
            onChange={(e) => setFormData({ ...formData, dropoffAddress: e.target.value })}
            required
          />
        </div>

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

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creando...' : 'Crear Pedido'}
        </button>
      </form>
    </div>
  )
}

export default CreateRide