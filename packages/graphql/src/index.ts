// Apollo Client
export { apolloClient } from './apollo/client'

// TanStack Query
export { queryClient, graphqlFetcher } from './tanstack/client'

// Hooks
export { useHealthMetrics, type HealthMetrics } from './hooks/use-health-metrics'
export { usePlugins, useTogglePlugin, type Plugin } from './hooks/use-plugins'

// Generated types and hooks (when codegen runs)
export * from './generated/types'

// Try to export generated Apollo hooks (graceful fallback if not generated yet)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const apolloHooks = require('./generated/apollo')
  module.exports = { ...module.exports, ...apolloHooks }
} catch {
  // Generated files not available yet - will be available after codegen
}

// Models and context types
export * from './models'
export * from './context'