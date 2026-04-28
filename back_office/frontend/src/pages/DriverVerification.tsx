import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Check, X, Eye, Phone, Car, FileText } from 'lucide-react'

export default function DriverVerificationPage() {
  const queryClient = useQueryClient()
  const [selectedDriver, setSelectedDriver] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')

const { data, isLoading, error } = useQuery({
    queryKey: ['admin-pending-drivers'],
    queryFn: () => api.getPendingDrivers() as Promise<any>
  })

  const verifyMutation = useMutation({
    mutationFn: ({ userId, action, reason }: { userId: string; action: 'approve' | 'reject'; reason?: string }) =>
      api.verifyDriver(userId, action, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-drivers'] })
      setSelectedDriver(null)
      setRejectReason('')
    }
  })

  const { drivers = [] } = data || {}

  const handleApprove = () => {
    if (selectedDriver) {
      verifyMutation.mutate({ userId: selectedDriver.userId, action: 'approve' })
    }
  }

  const handleReject = () => {
    if (selectedDriver) {
      verifyMutation.mutate({ userId: selectedDriver.userId, action: 'reject', reason: rejectReason })
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Cargando...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'var(--error)' }}>
        Error cargando conductores pendientes
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Verificar Conductores</h1>

      {/* Pending Drivers List */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
          Pendientes ({drivers.length})
        </h2>

        {drivers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay conductores pendientes de verificación
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {drivers.map((driver: any) => (
              <div 
                key={driver._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: selectedDriver?.userId === driver.userId ? 'var(--bg-secondary)' : 'var(--bg-primary)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {driver.user?.imageUrl ? (
                    <img 
                      src={driver.user.imageUrl} 
                      alt="" 
                      style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      fontWeight: 600
                    }}>
                      {driver.user?.firstName?.[0] || '?'}
                    </div>
                  )}
                  <div>
                    <p style={{ fontWeight: 600 }}>
                      {driver.user?.firstName} {driver.user?.lastName}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {driver.user?.email}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {driver.vehicleType} • {driver.plate} • {driver.capacityKg}kg
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setSelectedDriver(driver)}
                    className="btn-outline btn-sm"
                  >
                    <Eye size={16} /> Ver
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Driver Detail Modal */}
      {selectedDriver && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem' }}>Verificar Conductor</h2>
              <button onClick={() => setSelectedDriver(null)} className="btn-outline btn-sm">
                ✕ Cerrar
              </button>
            </div>

            {/* User Info */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={16} /> Información de Contacto
              </h3>
              <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <p><strong>Nombre:</strong> {selectedDriver.user?.firstName} {selectedDriver.user?.lastName}</p>
                <p><strong>Email:</strong> {selectedDriver.user?.email}</p>
                <p><strong>Teléfono:</strong> {selectedDriver.phone || '-'}</p>
              </div>
            </div>

            {/* Vehicle Info */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Car size={16} /> Vehículo
              </h3>
              <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <p><strong>Tipo:</strong> {selectedDriver.vehicleType}</p>
                <p><strong>Placa:</strong> {selectedDriver.plate}</p>
                <p><strong>Capacidad:</strong> {selectedDriver.capacityKg} kg</p>
                <p><strong>Tipo de licencia:</strong> {selectedDriver.licenseType || '-'}</p>
              </div>
            </div>

            {/* Documents */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} /> Documentos
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                {selectedDriver.licenseImage && (
                  <div>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Licencia</p>
                    <img 
                      src={selectedDriver.licenseImage} 
                      alt="Licencia" 
                      style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                )}
                {selectedDriver.cedulaFront && (
                  <div>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Cédula Frente</p>
                    <img 
                      src={selectedDriver.cedulaFront} 
                      alt="Cédula" 
                      style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                )}
                {selectedDriver.cedulaBack && (
                  <div>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Cédula Reverso</p>
                    <img 
                      src={selectedDriver.cedulaBack} 
                      alt="Cédula" 
                      style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                )}
                {selectedDriver.ruvDocument && (
                  <div>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>RUV</p>
                    <img 
                      src={selectedDriver.ruvDocument} 
                      alt="RUV" 
                      style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                )}
                {selectedDriver.insurancePolicy && (
                  <div>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Póliza de Seguro</p>
                    <img 
                      src={selectedDriver.insurancePolicy} 
                      alt="Seguro" 
                      style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Reject Reason */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Razón de Rechazo (opcional)</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Si rechazas, ingresa la razón..."
                style={{ width: '100%', minHeight: '80px' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedDriver(null)}
                className="btn-outline"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                className="btn-error"
                disabled={verifyMutation.isPending}
              >
                <X size={16} /> Rechazar
              </button>
              <button
                onClick={handleApprove}
                className="btn-success"
                disabled={verifyMutation.isPending}
              >
                <Check size={16} /> Aprobar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}