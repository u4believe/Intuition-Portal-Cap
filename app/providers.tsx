'use client'

import React, { useEffect } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { config } from '@/lib/wagmi'
import { ThemeProvider } from '@/components/theme-provider'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Suppress unhandled promise rejections from wallet connection errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes?.('Failed to connect')) {
        event.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}
