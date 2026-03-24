"""
Store registry with multi-store configuration.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel


class Anchor(BaseModel):
    anchor_id: str
    name: str
    x: int
    y: int


class StoreProfile(BaseModel):
    store_width_cm: int
    store_height_cm: int
    anchors: List[Anchor]


class Store(BaseModel):
    shop_id: str
    name: str
    profile: StoreProfile


# Multi-store registry
STORE_REGISTRY: Dict[str, Store] = {
    "Demo Supermarket": Store(
        shop_id="shop_demo_001",
        name="Demo Supermarket",
        profile=StoreProfile(
            store_width_cm=3000,
            store_height_cm=2000,
            anchors=[
                Anchor(anchor_id="A1", name="A1 Entrance", x=100, y=1850),
                Anchor(anchor_id="A2", name="A2 Aisle Left", x=500, y=1200),
                Anchor(anchor_id="A3", name="A3 Aisle Right", x=2500, y=1200),
                Anchor(anchor_id="A4", name="A4 Electronics", x=2200, y=500),
                Anchor(anchor_id="A5", name="A5 Food Court", x=600, y=500),
                Anchor(anchor_id="A6", name="A6 Checkout", x=1500, y=150),
            ]
        )
    ),
    "Budget Store": Store(
        shop_id="shop_budget_002",
        name="Budget Store",
        profile=StoreProfile(
            store_width_cm=2500,
            store_height_cm=1800,
            anchors=[
                Anchor(anchor_id="B1", name="B1 Entrance", x=200, y=1700),
                Anchor(anchor_id="B2", name="B2 Grocery", x=1200, y=900),
                Anchor(anchor_id="B3", name="B3 Checkout", x=1200, y=200),
            ]
        )
    )
}


def get_store_by_id(shop_id: str) -> Optional[Store]:
    """Get store by shop_id."""
    for store in STORE_REGISTRY.values():
        if store.shop_id == shop_id:
            return store
    return None


def get_store_by_name(name: str) -> Optional[Store]:
    """Get store by name."""
    return STORE_REGISTRY.get(name)


def list_stores() -> List[Store]:
    """Get all stores."""
    return list(STORE_REGISTRY.values())


def add_store(name: str, store: Store):
    """Add a new store to the registry."""
    STORE_REGISTRY[name] = store


def remove_store(name: str) -> bool:
    """Remove a store from the registry."""
    if name in STORE_REGISTRY:
        del STORE_REGISTRY[name]
        return True
    return False
