import { useLocation } from 'react-router-dom'
import { ReactNode, useState, useEffect } from 'react'

interface PageTransitionProps {
  children: ReactNode
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [transitionStage, setTransitionStage] = useState('enter')

  useEffect(() => {
    setTransitionStage('exit')

    const timeout = setTimeout(() => {
      setDisplayChildren(children)
      setTransitionStage('enter')
    }, 150)

    return () => clearTimeout(timeout)
  }, [location.pathname, children])

  return (
    <div
      style={{
        animation:
          transitionStage === 'enter'
            ? 'fadeInUp 250ms var(--ease-out) both'
            : 'none',
        opacity: transitionStage === 'exit' ? 0 : 1,
        transform: transitionStage === 'exit' ? 'translateY(-8px)' : 'none',
        transition:
          'opacity 150ms var(--ease-out), transform 150ms var(--ease-out)',
      }}
    >
      {displayChildren}
    </div>
  )
}
