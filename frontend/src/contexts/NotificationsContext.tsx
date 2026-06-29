import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { wsService } from '../services/api'

interface UnreadCounts {
  [rideId: string]: number
}

interface NotificationsContextType {
  unreadCounts: UnreadCounts
  totalUnread: number
  getUnreadCount: (rideId: string) => number
  refreshUnreadCounts: () => Promise<void>
  clearUnreadCount: (rideId: string) => void
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken, userId } = useAuth()
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({})
  
  // Fetch unread counts from backend
  const refreshUnreadCounts = useCallback(async () => {
    if (!isSignedIn) return
    
    try {
      const token = await getToken()
      if (!token) return
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/messages/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setUnreadCounts(data.data || {})
      }
    } catch {
      // Silently handle fetch errors — polling will retry
    }
  }, [isSignedIn, getToken])
  
  // Handle new message from WebSocket - increment unread count
  useEffect(() => {
    if (!isSignedIn || !userId) return
    
    const unsubscribe = wsService.onMessage((data) => {
      if (data.type === 'new_message' && data.data) {
        const message = data.data
        // Solo contar mensajes de OTROS usuarios, no los propios
        if (message.senderId !== userId) {
          setUnreadCounts(prev => ({
            ...prev,
            [message.rideId]: (prev[message.rideId] || 0) + 1
          }))
        }
      }
    })
    
    return unsubscribe
  }, [isSignedIn, userId])
  
  // Fetch initial unread counts and poll every 5 seconds (for real-time-ish updates)
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setUnreadCounts({})
      return
    }

    // Initial fetch
    refreshUnreadCounts()

    // Poll for updates every 5 seconds
    const interval = setInterval(refreshUnreadCounts, 5000)

    // Also refresh when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUnreadCounts()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isLoaded, isSignedIn, refreshUnreadCounts])
  
  // Get unread count for a specific ride
  const getUnreadCount = useCallback((rideId: string) => {
    return unreadCounts[rideId] || 0
  }, [unreadCounts])
  
  // Clear unread count when user opens the chat
  const clearUnreadCount = useCallback((rideId: string) => {
    setUnreadCounts(prev => ({
      ...prev,
      [rideId]: 0
    }))
  }, [])
  
  // Calculate total unread
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)
  
  return (
    <NotificationsContext.Provider value={{
      unreadCounts,
      totalUnread,
      getUnreadCount,
      refreshUnreadCounts,
      clearUnreadCount
    }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return context
}