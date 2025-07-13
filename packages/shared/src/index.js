/**
 * @autoweave/shared - Shared utilities and helpers
 */

// Re-export utilities
const utilsPath = './utils';
const fs = require('fs');
const path = require('path');

const exports = {};

// Dynamically export all utils
if (fs.existsSync(path.join(__dirname, 'utils'))) {
    const files = fs.readdirSync(path.join(__dirname, 'utils'));
    files.forEach(file => {
        if (file.endsWith('.js')) {
            const name = file.replace('.js', '');
            const moduleName = name.charAt(0).toUpperCase() + name.slice(1);
            try {
                exports[moduleName] = require(path.join(__dirname, 'utils', file));
            } catch (error) {
                console.warn(`Failed to load utility ${file}:`, error.message);
            }
        }
    });
}

// Export mock configuration and test utilities
exports.mockConfig = require('./mock-config');
exports.EnvironmentValidator = require('./env-validator');
exports.testUtils = require('./test-utils');

module.exports = exports;
