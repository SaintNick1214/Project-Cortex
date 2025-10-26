/**
 * Post-build script to rename ESM .js files to .mjs
 */

import { readdir, rename } from 'fs/promises';
import { join, extname } from 'path';

async function renameJsToMjs(dir) {
  const files = await readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = join(dir, file.name);

    if (file.isDirectory()) {
      await renameJsToMjs(fullPath);
    } else if (extname(file.name) === '.js' && !file.name.endsWith('.map')) {
      const newPath = fullPath.replace(/\.js$/, '.mjs');
      await rename(fullPath, newPath);
      console.log(`Renamed: ${file.name} -> ${file.name.replace('.js', '.mjs')}`);
    }
  }
}

const distEsmDir = join(process.cwd(), 'dist', 'esm');
console.log('Converting .js to .mjs in dist/esm...');
await renameJsToMjs(distEsmDir);
console.log('✅ ESM build complete!');

