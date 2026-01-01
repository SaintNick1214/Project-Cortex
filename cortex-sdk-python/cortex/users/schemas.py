"""
Cortex SDK - User Profile Schemas

Provides standard user profile schema with fully extensible fields
and validation presets for different use cases.
"""

import json
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple


@dataclass
class StandardUserProfile:
    """
    Standard user profile interface.

    This dataclass provides commonly-used fields while remaining fully extensible.
    All fields except display_name are optional, and developers can add any
    additional fields they need via the extra dict.

    Example:
        >>> profile = StandardUserProfile(
        ...     display_name='Alice Johnson',
        ...     email='alice@example.com',
        ...     avatar_url='https://example.com/avatars/alice.jpg',
        ...     preferences={
        ...         'theme': 'dark',
        ...         'language': 'en',
        ...         'notifications': {'email': True, 'push': False},
        ...     },
        ...     platform_metadata={
        ...         'tier': 'enterprise',
        ...         'signup_source': 'referral',
        ...     },
        ...     extra={
        ...         'legacy_id': 'old-system-123',
        ...         'feature_flags': ['beta', 'new-ui'],
        ...     },
        ... )
    """
    display_name: str
    """Display name for the user (required)"""

    email: Optional[str] = None
    """Email address"""

    avatar_url: Optional[str] = None
    """Avatar URL"""

    phone: Optional[str] = None
    """Phone number"""

    first_name: Optional[str] = None
    """First name"""

    last_name: Optional[str] = None
    """Last name"""

    bio: Optional[str] = None
    """Bio or description"""

    locale: Optional[str] = None
    """User's locale/language preference"""

    timezone: Optional[str] = None
    """User's timezone"""

    status: Optional[str] = None
    """Account status: 'active', 'inactive', 'suspended', 'pending', or custom"""

    account_type: Optional[str] = None
    """Account type or tier"""

    preferences: Optional[Dict[str, Any]] = None
    """
    User preferences - fully extensible.

    Example:
        preferences = {
            'theme': 'dark',
            'language': 'en',
            'notifications': {'email': True, 'push': False},
            'accessibility': {'reduced_motion': True},
        }
    """

    platform_metadata: Optional[Dict[str, Any]] = None
    """
    Platform-specific metadata - fully extensible.

    Use this for internal data, integration IDs, analytics data, etc.

    Example:
        platform_metadata = {
            'stripe_customer_id': 'cus_xxx',
            'hubspot_contact_id': 'contact_xxx',
            'tier': 'enterprise',
            'signup_source': 'referral',
            'signup_date': '2024-01-15',
        }
    """

    extra: Dict[str, Any] = field(default_factory=dict)
    """Any additional developer-defined fields"""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary (Convex-compatible format)."""
        result: Dict[str, Any] = {
            "displayName": self.display_name,
        }

        if self.email:
            result["email"] = self.email
        if self.avatar_url:
            result["avatarUrl"] = self.avatar_url
        if self.phone:
            result["phone"] = self.phone
        if self.first_name:
            result["firstName"] = self.first_name
        if self.last_name:
            result["lastName"] = self.last_name
        if self.bio:
            result["bio"] = self.bio
        if self.locale:
            result["locale"] = self.locale
        if self.timezone:
            result["timezone"] = self.timezone
        if self.status:
            result["status"] = self.status
        if self.account_type:
            result["accountType"] = self.account_type
        if self.preferences:
            result["preferences"] = self.preferences
        if self.platform_metadata:
            result["platformMetadata"] = self.platform_metadata

        # Merge extra fields
        result.update(self.extra)

        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StandardUserProfile":
        """Create from dictionary (Convex response)."""
        known_keys = {
            "displayName", "email", "avatarUrl", "phone", "firstName",
            "lastName", "bio", "locale", "timezone", "status",
            "accountType", "preferences", "platformMetadata",
        }
        extra = {k: v for k, v in data.items() if k not in known_keys}

        return cls(
            display_name=data.get("displayName", ""),
            email=data.get("email"),
            avatar_url=data.get("avatarUrl"),
            phone=data.get("phone"),
            first_name=data.get("firstName"),
            last_name=data.get("lastName"),
            bio=data.get("bio"),
            locale=data.get("locale"),
            timezone=data.get("timezone"),
            status=data.get("status"),
            account_type=data.get("accountType"),
            preferences=data.get("preferences"),
            platform_metadata=data.get("platformMetadata"),
            extra=extra,
        )


@dataclass
class ValidationPreset:
    """
    Validation preset configuration.

    Defines validation rules for user profile data.
    """
    required_fields: Optional[List[str]] = None
    """Fields that must be present"""

    validate_email: bool = False
    """Validate email format"""

    validate_phone: bool = False
    """Validate phone format"""

    max_data_size: Optional[int] = None
    """Maximum size of profile data in bytes"""

    max_string_length: Optional[int] = None
    """Maximum length for string fields"""

    custom_validator: Optional[Callable[[Dict[str, Any]], Tuple[bool, List[str]]]] = None
    """Custom validation function returning (valid, errors)"""


@dataclass
class ValidationResult:
    """Result of profile validation."""
    valid: bool
    """Whether validation passed"""

    errors: List[str] = field(default_factory=list)
    """List of validation errors"""


# Built-in validation presets
validation_presets: Dict[str, ValidationPreset] = {
    "strict": ValidationPreset(
        required_fields=["displayName", "email"],
        validate_email=True,
        max_data_size=64 * 1024,  # 64KB
        max_string_length=1024,  # 1KB per string field
    ),
    "standard": ValidationPreset(
        required_fields=["displayName"],
        validate_email=True,
        max_data_size=256 * 1024,  # 256KB
    ),
    "minimal": ValidationPreset(
        required_fields=["displayName"],
    ),
    "none": ValidationPreset(),
}


def validate_user_profile(
    data: Dict[str, Any],
    preset: Optional[ValidationPreset] = None,
) -> ValidationResult:
    """
    Validate user profile data against a preset.

    Args:
        data: Profile data to validate
        preset: Validation preset to use (default: minimal)

    Returns:
        ValidationResult with valid flag and list of errors

    Example:
        >>> result = validate_user_profile(
        ...     {'displayName': 'Alice', 'email': 'not-an-email'},
        ...     validation_presets['strict']
        ... )
        >>> if not result.valid:
        ...     print('Validation failed:', result.errors)
    """
    if preset is None:
        preset = validation_presets["minimal"]

    errors: List[str] = []

    # Check required fields
    if preset.required_fields:
        for field_name in preset.required_fields:
            if field_name not in data or data[field_name] is None:
                errors.append(f"Missing required field: {field_name}")
            elif isinstance(data[field_name], str) and len(data[field_name].strip()) == 0:
                errors.append(f"Required field cannot be empty: {field_name}")

    # Validate email format
    if preset.validate_email and "email" in data and data["email"]:
        email = data["email"]
        if isinstance(email, str):
            parts = email.split("@")
            is_valid_email = (
                len(email) <= 254  # RFC 5321 max length
                and "@" in email
                and " " not in email  # No spaces allowed
                and not email.startswith("@")
                and not email.endswith("@")
                and len(parts) == 2
                and len(parts[0]) > 0  # Local part must have content
                and len(parts[1]) > 0  # Domain part must have content
                and "." in parts[1]
                and not parts[1].startswith(".")  # Domain can't start with dot
                and not parts[1].endswith(".")  # Domain can't end with dot
            )
            if not is_valid_email:
                errors.append(f"Invalid email format: {email}")

    # Validate phone format
    if preset.validate_phone and "phone" in data and data["phone"]:
        phone = data["phone"]
        if isinstance(phone, str):
            # Basic phone validation - digits, spaces, dashes, parentheses, plus
            import re
            phone_regex = re.compile(r"^[+\d\s()\-]{7,20}$")
            if not phone_regex.match(phone):
                errors.append(f"Invalid phone format: {phone}")

    # Check data size
    if preset.max_data_size:
        data_size = len(json.dumps(data).encode("utf-8"))
        if data_size > preset.max_data_size:
            errors.append(
                f"Profile data exceeds maximum size: {data_size} bytes > {preset.max_data_size} bytes"
            )

    # Check string field lengths
    if preset.max_string_length:
        for key, value in data.items():
            if isinstance(value, str) and len(value) > preset.max_string_length:
                errors.append(
                    f"Field '{key}' exceeds maximum length: {len(value)} > {preset.max_string_length}"
                )

    # Run custom validator
    if preset.custom_validator:
        custom_valid, custom_errors = preset.custom_validator(data)
        if not custom_valid:
            errors.extend(custom_errors)

    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
    )


def create_user_profile(
    data: Dict[str, Any],
    defaults: Optional[Dict[str, Any]] = None,
) -> StandardUserProfile:
    """
    Create a user profile with defaults applied.

    Args:
        data: Partial profile data
        defaults: Default values to apply

    Returns:
        StandardUserProfile instance

    Raises:
        ValueError: If displayName is not provided

    Example:
        >>> profile = create_user_profile(
        ...     {'displayName': 'Alice'},
        ...     {'status': 'active', 'preferences': {'theme': 'light'}}
        ... )
        >>> # Result: StandardUserProfile with display_name='Alice', status='active'
    """
    merged = {}

    # Apply defaults first
    if defaults:
        merged.update(defaults)

    # Override with provided data
    merged.update(data)

    if "displayName" not in merged or not merged["displayName"]:
        raise ValueError("displayName is required for user profile")

    return StandardUserProfile.from_dict(merged)
