import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Driver } from '../types'

interface DriverContextType {
  driver: Driver | null
  setDriver: (driver: Driver | null) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  error: string | null
  setError: (error: string | null) => void
  refreshDriver: (clerkId: string, token: string) => Promise<void>
}

const DriverContext = createContext<DriverContextType | undefined>(undefined)

/**
 * Provider for shared driver state across application
 * - Driver profile (verification status, vehicle info, location)
 * - Loading and error states
 * - Refresh function to sync from backend
 *
 * Usage in component:
 * ```tsx
 * const { driver, refreshDriver, isLoading } = useDriver()
 * ```
 */
export const DriverProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [driver, setDriver] = useState<Driver | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshDriver = useCallback(
    async (clerkId: string, token: string) => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/users/driver/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch driver profile')
        }

        const data = await response.json()
        setDriver(data.driver || null)
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to refresh driver profile'
        setError(errorMessage)
        console.error('Driver refresh error:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  return (
    <DriverContext.Provider
      value={{
        driver,
        setDriver,
        isLoading,
        setIsLoading,
        error,
        setError,
        refreshDriver,
      }}
    >
      {children}
    </DriverContext.Provider>
  )
}

/**
 * Hook to access driver context
 * Must be used within DriverProvider
 */
export const useDriver = (): DriverContextType => {
  const context = useContext(DriverContext)
  if (!context) {
    throw new Error('useDriver must be used within DriverProvider')
  }
  return context
}
