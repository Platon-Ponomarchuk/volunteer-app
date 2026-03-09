import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme'
const THEME_ATTR = 'data-theme'

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute(THEME_ATTR, theme)
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { theme?: Theme } }
      const theme = parsed?.state?.theme
      if (theme === 'light' || theme === 'dark') return theme
    }
  } catch {
    // ignore
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: getInitialTheme(),
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      toggleTheme: () => {
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light'
          applyTheme(next)
          return { theme: next }
        })
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    }
  )
)

// Применить тему при первой загрузке (до гидрации zustand)
applyTheme(getInitialTheme())
