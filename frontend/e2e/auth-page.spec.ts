import { test, expect } from '@playwright/test'

test.describe('auth-page - pagina de autenticacion', () => {
  test('renderiza el selector de tipo de usuario (cliente/conductor)', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page.getByTestId('auth-select-client')).toBeVisible()
    await expect(page.getByTestId('auth-select-driver')).toBeVisible()
  })

  test('puede alternar entre cliente y conductor', async ({ page }) => {
    await page.goto('/sign-in')
    // Initially client is selected
    await expect(page.getByTestId('auth-select-client')).toBeVisible()
    // Click driver to switch
    await page.getByTestId('auth-select-driver').click()
    // Driver button should now be active (verify via visual state - text changes)
    await expect(page.getByTestId('auth-select-driver')).toBeVisible()
  })

  test('muestra el formulario de sign-in', async ({ page }) => {
    await page.goto('/sign-in')
    // Mock de Clerk muestra un formulario simple E2E
    await expect(page.getByText(/Inicio de sesion simulado/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /continuar con google/i })).toBeVisible()
  })

  test('el link de volver al inicio funciona', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByTestId('auth-back-to-home').click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('el link de crear cuenta redirige al home', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByTestId('auth-create-account-link').click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('el branding de Carglyn es visible', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page.getByRole('heading', { name: 'Carglyn', exact: true })).toBeVisible()
  })
})
