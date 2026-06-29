import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { usersAPI } from '../services/api'
import FileUpload from '../components/FileUpload'
import AddressInput from '../components/AddressInput'
import { hideLoading, showLoading } from '../services/alerts'

interface DriverProfile {
  verificationStatus: 'pending' | 'in_review' | 'verified' | 'rejected' | 'suspended'
  rejectionReason?: string
  vehicleType?: string
  plate?: string
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

interface FormData {
  vehicleType: string
  plate: string
  capacityKg: string
  vehicleImages: string[]

  licenseType: string
  licenseImage: string
  cedulaFront: string
  cedulaBack: string

  ruvDocument: string
  plateImage: string
  insurancePolicy: string

  phone: string
  locationAddress: string
  locationCoordinates: [number, number] | null

  carneBlanco: string
  carneVerde: string
  carneTransporteCarga: string
  fumigationCertificate: string
}

const sections = [
  { num: 1, title: 'Vehiculo', icon: 'directions_car' },
  { num: 2, title: 'Docs Personales', icon: 'badge' },
  { num: 3, title: 'Docs Vehiculo', icon: 'description' },
  { num: 4, title: 'Contacto', icon: 'location_on' },
  { num: 5, title: 'Adicionales', icon: 'add_circle' },
]

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

  const redirectUrl = searchParams.get('redirect') || '/driver'

  useEffect(() => {
    const checkDriverStatus = async () => {
      if (!isSignedIn) {
        navigate(`/sign-in?redirect=/register-driver`)
        return
      }

      try {
        const token = await getToken()
        const data = await usersAPI.getDriver('me', token || undefined)

        setDriverStatus(data)
        setIsLoadingStatus(false)

        if (data.verificationStatus === 'verified') {
          navigate(redirectUrl)
          return
        }

        if (data.verificationStatus === 'suspended') {
          setError('Tu cuenta ha sido suspendida. Contacta al soporte.')
          return
        }
      } catch {
        setIsLoadingStatus(false)
      }
    }

    checkDriverStatus()
  }, [isSignedIn, navigate, redirectUrl])

  useEffect(() => {
    if (isLoadingStatus) {
      showLoading('Verificando tu estado...')
    } else {
      hideLoading()
    }

    return () => {
      hideLoading()
    }
  }, [isLoadingStatus])

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
    locationAddress: '',
    locationCoordinates: null,
    carneBlanco: '',
    carneVerde: '',
    carneTransporteCarga: '',
    fumigationCertificate: '',
  })

  const isSectionValid = (section: number): boolean => {
    switch (section) {
      case 1:
        return !!(formData.vehicleType && formData.plate && formData.capacityKg && formData.vehicleImages.length > 0)
      case 2:
        return !!(formData.licenseType && formData.licenseImage && formData.cedulaFront && formData.cedulaBack)
      case 3:
        return !!(formData.ruvDocument && formData.plateImage && formData.insurancePolicy)
      case 4:
        return !!(formData.phone && formData.locationCoordinates)
      case 5:
        return true
      default:
        return false
    }
  }

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

    for (let i = 1; i <= 4; i++) {
      if (!isSectionValid(i)) {
        const sectionNames = ['', 'Vehiculo', 'Docs Personales', 'Docs Vehiculo', 'Contacto']
        setError(`Completa la seccion "${sectionNames[i]}" antes de continuar`)
        setActiveSection(i)
        return
      }
    }

    setLoading(true)
    setError('')

    try {
      const token = await getToken()

      const response = await fetch('/api/users/register-driver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
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
          currentLocation: formData.locationCoordinates ? {
            type: 'Point',
            coordinates: formData.locationCoordinates
          } : undefined,
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
        if (data.missing && Array.isArray(data.missing) && data.missing.length > 0) {
          setError(`Faltan: ${data.missing.join(', ')}`)
        } else {
          setError(data.error || 'Error al registrar conductor')
        }
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const showStatus = driverStatus && (driverStatus.verificationStatus === 'pending' || driverStatus.verificationStatus === 'in_review' || driverStatus.verificationStatus === 'rejected')

  if (isLoadingStatus) {
    return null
  }

  if (showStatus) {
    const statusConfig = {
      pending: {
        color: 'var(--warning)',
        bgColor: 'var(--warning-subtle)',
        icon: 'schedule',
        title: 'Verificacion Pendiente',
        description: 'Tus documentos estan en revision. No podras aceptar pedidos hasta que un admin apruebe tu perfil.',
      },
      in_review: {
        color: 'var(--info)',
        bgColor: 'var(--info-subtle)',
        icon: 'fact_check',
        title: 'En Revision',
        description: 'Un admin esta revisando tus documentos actualmente.',
      },
      rejected: {
        color: 'var(--error)',
        bgColor: 'var(--error-subtle)',
        icon: 'cancel',
        title: 'Verificacion Rechazada',
        description: driverStatus.rejectionReason || 'Tu solicitud fue rechazada.',
      },
    } as const

    const currentStatus = driverStatus.verificationStatus as keyof typeof statusConfig
    const status = statusConfig[currentStatus] || statusConfig.pending

    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '4rem' }}>
        <Link
          to="/"
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
          Volver al inicio
        </Link>

        <div
          className="card"
          style={{
            textAlign: 'center',
            background: status.bgColor,
            borderColor: status.color,
            animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
          }}
        >
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: status.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-5)',
            boxShadow: `0 0 24px ${status.color}40`,
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', color: 'white' }}>
              {status.icon}
            </span>
          </div>

          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-bold)',
            marginBottom: 'var(--space-2)',
            color: status.color,
          }}>
            {status.title}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
            {status.description}
          </p>

          {driverStatus.verificationStatus === 'pending' && (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Tiempo estimado: 24-48 horas
            </p>
          )}

          {driverStatus.verificationStatus === 'rejected' && (
            <div style={{
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'center',
              marginTop: 'var(--space-5)',
              flexWrap: 'wrap',
            }}>
              <Link
                to="/driver/profile"
                className="btn btn-primary"
              >
                <span className="material-symbols-rounded">edit</span>
                Corregir documentos
              </Link>
              <Link
                to="/"
                className="btn btn-outline"
              >
                <span className="material-symbols-rounded">home</span>
                Volver al inicio
              </Link>
            </div>
          )}

          {driverStatus.verificationStatus === 'pending' && (
            <Link
              to="/"
              className="btn btn-ghost"
              style={{
                marginTop: 'var(--space-5)',
                color: 'var(--text-muted)',
              }}
            >
              <span className="material-symbols-rounded">home</span>
              Volver al inicio
            </Link>
          )}
        </div>

        {driverStatus.vehicleType && driverStatus.plate && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-4)',
            padding: 'var(--space-4)',
            background: 'var(--surface-card)',
            borderRadius: 'var(--radius)',
          }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>
              directions_car
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 'var(--font-semibold)',
            }}>
              {driverStatus.vehicleType} - {driverStatus.plate}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Back button */}
      <Link
        to="/"
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
        Volver al inicio
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
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
            <span className="material-symbols-rounded">directions_car</span>
          </span>
          Registro como Conductor
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          Completa todos los documentos requeridos para comenzar a aceptar acarreos.
        </p>
      </div>

      {/* Progress bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
        padding: 'var(--space-4)',
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-2)',
          }}>
            <span style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-primary)',
            }}>
              Progreso del registro
            </span>
            <span style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--primary)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 'var(--font-bold)',
            }}>
              {progress}%
            </span>
          </div>
          <div style={{
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-full)',
            height: '8px',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(90deg, var(--primary) 0%, var(--primary-light) 100%)',
              width: `${progress}%`,
              height: '100%',
              borderRadius: 'var(--radius-full)',
              transition: 'width var(--duration-slow) var(--ease-out)',
              boxShadow: '0 0 12px var(--primary-glow)',
            }} />
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          color: 'var(--success)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-medium)',
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--success-subtle)',
          borderRadius: 'var(--radius-full)',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>check</span>
          {completedSections}/5
        </div>
      </div>

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
        {sections.map(section => {
          const isValid = isSectionValid(section.num)
          const isActive = activeSection === section.num

          return (
            <button
              key={section.num}
              onClick={() => setActiveSection(section.num)}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? 'white' : isValid ? 'var(--success)' : 'var(--text-secondary)',
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
                {isValid && !isActive ? 'check_circle' : section.icon}
              </span>
              {section.title}
            </button>
          )
        })}
      </div>

      {/* Error alert */}
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

      <form onSubmit={handleSubmit}>
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
                  <label className="form-label required">Capacidad (kg)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="1000"
                    value={formData.capacityKg}
                    onChange={(e) => updateField('capacityKg', e.target.value)}
                    min="1"
                    max="50000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label required">Fotos del Vehiculo (min. 1)</label>
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
                  required
                  value={formData.licenseImage}
                  onChange={(url) => updateField('licenseImage', url)}
                  folder="drivers/licenses"
                />

                <FileUpload
                  label="Cedula - Frente"
                  required
                  value={formData.cedulaFront}
                  onChange={(url) => updateField('cedulaFront', url)}
                  folder="drivers/cedulas"
                />

                <FileUpload
                  label="Cedula - Reverso"
                  required
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
                  required
                  value={formData.ruvDocument}
                  onChange={(url) => updateField('ruvDocument', url)}
                  folder="drivers/documents"
                />

                <FileUpload
                  label="Foto de Placa Vigente"
                  required
                  value={formData.plateImage}
                  onChange={(url) => updateField('plateImage', url)}
                  folder="drivers/plates"
                />

                <FileUpload
                  label="Poliza de Seguro"
                  required
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
                  <span className="material-symbols-rounded">location_on</span>
                </div>
                <div>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-semibold)',
                    margin: 0,
                  }}>
                    Datos de Contacto y Ubicacion
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
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                  Este numero se mostrara a los clientes cuando aceptes un encargo.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label required">Tu ubicacion actual</label>
                <AddressInput
                  label=""
                  placeholder="Busca tu ubicacion oselecciona en el mapa"
                  value={formData.locationAddress}
                  coordinates={formData.locationCoordinates}
                  onAddressChange={(address) => updateField('locationAddress', address)}
                  onCoordinatesChange={(coords) => updateField('locationCoordinates', coords)}
                  required
                />
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                  Esta ubicacion se usara para mostrarte pedidos cercanos.
                </p>
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
                    Documentos Adicionales (Opcionales)
                  </h2>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Opcionales pero mejoran tu perfil
                  </p>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 'var(--space-4)',
              }}>
                <FileUpload
                  label="Carne Blanco (Transporte de Alimentos)"
                  value={formData.carneBlanco}
                  onChange={(url) => updateField('carneBlanco', url)}
                  folder="drivers/optional"
                />

                <FileUpload
                  label="Carne Verde (Manipulacion de Alimentos)"
                  value={formData.carneVerde}
                  onChange={(url) => updateField('carneVerde', url)}
                  folder="drivers/optional"
                />

                <FileUpload
                  label="Carne de Transporte de Carga"
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

          {/* Navigation */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--border-subtle)',
            gap: 'var(--space-4)',
          }}>
            {activeSection > 1 ? (
              <button
                type="button"
                onClick={() => setActiveSection(activeSection - 1)}
                className="btn btn-outline"
              >
                <span className="material-symbols-rounded">arrow_back</span>
                Atras
              </button>
            ) : (
              <div />
            )}

            {activeSection < 5 ? (
              <button
                type="button"
                onClick={() => setActiveSection(activeSection + 1)}
                className="btn btn-primary"
                disabled={!isSectionValid(activeSection)}
              >
                Siguiente
                <span className="material-symbols-rounded">arrow_forward</span>
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading || !isSectionValid(4)}
              >
                {loading ? (
                  <>
                    <div className="spinner" style={{ width: '18px', height: '18px' }} />
                    Enviando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-rounded">send</span>
                    Enviar para Verificacion
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}