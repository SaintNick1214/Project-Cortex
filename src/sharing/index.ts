/**
 * Cortex SDK - Sharing Utilities
 *
 * Framework-agnostic utilities for working with shareable conversation links.
 */

/**
 * URL style for share links
 * - 'path': /shared/{id} (default)
 * - 'query': /shared?id={id}
 */
export type ShareUrlStyle = "path" | "query";

/**
 * Configuration for building share URLs
 */
export interface ShareUrlConfig {
  /** Base URL for share links (e.g., 'https://app.example.com/shared') */
  baseUrl: string;
  /** URL style: 'path' → /shared/{id}, 'query' → /shared?id={id} */
  style?: ShareUrlStyle;
  /** Query param name when style='query' (default: 'id') */
  paramName?: string;
}

/**
 * Build a shareable URL from a share ID
 *
 * This is a pure utility function that doesn't make any API calls.
 * Use it to construct URLs for sharing conversations in your application.
 *
 * @example
 * ```typescript
 * import { buildShareUrl } from '@cortex/sdk';
 *
 * // Path style (default): https://myapp.com/shared/share-abc123
 * const url1 = buildShareUrl('share-abc123', {
 *   baseUrl: 'https://myapp.com/shared'
 * });
 *
 * // Query style: https://myapp.com/shared?id=share-abc123
 * const url2 = buildShareUrl('share-abc123', {
 *   baseUrl: 'https://myapp.com/shared',
 *   style: 'query',
 * });
 *
 * // Custom param name: https://myapp.com/view?share=share-abc123
 * const url3 = buildShareUrl('share-abc123', {
 *   baseUrl: 'https://myapp.com/view',
 *   style: 'query',
 *   paramName: 'share',
 * });
 * ```
 */
export function buildShareUrl(shareId: string, config: ShareUrlConfig): string {
  const style = config.style || "path";

  if (style === "path") {
    // Ensure no trailing slash, then append shareId
    const base = config.baseUrl.replace(/\/$/, "");
    return `${base}/${encodeURIComponent(shareId)}`;
  } else {
    // Query style
    const paramName = config.paramName || "id";
    const separator = config.baseUrl.includes("?") ? "&" : "?";
    return `${config.baseUrl}${separator}${paramName}=${encodeURIComponent(shareId)}`;
  }
}

/**
 * Extract a share ID from a URL
 *
 * Reverse of buildShareUrl - extracts the share ID from a URL.
 *
 * @example
 * ```typescript
 * import { extractShareId } from '@cortex/sdk';
 *
 * // From path style
 * extractShareId('https://myapp.com/shared/share-abc123', { style: 'path' });
 * // => 'share-abc123'
 *
 * // From query style
 * extractShareId('https://myapp.com/shared?id=share-abc123', { style: 'query' });
 * // => 'share-abc123'
 * ```
 */
export function extractShareId(
  url: string,
  config: { style?: ShareUrlStyle; paramName?: string } = {},
): string | null {
  const style = config.style || "path";

  try {
    const urlObj = new URL(url);

    if (style === "path") {
      // Get the last path segment
      const segments = urlObj.pathname.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      return lastSegment ? decodeURIComponent(lastSegment) : null;
    } else {
      // Query style
      const paramName = config.paramName || "id";
      const value = urlObj.searchParams.get(paramName);
      return value ? decodeURIComponent(value) : null;
    }
  } catch {
    return null;
  }
}
