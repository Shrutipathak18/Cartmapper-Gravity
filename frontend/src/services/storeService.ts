import api from './api'
import type { Store, Anchor } from '../types'

export const storeService = {
    // List all stores
    async listStores(): Promise<{ stores: Store[] }> {
        const response = await api.get<{ stores: Store[] }>('/stores')
        return response.data
    },

    // Get store details
    async getStore(storeId: string): Promise<Store> {
        const response = await api.get<Store>(`/stores/${storeId}`)
        return response.data
    },

    // Activate store
    async activateStore(storeId: string): Promise<{ message: string; store_id: string }> {
        const response = await api.post<{ message: string; store_id: string }>(
            `/stores/${storeId}/activate`
        )
        return response.data
    },

    // Get active store
    async getActiveStore(): Promise<{ active_store: Store | null }> {
        const response = await api.get<{ active_store: Store | null }>('/stores/active/current')
        return response.data
    },

    // Upload inventory
    async uploadInventory(storeId: string, file: File): Promise<{
        success: boolean
        message?: string
        product_count?: number
        locations_count?: number
        error?: string
    }> {
        const formData = new FormData()
        formData.append('file', file)

        const response = await api.post(`/stores/${storeId}/inventory`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return response.data
    },

    // Get store anchors
    async getStoreAnchors(storeId: string): Promise<{ anchors: Anchor[] }> {
        const response = await api.get<{ anchors: Anchor[] }>(`/stores/${storeId}/anchors`)
        return response.data
    },

    // Export store layout
    async exportStoreLayout(storeId: string): Promise<any> {
        const response = await api.get(`/stores/${storeId}/export`)
        return response.data
    },
}

export default storeService
