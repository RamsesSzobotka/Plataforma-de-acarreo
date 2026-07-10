import { test, expect } from '@playwright/test'
import { signInAs, mockRideDetails, clientRide } from './helpers/mock-app'

// Tests principales de chat - verifican la UI funcional
test.describe('chat - mensajeria entre cliente y conductor', () => {
  const chatRide = { ...clientRide, _id: 'ride-chat-1', status: 'accepted', driverId: 'driver-user' }

  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'client')
    await mockRideDetails(page, chatRide)
    await page.route('**/api/messages/**', async (route) => {
      await route.fulfill({ json: { data: [] } })
    })
  })

  test('renderiza el input de mensaje y boton de enviar', async ({ page }) => {
    await page.goto('/chat/ride-chat-1?driverId=driver-user&contactId=contact-1')
    await expect(page.getByTestId('chat-message-input')).toBeVisible()
    await expect(page.getByTestId('chat-send-button')).toBeVisible()
  })

  test('puede enviar un mensaje de texto', async ({ page }) => {
    await page.route('**/api/messages', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ json: { success: true } })
      } else {
        await route.fulfill({ json: { data: [] } })
      }
    })
    await page.goto('/chat/ride-chat-1?driverId=driver-user&contactId=contact-1')
    await page.getByTestId('chat-message-input').fill('Hola, cuando puedes recoger?')
    await page.getByTestId('chat-send-button').click()
    await expect(page.getByTestId('chat-message-input')).toHaveValue('')
  })

  test('navega de vuelta al panel correspondiente', async ({ page }) => {
    await page.goto('/chat/ride-chat-1?driverId=driver-user')
    await page.getByTestId('chat-back-button').click()
    await expect(page).toHaveURL(/\/(my-rides|driver)/)
  })
})
