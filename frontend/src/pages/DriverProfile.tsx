import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import FileUpload from '../components/FileUpload'

interface Driver {
  _id: string
  verificationStatus: string
  rejectionReason?: string
  phone?: string
  vehicleType?: string
  plate?: string
  capacityKg?: number
  
  // Docs obligatorios
  vehicleImages?: string[]
  licenseType?: string
  licenseImage?: string
  cedulaFront?: string
  cedulaBack?: string
  ruvDocument?: string
  plateImage?: string
  insurancePolicy?: string
  
  // Docs opcionales
  carneBlanco?: string
  carneVerde?: string
  carneTransporteCarga?: string
  fumigationCertificate?: string
}

const VEHICLE_TYPES = [
  { value: 'camioneta', label: 'Camioneta', icon: 'local_shipping' },
  { value: 'camion', label: 'Camión', icon: 'local_shipping' },
  { value: 'furgon', label: 'Furgón', icon: 'warehouse' },
  { value: 'grua', label: 'Grúa', icon: 'construction' },
  { value: 'otro', label: 'Otro', icon: 'commute' },
]

const LICENSE_TYPES = [
  { value: 'a', label: 'Tipo A' },
  { value: 'b', label: 'Tipo B' },
  { value: 'c', label: 'Tipo C' },
  { value: 'd', label: 'Tipo D' },
  { value: 'e', label: 'Tipo E' },
]

export default function DriverProfile() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeSection, setActiveSection] = useState(1)
  
  const [formData, setFormData] = useState({
    vehicleType: '',
    plate: '',
    capacityKg: '',
    vehicleImages: [] as string[],
    licenseType: '',
    licenseImage: '',
    cedulaFront: '',
    cedulaBack: '',
    ruvDocument: '',
    plateImage: '',
    insurancePolicy: '',
    phone: '',
    carneBlanco: '',
    carneVerde: '',
    carneTransporteCarga: '',
    fumigationCertificate: '',
  })
  
  const sections = [
    { num: 1, title: 'Vehículo', icon: 'directions_car' },
    { num: 2, title: 'Documentos Personales', icon: 'badge' },
    { num: 3, title: 'Documentos del Vehículo', icon: 'description' },
    { num: 4, title: 'Contacto', icon: 'phone' },
    { num: 5, title: 'Adicionales', icon: 'add_circle' },
  ]
  
  useEffect(() => {
    loadDriver()
  }, [user])
  
  async function loadDriver() {
    try {
      const token = await getToken()
      const headers: HeadersInit = {}
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('/api/users/driver/me', { headers })
      if (response.ok) {
        const data = await response.json()
        setDriver(data)
        
        setFormData({
          vehicleType: data.vehicleType || '',
          plate: data.plate || '',
          capacityKg: data.capacityKg?.toString() || '',
          vehicleImages: data.vehicleImages || [],
          licenseType: data.licenseType || '',
          licenseImage: data.licenseImage || '',
          cedulaFront: data.cedulaFront || '',
          cedulaBack: data.cedulaBack || '',
          ruvDocument: data.ruvDocument || '',
          plateImage: data.plateImage || '',
          insurancePolicy: data.insurancePolicy || '',
          phone: data.phone || '',
          carneBlanco: data.carneBlanco || '',
          carneVerde: data.carneVerde || '',
          carneTransporteCarga: data.carneTransporteCarga || '',
          fumigationCertificate: data.fumigationCertificate || '',
        })
      }
    } catch (error) {
      console.error('Error loading driver:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }
  
  const updateVehicleImage = (url: string) => {
    const newImages = [...formData.vehicleImages, url]
    setFormData(prev => ({ ...prev, vehicleImages: newImages }))
  }
  
  const removeVehicleImage = (index: number) => {
    const newImages = formData.vehicleImages.filter((_, i) => i !== index)
    setFormData(prev => ({ ...prev, vehicleImages: newImages }))
  }
  
  const handleSubmit = async (isResubmit: boolean = false) => {
    if (!user) return
    
    setSaving(true)
    setError('')
    setSuccess('')
    
    try {
      const token = await getToken()
      const endpoint = isResubmit ? '/api/users/driver/resubmit' : '/api/users/driver/profile'
      const method = 'PATCH'
      
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify({
          vehicleType: formData.vehicleType,
          plate: formData.plate,
          capacityKg: parseInt(formData.capacityKg),
          vehicleImages: formData.vehicleImages,
          licenseType: formData.licenseType,
          licenseImage: formData.licenseImage,
          cedulaFront: formData.cedulaFront,
          cedulaBack: formData.cedulaBack,
          ruvDocument: formData.ruvDocument,
          plateImage: formData.plateImage,
          insurancePolicy: formData.insurancePolicy,
          phone: formData.phone,
          carneBlanco: formData.carneBlanco || undefined,
          carneVerde: formData.carneVerde || undefined,
          carneTransporteCarga: formData.carneTransporteCarga || undefined,
          fumigationCertificate: formData.fumigationCertificate || undefined,
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSuccess(isResubmit ? 'Perfil reenviado para verificación' : 'Perfil actualizado')
        loadDriver()
        
        if (isResubmit) {
          setTimeout(() => navigate('/driver'), 2000)
        }
      } else {
        setError(data.error || 'Error al actualizar perfil')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }
  
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
  
  if (!driver) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <h1>Perfil no encontrado</h1>
        <p style={{ color: '#64748B', marginBottom: '1.5rem' }}>
          Primero regístrate como conductor.
        </p>
        <Link to="/register-driver" className="btn btn-primary">
          Registrarse como Conductor
        </Link>
      </div>
    )
  }
  
  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Botón volver */}
      <Link 
        to="/driver" 
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
        Volver al panel
      </Link>

      <h1 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="material-symbols-rounded">person</span>
        Mi Perfil
      </h1>

      {/* Estado de verificación */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        marginBottom: '1.5rem',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        background: driver.verificationStatus === 'verified' ? '#DCFCE7' : driver.verificationStatus === 'rejected' ? '#FEE2E2' : '#FEF3C7',
      }}>
        <span className="material-symbols-rounded" style={{ 
          color: driver.verificationStatus === 'verified' ? '#16A34A' : driver.verificationStatus === 'rejected' ? '#DC2626' : '#D97706'
        }}>
          {driver.verificationStatus === 'verified' ? 'check_circle' : driver.verificationStatus === 'rejected' ? 'cancel' : 'hourglass_empty'}
        </span>
        <span style={{ 
          fontWeight: 600,
          color: driver.verificationStatus === 'verified' ? '#16A34A' : driver.verificationStatus === 'rejected' ? '#DC2626' : '#D97706'
        }}>
          {driver.verificationStatus === 'verified' ? 'Verificado' : 
           driver.verificationStatus === 'rejected' ? 'Rechazado' : 
           driver.verificationStatus === 'in_review' ? 'En revisión' : 'Pendiente'}
        </span>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          background: '#FEF2F2',
          border: '1px solid #EF4444',
          borderRadius: '12px',
          marginBottom: '1rem',
          color: '#EF4444',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span className="material-symbols-rounded">error</span>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '1rem',
          background: '#DCFCE7',
          border: '1px solid #16A34A',
          borderRadius: '12px',
          marginBottom: '1rem',
          color: '#16A34A',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span className="material-symbols-rounded">check_circle</span>
          {success}
        </div>
      )}

      {/* Section tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        overflowX: 'auto',
        paddingBottom: '0.5rem'
      }}>
        {sections.map(section => (
          <button
            key={section.num}
            onClick={() => setActiveSection(section.num)}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeSection === section.num ? '#0D9488' : '#F1F5F9',
              color: activeSection === section.num ? 'white' : '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
              fontSize: '0.875rem',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              {section.icon}
            </span>
            {section.title}
          </button>
        ))}
      </div>

      {/* Sección 1: Vehículo */}
      {activeSection === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Datos del Vehículo</h2>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600 }}>
              Tipo de Vehículo
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '0.75rem',
            }}>
              {VEHICLE_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateField('vehicleType', type.value)}
                  style={{
                    padding: '1rem',
                    border: `2px solid ${formData.vehicleType === type.value ? '#0D9488' : '#E2E8F0'}`,
                    borderRadius: '12px',
                    background: formData.vehicleType === type.value ? 'rgba(13, 148, 136, 0.2)' : '#1E293B',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span className="material-symbols-rounded" style={{
                    fontSize: '28px',
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

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Placa</label>
            <input
              type="text"
              className="input"
              placeholder="ABC-1234"
              value={formData.plate}
              onChange={(e) => updateField('plate', e.target.value.toUpperCase())}
              maxLength={8}
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Capacidad (kg)</label>
            <input
              type="number"
              className="input"
              placeholder="1000"
              value={formData.capacityKg}
              onChange={(e) => updateField('capacityKg', e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Fotos del Vehículo</label>
            {formData.vehicleImages.length > 0 && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                {formData.vehicleImages.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <img 
                      src={img} 
                      alt={`Vehículo ${idx + 1}`}
                      style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeVehicleImage(idx)}
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        background: '#EF4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {formData.vehicleImages.length < 5 && (
              <FileUpload
                label="Agregar foto"
                onChange={updateVehicleImage}
                folder="drivers/vehicles"
              />
            )}
          </div>
        </div>
      )}

      {/* Sección 2: Documentos Personales */}
      {activeSection === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Documentos Personales</h2>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Tipo de Licencia</label>
            <select
              className="input"
              value={formData.licenseType}
              onChange={(e) => updateField('licenseType', e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Selecciona el tipo</option>
              {LICENSE_TYPES.map(lt => (
                <option key={lt.value} value={lt.value}>{lt.label}</option>
              ))}
            </select>
          </div>

          <FileUpload
            label="Foto de Licencia"
            value={formData.licenseImage}
            onChange={(url) => updateField('licenseImage', url)}
            folder="drivers/licenses"
          />

          <FileUpload
            label="Cédula - Frente"
            value={formData.cedulaFront}
            onChange={(url) => updateField('cedulaFront', url)}
            folder="drivers/cedulas"
          />

          <FileUpload
            label="Cédula - Reverso"
            value={formData.cedulaBack}
            onChange={(url) => updateField('cedulaBack', url)}
            folder="drivers/cedulas"
          />
        </div>
      )}

      {/* Sección 3: Documentos del Vehículo */}
      {activeSection === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Documentos del Vehículo</h2>
          
          <FileUpload
            label="RUV del Vehículo"
            value={formData.ruvDocument}
            onChange={(url) => updateField('ruvDocument', url)}
            folder="drivers/documents"
          />

          <FileUpload
            label="Foto de Placa Vigente"
            value={formData.plateImage}
            onChange={(url) => updateField('plateImage', url)}
            folder="drivers/plates"
          />

          <FileUpload
            label="Póliza de Seguro"
            value={formData.insurancePolicy}
            onChange={(url) => updateField('insurancePolicy', url)}
            folder="drivers/insurance"
          />
        </div>
      )}

      {/* Sección 4: Contacto */}
      {activeSection === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Datos de Contacto</h2>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Teléfono</label>
            <input
              type="tel"
              className="input"
              placeholder="+507 6000-0000"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Sección 5: Adicionales */}
      {activeSection === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Documentos Adicionales</h2>
          
          <FileUpload
            label="Carné Blanco"
            value={formData.carneBlanco}
            onChange={(url) => updateField('carneBlanco', url)}
            folder="drivers/optional"
          />

          <FileUpload
            label="Carné Verde"
            value={formData.carneVerde}
            onChange={(url) => updateField('carneVerde', url)}
            folder="drivers/optional"
          />

          <FileUpload
            label="Carné de Transporte"
            value={formData.carneTransporteCarga}
            onChange={(url) => updateField('carneTransporteCarga', url)}
            folder="drivers/optional"
          />

          <FileUpload
            label="Certificado de Fumigación"
            value={formData.fumigationCertificate}
            onChange={(url) => updateField('fumigationCertificate', url)}
            folder="drivers/optional"
          />
        </div>
      )}

      {/* Botón guardar */}
      <div style={{ marginTop: '2rem' }}>
        {driver.verificationStatus === 'rejected' ? (
          <button 
            className="btn btn-primary"
            onClick={() => handleSubmit(true)}
            disabled={saving}
            style={{ width: '100%', padding: '1rem' }}
          >
            {saving ? 'Enviando...' : 'Corregir y Reenviar para Verificación'}
          </button>
        ) : (
          <button 
            className="btn btn-primary"
            onClick={() => handleSubmit(false)}
            disabled={saving}
            style={{ width: '100%', padding: '1rem' }}
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        )}
      </div>
    </div>
  )
}