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
var serverOnly_exports = {};
__export(serverOnly_exports, {
  serverOnlyPlugin: () => serverOnlyPlugin
});
module.exports = __toCommonJS(serverOnly_exports);
const serverOnlyPlugin = {
  name: "convex-server-only",
  setup(build) {
    build.onResolve({ filter: /^server-only$/ }, (args) => ({
      path: args.path,
      namespace: "server-only-stub"
    }));
    build.onLoad({ filter: /.*/, namespace: "server-only-stub" }, () => ({
      contents: "",
      loader: "js"
    }));
  }
};
//# sourceMappingURL=serverOnly.js.map
