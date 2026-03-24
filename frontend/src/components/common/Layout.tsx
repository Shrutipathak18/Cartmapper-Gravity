import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import CartSidebar from '../cart/CartSidebar'
import { useState } from 'react'

export interface LayoutOutletContext {
    openCart: () => void
}

export default function Layout() {
    const [isCartOpen, setIsCartOpen] = useState(false)
    const location = useLocation()
    const isHome = location.pathname === '/'
    const showNavbar = !isHome
    const openCart = () => setIsCartOpen(true)

    return (
        <div className={`app-shell-bg min-h-screen ${isHome ? 'app-shell-bg-home' : ''}`}>
            <div className="app-shell-overlay min-h-screen flex flex-col">
                {showNavbar ? <Navbar onCartClick={openCart} /> : null}

                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
                    <Outlet context={{ openCart } satisfies LayoutOutletContext} />
                </main>
            </div>

            <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        </div>
    )
}
