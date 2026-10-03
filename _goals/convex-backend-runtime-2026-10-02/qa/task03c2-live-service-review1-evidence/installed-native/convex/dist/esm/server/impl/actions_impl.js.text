"use strict";
import { convexToJson, jsonToConvex } from "../../values/index.js";
import { version } from "../../index.js";
import { performAsyncSyscall } from "./syscall.js";
import { parseArgs } from "../../common/index.js";
import { getFunctionAddress } from "../components/paths.js";
import { validateArg } from "./validate.js";
function syscallArgs(requestId, functionReference, args) {
  const address = getFunctionAddress(functionReference);
  return {
    ...address,
    args: convexToJson(parseArgs(args)),
    version,
    requestId
  };
}
export function setupActionCalls(requestId) {
  return {
    runQuery: async (query, args) => {
      const result = await performAsyncSyscall(
        "1.0/actions/query",
        syscallArgs(requestId, query, args)
      );
      return jsonToConvex(result);
    },
    runMutation: async (mutation, args) => {
      const result = await performAsyncSyscall(
        "1.0/actions/mutation",
        syscallArgs(requestId, mutation, args)
      );
      return jsonToConvex(result);
    },
    runAction: async (action, args) => {
      const result = await performAsyncSyscall(
        "1.0/actions/action",
        syscallArgs(requestId, action, args)
      );
      return jsonToConvex(result);
    }
  };
}
export async function getServiceToken(service) {
  validateArg(service, 1, "getServiceToken", "service");
  if (service !== "ai-gateway") {
    throw new Error(`Unsupported service "${String(service)}"`);
  }
  return await performAsyncSyscall("1.0/createServiceToken", {
    service,
    version
  });
}
//# sourceMappingURL=actions_impl.js.map
