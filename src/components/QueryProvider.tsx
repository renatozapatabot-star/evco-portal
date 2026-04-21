'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,   // 5 minutes — customs data changes hourly, not by the second
        gcTime: 10 * 60 * 1000,     // 10 minutes — keep unused queries in cache longer
        retry: 1,
        refetchOnWindowFocus: false, // no refetch on tab switch — data is not real-time
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
