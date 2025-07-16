import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
    },
  },
})

export const graphqlFetcher = async (query: string, variables?: any) => {
  const response = await fetch(
    process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    }
  )

  if (!response.ok) {
    throw new Error('Network response was not ok')
  }

  const result = await response.json()
  
  if (result.errors) {
    throw new Error(result.errors[0].message)
  }

  return result.data
}