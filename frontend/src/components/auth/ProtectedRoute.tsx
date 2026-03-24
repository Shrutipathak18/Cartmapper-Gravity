import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../common/LoadingSpinner'

export default function ProtectedRoute() {
    const { isAuthenticated, isLoading } = useAuth()
    const location = useLocation()

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pastel-cream via-white to-pastel-rose">
                <LoadingSpinner size="large" />
            </div>
        )
    }

    if (!isAuthenticated) {
        // Redirect to login with return path
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <Outlet />
}
