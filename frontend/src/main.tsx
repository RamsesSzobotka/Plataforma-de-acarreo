import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import App from './App'
import './styles/index.css'
import { setClerkTokenGetter } from './services/api'

// Import your publishable keys
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_placeholder'

function TokenSetter() {
  const { getToken } = useAuth()
  React.useEffect(() => {
    setClerkTokenGetter(getToken)
  }, [getToken])
  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <TokenSetter />
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>,
)