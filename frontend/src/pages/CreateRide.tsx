import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { ridesAPI } from '../services/api'

interface RideFormData {
  title: string
  description: string
  type: string
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
  const [error, setError] = useState<string>('')
  const [formData, setFormData] = useState<RideFormData>({
    title: '',
    description: '',
    type: '',
    pickupAddress: '',
    dropoffAddress: '',
    estimatedPrice: 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setLoading(true)
    setError('')
    
    try {
      // Validación básica en frontend
      if (formData.title.length < 10) {
        throw new Error('El título debe tener al menos 10 caracteres')
      }
      if (formData.description.length < 20) {
        throw new Error('La descripción debe tener al menos 20 caracteres')
      }
      if (!formData.type) {
        throw new Error('Selecciona un tipo de acarreo')
      }
      if (formData.estimatedPrice <= 0) {
        throw new Error('El precio debe ser mayor a 0')
      }

      const response = await ridesAPI.create({
        title: formData.title,
        description: formData.description,
        type: formData.type,
        pickupLocation: { address: formData.pickupAddress, coordinates: [0, 0] },
        dropoffLocation: { address: formData.dropoffAddress, coordinates: [0, 0] },
        estimatedPrice: formData.estimatedPrice,
        packages: formData.packages,
        notes: formData.notes,
      })
      
      navigate(`/ride/${response._id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear el pedido'
      setError(message)
      console.error('Error creando ride:', err)
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

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 'var(--radius)',
          color: '#991b1b'
        }}>
          {error}
        </div>
      )}
      
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
          {formData.title && formData.title.length < 10 && (
            <small style={{ color: '#ef4444' }}>Mínimo 10 caracteres ({formData.title.length}/10)</small>
          )}
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
            <option value="electrodomesticos">Electrodomésticos</option>
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
            placeholder="Describe que necesitas transportar..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
          {formData.description && formData.description.length < 20 && (
            <small style={{ color: '#ef4444' }}>Mínimo 20 caracteres ({formData.description.length}/20)</small>
          )}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Dirección de Recogida *
          </label>
          <input
            type="text"
            className="input"
            placeholder="Dirección donde recoger"
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
            step="0.01"
            min="0.01"
            value={formData.estimatedPrice}
            onChange={(e) => setFormData({ ...formData, estimatedPrice: Number(e.target.value) })}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Cantidad de Bultos (opcional)
          </label>
          <input
            type="number"
            className="input"
            placeholder="0"
            min="0"
            value={formData.packages || ''}
            onChange={(e) => setFormData({ ...formData, packages: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Notas Especiales (opcional)
          </label>
          <textarea
            className="input"
            rows={2}
            placeholder="Ej: Requiere ayuda para cargar, objetos frágiles..."
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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