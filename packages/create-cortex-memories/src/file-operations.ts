/**
 * File operations for copying Cortex backend functions
 */

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getSDKPath } from "./utils.js";
import pc from "picocolors";

// ES module equivalents of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Copy Cortex backend functions from SDK to user project
 */
export async function deployCortexBackend(projectPath: string): Promise<void> {
  // Look for SDK in the newly created project's node_modules
  const sdkPath = getSDKPath(projectPath);

  if (!sdkPath) {
    // Debug: Check what's actually in node_modules
    const nodeModulesPath = path.join(
      projectPath,
      "node_modules",
      "@cortexmemory",
    );
    const exists = fs.existsSync(nodeModulesPath);

    throw new Error(
      `Could not locate @cortexmemory/sdk package. ` +
        `Checked: ${path.join(projectPath, "node_modules", "@cortexmemory", "sdk")} ` +
        `(@cortexmemory folder exists: ${exists})`,
    );
  }

  const convexDevPath = path.join(sdkPath, "convex-dev");
  const targetConvexPath = path.join(projectPath, "convex");

  // Check if convex-dev exists in SDK
  if (!fs.existsSync(convexDevPath)) {
    throw new Error(
      `Convex backend functions not found at ${convexDevPath}. ` +
        "Please ensure you are using @cortexmemory/sdk v0.8.1 or later.",
    );
  }

  // Backup existing convex/ folder if it exists
  // Use atomic fs.move which handles the check internally
  try {
    const backupPath = path.join(projectPath, `convex.backup.${Date.now()}`);
    await fs.move(targetConvexPath, backupPath);
    console.log(pc.yellow("⚠️  Existing convex/ folder backed up"));
    console.log(pc.dim(`   Backed up to ${path.basename(backupPath)}`));
  } catch (error: any) {
    // Target doesn't exist (ENOENT) - this is fine, nothing to backup
    if (error.code !== "ENOENT") {
      throw error; // Re-throw if it's a different error
    }
  }

  // Copy all files from convex-dev to convex
  console.log(pc.dim("   Copying Cortex backend functions..."));
  await fs.copy(convexDevPath, targetConvexPath, {
    overwrite: true,
    errorOnExist: false,
  });

  // List of critical files to verify
  const criticalFiles = [
    "schema.ts",
    "conversations.ts",
    "immutable.ts",
    "mutable.ts",
    "memories.ts",
    "facts.ts",
    "contexts.ts",
    "memorySpaces.ts",
    "users.ts",
    "agents.ts",
    "graphSync.ts",
  ];

  // Verify all critical files were copied
  const missingFiles = criticalFiles.filter(
    (file) => !fs.existsSync(path.join(targetConvexPath, file)),
  );

  if (missingFiles.length > 0) {
    throw new Error(
      `Failed to copy some backend functions: ${missingFiles.join(", ")}`,
    );
  }

  console.log(
    pc.green(`   ✓ Copied ${criticalFiles.length} backend functions`),
  );
}

/**
 * Create or update convex.json configuration
 */
export async function createConvexJson(projectPath: string): Promise<void> {
  const convexJsonPath = path.join(projectPath, "convex.json");

  const convexConfig = {
    functions: "convex/",
  };

  await fs.writeJson(convexJsonPath, convexConfig, { spaces: 2 });
  console.log(pc.dim("   Created convex.json"));
}

/**
 * Copy project template files
 */
export async function copyTemplate(
  templateName: string,
  targetPath: string,
  projectName: string,
): Promise<void> {
  // When running from npm/npx, templates are relative to the package root
  // Try multiple possible locations
  const possiblePaths = [
    path.join(__dirname, "..", "templates", templateName), // From dist/
    path.join(__dirname, "../..", "templates", templateName), // From dist/subdir
    path.join(
      process.cwd(),
      "node_modules",
      "create-cortex-memories",
      "templates",
      templateName,
    ), // From installed package
  ];

  let templatePath: string | null = null;
  for (const tryPath of possiblePaths) {
    if (fs.existsSync(tryPath)) {
      templatePath = tryPath;
      break;
    }
  }

  console.log(pc.dim(`   Looking for template...`));

  if (!templatePath) {
    throw new Error(
      `Template ${templateName} not found. Tried:\n` +
        possiblePaths.map((p) => `  - ${p}`).join("\n"),
    );
  }

  console.log(pc.dim(`   Found at: ${templatePath}`));
  console.log(pc.dim(`   Copying to: ${targetPath}`));

  // List what's in the template
  const templateFiles = await fs.readdir(templatePath, { recursive: true });
  console.log(pc.dim(`   Template has ${templateFiles.length} items`));

  // Copy template files
  console.log(pc.dim(`   Starting fs.copy...`));

  try {
    await fs.copy(templatePath, targetPath, {
      overwrite: true,
      errorOnExist: false,
      filter: (src, dest) => {
        const relativeSrc = path.relative(templatePath, src) || ".";
        // Only skip if node_modules/dist are IN the template itself (not in the source path)
        const skip =
          relativeSrc.includes("node_modules") || relativeSrc.includes("dist");

        console.log(
          pc.dim(`     Filter: ${relativeSrc} -> ${skip ? "SKIP" : "COPY"}`),
        );

        return !skip;
      },
    });

    console.log(pc.dim(`   fs.copy completed`));
  } catch (error) {
    console.error(pc.red(`   fs.copy error: ${error}`));
    throw new Error(`fs.copy failed: ${error}`);
  }

  // Verify key files were copied
  const keyFiles = ["package.json", "src/index.ts", "tsconfig.json"];
  const missing = keyFiles.filter(
    (f) => !fs.existsSync(path.join(targetPath, f)),
  );
  if (missing.length > 0) {
    throw new Error(
      `Failed to copy template files: ${missing.join(", ")} not found`,
    );
  }

  // Replace template variables in package.json
  const packageJsonPath = path.join(targetPath, "package.json");
  try {
    let packageJson = await fs.readFile(packageJsonPath, "utf-8");
    packageJson = packageJson.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
    await fs.writeFile(packageJsonPath, packageJson);
  } catch (error: any) {
    // File doesn't exist or can't be read - skip template replacement
    if (error.code !== "ENOENT") {
      throw error; // Re-throw if it's not a "file not found" error
    }
  }
}

/**
 * Create .gitignore if it doesn't exist
 */
export async function ensureGitignore(projectPath: string): Promise<void> {
  const gitignorePath = path.join(projectPath, ".gitignore");

  const gitignoreContent = `# Dependencies
node_modules/

# Build output
dist/
build/

# Environment variables
.env
.env.local
.env.*.local

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Convex
.convex/
`;

  // Use atomic file operation to avoid race condition
  // The 'wx' flag fails if file already exists
  try {
    await fs.writeFile(gitignorePath, gitignoreContent, { flag: "wx" });
    console.log(pc.dim("   Created .gitignore"));
  } catch (error: any) {
    // File already exists (EEXIST), which is fine - silently continue
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}
