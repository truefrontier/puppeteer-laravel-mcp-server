#!/usr/bin/env node

// Wrapper that handles npx execution for Claude Desktop
// This avoids the argument parsing issues

const { execSync } = require('child_process');

try {
  execSync('npx -y @truefrontier/puppeteer-laravel-mcp-server', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (error) {
  console.error('Failed to execute MCP server:', error.message);
  process.exit(1);
}