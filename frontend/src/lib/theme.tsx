import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

type ThemeContextValue = {
  isDark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const stored = localStorage.getItem('avnac-theme')
      if (stored === 'dark') return true
      if (stored === 'light') return false
    } catch {}
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) root.classList.add('dark')
    else root.classList.remove('dark')
    try {
      localStorage.setItem('avnac-theme', isDark ? 'dark' : 'light')
    } catch {}
  }, [isDark])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem('avnac-theme')
        if (stored === 'dark' || stored === 'light') return
      } catch {}
      setIsDark(e.matches)
    }
    if (mq.addEventListener) {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    // fallbacks for older browsers
    // @ts-ignore
    if (mq.addListener) mq.addListener(handler)
    // @ts-ignore
    return () => mq.removeListener(handler)
  }, [])

  const toggle = useCallback(() => setIsDark(p => !p), [])

  return <ThemeContext.Provider value={{ isDark, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
