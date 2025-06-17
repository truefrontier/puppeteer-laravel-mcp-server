#!/usr/bin/env node

import { PuppeteerMCPServer } from './core/mcp-server.js';

async function main() {
  const server = new PuppeteerMCPServer();

  // Handle graceful shutdown
  const shutdown = async () => {
    console.error('Shutting down Puppeteer MCP Server...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    shutdown();
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown();
  });

  try {
    await server.start();
    console.error('Puppeteer MCP Server started successfully');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});