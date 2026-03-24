import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthCallback } from '../context/AuthContext'
import LoadingSpinner from '../components/common/LoadingSpinner'

const inFlightCallbacks = new Map<string, Promise<void>>()
const completedCodes = new Set<string>()

export default function AuthCallbackPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { handleCallback, error } = useAuthCallback()

    useEffect(() => {
        let isActive = true

        const processCallback = async () => {
            const code = searchParams.get('code')
            const state = searchParams.get('state')
            const errorParam = searchParams.get('error')

            if (errorParam) {
                if (isActive) {
                    navigate('/login', { state: { error: errorParam }, replace: true })
                }
                return
            }

            if (!code) {
                if (isActive) {
                    navigate('/login', { state: { error: 'No authorization code received' }, replace: true })
                }
                return
            }

            if (completedCodes.has(code)) {
                if (isActive) {
                    navigate('/', { replace: true })
                }
                return
            }

            let callbackPromise = inFlightCallbacks.get(code)
            if (!callbackPromise) {
                callbackPromise = handleCallback(code, state || undefined)
                    .then(() => {
                        completedCodes.add(code)
                    })
                    .finally(() => {
                        inFlightCallbacks.delete(code)
                    })
                inFlightCallbacks.set(code, callbackPromise)
            }

            try {
                await callbackPromise
                if (isActive) {
                    navigate('/', { replace: true })
                }
            } catch {
                if (isActive) {
                    navigate('/login', { replace: true })
                }
            }
        }

        void processCallback()

        return () => {
            isActive = false
        }
    }, [searchParams, handleCallback, navigate])

    return (
        <div className="min-h-screen bg-gradient-to-br from-pastel-cream via-white to-pastel-rose flex items-center justify-center">
            <div className="text-center">
                {error ? (
                    <div className="alert-error max-w-md">
                        <p>{error}</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="btn-primary mt-4"
                        >
                            Back to Login
                        </button>
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <LoadingSpinner size="large" />
                        <p className="mt-4 text-gray-600">Completing sign in...</p>
                    </div>
                )}
            </div>
        </div>
    )
}
