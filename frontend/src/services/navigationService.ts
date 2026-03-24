import api from './api'
import type {
    Location,
    PathResponse,
    ShoppingRouteResponse,
    NavigationQueryResponse,
    MapResponse,
    ProductSearchResponse,
    ProductStats,
} from '../types'

export const navigationService = {
    // Initialize sample map
    async initializeMap(storeId?: string): Promise<{ success: boolean; message: string }> {
        const response = await api.post<{ success: boolean; message: string }>(
            `/navigation/init`,
            null,
            { params: { store_id: storeId || 'sample' } }
        )
        return response.data
    },

    // Get path between locations
    async getPath(start: string, end: string, mode: string = 'astar'): Promise<PathResponse> {
        const response = await api.post<PathResponse>('/navigation/path', {
            start,
            end,
            mode,
        })
        return response.data
    },

    // Get distance between locations
    async getDistance(location1: string, location2: string): Promise<{ distance: number }> {
        const response = await api.post<{ distance: number; location1: string; location2: string }>(
            '/navigation/distance',
            { location1, location2 }
        )
        return response.data
    },

    // Get nearby locations
    async getNearby(currentLocation: string, maxDistance?: number): Promise<Location[]> {
        const response = await api.post<Location[]>('/navigation/nearby', {
            current_location: currentLocation,
            max_distance: maxDistance || 100,
        })
        return response.data
    },

    // Find product location
    async findProductLocation(productName: string): Promise<{
        product_name: string
        location: string | null
        found: boolean
    }> {
        const response = await api.post('/navigation/product-location', {
            product_name: productName,
        })
        return response.data
    },

    // Plan shopping route
    async planShoppingRoute(
        items: string[],
        currentLocation: string
    ): Promise<ShoppingRouteResponse> {
        const response = await api.post<ShoppingRouteResponse>('/navigation/shopping-route', {
            items,
            current_location: currentLocation,
        })
        return response.data
    },

    // Natural language navigation
    async askNavigation(
        question: string,
        currentLocation?: string,
        language: string = 'en'
    ): Promise<NavigationQueryResponse> {
        const response = await api.post<NavigationQueryResponse>('/navigation/ask', {
            question,
            current_location: currentLocation,
            language,
        })
        return response.data
    },

    // Get map image
    async getMap(currentLocation?: string, destination?: string, stops?: string[]): Promise<MapResponse> {
        const params = new URLSearchParams()
        if (currentLocation) params.append('current_location', currentLocation)
        if (destination) params.append('destination', destination)
        if (stops && stops.length) {
            stops
                .map((stop) => (stop || '').trim())
                .filter(Boolean)
                .forEach((stop) => params.append('stops', stop))
        }

        const query = params.toString()
        const url = query ? `/navigation/map?${query}` : '/navigation/map'
        const response = await api.get<MapResponse>(url)
        return response.data
    },

    // Get all locations
    async getLocations(): Promise<Location[]> {
        const response = await api.get<Location[]>('/navigation/locations')
        return response.data
    },

    // Search products
    async searchProducts(params: {
        query?: string
        category?: string
        type?: string
        min_price?: number
        max_price?: number
        limit?: number
    }): Promise<ProductSearchResponse> {
        const response = await api.get<ProductSearchResponse>('/navigation/products', {
            params,
        })
        return response.data
    },

    // Get product stats
    async getProductStats(): Promise<ProductStats> {
        const response = await api.get<ProductStats>('/navigation/products/stats')
        return response.data
    },

    // Get cheaper alternatives
    async getAlternatives(productName: string): Promise<{
        original_product: any
        alternatives: any[]
    }> {
        const response = await api.post('/navigation/products/alternatives', {
            product_name: productName,
        })
        return response.data
    },

    // Export map
    async exportMap(): Promise<any> {
        const response = await api.get('/navigation/export')
        return response.data
    },
}

export default navigationService
