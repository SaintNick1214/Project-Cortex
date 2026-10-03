"""
Cortex SDK - Auth Context System

Provides framework-agnostic authentication context management.
Developers bring their own auth provider; Cortex provides clean interfaces.
"""

# Re-export types from main types module
from ..types import AuthContext, AuthContextParams, AuthMethod
from .context import create_auth_context, validate_auth_context
from .validators import AuthValidationError

__all__ = [
    # Functions
    "create_auth_context",
    "validate_auth_context",
    # Types
    "AuthContext",
    "AuthContextParams",
    "AuthMethod",
    # Errors
    "AuthValidationError",
]
