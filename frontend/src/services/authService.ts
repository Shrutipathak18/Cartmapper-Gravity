import api from './api'
import type { User, LoginResponse, AuthStatus, ForgotPasswordResponse } from '../types'

export const authService = {
    // Get Google OAuth URL
    async getGoogleAuthUrl(): Promise<string> {
        const response = await api.get<{ auth_url: string }>('/auth/google/login')
        return response.data.auth_url
    },

    // Exchange OAuth code for token
    async handleGoogleCallback(code: string, state?: string): Promise<LoginResponse> {
        const response = await api.post<LoginResponse>('/auth/google/callback', {
            code,
            state,
        })
        return response.data
    },

    // Guest login
    async loginAsGuest(name?: string): Promise<LoginResponse> {
        const response = await api.post<LoginResponse>('/auth/guest', {
            name: name || 'Guest User',
        })
        return response.data
    },

    // Forgot password
    async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
        const response = await api.post<ForgotPasswordResponse>('/auth/forgot-password', { email })
        return response.data
    },

    // Get current user
    async getCurrentUser(): Promise<User> {
        const response = await api.get<User>('/auth/me')
        return response.data
    },

    // Logout
    async logout(): Promise<void> {
        await api.post('/auth/logout')
    },

    // Check auth status
    async getAuthStatus(): Promise<AuthStatus> {
        const response = await api.get<AuthStatus>('/auth/status')
        return response.data
    },

    // Save auth data to localStorage
    saveAuthData(data: LoginResponse): void {
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('user', JSON.stringify(data.user))
    },

    // Clear auth data
    clearAuthData(): void {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
    },

    // Get stored user
    getStoredUser(): User | null {
        const userStr = localStorage.getItem('user')
        if (userStr) {
            try {
                return JSON.parse(userStr) as User
            } catch {
                return null
            }
        }
        return null
    },

    // Check if authenticated
    isAuthenticated(): boolean {
        return !!localStorage.getItem('access_token')
    },
}

export default authService
