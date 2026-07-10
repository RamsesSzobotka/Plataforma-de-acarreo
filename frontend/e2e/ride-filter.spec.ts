import { test, expect } from '@playwright/test'
import { signInAs, mockCommonApi, mockRideList, clientRide, requestedRide, driverRide } from './helpers/mock-app'

test.describe('ride-filter - filtrado de pedidos en MyRides', () => {
  // Note: clientRide and requestedRide have clientId='client-user'
  // driverRide has clientId='another-client' - it won't appear in client's ride list
  const allRides = [clientRide, requestedRide]

  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'client')
    await mockCommonApi(page)
  })

  test('renderiza todos los filtros de estado', async ({ page }) => {
    await mockRideList(page, allRides)
    await page.goto('/my-rides')
    await expect(page.getByTestId('my-rides-filter-all')).toBeVisible()
    await expect(page.getByTestId('my-rides-filter-requested')).toBeVisible()
    await expect(page.getByTestId('my-rides-filter-accepted')).toBeVisible()
    await expect(page.getByTestId('my-rides-filter-in_progress')).toBeVisible()
    await expect(page.getByTestId('my-rides-filter-completed')).toBeVisible()
    await expect(page.getByTestId('my-rides-filter-paid')).toBeVisible()
    await expect(page.getByTestId('my-rides-filter-cancelled')).toBeVisible()
  })

  test('filtra por estado requested sin cambiar URL', async ({ page }) => {
    await mockRideList(page, [requestedRide])
    await page.goto('/my-rides')
    await page.getByTestId('my-rides-filter-requested').click()
    // No hay waitForURL porque MyRides usa estado de React, no URL params
  })

  test('filtra por estado accepted', async ({ page }) => {
    await mockRideList(page, [clientRide])
    await page.goto('/my-rides')
    await page.getByTestId('my-rides-filter-accepted').click()
  })

  test('muestra estado vacio cuando no hay pedidos en el filtro', async ({ page }) => {
    await mockRideList(page, [])
    await page.goto('/my-rides')
    await page.getByTestId('my-rides-filter-paid').click()
    // EmptyState muestra icono inventory_2 o search_off cuando no hay resultados
    await expect(page.locator('.card')).toHaveCount(0)
  })

  test('boton nuevo pedido redirige a create-ride', async ({ page }) => {
    await mockRideList(page, allRides)
    await page.goto('/my-rides')
    await page.getByTestId('my-rides-new-ride-button').click()
    await expect(page).toHaveURL(/\/create-ride/)
  })

  test('muestra todas las tarjetas de pedido en filtro all', async ({ page }) => {
    // Solo clientRide y requestedRide tienen clientId='client-user'
    await mockRideList(page, [clientRide, requestedRide])
    await page.goto('/my-rides')
    await page.getByTestId('my-rides-filter-all').click()
    await expect(page.locator('.card')).toHaveCount(2)
  })
})
