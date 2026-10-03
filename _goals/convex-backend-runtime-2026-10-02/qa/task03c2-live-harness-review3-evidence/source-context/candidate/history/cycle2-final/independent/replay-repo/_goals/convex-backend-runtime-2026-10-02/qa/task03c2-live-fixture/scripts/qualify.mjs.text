import { qualification } from "./driver.mjs";
const receipt = await qualification();
process.stdout.write(JSON.stringify({ status: receipt.status, discovered: receipt.discovered, passed: receipt.passed }) + "\n");
process.exitCode = receipt.status === "PASS" ? 0 : 1;
