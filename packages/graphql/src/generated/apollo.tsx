import { gql } from '@apollo/client';
import * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = {
  [_ in K]?: never;
};
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  DateTime: { input: any; output: any };
  JSON: { input: any; output: any };
  Upload: { input: any; output: any };
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
  STOPPED = 'stopped',
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

export type GetHealthMetricsQueryVariables = Exact<{ [key: string]: never }>;

export type GetHealthMetricsQuery = {
  __typename?: 'Query';
  systemHealth: {
    __typename?: 'SystemHealth';
    cpu: number;
    memory: number;
    disk: number;
    usbDevices: number;
    activePlugins: number;
    queueJobs: number;
    timestamp: any;
  };
};

export type GetHealthStatusQueryVariables = Exact<{ [key: string]: never }>;

export type GetHealthStatusQuery = {
  __typename?: 'Query';
  health: { __typename?: 'HealthStatus'; status: string; timestamp: any };
};

export type GetPluginsQueryVariables = Exact<{ [key: string]: never }>;

export type GetPluginsQuery = {
  __typename?: 'Query';
  plugins: Array<{
    __typename?: 'Plugin';
    id: string;
    name: string;
    version: string;
    status: PluginStatus;
    description: string;
    memoryUsage: number;
    author: string;
    category: string;
  }>;
};

export type TogglePluginMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type TogglePluginMutation = {
  __typename?: 'Mutation';
  togglePlugin: { __typename?: 'Plugin'; id: string; status: PluginStatus };
};

export const GetHealthMetricsDocument = gql`
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
`;

/**
 * __useGetHealthMetricsQuery__
 *
 * To run a query within a React component, call `useGetHealthMetricsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetHealthMetricsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetHealthMetricsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetHealthMetricsQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    Types.GetHealthMetricsQuery,
    Types.GetHealthMetricsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    Types.GetHealthMetricsQuery,
    Types.GetHealthMetricsQueryVariables
  >(GetHealthMetricsDocument, options);
}
export function useGetHealthMetricsLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    Types.GetHealthMetricsQuery,
    Types.GetHealthMetricsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    Types.GetHealthMetricsQuery,
    Types.GetHealthMetricsQueryVariables
  >(GetHealthMetricsDocument, options);
}
export function useGetHealthMetricsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        Types.GetHealthMetricsQuery,
        Types.GetHealthMetricsQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    Types.GetHealthMetricsQuery,
    Types.GetHealthMetricsQueryVariables
  >(GetHealthMetricsDocument, options);
}
export type GetHealthMetricsQueryHookResult = ReturnType<typeof useGetHealthMetricsQuery>;
export type GetHealthMetricsLazyQueryHookResult = ReturnType<typeof useGetHealthMetricsLazyQuery>;
export type GetHealthMetricsSuspenseQueryHookResult = ReturnType<
  typeof useGetHealthMetricsSuspenseQuery
>;
export type GetHealthMetricsQueryResult = ApolloReactCommon.QueryResult<
  Types.GetHealthMetricsQuery,
  Types.GetHealthMetricsQueryVariables
>;
export const GetHealthStatusDocument = gql`
  query GetHealthStatus {
    health {
      status
      timestamp
    }
  }
`;

/**
 * __useGetHealthStatusQuery__
 *
 * To run a query within a React component, call `useGetHealthStatusQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetHealthStatusQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetHealthStatusQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetHealthStatusQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    Types.GetHealthStatusQuery,
    Types.GetHealthStatusQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<Types.GetHealthStatusQuery, Types.GetHealthStatusQueryVariables>(
    GetHealthStatusDocument,
    options,
  );
}
export function useGetHealthStatusLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    Types.GetHealthStatusQuery,
    Types.GetHealthStatusQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    Types.GetHealthStatusQuery,
    Types.GetHealthStatusQueryVariables
  >(GetHealthStatusDocument, options);
}
export function useGetHealthStatusSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        Types.GetHealthStatusQuery,
        Types.GetHealthStatusQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    Types.GetHealthStatusQuery,
    Types.GetHealthStatusQueryVariables
  >(GetHealthStatusDocument, options);
}
export type GetHealthStatusQueryHookResult = ReturnType<typeof useGetHealthStatusQuery>;
export type GetHealthStatusLazyQueryHookResult = ReturnType<typeof useGetHealthStatusLazyQuery>;
export type GetHealthStatusSuspenseQueryHookResult = ReturnType<
  typeof useGetHealthStatusSuspenseQuery
>;
export type GetHealthStatusQueryResult = ApolloReactCommon.QueryResult<
  Types.GetHealthStatusQuery,
  Types.GetHealthStatusQueryVariables
>;
export const GetPluginsDocument = gql`
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
`;

/**
 * __useGetPluginsQuery__
 *
 * To run a query within a React component, call `useGetPluginsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPluginsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPluginsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetPluginsQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    Types.GetPluginsQuery,
    Types.GetPluginsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<Types.GetPluginsQuery, Types.GetPluginsQueryVariables>(
    GetPluginsDocument,
    options,
  );
}
export function useGetPluginsLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    Types.GetPluginsQuery,
    Types.GetPluginsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<Types.GetPluginsQuery, Types.GetPluginsQueryVariables>(
    GetPluginsDocument,
    options,
  );
}
export function useGetPluginsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        Types.GetPluginsQuery,
        Types.GetPluginsQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<Types.GetPluginsQuery, Types.GetPluginsQueryVariables>(
    GetPluginsDocument,
    options,
  );
}
export type GetPluginsQueryHookResult = ReturnType<typeof useGetPluginsQuery>;
export type GetPluginsLazyQueryHookResult = ReturnType<typeof useGetPluginsLazyQuery>;
export type GetPluginsSuspenseQueryHookResult = ReturnType<typeof useGetPluginsSuspenseQuery>;
export type GetPluginsQueryResult = ApolloReactCommon.QueryResult<
  Types.GetPluginsQuery,
  Types.GetPluginsQueryVariables
>;
export const TogglePluginDocument = gql`
  mutation TogglePlugin($id: ID!) {
    togglePlugin(id: $id) {
      id
      status
    }
  }
`;
export type TogglePluginMutationFn = ApolloReactCommon.MutationFunction<
  Types.TogglePluginMutation,
  Types.TogglePluginMutationVariables
>;

/**
 * __useTogglePluginMutation__
 *
 * To run a mutation, you first call `useTogglePluginMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useTogglePluginMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [togglePluginMutation, { data, loading, error }] = useTogglePluginMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useTogglePluginMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    Types.TogglePluginMutation,
    Types.TogglePluginMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    Types.TogglePluginMutation,
    Types.TogglePluginMutationVariables
  >(TogglePluginDocument, options);
}
export type TogglePluginMutationHookResult = ReturnType<typeof useTogglePluginMutation>;
export type TogglePluginMutationResult =
  ApolloReactCommon.MutationResult<Types.TogglePluginMutation>;
export type TogglePluginMutationOptions = ApolloReactCommon.BaseMutationOptions<
  Types.TogglePluginMutation,
  Types.TogglePluginMutationVariables
>;
