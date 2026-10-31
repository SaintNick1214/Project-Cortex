import {pathToFileURL} from "node:url";
const root="/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion";
const {oneoffContext}=await import(pathToFileURL(root+"/node_modules/convex/src/bundler/context.ts").href);
const {doCodegen}=await import(pathToFileURL(root+"/node_modules/convex/src/cli/lib/codegen.ts").href);
const ctx=await oneoffContext({envFile:process.argv[2]});
await doCodegen(ctx,process.cwd()+"/convex","enable");
console.log("Official Convex local application codegen and backend typecheck complete; no deployment or service connection.");
