import { useState } from 'react'
import { Link } from 'react-router-dom'
import SignInCustom from '../components/SignInCustom'

function AuthPage() {
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
          Volver al inicio
        </Link>
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
                  color: '#0F172A',
                  margin: 0,
                  lineHeight: 1.2,
                }}>
                  Plataforma de Acarreos
                </h1>
                <p style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: '0.875rem',
                  color: '#64748B',
                  margin: 0,
                }}>
                  Marketplace B2B de transporte
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
                color: '#0F172A',
                margin: 0,
                lineHeight: 1.2,
              }}>
                Transporta mercancias
                <span style={{ 
                  color: userType === 'driver' ? '#F97316' : '#0D9488',
                  display: 'block',
                }}>
                  con confianza
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
                  ? 'Encuentra conductores confiables para tus necesidades de transporte.'
                  : 'Encuentra pedidos de acarreo cerca de ti y genera ingresos.'}
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
                Cliente
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
                Conductor
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
                { icon: 'inventory_2', text: 'Multiples imagenes por pedido' },
                { icon: 'location_on', text: 'Tracking en tiempo real' },
                { icon: 'chat', text: 'Chat directo con conductor' },
                { icon: 'star', text: 'Calificaciones verificadas' },
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
                    color: '#334155',
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
              No tienes cuenta?{' '}
              <Link 
                to="/" 
                style={{ 
                  color: userType === 'driver' ? '#F97316' : '#0D9488',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                Crear cuenta como {userType === 'client' ? 'cliente' : 'conductor'}
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
            2026 Plataforma de Acarreos. Todos los derechos reservados.
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