import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth, UserButton, useUser } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useNotificationBadge } from '../../contexts/NotificationBadgeContext'

function Layout() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { unreadCount } = useNotificationBadge()

  // Prevenir scroll del body cuando el menú mobile está abierto
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

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
                  onFocus={(e) => {
                    e.currentTarget.style.color = 'var(--text-primary)'
                    e.currentTarget.style.background = 'var(--surface-1)'
                  }}
                  onBlur={(e) => {
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
                  onFocus={(e) => {
                    e.currentTarget.style.color = 'var(--text-primary)'
                    e.currentTarget.style.background = 'var(--surface-1)'
                  }}
                  onBlur={(e) => {
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

                {/* Notifications Bell */}
                <Link
                  to="/notifications"
                  aria-label={t('nav.notifications')}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    textDecoration: 'none',
                    color: 'var(--text-secondary)',
                    borderRadius: '50%',
                    transition: 'all var(--duration-fast) var(--ease-out)',
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
                  <span className="material-symbols-rounded" style={{ fontSize: '1.375rem' }}>notifications</span>
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      minWidth: '16px',
                      height: '16px',
                      borderRadius: '8px',
                      background: 'var(--error)',
                      color: '#fff',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      lineHeight: 1,
                      boxShadow: '0 0 0 2px var(--surface-0)',
                    }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

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
                        label={t('nav.settings')}
                        labelIcon={<span className="material-symbols-rounded">settings</span>}
                        href="/settings"
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

          {/* Hamburger Button - Mobile Only: menu si logueado, sign-in si no */}
          <button
            onClick={() => isSignedIn ? setMobileMenuOpen(true) : navigate('/sign-in')}
            className="hamburger-btn"
            style={{
              display: 'none',
              padding: 'var(--space-2)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            aria-label={isSignedIn ? t('nav.openMenu') : t('nav.signIn')}
          >
            <span className="material-symbols-rounded">
              {isSignedIn ? 'menu' : 'login'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" style={{
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <Link
              to="/privacy"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                color: 'var(--text-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>privacy_tip</span>
              {t('footer.privacy', 'Privacidad')}
            </Link>
            <Link
              to="/terms"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                color: 'var(--text-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>description</span>
              {t('footer.terms', 'Términos')}
            </Link>
            <p>{t('layout.footer.copyright')}</p>
          </div>
        </div>
      </footer>

      {/* Mobile Menu Overlay & Drawer */}
      {mobileMenuOpen && (
        <>
          <div
            onClick={() => setMobileMenuOpen(false)}
            role="presentation"
            aria-label="Cerrar menú"
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
            overflowY: 'auto',
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
              onFocus={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'var(--surface-2)'
              }}
              onBlur={(e) => {
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
              onFocus={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'var(--surface-2)'
              }}
              onBlur={(e) => {
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
              <Link
                to="/notifications"
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
                onFocus={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)'
                  e.currentTarget.style.background = 'var(--surface-2)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>notifications</span>
                Notificaciones
                {unreadCount > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'var(--error)',
                    color: '#fff',
                    borderRadius: '999px',
                    padding: '0.125rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}>
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link
                to="/settings"
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
                onFocus={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)'
                  e.currentTarget.style.background = 'var(--surface-2)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '1.25rem' }}>settings</span>
                {t('nav.settings')}
              </Link>
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
                    label={t('nav.settings')}
                    labelIcon={<span className="material-symbols-rounded">settings</span>}
                    href="/settings"
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