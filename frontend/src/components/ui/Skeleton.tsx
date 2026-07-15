interface SkeletonProps {
  variant?: 'text' | 'card' | 'circle' | 'image' | 'line'
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  count?: number
  className?: string
  style?: React.CSSProperties
}

const variantDefaults: Record<string, { width: string; height: string; borderRadius: string }> = {
  text: { width: '100%', height: '16px', borderRadius: 'var(--radius-sm)' },
  card: { width: '100%', height: '200px', borderRadius: 'var(--radius)' },
  circle: { width: '48px', height: '48px', borderRadius: '50%' },
  image: { width: '100%', height: '150px', borderRadius: 'var(--radius)' },
  line: { width: '100%', height: '16px', borderRadius: 'var(--radius-sm)' },
}

export default function Skeleton({
  variant = 'text',
  width,
  height,
  borderRadius,
  count = 1,
  className,
  style,
}: SkeletonProps) {
  const preset = variantDefaults[variant]

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`skeleton ${className || ''}`}
          style={{
            width: width ?? preset.width,
            height: height ?? preset.height,
            borderRadius: borderRadius ?? preset.borderRadius,
            marginBottom: i < count - 1 ? '0.5rem' : undefined,
            ...(count > 1 && i === count - 1 ? { width: width ?? '60%' } : {}),
            ...style,
          }}
        />
      ))}
    </>
  )
}
