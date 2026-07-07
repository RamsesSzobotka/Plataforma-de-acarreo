import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { userWsService, notificationsAPI } from '../services/api'

interface NotificationBadgeContextType {
  unreadCount: number
  refreshUnreadCount: () => Promise<void>
}

const NotificationBadgeContext = createContext<NotificationBadgeContextType | undefined>(undefined)

export function NotificationBadgeProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    if (!isSignedIn) return
    try {
      const token = await getToken()
      if (!token) return
      const data = await notificationsAPI.unreadCount(token)
      setUnreadCount(data.count)
    } catch { /* silent */ }
  }, [isSignedIn, getToken])

  // Connect WebSocket and listen for new notifications
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    let cancelled = false

    async function connectWs() {
      const token = await getToken()
      if (!token || cancelled) return
      userWsService.connect(token)
    }

    connectWs()

    const unsubscribe = userWsService.onMessage((data) => {
      if (data.type === 'new_notification') {
        setUnreadCount(prev => prev + 1)
      }
    })

    return () => {
      cancelled = true
      userWsService.disconnect()
      unsubscribe()
    }
  }, [isLoaded, isSignedIn, getToken])

  // Fetch on mount
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setUnreadCount(0)
      return
    }
    refreshUnreadCount()
  }, [isLoaded, isSignedIn, refreshUnreadCount])

  return (
    <NotificationBadgeContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationBadgeContext.Provider>
  )
}

export function useNotificationBadge() {
  const context = useContext(NotificationBadgeContext)
  if (!context) {
    throw new Error('useNotificationBadge must be used within NotificationBadgeProvider')
  }
  return context
}
