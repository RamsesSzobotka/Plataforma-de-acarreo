import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Target del proxy: en Docker se pasa via BACKEND_URL, localmente fallback a localhost
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
const WS_URL = BACKEND_URL.replace('http', 'ws')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-clerk': ['@clerk/clerk-react'],
          'vendor-stripe': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        }
      }
    }
  },
  resolve: {
    alias: {
      ...(process.env.VITE_E2E_AUTH_MOCK === '1'
        ? { '@clerk/clerk-react': path.resolve(__dirname, './src/test-mocks/clerk-react.tsx') }
        : {}),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/ws': {
        target: WS_URL,
        ws: true,
      },
    },
  },
})
