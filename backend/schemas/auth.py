"""
Authentication-related Pydantic schemas.
"""

from typing import Optional
from pydantic import BaseModel, Field


class UserInfo(BaseModel):
    """User information returned from authentication."""
    email: str
    name: str
    picture: str = ""
    is_guest: bool = False


class TokenData(BaseModel):
    """Data extracted from JWT token."""
    email: str
    name: str = ""
    picture: str = ""


class GoogleUserInfo(BaseModel):
    """User information from Google OAuth."""
    sub: str
    email: str
    email_verified: bool = False
    name: str = ""
    picture: str = ""
    given_name: str = ""
    family_name: str = ""


class GoogleAuthURL(BaseModel):
    """Response containing Google OAuth URL."""
    auth_url: str


class GoogleCallbackRequest(BaseModel):
    """Request body for Google OAuth callback."""
    code: str
    state: Optional[str] = None


class GuestLoginRequest(BaseModel):
    """Request body for guest login."""
    name: str = "Guest User"


class ForgotPasswordRequest(BaseModel):
    """Request body for forgot password."""
    email: str = Field(..., min_length=5, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ForgotPasswordResponse(BaseModel):
    """Response for forgot password request."""
    message: str
    # Exposed in development to simplify frontend testing.
    reset_token: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    """Request body for password reset."""
    token: str
    new_password: str


class ResetPasswordResponse(BaseModel):
    """Response after resetting password."""
    message: str


class LoginResponse(BaseModel):
    """Response after successful login."""
    access_token: str
    token_type: str = "bearer"
    user: UserInfo
