import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import AddressInput from '../components/AddressInput'
import MultiFileUpload from '../components/MultiFileUpload'
import { ridesAPI, usersAPI } from '../services/api'
import { SectionHeader } from '../components/SectionHeader'
import { showError, showWarning } from '../services/alerts'

interface UploadedImage {
  url: string
  publicId?: string
}

interface RideFormData {
  title: string
  description: string
  type: '' | 'mudanza' | 'electrodomesticos' | 'muebles' | 'productos' | 'otros'
  images: UploadedImage[]
  pickupAddress: string
  dropoffAddress: string
  pickupCoordinates: [number, number] | null
  dropoffCoordinates: [number, number] | null
  estimatedPrice: number
  packages?: number
  notes?: string
}

const rideTypes = [
  { value: 'mudanza', label: 'Mudanza', icon: 'home' },
  { value: 'electrodomesticos', label: 'Electrodomesticos', icon: 'kitchen' },
  { value: 'muebles', label: 'Muebles', icon: 'chair' },
  { value: 'productos', label: 'Productos', icon: 'inventory_2' },
  { value: 'otros', label: 'Otros', icon: 'category' },
]

function CreateRide() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)
  const [hasSavedPaymentMethod, setHasSavedPaymentMethod] = useState<boolean | null>(null)
  const [checkingPaymentMethod, setCheckingPaymentMethod] = useState(true)

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

  function updateFormField<K extends keyof RideFormData>(field: K, value: RideFormData[K]) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  // Check for saved payment method on mount
  useEffect(() => {
    async function checkPaymentMethod() {
      try {
        const token = await getToken()
        if (!token) {
          setHasSavedPaymentMethod(false)
          return
        }

        const result = await usersAPI.getPaymentMethod(token || undefined)
        setHasSavedPaymentMethod(result.hasPaymentMethod)
        if (result.stripePaymentMethodId) {
          setPaymentMethodId(result.stripePaymentMethodId)
        }
      } catch {
        setHasSavedPaymentMethod(false)
      } finally {
        setCheckingPaymentMethod(false)
      }
    }
    checkPaymentMethod()
  }, [getToken])

  // Check if returned from add-payment-method page with success
  useEffect(() => {
    const paymentAdded = searchParams.get('payment_added')
    if (paymentAdded === 'true') {
      setHasSavedPaymentMethod(true)
      getToken().then((token) =>
        usersAPI.getPaymentMethod(token || undefined).then(result => {
          if (result.stripePaymentMethodId) {
            setPaymentMethodId(result.stripePaymentMethodId)
          }
        })
      ).catch(() => {})
    }
  }, [searchParams, getToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!formData.pickupCoordinates || !formData.dropoffCoordinates) {
      await showWarning('Por favor selecciona una direccion de la lista de sugerencias')
      return
    }

    if (formData.images.length === 0) {
      await showWarning('Sube al menos una imagen del pedido')
      return
    }

    if (!formData.type) {
      await showWarning('Selecciona un tipo de pedido')
      return
    }

    const rideType = formData.type

    if (!paymentMethodId && !hasSavedPaymentMethod) {
      navigate('/add-payment-method?redirect=create-ride')
      return
    }

    setLoading(true)

    try {
      const token = await getToken()
      if (!token) {
        throw new Error('Sesion no valida. Inicia sesion nuevamente.')
      }

      await ridesAPI.create({
        clientId: user.id,
        title: formData.title,
        description: formData.description,
        type: rideType,
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
        stripePaymentMethodId: paymentMethodId || undefined,
      }, token)

      navigate('/my-rides')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al crear el pedido'
      await showError(message)
    } finally {
      setLoading(false)
    }
  }

  const formCompleted = formData.title && formData.type && formData.description && formData.images.length > 0
  const locationsCompleted = formData.pickupAddress && formData.dropoffAddress && formData.pickupCoordinates && formData.dropoffCoordinates
  const priceSet = formData.estimatedPrice > 0

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Back button */}
      <Link
        to="/my-rides"
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
        Volver a Mis Pedidos
      </Link>

      {/* Header */}
      <SectionHeader
        icon="add_circle"
        title="Crear Nuevo Pedido"
        description="Completa los detalles de tu acarreo"
        action={
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--surface-1)',
            borderRadius: 'var(--radius)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>info</span>
            1 de 3 pasos
          </div>
        }
      />

      {/* Progress indicator */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-8)',
        padding: 'var(--space-4)',
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3)',
          background: formCompleted ? 'var(--success-subtle)' : 'var(--surface-1)',
          borderRadius: 'var(--radius)',
          transition: 'all var(--duration-normal) var(--ease-out)',
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: formCompleted ? 'var(--success)' : 'var(--surface-2)',
            color: formCompleted ? 'white' : 'var(--text-muted)',
            borderRadius: '50%',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-bold)',
          }}>
            {formCompleted ? (
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>check</span>
            ) : '1'}
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '2px' }}>Paso 1</div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: formCompleted ? 'var(--success)' : 'var(--text-primary)' }}>
              Detalles del pedido
            </div>
          </div>
        </div>

        <div style={{
          width: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>chevron_right</span>
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3)',
          background: locationsCompleted ? 'var(--success-subtle)' : 'var(--surface-1)',
          borderRadius: 'var(--radius)',
          transition: 'all var(--duration-normal) var(--ease-out)',
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: locationsCompleted ? 'var(--success)' : 'var(--surface-2)',
            color: locationsCompleted ? 'white' : 'var(--text-muted)',
            borderRadius: '50%',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-bold)',
          }}>
            {locationsCompleted ? (
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>check</span>
            ) : '2'}
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '2px' }}>Paso 2</div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: locationsCompleted ? 'var(--success)' : 'var(--text-primary)' }}>
              Ubicaciones
            </div>
          </div>
        </div>

        <div style={{
          width: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>chevron_right</span>
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3)',
          background: priceSet ? 'var(--success-subtle)' : 'var(--surface-1)',
          borderRadius: 'var(--radius)',
          transition: 'all var(--duration-normal) var(--ease-out)',
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: priceSet ? 'var(--success)' : 'var(--surface-2)',
            color: priceSet ? 'white' : 'var(--text-muted)',
            borderRadius: '50%',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-bold)',
          }}>
            {priceSet ? (
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>check</span>
            ) : '3'}
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '2px' }}>Paso 3</div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: priceSet ? 'var(--success)' : 'var(--text-primary)' }}>
              Precio final
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Payment Method Status */}
        {checkingPaymentMethod ? (
          <div style={{
            padding: 'var(--space-4)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface-card)',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-3)',
          }}>
            <div className="spinner" style={{ width: '20px', height: '20px' }} />
            <span style={{ color: 'var(--text-muted)' }}>Verificando metodo de pago...</span>
          </div>
        ) : hasSavedPaymentMethod ? (
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--success-subtle)',
            borderRadius: 'var(--radius)',
            fontSize: 'var(--text-sm)',
            color: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>check_circle</span>
            <div>
              <strong>Metodo de pago verificado</strong>
              <p style={{ margin: 0, opacity: 0.8, fontSize: 'var(--text-xs)' }}>Tu metodo de pago esta listo para usar</p>
            </div>
          </div>
        ) : (
          <div style={{
            padding: 'var(--space-5)',
            background: 'var(--error-subtle)',
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 'var(--space-3)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: 'var(--error)',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>warning</span>
                <strong style={{ fontSize: 'var(--text-sm)' }}>Metodo de pago requerido</strong>
              </div>
              <Link
                to="/add-payment-method?redirect=create-ride"
                className="btn btn-sm"
                style={{
                  background: 'var(--error)',
                  color: 'white',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>add</span>
                Agregar
              </Link>
            </div>
            <p style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
            }}>
              Debes agregar un metodo de pago antes de crear un pedido.
            </p>
          </div>
        )}

        {/* Section 1: Basic Info Card */}
        <div className="card" style={{
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
          animationDelay: '100ms',
          animationFillMode: 'both',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-6)',
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
              <span className="material-symbols-rounded">description</span>
            </div>
            <div>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                margin: 0,
              }}>
                Informacion del Pedido
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Titulo, descripcion y tipo de acarreo
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div className="form-group">
              <label className="form-label required">Titulo del pedido</label>
              <input
                type="text"
                className="input"
                placeholder="Ej: Mudanza completa de apartamento a casa nueva"
                value={formData.title}
                onChange={(e) => updateFormField('title', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Tipo de acarreo</label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 'var(--space-3)',
              }}>
                {rideTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateFormField('type', type.value as RideFormData['type'])}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-4)',
                      background: formData.type === type.value ? 'var(--primary-subtle)' : 'var(--surface-1)',
                      border: formData.type === type.value ? '2px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      transition: 'all var(--duration-fast) var(--ease-out)',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{
                      fontSize: '1.5rem',
                      color: formData.type === type.value ? 'var(--primary)' : 'var(--text-muted)',
                    }}>
                      {type.icon}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--font-medium)',
                      color: formData.type === type.value ? 'var(--primary)' : 'var(--text-secondary)',
                    }}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Descripcion detallada</label>
              <textarea
                className="input"
                rows={4}
                placeholder="Describe que necesitas transportar, dimensiones aproximadas, cantidad de bultos..."
                value={formData.description}
                onChange={(e) => updateFormField('description', e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: Images Card */}
        <div className="card" style={{
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
          animationDelay: '150ms',
          animationFillMode: 'both',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-6)',
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
              <span className="material-symbols-rounded">photo_library</span>
            </div>
            <div>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                margin: 0,
              }}>
                Imagenes del Pedido
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Agrega hasta 8 fotos de lo que necesitas transportar
              </p>
            </div>
          </div>

          <MultiFileUpload
            label="Imágenes del acarreo"
            required
            maxFiles={8}
            value={formData.images}
            onChange={(images) => updateFormField('images', images)}
            folder="rides"
          />
        </div>

        {/* Section 3: Locations Card */}
        <div className="card" style={{
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
          animationDelay: '200ms',
          animationFillMode: 'both',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-6)',
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
              <span className="material-symbols-rounded">map</span>
            </div>
            <div>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                margin: 0,
              }}>
                Ubicaciones
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Punto de recogida y destino final
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <AddressInput
              label="Direccion de Recogida"
              placeholder="Escribe una direccion en Panama..."
              value={formData.pickupAddress}
              coordinates={formData.pickupCoordinates}
              onAddressChange={(address) => updateFormField('pickupAddress', address)}
              onCoordinatesChange={(coords) => updateFormField('pickupCoordinates', coords)}
              required
            />

            {/* Arrow indicator */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: 'var(--space-2) 0',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                background: 'var(--surface-2)',
                borderRadius: '50%',
                color: 'var(--primary)',
              }}>
                <span className="material-symbols-rounded">south</span>
              </div>
            </div>

            <AddressInput
              label="Direccion de Entrega"
              placeholder="Escribe una direccion en Panama..."
              value={formData.dropoffAddress}
              coordinates={formData.dropoffCoordinates}
              onAddressChange={(address) => updateFormField('dropoffAddress', address)}
              onCoordinatesChange={(coords) => updateFormField('dropoffCoordinates', coords)}
              required
            />
          </div>
        </div>

        {/* Section 4: Price & Extras Card */}
        <div className="card" style={{
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
          animationDelay: '250ms',
          animationFillMode: 'both',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-6)',
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
              <span className="material-symbols-rounded">payments</span>
            </div>
            <div>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                margin: 0,
              }}>
                Precio y Detalles
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Valor sugerido y informacion adicional
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div className="form-group">
              <label className="form-label required">Precio Sugerido (USD)</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: 'var(--space-4)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-lg)',
                }}>$</span>
                <input
                  type="number"
                  className="input"
                  placeholder="0.00"
                  value={formData.estimatedPrice || ''}
                  onChange={(e) => updateFormField('estimatedPrice', Number(e.target.value))}
                  required
                  style={{ paddingLeft: 'var(--space-8)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)' }}
                />
              </div>
              <p style={{
                margin: 'var(--space-2) 0 0',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
              }}>
                Este precio es una referencia inicial. Podras negociarlo con los conductores.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              <div className="form-group">
                <label className="form-label">Numero de Bultos</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Ej: 5"
                  value={formData.packages || ''}
                  onChange={(e) =>
                    updateFormField('packages', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notas Especiales</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Ej: Requiere ayuda para cargar, contiene articulos fragiles, horarios flexibles..."
                value={formData.notes || ''}
                onChange={(e) => updateFormField('notes', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          padding: 'var(--space-6)',
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
          animationDelay: '300ms',
          animationFillMode: 'both',
        }}>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || !formData.pickupCoordinates || !formData.dropoffCoordinates || formData.images.length === 0 || !hasSavedPaymentMethod}
            style={{ width: '100%' }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: '20px', height: '20px' }} />
                Creando pedido...
              </>
            ) : (
              <>
                <span className="material-symbols-rounded">send</span>
                Publicar Pedido
              </>
            )}
          </button>

          <p style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            textAlign: 'center',
            margin: 0,
          }}>
            Direcciones proporcionadas por <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>OpenStreetMap</a>
          </p>
        </div>
      </form>
    </div>
  )
}

export default CreateRide