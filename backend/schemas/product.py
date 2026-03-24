"""
Product-related Pydantic schemas.
"""

from typing import Optional, List
from pydantic import BaseModel


class Product(BaseModel):
    """A product in the store."""
    name: str
    category: str = "General"
    price: float = 0.0
    price_display: str = "N/A"
    type: str = "Unknown"  # Veg, Non-Veg, NA
    stock: Optional[str] = None
    location: str = ""


class ProductSearchRequest(BaseModel):
    """Request for product search."""
    query: str
    category: Optional[str] = None
    type: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    limit: int = 20


class ProductSearchResult(BaseModel):
    """A product search result."""
    product: Product
    location: str
    match_score: float = 1.0


class ProductSearchResponse(BaseModel):
    """Response from product search."""
    results: List[ProductSearchResult]
    total: int
    query: str


class ProductAlternativeRequest(BaseModel):
    """Request for cheaper product alternatives."""
    product_name: str
    max_price: Optional[float] = None


class ProductAlternativeResponse(BaseModel):
    """Response with cheaper alternatives."""
    original_product: Optional[Product] = None
    alternatives: List[ProductSearchResult]


class ProductCategory(BaseModel):
    """A product category with count."""
    name: str
    count: int


class ProductStats(BaseModel):
    """Statistics about products in store."""
    total_products: int
    categories: List[ProductCategory]
    veg_count: int
    non_veg_count: int
    price_range: dict
