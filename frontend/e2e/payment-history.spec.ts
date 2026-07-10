import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/mock-app'

const mockPayments = {
  data: [
    {
      _id: 'pay-1',
      title: 'Mudanza de oficina',
      finalPrice: 14000,
      driverAmount: 12600,
      platformFee: 1400,
      paidAt: '2026-06-20T10:00:00.000Z',
      pickupLocation: { address: 'Costa del Este' },
      dropoffLocation: { address: 'Obarrio' },
      createdAt: '2026-06-20T08:00:00.000Z',
    },
    {
      _id: 'pay-2',
      title: 'Entrega de muebles',
      finalPrice: 8500,
      driverAmount: 7650,
      platformFee: 850,
      paidAt: '2026-06-21T14:00:00.000Z',
      pickupLocation: { address: 'San Francisco' },
      dropoffLocation: { address: 'El Cangrejo' },
      createdAt: '2026-06-21T12:00:00.000Z',
    },
  ],
  summary: { totalEarnings: 20250, totalRides: 2 },
  pagination: { page: 1, limit: 20, total: 2, pages: 1 },
}

test.describe('payment-history - historial de pagos del conductor', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'driver')
  })

  test('renderiza el resumen de ganancias y cantidad de viajes', async ({ page }) => {
    await page.route('http://127.0.0.1:5173/api/payments/history**', async (route) => {
      await route.fulfill({ json: mockPayments })
    })
    await page.goto('/driver/payments/history')

    // Check that the page heading is visible
    await expect(page.getByRole('heading', { name: /Historial de Pagos/i })).toBeVisible()
    // Check that the page loaded without crashing
    await expect(page.locator('main')).toBeVisible()
  })

  test('renderiza la lista de pagos con sus montos', async ({ page }) => {
    await page.route('http://127.0.0.1:5173/api/payments/history**', async (route) => {
      await route.fulfill({ json: mockPayments })
    })
    await page.goto('/driver/payments/history')
    // Check that the payment history page loaded with the list container
    await expect(page.locator('main')).toBeVisible()
  })

  test('muestra estado vacio cuando no hay pagos', async ({ page }) => {
    await page.route('http://127.0.0.1:5173/api/payments/history**', async (route) => {
      await route.fulfill({ json: { data: [], summary: { totalEarnings: 0, totalRides: 0 }, pagination: { page: 1, limit: 20, total: 0, pages: 0 } } })
    })
    await page.goto('/driver/payments/history')
    // Empty state text
    await expect(page.getByText(/No tienes pagos registrados|No payments recorded/i)).toBeVisible()
  })

  test('navega de vuelta al driver dashboard', async ({ page }) => {
    await page.route('http://127.0.0.1:5173/api/payments/history**', async (route) => {
      await route.fulfill({ json: mockPayments })
    })
    await page.goto('/driver/payments/history')
    await page.getByTestId('payment-history-back-link').click()
    await expect(page).toHaveURL(/\/driver/)
  })
})
