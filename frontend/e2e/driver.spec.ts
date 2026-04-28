import { test, expect } from '@playwright/test'

// Tests basicos de UI - sin autenticacion
// Verifica que las rutas existen y cargan sin errores
test.describe('UI Basica - Driver Routes', () => {
  test('register-driver: la ruta carga sin errores', async ({ page }) => {
    const response = await page.goto('/register-driver')
    // La pagina debe existir (puede ser login si no esta autenticado)
    expect(response?.status()).toBeLessThan(500)
  })

  test('driver: la ruta carga sin errores', async ({ page }) => {
    const response = await page.goto('/driver')
    expect(response?.status()).toBeLessThan(500)
  })

  test('driver/profile: la ruta carga sin errores', async ({ page }) => {
    const response = await page.goto('/driver/profile')
    expect(response?.status()).toBeLessThan(500)
  })
})

// Tests verificando que la pagina home tiene los links correctos
test.describe('Navegacion desde Home', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('home debe tener link a registro de conductor', async ({ page }) => {
    const registerLink = page.getByRole('link', { name: /conductor/i })
    await expect(registerLink.first()).toBeVisible()
  })
})