import { expect, test, type Page } from '@playwright/test'

type ProtectedRouteCase = {
  path: string
  protectedText: RegExp
}

const protectedRoutes: ProtectedRouteCase[] = [
  { path: '/my-rides', protectedText: /Mis Pedidos/i },
  { path: '/create-ride', protectedText: /Crear Nuevo Pedido/i },
  { path: '/driver', protectedText: /Panel del Conductor|Pedidos Disponibles/i },
]

async function waitForUnauthenticatedSurface(page: Page) {
  await page.waitForFunction(() => {
    const bodyText = document.body.innerText

    return (
      window.location.pathname === '/sign-in' ||
      /Volver al inicio|Marketplace B2B de transporte|Cargando sesion/i.test(bodyText)
    )
  })
}

test.describe('protected routes', () => {
  for (const route of protectedRoutes) {
    test(`${route.path} does not expose protected content when unauthenticated`, async ({ page }) => {
      await page.goto(route.path)
      await waitForUnauthenticatedSurface(page)

      await expect(page.getByText(route.protectedText)).toHaveCount(0)

      if (new URL(page.url()).pathname !== route.path) {
        await expect(page).toHaveURL(/\/sign-in$/)
      } else {
        await expect(page.getByText(/Cargando sesion/i)).toBeVisible()
      }
    })
  }
})
