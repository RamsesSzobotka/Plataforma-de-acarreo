import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'

interface UploadedImage {
  url: string
  publicId?: string
}

interface MultiFileUploadProps {
  label: string
  required?: boolean
  maxFiles?: number
  value: UploadedImage[]
  onChange: (files: UploadedImage[]) => void
  folder?: string
}

export default function MultiFileUpload({
  label,
  required = false,
  maxFiles = 8,
  value = [],
  onChange,
  folder = 'rides',
}: MultiFileUploadProps) {
  const { getToken } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = useCallback(
  async (files: FileList) => {
    const remainingSlots = maxFiles - value.length

    if (remainingSlots <= 0) {
      setError(`Máximo ${maxFiles} imágenes permitidas`)
      return
    }

    setUploading(true)
    setError('')

    const filesToUpload = Array.from(files).slice(0, remainingSlots)
    const uploadedImages: UploadedImage[] = []

    try {
      const token = await getToken()

      if (!token) {
        setError('Sin autorización')
        return
      }

      for (const file of filesToUpload) {
        if (!file.type.startsWith('image/')) {
          setError(`"${file.name}" no es una imagen válida`)
          continue
        }

        if (file.size > 10 * 1024 * 1024) {
          setError(`"${file.name}" supera 10MB`)
          continue
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', folder)

        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Error al subir imagen')
        }

        uploadedImages.push({
          url: data.url,
          publicId: data.publicId,
        })
      }

      if (uploadedImages.length > 0) {
        onChange([...value, ...uploadedImages])
      }
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Error al subir imágenes')
    } finally {
      setUploading(false)
    }
  },
  [value, onChange, maxFiles, folder, getToken]
)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      uploadFiles(e.dataTransfer.files)
    },
    [uploadFiles]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        uploadFiles(e.target.files)
      }
    },
    [uploadFiles]
  )

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveImage = (index: number) => {
    const newImages = value.filter((_, i) => i !== index)
    onChange(newImages)
    setError('')
  }

  return (
    <div>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
        <span style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '0.25rem' }}>
          Máximo {maxFiles} imágenes ({value.length}/{maxFiles})
        </span>
      </label>

      {/* Image gallery */}
      {value.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {value.map((image, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  aspectRatio: '1/1',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                }}
              >
                <img
                  src={image.url}
                  alt={`Imagen ${idx + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  style={{
                    position: 'absolute',
                    top: '0.25rem',
                    right: '0.25rem',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                    close
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload area */}
      {value.length < maxFiles && (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: '12px',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'var(--primary-subtle)' : 'var(--surface-1)',
            transition: 'all 0.2s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '2rem', color: 'var(--text-muted)' }}>
              {uploading ? 'hourglass_empty' : 'image'}
            </span>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {uploading ? 'Subiendo imágenes...' : 'Arrastra imágenes aquí o haz clic'}
            </p>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              PNG, JPG hasta 10MB cada una
            </p>
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '0.75rem', color: '#EF4444', fontSize: '0.875rem' }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
