import { expect, test } from '@playwright/test'

test.describe('authentication surface', () => {
  test('sign-in page renders and navigates back home', async ({ page }) => {
    await page.goto('/sign-in')

    await expect(page.getByTestId('auth-back-to-home')).toBeVisible()
    await expect(page.locator('h1').filter({ hasText: /Carglyn/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Iniciar Ses/i })).toBeVisible()

    await page.getByTestId('auth-back-to-home').click()

    await expect(page).toHaveURL(/\/$/)
  })
})
