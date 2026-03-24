"""
Shopping cart-related Pydantic schemas.
"""

from typing import List, Optional
from pydantic import BaseModel


class CartItem(BaseModel):
    """An item in the shopping cart."""
    id: str
    name: str
    price: float
    location: str
    category: str = "General"
    quantity: int = 1


class AddToCartRequest(BaseModel):
    """Request to add item to cart."""
    name: str
    price: float
    location: str
    category: str = "General"
    quantity: int = 1


class UpdateCartItemRequest(BaseModel):
    """Request to update cart item quantity."""
    quantity: int


class Cart(BaseModel):
    """Complete shopping cart."""
    items: List[CartItem]
    total: float
    item_count: int


class CartWithBudget(BaseModel):
    """Cart with budget information."""
    items: List[CartItem]
    total: float
    item_count: int
    budget: Optional[float] = None
    remaining: Optional[float] = None
    over_budget: bool = False


class BudgetRequest(BaseModel):
    """Request to set budget."""
    budget: float
