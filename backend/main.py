"""
CartMapper API - Main FastAPI Application

A comprehensive indoor navigation and document analysis API
that supports multi-store management, RAG-based Q&A, voice I/O,
and QR-based location tracking.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from config import get_settings

# Import routers
from auth.router import router as auth_router
from rag.router import router as rag_router
from navigation.router import router as navigation_router
from stores.router import router as stores_router
from cart.router import router as cart_router
from qr.router import router as qr_router
from audio.router import router as audio_router
from translation.router import router as translation_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"📁 ChromaDB directory: {settings.CHROMA_PERSIST_DIR}")
    print(f"🔗 Frontend URL: {settings.FRONTEND_URL}")
    
    # Create required directories
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.AUDIO_UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.DOCUMENT_UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    os.makedirs(settings.QR_UPLOAD_DIR, exist_ok=True)
    
    yield
    
    # Shutdown
    print("👋 Shutting down CartMapper API")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    CartMapper API provides:
    - 🔐 Google OAuth & JWT Authentication
    - 📄 Document Analysis with RAG (PDF/CSV)
    - 🗺️ Indoor Navigation with A* Pathfinding
    - 📱 QR Code Generation & Scanning
    - 🎤 Voice Input/Output
    - 🌍 Multi-language Translation
    - 🛒 Shopping Cart Management
    - 🏬 Multi-store Support
    """,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(rag_router, prefix="/rag", tags=["Document Analysis"])
app.include_router(navigation_router, prefix="/navigation", tags=["Indoor Navigation"])
app.include_router(stores_router, prefix="/stores", tags=["Store Management"])
app.include_router(cart_router, prefix="/cart", tags=["Shopping Cart"])
app.include_router(qr_router, prefix="/qr", tags=["QR Codes"])
app.include_router(audio_router, prefix="/audio", tags=["Voice & Audio"])
app.include_router(translation_router, prefix="/translate", tags=["Translation"])


@app.get("/", tags=["Health"])
async def root():
    """Root endpoint - API health check."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "healthy",
        "docs": "/docs"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check endpoint."""
    return {
        "status": "healthy",
        "services": {
            "auth": "ready",
            "rag": "ready",
            "navigation": "ready",
            "stores": "ready",
            "cart": "ready",
            "qr": "ready",
            "audio": "ready",
            "translation": "ready"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
