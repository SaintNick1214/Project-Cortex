#!/usr/bin/env node

// Test fixture standing in for the backend binary's `keygen admin-key` command.
// Parses the expected arguments and prints a fake admin key in the format
// `instance_name|admin_key` to stdout.

import process from "node:process";

const args = process.argv.slice(2);

function getFlag(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

if (args[0] !== "keygen" || args[1] !== "admin-key") {
  process.stderr.write(
    `Unexpected subcommand: ${args.slice(0, 2).join(" ")}\n`,
  );
  process.exit(1);
}

const instanceName = getFlag("--instance-name");
const instanceSecret = getFlag("--instance-secret");

if (instanceName === undefined || instanceSecret === undefined) {
  process.stderr.write("Missing --instance-name or --instance-secret\n");
  process.exit(1);
}

process.stdout.write(`${instanceName}|mock_admin_key\n`);
