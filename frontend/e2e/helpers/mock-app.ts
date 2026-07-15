import type { Page, Route } from '@playwright/test'

export type E2ERole = 'client' | 'driver' | 'admin'

export type MockRide = {
  _id: string
  clientId: string
  driverId?: string
  title: string
  description: string
  type: string
  status: string
  estimatedPrice: number
  finalPrice?: number
  images?: Array<{ url: string; publicId?: string }>
  pickupLocation: { address: string; coordinates?: [number, number] }
  dropoffLocation: { address: string; coordinates?: [number, number] }
  packages?: number
  deliveryPhoto?: { url: string; publicId?: string }
  paidAt?: string
  createdAt: string
}

export const clientRide: MockRide = {
  _id: 'ride-client-1',
  clientId: 'client-user',
  driverId: 'driver-user',
  title: 'Mudanza de oficina Costa del Este',
  description: 'Traslado de escritorios, sillas y archivadores con cuidado.',
  type: 'mudanza',
  status: 'accepted',
  estimatedPrice: 120,
  finalPrice: 140,
  images: [{ url: 'https://example.com/oficina.jpg' }],
  pickupLocation: { address: 'Costa del Este, Torre Empresarial' },
  dropoffLocation: { address: 'Obarrio, Calle 50' },
  packages: 8,
  createdAt: '2026-06-20T10:00:00.000Z',
}

export const requestedRide: MockRide = {
  ...clientRide,
  _id: 'ride-requested-1',
  driverId: undefined,
  title: 'Entrega de muebles nuevos',
  description: 'Muebles de sala embalados, requiere ayuda para cargar.',
  type: 'muebles',
  status: 'requested',
  estimatedPrice: 85,
  finalPrice: undefined,
  pickupLocation: { address: 'San Francisco, bodega principal' },
  dropoffLocation: { address: 'El Cangrejo, apartamento 4B' },
}

export const driverRide: MockRide = {
  ...clientRide,
  _id: 'ride-driver-1',
  clientId: 'another-client',
  driverId: 'driver-user',
  title: 'Transporte de productos refrigerados',
  description: 'Cajas de productos para entrega comercial.',
  type: 'productos',
  status: 'accepted',
  estimatedPrice: 160,
  finalPrice: 175,
  pickupLocation: { address: 'Mercado de Abastos' },
  dropoffLocation: { address: 'Restaurante en Casco Viejo' },
}

export async function signInAs(page: Page, role: E2ERole) {
  await page.addInitScript((authRole) => {
    window.localStorage.setItem('__e2e_auth_role', authRole)
    // Force Spanish locale for E2E tests
    window.localStorage.setItem('i18nextLng', 'es')
    class MockWebSocket extends EventTarget {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      readyState = MockWebSocket.OPEN
      onopen: ((event: Event) => void) | null = null
      onmessage: ((event: MessageEvent) => void) | null = null
      onclose: ((event: CloseEvent) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      constructor() {
        super()
        setTimeout(() => this.onopen?.(new Event('open')), 0)
      }
      send() {}
      close() {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.(new CloseEvent('close'))
      }
    }
    window.WebSocket = MockWebSocket as unknown as typeof WebSocket
  }, role)
}

export async function mockCommonApi(page: Page) {
  await page.route('**/api/messages/unread-count', async (route) => {
    await route.fulfill({ json: { data: {} } })
  })
  await page.route('**/api/users/me/payment-method', async (route) => {
    await route.fulfill({ json: { hasPaymentMethod: false, stripePaymentMethodId: null } })
  })
  await page.route('**/api/ratings/ride/**', async (route) => {
    await route.fulfill({ json: { ratings: [] } })
  })
}

export async function mockRideList(page: Page, rides: MockRide[]) {
  await page.route('**/api/rides**', async (route) => {
    const url = new URL(route.request().url())
    // Only intercept /api/rides (list endpoint), fallback for /api/rides/:id
    if (url.pathname !== '/api/rides' && url.pathname !== '/api/rides/') {
      await route.fallback()
      return
    }

    const status = url.searchParams.get('status')
    const driverId = url.searchParams.get('driverId')
    const clientId = url.searchParams.get('clientId')
    const filtered = rides.filter((ride) => {
      if (status && ride.status !== status) return false
      if (driverId && ride.driverId !== driverId) return false
      if (clientId && ride.clientId !== clientId) return false
      return true
    })

    await route.fulfill({
      json: {
        data: filtered,
        pagination: { page: 1, limit: 10, total: filtered.length, pages: Math.max(1, Math.ceil(filtered.length / 10)) },
      },
    })
  })
}

export async function mockRideDetails(page: Page, ride: MockRide, options?: { hasPaymentMethod?: boolean; hasRating?: boolean }) {
  await mockCommonApi(page)
  await page.route('**/api/users/me/payment-method', async (route) => {
    await route.fulfill({ json: { hasPaymentMethod: options?.hasPaymentMethod ?? false, stripePaymentMethodId: null } })
  })
  await page.route(`**/api/rides/${ride._id}`, async (route) => {
    await route.fulfill({ json: ride })
  })
  await page.route(`**/api/rides/${ride._id}/contacts`, async (route) => {
    await route.fulfill({ json: { data: [] } })
  })
  // Mock user profile endpoints for both client and driver
  await page.route('**/api/users/client-user', async (route) => {
    await route.fulfill({ json: { _id: 'user-client', clerkId: 'client-user', firstName: 'Carla', lastName: 'E2E', imageUrl: '', role: 'client' } })
  })
  await page.route('**/api/users/driver-user', async (route) => {
    await route.fulfill({ json: { _id: 'user-driver', clerkId: 'driver-user', firstName: 'Diego', lastName: 'Martinez', imageUrl: '', role: 'driver' } })
  })
  await page.route('**/api/users/driver/driver-user', async (route) => {
    await route.fulfill({ json: { _id: 'driver-profile', userId: 'driver-user', vehicleType: 'Camioneta', plate: 'PTY-123', rating: 4.8, totalRides: 32 } })
  })
  await page.route('**/api/ratings/ride/**', async (route) => {
    await route.fulfill({
      json: {
        ratings: options?.hasRating
          ? [{ _id: 'rating-1', rideId: ride._id, raterId: 'client-user', ratedId: 'driver-user', rating: 5, comment: 'Excelente servicio', createdAt: '2026-06-25T12:00:00.000Z' }]
          : [],
      },
    })
  })
}

// Mock Stripe para E2E — evita que intente conectar a servidores externos de Stripe
export async function mockStripe(page: Page) {
  // Interceptar el script de Stripe desde CDN y reemplazar con un mock
  await page.route('https://js.stripe.com/v3/**', async (route) => {
    const mockStripe = `
      (function() {
        window.__stripe_mock = true;
        window.Stripe = function(key) {
          return {
            elements: function() {
              return {
                getElement: function() {
                  return {
                    mount: function() {},
                    on: function() {},
                    update: function() {},
                    unmount: function() {}
                  };
                },
                create: function() {
                  return {
                    mount: function() {},
                    on: function() {},
                    update: function() {},
                    unmount: function() {}
                  };
                }
              };
            },
            confirmCardSetup: function(clientSecret, options) {
              return Promise.resolve({
                setupIntent: { payment_method: 'pm_mock_' + Date.now() },
                error: null
              });
            },
            createPaymentMethod: function() {
              return Promise.resolve({
                paymentMethod: { id: 'pm_mock_' + Date.now() },
                error: null
              });
            }
          };
        };
        window.Stripe.__oxidized = true;
      })();
    `
    await route.fulfill({
      contentType: 'application/javascript',
      body: mockStripe,
    })
  })
  // Tambien interceptar la carga del modulo ES de @stripe/stripe-js
  // Vite carga stripe-js desde js.stripe.com, entonces el route de arriba deberia bastar
}

export async function mockDriverStatus(page: Page, statusResponse: unknown, availableRides: MockRide[] = [], myRides: MockRide[] = []) {
  await mockCommonApi(page)
  await page.route('**/api/users/driver/me', async (route) => {
    if (statusResponse === null) {
      await route.fulfill({ status: 404, json: { error: 'Driver not found' } })
      return
    }
    await route.fulfill({ json: statusResponse })
  })
  // Available rides: /api/rides/available
  await page.route('**/api/rides/available**', async (route) => {
    const url = new URL(route.request().url())
    const type = url.searchParams.get('type')
    const filtered = type ? availableRides.filter((ride) => ride.type === type) : availableRides
    await route.fulfill({ json: { data: filtered, pagination: { page: 1, limit: 20, total: filtered.length, pages: 1 } } })
  })
  // My rides: /api/rides?driverId=...
  await page.route('**/api/rides**', async (route: Route) => {
    const url = new URL(route.request().url())
    if (url.pathname !== '/api/rides') return route.fallback()
    await route.fulfill({ json: { data: myRides, pagination: { page: 1, limit: 20, total: myRides.length, pages: 1 } } })
  })
}
