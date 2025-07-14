# AutoWeave Quick Start Guide

Get up and running with AutoWeave in under 10 minutes!

## Prerequisites Check

Before starting, ensure you have:

```bash
# Check Node.js version (18+ required)
node --version

# Check Docker is running
docker info

# Check you have an OpenAI API key
echo $OPENAI_API_KEY
```

## Step 1: Installation

```bash
# Clone the repository
git clone https://github.com/autoweave/autoweave.git
cd autoweave

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

## Step 2: Configure Environment

Edit `.env` file with your OpenAI API key:

```bash
# Edit the .env file
nano .env

# Add your OpenAI API key
OPENAI_API_KEY=sk-your-api-key-here
```

## Step 3: Setup Infrastructure

Run the automated setup script:

```bash
# This will install Kind, create a Kubernetes cluster, and install kagent
npm run setup
```

Expected output:
```
🚀 AutoWeave + kagent Setup Script
ℹ️  Checking prerequisites...
✅ Docker 24.0.0
✅ Node.js 18.17.0
✅ kubectl installed
✅ kind installed
✅ Cluster 'autoweave' created
✅ kagent installed to cluster
✅ kagent is ready
🎉 AutoWeave + kagent setup complete!
```

## Step 4: Health Check

Verify everything is working:

```bash
npm run health
```

Expected output:
```
ℹ️  Running AutoWeave + kagent health check...
✅ Node.js 18.17.0
✅ Environment configuration
✅ kagent cluster is running
✅ kagent pods running
✅ Health check complete!
```

## Step 5: Create Your First Agent

### Option A: Interactive CLI

```bash
npm run create-agent
```

You'll be prompted to describe your agent:
```
🕸️  AutoWeave - Agent Creator
? Describe what your agent should do: Create an agent that monitors system logs and alerts on errors
🚀 Creating agent...
✅ Agent created and deployed successfully!
```

### Option B: Direct Command

```bash
node src/cli/create-agent.js create --description "Create an agent that reads CSV files and generates reports"
```

### Option C: API

```bash
# Start the AutoWeave server
npm start

# In another terminal, create an agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"description": "Create a file processing agent"}'
```

## Step 6: Monitor Your Agent

### Check Agent Status

```bash
# Get agent status by ID
node src/cli/create-agent.js status <agent-id>

# Or via API
curl http://localhost:3000/api/agents/<agent-id>
```

### Access kagent UI

```bash
# Port-forward to kagent UI
npm run dev:ui

# Open browser to http://localhost:8080
```

### View Logs

```bash
# AutoWeave logs
npm start

# kagent logs
kubectl logs -n kagent-system -l app=kagent-controller

# Agent logs
kubectl logs -l autoweave.dev/generated=true
```

## Common First Agents

Here are some example agents you can create to get started:

### 1. File Processor
```
Create an agent that reads CSV files from a directory, processes the data, and generates summary reports
```

### 2. System Monitor
```
Create an agent that monitors system metrics and sends alerts when thresholds are exceeded
```

### 3. Kubernetes Monitor
```
Create an agent that monitors Kubernetes pods and alerts when they're not healthy
```

### 4. Log Analyzer
```
Create an agent that analyzes application logs and identifies error patterns
```

### 5. Development Assistant
```
Create an agent that reviews code repositories and suggests improvements
```

## Next Steps

- Read the [full documentation](../README.md)
- Explore [examples](../../examples/)
- Try the [API reference](../api/README.md)
- Join the [community discussions](https://github.com/autoweave/autoweave/discussions)

## Troubleshooting

### Common Issues

**Issue**: `kagent not found`
```bash
# Install kagent manually
curl -fsSL https://raw.githubusercontent.com/kagent-dev/kagent/main/scripts/get-kagent | bash
export PATH=$PATH:$HOME/.local/bin
```

**Issue**: `Cluster not ready`
```bash
# Delete and recreate cluster
kind delete cluster --name autoweave
npm run setup
```

**Issue**: `OpenAI API error`
```bash
# Check your API key
echo $OPENAI_API_KEY

# Test API connection
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
```

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/autoweave/autoweave/issues)
- **Discussions**: [GitHub Discussions](https://github.com/autoweave/autoweave/discussions)
- **Email**: support@autoweave.dev

---

You're now ready to create amazing AI agents with AutoWeave! 🚀