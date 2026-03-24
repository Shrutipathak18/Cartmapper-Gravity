"""
Shopping cart service.
Note: Cart is maintained per-session in the frontend (client-side).
This service provides API operations for cart management.
"""

from typing import Dict, List, Optional
import uuid

from schemas.cart import CartItem, Cart, CartWithBudget


class CartService:
    """
    Service for shopping cart operations.
    In production, this would use a proper session/cache storage.
    For this implementation, carts are session-based.
    """
    
    def __init__(self):
        # In-memory cart storage (session_id -> cart)
        # In production, use Redis or similar
        self.carts: Dict[str, List[CartItem]] = {}
        self.budgets: Dict[str, float] = {}
    
    def _get_session_cart(self, session_id: str) -> List[CartItem]:
        """Get cart for a session, creating if needed."""
        if session_id not in self.carts:
            self.carts[session_id] = []
        return self.carts[session_id]
    
    def add_item(
        self,
        session_id: str,
        name: str,
        price: float,
        location: str,
        category: str = "General",
        quantity: int = 1
    ) -> CartItem:
        """Add an item to the cart."""
        cart = self._get_session_cart(session_id)
        
        # Check if item already exists
        for item in cart:
            if item.name == name and item.location == location:
                item.quantity += quantity
                return item
        
        # Create new item
        new_item = CartItem(
            id=str(uuid.uuid4()),
            name=name,
            price=price,
            location=location,
            category=category,
            quantity=quantity
        )
        
        cart.append(new_item)
        return new_item
    
    def remove_item(self, session_id: str, item_id: str) -> bool:
        """Remove an item from the cart."""
        cart = self._get_session_cart(session_id)
        
        for i, item in enumerate(cart):
            if item.id == item_id:
                cart.pop(i)
                return True
        
        return False
    
    def update_quantity(
        self,
        session_id: str,
        item_id: str,
        quantity: int
    ) -> Optional[CartItem]:
        """Update item quantity."""
        cart = self._get_session_cart(session_id)
        
        for item in cart:
            if item.id == item_id:
                if quantity <= 0:
                    self.remove_item(session_id, item_id)
                    return None
                item.quantity = quantity
                return item
        
        return None
    
    def get_cart(self, session_id: str) -> Cart:
        """Get the cart for a session."""
        cart = self._get_session_cart(session_id)
        
        total = sum(item.price * item.quantity for item in cart)
        item_count = sum(item.quantity for item in cart)
        
        return Cart(
            items=cart,
            total=total,
            item_count=item_count
        )
    
    def get_cart_with_budget(self, session_id: str) -> CartWithBudget:
        """Get cart with budget information."""
        cart = self.get_cart(session_id)
        budget = self.budgets.get(session_id)
        
        remaining = None
        over_budget = False
        
        if budget is not None:
            remaining = budget - cart.total
            over_budget = remaining < 0
        
        return CartWithBudget(
            items=cart.items,
            total=cart.total,
            item_count=cart.item_count,
            budget=budget,
            remaining=remaining,
            over_budget=over_budget
        )
    
    def set_budget(self, session_id: str, budget: float):
        """Set budget for a session."""
        self.budgets[session_id] = budget
    
    def get_budget(self, session_id: str) -> Optional[float]:
        """Get budget for a session."""
        return self.budgets.get(session_id)
    
    def clear_cart(self, session_id: str):
        """Clear all items from the cart."""
        if session_id in self.carts:
            self.carts[session_id] = []
    
    def clear_all(self, session_id: str):
        """Clear cart and budget."""
        self.clear_cart(session_id)
        if session_id in self.budgets:
            del self.budgets[session_id]


# Singleton instance
cart_service = CartService()
