'use client'

import { logger } from '@/lib/logger'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from '@/lib/app-toast'

interface User {
  email: string
  displayName: string
  role: 'teacher' | 'manager' | 'super_admin' | 'admin' | 'hr'
  localId: string
  isAdmin?: boolean
  isAppUser?: boolean
  permissions?: string[]
  userRoles?: string[]
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  logout: () => void
  updateUser: (user: User, token: string) => void
  refreshPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  logout: () => {},
  updateUser: () => {},
  refreshPermissions: async () => {},
})

export const useAuth = () => useContext(AuthContext)

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    )
    const decoded = atob(padded)
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token)
  if (!payload) return true

  const exp = payload.exp
  if (typeof exp !== 'number') return true

  return Date.now() >= exp * 1000
}

function isStoredUserShapeValid(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false
  const user = value as Record<string, unknown>

  return (
    typeof user.email === 'string' &&
    user.email.trim().length > 0 &&
    typeof user.displayName === 'string' &&
    typeof user.localId === 'string' &&
    typeof user.role === 'string'
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Check authentication status - only run once on mount
    try {
      logger.info('Initializing auth context...')

      const storedToken = localStorage.getItem('token')
      const storedUser = localStorage.getItem('user')

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser) as unknown

        if (!isStoredUserShapeValid(parsedUser)) {
          logger.warn(
            'Stored auth user has invalid shape, clearing stale auth data',
          )
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          localStorage.removeItem('refreshToken')
          return
        }

        if (isTokenExpired(storedToken)) {
          logger.info('Stored token is expired, clearing stale auth data')
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          localStorage.removeItem('refreshToken')
          return
        }

        setToken(storedToken)
        setUser(parsedUser)
        logger.success('Auth restored from localStorage', {
          email: parsedUser.email,
        })
      } else {
        logger.info('No stored auth found')
      }
    } catch (error: any) {
      logger.error('Error initializing auth', { error: error.message })
      // Clear corrupted data
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    } finally {
      setIsLoading(false)
    }
  }, []) // Empty dependency array - only run once

  const logout = () => {
    try {
      logger.info('Logging out user', { email: user?.email })

      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('refreshToken')
      setUser(null)
      setToken(null)

      toast.success('Đăng xuất thành công!', { icon: '👋' })
      logger.success('User logged out successfully')

      router.push('/login')
    } catch (error: any) {
      logger.error('Error during logout', { error: error.message })
      toast.error('Có lỗi khi đăng xuất')
    }
  }

  const updateUser = (newUser: User, newToken: string) => {
    try {
      logger.info('Updating user in auth context', { email: newUser.email })

      localStorage.setItem('token', newToken)
      localStorage.setItem('user', JSON.stringify(newUser))
      setUser(newUser)
      setToken(newToken)

      logger.success('Auth context updated successfully', {
        email: newUser.email,
      })
    } catch (error: any) {
      logger.error('Error updating user', { error: error.message })
      toast.error('Có lỗi khi cập nhật thông tin')
    }
  }

  const refreshPermissions = async () => {
    if (!user) return

    try {
      const response = await fetch(
        `/api/check-admin?email=${encodeURIComponent(user.email)}`,
      )
      const data = await response.json()

      if (data.success && data.permissions) {
        // Compare with current permissions to avoid unnecessary updates
        const currentPerms = JSON.stringify(
          [...(user.permissions || [])].sort(),
        )
        const newPerms = JSON.stringify([...data.permissions].sort())
        const currentRole = user.role
        const newRole = data.role
        const currentUserRoles = JSON.stringify(
          [...(user.userRoles || [])].sort(),
        )
        const nextUserRoles = JSON.stringify([...(data.userRoles || [])].sort())

        if (
          currentPerms !== newPerms ||
          currentRole !== newRole ||
          currentUserRoles !== nextUserRoles
        ) {
          const updatedUser = {
            ...user,
            role: newRole,
            permissions: data.permissions,
            userRoles: data.userRoles || [],
            isAdmin: data.isAdmin,
          }

          setUser(updatedUser)
          localStorage.setItem('user', JSON.stringify(updatedUser))
          logger.success('Permissions refreshed successfully', {
            email: user.email,
          })
        }
      }
    } catch (error: any) {
      logger.error('Error refreshing permissions', { error: error.message })
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, logout, updateUser, refreshPermissions }}
    >
      {children}
    </AuthContext.Provider>
  )
}
