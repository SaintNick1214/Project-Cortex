/**
 * File operations for init wizard
 *
 * Handles templates and additive local backend installation.
 */

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getSDKPath } from "../shell.js";
import pc from "picocolors";
import { installAdditiveBackend } from "./additive-backend.js";

// ES module equivalents of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Add the versioned Cortex backend to a host project without deploying it
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

  const result = await installAdditiveBackend(projectPath, sdkPath);
  console.log(pc.green(`   Added ${result.installed.length} Cortex backend files; retained ${result.unchanged.length} identical files`));
  if (!result.capabilities.authConfigured) {
    console.log(pc.yellow("   Configure a trusted Convex JWT provider and operator-provisioned grants before using the backend."));
  }

}

/**
 * Create or update convex.json configuration
 */
export async function createConvexJson(projectPath: string): Promise<void> {
  const convexJsonPath = path.join(projectPath, "convex.json");

  if (await fs.pathExists(convexJsonPath)) {
    const current = await fs.readJson(convexJsonPath);
    if (!current || typeof current !== "object" || Array.isArray(current) ||
      (current.functions !== undefined && typeof current.functions !== "string")) {
      throw new Error("Invalid host convex.json; repair it before installing Cortex.");
    }
    console.log(pc.dim("   Preserved existing convex.json"));
    return;
  }
  await fs.writeFile(convexJsonPath, JSON.stringify({ functions: "convex/" }, null, 2) + "\n", { flag: "wx" });
  console.log(pc.dim("   Created absent convex.json"));
}

/**
 * Copy project template files
 */
export async function copyTemplate(
  templateName: string,
  targetPath: string,
  projectName: string,
  convexVersion?: string,
): Promise<void> {
  // When running from npm/npx, templates are relative to the package root
  // Try multiple possible locations
  const possiblePaths = [
    path.join(__dirname, "../../../templates", templateName), // From dist/utils/init/
    path.join(__dirname, "../../../../templates", templateName), // From dist/utils/init/subdir
    path.join(
      process.cwd(),
      "node_modules",
      "@cortexmemory",
      "cli",
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

  if (!templatePath) {
    throw new Error(
      `Template ${templateName} not found. Tried:\n` +
        possiblePaths.map((p) => `  - ${p}`).join("\n"),
    );
  }

  // Copy template files

  try {
    await fs.copy(templatePath, targetPath, {
      overwrite: true,
      errorOnExist: false,
      filter: (src: string) => {
        const relativeSrc = path.relative(templatePath!, src) || ".";
        // Skip build artifacts that shouldn't be in templates
        // Use path segment matching to avoid false positives like [...nextauth] matching ".next"
        const segments = relativeSrc.split(path.sep);
        const skip =
          segments.some((seg) => seg === "node_modules") ||
          segments.some((seg) => seg === ".next") ||
          segments.some((seg) => seg === "dist") ||
          relativeSrc === "package-lock.json" ||
          relativeSrc === "pnpm-lock.yaml";
        return !skip;
      },
    });
  } catch (error) {
    console.error(pc.red(`   fs.copy error: ${error}`));
    throw new Error(`fs.copy failed: ${error}`, { cause: error });
  }

  // Verify key files were copied (template-specific validation)
  const keyFilesByTemplate: Record<string, string[]> = {
    basic: ["package.json", "src/index.ts", "tsconfig.json"],
    "vercel-ai-quickstart": ["package.json", "tsconfig.json", "app/layout.tsx"],
    "chat-sdk-quickstart": ["package.json", "tsconfig.json", "app/layout.tsx"],
  };
  const keyFiles = keyFilesByTemplate[templateName] || ["package.json"];
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
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    // Replace project name
    packageJson.name = projectName;

    // Update Convex version if provided
    if (convexVersion && packageJson.dependencies?.convex) {
      packageJson.dependencies.convex = convexVersion;
      console.log(
        pc.dim(`   Using Convex ${convexVersion} (from SDK metadata)`),
      );
    }

    // Source templates link local packages; generated apps use the published SDK.
    if (packageJson.dependencies?.["@cortexmemory/sdk"]?.startsWith("file:")) {
      const sdkPath = getSDKPath();
      if (!sdkPath) throw new Error("Could not locate SDK package metadata");
      const sdkPackage = await fs.readJson(path.join(sdkPath, "package.json"));
      packageJson.dependencies["@cortexmemory/sdk"] = `^${sdkPackage.version}`;
    }

    // Write back with proper formatting
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + "\n",
    );
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code !== "ENOENT") {
      throw error;
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
  try {
    await fs.writeFile(gitignorePath, gitignoreContent, { flag: "wx" });
    console.log(pc.dim("   Created .gitignore"));
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code !== "EEXIST") {
      throw error;
    }
  }
}
