import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'

interface Message {
  _id: string
  senderId: string
  senderName?: string
  content: string
  read: boolean
  createdAt: string
}

interface Ride {
  _id: string
  title: string
  estimatedPrice: number
  status: string
}

/**
 * Chat Page - Real-time messaging for ride negotiation
 *
 * Used during:
 * - 'negotiating' state: price discussion between driver and client
 * - 'accepted' state: pre-pickup coordination
 * - 'in_progress' state: delivery coordination
 *
 * Features:
 * - Message history with pagination
 * - Real-time updates (polling for Phase 1, WebSocket in Phase 2)
 * - Message timestamps
 * - Sender identification (blue for user, gray for other)
 * - Auto-scroll to latest message
 */
export const Chat: React.FC = () => {
  const { rideId } = useParams<{ rideId: string }>()
  const navigate = useNavigate()
  const { user, getToken } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ride, setRide] = useState<Ride | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize token
  useEffect(() => {
    const initToken = async () => {
      const t = await getToken()
      setToken(t)
    }
    initToken()
  }, [getToken])

  // Load ride info and messages
  useEffect(() => {
    if (rideId && token) {
      loadRide()
      loadMessages()
      // Poll for new messages every 5 seconds (Phase 1)
      const interval = setInterval(loadMessages, 5000)
      return () => clearInterval(interval)
    }
  }, [rideId, token])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadRide = async () => {
    try {
      const response = await fetch(`/api/rides/${rideId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (response.ok) {
        const data = await response.json()
        setRide(data.ride)
      }
    } catch (err) {
      console.error('Error loading ride:', err)
    }
  }

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/messages/ride/${rideId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(data.data || [])
        setError(null)
      }
    } catch (err) {
      console.error('Error loading messages:', err)
      setError('Error al cargar mensajes')
    } finally {
      if (loading) {
        setLoading(false)
      }
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || !user || !token) return

    setSending(true)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rideId,
          senderId: user.id,
          content: newMessage.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      setNewMessage('')
      await loadMessages()
    } catch (err) {
      console.error('Error sending message:', err)
      setError('Error al enviar mensaje')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      if (date.toDateString() === today.toDateString()) {
        return 'Hoy'
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Ayer'
      } else {
        return date.toLocaleDateString('es-ES')
      }
    } catch {
      return ''
    }
  }

  // Get back button destination based on ride status
  const getBackDestination = (): string => {
    if (!ride) return '/driver/dashboard'

    // If driver came from ride details
    if (ride.status === 'requested' || ride.status === 'negotiating') {
      return `/driver/rides/${rideId}`
    }

    // If coming from accepted rides
    return '/driver/dashboard'
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            className="material-symbols-rounded"
            style={{
              fontSize: '2rem',
              marginBottom: '1rem',
              animation: 'spin 2s linear infinite',
            }}
          >
            schedule
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Cargando chat...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)',
          padding: '1rem',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 700,
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)',
              }}
            >
              {ride?.title || 'Chat'}
            </h1>
            {ride && (
              <p
                style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                Estado: {ride.status}
              </p>
            )}
          </div>

          <Link
            to={getBackDestination()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '1.2rem' }}>
              arrow_back
            </span>
            Volver
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main
        style={{
          maxWidth: '800px',
          width: '100%',
          margin: '0 auto',
          padding: '1rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Error banner */}
        {error && (
          <div
            style={{
              backgroundColor: '#FEE2E2',
              borderLeft: '4px solid var(--error)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1rem',
              color: '#7F1D1D',
              fontSize: '0.875rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>❌ {error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#7F1D1D',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Messages container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius)',
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow)',
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                flex: 1,
              }}
            >
              <span className="material-symbols-rounded">chat_bubble</span>
              <p style={{ margin: 0 }}>No hay mensajes. ¡Sé el primero en escribir!</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isOwn = msg.senderId === user?.id
                const showDate =
                  index === 0 ||
                  formatDate(messages[index - 1].createdAt) !== formatDate(msg.createdAt)

                return (
                  <div key={msg._id}>
                    {showDate && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          margin: '0.5rem 0',
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: '1px',
                            backgroundColor: 'var(--border)',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {formatDate(msg.createdAt)}
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: '1px',
                            backgroundColor: 'var(--border)',
                          }}
                        />
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '70%',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius)',
                          backgroundColor: isOwn ? 'var(--primary)' : 'var(--bg-secondary)',
                          color: isOwn ? 'white' : 'var(--text-primary)',
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 0.25rem 0',
                            wordWrap: 'break-word',
                            fontSize: '0.95rem',
                          }}
                        >
                          {msg.content}
                        </p>
                        <p
                          style={{
                            fontSize: '0.75rem',
                            margin: 0,
                            opacity: 0.7,
                          }}
                        >
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message input */}
        <form
          onSubmit={handleSendMessage}
          style={{
            display: 'flex',
            gap: '0.5rem',
            backgroundColor: 'var(--bg-primary)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <input
            type="text"
            placeholder="Escribe tu mensaje..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={sending}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              fontFamily: 'var(--font-body)',
              opacity: sending ? 0.5 : 1,
            }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor:
                !newMessage.trim() || sending ? 'var(--text-muted)' : 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: !newMessage.trim() || sending ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              if (newMessage.trim() && !sending) {
                e.currentTarget.style.backgroundColor = 'var(--primary-hover)'
              }
            }}
            onMouseLeave={(e) => {
              if (newMessage.trim() && !sending) {
                e.currentTarget.style.backgroundColor = 'var(--primary)'
              }
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '1.125rem' }}
            >
              {sending ? 'schedule' : 'send'}
            </span>
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </main>
    </div>
  )
}

export default Chat
