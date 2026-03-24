import { NavLink } from 'react-router-dom'
import {
    Home,
    FileText,
    Navigation,
    ShoppingCart,
    Settings,
    HelpCircle,
    X,
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/navigation', label: 'Navigation', icon: Navigation },
]

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    return (
        <>
            {isOpen && (
                <button
                    aria-label="Close menu"
                    onClick={onClose}
                    className="fixed inset-0 bg-black/35 z-40 lg:hidden"
                />
            )}

            <aside
                className={clsx(
                    'sidebar fixed left-0 top-0 z-50 h-screen w-72 transition-transform duration-300 ease-out lg:translate-x-0',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="mb-8 flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
                            <ShoppingCart className="w-6 h-6" />
                            CartMapper
                        </h1>
                        <p className="text-xs text-gray-600 mt-1">
                            Smart retail assistant
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-600 hover:bg-white/80 lg:hidden"
                        aria-label="Close sidebar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <nav className="flex-1">
                    <p className="px-4 text-[11px] uppercase font-semibold tracking-wide text-gray-500 mb-3">
                        Workspace
                    </p>
                    <ul className="space-y-2">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            return (
                                <li key={item.path}>
                                    <NavLink
                                        to={item.path}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            clsx('nav-link', isActive && 'active')
                                        }
                                    >
                                        <Icon className="w-5 h-5" />
                                        {item.label}
                                    </NavLink>
                                </li>
                            )
                        })}
                    </ul>
                </nav>

                <div className="mt-6 border-t border-white/70 pt-5">
                    <ul className="space-y-2">
                        <li>
                            <a
                                href="#"
                                className="nav-link text-sm"
                                onClick={(e) => e.preventDefault()}
                            >
                                <HelpCircle className="w-4 h-4" />
                                Help & Support
                            </a>
                        </li>
                        <li>
                            <a
                                href="#"
                                className="nav-link text-sm"
                                onClick={(e) => e.preventDefault()}
                            >
                                <Settings className="w-4 h-4" />
                                Settings
                            </a>
                        </li>
                    </ul>
                </div>
            </aside>
        </>
    )
}
