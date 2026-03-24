import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { StoreProvider } from './context/StoreContext'
import { NavigationProvider } from './context/NavigationContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Layout from './components/common/Layout'
import LoginPage from './pages/LoginPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import HomePage from './pages/HomePage'
import DocumentAnalysisPage from './pages/DocumentAnalysisPage'
import NavigationPage from './pages/NavigationPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <StoreProvider>
                    <CartProvider>
                        <NavigationProvider>
                            <Routes>
                                {/* Public routes */}
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/auth/callback" element={<AuthCallbackPage />} />

                                {/* Protected routes */}
                                <Route element={<ProtectedRoute />}>
                                    <Route element={<Layout />}>
                                        <Route path="/" element={<HomePage />} />
                                        <Route path="/about" element={<AboutPage />} />
                                        <Route path="/contact" element={<ContactPage />} />
                                        <Route path="/documents" element={<DocumentAnalysisPage />} />
                                        <Route path="/navigation" element={<NavigationPage />} />
                                    </Route>
                                </Route>

                                {/* Fallback */}
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </NavigationProvider>
                    </CartProvider>
                </StoreProvider>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App
