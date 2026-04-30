import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { wsService } from '../services/api'
import type { UserRole } from '../types'

interface Message {
  _id: string
  senderId: string
  content: string
  createdAt: string
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

  // Cargar rol del usuario
  useEffect(() => {
    async function loadUserRole() {
      if (!user) return
      try {
        const token = await getToken()
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          setUserRole(data.role)
        }
      } catch (err) {
        console.error('Error loading user role:', err)
      }
    }
    loadUserRole()
  }, [user, getToken])

  // Función para manejar nuevos mensajes
  const handleNewMessage = useCallback((data: any) => {
    if (data.type === 'new_message') {
      setMessages((prev) => {
        // Evitar duplicados
        if (prev.some(msg => msg._id === data.data._id)) {
          return prev
        }
        return [...prev, data.data]
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
    // Check initial state
    const state = wsService.getState()
    setIsConnected(state.isConnected && state.rideId === rideId)

    // Subscribe to connection updates via polling (simple approach)
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

      // Si el usuario es CLIENTE, necesita contactId y driverId
      // Si es DRIVER, puede entrar directamente
      if (userRole === 'client') {
        if (!contactIdRef.current || !driverIdRef.current) {
          setError('No se ha seleccionado un conductor para chatear')
          setLoading(false)
          return
        }
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

        // Conectar WebSocket - NO desconectar al unmount (el servicio es global)
        const unsubscribeMessage = wsService.onMessage(handleNewMessage)
        const unsubscribeError = wsService.onError(handleWsError)
        wsService.connect(currentRideId, token)

        // Cleanup: solo quitar callbacks, NO desconectar
        return () => {
          unsubscribeMessage()
          unsubscribeError()
          // Note: We don't call wsService.disconnect() because the service persists
          // across the entire app session. Only disconnect if explicitly needed.
        }
      } catch (err: any) {
        setError(err.message || 'Error loading chat')
        setLoading(false)
      }
    }

    initChat()
  }, [rideId, handleNewMessage, handleWsError, userRole])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

      // Si es cliente, enviar contactId y driverId
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

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header con estado de conexión y volver */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => navigate(userRole === 'driver' ? '/driver' : '/my-rides')}
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
            No hay mensajes. {userRole === 'driver' ? 'Envía el primero para iniciar contacto con el cliente!' : 'Escribe el primero!'}
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg._id}
              style={{
                display: 'flex',
                justifyContent: msg.senderId === user?.id ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius)',
                  background:
                    msg.senderId === user?.id
                      ? 'var(--primary)'
                      : 'var(--bg-tertiary)',
                  color: msg.senderId === user?.id ? 'white' : 'var(--text-primary)',
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

      {/* Input */}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          className="input"
          placeholder={userRole === 'driver' ? 'Envía un mensaje al cliente...' : 'Escribe un mensaje...'}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={!isConnected}>
          Enviar
        </button>
      </form>
    </div>
  )
}

export default Chat