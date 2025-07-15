// GraphQL context type for resolvers
// This is a placeholder context used for code generation

export interface GraphQLContext {
  // Request context
  req?: any
  res?: any
  
  // User context
  user?: {
    id: string
    username: string
    email: string
  }
  
  // Data sources
  dataSources?: {
    // Add your data sources here
  }
  
  // Other context properties
  requestId?: string
  startTime?: number
}