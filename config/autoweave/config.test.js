const baseConfig = require('./config');

// Set test environment
process.env.NODE_ENV = 'test';

module.exports = {
    ...baseConfig,
    port: 3001,
    logLevel: 'error',
    kagent: {
        ...baseConfig.kagent,
        namespace: 'autoweave-test',
        timeout: 5000
    },
    kubernetes: {
        ...baseConfig.kubernetes,
        inCluster: false
    }
};