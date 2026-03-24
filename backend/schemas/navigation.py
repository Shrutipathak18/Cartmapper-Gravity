"""
Navigation-related Pydantic schemas.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class Location(BaseModel):
    """A location on the indoor map."""
    name: str
    x: int
    y: int
    description: str = ""


class Obstacle(BaseModel):
    """An obstacle on the indoor map."""
    x1: int
    y1: int
    x2: int
    y2: int


class PathPoint(BaseModel):
    """A point on a navigation path."""
    x: int
    y: int
    location: Optional[str] = None


class PathRequest(BaseModel):
    """Request for path calculation."""
    start: str
    end: str
    mode: str = "astar"  # "astar" or "standard"


class PathResponse(BaseModel):
    """Response with calculated path."""
    path: List[PathPoint]
    distance: float
    start: str
    end: str
    mode: str


class DistanceRequest(BaseModel):
    """Request for distance calculation."""
    location1: str
    location2: str


class DistanceResponse(BaseModel):
    """Response with distance."""
    distance: float
    location1: str
    location2: str


class NearbyLocationsRequest(BaseModel):
    """Request for nearby locations."""
    current_location: str
    max_distance: float = 100


class NearbyLocation(BaseModel):
    """A nearby location with distance."""
    name: str
    distance: float
    description: str = ""


class ProductLocationRequest(BaseModel):
    """Request for product location."""
    product_name: str


class ProductLocationResponse(BaseModel):
    """Response with product location."""
    product_name: str
    location: Optional[str] = None
    found: bool


class ShoppingRouteRequest(BaseModel):
    """Request for optimized shopping route."""
    items: List[str]
    current_location: str


class ShoppingRouteItem(BaseModel):
    """An item in the shopping route."""
    item: str
    location: str
    distance_from_previous: float


class ShoppingRouteResponse(BaseModel):
    """Response with optimized shopping route."""
    route: List[ShoppingRouteItem]
    total_distance: float
    items_not_found: List[str]


class NavigationQueryRequest(BaseModel):
    """Request for natural language navigation."""
    question: str
    current_location: Optional[str] = None
    language: str = "en"


class NavigationMatchedProduct(BaseModel):
    """Structured matched product for navigation Q&A."""
    name: str
    location: str
    price: float = 0.0
    type: str = "Unknown"
    company: Optional[str] = None


class NavigationQueryResponse(BaseModel):
    """Response from navigation assistant."""
    answer: str
    translated_answer: Optional[str] = None
    language: str = "en"
    destination_location: Optional[str] = None
    distance: Optional[float] = None
    route_steps: List[str] = Field(default_factory=list)
    matched_product: Optional[NavigationMatchedProduct] = None
    search_query_used: Optional[str] = None


class MapResponse(BaseModel):
    """Response with map image."""
    image_base64: str
    width: int
    height: int
    locations: List[Location]


class StoreLayoutInit(BaseModel):
    """Request to initialize store layout from CSV data."""
    store_id: str
    csv_data: str  # Base64 encoded CSV


class Anchor(BaseModel):
    """A QR anchor point in the store."""
    anchor_id: str
    name: str
    x: int  # in centimeters
    y: int  # in centimeters


class StoreProfile(BaseModel):
    """Store profile with dimensions and anchors."""
    store_id: str
    store_name: str
    store_width_cm: int
    store_height_cm: int
    anchors: List[Anchor]
