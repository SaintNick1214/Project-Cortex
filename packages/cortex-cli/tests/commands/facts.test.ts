/**
 * Facts Command Tests
 *
 * Tests for CLI facts command argument parsing and validation.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Command } from "commander";

describe("facts commands", () => {
  describe("argument parsing", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
      program.configureOutput({
        writeErr: () => {},
        writeOut: () => {},
      });

      const factsCmd = program
        .command("facts")
        .description("Fact operations");

      factsCmd
        .command("list")
        .description("List facts")
        .requiredOption("-s, --space <id>", "Memory space ID")
        .option("-t, --type <type>", "Filter by fact type")
        .option("-l, --limit <n>", "Limit results", "50")
        .action(() => {});

      factsCmd
        .command("search <query>")
        .description("Search facts")
        .requiredOption("-s, --space <id>", "Memory space ID")
        .option("-t, --type <type>", "Filter by fact type")
        .option("-l, --limit <n>", "Limit results", "20")
        .action(() => {});

      factsCmd
        .command("get <factId>")
        .description("Get a fact")
        .requiredOption("-s, --space <id>", "Memory space ID")
        .action(() => {});

      factsCmd
        .command("delete <factId>")
        .description("Delete a fact")
        .requiredOption("-s, --space <id>", "Memory space ID")
        .option("-y, --yes", "Skip confirmation")
        .action(() => {});

      factsCmd
        .command("export")
        .description("Export facts")
        .requiredOption("-s, --space <id>", "Memory space ID")
        .option("-o, --output <file>", "Output file")
        .option("-f, --format <fmt>", "Format", "json")
        .option("-t, --type <type>", "Filter by fact type")
        .action(() => {});
    });

    it("should parse facts list with required space", async () => {
      await program.parseAsync([
        "node", "test", "facts", "list", "-s", "test-space",
      ]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().space).toBe("test-space");
      expect(cmd.opts().limit).toBe("50");
    });

    it("should parse facts list with type filter", async () => {
      await program.parseAsync([
        "node", "test", "facts", "list",
        "-s", "test-space",
        "-t", "preference",
        "-l", "100",
      ]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().type).toBe("preference");
      expect(cmd.opts().limit).toBe("100");
    });

    it("should require space for list", async () => {
      await expect(
        program.parseAsync(["node", "test", "facts", "list"])
      ).rejects.toThrow();
    });

    it("should parse facts search with query", async () => {
      await program.parseAsync([
        "node", "test", "facts", "search", "user preferences",
        "-s", "test-space",
      ]);

      const cmd = program.commands[0].commands[1];
      expect(cmd.args[0]).toBe("user preferences");
      expect(cmd.opts().space).toBe("test-space");
      expect(cmd.opts().limit).toBe("20");
    });

    it("should parse facts get with fact ID", async () => {
      await program.parseAsync([
        "node", "test", "facts", "get", "fact-123",
        "-s", "test-space",
      ]);

      const cmd = program.commands[0].commands[2];
      expect(cmd.args[0]).toBe("fact-123");
    });

    it("should parse facts delete with confirmation skip", async () => {
      await program.parseAsync([
        "node", "test", "facts", "delete", "fact-123",
        "-s", "test-space",
        "-y",
      ]);

      const cmd = program.commands[0].commands[3];
      expect(cmd.args[0]).toBe("fact-123");
      expect(cmd.opts().yes).toBe(true);
    });

    it("should parse facts export with all options", async () => {
      await program.parseAsync([
        "node", "test", "facts", "export",
        "-s", "test-space",
        "-o", "facts.json",
        "-f", "csv",
        "-t", "knowledge",
      ]);

      const cmd = program.commands[0].commands[4];
      expect(cmd.opts().output).toBe("facts.json");
      expect(cmd.opts().format).toBe("csv");
      expect(cmd.opts().type).toBe("knowledge");
    });
  });
});
