/**
 * Integration Tests: Auth API Routes
 *
 * Tests the authentication API routes with mocked Cortex SDK.
 */

import {
  createMockCortex,
  resetMockStores,
  seedTestData,
  type MockCortex,
} from "../helpers/mock-cortex";
import { hashPassword } from "../../lib/password";

// Mock the Cortex SDK module
let mockCortex: MockCortex;

jest.mock("../../lib/cortex", () => ({
  getCortex: () => mockCortex,
}));

// Import route handlers after mocking
import { GET as checkGet } from "../../app/api/auth/check/route";
import { POST as setupPost } from "../../app/api/auth/setup/route";
import { POST as registerPost } from "../../app/api/auth/register/route";
import { POST as loginPost } from "../../app/api/auth/login/route";

/**
 * Helper to create a mock Request object
 */
function createRequest(
  method: string,
  body?: Record<string, unknown>,
  url: string = "http://localhost:3000"
): Request {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(url, init);
}

/**
 * Helper to parse JSON response
 */
async function parseResponse(response: Response): Promise<{
  status: number;
  data: Record<string, unknown>;
}> {
  const data = await response.json();
  return { status: response.status, data };
}

describe("Auth API Routes", () => {
  beforeEach(() => {
    resetMockStores();
    mockCortex = createMockCortex();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/auth/check
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("GET /api/auth/check", () => {
    it("should return isSetup: false when admin not configured", async () => {
      const response = await checkGet();
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.isSetup).toBe(false);
    });

    it("should return isSetup: true when admin configured", async () => {
      // Seed admin password hash
      seedTestData.mutable(
        "quickstart-config",
        "admin_password_hash",
        "somehash:value"
      );

      const response = await checkGet();
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.isSetup).toBe(true);
    });

    it("should call cortex.mutable.get with correct namespace and key", async () => {
      await checkGet();

      expect(mockCortex.mutable.get).toHaveBeenCalledWith(
        "quickstart-config",
        "admin_password_hash"
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/auth/setup
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("POST /api/auth/setup", () => {
    it("should return 400 if password is missing", async () => {
      const request = createRequest("POST", {});
      const response = await setupPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Password is required");
    });

    it("should return 400 if password is not a string", async () => {
      const request = createRequest("POST", { password: 12345 });
      const response = await setupPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Password is required");
    });

    it("should return 400 if password is less than 4 characters", async () => {
      const request = createRequest("POST", { password: "abc" });
      const response = await setupPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Password must be at least 4 characters");
    });

    it("should return 409 if admin already configured", async () => {
      // Seed existing admin
      seedTestData.mutable(
        "quickstart-config",
        "admin_password_hash",
        "existing:hash"
      );

      const request = createRequest("POST", { password: "newpassword" });
      const response = await setupPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(409);
      expect(data.error).toBe("Admin already configured");
    });

    it("should store hashed password and return success", async () => {
      const request = createRequest("POST", { password: "adminpass123" });
      const response = await setupPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Admin password configured successfully");

      // Verify mutable.set was called with a hashed password
      expect(mockCortex.mutable.set).toHaveBeenCalledWith(
        "quickstart-config",
        "admin_password_hash",
        expect.stringContaining(":") // salt:hash format
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/auth/register
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("POST /api/auth/register", () => {
    it("should return 400 if username is missing", async () => {
      const request = createRequest("POST", { password: "pass1234" });
      const response = await registerPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Username is required");
    });

    it("should return 400 if password is missing", async () => {
      const request = createRequest("POST", { username: "testuser" });
      const response = await registerPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Password is required");
    });

    it("should return 400 if username is less than 2 characters", async () => {
      const request = createRequest("POST", {
        username: "a",
        password: "pass1234",
      });
      const response = await registerPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Username must be at least 2 characters");
    });

    it("should return 400 if password is less than 4 characters", async () => {
      const request = createRequest("POST", {
        username: "testuser",
        password: "abc",
      });
      const response = await registerPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Password must be at least 4 characters");
    });

    it("should return 400 for invalid username characters", async () => {
      const request = createRequest("POST", {
        username: "test user@!",
        password: "pass1234",
      });
      const response = await registerPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toContain("can only contain");
    });

    it("should return 409 if username already exists", async () => {
      // Seed existing user
      seedTestData.user("existinguser", { displayName: "Existing User" });

      const request = createRequest("POST", {
        username: "existinguser",
        password: "pass1234",
      });
      const response = await registerPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(409);
      expect(data.error).toBe("Username already taken");
    });

    it("should create user and return success with sessionToken", async () => {
      const request = createRequest("POST", {
        username: "NewUser",
        password: "pass1234",
        displayName: "New User Display",
      });
      const response = await registerPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toEqual({
        id: "newuser", // lowercase
        displayName: "New User Display",
      });
      expect(data.sessionToken).toBeDefined();
      expect((data.sessionToken as string).length).toBe(64);

      // Verify user was created with hashed password
      expect(mockCortex.users.update).toHaveBeenCalledWith(
        "newuser",
        expect.objectContaining({
          displayName: "New User Display",
          passwordHash: expect.stringContaining(":"),
          createdAt: expect.any(Number),
          lastLoginAt: expect.any(Number),
        })
      );
    });

    it("should normalize username to lowercase", async () => {
      const request = createRequest("POST", {
        username: "TestUser",
        password: "pass1234",
      });
      const response = await registerPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect((data.user as { id: string }).id).toBe("testuser");
    });

    it("should use username as displayName if not provided", async () => {
      const request = createRequest("POST", {
        username: "testuser",
        password: "pass1234",
      });
      const response = await registerPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect((data.user as { displayName: string }).displayName).toBe(
        "testuser"
      );
    });

    it("should allow underscores and hyphens in username", async () => {
      const request = createRequest("POST", {
        username: "test_user-123",
        password: "pass1234",
      });
      const response = await registerPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect((data.user as { id: string }).id).toBe("test_user-123");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/auth/login
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("POST /api/auth/login", () => {
    it("should return 400 if username is missing", async () => {
      const request = createRequest("POST", { password: "pass1234" });
      const response = await loginPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Username is required");
    });

    it("should return 400 if password is missing", async () => {
      const request = createRequest("POST", { username: "testuser" });
      const response = await loginPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Password is required");
    });

    it("should return 401 for non-existent user", async () => {
      const request = createRequest("POST", {
        username: "nonexistent",
        password: "pass1234",
      });
      const response = await loginPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Invalid username or password");
    });

    it("should return 401 for wrong password", async () => {
      // Seed user with known password hash
      const passwordHash = await hashPassword("correctpassword");
      seedTestData.user("testuser", {
        displayName: "Test User",
        passwordHash,
      });

      const request = createRequest("POST", {
        username: "testuser",
        password: "wrongpassword",
      });
      const response = await loginPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Invalid username or password");
    });

    it("should return 401 if user has no password hash", async () => {
      // Seed user without password hash
      seedTestData.user("testuser", { displayName: "Test User" });

      const request = createRequest("POST", {
        username: "testuser",
        password: "anypassword",
      });
      const response = await loginPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Invalid username or password");
    });

    it("should return success with user data and sessionToken for valid credentials", async () => {
      // Seed user with known password
      const passwordHash = await hashPassword("correctpassword");
      seedTestData.user("testuser", {
        displayName: "Test User Display",
        passwordHash,
      });

      const request = createRequest("POST", {
        username: "testuser",
        password: "correctpassword",
      });
      const response = await loginPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toEqual({
        id: "testuser",
        displayName: "Test User Display",
      });
      expect(data.sessionToken).toBeDefined();
      expect((data.sessionToken as string).length).toBe(64);
    });

    it("should update lastLoginAt on successful login", async () => {
      const passwordHash = await hashPassword("correctpassword");
      seedTestData.user("testuser", {
        displayName: "Test User",
        passwordHash,
      });

      const request = createRequest("POST", {
        username: "testuser",
        password: "correctpassword",
      });
      await loginPost(request);

      expect(mockCortex.users.update).toHaveBeenCalledWith("testuser", {
        lastLoginAt: expect.any(Number),
      });
    });

    it("should normalize username to lowercase for lookup", async () => {
      const passwordHash = await hashPassword("correctpassword");
      seedTestData.user("testuser", {
        displayName: "Test User",
        passwordHash,
      });

      const request = createRequest("POST", {
        username: "TestUser",
        password: "correctpassword",
      });
      const response = await loginPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should use username as displayName if displayName not set", async () => {
      const passwordHash = await hashPassword("correctpassword");
      seedTestData.user("testuser", { passwordHash }); // No displayName

      const request = createRequest("POST", {
        username: "testuser",
        password: "correctpassword",
      });
      const response = await loginPost(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect((data.user as { displayName: string }).displayName).toBe(
        "testuser"
      );
    });
  });
});
