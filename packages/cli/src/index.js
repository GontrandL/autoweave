#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const packageInfo = require('../package.json');

// Import command modules
const createAgentCommand = require('./create-agent');
const openSourceCommand = require('./commands/open-source');

const program = new Command();

// Main CLI configuration
program
    .name('autoweave')
    .description('AutoWeave CLI - Self-Weaving Agent Orchestrator')
    .version(packageInfo.version || '1.0.0');

// Add global options
program
    .option('-v, --verbose', 'Enable verbose output')
    .option('--api-url <url>', 'AutoWeave API URL', process.env.AUTOWEAVE_API_URL || 'http://localhost:3000');

// Create agent command (existing functionality)
program
    .command('create')
    .description('Create and deploy an agent')
    .option('-d, --description <desc>', 'Agent description')
    .option('-n, --name <name>', 'Agent name')
    .option('--dry-run', 'Generate YAML without deploying')
    .action(async (options) => {
        // Import the existing create-agent logic
        const { AutoWeave } = require('@autoweave/core');
        const { KagentBridge } = require('@autoweave/core');
        const config = require('@autoweave/core');
        const inquirer = require('inquirer');

        try {
            console.log(chalk.blue('🕸️  AutoWeave - Agent Creator'));

            let description = options.description;

            if (!description) {
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'description',
                        message: 'Describe what your agent should do:',
                        validate: input => input.length > 10 || 'Please provide a detailed description'
                    }
                ]);
                description = answers.description;
            }

            console.log(chalk.yellow('🚀 Creating agent...'));

            // Initialize AutoWeave
            const kagentBridge = new KagentBridge(config.kagent);
            await kagentBridge.initialize();

            const autoweave = new AutoWeave(config, kagentBridge);
            await autoweave.initialize();

            if (options.dryRun) {
                // Generate workflow only
                const workflow = await autoweave.agentWeaver.generateWorkflow(description);
                console.log(chalk.green('✅ Workflow generated:'));
                console.log(JSON.stringify(workflow, null, 2));
            } else {
                // Create and deploy agent
                const agent = await autoweave.createAgent(description);
                console.log(chalk.green('✅ Agent created successfully!'));
                console.log(chalk.blue('Agent ID:'), agent.id);
                console.log(chalk.blue('Status:'), agent.status);
            }

        } catch (error) {
            console.error(chalk.red('❌ Error creating agent:'), error.message);
            if (program.opts().verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    });

// Open Source commands
program
    .command('discover-alternatives')
    .alias('discover')
    .description('Discover open source alternatives for a tool')
    .argument('<tool>', 'The tool to find alternatives for')
    .option('-d, --docker', 'Include Docker Hub alternatives', true)
    .option('-n, --npm', 'Include NPM alternatives', true)
    .option('-h, --helm', 'Include Helm chart alternatives', true)
    .option('-o, --output <format>', 'Output format (table, json, csv)', 'table')
    .option('-s, --save <file>', 'Save results to file')
    .action(async (tool, options) => {
        const openSourceCmd = require('./commands/open-source');
        await openSourceCmd.parseAsync(['node', 'autoweave', 'discover-alternatives', tool, ...buildOptions(options)]);
    });

program
    .command('audit-licenses')
    .alias('audit')
    .description('Audit project licenses for compliance')
    .argument('[path]', 'Path to project directory', '.')
    .option('-q, --quick', 'Perform quick scan', false)
    .option('-t, --target <license>', 'Target license for compatibility check', 'MIT')
    .option('-o, --output <format>', 'Output format (table, json, report)', 'table')
    .option('-s, --save <file>', 'Save results to file')
    .option('--fail-on-issues', 'Exit with error code if issues found', false)
    .action(async (projectPath, options) => {
        const openSourceCmd = require('./commands/open-source');
        await openSourceCmd.parseAsync(['node', 'autoweave', 'audit-licenses', projectPath, ...buildOptions(options)]);
    });

program
    .command('compliance-score')
    .alias('score')
    .description('Get compliance score for a project')
    .argument('[path]', 'Path to project directory', '.')
    .option('-o, --output <format>', 'Output format (simple, detailed, json)', 'simple')
    .action(async (projectPath, options) => {
        const openSourceCmd = require('./commands/open-source');
        await openSourceCmd.parseAsync(['node', 'autoweave', 'compliance-score', projectPath, ...buildOptions(options)]);
    });

program
    .command('migrate-to-oss')
    .alias('migrate')
    .description('Generate migration plan to open source alternatives')
    .argument('<from-tool>', 'Tool to migrate from')
    .argument('<to-tool>', 'Tool to migrate to')
    .option('-o, --output <format>', 'Output format (table, json, plan)', 'plan')
    .option('-s, --save <file>', 'Save plan to file')
    .action(async (fromTool, toTool, options) => {
        const openSourceCmd = require('./commands/open-source');
        await openSourceCmd.parseAsync(['node', 'autoweave', 'migrate-to-oss', fromTool, toTool, ...buildOptions(options)]);
    });

program
    .command('cost-analysis')
    .alias('cost')
    .description('Analyze cost savings from open source adoption')
    .argument('[tools]', 'Comma-separated list of tools to analyze')
    .option('-p, --path <path>', 'Project path to analyze')
    .option('-o, --output <format>', 'Output format (table, json, summary)', 'table')
    .option('-s, --save <file>', 'Save results to file')
    .action(async (tools, options) => {
        const openSourceCmd = require('./commands/open-source');
        await openSourceCmd.parseAsync(['node', 'autoweave', 'cost-analysis', tools, ...buildOptions(options)]);
    });

program
    .command('cncf-check')
    .alias('cncf')
    .description('Check CNCF compliance for a project')
    .argument('[path]', 'Path to project directory', '.')
    .option('-o, --output <format>', 'Output format (table, json, report)', 'report')
    .option('-s, --save <file>', 'Save results to file')
    .action(async (projectPath, options) => {
        const openSourceCmd = require('./commands/open-source');
        await openSourceCmd.parseAsync(['node', 'autoweave', 'cncf-check', projectPath, ...buildOptions(options)]);
    });

// Health and status commands
program
    .command('health')
    .description('Check health of AutoWeave services')
    .option('-s, --service <service>', 'Check specific service (open-source, memory, agents)')
    .option('-o, --output <format>', 'Output format (simple, detailed, json)', 'simple')
    .action(async (options) => {
        if (options.service === 'open-source') {
            const openSourceCmd = require('./commands/open-source');
            await openSourceCmd.parseAsync(['node', 'autoweave', 'health', ...buildOptions(options)]);
        } else {
            // General health check
            const axios = require('axios');
            const ora = require('ora');
            
            const spinner = ora('Checking AutoWeave health...').start();
            
            try {
                const apiUrl = program.opts().apiUrl || 'http://localhost:3000';
                const response = await axios.get(`${apiUrl}/health`, { timeout: 5000 });
                
                spinner.succeed('AutoWeave is healthy');
                
                if (options.output === 'json') {
                    console.log(JSON.stringify(response.data, null, 2));
                } else if (options.output === 'detailed') {
                    console.log(`\n${chalk.bold('AutoWeave Health Status')}`);
                    console.log(`${chalk.gray('=')} `.repeat(40));
                    console.log(`${chalk.blue('Status:')} ${response.data.status}`);
                    console.log(`${chalk.blue('Uptime:')} ${Math.floor(response.data.uptime)}s`);
                    console.log(`${chalk.blue('Version:')} ${response.data.version}`);
                } else {
                    console.log(`\n${chalk.bold('AutoWeave:')} ${chalk.green('healthy')}`);
                    console.log(`${chalk.blue('Uptime:')} ${Math.floor(response.data.uptime)}s`);
                }
                
            } catch (error) {
                spinner.fail('AutoWeave health check failed');
                console.error(chalk.red('Error:'), error.message);
                process.exit(1);
            }
        }
    });

// Help command
program
    .command('help')
    .description('Display help information')
    .action(() => {
        console.log(chalk.blue('🕸️  AutoWeave CLI - Self-Weaving Agent Orchestrator'));
        console.log();
        console.log(chalk.bold('Usage:'));
        console.log('  autoweave <command> [options]');
        console.log();
        console.log(chalk.bold('Commands:'));
        console.log('  create              Create and deploy an agent');
        console.log('  discover-alternatives   Discover open source alternatives');
        console.log('  audit-licenses      Audit project licenses');
        console.log('  compliance-score    Get compliance score');
        console.log('  migrate-to-oss      Generate migration plan');
        console.log('  cost-analysis       Analyze cost savings');
        console.log('  cncf-check          Check CNCF compliance');
        console.log('  health              Check service health');
        console.log();
        console.log(chalk.bold('Examples:'));
        console.log('  autoweave create -d "A monitoring agent for Kubernetes"');
        console.log('  autoweave discover-alternatives datadog');
        console.log('  autoweave audit-licenses ./my-project');
        console.log('  autoweave compliance-score');
        console.log('  autoweave migrate-to-oss datadog prometheus');
        console.log('  autoweave cost-analysis "datadog,splunk,vault-enterprise"');
        console.log('  autoweave cncf-check ./my-project');
        console.log();
        console.log(chalk.bold('Options:'));
        console.log('  -v, --verbose       Enable verbose output');
        console.log('  --api-url <url>     AutoWeave API URL');
        console.log('  -h, --help          Display help for command');
        console.log();
        console.log(chalk.gray('For more information, visit: https://github.com/autoweave/autoweave'));
    });

/**
 * Helper function to build options array for command delegation
 */
function buildOptions(options) {
    const args = [];
    
    Object.entries(options).forEach(([key, value]) => {
        if (key === 'parent') return; // Skip commander internal property
        
        if (typeof value === 'boolean' && value) {
            args.push(`--${key}`);
        } else if (typeof value === 'string' || typeof value === 'number') {
            args.push(`--${key}`, value);
        }
    });
    
    return args;
}

// Error handling
program.on('command:*', () => {
    console.error(chalk.red('Invalid command: %s'), program.args.join(' '));
    console.log(chalk.blue('Run "autoweave help" for available commands'));
    process.exit(1);
});

// Parse arguments
if (process.argv.length === 2) {
    program.help();
}

program.parse(process.argv);

module.exports = program;