import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { createClient } from 'graphql-ws'

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
})

const wsLink = new GraphQLWsLink(
  createClient({
    url: process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || 'ws://localhost:4000/graphql',
  })
)

// The split function takes three parameters:
// * A function that returns true if the operation should use the websocket link
// * The Link to use for websocket operations
// * The Link to use for other operations
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query)
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    )
  },
  wsLink,
  httpLink
)

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
})