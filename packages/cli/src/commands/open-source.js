#!/usr/bin/env node

const { Command } = require('commander');
const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const fs = require('fs').promises;
const path = require('path');

const program = new Command();

// Configuration
const DEFAULT_API_URL = process.env.AUTOWEAVE_API_URL || 'http://localhost:3000';
const API_BASE = `${DEFAULT_API_URL}/api/open-source`;

/**
 * Utility function to make API requests
 */
async function makeAPIRequest(endpoint, options = {}) {
    try {
        const response = await axios({
            url: `${API_BASE}${endpoint}`,
            method: options.method || 'GET',
            data: options.data,
            params: options.params,
            timeout: options.timeout || 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'AutoWeave-CLI/1.0.0'
            }
        });
        
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`API Error: ${error.response.data.error || error.message}`);
        } else if (error.request) {
            throw new Error(`Network Error: Unable to connect to AutoWeave API at ${API_BASE}`);
        } else {
            throw new Error(`Request Error: ${error.message}`);
        }
    }
}

/**
 * Format and display alternatives in a table
 */
function displayAlternatives(alternatives, tool) {
    if (!alternatives || alternatives.length === 0) {
        console.log(chalk.yellow(`No alternatives found for ${tool}`));
        return;
    }

    const table = new Table({
        head: [
            chalk.blue('Alternative'),
            chalk.blue('Reason'),
            chalk.blue('CNCF Status'),
            chalk.blue('Maturity'),
            chalk.blue('Est. Savings')
        ],
        colWidths: [20, 40, 15, 15, 15]
    });

    alternatives.forEach(alt => {
        const savings = alt.estimatedCostSaving 
            ? `$${alt.estimatedCostSaving.monthly || 0}/mo`
            : 'N/A';
        
        table.push([
            chalk.green(alt.name),
            alt.reason || 'N/A',
            alt.cncf_status || 'N/A',
            alt.maturity || 'N/A',
            savings
        ]);
    });

    console.log(`\n${chalk.bold('Open Source Alternatives for')} ${chalk.cyan(tool)}:`);
    console.log(table.toString());
}

/**
 * Command: discover-alternatives
 */
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
        const spinner = ora(`Discovering alternatives for ${tool}...`).start();
        
        try {
            const response = await makeAPIRequest('/alternatives', {
                params: {
                    tool,
                    includeDocker: options.docker,
                    includeNpm: options.npm,
                    includeHelm: options.helm
                }
            });

            spinner.succeed(`Found ${response.data.alternatives.length} alternatives for ${tool}`);

            if (options.output === 'json') {
                console.log(JSON.stringify(response.data, null, 2));
            } else if (options.output === 'csv') {
                const csv = response.data.alternatives.map(alt => 
                    `${alt.name},${alt.reason || ''},${alt.cncf_status || ''},${alt.maturity || ''}`
                ).join('\n');
                console.log('Name,Reason,CNCF Status,Maturity');
                console.log(csv);
            } else {
                displayAlternatives(response.data.alternatives, tool);
            }

            if (options.save) {
                await fs.writeFile(options.save, JSON.stringify(response.data, null, 2));
                console.log(chalk.green(`Results saved to ${options.save}`));
            }

        } catch (error) {
            spinner.fail(`Failed to discover alternatives: ${error.message}`);
            process.exit(1);
        }
    });

/**
 * Command: audit-licenses
 */
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
        const spinner = ora(`Auditing licenses in ${projectPath}...`).start();
        
        try {
            const response = await makeAPIRequest('/audit-licenses', {
                method: 'POST',
                data: {
                    projectPath: path.resolve(projectPath),
                    options: {
                        quickScan: options.quick,
                        targetLicense: options.target
                    }
                }
            });

            const audit = response.data;
            spinner.succeed(`License audit completed for ${projectPath}`);

            if (options.output === 'json') {
                console.log(JSON.stringify(audit, null, 2));
            } else if (options.output === 'report') {
                console.log(`\n${chalk.bold('License Compliance Report')}`);
                console.log(`${chalk.gray('=')} `.repeat(40));
                console.log(`${chalk.blue('Compliance Score:')} ${audit.summary.complianceScore}%`);
                console.log(`${chalk.blue('Risk Level:')} ${audit.summary.riskLevel}`);
                console.log(`${chalk.blue('Total Dependencies:')} ${audit.summary.totalDependencies}`);
                console.log(`${chalk.blue('License Types:')} ${audit.summary.licenseTypes.join(', ')}`);
                
                if (audit.recommendations && audit.recommendations.length > 0) {
                    console.log(`\n${chalk.bold('Recommendations:')}`);
                    audit.recommendations.forEach((rec, i) => {
                        console.log(`${i + 1}. ${rec}`);
                    });
                }
            } else {
                // Table format
                const table = new Table({
                    head: [
                        chalk.blue('Dependency'),
                        chalk.blue('License'),
                        chalk.blue('Risk'),
                        chalk.blue('Compatible')
                    ],
                    colWidths: [30, 20, 10, 12]
                });

                if (audit.licenseAnalysis && audit.licenseAnalysis.analyzed) {
                    audit.licenseAnalysis.analyzed.slice(0, 10).forEach(dep => {
                        const compatible = dep.compatible ? chalk.green('✓') : chalk.red('✗');
                        const risk = dep.risk === 'low' ? chalk.green(dep.risk) : 
                                   dep.risk === 'medium' ? chalk.yellow(dep.risk) : chalk.red(dep.risk);
                        
                        table.push([
                            dep.name,
                            dep.license,
                            risk,
                            compatible
                        ]);
                    });
                }

                console.log(`\n${chalk.bold('License Analysis Results:')}`);
                console.log(table.toString());
                
                console.log(`\n${chalk.blue('Compliance Score:')} ${audit.summary.complianceScore}%`);
                console.log(`${chalk.blue('Risk Level:')} ${audit.summary.riskLevel}`);
            }

            if (options.save) {
                await fs.writeFile(options.save, JSON.stringify(audit, null, 2));
                console.log(chalk.green(`Audit results saved to ${options.save}`));
            }

            if (options.failOnIssues && audit.summary.riskLevel === 'high') {
                console.log(chalk.red('Exiting with error due to high-risk license issues'));
                process.exit(1);
            }

        } catch (error) {
            spinner.fail(`License audit failed: ${error.message}`);
            process.exit(1);
        }
    });

/**
 * Command: compliance-score
 */
program
    .command('compliance-score')
    .alias('score')
    .description('Get compliance score for a project')
    .argument('[path]', 'Path to project directory', '.')
    .option('-o, --output <format>', 'Output format (simple, detailed, json)', 'simple')
    .action(async (projectPath, options) => {
        const spinner = ora(`Calculating compliance score for ${projectPath}...`).start();
        
        try {
            const response = await makeAPIRequest('/compliance-score', {
                params: {
                    projectPath: path.resolve(projectPath)
                }
            });

            const score = response.data;
            spinner.succeed(`Compliance score calculated for ${projectPath}`);

            if (options.output === 'json') {
                console.log(JSON.stringify(score, null, 2));
            } else if (options.output === 'detailed') {
                console.log(`\n${chalk.bold('Compliance Score Report')}`);
                console.log(`${chalk.gray('=')} `.repeat(40));
                console.log(`${chalk.blue('Project:')} ${score.projectPath}`);
                console.log(`${chalk.blue('Compliance Score:')} ${score.complianceScore}%`);
                console.log(`${chalk.blue('Risk Level:')} ${score.riskLevel}`);
                console.log(`${chalk.blue('Total Dependencies:')} ${score.totalDependencies}`);
                console.log(`${chalk.blue('License Types:')} ${score.licenseTypes.join(', ')}`);
                
                if (score.recommendations && score.recommendations.length > 0) {
                    console.log(`\n${chalk.bold('Top Recommendations:')}`);
                    score.recommendations.forEach((rec, i) => {
                        console.log(`${i + 1}. ${rec}`);
                    });
                }
            } else {
                // Simple format
                const scoreColor = score.complianceScore >= 80 ? chalk.green : 
                                 score.complianceScore >= 60 ? chalk.yellow : chalk.red;
                
                console.log(`\n${chalk.bold('Compliance Score:')} ${scoreColor(score.complianceScore + '%')}`);
                console.log(`${chalk.blue('Risk Level:')} ${score.riskLevel}`);
                console.log(`${chalk.blue('Dependencies:')} ${score.totalDependencies}`);
            }

        } catch (error) {
            spinner.fail(`Failed to calculate compliance score: ${error.message}`);
            process.exit(1);
        }
    });

/**
 * Command: migrate-to-oss
 */
program
    .command('migrate-to-oss')
    .alias('migrate')
    .description('Generate migration plan to open source alternatives')
    .argument('<from-tool>', 'Tool to migrate from')
    .argument('<to-tool>', 'Tool to migrate to')
    .option('-o, --output <format>', 'Output format (table, json, plan)', 'plan')
    .option('-s, --save <file>', 'Save plan to file')
    .action(async (fromTool, toTool, options) => {
        const spinner = ora(`Generating migration plan from ${fromTool} to ${toTool}...`).start();
        
        try {
            const response = await makeAPIRequest('/migration-plan', {
                method: 'POST',
                data: {
                    fromTool,
                    toTool
                }
            });

            const plan = response.data;
            spinner.succeed(`Migration plan generated successfully`);

            if (options.output === 'json') {
                console.log(JSON.stringify(plan, null, 2));
            } else if (options.output === 'plan') {
                console.log(`\n${chalk.bold('Migration Plan:')}`);
                console.log(`${chalk.blue('From:')} ${fromTool}`);
                console.log(`${chalk.blue('To:')} ${toTool}`);
                
                if (plan.phases && plan.phases.length > 0) {
                    console.log(`\n${chalk.bold('Migration Phases:')}`);
                    plan.phases.forEach((phase, i) => {
                        console.log(`\n${chalk.yellow(`Phase ${i + 1}: ${phase.phase}`)}`);
                        console.log(`${chalk.blue('Duration:')} ${phase.duration}`);
                        if (phase.tasks && phase.tasks.length > 0) {
                            console.log(`${chalk.blue('Tasks:')}`);
                            phase.tasks.forEach(task => {
                                console.log(`  • ${task}`);
                            });
                        }
                    });
                }
                
                if (plan.estimatedSavings) {
                    console.log(`\n${chalk.bold('Cost Savings:')}`);
                    console.log(`${chalk.blue('Monthly:')} $${plan.estimatedSavings.monthly || 0}`);
                    console.log(`${chalk.blue('Yearly:')} $${plan.estimatedSavings.yearly || 0}`);
                }
                
                if (plan.riskAssessment) {
                    console.log(`\n${chalk.blue('Risk Assessment:')} ${plan.riskAssessment}`);
                }
            } else {
                // Table format
                const table = new Table({
                    head: [chalk.blue('Phase'), chalk.blue('Duration'), chalk.blue('Tasks')],
                    colWidths: [15, 15, 50]
                });

                if (plan.phases) {
                    plan.phases.forEach(phase => {
                        table.push([
                            phase.phase,
                            phase.duration,
                            phase.tasks ? phase.tasks.join(', ') : 'N/A'
                        ]);
                    });
                }

                console.log(`\n${chalk.bold('Migration Plan:')} ${fromTool} → ${toTool}`);
                console.log(table.toString());
            }

            if (options.save) {
                await fs.writeFile(options.save, JSON.stringify(plan, null, 2));
                console.log(chalk.green(`Migration plan saved to ${options.save}`));
            }

        } catch (error) {
            spinner.fail(`Failed to generate migration plan: ${error.message}`);
            process.exit(1);
        }
    });

/**
 * Command: cost-analysis
 */
program
    .command('cost-analysis')
    .alias('cost')
    .description('Analyze cost savings from open source adoption')
    .argument('[tools]', 'Comma-separated list of tools to analyze')
    .option('-p, --path <path>', 'Project path to analyze')
    .option('-o, --output <format>', 'Output format (table, json, summary)', 'table')
    .option('-s, --save <file>', 'Save results to file')
    .action(async (tools, options) => {
        const spinner = ora('Analyzing cost savings...').start();
        
        try {
            const params = {};
            if (tools) {
                params.tools = tools;
            }
            if (options.path) {
                params.projectPath = path.resolve(options.path);
            }
            
            if (!tools && !options.path) {
                throw new Error('Either tools list or project path is required');
            }

            const response = await makeAPIRequest('/cost-analysis', { params });
            const analysis = response.data;
            
            spinner.succeed('Cost analysis completed');

            if (options.output === 'json') {
                console.log(JSON.stringify(analysis, null, 2));
            } else if (options.output === 'summary') {
                console.log(`\n${chalk.bold('Cost Savings Summary')}`);
                console.log(`${chalk.gray('=')} `.repeat(40));
                console.log(`${chalk.blue('Monthly Savings:')} $${analysis.totalSavings.monthly}`);
                console.log(`${chalk.blue('Yearly Savings:')} $${analysis.totalSavings.yearly}`);
                console.log(`${chalk.blue('Tools Analyzed:')} ${analysis.toolAnalysis.length}`);
            } else {
                // Table format
                const table = new Table({
                    head: [
                        chalk.blue('Tool'),
                        chalk.blue('Alternative'),
                        chalk.blue('Monthly Savings'),
                        chalk.blue('Complexity'),
                        chalk.blue('Recommendation')
                    ],
                    colWidths: [20, 20, 15, 15, 15]
                });

                analysis.toolAnalysis.forEach(tool => {
                    table.push([
                        tool.tool,
                        tool.alternative,
                        `$${tool.estimatedSavings.monthly || 0}`,
                        tool.migrationComplexity,
                        tool.recommendationLevel
                    ]);
                });

                console.log(`\n${chalk.bold('Cost Analysis Results:')}`);
                console.log(table.toString());
                
                console.log(`\n${chalk.bold('Total Savings:')}`);
                console.log(`${chalk.blue('Monthly:')} $${analysis.totalSavings.monthly}`);
                console.log(`${chalk.blue('Yearly:')} $${analysis.totalSavings.yearly}`);
            }

            if (options.save) {
                await fs.writeFile(options.save, JSON.stringify(analysis, null, 2));
                console.log(chalk.green(`Cost analysis saved to ${options.save}`));
            }

        } catch (error) {
            spinner.fail(`Cost analysis failed: ${error.message}`);
            process.exit(1);
        }
    });

/**
 * Command: cncf-check
 */
program
    .command('cncf-check')
    .alias('cncf')
    .description('Check CNCF compliance for a project')
    .argument('[path]', 'Path to project directory', '.')
    .option('-o, --output <format>', 'Output format (table, json, report)', 'report')
    .option('-s, --save <file>', 'Save results to file')
    .action(async (projectPath, options) => {
        const spinner = ora(`Checking CNCF compliance for ${projectPath}...`).start();
        
        try {
            const response = await makeAPIRequest('/cncf-check', {
                method: 'POST',
                data: {
                    projectPath: path.resolve(projectPath)
                }
            });

            const compliance = response.data;
            spinner.succeed(`CNCF compliance check completed`);

            if (options.output === 'json') {
                console.log(JSON.stringify(compliance, null, 2));
            } else if (options.output === 'report') {
                console.log(`\n${chalk.bold('CNCF Compliance Report')}`);
                console.log(`${chalk.gray('=')} `.repeat(40));
                console.log(`${chalk.blue('Overall Status:')} ${compliance.overall}`);
                console.log(`${chalk.blue('Compliance Score:')} ${compliance.score}%`);
                console.log(`${chalk.blue('CNCF Components:')} ${compliance.cncfComponents}/${compliance.totalComponents}`);
                console.log(`${chalk.blue('CNCF Percentage:')} ${compliance.cncfPercentage}%`);
                
                if (compliance.recommendations && compliance.recommendations.length > 0) {
                    console.log(`\n${chalk.bold('Recommendations:')}`);
                    compliance.recommendations.forEach((rec, i) => {
                        console.log(`${i + 1}. ${rec.recommendation} (${rec.tool})`);
                    });
                }
            } else {
                // Table format
                const table = new Table({
                    head: [
                        chalk.blue('Tool'),
                        chalk.blue('License'),
                        chalk.blue('CNCF'),
                        chalk.blue('Open Source')
                    ],
                    colWidths: [30, 20, 10, 12]
                });

                if (compliance.details && compliance.details.cncfTools) {
                    compliance.details.cncfTools.forEach(tool => {
                        const cncfStatus = tool.cncf ? chalk.green('✓') : chalk.red('✗');
                        const osStatus = tool.openSource ? chalk.green('✓') : chalk.red('✗');
                        
                        table.push([
                            tool.name,
                            tool.license,
                            cncfStatus,
                            osStatus
                        ]);
                    });
                }

                console.log(`\n${chalk.bold('CNCF Compliance Check:')}`);
                console.log(table.toString());
                
                console.log(`\n${chalk.blue('CNCF Percentage:')} ${compliance.cncfPercentage}%`);
                console.log(`${chalk.blue('Overall Status:')} ${compliance.overall}`);
            }

            if (options.save) {
                await fs.writeFile(options.save, JSON.stringify(compliance, null, 2));
                console.log(chalk.green(`CNCF compliance report saved to ${options.save}`));
            }

        } catch (error) {
            spinner.fail(`CNCF compliance check failed: ${error.message}`);
            process.exit(1);
        }
    });

/**
 * Command: health
 */
program
    .command('health')
    .description('Check health of open source services')
    .option('-o, --output <format>', 'Output format (simple, detailed, json)', 'simple')
    .action(async (options) => {
        const spinner = ora('Checking open source services health...').start();
        
        try {
            const response = await makeAPIRequest('/health');
            const health = response.data;
            
            spinner.succeed('Health check completed');

            if (options.output === 'json') {
                console.log(JSON.stringify(health, null, 2));
            } else if (options.output === 'detailed') {
                console.log(`\n${chalk.bold('Open Source Services Health')}`);
                console.log(`${chalk.gray('=')} `.repeat(40));
                console.log(`${chalk.blue('Overall Status:')} ${health.status}`);
                
                console.log(`\n${chalk.bold('Services:')}`);
                Object.entries(health.services).forEach(([service, status]) => {
                    const statusColor = status === 'healthy' ? chalk.green : chalk.red;
                    console.log(`  ${service}: ${statusColor(status)}`);
                });
            } else {
                // Simple format
                const statusColor = health.status === 'healthy' ? chalk.green : chalk.red;
                console.log(`\n${chalk.bold('Health Status:')} ${statusColor(health.status)}`);
                
                const healthyServices = Object.values(health.services).filter(s => s === 'healthy').length;
                const totalServices = Object.keys(health.services).length;
                console.log(`${chalk.blue('Services:')} ${healthyServices}/${totalServices} healthy`);
            }

        } catch (error) {
            spinner.fail(`Health check failed: ${error.message}`);
            process.exit(1);
        }
    });

// Global options
program
    .version('1.0.0')
    .description('AutoWeave Open Source CLI - Discover alternatives and manage license compliance')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--api-url <url>', 'AutoWeave API URL', DEFAULT_API_URL);

// Error handling
program.on('command:*', () => {
    console.error(chalk.red('Invalid command: %s'), program.args.join(' '));
    console.log(chalk.blue('Run "autoweave open-source --help" for available commands'));
    process.exit(1);
});

// Parse arguments
if (process.argv.length === 2) {
    program.help();
}

program.parse(process.argv);

module.exports = program;