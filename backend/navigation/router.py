"""
Navigation router for indoor navigation and pathfinding.
"""

import base64
import math
import re
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Query

from navigation.service import navigation_service
from translation.service import translation_service
from rag.service import rag_service
from schemas.navigation import (
    PathRequest,
    PathResponse,
    PathPoint,
    DistanceRequest,
    DistanceResponse,
    NearbyLocationsRequest,
    NearbyLocation,
    ProductLocationRequest,
    ProductLocationResponse,
    ShoppingRouteRequest,
    ShoppingRouteResponse,
    ShoppingRouteItem,
    NavigationQueryRequest,
    NavigationQueryResponse,
    MapResponse,
    Location,
    StoreLayoutInit
)
from schemas.product import (
    ProductSearchRequest,
    ProductSearchResponse,
    ProductSearchResult,
    Product,
    ProductStats,
    ProductAlternativeRequest,
    ProductAlternativeResponse
)
from auth.dependencies import get_optional_user
from schemas.auth import UserInfo
from config import get_settings

settings = get_settings()
router = APIRouter()


def _resolve_current_location(indoor_map, requested_location: Optional[str]) -> str:
    """Resolve current location with sensible defaults."""
    if requested_location and requested_location in indoor_map.locations:
        return requested_location

    for name in indoor_map.locations.keys():
        if "entrance" in name.lower():
            return name

    return next(iter(indoor_map.locations.keys()), "Unknown")


def _format_price(value: Any) -> str:
    """Format numeric price for user-facing answers."""
    try:
        price = float(value)
    except (TypeError, ValueError):
        return "N/A"

    if price <= 0:
        return "N/A"
    if price.is_integer():
        return f"Rs {int(price)}"
    return f"Rs {price:.2f}"


def _path_to_steps(path: List[Dict[str, Any]], max_steps: int = 4) -> List[str]:
    """
    Convert raw path points to compact directional steps.
    """
    if not path or len(path) < 2:
        return []

    segments: List[Dict[str, Any]] = []
    for i in range(1, len(path)):
        x0, y0 = int(path[i - 1]["x"]), int(path[i - 1]["y"])
        x1, y1 = int(path[i]["x"]), int(path[i]["y"])
        dx, dy = x1 - x0, y1 - y0
        distance = math.sqrt(dx * dx + dy * dy)
        if distance < 1:
            continue

        if abs(dx) >= abs(dy):
            direction = "right" if dx > 0 else "left"
        else:
            direction = "down" if dy > 0 else "up"

        if segments and segments[-1]["direction"] == direction:
            segments[-1]["distance"] += distance
        else:
            segments.append({"direction": direction, "distance": distance})

    step_lines = []
    for seg in segments[:max_steps]:
        step_lines.append(
            f"Move {seg['direction']} for about {int(round(seg['distance']))} px."
        )
    return step_lines


_QUERY_STOP_WORDS = {
    "where", "what", "which", "is", "are", "the", "a", "an", "of", "in", "at",
    "on", "to", "for", "from", "show", "tell", "me", "give", "find", "locate",
    "location", "price", "cost", "mrp", "rate", "how", "much", "please", "and",
    "with", "item", "product"
}


def _extract_product_search_query(question: str) -> str:
    """Extract likely product phrase from a natural-language question."""
    raw = re.sub(r"\s+", " ", question).strip()
    normalized = re.sub(r"[^a-z0-9\s]", " ", raw.lower())
    tokens = [t for t in normalized.split() if t and t not in _QUERY_STOP_WORDS]
    extracted = " ".join(tokens).strip()
    return extracted or raw


def _build_product_navigation_result(
    question: str,
    current_location: str
) -> Optional[Dict[str, Any]]:
    """
    Deterministic product answer plus structured route/product payload.
    """
    queries = []
    extracted_query = _extract_product_search_query(question)
    if extracted_query:
        queries.append(extracted_query)
    plain_question = question.strip()
    if plain_question and plain_question not in queries:
        queries.append(plain_question)

    results = []
    used_query = plain_question
    for query in queries:
        results = navigation_service.search_products(query)
        if results:
            used_query = query
            break

    if not results:
        return None

    top_result = results[0]
    product = top_result.get("product", {})
    location = top_result.get("location", "Unknown")
    name = str(product.get("name", "Item"))
    price_value = float(product.get("price", 0) or 0)
    price_text = _format_price(price_value)
    item_type = str(product.get("type", "Unknown"))
    company = str(product.get("company", "")).strip()
    stock = str(product.get("stock", "")).strip()

    route_steps = [f"Start at {current_location}."]
    path_result = navigation_service.get_path(current_location, location, mode="astar")
    distance = None
    if path_result:
        path, distance_value = path_result
        distance = float(distance_value)
        route_steps.extend(_path_to_steps(path, max_steps=4))
        route_steps.append(f"You will reach {location}.")
    else:
        route_steps.append(f"Go to {location}.")

    sentence_parts = [
        f"{name} is available in {location}.",
        f"Price: {price_text}.",
        f"Type: {item_type}.",
    ]
    if company:
        sentence_parts.append(f"Brand: {company}.")
    if stock:
        sentence_parts.append(f"Stock: {stock}.")
    if distance is not None:
        sentence_parts.append(
            f"Distance from {current_location}: about {int(round(distance))} px."
        )
    if route_steps:
        sentence_parts.append("Directions: " + " ".join(route_steps))

    return {
        "answer": " ".join(sentence_parts),
        "destination_location": location,
        "distance": distance,
        "route_steps": route_steps,
        "matched_product": {
            "name": name,
            "location": location,
            "price": price_value,
            "type": item_type,
            "company": company or None,
        },
        "search_query_used": used_query,
    }


def _fallback_navigation_answer(current_location: str, indoor_map, product_result: Optional[Dict[str, Any]] = None) -> str:
    """
    Reliable fallback response when LLM is unavailable or fails.
    """
    if product_result and product_result.get("answer"):
        return str(product_result["answer"])

    location_names = ", ".join(list(indoor_map.locations.keys())[:20])
    return (
        f"I could not run the LLM right now. You are at {current_location}. "
        f"Available locations include: {location_names}."
    )


@router.post("/init")
async def initialize_map(
    store_id: str = "sample",
    user: UserInfo = Depends(get_optional_user)
):
    """
    Initialize a sample store map.
    For custom maps, use the store inventory upload endpoint.
    """
    map_exists = store_id in navigation_service.maps
    indoor_map = navigation_service.create_sample_map(store_id)
    
    return {
        "success": True,
        "message": (
            f"Loaded existing map for store {store_id}"
            if map_exists
            else f"Initialized sample map for store {store_id}"
        ),
        "locations": list(indoor_map.locations.keys()),
        "product_count": sum(len(p) for p in indoor_map.products.values())
    }


@router.post("/path", response_model=PathResponse)
async def get_path(request: PathRequest):
    """
    Calculate path between two locations.
    Supports 'astar' (obstacle-avoiding) and 'standard' (direct) modes.
    """
    result = navigation_service.get_path(
        start=request.start,
        end=request.end,
        mode=request.mode
    )
    
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not find path. Make sure locations exist and a map is loaded."
        )
    
    path, distance = result
    
    return PathResponse(
        path=[PathPoint(**p) for p in path],
        distance=distance,
        start=request.start,
        end=request.end,
        mode=request.mode
    )


@router.post("/distance", response_model=DistanceResponse)
async def get_distance(request: DistanceRequest):
    """
    Calculate distance between two locations.
    """
    indoor_map = navigation_service.get_current_map()
    
    if not indoor_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No map loaded. Initialize a map first."
        )
    
    distance = indoor_map.calculate_distance(request.location1, request.location2)
    
    if distance == float('inf'):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both locations not found"
        )
    
    return DistanceResponse(
        distance=distance,
        location1=request.location1,
        location2=request.location2
    )


@router.post("/nearby", response_model=List[NearbyLocation])
async def get_nearby_locations(request: NearbyLocationsRequest):
    """
    Get locations near the current location.
    """
    indoor_map = navigation_service.get_current_map()
    
    if not indoor_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No map loaded. Initialize a map first."
        )
    
    nearby = indoor_map.get_nearest_locations(
        request.current_location,
        request.max_distance
    )
    
    return [NearbyLocation(**loc) for loc in nearby]


@router.post("/product-location", response_model=ProductLocationResponse)
async def get_product_location(request: ProductLocationRequest):
    """
    Find the location of a product in the store.
    """
    indoor_map = navigation_service.get_current_map()
    
    if not indoor_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No map loaded. Initialize a map first."
        )
    
    location = indoor_map.find_product_location(request.product_name)
    
    return ProductLocationResponse(
        product_name=request.product_name,
        location=location,
        found=location is not None
    )


@router.post("/shopping-route", response_model=ShoppingRouteResponse)
async def plan_shopping_route(request: ShoppingRouteRequest):
    """
    Plan an optimized shopping route for multiple items.
    """
    result = navigation_service.plan_shopping_route(
        items=request.items,
        current_location=request.current_location
    )
    
    route_items = []
    for item in result.get("route", []):
        for product_name in item.get("items", []):
            route_items.append(ShoppingRouteItem(
                item=product_name,
                location=item["location"],
                distance_from_previous=item["distance_from_previous"]
            ))
    
    return ShoppingRouteResponse(
        route=route_items,
        total_distance=result.get("total_distance", 0),
        items_not_found=result.get("items_not_found", [])
    )


@router.post("/ask", response_model=NavigationQueryResponse)
async def ask_navigation(request: NavigationQueryRequest):
    """
    Natural language navigation assistance.
    Uses LLM to provide directions and product information.
    """
    indoor_map = navigation_service.get_current_map()
    
    if not indoor_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No map loaded. Initialize a map first."
        )
    
    question = request.question
    translated_answer = None
    
    # Translate question if needed
    if request.language != "en":
        translation_result = translation_service.translate(
            text=question,
            source_lang=request.language,
            target_lang="en"
        )
        if translation_result["success"]:
            question = translation_result["translated_text"]
    
    current_location = _resolve_current_location(indoor_map, request.current_location)
    product_result = _build_product_navigation_result(question, current_location)
    is_short_query = len(question.split()) <= 10

    destination_location = product_result.get("destination_location") if product_result else None
    distance = product_result.get("distance") if product_result else None
    route_steps = product_result.get("route_steps", []) if product_result else []
    matched_product = product_result.get("matched_product") if product_result else None
    search_query_used = product_result.get("search_query_used") if product_result else None

    # For short product-like queries, prefer deterministic response.
    if product_result and is_short_query:
        answer = str(product_result.get("answer", ""))
    else:
        # Build compact context to avoid token overflow (413).
        locations_info = [
            {
                "name": name,
                "description": info.get("description", "")
            }
            for name, info in list(indoor_map.locations.items())[:30]
        ]
        query_for_context = search_query_used or _extract_product_search_query(question)
        product_candidates = navigation_service.search_products(query_for_context)[:8]
        if not product_candidates:
            product_candidates = navigation_service.search_products(question)[:8]
        compact_products = []
        for item in product_candidates:
            p = item.get("product", {})
            compact_products.append({
                "name": p.get("name", ""),
                "location": item.get("location", ""),
                "price": p.get("price", 0),
                "type": p.get("type", "Unknown"),
                "company": p.get("company", ""),
            })

        # Use LLM for navigation response with compact context.
        try:
            from langchain_groq import ChatGroq
            from langchain_core.prompts import ChatPromptTemplate
            from langchain_core.output_parsers import StrOutputParser

            if not settings.GROQ_API_KEY:
                answer = _fallback_navigation_answer(current_location, indoor_map, product_result)
            else:
                llm = ChatGroq(
                    temperature=0.2,
                    model_name=settings.GROQ_MODEL,
                    groq_api_key=settings.GROQ_API_KEY
                )

                navigation_template = """You are an indoor navigation assistant for a supermarket.
Current location: {current_location}
Available locations (compact): {locations}
Top relevant products for this query (compact): {products_info}
User query: {question}

Rules:
- If user asks a product question, include exact location and price.
- If user asks navigation, provide short step-by-step directions from current location.
- Keep the response concise and practical.
- If product is not in compact products, say so clearly.

Response:"""

                prompt = ChatPromptTemplate.from_template(navigation_template)
                chain = prompt | llm | StrOutputParser()

                answer = chain.invoke({
                    "locations": str(locations_info),
                    "current_location": current_location,
                    "products_info": str(compact_products),
                    "question": question
                })
        except Exception as e:
            print(f"LLM navigation failed: {e}")
            answer = _fallback_navigation_answer(current_location, indoor_map, product_result)
    
    # Translate response if needed
    if request.language != "en":
        translation_result = translation_service.translate(
            text=answer,
            source_lang="en",
            target_lang=request.language
        )
        if translation_result["success"]:
            translated_answer = translation_result["translated_text"]
    
    return NavigationQueryResponse(
        answer=translated_answer if translated_answer else answer,
        translated_answer=translated_answer,
        language=request.language,
        destination_location=destination_location,
        distance=distance,
        route_steps=route_steps,
        matched_product=matched_product,
        search_query_used=search_query_used
    )


@router.get("/map", response_model=MapResponse)
async def get_map(
    current_location: Optional[str] = None,
    destination: Optional[str] = None,
    stops: Optional[List[str]] = Query(None),
    stops_bracket: Optional[List[str]] = Query(None, alias="stops[]")
):
    """
    Get the store map as a base64-encoded image.
    """
    indoor_map = navigation_service.get_current_map()
    
    if not indoor_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No map loaded. Initialize a map first."
        )
    
    # Get path if locations are specified.
    path = None
    resolved_destination = destination
    all_stops: List[str] = []
    if stops:
        all_stops.extend(stops)
    if stops_bracket:
        all_stops.extend(stops_bracket)

    if current_location and all_stops:
        ordered_stops: List[str] = []
        for stop in all_stops:
            stop_name = (stop or "").strip()
            if not stop_name or stop_name not in indoor_map.locations:
                continue
            if ordered_stops and ordered_stops[-1] == stop_name:
                continue
            ordered_stops.append(stop_name)

        if ordered_stops:
            result = navigation_service.get_path_chain(current_location, ordered_stops)
            if result:
                path, _ = result
                resolved_destination = ordered_stops[-1]
    elif current_location and destination:
        result = navigation_service.get_path(current_location, destination)
        if result:
            path, _ = result
    
    # Generate map image
    image_bytes = indoor_map.generate_visual_map(
        current_location=current_location,
        destination=resolved_destination,
        path=path
    )
    
    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
    
    locations = [
        Location(
            name=name,
            x=loc['x'],
            y=loc['y'],
            description=loc.get('description', '')
        )
        for name, loc in indoor_map.locations.items()
    ]
    
    return MapResponse(
        image_base64=image_base64,
        width=indoor_map.width,
        height=indoor_map.height,
        locations=locations
    )


@router.get("/locations", response_model=List[Location])
async def get_locations():
    """
    Get all locations in the current map.
    """
    indoor_map = navigation_service.get_current_map()
    
    if not indoor_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No map loaded. Initialize a map first."
        )
    
    return [
        Location(
            name=name,
            x=loc['x'],
            y=loc['y'],
            description=loc.get('description', '')
        )
        for name, loc in indoor_map.locations.items()
    ]


@router.get("/products", response_model=ProductSearchResponse)
async def get_products(
    query: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    limit: int = 50
):
    """
    Get products with optional filtering.
    If a query is provided, it also checks the RAG system for uploaded documents.
    """
    results = []
    
    # Standard product search
    if query:
        results = navigation_service.search_products(query)
    else:
        results = navigation_service.get_all_products(
            category=category,
            product_type=type,
            min_price=min_price,
            max_price=max_price
        )
    
    # Optional: If results are few or empty, and we have a query, ask RAG
    if query:
        rag_status = rag_service.get_status()
        if rag_status.get("documents_loaded"):
            # We use the RAG service to find mentions of products
            rag_results = await rag_service.query_products(query)
            
            for item in rag_results:
                # Add RAG results to the combined list
                results.append({
                    'product': {
                        'name': item.get('name', 'Unknown'),
                        'category': item.get('category', 'Document'),
                        'price': float(item.get('price', 0)),
                        'type': item.get('type', 'General')
                    },
                    'location': 'Document Analysis', # Mark as coming from document
                    'match_score': 1.5 # Boost RAG matches slightly to show they are relevant
                })

    # Transform to response format
    search_results = []
    # Sort again to ensure RAG results are mixed in correctly by match score
    results.sort(key=lambda x: (-x.get('match_score', 0), x['product'].get('name', '')))
    
    for r in results[:limit]:
        product = r['product']
        search_results.append(ProductSearchResult(
            product=Product(
                name=product.get('name', ''),
                category=product.get('category', 'General'),
                price=float(product.get('price', 0)),
                price_display=f"₹{product.get('price', 0)}",
                type=product.get('type', 'Unknown'),
                stock=str(product.get('stock')).strip() if product.get('stock') is not None else None,
                location=r['location']
            ),
            location=r['location'],
            match_score=r.get('match_score', 1)
        ))
    
    return ProductSearchResponse(
        results=search_results,
        total=len(results),
        query=query or ""
    )


@router.get("/products/stats", response_model=ProductStats)
async def get_product_stats():
    """
    Get statistics about products in the store.
    """
    stats = navigation_service.get_product_stats()
    
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No map loaded. Initialize a map first."
        )
    
    return ProductStats(**stats)


@router.post("/products/alternatives", response_model=ProductAlternativeResponse)
async def get_alternatives(request: ProductAlternativeRequest):
    """
    Get cheaper alternatives for a product.
    """
    indoor_map = navigation_service.get_current_map()
    
    if not indoor_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No map loaded. Initialize a map first."
        )
    
    # Find original product
    original = None
    original_price = request.max_price or float('inf')
    
    search_results = indoor_map.search_products(request.product_name)
    if search_results:
        original_data = search_results[0]['product']
        original = Product(
            name=original_data.get('name', ''),
            category=original_data.get('category', 'General'),
            price=float(original_data.get('price', 0)),
            price_display=f"₹{original_data.get('price', 0)}",
            type=original_data.get('type', 'Unknown'),
            stock=str(original_data.get('stock')).strip() if original_data.get('stock') is not None else None,
            location=search_results[0]['location']
        )
        original_price = original.price
    
    # Find cheaper alternatives
    alternatives = indoor_map.get_products_by_price_range(0, original_price - 1)
    
    alt_results = []
    for alt in alternatives[:5]:
        product = alt['product']
        alt_results.append(ProductSearchResult(
            product=Product(
                name=product.get('name', ''),
                category=product.get('category', 'General'),
                price=float(product.get('price', 0)),
                price_display=f"₹{product.get('price', 0)}",
                type=product.get('type', 'Unknown'),
                stock=str(product.get('stock')).strip() if product.get('stock') is not None else None,
                location=alt['location']
            ),
            location=alt['location'],
            match_score=1
        ))
    
    return ProductAlternativeResponse(
        original_product=original,
        alternatives=alt_results
    )


@router.get("/export")
async def export_map():
    """
    Export the current map as JSON.
    """
    indoor_map = navigation_service.get_current_map()
    
    if not indoor_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No map loaded. Initialize a map first."
        )
    
    return indoor_map.to_dict()
