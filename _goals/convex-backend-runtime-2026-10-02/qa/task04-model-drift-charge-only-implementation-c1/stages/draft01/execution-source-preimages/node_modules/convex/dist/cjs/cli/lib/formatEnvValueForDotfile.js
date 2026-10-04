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
var formatEnvValueForDotfile_exports = {};
__export(formatEnvValueForDotfile_exports, {
  formatEnvValueForDotfile: () => formatEnvValueForDotfile
});
module.exports = __toCommonJS(formatEnvValueForDotfile_exports);
function formatEnvValueForDotfile(value) {
  let formatted = value, warning = void 0;
  const containsNewline = value.includes("\n");
  const containsSingleQuote = value.includes("'");
  const containsDoubleQuote = value.includes('"');
  const containsSlashN = value.includes("\\n");
  const commentWarning = value.includes("#") && `includes a '#' which may be interpreted as a comment if you save this value to a .env file, resulting in only reading a partial value.`;
  if (containsNewline) {
    if (!containsSingleQuote) {
      formatted = `'${value}'`;
    } else if (!containsSlashN) {
      if (containsDoubleQuote && commentWarning) {
        warning = commentWarning;
      }
      formatted = `"${value.replaceAll("\n", "\\n")}"`;
    } else {
      formatted = `'${value}'`;
      warning = `includes single quotes, newlines and "\\n" in the value. If you save this value to a .env file, it may not round-trip.`;
    }
  } else if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'") || value.startsWith("`") || value.endsWith("`") || value.includes("\f") || value.includes("\v") || commentWarning) {
    if (containsSingleQuote && !containsDoubleQuote && !containsSlashN) {
      formatted = `"${value}"`;
    } else {
      formatted = `'${value}'`;
      if (containsSingleQuote && commentWarning) {
        warning = commentWarning;
      }
    }
  }
  if (value.includes("\r")) {
    warning = warning ? `${warning} It also ` : "";
    warning += `includes carriage return (\\r) which cannot be preserved in .env files (dotenv limitation)`;
  }
  return { formatted, warning };
}
//# sourceMappingURL=formatEnvValueForDotfile.js.map
