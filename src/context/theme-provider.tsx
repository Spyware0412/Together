"use client"

import * as React from "react"
import { themes } from "@/lib/themes"
import { cn } from "@/lib/utils"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: string
  storageKey?: string
  className?: string
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
  className,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem(storageKey) : defaultTheme) || defaultTheme
  )

  const value = {
    theme,
    setTheme: (theme: string) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
        <div className={cn(
          theme,
          "h-full w-full flex flex-col bg-background text-foreground",
          className
        )}>
          {children}
        </div>
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
