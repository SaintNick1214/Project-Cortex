#!/usr/bin/env node

// Test fixture standing in for a backend binary that fails to generate an admin
// key. Writes an error message to stderr and exits with a nonzero code.

import process from "node:process";

process.stderr.write("could not generate admin key: something went wrong\n");
process.exit(1);
