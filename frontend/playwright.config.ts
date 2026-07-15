import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Force Spanish locale at browser level so navigator.language returns 'es-ES'
  // This fixes i18next LanguageDetector resolution to Spanish
  // Also set localStorage as fallback
  initScript: `
    localStorage.setItem('i18nextLng', 'es');
    Object.defineProperty(navigator, 'language', { value: 'es-ES', writable: true });
    Object.defineProperty(navigator, 'languages', { value: ['es-ES', 'es'], writable: true });
  `,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Locale at browser context level — this is the REAL fix for i18n
        contextOptions: {
          locale: 'es-ES',
          timezoneId: 'America/Panama',
        },
      },
    },
  ],
  webServer: {
    command: 'bun run dev -- --host 127.0.0.1',
    env: {
      VITE_E2E_AUTH_MOCK: '1',
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
