'use client'

import { ReactNode } from 'react'
import { useAuth } from '../providers/auth-provider'
import { usePermission, Permission } from '../hooks/use-permission'

interface AuthGuardProps {
  children: ReactNode
  requiredPermissions?: Permission[]
  requireAll?: boolean
  fallback?: ReactNode
}

export function AuthGuard({
  children,
  requiredPermissions = [],
  requireAll = false,
  fallback = <div>Access denied</div>,
}: AuthGuardProps) {
  const { user, loading } = useAuth()
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermission()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return fallback
  }

  if (requiredPermissions.length > 0) {
    const hasAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions)

    if (!hasAccess) {
      return fallback
    }
  }

  return <>{children}</>
}