#!/usr/bin/env node

// CommonJS wrapper for compatibility with older Node versions
const path = require('path');
const fs = require('fs');

// Log to stderr for debugging Claude Desktop issues
console.error('Starting Puppeteer MCP Server (CommonJS)...');
console.error('Node version:', process.version);
console.error('Working directory:', process.cwd());
console.error('Script path:', __filename);
console.error('Arguments:', process.argv);

// Try to find the index.js file in multiple locations
const possiblePaths = [
  path.join(__dirname, '../dist/index.js'),
  path.join(__dirname, 'dist/index.js'),
  './dist/index.js',
  path.join(process.cwd(), 'dist/index.js')
];

let indexPath = null;
for (const possiblePath of possiblePaths) {
  if (fs.existsSync(possiblePath)) {
    indexPath = possiblePath;
    console.error('Found index.js at:', indexPath);
    break;
  }
}

if (!indexPath) {
  console.error('Could not find index.js file. Tried:', possiblePaths);
  process.exit(1);
}

// Import and run the ES module using dynamic import
(async () => {
  try {
    await import(indexPath);
  } catch (err) {
    console.error('Failed to start Puppeteer MCP Server:', err);
    console.error('Stack trace:', err.stack);
    process.exit(1);
  }
})();