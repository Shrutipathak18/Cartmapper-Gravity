// User types
export interface User {
    email: string
    name: string
    picture?: string
    is_guest: boolean
}

export interface LoginResponse {
    access_token: string
    token_type: string
    user: User
}

export interface AuthStatus {
    google_oauth_configured: boolean
    guest_login_available: boolean
}

export interface ForgotPasswordResponse {
    message: string
    reset_token?: string
}

// Document types
export interface DocumentUploadResponse {
    success: boolean
    message: string
    document_id?: string
    num_chunks: number
    document_type: string
}

export interface RAGQueryRequest {
    question: string
    language?: string
    include_sources?: boolean
}

export interface RAGQueryResponse {
    answer: string
    original_question: string
    translated_question?: string
    translated_answer?: string
    language: string
    sources: string[]
}

export interface DocumentStatus {
    documents_loaded: boolean
    num_documents: number
    num_chunks: number
    collection_name: string
}

// Navigation types
export interface Location {
    name: string
    x: number
    y: number
    description: string
}

export interface PathPoint {
    x: number
    y: number
    location?: string
}

export interface PathResponse {
    path: PathPoint[]
    distance: number
    start: string
    end: string
    mode: string
}

export interface ShoppingRouteItem {
    item: string
    location: string
    distance_from_previous: number
}

export interface ShoppingRouteResponse {
    route: ShoppingRouteItem[]
    total_distance: number
    items_not_found: string[]
}

export interface NavigationMatchedProduct {
    name: string
    location: string
    price: number
    type: string
    company?: string
}

export interface NavigationQueryResponse {
    answer: string
    translated_answer?: string
    language: string
    destination_location?: string
    distance?: number
    route_steps?: string[]
    matched_product?: NavigationMatchedProduct
    search_query_used?: string
}

export interface MapResponse {
    image_base64: string
    width: number
    height: number
    locations: Location[]
}

// Product types
export interface Product {
    name: string
    category: string
    price: number
    price_display: string
    type: string
    stock?: string
    location: string
}

export interface ProductSearchResult {
    product: Product
    location: string
    match_score: number
}

export interface ProductSearchResponse {
    results: ProductSearchResult[]
    total: number
    query: string
}

export interface ProductStats {
    total_products: number
    categories: { name: string; count: number }[]
    veg_count: number
    non_veg_count: number
    price_range: { min: number; max: number }
}

// Cart types
export interface CartItem {
    id: string
    name: string
    price: number
    location: string
    category: string
    quantity: number
}

export interface Cart {
    items: CartItem[]
    total: number
    item_count: number
}

export interface CartWithBudget extends Cart {
    budget?: number
    remaining?: number
    over_budget: boolean
}

export interface PurchaseHistoryItem {
    name: string
    price: number
    location: string
    category: string
    quantity: number
}

export interface PurchaseHistoryEntry {
    id: string
    purchased_at: string
    items: PurchaseHistoryItem[]
    total: number
    item_count: number
}

// Store types
export interface Anchor {
    anchor_id: string
    name: string
    x: number
    y: number
}

export interface StoreProfile {
    store_width_cm: number
    store_height_cm: number
    anchors: Anchor[]
}

export interface Store {
    shop_id: string
    name: string
    has_inventory?: boolean
    anchors_count?: number
    profile?: StoreProfile
}

// QR types
export interface QRDecodeResponse {
    data: string
    success: boolean
    is_url: boolean
    is_anchor: boolean
}

export interface AnchorPayload {
    type: string
    shop_id: string
    anchor_id: string
    name: string
    x: number
    y: number
    v: number
}

export interface QRAnchorValidation {
    valid: boolean
    payload?: AnchorPayload
    error?: string
}

// Audio types
export interface AudioTranscribeResponse {
    text: string
    language: string
    confidence?: number
}

export interface TTSResponse {
    audio_base64: string
    format: string
    language: string
}

// Translation types
export interface TranslationResponse {
    original_text: string
    translated_text: string
    source_lang: string
    target_lang: string
    success: boolean
}

export interface SupportedLanguage {
    code: string
    name: string
}

// API Response wrapper
export interface ApiResponse<T> {
    data: T
    status: number
    message?: string
}

export interface ApiError {
    detail: string
    status?: number
}
