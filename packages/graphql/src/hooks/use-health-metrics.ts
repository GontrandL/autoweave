import { useQuery } from '@tanstack/react-query'
import { graphqlFetcher } from '../tanstack/client'

const HEALTH_METRICS_QUERY = `
  query GetHealthMetrics {
    systemHealth {
      cpu
      memory
      disk
      usbDevices
      activePlugins
      queueJobs
      timestamp
    }
  }
`

export interface HealthMetrics {
  cpu: number
  memory: number
  disk: number
  usbDevices: number
  activePlugins: number
  queueJobs: number
  timestamp: string
}

export function useHealthMetrics() {
  return useQuery<{ systemHealth: HealthMetrics }>({
    queryKey: ['health-metrics'],
    queryFn: () => graphqlFetcher(HEALTH_METRICS_QUERY),
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}