#!/usr/bin/env node
/**
 * Development runner for Cortex projects
 * Starts Convex in watch mode
 */

import { spawn } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const CONVEX_URL = process.env.CONVEX_URL || '';
const isLocal = CONVEX_URL.includes('localhost') || CONVEX_URL.includes('127.0.0.1');

console.log('🚀 Starting Convex development server...\n');

if (isLocal) {
  console.log('📝 Mode: LOCAL');
  console.log('🌐 URL: http://127.0.0.1:3210');
} else {
  console.log('📝 Mode: CLOUD');
  console.log('🌐 URL:', CONVEX_URL);
}

console.log('\n🔄 Watching for changes...');
console.log('   Press Ctrl+C to stop\n');

// Start Convex dev in watch mode
const args = ['convex', 'dev'];

if (isLocal) {
  args.push('--url', 'http://127.0.0.1:3210');
}

const child = spawn('npx', args, {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (err) => {
  console.error('❌ Failed to start Convex:', err);
  process.exit(1);
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`\n❌ Convex exited with code ${code}`);
    process.exit(code);
  }
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping Convex...');
  child.kill('SIGINT');
  setTimeout(() => process.exit(0), 100);
});

