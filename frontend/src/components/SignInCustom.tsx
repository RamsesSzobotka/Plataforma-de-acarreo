import { useSearchParams } from 'react-router-dom'
import { SignIn } from '@clerk/clerk-react'

interface SignInCustomProps {
  userType?: 'client' | 'driver'
  defaultRedirectUrl?: string
}

function SignInCustom({ userType = 'client', defaultRedirectUrl }: SignInCustomProps) {
  const [searchParams] = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || defaultRedirectUrl || (userType === 'driver' ? '/register-driver' : '/my-rides')
  const primaryColor = userType === 'driver' ? '#F97316' : '#0D9488'

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    }}>
      <SignIn
        routing="path"
        path="/sign-in"
        afterSignInUrl={redirectUrl}
        signUpUrl="/sign-up"
        appearance={{
          variables: {
            colorPrimary: primaryColor,
            colorTextOnPrimaryBackground: '#FFFFFF',
            colorTextSecondary: '#64748B',
            colorText: '#0F172A',
            colorBackground: '#FFFFFF',
            colorInputBackground: '#F8FAFC',
            colorInputText: '#0F172A',
            borderRadius: '12px',
          },
          elements: {
            card: {
              borderRadius: '16px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #E2E8F0',
            },
            headerTitle: {
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: '700',
              fontSize: '24px',
              color: '#0F172A',
            },
            headerSubtitle: {
              color: '#64748B',
            },
            socialButtons: {
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
            },
            socialButtonsIconButton: {
              borderRadius: '12px',
            },
            formButtonPrimary: {
              borderRadius: '12px',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: '600',
              fontSize: '14px',
              textTransform: 'none' as const,
              backgroundColor: primaryColor,
            },
            dividerLine: {
              backgroundColor: '#E2E8F0',
            },
            dividerText: {
              color: '#64748B',
              fontFamily: '"Inter", sans-serif',
            },
            footerActionLink: {
              color: primaryColor,
              fontWeight: '500',
            },
          },
        }}
      />
    </div>
  )
}

export default SignInCustom