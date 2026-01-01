/**
 * Jest Test Setup
 *
 * Configures global test environment for quickstart tests.
 */

import { TextEncoder, TextDecoder } from "util";

// Polyfill TextEncoder/TextDecoder for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Polyfill crypto for Node.js environment (required for password utilities)
if (typeof global.crypto === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { webcrypto } = require("crypto");
  global.crypto = webcrypto;
}

// Polyfill btoa/atob for Node.js environment
if (typeof global.btoa === "undefined") {
  global.btoa = (str: string) => Buffer.from(str, "binary").toString("base64");
}

if (typeof global.atob === "undefined") {
  global.atob = (str: string) => Buffer.from(str, "base64").toString("binary");
}

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.CONVEX_URL = "https://test.convex.cloud";

// Suppress console output during tests (optional - comment out for debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

// Increase test timeout for async operations
jest.setTimeout(10000);

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
