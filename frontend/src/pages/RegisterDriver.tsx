import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'

function RegisterDriver() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    vehicleType: '',
    plate: '',
    capacityKg: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
  })

  const vehicleTypes = [
    { value: 'camioneta', label: 'Camioneta', icon: 'local_shipping' },
    { value: 'camion', label: 'Camion', icon: 'local_shipping' },
    { value: 'furgon', label: 'Furgon', icon: 'local_shipping' },
    { value: 'grua', label: 'Grua', icon: 'engineering' },
    { value: 'otro', label: 'Otro', icon: 'question_mark' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/users/register-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleType: formData.vehicleType,
          plate: formData.plate,
          capacityKg: parseInt(formData.capacityKg),
          vehicleBrand: formData.vehicleBrand || undefined,
          vehicleModel: formData.vehicleModel || undefined,
          vehicleYear: formData.vehicleYear || undefined,
          vehicleColor: formData.vehicleColor || undefined,
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        navigate('/driver')
      } else {
        setError(data.error || 'Error al registrar conductor')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Boton volver */}
      <Link 
        to="/" 
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
        Volver al inicio
      </Link>

      <h1 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="material-symbols-rounded">directions_car</span>
        Registro como Conductor
      </h1>
      
      <p style={{ color: '#64748B', marginBottom: '2rem' }}>
        Complete los datos de su vehiculo para comenzar a aceptar acarreos.
      </p>

      {error && (
        <div style={{
          padding: '1rem',
          background: '#FEF2F2',
          border: '1px solid #EF4444',
          borderRadius: '12px',
          marginBottom: '1rem',
          color: '#EF4444',
        }}>
          <span className="material-symbols-rounded">error</span>
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Tipo de vehiculo */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600 }}>
            Tipo de Vehiculo *
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '0.75rem',
          }}>
            {vehicleTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData({ ...formData, vehicleType: type.value })}
                style={{
                  padding: '1rem',
                  border: `2px solid ${formData.vehicleType === type.value ? '#0D9488' : '#E2E8F0'}`,
                  borderRadius: '12px',
                  background: formData.vehicleType === type.value ? 'rgba(13, 148, 136, 0.1)' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <span className="material-symbols-rounded" style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: formData.vehicleType === type.value ? '#0D9488' : '#64748B',
                }}>
                  {type.icon}
                </span>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: formData.vehicleType === type.value ? '#0D9488' : '#334155',
                }}>
                  {type.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Placa */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Placa *
          </label>
          <input
            type="text"
            className="input"
            placeholder="ABC-1234"
            value={formData.plate}
            onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
            maxLength={8}
            style={{ textTransform: 'uppercase' }}
            required
          />
          <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
            Formato: 3 letras + guion + 3 o 4 numeros
          </p>
        </div>

        {/* Capacidad */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Capacidad de Carga (kg) *
          </label>
          <input
            type="number"
            className="input"
            placeholder="Ej: 1000"
            value={formData.capacityKg}
            onChange={(e) => setFormData({ ...formData, capacityKg: e.target.value })}
            min="1"
            max="50000"
            required
          />
        </div>

        {/* Campos opcionales */}
        <details style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', color: '#64748B', fontWeight: 500 }}>
            <span className="material-symbols-rounded" style={{ fontSize: '1rem', marginRight: '0.5rem' }}>expand_more</span>
            Informacion adicional (opcional)
          </summary>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Marca
              </label>
              <input
                type="text"
                className="input"
                placeholder="Ej: Toyota"
                value={formData.vehicleBrand}
                onChange={(e) => setFormData({ ...formData, vehicleBrand: e.target.value })}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Modelo
              </label>
              <input
                type="text"
                className="input"
                placeholder="Ej: Hilux"
                value={formData.vehicleModel}
                onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Ano
              </label>
              <input
                type="text"
                className="input"
                placeholder="Ej: 2022"
                value={formData.vehicleYear}
                onChange={(e) => setFormData({ ...formData, vehicleYear: e.target.value })}
                maxLength={4}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Color
              </label>
              <input
                type="text"
                className="input"
                placeholder="Ej: Blanco"
                value={formData.vehicleColor}
                onChange={(e) => setFormData({ ...formData, vehicleColor: e.target.value })}
              />
            </div>
          </div>
        </details>

        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={loading || !formData.vehicleType || !formData.plate || !formData.capacityKg}
          style={{ 
            padding: '1rem',
            fontSize: '1rem',
          }}
        >
          {loading ? (
            'Registrando...'
          ) : (
            <>
              <span className="material-symbols-rounded">check</span>
              Registrar como Conductor
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default RegisterDriver