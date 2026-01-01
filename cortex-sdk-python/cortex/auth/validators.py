"""
Cortex SDK - Auth Validators

Validation logic for authentication context.
"""

from typing import Any, Dict, Optional


class AuthValidationError(Exception):
    """
    Validation error for auth context.

    Attributes:
        message: Error message
        code: Error code for programmatic handling
        field: Optional field name that failed validation
    """

    def __init__(
        self,
        message: str,
        code: str,
        field: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.field = field

    def __repr__(self) -> str:
        return f"AuthValidationError(message={self.message!r}, code={self.code!r}, field={self.field!r})"


def validate_user_id(user_id: Any) -> None:
    """
    Validate user ID.

    Args:
        user_id: User ID to validate

    Raises:
        AuthValidationError: If user_id is invalid
    """
    if user_id is None:
        raise AuthValidationError(
            "userId is required",
            "MISSING_USER_ID",
            "userId",
        )

    if not isinstance(user_id, str):
        raise AuthValidationError(
            f"userId must be a string, got {type(user_id).__name__}",
            "INVALID_USER_ID_TYPE",
            "userId",
        )

    if len(user_id.strip()) == 0:
        raise AuthValidationError(
            "userId cannot be empty",
            "EMPTY_USER_ID",
            "userId",
        )

    # Check for reasonable length
    if len(user_id) > 256:
        raise AuthValidationError(
            f"userId too long: {len(user_id)} > 256 characters",
            "USER_ID_TOO_LONG",
            "userId",
        )


def validate_tenant_id(tenant_id: Any) -> None:
    """
    Validate tenant ID (optional field).

    Args:
        tenant_id: Tenant ID to validate

    Raises:
        AuthValidationError: If tenant_id is invalid
    """
    if tenant_id is None:
        return  # Optional field

    if not isinstance(tenant_id, str):
        raise AuthValidationError(
            f"tenantId must be a string, got {type(tenant_id).__name__}",
            "INVALID_TENANT_ID_TYPE",
            "tenantId",
        )

    if len(tenant_id.strip()) == 0:
        raise AuthValidationError(
            "tenantId cannot be empty string (use None instead)",
            "EMPTY_TENANT_ID",
            "tenantId",
        )

    if len(tenant_id) > 256:
        raise AuthValidationError(
            f"tenantId too long: {len(tenant_id)} > 256 characters",
            "TENANT_ID_TOO_LONG",
            "tenantId",
        )


def validate_organization_id(organization_id: Any) -> None:
    """
    Validate organization ID (optional field).

    Args:
        organization_id: Organization ID to validate

    Raises:
        AuthValidationError: If organization_id is invalid
    """
    if organization_id is None:
        return  # Optional field

    if not isinstance(organization_id, str):
        raise AuthValidationError(
            f"organizationId must be a string, got {type(organization_id).__name__}",
            "INVALID_ORG_ID_TYPE",
            "organizationId",
        )

    if len(organization_id.strip()) == 0:
        raise AuthValidationError(
            "organizationId cannot be empty string (use None instead)",
            "EMPTY_ORG_ID",
            "organizationId",
        )

    if len(organization_id) > 256:
        raise AuthValidationError(
            f"organizationId too long: {len(organization_id)} > 256 characters",
            "ORG_ID_TOO_LONG",
            "organizationId",
        )


def validate_session_id(session_id: Any) -> None:
    """
    Validate session ID (optional field).

    Args:
        session_id: Session ID to validate

    Raises:
        AuthValidationError: If session_id is invalid
    """
    if session_id is None:
        return  # Optional field

    if not isinstance(session_id, str):
        raise AuthValidationError(
            f"sessionId must be a string, got {type(session_id).__name__}",
            "INVALID_SESSION_ID_TYPE",
            "sessionId",
        )

    if len(session_id.strip()) == 0:
        raise AuthValidationError(
            "sessionId cannot be empty string (use None instead)",
            "EMPTY_SESSION_ID",
            "sessionId",
        )

    if len(session_id) > 256:
        raise AuthValidationError(
            f"sessionId too long: {len(session_id)} > 256 characters",
            "SESSION_ID_TOO_LONG",
            "sessionId",
        )


def validate_auth_provider(auth_provider: Any) -> None:
    """
    Validate auth provider name (optional field).

    Args:
        auth_provider: Auth provider name to validate (e.g., 'auth0', 'firebase')

    Raises:
        AuthValidationError: If auth_provider is invalid
    """
    if auth_provider is None:
        return  # Optional field

    if not isinstance(auth_provider, str):
        raise AuthValidationError(
            f"authProvider must be a string, got {type(auth_provider).__name__}",
            "INVALID_AUTH_PROVIDER_TYPE",
            "authProvider",
        )

    if len(auth_provider.strip()) == 0:
        raise AuthValidationError(
            "authProvider cannot be empty string (use None instead)",
            "EMPTY_AUTH_PROVIDER",
            "authProvider",
        )

    if len(auth_provider) > 256:
        raise AuthValidationError(
            f"authProvider too long: {len(auth_provider)} > 256 characters",
            "AUTH_PROVIDER_TOO_LONG",
            "authProvider",
        )


def validate_auth_method(auth_method: Any) -> None:
    """
    Validate auth method (optional field).

    Args:
        auth_method: Auth method to validate

    Raises:
        AuthValidationError: If auth_method is invalid
    """
    if auth_method is None:
        return  # Optional field

    valid_methods = {"oauth", "api_key", "jwt", "session", "custom"}

    if not isinstance(auth_method, str):
        raise AuthValidationError(
            f"authMethod must be a string, got {type(auth_method).__name__}",
            "INVALID_AUTH_METHOD_TYPE",
            "authMethod",
        )

    if auth_method not in valid_methods:
        raise AuthValidationError(
            f"Invalid authMethod: {auth_method}. Must be one of: {', '.join(sorted(valid_methods))}",
            "INVALID_AUTH_METHOD",
            "authMethod",
        )


def validate_timestamp(timestamp: Any, field_name: str) -> None:
    """
    Validate a timestamp field.

    Args:
        timestamp: Timestamp to validate
        field_name: Field name for error messages

    Raises:
        AuthValidationError: If timestamp is invalid
    """
    if timestamp is None:
        return  # Optional field

    if not isinstance(timestamp, (int, float)):
        raise AuthValidationError(
            f"{field_name} must be a number, got {type(timestamp).__name__}",
            "INVALID_TIMESTAMP_TYPE",
            field_name,
        )

    if timestamp < 0:
        raise AuthValidationError(
            f"{field_name} cannot be negative",
            "NEGATIVE_TIMESTAMP",
            field_name,
        )


def validate_claims(claims: Any) -> None:
    """
    Validate claims object (optional field).

    Args:
        claims: Claims object to validate

    Raises:
        AuthValidationError: If claims is invalid
    """
    if claims is None:
        return  # Optional field

    if not isinstance(claims, dict):
        raise AuthValidationError(
            f"claims must be a dict, got {type(claims).__name__}",
            "INVALID_CLAIMS_TYPE",
            "claims",
        )


def validate_metadata(metadata: Any) -> None:
    """
    Validate metadata object (optional field).

    Args:
        metadata: Metadata object to validate

    Raises:
        AuthValidationError: If metadata is invalid
    """
    if metadata is None:
        return  # Optional field

    if not isinstance(metadata, dict):
        raise AuthValidationError(
            f"metadata must be a dict, got {type(metadata).__name__}",
            "INVALID_METADATA_TYPE",
            "metadata",
        )


def validate_auth_context_params(params: Dict[str, Any]) -> None:
    """
    Validate all auth context parameters.

    Args:
        params: Dictionary of auth context parameters

    Raises:
        AuthValidationError: If any parameter is invalid
    """
    validate_user_id(params.get("user_id"))
    validate_tenant_id(params.get("tenant_id"))
    validate_organization_id(params.get("organization_id"))
    validate_session_id(params.get("session_id"))
    validate_auth_provider(params.get("auth_provider"))
    validate_auth_method(params.get("auth_method"))
    validate_timestamp(params.get("authenticated_at"), "authenticatedAt")
    validate_claims(params.get("claims"))
    validate_metadata(params.get("metadata"))
