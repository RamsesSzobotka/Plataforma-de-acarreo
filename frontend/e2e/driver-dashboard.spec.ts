import { test, expect } from '@playwright/test'
import { signInAs, mockCommonApi, mockDriverStatus, clientRide, driverRide } from './helpers/mock-app'

test.describe('driver-dashboard - panel del conductor', () => {
  const verifiedDriver = {
    _id: 'driver-profile-1',
    userId: 'driver-user',
    verificationStatus: 'verified',
    vehicleType: 'Camioneta',
    plate: 'PTY-123',
    rating: 4.8,
    totalRides: 32,
    isAvailable: true,
  }

  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'driver')
    await mockCommonApi(page)
  })

  test('renderiza tabs de pedidos disponibles y mis acarreos', async ({ page }) => {
    await mockDriverStatus(page, verifiedDriver, [clientRide], [driverRide])
    await page.goto('/driver')
    await expect(page.getByTestId('driver-dashboard-tab-available')).toBeVisible()
    await expect(page.getByTestId('driver-dashboard-tab-mine')).toBeVisible()
  })

  test('muestra filtros de tipo de pedido en tab disponibles', async ({ page }) => {
    await mockDriverStatus(page, verifiedDriver, [clientRide], [])
    await page.goto('/driver')
    await expect(page.getByTestId('driver-dashboard-type-filter')).toBeVisible()
  })

  test('filtra mis acarreos por estado', async ({ page }) => {
    await mockDriverStatus(page, verifiedDriver, [], [driverRide])
    await page.goto('/driver')
    await page.getByTestId('driver-dashboard-tab-mine').click()
    await expect(page.getByTestId('driver-dashboard-mine-filter-all')).toBeVisible()
    await expect(page.getByTestId('driver-dashboard-mine-filter-pending')).toBeVisible()
    await expect(page.getByTestId('driver-dashboard-mine-filter-in_progress')).toBeVisible()
    await expect(page.getByTestId('driver-dashboard-mine-filter-paid')).toBeVisible()
  })

  test('muestra banner de verificacion pendiente cuando status no es verified', async ({ page }) => {
    const pendingDriver = { ...verifiedDriver, verificationStatus: 'pending' }
    await mockDriverStatus(page, pendingDriver, [], [])
    await page.goto('/driver')
    await expect(page.getByTestId('driver-verification-banner')).toBeVisible()
  })

  test('muestra banner de verificacion rechazada con razon', async ({ page }) => {
    const rejectedDriver = { ...verifiedDriver, verificationStatus: 'rejected', rejectionReason: 'Documentos ilegibles' }
    await mockDriverStatus(page, rejectedDriver, [], [])
    await page.goto('/driver')
    await expect(page.getByTestId('driver-verification-banner')).toBeVisible()
    await expect(page.getByText(/Documentos ilegibles/i)).toBeVisible()
  })

  test('navega de vuelta al inicio', async ({ page }) => {
    await mockDriverStatus(page, verifiedDriver, [clientRide], [driverRide])
    await page.goto('/driver')
    await page.getByRole('link', { name: /volver/i }).first().click()
    await expect(page).toHaveURL(/\/$/)
  })
})
