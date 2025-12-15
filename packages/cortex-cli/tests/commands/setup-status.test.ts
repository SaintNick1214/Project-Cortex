/**
 * Setup and Status Command Tests
 *
 * Tests for CLI setup and status command argument parsing.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Command } from "commander";

describe("setup and status commands", () => {
  describe("setup command parsing", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
      program.configureOutput({
        writeErr: () => {},
        writeOut: () => {},
      });

      program
        .command("setup")
        .description("Interactive setup wizard")
        .option("--auto", "Auto-configure based on environment")
        .option("--local", "Configure for local development")
        .option("--cloud", "Configure for cloud deployment")
        .action(() => {});
    });

    it("should parse setup command", async () => {
      await program.parseAsync(["node", "test", "setup"]);

      const cmd = program.commands[0];
      expect(cmd.opts().auto).toBeUndefined();
    });

    it("should parse setup --auto", async () => {
      await program.parseAsync(["node", "test", "setup", "--auto"]);

      const cmd = program.commands[0];
      expect(cmd.opts().auto).toBe(true);
    });

    it("should parse setup --local", async () => {
      await program.parseAsync(["node", "test", "setup", "--local"]);

      const cmd = program.commands[0];
      expect(cmd.opts().local).toBe(true);
    });

    it("should parse setup --cloud", async () => {
      await program.parseAsync(["node", "test", "setup", "--cloud"]);

      const cmd = program.commands[0];
      expect(cmd.opts().cloud).toBe(true);
    });
  });

  describe("config command parsing", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
      program.configureOutput({
        writeErr: () => {},
        writeOut: () => {},
      });

      const configCmd = program
        .command("config")
        .description("Manage CLI configuration");

      configCmd
        .command("show")
        .description("Show current configuration")
        .option("-f, --format <fmt>", "Output format", "table")
        .action(() => {});

      configCmd
        .command("set <key> <value>")
        .description("Set configuration value")
        .action(() => {});

      configCmd
        .command("test")
        .description("Test connection")
        .option("-d, --deployment <name>", "Deployment to test")
        .action(() => {});

      configCmd
        .command("deployments")
        .description("List deployments")
        .action(() => {});

      configCmd
        .command("path")
        .description("Show config file paths")
        .action(() => {});
    });

    it("should parse config show", async () => {
      await program.parseAsync(["node", "test", "config", "show"]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().format).toBe("table");
    });

    it("should parse config show with JSON format", async () => {
      await program.parseAsync([
        "node", "test", "config", "show", "-f", "json",
      ]);

      const cmd = program.commands[0].commands[0];
      expect(cmd.opts().format).toBe("json");
    });

    it("should parse config set", async () => {
      await program.parseAsync([
        "node", "test", "config", "set", "format", "json",
      ]);

      const cmd = program.commands[0].commands[1];
      expect(cmd.args).toEqual(["format", "json"]);
    });

    it("should parse config test", async () => {
      await program.parseAsync([
        "node", "test", "config", "test",
        "-d", "local",
      ]);

      const cmd = program.commands[0].commands[2];
      expect(cmd.opts().deployment).toBe("local");
    });

    it("should parse config deployments", async () => {
      await program.parseAsync(["node", "test", "config", "deployments"]);

      // Should not throw
      expect(program.commands[0].commands[3]).toBeDefined();
    });

    it("should parse config path", async () => {
      await program.parseAsync(["node", "test", "config", "path"]);

      // Should not throw
      expect(program.commands[0].commands[4]).toBeDefined();
    });
  });

  describe("status command parsing", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
      program.configureOutput({
        writeErr: () => {},
        writeOut: () => {},
      });

      program
        .command("status")
        .description("Show status dashboard")
        .option("-f, --format <fmt>", "Output format", "table")
        .option("--check", "Run health checks")
        .option("--verbose", "Verbose output")
        .action(() => {});
    });

    it("should parse status command", async () => {
      await program.parseAsync(["node", "test", "status"]);

      const cmd = program.commands[0];
      expect(cmd.opts().format).toBe("table");
    });

    it("should parse status with JSON format", async () => {
      await program.parseAsync([
        "node", "test", "status", "-f", "json",
      ]);

      const cmd = program.commands[0];
      expect(cmd.opts().format).toBe("json");
    });

    it("should parse status --check", async () => {
      await program.parseAsync([
        "node", "test", "status", "--check",
      ]);

      const cmd = program.commands[0];
      expect(cmd.opts().check).toBe(true);
    });

    it("should parse status --verbose", async () => {
      await program.parseAsync([
        "node", "test", "status", "--verbose",
      ]);

      const cmd = program.commands[0];
      expect(cmd.opts().verbose).toBe(true);
    });
  });
});
