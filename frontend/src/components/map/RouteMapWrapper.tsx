import { useEffect, useRef, useState, lazy, Suspense, type ReactNode } from 'react'

const RouteMapLazy = lazy(() => import('./RouteMap'))

interface RouteMapWrapperProps {
  pickup: {
    address: string
    coordinates: { lat: number; lng: number }
  }
  dropoff: {
    address: string
    coordinates: { lat: number; lng: number }
  }
  /** Ubicación en vivo del conductor (tracking) */
  driverLocation?: {
    latitude: number
    longitude: number
    heading?: number
  } | null
}

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        height: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        backgroundColor: 'var(--bg-secondary, #F8FAFC)',
        borderRadius: 'var(--radius, 12px)',
        color: 'var(--text-muted, #64748B)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: '14px',
      }}
    >
      {children}
    </div>
  )
}

export default function RouteMapWrapper(props: RouteMapWrapperProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Fallback for browsers without IntersectionObserver support
    const hasObserver = typeof IntersectionObserver !== 'undefined'
    if (!hasObserver) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }, // Start loading 200px before visible
    )

    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ minHeight: '200px', width: '100%' }}>
      {isVisible ? (
        <Suspense
          fallback={
            <Placeholder>
              <span className="material-symbols-rounded" style={{ fontSize: '2rem', opacity: 0.5 }}>
                map
              </span>
              Cargando mapa...
            </Placeholder>
          }
        >
          <RouteMapLazy {...props} />
        </Suspense>
      ) : (
        <Placeholder>
          <span className="material-symbols-rounded" style={{ fontSize: '2rem', opacity: 0.5 }}>
            map
          </span>
          Mapa de ruta
        </Placeholder>
      )}
    </div>
  )
}
