import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { wsService } from '../services/api'
import type { UserRole, Ride } from '../types'

interface Message {
  _id: string
  senderId: string
  content: string
  read: boolean
  createdAt: string
}

interface ProposalInfo {
  driverId: string
  proposedPrice?: number
  proposalCount: number
  remainingProposals: number
  canProposeMore: boolean
  status?: 'pending' | 'accepted' | 'rejected'
}

function Chat() {
  const { rideId } = useParams<{ rideId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useUser()
  const { getToken } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [rideInfo, setRideInfo] = useState<Ride | null>(null)
  const [proposalInfo, setProposalInfo] = useState<ProposalInfo | null>(null)
  const [proposedPrice, setProposedPrice] = useState('')
  const [submittingProposal, setSubmittingProposal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get contact info from URL params
  const contactId = searchParams.get('contactId')
  const driverId = searchParams.get('driverId')

  // Refs para mantener los callbacks sin re-renders
  const userRef = useRef(user)
  const getTokenRef = useRef(getToken)
  const rideIdRef = useRef(rideId)
  const contactIdRef = useRef(contactId)
  const driverIdRef = useRef(driverId)

  // Actualizar refs cuando cambian
  useEffect(() => {
    userRef.current = user
    getTokenRef.current = getToken
    rideIdRef.current = rideId
    contactIdRef.current = contactId
    driverIdRef.current = driverId
  }, [user, getToken, rideId, contactId, driverId])

  // Cargar rol del usuario y info del ride
  useEffect(() => {
    async function loadUserRoleAndRide() {
      if (!user) return
      try {
        const token = await getToken()

        // Cargar info del usuario
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          setUserRole(data.role)
        }

        // Cargar info del ride si tenemos rideId
        if (rideId) {
          const rideResponse = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/rides/${rideId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (rideResponse.ok) {
            const rideData = await rideResponse.json()
            setRideInfo(rideData)
          }

          // Si somos cliente y tenemos driverId, cargar proposal info
          if (data.role === 'client' && driverId) {
            const contactResponse = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/rides/${rideId}/contacts`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (contactResponse.ok) {
              const contactsData = await contactResponse.json()
              const driverContact = contactsData.data?.find((c: any) => c.driverId === driverId)
              if (driverContact) {
                setProposalInfo({
                  driverId: driverContact.driverId,
                  proposedPrice: driverContact.proposedPrice,
                  proposalCount: driverContact.proposalCount || 0,
                  remainingProposals: 3 - (driverContact.proposalCount || 0),
                  canProposeMore: (driverContact.proposalCount || 0) < 3,
                  status: driverContact.proposedPrice ? 'pending' : undefined
                })
              }
            }
          }
        }
      } catch (err) {
        console.error('Error loading data:', err)
      }
    }
    loadUserRoleAndRide()
  }, [user, getToken, rideId, driverId])

  // Función para manejar nuevos mensajes y eventos de propuesta
  const handleNewMessage = useCallback((data: any) => {
    if (data.type === 'new_message' && data.data) {
      const message = data.data

      // Ignorar mensajes duplicados usando función update para evitar stale closure
      setMessages(prev => {
        if (prev.some(msg => msg._id === message._id)) return prev
        return [...prev, message]
      })

      // Marcar como leído
      const token = getTokenRef.current()
      const currentUserId = userRef.current?.id
      const currentRideId = rideIdRef.current

      if (token && currentUserId && currentRideId) {
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/messages/ride/${currentRideId}/read`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: currentUserId }),
        }).catch(err => console.error('Error marking as read:', err))
      }
    }

    // Handle price proposed event
    if (data.type === 'price_proposed' && data.data) {
      const proposalData = data.data
      setProposalInfo({
        driverId: proposalData.driverId,
        proposedPrice: proposalData.proposedPrice,
        proposalCount: proposalData.proposalCount,
        remainingProposals: proposalData.remainingProposals,
        canProposeMore: proposalData.remainingProposals > 0,
        status: 'pending'
      })
    }

    // Handle price accepted event
    if (data.type === 'price_accepted' && data.data) {
      const acceptedData = data.data
      setProposalInfo(prev => prev ? {
        ...prev,
        status: 'accepted'
      } : null)
      setRideInfo(prev => prev ? {
        ...prev,
        status: 'accepted',
        driverId: acceptedData.driverId,
        finalPrice: acceptedData.finalPrice
      } : null)
    }

    // Handle price rejected event
    if (data.type === 'price_rejected' && data.data) {
      const rejectedData = data.data
      setProposalInfo(prev => prev ? {
        ...prev,
        proposedPrice: undefined,
        status: 'rejected',
        canProposeMore: rejectedData.canProposeMore
      } : null)
    }

    // Handle auth success
    if (data.type === 'auth_success') {
      console.log('WebSocket authenticated successfully')
      setIsConnected(true)
    }
  }, [])

  const handleWsError = useCallback((err: any) => {
    console.error('WebSocket error:', err)
    setIsConnected(false)
  }, [])

  // Monitor connection state
  useEffect(() => {
    const state = wsService.getState()
    setIsConnected(state.isConnected && state.rideId === rideId)

    const interval = setInterval(() => {
      const currentState = wsService.getState()
      setIsConnected(currentState.isConnected && currentState.rideId === rideId)
    }, 2000)

    return () => clearInterval(interval)
  }, [rideId])

  useEffect(() => {
    async function initChat() {
      const currentRideId = rideIdRef.current
      const currentUser = userRef.current
      const token = await getTokenRef.current()

      if (!currentRideId || !currentUser || !token) {
        setLoading(false)
        return
      }

      // Si el usuario es CLIENTE y el ride está en 'requested', necesita contactId y driverId
      // Si el ride está en 'accepted', 'in_progress' o 'completed', puede entrar libremente
      // Si es DRIVER, puede entrar directamente
      if (userRole === 'client') {
        // Primero cargar info del ride para saber su estado
        const rideResponse = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/rides/${currentRideId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!rideResponse.ok) {
          setError('No se pudo cargar la información del pedido')
          setLoading(false)
          return
        }
        const rideData = await rideResponse.json()
        setRideInfo(rideData)

        // Si está en 'requested', necesita contactId y driverId
        // Si está en otros estados, puede entrar libremente
        if (rideData.status === 'requested') {
          if (!contactIdRef.current || !driverIdRef.current) {
            setError('No se ha seleccionado un conductor para chatear')
            setLoading(false)
            return
          }
        }
        // Para 'accepted', 'in_progress', 'completed' puede entrar sin contactId
      }

      try {
        // Cargar mensajes iniciales
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/messages/ride/${currentRideId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        })
        const data = await response.json()
        setMessages(data.data || [])
        setLoading(false)

        // Conectar WebSocket
        const unsubscribeMessage = wsService.onMessage(handleNewMessage)
        const unsubscribeError = wsService.onError(handleWsError)
        wsService.connect(currentRideId, token)

        return () => {
          unsubscribeMessage()
          unsubscribeError()
          wsService.disconnect()
        }
      } catch (err: any) {
        setError(err.message || 'Error loading chat')
        setLoading(false)
      }
    }

    initChat()
  }, [rideId, userRole])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Proponer precio (driver)
  async function handleProposePrice(e: React.FormEvent) {
    e.preventDefault()
    if (!proposedPrice || !user || !rideId || !userRole) return

    const price = parseFloat(proposedPrice)
    if (isNaN(price) || price <= 0) {
      alert('Ingresa un precio válido')
      return
    }

    setSubmittingProposal(true)
    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/messages/propose-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rideId, proposedPrice: price })
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Error al proponer precio')
        return
      }

      setProposedPrice('')
      setProposalInfo({
        driverId: user.id,
        proposedPrice: price,
        proposalCount: data.proposalCount,
        remainingProposals: data.remainingProposals,
        canProposeMore: data.remainingProposals > 0,
        status: 'pending'
      })
    } catch (err) {
      console.error('Error proposing price:', err)
      alert('Error al proponer precio')
    } finally {
      setSubmittingProposal(false)
    }
  }

  // Aceptar precio (cliente)
  async function handleAcceptPrice() {
    if (!user || !rideId || !driverId || !userRole) return

    if (!confirm('¿Aceptas este precio y contratas al conductor?')) return

    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/messages/accept-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rideId, driverId })
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Error al aceptar precio')
        return
      }

      setProposalInfo(prev => prev ? { ...prev, status: 'accepted' } : null)
      setRideInfo(data.ride)
      alert('¡Precio aceptado! El contrato ha iniciado.')
    } catch (err) {
      console.error('Error accepting price:', err)
      alert('Error al aceptar precio')
    }
  }

  // Rechazar precio (cliente)
  async function handleRejectPrice() {
    if (!user || !rideId || !driverId || !userRole) return

    if (!confirm('¿Rechazas este precio?')) return

    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/messages/reject-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rideId, driverId })
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Error al rechazar precio')
        return
      }

      setProposalInfo(prev => prev ? {
        ...prev,
        proposedPrice: undefined,
        status: 'rejected',
        canProposeMore: data.canProposeMore
      } : null)
    } catch (err) {
      console.error('Error rejecting price:', err)
      alert('Error al rechazar precio')
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !user || !rideId) return

    try {
      const token = await getToken()
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
      }

      const body: any = {
        rideId,
        senderId: user.id,
        content: newMessage,
      }

      if (userRole === 'client' && contactIdRef.current && driverIdRef.current) {
        body.contactId = contactIdRef.current
        body.driverId = driverIdRef.current
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error sending message')
      }

      setNewMessage('')
    } catch (error: any) {
      console.error('Error sending message:', error)
      setError(error.message || 'Error sending message')
    }
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function isSystemMessage(senderId: string) {
    return senderId === 'system'
  }

  if (loading) return <div>Cargando chat...</div>

  if (error) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', padding: '2rem' }}>
        <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: 'var(--error)' }}>
          error
        </span>
        <p style={{ marginTop: '1rem', color: 'var(--error)' }}>{error}</p>
        <button
          className="btn btn-outline"
          onClick={() => navigate(userRole === 'driver' ? '/driver' : '/my-rides')}
          style={{ marginTop: '1rem' }}
        >
          {userRole === 'driver' ? 'Volver al Panel' : 'Volver a Mis Pedidos'}
        </button>
      </div>
    )
  }

  const isDriver = userRole === 'driver'
  const isClient = userRole === 'client'
  const isRequested = rideInfo?.status === 'requested'
  const isAccepted = rideInfo?.status === 'accepted'
  const canChat = isRequested || isAccepted || rideInfo?.status === 'in_progress' || rideInfo?.status === 'completed'

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => navigate(isDriver ? '/driver' : '/my-rides')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
            }}
          >
            <span className="material-symbols-rounded">arrow_back</span>
            Volver
          </button>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.25rem 0.75rem',
          borderRadius: '999px',
          background: isConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: isConnected ? 'var(--success)' : 'var(--error)',
          fontSize: '0.875rem'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? 'var(--success)' : 'var(--error)'
          }} />
          {isConnected ? 'Conectado' : 'Desconectado'}
        </div>
      </div>

      {/* Ride Info Card (para driver) */}
      {isDriver && rideInfo && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          marginBottom: '1rem',
          border: '1px solid var(--border)'
        }}>
          <h3 style={{ marginBottom: '0.5rem' }}>{rideInfo.title}</h3>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <p><strong>Desde:</strong> {rideInfo.pickupLocation?.address}</p>
            <p><strong>Hasta:</strong> {rideInfo.dropoffLocation?.address}</p>
            <p><strong>Precio estimado:</strong> ${rideInfo.estimatedPrice}</p>
          </div>
        </div>
      )}

      {/* Proposal Section */}
      {canChat && isRequested && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          marginBottom: '1rem',
          border: '1px solid var(--border)'
        }}>
          {isDriver && (
            <>
              {/* Panel del Driver - Proponer precio */}
              {proposalInfo?.status === 'pending' ? (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    💰 Precio propuesto: ${proposalInfo.proposedPrice}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Esperando respuesta del cliente...
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Propuestas restantes: {proposalInfo.remainingProposals}
                  </p>
                </div>
              ) : proposalInfo?.status === 'accepted' ? (
                <div style={{ textAlign: 'center', color: 'var(--success)' }}>
                  <p style={{ fontWeight: 600 }}>✅ ¡Precio aceptado! El contrato está activo.</p>
                </div>
              ) : proposalInfo?.status === 'rejected' && !proposalInfo.canProposeMore ? (
                <div style={{ textAlign: 'center', color: 'var(--error)' }}>
                  <p style={{ fontWeight: 600 }}>❌ Precio rechazado.</p>
                  <p style={{ fontSize: '0.9rem' }}>Has alcanzado el máximo de propuestas.</p>
                </div>
              ) : proposalInfo?.status === 'rejected' ? (
                <div>
                  <p style={{ color: 'var(--warning)', textAlign: 'center', marginBottom: '0.5rem' }}>
                    ❌ Precio rechazado. Puedes enviar otra propuesta.
                  </p>
                  <form onSubmit={handleProposePrice} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="number"
                      className="input"
                      placeholder="Tu precio..."
                      value={proposedPrice}
                      onChange={(e) => setProposedPrice(e.target.value)}
                      style={{ flex: 1 }}
                      disabled={submittingProposal}
                    />
                    <button type="submit" className="btn btn-primary" disabled={submittingProposal}>
                      {submittingProposal ? 'Enviando...' : 'Proponer'}
                    </button>
                  </form>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
                    Propuestas restantes: {proposalInfo?.remainingProposals || 3}
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>💰 ¿Quieres proponer un precio?</p>
                  <form onSubmit={handleProposePrice} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="number"
                      className="input"
                      placeholder="Tu precio..."
                      value={proposedPrice}
                      onChange={(e) => setProposedPrice(e.target.value)}
                      style={{ flex: 1 }}
                      disabled={submittingProposal}
                    />
                    <button type="submit" className="btn btn-primary" disabled={submittingProposal}>
                      {submittingProposal ? 'Enviando...' : 'Proponer'}
                    </button>
                  </form>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
                    Máximo 3 propuestas
                  </p>
                </div>
              )}
            </>
          )}

          {isClient && proposalInfo && proposalInfo.proposedPrice && (
            <>
              {/* Panel del Cliente - Aceptar/Rechazar precio */}
              {proposalInfo.status === 'pending' && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)' }}>
                      💰 Propuesta de precio: ${proposalInfo.proposedPrice}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      El conductor ha propuesto este precio para el servicio.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button onClick={handleRejectPrice} className="btn btn-outline" style={{ background: 'var(--error)', color: 'white', borderColor: 'var(--error)' }}>
                      Rechazar
                    </button>
                    <button onClick={handleAcceptPrice} className="btn btn-primary">
                      Aceptar Precio
                    </button>
                  </div>
                </div>
              )}
              {proposalInfo.status === 'accepted' && (
                <div style={{ textAlign: 'center', color: 'var(--success)' }}>
                  <p style={{ fontWeight: 600 }}>✅ ¡Precio aceptado! El contrato está activo.</p>
                </div>
              )}
              {proposalInfo.status === 'rejected' && (
                <div style={{ textAlign: 'center', color: 'var(--warning)' }}>
                  <p>❌ Has rechazado esta propuesta.</p>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    El conductor puede enviar una nueva propuesta.
                  </p>
                </div>
              )}
            </>
          )}

          {isClient && (!proposalInfo || !proposalInfo.proposedPrice) && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Espera la propuesta de precio del conductor para contratarlo...
            </p>
          )}
        </div>
      )}

      {/* Accepted Status */}
      {canChat && isAccepted && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          marginBottom: '1rem',
          border: '1px solid var(--success)',
          textAlign: 'center'
        }}>
          <p style={{ color: 'var(--success)', fontWeight: 600 }}>
            ✅ Contrato activo - Precio: ${rideInfo?.finalPrice}
          </p>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          height: '400px',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {messages.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-rounded">chat_bubble</span>
            {isDriver ? 'Envía un mensaje al cliente para iniciar contacto!' : 'No hay mensajes aún.'}
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg._id}
              style={{
                display: 'flex',
                justifyContent: isSystemMessage(msg.senderId) ? 'center' : (msg.senderId === user?.id ? 'flex-end' : 'flex-start'),
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius)',
                  background: isSystemMessage(msg.senderId)
                    ? 'var(--bg-tertiary)'
                    : (msg.senderId === user?.id ? 'var(--primary)' : 'var(--bg-tertiary)'),
                  color: isSystemMessage(msg.senderId) ? 'var(--text-secondary)' : (msg.senderId === user?.id ? 'white' : 'var(--text-primary)'),
                  fontStyle: isSystemMessage(msg.senderId) ? 'italic' : 'normal',
                  textAlign: isSystemMessage(msg.senderId) ? 'center' : 'left',
                }}
              >
                <p>{msg.content}</p>
                <p
                  style={{
                    fontSize: '0.75rem',
                    marginTop: '0.25rem',
                    opacity: 0.7,
                  }}
                >
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - solo si puede chatear */}
      {canChat ? (
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            className="input"
            placeholder={isDriver ? 'Envía un mensaje al cliente...' : 'Escribe un mensaje...'}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={!isConnected}>
            Enviar
          </button>
        </form>
      ) : (
        <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', color: 'var(--text-muted)' }}>
          Chat no disponible en este estado del pedido.
        </div>
      )}
    </div>
  )
}

export default Chat