/**
 * Users Command Tests
 *
 * Tests for CLI user command argument parsing and validation.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Command } from "commander";

describe("users commands", () => {
  describe("argument parsing", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
      program.configureOutput({
        writeErr: () => {},
        writeOut: () => {},
      });

      const usersCmd = program.command("users").description("User operations");

      usersCmd
        .command("list")
        .description("List users")
        .option("-l, --limit <n>", "Limit results", "50")
        .option("--no-stats", "Skip user statistics")
        .action(() => {});

      usersCmd
        .command("get <userId>")
        .description("Get user profile")
        .option("--include-history", "Include version history")
        .action(() => {});

      usersCmd
        .command("delete <userId>")
        .description("Delete user")
        .option("-y, --yes", "Skip confirmation")
        .option("--cascade", "GDPR cascade delete")
        .option("--dry-run", "Preview without deleting")
        .action(() => {});

      usersCmd
        .command("delete-many <userIds...>")
        .description("Delete multiple users")
        .option("-y, --yes", "Skip confirmation")
        .action(() => {});
    });

    it("should parse users list command", async () => {
      await program.parseAsync(["node", "test", "users", "list"]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().limit).toBe("50");
    });

    it("should parse users list with custom limit", async () => {
      await program.parseAsync(["node", "test", "users", "list", "-l", "100"]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().limit).toBe("100");
    });

    it("should parse users list with --no-stats", async () => {
      await program.parseAsync(["node", "test", "users", "list", "--no-stats"]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().stats).toBe(false);
    });

    it("should parse users get with user ID", async () => {
      await program.parseAsync(["node", "test", "users", "get", "user-123"]);

      const cmd = program.commands[0].commands[1];
      expect(cmd.args[0]).toBe("user-123");
    });

    it("should parse users get with --include-history", async () => {
      await program.parseAsync([
        "node",
        "test",
        "users",
        "get",
        "user-123",
        "--include-history",
      ]);

      const cmd = program.commands[0].commands[1];
      expect(cmd.opts().includeHistory).toBe(true);
    });

    it("should parse users delete with cascade option", async () => {
      await program.parseAsync([
        "node",
        "test",
        "users",
        "delete",
        "user-123",
        "--cascade",
        "-y",
      ]);

      const cmd = program.commands[0].commands[2];
      expect(cmd.args[0]).toBe("user-123");
      expect(cmd.opts().cascade).toBe(true);
      expect(cmd.opts().yes).toBe(true);
    });

    it("should parse users delete with dry-run", async () => {
      await program.parseAsync([
        "node",
        "test",
        "users",
        "delete",
        "user-123",
        "--dry-run",
      ]);

      const cmd = program.commands[0].commands[2];
      expect(cmd.opts().dryRun).toBe(true);
    });

    it("should parse users delete-many with multiple IDs", async () => {
      await program.parseAsync([
        "node",
        "test",
        "users",
        "delete-many",
        "user-1",
        "user-2",
        "user-3",
        "-y",
      ]);

      const cmd = program.commands[0].commands[3];
      expect(cmd.args).toEqual(["user-1", "user-2", "user-3"]);
    });
  });
});
