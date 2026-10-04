"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var cursorrules_exports = {};
__export(cursorrules_exports, {
  removeLegacyCursorRulesFile: () => removeLegacyCursorRulesFile
});
module.exports = __toCommonJS(cursorrules_exports);
var import_path = __toESM(require("path"), 1);
var import_chalk = require("chalk");
var import_log = require("../../../bundler/log.js");
var import_utils = require("./utils.js");
async function removeLegacyCursorRulesFile(projectDir) {
  const removed = await (0, import_utils.safelyDeleteFile)(
    import_path.default.join(projectDir, ".cursor", "rules", "convex_rules.mdc")
  );
  if (removed)
    (0, import_log.logMessage)(
      `${import_chalk.chalkStderr.green("\u2714")} Removed legacy .cursor/rules/convex_rules.mdc (superseded by convex/_generated/ai/guidelines.md).`
    );
  return removed;
}
//# sourceMappingURL=cursorrules.js.map
