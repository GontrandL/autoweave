export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: string; output: string; }
  JSON: { input: any; output: any; }
  Upload: { input: File; output: File; }
};

export type Agent = {
  __typename?: 'Agent';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type HealthStatus = {
  __typename?: 'HealthStatus';
  status: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
};

export type Memory = {
  __typename?: 'Memory';
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Placeholder mutation */
  ping: Scalars['String']['output'];
  /** Toggle plugin status */
  togglePlugin: Plugin;
};


export type MutationTogglePluginArgs = {
  id: Scalars['ID']['input'];
};

export type Plugin = {
  __typename?: 'Plugin';
  author: Scalars['String']['output'];
  category: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  memoryUsage: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  status: PluginStatus;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['String']['output'];
};

export enum PluginStatus {
  ERROR = 'error',
  RUNNING = 'running',
  STOPPED = 'stopped'
}

export type Query = {
  __typename?: 'Query';
  /** Health check query */
  health: HealthStatus;
  /** Get list of plugins */
  plugins: Array<Plugin>;
  /** Get system health metrics */
  systemHealth: SystemHealth;
};

export type Queue = {
  __typename?: 'Queue';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  status: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type SystemHealth = {
  __typename?: 'SystemHealth';
  activePlugins: Scalars['Int']['output'];
  cpu: Scalars['Float']['output'];
  disk: Scalars['Float']['output'];
  memory: Scalars['Float']['output'];
  queueJobs: Scalars['Int']['output'];
  timestamp: Scalars['DateTime']['output'];
  usbDevices: Scalars['Int']['output'];
};

export type User = {
  __typename?: 'User';
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
  username: Scalars['String']['output'];
};

export type GetHealthMetricsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetHealthMetricsQuery = { __typename?: 'Query', systemHealth: { __typename?: 'SystemHealth', cpu: number, memory: number, disk: number, usbDevices: number, activePlugins: number, queueJobs: number, timestamp: string } };

export type GetHealthStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type GetHealthStatusQuery = { __typename?: 'Query', health: { __typename?: 'HealthStatus', status: string, timestamp: string } };

export type GetPluginsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetPluginsQuery = { __typename?: 'Query', plugins: Array<{ __typename?: 'Plugin', id: string, name: string, version: string, status: PluginStatus, description: string, memoryUsage: number, author: string, category: string }> };

export type TogglePluginMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type TogglePluginMutation = { __typename?: 'Mutation', togglePlugin: { __typename?: 'Plugin', id: string, status: PluginStatus } };
