"""
Authentication dependencies for FastAPI endpoints.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from auth.service import auth_service
from schemas.auth import TokenData, UserInfo

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> UserInfo:
    """
    Get the current authenticated user from JWT token.
    Raises 401 if not authenticated.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token_data = auth_service.verify_token(credentials.credentials)
    
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return UserInfo(
        email=token_data.email,
        name=token_data.name,
        picture=token_data.picture,
        is_guest="@cartmapper.local" in token_data.email
    )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[UserInfo]:
    """
    Get the current user if authenticated, otherwise return None.
    Does not raise an exception for unauthenticated requests.
    """
    if credentials is None:
        return None
    
    token_data = auth_service.verify_token(credentials.credentials)
    
    if token_data is None:
        return None
    
    return UserInfo(
        email=token_data.email,
        name=token_data.name,
        picture=token_data.picture,
        is_guest="@cartmapper.local" in token_data.email
    )
