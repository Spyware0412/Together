"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { themes } from "@/lib/themes"

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
  theme: "theme-default",
  setTheme: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "theme-default",
  storageKey = "cinesync-theme",
  attribute = "class",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem(storageKey) : defaultTheme) || defaultTheme
  )

  React.useEffect(() => {
    const root = window.document.documentElement
    
    // Remove all possible theme classes
    themes.forEach(t => root.classList.remove(t.name));

    // Add the currently selected theme class
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
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={theme}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
