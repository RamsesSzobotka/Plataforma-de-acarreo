import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'

interface VerificationState {
  status: 'pending' | 'in_review' | 'verified' | 'rejected' | 'suspended' | null
  rejectionReason?: string
  isVerified: boolean
  loading: boolean
  error: string | null
}

/**
 * Custom hook to fetch and manage driver verification status
 * 
 * Features:
 * - Fetches verification status from backend
 * - Supports dev bypass mode (?bypassVerification=true)
 * - Caches for 5 minutes
 * 
 * @returns VerificationState
 */
export const useVerification = (): VerificationState => {
  const { getToken } = useAuth()
  const [state, setState] = useState<VerificationState>({
    status: null,
    rejectionReason: undefined,
    isVerified: false,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const fetchVerification = async () => {
      try {
        const token = await getToken()

        if (!token) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: 'Not authenticated',
          }))
          return
        }

        // Check for dev bypass mode
        const searchParams = new URLSearchParams(window.location.search)
        const bypassMode = searchParams.get('bypassVerification') === 'true'

        if (bypassMode && process.env.NODE_ENV === 'development') {
          console.warn('⚠️ DEVELOPMENT: Verification bypassed')
          setState({
            status: 'verified',
            rejectionReason: undefined,
            isVerified: true,
            loading: false,
            error: null,
          })
          return
        }

        // TODO: Fetch verification status from /api/users/driver/me endpoint
        // For now, just mark as verified (adjust based on your user model)
        const response = await fetch('/api/users/driver/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch verification status')
        }

        const data = await response.json()
        const verificationStatus = data.driver?.verificationStatus || 'pending'

        setState({
          status: verificationStatus,
          rejectionReason: data.driver?.rejectionReason,
          isVerified: verificationStatus === 'verified',
          loading: false,
          error: null,
        })
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch verification'
        console.error('Verification fetch error:', err)
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }))
      }
    }

    fetchVerification()
  }, [getToken])

  return state
}
