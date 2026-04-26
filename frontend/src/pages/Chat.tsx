import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'

interface Message {
  _id: string
  senderId: string
  content: string
  createdAt: string
}

function Chat() {
  const { rideId } = useParams<{ rideId: string }>()
  const { user } = useUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (rideId) {
      loadMessages()
      // Poll for new messages (simple approach)
      const interval = setInterval(loadMessages, 5000)
      return () => clearInterval(interval)
    }
  }, [rideId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    try {
      const response = await fetch(`/api/messages/ride/${rideId}`)
      const data = await response.json()
      setMessages(data.data || [])
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !user) return

    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId,
          senderId: user.id,
          content: newMessage,
        }),
      })
      setNewMessage('')
      loadMessages()
    } catch (error) {
      console.error('Error sending message:', error)
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
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay mensajes todavía. ¡Escribe el primero!
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