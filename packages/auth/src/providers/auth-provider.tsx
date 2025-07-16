'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'developer' | 'user'
  avatar?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loading: boolean
}

interface LoginResponse {
  user: User
  token: string
}

interface ValidateResponse {
  id: string
  email: string
  name: string
  role: 'admin' | 'developer' | 'user'
  avatar?: string
}

// Storage abstraction that works in both client and server environments
const storage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key)
    }
    return null
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, value)
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(key)
    }
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for stored auth token and validate
    const token = storage.getItem('auth-token')
    if (token) {
      // Validate token and get user info
      validateToken(token)
    } else {
      setLoading(false)
    }
  }, [])

  const validateToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/validate', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        const userData = await response.json() as ValidateResponse
        setUser(userData)
      } else {
        storage.removeItem('auth-token')
      }
    } catch (error) {
      console.error('Token validation failed:', error)
      storage.removeItem('auth-token')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const { user: userData, token } = await response.json() as LoginResponse
        storage.setItem('auth-token', token)
        setUser(userData)
      } else {
        throw new Error('Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      const token = storage.getItem('auth-token')
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      storage.removeItem('auth-token')
      setUser(null)
      setLoading(false)
    }
  }

  const value = {
    user,
    login,
    logout,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}