"""
Cortex SDK - Sharing Utilities

Framework-agnostic utilities for working with shareable conversation links.
"""

from typing import Literal, Optional
from urllib.parse import parse_qs, quote, urlparse

ShareUrlStyle = Literal["path", "query"]


def build_share_url(
    share_id: str,
    *,
    base_url: str,
    style: ShareUrlStyle = "path",
    param_name: str = "id",
) -> str:
    """
    Build a shareable URL from a share ID.

    This is a pure utility function that doesn't make any API calls.
    Use it to construct URLs for sharing conversations in your application.

    Args:
        share_id: The share ID to include in the URL
        base_url: Base URL for share links (e.g., 'https://app.example.com/shared')
        style: URL style - 'path' for /shared/{id}, 'query' for /shared?id={id}
        param_name: Query param name when style='query' (default: 'id')

    Returns:
        The constructed share URL

    Examples:
        >>> # Path style (default): https://myapp.com/shared/share-abc123
        >>> build_share_url('share-abc123', base_url='https://myapp.com/shared')
        'https://myapp.com/shared/share-abc123'

        >>> # Query style: https://myapp.com/shared?id=share-abc123
        >>> build_share_url('share-abc123', base_url='https://myapp.com/shared', style='query')
        'https://myapp.com/shared?id=share-abc123'

        >>> # Custom param name: https://myapp.com/view?share=share-abc123
        >>> build_share_url('share-abc123', base_url='https://myapp.com/view', style='query', param_name='share')
        'https://myapp.com/view?share=share-abc123'
    """
    if style == "path":
        # Ensure no trailing slash, then append share_id
        base = base_url.rstrip("/")
        return f"{base}/{quote(share_id, safe='')}"
    else:
        # Query style
        separator = "&" if "?" in base_url else "?"
        return f"{base_url}{separator}{param_name}={quote(share_id, safe='')}"


def extract_share_id(
    url: str,
    *,
    style: ShareUrlStyle = "path",
    param_name: str = "id",
) -> Optional[str]:
    """
    Extract a share ID from a URL.

    Reverse of build_share_url - extracts the share ID from a URL.

    Args:
        url: The URL to extract the share ID from
        style: URL style - 'path' for /shared/{id}, 'query' for /shared?id={id}
        param_name: Query param name when style='query' (default: 'id')

    Returns:
        The extracted share ID, or None if not found

    Examples:
        >>> # From path style
        >>> extract_share_id('https://myapp.com/shared/share-abc123', style='path')
        'share-abc123'

        >>> # From query style
        >>> extract_share_id('https://myapp.com/shared?id=share-abc123', style='query')
        'share-abc123'
    """
    try:
        parsed = urlparse(url)
        
        # Check if it's a valid URL (has scheme and netloc)
        if not parsed.scheme or not parsed.netloc:
            return None

        if style == "path":
            # Get the last path segment
            segments = [s for s in parsed.path.split("/") if s]
            if segments:
                return segments[-1]
            return None
        else:
            # Query style
            params = parse_qs(parsed.query)
            values = params.get(param_name)
            if values:
                return values[0]
            return None
    except Exception:
        return None


__all__ = [
    "ShareUrlStyle",
    "build_share_url",
    "extract_share_id",
]
