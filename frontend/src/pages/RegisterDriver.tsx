import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import FileUpload from '../components/FileUpload'

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

interface FormData {
  // Sección 1: Vehículo
  vehicleType: string
  plate: string
  capacityKg: string
  vehicleImages: string[]
  
  // Sección 2: Documentos personales
  licenseType: string
  licenseImage: string
  cedulaFront: string
  cedulaBack: string
  
  // Sección 3: Documentos del vehículo
  ruvDocument: string
  plateImage: string
  insurancePolicy: string
  
  // Sección 4: Contacto
  phone: string
  
  // Sección 5: Docs opcionales
  carneBlanco: string
  carneVerde: string
  carneTransporteCarga: string
  fumigationCertificate: string
}

export default function RegisterDriver() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState(1)
  
  const [formData, setFormData] = useState<FormData>({
    vehicleType: '',
    plate: '',
    capacityKg: '',
    vehicleImages: [],
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
  
  // Validar sección actual
  const isSectionValid = (section: number): boolean => {
    switch (section) {
      case 1:
        return !!(formData.vehicleType && formData.plate && formData.capacityKg && formData.vehicleImages.length > 0)
      case 2:
        return !!(formData.licenseType && formData.licenseImage && formData.cedulaFront && formData.cedulaBack)
      case 3:
        return !!(formData.ruvDocument && formData.plateImage && formData.insurancePolicy)
      case 4:
        return !!formData.phone
      case 5:
        return true // Opcional
      default:
        return false
    }
  }
  
  // Progress
  const completedSections = sections.filter(s => isSectionValid(s.num)).length
  const progress = Math.round((completedSections / sections.length) * 100)
  
  const updateField = (field: keyof FormData, value: any) => {
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
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    // Validar todas las secciones obligatorias
    for (let i = 1; i <= 4; i++) {
      if (!isSectionValid(i)) {
        setError(`Completa la sección ${i} antes de continuar`)
        return
      }
    }
    
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
        navigate('/driver')
      } else {
        setError(data.error || data.missing ? `Faltan: ${data.missing?.join(', ')}` : 'Error al registrar conductor')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Botón volver */}
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
      
      <p style={{ color: '#64748B', marginBottom: '1.5rem' }}>
        Completa todos los documentos requeridos para comenzar a aceptar acarreos.
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Progreso</span>
          <span style={{ color: '#64748B', fontSize: '0.875rem' }}>{progress}%</span>
        </div>
        <div style={{ background: '#E2E8F0', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
          <div style={{ 
            background: '#0D9488', 
            width: `${progress}%`, 
            height: '100%', 
            borderRadius: '999px',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

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
              {isSectionValid(section.num) ? 'check_circle' : section.icon}
            </span>
            {section.title}
          </button>
        ))}
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
      
      <form onSubmit={handleSubmit}>
        {/* Sección 1: Vehículo */}
        {activeSection === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Datos del Vehículo</h2>
            
            {/* Tipo de vehículo */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600 }}>
                Tipo de Vehículo <span style={{ color: '#EF4444' }}>*</span>
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

            {/* Placa */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Placa <span style={{ color: '#EF4444' }}>*</span>
              </label>
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

            {/* Capacidad */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Capacidad de Carga (kg) <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="number"
                className="input"
                placeholder="Ej: 1000"
                value={formData.capacityKg}
                onChange={(e) => updateField('capacityKg', e.target.value)}
                min="1"
                max="50000"
              />
            </div>

            {/* Fotos del vehículo */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Fotos del Vehículo <span style={{ color: '#EF4444' }}>*</span> (mín. 1)
              </label>
              
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
            
            {/* Tipo de licencia */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Tipo de Licencia <span style={{ color: '#EF4444' }}>*</span>
              </label>
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

            {/* Foto de licencia */}
            <FileUpload
              label="Foto de Licencia"
              required
              value={formData.licenseImage}
              onChange={(url) => updateField('licenseImage', url)}
              folder="drivers/licenses"
            />

            {/* Cédula frente */}
            <FileUpload
              label="Cédula de Identidad - Frente"
              required
              value={formData.cedulaFront}
              onChange={(url) => updateField('cedulaFront', url)}
              folder="drivers/cedulas"
            />

            {/* Cédula reverso */}
            <FileUpload
              label="Cédula de Identidad - Reverso"
              required
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
            
            {/* RUV */}
            <FileUpload
              label="RUV del Vehículo"
              required
              value={formData.ruvDocument}
              onChange={(url) => updateField('ruvDocument', url)}
              folder="drivers/documents"
            />

            {/* Placa vigente */}
            <FileUpload
              label="Foto de Placa Vigente"
              required
              value={formData.plateImage}
              onChange={(url) => updateField('plateImage', url)}
              folder="drivers/plates"
            />

            {/* Póliza de seguro */}
            <FileUpload
              label="Póliza de Seguro de Daños a Terceros"
              required
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
            
            {/* Teléfono */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Teléfono <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="tel"
                className="input"
                placeholder="+507 6000-0000"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
              <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
                Este número se mostrará a los clientes cuando aceptes un encargo.
              </p>
            </div>
          </div>
        )}

        {/* Sección 5: Adicionales */}
        {activeSection === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Documentos Adicionales (Opcionales)</h2>
            <p style={{ color: '#64748B', marginTop: '-1rem' }}>
              Estos documentos son opcionales pero pueden ser requeridos por algunos clientes.
            </p>
            
            <FileUpload
              label="Carné Blanco (Transporte de Alimentos)"
              value={formData.carneBlanco}
              onChange={(url) => updateField('carneBlanco', url)}
              folder="drivers/optional"
            />

            <FileUpload
              label="Carné Verde (Manipulación de Alimentos)"
              value={formData.carneVerde}
              onChange={(url) => updateField('carneVerde', url)}
              folder="drivers/optional"
            />

            <FileUpload
              label="Carné de Transporte de Carga"
              value={formData.carneTransporteCarga}
              onChange={(url) => updateField('carneTransporteCarga', url)}
              folder="drivers/optional"
            />

            <FileUpload
              label="Certificado de Fumigación del Vehículo"
              value={formData.fumigationCertificate}
              onChange={(url) => updateField('fumigationCertificate', url)}
              folder="drivers/optional"
            />
          </div>
        )}

        {/* Navegación entre secciones */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '2rem',
          gap: '1rem'
        }}>
          {activeSection > 1 ? (
            <button
              type="button"
              onClick={() => setActiveSection(activeSection - 1)}
              className="btn btn-outline"
              style={{ padding: '1rem 1.5rem' }}
            >
              <span className="material-symbols-rounded">arrow_back</span>
              Atrás
            </button>
          ) : (
            <div />
          )}
          
          {activeSection < 5 ? (
            <button
              type="button"
              onClick={() => setActiveSection(activeSection + 1)}
              className="btn btn-primary"
              style={{ padding: '1rem 1.5rem' }}
              disabled={!isSectionValid(activeSection)}
            >
              Siguiente
              <span className="material-symbols-rounded">arrow_forward</span>
            </button>
          ) : (
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading || !isSectionValid(4)}
              style={{ 
                padding: '1rem 2rem',
                fontSize: '1rem',
              }}
            >
              {loading ? (
                'Enviando...'
              ) : (
                <>
                  <span className="material-symbols-rounded">send</span>
                  Enviar para Verificación
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}