"""
QR code router.
"""

import base64
from typing import Optional
from fastapi import APIRouter, HTTPException, status, UploadFile, File
from fastapi.responses import Response

from qr.service import qr_service
from schemas.common import QRDecodeResponse, QRAnchorValidation, AnchorPayload

router = APIRouter()


@router.post("/decode", response_model=QRDecodeResponse)
async def decode_qr(file: UploadFile = File(...)):
    """
    Decode a QR code from an uploaded image.
    """
    try:
        content = await file.read()
        
        data = qr_service.decode_qr(content)
        
        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No QR code found in the image"
            )
        
        return QRDecodeResponse(
            data=data,
            success=True,
            is_url=qr_service.is_url(data),
            is_anchor=qr_service.is_anchor(data)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to decode QR: {str(e)}"
        )


@router.post("/validate-anchor", response_model=QRAnchorValidation)
async def validate_anchor(
    file: UploadFile = File(...),
    shop_id: Optional[str] = None
):
    """
    Decode and validate an anchor QR code.
    """
    try:
        content = await file.read()
        
        data = qr_service.decode_qr(content)
        
        if not data:
            return QRAnchorValidation(
                valid=False,
                payload=None,
                error="No QR code found in the image"
            )
        
        payload, error = qr_service.parse_anchor_payload(data, shop_id)
        
        if error:
            return QRAnchorValidation(
                valid=False,
                payload=None,
                error=error
            )
        
        return QRAnchorValidation(
            valid=True,
            payload=payload,
            error=None
        )
        
    except Exception as e:
        return QRAnchorValidation(
            valid=False,
            payload=None,
            error=f"Failed to process QR: {str(e)}"
        )


@router.post("/validate-anchor-data", response_model=QRAnchorValidation)
async def validate_anchor_data(
    qr_data: str,
    shop_id: Optional[str] = None
):
    """
    Validate anchor QR data (already decoded).
    """
    payload, error = qr_service.parse_anchor_payload(qr_data, shop_id)
    
    if error:
        return QRAnchorValidation(
            valid=False,
            payload=None,
            error=error
        )
    
    return QRAnchorValidation(
        valid=True,
        payload=payload,
        error=None
    )


@router.get("/generate-anchor/{store_id}/{anchor_id}")
async def generate_anchor_qr(store_id: str, anchor_id: str):
    """
    Generate a QR code PNG for a specific anchor.
    """
    qr_bytes = qr_service.generate_anchor_qr(store_id, anchor_id)
    
    if not qr_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store or anchor not found"
        )
    
    return Response(
        content=qr_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f"attachment; filename={anchor_id}_qr.png"
        }
    )


@router.get("/generate-anchor-base64/{store_id}/{anchor_id}")
async def generate_anchor_qr_base64(store_id: str, anchor_id: str):
    """
    Generate a QR code as base64 for a specific anchor.
    """
    qr_bytes = qr_service.generate_anchor_qr(store_id, anchor_id)
    
    if not qr_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store or anchor not found"
        )
    
    base64_data = base64.b64encode(qr_bytes).decode('utf-8')
    
    return {
        "store_id": store_id,
        "anchor_id": anchor_id,
        "qr_base64": base64_data,
        "format": "png"
    }


@router.post("/generate")
async def generate_qr(data: str):
    """
    Generate a QR code from arbitrary data.
    """
    try:
        qr_bytes = qr_service.generate_qr(data)
        
        return Response(
            content=qr_bytes,
            media_type="image/png",
            headers={
                "Content-Disposition": "attachment; filename=qrcode.png"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate QR: {str(e)}"
        )
