#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { AutoWeave } = require('../core/autoweave');
const { KagentBridge } = require('../kagent/bridge');
const config = require('../../config/autoweave/config');

program
    .name('autoweave')
    .description('AutoWeave CLI - Create agents with natural language')
    .version('0.1.0');

program
    .command('create')
    .description('Create and deploy an agent')
    .option('-d, --description <desc>', 'Agent description')
    .option('-n, --name <name>', 'Agent name')
    .option('--dry-run', 'Generate YAML without deploying')
    .action(async (options) => {
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
                const yamlGenerator = new (require('../kagent/yaml-generator')).KagentYAMLGenerator();
                const yaml = yamlGenerator.generateFromWorkflow(workflow);

                console.log(chalk.green('📄 Generated kagent YAML:'));
                console.log(require('yaml').stringify(yaml));
            } else {
                // Create and deploy
                const result = await autoweave.createAndDeployAgent(description);

                console.log(chalk.green('✅ Agent created and deployed successfully!'));
                console.log(chalk.cyan(`🆔 Agent ID: ${result.workflow.id}`));
                console.log(chalk.cyan(`📝 Name: ${result.workflow.name}`));
                console.log(chalk.cyan(`⚙️  Tools: ${result.workflow.requiredModules.map(m => m.name).join(', ')}`));
                console.log(chalk.cyan(`☸️  kagent Status: ${result.deployment.status}`));

                console.log(chalk.blue('\n🌐 Access your agent:'));
                console.log(`- AutoWeave API: http://localhost:${config.port}/api/agents/${result.workflow.id}`);
                console.log('- kagent UI: kubectl port-forward -n kagent-system svc/kagent-ui 8080:80');
            }

            await autoweave.shutdown();
            await kagentBridge.shutdown();

        } catch (error) {
            console.error(chalk.red('❌ Error creating agent:'), error.message);
            process.exit(1);
        }
    });

program
    .command('status <agentId>')
    .description('Get agent status')
    .action(async (agentId) => {
        try {
            console.log(chalk.blue(`📊 Getting status for agent: ${agentId}`));

            // Initialize components
            const kagentBridge = new KagentBridge(config.kagent);
            await kagentBridge.initialize();

            const autoweave = new AutoWeave(config, kagentBridge);
            await autoweave.initialize();

            const status = await autoweave.getAgentStatus(agentId);

            if (!status) {
                console.log(chalk.red('❌ Agent not found'));
                process.exit(1);
            }

            console.log(chalk.green('✅ Agent Status:'));
            console.log(chalk.cyan(`Name: ${status.name}`));
            console.log(chalk.cyan(`Status: ${status.status}`));
            console.log(chalk.cyan(`Created: ${status.createdAt}`));
            console.log(chalk.cyan(`Description: ${status.description}`));

            if (status.kagentDetails) {
                console.log(chalk.blue('\n☸️  Kubernetes Details:'));
                console.log(chalk.cyan(`Phase: ${status.kagentDetails.status}`));
                console.log(chalk.cyan(`Ready: ${status.kagentDetails.ready}`));
                console.log(chalk.cyan(`Pods: ${status.kagentDetails.pods?.length || 0}`));
            }

            await autoweave.shutdown();
            await kagentBridge.shutdown();

        } catch (error) {
            console.error(chalk.red('❌ Error getting status:'), error.message);
            process.exit(1);
        }
    });

program
    .command('list')
    .description('List all agents')
    .action(async () => {
        try {
            console.log(chalk.blue('📋 Listing all agents...'));

            // Initialize components
            const kagentBridge = new KagentBridge(config.kagent);
            await kagentBridge.initialize();

            const autoweave = new AutoWeave(config, kagentBridge);
            await autoweave.initialize();

            // This would need to be implemented in AutoWeave
            console.log(chalk.yellow('⚠️  List functionality not yet implemented'));

            await autoweave.shutdown();
            await kagentBridge.shutdown();

        } catch (error) {
            console.error(chalk.red('❌ Error listing agents:'), error.message);
            process.exit(1);
        }
    });

program
    .command('delete <agentId>')
    .description('Delete an agent')
    .action(async (agentId) => {
        try {
            console.log(chalk.blue(`🗑️  Deleting agent: ${agentId}`));

            // Initialize components
            const kagentBridge = new KagentBridge(config.kagent);
            await kagentBridge.initialize();

            await kagentBridge.deleteAgent(agentId);

            console.log(chalk.green('✅ Agent deleted successfully!'));

            await kagentBridge.shutdown();

        } catch (error) {
            console.error(chalk.red('❌ Error deleting agent:'), error.message);
            process.exit(1);
        }
    });

program.parse();