import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User } from '@/types'
import authService from '@/services/authService'
import { getErrorMessage } from '@/services/api'

interface AuthContextType {
    user: User | null
    isLoading: boolean
    isAuthenticated: boolean
    error: string | null
    login: () => Promise<void>
    loginAsGuest: (name?: string) => Promise<void>
    logout: () => Promise<void>
    clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Check for existing auth on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const storedUser = authService.getStoredUser()
                if (storedUser && authService.isAuthenticated()) {
                    // Verify token is still valid
                    try {
                        const freshUser = await authService.getCurrentUser()
                        setUser(freshUser)
                    } catch {
                        // Token invalid, use stored user or clear
                        setUser(storedUser)
                    }
                }
            } catch (err) {
                console.error('Auth check failed:', err)
                authService.clearAuthData()
            } finally {
                setIsLoading(false)
            }
        }

        checkAuth()
    }, [])

    // Google OAuth login
    const login = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const authUrl = await authService.getGoogleAuthUrl()
            // Redirect to Google OAuth
            window.location.href = authUrl
        } catch (err) {
            setError(getErrorMessage(err))
            setIsLoading(false)
        }
    }, [])

    // Guest login
    const loginAsGuest = useCallback(async (name?: string) => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await authService.loginAsGuest(name)
            authService.saveAuthData(response)
            setUser(response.user)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Logout
    const logout = useCallback(async () => {
        setIsLoading(true)
        try {
            await authService.logout()
        } catch {
            // Ignore logout errors
        } finally {
            authService.clearAuthData()
            setUser(null)
            setIsLoading(false)
        }
    }, [])

    const clearError = useCallback(() => {
        setError(null)
    }, [])

    const value: AuthContextType = {
        user,
        isLoading,
        isAuthenticated: !!user,
        error,
        login,
        loginAsGuest,
        logout,
        clearError,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

// Hook for handling OAuth callback
export function useAuthCallback() {
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleCallback = useCallback(async (code: string, state?: string) => {
        setIsProcessing(true)
        setError(null)

        try {
            const response = await authService.handleGoogleCallback(code, state)
            authService.saveAuthData(response)
            return response.user
        } catch (err) {
            const message = getErrorMessage(err)
            setError(message)
            throw new Error(message)
        } finally {
            setIsProcessing(false)
        }
    }, [])

    return { handleCallback, isProcessing, error }
}

export default AuthContext
