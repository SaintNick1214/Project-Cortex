import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { root, localPreflight } from "./guard.mjs";
localPreflight();
// A creation request only. The parent creates the project with its trusted service
// tool and records an independently verified active receipt/private environment.
process.stdout.write(readFileSync(resolve(root, "project-request.json"), "utf8"));
