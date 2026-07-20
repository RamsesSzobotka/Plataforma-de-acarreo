import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SignInButton, SignUpButton, useUser } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

function Home() {
  const { isSignedIn } = useUser()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [userType, setUserType] = useState<'client' | 'driver'>('client')

  // Handler inteligente para "ser conductor"
  const handleDriverCTA = () => {
    if (isSignedIn) {
      // Ya logueado -> ir directo al registro de conductor
      navigate('/register-driver')
    } else {
      // No logueado -> el SignUp ya tiene el redirect configurado
    }
  }

  return (
    <div style={{ background: '#0F172A', minHeight: '100vh' }}>
      {/* Hero Section - Impactante */}
      <div role="banner" style={{
        position: 'relative',
        padding: '5rem 0 6rem',
        background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
        overflow: 'hidden',
      }}>
        {/* Efectos de luz decorativos */}
        <div style={{
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          background: `
            radial-gradient(ellipse at 20% 0%, rgba(13, 148, 136, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 100%, rgba(249, 115, 22, 0.1) 0%, transparent 50%)
          `,
        }} />
        
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
          {!isSignedIn && (
            <div style={{ position: 'absolute', top: 0, right: '2rem' }}>
              <LanguageSwitcher />
            </div>
          )}
          <h1 style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontWeight: '800',
            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
            color: '#FFFFFF',
            marginBottom: '1.5rem',
            lineHeight: 1.1,
            maxWidth: '700px',
          }}>
            {t('home.title')}{' '}
            <span style={{ color: '#F97316' }}>{t('home.hero.emitters')}</span>
            {t('home.hero.and')}{' '}
            <span style={{ color: '#0D9488' }}>{t('home.hero.drivers')}</span>{' '}
            {t('home.hero.rides')}
          </h1>
          
          <p style={{
            fontFamily: '"Inter", sans-serif',
            fontSize: '1.25rem',
            color: 'rgba(255,255,255,0.7)',
            maxWidth: '550px',
            marginBottom: '2.5rem',
            lineHeight: 1.6,
          }}>
            {t('home.hero.subtitle')}
          </p>

          {!isSignedIn && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '1.5rem',
            }}>
              {/* Selector de tipo de usuario */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                background: 'rgba(255,255,255,0.05)',
                padding: '0.35rem',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <button
                  onClick={() => setUserType('client')}
                  style={{
                    padding: '0.875rem 1.75rem',
                    border: 'none',
                    borderRadius: '12px',
                    background: userType === 'client' ? '#FFFFFF' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    color: userType === 'client' ? '#0D9488' : '#FFFFFF',
                    transition: 'all 0.3s',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>
                    shopping_bag
                  </span>
                  {t('home.clientCta')}
                </button>
                <button
                  onClick={() => setUserType('driver')}
                  style={{
                    padding: '0.875rem 1.75rem',
                    border: 'none',
                    borderRadius: '12px',
                    background: userType === 'driver' ? '#FFFFFF' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    color: userType === 'driver' ? '#F97316' : '#FFFFFF',
                    transition: 'all 0.3s',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>
                    directions_car
                  </span>
                  {t('home.driverCta')}
                </button>
              </div>

              {/* Botones CTA */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
              }}>
                <SignUpButton mode="modal" signInFallbackRedirectUrl={userType === 'driver' ? '/register-driver' : '/my-rides'}>
                  <button 
                    style={{
                      padding: '1rem 2rem',
                      fontSize: '1rem',
                      borderRadius: '14px',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: userType === 'driver' ? '#F97316' : '#0D9488',
                      color: 'white',
                      cursor: 'pointer',
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontWeight: '700',
                      boxShadow: `0 4px 20px ${userType === 'driver' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(13, 148, 136, 0.4)'}`,
                      transition: 'all 0.3s',
                    }}
                  >
                    <span className="material-symbols-rounded">rocket_launch</span>
                    {userType === 'client' ? t('home.hero.publishRide') : t('home.hero.startEarning')}
                  </button>
                </SignUpButton>
                
                <SignInButton mode="modal">
                  <button 
                    style={{
                      padding: '1rem 2rem',
                      fontSize: '1rem',
                      borderRadius: '14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '2px solid rgba(255,255,255,0.2)',
                      color: 'white',
                      cursor: 'pointer',
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontWeight: '600',
                      transition: 'all 0.3s',
                    }}
                  >
                    <span className="material-symbols-rounded">login</span>
                    {t('home.hero.signIn')}
                  </button>
                </SignInButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seccion Como Funciona */}
      <div style={{
        padding: '5rem 0',
        background: '#0F172A',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 clamp(1rem, 4vw, 5rem)' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: '700',
              fontSize: '2.5rem',
              color: '#FFFFFF',
              marginBottom: '1rem',
            }}>
              {t('home.howItWorks')}
            </h2>
            <p style={{
              fontFamily: '"Inter", sans-serif',
              fontSize: '1.125rem',
              color: 'rgba(255,255,255,0.6)',
              maxWidth: '500px',
              margin: '0 auto',
            }}>
              {t('home.howItWorks.subtitle')}
            </p>
          </div>

          <ol style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.5rem',
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}>
            {[
              { 
                step: '01',
                icon: 'edit_note',
                title: t('home.step1.title'),
                description: t('home.step1.desc')
              },
              { 
                step: '02',
                icon: 'chat',
                title: t('home.step2.title'),
                description: t('home.step2.desc')
              },
              { 
                step: '03',
                icon: 'local_shipping',
                title: t('home.step3.title'),
                description: t('home.step3.desc')
              },
              { 
                step: '04',
                icon: 'verified',
                title: t('home.step4.title'),
                description: t('home.step4.desc')
              },
            ].map((item, index) => (
              <li key={index} style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '20px',
                padding: '2rem',
                border: '1px solid rgba(255,255,255,0.08)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-0.75rem',
                  left: '1.5rem',
                  background: '#0D9488',
                  color: 'white',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: '700',
                  fontSize: '0.7rem',
                }}>
                  {item.step}
                </div>
                
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: 'rgba(13, 148, 136, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                  marginTop: '0.5rem',
                }}>
                  <span className="material-symbols-rounded" aria-hidden="true" style={{ fontSize: '1.75rem', color: '#0D9488' }}>
                    {item.icon}
                  </span>
                </div>
                
                <h3 style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: '700',
                  fontSize: '1.125rem',
                  color: '#FFFFFF',
                  marginBottom: '0.75rem',
                }}>
                  {item.title}
                </h3>
                <p style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: '0.9rem',
                  color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  {item.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Features Grid */}
      <section aria-label="Características" style={{
        padding: '5rem 0',
        background: '#0F172A',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 clamp(1rem, 4vw, 5rem)' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {[
              { 
                icon: 'inventory_2', 
                title: t('home.features.multipleImages'),
                description: t('home.features.multipleImages.desc'),
                color: '#0D9488',
              },
              { 
                icon: 'location_on', 
                title: t('home.features.realtimeTracking'),
                description: t('home.features.realtimeTracking.desc'),
                color: '#F97316',
              },
              { 
                icon: 'chat', 
                title: t('home.features.directChat'),
                description: t('home.features.directChat.desc'),
                color: '#8B5CF6',
              },
              { 
                icon: 'star', 
                title: t('home.features.ratings'),
                description: t('home.features.ratings.desc'),
                color: '#F59E0B',
              },
              { 
                icon: 'shield', 
                title: t('home.features.securePayment'),
                description: t('home.features.securePayment.desc'),
                color: '#22C55E',
              },
              { 
                icon: 'photo_camera', 
                title: t('home.features.deliveryPhoto'),
                description: t('home.features.deliveryPhoto.desc'),
                color: '#3B82F6',
              },
            ].map((feature, index) => (
              <article
                key={index} 
                aria-labelledby={`feature-title-${index}`}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '20px',
                  padding: '1.75rem',
                  border: '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.borderColor = feature.color
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                }}
              >
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: `${feature.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                }}>
                  <span className="material-symbols-rounded" aria-hidden="true" style={{ fontSize: '1.5rem', color: feature.color }}>
                    {feature.icon}
                  </span>
                </div>
                <h3 id={`feature-title-${index}`} style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: '700',
                  fontSize: '1.1rem',
                  color: '#FFFFFF',
                  marginBottom: '0.5rem',
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: '0.9rem',
                  color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Seccion PARA CLIENTES */}
      <section aria-label="Para clientes" style={{
        padding: '5rem 0',
        background: '#0F172A',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 clamp(1rem, 4vw, 5rem)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '3rem',
            alignItems: 'center',
          }}>
            {/* Contenido izquierdo */}
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(13, 148, 136, 0.15)',
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                marginBottom: '1.5rem',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: '#0D9488' }}>
                  shopping_bag
                </span>
                <span style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: '0.875rem',
                  color: '#0D9488',
                  fontWeight: '600',
                }}>
                  {t('home.forClients.title')}
                </span>
              </div>
              
              <h2 style={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontWeight: '800',
                fontSize: '2.5rem',
                color: '#FFFFFF',
                marginBottom: '1rem',
                lineHeight: 1.2,
              }}>
                {t('home.forClients.heading')}
              </h2>
              
              <p style={{
                fontFamily: '"Inter", sans-serif',
                fontSize: '1.125rem',
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '2rem',
                lineHeight: 1.6,
              }}>
                {t('home.forClients.desc')}
              </p>
              
              <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: '0 0 2rem 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}>
                {[
                  t('home.forClients.benefit1'),
                  t('home.forClients.benefit2'),
                  t('home.forClients.benefit3'),
                  t('home.forClients.benefit4'),
                ].map((item, index) => (
                  <li key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontFamily: '"Inter", sans-serif',
                    fontSize: '0.95rem',
                    color: '#FFFFFF',
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1.25rem', color: '#0D9488' }}>
                      check_circle
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              
              <SignUpButton mode="modal">
                <button
                  style={{
                    background: '#0D9488',
                    color: 'white',
                    padding: '1rem 2rem',
                    borderRadius: '14px',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontWeight: '700',
                    fontSize: '1rem',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 20px rgba(13, 148, 136, 0.4)',
                  }}
                >
                  <span className="material-symbols-rounded">add_circle</span>
                  {t('home.forClients.cta')}
                </button>
              </SignUpButton>
            </div>
            
            {/* Cards de ejemplo derecha */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}>
              {[
                { from: 'San Miguelito', to: 'Costa del Este', price: '$45', type: 'Mudanza' },
                { from: 'Chorrera', to: 'Bella Vista', price: '$80', type: 'Productos' },
                { from: 'Arraijan', to: 'Albrook', price: '$35', type: 'Muebles' },
                { from: 'Penonome', to: 'David', price: '$150', type: 'Carga' },
              ].map((ride, index) => (
                <div key={index} style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                  }}>
                    <span style={{
                      fontSize: '0.7rem',
                      color: '#0D9488',
                      fontFamily: '"Inter", sans-serif',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                    }}>
                      {ride.type}
                    </span>
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontWeight: '700',
                      fontSize: '1rem',
                      color: '#22C55E',
                    }}>
                      {ride.price}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ fontFamily: '"Inter", sans-serif' }}>{ride.from}</span>
                    <span style={{ margin: '0 0.5rem' }}>→</span>
                    <span style={{ fontFamily: '"Inter", sans-serif' }}>{ride.to}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Seccion PARA CONDUCTORES */}
      <section aria-label="Para conductores" style={{
        padding: '5rem 0',
        background: 'rgba(249, 115, 22, 0.05)',
        borderTop: '1px solid rgba(249, 115, 22, 0.1)',
        borderBottom: '1px solid rgba(249, 115, 22, 0.1)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 clamp(1rem, 4vw, 5rem)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '3rem',
            alignItems: 'center',
          }}>
            {/* Cards de ejemplo izquierda */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}>
              {[
                { from: 'Tocumen', to: 'Marbella', price: '$60', type: 'Mudanza' },
                { from: 'La Chorerra', to: 'Brisas del Golf', price: '$55', type: 'Muebles' },
                { from: 'San Carlos', to: 'Albrook', price: '$70', type: 'Productos' },
                { from: 'Capira', to: 'El Cangrejo', price: '$90', type: 'Carga' },
              ].map((ride, index) => (
                <div key={index} style={{
                  background: 'rgba(249, 115, 22, 0.1)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  border: '1px solid rgba(249, 115, 22, 0.2)',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                  }}>
                    <span style={{
                      fontSize: '0.7rem',
                      color: '#F97316',
                      fontFamily: '"Inter", sans-serif',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                    }}>
                      {ride.type}
                    </span>
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontWeight: '700',
                      fontSize: '1rem',
                      color: '#22C55E',
                    }}>
                      {ride.price}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ fontFamily: '"Inter", sans-serif' }}>{ride.from}</span>
                    <span style={{ margin: '0 0.5rem' }}>→</span>
                    <span style={{ fontFamily: '"Inter", sans-serif' }}>{ride.to}</span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Contenido derecho */}
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(249, 115, 22, 0.15)',
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                marginBottom: '1.5rem',
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: '#F97316' }}>
                  directions_car
                </span>
                <span style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: '0.875rem',
                  color: '#F97316',
                  fontWeight: '600',
                }}>
                  {t('home.forDrivers.title')}
                </span>
              </div>
              
              <h2 style={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontWeight: '800',
                fontSize: '2.5rem',
                color: '#FFFFFF',
                marginBottom: '1rem',
                lineHeight: 1.2,
              }}>
                {t('home.forDrivers.heading')}
              </h2>
              
              <p style={{
                fontFamily: '"Inter", sans-serif',
                fontSize: '1.125rem',
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '2rem',
                lineHeight: 1.6,
              }}>
                {t('home.forDrivers.desc')}
              </p>
              
              <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: '0 0 2rem 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}>
                {[
                  t('home.forDrivers.benefit1'),
                  t('home.forDrivers.benefit2'),
                  t('home.forDrivers.benefit3'),
                  t('home.forDrivers.benefit4'),
                ].map((item, index) => (
                  <li key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontFamily: '"Inter", sans-serif',
                    fontSize: '0.95rem',
                    color: '#FFFFFF',
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1.25rem', color: '#F97316' }}>
                      check_circle
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              
              <button
                onClick={handleDriverCTA}
                style={{
                  background: '#F97316',
                  color: 'white',
                  padding: '1rem 2rem',
                  borderRadius: '14px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: '700',
                  fontSize: '1rem',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 20px rgba(249, 115, 22, 0.4)',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <span className="material-symbols-rounded">directions_car</span>
                {t('home.forDrivers.cta')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section aria-label="Registro" style={{
        padding: '5rem 0',
        background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 clamp(1rem, 4vw, 5rem)' }}>
          <h2 style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontWeight: '800',
            fontSize: '2.5rem',
            color: '#FFFFFF',
            marginBottom: '1rem',
          }}>
            {t('home.cta.title')}
          </h2>
          <p style={{
            fontFamily: '"Inter", sans-serif',
            fontSize: '1.125rem',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '2rem',
            maxWidth: '500px',
            margin: '0 auto 2rem',
          }}>
            {t('home.cta.desc')}
          </p>
          <SignUpButton mode="modal">
            <button 
              style={{
                background: '#0D9488',
                color: 'white',
                border: 'none',
                padding: '1.25rem 3rem',
                borderRadius: '14px',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontWeight: '700',
                fontSize: '1.125rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 10px 30px rgba(13, 148, 136, 0.4)',
              }}
            >
              <span className="material-symbols-rounded">rocket_launch</span>
              {t('home.cta.button')}
            </button>
          </SignUpButton>
        </div>
      </section>

      {/* Si es usuario logueado y aun no es conductor */}
      {isSignedIn && (
        <div style={{
          padding: '3rem 0',
          background: '#0F172A',
        }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 clamp(1rem, 4vw, 5rem)' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0.1) 100%)',
              borderRadius: '24px',
              padding: '2.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.5rem',
              border: '1px solid rgba(249, 115, 22, 0.2)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  background: 'rgba(249, 115, 22, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '2rem', color: '#F97316' }}>
                    directions_car
                  </span>
                </div>
                <div>
                  <h3 style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontWeight: '700',
                    fontSize: '1.25rem',
                    color: '#FFFFFF',
                    margin: 0,
                  }}>
                    {t('home.loggedIn.driverSection.title')}
                  </h3>
                  <p style={{
                    fontFamily: '"Inter", sans-serif',
                    fontSize: '0.9rem',
                    color: 'rgba(255,255,255,0.7)',
                    margin: '0.25rem 0 0',
                  }}>
                    {t('home.loggedIn.driverSection.desc')}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleDriverCTA}
                style={{
                  background: '#F97316',
                  color: 'white',
                  padding: '1rem 2rem',
                  borderRadius: '12px',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontWeight: '700',
                  fontSize: '1rem',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-rounded">how_to_reg</span>
                {t('home.forDrivers.cta')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home