/**
 * Conversations Command Tests
 *
 * Tests for CLI conversation command argument parsing and validation.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Command } from "commander";

describe("conversations commands", () => {
  describe("argument parsing", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
      program.configureOutput({
        writeErr: () => {},
        writeOut: () => {},
      });

      const convsCmd = program
        .command("conversations")
        .alias("convs")
        .description("Conversation operations");

      convsCmd
        .command("list")
        .description("List conversations")
        .option("-s, --space <id>", "Filter by memory space")
        .option("-u, --user <id>", "Filter by user ID")
        .option("-t, --type <type>", "Filter by type")
        .option("-l, --limit <n>", "Limit results", "50")
        .action(() => {});

      convsCmd
        .command("get <conversationId>")
        .description("Get conversation")
        .option("-m, --messages <n>", "Message limit", "50")
        .action(() => {});

      convsCmd
        .command("delete <conversationId>")
        .description("Delete conversation")
        .option("-y, --yes", "Skip confirmation")
        .action(() => {});

      convsCmd
        .command("export <conversationId>")
        .description("Export conversation")
        .option("-o, --output <file>", "Output file")
        .option("-f, --format <fmt>", "Format", "json")
        .action(() => {});

      convsCmd
        .command("count")
        .description("Count conversations")
        .option("-s, --space <id>", "Filter by memory space")
        .option("-u, --user <id>", "Filter by user ID")
        .action(() => {});
    });

    it("should parse conversations list", async () => {
      await program.parseAsync(["node", "test", "conversations", "list"]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().limit).toBe("50");
    });

    it("should parse conversations list with alias", async () => {
      await program.parseAsync(["node", "test", "convs", "list"]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().limit).toBe("50");
    });

    it("should parse conversations list with filters", async () => {
      await program.parseAsync([
        "node", "test", "conversations", "list",
        "-s", "test-space",
        "-u", "user-123",
        "-t", "user-agent",
        "-l", "100",
      ]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().space).toBe("test-space");
      expect(cmd.opts().user).toBe("user-123");
      expect(cmd.opts().type).toBe("user-agent");
      expect(cmd.opts().limit).toBe("100");
    });

    it("should parse conversations get", async () => {
      await program.parseAsync([
        "node", "test", "conversations", "get", "conv-123",
      ]);

      const cmd = program.commands[0].commands[1];
      expect(cmd.args[0]).toBe("conv-123");
      expect(cmd.opts().messages).toBe("50");
    });

    it("should parse conversations get with message limit", async () => {
      await program.parseAsync([
        "node", "test", "conversations", "get", "conv-123",
        "-m", "10",
      ]);

      const cmd = program.commands[0].commands[1];
      expect(cmd.opts().messages).toBe("10");
    });

    it("should parse conversations delete", async () => {
      await program.parseAsync([
        "node", "test", "conversations", "delete", "conv-123",
        "-y",
      ]);

      const cmd = program.commands[0].commands[2];
      expect(cmd.args[0]).toBe("conv-123");
      expect(cmd.opts().yes).toBe(true);
    });

    it("should parse conversations export", async () => {
      await program.parseAsync([
        "node", "test", "conversations", "export", "conv-123",
        "-o", "conversation.json",
        "-f", "txt",
      ]);

      const cmd = program.commands[0].commands[3];
      expect(cmd.args[0]).toBe("conv-123");
      expect(cmd.opts().output).toBe("conversation.json");
      expect(cmd.opts().format).toBe("txt");
    });

    it("should parse conversations count", async () => {
      await program.parseAsync([
        "node", "test", "conversations", "count",
        "-s", "test-space",
        "-u", "user-123",
      ]);

      const cmd = program.commands[0].commands[4];
      expect(cmd.opts().space).toBe("test-space");
      expect(cmd.opts().user).toBe("user-123");
    });
  });
});
