import { JWTService } from '../../src/auth/jwt';
import { SessionManager } from '../../src/auth/session';
import { RBACService } from '../../src/rbac/rbac';
import { User, Role, SystemPermissions } from '../../src/types';

describe('Authentication System', () => {
  let jwtService: JWTService;
  let sessionManager: SessionManager;
  let rbacService: RBACService;

  beforeEach(() => {
    jwtService = new JWTService();
    sessionManager = new SessionManager();
    rbacService = new RBACService();
  });

  afterEach(async () => {
    await sessionManager.close();
  });

  describe('JWT Service', () => {
    const mockUser: User = {
      id: 'user-1',
      email: 'test@example.com',
      tenantId: 'tenant-1',
      roles: [
        {
          id: 'role-1',
          name: 'Developer',
          description: 'Developer role',
          permissions: [
            { id: 'perm-1', name: 'agents:read', resource: 'agents', action: 'read' }
          ],
          isSystem: true,
          level: 2
        }
      ],
      permissions: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    test('should generate valid access token', () => {
      const token = jwtService.generateAccessToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    test('should generate valid refresh token', () => {
      const token = jwtService.generateRefreshToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    test('should verify access token correctly', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const decoded = jwtService.verifyAccessToken(token);
      
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.tenantId).toBe(mockUser.tenantId);
      expect(decoded.type).toBe('access');
    });

    test('should verify refresh token correctly', () => {
      const token = jwtService.generateRefreshToken(mockUser);
      const decoded = jwtService.verifyRefreshToken(token);
      
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.tenantId).toBe(mockUser.tenantId);
      expect(decoded.type).toBe('refresh');
    });

    test('should throw error for invalid access token', () => {
      expect(() => {
        jwtService.verifyAccessToken('invalid-token');
      }).toThrow('Invalid access token');
    });

    test('should throw error for invalid refresh token', () => {
      expect(() => {
        jwtService.verifyRefreshToken('invalid-token');
      }).toThrow('Invalid refresh token');
    });

    test('should extract token from authorization header', () => {
      const token = 'test-token';
      const header = `Bearer ${token}`;
      const extracted = jwtService.extractTokenFromHeader(header);
      
      expect(extracted).toBe(token);
    });

    test('should return null for invalid authorization header', () => {
      const extracted = jwtService.extractTokenFromHeader('Invalid header');
      expect(extracted).toBeNull();
    });
  });

  describe('Session Manager', () => {
    const mockUser: User = {
      id: 'user-1',
      email: 'test@example.com',
      tenantId: 'tenant-1',
      roles: [],
      permissions: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    test('should store and retrieve user session', async () => {
      const refreshToken = 'refresh-token';
      
      await sessionManager.storeUserSession(mockUser.id, mockUser, refreshToken);
      const session = await sessionManager.getUserSession(mockUser.id);
      
      expect(session).toBeDefined();
      expect(session?.user.id).toBe(mockUser.id);
      expect(session?.refreshToken).toBe(refreshToken);
    });

    test('should invalidate user session', async () => {
      const refreshToken = 'refresh-token';
      
      await sessionManager.storeUserSession(mockUser.id, mockUser, refreshToken);
      await sessionManager.invalidateUserSession(mockUser.id);
      
      const session = await sessionManager.getUserSession(mockUser.id);
      expect(session).toBeNull();
    });

    test('should retrieve user by refresh token', async () => {
      const refreshToken = 'refresh-token';
      
      await sessionManager.storeUserSession(mockUser.id, mockUser, refreshToken);
      const user = await sessionManager.getUserByRefreshToken(refreshToken);
      
      expect(user).toBeDefined();
      expect(user?.id).toBe(mockUser.id);
    });
  });

  describe('RBAC Service', () => {
    const mockUser: User = {
      id: 'user-1',
      email: 'test@example.com',
      tenantId: 'tenant-1',
      roles: [
        {
          id: 'role-1',
          name: 'Developer',
          description: 'Developer role',
          permissions: [
            { id: 'perm-1', name: 'agents:read', resource: 'agents', action: 'read' },
            { id: 'perm-2', name: 'agents:write', resource: 'agents', action: 'write' }
          ],
          isSystem: true,
          level: 2
        }
      ],
      permissions: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    test('should check if user has permission', () => {
      const hasPermission = rbacService.hasPermission(mockUser, SystemPermissions.AGENTS_READ);
      expect(hasPermission).toBe(true);
    });

    test('should check if user has role', () => {
      const hasRole = rbacService.hasRole(mockUser, 'Developer');
      expect(hasRole).toBe(true);
    });

    test('should check if user is super admin', () => {
      const isSuperAdmin = rbacService.isSuperAdmin(mockUser);
      expect(isSuperAdmin).toBe(false);
    });

    test('should check if user is tenant admin', () => {
      const isTenantAdmin = rbacService.isTenantAdmin(mockUser);
      expect(isTenantAdmin).toBe(false);
    });

    test('should get effective permissions', () => {
      const permissions = rbacService.getEffectivePermissions(mockUser);
      expect(permissions).toHaveLength(2);
      expect(permissions.find(p => p.name === 'agents:read')).toBeDefined();
      expect(permissions.find(p => p.name === 'agents:write')).toBeDefined();
    });

    test('should filter allowed resources', () => {
      const resources = [
        { id: 'resource-1', tenantId: 'tenant-1' },
        { id: 'resource-2', tenantId: 'tenant-2' }
      ];
      
      const filtered = rbacService.filterAllowedResources(
        mockUser,
        resources,
        SystemPermissions.AGENTS_READ
      );
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('resource-1');
    });
  });
});