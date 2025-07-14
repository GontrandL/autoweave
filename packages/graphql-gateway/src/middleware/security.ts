import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import depthLimit from 'graphql-depth-limit';
import { createComplexityLimitRule } from 'graphql-query-complexity';
import { GraphQLError } from 'graphql';
import { gatewayConfig } from '../config/gateway';
import { AuthRequest } from './auth';

// Redis client for rate limiting
const redis = new Redis({
  host: gatewayConfig.redis.host,
  port: gatewayConfig.redis.port,
  password: gatewayConfig.redis.password,
  db: gatewayConfig.redis.db,
});

/**
 * Rate limiter for GraphQL operations
 */
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'graphql_rate_limit',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 60 seconds if limit exceeded
});

/**
 * Tenant-specific rate limiter
 */
const tenantRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'tenant_rate_limit',
  points: 100,
  duration: 60,
  blockDuration: 60,
});

/**
 * Express rate limiting middleware
 */
export const expressRateLimit = rateLimit({
  windowMs: gatewayConfig.rateLimit.windowMs,
  max: gatewayConfig.rateLimit.maxRequests,
  message: {
    error: 'Too many requests from this IP',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthRequest) => {
    // Use tenant ID for authenticated users, IP for unauthenticated
    return req.user?.tenantId || req.ip;
  },
  skip: (req: AuthRequest) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/metrics';
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * GraphQL rate limiting middleware
 */
export async function graphqlRateLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const key = req.user?.tenantId || req.ip;
    const limiter = req.user?.tenantId ? tenantRateLimiter : rateLimiter;
    
    await limiter.consume(key, 1);
    
    // Store rate limiter in locals for use in GraphQL context
    res.locals.rateLimiter = limiter;
    
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many GraphQL requests, please try again later',
      retryAfter: secs
    });
  }
}

/**
 * Query depth limiting rule
 */
export const queryDepthLimit = depthLimit(gatewayConfig.security.maxQueryDepth, {
  ignore: [
    '__schema',
    '__type',
    '__Field',
    '__InputValue',
    '__EnumValue',
    '__Directive'
  ]
});

/**
 * Query complexity limiting rule
 */
export const queryComplexityLimit = createComplexityLimitRule(gatewayConfig.security.maxQueryComplexity, {
  introspection: false,
  createError: (max: number, actual: number) => {
    return new GraphQLError(`Query complexity ${actual} exceeds maximum allowed complexity ${max}`, {
      extensions: {
        code: 'QUERY_COMPLEXITY_EXCEEDED',
        http: { status: 400 },
        maxComplexity: max,
        actualComplexity: actual
      }
    });
  }
});

/**
 * Query timeout middleware
 */
export function queryTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Query timeout',
          message: 'GraphQL query took too long to execute'
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Remove potentially sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // Add CORS headers
  const allowedOrigins = gatewayConfig.security.corsOrigins;
  const origin = req.headers.origin as string;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
}

/**
 * Query validation middleware
 */
export function validateQuery(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'POST') {
    return next();
  }

  const { query, variables } = req.body;

  // Basic query validation
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Invalid query',
      message: 'GraphQL query must be a string'
    });
  }

  // Check for potentially dangerous operations
  const dangerousPatterns = [
    /\b__schema\b/,
    /\b__type\b/,
    /\bintrospection\b/i
  ];

  const isIntrospectionQuery = dangerousPatterns.some(pattern => pattern.test(query));

  if (isIntrospectionQuery && !gatewayConfig.security.introspectionEnabled) {
    return res.status(400).json({
      error: 'Introspection disabled',
      message: 'GraphQL introspection is disabled in production'
    });
  }

  // Validate variables
  if (variables && typeof variables !== 'object') {
    return res.status(400).json({
      error: 'Invalid variables',
      message: 'GraphQL variables must be an object'
    });
  }

  next();
}

/**
 * Request size limiter
 */
export function requestSizeLimit(limit: string = '1mb') {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      const maxSize = parseSize(limit);
      
      if (size > maxSize) {
        return res.status(413).json({
          error: 'Request too large',
          message: `Request size ${size} bytes exceeds maximum allowed size ${maxSize} bytes`
        });
      }
    }
    
    next();
  };
}

/**
 * Helper function to parse size strings
 */
function parseSize(size: string): number {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';

  return value * units[unit as keyof typeof units];
}

/**
 * Create security plugins for Apollo Server
 */
export function createSecurityPlugins() {
  return [
    {
      requestDidStart() {
        return {
          didResolveOperation(requestContext: any) {
            const { operationName, operation } = requestContext.request;
            
            // Log potentially suspicious operations
            if (operationName?.includes('__') || operation?.loc?.source?.body?.includes('__schema')) {
              console.warn('Potential introspection query detected:', {
                operationName,
                ip: requestContext.request.ip,
                userAgent: requestContext.request.headers['user-agent']
              });
            }
          },
          
          willSendResponse(requestContext: any) {
            // Add security headers to GraphQL responses
            const { response } = requestContext;
            
            response.http.headers.set('X-Content-Type-Options', 'nosniff');
            response.http.headers.set('X-Frame-Options', 'DENY');
            response.http.headers.set('Cache-Control', 'no-store');
          }
        };
      }
    }
  ];
}

export { rateLimiter, tenantRateLimiter };