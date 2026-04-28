import { useSearchParams } from 'react-router-dom'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import AddPaymentMethod from '../components/AddPaymentMethod'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

const stripeElementsOptions = {
  appearance: {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#0D9488',
      colorBackground: '#FFFFFF',
      colorText: '#0F172A',
      colorDanger: '#EF4444',
      fontFamily: 'Inter, sans-serif',
      borderRadius: '8px',
    },
  },
}

function AddPaymentMethodPage() {
  const [searchParams] = useSearchParams()
  const rideId = searchParams.get('rideId') || undefined

  return (
    <Elements stripe={stripePromise} options={stripeElementsOptions}>
      <AddPaymentMethod rideId={rideId} />
    </Elements>
  )
}

export default AddPaymentMethodPage