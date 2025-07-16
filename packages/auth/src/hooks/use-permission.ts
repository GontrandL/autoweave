import { useAuth } from '../providers/auth-provider'

export type Permission = 
  | 'admin:read' 
  | 'admin:write' 
  | 'plugins:read' 
  | 'plugins:write' 
  | 'flows:read' 
  | 'flows:write'
  | 'chat:read' 
  | 'chat:write'

const rolePermissions: Record<string, Permission[]> = {
  admin: [
    'admin:read',
    'admin:write',
    'plugins:read',
    'plugins:write',
    'flows:read',
    'flows:write',
    'chat:read',
    'chat:write',
  ],
  developer: [
    'plugins:read',
    'plugins:write',
    'flows:read',
    'flows:write',
    'chat:read',
    'chat:write',
  ],
  user: [
    'chat:read',
    'chat:write',
  ],
}

export function usePermission() {
  const { user } = useAuth()

  const hasPermission = (permission: Permission): boolean => {
    if (!user) {return false}
    
    const userPermissions = rolePermissions[user.role] ?? []
    return userPermissions.includes(permission)
  }

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(permission => hasPermission(permission))
  }

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(permission => hasPermission(permission))
  }

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  }
}