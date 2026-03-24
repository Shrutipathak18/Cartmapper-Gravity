import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Location, PathResponse, MapResponse, ProductSearchResult } from '@/types'
import navigationService from '@/services/navigationService'
import { getErrorMessage } from '@/services/api'

interface NavigationContextType {
    locations: Location[]
    currentLocation: string | null
    mapData: MapResponse | null
    currentPath: PathResponse | null
    isLoading: boolean
    error: string | null
    initializeMap: (storeId?: string) => Promise<void>
    fetchLocations: () => Promise<void>
    setCurrentLocation: (location: string) => void
    findPath: (start: string, end: string, mode?: string) => Promise<PathResponse>
    getMapWithPath: (start: string, end: string) => Promise<void>
    getMapWithStops: (start: string, stops: string[]) => Promise<void>
    searchProducts: (query: string) => Promise<ProductSearchResult[]>
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

export function NavigationProvider({ children }: { children: React.ReactNode }) {
    const [locations, setLocations] = useState<Location[]>([])
    const [currentLocation, setCurrentLocation] = useState<string | null>(null)
    const [mapData, setMapData] = useState<MapResponse | null>(null)
    const [currentPath, setCurrentPath] = useState<PathResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Initialize map
    const initializeMap = useCallback(async (storeId?: string) => {
        setIsLoading(true)
        setError(null)

        try {
            await navigationService.initializeMap(storeId)

            // Fetch locations
            const locs = await navigationService.getLocations()
            setLocations(locs)

            // Fetch initial map
            const map = await navigationService.getMap()
            setMapData(map)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Fetch locations
    const fetchLocations = useCallback(async () => {
        try {
            const locs = await navigationService.getLocations()
            setLocations(locs)
        } catch (err) {
            setError(getErrorMessage(err))
        }
    }, [])

    // Find path
    const findPath = useCallback(async (start: string, end: string, mode: string = 'astar') => {
        setError(null)

        try {
            const path = await navigationService.getPath(start, end, mode)
            setCurrentPath(path)
            return path
        } catch (err) {
            setError(getErrorMessage(err))
            throw err
        }
    }, [])

    // Get map with path visualization
    const getMapWithPath = useCallback(async (start: string, end: string) => {
        setError(null)

        try {
            const map = await navigationService.getMap(start, end)
            setMapData(map)
        } catch (err) {
            setError(getErrorMessage(err))
        }
    }, [])

    const getMapWithStops = useCallback(async (start: string, stops: string[]) => {
        setError(null)

        try {
            const map = await navigationService.getMap(start, undefined, stops)
            setMapData(map)
            setCurrentPath(null)
        } catch (err) {
            setError(getErrorMessage(err))
        }
    }, [])

    // Search products
    const searchProducts = useCallback(async (query: string): Promise<ProductSearchResult[]> => {
        try {
            const response = await navigationService.searchProducts({ query })
            return response.results
        } catch {
            return []
        }
    }, [])

    const value: NavigationContextType = {
        locations,
        currentLocation,
        mapData,
        currentPath,
        isLoading,
        error,
        initializeMap,
        fetchLocations,
        setCurrentLocation,
        findPath,
        getMapWithPath,
        getMapWithStops,
        searchProducts,
    }

    return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function useNavigation(): NavigationContextType {
    const context = useContext(NavigationContext)
    if (context === undefined) {
        throw new Error('useNavigation must be used within a NavigationProvider')
    }
    return context
}

export default NavigationContext
