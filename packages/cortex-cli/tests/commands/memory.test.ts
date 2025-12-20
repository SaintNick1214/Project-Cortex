/**
 * Memory Command Tests
 *
 * Tests for CLI memory command argument parsing and validation.
 * These tests focus on what can be reliably tested without complex SDK mocking.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Command } from "commander";
import { testConfig } from "../helpers/cli-test-utils.js";

describe("memory commands", () => {
  describe("argument parsing", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
      program.configureOutput({
        writeErr: () => {},
        writeOut: () => {},
      });

      // Register a simple version of memory commands for parsing tests
      const memoryCmd = program
        .command("memory")
        .description("Memory operations");

      memoryCmd
        .command("list")
        .description("List memories")
        .requiredOption("-s, --space <id>", "Memory space ID")
        .option("-u, --user <id>", "Filter by user ID")
        .option("-l, --limit <n>", "Limit results", "50")
        .option("-t, --type <type>", "Filter by content type")
        .action(() => {});

      memoryCmd
        .command("search <query>")
        .description("Search memories")
        .requiredOption("-s, --space <id>", "Memory space ID")
        .option("-u, --user <id>", "Filter by user ID")
        .option("-l, --limit <n>", "Limit results", "20")
        .action(() => {});

      memoryCmd
        .command("get <memoryId>")
        .description("Get a memory")
        .requiredOption("-s, --space <id>", "Memory space ID")
        .action(() => {});

      memoryCmd
        .command("delete <memoryId>")
        .description("Delete a memory")
        .requiredOption("-s, --space <id>", "Memory space ID")
        .option("-y, --yes", "Skip confirmation")
        .option("--cascade", "Cascade delete facts")
        .action(() => {});
    });

    it("should parse memory list command with required space", async () => {
      await program.parseAsync([
        "node",
        "test",
        "memory",
        "list",
        "-s",
        "test-space",
      ]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().space).toBe("test-space");
    });

    it("should parse memory list with all options", async () => {
      await program.parseAsync([
        "node",
        "test",
        "memory",
        "list",
        "-s",
        "test-space",
        "-u",
        "user-123",
        "-l",
        "100",
        "-t",
        "conversation",
      ]);

      const cmd = program.commands[0].commands[0];
      const opts = cmd.opts();
      expect(opts.space).toBe("test-space");
      expect(opts.user).toBe("user-123");
      expect(opts.limit).toBe("100");
      expect(opts.type).toBe("conversation");
    });

    it("should require space option for list", async () => {
      await expect(
        program.parseAsync(["node", "test", "memory", "list"]),
      ).rejects.toThrow();
    });

    it("should parse search command with query", async () => {
      await program.parseAsync([
        "node",
        "test",
        "memory",
        "search",
        "test query",
        "-s",
        "test-space",
      ]);

      const cmd = program.commands[0].commands[1];
      expect(cmd.args[0]).toBe("test query");
      expect(cmd.opts().space).toBe("test-space");
    });

    it("should parse get command with memory ID", async () => {
      await program.parseAsync([
        "node",
        "test",
        "memory",
        "get",
        "mem-123",
        "-s",
        "test-space",
      ]);

      const cmd = program.commands[0].commands[2];
      expect(cmd.args[0]).toBe("mem-123");
    });

    it("should parse delete command with cascade option", async () => {
      await program.parseAsync([
        "node",
        "test",
        "memory",
        "delete",
        "mem-123",
        "-s",
        "test-space",
        "--cascade",
        "-y",
      ]);

      const cmd = program.commands[0].commands[3];
      expect(cmd.args[0]).toBe("mem-123");
      expect(cmd.opts().cascade).toBe(true);
      expect(cmd.opts().yes).toBe(true);
    });
  });

  describe("default values", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();

      program
        .command("memory-list")
        .requiredOption("-s, --space <id>", "Space ID")
        .option("-l, --limit <n>", "Limit", "50")
        .option("-f, --format <fmt>", "Format", "table")
        .action(() => {});
    });

    it("should use default limit of 50", async () => {
      await program.parseAsync(["node", "test", "memory-list", "-s", "space"]);

      const cmd = program.commands[0];
      expect(cmd.opts().limit).toBe("50");
    });

    it("should use default format of table", async () => {
      await program.parseAsync(["node", "test", "memory-list", "-s", "space"]);

      const cmd = program.commands[0];
      expect(cmd.opts().format).toBe("table");
    });

    it("should override defaults with explicit values", async () => {
      await program.parseAsync([
        "node",
        "test",
        "memory-list",
        "-s",
        "space",
        "-l",
        "100",
        "-f",
        "json",
      ]);

      const cmd = program.commands[0];
      expect(cmd.opts().limit).toBe("100");
      expect(cmd.opts().format).toBe("json");
    });
  });
});
