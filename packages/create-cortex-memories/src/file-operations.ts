/**
 * File operations for copying Cortex backend functions
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getSDKPath } from './utils.js';
import pc from 'picocolors';

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
    const nodeModulesPath = path.join(projectPath, 'node_modules', '@cortexmemory');
    const exists = fs.existsSync(nodeModulesPath);
    
    throw new Error(
      `Could not locate @cortexmemory/sdk package. ` +
      `Checked: ${path.join(projectPath, 'node_modules', '@cortexmemory', 'sdk')} ` +
      `(@cortexmemory folder exists: ${exists})`
    );
  }

  const convexDevPath = path.join(sdkPath, 'convex-dev');
  const targetConvexPath = path.join(projectPath, 'convex');

  // Check if convex-dev exists in SDK
  if (!fs.existsSync(convexDevPath)) {
    throw new Error(
      `Convex backend functions not found at ${convexDevPath}. ` +
      'Please ensure you are using @cortexmemory/sdk v0.8.1 or later.'
    );
  }

  // Check if target convex/ folder exists
  const convexExists = fs.existsSync(targetConvexPath);
  
  if (convexExists) {
    console.log(pc.yellow('⚠️  Existing convex/ folder detected'));
    // In a real implementation, we'd prompt the user here
    // For now, we'll backup and overwrite
    const backupPath = path.join(projectPath, `convex.backup.${Date.now()}`);
    console.log(pc.dim(`   Backing up to ${path.basename(backupPath)}`));
    await fs.move(targetConvexPath, backupPath);
  }

  // Copy all files from convex-dev to convex
  console.log(pc.dim('   Copying Cortex backend functions...'));
  await fs.copy(convexDevPath, targetConvexPath, {
    overwrite: true,
    errorOnExist: false,
  });

  // List of critical files to verify
  const criticalFiles = [
    'schema.ts',
    'conversations.ts',
    'immutable.ts',
    'mutable.ts',
    'memories.ts',
    'facts.ts',
    'contexts.ts',
    'memorySpaces.ts',
    'users.ts',
    'agents.ts',
    'graphSync.ts',
  ];

  // Verify all critical files were copied
  const missingFiles = criticalFiles.filter(
    (file) => !fs.existsSync(path.join(targetConvexPath, file))
  );

  if (missingFiles.length > 0) {
    throw new Error(
      `Failed to copy some backend functions: ${missingFiles.join(', ')}`
    );
  }

  console.log(pc.green(`   ✓ Copied ${criticalFiles.length} backend functions`));
}

/**
 * Create or update convex.json configuration
 */
export async function createConvexJson(projectPath: string): Promise<void> {
  const convexJsonPath = path.join(projectPath, 'convex.json');
  
  const convexConfig = {
    functions: 'convex/',
  };

  await fs.writeJson(convexJsonPath, convexConfig, { spaces: 2 });
  console.log(pc.dim('   Created convex.json'));
}

/**
 * Copy project template files
 */
export async function copyTemplate(
  templateName: string,
  targetPath: string,
  projectName: string
): Promise<void> {
  const templatePath = path.join(__dirname, '..', 'templates', templateName);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template ${templateName} not found at ${templatePath}`);
  }

  // Copy template files
  await fs.copy(templatePath, targetPath, {
    overwrite: false,
    errorOnExist: false,
    filter: (src) => {
      // Skip node_modules and dist if they exist in template
      return !src.includes('node_modules') && !src.includes('dist');
    },
  });

  // Replace template variables in package.json
  const packageJsonPath = path.join(targetPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    let packageJson = await fs.readFile(packageJsonPath, 'utf-8');
    packageJson = packageJson.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
    await fs.writeFile(packageJsonPath, packageJson);
  }
}

/**
 * Create .gitignore if it doesn't exist
 */
export async function ensureGitignore(projectPath: string): Promise<void> {
  const gitignorePath = path.join(projectPath, '.gitignore');
  
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

  if (!fs.existsSync(gitignorePath)) {
    await fs.writeFile(gitignorePath, gitignoreContent);
    console.log(pc.dim('   Created .gitignore'));
  }
}

