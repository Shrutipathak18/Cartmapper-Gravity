import api from './api'
import type { CartItem, CartWithBudget } from '@/types'

export const cartService = {
    // Get cart
    async getCart(): Promise<CartWithBudget> {
        const response = await api.get<CartWithBudget>('/cart')
        return response.data
    },

    // Add item to cart
    async addItem(item: {
        name: string
        price: number
        location: string
        category?: string
        quantity?: number
    }): Promise<CartItem> {
        const response = await api.post<CartItem>('/cart/add', {
            name: item.name,
            price: item.price,
            location: item.location,
            category: item.category || 'General',
            quantity: item.quantity || 1,
        })
        return response.data
    },

    // Remove item from cart
    async removeItem(itemId: string): Promise<void> {
        await api.delete(`/cart/${itemId}`)
    },

    // Update item quantity
    async updateQuantity(itemId: string, quantity: number): Promise<CartItem | null> {
        const response = await api.put<CartItem | null>(`/cart/${itemId}`, {
            quantity,
        })
        return response.data
    },

    // Set budget
    async setBudget(budget: number): Promise<void> {
        await api.post('/cart/budget', { budget })
    },

    // Get budget
    async getBudget(): Promise<{ budget: number | null }> {
        const response = await api.get<{ budget: number | null }>('/cart/budget')
        return response.data
    },

    // Clear cart
    async clearCart(): Promise<void> {
        await api.delete('/cart')
    },
}

export default cartService
