"""
Utility functions and helpers.
"""

import os
import re
from typing import Optional, Any


def sanitize_filename(filename: str) -> str:
    """Sanitize a filename for safe file system use."""
    # Remove or replace invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Remove leading/trailing dots and spaces
    filename = filename.strip('. ')
    # Limit length
    if len(filename) > 200:
        filename = filename[:200]
    return filename or 'unnamed'


def ensure_dir(path: str) -> str:
    """Ensure a directory exists, creating it if necessary."""
    os.makedirs(path, exist_ok=True)
    return path


def parse_price(value: Any) -> float:
    """Parse a price value from various formats."""
    if value is None:
        return 0.0
    
    if isinstance(value, (int, float)):
        return float(value)
    
    try:
        # Remove currency symbols and commas
        clean = str(value).replace('₹', '').replace('$', '').replace(',', '').strip()
        return float(clean)
    except (ValueError, TypeError):
        return 0.0


def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """Truncate text to a maximum length."""
    if len(text) <= max_length:
        return text
    return text[:max_length - len(suffix)] + suffix


def format_price(price: float, currency: str = "₹") -> str:
    """Format a price value for display."""
    return f"{currency}{price:.2f}"


def get_file_extension(filename: str) -> str:
    """Get the file extension (lowercase, without dot)."""
    if '.' not in filename:
        return ''
    return filename.rsplit('.', 1)[-1].lower()


def is_valid_email(email: str) -> bool:
    """Basic email validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def calculate_path_distance(path: list) -> float:
    """Calculate total distance of a path."""
    if not path or len(path) < 2:
        return 0.0
    
    total = 0.0
    for i in range(len(path) - 1):
        dx = path[i + 1].get('x', 0) - path[i].get('x', 0)
        dy = path[i + 1].get('y', 0) - path[i].get('y', 0)
        total += (dx ** 2 + dy ** 2) ** 0.5
    
    return total
