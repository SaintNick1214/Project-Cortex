"""
Cortex SDK - Auth Context Creation

Factory functions for creating and validating auth contexts.
"""

from typing import Any, Dict, Optional

from ..types import AuthContext, AuthMethod
from .validators import (
    AuthValidationError,
    validate_auth_context_params,
)


def create_auth_context(
    user_id: str,
    tenant_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    session_id: Optional[str] = None,
    auth_provider: Optional[str] = None,
    auth_method: Optional[AuthMethod] = None,
    authenticated_at: Optional[int] = None,
    claims: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> AuthContext:
    """
    Create a validated auth context.

    This is the recommended way to create an AuthContext for the Cortex SDK.
    All parameters are validated before the context is created.

    Args:
        user_id: Unique user identifier (required)
        tenant_id: Tenant identifier for multi-tenant applications
        organization_id: Organization identifier within a tenant
        session_id: Current session identifier
        auth_provider: Authentication provider name (e.g., 'auth0', 'firebase')
        auth_method: Authentication method used
        authenticated_at: Timestamp when authentication occurred (ms since epoch)
        claims: Raw JWT/provider claims
        metadata: Arbitrary developer-defined metadata

    Returns:
        Validated AuthContext instance

    Raises:
        AuthValidationError: If any parameter is invalid

    Example:
        >>> from cortex.auth import create_auth_context
        >>>
        >>> # Basic usage
        >>> auth = create_auth_context(user_id='user-123')
        >>>
        >>> # Multi-tenant usage
        >>> auth = create_auth_context(
        ...     user_id='user-123',
        ...     tenant_id='tenant-acme',
        ...     organization_id='org-engineering',
        ... )
        >>>
        >>> # With auth provider metadata
        >>> auth = create_auth_context(
        ...     user_id='user-123',
        ...     tenant_id='tenant-acme',
        ...     auth_provider='auth0',
        ...     auth_method='oauth',
        ...     claims={'roles': ['admin', 'editor']},
        ... )
    """
    # Validate all parameters
    params = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "organization_id": organization_id,
        "session_id": session_id,
        "auth_provider": auth_provider,
        "auth_method": auth_method,
        "authenticated_at": authenticated_at,
        "claims": claims,
        "metadata": metadata,
    }
    validate_auth_context_params(params)

    # Create and return the context
    return AuthContext(
        user_id=user_id,
        tenant_id=tenant_id,
        organization_id=organization_id,
        session_id=session_id,
        auth_provider=auth_provider,
        auth_method=auth_method,
        authenticated_at=authenticated_at,
        claims=claims,
        metadata=metadata,
    )


def validate_auth_context(context: AuthContext) -> bool:
    """
    Validate an existing auth context.

    Use this to validate an AuthContext that was created directly
    (not through create_auth_context).

    Args:
        context: AuthContext to validate

    Returns:
        True if valid

    Raises:
        AuthValidationError: If the context is invalid

    Example:
        >>> from cortex.auth import validate_auth_context
        >>> from cortex.types import AuthContext
        >>>
        >>> context = AuthContext(user_id='user-123', tenant_id='tenant-456')
        >>> validate_auth_context(context)  # Returns True
        >>>
        >>> bad_context = AuthContext(user_id='')  # Empty user_id
        >>> validate_auth_context(bad_context)  # Raises AuthValidationError
    """
    if not isinstance(context, AuthContext):
        raise AuthValidationError(
            f"Expected AuthContext, got {type(context).__name__}",
            "INVALID_CONTEXT_TYPE",
        )

    # Validate all fields
    params = {
        "user_id": context.user_id,
        "tenant_id": context.tenant_id,
        "organization_id": context.organization_id,
        "session_id": context.session_id,
        "auth_provider": context.auth_provider,
        "auth_method": context.auth_method,
        "authenticated_at": context.authenticated_at,
        "claims": context.claims,
        "metadata": context.metadata,
    }
    validate_auth_context_params(params)

    return True
