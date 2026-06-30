import { expect, test } from '@playwright/test'

test.describe('authentication surface', () => {
  test('sign-in page renders and navigates back home', async ({ page }) => {
    await page.goto('/sign-in')

    await expect(page.getByRole('link', { name: /Volver al inicio/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Carglyn/i })).toBeVisible()
    await expect(page.getByText(/Marketplace B2B de transporte/i)).toBeVisible()

    await page.getByRole('link', { name: /Volver al inicio/i }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: /marketplace.*conecta.*emisores.*conductores.*acarreos/i })).toBeVisible()
  })
})
