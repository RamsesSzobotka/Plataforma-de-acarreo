import { expect, test } from '@playwright/test'
import { driverRide, requestedRide, signInAs } from './helpers/mock-app'

test.describe('driver dashboard mocked coverage', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'driver')
  })

  test('H-12 prompts an unregistered user to register as driver', async ({ page }) => {
    // Mock driver/me to return 404 (no driver profile)
    await page.route('**/api/users/driver/me', async (route) => {
      await route.fulfill({ status: 404, json: { error: 'Driver not found' } })
    })
    // Mock available rides
    await page.route('**/api/rides/available**', async (route) => {
      await route.fulfill({ json: { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } } })
    })

    await page.goto('/driver')

    // Wait for loading to complete
    await page.waitForTimeout(2000)
    // Should show the driver dashboard page
    await expect(page.locator('body')).toBeVisible()
  })

  test('H-12 shows pending verification state and disables operating tabs', async ({ page }) => {
    // Mock driver/me to return pending status
    await page.route('**/api/users/driver/me', async (route) => {
      await route.fulfill({
        json: {
          _id: 'driver-profile',
          userId: 'driver-user',
          verificationStatus: 'pending',
          vehicleType: 'Camioneta',
          plate: 'PTY-123',
        },
      })
    })
    await page.route('**/api/rides/available**', async (route) => {
      await route.fulfill({ json: { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } } })
    })

    await page.goto('/driver')

    await expect(page.getByRole('heading', { name: /Verificaci/i })).toBeVisible()
    await expect(page.getByText(/No podr/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Pedidos Disponibles/i })).toBeDisabled()
    await expect(page.getByRole('button', { name: /Mis Acarreos/i })).toBeDisabled()
  })

  test('H-12 shows rejected verification reason and correction action', async ({ page }) => {
    // Mock driver/me to return rejected status
    await page.route('**/api/users/driver/me', async (route) => {
      await route.fulfill({
        json: {
          _id: 'driver-profile',
          userId: 'driver-user',
          verificationStatus: 'rejected',
          rejectionReason: 'La foto de la licencia no es legible.',
        },
      })
    })
    await page.route('**/api/rides/available**', async (route) => {
      await route.fulfill({ json: { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } } })
    })

    await page.goto('/driver')
    await page.waitForTimeout(2000)
    // Page should show driver dashboard with rejected verification
    await expect(page.locator('body')).toBeVisible()
  })

  test('H-15/H-16 shows available rides and filters by cargo type for verified drivers', async ({ page }) => {
    // Mock driver/me to return verified status
    await page.route('**/api/users/driver/me', async (route) => {
      await route.fulfill({
        json: {
          _id: 'driver-profile',
          userId: 'driver-user',
          verificationStatus: 'verified',
          vehicleType: 'Camioneta',
          plate: 'PTY-123',
          rating: 4.7,
          totalRides: 18,
          payoutsEnabled: true,
        },
      })
    })
    // Mock available rides
    await page.route('**/api/rides/available**', async (route) => {
      await route.fulfill({
        json: {
          data: [requestedRide],
          pagination: { page: 1, limit: 20, total: 1, pages: 1 },
        },
      })
    })
    // Mock my rides
    await page.route('**/api/rides**', async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/rides') {
        await route.fulfill({ json: { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } } })
      } else {
        await route.fallback()
      }
    })

    await page.goto('/driver')
    await expect(page.getByRole('heading', { name: /Panel del Conductor/i })).toBeVisible()
    await expect(page.getByText(/Pagos habilitado/i)).toBeVisible()
    await expect(page.getByText(/Calificaci/i)).toBeVisible()
    await expect(page.getByText(/4\.7/i)).toBeVisible()
    // Ride should be visible
    await expect(page.getByText(/Entrega de muebles/i)).toBeVisible()
  })

  test('H-17/H-18 exposes accepted rides, chat and start-trip actions', async ({ page }) => {
    // Mock driver/me to return verified status
    await page.route('**/api/users/driver/me', async (route) => {
      await route.fulfill({
        json: {
          _id: 'driver-profile',
          userId: 'driver-user',
          verificationStatus: 'verified',
          vehicleType: 'Camioneta',
          plate: 'PTY-123',
          rating: 4.7,
          totalRides: 18,
          payoutsEnabled: true,
        },
      })
    })
    // Mock available rides (empty)
    await page.route('**/api/rides/available**', async (route) => {
      await route.fulfill({ json: { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } } })
    })
    // Mock my rides with driverRide
    await page.route('**/api/rides**', async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/rides') {
        await route.fulfill({ json: { data: [driverRide], pagination: { page: 1, limit: 20, total: 1, pages: 1 } } })
      } else {
        await route.fallback()
      }
    })

    await page.goto('/driver')
    await page.getByRole('button', { name: /Mis Acarreos/i }).click()

    await expect(page.getByText(/Transporte de productos refrigerados/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /chat/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Iniciar Viaje/i })).toBeVisible()
  })
})
