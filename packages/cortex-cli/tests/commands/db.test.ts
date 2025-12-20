/**
 * Database Command Tests
 *
 * Tests for CLI database command argument parsing and validation.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Command } from "commander";

describe("db commands", () => {
  describe("argument parsing", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
      program.configureOutput({
        writeErr: () => {},
        writeOut: () => {},
      });

      // Add global options
      program
        .option("-d, --deployment <name>", "Deployment name")
        .option("--debug", "Debug mode");

      const dbCmd = program.command("db").description("Database operations");

      dbCmd
        .command("stats")
        .description("Show database statistics")
        .option("-f, --format <fmt>", "Output format", "table")
        .action(() => {});

      dbCmd
        .command("clear")
        .description("Clear database")
        .option("-y, --yes", "Skip confirmation")
        .action(() => {});

      dbCmd
        .command("backup")
        .description("Backup database")
        .option("-o, --output <file>", "Output file")
        .option("--include-all", "Include all data")
        .action(() => {});

      dbCmd
        .command("restore")
        .description("Restore database")
        .requiredOption("-i, --input <file>", "Input file")
        .option("-y, --yes", "Skip confirmation")
        .option("--dry-run", "Preview without restoring")
        .action(() => {});

      dbCmd
        .command("export")
        .description("Export database")
        .option("-o, --output <file>", "Output file")
        .option("-f, --format <fmt>", "Format", "json")
        .action(() => {});
    });

    it("should parse db stats command", async () => {
      await program.parseAsync(["node", "test", "db", "stats", "-d", "local"]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().format).toBe("table");
    });

    it("should parse db stats with JSON format", async () => {
      await program.parseAsync(["node", "test", "db", "stats", "-f", "json"]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().format).toBe("json");
    });

    it("should parse db clear with confirmation skip", async () => {
      await program.parseAsync(["node", "test", "db", "clear", "-y"]);

      const cmd = program.commands[0].commands[1];
      expect(cmd.opts().yes).toBe(true);
    });

    it("should parse db backup with options", async () => {
      await program.parseAsync([
        "node",
        "test",
        "db",
        "backup",
        "-o",
        "backup.json",
        "--include-all",
      ]);

      const cmd = program.commands[0].commands[2];
      expect(cmd.opts().output).toBe("backup.json");
      expect(cmd.opts().includeAll).toBe(true);
    });

    it("should parse db restore with required input", async () => {
      await program.parseAsync([
        "node",
        "test",
        "db",
        "restore",
        "-i",
        "backup.json",
        "-y",
      ]);

      const cmd = program.commands[0].commands[3];
      expect(cmd.opts().input).toBe("backup.json");
      expect(cmd.opts().yes).toBe(true);
    });

    it("should parse db restore with dry-run", async () => {
      await program.parseAsync([
        "node",
        "test",
        "db",
        "restore",
        "-i",
        "backup.json",
        "--dry-run",
      ]);

      const cmd = program.commands[0].commands[3];
      expect(cmd.opts().dryRun).toBe(true);
    });

    it("should require input for restore", async () => {
      await expect(
        program.parseAsync(["node", "test", "db", "restore"]),
      ).rejects.toThrow();
    });

    it("should parse db export with options", async () => {
      await program.parseAsync([
        "node",
        "test",
        "db",
        "export",
        "-o",
        "export.csv",
        "-f",
        "csv",
      ]);

      const cmd = program.commands[0].commands[4];
      expect(cmd.opts().output).toBe("export.csv");
      expect(cmd.opts().format).toBe("csv");
    });

    it("should parse global deployment option", async () => {
      await program.parseAsync(["node", "test", "-d", "cloud", "db", "stats"]);

      expect(program.opts().deployment).toBe("cloud");
    });
  });
});
