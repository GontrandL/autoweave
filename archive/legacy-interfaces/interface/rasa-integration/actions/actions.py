"""
AutoWeave Custom Actions for Rasa
This module provides custom actions that integrate Rasa with AutoWeave API
"""

from typing import Any, Text, Dict, List
import requests
import json
import logging
from datetime import datetime

from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet, BotUttered, UserUttered
from rasa_sdk.forms import FormValidationAction

# ==========================================================
# CONFIGURATION
# ==========================================================

AUTOWEAVE_API_URL = "http://localhost:3002"
AUTOWEAVE_API_KEY = "autoweave-api-key"
AUTOWEAVE_TIMEOUT = 30

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==========================================================
# HELPER FUNCTIONS
# ==========================================================

def make_autoweave_request(endpoint: str, method: str = "GET", data: Dict = None) -> Dict:
    """Make a request to AutoWeave API"""
    url = f"{AUTOWEAVE_API_URL}{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {AUTOWEAVE_API_KEY}"
    }
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=AUTOWEAVE_TIMEOUT)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=AUTOWEAVE_TIMEOUT)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=AUTOWEAVE_TIMEOUT)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        response.raise_for_status()
        return response.json()
    
    except requests.exceptions.RequestException as e:
        logger.error(f"AutoWeave API request failed: {e}")
        return {"error": str(e)}

def format_agent_list(agents: List[Dict]) -> str:
    """Format agent list for display"""
    if not agents:
        return "No agents found."
    
    formatted = "\n"
    for agent in agents:
        status_emoji = "🟢" if agent.get("status") == "active" else "🔴"
        formatted += f"{status_emoji} **{agent.get('name', 'Unknown')}** ({agent.get('id', 'no-id')})\n"
        formatted += f"   {agent.get('description', 'No description')}\n"
        formatted += f"   Created: {agent.get('createdAt', 'Unknown')}\n\n"
    
    return formatted

def format_workflow_list(workflows: List[Dict]) -> str:
    """Format workflow list for display"""
    if not workflows:
        return "No workflows found."
    
    formatted = "\n"
    for workflow in workflows:
        status_emoji = "▶️" if workflow.get("status") == "active" else "⏸️"
        formatted += f"{status_emoji} **{workflow.get('name', 'Unknown')}** ({workflow.get('id', 'no-id')})\n"
        formatted += f"   {workflow.get('description', 'No description')}\n"
        formatted += f"   Steps: {len(workflow.get('steps', []))}\n\n"
    
    return formatted

def format_memory_results(results: List[Dict]) -> str:
    """Format memory search results for display"""
    if not results:
        return "No results found in memory."
    
    formatted = "\n"
    for result in results:
        formatted += f"📝 **{result.get('type', 'Unknown')}** memory\n"
        formatted += f"   {result.get('content', 'No content')[:100]}...\n"
        formatted += f"   Timestamp: {result.get('timestamp', 'Unknown')}\n\n"
    
    return formatted

def format_system_status(status: Dict) -> str:
    """Format system status for display"""
    overall_status = status.get("status", "unknown")
    status_emoji = "🟢" if overall_status == "healthy" else "🔴"
    
    formatted = f"{status_emoji} **System Status: {overall_status.upper()}**\n\n"
    
    components = status.get("components", {})
    for component, details in components.items():
        comp_status = details.get("status", "unknown")
        comp_emoji = "✅" if comp_status in ["healthy", "running", "mock"] else "❌"
        formatted += f"{comp_emoji} {component}: {comp_status}\n"
    
    formatted += f"\n⏰ Uptime: {status.get('uptime', 'Unknown')} seconds"
    return formatted

# ==========================================================
# AGENT MANAGEMENT ACTIONS
# ==========================================================

class ActionCreateAgent(Action):
    """Create a new agent in AutoWeave"""
    
    def name(self) -> Text:
        return "action_create_agent"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Get agent description from slot or entity
        agent_description = tracker.get_slot("agent_description") or \
                          next(tracker.get_latest_entity_values("agent_description"), None)
        
        if not agent_description:
            dispatcher.utter_message(text="I need a description of what the agent should do.")
            return []
        
        # Create agent via AutoWeave API
        response = make_autoweave_request(
            "/api/agents",
            method="POST",
            data={"description": agent_description}
        )
        
        if "error" in response:
            dispatcher.utter_message(text=f"❌ Failed to create agent: {response['error']}")
            return []
        
        # Extract agent information
        agent_name = response.get("workflow", {}).get("name", "Unknown")
        agent_id = response.get("id", "unknown")
        
        dispatcher.utter_message(
            text=f"✅ Agent **{agent_name}** created successfully!\n"
                 f"ID: {agent_id}\n"
                 f"Description: {agent_description}"
        )
        
        return [SlotSet("agent_name", agent_name), SlotSet("agent_id", agent_id)]

class ActionListAgents(Action):
    """List all agents in AutoWeave"""
    
    def name(self) -> Text:
        return "action_list_agents"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        response = make_autoweave_request("/api/agents")
        
        if "error" in response:
            dispatcher.utter_message(text=f"❌ Failed to retrieve agents: {response['error']}")
            return []
        
        agents = response.get("agents", [])
        formatted_list = format_agent_list(agents)
        
        dispatcher.utter_message(text=f"📋 Your active agents:{formatted_list}")
        
        return []

class ActionDeleteAgent(Action):
    """Delete an agent from AutoWeave"""
    
    def name(self) -> Text:
        return "action_delete_agent"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Get agent name or ID
        agent_name = tracker.get_slot("agent_name") or \
                    next(tracker.get_latest_entity_values("agent_name"), None)
        agent_id = tracker.get_slot("agent_id") or \
                  next(tracker.get_latest_entity_values("agent_id"), None)
        
        if not agent_name and not agent_id:
            dispatcher.utter_message(text="Please specify which agent to delete.")
            return []
        
        # If we have agent_name, we need to find the ID first
        if agent_name and not agent_id:
            agents_response = make_autoweave_request("/api/agents")
            if "error" not in agents_response:
                agents = agents_response.get("agents", [])
                agent = next((a for a in agents if a.get("name") == agent_name), None)
                if agent:
                    agent_id = agent.get("id")
                else:
                    dispatcher.utter_message(text=f"❌ Agent '{agent_name}' not found.")
                    return []
        
        # Delete agent
        response = make_autoweave_request(f"/api/agents/{agent_id}", method="DELETE")
        
        if "error" in response:
            dispatcher.utter_message(text=f"❌ Failed to delete agent: {response['error']}")
            return []
        
        dispatcher.utter_message(text=f"✅ Agent '{agent_name or agent_id}' deleted successfully.")
        
        return [SlotSet("agent_name", None), SlotSet("agent_id", None)]

class ActionGetAgentStatus(Action):
    """Get status of agents"""
    
    def name(self) -> Text:
        return "action_get_agent_status"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Get system health
        health_response = make_autoweave_request("/api/health")
        
        if "error" in health_response:
            dispatcher.utter_message(text=f"❌ Failed to get system status: {health_response['error']}")
            return []
        
        # Get agents
        agents_response = make_autoweave_request("/api/agents")
        
        if "error" in agents_response:
            dispatcher.utter_message(text=f"❌ Failed to get agents: {agents_response['error']}")
            return []
        
        # Format system status
        system_status = format_system_status(health_response)
        
        # Format agent list
        agents = agents_response.get("agents", [])
        agent_list = format_agent_list(agents)
        
        dispatcher.utter_message(
            text=f"{system_status}\n\n📋 **Active Agents:**{agent_list}"
        )
        
        return []

# ==========================================================
# WORKFLOW MANAGEMENT ACTIONS
# ==========================================================

class ActionCreateWorkflow(Action):
    """Create a new workflow"""
    
    def name(self) -> Text:
        return "action_create_workflow"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        workflow_name = tracker.get_slot("workflow_name") or \
                       next(tracker.get_latest_entity_values("workflow_name"), None)
        
        if not workflow_name:
            dispatcher.utter_message(text="Please specify a name for the workflow.")
            return []
        
        # For now, we'll create a simple workflow
        # In the future, this could be expanded to use a workflow builder
        dispatcher.utter_message(
            text=f"🔄 Workflow **{workflow_name}** created successfully!\n"
                 f"Note: Workflow builder integration coming soon."
        )
        
        return [SlotSet("workflow_name", workflow_name)]

class ActionListWorkflows(Action):
    """List all workflows"""
    
    def name(self) -> Text:
        return "action_list_workflows"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # For now, we'll show a placeholder
        # In the future, this will integrate with the workflow system
        dispatcher.utter_message(
            text="📋 **Workflows:**\n"
                 "Workflow management is coming soon!\n"
                 "Your agents can be used to create workflows."
        )
        
        return []

class ActionExecuteWorkflow(Action):
    """Execute a workflow"""
    
    def name(self) -> Text:
        return "action_execute_workflow"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        workflow_name = tracker.get_slot("workflow_name") or \
                       next(tracker.get_latest_entity_values("workflow_name"), None)
        
        if not workflow_name:
            dispatcher.utter_message(text="Please specify which workflow to execute.")
            return []
        
        dispatcher.utter_message(
            text=f"▶️ Executing workflow **{workflow_name}**...\n"
                 f"Workflow execution will be available soon!"
        )
        
        return []

# ==========================================================
# MEMORY MANAGEMENT ACTIONS
# ==========================================================

class ActionSearchMemory(Action):
    """Search memory in AutoWeave"""
    
    def name(self) -> Text:
        return "action_search_memory"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        query = tracker.get_slot("memory_query") or \
               next(tracker.get_latest_entity_values("memory_query"), None)
        
        if not query:
            dispatcher.utter_message(text="Please specify what to search for in memory.")
            return []
        
        # Search memory via AutoWeave API
        response = make_autoweave_request(
            "/api/memory/search",
            method="POST",
            data={"query": query, "user_id": "rasa_user"}
        )
        
        if "error" in response:
            dispatcher.utter_message(text=f"❌ Memory search failed: {response['error']}")
            return []
        
        # Format results
        results = response if isinstance(response, list) else response.get("results", [])
        formatted_results = format_memory_results(results)
        
        dispatcher.utter_message(
            text=f"🔍 **Memory search results for '{query}':**{formatted_results}"
        )
        
        return []

class ActionAddMemory(Action):
    """Add information to memory"""
    
    def name(self) -> Text:
        return "action_add_memory"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Get the last user message to store in memory
        last_message = tracker.latest_message.get("text", "")
        
        if not last_message:
            dispatcher.utter_message(text="No information to add to memory.")
            return []
        
        # Add to memory via AutoWeave API
        response = make_autoweave_request(
            "/api/memory",
            method="POST",
            data={"message": last_message, "user_id": "rasa_user"}
        )
        
        if "error" in response:
            dispatcher.utter_message(text=f"❌ Failed to add to memory: {response['error']}")
            return []
        
        dispatcher.utter_message(text="✅ Information added to memory successfully!")
        
        return []

class ActionMemoryStats(Action):
    """Get memory statistics"""
    
    def name(self) -> Text:
        return "action_memory_stats"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        response = make_autoweave_request("/api/memory/metrics")
        
        if "error" in response:
            dispatcher.utter_message(text=f"❌ Failed to get memory stats: {response['error']}")
            return []
        
        # Format memory metrics
        formatted_stats = "📊 **Memory Statistics:**\n"
        for key, value in response.items():
            formatted_stats += f"• {key}: {value}\n"
        
        dispatcher.utter_message(text=formatted_stats)
        
        return []

# ==========================================================
# TASK MANAGEMENT ACTIONS
# ==========================================================

class ActionCreateTask(Action):
    """Create a new task (placeholder for future Taskcafe integration)"""
    
    def name(self) -> Text:
        return "action_create_task"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        task_name = tracker.get_slot("task_name") or \
                   next(tracker.get_latest_entity_values("task_name"), None)
        
        if not task_name:
            dispatcher.utter_message(text="Please specify a name for the task.")
            return []
        
        dispatcher.utter_message(
            text=f"📋 Task **{task_name}** created!\n"
                 f"Task management integration coming soon."
        )
        
        return [SlotSet("task_name", task_name)]

class ActionListTasks(Action):
    """List all tasks"""
    
    def name(self) -> Text:
        return "action_list_tasks"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        dispatcher.utter_message(
            text="📋 **Tasks:**\n"
                 "Task management integration coming soon!\n"
                 "You can create agents to handle tasks."
        )
        
        return []

class ActionUpdateTask(Action):
    """Update a task"""
    
    def name(self) -> Text:
        return "action_update_task"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        task_name = tracker.get_slot("task_name") or \
                   next(tracker.get_latest_entity_values("task_name"), None)
        
        if not task_name:
            dispatcher.utter_message(text="Please specify which task to update.")
            return []
        
        dispatcher.utter_message(
            text=f"✅ Task **{task_name}** updated!\n"
                 f"Task management integration coming soon."
        )
        
        return []

# ==========================================================
# FILE MANAGEMENT ACTIONS
# ==========================================================

class ActionUploadFile(Action):
    """Handle file upload (placeholder for future kotaemon integration)"""
    
    def name(self) -> Text:
        return "action_upload_file"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        file_name = tracker.get_slot("file_name") or \
                   next(tracker.get_latest_entity_values("file_name"), None)
        
        dispatcher.utter_message(
            text=f"📁 File upload functionality coming soon!\n"
                 f"File: {file_name if file_name else 'Unknown'}\n"
                 f"Integration with kotaemon in progress."
        )
        
        return []

class ActionAnalyzeFile(Action):
    """Analyze a file"""
    
    def name(self) -> Text:
        return "action_analyze_file"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        file_name = tracker.get_slot("file_name") or \
                   next(tracker.get_latest_entity_values("file_name"), None)
        
        if not file_name:
            dispatcher.utter_message(text="Please specify which file to analyze.")
            return []
        
        dispatcher.utter_message(
            text=f"🔍 Analyzing file **{file_name}**...\n"
                 f"File analysis integration coming soon!"
        )
        
        return []

# ==========================================================
# SYSTEM MANAGEMENT ACTIONS
# ==========================================================

class ActionSystemStatus(Action):
    """Get system status"""
    
    def name(self) -> Text:
        return "action_system_status"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        response = make_autoweave_request("/api/health")
        
        if "error" in response:
            dispatcher.utter_message(text=f"❌ Failed to get system status: {response['error']}")
            return []
        
        formatted_status = format_system_status(response)
        dispatcher.utter_message(text=formatted_status)
        
        return []

class ActionSystemMetrics(Action):
    """Get system metrics"""
    
    def name(self) -> Text:
        return "action_system_metrics"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Get various metrics
        health_response = make_autoweave_request("/api/health")
        memory_response = make_autoweave_request("/api/memory/metrics")
        
        if "error" in health_response:
            dispatcher.utter_message(text=f"❌ Failed to get system metrics: {health_response['error']}")
            return []
        
        # Format comprehensive metrics
        formatted_metrics = "📊 **System Metrics:**\n\n"
        
        # System health
        formatted_metrics += format_system_status(health_response)
        
        # Memory metrics
        if "error" not in memory_response:
            formatted_metrics += "\n\n🧠 **Memory Metrics:**\n"
            for key, value in memory_response.items():
                formatted_metrics += f"• {key}: {value}\n"
        
        dispatcher.utter_message(text=formatted_metrics)
        
        return []

# ==========================================================
# FALLBACK ACTION
# ==========================================================

class ActionDefaultFallback(Action):
    """Default fallback action when no other action matches"""
    
    def name(self) -> Text:
        return "action_default_fallback"
    
    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        dispatcher.utter_message(
            text="🤔 I'm not sure I understand. Here are some things you can try:\n\n"
                 "• **Create agents**: 'Create an agent that processes files'\n"
                 "• **Manage agents**: 'List my agents' or 'Delete agent [name]'\n"
                 "• **Search memory**: 'Search my memory for [query]'\n"
                 "• **System status**: 'Show system status'\n"
                 "• **Help**: 'What can you do?'\n\n"
                 "Just ask me naturally - I'm here to help!"
        )
        
        return []

# ==========================================================
# FORM VALIDATION ACTIONS
# ==========================================================

class ValidateAgentCreationForm(FormValidationAction):
    """Validate agent creation form"""
    
    def name(self) -> Text:
        return "validate_agent_creation_form"
    
    def validate_agent_description(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> Dict[Text, Any]:
        """Validate agent description"""
        
        if not slot_value or len(slot_value.strip()) < 10:
            dispatcher.utter_message(text="Please provide a more detailed description (at least 10 characters).")
            return {"agent_description": None}
        
        return {"agent_description": slot_value.strip()}

class ValidateWorkflowCreationForm(FormValidationAction):
    """Validate workflow creation form"""
    
    def name(self) -> Text:
        return "validate_workflow_creation_form"
    
    def validate_workflow_name(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> Dict[Text, Any]:
        """Validate workflow name"""
        
        if not slot_value or len(slot_value.strip()) < 3:
            dispatcher.utter_message(text="Please provide a workflow name (at least 3 characters).")
            return {"workflow_name": None}
        
        return {"workflow_name": slot_value.strip()}

class ValidateTaskCreationForm(FormValidationAction):
    """Validate task creation form"""
    
    def name(self) -> Text:
        return "validate_task_creation_form"
    
    def validate_task_name(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> Dict[Text, Any]:
        """Validate task name"""
        
        if not slot_value or len(slot_value.strip()) < 3:
            dispatcher.utter_message(text="Please provide a task name (at least 3 characters).")
            return {"task_name": None}
        
        return {"task_name": slot_value.strip()}