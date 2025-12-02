#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Use relative paths from script location for portability
const projectRoot = path.resolve(__dirname);
const docsRoot = path.join(projectRoot, 'Documentation');

// Get all markdown files
function getAllMarkdownFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath));
    } else if (item.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Extract links from markdown content
// eslint-disable-next-line no-unused-vars
function extractLinks(content, _filePath) {
  const links = [];
  
  // Match [text](url) style links
  const inlineLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = inlineLinkRegex.exec(content)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  // Match <url> style links
  const angleBracketRegex = /<(https?:\/\/[^>]+)>/g;
  while ((match = angleBracketRegex.exec(content)) !== null) {
    links.push({
      text: match[1],
      url: match[1],
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  return links;
}

// Check if a link is broken
function checkLink(link, sourceFile) {
  const url = link.url;
  
  // Skip anchors only
  if (url.startsWith('#')) {
    return { valid: true, type: 'anchor' };
  }
  
  // External links (we'll note them but not validate)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { valid: true, type: 'external' };
  }
  
  // Email links
  if (url.startsWith('mailto:')) {
    return { valid: true, type: 'email' };
  }
  
  // Internal links
  let targetPath;
  const [pathPart, anchor] = url.split('#');
  
  if (pathPart.startsWith('/')) {
    // Absolute path from project root
    targetPath = path.join(projectRoot, pathPart);
  } else if (pathPart.startsWith('../') || pathPart.startsWith('./')) {
    // Relative path
    const sourceDir = path.dirname(sourceFile);
    targetPath = path.resolve(sourceDir, pathPart);
  } else if (pathPart === '') {
    // Just an anchor in the same file
    return { valid: true, type: 'anchor' };
  } else {
    // Relative path without ./ prefix
    const sourceDir = path.dirname(sourceFile);
    targetPath = path.resolve(sourceDir, pathPart);
  }
  
  // Check if file exists
  const exists = fs.existsSync(targetPath);
  
  return {
    valid: exists,
    type: 'internal',
    targetPath,
    anchor
  };
}

// Main function
function main() {
  console.log('Checking links in Documentation folder...\n');
  
  const allFiles = getAllMarkdownFiles(docsRoot);
  const brokenLinks = [];
  
  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const links = extractLinks(content, file);
    const relativePath = path.relative(projectRoot, file);
    
    for (const link of links) {
      const result = checkLink(link, file);
      
      if (!result.valid) {
        brokenLinks.push({
          file: relativePath,
          line: link.line,
          text: link.text,
          url: link.url,
          targetPath: result.targetPath,
          type: result.type
        });
      }
    }
  }
  
  // Report results
  if (brokenLinks.length === 0) {
    console.log('✅ No broken links found!');
  } else {
    console.log(`❌ Found ${brokenLinks.length} broken link(s):\n`);
    
    for (const broken of brokenLinks) {
      console.log(`File: ${broken.file}:${broken.line}`);
      console.log(`  Text: "${broken.text}"`);
      console.log(`  Link: ${broken.url}`);
      if (broken.targetPath) {
        console.log(`  Target: ${broken.targetPath}`);
      }
      console.log('');
    }
  }
  
  process.exit(brokenLinks.length > 0 ? 1 : 0);
}

main();
