import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'

interface ClientProfileProps {
  clerkId: string
}

interface ClientData {
  clerkId: string
  firstName?: string
  lastName?: string
  imageUrl?: string
  email?: string
}

function ClientProfile({ clerkId }: ClientProfileProps) {
  const { getToken } = useAuth()
  const [client, setClient] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadClientProfile()
  }, [clerkId])

  async function loadClientProfile() {
    try {
      const token = await getToken()
      const headers: HeadersInit = {}
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`/api/users/${clerkId}`, { headers })
      if (response.ok) {
        const data = await response.json()
        setClient(data)
      } else {
        setError('Cliente no encontrado')
      }
    } catch (err) {
      setError('Error al cargar perfil')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        padding: '1rem',
        background: '#F8FAFC',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#E2E8F0',
          animation: 'pulse 1.5s infinite',
        }} />
        <div>
          <div style={{ width: '100px', height: '12px', background: '#E2E8F0', borderRadius: '4px', marginBottom: '4px' }} />
          <div style={{ width: '60px', height: '10px', background: '#E2E8F0', borderRadius: '4px' }} />
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div style={{
        padding: '1rem',
        background: '#FEF2F2',
        borderRadius: '12px',
        color: '#EF4444',
      }}>
        <span className="material-symbols-rounded">error</span>
        {error || 'Cliente no disponible'}
      </div>
    )
  }

  const fullName = [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Cliente'
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{
      padding: '1rem',
      background: '#F8FAFC',
      borderRadius: '12px',
      border: '1px solid #E2E8F0',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '0.75rem',
      }}>
        {/* Avatar */}
        {client.imageUrl ? (
          <img 
            src={client.imageUrl} 
            alt={fullName}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#0D9488',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '600',
            fontSize: '1rem',
          }}>
            {initials}
          </div>
        )}
        
        {/* Info */}
        <div>
          <h4 style={{ 
            margin: 0, 
            fontSize: '1rem',
            fontWeight: '600',
            color: '#0F172A',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: '#64748B' }}>person</span>
            {fullName}
          </h4>
        </div>
      </div>
      
      {client.email && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #E2E8F0',
          fontSize: '0.75rem',
          color: '#64748B',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>email</span>
          <span>{client.email}</span>
        </div>
      )}
    </div>
  )
}

export default ClientProfile