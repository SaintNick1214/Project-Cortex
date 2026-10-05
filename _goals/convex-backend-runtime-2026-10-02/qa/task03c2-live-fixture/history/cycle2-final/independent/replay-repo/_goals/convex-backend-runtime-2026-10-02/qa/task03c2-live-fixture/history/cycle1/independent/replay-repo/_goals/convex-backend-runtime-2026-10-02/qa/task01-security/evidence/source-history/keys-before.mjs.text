import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const privateDir = resolve(process.env.QUALIFICATION_PRIVATE_DIR ?? "../../../../../work/backend-runtime/qualification");
mkdirSync(privateDir, { recursive: true, mode: 0o700 });
const privatePath = resolve(privateDir, "jwt-private.pem");
if (existsSync(privatePath)) throw new Error("Private key exists; preserve it and its matching public JWKS.");
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "task01-rs256-v1", alg: "RS256", use: "sig" };
const uri = "data:text/plain;charset=utf-8;base64," + Buffer.from(JSON.stringify({ keys: [jwk] })).toString("base64");
writeFileSync("convex/auth.config.ts", `import type { AuthConfig } from "convex/server";\nexport default { providers: [{ type: "customJwt", applicationID: "cortex-task01", issuer: "https://cortex-qualification.invalid", jwks: ${JSON.stringify(uri)}, algorithm: "RS256" }] } satisfies AuthConfig;\n`);
console.log("RS256 private key stored in private scratch; public data-URI JWKS auth config written.");
