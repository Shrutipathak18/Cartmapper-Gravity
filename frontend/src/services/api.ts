import axios, { AxiosInstance, AxiosError } from 'axios'

const PRODUCTION_API_FALLBACK = 'https://cartmapper-gravity.onrender.com'
const API_BASE_URL =
    import.meta.env.VITE_API_URL?.trim() ||
    (import.meta.env.PROD ? PRODUCTION_API_FALLBACK : '/api')

// Create axios instance
export const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Request interceptor for auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }

        // Add session ID for cart operations
        const sessionId = localStorage.getItem('session_id')
        if (sessionId) {
            config.headers['X-Session-ID'] = sessionId
        }

        return config
    },
    (error) => Promise.reject(error)
)

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('access_token')
            localStorage.removeItem('user')
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

// Helper for handling API errors
export function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ detail: string }>
        return axiosError.response?.data?.detail || axiosError.message || 'An error occurred'
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'An unknown error occurred'
}

export default api
