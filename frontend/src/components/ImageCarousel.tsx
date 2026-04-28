import React, { useState, useEffect } from 'react'

export interface ImageCarouselProps {
  images: Array<{ url: string; publicId?: string }>
  title?: string
}

/**
 * Image carousel component for ride details
 * Navigation: prev/next buttons, keyboard arrows
 * Indicators: dots showing current position
 */
export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  title,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Handle keyboard arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, images.length])

  const handlePrev = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1,
    )
  }

  const handleNext = () => {
    setCurrentIndex((prev) =>
      prev === images.length - 1 ? 0 : prev + 1,
    )
  }

  if (!images || images.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '1rem',
        }}
      >
        No hay imágenes disponibles
      </div>
    )
  }

  const currentImage = images[currentIndex]

  return (
    <div
      style={{
        width: '100%',
      }}
    >
      {/* Main image */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          marginBottom: '1rem',
        }}
      >
        <img
          src={currentImage.url}
          alt={title || `Slide ${currentIndex + 1}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Navigation buttons */}
        {images.length > 1 && (
          <>
            {/* Previous button */}
            <button
              onClick={handlePrev}
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
              }}
            >
              ‹
            </button>

            {/* Next button */}
            <button
              onClick={handleNext}
              style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
              }}
            >
              ›
            </button>

            {/* Indicators */}
            <div
              style={{
                position: 'absolute',
                bottom: '1rem',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '0.5rem',
              }}
            >
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    width: idx === currentIndex ? '0.75rem' : '0.5rem',
                    height: '0.5rem',
                    borderRadius: '9999px',
                    backgroundColor:
                      idx === currentIndex ? 'white' : 'rgba(255, 255, 255, 0.5)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                />
              ))}
            </div>

            {/* Counter */}
            <div
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            overflow: 'auto',
            paddingBottom: '0.5rem',
          }}
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: 'var(--radius-sm)',
                border:
                  idx === currentIndex ? '3px solid var(--primary)' : '1px solid var(--border)',
                padding: 0,
                cursor: 'pointer',
                overflow: 'hidden',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (idx !== currentIndex) {
                  e.currentTarget.style.borderColor = 'var(--primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (idx !== currentIndex) {
                  e.currentTarget.style.borderColor = 'var(--border)'
                }
              }}
            >
              <img
                src={img.url}
                alt={`Thumbnail ${idx + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
