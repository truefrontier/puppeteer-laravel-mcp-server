#!/usr/bin/env node

// Direct npx execution for Claude Desktop compatibility
import { spawn } from 'child_process';

const proc = spawn('npx', ['-y', '@truefrontier/puppeteer-laravel-mcp-server'], {
  stdio: 'inherit',
  shell: false
});

proc.on('exit', (code) => {
  process.exit(code || 0);
});

proc.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});