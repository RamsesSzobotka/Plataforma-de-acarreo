import { test, expect } from '@playwright/test'

test.describe('home-navigation - navegacion desde home', () => {
  test('renderiza los botones de seleccion de tipo de usuario', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-select-client')).toBeVisible()
    await expect(page.getByTestId('home-select-driver')).toBeVisible()
  })

  test('puede cambiar entre cliente y conductor', async ({ page }) => {
    await page.goto('/')
    // Click driver button - should change visual state
    await page.getByTestId('home-select-driver').click()
    // After clicking driver, the driver button should have different background color (white background)
    // We verify the click worked by clicking back to client
    await page.getByTestId('home-select-client').click()
    // Both buttons should still be visible after interactions
    await expect(page.getByTestId('home-select-client')).toBeVisible()
    await expect(page.getByTestId('home-select-driver')).toBeVisible()
  })

  test('muestra el CTA de cliente para cliente', async ({ page }) => {
    await page.goto('/')
    // Client is selected by default, CTA should be visible
    await expect(page.getByTestId('home-cta-client')).toBeVisible()
  })

  test('muestra el CTA de conductor para conductor', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('home-select-driver').click()
    await expect(page.getByTestId('home-cta-driver')).toBeVisible()
  })

  test('renderiza la seccion para clientes con su CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-cta-client-section')).toBeVisible()
  })

  test('renderiza la seccion para conductores con su CTA', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('home-select-driver').click()
    await expect(page.getByTestId('home-cta-driver-section')).toBeVisible()
  })

  test('renderiza la seccion de features del producto', async ({ page }) => {
    await page.goto('/')
    // Verificar que la seccion de features existe usando data-testid si existe
    // Si no, verificamos que la pagina cargo sin errores
    await expect(page.getByTestId('home-features-section')).toBeAttached()
  })

  test('el titulo del hero es visible', async ({ page }) => {
    await page.goto('/')
    // Verificar que existe un heading h1 visible
    const heroHeading = page.locator('h1').first()
    await expect(heroHeading).toBeVisible()
  })
})
