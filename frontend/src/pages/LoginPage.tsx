import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/login.css'

export default function LoginPage() {
    const { login, loginAsGuest, isLoading, isAuthenticated, error, clearError } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        if (!isAuthenticated) return

        const fromState = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
        navigate(fromState || '/', { replace: true })
    }, [isAuthenticated, location.state, navigate])

    const handleGoogleLogin = async () => {
        clearError()
        await login()
    }

    const handleGuestLogin = async () => {
        clearError()
        await loginAsGuest()
    }

    return (
        <div className="login-screen">
            <main className="login-main">
                <section className="login-card" aria-label="Login options">
                    <h1 className="login-title">CartMapper</h1>
                    <p className="login-subtitle">Sign in to continue</p>

                    <button
                        type="button"
                        className="login-option-btn login-option-google"
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                    >
                        Continue with Google
                    </button>

                    <button
                        type="button"
                        className="login-option-btn login-option-guest"
                        onClick={handleGuestLogin}
                        disabled={isLoading}
                    >
                        Continue as Guest
                    </button>

                    {error ? <p className="login-option-note is-error">{error}</p> : null}
                </section>
            </main>

            {isLoading ? (
                <div className="login-loading" aria-live="polite">
                    Signing in...
                </div>
            ) : null}
        </div>
    )
}
