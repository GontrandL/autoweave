const { createAutoDebugger, createMCPServer, createAutoWeaveBridge } = require('@autoweave/auto-debugger');
const { chromium } = require('playwright');

/**
 * Basic usage example of AutoWeave Auto-Debugger
 */
async function basicExample() {
    // Create and start MCP server
    const mcpServer = createMCPServer({
        headless: true,
        devtools: false,
        timeout: 30000
    });

    console.log('Starting MCP server...');
    await mcpServer.start(8931);
    console.log('MCP server started on port 8931');

    // Create browser and page
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Create debugger instance
    const debugger = createAutoDebugger({
        captureConsole: true,
        captureErrors: true,
        captureNetwork: true,
        autoAnalyze: true,
        maxLogSize: 500
    });

    // Listen to debugger events
    debugger.on('error', (error) => {
        console.log('Error detected:', error.message);
    });

    debugger.on('console', (log) => {
        if (log.type === 'error') {
            console.log('Console error:', log.text);
        }
    });

    debugger.on('network-error', (issue) => {
        console.log(`Network error: ${issue.status} ${issue.url}`);
    });

    debugger.on('pattern-detected', ({ type, data }) => {
        console.log(`Pattern detected: ${type}`, data);
    });

    // Attach debugger to page
    console.log('Attaching debugger...');
    await debugger.attach(page);

    // Navigate to a test page with errors
    console.log('Navigating to test page...');
    await page.goto('https://example.com');

    // Inject some errors for testing
    await page.evaluate(() => {
        // Undefined variable error
        console.error('ReferenceError: testVariable is not defined');
        
        // Null reference error
        console.error('TypeError: Cannot read property \'foo\' of null');
        
        // Custom error
        throw new Error('Test error for debugging');
    }).catch(() => {}); // Catch to continue execution

    // Wait a bit for events to be captured
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate debug report
    console.log('\nGenerating debug report...');
    const report = await debugger.generateReport();

    console.log('\n=== DEBUG REPORT ===');
    console.log(`URL: ${report.url}`);
    console.log(`Total logs: ${report.summary.totalLogs}`);
    console.log(`Total errors: ${report.summary.totalErrors}`);
    console.log(`Total network issues: ${report.summary.totalNetworkIssues}`);
    console.log(`Critical issues: ${report.summary.criticalIssues.length}`);

    if (report.errors.length > 0) {
        console.log('\nErrors found:');
        report.errors.forEach((error, i) => {
            console.log(`${i + 1}. ${error.name}: ${error.message}`);
        });
    }

    if (report.suggestions.length > 0) {
        console.log('\nSuggested fixes:');
        report.suggestions.forEach((suggestion, i) => {
            console.log(`${i + 1}. [${suggestion.severity}] ${suggestion.message}`);
            console.log(`   Fix: ${suggestion.fix}`);
        });
    }

    // Get debugger stats
    const stats = debugger.getStats();
    console.log('\nDebugger stats:', stats);

    // Cleanup
    await debugger.detach();
    await browser.close();
    await mcpServer.stop();
    
    console.log('\nExample completed!');
}

/**
 * AutoWeave integration example
 */
async function autoweaveExample() {
    // Create AutoWeave bridge
    const bridge = createAutoWeaveBridge({
        mcpPort: 8931,
        apiUrl: 'http://localhost:3000',
        headless: true
    });

    console.log('Initializing AutoWeave bridge...');
    await bridge.initialize();

    // Listen to bridge events
    bridge.on('error-detected', ({ sessionId, error }) => {
        console.log(`[${sessionId}] Error detected:`, error.message);
    });

    bridge.on('suggestions-ready', ({ sessionId, suggestions }) => {
        console.log(`[${sessionId}] ${suggestions.length} suggestions generated`);
    });

    bridge.on('fixes-applied', ({ sessionId, improvement }) => {
        console.log(`[${sessionId}] Fixes applied, improvement: ${improvement}%`);
    });

    // Create debug session for a workflow
    const workflowId = 'workflow-' + Date.now();
    const sessionId = await bridge.createDebugSession(
        workflowId,
        'https://example.com'
    );
    console.log(`Created debug session: ${sessionId}`);

    // Wait for analysis
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get analysis report
    const report = await bridge.analyzeWorkflow(sessionId);
    console.log('Analysis complete:', {
        errors: report.summary.totalErrors,
        suggestions: report.suggestions.length
    });

    // Apply fixes if available
    if (report.suggestions.length > 0) {
        console.log('Applying fixes...');
        await bridge.applyFixes(sessionId, report.suggestions);
    }

    // Cleanup
    await bridge.cleanup();
    console.log('AutoWeave example completed!');
}

// Run examples
(async () => {
    try {
        console.log('=== BASIC EXAMPLE ===');
        await basicExample();
        
        console.log('\n\n=== AUTOWEAVE INTEGRATION EXAMPLE ===');
        await autoweaveExample();
    } catch (error) {
        console.error('Example failed:', error);
        process.exit(1);
    }
})();