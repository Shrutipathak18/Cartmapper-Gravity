import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { CartWithBudget } from '@/types'
import cartService from '@/services/cartService'
import { getErrorMessage } from '@/services/api'
import { useAuth } from '@/context/AuthContext.tsx'

interface CartContextType {
    cart: CartWithBudget
    isLoading: boolean
    error: string | null
    addItem: (item: {
        name: string
        price: number
        location: string
        category?: string
        quantity?: number
    }) => Promise<void>
    removeItem: (itemId: string) => Promise<void>
    updateQuantity: (itemId: string, quantity: number) => Promise<void>
    setBudget: (budget: number) => Promise<void>
    clearCart: () => Promise<void>
    refreshCart: () => Promise<void>
}

const emptyCart: CartWithBudget = {
    items: [],
    total: 0,
    item_count: 0,
    budget: undefined,
    remaining: undefined,
    over_budget: false,
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth()
    const [cart, setCart] = useState<CartWithBudget>(emptyCart)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Initialize session ID
    useEffect(() => {
        if (!localStorage.getItem('session_id')) {
            localStorage.setItem('session_id', `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
        }
    }, [])

    // Fetch cart on auth change
    const refreshCart = useCallback(async () => {
        if (!isAuthenticated) {
            setCart(emptyCart)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const cartData = await cartService.getCart()
            setCart(cartData)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setIsLoading(false)
        }
    }, [isAuthenticated])

    useEffect(() => {
        refreshCart()
    }, [refreshCart])

    // Add item
    const addItem = useCallback(async (item: {
        name: string
        price: number
        location: string
        category?: string
        quantity?: number
    }) => {
        setError(null)

        try {
            await cartService.addItem(item)
            await refreshCart()
        } catch (err) {
            setError(getErrorMessage(err))
            throw err
        }
    }, [refreshCart])

    // Remove item
    const removeItem = useCallback(async (itemId: string) => {
        setError(null)

        try {
            await cartService.removeItem(itemId)
            await refreshCart()
        } catch (err) {
            setError(getErrorMessage(err))
            throw err
        }
    }, [refreshCart])

    // Update quantity
    const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
        setError(null)

        try {
            await cartService.updateQuantity(itemId, quantity)
            await refreshCart()
        } catch (err) {
            setError(getErrorMessage(err))
            throw err
        }
    }, [refreshCart])

    // Set budget
    const setBudget = useCallback(async (budget: number) => {
        setError(null)

        try {
            await cartService.setBudget(budget)
            await refreshCart()
        } catch (err) {
            setError(getErrorMessage(err))
            throw err
        }
    }, [refreshCart])

    // Clear cart
    const clearCart = useCallback(async () => {
        setError(null)

        try {
            await cartService.clearCart()
            await refreshCart()
        } catch (err) {
            setError(getErrorMessage(err))
            throw err
        }
    }, [refreshCart])

    const value: CartContextType = {
        cart,
        isLoading,
        error,
        addItem,
        removeItem,
        updateQuantity,
        setBudget,
        clearCart,
        refreshCart,
    }

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextType {
    const context = useContext(CartContext)
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider')
    }
    return context
}

export default CartContext
