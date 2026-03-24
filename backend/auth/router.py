"""
Authentication router for Google OAuth and JWT-based auth.
"""

from fastapi import APIRouter, HTTPException, status, Depends

from auth.service import auth_service
from auth.dependencies import get_current_user
from schemas.auth import (
    LoginResponse,
    GoogleAuthURL,
    GoogleCallbackRequest,
    GuestLoginRequest,
    UserInfo,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from config import get_settings

settings = get_settings()
router = APIRouter()


@router.get("/google/login", response_model=GoogleAuthURL)
async def google_login():
    """
    Get Google OAuth authorization URL.
    Frontend should redirect user to this URL.
    """
    try:
        auth_url = auth_service.get_google_auth_url()
        return GoogleAuthURL(auth_url=auth_url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )


@router.post("/google/callback", response_model=LoginResponse)
async def google_callback(request: GoogleCallbackRequest):
    """
    Handle Google OAuth callback.
    Exchange authorization code for user info and JWT token.
    """
    user = await auth_service.get_user_from_google(request.code)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to authenticate with Google"
        )
    
    # Create JWT token
    token = auth_service.create_access_token(
        data={
            "sub": user.email,
            "name": user.name,
            "picture": user.picture
        }
    )
    
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=user
    )


@router.post("/guest", response_model=LoginResponse)
async def guest_login(request: GuestLoginRequest):
    """
    Create a guest session without OAuth.
    Useful when Google OAuth is not configured.
    """
    guest_user = auth_service.create_guest_user(name=request.name)
    
    # Create JWT token for guest
    token = auth_service.create_access_token(
        data={
            "sub": guest_user.email,
            "name": guest_user.name,
            "picture": ""
        }
    )
    
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=guest_user
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(request: ForgotPasswordRequest):
    """
    Request a password reset token.
    Always returns success-shaped response to avoid leaking account existence.
    """
    reset_token = auth_service.create_password_reset_token(str(request.email))

    response = ForgotPasswordResponse(
        message="If an account exists for this email, a reset link has been sent."
    )

    # Helpful for local development/testing when no email provider is configured.
    if settings.DEBUG:
        response.reset_token = reset_token

    return response


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password using a reset token.
    Current version validates token lifecycle; password persistence can be
    connected to a user database when local-password auth is added.
    """
    if len(request.new_password.strip()) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long.",
        )

    token_valid = auth_service.consume_password_reset_token(request.token)
    if not token_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    return ResetPasswordResponse(message="Password reset successful. You can now sign in.")


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: UserInfo = Depends(get_current_user)):
    """
    Get current authenticated user's information.
    """
    return current_user


@router.post("/logout")
async def logout(current_user: UserInfo = Depends(get_current_user)):
    """
    Logout current user.
    Note: JWT tokens are stateless, so this just returns success.
    Frontend should delete the token from storage.
    """
    return {
        "message": "Successfully logged out",
        "email": current_user.email
    }


@router.get("/status")
async def auth_status():
    """
    Check if Google OAuth is configured.
    """
    google_configured = bool(
        settings.GOOGLE_CLIENT_ID and 
        settings.GOOGLE_CLIENT_SECRET
    )
    
    return {
        "google_oauth_configured": google_configured,
        "guest_login_available": True
    }
