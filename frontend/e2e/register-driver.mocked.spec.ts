import { expect, test } from '@playwright/test'
import { mockDriverStatus, signInAs } from './helpers/mock-app'

test.describe('register driver mocked coverage', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'driver')
  })

  test('H-11 renders registration sections, progress and required-field gating', async ({ page }) => {
    await mockDriverStatus(page, null)

    await page.goto('/register-driver')


    await expect(page.getByRole('heading', { name: /Registro como Conductor/i })).toBeVisible()
    await expect(page.getByText(/Progreso del registro/i)).toBeVisible()
    await expect(page.getByText('1/5')).toBeVisible()
    await expect(page.getByRole('button', { name: /^directions_car Vehiculo$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Docs Personales/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Docs Vehiculo/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Contacto/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Adicionales/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Datos del Vehiculo/i })).toBeVisible()
    await expect(page.getByText(/Tipo de Vehiculo/i)).toBeVisible()
    await expect(page.getByPlaceholder(/ABC-1234/i)).toBeVisible()
    await expect(page.getByPlaceholder('1000')).toBeVisible()
    await expect(page.getByRole('button', { name: /Siguiente/i })).toBeDisabled()
  })

  test('H-11 exposes each document section without upload side effects', async ({ page }) => {
    await mockDriverStatus(page, null)

    await page.goto('/register-driver')

    await page.getByRole('button', { name: /Docs Personales/i }).click()
    await expect(page.getByRole('heading', { name: /Documentos Personales/i })).toBeVisible()
    await expect(page.getByText(/Tipo de Licencia/i)).toBeVisible()
    await expect(page.getByText(/Foto de Licencia/i)).toBeVisible()
    await expect(page.getByText(/Cedula - Frente/i)).toBeVisible()
    await expect(page.getByText(/Cedula - Reverso/i)).toBeVisible()

    await page.getByRole('button', { name: /Docs Vehiculo/i }).click()
    await expect(page.getByRole('heading', { name: /Documentos del Vehiculo/i })).toBeVisible()
    await expect(page.getByText(/RUV del Vehiculo/i)).toBeVisible()
    await expect(page.getByText(/Foto de Placa Vigente/i)).toBeVisible()
    await expect(page.getByText(/Poliza de Seguro/i)).toBeVisible()

    await page.getByRole('button', { name: /Contacto/i }).click()
    await expect(page.getByRole('heading', { name: /Datos de Contacto y Ubicacion/i })).toBeVisible()
    await expect(page.getByPlaceholder(/\+507 6000-0000/i)).toBeVisible()
    await expect(page.getByText(/Esta ubicacion se usara para mostrarte pedidos cercanos/i)).toBeVisible()

    await page.getByRole('button', { name: /Adicionales/i }).click()
    await expect(page.getByRole('heading', { name: /Documentos Adicionales/i })).toBeVisible()
    await expect(page.getByText(/Carne Blanco/i)).toBeVisible()
    await expect(page.getByText(/Carne Verde/i)).toBeVisible()
    await expect(page.getByText(/Carne de Transporte de Carga/i)).toBeVisible()
    await expect(page.getByText(/Certificado de Fumigacion/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Enviar para Verificacion/i })).toBeDisabled()
  })

  test('H-11 shows existing pending verification status instead of the form', async ({ page }) => {
    await mockDriverStatus(page, {
      verificationStatus: 'pending',
      vehicleType: 'Camioneta',
      plate: 'PTY-123',
    })

    await page.goto('/register-driver')
    await expect(page.getByRole('heading', { name: /Verificacion Pendiente/i })).toBeVisible()
    await expect(page.getByText(/Tiempo estimado: 24-48 horas/i)).toBeVisible()
    await expect(page.getByText(/Camioneta - PTY-123/i)).toBeVisible()
  })
})
