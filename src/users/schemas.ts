/**
 * Cortex SDK - User Profile Schemas
 *
 * Provides standard user profile schema with fully extensible fields
 * and validation presets for different use cases.
 */

/**
 * Standard user profile interface.
 *
 * This interface provides commonly-used fields while remaining fully extensible.
 * All fields except displayName are optional, and developers can add any
 * additional fields they need.
 *
 * @example
 * ```typescript
 * const profile: StandardUserProfile = {
 *   displayName: 'Alice Johnson',
 *   email: 'alice@example.com',
 *   avatarUrl: 'https://example.com/avatars/alice.jpg',
 *
 *   // Extensible preferences - any shape
 *   preferences: {
 *     theme: 'dark',
 *     language: 'en',
 *     notifications: { email: true, push: false },
 *     customSetting: { nested: 'value' },
 *   },
 *
 *   // Extensible platform metadata - any shape
 *   platformMetadata: {
 *     tier: 'enterprise',
 *     signupSource: 'referral',
 *     internalNotes: ['VIP customer'],
 *   },
 *
 *   // Additional developer-defined fields
 *   legacyId: 'old-system-123',
 *   featureFlags: ['beta', 'new-ui'],
 * };
 * ```
 */
export interface StandardUserProfile {
  /** Display name for the user (required) */
  displayName: string;

  /** Email address */
  email?: string;

  /** Avatar URL */
  avatarUrl?: string;

  /** Phone number */
  phone?: string;

  /** First name */
  firstName?: string;

  /** Last name */
  lastName?: string;

  /** Bio or description */
  bio?: string;

  /** User's locale/language preference */
  locale?: string;

  /** User's timezone */
  timezone?: string;

  /** Account status */
  status?: "active" | "inactive" | "suspended" | "pending" | string;

  /** Account type or tier */
  accountType?: string;

  /**
   * User preferences - fully extensible.
   *
   * @example
   * ```typescript
   * preferences: {
   *   theme: 'dark',
   *   language: 'en',
   *   notifications: { email: true, push: false },
   *   accessibility: { reducedMotion: true },
   * }
   * ```
   */
  preferences?: Record<string, unknown>;

  /**
   * Platform-specific metadata - fully extensible.
   *
   * Use this for internal data, integration IDs, analytics data, etc.
   *
   * @example
   * ```typescript
   * platformMetadata: {
   *   stripeCustomerId: 'cus_xxx',
   *   hubspotContactId: 'contact_xxx',
   *   tier: 'enterprise',
   *   signupSource: 'referral',
   *   signupDate: '2024-01-15',
   * }
   * ```
   */
  platformMetadata?: Record<string, unknown>;

  /**
   * Any additional developer-defined fields.
   *
   * The interface is fully extensible - add any fields your application needs.
   */
  [key: string]: unknown;
}

/**
 * Validation preset configuration
 */
export interface ValidationPreset {
  /** Fields that must be present */
  requiredFields?: string[];

  /** Validate email format */
  validateEmail?: boolean;

  /** Validate phone format */
  validatePhone?: boolean;

  /** Maximum size of profile data in bytes */
  maxDataSize?: number;

  /** Maximum length for string fields */
  maxStringLength?: number;

  /** Custom validation function */
  customValidator?: (data: Record<string, unknown>) => {
    valid: boolean;
    errors: string[];
  };
}

/**
 * Built-in validation presets for common use cases.
 *
 * @example
 * ```typescript
 * // Use strict validation for enterprise apps
 * const cortex = new Cortex({
 *   convexUrl: process.env.CONVEX_URL!,
 *   users: {
 *     validation: validationPresets.strict,
 *   },
 * });
 *
 * // Use minimal validation for quick prototyping
 * const cortex = new Cortex({
 *   convexUrl: process.env.CONVEX_URL!,
 *   users: {
 *     validation: validationPresets.minimal,
 *   },
 * });
 *
 * // No validation for maximum flexibility
 * const cortex = new Cortex({
 *   convexUrl: process.env.CONVEX_URL!,
 *   users: {
 *     validation: validationPresets.none,
 *   },
 * });
 * ```
 */
export const validationPresets: Record<string, ValidationPreset> = {
  /**
   * Strict validation for production/enterprise apps.
   *
   * Requires displayName and email, validates email format,
   * enforces reasonable size limits.
   */
  strict: {
    requiredFields: ["displayName", "email"],
    validateEmail: true,
    maxDataSize: 64 * 1024, // 64KB
    maxStringLength: 1024, // 1KB per string field
  },

  /**
   * Standard validation for most applications.
   *
   * Requires displayName, validates email if present.
   */
  standard: {
    requiredFields: ["displayName"],
    validateEmail: true,
    maxDataSize: 256 * 1024, // 256KB
  },

  /**
   * Minimal validation for prototyping.
   *
   * Only requires displayName.
   */
  minimal: {
    requiredFields: ["displayName"],
  },

  /**
   * No validation - fully flexible.
   *
   * Use with caution - no constraints on profile data.
   */
  none: {},
};

/**
 * Validate user profile data against a preset.
 *
 * @param data - Profile data to validate
 * @param preset - Validation preset to use
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateUserProfile(
 *   { displayName: 'Alice', email: 'not-an-email' },
 *   validationPresets.strict
 * );
 *
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export function validateUserProfile(
  data: Record<string, unknown>,
  preset: ValidationPreset = validationPresets.minimal,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (preset.requiredFields) {
    for (const field of preset.requiredFields) {
      if (
        !(field in data) ||
        data[field] === null ||
        data[field] === undefined
      ) {
        errors.push(`Missing required field: ${field}`);
      } else if (
        typeof data[field] === "string" &&
        (data[field] as string).trim() === ""
      ) {
        errors.push(`Required field cannot be empty: ${field}`);
      }
    }
  }

  // Validate email format
  if (preset.validateEmail && "email" in data && data.email) {
    const email = data.email as string;
    // Use a simple, non-backtracking email validation to prevent ReDoS
    // This validates: local@domain.tld format without catastrophic backtracking
    const isValidEmail =
      email.length <= 254 && // RFC 5321 max length
      email.includes("@") &&
      !email.startsWith("@") &&
      !email.endsWith("@") &&
      email.split("@").length === 2 &&
      email.split("@")[1]!.includes(".");
    if (!isValidEmail) {
      errors.push(`Invalid email format: ${email}`);
    }
  }

  // Validate phone format (basic)
  if (preset.validatePhone && "phone" in data && data.phone) {
    const phone = data.phone as string;
    // Basic phone validation - digits, spaces, dashes, parentheses, plus
    const phoneRegex = /^[+\d\s()-]{7,20}$/;
    if (!phoneRegex.test(phone)) {
      errors.push(`Invalid phone format: ${phone}`);
    }
  }

  // Check data size
  if (preset.maxDataSize) {
    const dataSize = new TextEncoder().encode(JSON.stringify(data)).length;
    if (dataSize > preset.maxDataSize) {
      errors.push(
        `Profile data exceeds maximum size: ${dataSize} bytes > ${preset.maxDataSize} bytes`,
      );
    }
  }

  // Check string field lengths
  if (preset.maxStringLength) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && value.length > preset.maxStringLength) {
        errors.push(
          `Field '${key}' exceeds maximum length: ${value.length} > ${preset.maxStringLength}`,
        );
      }
    }
  }

  // Run custom validator
  if (preset.customValidator) {
    const customResult = preset.customValidator(data);
    if (!customResult.valid) {
      errors.push(...customResult.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a user profile with defaults applied.
 *
 * @param data - Partial profile data
 * @param defaults - Default values to apply
 * @returns Complete profile with defaults
 *
 * @example
 * ```typescript
 * const profile = createUserProfile(
 *   { displayName: 'Alice' },
 *   { status: 'active', preferences: { theme: 'light' } }
 * );
 * // Result: { displayName: 'Alice', status: 'active', preferences: { theme: 'light' } }
 * ```
 */
export function createUserProfile(
  data: Partial<StandardUserProfile>,
  defaults?: Partial<StandardUserProfile>,
): StandardUserProfile {
  const merged = { ...defaults, ...data };

  if (!merged.displayName) {
    throw new Error("displayName is required for user profile");
  }

  return merged as StandardUserProfile;
}
