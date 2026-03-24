import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Store } from '@/types'
import storeService from '@/services/storeService'
import { getErrorMessage } from '@/services/api'

interface StoreContextType {
    stores: Store[]
    activeStore: Store | null
    isLoading: boolean
    error: string | null
    fetchStores: () => Promise<void>
    selectStore: (storeId: string) => Promise<void>
    uploadInventory: (storeId: string, file: File) => Promise<{
        success: boolean
        message?: string
        error?: string
    }>
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: React.ReactNode }) {
    const [stores, setStores] = useState<Store[]>([])
    const [activeStore, setActiveStore] = useState<Store | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Fetch all stores
    const fetchStores = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await storeService.listStores()
            setStores(response.stores)

            // Also get active store
            const activeResponse = await storeService.getActiveStore()
            setActiveStore(activeResponse.active_store)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Select and activate a store
    const selectStore = useCallback(async (storeId: string) => {
        setError(null)

        try {
            await storeService.activateStore(storeId)
            const storeDetails = await storeService.getStore(storeId)
            setActiveStore(storeDetails)
        } catch (err) {
            setError(getErrorMessage(err))
            throw err
        }
    }, [])

    // Upload inventory
    const uploadInventory = useCallback(async (storeId: string, file: File) => {
        try {
            const result = await storeService.uploadInventory(storeId, file)
            if (result.success) {
                await fetchStores()
            }
            return result
        } catch (err) {
            const message = getErrorMessage(err)
            return { success: false, error: message }
        }
    }, [fetchStores])

    const value: StoreContextType = {
        stores,
        activeStore,
        isLoading,
        error,
        fetchStores,
        selectStore,
        uploadInventory,
    }

    return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreContextType {
    const context = useContext(StoreContext)
    if (context === undefined) {
        throw new Error('useStore must be used within a StoreProvider')
    }
    return context
}

export default StoreContext
