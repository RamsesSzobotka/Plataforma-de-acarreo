import { test, expect } from '@playwright/test'
import { signInAs, mockCommonApi } from './helpers/mock-app'

test.describe('register-driver - registro multi-step de conductor', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'client')
    await mockCommonApi(page)
    await page.route('**/api/users/driver/me', async (route) => {
      await route.fulfill({ status: 404, json: { error: 'Driver not found' } })
    })
  })

  test('renderiza los 5 tabs de seccion con sus iconos', async ({ page }) => {
    await page.goto('/register-driver')
    await expect(page.getByTestId('register-driver-section-1')).toBeVisible()
    await expect(page.getByTestId('register-driver-section-2')).toBeVisible()
    await expect(page.getByTestId('register-driver-section-3')).toBeVisible()
    await expect(page.getByTestId('register-driver-section-4')).toBeVisible()
    await expect(page.getByTestId('register-driver-section-5')).toBeVisible()
  })

  test('el boton siguiente esta deshabilitado en seccion 1 sin campos obligatorios', async ({ page }) => {
    await page.goto('/register-driver')
    await expect(page.getByTestId('register-driver-next')).toBeDisabled()
  })

  test('puede avanzar a seccion 2 cuando completo seccion 1', async ({ page }) => {
    // Mock image upload
    await page.route('**/api/upload**', async (route) => {
      await route.fulfill({ json: { url: 'https://example.com/vehicle.jpg', publicId: 'test/vehicle' } })
    })
    await page.goto('/register-driver')
    // Section 1 should be selected by default (activeSection === 1)
    // Click vehicle type button
    await page.locator('button', { hasText: /camioneta/i }).first().click()
    // Fill plate
    await page.locator('input[placeholder="ABC-1234"]').fill('PTY-9999')
    // Fill capacity
    await page.locator('input[type="number"][placeholder="1000"]').fill('1500')
    // Upload a vehicle image
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles({
      name: 'vehicle.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
    })
    // Now next button should be enabled
    await expect(page.getByTestId('register-driver-next')).toBeEnabled()
    await page.getByTestId('register-driver-next').click()
    // Section 2 should now be visible (Personal Documents section)
    await expect(page.getByRole('heading', { name: /Documentos Personales/i })).toBeVisible()
  })

  test('el boton atras aparece desde seccion 2', async ({ page }) => {
    await page.goto('/register-driver')
    await page.getByTestId('register-driver-section-2').click()
    await expect(page.getByTestId('register-driver-back')).toBeVisible()
  })

  test('el boton enviar aparece solo en la seccion 5', async ({ page }) => {
    await page.goto('/register-driver')
    await page.getByTestId('register-driver-section-5').click()
    await expect(page.getByTestId('register-driver-submit')).toBeVisible()
  })

  test('navega de vuelta al inicio', async ({ page }) => {
    await page.goto('/register-driver')
    await page.getByRole('link', { name: /volver/i }).first().click()
    await expect(page).toHaveURL(/\/$/)
  })
})
