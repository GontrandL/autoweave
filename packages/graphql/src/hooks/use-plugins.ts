import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { graphqlFetcher } from '../tanstack/client'

const PLUGINS_QUERY = `
  query GetPlugins {
    plugins {
      id
      name
      version
      status
      description
      memoryUsage
      author
      category
    }
  }
`

const TOGGLE_PLUGIN_MUTATION = `
  mutation TogglePlugin($id: ID!) {
    togglePlugin(id: $id) {
      id
      status
    }
  }
`

export interface Plugin {
  id: string
  name: string
  version: string
  status: 'running' | 'stopped' | 'error'
  description: string
  memoryUsage: number
  author: string
  category: string
}

export function usePlugins() {
  return useQuery<{ plugins: Plugin[] }>({
    queryKey: ['plugins'],
    queryFn: () => graphqlFetcher(PLUGINS_QUERY),
  })
}

export function useTogglePlugin() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => graphqlFetcher(TOGGLE_PLUGIN_MUTATION, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
    },
  })
}