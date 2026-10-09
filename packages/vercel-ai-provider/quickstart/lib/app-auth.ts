import "server-only";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { hashPassword, verifyPassword } from "./password";

const COOKIE = "cortex-app-session";
const MAX_AGE = 8 * 60 * 60;
const OPERATIONS = [
  "app/accounts:setup",
  "app/accounts:register",
  "app/accounts:credentialByUsername",
  "app/accounts:identityById",
  "app/sessions:create",
  "app/sessions:resolve",
  "app/sessions:revoke",
  "app/authState:status",
] as const;
type Operation = (typeof OPERATIONS)[number];
export interface AppIdentity {
  accountId: string;
  username: string;
  displayName?: string;
  role: "admin" | "user";
  tenantId: string;
  allowedMemorySpaceIds: string[];
}
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown): Response {
  return error instanceof AppError
    ? Response.json({ error: error.message }, { status: error.status })
    : Response.json(
        {
          error: "Backend unavailable; check private deployment configuration",
        },
        { status: 503 },
      );
}
export function privateConfiguration() {
  const convexUrl = process.env.CONVEX_URL;
  const deploymentKey = process.env.CORTEX_APP_DEPLOYMENT_ADMIN_KEY;
  const origin = process.env.CORTEX_APP_ORIGIN;
  if (!convexUrl || !deploymentKey?.trim() || !origin)
    throw new AppError(
      503,
      "Configure CONVEX_URL, CORTEX_APP_DEPLOYMENT_ADMIN_KEY and CORTEX_APP_ORIGIN on the server",
    );
  let url: URL, app: URL;
  try {
    url = new URL(convexUrl);
    app = new URL(origin);
  } catch {
    throw new AppError(503, "Invalid private application URL configuration");
  }
  const loopback = (host: string) =>
    ["localhost", "127.0.0.1", "[::1]"].includes(host);
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && loopback(url.hostname))) ||
    (app.protocol !== "https:" &&
      !(
        app.protocol === "http:" &&
        loopback(app.hostname) &&
        process.env.NODE_ENV === "development"
      )) ||
    app.origin !== origin ||
    url.username ||
    url.password ||
    app.username ||
    app.password
  )
    throw new AppError(
      503,
      "Use HTTPS, or an owned loopback development origin",
    );
  return {
    convexUrl,
    deploymentKey,
    origin,
    secureCookie: app.protocol === "https:",
  };
}
export function requireSameOrigin(req: Request): void {
  if (req.headers.get("origin") !== privateConfiguration().origin)
    throw new AppError(403, "Same-origin request required");
}
interface AdminCapability {
  setAdminAuth(key: string): void;
  function(
    name: Operation,
    component: undefined,
    args: Record<string, unknown>,
  ): Promise<unknown>;
}
async function callAuth(
  name: Operation,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!OPERATIONS.includes(name))
    throw new AppError(503, "Unsupported private operation");
  const config = privateConfiguration();
  const deadline = AbortSignal.timeout(5000);
  const client = new ConvexHttpClient(config.convexUrl, {
    logger: false,
    fetch: (input, init) => fetch(input, { ...init, signal: deadline }),
  });
  const candidate: unknown = client;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("setAdminAuth" in candidate) ||
    !("function" in candidate) ||
    typeof candidate.setAdminAuth !== "function" ||
    typeof candidate.function !== "function"
  )
    throw new AppError(
      503,
      "Installed Convex client lacks the private server transport",
    );
  // The structural capability stays server-only. It is the pinned native /api/function
  // protocol, never an internal reference cast to a public query/mutation.
  const admin = candidate as AdminCapability;
  let result: unknown;
  try {
    admin.setAdminAuth(config.deploymentKey);
    result = await admin.function(name, undefined, args);
  } catch {
    throw new AppError(
      503,
      "Private backend unavailable or deployment credential refused",
    );
  }
  if (result && typeof result === "object" && "error" in result) {
    const code = result.error;
    if (
      code === "SETUP_COMPLETE" ||
      code === "USERNAME_TAKEN" ||
      code === "ACCOUNT_EXISTS"
    )
      throw new AppError(
        409,
        code === "USERNAME_TAKEN"
          ? "Username already taken"
          : "Setup or account already exists",
      );
    if (code === "SETUP_REQUIRED")
      throw new AppError(409, "Complete private setup first");
    throw new AppError(401, "Account unavailable");
  }
  return result;
}
function identity(value: unknown): AppIdentity | null {
  if (value === null) return null;
  if (
    !value ||
    typeof value !== "object" ||
    !("accountId" in value) ||
    !("username" in value) ||
    !("role" in value) ||
    !("tenantId" in value) ||
    !("allowedMemorySpaceIds" in value) ||
    typeof value.accountId !== "string" ||
    typeof value.username !== "string" ||
    (value.role !== "admin" && value.role !== "user") ||
    typeof value.tenantId !== "string" ||
    !Array.isArray(value.allowedMemorySpaceIds) ||
    !value.allowedMemorySpaceIds.length ||
    !value.allowedMemorySpaceIds.every(
      (space) => typeof space === "string" && space.length > 0,
    )
  )
    throw new AppError(503, "Invalid private identity response");
  return {
    accountId: value.accountId,
    username: value.username,
    role: value.role,
    tenantId: value.tenantId,
    allowedMemorySpaceIds: value.allowedMemorySpaceIds,
    ...("displayName" in value && typeof value.displayName === "string"
      ? { displayName: value.displayName }
      : {}),
  };
}
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
function sessionToken(req: Request): string | null {
  const values = (req.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(COOKIE + "="));
  if (values.length !== 1) return null;
  const value = values[0].slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function resolveSession(
  req: Request,
): Promise<AppIdentity | null> {
  const token = sessionToken(req);
  if (!token) return null;
  return identity(
    await callAuth("app/sessions:resolve", { sessionDigest: digest(token) }),
  );
}
export async function requireSession(req: Request): Promise<AppIdentity> {
  if (req.method !== "GET" && req.method !== "HEAD") requireSameOrigin(req);
  const account = await resolveSession(req);
  if (!account) throw new AppError(401, "Sign in required");
  return account;
}
export function selectSpace(
  account: AppIdentity,
  selectors: { userId?: unknown; tenantId?: unknown; memorySpaceId?: unknown },
): string {
  if (
    (selectors.userId != null && selectors.userId !== account.accountId) ||
    (selectors.tenantId != null && selectors.tenantId !== account.tenantId)
  )
    throw new AppError(403, "Account scope cannot be overridden");
  const space = selectors.memorySpaceId ?? account.allowedMemorySpaceIds[0];
  if (
    typeof space !== "string" ||
    !account.allowedMemorySpaceIds.includes(space)
  )
    throw new AppError(403, "Memory space unavailable");
  return space;
}
export function publicUser(account: AppIdentity) {
  return {
    id: account.accountId,
    displayName: account.displayName || account.username,
    allowedMemorySpaceIds: account.allowedMemorySpaceIds,
  };
}
export async function authStatus(req: Request) {
  const status = await callAuth("app/authState:status", {});
  if (
    !status ||
    typeof status !== "object" ||
    !("isSetup" in status) ||
    typeof status.isSetup !== "boolean"
  )
    throw new AppError(503, "Invalid private setup response");
  const account = await resolveSession(req);
  return {
    isSetup: status.isSetup,
    user: account ? publicUser(account) : null,
  };
}
function credentials(body: unknown): { username: string; password: string } {
  if (
    !body ||
    typeof body !== "object" ||
    !("username" in body) ||
    !("password" in body) ||
    typeof body.username !== "string" ||
    typeof body.password !== "string"
  )
    throw new AppError(400, "Username and password required");
  const username = body.username.trim().toLowerCase();
  if (
    !/^[a-z0-9_-]{2,64}$/.test(username) ||
    body.password.length < 6 ||
    body.password.length > 1024
  )
    throw new AppError(
      400,
      "Use a valid username and a password of 6 to 1024 characters",
    );
  if (
    "role" in body ||
    "tenantId" in body ||
    "accountId" in body ||
    "allowedMemorySpaceIds" in body
  )
    throw new AppError(400, "Account authority cannot be selected");
  return { username, password: body.password };
}
async function issueSession(accountId: string) {
  const token = randomBytes(32).toString("hex");
  await callAuth("app/sessions:create", {
    sessionDigest: digest(token),
    accountId,
  });
  const account = identity(
    await callAuth("app/accounts:identityById", { accountId }),
  );
  if (!account) throw new AppError(401, "Account unavailable");
  const response = Response.json({ success: true, user: publicUser(account) });
  const secure = privateConfiguration().secureCookie ? "; Secure" : "";
  response.headers.set(
    "Set-Cookie",
    `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}${secure}`,
  );
  return response;
}
export async function authenticate(
  req: Request,
  mode: "setup" | "register" | "login",
): Promise<Response> {
  requireSameOrigin(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError(400, "Invalid JSON body");
  }
  const { username, password } = credentials(body);
  const displayName =
    body && typeof body === "object" && "displayName" in body
      ? body.displayName
      : undefined;
  if (
    displayName !== undefined &&
    (typeof displayName !== "string" ||
      !displayName.trim() ||
      displayName.length > 100)
  )
    throw new AppError(400, "Display name must contain 1 to 100 characters");
  if (mode === "setup") {
    const capability = process.env.CORTEX_APP_SETUP_TOKEN;
    if (!capability?.trim())
      throw new AppError(
        503,
        "Configure CORTEX_APP_SETUP_TOKEN privately for first setup",
      );
    const supplied =
      body &&
      typeof body === "object" &&
      "setupToken" in body &&
      typeof body.setupToken === "string"
        ? body.setupToken
        : "";
    if (
      !timingSafeEqual(
        createHash("sha256").update(capability).digest(),
        createHash("sha256").update(supplied).digest(),
      )
    )
      throw new AppError(403, "Setup capability refused");
  }
  if (mode === "login") {
    const account = await callAuth("app/accounts:credentialByUsername", {
      username,
    });
    const validRecord =
      account &&
      typeof account === "object" &&
      "accountId" in account &&
      typeof account.accountId === "string" &&
      "passwordHash" in account &&
      typeof account.passwordHash === "string" &&
      "disabled" in account &&
      typeof account.disabled === "boolean"
        ? {
            accountId: account.accountId,
            passwordHash: account.passwordHash,
            disabled: account.disabled,
          }
        : null;
    const dummy =
      "AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const matches = await verifyPassword(
      password,
      validRecord?.passwordHash || dummy,
    );
    if (!validRecord || !matches || validRecord.disabled)
      throw new AppError(401, "Invalid username or password");
    return issueSession(validRecord.accountId);
  }
  const accountId = randomUUID();
  const passwordHash = await hashPassword(password);
  await callAuth(
    mode === "setup" ? "app/accounts:setup" : "app/accounts:register",
    {
      accountId,
      username,
      passwordHash,
      ...(typeof displayName === "string"
        ? { displayName: displayName.trim() }
        : {}),
      ...(mode === "setup" ? { tenantId: `tenant-${randomUUID()}` } : {}),
    },
  );
  return issueSession(accountId);
}
export async function logout(req: Request): Promise<Response> {
  requireSameOrigin(req);
  const token = sessionToken(req);
  if (token)
    await callAuth("app/sessions:revoke", { sessionDigest: digest(token) });
  const response = Response.json({ success: true });
  response.headers.set(
    "Set-Cookie",
    `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${privateConfiguration().secureCookie ? "; Secure" : ""}`,
  );
  return response;
}
