import { expect, test } from '@playwright/test'
import { mockDriverStatus, signInAs } from './helpers/mock-app'

test.describe('register driver mocked coverage', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'driver')
  })

  test('H-11 renders registration sections, progress and required-field gating', async ({ page }) => {
    await mockDriverStatus(page, null)

    await page.goto('/register-driver')

    await expect(page.getByRole('heading', { name: /Registrarse como Conductor/i })).toBeVisible()
    // Section 1 is visible by default - the form with vehicle fields
    await expect(page.getByRole('heading', { name: /Datos del Veh/i })).toBeVisible()
    await expect(page.getByText(/Tipo de Vehiculo/i)).toBeVisible()
    await expect(page.getByPlaceholder(/ABC-1234/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Siguiente/i })).toBeDisabled()
  })

  test('H-11 exposes each document section without upload side effects', async ({ page }) => {
    await mockDriverStatus(page, null)

    await page.goto('/register-driver')

    // Scroll to and click Docs Personales tab
    await page.locator('button', { hasText: /Docs Personales/i }).click()
    await expect(page.getByRole('heading', { name: /Documentos Personales/i })).toBeVisible()
    await expect(page.getByText(/Tipo de Licencia/i)).toBeVisible()

    // Click Docs Vehiculo tab
    await page.locator('button', { hasText: /Docs Vehiculo/i }).click()
    await expect(page.getByRole('heading', { name: /Documentos del Vehiculo/i })).toBeVisible()
    await expect(page.getByText(/RUV del Vehiculo/i)).toBeVisible()

    // Click Contacto tab
    await page.locator('button', { hasText: /Contacto/i }).click()
    await expect(page.getByRole('heading', { name: /Datos de Contacto/i })).toBeVisible()
    await expect(page.getByPlaceholder(/\+507/i)).toBeVisible()

    // Click Adicionales tab and scroll to submit button area
    await page.locator('button', { hasText: /Adicionales/i }).click()
    await expect(page.getByRole('heading', { name: /Documentos Adicionales/i })).toBeVisible()
    // Scroll down to make the submit button visible
    await page.locator('button', { hasText: /Enviar para/i }).scrollIntoViewIfNeeded()
    await expect(page.locator('button', { hasText: /Enviar para/i })).toBeVisible()
  })

  test('H-11 shows existing pending verification status instead of the form', async ({ page }) => {
    await mockDriverStatus(page, {
      verificationStatus: 'pending',
      vehicleType: 'Camioneta',
      plate: 'PTY-123',
    })

    await page.goto('/register-driver')
    await expect(page.getByRole('heading', { name: /Verificaci/i })).toBeVisible()
    await expect(page.getByText(/documentos/i)).toBeVisible()
  })
})
