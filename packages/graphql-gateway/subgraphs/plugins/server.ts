import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GraphQLResolverMap } from '@apollo/subgraph/dist/schema-helper';
import { GraphQLScalarType, Kind } from 'graphql';

// GraphQL scalar types
const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO 8601 date-time string',
  serialize: (value: Date) => value.toISOString(),
  parseValue: (value: string) => new Date(value),
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON scalar type',
  serialize: (value: any) => value,
  parseValue: (value: any) => value,
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING) {
      return JSON.parse(ast.value);
    }
    return null;
  },
});

// Mock data
const mockPlugins = [
  {
    id: '1',
    name: 'Web Scraper Plugin',
    description: 'Advanced web scraping capabilities with anti-bot detection',
    version: '1.2.3',
    author: 'AutoWeave Team',
    homepage: 'https://github.com/autoweave/web-scraper-plugin',
    repository: 'https://github.com/autoweave/web-scraper-plugin',
    license: 'MIT',
    status: 'ENABLED',
    category: 'AUTOMATION',
    tags: ['scraping', 'web', 'automation', 'data-extraction'],
    manifest: {
      name: 'web-scraper-plugin',
      version: '1.2.3',
      description: 'Advanced web scraping capabilities',
      author: 'AutoWeave Team',
      license: 'MIT',
      homepage: 'https://github.com/autoweave/web-scraper-plugin',
      repository: 'https://github.com/autoweave/web-scraper-plugin',
      bugs: 'https://github.com/autoweave/web-scraper-plugin/issues',
      keywords: ['scraping', 'web', 'automation'],
      main: 'index.js',
      runtime: 'NODEJS',
      permissions: ['network:http', 'filesystem:read', 'system:process'],
      dependencies: [
        { name: 'puppeteer', version: '^21.0.0', type: 'RUNTIME', optional: false },
        { name: 'cheerio', version: '^1.0.0', type: 'RUNTIME', optional: false }
      ],
      engines: { node: '>=18.0.0' },
      scripts: { start: 'node index.js', test: 'npm test' },
      config: { timeout: 30000, retries: 3 },
      hooks: [
        { event: 'pre-scrape', handler: 'preScrapeHook', priority: 1, async: true },
        { event: 'post-scrape', handler: 'postScrapeHook', priority: 1, async: true }
      ],
      api: [
        {
          path: '/scrape',
          method: 'POST',
          handler: 'scrapeHandler',
          middleware: ['auth', 'rateLimit'],
          auth: true,
          rateLimit: 100,
          documentation: 'Scrape a web page'
        }
      ],
      ui: {
        type: 'REACT',
        entrypoint: 'ui/index.js',
        routes: [
          { path: '/scraper', component: 'ScraperComponent', exact: true, permissions: ['scraper:use'] }
        ],
        components: [
          { name: 'ScraperWidget', type: 'WIDGET', props: {}, permissions: ['scraper:view'] }
        ],
        assets: ['ui/styles.css', 'ui/logo.png'],
        permissions: ['ui:render']
      },
      security: {
        sandboxed: true,
        permissions: ['network:http', 'filesystem:read'],
        allowedDomains: ['*.example.com'],
        allowedIPs: ['0.0.0.0/0'],
        resourceLimits: {
          memory: '512Mi',
          cpu: '250m',
          disk: '1Gi',
          network: '100Mbps',
          timeout: 30000
        },
        contentSecurityPolicy: "default-src 'self'"
      },
      metadata: { category: 'automation', featured: true }
    },
    config: { timeout: 30000, retries: 3, userAgent: 'AutoWeave-Bot/1.0' },
    permissions: [
      {
        name: 'network:http',
        description: 'Access to HTTP/HTTPS requests',
        type: 'NETWORK',
        level: 'READ',
        granted: true,
        grantedBy: 'user-1',
        grantedAt: new Date('2024-01-01T00:00:00Z'),
        conditions: { domains: ['*.example.com'] }
      }
    ],
    dependencies: [
      {
        name: 'puppeteer',
        version: '^21.0.0',
        type: 'RUNTIME',
        optional: false,
        installed: true,
        availableVersion: '21.5.2',
        repository: 'https://npmjs.com/package/puppeteer',
        license: 'Apache-2.0'
      }
    ],
    metrics: {
      pluginId: '1',
      installCount: 150,
      activeUsers: 45,
      usageCount: 1250,
      errorCount: 23,
      avgResponseTime: 2500,
      cpuUsage: 15.3,
      memoryUsage: 128.5,
      diskUsage: 512.0,
      networkUsage: 1024.0,
      lastUsed: new Date(),
      uptime: 98.5,
      performance: {
        avgExecutionTime: 2500,
        minExecutionTime: 500,
        maxExecutionTime: 30000,
        p95ExecutionTime: 8000,
        p99ExecutionTime: 15000,
        throughput: 25.5,
        errorRate: 0.018
      },
      errors: [
        {
          timestamp: new Date(),
          message: 'Timeout error during scraping',
          stack: 'Error: Timeout at...',
          level: 'ERROR',
          context: { url: 'https://example.com' }
        }
      ]
    },
    tenantId: 'tenant-1',
    installedBy: 'user-1',
    installedAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    lastUsed: new Date(),
    usageCount: 1250,
    isEnabled: true,
    isSystem: false,
    isVerified: true,
    source: {
      type: 'GIT',
      url: 'https://github.com/autoweave/web-scraper-plugin',
      branch: 'main',
      commit: 'abc123',
      tag: 'v1.2.3',
      credentials: null
    },
    checksum: 'sha256:abc123def456',
    size: 1024000,
    supportedPlatforms: ['linux', 'darwin', 'win32'],
    minVersion: '1.0.0',
    maxVersion: '2.0.0',
    screenshots: ['screenshot1.png', 'screenshot2.png'],
    documentation: 'https://docs.example.com/web-scraper-plugin',
    changelog: '# Changelog\n\n## v1.2.3\n- Bug fixes and improvements'
  }
];

const mockRegistryEntries = [
  {
    name: 'web-scraper-plugin',
    version: '1.2.3',
    description: 'Advanced web scraping capabilities',
    author: 'AutoWeave Team',
    category: 'AUTOMATION',
    tags: ['scraping', 'web', 'automation'],
    downloadCount: 1500,
    rating: 4.5,
    lastUpdated: new Date('2024-01-01T00:00:00Z'),
    verified: true,
    source: 'https://github.com/autoweave/web-scraper-plugin',
    license: 'MIT',
    documentation: 'https://docs.example.com/web-scraper-plugin',
    screenshots: ['screenshot1.png', 'screenshot2.png']
  }
];

const mockMarketplacePlugins = [
  {
    id: '1',
    name: 'Web Scraper Plugin',
    description: 'Advanced web scraping capabilities with anti-bot detection',
    version: '1.2.3',
    author: 'AutoWeave Team',
    category: 'AUTOMATION',
    tags: ['scraping', 'web', 'automation'],
    downloadCount: 1500,
    rating: 4.5,
    reviews: [
      {
        id: '1',
        pluginId: '1',
        userId: 'user-2',
        rating: 5,
        title: 'Excellent plugin!',
        comment: 'Works perfectly for my scraping needs',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        helpful: 12,
        verified: true
      }
    ],
    screenshots: ['screenshot1.png', 'screenshot2.png'],
    documentation: 'https://docs.example.com/web-scraper-plugin',
    changelog: '# Changelog\n\n## v1.2.3\n- Bug fixes and improvements',
    price: 0,
    currency: 'USD',
    license: 'MIT',
    source: 'https://github.com/autoweave/web-scraper-plugin',
    verified: true,
    featured: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    compatibility: ['>=1.0.0'],
    supportedPlatforms: ['linux', 'darwin', 'win32'],
    minVersion: '1.0.0',
    maxVersion: '2.0.0'
  }
];

// GraphQL resolvers
const resolvers: GraphQLResolverMap = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,
  
  Query: {
    plugins: (parent, args, context) => {
      let plugins = mockPlugins;
      
      if (args.tenantId) {
        plugins = plugins.filter(plugin => plugin.tenantId === args.tenantId);
      }
      
      if (args.status) {
        plugins = plugins.filter(plugin => plugin.status === args.status);
      }
      
      return plugins;
    },
    
    plugin: (parent, args) => {
      return mockPlugins.find(plugin => plugin.id === args.id);
    },
    
    pluginRegistry: () => {
      return mockRegistryEntries;
    },
    
    pluginManifest: (parent, args) => {
      const plugin = mockPlugins.find(p => p.id === args.id);
      return plugin?.manifest || null;
    },
    
    pluginPermissions: (parent, args) => {
      const plugin = mockPlugins.find(p => p.id === args.id);
      return plugin?.permissions || [];
    },
    
    pluginMetrics: (parent, args) => {
      const plugin = mockPlugins.find(p => p.id === args.id);
      return plugin?.metrics || null;
    },
    
    pluginDependencies: (parent, args) => {
      const plugin = mockPlugins.find(p => p.id === args.id);
      return plugin?.dependencies || [];
    },
    
    pluginMarketplace: (parent, args) => {
      let plugins = mockMarketplacePlugins;
      
      if (args.category) {
        plugins = plugins.filter(plugin => plugin.category === args.category);
      }
      
      if (args.search) {
        const searchTerm = args.search.toLowerCase();
        plugins = plugins.filter(plugin => 
          plugin.name.toLowerCase().includes(searchTerm) ||
          plugin.description.toLowerCase().includes(searchTerm) ||
          plugin.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }
      
      return plugins;
    }
  },
  
  Mutation: {
    installPlugin: async (parent, { input }, context) => {
      const newPlugin = {
        id: `plugin-${Date.now()}`,
        name: `Plugin from ${input.source}`,
        description: 'Installed plugin',
        version: input.version || '1.0.0',
        author: 'Unknown',
        homepage: input.source,
        repository: input.source,
        license: 'Unknown',
        status: 'INSTALLING',
        category: 'CUSTOM',
        tags: [],
        manifest: {
          name: `plugin-${Date.now()}`,
          version: input.version || '1.0.0',
          description: 'Installed plugin',
          author: 'Unknown',
          license: 'Unknown',
          keywords: [],
          main: 'index.js',
          runtime: 'NODEJS',
          permissions: input.permissions || [],
          dependencies: [],
          engines: { node: '>=18.0.0' },
          hooks: [],
          api: [],
          security: {
            sandboxed: true,
            permissions: input.permissions || [],
            allowedDomains: [],
            allowedIPs: [],
            resourceLimits: {
              memory: '256Mi',
              cpu: '100m',
              disk: '512Mi',
              network: '10Mbps',
              timeout: 30000
            }
          },
          metadata: {}
        },
        config: input.config || {},
        permissions: [],
        dependencies: [],
        metrics: {
          pluginId: `plugin-${Date.now()}`,
          installCount: 1,
          activeUsers: 1,
          usageCount: 0,
          errorCount: 0,
          avgResponseTime: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0,
          networkUsage: 0,
          lastUsed: null,
          uptime: 0,
          performance: {
            avgExecutionTime: 0,
            minExecutionTime: 0,
            maxExecutionTime: 0,
            p95ExecutionTime: 0,
            p99ExecutionTime: 0,
            throughput: 0,
            errorRate: 0
          },
          errors: []
        },
        tenantId: context.user.tenantId,
        installedBy: context.user.id,
        installedAt: new Date(),
        updatedAt: new Date(),
        lastUsed: null,
        usageCount: 0,
        isEnabled: input.autoEnable !== false,
        isSystem: false,
        isVerified: false,
        source: {
          type: 'GIT',
          url: input.source,
          branch: 'main',
          commit: null,
          tag: null,
          credentials: null
        },
        checksum: 'sha256:pending',
        size: 0,
        supportedPlatforms: ['linux', 'darwin', 'win32'],
        minVersion: null,
        maxVersion: null,
        screenshots: [],
        documentation: null,
        changelog: null
      };
      
      mockPlugins.push(newPlugin);
      
      // Simulate installation progress
      setTimeout(() => {
        newPlugin.status = 'INSTALLED';
        if (input.autoEnable !== false) {
          newPlugin.status = 'ENABLED';
        }
      }, 1000);
      
      return newPlugin;
    },
    
    uninstallPlugin: async (parent, { id }, context) => {
      const index = mockPlugins.findIndex(p => p.id === id);
      if (index === -1) {
        throw new Error('Plugin not found');
      }
      
      mockPlugins.splice(index, 1);
      return true;
    },
    
    updatePlugin: async (parent, { id, input }, context) => {
      const plugin = mockPlugins.find(p => p.id === id);
      if (!plugin) {
        throw new Error('Plugin not found');
      }
      
      if (input.version) plugin.version = input.version;
      if (input.config) plugin.config = { ...plugin.config, ...input.config };
      if (input.permissions) {
        plugin.permissions = input.permissions.map(perm => ({
          name: perm,
          description: `Permission ${perm}`,
          type: 'SYSTEM',
          level: 'READ',
          granted: true,
          grantedBy: context.user.id,
          grantedAt: new Date(),
          conditions: {}
        }));
      }
      
      plugin.updatedAt = new Date();
      
      return plugin;
    },
    
    enablePlugin: async (parent, { id }, context) => {
      const plugin = mockPlugins.find(p => p.id === id);
      if (!plugin) {
        throw new Error('Plugin not found');
      }
      
      plugin.status = 'ENABLED';
      plugin.isEnabled = true;
      plugin.updatedAt = new Date();
      
      return plugin;
    },
    
    disablePlugin: async (parent, { id }, context) => {
      const plugin = mockPlugins.find(p => p.id === id);
      if (!plugin) {
        throw new Error('Plugin not found');
      }
      
      plugin.status = 'DISABLED';
      plugin.isEnabled = false;
      plugin.updatedAt = new Date();
      
      return plugin;
    },
    
    configurePlugin: async (parent, { id, config }, context) => {
      const plugin = mockPlugins.find(p => p.id === id);
      if (!plugin) {
        throw new Error('Plugin not found');
      }
      
      plugin.config = { ...plugin.config, ...config };
      plugin.updatedAt = new Date();
      
      return plugin;
    },
    
    grantPluginPermission: async (parent, { id, permission }, context) => {
      const plugin = mockPlugins.find(p => p.id === id);
      if (!plugin) {
        throw new Error('Plugin not found');
      }
      
      const existingPermission = plugin.permissions.find(p => p.name === permission);
      if (existingPermission) {
        existingPermission.granted = true;
        existingPermission.grantedBy = context.user.id;
        existingPermission.grantedAt = new Date();
      } else {
        plugin.permissions.push({
          name: permission,
          description: `Permission ${permission}`,
          type: 'SYSTEM',
          level: 'READ',
          granted: true,
          grantedBy: context.user.id,
          grantedAt: new Date(),
          conditions: {}
        });
      }
      
      return true;
    },
    
    revokePluginPermission: async (parent, { id, permission }, context) => {
      const plugin = mockPlugins.find(p => p.id === id);
      if (!plugin) {
        throw new Error('Plugin not found');
      }
      
      const existingPermission = plugin.permissions.find(p => p.name === permission);
      if (existingPermission) {
        existingPermission.granted = false;
        existingPermission.grantedBy = context.user.id;
        existingPermission.grantedAt = new Date();
      }
      
      return true;
    },
    
    publishPlugin: async (parent, { input }, context) => {
      const newMarketplacePlugin = {
        id: `marketplace-${Date.now()}`,
        name: input.name,
        description: input.description,
        version: input.version,
        author: context.user.id,
        category: input.category,
        tags: input.tags,
        downloadCount: 0,
        rating: 0,
        reviews: [],
        screenshots: input.screenshots || [],
        documentation: input.documentation || '',
        changelog: '',
        price: input.price || 0,
        currency: input.currency || 'USD',
        license: input.license,
        source: input.source,
        verified: false,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        compatibility: ['>=1.0.0'],
        supportedPlatforms: ['linux', 'darwin', 'win32'],
        minVersion: null,
        maxVersion: null
      };
      
      mockMarketplacePlugins.push(newMarketplacePlugin);
      return newMarketplacePlugin;
    },
    
    unpublishPlugin: async (parent, { id }, context) => {
      const index = mockMarketplacePlugins.findIndex(p => p.id === id);
      if (index === -1) {
        throw new Error('Plugin not found in marketplace');
      }
      
      mockMarketplacePlugins.splice(index, 1);
      return true;
    },
    
    validatePlugin: async (parent, { source }, context) => {
      // Mock validation
      return {
        valid: true,
        errors: [],
        warnings: [
          {
            field: 'manifest.permissions',
            message: 'Consider using more specific permissions',
            code: 'W001'
          }
        ],
        manifest: mockPlugins[0].manifest,
        security: {
          score: 8.5,
          issues: [
            {
              severity: 'MEDIUM',
              type: 'permissions',
              description: 'Plugin requests broad network access',
              recommendation: 'Limit network access to specific domains'
            }
          ],
          recommendations: [
            'Use more specific permissions',
            'Implement proper input validation'
          ]
        },
        performance: {
          score: 7.8,
          issues: [
            {
              severity: 'LOW',
              type: 'memory',
              description: 'Plugin may use excessive memory',
              recommendation: 'Optimize memory usage'
            }
          ],
          recommendations: [
            'Implement memory pooling',
            'Use streaming for large data sets'
          ]
        }
      };
    }
  },
  
  Plugin: {
    __resolveReference: (plugin: any) => {
      return mockPlugins.find(p => p.id === plugin.id);
    }
  }
};

// Create Apollo Server
async function startServer() {
  const typeDefs = readFileSync(join(__dirname, 'schema.graphql'), 'utf8');
  
  const server = new ApolloServer({
    schema: buildSubgraphSchema({
      typeDefs,
      resolvers
    })
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: 4004 },
    context: async ({ req }) => {
      return {
        user: {
          id: 'user-1',
          tenantId: 'tenant-1',
          roles: [{ name: 'Developer' }]
        }
      };
    }
  });

  console.log(`🔌 Plugins subgraph ready at: ${url}`);
}

if (require.main === module) {
  startServer().catch(console.error);
}

export { resolvers };