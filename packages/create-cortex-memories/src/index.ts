#!/usr/bin/env node

/**
 * create-cortex-memories
 * Interactive CLI to scaffold Cortex Memory SDK projects
 */

import { runWizard } from './wizard.js';
import pc from 'picocolors';

async function main() {
  try {
    // Get target directory from command line args
    const targetDir = process.argv[2];
    
    // Run the wizard
    await runWizard(targetDir);
    
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Setup cancelled') {
        process.exit(0);
      }
      console.error(pc.red('\n❌ Error:'), error.message);
    } else {
      console.error(pc.red('\n❌ An unexpected error occurred:'), error);
    }
    process.exit(1);
  }
}

main();

