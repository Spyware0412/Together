"use client"

import * as React from "react"
import { themes } from "@/lib/themes"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: string
  storageKey?: string
}

type ThemeProviderState = {
  theme: string
  setTheme: (theme: string) => void
}

const initialState: ThemeProviderState = {
  theme: "theme-default",
  setTheme: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "theme-default",
  storageKey = "cinesync-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem(storageKey) : defaultTheme) || defaultTheme
  )

  React.useEffect(() => {
    const root = window.document.documentElement
    
    // Remove all possible theme classes before adding the new one.
    root.classList.remove(...themes.map(t => t.name));

    if (theme) {
      root.classList.add(theme);
    }

  }, [theme])

  const value = {
    theme,
    setTheme: (theme: string) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
        {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
