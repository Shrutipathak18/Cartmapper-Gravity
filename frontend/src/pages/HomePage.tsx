import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    AlertCircle,
    CheckCircle2,
    Loader2,
    LogOut,
    MapPin,
    MessageSquare,
    Mic,
    MicOff,
    QrCode,
    Search,
    Send,
    ShoppingCart,
    Sparkles,
    Upload,
    Volume2,
    X,
} from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import type { LayoutOutletContext } from '@/components/common/Layout'
import { useNavigation } from '@/context/NavigationContext'
import { useStore } from '@/context/StoreContext'
import { getErrorMessage } from '@/services/api'
import { convertBlobToWav } from '@/services/audioUtils'
import audioService from '@/services/audioService'
import navigationService from '@/services/navigationService'
import qrService from '@/services/qrService'
import ragService from '@/services/ragService'
import translationService from '@/services/translationService'
import { Html5Qrcode } from 'html5-qrcode'
import type { ProductSearchResult, ShoppingRouteResponse } from '@/types'
import '@/styles/home.css'

type VoiceTarget = 'search' | 'qa' | null
type NoticeType = 'success' | 'error' | 'info'
type DietFilter = 'All' | 'Vegan' | 'Veg' | 'Non-Veg'
type LanguageCode = 'en' | 'hi' | 'or' | 'bn' | 'ta'
type RecommendationMode = 'food' | 'non_food' | 'neutral'
type BudgetDietChoice = 'Vegan' | 'Veg' | 'Non-Veg'
type BudgetNeedType = 'meal' | 'care'

interface Notice {
    type: NoticeType
    message: string
}

interface QaRow {
    id: string
    question: string
    answer: string
    answerLanguage: LanguageCode
}

interface RecipeSuggestion {
    dish: string
    ingredients: string[]
}

interface RecommendationPlan {
    mode: RecommendationMode
    terms: string[]
    recipes: RecipeSuggestion[]
    narrative: string
}

interface RecipeIngredientDetail {
    ingredient: string
    available: boolean
    productName?: string
    location?: string
    price?: number
    stock?: string
    category?: string
}

interface ShoppingRouteStop {
    location: string
    items: string[]
    distanceFromPrevious: number
}

interface BudgetInsights {
    budget: number
    estimatedSpend: number
    remaining: number
    bestItems: ProductSearchResult[]
    totalCandidates: number
    appliedDiet: BudgetDietChoice
    appliedNeed: BudgetNeedType
    goal: string
}

interface OfferCarouselItem {
    id: string
    row: ProductSearchResult
    originalPrice: number
    discountPercent: number
    offerTag: string
    thumbnail: string
    fallbackThumbnail: string
    finalFallbackThumbnail: string
}

const SAMPLE_STORE = '__sample__'
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const VEGAN_BLOCK = ['milk', 'paneer', 'ghee', 'cheese', 'curd', 'butter', 'egg', 'chicken', 'mutton', 'fish']
const LANGUAGES: Array<{ code: LanguageCode; label: string }> = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi' },
    { code: 'or', label: 'Odia' },
    { code: 'ta', label: 'Tamil' },
    { code: 'bn', label: 'Bengali' },
]
const LANGUAGE_LABEL: Record<LanguageCode, string> = {
    en: 'English',
    hi: 'Hindi',
    or: 'Odia',
    ta: 'Tamil',
    bn: 'Bengali',
}
const FOOD_KEYWORDS = [
    'rice', 'basmati', 'milk', 'sugar', 'dry fruit', 'dry fruits', 'cashew', 'almond', 'raisin', 'elaichi', 'cardamom',
    'ghee', 'paneer', 'curd', 'yogurt', 'cheese', 'butter', 'dal', 'lentil', 'pulses', 'atta', 'flour', 'spice', 'masala',
    'turmeric', 'chilli', 'cumin', 'vegetable', 'fruit', 'tomato', 'onion', 'potato', 'poha', 'suji', 'rava', 'besan',
    'bread', 'egg', 'chicken', 'fish', 'mutton', 'oil', 'salt', 'tea', 'coffee'
]
const FOOD_CATEGORY_KEYWORDS = [
    'grocery', 'grains', 'dairy', 'bakery', 'vegetable', 'vegetables', 'fruits', 'spices', 'pulses',
    'beverages', 'snacks', 'meat', 'seafood', 'frozen food'
]
const CARE_KEYWORDS = [
    'shampoo', 'conditioner', 'hair oil', 'hair serum', 'face wash', 'facewash', 'soap', 'body wash', 'bodywash',
    'moisturizer', 'sunscreen', 'skin care', 'skincare', 'beauty', 'laundry', 'detergent', 'washing powder',
    'fabric conditioner', 'stain remover', 'detergent bar', 'dish wash', 'dishwash', 'cleaner', 'hand wash',
    'toothpaste', 'toothbrush'
]
const CARE_CATEGORY_KEYWORDS = ['personal care', 'hair care', 'skin care', 'beauty', 'hygiene', 'laundry', 'cleaning', 'home care', 'household']
const OFFER_LOCAL_IMAGE_HINTS: Array<{ triggers: string[]; src: string }> = [
    { triggers: ['baby diaper', 'baby diapers', 'diaper', 'diapers', 'baby wipes', 'wipes'], src: '/baby-diaper.png' },
    { triggers: ['baby powder'], src: '/baby-powder.jpg' },
    { triggers: ['baby lotion'], src: '/baby-lotion.jpg' },
    { triggers: ['body lotion'], src: '/body-lotion.jpg' },
    { triggers: ['cat food'], src: '/cat-food.jpg' },
    { triggers: ['breakfast cereal', 'cereals', 'cereal'], src: '/cereals.jpg' },
    { triggers: ['basmati rice'], src: '/basmati-rice.jpg' },
    { triggers: ['brownies', 'brownie'], src: '/brownies.jpeg' },
    { triggers: ['carrot', 'carrots'], src: '/carrot.jpeg' },
    { triggers: ['ball pen'], src: '/ball-pen.jpg' },
    { triggers: ['chicken breast'], src: '/chicken-breast.jpeg' },
    { triggers: ['tomato', 'broccoli', 'onion', 'potato', 'aloo', 'milk', 'dairy', 'bread', 'rice', 'basmati', 'egg', 'chicken', 'fish', 'coffee', 'tea', 'apple', 'banana', 'lemon', 'fruit', 'vegetable', 'grocery'], src: '/pic3.jpeg' },
    { triggers: ['lotion', 'soap', 'shampoo', 'toothpaste', 'detergent', 'laundry', 'cleaner'], src: '/pic4.png' },
]
const INDIAN_MEAL_RULES: Array<{ triggers: string[]; recipes: RecipeSuggestion[] }> = [
    {
        triggers: ['rice', 'basmati rice', 'basmati'],
        recipes: [
            { dish: 'Kheer', ingredients: ['milk', 'sugar', 'dry fruits', 'cardamom', 'ghee'] },
            { dish: 'Veg Pulao', ingredients: ['mixed vegetables', 'ghee', 'whole spices', 'onion'] },
            { dish: 'Jeera Rice', ingredients: ['ghee', 'cumin', 'salt'] },
        ],
    },
    {
        triggers: ['milk'],
        recipes: [
            { dish: 'Kheer', ingredients: ['rice', 'sugar', 'dry fruits', 'cardamom'] },
            { dish: 'Masala Chai', ingredients: ['tea leaves', 'sugar', 'ginger', 'cardamom'] },
        ],
    },
    {
        triggers: ['dal', 'lentil'],
        recipes: [
            { dish: 'Dal Tadka', ingredients: ['onion', 'tomato', 'cumin', 'garlic', 'ghee'] },
            { dish: 'Khichdi', ingredients: ['rice', 'ghee', 'turmeric', 'salt'] },
        ],
    },
    {
        triggers: ['paneer'],
        recipes: [
            { dish: 'Paneer Butter Masala', ingredients: ['onion', 'tomato', 'butter', 'cream', 'garam masala'] },
            { dish: 'Paneer Bhurji', ingredients: ['onion', 'tomato', 'green chilli', 'coriander'] },
        ],
    },
    {
        triggers: ['poha'],
        recipes: [
            { dish: 'Kanda Poha', ingredients: ['onion', 'mustard seeds', 'curry leaves', 'peanuts', 'lemon'] },
        ],
    },
    {
        triggers: ['suji', 'rava'],
        recipes: [
            { dish: 'Upma', ingredients: ['mustard seeds', 'curry leaves', 'onion', 'green chilli'] },
            { dish: 'Sooji Halwa', ingredients: ['ghee', 'sugar', 'milk', 'dry fruits'] },
        ],
    },
    {
        triggers: ['besan'],
        recipes: [
            { dish: 'Besan Chilla', ingredients: ['onion', 'tomato', 'green chilli', 'spices'] },
            { dish: 'Pakora', ingredients: ['onion', 'potato', 'ajwain', 'oil'] },
        ],
    },
    {
        triggers: ['atta', 'flour', 'wheat flour'],
        recipes: [
            { dish: 'Roti', ingredients: ['water', 'salt', 'ghee'] },
            { dish: 'Aloo Paratha', ingredients: ['potato', 'onion', 'green chilli', 'ghee'] },
        ],
    },
    {
        triggers: ['chicken'],
        recipes: [
            { dish: 'Chicken Curry', ingredients: ['onion', 'tomato', 'ginger garlic paste', 'chicken masala', 'oil'] },
            { dish: 'Chicken Biryani', ingredients: ['rice', 'curd', 'whole spices', 'mint', 'fried onion'] },
        ],
    },
    {
        triggers: ['fish'],
        recipes: [
            { dish: 'Fish Curry', ingredients: ['mustard oil', 'turmeric', 'chilli powder', 'tomato', 'garlic'] },
        ],
    },
    {
        triggers: ['egg'],
        recipes: [
            { dish: 'Masala Omelette', ingredients: ['onion', 'tomato', 'green chilli', 'oil', 'salt'] },
            { dish: 'Egg Curry', ingredients: ['onion', 'tomato', 'ginger garlic paste', 'spices'] },
        ],
    },
    {
        triggers: ['tea'],
        recipes: [
            { dish: 'Masala Chai', ingredients: ['milk', 'sugar', 'ginger', 'cardamom'] },
        ],
    },
    {
        triggers: ['coffee'],
        recipes: [
            { dish: 'Cold Coffee', ingredients: ['milk', 'sugar', 'ice cream'] },
            { dish: 'Hot Coffee', ingredients: ['milk', 'sugar'] },
        ],
    },
    {
        triggers: ['potato', 'aloo'],
        recipes: [
            { dish: 'Aloo Jeera', ingredients: ['cumin', 'green chilli', 'coriander', 'oil'] },
            { dish: 'Aloo Sabzi', ingredients: ['onion', 'tomato', 'turmeric', 'chilli powder'] },
        ],
    },
]
const NON_FOOD_RULES: Array<{ triggers: string[]; companions: string[] }> = [
    {
        triggers: ['shampoo'],
        companions: ['soap', 'face wash', 'conditioner', 'hair oil'],
    },
    {
        triggers: ['face wash', 'facewash'],
        companions: ['soap', 'moisturizer', 'sunscreen'],
    },
    {
        triggers: ['laundry', 'detergent', 'washing powder'],
        companions: ['fabric conditioner', 'stain remover', 'detergent bar'],
    },
]
const PRODUCT_QUERY_HINTS = ['where', 'location', 'price', 'cost', 'route', 'path', 'find', 'available']
const QUERY_TERM_BLOCKLIST = new Set([
    'where', 'is', 'are', 'the', 'a', 'an', 'for', 'of', 'to', 'and', 'or', 'me', 'i', 'want', 'need',
    'please', 'show', 'tell', 'give', 'find', 'route', 'routes', 'location', 'locations', 'price', 'prices',
    'cost', 'in', 'at', 'my', 'list', 'all', 'items', 'item', 'with', 'from', 'near', 'get'
])

function formatInr(value: number): string {
    return INR.format(Number.isFinite(value) ? value : 0)
}

function productType(type: string): 'Veg' | 'Non-Veg' | 'Other' {
    const t = type.toLowerCase()
    if (t.includes('non')) return 'Non-Veg'
    if (t.includes('veg')) return 'Veg'
    return 'Other'
}

function isVegan(name: string): boolean {
    const n = name.toLowerCase()
    return !VEGAN_BLOCK.some((item) => n.includes(item))
}

function applyDietFilter(items: ProductSearchResult[], dietFilter: DietFilter): ProductSearchResult[] {
    if (dietFilter === 'All') return items
    if (dietFilter === 'Vegan') {
        return items.filter((item) => productType(item.product.type) === 'Veg' && isVegan(item.product.name))
    }
    if (dietFilter === 'Veg') return items.filter((item) => productType(item.product.type) === 'Veg')
    return items.filter((item) => productType(item.product.type) === 'Non-Veg')
}

function buildOfferLocalImageUrl(name: string, category?: string): string {
    const combined = normalizeText(`${name} ${category || ''}`)
    for (const hint of OFFER_LOCAL_IMAGE_HINTS) {
        if (hint.triggers.some((trigger) => combined.includes(trigger))) {
            return hint.src
        }
    }
    return '/pic3.jpeg'
}

function keywordFromQuestion(question: string): string {
    const cleaned = question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
    return cleaned.split(/\s+/).filter(Boolean).slice(-3).join(' ') || question
}

function normalizeText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function includesAny(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(term))
}

function uniqueStrings(values: string[]): string[] {
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const value of values) {
        const clean = value.trim().toLowerCase()
        if (!clean || seen.has(clean)) continue
        seen.add(clean)
        ordered.push(value.trim())
    }
    return ordered
}

function recipeIngredientKey(ingredient: string): string {
    const normalized = normalizeText(ingredient)
    return normalized || ingredient.trim().toLowerCase()
}

function groupShoppingRouteStops(route: ShoppingRouteResponse['route']): ShoppingRouteStop[] {
    const stops: ShoppingRouteStop[] = []
    for (const step of route) {
        const previous = stops[stops.length - 1]
        if (previous && previous.location === step.location) {
            const exists = previous.items.some((item) => normalizeText(item) === normalizeText(step.item))
            if (!exists) previous.items.push(step.item)
            continue
        }
        stops.push({
            location: step.location,
            items: [step.item],
            distanceFromPrevious: step.distance_from_previous,
        })
    }
    return stops
}

function cleanQueryItemTerm(value: string): string {
    const normalized = normalizeText(value)
    if (!normalized) return ''
    const words = normalized.split(/\s+/).filter((word) => word && !QUERY_TERM_BLOCKLIST.has(word))
    return words.join(' ').trim()
}

function extractQueryItemTerms(question: string): string[] {
    const normalizedQuestion = normalizeText(question)
    if (!normalizedQuestion) return []

    const ofOrForMatch = normalizedQuestion.match(/\b(?:of|for)\s+(.+)$/)
    const base = ofOrForMatch?.[1]?.trim() || normalizedQuestion

    let pieces = base
        .split(/\s*(?:,|;|\/|&|\bplus\b)\s*/i)
        .map((chunk) => cleanQueryItemTerm(chunk))
        .filter(Boolean)

    if (pieces.length <= 1 && base.includes(' and ')) {
        pieces = base
            .split(/\band\b/i)
            .map((chunk) => cleanQueryItemTerm(chunk))
            .filter(Boolean)
    }

    if (pieces.length > 1) return uniqueStrings(pieces)

    const fallbackWords = base
        .split(/\s+/)
        .map((word) => word.trim().toLowerCase())
        .filter((word) => word.length > 1 && !QUERY_TERM_BLOCKLIST.has(word))
    if (fallbackWords.length >= 2 && fallbackWords.length <= 6) {
        return uniqueStrings(fallbackWords)
    }

    const single = cleanQueryItemTerm(base)
    return single ? [single] : []
}

function capitalizeWords(text: string): string {
    return text
        .split(/\s+/)
        .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
        .join(' ')
        .trim()
}

function buildProductText(name: string, category: string): string {
    return normalizeText(`${name} ${category}`)
}

function stockMeansUnavailable(stock?: string): boolean {
    if (!stock) return false
    const normalized = normalizeText(stock)
    if (normalized.includes('out of stock') || normalized.includes('unavailable') || normalized.includes('no stock')) return true
    return /^0(\.0+)?($|\D)/.test(normalized)
}

function isFoodText(text: string): boolean {
    return includesAny(text, FOOD_KEYWORDS) || includesAny(text, FOOD_CATEGORY_KEYWORDS)
}

function isCareText(text: string): boolean {
    return includesAny(text, CARE_KEYWORDS) || includesAny(text, CARE_CATEGORY_KEYWORDS)
}

function buildFallbackFoodRecipes(mainResult: ProductSearchResult | null, anchorText: string): RecipeSuggestion[] {
    const mainName = mainResult?.product?.name?.trim() || anchorText.trim() || 'this item'
    const readableName = capitalizeWords(mainName)
    return [
        {
            dish: `${readableName} Curry (Home Style)`,
            ingredients: ['onion', 'tomato', 'ginger garlic paste', 'turmeric', 'chilli powder', 'salt', 'oil'],
        },
        {
            dish: `${readableName} Masala Stir Fry`,
            ingredients: ['onion', 'cumin', 'garam masala', 'green chilli', 'oil'],
        },
    ]
}

function buildNarrative(planMode: RecommendationMode, recipes: RecipeSuggestion[]): string {
    if (planMode === 'food' && recipes.length) {
        const first = recipes[0]
        return `You can make ${first.dish}. For this, you may need ${first.ingredients.join(', ')}.`
    }
    if (planMode === 'non_food') {
        return 'Recommended companion items for this product are shown below.'
    }
    return 'Related items are shown below.'
}

function planRecommendations(anchorText: string, mainResult: ProductSearchResult | null): RecommendationPlan {
    const primaryText = mainResult ? buildProductText(mainResult.product.name, mainResult.product.category) : ''
    const context = normalizeText(`${anchorText} ${primaryText}`)

    for (const rule of INDIAN_MEAL_RULES) {
        if (includesAny(context, rule.triggers)) {
            const recipes = rule.recipes.slice(0, 3)
            const terms = uniqueStrings(recipes.flatMap((recipe) => recipe.ingredients))
            return {
                mode: 'food',
                terms,
                recipes,
                narrative: buildNarrative('food', recipes),
            }
        }
    }

    for (const rule of NON_FOOD_RULES) {
        if (includesAny(context, rule.triggers)) {
            return {
                mode: 'non_food',
                terms: uniqueStrings(rule.companions),
                recipes: [],
                narrative: buildNarrative('non_food', []),
            }
        }
    }

    if (isFoodText(context)) {
        const recipes = buildFallbackFoodRecipes(mainResult, anchorText)
        const terms = uniqueStrings(recipes.flatMap((recipe) => recipe.ingredients))
        return {
            mode: 'food',
            terms,
            recipes,
            narrative: buildNarrative('food', recipes),
        }
    }

    if (isCareText(context)) {
        const fallbackTerms = [mainResult?.product.name || anchorText, 'soap', 'face wash', 'conditioner'].filter(Boolean)
        return {
            mode: 'non_food',
            terms: uniqueStrings(fallbackTerms),
            recipes: [],
            narrative: buildNarrative('non_food', []),
        }
    }

    return {
        mode: 'neutral',
        terms: uniqueStrings([mainResult?.product.name || anchorText].filter(Boolean)),
        recipes: [],
        narrative: buildNarrative('neutral', []),
    }
}

function filterByRecommendationMode(items: ProductSearchResult[], mode: RecommendationMode): ProductSearchResult[] {
    if (mode === 'food') {
        return items.filter((row) => {
            const text = buildProductText(row.product.name, row.product.category)
            return isFoodText(text) && !isCareText(text)
        })
    }

    if (mode === 'non_food') {
        const strict = items.filter((row) => {
            const text = buildProductText(row.product.name, row.product.category)
            return isCareText(text) && !isFoodText(text)
        })
        if (strict.length) return strict

        return items.filter((row) => !isFoodText(buildProductText(row.product.name, row.product.category)))
    }

    return items
}

export default function HomePage() {
    const { user, logout } = useAuth()
    const { addItem, cart } = useCart()
    const { openCart } = useOutletContext<LayoutOutletContext>()
    const { activeStore, fetchStores } = useStore()
    const {
        locations,
        currentLocation,
        mapData,
        currentPath,
        initializeMap,
        findPath,
        getMapWithPath,
        getMapWithStops,
        setCurrentLocation,
        error: navigationError,
    } = useNavigation()

    const [notice, setNotice] = useState<Notice | null>(null)
    const [storeId, setStoreId] = useState(SAMPLE_STORE)
    const [inputLanguage, setInputLanguage] = useState<LanguageCode>('en')
    const [outputLanguage, setOutputLanguage] = useState<LanguageCode>('en')
    const [search, setSearch] = useState('')
    const [mainResult, setMainResult] = useState<ProductSearchResult | null>(null)
    const [routeSteps, setRouteSteps] = useState<string[]>([])
    const [resultCount, setResultCount] = useState(0)
    const [recommendations, setRecommendations] = useState<ProductSearchResult[]>([])
    const [recommendationPlan, setRecommendationPlan] = useState<RecommendationPlan | null>(null)
    const [selectedRecipe, setSelectedRecipe] = useState<RecipeSuggestion | null>(null)
    const [recipeIngredientDetails, setRecipeIngredientDetails] = useState<RecipeIngredientDetail[]>([])
    const [selectedRecipeIngredients, setSelectedRecipeIngredients] = useState<string[]>([])
    const [checkingRecipe, setCheckingRecipe] = useState(false)
    const [addingRecipeIngredients, setAddingRecipeIngredients] = useState(false)
    const [dietFilter, setDietFilter] = useState<DietFilter>('All')
    const [budgetModeEnabled, setBudgetModeEnabled] = useState(false)
    const [budgetAmount, setBudgetAmount] = useState('1000')
    const [budgetDietChoice, setBudgetDietChoice] = useState<BudgetDietChoice>('Veg')
    const [budgetNeedType, setBudgetNeedType] = useState<BudgetNeedType>('meal')
    const [budgetGoal, setBudgetGoal] = useState('')
    const [budgetQuickSearch, setBudgetQuickSearch] = useState('')
    const [selectedBudgetItemKey, setSelectedBudgetItemKey] = useState<string | null>(null)
    const [budgetInsights, setBudgetInsights] = useState<BudgetInsights | null>(null)
    const [budgetLoading, setBudgetLoading] = useState(false)
    const [offerItems, setOfferItems] = useState<OfferCarouselItem[]>([])
    const [offersLoading, setOffersLoading] = useState(false)
    const [routeVoiceAutoEnabled, setRouteVoiceAutoEnabled] = useState(true)
    const [qaInput, setQaInput] = useState('')
    const [qaRows, setQaRows] = useState<QaRow[]>([])
    const [recording, setRecording] = useState<VoiceTarget>(null)
    const [playingId, setPlayingId] = useState<string | null>(null)
    const [voiceAssistEnabled, setVoiceAssistEnabled] = useState(true)
    const [budgetAlertEnabled, setBudgetAlertEnabled] = useState(false)
    const [budgetAlertInput, setBudgetAlertInput] = useState('2000')
    const [isQrCameraOpen, setIsQrCameraOpen] = useState(false)
    const [busy, setBusy] = useState({ file: false, qr: false, search: false, qa: false })
    const userName = user?.name?.trim() || 'Guest User'
    const spokenAddressee = useMemo(() => {
        if (user?.is_guest) return 'Guest User'
        const name = user?.name?.trim()
        return name || 'User'
    }, [user?.is_guest, user?.name])

    const fileRef = useRef<HTMLInputElement>(null)
    const mediaRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const qrScannerRef = useRef<Html5Qrcode | null>(null)
    const qrScanHandledRef = useRef(false)
    const activeAudioRef = useRef<HTMLAudioElement | null>(null)
    const activeAudioUrlRef = useRef<string | null>(null)
    const didInitRef = useRef(false)
    const didAutoSearchRef = useRef(false)
    const budgetExceededVoiceRef = useRef(false)

    const budgetAlertLimit = useMemo(() => {
        const value = Number.parseFloat(budgetAlertInput)
        return Number.isFinite(value) && value > 0 ? value : null
    }, [budgetAlertInput])

    useEffect(() => {
        void fetchStores()
    }, [fetchStores])

    useEffect(() => {
        if (activeStore?.shop_id) setStoreId(activeStore.shop_id)
    }, [activeStore?.shop_id])

    useEffect(() => {
        const boot = async () => {
            if (didInitRef.current) return
            didInitRef.current = true
            try {
                await initializeMap(activeStore?.shop_id || 'sample')
            } catch (error) {
                setNotice({ type: 'error', message: getErrorMessage(error) })
            }
        }
        void boot()
    }, [activeStore?.shop_id, initializeMap])

    useEffect(() => {
        if (!locations.length || currentLocation) return
        const entrance = locations.find((loc) => loc.name.toLowerCase().includes('entrance'))
        setCurrentLocation(entrance?.name || locations[0].name)
    }, [currentLocation, locations, setCurrentLocation])

    useEffect(() => {
        if (!notice) return
        const timer = window.setTimeout(() => setNotice(null), 5000)
        return () => window.clearTimeout(timer)
    }, [notice])

    useEffect(() => {
        setSelectedRecipe(null)
        setRecipeIngredientDetails([])
        setSelectedRecipeIngredients([])
        setCheckingRecipe(false)
        setAddingRecipeIngredients(false)
    }, [recommendationPlan])

    useEffect(() => {
        if (budgetModeEnabled) return
        setBudgetInsights(null)
        setBudgetLoading(false)
        setSelectedBudgetItemKey(null)
        setBudgetQuickSearch('')
    }, [budgetModeEnabled])

    const startLocation = useMemo(() => {
        if (currentLocation && locations.some((loc) => loc.name === currentLocation)) return currentLocation
        const entrance = locations.find((loc) => loc.name.toLowerCase().includes('entrance'))
        return entrance?.name || locations[0]?.name || ''
    }, [currentLocation, locations])

    const updateCurrentLocationAfterRoute = useCallback((nextLocation: string | null | undefined) => {
        const location = (nextLocation || '').trim()
        if (!location) return
        setCurrentLocation(location)
    }, [setCurrentLocation])

    const filteredRecommendations = useMemo(() => {
        return applyDietFilter(recommendations, dietFilter)
    }, [dietFilter, recommendations])

    const offerMarqueeItems = useMemo(() => {
        if (!offerItems.length) return []
        return [...offerItems, ...offerItems]
    }, [offerItems])

    const loadOfferItems = useCallback(async () => {
        setOffersLoading(true)
        try {
            const response = await navigationService.searchProducts({ limit: 80 })
            const deduped = new Map<string, ProductSearchResult>()
            for (const row of response.results) {
                if (!row?.product?.name || row.location === 'Document Analysis') continue
                const key = `${normalizeText(row.product.name)}::${normalizeText(row.location)}`
                if (!deduped.has(key)) deduped.set(key, row)
            }

            const sorted = Array.from(deduped.values())
                .filter((row) => Number.isFinite(row.product.price) && row.product.price > 0)
                .sort((a, b) => a.product.price - b.product.price)
                .slice(0, 12)

            const discountPattern = [10, 12, 15, 18, 20, 25]
            const offerTags = ['Special Offer', 'Limited Sale', 'Family Saver', 'Student Deal']
            const offers = sorted.map((row, index) => {
                const discountPercent = discountPattern[index % discountPattern.length]
                const originalPrice = Math.round(row.product.price * (1 + discountPercent / 100))
                const thumbnail = buildOfferLocalImageUrl(row.product.name, row.product.category)
                const fallbackThumbnail = '/pic3.jpeg'
                const finalFallbackThumbnail = '/pic3.jpeg'
                return {
                    id: `${normalizeText(row.product.name)}-${normalizeText(row.location)}-${index}`,
                    row,
                    originalPrice,
                    discountPercent,
                    offerTag: offerTags[index % offerTags.length],
                    thumbnail,
                    fallbackThumbnail,
                    finalFallbackThumbnail,
                } satisfies OfferCarouselItem
            })
            setOfferItems(offers)
        } catch {
            setOfferItems([])
        } finally {
            setOffersLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!locations.length) return
        void loadOfferItems()
    }, [locations.length, loadOfferItems, storeId])

    const translateText = useCallback(async (text: string, source: LanguageCode, target: LanguageCode): Promise<string> => {
        if (!text.trim() || source === target) return text
        try {
            const response = await translationService.translate(text, source, target)
            if (response.success && response.translated_text) return response.translated_text
        } catch {
            // fallback to original
        }
        return text
    }, [])

    const stopActiveAudio = useCallback(() => {
        if (activeAudioRef.current) {
            activeAudioRef.current.pause()
            activeAudioRef.current = null
        }
        if (activeAudioUrlRef.current) {
            URL.revokeObjectURL(activeAudioUrlRef.current)
            activeAudioUrlRef.current = null
        }
        setPlayingId(null)
    }, [])

    useEffect(() => {
        return () => {
            stopActiveAudio()
        }
    }, [stopActiveAudio])

    const playAnswerAudio = useCallback(async (id: string, text: string, language: LanguageCode) => {
        try {
            stopActiveAudio()
            setPlayingId(id)
            const blob = await audioService.textToSpeech(text, language)
            const url = URL.createObjectURL(blob)
            const audio = new Audio(url)
            activeAudioRef.current = audio
            activeAudioUrlRef.current = url
            audio.onended = () => {
                if (activeAudioRef.current === audio) activeAudioRef.current = null
                if (activeAudioUrlRef.current === url) {
                    URL.revokeObjectURL(url)
                    activeAudioUrlRef.current = null
                }
                setPlayingId((prev) => (prev === id ? null : prev))
            }
            await audio.play()
        } catch (error) {
            stopActiveAudio()
            setNotice({ type: 'error', message: getErrorMessage(error) })
        }
    }, [stopActiveAudio])

    const speakLocalizedText = useCallback(async (id: string, englishText: string) => {
        const clean = englishText.trim()
        if (!clean) return
        const addressed = `Dear ${spokenAddressee}, ${clean}`
        const localized = await translateText(addressed, 'en', outputLanguage)
        await playAnswerAudio(id, localized, outputLanguage)
    }, [outputLanguage, playAnswerAudio, spokenAddressee, translateText])

    useEffect(() => {
        if (!budgetAlertEnabled || !budgetAlertLimit) {
            budgetExceededVoiceRef.current = false
            return
        }

        const isOverLimit = cart.total > budgetAlertLimit
        if (!isOverLimit) {
            budgetExceededVoiceRef.current = false
            return
        }
        if (budgetExceededVoiceRef.current) return

        budgetExceededVoiceRef.current = true
        setNotice({
            type: 'info',
            message: `Budget alert: your cart total ${formatInr(cart.total)} exceeds ${formatInr(budgetAlertLimit)}.`,
        })
        void speakLocalizedText(
            'budget-alert-exceeded',
            `Your spending is ${formatInr(cart.total)}, which exceeds your budget ${formatInr(budgetAlertLimit)}. Please remove some items.`
        )
    }, [budgetAlertEnabled, budgetAlertLimit, cart.total, speakLocalizedText])

    const playAddressedAudio = useCallback(async (id: string, text: string, language: LanguageCode) => {
        const clean = text.trim()
        if (!clean) return
        const prefix = await translateText(`Dear ${spokenAddressee},`, 'en', language)
        await playAnswerAudio(id, `${prefix} ${clean}`.trim(), language)
    }, [playAnswerAudio, spokenAddressee, translateText])

    const buildSmartRecommendations = useCallback(async (
        anchorText: string,
        main: ProductSearchResult | null
    ): Promise<{ items: ProductSearchResult[]; plan: RecommendationPlan }> => {
        const normalizedAnchor = anchorText.trim()
        if (!normalizedAnchor && !main) {
            return {
                items: [],
                plan: {
                    mode: 'neutral',
                    terms: [],
                    recipes: [],
                    narrative: 'Related items are shown below.',
                },
            }
        }

        const plan = planRecommendations(normalizedAnchor, main)
        const requests: Array<Promise<any>> = []

        if (main?.product?.name) {
            requests.push(navigationService.getAlternatives(main.product.name))
        }
        if (main?.product?.category) {
            requests.push(navigationService.searchProducts({ category: main.product.category, limit: 8 }))
        }
        for (const term of plan.terms.slice(0, 6)) {
            requests.push(navigationService.searchProducts({ query: term, limit: 6 }))
        }

        const settled = await Promise.allSettled(requests)
        const pool: ProductSearchResult[] = []
        for (const result of settled) {
            if (result.status !== 'fulfilled') continue
            if (Array.isArray(result.value?.alternatives)) {
                pool.push(...(result.value.alternatives as ProductSearchResult[]))
            }
            if (Array.isArray(result.value?.results)) {
                pool.push(...(result.value.results as ProductSearchResult[]))
            }
        }

        const baseName = main?.product.name.toLowerCase()
        const unique = new Map<string, ProductSearchResult>()
        for (const row of pool) {
            if (!row?.product?.name || !row.location) continue
            if (baseName && row.product.name.toLowerCase() === baseName) continue
            const key = `${row.product.name.toLowerCase()}::${row.location.toLowerCase()}`
            if (!unique.has(key)) unique.set(key, row)
        }

        return {
            items: filterByRecommendationMode(Array.from(unique.values()), plan.mode).slice(0, 8),
            plan,
        }
    }, [])

    const chooseRecipe = useCallback(async (recipe: RecipeSuggestion) => {
        setSelectedRecipe(recipe)
        setSelectedRecipeIngredients([])
        setCheckingRecipe(true)
        setAddingRecipeIngredients(false)
        try {
            const lookups = await Promise.allSettled(
                recipe.ingredients.map((ingredient) => navigationService.searchProducts({ query: ingredient, limit: 4 }))
            )

            const details: RecipeIngredientDetail[] = recipe.ingredients.map((ingredient, index) => {
                const lookup = lookups[index]
                if (!lookup || lookup.status !== 'fulfilled' || !lookup.value.results.length) {
                    return { ingredient, available: false }
                }

                const preferred = lookup.value.results.find((row) => {
                    const text = buildProductText(row.product.name, row.product.category)
                    return isFoodText(text)
                }) || lookup.value.results[0]

                if (!preferred) return { ingredient, available: false }

                const stock = preferred.product.stock?.trim()
                const unavailable = stockMeansUnavailable(stock)
                return {
                    ingredient,
                    available: !unavailable,
                    productName: preferred.product.name,
                    location: preferred.location,
                    price: preferred.product.price,
                    stock,
                    category: preferred.product.category,
                }
            })
            setRecipeIngredientDetails(details)
        } catch {
            setRecipeIngredientDetails(recipe.ingredients.map((ingredient) => ({ ingredient, available: false })))
        } finally {
            setCheckingRecipe(false)
        }
    }, [])

    const selectedRecipeTotal = useMemo(() => {
        return recipeIngredientDetails
            .filter((item) => item.available && typeof item.price === 'number')
            .reduce((sum, item) => sum + (item.price || 0), 0)
    }, [recipeIngredientDetails])

    const selectedRecipeIngredientKeySet = useMemo(() => {
        return new Set(selectedRecipeIngredients)
    }, [selectedRecipeIngredients])

    const selectedRecipeSelectionTotal = useMemo(() => {
        return recipeIngredientDetails
            .filter((item) => item.available && selectedRecipeIngredientKeySet.has(recipeIngredientKey(item.ingredient)) && typeof item.price === 'number')
            .reduce((sum, item) => sum + (item.price || 0), 0)
    }, [recipeIngredientDetails, selectedRecipeIngredientKeySet])

    const toggleRecipeIngredient = useCallback((ingredient: string) => {
        const key = recipeIngredientKey(ingredient)
        setSelectedRecipeIngredients((prev) => {
            if (prev.includes(key)) return prev.filter((item) => item !== key)
            return [...prev, key]
        })
    }, [])

    const addSelectedRecipeIngredientsToList = useCallback(async () => {
        if (!selectedRecipeIngredients.length) {
            setNotice({ type: 'info', message: 'Select at least one ingredient first.' })
            return
        }

        const selected = recipeIngredientDetails.filter((item) => selectedRecipeIngredientKeySet.has(recipeIngredientKey(item.ingredient)))
        const availableRows = selected.filter(
            (item) => item.available && item.productName && item.location && typeof item.price === 'number'
        )
        if (!availableRows.length) {
            setNotice({ type: 'info', message: 'Selected ingredients are unavailable in current store data.' })
            return
        }

        setAddingRecipeIngredients(true)
        let addedCount = 0
        for (const row of availableRows) {
            try {
                await addItem({
                    name: row.productName as string,
                    price: row.price as number,
                    location: row.location as string,
                    category: row.category,
                })
                addedCount += 1
            } catch {
                // Continue adding other selected ingredients even if one fails.
            }
        }
        setAddingRecipeIngredients(false)

        if (addedCount === 0) {
            setNotice({ type: 'error', message: 'Could not add selected ingredients to list.' })
            return
        }

        setSelectedRecipeIngredients((prev) => {
            const addedKeys = new Set(availableRows.map((row) => recipeIngredientKey(row.ingredient)))
            return prev.filter((key) => !addedKeys.has(key))
        })

        setNotice({
            type: 'success',
            message: addedCount === 1 ? '1 ingredient added to list.' : `${addedCount} ingredients added to list.`,
        })
    }, [addItem, recipeIngredientDetails, selectedRecipeIngredientKeySet, selectedRecipeIngredients.length])

    const resolveProductsFromQueryTerms = useCallback(async (terms: string[]): Promise<ProductSearchResult[]> => {
        const normalizedTerms = uniqueStrings(terms.map((term) => cleanQueryItemTerm(term)).filter(Boolean)).slice(0, 6)
        if (!normalizedTerms.length) return []

        const lookups = await Promise.allSettled(
            normalizedTerms.map((term) => navigationService.searchProducts({ query: term, limit: 6 }))
        )

        const resolved: ProductSearchResult[] = []
        for (let index = 0; index < lookups.length; index += 1) {
            const lookup = lookups[index]
            if (!lookup || lookup.status !== 'fulfilled' || !lookup.value.results.length) continue

            const term = normalizeText(normalizedTerms[index])
            const preferred = lookup.value.results.find((row) => {
                const productText = buildProductText(row.product.name, row.product.category)
                return term && (productText.includes(term) || term.includes(normalizeText(row.product.name)))
            }) || lookup.value.results[0]

            if (!preferred) continue
            resolved.push(preferred)
        }

        const deduped = new Map<string, ProductSearchResult>()
        for (const row of resolved) {
            const key = `${normalizeText(row.product.name)}::${normalizeText(row.location)}`
            if (!deduped.has(key)) deduped.set(key, row)
        }
        return Array.from(deduped.values())
    }, [])

    const applyOptimizedRouteForItems = useCallback(async (items: string[]): Promise<ShoppingRouteStop[]> => {
        if (!startLocation || !items.length) return []

        const route = await navigationService.planShoppingRoute(items, startLocation)
        const stops = groupShoppingRouteStops(route.route)
        if (!stops.length) {
            const missing = route.items_not_found.length ? ` Missing: ${route.items_not_found.join(', ')}.` : ''
            setRouteSteps([`Could not build a path from these items.${missing}`.trim()])
            return []
        }

        const steps = [`Start at ${startLocation}.`]
        stops.forEach((stop, index) => {
            const walk = stop.distanceFromPrevious > 0
                ? `Walk ${Math.round(stop.distanceFromPrevious)} px to ${stop.location}`
                : `Go to ${stop.location}`
            steps.push(`${index + 1}. ${walk} and pick ${stop.items.join(', ')}.`)
        })
        if (route.items_not_found.length) {
            steps.push(`Not found in store: ${route.items_not_found.join(', ')}.`)
        }
        steps.push(`Optimized list distance: ${Math.round(route.total_distance)} px.`)
        setRouteSteps(steps)

        await getMapWithStops(startLocation, stops.map((stop) => stop.location))
        const lastStop = stops[stops.length - 1]
        if (lastStop?.location) updateCurrentLocationAfterRoute(lastStop.location)
        return stops
    }, [getMapWithStops, startLocation, updateCurrentLocationAfterRoute])

    const buildBudgetShoppingPlan = useCallback(async () => {
        const budget = Number.parseFloat(budgetAmount)
        if (!Number.isFinite(budget) || budget <= 0) {
            setNotice({ type: 'info', message: 'Enter a valid budget amount (for example, 1000).' })
            return
        }

        setBudgetLoading(true)
        setNotice(null)
        try {
            const response = await navigationService.searchProducts({ limit: 200 })
            const deduped = new Map<string, ProductSearchResult>()
            for (const row of response.results) {
                const key = `${normalizeText(row.product.name)}::${normalizeText(row.location)}`
                if (!deduped.has(key)) deduped.set(key, row)
            }

            let allItems = Array.from(deduped.values()).filter((row) => {
                return row.location !== 'Document Analysis' && Number.isFinite(row.product.price) && row.product.price > 0
            })

            if (!allItems.length) {
                const localPool = [
                    ...offerItems.map((offer) => offer.row),
                    ...recommendations,
                    ...(mainResult ? [mainResult] : []),
                ]
                const localDeduped = new Map<string, ProductSearchResult>()
                for (const row of localPool) {
                    if (!row?.product?.name || !row.location) continue
                    const key = `${normalizeText(row.product.name)}::${normalizeText(row.location)}`
                    if (!localDeduped.has(key)) localDeduped.set(key, row)
                }
                allItems = Array.from(localDeduped.values()).filter((row) => {
                    return row.location !== 'Document Analysis' && Number.isFinite(row.product.price) && row.product.price > 0
                })
            }

            let filtered = applyDietFilter(allItems, budgetDietChoice)
            const intentFiltered = filtered.filter((row) => {
                const text = buildProductText(row.product.name, row.product.category)
                return budgetNeedType === 'meal' ? isFoodText(text) : isCareText(text)
            })
            if (intentFiltered.length) filtered = intentFiltered

            const normalizedGoal = normalizeText(budgetGoal)
            if (normalizedGoal) {
                const typedTerms = extractQueryItemTerms(budgetGoal)
                if (typedTerms.length) {
                    const searchedGoalRows = await resolveProductsFromQueryTerms(typedTerms)
                    if (searchedGoalRows.length) {
                        let typedFiltered = applyDietFilter(searchedGoalRows, budgetDietChoice)
                        const typedIntentFiltered = typedFiltered.filter((row) => {
                            const text = buildProductText(row.product.name, row.product.category)
                            return budgetNeedType === 'meal' ? isFoodText(text) : isCareText(text)
                        })
                        if (typedIntentFiltered.length) typedFiltered = typedIntentFiltered
                        if (typedFiltered.length) filtered = typedFiltered
                    }
                } else {
                    const goalTerms = uniqueStrings(normalizedGoal.split(/\s+/).filter((term) => term.length > 1))
                    const goalMatches = filtered.filter((row) => {
                        const text = buildProductText(row.product.name, row.product.category)
                        return goalTerms.some((term) => text.includes(term))
                    })
                    if (goalMatches.length) filtered = goalMatches
                }
            }

            if (!filtered.length) {
                const emptyInsights: BudgetInsights = {
                    budget,
                    estimatedSpend: 0,
                    remaining: budget,
                    bestItems: [],
                    totalCandidates: allItems.length,
                    appliedDiet: budgetDietChoice,
                    appliedNeed: budgetNeedType,
                    goal: budgetGoal.trim(),
                }
                setBudgetInsights(emptyInsights)
                setNotice({ type: 'info', message: 'No products match those filters right now. Try a different diet/need or item keywords.' })
                return
            }

            const sortedByPrice = [...filtered].sort((a, b) => a.product.price - b.product.price)

            const bestItems: ProductSearchResult[] = []
            let estimatedSpend = 0
            for (const row of sortedByPrice) {
                if (estimatedSpend + row.product.price > budget) continue
                bestItems.push(row)
                estimatedSpend += row.product.price
                if (bestItems.length >= 16) break
            }

            const insights: BudgetInsights = {
                budget,
                estimatedSpend,
                remaining: Math.max(0, budget - estimatedSpend),
                bestItems,
                totalCandidates: filtered.length,
                appliedDiet: budgetDietChoice,
                appliedNeed: budgetNeedType,
                goal: budgetGoal.trim(),
            }
            setBudgetInsights(insights)
            setDietFilter(budgetDietChoice)

            if (!bestItems.length) {
                setNotice({ type: 'info', message: 'No combination found within budget. Try increasing budget.' })
            } else {
                setNotice({
                    type: 'success',
                    message: `Budget plan ready: ${bestItems.length} items in ${formatInr(estimatedSpend)} (budget ${formatInr(budget)}).`,
                })
            }
        } catch (error) {
            const emptyInsights: BudgetInsights = {
                budget,
                estimatedSpend: 0,
                remaining: budget,
                bestItems: [],
                totalCandidates: 0,
                appliedDiet: budgetDietChoice,
                appliedNeed: budgetNeedType,
                goal: budgetGoal.trim(),
            }
            setBudgetInsights(emptyInsights)
            setNotice({ type: 'error', message: getErrorMessage(error) })
        } finally {
            setBudgetLoading(false)
        }
    }, [budgetAmount, budgetDietChoice, budgetGoal, budgetNeedType, mainResult, offerItems, recommendations, resolveProductsFromQueryTerms])

    const runProductSearch = useCallback(async (query: string) => {
        const raw = query.trim()
        if (!raw) return
        setBusy((prev) => ({ ...prev, search: true }))
        setNotice(null)
        try {
            const englishQuery = await translateText(raw, inputLanguage, 'en')
            const hasExplicitListDelimiter = /,|;|\/|&|\bplus\b|\band\b/i.test(englishQuery)
            if (hasExplicitListDelimiter) {
                const listTerms = extractQueryItemTerms(englishQuery)
                if (listTerms.length >= 2) {
                    const resolved = await resolveProductsFromQueryTerms(listTerms)
                    if (resolved.length >= 2) {
                        const routeItems = uniqueStrings(resolved.map((row) => row.product.name))
                        const first = resolved[0]
                        setMainResult(first)
                        setResultCount(resolved.length)
                        setSearch(routeItems.join(', '))

                        const stops = startLocation ? await applyOptimizedRouteForItems(routeItems) : []
                        const smartRecommendations = await buildSmartRecommendations(first.product.name, first)
                        setRecommendations(smartRecommendations.items)
                        setRecommendationPlan(smartRecommendations.plan)

                        const summary = resolved
                            .map((row) => `${row.product.name}: ${formatInr(row.product.price)} at ${row.location}`)
                            .join('; ')
                        const routeVoiceNote = startLocation
                            ? (stops.length
                                ? `Optimized route from ${startLocation} is ready. ${stops.map((stop, index) => `Stop ${index + 1}: ${stop.location} for ${stop.items.join(', ')}`).join('. ')}.`
                                : 'I could not generate a combined route path for all items.')
                            : 'Scan store QR to set your current location and generate route on the map.'
                        if (routeVoiceAutoEnabled) {
                            void speakLocalizedText('search-auto', `Found ${resolved.length} items. ${summary}. ${routeVoiceNote}`)
                        }

                        const routeNote = startLocation && stops.length ? ' Combined optimized route is shown on map.' : ''
                        setNotice({ type: 'success', message: `Found ${resolved.length} items.${routeNote}` })
                        return
                    }
                }
            }

            const response = await navigationService.searchProducts({ query: englishQuery, limit: 10 })
            setResultCount(response.results.length)
            if (response.results.length === 0) {
                setMainResult(null)
                setRecommendations([])
                setRecommendationPlan(null)
                setRouteSteps([])
                setNotice({ type: 'info', message: `No item found for "${raw}".` })
                if (routeVoiceAutoEnabled) {
                    void speakLocalizedText('search-auto', `No item found for "${raw}".`)
                }
                return
            }

            const best = response.results[0]
            setMainResult(best)
            let distanceText = ''
            if (startLocation && best.location) {
                const path = await findPath(startLocation, best.location)
                await getMapWithPath(startLocation, best.location)
                const steps = [`Start at ${startLocation}.`, 'Follow highlighted aisle route.', `${best.product.name} is in ${best.location}.`]
                if (path.distance) steps.push(`Approx distance: ${Math.round(path.distance)} px.`)
                if (path.distance) distanceText = ` Approx distance is ${Math.round(path.distance)} pixels.`
                setRouteSteps(steps)
                updateCurrentLocationAfterRoute(best.location)
            }

            const smartRecommendations = await buildSmartRecommendations(englishQuery, best)
            setRecommendations(smartRecommendations.items)
            setRecommendationPlan(smartRecommendations.plan)
            setNotice({ type: 'success', message: `${best.product.name} found at ${best.location}.` })
            if (routeVoiceAutoEnabled) {
                if (startLocation && best.location) {
                    void speakLocalizedText(
                        'search-auto',
                        `${best.product.name} is available at ${best.location} for ${formatInr(best.product.price)}. ` +
                        `Route is shown on the map from ${startLocation} to ${best.location}.${distanceText}`
                    )
                } else {
                    void speakLocalizedText(
                        'search-auto',
                        `${best.product.name} is available at ${best.location} for ${formatInr(best.product.price)}. ` +
                        'Scan QR first to generate route guidance on the map.'
                    )
                }
            }
        } catch (error) {
            setNotice({ type: 'error', message: getErrorMessage(error) })
        } finally {
            setBusy((prev) => ({ ...prev, search: false }))
        }
    }, [applyOptimizedRouteForItems, buildSmartRecommendations, findPath, getMapWithPath, inputLanguage, resolveProductsFromQueryTerms, routeVoiceAutoEnabled, speakLocalizedText, startLocation, translateText, updateCurrentLocationAfterRoute])

    useEffect(() => {
        if (!locations.length || didAutoSearchRef.current) return
        didAutoSearchRef.current = true
        void runProductSearch(search)
    }, [locations.length, runProductSearch, search])

    const askQuestion = useCallback(async (rawQuestion?: string) => {
        const questionRaw = (rawQuestion || qaInput).trim()
        if (!questionRaw) return
        if (!rawQuestion) setQaInput('')
        setBusy((prev) => ({ ...prev, qa: true }))
        try {
            const questionEnglish = await translateText(questionRaw, inputLanguage, 'en')
            let answerEnglish = ''
            let routeVoiceEnglish = ''
            let navResponse: Awaited<ReturnType<typeof navigationService.askNavigation>> | null = null
            let recommendationAnchor: ProductSearchResult | null = mainResult
            const normalizedQuestion = normalizeText(questionEnglish)
            const hasProductIntent = PRODUCT_QUERY_HINTS.some((hint) => normalizedQuestion.includes(hint))
            const queryTerms = extractQueryItemTerms(questionEnglish)
            let resolvedProducts: ProductSearchResult[] = []

            if (hasProductIntent || queryTerms.length >= 2) {
                resolvedProducts = await resolveProductsFromQueryTerms(queryTerms)
            }

            if (resolvedProducts.length >= 2) {
                const routeItems = uniqueStrings(resolvedProducts.map((row) => row.product.name))
                let mapNote = ''
                if (startLocation) {
                    const stops = await applyOptimizedRouteForItems(routeItems)
                    if (stops.length) {
                        mapNote = ` I have shown a combined optimized route on the map from ${startLocation}.`
                        const stopVoice = stops
                            .map((stop, index) => `Stop ${index + 1}: ${stop.location} for ${stop.items.join(', ')}`)
                            .join('. ')
                        routeVoiceEnglish = `Route is ready from ${startLocation}. ${stopVoice}.`
                    } else {
                        mapNote = ' I could not generate a combined route path for all items.'
                        routeVoiceEnglish = `I could not generate a combined route path for ${routeItems.join(', ')}.`
                    }
                }

                        const summary = resolvedProducts
                            .map((row) => `${row.product.name}: ${formatInr(row.product.price)} at ${row.location}`)
                            .join('; ')
                        answerEnglish = `Found ${resolvedProducts.length} items. ${summary}.${mapNote}`
                const first = resolvedProducts[0]
                setMainResult(first)
                recommendationAnchor = first
                setSearch(routeItems.join(', '))
                setResultCount(resolvedProducts.length)
            } else if (resolvedProducts.length === 1 && hasProductIntent) {
                const single = resolvedProducts[0]
                answerEnglish = `${single.product.name} is at ${single.location} for ${formatInr(single.product.price)}.`

                if (startLocation && single.location) {
                    try {
                        const path = await findPath(startLocation, single.location)
                        await getMapWithPath(startLocation, single.location)
                        const steps = [
                            `Start at ${startLocation}.`,
                            'Follow highlighted aisle route.',
                            `${single.product.name} is in ${single.location}.`,
                        ]
                        if (path.distance) steps.push(`Approx distance: ${Math.round(path.distance)} px.`)
                        setRouteSteps(steps)
                        updateCurrentLocationAfterRoute(single.location)
                        answerEnglish += ` Route is shown on the map from ${startLocation}.`
                        routeVoiceEnglish = `${single.product.name} is at ${single.location}. Start from ${startLocation} and follow the highlighted route.${path.distance ? ` Approx walking distance is ${Math.round(path.distance)} pixels.` : ''}`
                    } catch {
                        // Keep answer even if path rendering fails.
                    }
                }

                setMainResult(single)
                recommendationAnchor = single
                setSearch(single.product.name)
                setResultCount(1)
            } else {
                try {
                    navResponse = await navigationService.askNavigation(questionEnglish, startLocation || undefined, 'en')
                    answerEnglish = navResponse.answer

                    if (navResponse.destination_location && startLocation) {
                        try {
                            const path = await findPath(startLocation, navResponse.destination_location)
                            await getMapWithPath(startLocation, navResponse.destination_location)
                            if (navResponse.route_steps && navResponse.route_steps.length > 0) {
                                setRouteSteps(navResponse.route_steps)
                            } else {
                                const generatedSteps = [
                                    `Start at ${startLocation}.`,
                                    'Follow highlighted aisle route.',
                                    `Destination: ${navResponse.destination_location}.`,
                                ]
                                if (path.distance) generatedSteps.push(`Approx distance: ${Math.round(path.distance)} px.`)
                                setRouteSteps(generatedSteps)
                            }
                            updateCurrentLocationAfterRoute(navResponse.destination_location)
                            routeVoiceEnglish = `Destination is ${navResponse.destination_location}. Start from ${startLocation} and follow the highlighted route.${path.distance ? ` Approx walking distance is ${Math.round(path.distance)} pixels.` : ''}`
                        } catch {
                            // keep Q&A response even if map render fails
                        }
                    }

                    if (navResponse.matched_product) {
                        const matched = navResponse.matched_product
                        const matchedResult: ProductSearchResult = {
                            product: {
                                name: matched.name,
                                category: 'General',
                                price: matched.price,
                                price_display: formatInr(matched.price),
                                type: matched.type || 'Unknown',
                                location: matched.location,
                            },
                            location: matched.location,
                            match_score: 100,
                        }
                        setMainResult(matchedResult)
                        recommendationAnchor = matchedResult
                        setSearch(navResponse.search_query_used || matched.name)
                        setResultCount(1)
                    }
                } catch (navError) {
                    try {
                        const ragResponse = await ragService.query({ question: questionEnglish, language: 'en', include_sources: false })
                        answerEnglish = ragResponse.answer
                    } catch {
                        throw navError
                    }
                }
            }

            const localizedAnswer = await translateText(answerEnglish, 'en', outputLanguage)
            const entry: QaRow = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                question: questionRaw,
                answer: localizedAnswer,
                answerLanguage: outputLanguage,
            }
            setQaRows((prev) => [entry, ...prev].slice(0, 6))
            const hasRouteGuidance = routeVoiceEnglish.trim().length > 0
            if (hasRouteGuidance) {
                if (routeVoiceAutoEnabled) {
                    void speakLocalizedText(`qa-route-${entry.id}`, routeVoiceEnglish)
                }
            } else if (voiceAssistEnabled) {
                void playAddressedAudio(entry.id, entry.answer, entry.answerLanguage)
            }

            const recKeyword = recommendationAnchor?.product.name || navResponse?.search_query_used || keywordFromQuestion(questionEnglish)
            const smartRecommendations = await buildSmartRecommendations(recKeyword, recommendationAnchor)
            setRecommendations(smartRecommendations.items)
            setRecommendationPlan(smartRecommendations.plan)
        } catch (error) {
            setNotice({ type: 'error', message: getErrorMessage(error) })
        } finally {
            setBusy((prev) => ({ ...prev, qa: false }))
        }
    }, [applyOptimizedRouteForItems, buildSmartRecommendations, findPath, getMapWithPath, inputLanguage, mainResult, outputLanguage, playAddressedAudio, qaInput, resolveProductsFromQueryTerms, routeVoiceAutoEnabled, speakLocalizedText, startLocation, translateText, updateCurrentLocationAfterRoute, voiceAssistEnabled])

    const toggleVoice = async (target: Exclude<VoiceTarget, null>) => {
        if (recording) {
            mediaRef.current?.stop()
            setRecording(null)
            return
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            let recorder: MediaRecorder
            try {
                recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
            } catch {
                recorder = new MediaRecorder(stream)
            }
            mediaRef.current = recorder
            chunksRef.current = []
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunksRef.current.push(event.data)
            }
            recorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop())
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
                const wav = await convertBlobToWav(blob, 'voice-input.wav')
                const transcript = await audioService.transcribe(wav, inputLanguage)
                const text = transcript.text.trim()
                if (!text) return
                if (target === 'search') {
                    setSearch(text)
                    await runProductSearch(text)
                } else {
                    setQaInput(text)
                    await askQuestion(text)
                }
            }
            recorder.start()
            setRecording(target)
        } catch {
            setNotice({ type: 'error', message: 'Microphone permission denied or unavailable.' })
        }
    }

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        setBusy((prev) => ({ ...prev, file: true }))
        try {
            const isCsv = file.name.toLowerCase().endsWith('.csv')
            const result = file.name.toLowerCase().endsWith('.pdf')
                ? await ragService.uploadPDF(file)
                : await ragService.uploadCSV(file)
            if (isCsv) {
                await initializeMap(activeStore?.shop_id || 'sample')
            }
            setNotice({ type: 'success', message: result.message })
        } catch (error) {
            setNotice({ type: 'error', message: getErrorMessage(error) })
        } finally {
            setBusy((prev) => ({ ...prev, file: false }))
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    const stopQrScanner = useCallback(async () => {
        const scanner = qrScannerRef.current
        qrScannerRef.current = null
        if (!scanner) return
        try {
            await scanner.stop()
        } catch {
            // scanner may not be started yet
        }
        try {
            await scanner.clear()
        } catch {
            // no-op
        }
    }, [])

    const processScannedQrData = useCallback(async (qrData: string): Promise<boolean> => {
        setBusy((prev) => ({ ...prev, qr: true }))
        try {
            const trimmed = qrData.trim()
            const anchor = await qrService.validateAnchorData(trimmed, activeStore?.shop_id || undefined)
            if (anchor.valid && anchor.payload) {
                setCurrentLocation(anchor.payload.name)
                setNotice({ type: 'success', message: `QR scanned. Current location: ${anchor.payload.name}` })
                return true
            }

            if (/^https?:\/\//i.test(trimmed)) {
                const upload = await ragService.uploadFromQRUrl(trimmed)
                setNotice({ type: 'success', message: upload.message })
                return true
            }

            throw new Error(anchor.error || 'Use a valid store anchor QR or URL QR.')
        } catch (error) {
            setNotice({ type: 'error', message: getErrorMessage(error) })
            return false
        } finally {
            setBusy((prev) => ({ ...prev, qr: false }))
        }
    }, [activeStore?.shop_id, setCurrentLocation])

    const openQrCamera = useCallback(() => {
        setNotice(null)
        qrScanHandledRef.current = false
        setIsQrCameraOpen(true)
    }, [])

    const closeQrCamera = useCallback(async () => {
        setIsQrCameraOpen(false)
        await stopQrScanner()
    }, [stopQrScanner])

    useEffect(() => {
        if (!isQrCameraOpen) return

        let mounted = true
        const scanner = new Html5Qrcode('home-qr-reader')
        qrScannerRef.current = scanner

        const startScanner = async () => {
            try {
                await scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 260, height: 260 } },
                    async (decodedText) => {
                        if (qrScanHandledRef.current) return
                        qrScanHandledRef.current = true
                        const handled = await processScannedQrData(decodedText)
                        if (handled && mounted) {
                            await stopQrScanner()
                            setIsQrCameraOpen(false)
                        } else {
                            qrScanHandledRef.current = false
                        }
                    },
                    () => {
                        // ignore scan errors while camera is active
                    }
                )
            } catch (error) {
                setNotice({ type: 'error', message: `Camera scan failed: ${getErrorMessage(error)}` })
                if (mounted) setIsQrCameraOpen(false)
                await stopQrScanner()
            }
        }

        void startScanner()
        return () => {
            mounted = false
            void stopQrScanner()
        }
    }, [isQrCameraOpen, processScannedQrData, stopQrScanner])

    const handleAddToList = async (row: ProductSearchResult) => {
        try {
            await addItem({ name: row.product.name, price: row.product.price, location: row.location, category: row.product.category })
            setNotice({ type: 'success', message: `${row.product.name} added to list.` })
        } catch (error) {
            setNotice({ type: 'error', message: getErrorMessage(error) })
        }
    }

    const handleBudgetRoute = async (row: ProductSearchResult) => {
        const itemKey = `${normalizeText(row.product.name)}::${normalizeText(row.location)}`
        setSelectedBudgetItemKey(itemKey)
        if (!startLocation || !row.location) {
            setNotice({ type: 'info', message: 'Current location is not set. Scan QR first.' })
            return
        }

        try {
            const path = await findPath(startLocation, row.location)
            await getMapWithPath(startLocation, row.location)
            const steps = [
                `Start at ${startLocation}.`,
                'Follow highlighted aisle route.',
                `${row.product.name} is in ${row.location}.`,
            ]
            if (path.distance) steps.push(`Approx distance: ${Math.round(path.distance)} px.`)
            setRouteSteps(steps)
            updateCurrentLocationAfterRoute(row.location)
            setMainResult(row)
            setSearch(row.product.name)
            setNotice({ type: 'success', message: `Route ready for ${row.product.name}.` })
            if (routeVoiceAutoEnabled) {
                const voiceText = `${row.product.name} is at ${row.location}. Start from ${startLocation} and follow the highlighted route.${path.distance ? ` Approx walking distance is ${Math.round(path.distance)} pixels.` : ''}`
                void speakLocalizedText('budget-route-auto', voiceText)
            }
        } catch (error) {
            setNotice({ type: 'error', message: getErrorMessage(error) })
        }
    }

    const handleBudgetQuickSearch = async () => {
        const term = budgetQuickSearch.trim()
        if (!term) {
            setNotice({ type: 'info', message: 'Enter a search item to add to checkout.' })
            return
        }
        setSearch(term)
        await runProductSearch(term)
    }

    const handleOfferSelect = async (offer: OfferCarouselItem) => {
        const row = offer.row
        setMainResult(row)
        setSearch(row.product.name)
        setResultCount(1)

        if (!startLocation || !row.location) {
            const fallbackSpeech = `${row.product.name} selected at ${row.location || 'store location unknown'}. Scan QR first to generate route guidance on the map.`
            setNotice({ type: 'info', message: `${row.product.name} selected. Scan QR to generate route.` })
            if (routeVoiceAutoEnabled) {
                void speakLocalizedText('offer-auto', fallbackSpeech)
            }
            return
        }

        try {
            const path = await findPath(startLocation, row.location)
            await getMapWithPath(startLocation, row.location)
            const steps = [
                `Start at ${startLocation}.`,
                'Follow highlighted aisle route.',
                `${row.product.name} offer is in ${row.location}.`,
            ]
            if (path.distance) steps.push(`Approx distance: ${Math.round(path.distance)} px.`)
            setRouteSteps(steps)
            updateCurrentLocationAfterRoute(row.location)
            const voiceText = `${row.product.name} is available at ${row.location} for ${formatInr(row.product.price)}. Start from ${startLocation} and follow the highlighted route. ${path.distance ? `Approx walking distance is ${Math.round(path.distance)} pixels.` : ''}`.trim()
            setNotice({
                type: 'success',
                message: `${row.product.name} | ${formatInr(row.product.price)} at ${row.location}`,
            })
            if (routeVoiceAutoEnabled) {
                void speakLocalizedText('offer-auto', voiceText)
            }
        } catch (error) {
            setNotice({ type: 'error', message: getErrorMessage(error) })
        }
    }

    return (
        <div className="market-home animate-fade-in">
            <input ref={fileRef} type="file" accept=".pdf,.csv" onChange={handleFileUpload} className="hidden" />
            {isQrCameraOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-800">Scan QR with Camera</h3>
                            <button
                                type="button"
                                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                                onClick={() => void closeQrCamera()}
                                aria-label="Close QR scanner"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div id="home-qr-reader" className="overflow-hidden rounded-xl border border-gray-200" />
                        <p className="mt-3 text-xs text-gray-500">Align the QR inside the frame. It will scan automatically.</p>
                    </div>
                </div>
            )}

            <section className="market-hero-scene">
                <div className="market-hero-scene-top">
                    <div className="market-hero-brand-line">
                        <span className="market-hero-brand-mark"><ShoppingCart className="h-7 w-7" /></span>
                        <div className="market-hero-brand-stack">
                            <p className="market-hero-brand-name">CartMapper</p>
                            <p className="market-hero-brand-welcome">Welcome {userName}</p>
                        </div>
                    </div>
                    <div className="market-hero-user-line">
                        <Link className="market-hero-nav-link" to="/about">About</Link>
                        <Link className="market-hero-nav-link" to="/contact">Contact</Link>
                        <button type="button" className="market-hero-cart-btn" onClick={openCart}>
                            <ShoppingCart className="h-4 w-4" />
                            Cart
                            <span className="market-hero-cart-count">{cart.item_count || cart.items.length}</span>
                        </button>
                        <button
                            type="button"
                            className="market-hero-auth-btn is-logout"
                            onClick={() => void logout()}
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </button>
                    </div>
                </div>

                <div className="market-hero-core">
                    <h1 className="market-hero-core-title">Fresh Grocery <span>Smart Flow</span></h1>
                    <p className="market-hero-core-subtitle">From farm to your kitchen</p>
                    <p className="market-hero-core-text">Upload your list, scan store QR, choose language</p>

                    <div className="market-hero-actions market-hero-actions-inline">
                        <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy.file}>
                            {busy.file ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Upload File
                        </button>
                        <button className="btn-secondary" onClick={openQrCamera} disabled={busy.qr}>
                            {busy.qr ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}Scan QR Code
                        </button>
                        <div className="market-budget-alert-control">
                            <label className="market-budget-alert-toggle">
                                <input
                                    type="checkbox"
                                    checked={budgetAlertEnabled}
                                    onChange={(event) => {
                                        const enabled = event.target.checked
                                        setBudgetAlertEnabled(enabled)
                                        if (!enabled) budgetExceededVoiceRef.current = false
                                    }}
                                />
                                Budget Alert
                            </label>
                            {budgetAlertEnabled ? (
                                <>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={budgetAlertInput}
                                        onChange={(event) => setBudgetAlertInput(event.target.value)}
                                        className="market-budget-alert-input"
                                        placeholder="Budget (INR)"
                                    />
                                    <p className="market-budget-alert-note">
                                        {budgetAlertLimit
                                            ? `Voice alert when total exceeds ${formatInr(budgetAlertLimit)}`
                                            : 'Enter a valid budget to enable voice alert.'}
                                    </p>
                                </>
                            ) : (
                                <p className="market-budget-alert-note">Optional. Keep off if you do not need budget voice alerts.</p>
                            )}
                        </div>
                    </div>

                    <div className="market-language-row market-language-grid market-hero-lang-grid">
                        <div className="market-language-box">
                            <label htmlFor="inputLang">Input Language</label>
                            <select id="inputLang" className="market-language-select" value={inputLanguage} onChange={(event) => setInputLanguage(event.target.value as LanguageCode)}>
                                {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.label}</option>)}
                            </select>
                        </div>
                        <div className="market-language-box">
                            <label htmlFor="outputLang">Output Language</label>
                            <select id="outputLang" className="market-language-select" value={outputLanguage} onChange={(event) => setOutputLanguage(event.target.value as LanguageCode)}>
                                {LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            <div className="market-post-hero-bg">
                <section className="market-offer-strip">
                    <div className="market-offer-head">
                        <h2 className="market-offer-title">Offers & Discount Deals</h2>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="btn-secondary px-3 py-1 text-xs"
                                onClick={() => setRouteVoiceAutoEnabled((prev) => {
                                    const next = !prev
                                    if (!next) stopActiveAudio()
                                    return next
                                })}
                            >
                                Route Voice: {routeVoiceAutoEnabled ? 'On' : 'Off'}
                            </button>
                        </div>
                    </div>
                    <div className="market-offer-window">
                        {offersLoading ? (
                            <div className="market-offer-loading"><Loader2 className="h-4 w-4 animate-spin" />Loading offers...</div>
                        ) : offerItems.length ? (
                            <div className="market-offer-track is-animated">
                                {offerMarqueeItems.map((offer, index) => (
                                    <button
                                        key={`${offer.id}-${index}`}
                                        type="button"
                                        className="market-offer-card"
                                        onClick={() => void handleOfferSelect(offer)}
                                        title="Click to show route and price"
                                    >
                                        <div className="market-offer-media">
                                            <img
                                                src={offer.thumbnail}
                                                data-fallback={offer.fallbackThumbnail}
                                                data-final-fallback={offer.finalFallbackThumbnail}
                                                alt={offer.row.product.name}
                                                className="market-offer-thumb"
                                                loading="lazy"
                                                onError={(event) => {
                                                    const image = event.currentTarget
                                                    const fallback = image.dataset.fallback
                                                    const finalFallback = image.dataset.finalFallback
                                                    if (!image.dataset.usedFallback && fallback) {
                                                        image.dataset.usedFallback = 'true'
                                                        image.src = fallback
                                                        return
                                                    }
                                                    if (!image.dataset.usedFinalFallback && finalFallback) {
                                                        image.dataset.usedFinalFallback = 'true'
                                                        image.src = finalFallback
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="market-offer-copy">
                                            <p className="market-offer-name">{offer.row.product.name}</p>
                                            <p className="market-offer-location"><MapPin className="market-offer-location-icon" />{offer.row.location}</p>
                                            <div className="market-offer-badges">
                                                <span className="market-offer-badge">{formatInr(offer.row.product.price)}</span>
                                                <span className="market-offer-badge market-offer-badge-soft">{offer.discountPercent}% OFF</span>
                                            </div>
                                            <p className="market-offer-meta">Was {formatInr(offer.originalPrice)} | {offer.offerTag}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="market-offer-loading">No offers available right now.</p>
                        )}
                    </div>
                </section>

                {(notice || navigationError) ? (
                    <div className={notice?.type === 'error' || navigationError ? 'alert-error' : notice?.type === 'success' ? 'alert-success' : 'alert-info'}>
                        <div className="flex items-center gap-2">
                            {notice?.type === 'error' || navigationError ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                            <span>{navigationError || notice?.message}</span>
                        </div>
                    </div>
                ) : null}

                <section className="market-main-grid">
                <div className="space-y-5">
                    <article className="market-panel">
                        <div className="market-panel-header"><h2><MessageSquare className="h-5 w-5 text-teal-700" />Ask Questions (Text + Voice)</h2><div className="flex items-center gap-2"><span className="market-status-tag">Voice: {LANGUAGE_LABEL[outputLanguage]}</span><button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => setVoiceAssistEnabled((prev) => { const next = !prev; if (!next) stopActiveAudio(); return next })}>Voice Assist: {voiceAssistEnabled ? 'On' : 'Off'}</button></div></div>
                        <div className="flex gap-2">
                            <input className="input-field" value={qaInput} onChange={(event) => setQaInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void askQuestion() }} placeholder="Ask about location, items, recommendations..." disabled={busy.qa} />
                            <button className={`market-voice-btn ${recording === 'qa' ? 'is-active' : ''}`} onClick={() => void toggleVoice('qa')}>{recording === 'qa' ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
                            <button className="btn-primary px-3" onClick={() => void askQuestion()} disabled={!qaInput.trim() || busy.qa}>{busy.qa ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
                        </div>
                        <div className="market-carousel">
                            {qaRows.length === 0 ? <p className="text-sm text-gray-500">Q&A cards will show here. Use Voice Assist toggle for auto-read and play button to listen anytime.</p> : (
                                <div className="market-carousel-track">
                                    {qaRows.map((row) => (
                                        <article key={row.id} className="market-qa-card">
                                            <p className="market-qa-question">{row.question}</p>
                                            <p className="market-qa-answer">{row.answer}</p>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold text-teal-700">{LANGUAGE_LABEL[row.answerLanguage]}</span>
                                                <button className="market-audio-btn" onClick={() => void playAddressedAudio(row.id, row.answer, row.answerLanguage)} disabled={playingId === row.id}>{playingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}</button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    </article>

                    <article className="market-panel">
                        <div className="market-panel-header"><h2><Sparkles className="h-5 w-5 text-teal-700" />Smart Recommendations</h2><span className="market-status-tag">Recipe + INR</span></div>
                        <div className="market-budget-box">
                            <div className="market-budget-head">
                                <label className="market-budget-toggle">
                                    <input type="checkbox" checked={budgetModeEnabled} onChange={(event) => setBudgetModeEnabled(event.target.checked)} />
                                    Budget Shopping Mode
                                </label>
                                <span className="market-status-tag">{budgetModeEnabled ? 'On' : 'Off'}</span>
                            </div>
                            {budgetModeEnabled ? (
                                <div className="space-y-3">
                                    <div className="market-budget-question">
                                        <p className="market-budget-title">1) What is your budget?</p>
                                        <div className="market-budget-controls">
                                            <input
                                                type="number"
                                                min={1}
                                                className="input-field"
                                                value={budgetAmount}
                                                onChange={(event) => setBudgetAmount(event.target.value)}
                                                placeholder="Enter budget in INR (e.g., 1000)"
                                            />
                                        </div>
                                    </div>

                                    <div className="market-budget-question">
                                        <p className="market-budget-title">2) Choose diet preference</p>
                                        <div className="market-filter-row !my-0">
                                            {(['Vegan', 'Veg', 'Non-Veg'] as BudgetDietChoice[]).map((choice) => (
                                                <button
                                                    key={choice}
                                                    type="button"
                                                    className={`market-filter-chip ${budgetDietChoice === choice ? 'is-active' : ''}`}
                                                    onClick={() => setBudgetDietChoice(choice)}
                                                >
                                                    {choice}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="market-budget-question">
                                        <p className="market-budget-title">3) What do you want to buy?</p>
                                        <div className="market-filter-row !my-0">
                                            <button type="button" className={`market-filter-chip ${budgetNeedType === 'meal' ? 'is-active' : ''}`} onClick={() => setBudgetNeedType('meal')}>Meal Ingredients</button>
                                            <button type="button" className={`market-filter-chip ${budgetNeedType === 'care' ? 'is-active' : ''}`} onClick={() => setBudgetNeedType('care')}>Hair / Skin Care</button>
                                        </div>
                                    </div>

                                    <div className="market-budget-question">
                                        <p className="market-budget-title">4) What exactly do you want?</p>
                                        <div className="market-budget-controls">
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={budgetGoal}
                                                onChange={(event) => setBudgetGoal(event.target.value)}
                                                placeholder={budgetNeedType === 'meal' ? 'Write ingredients: rice, milk, sugar' : 'Write products: shampoo, face wash'}
                                            />
                                            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void buildBudgetShoppingPlan()} disabled={budgetLoading}>
                                                {budgetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                                Generate List
                                            </button>
                                        </div>
                                        <p className="market-budget-note">Tip: Use comma-separated ingredients/products to search exact items you write.</p>
                                    </div>

                                    {budgetInsights ? (
                                        <div className="space-y-2">
                                            <div className="market-budget-summary">
                                                <p>Budget: {formatInr(budgetInsights.budget)} | Spend: {formatInr(budgetInsights.estimatedSpend)} | Remaining: {formatInr(budgetInsights.remaining)}</p>
                                                <p className="market-budget-note">Filter: {budgetInsights.appliedDiet} | {budgetInsights.appliedNeed === 'meal' ? 'Meal' : 'Hair/Skin Care'}{budgetInsights.goal ? ` | Goal: ${budgetInsights.goal}` : ''}</p>
                                                <p className="market-budget-note">Scanned {budgetInsights.totalCandidates} matching products in this store.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="market-budget-title">Generated List (Location + Budget)</p>
                                                {budgetInsights.bestItems.length ? budgetInsights.bestItems.map((row) => (
                                                    <div
                                                        key={`budget-item-${row.product.name}-${row.location}`}
                                                        className={`market-budget-row market-budget-item ${selectedBudgetItemKey === `${normalizeText(row.product.name)}::${normalizeText(row.location)}` ? 'is-selected' : ''}`}
                                                        onClick={() => setSelectedBudgetItemKey(`${normalizeText(row.product.name)}::${normalizeText(row.location)}`)}
                                                    >
                                                        <div>
                                                            <p className="font-semibold text-gray-900">{row.product.name}</p>
                                                            <p className="text-xs text-gray-600">{row.product.category} | {row.location}</p>
                                                        </div>
                                                        <div className="text-right market-budget-actions">
                                                            <p className="text-sm font-bold text-teal-800">{formatInr(row.product.price)}</p>
                                                            <button type="button" className="btn-secondary mt-1 px-3 py-1.5 text-xs" onClick={() => void handleAddToList(row)}>Add</button>
                                                            <button type="button" className="btn-secondary mt-1 px-3 py-1.5 text-xs" onClick={() => void handleBudgetRoute(row)}>Location Route</button>
                                                        </div>
                                                    </div>
                                                )) : <p className="text-xs text-gray-500">No item combination fits this budget.</p>}
                                            </div>

                                            <div className="market-budget-search">
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    value={budgetQuickSearch}
                                                    onChange={(event) => setBudgetQuickSearch(event.target.value)}
                                                    onKeyDown={(event) => { if (event.key === 'Enter') void handleBudgetQuickSearch() }}
                                                    placeholder="Search item and add to checkout (e.g., shampoo)"
                                                />
                                                <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void handleBudgetQuickSearch()}>Search & Add</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500">Answer the questions and click Generate List.</p>
                                    )}
                                </div>
                            ) : null}
                        </div>
                        {recommendationPlan?.mode === 'food' && recommendationPlan.recipes.length ? (
                            <div className="market-recipe-box">
                                <p className="market-recipe-lead">{recommendationPlan.narrative}</p>
                                <div className="space-y-2">
                                    {recommendationPlan.recipes.slice(0, 3).map((recipe) => (
                                        <button
                                            key={recipe.dish}
                                            type="button"
                                            className={`market-recipe-item ${selectedRecipe?.dish === recipe.dish ? 'is-active' : ''}`}
                                            onClick={() => void chooseRecipe(recipe)}
                                        >
                                            <p className="market-recipe-title">You can make {recipe.dish}</p>
                                            <p className="market-recipe-ingredients">You may need: {recipe.ingredients.join(', ')}.</p>
                                            <p className="market-recipe-action">Click to choose this recipe and check ingredient availability.</p>
                                        </button>
                                    ))}
                                </div>
                                {selectedRecipe ? (
                                    <div className="market-recipe-check">
                                        <p className="market-recipe-check-title">Selected recipe: {selectedRecipe.dish}</p>
                                        <p className="market-recipe-check-note">Click ingredients to select the ones you want to add to your list.</p>
                                        {checkingRecipe ? <p className="market-recipe-check-note">Checking availability...</p> : null}
                                        {!checkingRecipe && recipeIngredientDetails.length ? (
                                            <div className="space-y-2">
                                                {recipeIngredientDetails.map((item) => (
                                                    <button
                                                        key={`${selectedRecipe.dish}-${item.ingredient}`}
                                                        type="button"
                                                        className={`market-recipe-check-row ${selectedRecipeIngredientKeySet.has(recipeIngredientKey(item.ingredient)) ? 'is-selected' : ''}`}
                                                        onClick={() => toggleRecipeIngredient(item.ingredient)}
                                                    >
                                                        <div>
                                                            <p className="market-recipe-check-ingredient">{item.ingredient}</p>
                                                            {item.available && item.productName ? (
                                                                <p className="market-recipe-check-meta">
                                                                    {item.productName} | {item.location} | {typeof item.price === 'number' ? formatInr(item.price) : 'N/A'}
                                                                </p>
                                                            ) : <p className="market-recipe-check-meta">Not available in current store data</p>}
                                                        </div>
                                                        <div className="market-recipe-check-status">
                                                            <span className={`market-recipe-check-tag ${item.available ? 'is-available' : 'is-missing'}`}>
                                                                {item.available ? 'Available' : 'Unavailable'}
                                                            </span>
                                                            {selectedRecipeIngredientKeySet.has(recipeIngredientKey(item.ingredient)) ? (
                                                                <span className="market-recipe-check-tag is-selected">Selected</span>
                                                            ) : null}
                                                        </div>
                                                    </button>
                                                ))}
                                                <p className="market-recipe-total">Estimated available total: {formatInr(selectedRecipeTotal)}</p>
                                                {selectedRecipeIngredients.length ? (
                                                    <p className="market-recipe-total">Selected ingredient total: {formatInr(selectedRecipeSelectionTotal)}</p>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    className="btn-secondary px-3 py-1.5 text-xs"
                                                    onClick={() => void addSelectedRecipeIngredientsToList()}
                                                    disabled={addingRecipeIngredients || selectedRecipeIngredients.length === 0}
                                                >
                                                    {addingRecipeIngredients ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                                    Add Selected Ingredients ({selectedRecipeIngredients.length}) to List
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </article>
                </div>

                <div className="space-y-5">
                    <article className="market-panel">
                        <div className="market-panel-header">
                            <h2><Search className="h-5 w-5 text-teal-700" />Find Product + Indoor Map</h2>
                            <div className="flex items-center gap-2">
                                <span className="market-status-tag">Live Route</span>
                                <button
                                    type="button"
                                    className="btn-secondary px-3 py-1 text-xs"
                                    onClick={() => setRouteVoiceAutoEnabled((prev) => {
                                        const next = !prev
                                        if (!next) stopActiveAudio()
                                        return next
                                    })}
                                >
                                    Route Voice: {routeVoiceAutoEnabled ? 'On' : 'Off'}
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <input
                                className="input-field"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                onKeyDown={(event) => { if (event.key === 'Enter') void runProductSearch(search) }}
                                placeholder="Search any grocery item (e.g., milk, bread, paneer)"
                            />
                            <button className={`market-voice-btn ${recording === 'search' ? 'is-active' : ''}`} onClick={() => void toggleVoice('search')}>{recording === 'search' ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
                            <button className="btn-primary px-3" onClick={() => void runProductSearch(search)} disabled={!search.trim() || busy.search}>{busy.search ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button>
                        </div>
                        {mainResult ? <div className="market-main-product"><div><p className="text-lg font-semibold text-gray-900">{mainResult.product.name}</p><p className="text-sm text-gray-600">{mainResult.location}</p></div><p className="text-xl font-bold text-teal-800">{formatInr(mainResult.product.price)}</p></div> : null}
                        <div className="market-map-shell">{mapData ? <img src={`data:image/png;base64,${mapData.image_base64}`} alt="Indoor map" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-sm text-gray-500">Map preview appears here.</div>}</div>
                        <div className="market-route-box"><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Route Steps</p><ol className="mt-2 space-y-2 text-sm text-gray-700">{routeSteps.length ? routeSteps.map((step, index) => <li key={`${index}-${step}`} className="flex items-start gap-2"><span className="market-step-dot" />{step}</li>) : <li className="text-gray-500">Search an item or ask for multiple items to generate route.</li>}</ol>{currentPath?.distance ? <p className="mt-2 text-xs text-teal-800">Current path distance: {Math.round(currentPath.distance)} px</p> : null}</div>
                        <div className="mt-3">
                            <div className="market-filter-row">{(['All', 'Vegan', 'Veg', 'Non-Veg'] as DietFilter[]).map((filter) => <button key={filter} className={`market-filter-chip ${dietFilter === filter ? 'is-active' : ''}`} onClick={() => setDietFilter(filter)}>{filter}</button>)}</div>
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                {filteredRecommendations.length ? filteredRecommendations.map((row) => (
                                    <div key={`${row.product.name}-${row.location}`} className="market-product-row">
                                        <div>
                                            <p className="font-semibold text-gray-900">{row.product.name}</p>
                                            <p className="text-xs text-gray-600">{row.product.category} | {row.location}</p>
                                            <p className={`market-type-tag type-${productType(row.product.type).toLowerCase()}`}>{productType(row.product.type)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-base font-bold text-teal-800">{formatInr(row.product.price)}</p>
                                            <button className="btn-secondary mt-1 px-3 py-1.5 text-xs" onClick={() => void handleAddToList(row)}>Add to List</button>
                                        </div>
                                    </div>
                                )) : <p className="text-sm text-gray-500">Search an item to load recommendations.</p>}
                            </div>
                        </div>
                        <div className="market-search-foot">
                            <span className="text-xs text-gray-600">{resultCount} matches</span>
                            <div className="flex items-center gap-2">
                                {mainResult ? <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void handleAddToList(mainResult)}>Add {mainResult.product.name}</button> : null}
                            </div>
                        </div>
                    </article>
                </div>
                </section>

                <footer className="market-site-footer">
                    <p className="market-footer-copy">© {new Date().getFullYear()} CartMapper. All rights reserved.</p>
                </footer>
            </div>
        </div>
    )
}
