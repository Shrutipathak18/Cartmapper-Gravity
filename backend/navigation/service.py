"""
Indoor navigation service with A* pathfinding and map generation.
"""

import math
import heapq
import io
import base64
import re
import csv
from typing import Optional, List, Dict, Any, Tuple
from PIL import Image, ImageDraw, ImageFont

from config import get_settings
from schemas.navigation import Location, PathPoint, Anchor

settings = get_settings()


class IndoorMap:
    """
    Indoor map class for navigation and pathfinding.
    Maintains locations, obstacles, products, and provides routing algorithms.
    """
    
    def __init__(self, width: int = 800, height: int = 600):
        self.width = width
        self.height = height
        self.locations: Dict[str, Dict[str, Any]] = {}
        self.obstacles: List[Dict[str, int]] = []
        self.paths: List = []
        self.products: Dict[str, List[Dict[str, Any]]] = {}
    
    def add_location(self, name: str, x: int, y: int, description: str = ""):
        """Add a location to the map."""
        self.locations[name] = {
            'x': x,
            'y': y,
            'description': description
        }
    
    def add_obstacle(self, x1: int, y1: int, x2: int, y2: int):
        """Add an obstacle (wall, shelf, etc.) to the map."""
        self.obstacles.append({
            'x1': x1,
            'y1': y1,
            'x2': x2,
            'y2': y2
        })
    
    def calculate_distance(self, loc1: str, loc2: str) -> float:
        """Calculate Euclidean distance between two locations."""
        if loc1 in self.locations and loc2 in self.locations:
            x1, y1 = self.locations[loc1]['x'], self.locations[loc1]['y']
            x2, y2 = self.locations[loc2]['x'], self.locations[loc2]['y']
            return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        return float('inf')
    
    def find_path_standard(self, start: str, end: str) -> Optional[List[Dict]]:
        """Find direct path between two locations (no obstacle avoidance)."""
        if start not in self.locations or end not in self.locations:
            return None
        
        start_pos = self.locations[start]
        end_pos = self.locations[end]
        
        path = [
            {'x': start_pos['x'], 'y': start_pos['y'], 'location': start},
            {'x': end_pos['x'], 'y': end_pos['y'], 'location': end}
        ]
        return path
    
    def find_path_astar(self, start: str, end: str, grid_size: int = 40) -> Optional[List[Dict]]:
        """
        A* pathfinding on a grid-based approximation of the indoor map.
        Avoids obstacles and finds optimal path.
        """
        if start not in self.locations or end not in self.locations:
            return None
        
        start_pos = self.locations[start]
        end_pos = self.locations[end]
        
        cols = self.width // grid_size
        rows = self.height // grid_size
        
        def to_grid(x: int, y: int) -> Tuple[int, int]:
            return int(x // grid_size), int(y // grid_size)
        
        def to_world(gx: int, gy: int) -> Tuple[int, int]:
            return gx * grid_size + grid_size // 2, gy * grid_size + grid_size // 2
        
        start_node = to_grid(start_pos["x"], start_pos["y"])
        end_node = to_grid(end_pos["x"], end_pos["y"])
        
        # Build blocked cells from obstacles
        blocked = set()
        for obs in self.obstacles:
            x1, y1 = to_grid(obs["x1"], obs["y1"])
            x2, y2 = to_grid(obs["x2"], obs["y2"])
            for x in range(min(x1, x2), max(x1, x2) + 1):
                for y in range(min(y1, y2), max(y1, y2) + 1):
                    blocked.add((x, y))
        
        def heuristic(a: Tuple[int, int], b: Tuple[int, int]) -> int:
            return abs(a[0] - b[0]) + abs(a[1] - b[1])
        
        open_set = []
        heapq.heappush(open_set, (0, start_node))
        came_from = {}
        g_score = {start_node: 0}
        
        directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        
        while open_set:
            _, current = heapq.heappop(open_set)
            
            if current == end_node:
                # Reconstruct path
                path = []
                
                # Include end node
                wx, wy = to_world(*current)
                path.append({"x": wx, "y": wy})
                
                # Backtrack
                while current in came_from:
                    current = came_from[current]
                    wx, wy = to_world(*current)
                    path.append({"x": wx, "y": wy})
                
                path.reverse()
                
                # Snap exact start & end positions
                path[0] = {
                    "x": start_pos["x"],
                    "y": start_pos["y"],
                    "location": start
                }
                path[-1] = {
                    "x": end_pos["x"],
                    "y": end_pos["y"],
                    "location": end
                }
                
                return path
            
            for dx, dy in directions:
                neighbor = (current[0] + dx, current[1] + dy)
                
                if not (0 <= neighbor[0] < cols and 0 <= neighbor[1] < rows):
                    continue
                if neighbor in blocked:
                    continue
                
                tentative_g = g_score[current] + 1
                if tentative_g < g_score.get(neighbor, float("inf")):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f_score = tentative_g + heuristic(neighbor, end_node)
                    heapq.heappush(open_set, (f_score, neighbor))
        
        # No path found - return direct path as fallback
        return self.find_path_standard(start, end)
    
    def find_product_location(self, product_name: str) -> Optional[str]:
        """Find the location of a product by name."""
        query = product_name.strip().lower()
        if not query:
            return None

        def searchable_values(product: Dict[str, Any]) -> List[str]:
            fields = (
                "name",
                "category",
                "company",
                "section",
                "location_in_store",
                "type",
                "vegan_option",
            )
            values = []
            for field in fields:
                value = str(product.get(field, "")).strip().lower()
                if value:
                    values.append(value)
            return values

        # Exact-ish matches first.
        for location, products in self.products.items():
            for product in products:
                values = searchable_values(product)
                if any(query == value for value in values):
                    return location

        # Partial matches with simple scoring.
        best_location = None
        best_score = 0
        for location, products in self.products.items():
            for product in products:
                score = 0
                name = str(product.get("name", "")).strip().lower()
                if query and query in name:
                    score += 6

                for field, weight in (
                    ("category", 3),
                    ("company", 2),
                    ("section", 3),
                    ("location_in_store", 4),
                    ("type", 1),
                    ("vegan_option", 1),
                ):
                    value = str(product.get(field, "")).strip().lower()
                    if query and query in value:
                        score += weight

                if score > best_score:
                    best_score = score
                    best_location = location

        return best_location
    
    def get_location_products(self, location_name: str) -> List[Dict]:
        """Get all products at a location."""
        return self.products.get(location_name, [])
    
    def get_nearest_locations(
        self, 
        current_location: str, 
        max_distance: float = 100
    ) -> List[Dict]:
        """Get locations within a maximum distance."""
        if current_location not in self.locations:
            return []
        
        current_pos = self.locations[current_location]
        nearby = []
        
        for name, pos in self.locations.items():
            if name != current_location:
                distance = math.sqrt(
                    (pos['x'] - current_pos['x']) ** 2 + 
                    (pos['y'] - current_pos['y']) ** 2
                )
                if distance <= max_distance:
                    nearby.append({
                        'name': name,
                        'distance': distance,
                        'description': pos.get('description', '')
                    })
        
        return sorted(nearby, key=lambda x: x['distance'])
    
    def get_products_by_type(self, product_type: str) -> List[Dict]:
        """Get products filtered by type (Veg, Non-Veg, etc.)."""
        filtered_products = []
        for location, products in self.products.items():
            for product in products:
                if product.get('type', '').lower() == product_type.lower():
                    filtered_products.append({
                        'product': product,
                        'location': location
                    })
        return filtered_products
    
    def get_products_by_price_range(
        self, 
        min_price: float, 
        max_price: float
    ) -> List[Dict]:
        """Get products within a price range."""
        filtered_products = []
        for location, products in self.products.items():
            for product in products:
                try:
                    price = float(product.get('price', 0))
                    if min_price <= price <= max_price:
                        filtered_products.append({
                            'product': product,
                            'location': location
                        })
                except (ValueError, TypeError):
                    continue
        return sorted(filtered_products, key=lambda x: x['product'].get('price', 0))
    
    def search_products(self, search_term: str) -> List[Dict]:
        """Search for products by name or category."""
        search_term = search_term.strip().lower()
        if not search_term:
            return []

        results = []
        
        for location, products in self.products.items():
            for product in products:
                product_name = product.get('name', '').lower()
                product_category = product.get('category', '').lower()
                product_company = str(product.get('company', '')).lower()
                product_section = str(product.get('section', '')).lower()
                product_type = str(product.get('type', '')).lower()
                product_location = str(product.get('location_in_store', location)).lower()
                vegan_option = str(product.get('vegan_option', '')).lower()
                
                match_score = 0.0

                if search_term == product_name:
                    match_score += 10
                elif search_term in product_name:
                    match_score += 7

                if search_term == product_category:
                    match_score += 5
                elif search_term in product_category:
                    match_score += 3

                if search_term in product_section:
                    match_score += 3
                if search_term in product_company:
                    match_score += 2.5
                if search_term in product_location:
                    match_score += 2
                if search_term in product_type:
                    match_score += 1.5
                if search_term in vegan_option:
                    match_score += 1

                if match_score > 0:
                    results.append({
                        'product': product,
                        'location': location,
                        'match_score': match_score
                    })
        
        return sorted(results, key=lambda x: (-x['match_score'], x['product'].get('name', '')))
    
    def generate_visual_map(
        self,
        current_location: Optional[str] = None,
        destination: Optional[str] = None,
        path: Optional[List[Dict]] = None
    ) -> bytes:
        """Generate a visual map image with locations, path, and obstacles."""
        img = Image.new('RGB', (self.width, self.height), color='white')
        draw = ImageDraw.Draw(img)
        
        # Draw obstacles first
        for obstacle in self.obstacles:
            draw.rectangle(
                [obstacle['x1'], obstacle['y1'], obstacle['x2'], obstacle['y2']],
                fill='gray',
                outline='black'
            )
        
        # Draw path if provided
        if path and len(path) > 1:
            # Draw path line
            for i in range(len(path) - 1):
                # White underlay improves visibility on busy maps.
                draw.line(
                    [path[i]['x'], path[i]['y'], path[i + 1]['x'], path[i + 1]['y']],
                    fill='white',
                    width=11
                )
                draw.line(
                    [path[i]['x'], path[i]['y'], path[i + 1]['x'], path[i + 1]['y']],
                    fill='#0077FF',
                    width=7
                )
            
            # Draw waypoints
            for point in path[1:-1]:
                draw.ellipse(
                    [point['x'] - 6, point['y'] - 6, point['x'] + 6, point['y'] + 6],
                    fill='#FFD54F',
                    outline='#F57F17',
                    width=2
                )
        
        # Draw locations
        for name, loc in self.locations.items():
            color = 'blue'
            if name == current_location:
                color = 'green'
            elif name == destination:
                color = 'red'
            
            radius = 15
            draw.ellipse(
                [loc['x'] - radius, loc['y'] - radius, loc['x'] + radius, loc['y'] + radius],
                fill=color,
                outline='black',
                width=2
            )
            
            # Draw label
            try:
                font = ImageFont.truetype("arial.ttf", 12)
            except:
                font = ImageFont.load_default()
            
            draw.text((loc['x'] + 20, loc['y']), name, fill='black', font=font)
        
        # Convert to bytes
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer.getvalue()
    
    def to_dict(self) -> Dict:
        """Export map to dictionary format."""
        return {
            'width': self.width,
            'height': self.height,
            'locations': self.locations,
            'obstacles': self.obstacles,
            'products': self.products
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'IndoorMap':
        """Create map from dictionary format."""
        indoor_map = cls(
            width=data.get('width', 800),
            height=data.get('height', 600)
        )
        indoor_map.locations = data.get('locations', {})
        indoor_map.obstacles = data.get('obstacles', [])
        indoor_map.products = data.get('products', {})
        return indoor_map


class NavigationService:
    """
    Service for indoor navigation operations.
    Manages store maps and provides navigation functionality.
    """
    
    def __init__(self):
        self.maps: Dict[str, IndoorMap] = {}
        self.current_store_id: Optional[str] = None
        self.current_location: Optional[str] = None
        self.llm_chain = None
    
    def get_current_map(self) -> Optional[IndoorMap]:
        """Get the current store map."""
        if self.current_store_id and self.current_store_id in self.maps:
            return self.maps[self.current_store_id]
        return None
    
    def set_current_store(self, store_id: str):
        """Set the current active store."""
        self.current_store_id = store_id
        self.current_location = None
    
    def create_map_from_csv(
        self,
        store_id: str,
        csv_data: bytes,
        store_profile: Dict
    ) -> IndoorMap:
        """Create a store map from CSV inventory data."""
        decoded_csv = None
        for encoding in ("utf-8-sig", "utf-8", "latin-1"):
            try:
                decoded_csv = csv_data.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        if decoded_csv is None:
            raise ValueError("CSV encoding is not supported")

        reader = csv.DictReader(io.StringIO(decoded_csv))
        csv_rows = list(reader)
        if not csv_rows or not reader.fieldnames:
            raise ValueError("CSV has no rows to map")

        mall_map = IndoorMap(1000, 700)
        mall_map.add_location("Entrance", 500, 640, "Main entrance to the store")
        mall_map.add_location("Checkout", 860, 620, "Billing counter")
        mall_map.add_location("Exit", 140, 620, "Store exit")

        # Light boundary walls so A* paths stay inside the map.
        mall_map.add_obstacle(0, 0, mall_map.width, 30)
        mall_map.add_obstacle(0, 0, 30, mall_map.height)
        mall_map.add_obstacle(mall_map.width - 30, 0, mall_map.width, mall_map.height)

        normalized_cols = {
            col: re.sub(r"[^a-z0-9]+", " ", str(col).lower()).strip()
            for col in reader.fieldnames
            if col
        }

        def pick_column(
            required_terms: List[str],
            bonus_terms: Optional[List[str]] = None
        ) -> Optional[str]:
            best_col = None
            best_score = 0
            for col, normalized in normalized_cols.items():
                score = sum(4 for term in required_terms if term in normalized)
                if bonus_terms:
                    score += sum(2 for term in bonus_terms if term in normalized)
                if score > best_score:
                    best_col = col
                    best_score = score
            return best_col if best_score > 0 else None

        def clean_text(value: Any) -> str:
            if value is None:
                return ""
            text = re.sub(r"\s+", " ", str(value)).strip()
            if text.lower() in {"nan", "none", "null"}:
                return ""
            return text

        def parse_number(value: Any) -> float:
            if value is None:
                return 0.0
            text = clean_text(value).replace(",", "")
            text = re.sub(r"[^0-9.\-]", "", text)
            if not text:
                return 0.0
            try:
                return float(text)
            except ValueError:
                return 0.0

        name_col = pick_column(["product", "name"], ["item"])
        section_col = pick_column(["section"], ["category", "department"])
        location_col = pick_column(["location"], ["aisle", "shelf", "rack", "zone", "bay"])
        company_col = pick_column(["company"], ["brand", "manufacturer", "maker"])
        type_col = pick_column(["veg"], ["type", "diet"])
        vegan_col = pick_column(["vegan"])
        stock_col = pick_column(["stock"], ["qty", "quantity", "available", "inventory"])

        price_candidates = [
            col for col, normalized in normalized_cols.items()
            if any(term in normalized for term in ("price", "mrp", "cost", "rate"))
        ]
        price_col = None
        mrp_col = None
        if price_candidates:
            price_col = sorted(
                price_candidates,
                key=lambda c: (
                    1 if "discount" in normalized_cols[c] else 0,
                    1 if "selling" in normalized_cols[c] else 0,
                    1 if "final" in normalized_cols[c] else 0,
                    1 if "price" in normalized_cols[c] else 0,
                    1 if "mrp" in normalized_cols[c] else 0,
                ),
                reverse=True
            )[0]
            mrp_matches = [c for c in price_candidates if "mrp" in normalized_cols[c]]
            if mrp_matches:
                mrp_col = mrp_matches[0]

        location_source_col = location_col or section_col

        # Build navigable in-store locations (prefer aisle/location column).
        discovered_locations: List[str] = []
        if location_source_col:
            for row in csv_rows:
                value = row.get(location_source_col, "")
                location_name = clean_text(value)
                if location_name:
                    discovered_locations.append(location_name)

        if not discovered_locations:
            discovered_locations = ["General Section"]

        seen = set()
        ordered_locations: List[str] = []
        for loc in discovered_locations:
            key = loc.lower()
            if key not in seen:
                seen.add(key)
                ordered_locations.append(loc)

        cols = min(5, max(2, int(math.ceil(math.sqrt(len(ordered_locations))))))
        grid_rows = int(math.ceil(len(ordered_locations) / cols))

        x_min, x_max = 120, mall_map.width - 120
        y_min, y_max = 90, mall_map.height - 180
        x_step = (x_max - x_min) / (cols - 1) if cols > 1 else 0
        y_step = (y_max - y_min) / (grid_rows - 1) if grid_rows > 1 else 0

        for idx, location_name in enumerate(ordered_locations):
            row = idx // cols
            col = idx % cols
            x = int(round(x_min + col * x_step))
            y = int(round(y_min + row * y_step))
            description = (
                f"Products available at {location_name}"
                if location_col
                else f"Section for {location_name}"
            )
            mall_map.add_location(location_name, x, y, description)

        # Index products by exact in-store location/aisle.
        mall_map.products = {location_name: [] for location_name in ordered_locations}
        for i, row in enumerate(csv_rows):
            if not any(clean_text(v) for v in row.values()):
                continue

            location_name = clean_text(row.get(location_source_col, "")) if location_source_col else ""
            if not location_name:
                location_name = ordered_locations[0]

            if location_name not in mall_map.products:
                # Late-discovered location; add to map near center without breaking import.
                x = int(mall_map.width * 0.5 + ((len(mall_map.products) % 3) - 1) * 80)
                y = int(mall_map.height * 0.45 + ((len(mall_map.products) // 3) % 3) * 60)
                mall_map.add_location(location_name, x, y, f"Products available at {location_name}")
                mall_map.products[location_name] = []

            section_value = clean_text(row.get(section_col, "")) if section_col else ""
            company_value = clean_text(row.get(company_col, "")) if company_col else ""
            type_value = clean_text(row.get(type_col, "")) if type_col else ""
            vegan_value = clean_text(row.get(vegan_col, "")) if vegan_col else ""
            stock_value = clean_text(row.get(stock_col, "")) if stock_col else ""

            product_name = clean_text(row.get(name_col, "")) if name_col else ""
            if not product_name:
                product_name = f"Product {i + 1}"

            price_value = parse_number(row.get(price_col)) if price_col else 0.0
            mrp_value = parse_number(row.get(mrp_col)) if mrp_col else 0.0
            if price_value <= 0 and mrp_value > 0:
                price_value = mrp_value

            product = {
                "name": product_name,
                "category": section_value or location_name,
                "section": section_value or location_name,
                "company": company_value,
                "price": price_value,
                "type": type_value or "Unknown",
                "location_in_store": location_name,
            }

            if stock_value:
                product["stock"] = stock_value
            if vegan_value:
                product["vegan_option"] = vegan_value
            if mrp_value > 0:
                product["mrp"] = mrp_value

            mall_map.products[location_name].append(product)

        # Add anchors from store profile.
        self._add_anchors_to_map(mall_map, store_profile)

        self.maps[store_id] = mall_map
        self.current_store_id = store_id

        return mall_map
    
    def _add_anchors_to_map(self, indoor_map: IndoorMap, store_profile: Dict):
        """Add QR anchor points to the map."""
        store_width_cm = store_profile.get("store_width_cm", 3000)
        store_height_cm = store_profile.get("store_height_cm", 2000)
        
        for anchor in store_profile.get("anchors", []):
            # Scale anchor position to map pixels
            ax = int((anchor["x"] / store_width_cm) * indoor_map.width)
            ay = int((anchor["y"] / store_height_cm) * indoor_map.height)
            
            indoor_map.add_location(
                anchor["name"],
                ax,
                ay,
                f"Anchor {anchor['anchor_id']} ({anchor['name']})"
            )
    
    def create_sample_map(self, store_id: str = "sample", force: bool = False) -> IndoorMap:
        """Create a sample/demo store map."""
        if not force and store_id in self.maps:
            self.current_store_id = store_id
            return self.maps[store_id]

        mall_map = IndoorMap(800, 600)
        
        # Add locations
        mall_map.add_location("Entrance", 400, 550, "Main entrance to the mall")
        mall_map.add_location("Food Court", 200, 200, "Dining area with multiple restaurants")
        mall_map.add_location("Electronics Store", 600, 200, "Latest gadgets and electronics")
        mall_map.add_location("Clothing Store", 200, 400, "Fashion and apparel")
        mall_map.add_location("Grocery Store", 600, 400, "Supermarket for daily needs")
        mall_map.add_location("Pharmacy", 400, 300, "Medicine and healthcare products")
        mall_map.add_location("ATM", 100, 350, "Cash withdrawal point")
        mall_map.add_location("Restroom", 700, 350, "Public facilities")
        mall_map.add_location("Information Desk", 400, 450, "Help and information center")
        mall_map.add_location("Parking", 50, 550, "Vehicle parking area")
        
        # Add obstacles (walls)
        mall_map.add_obstacle(350, 250, 450, 350)
        mall_map.add_obstacle(0, 0, 800, 50)
        mall_map.add_obstacle(0, 0, 50, 600)
        mall_map.add_obstacle(750, 0, 800, 600)
        mall_map.add_obstacle(0, 550, 800, 600)
        
        # Add sample products
        mall_map.products = {
            "Grocery Store": [
                {"name": "Basmati Rice", "category": "Grains", "price": 120, "type": "Veg"},
                {"name": "Milk", "category": "Dairy", "price": 55, "type": "Veg"},
                {"name": "Bread", "category": "Bakery", "price": 25, "type": "Veg"},
                {"name": "Tomatoes", "category": "Vegetables", "price": 40, "type": "Veg"},
            ],
            "Food Court": [
                {"name": "Pizza", "category": "Fast Food", "price": 250, "type": "Veg"},
                {"name": "Burger", "category": "Fast Food", "price": 180, "type": "Non-Veg"},
                {"name": "Coffee", "category": "Beverages", "price": 80, "type": "Veg"},
            ],
            "Electronics Store": [
                {"name": "Smartphone", "category": "Electronics", "price": 15000, "type": "NA"},
                {"name": "Headphones", "category": "Electronics", "price": 2000, "type": "NA"},
            ]
        }
        
        self.maps[store_id] = mall_map
        self.current_store_id = store_id
        
        return mall_map
    
    def get_path(
        self,
        start: str,
        end: str,
        mode: str = "astar"
    ) -> Optional[Tuple[List[Dict], float]]:
        """Get path between two locations."""
        indoor_map = self.get_current_map()
        if not indoor_map:
            return None
        
        if mode == "astar":
            path = indoor_map.find_path_astar(start, end)
        else:
            path = indoor_map.find_path_standard(start, end)
        
        if path:
            distance = indoor_map.calculate_distance(start, end)
            return path, distance
        
        return None

    def get_path_chain(
        self,
        start: str,
        stops: List[str],
        mode: str = "astar"
    ) -> Optional[Tuple[List[Dict], float]]:
        """Build a single combined path from start through ordered stops."""
        indoor_map = self.get_current_map()
        if not indoor_map or not stops:
            return None

        valid_stops: List[str] = []
        for stop in stops:
            stop_name = str(stop).strip()
            if not stop_name or stop_name not in indoor_map.locations:
                continue
            if valid_stops and valid_stops[-1] == stop_name:
                continue
            valid_stops.append(stop_name)

        if not valid_stops:
            return None

        if start not in indoor_map.locations:
            start = "Entrance" if "Entrance" in indoor_map.locations else valid_stops[0]

        combined_path: List[Dict] = []
        total_distance = 0.0
        current_loc = start

        for stop in valid_stops:
            if stop == current_loc:
                continue

            if mode == "astar":
                segment = indoor_map.find_path_astar(current_loc, stop)
            else:
                segment = indoor_map.find_path_standard(current_loc, stop)

            if not segment:
                continue

            total_distance += indoor_map.calculate_distance(current_loc, stop)
            if combined_path:
                combined_path.extend(segment[1:])
            else:
                combined_path.extend(segment)
            current_loc = stop

        if len(combined_path) < 2:
            return None

        return combined_path, total_distance
    
    def plan_shopping_route(
        self,
        items: List[str],
        current_location: str
    ) -> Dict:
        """Plan an optimized shopping route for multiple items."""
        indoor_map = self.get_current_map()
        if not indoor_map:
            return {"route": [], "total_distance": 0, "items_not_found": items}
        
        shopping_route = []
        items_not_found = []
        
        for item in items:
            location = indoor_map.find_product_location(item)
            if location:
                shopping_route.append({'item': item, 'location': location})
            else:
                items_not_found.append(item)
        
        if not shopping_route:
            return {"route": [], "total_distance": 0, "items_not_found": items_not_found}
        
        # Group items by location.
        items_by_location: Dict[str, List[str]] = {}
        for route_item in shopping_route:
            items_by_location.setdefault(route_item["location"], []).append(route_item["item"])

        remaining_locations = list(items_by_location.keys())
        if current_location not in indoor_map.locations:
            current_location = "Entrance" if "Entrance" in indoor_map.locations else remaining_locations[0]

        # Greedy nearest-neighbor route for better in-store walk order.
        ordered_locations: List[str] = []
        current_loc = current_location
        while remaining_locations:
            next_location = min(
                remaining_locations,
                key=lambda loc: indoor_map.calculate_distance(current_loc, loc)
            )
            ordered_locations.append(next_location)
            remaining_locations.remove(next_location)
            current_loc = next_location

        # Calculate route with distances.
        route_with_distances = []
        current_loc = current_location
        total_distance = 0
        
        for location in ordered_locations:
            distance = indoor_map.calculate_distance(current_loc, location)
            total_distance += distance
            
            items_here = items_by_location.get(location, [])
            
            route_with_distances.append({
                'location': location,
                'items': items_here,
                'distance_from_previous': distance
            })
            current_loc = location
        
        return {
            "route": route_with_distances,
            "total_distance": total_distance,
            "items_not_found": items_not_found
        }
    
    def search_products(self, query: str) -> List[Dict]:
        """Search for products across the current store."""
        indoor_map = self.get_current_map()
        if not indoor_map:
            return []
        return indoor_map.search_products(query)
    
    def get_all_products(
        self,
        category: Optional[str] = None,
        product_type: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None
    ) -> List[Dict]:
        """Get all products with optional filters."""
        indoor_map = self.get_current_map()
        if not indoor_map:
            return []
        
        all_products = []
        for location, products in indoor_map.products.items():
            for product in products:
                all_products.append({
                    'product': product,
                    'location': location
                })
        
        # Apply filters
        if category:
            all_products = [p for p in all_products if p['product'].get('category', '').lower() == category.lower()]
        
        if product_type:
            all_products = [p for p in all_products if p['product'].get('type', '').lower() == product_type.lower()]
        
        if min_price is not None:
            all_products = [p for p in all_products if p['product'].get('price', 0) >= min_price]
        
        if max_price is not None:
            all_products = [p for p in all_products if p['product'].get('price', float('inf')) <= max_price]
        
        return all_products
    
    def get_product_stats(self) -> Dict:
        """Get statistics about products in the current store."""
        indoor_map = self.get_current_map()
        if not indoor_map:
            return {}
        
        all_products = []
        for products in indoor_map.products.values():
            all_products.extend(products)
        
        if not all_products:
            return {
                "total_products": 0,
                "categories": [],
                "veg_count": 0,
                "non_veg_count": 0,
                "price_range": {"min": 0, "max": 0}
            }
        
        # Count by category
        category_counts = {}
        veg_count = 0
        non_veg_count = 0
        prices = []
        
        for product in all_products:
            cat = product.get('category', 'General')
            category_counts[cat] = category_counts.get(cat, 0) + 1
            
            if product.get('type', '').lower() == 'veg':
                veg_count += 1
            elif product.get('type', '').lower() == 'non-veg':
                non_veg_count += 1
            
            try:
                prices.append(float(product.get('price', 0)))
            except:
                pass
        
        return {
            "total_products": len(all_products),
            "categories": [{"name": k, "count": v} for k, v in category_counts.items()],
            "veg_count": veg_count,
            "non_veg_count": non_veg_count,
            "price_range": {
                "min": min(prices) if prices else 0,
                "max": max(prices) if prices else 0
            }
        }


# Singleton instance
navigation_service = NavigationService()
