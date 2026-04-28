import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import FileUpload from '../components/FileUpload'

// ... resto de imports y types

export default function RegisterDriver() {
  const { user, isSignedIn } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState(1)
  const [driverStatus, setDriverStatus] = useState<DriverProfile | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  
  // Variable para evitar que el effect se ejecute múltiples veces
  const hasCheckedStatus = useRef(false)

  // Obtener redirect URL si existe
  const redirectUrl = searchParams.get('redirect') || '/driver'

  // Verificar estado del conductor - SOLO UNA VEZ cuando isSignedIn cambia
  useEffect(() => {
    if (!isSignedIn) {
      // No está logueado -> redirigir a sign-in con redirect
      navigate(`/sign-in?redirect=/register-driver`)
      return
    }

    // Si ya fue verificado el driver status, no hacer nada
    if (hasCheckedStatus.current) {
      setIsLoadingStatus(false)
      return
    }

    hasCheckedStatus.current = true

    const checkDriverStatus = async () => {
      try {
        const token = await getToken()
        
        const response = await fetch('/api/users/driver/me', {
          headers: { 
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          }
        })

        if (response.ok) {
          const data = await response.json()
          setDriverStatus(data)

          // Si ya está verificado -> ir directo al dashboard
          if (data.verificationStatus === 'verified') {
            navigate(redirectUrl)
            return
          }

          // Si está en revisión, pendiente o rechazado -> mostrar estado/formulario
          // Si está suspendido -> mostrar error
          if (data.verificationStatus === 'suspended') {
            setError('Tu cuenta ha sido suspendida. Contacta al soporte.')
            return
          }
        } else if (response.status === 404) {
          // No existe -> es nuevo, mostrar formulario
          setDriverStatus(null)
        }
      } catch (err) {
        console.error('Error checking driver status:', err)
      } finally {
        setIsLoadingStatus(false)
      }
    }

    checkDriverStatus()
  }, [isSignedIn]) // Solo depende de isSignedIn - se ejecuta cuando cambia de no-logueado a logueado
  
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
      const token = await getToken()
      
      const payload = {
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
      }
      
      console.log('📤 [REGISTER] Enviando payload:', payload)
      
      const response = await fetch('/api/users/register-driver', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify(payload),
      })
      
      const data = await response.json()
      console.log('📥 [REGISTER] Respuesta:', { status: response.status, data })
      
      if (response.ok) {
        navigate('/driver')
      } else {
        const errorMsg = data.missing ? `Faltan: ${data.missing.join(', ')}` : (data.error || 'Error al registrar conductor')
        console.error('❌ [REGISTER] Error:', errorMsg)
        setError(errorMsg)
      }
    } catch (err) {
      setError('Error de conexión')
} finally {
      setLoading(false)
    }
  }

  // Mostrar estado si ya tiene solicitud pendiente o fue rechazado
  const showStatus = driverStatus && (driverStatus.verificationStatus === 'pending' || driverStatus.verificationStatus === 'in_review' || driverStatus.verificationStatus === 'rejected')

  // Loading inicial mientras verifica estado
  if (isLoadingStatus) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', paddingBottom: '4rem', textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ color: '#64748B' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '3rem', display: 'block', margin: '0 auto 1rem' }}>
            hourglass_empty
          </span>
          <p>Verificando tu estado...</p>
        </div>
      </div>
    )
  }

  // Mostrar mensajes de estado existente (pendiente, en revisión, rechazado)
  if (showStatus) {
    const statusConfig = {
      pending: { color: '#F59E0B', icon: 'schedule', title: 'Verificación Pendiente', description: 'Tus documentos están en revisión. No podrás aceptar pedidos hasta que un admin apruebe tu perfil.' },
      in_review: { color: '#3B82F6', icon: 'fact_check', title: 'En Revisión', description: 'Un admin está revisando tus documentos actualmente.' },
      rejected: { color: '#EF4444', icon: 'cancel', title: 'Verificación Rechazada', description: driverStatus.rejectionReason || 'Tu solicitud fue rechazada.' },
    } as const
    const currentStatus = driverStatus.verificationStatus as keyof typeof statusConfig
    const status = statusConfig[currentStatus] || statusConfig.pending

    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', paddingBottom: '4rem' }}>
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

        {/* State Card */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '2.5rem',
          border: '1px solid #E2E8F0',
          textAlign: 'center',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: `${status.color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', color: status.color }}>
              {status.icon}
            </span>
          </div>
          
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            {status.title}
          </h2>
          <p style={{ color: '#64748B', marginBottom: '1.5rem', fontFamily: '"Inter", sans-serif' }}>
            {status.description}
          </p>

          {driverStatus.verificationStatus === 'pending' && (
            <p style={{ color: '#94A3B8', fontSize: '0.875rem' }}>
              Tiempo estimado: 24-48 horas
            </p>
          )}

          {driverStatus.verificationStatus === 'rejected' && (
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <Link
                to="/driver/profile"
                style={{
                  background: '#0D9488',
                  color: 'white',
                  padding: '0.875rem 1.5rem',
                  borderRadius: '12px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span className="material-symbols-rounded">edit</span>
                Corregir documentos
              </Link>
              <Link
                to="/"
                style={{
                  background: '#F1F5F9',
                  color: '#334155',
                  padding: '0.875rem 1.5rem',
                  borderRadius: '12px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span className="material-symbols-rounded">home</span>
                Volver al inicio
              </Link>
            </div>
          )}

          {driverStatus.verificationStatus === 'pending' && (
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '1.5rem',
                color: '#64748B',
                textDecoration: 'none',
                fontFamily: '"Inter", sans-serif',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>home</span>
              Volver al inicio
            </Link>
          )}
        </div>

        {/* Info del vehículos si existe */}
        {driverStatus.vehicleType && driverStatus.plate && (
          <div style={{
            background: '#F8FAFC',
            borderRadius: '16px',
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            border: '1px solid #E2E8F0',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: '1.5rem', color: '#0D9488' }}>
              directions_car
            </span>
            <span style={{ 
              fontFamily: '"JetBrains Mono", monospace', 
              fontWeight: 600,
              color: '#0F172A' // ← AGREGADO: color texto oscuro
            }}>
              {driverStatus.vehicleType} • {driverStatus.plate}
            </span>
          </div>
        )}
      </div>
    )
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