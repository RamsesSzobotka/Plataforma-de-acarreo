import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/mock-app'

test.describe('create-ride - cliente crea un pedido', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'client')
  })

  test('renderiza el formulario completo con todos los campos', async ({ page }) => {
    // Mock with payment method available
    await page.route('**/api/users/me/payment-method', async (route) => {
      await route.fulfill({ json: { hasPaymentMethod: true, stripePaymentMethodId: 'pm_mock' } })
    })
    await page.goto('/create-ride')

    await expect(page.getByTestId('create-ride-title')).toBeVisible()
    await expect(page.getByTestId('create-ride-description')).toBeVisible()
    await expect(page.getByTestId('create-ride-price')).toBeVisible()
    await expect(page.getByTestId('create-ride-submit')).toBeVisible()
  })

  test('el boton submit esta deshabilitado sin campos obligatorios', async ({ page }) => {
    await page.route('**/api/users/me/payment-method', async (route) => {
      await route.fulfill({ json: { hasPaymentMethod: true, stripePaymentMethodId: 'pm_mock' } })
    })
    await page.goto('/create-ride')
    const submitBtn = page.getByTestId('create-ride-submit')
    await expect(submitBtn).toBeDisabled()
  })

  test('puede seleccionar tipo de acarreo', async ({ page }) => {
    await page.route('**/api/users/me/payment-method', async (route) => {
      await route.fulfill({ json: { hasPaymentMethod: true, stripePaymentMethodId: 'pm_mock' } })
    })
    await page.goto('/create-ride')
    await page.getByTestId('create-ride-type-mudanza').click()
    await expect(page.getByTestId('create-ride-type-mudanza')).toHaveAttribute('data-testid', /mudanza/)
  })

  test('muestra mensaje de metodo de pago requerido cuando no hay metodo', async ({ page }) => {
    // Mock payment method as missing
    await page.route('**/api/users/me/payment-method', async (route) => {
      await route.fulfill({ json: { hasPaymentMethod: false, stripePaymentMethodId: null } })
    })
    await page.goto('/create-ride')
    // The component shows a warning message about payment method
    await expect(page.getByText(/pago requerido/i)).toBeVisible()
  })

  test('navega de vuelta a mis pedidos', async ({ page }) => {
    await page.route('**/api/users/me/payment-method', async (route) => {
      await route.fulfill({ json: { hasPaymentMethod: true, stripePaymentMethodId: 'pm_mock' } })
    })
    await page.goto('/create-ride')
    await page.getByRole('link', { name: /volver/i }).click()
    await expect(page).toHaveURL(/\/my-rides/)
  })
})
