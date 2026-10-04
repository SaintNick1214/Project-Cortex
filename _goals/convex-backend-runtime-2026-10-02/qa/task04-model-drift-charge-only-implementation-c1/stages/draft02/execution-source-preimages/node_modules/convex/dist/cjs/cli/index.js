"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var import_chalk = require("chalk");
var Sentry = __toESM(require("@sentry/node"), 1);
var import_sentry = require("./lib/utils/sentry.js");
var import_util = require("util");
var import_node_dns = __toESM(require("node:dns"), 1);
var import_node_net = __toESM(require("node:net"), 1);
var import_undici = require("undici");
var import_log = require("../bundler/log.js");
var import_program = require("./program.js");
const HARD_MINIMUM_NODE_MAJOR_VERSION = 20;
const HARD_MINIMUM_NODE_MINOR_VERSION = 0;
function logToStderr(...args) {
  process.stderr.write(`${(0, import_util.format)(...args)}
`);
}
async function main() {
  const nodeVersion = process.versions.node;
  const majorVersion = parseInt(nodeVersion.split(".")[0], 10);
  const minorVersion = parseInt(nodeVersion.split(".")[1], 10);
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy) {
    (0, import_undici.setGlobalDispatcher)(new import_undici.EnvHttpProxyAgent());
    (0, import_log.logVerbose)(`[proxy-bootstrap] Using proxy: ${proxy}`);
  }
  import_node_dns.default.setDefaultResultOrder("ipv4first");
  if (majorVersion >= 20) {
    import_node_net.default.setDefaultAutoSelectFamilyAttemptTimeout?.(1e3);
  }
  (0, import_sentry.initSentry)();
  if (majorVersion < HARD_MINIMUM_NODE_MAJOR_VERSION || majorVersion === HARD_MINIMUM_NODE_MAJOR_VERSION && minorVersion < HARD_MINIMUM_NODE_MINOR_VERSION) {
    logToStderr(
      import_chalk.chalkStderr.red(
        `Your Node version ${nodeVersion} is too old. Convex requires at least Node v${HARD_MINIMUM_NODE_MAJOR_VERSION}.${HARD_MINIMUM_NODE_MINOR_VERSION}`
      )
    );
    logToStderr(
      import_chalk.chalkStderr.gray(
        `You can use ${import_chalk.chalkStderr.bold(
          "nvm"
        )} (https://github.com/nvm-sh/nvm#installing-and-updating) to manage different versions of Node.`
      )
    );
    logToStderr(
      import_chalk.chalkStderr.gray(
        "After installing `nvm`, install the latest version of Node with " + import_chalk.chalkStderr.bold("`nvm install node`.")
      )
    );
    logToStderr(
      import_chalk.chalkStderr.gray(
        "Then, activate the installed version in your terminal with " + import_chalk.chalkStderr.bold("`nvm use`.")
      )
    );
    process.exit(1);
  }
  const program = (0, import_program.buildProgram)();
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    Sentry.captureException(e);
    process.exitCode = 1;
    console.error(import_chalk.chalkStderr.red("Unexpected Error: " + e));
  } finally {
    await Sentry.close();
  }
  await Promise.all([
    new Promise((resolve) => process.stdout.write("", () => resolve())),
    new Promise((resolve) => process.stderr.write("", () => resolve()))
  ]);
  process.exit();
}
void main();
//# sourceMappingURL=index.js.map
