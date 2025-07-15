#!/usr/bin/env node

// MCP Server startup script for AutoWeave Auto-Debugger

const { PlaywrightMCPServer } = require('./dist/playwright/mcp-server.js');

const server = new PlaywrightMCPServer({
  headless: process.env.HEADLESS !== 'false',
  devtools: process.env.DEVTOOLS === 'true',
  slowMo: parseInt(process.env.SLOW_MO || '0'),
  timeout: parseInt(process.env.TIMEOUT || '30000')
});

const port = parseInt(process.env.MCP_PORT || '8931');

server.start(port)
  .then(() => {
    console.log(`AutoWeave Auto-Debugger MCP Server started on port ${port}`);
  })
  .catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});