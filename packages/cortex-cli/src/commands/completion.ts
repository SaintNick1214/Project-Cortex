/**
 * Completion Command
 *
 * Generate shell completion scripts for cortex CLI.
 * This is a fallback for users who need to manually configure completion.
 */

import { Command } from "commander";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pc from "picocolors";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Get the path to completion scripts
 */
function getCompletionsPath(): string {
  // In dist, we're at dist/commands/completion.js
  // Completion scripts are at scripts/completions/
  return join(__dirname, "..", "..", "scripts", "completions");
}

/**
 * Read and output a completion script
 */
function outputCompletionScript(shell: string): void {
  const completionsPath = getCompletionsPath();
  const scriptPath = join(completionsPath, `cortex.${shell}`);

  if (!existsSync(scriptPath)) {
    console.error(pc.red(`Completion script not found: ${scriptPath}`));
    console.error(pc.dim(`Supported shells: zsh, bash, fish`));
    process.exit(1);
  }

  const script = readFileSync(scriptPath, "utf-8");
  console.log(script);
}

/**
 * Register the completion command
 */
export function registerCompletionCommand(program: Command): void {
  program
    .command("completion <shell>")
    .description("Generate shell completion script")
    .addHelpText(
      "after",
      `
${pc.bold("Supported shells:")}
  zsh     Zsh completion
  bash    Bash completion
  fish    Fish completion

${pc.bold("Usage examples:")}

  ${pc.cyan("# Zsh - add to ~/.zshrc")}
  source <(cortex completion zsh)

  ${pc.cyan("# Bash - add to ~/.bashrc")}
  source <(cortex completion bash)

  ${pc.cyan("# Fish - save to completions directory")}
  cortex completion fish > ~/.config/fish/completions/cortex.fish

${pc.bold("Note:")} Completion is automatically installed during 'npm install -g'.
This command is for manual setup or troubleshooting.
`,
    )
    .action((shell: string) => {
      const validShells = ["zsh", "bash", "fish"];

      if (!validShells.includes(shell)) {
        console.error(pc.red(`Unknown shell: ${shell}`));
        console.error(pc.dim(`Supported shells: ${validShells.join(", ")}`));
        process.exit(1);
      }

      outputCompletionScript(shell);
    });
}
