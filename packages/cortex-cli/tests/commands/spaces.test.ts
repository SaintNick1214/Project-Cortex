/**
 * Spaces Command Tests
 *
 * Tests for CLI memory space command argument parsing and validation.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Command } from "commander";

describe("spaces commands", () => {
  describe("argument parsing", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
      program.configureOutput({
        writeErr: () => {},
        writeOut: () => {},
      });

      const spacesCmd = program
        .command("spaces")
        .description("Memory space operations");

      spacesCmd
        .command("list")
        .description("List spaces")
        .option("-t, --type <type>", "Filter by type")
        .option("-s, --status <status>", "Filter by status")
        .option("-l, --limit <n>", "Limit results", "100")
        .action(() => {});

      spacesCmd
        .command("create <spaceId>")
        .description("Create space")
        .requiredOption("-t, --type <type>", "Space type")
        .option("-n, --name <name>", "Space name")
        .option("-m, --metadata <json>", "Metadata JSON")
        .action(() => {});

      spacesCmd
        .command("get <spaceId>")
        .description("Get space")
        .action(() => {});

      spacesCmd
        .command("delete <spaceId>")
        .description("Delete space")
        .option("-y, --yes", "Skip confirmation")
        .option("--cascade", "Cascade delete")
        .action(() => {});

      spacesCmd
        .command("archive <spaceId>")
        .description("Archive space")
        .option("-r, --reason <reason>", "Archive reason")
        .option("-y, --yes", "Skip confirmation")
        .action(() => {});

      spacesCmd
        .command("add-participant <spaceId>")
        .description("Add participant")
        .requiredOption("-i, --id <id>", "Participant ID")
        .requiredOption("-t, --type <type>", "Participant type")
        .option("-r, --role <role>", "Role", "member")
        .action(() => {});
    });

    it("should parse spaces list command", async () => {
      await program.parseAsync(["node", "test", "spaces", "list"]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().limit).toBe("100");
    });

    it("should parse spaces list with filters", async () => {
      await program.parseAsync([
        "node",
        "test",
        "spaces",
        "list",
        "-t",
        "project",
        "-s",
        "active",
        "-l",
        "50",
      ]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().type).toBe("project");
      expect(cmd.opts().status).toBe("active");
      expect(cmd.opts().limit).toBe("50");
    });

    it("should parse spaces create with required type", async () => {
      await program.parseAsync([
        "node",
        "test",
        "spaces",
        "create",
        "new-space",
        "-t",
        "project",
      ]);

      const cmd = program.commands[0].commands[1];
      expect(cmd.args[0]).toBe("new-space");
      expect(cmd.opts().type).toBe("project");
    });

    it("should parse spaces create with all options", async () => {
      await program.parseAsync([
        "node",
        "test",
        "spaces",
        "create",
        "new-space",
        "-t",
        "project",
        "-n",
        "My Project",
        "-m",
        '{"category":"test"}',
      ]);

      const cmd = program.commands[0].commands[1];
      expect(cmd.opts().name).toBe("My Project");
      expect(cmd.opts().metadata).toBe('{"category":"test"}');
    });

    it("should require type for create", async () => {
      await expect(
        program.parseAsync(["node", "test", "spaces", "create", "new-space"]),
      ).rejects.toThrow();
    });

    it("should parse spaces get with space ID", async () => {
      await program.parseAsync(["node", "test", "spaces", "get", "space-123"]);

      const cmd = program.commands[0].commands[2];
      expect(cmd.args[0]).toBe("space-123");
    });

    it("should parse spaces delete with cascade", async () => {
      await program.parseAsync([
        "node",
        "test",
        "spaces",
        "delete",
        "space-123",
        "--cascade",
        "-y",
      ]);

      const cmd = program.commands[0].commands[3];
      expect(cmd.opts().cascade).toBe(true);
      expect(cmd.opts().yes).toBe(true);
    });

    it("should parse spaces archive with reason", async () => {
      await program.parseAsync([
        "node",
        "test",
        "spaces",
        "archive",
        "space-123",
        "-r",
        "Project completed",
        "-y",
      ]);

      const cmd = program.commands[0].commands[4];
      expect(cmd.opts().reason).toBe("Project completed");
    });

    it("should parse add-participant with required options", async () => {
      await program.parseAsync([
        "node",
        "test",
        "spaces",
        "add-participant",
        "space-123",
        "-i",
        "user-456",
        "-t",
        "user",
      ]);

      const cmd = program.commands[0].commands[5];
      expect(cmd.args[0]).toBe("space-123");
      expect(cmd.opts().id).toBe("user-456");
      expect(cmd.opts().type).toBe("user");
      expect(cmd.opts().role).toBe("member");
    });
  });
});
