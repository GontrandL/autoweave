/**
 * @autoweave/core - Core orchestration engine
 */

module.exports = {
    AutoWeave: require('./autoweave.js').AutoWeave,
    AgentWeaver: require('./agent-weaver.js').AgentWeaver,
    ConfigurationIntelligence: require('./config-intelligence.js').ConfigurationIntelligence,
    Logger: require('./logger.js')
};