'use client'
import { useEffect } from 'react'

export function useDynamicFavicon(hasCritical: boolean) {
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
    if (!link) return
    link.href = hasCritical ? '/favicon-alert.svg' : '/favicon.svg'
  }, [hasCritical])
}
