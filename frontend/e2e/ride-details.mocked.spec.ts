import { expect, test } from '@playwright/test'
import { clientRide, mockRideDetails, requestedRide, signInAs } from './helpers/mock-app'

test.describe('ride details mocked coverage', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'client')
  })

  test('H-04 renders ride details, images, locations, driver and negotiated price', async ({ page }) => {
    await mockRideDetails(page, clientRide)

    await page.goto(`/ride/${clientRide._id}`)

    await expect(page.getByRole('link', { name: /Volver a Mis Pedidos/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Mudanza de oficina Costa del Este/i })).toBeVisible()
    await expect(page.getByText(/Traslado de escritorios/i)).toBeVisible()
    await expect(page.getByText(/Imagenes del Pedido/i)).toBeVisible()
    await expect(page.getByText(/Recogida/i)).toBeVisible()
    await expect(page.getByText(/Costa del Este, Torre Empresarial/i)).toBeVisible()
    await expect(page.getByText(/Entrega/i)).toBeVisible()
    await expect(page.getByText(/Obarrio, Calle 50/i)).toBeVisible()
    await expect(page.getByText(/Conductor Asignado/i)).toBeVisible()
    await expect(page.getByText(/Diego Martinez/i)).toBeVisible()
    await expect(page.getByText(/Precio negociado/i)).toBeVisible()
    await expect(page.getByText('$140')).toBeVisible()
  })

  test('H-06 exposes cancellation only while a client-owned ride is requested', async ({ page }) => {
    await mockRideDetails(page, requestedRide)

    await page.goto(`/ride/${requestedRide._id}`)

    await expect(page.getByRole('heading', { name: /Entrega de muebles nuevos/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Cancelar Pedido/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Confirmar Entrega/i })).toHaveCount(0)
    await expect(page.getByText(/Agregar Metodo de Pago/i)).toHaveCount(0)
  })

  test('H-08 shows delivery confirmation while ride is in progress', async ({ page }) => {
    const inProgressRide = { ...clientRide, status: 'in_progress' }
    await mockRideDetails(page, inProgressRide, { hasPaymentMethod: true })

    await page.goto(`/ride/${inProgressRide._id}`)

    await expect(page.getByText('En Viaje', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Confirmar Entrega/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Cancelar Pedido/i })).toHaveCount(0)
  })

  test('H-09 shows payment requirement when completed without saved payment method', async ({ page }) => {
    const completedRide = { ...clientRide, status: 'completed' }
    await mockRideDetails(page, completedRide, { hasPaymentMethod: false })

    await page.goto(`/ride/${completedRide._id}`)

    await expect(page.getByRole('link', { name: /Agregar Metodo de Pago/i })).toBeVisible()
    await expect(page.getByText(/Metodo de Pago Requerido/i)).toBeVisible()
    await expect(page.getByText(/Debes agregar un metodo de pago/i)).toBeVisible()
  })

  test('H-09 shows rating surface after payment is confirmed', async ({ page }) => {
    const paidRide = { ...clientRide, status: 'paid', paidAt: '2026-06-26T15:00:00.000Z' }
    await mockRideDetails(page, paidRide)

    await page.goto(`/ride/${paidRide._id}`)

    await expect(page.getByText(/Pago Confirmado/i)).toBeVisible()
    await expect(page.getByText(/Calificar Servicio/i)).toBeVisible()
    await expect(page.getByPlaceholder(/Comentario/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Enviar Calificacion/i })).toBeDisabled()
  })
})
