#!/usr/bin/env node

// This wrapper ensures compatibility with npx execution
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log to stderr for debugging Claude Desktop issues
console.error('Starting Puppeteer MCP Server...');
console.error('Node version:', process.version);
console.error('Working directory:', process.cwd());
console.error('Script path:', __filename);

try {
  await import(join(__dirname, '../dist/index.js'));
} catch (err) {
  console.error('Failed to start Puppeteer MCP Server:', err);
  console.error('Stack trace:', err.stack);
  process.exit(1);
};