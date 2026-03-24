# CartMapper - React + FastAPI Architecture

A fully decoupled web application for smart shopping with indoor navigation, document analysis, and AI-powered assistance.

## Architecture

```
📁 CartMapper/
├── 📁 backend/          # FastAPI Python Backend
│   ├── main.py          # FastAPI application entry
│   ├── config.py        # Configuration management
│   ├── requirements.txt # Python dependencies
│   ├── 📁 auth/         # Authentication (Google OAuth, JWT, Guest)
│   ├── 📁 rag/          # Document analysis (RAG, ChromaDB, LangChain)
│   ├── 📁 navigation/   # Indoor navigation (A* pathfinding, map)
│   ├── 📁 stores/       # Multi-store management
│   ├── 📁 cart/         # Shopping cart operations
│   ├── 📁 qr/           # QR code decode/encode
│   ├── 📁 audio/        # Speech recognition & TTS
│   ├── 📁 translation/  # Multi-language translation
│   ├── 📁 schemas/      # Pydantic models
│   ├── 📁 services/     # Shared services (LLM)
│   └── 📁 utils/        # Utility functions
│
└── 📁 frontend/         # React TypeScript Frontend
    ├── 📁 src/
    │   ├── App.tsx      # Main application
    │   ├── main.tsx     # Entry point
    │   ├── 📁 components/  # React components
    │   ├── 📁 context/     # React context providers
    │   ├── 📁 pages/       # Page components
    │   ├── 📁 services/    # API services
    │   ├── 📁 types/       # TypeScript types
    │   └── 📁 styles/      # CSS styles
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts
```

## Quick Start

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy environment file and configure
copy .env.example .env
# Edit .env with your API keys

# Run development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
copy .env.example .env

# Run development server
npm run dev
```

## API Endpoints

### Authentication
- `GET /auth/google/login` - Get Google OAuth URL
- `POST /auth/google/callback` - Handle OAuth callback
- `POST /auth/guest` - Guest login
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout

### Documents (RAG)
- `POST /rag/upload/pdf` - Upload PDF
- `POST /rag/upload/csv` - Upload CSV
- `POST /rag/upload/qr-url` - Upload from QR URL
- `POST /rag/query` - Query documents
- `GET /rag/status` - Document status

### Navigation
- `POST /navigation/init` - Initialize map
- `POST /navigation/path` - Calculate path
- `GET /navigation/map` - Get map image
- `GET /navigation/products` - Search products
- `POST /navigation/shopping-route` - Plan route
- `POST /navigation/ask` - Natural language navigation

### Stores
- `GET /stores` - List stores
- `POST /stores/{id}/activate` - Activate store
- `POST /stores/{id}/inventory` - Upload inventory

### Cart
- `GET /cart` - Get cart
- `POST /cart/add` - Add item
- `DELETE /cart/{id}` - Remove item
- `POST /cart/budget` - Set budget

### QR Code
- `POST /qr/decode` - Decode QR
- `GET /qr/generate-anchor/{store}/{anchor}` - Generate anchor QR

### Audio
- `POST /audio/transcribe` - Speech to text
- `POST /audio/tts` - Text to speech

### Translation
- `POST /translation` - Translate text

## Features

- 🔐 **Authentication**: Google OAuth, JWT tokens, Guest login
- 📄 **Document Analysis**: PDF/CSV upload, QR scanning, RAG Q&A
- 🗺️ **Indoor Navigation**: A* pathfinding, product search, route planning
- 🛒 **Smart Cart**: Budget tracking, quantity management
- 🎤 **Voice Features**: Speech recognition, text-to-speech
- 🌐 **Multi-language**: English, Hindi, Odia, Bengali, Tamil
- 🏪 **Multi-store**: Store registry, inventory management

## Tech Stack

### Backend
- FastAPI
- LangChain + ChromaDB
- Groq LLM
- PyJWT
- Google Auth
- OpenCV (QR)
- gTTS + SpeechRecognition

### Frontend
- React 18
- TypeScript
- Vite
- TailwindCSS
- Zustand (state)
- React Query
- React Router

## Environment Variables

### Backend (.env)
```
JWT_SECRET_KEY=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GROQ_API_KEY=your-groq-api-key
```

### Frontend (.env)
```
VITE_API_URL=/api
API_PROXY_TARGET=http://127.0.0.1:8000
```
