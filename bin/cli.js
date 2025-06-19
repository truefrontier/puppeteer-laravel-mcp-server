#!/usr/bin/env node

// This wrapper ensures compatibility with npx execution
import('../dist/index.js').catch(err => {
  console.error('Failed to start Puppeteer MCP Server:', err);
  process.exit(1);
});