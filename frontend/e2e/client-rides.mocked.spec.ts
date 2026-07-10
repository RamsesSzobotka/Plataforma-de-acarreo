import { expect, test } from '@playwright/test'

const mockRides = [
  {
    _id: 'ride-1',
    clientId: 'client-user',
    driverId: 'driver-user',
    title: 'Mudanza de oficina Costa del Este',
    description: 'Traslado de escritorios y sillas.',
    type: 'mudanza',
    status: 'accepted',
    estimatedPrice: 120,
    finalPrice: 140,
    images: [{ url: 'https://example.com/oficina.jpg' }],
    pickupLocation: { address: 'Costa del Este, Torre Empresarial' },
    dropoffLocation: { address: 'Obarrio, Calle 50' },
    packages: 8,
    createdAt: '2026-06-20T10:00:00.000Z',
  },
  {
    _id: 'ride-2',
    clientId: 'client-user',
    driverId: undefined,
    title: 'Entrega de muebles nuevos',
    description: 'Muebles de sala.',
    type: 'muebles',
    status: 'requested',
    estimatedPrice: 85,
    images: [{ url: 'https://example.com/muebles.jpg' }],
    pickupLocation: { address: 'San Francisco, bodega' },
    dropoffLocation: { address: 'El Cangrejo, apartamento' },
    createdAt: '2026-06-21T10:00:00.000Z',
  },
]

test.describe('client rides mocked coverage', () => {
  test('H-03 lists client rides with status filters', async ({ page }) => {
    await page.addInitScript((rides) => {
      window.localStorage.setItem('__e2e_auth_role', 'client')
      window.localStorage.setItem('i18nextLng', 'es')
      const originalFetch = window.fetch.bind(window)
      window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : (input as Request).url
        if (url.includes('/api/rides') && !url.match(/\/api\/rides\//)) {
          const urlObj = new URL(url, 'http://localhost')
          const status = urlObj.searchParams.get('status')
          const clientId = urlObj.searchParams.get('clientId')
          const filtered = rides.filter(function(r: any) {
            if (status && r.status !== status) return false
            if (clientId && r.clientId !== clientId) return false
            return true
          })
          return Promise.resolve(new Response(JSON.stringify({
            data: filtered,
            pagination: { page: 1, limit: 10, total: filtered.length, pages: 1 }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }))
        }
        return originalFetch(input, init)
      }
    }, mockRides)

    await page.goto('/my-rides')

    await expect(page.getByRole('heading', { name: /Mis Pedidos/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Publicar Pedido/i })).toBeVisible()
    await expect(page.getByText(/Mudanza de oficina Costa del Este/i)).toBeVisible()
    await expect(page.getByText(/Entrega de muebles nuevos/i)).toBeVisible()

    // Filter by "Solicitado" (requested)
    await page.getByRole('button', { name: /Solicitado/i }).click()

    await expect(page.getByText(/Entrega de muebles nuevos/i)).toBeVisible()
    await expect(page.getByText(/Mudanza de oficina Costa del Este/i)).toHaveCount(0)
  })

  test('H-03 shows empty state when filter returns no results', async ({ page }) => {
    const acceptedOnly = mockRides.filter(r => r.status === 'accepted')
    await page.addInitScript((rides) => {
      window.localStorage.setItem('__e2e_auth_role', 'client')
      window.localStorage.setItem('i18nextLng', 'es')
      const originalFetch = window.fetch.bind(window)
      window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : (input as Request).url
        if (url.includes('/api/rides') && !url.match(/\/api\/rides\//)) {
          const urlObj = new URL(url, 'http://localhost')
          const status = urlObj.searchParams.get('status')
          const clientId = urlObj.searchParams.get('clientId')
          const filtered = rides.filter(function(r: any) {
            if (status && r.status !== status) return false
            if (clientId && r.clientId !== clientId) return false
            return true
          })
          return Promise.resolve(new Response(JSON.stringify({
            data: filtered,
            pagination: { page: 1, limit: 10, total: filtered.length, pages: 1 }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }))
        }
        return originalFetch(input, init)
      }
    }, acceptedOnly)

    await page.goto('/my-rides')

    // Initial state: accepted ride visible
    await expect(page.getByText(/Mudanza de oficina Costa del Este/i)).toBeVisible()

    // Click "Cancelado" - no cancelled rides in our mock
    await page.getByRole('button', { name: /Cancelado/i }).click()

    // Should show empty state
    await expect(page.getByText(/No hay pedidos/i)).toBeVisible()
  })
})
