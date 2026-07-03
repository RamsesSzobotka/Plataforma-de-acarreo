import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import FileUpload from '../components/FileUpload'
import { StatusBadge } from '../components/StatusBadge'

interface Driver {
  _id: string
  verificationStatus: string
  rejectionReason?: string
  phone?: string
  vehicleType?: string
  plate?: string
  capacityKg?: number

  vehicleImages?: string[]
  licenseType?: string
  licenseImage?: string
  cedulaFront?: string
  cedulaBack?: string
  ruvDocument?: string
  plateImage?: string
  insurancePolicy?: string

  carneBlanco?: string
  carneVerde?: string
  carneTransporteCarga?: string
  fumigationCertificate?: string
}

const VEHICLE_TYPES = [
  { value: 'camioneta', label: 'Camioneta', icon: 'local_shipping' },
  { value: 'camion', label: 'Camion', icon: 'local_shipping' },
  { value: 'furgon', label: 'Furgon', icon: 'warehouse' },
  { value: 'grua', label: 'Grua', icon: 'construction' },
  { value: 'otro', label: 'Otro', icon: 'commute' },
]

const LICENSE_TYPES = [
  { value: 'a', label: 'Tipo A' },
  { value: 'b', label: 'Tipo B' },
  { value: 'c', label: 'Tipo C' },
  { value: 'd', label: 'Tipo D' },
  { value: 'e', label: 'Tipo E' },
]

const sections = [
  { num: 1, title: 'Vehiculo', icon: 'directions_car' },
  { num: 2, title: 'Docs Personales', icon: 'badge' },
  { num: 3, title: 'Docs Vehiculo', icon: 'description' },
  { num: 4, title: 'Contacto', icon: 'phone' },
  { num: 5, title: 'Adicionales', icon: 'add_circle' },
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

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/driver/me`, { headers })
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
        setSuccess(isResubmit ? 'Perfil reenviado para verificacion' : 'Perfil actualizado')
        loadDriver()

        if (isResubmit) {
          setTimeout(() => navigate('/driver'), 2000)
        }
      } else {
        setError(data.error || 'Error al actualizar perfil')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '60px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    )
  }

  if (!driver) {
    return (
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div className="empty-state card">
          <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: 'var(--text-muted)' }}>
            person_off
          </span>
          <h3>Perfil no encontrado</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Primero registrate como conductor.
          </p>
          <Link to="/register-driver" className="btn btn-primary">
            Registrarse como Conductor
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Back button */}
      <Link
        to="/driver"
        className="btn btn-ghost"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-6)',
          color: 'var(--text-muted)',
        }}
      >
        <span className="material-symbols-rounded">arrow_back</span>
        Volver al panel
      </Link>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-6)',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            marginBottom: 'var(--space-2)',
          }}>
            <span style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--primary-subtle)',
              color: 'var(--primary)',
              borderRadius: 'var(--radius)',
            }}>
              <span className="material-symbols-rounded">person</span>
            </span>
            Mi Perfil
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Gestiona tu informacion y documentos
          </p>
        </div>
        <StatusBadge status={driver.verificationStatus} size="lg" />
      </div>

      {/* Success/Error alerts */}
      {error && (
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--error-subtle)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius)',
          marginBottom: 'var(--space-4)',
          color: 'var(--error)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
        }}>
          <span className="material-symbols-rounded">error</span>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--success-subtle)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 'var(--radius)',
          marginBottom: 'var(--space-4)',
          color: 'var(--success)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
        }}>
          <span className="material-symbols-rounded">check_circle</span>
          {success}
        </div>
      )}

      {/* Rejection reason */}
      {driver.verificationStatus === 'rejected' && driver.rejectionReason && (
        <div style={{
          padding: 'var(--space-5)',
          background: 'var(--error-subtle)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-6)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            color: 'var(--error)',
            fontWeight: 'var(--font-semibold)',
            marginBottom: 'var(--space-2)',
          }}>
            <span className="material-symbols-rounded">info</span>
            Motivo del rechazo
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {driver.rejectionReason}
          </p>
        </div>
      )}

      {/* Section tabs */}
      <div className="tabs" style={{
        marginBottom: 'var(--space-6)',
        padding: 'var(--space-1)',
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        gap: 'var(--space-1)',
        overflowX: 'auto',
      }}>
        {sections.map(section => (
          <button
            key={section.num}
            onClick={() => setActiveSection(section.num)}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeSection === section.num ? 'var(--primary)' : 'transparent',
              color: activeSection === section.num ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              whiteSpace: 'nowrap',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              fontFamily: 'var(--font-display)',
              transition: 'all var(--duration-fast) var(--ease-out)',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
              {section.icon}
            </span>
            {section.title}
          </button>
        ))}
      </div>

      {/* Content card */}
      <div
        className="card"
        style={{
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
        }}
      >
        {/* Section 1: Vehicle */}
        {activeSection === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              paddingBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                borderRadius: 'var(--radius)',
              }}>
                <span className="material-symbols-rounded">directions_car</span>
              </div>
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  margin: 0,
                }}>
                  Datos del Vehiculo
                </h2>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Informacion de tu vehiculo de transporte
                </p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Tipo de Vehiculo</label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 'var(--space-3)',
              }}>
                {VEHICLE_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateField('vehicleType', type.value)}
                    style={{
                      padding: 'var(--space-4)',
                      border: `2px solid ${formData.vehicleType === type.value ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius)',
                      background: formData.vehicleType === type.value ? 'var(--primary-subtle)' : 'var(--surface-1)',
                      cursor: 'pointer',
                      transition: 'all var(--duration-fast) var(--ease-out)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{
                      fontSize: '1.5rem',
                      color: formData.vehicleType === type.value ? 'var(--primary)' : 'var(--text-muted)',
                    }}>
                      {type.icon}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-medium)',
                      color: formData.vehicleType === type.value ? 'var(--primary)' : 'var(--text-secondary)',
                    }}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              <div className="form-group">
                <label className="form-label required">Placa</label>
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

              <div className="form-group">
                <label className="form-label">Capacidad (kg)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="1000"
                  value={formData.capacityKg}
                  onChange={(e) => updateField('capacityKg', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Fotos del Vehiculo</label>
              {formData.vehicleImages.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                }}>
                  {formData.vehicleImages.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img
                        src={img}
                        alt={`Vehiculo ${idx + 1}`}
                        style={{
                          width: '100%',
                          height: '100px',
                          objectFit: 'cover',
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeVehicleImage(idx)}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          background: 'var(--error)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
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

        {/* Section 2: Personal Docs */}
        {activeSection === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              paddingBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--info-subtle)',
                color: 'var(--info)',
                borderRadius: 'var(--radius)',
              }}>
                <span className="material-symbols-rounded">badge</span>
              </div>
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  margin: 0,
                }}>
                  Documentos Personales
                </h2>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Licencia de conducir y cedula de identidad
                </p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Tipo de Licencia</label>
              <select
                className="input select"
                value={formData.licenseType}
                onChange={(e) => updateField('licenseType', e.target.value)}
              >
                <option value="">Selecciona el tipo</option>
                {LICENSE_TYPES.map(lt => (
                  <option key={lt.value} value={lt.value}>{lt.label}</option>
                ))}
              </select>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              <FileUpload
                label="Foto de Licencia"
                value={formData.licenseImage}
                onChange={(url) => updateField('licenseImage', url)}
                folder="drivers/licenses"
              />

              <FileUpload
                label="Cedula - Frente"
                value={formData.cedulaFront}
                onChange={(url) => updateField('cedulaFront', url)}
                folder="drivers/cedulas"
              />

              <FileUpload
                label="Cedula - Reverso"
                value={formData.cedulaBack}
                onChange={(url) => updateField('cedulaBack', url)}
                folder="drivers/cedulas"
              />
            </div>
          </div>
        )}

        {/* Section 3: Vehicle Docs */}
        {activeSection === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              paddingBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--secondary)',
                color: 'white',
                borderRadius: 'var(--radius)',
              }}>
                <span className="material-symbols-rounded">description</span>
              </div>
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  margin: 0,
                }}>
                  Documentos del Vehiculo
                </h2>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  RUV, placa y seguro obligatorio
                </p>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              <FileUpload
                label="RUV del Vehiculo"
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
                label="Poliza de Seguro"
                value={formData.insurancePolicy}
                onChange={(url) => updateField('insurancePolicy', url)}
                folder="drivers/insurance"
              />
            </div>
          </div>
        )}

        {/* Section 4: Contact */}
        {activeSection === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              paddingBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--warning-subtle)',
                color: 'var(--warning)',
                borderRadius: 'var(--radius)',
              }}>
                <span className="material-symbols-rounded">phone</span>
              </div>
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  margin: 0,
                }}>
                  Datos de Contacto
                </h2>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Como te contactaran los clientes
                </p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Telefono</label>
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

        {/* Section 5: Optional Docs */}
        {activeSection === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              paddingBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--surface-2)',
                color: 'var(--text-muted)',
                borderRadius: 'var(--radius)',
              }}>
                <span className="material-symbols-rounded">add_circle</span>
              </div>
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  margin: 0,
                }}>
                  Documentos Adicionales
                </h2>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Opcionales pero mejora tu perfil
                </p>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              <FileUpload
                label="Carne Blanco"
                value={formData.carneBlanco}
                onChange={(url) => updateField('carneBlanco', url)}
                folder="drivers/optional"
              />

              <FileUpload
                label="Carne Verde"
                value={formData.carneVerde}
                onChange={(url) => updateField('carneVerde', url)}
                folder="drivers/optional"
              />

              <FileUpload
                label="Carne de Transporte"
                value={formData.carneTransporteCarga}
                onChange={(url) => updateField('carneTransporteCarga', url)}
                folder="drivers/optional"
              />

              <FileUpload
                label="Certificado de Fumigacion"
                value={formData.fumigationCertificate}
                onChange={(url) => updateField('fumigationCertificate', url)}
                folder="drivers/optional"
              />
            </div>
          </div>
        )}

        {/* Submit button */}
        <div style={{
          marginTop: 'var(--space-6)',
          paddingTop: 'var(--space-6)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--space-3)',
        }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => handleSubmit(driver.verificationStatus === 'rejected')}
            disabled={saving}
            style={{ minWidth: '200px' }}
          >
            {saving ? (
              <>
                <div className="spinner" style={{ width: '18px', height: '18px' }} />
                {driver.verificationStatus === 'rejected' ? 'Enviando...' : 'Guardando...'}
              </>
            ) : (
              <>
                <span className="material-symbols-rounded">save</span>
                {driver.verificationStatus === 'rejected' ? 'Corregir y Reenviar' : 'Guardar Cambios'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}