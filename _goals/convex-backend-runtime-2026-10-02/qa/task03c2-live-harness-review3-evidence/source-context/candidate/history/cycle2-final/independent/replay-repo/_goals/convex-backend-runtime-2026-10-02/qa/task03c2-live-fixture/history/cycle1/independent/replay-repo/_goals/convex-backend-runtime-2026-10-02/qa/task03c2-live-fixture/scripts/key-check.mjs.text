import { randomUUID } from "node:crypto";
import { localPreflight, verifiedSigningKey, writeEvidence } from "./guard.mjs";
localPreflight();
verifiedSigningKey();
writeEvidence(`key-match-${randomUUID()}.json`, { matched: true, privateFileOwned0600Unlinked: true, existingKeyOnly: true, newKeys: 0, signedTokens: 0, networkCalls: 0 }, false);
process.stdout.write(JSON.stringify({ publicJwksMatchesTrustedPrivateKey: true, newKeys: 0, signedTokens: 0 }) + "\n");
