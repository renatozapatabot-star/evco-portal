'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Lazy load hook — triggers callback when element enters viewport.
 * Used for images, heavy components, and infinite scroll.
 */
export function useLazyLoad(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px', threshold: 0, ...options }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

/**
 * Prefetch on hover — preloads a route when user hovers over a link.
 */
export function usePrefetchOnHover(href: string) {
  const prefetched = useRef(false)

  const onMouseEnter = () => {
    if (prefetched.current) return
    prefetched.current = true
    // Next.js auto-prefetches Link components, but this handles dynamic routes
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = href
    document.head.appendChild(link)
  }

  return { onMouseEnter }
}
