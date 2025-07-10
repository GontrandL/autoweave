# MCP Integration Example

This example demonstrates how AutoWeave integrates with Model Context Protocol (MCP) servers to provide custom tools for agents.

## Scenario

Create an agent that uses a custom MCP server for specialized data processing.

## Natural Language Description

```
Create an agent that connects to our custom data processing MCP server to analyze financial transactions, detect anomalies, and generate compliance reports.
```

## Generated Workflow

AutoWeave will generate a workflow that includes:

1. **Standard Tools**: file-reader, file-writer
2. **Custom MCP Tool**: financial-data-processor

## Generated YAML

```yaml
apiVersion: kagent.dev/v1alpha1
kind: Agent
metadata:
  name: financial-analysis-agent
  labels:
    autoweave.dev/generated: "true"
spec:
  systemPrompt: |
    You are an AI agent for financial transaction analysis.
    Your capabilities include:
    - file-reader: Read transaction files
    - file-writer: Write reports
    - financial-data-processor: Custom financial analysis tools

    Instructions:
    1. Read transaction data files
    2. Process transactions using financial analysis tools
    3. Detect anomalies and compliance issues
    4. Generate detailed reports
    
  tools:
    - file-reader
    - file-writer
    - financial-data-processor
    
  modelConfig:
    name: gpt-4
    temperature: 0.7

---
apiVersion: kagent.dev/v1alpha1
kind: Tool
metadata:
  name: financial-data-processor
  labels:
    autoweave.dev/generated: "true"
spec:
  description: Custom financial data processing tool
  mcpServer:
    url: http://financial-mcp-server:8080
    method: sse
```

## MCP Server Configuration

The custom MCP server would expose tools like:

- `analyze_transactions`: Analyze transaction patterns
- `detect_anomalies`: Identify suspicious activities
- `generate_compliance_report`: Create regulatory reports
- `risk_assessment`: Evaluate transaction risks

## Usage

```bash
# Create the agent
npm run create-agent -- --description "Create an agent that connects to our custom data processing MCP server to analyze financial transactions, detect anomalies, and generate compliance reports."

# The agent will automatically:
# 1. Generate the workflow
# 2. Create the custom MCP tool
# 3. Deploy both to Kubernetes
# 4. Connect to the MCP server at runtime
```

## Benefits

- **Seamless Integration**: No manual YAML writing
- **Custom Tools**: Extend agent capabilities with MCP
- **Automatic Discovery**: MCP servers are discovered automatically
- **Type Safety**: Tools are validated before deployment