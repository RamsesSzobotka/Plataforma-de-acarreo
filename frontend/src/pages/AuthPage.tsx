import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SignInCustom from '../components/SignInCustom'
import LanguageSwitcher from '../components/LanguageSwitcher'

function AuthPage() {
  const { t } = useTranslation()
  const [userType, setUserType] = useState<'client' | 'driver'>('client')

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header con boton volver */}
      <header style={{
        background: '#0F172A',
        borderBottom: '1px solid #334155',
        padding: '1rem 2rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <Link 
            to="/" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              textDecoration: 'none',
              color: '#F8FAFC',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: '600',
              fontSize: '1rem',
            }}
          >
          <span className="material-symbols-rounded" style={{ color: '#0D9488' }}>
            arrow_back
          </span>
            {t('auth.returnHome')}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Contenido principal */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '1200px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '3rem',
          alignItems: 'center',
        }}>
          {/* Lado izquierdo: Branding */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}>
            {/* Logo */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(13, 148, 136, 0.3)',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: '2rem', color: '#FFFFFF' }}>
                  local_shipping
                </span>
              </div>
              <div>
                <h1 style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: '700',
                  fontSize: '1.5rem',
                  color: '#F8FAFC',
                  margin: 0,
                  lineHeight: 1.2,
                }}>
                  Carglyn
                </h1>
                <p style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: '0.875rem',
                  color: '#64748B',
                  margin: 0,
                }}>
                  {t('home.title')}
                </p>
              </div>
            </div>

            {/* Mensaje de bienvenida */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              <h2 style={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontWeight: '700',
                fontSize: '2rem',
                color: '#F8FAFC',
                margin: 0,
                lineHeight: 1.2,
              }}>
                {t('auth.welcome')}
                <span style={{ 
                  color: userType === 'driver' ? '#F97316' : '#0D9488',
                  display: 'block',
                }}>
                  {t('auth.signIn')}
                </span>
              </h2>
              <p style={{
                fontFamily: '"Inter", sans-serif',
                fontSize: '1rem',
                color: '#64748B',
                margin: 0,
                maxWidth: '400px',
              }}>
                {userType === 'client' 
                  ? t('home.forClients.desc')
                  : t('home.forDrivers.desc')}
              </p>
            </div>

            {/* Selector de tipo */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              background: '#F1F5F9',
              padding: '0.25rem',
              borderRadius: '12px',
              width: 'fit-content',
            }}>
              <button
                onClick={() => setUserType('client')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '10px',
                  background: userType === 'client' ? '#FFFFFF' : 'transparent',
                  boxShadow: userType === 'client' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: '600',
                  fontSize: '0.8rem',
                  color: userType === 'client' ? '#0D9488' : '#64748B',
                  transition: 'all 0.2s',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                  shopping_bag
                </span>
                {t('home.clientCta')}
              </button>
              <button
                onClick={() => setUserType('driver')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '10px',
                  background: userType === 'driver' ? '#FFFFFF' : 'transparent',
                  boxShadow: userType === 'driver' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: '600',
                  fontSize: '0.8rem',
                  color: userType === 'driver' ? '#F97316' : '#64748B',
                  transition: 'all 0.2s',
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                  directions_car
                </span>
                {t('home.driverCta')}
              </button>
            </div>

            {/* Features del producto */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginTop: '0.5rem',
            }}>
              {[
                { icon: 'inventory_2', text: t('home.features.multipleImages') },
                { icon: 'location_on', text: t('home.features.realtimeTracking') },
                { icon: 'chat', text: t('home.features.directChat') },
                { icon: 'star', text: t('home.features.ratings') },
              ].map((feature, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1.25rem', color: '#0D9488' }}>
                    {feature.icon}
                  </span>
                  <span style={{
                    fontFamily: '"Inter", sans-serif',
                    fontSize: '0.875rem',
                    color: '#94A3B8',
                  }}>
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Lado derecho: SignIn */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <SignInCustom userType={userType} />
            
            {/* Link para registrarse */}
            <p style={{
              textAlign: 'center',
              fontFamily: '"Inter", sans-serif',
              fontSize: '0.875rem',
              color: '#64748B',
              marginTop: '1rem',
            }}>
              {t('auth.noAccount')}{' '}
              <Link 
                to="/" 
                style={{ 
                  color: userType === 'driver' ? '#F97316' : '#0D9488',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                {t('auth.createAccountAs', { role: userType === 'client' ? t('home.clientCta') : t('home.driverCta') })}
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        background: '#FFFFFF',
        borderTop: '1px solid #E2E8F0',
        padding: '1.5rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}>
          <p style={{
            fontFamily: '"Inter", sans-serif',
            fontSize: '0.75rem',
            color: '#64748B',
            margin: 0,
          }}>
            2026 Carglyn. Todos los derechos reservados.
          </p>
          <div style={{
            display: 'flex',
            gap: '1rem',
          }}>
            <a 
              href="#" 
              style={{
                fontFamily: '"Inter", sans-serif',
                fontSize: '0.75rem',
                color: '#0D9488',
                textDecoration: 'none',
              }}
            >
              Terminos de Servicio
            </a>
            <a 
              href="#" 
              style={{
                fontFamily: '"Inter", sans-serif',
                fontSize: '0.75rem',
                color: '#0D9488',
                textDecoration: 'none',
              }}
            >
              Politica de Privacidad
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AuthPage