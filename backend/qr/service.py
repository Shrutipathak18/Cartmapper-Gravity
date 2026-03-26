"""
QR code service for encoding and decoding.
"""

import io
import json
from typing import Optional, Tuple
import qrcode
from PIL import Image

from stores.registry import get_store_by_id, STORE_REGISTRY
from schemas.common import AnchorPayload


class QRService:
    """Service for QR code operations."""
    
    def decode_qr(self, image_bytes: bytes) -> Optional[str]:
        """Decode a QR code from image bytes."""
        try:
            import cv2
            import numpy as np
            # Convert to numpy array
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                return None
            
            # Initialize QR detector
            detector = cv2.QRCodeDetector()
            
            # Try to decode
            data, vertices, _ = detector.detectAndDecode(img)
            
            if data:
                return data
            
            # Try with grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            data, vertices, _ = detector.detectAndDecode(gray)
            
            return data if data else None
            
        except Exception as e:
            print(f"QR decode error: {e}")
            return None
    
    def decode_qr_from_pil(self, image: Image.Image) -> Optional[str]:
        """Decode QR code from PIL Image."""
        try:
            import cv2
            import numpy as np
            # Convert PIL to numpy
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            img = np.array(image)
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            
            detector = cv2.QRCodeDetector()
            data, _, _ = detector.detectAndDecode(img)
            
            return data if data else None
            
        except Exception as e:
            print(f"QR decode error: {e}")
            return None
    
    def generate_qr(self, data: str) -> bytes:
        """Generate a QR code PNG from data."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return buffer.getvalue()
    
    def generate_anchor_qr(self, store_id: str, anchor_id: str) -> Optional[bytes]:
        """Generate QR code for a specific anchor."""
        store = get_store_by_id(store_id)
        
        if not store:
            # Try by name
            for name, s in STORE_REGISTRY.items():
                if s.shop_id == store_id or name == store_id:
                    store = s
                    break
        
        if not store:
            return None
        
        # Find anchor
        anchor = None
        for a in store.profile.anchors:
            if a.anchor_id == anchor_id:
                anchor = a
                break
        
        if not anchor:
            return None
        
        # Create payload
        payload = {
            "type": "anchor",
            "shop_id": store.shop_id,
            "anchor_id": anchor.anchor_id,
            "name": anchor.name,
            "x": anchor.x,
            "y": anchor.y,
            "v": 1
        }
        
        payload_json = json.dumps(payload, separators=(',', ':'))
        return self.generate_qr(payload_json)
    
    def parse_anchor_payload(
        self,
        qr_data: str,
        expected_shop_id: Optional[str] = None
    ) -> Tuple[Optional[AnchorPayload], Optional[str]]:
        """
        Parse and validate an anchor QR payload.
        Returns (payload, error_message).
        """
        try:
            payload = json.loads(qr_data)
            
            # Validate type
            if payload.get("type") != "anchor":
                return None, "This QR is not an anchor marker"
            
            # Validate shop_id if specified
            if expected_shop_id and payload.get("shop_id") != expected_shop_id:
                return None, f"This marker belongs to shop {payload.get('shop_id')}. Switch shop?"
            
            # Validate required fields
            required = ["anchor_id", "name", "x", "y"]
            for field in required:
                if field not in payload:
                    return None, f"Missing field: {field}"
            
            return AnchorPayload(**payload), None
            
        except json.JSONDecodeError:
            return None, "Invalid QR data format"
        except Exception as e:
            return None, f"Error parsing QR: {str(e)}"
    
    def is_url(self, data: str) -> bool:
        """Check if QR data is a URL."""
        return data.startswith(('http://', 'https://'))
    
    def is_anchor(self, data: str) -> bool:
        """Check if QR data is an anchor payload."""
        try:
            payload = json.loads(data)
            return payload.get("type") == "anchor"
        except:
            return False


# Singleton instance
qr_service = QRService()
