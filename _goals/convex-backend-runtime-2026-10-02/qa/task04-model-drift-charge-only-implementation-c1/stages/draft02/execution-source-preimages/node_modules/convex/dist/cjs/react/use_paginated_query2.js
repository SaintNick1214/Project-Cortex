"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var use_paginated_query2_exports = {};
__export(use_paginated_query2_exports, {
  resetPaginationId: () => resetPaginationId,
  usePaginatedQuery_experimental: () => usePaginatedQuery_experimental
});
module.exports = __toCommonJS(use_paginated_query2_exports);
var import_react = require("react");
var import_api = require("../server/api.js");
var import_value = require("../values/value.js");
var import_use_queries = require("./use_queries.js");
var import_errors = require("../values/errors.js");
var import_client = require("./client.js");
function usePaginatedQuery_experimental(queryOrOptions, args, options) {
  const isObjectOptions = typeof queryOrOptions === "object" && queryOrOptions !== null && "query" in queryOrOptions;
  const query = isObjectOptions ? queryOrOptions.query : queryOrOptions;
  const queryArgs = isObjectOptions ? queryOrOptions.args : args;
  const throwOnError = isObjectOptions ? queryOrOptions.throwOnError ?? false : true;
  const initialOptions = isObjectOptions ? { initialNumItems: queryOrOptions.initialNumItems } : options;
  if (typeof initialOptions?.initialNumItems !== "number" || initialOptions.initialNumItems < 0) {
    throw new Error(
      `\`options.initialNumItems\` must be a positive number. Received \`${initialOptions?.initialNumItems}\`.`
    );
  }
  const skip = queryArgs === "skip";
  const argsObject = skip ? {} : queryArgs;
  const convexClient = (0, import_client.useConvex)();
  const logger = convexClient.logger;
  const createInitialState = () => {
    const id = nextPaginationId();
    return {
      query,
      args: argsObject,
      id,
      // Queries will contain zero or one queries forever.
      queries: skip ? {} : {
        paginatedQuery: {
          query,
          args: {
            ...argsObject
          },
          paginationOptions: {
            initialNumItems: initialOptions.initialNumItems,
            id
          }
        }
      },
      skip
    };
  };
  const [state, setState] = (0, import_react.useState)(createInitialState);
  let currState = state;
  if ((0, import_api.getFunctionName)(query) !== (0, import_api.getFunctionName)(state.query) || JSON.stringify((0, import_value.convexToJson)(argsObject)) !== JSON.stringify((0, import_value.convexToJson)(state.args)) || skip !== state.skip) {
    currState = createInitialState();
    setState(currState);
  }
  const resultsObject = (0, import_use_queries.useQueries)(currState.queries);
  if (!("paginatedQuery" in resultsObject)) {
    if (!skip) {
      throw new Error("Why is it missing?");
    }
    const internalResult2 = {
      results: [],
      status: "LoadingFirstPage",
      isLoading: true,
      loadMore: function skipNOP(_numItems) {
        return false;
      }
    };
    if (isObjectOptions) {
      return reshapeToObjectForm2(
        internalResult2
      );
    }
    return internalResult2;
  }
  const result = resultsObject.paginatedQuery;
  if (result === void 0) {
    const internalResult2 = {
      results: [],
      loadMore: () => false,
      isLoading: true,
      status: "LoadingFirstPage"
    };
    if (isObjectOptions) {
      return reshapeToObjectForm2(
        internalResult2
      );
    }
    return internalResult2;
  }
  if (result instanceof Error) {
    if (result.message.includes("InvalidCursor") || result instanceof import_errors.ConvexError && typeof result.data === "object" && result.data?.isConvexSystemError === true && result.data?.paginationError === "InvalidCursor") {
      logger.warn(
        "usePaginatedQuery hit error, resetting pagination state: " + result.message
      );
      setState(createInitialState);
      const internalResult2 = {
        results: [],
        loadMore: () => false,
        isLoading: true,
        status: "LoadingFirstPage"
      };
      if (isObjectOptions) {
        return reshapeToObjectForm2(
          internalResult2
        );
      }
      return internalResult2;
    } else {
      if (throwOnError) {
        throw result;
      }
      const internalResult2 = {
        results: [],
        loadMore: () => false,
        isLoading: false,
        status: "Error",
        error: result
      };
      if (isObjectOptions) {
        return reshapeToObjectForm2(
          internalResult2
        );
      }
      return internalResult2;
    }
  }
  const internalResult = {
    ...result,
    loadMore: (num) => {
      return result.loadMore(num);
    },
    isLoading: result.status === "LoadingFirstPage" ? true : result.status === "LoadingMore" ? true : false
  };
  if (isObjectOptions) {
    return reshapeToObjectForm2(
      internalResult
    );
  }
  return internalResult;
}
function reshapeToObjectForm2(internal) {
  const { results, loadMore } = internal;
  if (internal.status === "Error" && "error" in internal) {
    return {
      data: results,
      status: "error",
      canLoadMore: false,
      isLoading: false,
      error: internal.error,
      loadMore
    };
  }
  if (internal.status === "LoadingFirstPage" || internal.status === "LoadingMore") {
    return {
      data: internal.status === "LoadingFirstPage" ? void 0 : results,
      status: "pending",
      canLoadMore: false,
      isLoading: true,
      error: void 0,
      loadMore
    };
  }
  return {
    data: results,
    status: "success",
    canLoadMore: internal.status === "CanLoadMore",
    isLoading: false,
    error: void 0,
    loadMore
  };
}
let paginationId = 0;
function nextPaginationId() {
  paginationId++;
  return paginationId;
}
function resetPaginationId() {
  paginationId = 0;
}
//# sourceMappingURL=use_paginated_query2.js.map
