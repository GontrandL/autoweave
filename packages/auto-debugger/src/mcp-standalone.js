#!/usr/bin/env node

/**
 * Standalone MCP server launcher
 * This file can be called directly by Claude Desktop
 */

const { PlaywrightMCPServer } = require('../dist/playwright/mcp-server.js');

// Configuration from environment or defaults
const config = {
  port: parseInt(process.env.MCP_PORT || '8931'),
  headless: process.env.HEADLESS !== 'false',
  devtools: process.env.DEVTOOLS === 'true',
  timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Create and start server
async function main() {
  console.log('🚀 AutoWeave Debugger MCP Server');
  console.log('================================');
  console.log(`Port: ${config.port}`);
  console.log(`Headless: ${config.headless}`);
  console.log(`Log Level: ${config.logLevel}`);
  console.log('');

  try {
    const server = new PlaywrightMCPServer({
      headless: config.headless,
      devtools: config.devtools,
      timeout: config.timeout
    });

    await server.start(config.port);
    
    console.log(`✅ MCP Server started on port ${config.port}`);
    console.log('');
    console.log('Available methods:');
    console.log('- createSession');
    console.log('- navigate');
    console.log('- startDebugging');
    console.log('- getDebugReport');
    console.log('- screenshot');
    console.log('... and more');
    console.log('');
    console.log('Press Ctrl+C to stop');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };