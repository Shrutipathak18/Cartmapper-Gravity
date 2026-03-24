import type { CartItem, CartWithBudget, PurchaseHistoryEntry, PurchaseHistoryItem } from '@/types'

const STORAGE_KEY = 'cart_purchase_history_v1'
const MAX_HISTORY_ENTRIES = 30

function toHistoryItem(item: CartItem): PurchaseHistoryItem {
    return {
        name: item.name,
        price: Number(item.price) || 0,
        location: item.location,
        category: item.category,
        quantity: Number(item.quantity) || 1,
    }
}

function isValidHistoryEntry(value: unknown): value is PurchaseHistoryEntry {
    if (!value || typeof value !== 'object') return false

    const entry = value as PurchaseHistoryEntry
    if (typeof entry.id !== 'string' || typeof entry.purchased_at !== 'string') return false
    if (typeof entry.total !== 'number' || typeof entry.item_count !== 'number') return false
    if (!Array.isArray(entry.items)) return false

    return entry.items.every((item) =>
        item &&
        typeof item.name === 'string' &&
        typeof item.location === 'string' &&
        typeof item.category === 'string' &&
        typeof item.price === 'number' &&
        typeof item.quantity === 'number'
    )
}

function readHistory(): PurchaseHistoryEntry[] {
    if (typeof window === 'undefined') return []

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter(isValidHistoryEntry)
    } catch {
        return []
    }
}

function writeHistory(entries: PurchaseHistoryEntry[]): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY_ENTRIES)))
}

export const purchaseHistoryService = {
    getHistory(): PurchaseHistoryEntry[] {
        return readHistory()
    },

    savePurchase(cartSnapshot: Pick<CartWithBudget, 'items' | 'total' | 'item_count'>): PurchaseHistoryEntry {
        const entry: PurchaseHistoryEntry = {
            id: `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            purchased_at: new Date().toISOString(),
            total: Number(cartSnapshot.total) || 0,
            item_count: Number(cartSnapshot.item_count) || 0,
            items: cartSnapshot.items.map(toHistoryItem),
        }

        const history = readHistory()
        const next = [entry, ...history]
        writeHistory(next)
        return entry
    },

    clearHistory(): void {
        if (typeof window === 'undefined') return
        window.localStorage.removeItem(STORAGE_KEY)
    },
}

export default purchaseHistoryService
