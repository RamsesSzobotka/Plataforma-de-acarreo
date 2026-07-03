import { Outlet, Link } from 'react-router-dom'
import { useAuth, UserButton, useUser } from '@clerk/clerk-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'

function Layout() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const { t } = useTranslation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface-0)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: 'var(--space-3) 0',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky)',
        backdropFilter: 'blur(12px)',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 clamp(1rem, 4vw, 5rem)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-6)',
        }}>
          {/* Logo */}
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              textDecoration: 'none',
            }}
          >
            <img
              src="/logos/Carglylogo.png"
              alt="Carglyn"
              style={{
                height: '40px',
                width: 'auto',
              }}
            />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--font-extrabold)',
              fontSize: 'var(--text-xl)',
              color: 'var(--text-primary)',
            }}>
              Carglyn
            </span>
          </Link>

          {/* Navigation */}
          <nav className="desktop-nav" style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'center',
          }}>
            {isSignedIn ? (
              <>
                {/* Nav Links */}
                <Link
                  to="/driver"
                  style={{
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-medium)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius)',
                    transition: 'all var(--duration-fast) var(--ease-out)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-primary)'
                    e.currentTarget.style.background = 'var(--surface-1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>dashboard</span>
                  {t('nav.driverPanel')}
                </Link>

                <Link
                  to="/my-rides"
                  style={{
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-medium)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius)',
                    transition: 'all var(--duration-fast) var(--ease-out)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-primary)'
                    e.currentTarget.style.background = 'var(--surface-1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>local_shipping</span>
                  {t('nav.myRides')}
                </Link>

                {/* CTA - Nuevo Pedido */}
                <Link
                  to="/create-ride"
                  className="btn btn-primary"
                  style={{
                    marginLeft: 'var(--space-2)',
                    animation: 'fadeInUp var(--duration-normal) var(--ease-out)',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
                  {t('nav.createRide')}
                </Link>

                <LanguageSwitcher />

                {/* User Button */}
                <div style={{
                  marginLeft: 'var(--space-3)',
                  paddingLeft: 'var(--space-3)',
                  borderLeft: '1px solid var(--border-subtle)',
                }}>
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: {
                          width: '40px',
                          height: '40px',
                          border: '2px solid var(--border)',
                          transition: 'border-color var(--duration-fast)',
                        },
                        rootBox: {
                          cursor: 'pointer',
                        },
                      },
                    }}
                  >
                    <UserButton.MenuItems>
                      <UserButton.Link
                        label={t('nav.viewPublicProfile')}
                        labelIcon={<span className="material-symbols-rounded">person</span>}
                        href={`/profile/${user?.id}`}
                      />
                      <UserButton.Link
                        label={t('nav.paymentMethod')}
                        labelIcon={<span className="material-symbols-rounded">credit_card</span>}
                        href="/add-payment-method"
                      />
                      <UserButton.Link
                        label={t('nav.mcpSettings')}
                        labelIcon={<span className="material-symbols-rounded">api</span>}
                        href="/settings/mcp"
                      />
                    </UserButton.MenuItems>
                  </UserButton>
                </div>
              </>
            ) : (
              <Link
                to="/sign-in"
                className="btn btn-primary"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>login</span>
                {t('nav.signIn')}
              </Link>
            )}
          </nav>

          {/* Hamburger Button - Mobile Only (outside desktop-nav) */}
          {isSignedIn && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="hamburger-btn"
              style={{
                display: 'none',
                padding: 'var(--space-2)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              aria-label={t('nav.openMenu')}
            >
              <span className="material-symbols-rounded">menu</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        padding: 'var(--space-8) 0',
        background: 'var(--surface-0)',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 clamp(1rem, 4vw, 5rem)',
        }}>
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        background: 'var(--surface-0)',
        borderTop: '1px solid var(--border-subtle)',
        padding: 'var(--space-6) 0',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 clamp(1rem, 4vw, 5rem)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <img src="/logos/Carglylogo.png" alt="Carglyn" style={{ height: '24px', width: 'auto' }} />
          </div>
          <p>{t('layout.footer.copyright')}</p>
        </div>
      </footer>

      {/* Mobile Menu Overlay & Drawer */}
      {mobileMenuOpen && (
        <>
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 299,
            }}
          />
          <nav style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '280px',
            background: 'var(--surface-1)',
            zIndex: 300,
            padding: 'var(--space-6)',
            transform: 'translateX(0)',
            transition: 'transform var(--duration-normal) var(--ease-out)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}>
            {/* Close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{
                alignSelf: 'flex-end',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 'var(--space-2)',
              }}
              aria-label={t('nav.closeMenu')}
            >
              <span className="material-symbols-rounded">close</span>
            </button>

            {/* Logo en drawer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <img src="/logos/Carglylogo.png" alt="Carglyn" style={{ height: '32px', width: 'auto' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-extrabold)', fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>Cargly</span>
            </div>

            {/* Menu items */}
            <Link
              to="/driver"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-medium)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius)',
                transition: 'all var(--duration-fast) var(--ease-out)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'var(--surface-2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>dashboard</span>
              Panel Conductor
            </Link>

            <Link
              to="/my-rides"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-medium)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius)',
                transition: 'all var(--duration-fast) var(--ease-out)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'var(--surface-2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>local_shipping</span>
              Mis Pedidos
            </Link>

            <Link
              to="/create-ride"
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-primary"
              style={{
                marginTop: 'var(--space-2)',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
              Nuevo Pedido
            </Link>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)' }}>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <LanguageSwitcher />
              </div>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: {
                      width: '36px',
                      height: '36px',
                      border: '2px solid var(--border)',
                    },
                  },
                }}
              >
                <UserButton.MenuItems>
                  <UserButton.Link
                    label="Ver Perfil Público"
                    labelIcon={<span className="material-symbols-rounded">person</span>}
                    href={`/profile/${user?.id}`}
                  />
                  <UserButton.Link
                    label="Método de Pago"
                    labelIcon={<span className="material-symbols-rounded">credit_card</span>}
                    href="/add-payment-method"
                  />
                  <UserButton.Link
                    label="Conexión MCP"
                    labelIcon={<span className="material-symbols-rounded">api</span>}
                    href="/settings/mcp"
                  />
                </UserButton.MenuItems>
              </UserButton>
            </div>
          </nav>
        </>
      )}
    </div>
  )
}

export default Layout