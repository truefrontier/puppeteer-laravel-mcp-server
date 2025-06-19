#!/usr/bin/env node

// This wrapper ensures compatibility with npx execution
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log to stderr for debugging Claude Desktop issues
console.error('Starting Puppeteer MCP Server...');
console.error('Node version:', process.version);
console.error('Working directory:', process.cwd());
console.error('Script path:', __filename);
console.error('Arguments:', process.argv);

// Try to find the index.js file in multiple locations
const possiblePaths = [
  join(__dirname, '../dist/index.js'),
  join(__dirname, 'dist/index.js'),
  './dist/index.js',
  join(process.cwd(), 'dist/index.js')
];

let indexPath = null;
for (const path of possiblePaths) {
  if (fs.existsSync(path)) {
    indexPath = path;
    console.error('Found index.js at:', indexPath);
    break;
  }
}

if (!indexPath) {
  console.error('Could not find index.js file. Tried:', possiblePaths);
  process.exit(1);
}

try {
  await import(indexPath);
} catch (err) {
  console.error('Failed to start Puppeteer MCP Server:', err);
  console.error('Stack trace:', err.stack);
  process.exit(1);
};