import { expect, test } from '@playwright/test'
import { clientRide, mockCommonApi, mockRideList, requestedRide, signInAs } from './helpers/mock-app'

test.describe('client rides mocked coverage', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'client')
    await mockCommonApi(page)
  })

  test('H-03 lists client rides with status filters and primary controls', async ({ page }) => {
    await mockRideList(page, [clientRide, requestedRide])

    await page.goto('/my-rides')

    await expect(page.getByRole('heading', { name: /Mis Pedidos/i })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: /Nuevo Pedido/i })).toBeVisible()
    await expect(page.getByText(/Tienes 2 pedidos en total/i)).toBeVisible()
    await expect(page.getByText(/Mudanza de oficina Costa del Este/i)).toBeVisible()
    await expect(page.getByText(/Entrega de muebles nuevos/i)).toBeVisible()
    await expect(page.getByText(/Costa del Este, Torre Empresarial/i)).toBeVisible()
    await expect(page.getByText(/Obarrio, Calle 50/i)).toBeVisible()
    await expect(page.getByText(/Filtro: Todos/i)).toBeVisible()

    await page.getByRole('button', { name: /Pendientes/i }).click()

    await expect(page.getByText(/Entrega de muebles nuevos/i)).toBeVisible()
    await expect(page.getByText(/Mudanza de oficina Costa del Este/i)).toHaveCount(0)
    await expect(page.getByText(/Filtro: Pendientes/i)).toBeVisible()
  })

  test('H-03 shows an actionable empty state when no rides match a filter', async ({ page }) => {
    await mockRideList(page, [clientRide])

    await page.goto('/my-rides')
    await page.getByRole('button', { name: /Cancelados/i }).click()

    await expect(page.getByText(/No hay pedidos cancelados/i)).toBeVisible()
    await expect(page.getByText(/Prueba cambiar el filtro/i)).toBeVisible()

    await page.getByRole('button', { name: /Ver Todos/i }).click()
    await expect(page.getByText(/Mudanza de oficina Costa del Este/i)).toBeVisible()
  })
})
