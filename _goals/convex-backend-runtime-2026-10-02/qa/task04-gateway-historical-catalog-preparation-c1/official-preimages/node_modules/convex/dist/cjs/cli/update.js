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
var update_exports = {};
__export(update_exports, {
  update: () => update
});
module.exports = __toCommonJS(update_exports);
var import_chalk = require("chalk");
var import_extra_typings = require("@commander-js/extra-typings");
var import_log = require("../bundler/log.js");
const update = new import_extra_typings.Command("update").description("Print instructions for updating the convex package").allowExcessArguments(false).action(async () => {
  (0, import_log.logMessage)(
    import_chalk.chalkStderr.green(
      `To view the Convex changelog, go to https://news.convex.dev/tag/releases/
When you are ready to upgrade, run the following command:
npm install convex@latest
`
    )
  );
});
//# sourceMappingURL=update.js.map
