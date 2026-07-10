import { test, expect } from '@playwright/test'
import { signInAs, mockCommonApi, mockRideDetails, clientRide } from './helpers/mock-app'

test.describe('ride-details - detalles y acciones del pedido', () => {
  const acceptedRide = { ...clientRide, _id: 'ride-details-1', status: 'accepted', driverId: 'driver-user' }
  const inProgressRide = { ...clientRide, _id: 'ride-details-2', status: 'in_progress', driverId: 'driver-user' }
  const completedRide = { ...clientRide, _id: 'ride-details-3', status: 'completed', driverId: 'driver-user' }

  test('renderiza los datos del pedido con imagen, ubicaciones y precio', async ({ page }) => {
    await signInAs(page, 'client')
    await mockRideDetails(page, acceptedRide)
    await page.goto('/ride/ride-details-1')
    await expect(page.getByText(acceptedRide.title)).toBeVisible()
    await expect(page.getByText(acceptedRide.description)).toBeVisible()
    await expect(page.getByText(/\$140/i)).toBeVisible()
  })

  test('muestra boton cancelar cuando el cliente es dueño y estado es requested', async ({ page }) => {
    const requestedRide = { ...clientRide, _id: 'ride-req-1', status: 'requested', clientId: 'client-user' }
    await signInAs(page, 'client')
    await mockRideDetails(page, requestedRide)
    await page.goto('/ride/ride-req-1')
    await expect(page.getByTestId('ride-details-cancel-button')).toBeVisible()
  })

  test('muestra boton confirmar entrega cuando estado es in_progress y es cliente', async ({ page }) => {
    await signInAs(page, 'client')
    await mockRideDetails(page, inProgressRide)
    await page.goto('/ride/ride-details-2')
    await expect(page.getByTestId('ride-details-confirm-delivery-button')).toBeVisible()
  })

  test('muestra boton de pago cuando estado es completed y tiene metodo de pago', async ({ page }) => {
    await signInAs(page, 'client')
    await mockRideDetails(page, completedRide, { hasPaymentMethod: true })
    await page.goto('/ride/ride-details-3')
    await expect(page.getByTestId('ride-details-pay-now-button')).toBeVisible()
  })

  test('muestra boton agregar metodo de pago cuando no tiene metodo y estado es completed', async ({ page }) => {
    await signInAs(page, 'client')
    await mockRideDetails(page, completedRide, { hasPaymentMethod: false })
    await page.goto('/ride/ride-details-3')
    await expect(page.getByTestId('ride-details-add-payment-button')).toBeVisible()
  })

  test('muestra rating del conductor cuando hay conductor asignado', async ({ page }) => {
    await signInAs(page, 'client')
    await mockRideDetails(page, acceptedRide)
    await page.goto('/ride/ride-details-1')
    await expect(page.getByText(/Diego Martinez/i)).toBeVisible()
    await expect(page.getByText(/4\.8/)).toBeVisible()
  })

  test('navega de vuelta a mis pedidos', async ({ page }) => {
    await signInAs(page, 'client')
    await mockRideDetails(page, acceptedRide)
    await page.goto('/ride/ride-details-1')
    await page.getByRole('link', { name: /volver/i }).click()
    await expect(page).toHaveURL(/\/my-rides/)
  })
})
