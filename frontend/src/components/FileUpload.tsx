import { useState, useRef, useCallback } from 'react'

interface FileUploadProps {
  label: string
  required?: boolean
  value?: string
  onChange: (url: string) => void
  folder?: string
}

export default function FileUpload({ 
  label, 
  required = false, 
  value, 
  onChange,
  folder = 'general' 
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(value || '')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes')
      return
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB max
      setError('La imagen no puede superar 10MB')
      return
    }
    
    setUploading(true)
    setError('')
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al subir imagen')
      }
      
      setPreview(data.url)
      onChange(data.url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }, [folder, onChange])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      uploadFile(file)
    }
  }, [uploadFile])
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadFile(file)
    }
  }, [uploadFile])
  
  const handleClick = () => {
    fileInputRef.current?.click()
  }
  
  const handleRemove = () => {
    setPreview('')
    onChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      
      {preview ? (
        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
          <img 
            src={preview} 
            alt={label}
            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }}
          />
          <button
            type="button"
            onClick={handleRemove}
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: 'rgba(0,0,0,0.6)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? '#0D9488' : '#E2E8F0'}`,
            borderRadius: '12px',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(13, 148, 136, 0.1)' : '#F8FAFC',
            transition: 'all 0.2s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          
          {uploading ? (
            <div style={{ color: '#64748B' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '32px', animation: 'spin 1s linear infinite' }}>
                sync
              </span>
              <p>Subiendo...</p>
            </div>
          ) : (
            <div style={{ color: '#64748B' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '32px', color: '#94A3B8' }}>
                cloud_upload
              </span>
              <p style={{ marginTop: '0.5rem' }}>
                Arrastra una imagen o haz clic para seleccionar
              </p>
              <p style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                PNG, JPG o WebP (máx 10MB)
              </p>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <p style={{ color: '#EF4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          {error}
        </p>
      )}
    </div>
  )
}