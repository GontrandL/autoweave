import Redis from 'ioredis';
import { User, Tenant } from '../types';
import { gatewayConfig } from '../config/gateway';

export class SessionManager {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: gatewayConfig.redis.host,
      port: gatewayConfig.redis.port,
      password: gatewayConfig.redis.password,
      db: gatewayConfig.redis.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  /**
   * Store user session
   */
  async storeUserSession(userId: string, user: User, refreshToken: string): Promise<void> {
    const sessionKey = `session:user:${userId}`;
    const refreshKey = `refresh:${refreshToken}`;
    
    const sessionData = {
      user: JSON.stringify(user),
      refreshToken,
      createdAt: new Date().toISOString(),
      lastAccess: new Date().toISOString()
    };

    const pipeline = this.redis.pipeline();
    
    // Store user session (7 days)
    pipeline.hmset(sessionKey, sessionData);
    pipeline.expire(sessionKey, 7 * 24 * 60 * 60); // 7 days
    
    // Store refresh token mapping (7 days)
    pipeline.set(refreshKey, userId);
    pipeline.expire(refreshKey, 7 * 24 * 60 * 60); // 7 days
    
    await pipeline.exec();
  }

  /**
   * Get user session
   */
  async getUserSession(userId: string): Promise<{ user: User; refreshToken: string } | null> {
    const sessionKey = `session:user:${userId}`;
    const sessionData = await this.redis.hmget(sessionKey, 'user', 'refreshToken');
    
    if (!sessionData[0] || !sessionData[1]) {
      return null;
    }

    // Update last access
    await this.redis.hset(sessionKey, 'lastAccess', new Date().toISOString());

    return {
      user: JSON.parse(sessionData[0]),
      refreshToken: sessionData[1]
    };
  }

  /**
   * Get user by refresh token
   */
  async getUserByRefreshToken(refreshToken: string): Promise<User | null> {
    const refreshKey = `refresh:${refreshToken}`;
    const userId = await this.redis.get(refreshKey);
    
    if (!userId) {
      return null;
    }

    const session = await this.getUserSession(userId);
    return session?.user || null;
  }

  /**
   * Invalidate user session
   */
  async invalidateUserSession(userId: string): Promise<void> {
    const sessionKey = `session:user:${userId}`;
    
    // Get refresh token before deleting session
    const refreshToken = await this.redis.hget(sessionKey, 'refreshToken');
    
    const pipeline = this.redis.pipeline();
    pipeline.del(sessionKey);
    
    if (refreshToken) {
      pipeline.del(`refresh:${refreshToken}`);
    }
    
    await pipeline.exec();
  }

  /**
   * Invalidate all user sessions for a tenant
   */
  async invalidateTenantSessions(tenantId: string): Promise<void> {
    const pattern = `session:user:*`;
    const keys = await this.redis.keys(pattern);
    
    const pipeline = this.redis.pipeline();
    
    for (const key of keys) {
      const userData = await this.redis.hget(key, 'user');
      if (userData) {
        const user: User = JSON.parse(userData);
        if (user.tenantId === tenantId) {
          const refreshToken = await this.redis.hget(key, 'refreshToken');
          pipeline.del(key);
          if (refreshToken) {
            pipeline.del(`refresh:${refreshToken}`);
          }
        }
      }
    }
    
    await pipeline.exec();
  }

  /**
   * Store tenant data
   */
  async storeTenant(tenant: Tenant): Promise<void> {
    const tenantKey = `tenant:${tenant.id}`;
    await this.redis.set(tenantKey, JSON.stringify(tenant), 'EX', 24 * 60 * 60); // 24 hours
  }

  /**
   * Get tenant data
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    const tenantKey = `tenant:${tenantId}`;
    const tenantData = await this.redis.get(tenantKey);
    
    if (!tenantData) {
      return null;
    }

    return JSON.parse(tenantData);
  }

  /**
   * Update user last access
   */
  async updateLastAccess(userId: string): Promise<void> {
    const sessionKey = `session:user:${userId}`;
    await this.redis.hset(sessionKey, 'lastAccess', new Date().toISOString());
  }

  /**
   * Get active sessions count for tenant
   */
  async getActiveSessionsCount(tenantId: string): Promise<number> {
    const pattern = `session:user:*`;
    const keys = await this.redis.keys(pattern);
    
    let count = 0;
    for (const key of keys) {
      const userData = await this.redis.hget(key, 'user');
      if (userData) {
        const user: User = JSON.parse(userData);
        if (user.tenantId === tenantId) {
          count++;
        }
      }
    }
    
    return count;
  }

  /**
   * Clean expired sessions
   */
  async cleanExpiredSessions(): Promise<number> {
    const pattern = `session:user:*`;
    const keys = await this.redis.keys(pattern);
    
    let cleaned = 0;
    const pipeline = this.redis.pipeline();
    
    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -1 || ttl === -2) { // Key expired or doesn't exist
        const refreshToken = await this.redis.hget(key, 'refreshToken');
        pipeline.del(key);
        if (refreshToken) {
          pipeline.del(`refresh:${refreshToken}`);
        }
        cleaned++;
      }
    }
    
    await pipeline.exec();
    return cleaned;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export const sessionManager = new SessionManager();