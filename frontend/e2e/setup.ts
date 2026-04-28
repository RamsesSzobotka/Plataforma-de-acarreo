import { test as setup, expect } from '@playwright/test'

/**
 * Setup para autenticacion de Clerk
 * Este archivo corre antes de los tests para establecer el estado de autenticacion
 */

// Setup: Autenticar como usuario de prueba (solo si estas en modo desarrollo)
setup('autenticarse como usuario de prueba', async ({ page }) => {
  // Skip autenticacion si ya esta logueado
  // Esto es un placeholder - en un entorno real,tendrias que configurar Clerk test mode
  
  // Por ahora, vamos a la pagina principal
  await page.goto('/')
})

// Test basico de navegacion
setup('navegacion basica', async ({ page }) => {
  await page.goto('/')
  
  // Verificar que la pagina cargo
  await expect(page).toHaveTitle(/Plataforma/i)
})