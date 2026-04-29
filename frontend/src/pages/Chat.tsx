import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { wsService } from '../services/api'

interface Message {
  _id: string
  senderId: string
  content: string
  createdAt: string
}

function Chat() {
  const { rideId } = useParams<{ rideId: string }>()
  const { user } = useUser()
  const { getToken } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Refs para mantener los callbacks sin re-renders
  const userRef = useRef(user)
  const getTokenRef = useRef(getToken)
  const rideIdRef = useRef(rideId)
  
  // Actualizar refs cuando cambian
  useEffect(() => {
    userRef.current = user
    getTokenRef.current = getToken
    rideIdRef.current = rideId
  }, [user, getToken, rideId])

  // Función para manejar nuevos mensajes (useCallback para stability)
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
  }, [])

  const handleWsError = useCallback((err: any) => {
    console.error('WebSocket error:', err)
    setIsConnected(false)
  }, [])

  useEffect(() => {
    async function initChat() {
      const currentRideId = rideIdRef.current
      const currentUser = userRef.current
      const token = await getTokenRef.current()
      
      if (!currentRideId || !currentUser || !token) {
        setLoading(false)
        return
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

        // Conectar WebSocket solo una vez al montar
        wsService.onMessage(handleNewMessage)
        wsService.onError(handleWsError)
        wsService.connect(currentRideId, token)
        setIsConnected(true)
      } catch (err: any) {
        setError(err.message || 'Error loading chat')
        setLoading(false)
      }
    }

    initChat()

    // Cleanup: desconectar y quitar callbacks
    return () => {
      wsService.offMessage(handleNewMessage)
      wsService.offError(handleWsError)
      wsService.disconnect()
      setIsConnected(false)
    }
  }, [rideId, handleNewMessage, handleWsError]) // Quitamos 'user' de las deps

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

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rideId,
          senderId: user.id,
          content: newMessage,
        }),
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

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1rem' }}>Chat</h2>

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
            No hay mensajes. Escribe el primero!
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
          placeholder="Escribe un mensaje..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary">
          Enviar
        </button>
      </form>
    </div>
  )
}

export default Chat