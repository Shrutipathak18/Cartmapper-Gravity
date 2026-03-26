"""
Store management service.
"""

from typing import Dict, List, Optional, Any
import io

from stores.registry import (
    STORE_REGISTRY, 
    Store, 
    StoreProfile, 
    Anchor,
    get_store_by_id,
    get_store_by_name,
    list_stores
)
from navigation.service import navigation_service


class StoreService:
    """Service for managing stores and their inventories."""
    
    def __init__(self):
        self.active_store: Optional[str] = None
        self.store_inventories: Dict[str, bytes] = {}
    
    def get_all_stores(self) -> List[Dict]:
        """Get all available stores."""
        stores = []
        for name, store in STORE_REGISTRY.items():
            stores.append({
                "name": name,
                "shop_id": store.shop_id,
                "has_inventory": store.shop_id in self.store_inventories,
                "anchors_count": len(store.profile.anchors)
            })
        return stores
    
    def get_store(self, store_id: str) -> Optional[Dict]:
        """Get store details by ID or name."""
        store = get_store_by_id(store_id)
        if not store:
            store = get_store_by_name(store_id)
        
        if store:
            return {
                "shop_id": store.shop_id,
                "name": store.name,
                "profile": {
                    "store_width_cm": store.profile.store_width_cm,
                    "store_height_cm": store.profile.store_height_cm,
                    "anchors": [
                        {
                            "anchor_id": a.anchor_id,
                            "name": a.name,
                            "x": a.x,
                            "y": a.y
                        }
                        for a in store.profile.anchors
                    ]
                }
            }
        return None
    
    def set_active_store(self, store_id: str) -> bool:
        """Set the active store."""
        store = get_store_by_id(store_id)
        if not store:
            store = get_store_by_name(store_id)
        
        if store:
            self.active_store = store.shop_id
            navigation_service.set_current_store(store.shop_id)
            return True
        return False
    
    def get_active_store(self) -> Optional[str]:
        """Get the current active store."""
        return self.active_store
    
    def upload_inventory(self, store_id: str, csv_data: bytes) -> Dict:
        """Upload inventory CSV for a store."""
        store = get_store_by_id(store_id)
        if not store:
            store = get_store_by_name(store_id)
        
        if not store:
            return {"success": False, "error": "Store not found"}
        
        try:
            # Validate CSV
            import pandas as pd
            df = pd.read_csv(io.BytesIO(csv_data))
            
            if df.empty or len(df.columns) == 0:
                return {"success": False, "error": "CSV is empty or invalid"}
            
            # Store the inventory
            self.store_inventories[store.shop_id] = csv_data
            
            # Create map from inventory
            store_profile = {
                "store_width_cm": store.profile.store_width_cm,
                "store_height_cm": store.profile.store_height_cm,
                "anchors": [
                    {"anchor_id": a.anchor_id, "name": a.name, "x": a.x, "y": a.y}
                    for a in store.profile.anchors
                ]
            }
            
            indoor_map = navigation_service.create_map_from_csv(
                store.shop_id,
                csv_data,
                store_profile
            )
            
            self.active_store = store.shop_id
            
            return {
                "success": True,
                "message": f"Uploaded {len(df)} products",
                "product_count": len(df),
                "locations_count": len(indoor_map.locations)
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_store_anchors(self, store_id: str) -> List[Dict]:
        """Get anchor points for a store."""
        store = get_store_by_id(store_id)
        if not store:
            store = get_store_by_name(store_id)
        
        if store:
            return [
                {
                    "anchor_id": a.anchor_id,
                    "name": a.name,
                    "x": a.x,
                    "y": a.y
                }
                for a in store.profile.anchors
            ]
        return []
    
    def export_store_layout(self, store_id: str) -> Optional[Dict]:
        """Export store layout as JSON."""
        store = get_store_by_id(store_id)
        if not store:
            store = get_store_by_name(store_id)
        
        if not store:
            return None
        
        # Get map if available
        indoor_map = navigation_service.maps.get(store.shop_id)
        
        if indoor_map:
            return {
                "store": {
                    "shop_id": store.shop_id,
                    "name": store.name,
                    "dimensions": {
                        "width_cm": store.profile.store_width_cm,
                        "height_cm": store.profile.store_height_cm
                    }
                },
                "anchors": self.get_store_anchors(store_id),
                "map": indoor_map.to_dict()
            }
        else:
            return {
                "store": {
                    "shop_id": store.shop_id,
                    "name": store.name,
                    "dimensions": {
                        "width_cm": store.profile.store_width_cm,
                        "height_cm": store.profile.store_height_cm
                    }
                },
                "anchors": self.get_store_anchors(store_id),
                "map": None
            }


# Singleton instance
store_service = StoreService()
