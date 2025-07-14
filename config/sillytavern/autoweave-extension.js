/**
 * AutoWeave Extension for SillyTavern
 * Provides integration with AutoWeave agent orchestration system
 */

(() => {
    'use strict';

    // Extension configuration
    const EXTENSION_NAME = 'autoweave';
    const EXTENSION_DISPLAY_NAME = 'AutoWeave';
    const AUTOWEAVE_API_URL = 'http://172.19.0.1:3000'; // Kind Docker Gateway IP

    // Extension state
    let isEnabled = false;
    let autoweaveAgents = [];
    let currentAgentId = null;

    // UI Elements
    let extensionButton;
    let extensionPanel;
    let agentsList;
    let createAgentForm;

    /**
     * Initialize the extension
     */
    function init() {
        console.log(`[${EXTENSION_NAME}] Initializing AutoWeave extension...`);
        
        // Create UI elements
        createUI();
        
        // Register slash commands
        registerSlashCommands();
        
        // Load saved settings
        loadSettings();
        
        // Refresh agents list
        refreshAgents();
        
        console.log(`[${EXTENSION_NAME}] Extension initialized successfully`);
    }

    /**
     * Create the extension UI
     */
    function createUI() {
        // Create extension button in toolbar
        extensionButton = $(`
            <div id="autoweave-button" class="menu_button fa-solid fa-robot" 
                 title="AutoWeave Agent Manager" style="color: #4CAF50;">
            </div>
        `);
        
        extensionButton.on('click', togglePanel);
        $('#send_but_sheld').prepend(extensionButton);

        // Create extension panel
        extensionPanel = $(`
            <div id="autoweave-panel" class="drawer-content" style="display: none;">
                <div class="drawer-header">
                    <h3>AutoWeave Agent Manager</h3>
                    <div class="drawer-controls">
                        <button id="autoweave-refresh" class="menu_button fa-solid fa-refresh" 
                                title="Refresh Agents"></button>
                        <button id="autoweave-close" class="menu_button fa-solid fa-times" 
                                title="Close"></button>
                    </div>
                </div>
                
                <div class="drawer-body">
                    <!-- Agent Creation Form -->
                    <div class="autoweave-section">
                        <h4>Create New Agent</h4>
                        <form id="autoweave-create-form">
                            <div class="form-group">
                                <label for="agent-description">Agent Description:</label>
                                <textarea id="agent-description" class="text_pole" rows="3" 
                                          placeholder="Describe what you want the agent to do..."></textarea>
                            </div>
                            <button type="submit" class="menu_button">Create Agent</button>
                        </form>
                    </div>
                    
                    <!-- Agents List -->
                    <div class="autoweave-section">
                        <h4>Active Agents</h4>
                        <div id="autoweave-agents-list">
                            <div class="loading">Loading agents...</div>
                        </div>
                    </div>
                    
                    <!-- Connection Status -->
                    <div class="autoweave-section">
                        <h4>Connection Status</h4>
                        <div id="autoweave-status">
                            <span class="status-indicator" id="autoweave-status-indicator">●</span>
                            <span id="autoweave-status-text">Checking connection...</span>
                        </div>
                    </div>
                </div>
            </div>
        `);

        // Add panel to page
        $('#extensions_panel').append(extensionPanel);

        // Bind events
        $('#autoweave-close').on('click', hidePanel);
        $('#autoweave-refresh').on('click', refreshAgents);
        $('#autoweave-create-form').on('submit', createAgent);

        // Add styles
        addStyles();
    }

    /**
     * Add custom styles for the extension
     */
    function addStyles() {
        const styles = `
            <style id="autoweave-styles">
                #autoweave-panel {
                    position: fixed;
                    top: 50px;
                    right: 20px;
                    width: 400px;
                    max-height: 600px;
                    background: var(--SmartThemeBodyColor);
                    border: 1px solid var(--SmartThemeBorderColor);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 1000;
                    overflow-y: auto;
                }

                .drawer-header {
                    background: var(--SmartThemeQuoteColor);
                    padding: 15px;
                    border-bottom: 1px solid var(--SmartThemeBorderColor);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .drawer-header h3 {
                    margin: 0;
                    color: var(--SmartThemeEmColor);
                }

                .drawer-controls {
                    display: flex;
                    gap: 10px;
                }

                .drawer-body {
                    padding: 15px;
                }

                .autoweave-section {
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid var(--SmartThemeBorderColor);
                }

                .autoweave-section:last-child {
                    border-bottom: none;
                }

                .autoweave-section h4 {
                    margin: 0 0 10px 0;
                    color: var(--SmartThemeEmColor);
                }

                .agent-item {
                    background: var(--SmartThemeQuoteColor);
                    padding: 10px;
                    margin: 5px 0;
                    border-radius: 4px;
                    border-left: 4px solid #4CAF50;
                }

                .agent-item.selected {
                    border-left-color: #FF9800;
                }

                .agent-name {
                    font-weight: bold;
                    color: var(--SmartThemeEmColor);
                }

                .agent-description {
                    color: var(--SmartThemeBodyColor);
                    font-size: 0.9em;
                    margin: 5px 0;
                }

                .agent-status {
                    font-size: 0.8em;
                    color: var(--SmartThemeQuoteColor);
                }

                .agent-controls {
                    margin-top: 8px;
                }

                .agent-controls button {
                    margin-right: 5px;
                    padding: 4px 8px;
                    font-size: 0.8em;
                }

                .status-indicator {
                    font-size: 1.2em;
                    margin-right: 8px;
                }

                .status-connected {
                    color: #4CAF50;
                }

                .status-disconnected {
                    color: #f44336;
                }

                .loading {
                    text-align: center;
                    color: var(--SmartThemeQuoteColor);
                    padding: 20px;
                }

                .form-group {
                    margin-bottom: 15px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    color: var(--SmartThemeEmColor);
                }

                #agent-description {
                    width: 100%;
                    min-height: 60px;
                    resize: vertical;
                }
            </style>
        `;
        
        $('head').append(styles);
    }

    /**
     * Register slash commands
     */
    function registerSlashCommands() {
        // Register /autoweave command
        registerSlashCommand('autoweave', autoweaveCommand, [], '<action> [args] - AutoWeave agent management', true, true);
        
        // Register /createagent command
        registerSlashCommand('createagent', createAgentCommand, [], '<description> - Create a new AutoWeave agent', true, true);
        
        // Register /listagents command
        registerSlashCommand('listagents', listAgentsCommand, [], '- List all AutoWeave agents', true, true);
    }

    /**
     * Handle /autoweave slash command
     */
    function autoweaveCommand(args) {
        const action = args.toLowerCase();
        
        switch (action) {
            case 'panel':
            case 'show':
                showPanel();
                return '';
            case 'hide':
                hidePanel();
                return '';
            case 'refresh':
                refreshAgents();
                return 'Refreshing agents...';
            case 'status':
                checkConnectionStatus();
                return 'Checking connection status...';
            default:
                return 'Available commands: show, hide, refresh, status';
        }
    }

    /**
     * Handle /createagent slash command
     */
    function createAgentCommand(args) {
        if (!args || args.trim() === '') {
            return 'Please provide a description for the agent.';
        }
        
        createAgentFromDescription(args.trim());
        return `Creating agent: ${args.trim()}`;
    }

    /**
     * Handle /listagents slash command
     */
    function listAgentsCommand() {
        refreshAgents();
        showPanel();
        return 'Showing agents panel...';
    }

    /**
     * Toggle the extension panel
     */
    function togglePanel() {
        if (extensionPanel.is(':visible')) {
            hidePanel();
        } else {
            showPanel();
        }
    }

    /**
     * Show the extension panel
     */
    function showPanel() {
        extensionPanel.show();
        checkConnectionStatus();
    }

    /**
     * Hide the extension panel
     */
    function hidePanel() {
        extensionPanel.hide();
    }

    /**
     * Create a new agent
     */
    function createAgent(event) {
        event.preventDefault();
        
        const description = $('#agent-description').val().trim();
        if (!description) {
            toastr.error('Please enter an agent description');
            return;
        }
        
        createAgentFromDescription(description);
        $('#agent-description').val('');
    }

    /**
     * Create agent from description
     */
    async function createAgentFromDescription(description) {
        try {
            toastr.info('Creating agent...');
            
            const response = await fetch(`${AUTOWEAVE_API_URL}/api/agents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ description })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            toastr.success(`Agent "${result.workflow.name}" created successfully!`);
            refreshAgents();
            
        } catch (error) {
            console.error('Error creating agent:', error);
            toastr.error(`Failed to create agent: ${error.message}`);
        }
    }

    /**
     * Refresh the agents list
     */
    async function refreshAgents() {
        try {
            const response = await fetch(`${AUTOWEAVE_API_URL}/api/agents`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            autoweaveAgents = await response.json();
            updateAgentsList();
            
        } catch (error) {
            console.error('Error refreshing agents:', error);
            $('#autoweave-agents-list').html(
                '<div class="error">Failed to load agents. Check connection.</div>'
            );
        }
    }

    /**
     * Update the agents list UI
     */
    function updateAgentsList() {
        if (autoweaveAgents.length === 0) {
            $('#autoweave-agents-list').html(
                '<div class="empty">No agents found. Create your first agent!</div>'
            );
            return;
        }
        
        const agentsHtml = autoweaveAgents.map(agent => `
            <div class="agent-item ${agent.id === currentAgentId ? 'selected' : ''}" 
                 data-agent-id="${agent.id}">
                <div class="agent-name">${agent.name}</div>
                <div class="agent-description">${agent.description}</div>
                <div class="agent-status">Status: ${agent.status}</div>
                <div class="agent-controls">
                    <button class="menu_button select-agent" data-agent-id="${agent.id}">
                        ${agent.id === currentAgentId ? 'Selected' : 'Select'}
                    </button>
                    <button class="menu_button delete-agent" data-agent-id="${agent.id}">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
        
        $('#autoweave-agents-list').html(agentsHtml);
        
        // Bind events
        $('.select-agent').on('click', selectAgent);
        $('.delete-agent').on('click', deleteAgent);
    }

    /**
     * Select an agent
     */
    function selectAgent(event) {
        const agentId = $(event.target).data('agent-id');
        const agent = autoweaveAgents.find(a => a.id === agentId);
        
        if (agent) {
            currentAgentId = agentId;
            updateAgentsList();
            toastr.success(`Selected agent: ${agent.name}`);
            
            // Add agent context to the current chat
            const contextMessage = `[AutoWeave Agent: ${agent.name}] ${agent.description}`;
            $('#send_textarea').val(contextMessage);
        }
    }

    /**
     * Delete an agent
     */
    async function deleteAgent(event) {
        const agentId = $(event.target).data('agent-id');
        const agent = autoweaveAgents.find(a => a.id === agentId);
        
        if (!agent) return;
        
        if (!confirm(`Are you sure you want to delete agent "${agent.name}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`${AUTOWEAVE_API_URL}/api/agents/${agentId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            toastr.success(`Agent "${agent.name}" deleted successfully`);
            
            if (currentAgentId === agentId) {
                currentAgentId = null;
            }
            
            refreshAgents();
            
        } catch (error) {
            console.error('Error deleting agent:', error);
            toastr.error(`Failed to delete agent: ${error.message}`);
        }
    }

    /**
     * Check connection status
     */
    async function checkConnectionStatus() {
        try {
            const response = await fetch(`${AUTOWEAVE_API_URL}/health`);
            
            if (response.ok) {
                $('#autoweave-status-indicator').removeClass('status-disconnected').addClass('status-connected');
                $('#autoweave-status-text').text('Connected to AutoWeave');
            } else {
                throw new Error('Health check failed');
            }
            
        } catch (error) {
            $('#autoweave-status-indicator').removeClass('status-connected').addClass('status-disconnected');
            $('#autoweave-status-text').text('Disconnected from AutoWeave');
        }
    }

    /**
     * Load saved settings
     */
    function loadSettings() {
        const settings = extension_settings[EXTENSION_NAME] || {};
        currentAgentId = settings.currentAgentId || null;
    }

    /**
     * Save settings
     */
    function saveSettings() {
        if (!extension_settings[EXTENSION_NAME]) {
            extension_settings[EXTENSION_NAME] = {};
        }
        
        extension_settings[EXTENSION_NAME].currentAgentId = currentAgentId;
        saveSettingsDebounced();
    }

    /**
     * Extension cleanup
     */
    function cleanup() {
        $('#autoweave-button').remove();
        $('#autoweave-panel').remove();
        $('#autoweave-styles').remove();
    }

    // Initialize extension when DOM is ready
    $(document).ready(() => {
        // Wait for SillyTavern to be fully loaded
        if (typeof extension_settings !== 'undefined') {
            init();
        } else {
            setTimeout(init, 1000);
        }
    });

    // Export for debugging
    window.autoweaveExtension = {
        refreshAgents,
        createAgentFromDescription,
        checkConnectionStatus,
        showPanel,
        hidePanel
    };

})();