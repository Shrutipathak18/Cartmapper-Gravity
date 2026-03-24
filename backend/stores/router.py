"""
Store management router.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Depends
from fastapi.responses import JSONResponse

from stores.service import store_service
from auth.dependencies import get_optional_user
from schemas.auth import UserInfo

router = APIRouter()


@router.get("")
async def list_stores():
    """
    Get all available stores.
    """
    stores = store_service.get_all_stores()
    return {"stores": stores}


@router.get("/active/current")
async def get_active_store():
    """
    Get the currently active store.
    """
    active = store_service.get_active_store()
    
    if not active:
        return {"active_store": None}
    
    store = store_service.get_store(active)
    return {"active_store": store}


@router.get("/{store_id}")
async def get_store(store_id: str):
    """
    Get store details by ID or name.
    """
    store = store_service.get_store(store_id)
    
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store not found"
        )
    
    return store


@router.post("/{store_id}/activate")
async def activate_store(
    store_id: str,
    user: UserInfo = Depends(get_optional_user)
):
    """
    Set a store as the active store.
    """
    success = store_service.set_active_store(store_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store not found"
        )
    
    return {"message": f"Store {store_id} is now active", "store_id": store_id}


@router.post("/{store_id}/inventory")
async def upload_inventory(
    store_id: str,
    file: UploadFile = File(...),
    user: UserInfo = Depends(get_optional_user)
):
    """
    Upload inventory CSV for a store.
    """
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    content = await file.read()
    
    result = store_service.upload_inventory(store_id, content)
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    
    return result


@router.get("/{store_id}/anchors")
async def get_store_anchors(store_id: str):
    """
    Get anchor points for a store.
    """
    anchors = store_service.get_store_anchors(store_id)
    
    if not anchors:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store not found or has no anchors"
        )
    
    return {"anchors": anchors}


@router.get("/{store_id}/export")
async def export_store_layout(store_id: str):
    """
    Export store layout as JSON.
    """
    layout = store_service.export_store_layout(store_id)
    
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store not found"
        )
    
    return layout
