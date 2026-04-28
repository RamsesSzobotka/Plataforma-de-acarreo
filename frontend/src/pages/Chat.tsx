import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { messagesAPI } from '../services/api'

interface Message {
  _id: string
  senderId: string
  content: string
  read: boolean
  createdAt: string
}

function Chat() {
  const { rideId } = useParams<{ rideId: string }>()
  const { user } = useUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (rideId) {
      loadMessages()
      // Auto-refresh messages every 2 seconds (polling until WebSocket is implemented)
      const interval = setInterval(loadMessages, 2000)
      return () => clearInterval(interval)
    }
  }, [rideId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    try {
      if (!rideId) return
      const data = await messagesAPI.getByRide(rideId)
      setMessages(data)
      
      // Mark messages as read
      await messagesAPI.markAsRead(rideId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar mensajes'
      setError(message)
      console.error('Error loading messages:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || !rideId || !user) return

    setSending(true)
    setError('')
    try {
      const newMessage = await messagesAPI.send(rideId, content)
      setMessages([...messages, newMessage])
      setContent('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar mensaje'
      setError(message)
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        Cargando chat...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <Link to={`/ride/${rideId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-symbols-rounded">arrow_back</span>
          Volver al Pedido
        </Link>
        <h2 style={{ marginTop: '0.5rem' }}>
          <span className="material-symbols-rounded" style={{ display: 'inline-block', marginRight: '0.5rem' }}>chat</span>
          Chat
        </h2>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#991b1b',
          fontSize: '0.9rem',
        }}>
          {error}
        </div>
      )}

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>
              chat_bubble_outline
            </span>
            No hay mensajes aún. ¡Sé el primero en escribir!
          </div>
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
                  maxWidth: '60%',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius)',
                  background: msg.senderId === user?.id ? 'var(--primary)' : 'var(--bg-tertiary)',
                  color: msg.senderId === user?.id ? 'white' : 'var(--text-primary)',
                  wordBreak: 'break-word',
                }}
              >
                <p>{msg.content}</p>
                <small style={{ opacity: 0.7, display: 'block', marginTop: '0.25rem' }}>
                  {new Date(msg.createdAt).toLocaleTimeString('es-PA', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </small>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            className="input"
            placeholder="Escribe un mensaje..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={sending}
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || !content.trim()}
            style={{ whiteSpace: 'nowrap' }}
          >
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
</div>
  )
}

export default Chat
  )
}

export default Chat