import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWTPayload, User, AuthenticationConfig } from '../types';
import { gatewayConfig } from '../config/gateway';

export class JWTService {
  private config: AuthenticationConfig;

  constructor(config: AuthenticationConfig = gatewayConfig.authentication) {
    this.config = config;
  }

  /**
   * Generate access token (15 minutes)
   */
  generateAccessToken(user: User): string {
    const payload: Partial<JWTPayload> = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles.map(role => role.name),
      permissions: user.permissions.map(permission => `${permission.resource}:${permission.action}`),
      type: 'access'
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.accessTokenExpiry,
      issuer: 'autoweave-gateway',
      audience: 'autoweave-api'
    });
  }

  /**
   * Generate refresh token (7 days)
   */
  generateRefreshToken(user: User): string {
    const payload: Partial<JWTPayload> = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      type: 'refresh'
    };

    return jwt.sign(payload, this.config.jwtRefreshSecret, {
      expiresIn: this.config.refreshTokenExpiry,
      issuer: 'autoweave-gateway',
      audience: 'autoweave-api'
    });
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret, {
        issuer: 'autoweave-gateway',
        audience: 'autoweave-api'
      }) as JWTPayload;

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Invalid access token: ${error.message}`);
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtRefreshSecret, {
        issuer: 'autoweave-gateway',
        audience: 'autoweave-api'
      }) as JWTPayload;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Invalid refresh token: ${error.message}`);
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds);
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }
    
    return parts[1];
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(user: User): { accessToken: string; refreshToken: string } {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user)
    };
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): any {
    return jwt.decode(token);
  }
}

export const jwtService = new JWTService();