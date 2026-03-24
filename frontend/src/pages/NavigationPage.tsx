import { useEffect, useState, useRef } from 'react'
import {
    Map,
    Navigation as NavIcon,
    Search,
    ShoppingCart,
    ArrowRight,
    MapPin,
    Route,
    Plus,
    Mic,
    MicOff,
    Compass,
} from 'lucide-react'
import { useNavigation } from '@/context/NavigationContext.tsx'
import { useCart } from '@/context/CartContext.tsx'
import navigationService from '@/services/navigationService'
import audioService from '@/services/audioService'
import { convertBlobToWav } from '@/services/audioUtils'
import { getErrorMessage } from '@/services/api'
import type { ProductSearchResult, ShoppingRouteResponse } from '@/types'
import LoadingSpinner from '@/components/common/LoadingSpinner.tsx'
import clsx from 'clsx'

type TabId = 'map' | 'products' | 'route'

export default function NavigationPage() {
    const {
        locations,
        currentLocation,
        mapData,
        currentPath,
        isLoading,
        error: navError,
        initializeMap,
        findPath,
        getMapWithPath,
        setCurrentLocation,
    } = useNavigation()
    const { addItem } = useCart()

    const [activeTab, setActiveTab] = useState<TabId>('map')
    const [startLocation, setStartLocation] = useState('')
    const [endLocation, setEndLocation] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [shoppingItems, setShoppingItems] = useState<string[]>([])
    const [shoppingRoute, setShoppingRoute] = useState<ShoppingRouteResponse | null>(null)
    const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [inputLanguage, setInputLanguage] = useState('en')
    const [outputLanguage, setOutputLanguage] = useState('en')
    const [isRecording, setIsRecording] = useState<'dest' | 'search' | null>(null)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])

    useEffect(() => {
        if (locations.length === 0) {
            initializeMap()
        }
    }, [initializeMap, locations.length])

    useEffect(() => {
        if (!locations.length || startLocation) return
        if (currentLocation && locations.some((location) => location.name === currentLocation)) {
            setStartLocation(currentLocation)
            return
        }
        const entrance = locations.find((location) => location.name.toLowerCase().includes('entrance'))
        setStartLocation(entrance?.name || locations[0].name)
    }, [currentLocation, locations, startLocation])

    const handleFindPath = async () => {
        if (!startLocation || !endLocation) return

        try {
            await findPath(startLocation, endLocation)
            await getMapWithPath(startLocation, endLocation)
            setStartLocation(endLocation)
            setCurrentLocation(endLocation)
        } catch (err) {
            setError(getErrorMessage(err))
        }
    }

    const handleVoiceInput = async (target: 'dest' | 'search') => {
        if (isRecording) {
            mediaRecorderRef.current?.stop()
            setIsRecording(null)
            return
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const options = { mimeType: 'audio/webm' }

            let mediaRecorder: MediaRecorder
            try {
                mediaRecorder = new MediaRecorder(stream, options)
            } catch {
                mediaRecorder = new MediaRecorder(stream)
            }

            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop())
                const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType })
                const audioFile = await convertBlobToWav(audioBlob, 'recording.wav')

                try {
                    const result = await audioService.transcribe(audioFile, inputLanguage)
                    if (!result.text) return

                    if (target === 'dest') {
                        const matched = locations.find((location) =>
                            location.name.toLowerCase().includes(result.text.toLowerCase())
                        )
                        const destination = matched ? matched.name : result.text
                        setEndLocation(destination)

                        if (startLocation && matched) {
                            try {
                                await findPath(startLocation, destination)
                                await getMapWithPath(startLocation, destination)
                                setStartLocation(destination)
                                setCurrentLocation(destination)
                            } catch (pathErr) {
                                setError(getErrorMessage(pathErr))
                            }
                        }
                        return
                    }

                    setSearchQuery(result.text)
                    setIsSearching(true)
                    setError(null)
                    try {
                        const response = await navigationService.searchProducts({ query: result.text })
                        setSearchResults(response.results)
                    } catch (searchErr) {
                        setError(getErrorMessage(searchErr))
                    } finally {
                        setIsSearching(false)
                    }
                } catch (err) {
                    setError(getErrorMessage(err))
                }
            }

            mediaRecorder.start()
            setIsRecording(target)
        } catch {
            setError('Microphone access denied.')
        }
    }

    const handleSearch = async () => {
        if (!searchQuery.trim()) return

        setIsSearching(true)
        setError(null)
        try {
            const response = await navigationService.searchProducts({ query: searchQuery })
            setSearchResults(response.results)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setIsSearching(false)
        }
    }

    const addToShoppingList = (productName: string) => {
        if (!shoppingItems.includes(productName)) {
            setShoppingItems((prev) => [...prev, productName])
        }
    }

    const removeFromShoppingList = (index: number) => {
        setShoppingItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
    }

    useEffect(() => {
        let active = true

        const calculateShoppingRoute = async () => {
            if (shoppingItems.length === 0 || !startLocation) {
                if (active) setShoppingRoute(null)
                return
            }

            setIsCalculatingRoute(true)
            setError(null)
            try {
                const route = await navigationService.planShoppingRoute(shoppingItems, startLocation)
                if (active) setShoppingRoute(route)
            } catch (err) {
                if (active) setError(getErrorMessage(err))
            } finally {
                if (active) setIsCalculatingRoute(false)
            }
        }

        void calculateShoppingRoute()
        return () => {
            active = false
        }
    }, [shoppingItems, startLocation])

    const handleAddToCart = async (product: ProductSearchResult) => {
        try {
            await addItem({
                name: product.product.name,
                price: product.product.price,
                location: product.location,
                category: product.product.category,
            })
        } catch (err) {
            setError(getErrorMessage(err))
        }
    }

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'hi', name: 'Hindi' },
        { code: 'or', name: 'Odia' },
        { code: 'bn', name: 'Bengali' },
        { code: 'ta', name: 'Tamil' },
    ]

    const tabs: Array<{ id: TabId; label: string; icon: typeof Map }> = [
        { id: 'map', label: 'Map', icon: Map },
        { id: 'products', label: 'Products', icon: Search },
        { id: 'route', label: 'Route Planner', icon: Route },
    ]

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <LoadingSpinner size="large" />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-gray-800">
                        Indoor Navigation
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Build paths, search products, and optimize shopping routes.
                    </p>
                </div>

                <div className="flex gap-2 items-end flex-wrap">
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 px-1">Input</label>
                        <select
                            value={inputLanguage}
                            onChange={(e) => setInputLanguage(e.target.value)}
                            className="input-field py-1 h-10 text-sm w-32"
                        >
                            {languages.map((lang) => (
                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 px-1">Output</label>
                        <select
                            value={outputLanguage}
                            onChange={(e) => setOutputLanguage(e.target.value)}
                            className="input-field py-1 h-10 text-sm w-32"
                        >
                            {languages.map((lang) => (
                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs text-gray-600">
                        <Compass className="w-4 h-4 text-primary" />
                        Language-ready flow
                    </div>
                </div>
            </div>

            {(error || navError) && (
                <div className="alert-error">{error || navError}</div>
            )}

            <div className="flex gap-2 bg-rose-50 border border-rose-100 p-1 rounded-xl w-fit">
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx('tab-button flex items-center gap-2', activeTab === tab.id && 'active')}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {activeTab === 'map' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="card space-y-4">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <NavIcon className="w-5 h-5 text-primary" />
                            Find Path
                        </h3>

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">From</label>
                            <select
                                value={startLocation}
                                onChange={(e) => setStartLocation(e.target.value)}
                                className="input-field"
                            >
                                <option value="">Select start location</option>
                                {locations.map((location) => (
                                    <option key={location.name} value={location.name}>
                                        {location.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">To</label>
                            <div className="flex gap-2">
                                <select
                                    value={endLocation}
                                    onChange={(e) => setEndLocation(e.target.value)}
                                    className="input-field flex-1"
                                >
                                    <option value="">Select destination</option>
                                    {locations.map((location) => (
                                        <option key={location.name} value={location.name}>
                                            {location.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => handleVoiceInput('dest')}
                                    className={clsx(
                                        'p-2 rounded-xl transition-all',
                                        isRecording === 'dest'
                                            ? 'bg-red-500 text-white animate-pulse'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    )}
                                    title="Voice destination"
                                >
                                    {isRecording === 'dest'
                                        ? <MicOff className="w-5 h-5" />
                                        : <Mic className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleFindPath}
                            disabled={!startLocation || !endLocation}
                            className="btn-primary w-full"
                        >
                            <NavIcon className="w-4 h-4" />
                            Find Path
                        </button>

                        {currentPath && (
                            <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
                                <p className="text-sm text-gray-600">
                                    Distance: <span className="font-semibold">{currentPath.distance.toFixed(1)} px</span>
                                </p>
                                <p className="text-sm text-gray-600">
                                    Mode: <span className="font-semibold capitalize">{currentPath.mode}</span>
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-2 map-container aspect-video bg-gray-50 flex items-center justify-center">
                        {mapData ? (
                            <img
                                src={`data:image/png;base64,${mapData.image_base64}`}
                                alt="Store Map"
                                className="max-w-full max-h-full object-contain"
                            />
                        ) : (
                            <div className="text-gray-400 text-center">
                                <Map className="w-16 h-16 mx-auto mb-3 opacity-50" />
                                <p>Initializing map...</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'products' && (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Search products..."
                                className="input-field pl-12"
                            />
                            <button
                                onClick={() => handleVoiceInput('search')}
                                className={clsx(
                                    'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all',
                                    isRecording === 'search'
                                        ? 'bg-red-500 text-white animate-pulse'
                                        : 'text-gray-400 hover:text-primary'
                                )}
                                title="Voice search"
                            >
                                {isRecording === 'search'
                                    ? <MicOff className="w-4 h-4" />
                                    : <Mic className="w-4 h-4" />}
                            </button>
                        </div>
                        <button onClick={handleSearch} className="btn-primary sm:min-w-[120px]">
                            {isSearching ? <LoadingSpinner size="small" /> : <Search className="w-4 h-4" />}
                            Search
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {searchResults.map((result, index) => (
                            <div key={`${result.product.name}-${index}`} className="product-card">
                                <div className="flex justify-between items-start mb-3 gap-2">
                                    <h4 className="font-semibold text-gray-800">{result.product.name}</h4>
                                    <span
                                        className={clsx(
                                            'px-2 py-1 text-xs rounded-full',
                                            result.product.type === 'Veg'
                                                ? 'bg-green-100 text-green-700'
                                                : result.product.type === 'Non-Veg'
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-gray-100 text-gray-600'
                                        )}
                                    >
                                        {result.product.type}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-500 mb-2">{result.product.category}</p>

                                <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    <span>{result.location}</span>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xl font-bold text-primary">
                                        {result.product.price_display}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => addToShoppingList(result.product.name)}
                                            className="btn-secondary py-1.5 px-3 text-sm"
                                            title="Add to route planner"
                                        >
                                            <Route className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleAddToCart(result)}
                                            className="btn-primary py-1.5 px-3 text-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Cart
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {searchResults.length === 0 && searchQuery && !isSearching && (
                        <div className="text-center py-12 text-gray-400 card">
                            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No products found for "{searchQuery}"</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'route' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="card">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-primary" />
                            Shopping List
                        </h3>

                        <div className="mb-4">
                            <label className="block text-sm text-gray-600 mb-1">Starting Location</label>
                            <select
                                value={startLocation}
                                onChange={(e) => setStartLocation(e.target.value)}
                                className="input-field"
                            >
                                <option value="">Select your location</option>
                                {locations.map((location) => (
                                    <option key={location.name} value={location.name}>
                                        {location.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {shoppingItems.length > 0 ? (
                            <div className="space-y-2 mb-4">
                                {shoppingItems.map((item, index) => (
                                    <div key={`${item}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <span className="text-sm">{item}</span>
                                        <button
                                            onClick={() => removeFromShoppingList(index)}
                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                                            aria-label="Remove item"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400 mb-4 border border-dashed border-gray-200 rounded-xl">
                                <p>Add products from the Products tab</p>
                            </div>
                        )}

                        {isCalculatingRoute ? (
                            <p className="text-xs text-gray-500">Calculating route...</p>
                        ) : null}
                    </div>

                    <div className="card">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Route className="w-5 h-5 text-primary" />
                            Optimized Route
                        </h3>

                        {shoppingRoute ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                                    <p className="text-sm text-gray-600">
                                        Total Distance: <span className="font-semibold">{shoppingRoute.total_distance.toFixed(1)} px</span>
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    {shoppingRoute.route.map((stop, index) => (
                                        <div key={`${stop.item}-${index}`} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold text-sm">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium">{stop.item}</p>
                                                <p className="text-sm text-gray-500">{stop.location}</p>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-gray-400" />
                                        </div>
                                    ))}
                                </div>

                                {shoppingRoute.items_not_found.length > 0 && (
                                    <div className="alert-warning">
                                        <p className="font-medium">Items not found</p>
                                        <p className="text-sm">{shoppingRoute.items_not_found.join(', ')}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                <Route className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Add items and select start location to auto-generate route</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
