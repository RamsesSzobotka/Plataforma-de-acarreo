import { expect, test } from '@playwright/test'

test.describe('public homepage', () => {
  test('renders the landing page and primary calls to action', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /marketplace.*conecta.*emisores.*conductores.*acarreos/i })).toBeVisible()
    await expect(page.getByText(/Publica tu pedido en segundos/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Soy Cliente/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Soy Conductor/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Publicar un Pedido/i })).toBeVisible()

    await page.getByRole('button', { name: /Soy Conductor/i }).click()
    await expect(page.getByRole('button', { name: /Comenzar a Ganar/i })).toBeVisible()
  })
})
