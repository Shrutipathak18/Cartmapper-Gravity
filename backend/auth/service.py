"""
Authentication service handling Google OAuth and JWT token management.
"""

from datetime import datetime, timedelta
from typing import Optional
import httpx
import secrets
from urllib.parse import urlencode
from jose import jwt, JWTError
from passlib.context import CryptContext
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from config import get_settings
from schemas.auth import UserInfo, TokenData, GoogleUserInfo

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """Service for handling authentication operations."""
    
    def __init__(self):
        self.google_client_id = settings.GOOGLE_CLIENT_ID
        self.google_client_secret = settings.GOOGLE_CLIENT_SECRET
        self.google_redirect_uri = settings.GOOGLE_REDIRECT_URI
        # In-memory store for reset tokens (token -> {"email": str, "expires_at": datetime})
        self.password_reset_tokens: dict[str, dict[str, datetime | str]] = {}
        
    def create_access_token(
        self, 
        data: dict, 
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create a JWT access token."""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
        
        to_encode.update({"exp": expire})
        
        encoded_jwt = jwt.encode(
            to_encode, 
            settings.JWT_SECRET_KEY, 
            algorithm=settings.JWT_ALGORITHM
        )
        
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[TokenData]:
        """Verify and decode a JWT token."""
        try:
            payload = jwt.decode(
                token, 
                settings.JWT_SECRET_KEY, 
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            email: str = payload.get("sub")
            name: str = payload.get("name", "")
            picture: str = payload.get("picture", "")
            
            if email is None:
                return None
                
            return TokenData(
                email=email,
                name=name,
                picture=picture
            )
            
        except JWTError:
            return None
    
    def get_google_auth_url(self, state: Optional[str] = None) -> str:
        """Generate Google OAuth authorization URL."""
        if not self.google_client_id:
            raise ValueError("Google Client ID not configured")
        
        base_url = "https://accounts.google.com/o/oauth2/v2/auth"
        
        params = {
            "client_id": self.google_client_id,
            "redirect_uri": self.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent"
        }
        
        if state:
            params["state"] = state
        
        query_string = urlencode(params)
        return f"{base_url}?{query_string}"
    
    async def exchange_code_for_tokens(self, code: str) -> dict:
        """Exchange authorization code for access and ID tokens."""
        token_url = "https://oauth2.googleapis.com/token"
        
        data = {
            "client_id": self.google_client_id,
            "client_secret": self.google_client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": self.google_redirect_uri
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(token_url, data=data)
            response.raise_for_status()
            return response.json()
    
    def verify_google_token(self, id_token_str: str) -> Optional[GoogleUserInfo]:
        """Verify Google ID token and extract user info."""
        try:
            user_info = id_token.verify_oauth2_token(
                id_token_str,
                google_requests.Request(),
                self.google_client_id
            )
            
            return GoogleUserInfo(
                sub=user_info.get("sub", ""),
                email=user_info.get("email", ""),
                email_verified=user_info.get("email_verified", False),
                name=user_info.get("name", ""),
                picture=user_info.get("picture", ""),
                given_name=user_info.get("given_name", ""),
                family_name=user_info.get("family_name", "")
            )
            
        except Exception as e:
            print(f"Google token verification failed: {e}")
            return None
    
    async def get_user_from_google(self, code: str) -> Optional[UserInfo]:
        """Complete Google OAuth flow and get user info."""
        try:
            # Exchange code for tokens
            tokens = await self.exchange_code_for_tokens(code)
            id_token_str = tokens.get("id_token")
            
            if not id_token_str:
                return None
            
            # Verify and extract user info
            google_user = self.verify_google_token(id_token_str)
            
            if not google_user:
                return None
            
            return UserInfo(
                email=google_user.email,
                name=google_user.name,
                picture=google_user.picture,
                is_guest=False
            )
            
        except Exception as e:
            print(f"Google OAuth error: {e}")
            return None
    
    def create_guest_user(self, name: str = "Guest User") -> UserInfo:
        """Create a guest user without authentication."""
        import uuid
        
        guest_email = f"guest_{uuid.uuid4().hex[:8]}@cartmapper.local"
        
        return UserInfo(
            email=guest_email,
            name=name,
            picture="",
            is_guest=True
        )

    def create_password_reset_token(self, email: str) -> str:
        """
        Create and store a temporary password reset token.
        Note: Current app has no local-password users yet; this supports
        frontend/backend integration and future extension.
        """
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(minutes=30)
        self.password_reset_tokens[token] = {
            "email": email,
            "expires_at": expires_at,
        }
        return token

    def consume_password_reset_token(self, token: str) -> bool:
        """Validate and consume a reset token."""
        token_data = self.password_reset_tokens.get(token)
        if token_data is None:
            return False

        expires_at = token_data["expires_at"]
        if not isinstance(expires_at, datetime) or datetime.utcnow() > expires_at:
            self.password_reset_tokens.pop(token, None)
            return False

        self.password_reset_tokens.pop(token, None)
        return True


# Singleton instance
auth_service = AuthService()
