const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class DevLogger {
    constructor(sessionId = null) {
        this.sessionId = sessionId || `session-${Date.now()}`;
        this.progressFile = path.join(__dirname, '../../docs/development-progress.md');
        this.startTime = Date.now();
        this.milestones = [];
        
        // Ensure docs directory exists
        this.ensureDocsDirectory();
        
        // Initialize progress file
        this.initializeProgressFile();
    }

    ensureDocsDirectory() {
        const docsDir = path.dirname(this.progressFile);
        if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
        }
    }

    initializeProgressFile() {
        const header = `# Development Progress - Appsmith Integration

**Session ID:** ${this.sessionId}  
**Started:** ${new Date().toISOString()}  
**Project:** AutoWeave + Appsmith Integration

## Overview
This document tracks the real-time progress of integrating Appsmith as the web UI for AutoWeave.

## Milestones Log

`;
        
        fs.writeFileSync(this.progressFile, header);
        console.log(chalk.blue(`📋 DevLogger initialized - Session: ${this.sessionId}`));
    }

    milestone(phase, task, status, metadata = {}) {
        const timestamp = new Date().toISOString();
        const duration = metadata.durationSeconds || Math.round((Date.now() - this.startTime) / 1000);
        
        const milestone = {
            phase,
            task,
            status,
            timestamp,
            duration,
            metadata
        };
        
        this.milestones.push(milestone);
        
        // Log to console
        this.logToConsole(milestone);
        
        // Update progress file
        this.updateProgressFile(milestone);
        
        return milestone;
    }

    logToConsole(milestone) {
        const statusColor = {
            'completed': 'green',
            'failed': 'red',
            'started': 'yellow',
            'in_progress': 'blue'
        };
        
        const color = statusColor[milestone.status] || 'white';
        const statusIcon = {
            'completed': '✅',
            'failed': '❌',
            'started': '🚀',
            'in_progress': '⏳'
        };
        
        const icon = statusIcon[milestone.status] || '📋';
        
        console.log(chalk[color](
            `${icon} [${milestone.phase}] ${milestone.task}: ${milestone.status.toUpperCase()}`
        ));
        
        if (milestone.metadata && Object.keys(milestone.metadata).length > 0) {
            console.log(chalk.gray(`   └─ ${JSON.stringify(milestone.metadata, null, 2)}`));
        }
    }

    updateProgressFile(milestone) {
        const statusEmoji = {
            'completed': '✅',
            'failed': '❌',
            'started': '🚀',
            'in_progress': '⏳'
        };
        
        const icon = statusEmoji[milestone.status] || '📋';
        
        const entry = `### ${icon} [${milestone.phase}] ${milestone.task}

**Status:** ${milestone.status}  
**Timestamp:** ${milestone.timestamp}  
**Duration:** ${milestone.duration}s  

${milestone.metadata && Object.keys(milestone.metadata).length > 0 ? 
    `**Metadata:**\n\`\`\`json\n${JSON.stringify(milestone.metadata, null, 2)}\n\`\`\`\n` : ''
}

---

`;
        
        fs.appendFileSync(this.progressFile, entry);
    }

    phase(phaseName, description = '') {
        const entry = `## Phase: ${phaseName}

${description}

`;
        fs.appendFileSync(this.progressFile, entry);
        console.log(chalk.magenta(`🔄 Phase: ${phaseName}`));
    }

    summary() {
        const completedCount = this.milestones.filter(m => m.status === 'completed').length;
        const failedCount = this.milestones.filter(m => m.status === 'failed').length;
        const totalDuration = Math.round((Date.now() - this.startTime) / 1000);
        
        const summary = `
## Session Summary

**Total Milestones:** ${this.milestones.length}  
**Completed:** ${completedCount}  
**Failed:** ${failedCount}  
**Total Duration:** ${totalDuration}s  
**Success Rate:** ${Math.round((completedCount / this.milestones.length) * 100)}%

### Timeline

${this.milestones.map(m => 
    `- **${m.timestamp}** - [${m.phase}] ${m.task}: ${m.status}`
).join('\n')}

---
*Generated by DevLogger - AutoWeave Project*
`;
        
        fs.appendFileSync(this.progressFile, summary);
        
        console.log(chalk.cyan('📊 Session Summary:'));
        console.log(chalk.cyan(`   Total: ${this.milestones.length} | Completed: ${completedCount} | Failed: ${failedCount}`));
        console.log(chalk.cyan(`   Duration: ${totalDuration}s | Success Rate: ${Math.round((completedCount / this.milestones.length) * 100)}%`));
        
        return {
            total: this.milestones.length,
            completed: completedCount,
            failed: failedCount,
            duration: totalDuration,
            successRate: Math.round((completedCount / this.milestones.length) * 100)
        };
    }

    getCurrentProgress() {
        return {
            sessionId: this.sessionId,
            startTime: this.startTime,
            milestones: this.milestones,
            progressFile: this.progressFile
        };
    }
}

// Singleton instance for global use
let globalDevLogger = null;

function getDevLogger() {
    if (!globalDevLogger) {
        globalDevLogger = new DevLogger();
    }
    return globalDevLogger;
}

module.exports = { DevLogger, getDevLogger };