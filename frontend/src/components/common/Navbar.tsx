import { ChevronDown, LogOut, Settings, ShoppingCart, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'

interface NavbarProps { onCartClick: () => void }

export default function Navbar({ onCartClick }: NavbarProps) {
    const { user, logout } = useAuth()
    const { cart } = useCart()
    const userName = user?.name?.trim() || 'Guest User'
    const firstName = userName.split(/\s+/)[0] || 'Guest'
    const cartCount = cart.item_count || cart.items.length

    return (
        <header className="sticky top-0 z-30 border-b border-[#E9E0CF]/45 bg-[#FFF8EA]/28 px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F0C77C] shadow-sm">
                        <ShoppingCart className="h-5 w-5 text-[#3D2A12]" />
                    </div>
                    <p className="truncate text-sm font-semibold text-[#2F4D1A] sm:text-base">
                        Welcome, {userName}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onCartClick}
                        className="relative flex items-center gap-2 rounded-xl border border-[#E5D8C3] bg-white px-3 py-1.5 text-sm font-semibold text-[#433A2D] shadow-sm hover:bg-[#FFF5E7]"
                    >
                        <ShoppingCart className="h-4 w-4" />
                        <span className="hidden sm:inline">Cart</span>
                        <span className="rounded-full bg-[#F0C77C] px-1.5 py-0.5 text-xs font-bold text-[#3D2A12]">
                            {cartCount}
                        </span>
                    </button>

                    <details className="relative">
                        <summary
                            className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[#E5D8C3] bg-white px-2 py-1.5 text-[#433A2D] shadow-sm"
                            style={{ listStyle: 'none' }}
                        >
                            <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-[#F4EBDD]">
                                {user?.picture ? (
                                    <img
                                        src={user.picture}
                                        alt={userName}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <User className="h-4 w-4 text-[#8A7250]" />
                                )}
                            </div>
                            <span className="hidden max-w-20 truncate text-sm font-semibold sm:inline">
                                {firstName}
                            </span>
                            <ChevronDown className="h-4 w-4" />
                        </summary>

                        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-[#E5D8C3] bg-white shadow-xl">
                            <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[#5A4B36] hover:bg-[#FFF5E7]"
                            >
                                <Settings className="h-4 w-4" />
                                Login Settings
                            </button>
                            <button
                                type="button"
                                onClick={logout}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[#9A3B2E] hover:bg-[#FFF1ED]"
                            >
                                <LogOut className="h-4 w-4" />
                                Logout
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </header>
    )
}
