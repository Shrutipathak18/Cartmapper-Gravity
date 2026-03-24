"""
Shopping cart router.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Request

from cart.service import cart_service
from schemas.cart import (
    AddToCartRequest,
    UpdateCartItemRequest,
    Cart,
    CartWithBudget,
    CartItem,
    BudgetRequest
)
from auth.dependencies import get_optional_user
from schemas.auth import UserInfo

router = APIRouter()


def get_session_id(request: Request, user: Optional[UserInfo] = None) -> str:
    """Get session ID from user or generate one."""
    if user:
        return user.email
    # Fallback to a header-based session
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        session_id = "anonymous"
    return session_id


@router.get("", response_model=CartWithBudget)
async def get_cart(
    request: Request,
    user: UserInfo = Depends(get_optional_user)
):
    """
    Get the current shopping cart with budget info.
    """
    session_id = get_session_id(request, user)
    return cart_service.get_cart_with_budget(session_id)


@router.post("/add", response_model=CartItem)
async def add_to_cart(
    request: Request,
    item: AddToCartRequest,
    user: UserInfo = Depends(get_optional_user)
):
    """
    Add an item to the cart.
    """
    session_id = get_session_id(request, user)
    
    cart_item = cart_service.add_item(
        session_id=session_id,
        name=item.name,
        price=item.price,
        location=item.location,
        category=item.category,
        quantity=item.quantity
    )
    
    return cart_item


@router.delete("/{item_id}")
async def remove_from_cart(
    request: Request,
    item_id: str,
    user: UserInfo = Depends(get_optional_user)
):
    """
    Remove an item from the cart.
    """
    session_id = get_session_id(request, user)
    
    success = cart_service.remove_item(session_id, item_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found in cart"
        )
    
    return {"message": "Item removed from cart"}


@router.put("/{item_id}", response_model=Optional[CartItem])
async def update_cart_item(
    request: Request,
    item_id: str,
    update: UpdateCartItemRequest,
    user: UserInfo = Depends(get_optional_user)
):
    """
    Update item quantity in cart.
    """
    session_id = get_session_id(request, user)
    
    result = cart_service.update_quantity(session_id, item_id, update.quantity)
    
    if result is None and update.quantity > 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found in cart"
        )
    
    return result


@router.post("/budget")
async def set_budget(
    request: Request,
    budget_req: BudgetRequest,
    user: UserInfo = Depends(get_optional_user)
):
    """
    Set shopping budget.
    """
    session_id = get_session_id(request, user)
    
    cart_service.set_budget(session_id, budget_req.budget)
    
    return {"message": f"Budget set to ₹{budget_req.budget}", "budget": budget_req.budget}


@router.get("/budget")
async def get_budget(
    request: Request,
    user: UserInfo = Depends(get_optional_user)
):
    """
    Get current budget.
    """
    session_id = get_session_id(request, user)
    
    budget = cart_service.get_budget(session_id)
    
    return {"budget": budget}


@router.delete("")
async def clear_cart(
    request: Request,
    user: UserInfo = Depends(get_optional_user)
):
    """
    Clear the entire cart.
    """
    session_id = get_session_id(request, user)
    
    cart_service.clear_cart(session_id)
    
    return {"message": "Cart cleared"}
