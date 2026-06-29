import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { wsService } from '../services/api'
import { showConfirm, showError, showSuccess, showWarning } from '../services/alerts'
import type { UserRole, Ride } from '../types'
import { StatusBadge } from '../components/StatusBadge'
import DriverProfilePopup from '../components/DriverProfilePopup'
import { usersAPI } from '../services/api'

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
  const [chatDriverUser, setChatDriverUser] = useState<any>(null)
  const [chatDriverProfile, setChatDriverProfile] = useState<any>(null)
  const [driverPopupPos, setDriverPopupPos] = useState<{ x: number; y: number } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const contactId = searchParams.get('contactId')
  const driverId = searchParams.get('driverId')

  const userRef = useRef(user)
  const getTokenRef = useRef(getToken)
  const rideIdRef = useRef(rideId)
  const contactIdRef = useRef(contactId)
  const driverIdRef = useRef(driverId)

  useEffect(() => {
    userRef.current = user
    getTokenRef.current = getToken
    rideIdRef.current = rideId
    contactIdRef.current = contactId
    driverIdRef.current = driverId
  }, [user, getToken, rideId, contactId, driverId])

  useEffect(() => {
    async function loadUserRoleAndRide() {
      if (!user) return
      try {
        const token = await getToken()

        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          setUserRole(data.role)

          if (rideId) {
            const rideResponse = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/rides/${rideId}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (rideResponse.ok) {
              const rideData = await rideResponse.json()
              setRideInfo(rideData)

            // Load driver user data for client
            if (rideData.driverId && data.role === 'client' && token) {
              try {
                const [dUser, dProfile] = await Promise.all([
                  usersAPI.get(rideData.driverId, token),
                  usersAPI.getDriver(rideData.driverId, token).catch(() => null),
                ])
                setChatDriverUser(dUser)
                setChatDriverProfile(dProfile)
              } catch (err) {
                console.error('Error loading driver data:', err)
              }
            }
            }

            // Cargar propuestas desde contacts para ambos roles
            const contactId = data.role === 'client' ? driverId : user.id
            if (contactId) {
              const contactResponse = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/rides/${rideId}/contacts`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (contactResponse.ok) {
                const contactsData = await contactResponse.json()
                // Cliente busca por driverId, driver busca su propio contacto
                const driverContact = contactsData.data?.find(
                  (c: any) => data.role === 'client' ? c.driverId === driverId : c.driverId === user.id
                )
                if (driverContact && driverContact.proposedPrice) {
                  setProposalInfo({
                    driverId: driverContact.driverId,
                    proposedPrice: driverContact.proposedPrice,
                    proposalCount: driverContact.proposalCount || 0,
                    remainingProposals: 3 - (driverContact.proposalCount || 0),
                    canProposeMore: (driverContact.proposalCount || 0) < 3,
                    status: 'pending'
                  })
                }
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

  const handleNewMessage = useCallback((data: any) => {
    if (data.type === 'new_message' && data.data) {
      const message = data.data

      setMessages(prev => {
        if (prev.some(msg => msg._id === message._id)) return prev
        return [...prev, message]
      })

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

    if (data.type === 'price_accepted' && data.data) {
      const acceptedData = data.data
      setProposalInfo(prev => prev ? { ...prev, status: 'accepted' } : null)
      setRideInfo(prev => prev ? {
        ...prev,
        status: 'accepted',
        driverId: acceptedData.driverId,
        finalPrice: acceptedData.finalPrice
      } : null)
    }

    if (data.type === 'price_rejected' && data.data) {
      const rejectedData = data.data
      setProposalInfo(prev => prev ? {
        ...prev,
        proposedPrice: undefined,
        status: 'rejected',
        canProposeMore: rejectedData.canProposeMore
      } : null)
    }

    if (data.type === 'auth_success') {
      console.log('WebSocket authenticated successfully')
      setIsConnected(true)
    }
  }, [])

  const handleWsError = useCallback((err: any) => {
    console.error('WebSocket error:', err)
    setIsConnected(false)
  }, [])

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

      if (userRole === 'client') {
        const rideResponse = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/rides/${currentRideId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!rideResponse.ok) {
          setError('No se pudo cargar la informacion del pedido')
          setLoading(false)
          return
        }
        const rideData = await rideResponse.json()
        setRideInfo(rideData)

        if (rideData.status === 'requested') {
          if (!contactIdRef.current || !driverIdRef.current) {
            setError('No se ha seleccionado un conductor para chatear')
            setLoading(false)
            return
          }
        }
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/messages/ride/${currentRideId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        })
        const data = await response.json()
        const messageList: Message[] = data.data || []
        setMessages(messageList)
        setLoading(false)

        // Detectar estado de propuesta desde mensajes del sistema (solo driver)
        if (!proposalInfo && userRole === 'driver' && currentUser && currentRideId) {
          for (let i = messageList.length - 1; i >= 0; i--) {
            const msg = messageList[i]
            if (msg.senderId !== 'system') continue

            if (msg.content.startsWith('💰 Propuesta de precio:')) {
              const priceMatch = msg.content.match(/\$([\d.]+)/)
              const proposedPrice = priceMatch ? parseFloat(priceMatch[1]) : undefined
              setProposalInfo({
                driverId: currentUser.id,
                proposedPrice,
                proposalCount: 1,
                remainingProposals: 2,
                canProposeMore: true,
                status: 'pending'
              })
              break
            }
            if (msg.content.includes('Precio rechazado')) {
              // Buscar el contacto del driver para obtener el proposalCount actual
              const contactResp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/rides/${currentRideId}/contacts`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              const contactsData = await contactResp.json()
              const myContact = contactsData.data?.find(
                (c: any) => c.driverId === currentUser.id
              )
              const count = myContact?.proposalCount || 1
              setProposalInfo({
                driverId: currentUser.id,
                proposalCount: count,
                remainingProposals: 3 - count,
                canProposeMore: count < 3,
                status: 'rejected'
              })
              break
            }
          }
        }

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

  async function handleProposePrice(e: React.FormEvent) {
    e.preventDefault()
    if (!proposedPrice || !user || !rideId || !userRole) return

    const price = parseFloat(proposedPrice)
    if (isNaN(price) || price <= 0) {
      await showWarning('Ingresa un precio valido')
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
        await showError(data.error || 'Error al proponer precio')
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
      await showError('Error al proponer precio')
    } finally {
      setSubmittingProposal(false)
    }
  }

  async function handleAcceptPrice() {
    if (!user || !rideId || !driverId || !userRole) return

    const accepted = await showConfirm({
      title: 'Confirmar precio',
      text: '¿Aceptas este precio y contratas al conductor?'
    })

    if (!accepted) return

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
        await showError(data.error || 'Error al aceptar precio')
        return
      }

      setProposalInfo(prev => prev ? { ...prev, status: 'accepted' } : null)
      setRideInfo(data.ride)
      await showSuccess('¡Precio aceptado! El contrato ha iniciado.')
    } catch (err) {
      console.error('Error accepting price:', err)
      await showError('Error al aceptar precio')
    }
  }

  async function handleRejectPrice() {
    if (!user || !rideId || !driverId || !userRole) return

    const rejected = await showConfirm({
      title: 'Rechazar precio',
      text: '¿Rechazas este precio?'
    })

    if (!rejected) return

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
        await showError(data.error || 'Error al rechazar precio')
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
      await showError('Error al rechazar precio')
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

  function formatRelativeTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Ahora'
    if (diffMins < 60) return `hace ${diffMins}m`
    if (diffHours < 24) return `hace ${diffHours}h`
    if (diffDays < 7) return `hace ${diffDays}d`
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  function isSystemMessage(senderId: string) {
    return senderId === 'system'
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          padding: 'var(--space-6)',
        }}>
          <div className="skeleton" style={{ height: '60px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '60px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--space-8) 0', textAlign: 'center' }}>
        <div
          className="card"
          style={{
            animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '4rem', color: 'var(--error)', marginBottom: 'var(--space-4)' }}>
            error
          </span>
          <p style={{ color: 'var(--error)', marginBottom: 'var(--space-5)' }}>{error}</p>
          <button
            className="btn btn-outline"
            onClick={() => navigate(userRole === 'driver' ? '/driver' : '/my-rides')}
          >
            <span className="material-symbols-rounded">arrow_back</span>
            {userRole === 'driver' ? 'Volver al Panel' : 'Volver a Mis Pedidos'}
          </button>
        </div>
      </div>
    )
  }

  const isDriver = userRole === 'driver'
  const isClient = userRole === 'client'
  const isRequested = rideInfo?.status === 'requested'
  const isAccepted = rideInfo?.status === 'accepted'
  const canChat = isRequested || isAccepted || rideInfo?.status === 'in_progress' || rideInfo?.status === 'completed'

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-4)',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
      }}>
        <button
          onClick={() => navigate(isDriver ? '/driver' : '/my-rides')}
          className="btn btn-ghost"
          style={{ color: 'var(--text-muted)' }}
        >
          <span className="material-symbols-rounded">arrow_back</span>
          Volver
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-4)',
          borderRadius: 'var(--radius-full)',
          background: isConnected ? 'var(--success-subtle)' : 'var(--error-subtle)',
          color: isConnected ? 'var(--success)' : 'var(--error)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-medium)',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? 'var(--success)' : 'var(--error)',
            animation: isConnected ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
          {isConnected ? 'Conectado' : 'Desconectado'}
        </div>
      </div>

      {/* Ride Info Card for Driver */}
      {isDriver && rideInfo && (
        <div
          className="card"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-4)',
            background: 'linear-gradient(135deg, var(--primary-subtle) 0%, var(--surface-1) 100%)',
            border: '1px solid var(--border-accent)',
            animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>local_shipping</span>
                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--font-semibold)',
                  margin: 0,
                }}>
                  {rideInfo.title}
                </h3>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--success)' }}>circle</span>
                  <span className="truncate">{rideInfo.pickupLocation?.address}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--error)' }}>location_on</span>
                  <span className="truncate">{rideInfo.dropoffLocation?.address}</span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <StatusBadge status={rideInfo.status} size="sm" />
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xl)',
                fontWeight: 'var(--font-bold)',
                color: 'var(--secondary)',
                marginTop: 'var(--space-2)',
              }}>
                ${rideInfo.estimatedPrice}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client side - Driver info card */}
      {isClient && chatDriverUser && (
        <div
          className="card"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
          }}
        >
          {/* Driver avatar - clickable */}
          {chatDriverUser.imageUrl ? (
            <img
              src={chatDriverUser.imageUrl}
              alt={chatDriverUser.firstName}
              onClick={(e) => setDriverPopupPos({ x: e.clientX, y: e.clientY })}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--primary-subtle)',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            />
          ) : (
            <div
              onClick={(e) => setDriverPopupPos({ x: e.clientX, y: e.clientY })}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-bold)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {chatDriverUser.firstName?.charAt(0) || 'C'}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {chatDriverUser.firstName} {chatDriverUser.lastName}
            </div>
            {chatDriverProfile && (
              <div style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>star</span>
                {chatDriverProfile.rating} ({chatDriverProfile.totalRides} viajes)
              </div>
            )}
          </div>
          <button
            onClick={(e) => setDriverPopupPos({ x: e.clientX, y: e.clientY })}
            className="btn btn-ghost"
            style={{ padding: 'var(--space-2)', color: 'var(--text-muted)', flexShrink: 0 }}
            title="Ver perfil del conductor"
          >
            <span className="material-symbols-rounded">person</span>
          </button>
        </div>
      )}

      {/* Proposal Section */}
      {canChat && isRequested && (
        <div
          className="card"
          style={{
            marginBottom: 'var(--space-4)',
            animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
            animationDelay: '50ms',
            animationFillMode: 'both',
          }}
        >
          {isDriver && (
            <div>
              {proposalInfo?.status === 'pending' ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'var(--primary-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--space-4)',
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '2rem', color: 'var(--primary)' }}>payments</span>
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-bold)',
                    color: 'var(--primary)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    Precio propuesto: ${proposalInfo.proposedPrice}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    Esperando respuesta del cliente...
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
                    Propuestas restantes: {proposalInfo.remainingProposals}
                  </p>
                </div>
              ) : proposalInfo?.status === 'accepted' ? (
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-5)',
                  background: 'var(--success-subtle)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--success)',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>check_circle</span>
                  <p style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-lg)' }}>¡Precio aceptado!</p>
                  <p style={{ fontSize: 'var(--text-sm)' }}>El contrato esta activo.</p>
                </div>
              ) : proposalInfo?.status === 'rejected' && !proposalInfo.canProposeMore ? (
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-5)',
                  background: 'var(--error-subtle)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--error)',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>cancel</span>
                  <p style={{ fontWeight: 'var(--font-bold)' }}>Precio rechazado</p>
                  <p style={{ fontSize: 'var(--text-sm)' }}>Has alcanzado el maximo de propuestas.</p>
                </div>
              ) : proposalInfo?.status === 'rejected' ? (
                <div>
                  <div style={{
                    textAlign: 'center',
                    marginBottom: 'var(--space-4)',
                    color: 'var(--warning)',
                  }}>
                    <p style={{ fontWeight: 'var(--font-semibold)' }}>Precio rechazado</p>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                      Puedes enviar otra propuesta.
                    </p>
                  </div>
                  <form onSubmit={handleProposePrice} style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
                      <span style={{
                        position: 'absolute',
                        left: 'var(--space-4)',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}>$</span>
                      <input
                        type="number"
                        className="input"
                        placeholder="Tu precio..."
                        value={proposedPrice}
                        onChange={(e) => setProposedPrice(e.target.value)}
                        style={{ paddingLeft: 'var(--space-8)', fontFamily: 'var(--font-mono)' }}
                        disabled={submittingProposal}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={submittingProposal}>
                      {submittingProposal ? (
                        <div className="spinner" style={{ width: '18px', height: '18px' }} />
                      ) : (
                        <span className="material-symbols-rounded">send</span>
                      )}
                      Proponer
                    </button>
                  </form>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
                    Maximo 3 propuestas | Restantes: {proposalInfo?.remainingProposals || 3}
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-4)',
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'var(--warning-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span className="material-symbols-rounded" style={{ color: 'var(--warning)' }}>payments</span>
                    </div>
                    <div>
                      <p style={{ fontWeight: 'var(--font-semibold)', margin: 0 }}>¿Quieres proponer un precio?</p>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>El cliente recibira tu propuesta.</p>
                    </div>
                  </div>
                  <form onSubmit={handleProposePrice} style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
                      <span style={{
                        position: 'absolute',
                        left: 'var(--space-4)',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}>$</span>
                      <input
                        type="number"
                        className="input"
                        placeholder="Tu precio..."
                        value={proposedPrice}
                        onChange={(e) => setProposedPrice(e.target.value)}
                        style={{ paddingLeft: 'var(--space-8)', fontFamily: 'var(--font-mono)' }}
                        disabled={submittingProposal}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={submittingProposal}>
                      {submittingProposal ? (
                        <div className="spinner" style={{ width: '18px', height: '18px' }} />
                      ) : (
                        <span className="material-symbols-rounded">send</span>
                      )}
                      Proponer
                    </button>
                  </form>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
                    Maximo 3 propuestas
                  </p>
                </div>
              )}
            </div>
          )}

          {isClient && proposalInfo && proposalInfo.proposedPrice && (
            <div>
              {proposalInfo.status === 'pending' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'var(--primary-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--space-4)',
                    boxShadow: '0 0 24px var(--primary-glow)',
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>payments</span>
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 'var(--font-bold)',
                    color: 'var(--primary)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    ${proposalInfo.proposedPrice}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)' }}>
                    El conductor ha propuesto este precio para el servicio.
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
                    <button onClick={handleRejectPrice} className="btn btn-outline" style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
                      <span className="material-symbols-rounded">close</span>
                      Rechazar
                    </button>
                    <button onClick={handleAcceptPrice} className="btn btn-primary">
                      <span className="material-symbols-rounded">check</span>
                      Aceptar Precio
                    </button>
                  </div>
                </div>
              )}
              {proposalInfo.status === 'accepted' && (
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-5)',
                  background: 'var(--success-subtle)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--success)',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>check_circle</span>
                  <p style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-lg)' }}>¡Precio aceptado!</p>
                  <p style={{ fontSize: 'var(--text-sm)' }}>El contrato esta activo.</p>
                </div>
              )}
              {proposalInfo.status === 'rejected' && (
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-4)',
                  background: 'var(--warning-subtle)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--warning)',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>cancel</span>
                  <p style={{ fontWeight: 'var(--font-semibold)' }}>Has rechazado esta propuesta.</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    El conductor puede enviar una nueva propuesta.
                  </p>
                </div>
              )}
            </div>
          )}

          {isClient && (!proposalInfo || !proposalInfo.proposedPrice) && (
            <div style={{
              textAlign: 'center',
              padding: 'var(--space-5)',
              color: 'var(--text-muted)',
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>hourglass_empty</span>
              <p>Espera la propuesta de precio del conductor para contratarlo...</p>
            </div>
          )}
        </div>
      )}

      {/* Accepted Status Banner */}
      {canChat && isAccepted && (
        <div style={{
          background: 'var(--success-subtle)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
        }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--success)', fontSize: '1.5rem' }}>check_circle</span>
          <span style={{ color: 'var(--success)', fontWeight: 'var(--font-semibold)' }}>
            Contrato activo - Precio: ${rideInfo?.finalPrice}
          </span>
        </div>
      )}

      {/* Messages Container */}
      <div
        style={{
          height: 'min(450px, 50vh)',
          maxHeight: '50vh',
          overflowY: 'auto',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
          background: 'var(--surface-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            gap: 'var(--space-3)',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: '3rem', opacity: 0.5 }}>chat_bubble</span>
            <p style={{ fontSize: 'var(--text-sm)' }}>
              {isDriver ? 'Envía un mensaje al cliente para iniciar contacto!' : 'No hay mensajes aun. Inicia la conversacion!'}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.senderId === user?.id
            const isSystem = isSystemMessage(msg.senderId)

            return (
              <div
                key={msg._id}
                style={{
                  display: 'flex',
                  justifyContent: isSystem ? 'center' : (isOwn ? 'flex-end' : 'flex-start'),
                  animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
                  animationDelay: `${Math.min(index * 30, 300)}ms`,
                  animationFillMode: 'both',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: isSystem ? 'var(--radius)' : (isOwn ? 'var(--radius-lg) var(--radius-lg) 4px var(--radius-lg)' : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px'),
                    background: isSystem
                      ? 'var(--surface-2)'
                      : (isOwn ? 'var(--primary)' : 'var(--surface-2)'),
                    color: isSystem ? 'var(--text-secondary)' : (isOwn ? 'white' : 'var(--text-primary)'),
                    fontStyle: isSystem ? 'italic' : 'normal',
                    textAlign: isSystem ? 'center' : 'left',
                    boxShadow: isOwn ? 'var(--shadow-glow)' : 'none',
                    position: 'relative',
                  }}
                >
                  {!isSystem && !isOwn && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: '-8px',
                      width: 0,
                      height: 0,
                      borderTop: '8px solid var(--surface-2)',
                      borderRight: '8px solid transparent',
                    }} />
                  )}
                  <p style={{
                    margin: 0,
                    lineHeight: 1.5,
                    fontSize: 'var(--text-sm)',
                  }}>{msg.content}</p>
                  <p style={{
                    fontSize: 'var(--text-xs)',
                    marginTop: 'var(--space-1)',
                    opacity: 0.7,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {formatRelativeTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {canChat ? (
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <input
            type="text"
            className="input"
            placeholder={isDriver ? 'Escribe un mensaje al cliente...' : 'Escribe un mensaje...'}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary btn-lg" disabled={!isConnected}>
            <span className="material-symbols-rounded">send</span>
          </button>
        </form>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-5)',
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-muted)',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>chat_bubble_disabled</span>
          <p>Chat no disponible en este estado del pedido.</p>
        </div>
      )}

      {/* Driver Profile Popup */}
      {driverPopupPos && (
        <DriverProfilePopup
          driverUser={chatDriverUser}
          driver={chatDriverProfile}
          rideId={rideId}
          position={driverPopupPos}
          onClose={() => setDriverPopupPos(null)}
        />
      )}
    </div>
  )
}

export default Chat