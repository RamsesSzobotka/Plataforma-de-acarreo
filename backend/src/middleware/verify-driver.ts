import type { MiddlewareHandler } from 'hono'
import { Driver } from '../models/driver'

/**
 * Response structure when verification check fails
 */
export interface VerificationError {
  verified: false
  status: 'pending' | 'in_review' | 'rejected' | 'suspended'
  rejectionReason?: string
}

/**
 * Response structure when verification check succeeds
 */
export interface VerificationSuccess {
  verified: true
  warning?: string
}

/**
 * Verify that a driver has completed verification
 * 
 * Checks if driver.verificationStatus === 'verified'
 * In development with bypassInDev=true, allows unverified drivers (logs warning)
 * 
 * @param driverId - Clerk ID of the driver
 * @param options - Configuration options
 * @returns Object with verification result and details
 * 
 * @throws Error if driver profile not found
 * 
 * @example
 * const result = await verifyDriver(driverId, { bypassInDev: false })
 * if (!result.verified) {
 *   return c.json({ error: 'Driver not verified', ...result }, 403)
 * }
 */
export async function verifyDriver(
  driverId: string,
  options?: { bypassInDev?: boolean },
): Promise<VerificationSuccess | VerificationError> {
  // Fetch driver profile
  const driver = await Driver.findOne({ userId: driverId })

  if (!driver) {
    throw new Error('Driver profile not found')
  }

  // Development bypass (for testing)
  const isDev = process.env.NODE_ENV === 'development'
  if (isDev && options?.bypassInDev) {
    console.warn(`⚠️ DEVELOPMENT: Verification bypassed for driverId=${driverId}`)
    return {
      verified: true,
      warning: 'Bypass enabled - verification skipped (dev only)',
    }
  }

  // Check verification status
  if (driver.verificationStatus === 'verified') {
    return { verified: true }
  }

  // Not verified - return error details
  return {
    verified: false,
    status: driver.verificationStatus || 'pending',
    rejectionReason: driver.rejectionReason,
  }
}

/**
 * Hono middleware to enforce driver verification
 * 
 * Usage:
 * app.post('/api/rides/:id/accept', verifyDriverMiddleware, handler)
 * 
 * Returns 403 if driver is not verified (unless bypassInDev=true in development)
 */
export const verifyDriverMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user')

  if (!user || !user.clerkId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Check if user role is driver
  if (user.role !== 'driver') {
    return c.json({ error: 'Only drivers can access this resource' }, 403)
  }

  // Check if bypassVerification query param is set (dev only)
  const bypassParam = c.req.query('bypassVerification') === 'true'
  const isDev = process.env.NODE_ENV === 'development'

  try {
    const result = await verifyDriver(user.clerkId, {
      bypassInDev: isDev && bypassParam,
    })

    if (!result.verified) {
      return c.json(
        {
          error: 'Driver not verified',
          status: result.status,
          rejectionReason: result.rejectionReason,
        },
        403,
      )
    }

    // If bypass was used, add warning to context for response
    if (result.warning) {
      c.set('verificationWarning', result.warning)
    }

    await next()
  } catch (err) {
    console.error('Verification middleware error:', err)
    return c.json({ error: 'Failed to verify driver status' }, 500)
  }
}
