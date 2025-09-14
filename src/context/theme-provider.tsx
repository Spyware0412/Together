"use client"

import * as React from "react"
import { themes, Theme } from "@/lib/themes"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: string
  storageKey?: string
  attribute?: "class" | "data-theme"
  enableSystem?: boolean
}

type ThemeProviderState = {
  theme: string
  setTheme: (theme: string) => void
}

const initialState: ThemeProviderState = {
  theme: "default",
  setTheme: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "default",
  storageKey = "cinesync-theme",
  attribute = "class",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState(
    () => (typeof window !== 'undefined' && localStorage.getItem(storageKey)) || defaultTheme
  )

  React.useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove(...themes.map(t => t.name))

    if (theme === "system") {
      // This part is not fully implemented as per user request (no system theme)
      // but is good practice to keep for future extensions.
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
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
