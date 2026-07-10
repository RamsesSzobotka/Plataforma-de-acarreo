import { test, expect } from '@playwright/test'
import { signInAs, mockCommonApi, mockRideDetails, clientRide } from './helpers/mock-app'

test.describe('rating-flow - calificacion mutua после оплаты', () => {
  const paidRide = { ...clientRide, _id: 'ride-paid-1', status: 'paid', driverId: 'driver-user', clientId: 'client-user' }

  test('cliente puede ver el formulario de rating cuando el ride esta paid', async ({ page }) => {
    await signInAs(page, 'client')
    await mockRideDetails(page, paidRide, { hasPaymentMethod: true, hasRating: false })
    await page.goto('/ride/ride-paid-1')
    await expect(page.getByTestId('ride-details-submit-rating-button')).toBeVisible()
  })

  test('cliente no ve el formulario si ya califico', async ({ page }) => {
    await signInAs(page, 'client')
    await mockRideDetails(page, paidRide, { hasPaymentMethod: true, hasRating: true })
    await page.goto('/ride/ride-paid-1')
    await expect(page.getByTestId('rating-already-rated')).toBeVisible()
  })

  test('conductor puede ver el formulario de rating cuando el ride esta paid', async ({ page }) => {
    await signInAs(page, 'driver')
    await mockRideDetails(page, { ...paidRide, clientId: 'another-client' }, { hasRating: false })
    await page.goto('/ride/ride-paid-1')
    await expect(page.getByTestId('ride-details-driver-submit-rating-button')).toBeVisible()
  })

  test('el rating no esta disponible hasta que el ride este en estado paid', async ({ page }) => {
    const completedRide = { ...clientRide, _id: 'ride-comp-1', status: 'completed', driverId: 'driver-user' }
    await signInAs(page, 'client')
    await mockRideDetails(page, completedRide, { hasPaymentMethod: true })
    await page.goto('/ride/ride-comp-1')
    await expect(page.getByTestId('ride-details-submit-rating-button')).not.toBeVisible()
  })

  test('el conductor ve opcion de calificar al cliente en ride paid', async ({ page }) => {
    await signInAs(page, 'driver')
    await mockRideDetails(page, { ...paidRide, clientId: 'another-client' }, { hasRating: false })
    await page.goto('/ride/ride-paid-1')
    await expect(page.getByTestId('ride-details-driver-submit-rating-button')).toBeVisible()
  })
})
