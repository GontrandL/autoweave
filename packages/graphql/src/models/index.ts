// Model types for GraphQL resolvers
// These are placeholder types used for code generation

export interface AgentModel {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface UserModel {
  id: string
  username: string
  email: string
  createdAt: Date
  updatedAt: Date
}

export interface PluginModel {
  id: string
  name: string
  version: string
  status: 'running' | 'stopped' | 'error'
  description: string
  memoryUsage: number
  author: string
  category: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MemoryModel {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface QueueModel {
  id: string
  name: string
  status: string
  createdAt: Date
  updatedAt: Date
}