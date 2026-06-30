import { expect, test } from '@playwright/test'
import { driverRide, mockDriverStatus, requestedRide, signInAs } from './helpers/mock-app'

test.describe('driver dashboard mocked coverage', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'driver')
  })

  test('H-12 prompts an unregistered user to register as driver', async ({ page }) => {
    await mockDriverStatus(page, null)

    await page.goto('/driver')

    await expect(page.getByText(/Registrate como Conductor/i)).toBeVisible()
    await expect(page.getByText(/completar tu registro y verificacion/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Registrarse como Conductor/i })).toBeVisible()
  })

  test('H-12 shows pending verification state and disables operating tabs', async ({ page }) => {
    await mockDriverStatus(page, {
      _id: 'driver-profile',
      userId: 'driver-user',
      verificationStatus: 'pending',
      vehicleType: 'Camioneta',
      plate: 'PTY-123',
    })

    await page.goto('/driver')

    await expect(page.getByRole('heading', { name: /Verificacion Pendiente/i })).toBeVisible()
    await expect(page.getByText(/No podras aceptar encargos/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Pedidos Disponibles/i })).toBeDisabled()
    await expect(page.getByRole('button', { name: /Mis Acarreos/i })).toBeDisabled()
  })

  test('H-12 shows rejected verification reason and correction action', async ({ page }) => {
    await mockDriverStatus(page, {
      _id: 'driver-profile',
      userId: 'driver-user',
      verificationStatus: 'rejected',
      rejectionReason: 'La foto de la licencia no es legible.',
    })

    await page.goto('/driver')
    await expect(page.getByRole('heading', { name: /Verificacion Rechazada/i })).toBeVisible()
    await expect(page.getByText(/Motivo del rechazo/i)).toBeVisible()
    await expect(page.getByText(/La foto de la licencia no es legible/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Corregir y Reenviar/i })).toBeVisible()
  })

  test('H-15/H-16 shows available rides and filters by cargo type for verified drivers', async ({ page }) => {
    await mockDriverStatus(
      page,
      {
        _id: 'driver-profile',
        userId: 'driver-user',
        verificationStatus: 'verified',
        vehicleType: 'Camioneta',
        plate: 'PTY-123',
        rating: 4.7,
        totalRides: 18,
        payoutsEnabled: true,
      },
      [requestedRide],
    )

    await page.goto('/driver')
    await expect(page.getByRole('heading', { name: /Panel del Conductor/i })).toBeVisible()
    await expect(page.getByText(/Pagos habilitados/i)).toBeVisible()
    await expect(page.getByText(/Calificacion/i)).toBeVisible()
    await expect(page.getByText(/4.7/i)).toBeVisible()
    await expect(page.getByText(/Entrega de muebles nuevos/i)).toBeVisible()
    await expect(page.getByText(/San Francisco, bodega principal/i)).toBeVisible()

    await page.locator('select.select').selectOption('productos')
    await expect(page.getByRole('heading', { name: /No hay pedidos disponibles/i })).toBeVisible()
  })

  test('H-17/H-18 exposes accepted rides, chat and start-trip actions', async ({ page }) => {
    await mockDriverStatus(
      page,
      {
        _id: 'driver-profile',
        userId: 'driver-user',
        verificationStatus: 'verified',
        vehicleType: 'Camioneta',
        plate: 'PTY-123',
        rating: 4.7,
        totalRides: 18,
        payoutsEnabled: true,
      },
      [],
      [driverRide],
    )

    await page.goto('/driver')
    await page.getByRole('button', { name: /Mis Acarreos/i }).click()

    await expect(page.getByText(/Transporte de productos refrigerados/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /^visibility Ver$/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /^chat Chat$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Iniciar Viaje/i })).toBeVisible()
  })
})
