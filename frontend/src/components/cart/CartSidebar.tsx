import { X, Trash2, Plus, Minus, DollarSign, ShoppingBag, History, RotateCcw, Clock } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { useCart } from '@/context/CartContext'
import { getErrorMessage } from '@/services/api'
import purchaseHistoryService from '@/services/purchaseHistoryService'
import type { CartWithBudget, PurchaseHistoryEntry } from '@/types'

interface CartSidebarProps {
    isOpen: boolean
    onClose: () => void
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})

const historyDateFormatter = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

function formatInr(value: number): string {
    return `INR ${currencyFormatter.format(value)}`
}

function formatPurchaseDate(value: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Unknown time'
    return historyDateFormatter.format(date)
}

function snapshotCart(cart: CartWithBudget): Pick<CartWithBudget, 'items' | 'total' | 'item_count'> {
    return {
        total: cart.total,
        item_count: cart.item_count,
        items: cart.items.map((item) => ({ ...item })),
    }
}

export default function CartSidebar({ isOpen, onClose }: CartSidebarProps) {
    const { cart, addItem, removeItem, updateQuantity, setBudget, clearCart } = useCart()
    const [budgetInput, setBudgetInput] = useState('')
    const [isSettingBudget, setIsSettingBudget] = useState(false)
    const [history, setHistory] = useState<PurchaseHistoryEntry[]>(() => purchaseHistoryService.getHistory())
    const [isCheckingOut, setIsCheckingOut] = useState(false)
    const [buyAgainId, setBuyAgainId] = useState<string | null>(null)
    const [historyMessage, setHistoryMessage] = useState<string | null>(null)

    const handleSetBudget = async () => {
        const budget = parseFloat(budgetInput)
        if (!isNaN(budget) && budget > 0) {
            await setBudget(budget)
            setBudgetInput('')
            setIsSettingBudget(false)
        }
    }

    const handleDecreaseQty = async (itemId: string, currentQuantity: number) => {
        if (currentQuantity <= 1) {
            await removeItem(itemId)
            return
        }
        await updateQuantity(itemId, currentQuantity - 1)
    }

    const handleCheckout = async () => {
        if (!cart.items.length) return

        const cartSnapshot = snapshotCart(cart)
        setHistoryMessage(null)
        setIsCheckingOut(true)

        try {
            await clearCart()
            const saved = purchaseHistoryService.savePurchase(cartSnapshot)
            setHistory((prev) => [saved, ...prev])
            setHistoryMessage(`Saved ${saved.item_count} items to history.`)
        } catch (error) {
            setHistoryMessage(getErrorMessage(error))
        } finally {
            setIsCheckingOut(false)
        }
    }

    const handleBuyAgain = async (entry: PurchaseHistoryEntry) => {
        if (!entry.items.length) return
        setHistoryMessage(null)
        setBuyAgainId(entry.id)

        try {
            for (const item of entry.items) {
                await addItem({
                    name: item.name,
                    price: item.price,
                    location: item.location,
                    category: item.category,
                    quantity: item.quantity,
                })
            }
            setHistoryMessage(`Added ${entry.item_count} items back to cart.`)
        } catch (error) {
            setHistoryMessage(getErrorMessage(error))
        } finally {
            setBuyAgainId(null)
        }
    }

    const handleClearHistory = () => {
        purchaseHistoryService.clearHistory()
        setHistory([])
        setHistoryMessage('Purchase history cleared.')
    }

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/35 z-40 transition-opacity"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            <aside
                className={clsx(
                    'fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 transform transition-transform duration-300 border-l border-gray-100 flex flex-col',
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                )}
            >
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="w-6 h-6 text-primary" />
                        <h2 className="text-xl font-semibold">Shopping Cart</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                        aria-label="Close cart"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 bg-pastel-cream/60 border-b border-gray-100">
                    {cart.budget ? (
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500">Budget</p>
                                <p className="font-semibold text-lg">{formatInr(cart.budget)}</p>
                            </div>
                            <div
                                className={clsx(
                                    'px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap',
                                    cart.over_budget
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-green-100 text-green-700'
                                )}
                            >
                                {cart.over_budget
                                    ? 'Over budget'
                                    : `${formatInr(cart.remaining ?? 0)} left`}
                            </div>
                        </div>
                    ) : (
                        <div>
                            {isSettingBudget ? (
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={budgetInput}
                                        onChange={(e) => setBudgetInput(e.target.value)}
                                        placeholder="Enter budget"
                                        className="input-field flex-1"
                                    />
                                    <button onClick={() => void handleSetBudget()} className="btn-primary">
                                        Set
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsSettingBudget(true)}
                                    className="btn-secondary w-full flex items-center justify-center gap-2"
                                >
                                    <DollarSign className="w-4 h-4" />
                                    Set Budget
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                    <section>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Current Cart</h3>
                        {cart.items.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 border border-gray-100 rounded-xl bg-gray-50/50">
                                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>Your cart is empty</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cart.items.map((item) => (
                                    <div key={item.id} className="cart-item">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-gray-800">{item.name}</h4>
                                            <p className="text-xs text-gray-500">{item.location}</p>
                                            <p className="text-primary font-semibold mt-1">{formatInr(item.price)}</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => void handleDecreaseQty(item.id, item.quantity)}
                                                className="p-1.5 hover:bg-gray-200 rounded-lg"
                                                aria-label="Decrease quantity"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                                            <button
                                                onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                                                className="p-1.5 hover:bg-gray-200 rounded-lg"
                                                aria-label="Increase quantity"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => void removeItem(item.id)}
                                                className="p-1.5 hover:bg-red-100 rounded-lg text-red-500"
                                                aria-label="Remove item"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-xl border border-gray-100 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <History className="w-4 h-4" />
                                Purchase History
                            </h3>
                            <button
                                onClick={handleClearHistory}
                                className="text-xs font-medium text-gray-500 hover:text-red-500 disabled:opacity-40"
                                disabled={!history.length || !!buyAgainId || isCheckingOut}
                            >
                                Clear
                            </button>
                        </div>

                        {historyMessage ? (
                            <p className="mt-2 text-xs rounded-md bg-teal-50 text-teal-800 px-2 py-1">{historyMessage}</p>
                        ) : null}

                        {history.length === 0 ? (
                            <p className="mt-3 text-sm text-gray-500">No past purchases yet. Checkout once to create history.</p>
                        ) : (
                            <div className="mt-3 space-y-3">
                                {history.map((entry) => (
                                    <article key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatPurchaseDate(entry.purchased_at)}
                                                </p>
                                                <p className="text-sm font-semibold text-gray-800">
                                                    {entry.item_count} items | {formatInr(entry.total)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => void handleBuyAgain(entry)}
                                                className="btn-secondary px-2.5 py-1.5 text-xs"
                                                disabled={buyAgainId === entry.id || isCheckingOut}
                                            >
                                                {buyAgainId === entry.id ? (
                                                    'Adding...'
                                                ) : (
                                                    <>
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                        Buy Again
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        <div className="mt-2 space-y-1.5">
                                            {entry.items.map((item, index) => (
                                                <div
                                                    key={`${entry.id}-${item.name}-${item.location}-${index}`}
                                                    className="rounded-md border border-gray-100 bg-white px-2 py-1.5"
                                                >
                                                    <p className="text-sm font-medium text-gray-800">{item.name}</p>
                                                    <p className="text-xs text-gray-600">{item.location} | {item.category}</p>
                                                    <p className="text-xs text-gray-700">
                                                        Qty {item.quantity} x {formatInr(item.price)} = {formatInr(item.price * item.quantity)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <div className="p-5 bg-white border-t border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-600">Total</span>
                        <span className="text-2xl font-bold text-primary">
                            {formatInr(cart.total)}
                        </span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => void clearCart()}
                            className="btn-secondary flex-1"
                            disabled={cart.items.length === 0 || isCheckingOut}
                        >
                            Clear Cart
                        </button>
                        <button
                            onClick={() => void handleCheckout()}
                            className="btn-primary flex-1"
                            disabled={cart.items.length === 0 || isCheckingOut}
                        >
                            {isCheckingOut ? 'Saving...' : 'Checkout'}
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
