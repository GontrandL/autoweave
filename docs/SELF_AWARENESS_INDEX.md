# AutoWeave Self-Awareness System Index

## Overview

This index provides a comprehensive guide to AutoWeave's self-awareness documentation system, enabling the system to understand and manage its own state, configuration, and environment.

## Self-Awareness Documentation Map

### 🔍 **Core Detection & Monitoring**

#### [System State Detection Guide](SYSTEM_STATE_DETECTION.md)
**Purpose:** Real-time system state detection and service monitoring
- **What it covers:** Service status detection, environment detection, dependency validation
- **When to use:** Continuous monitoring, pre-operation checks, system health assessment
- **Key features:** Auto-diagnostic APIs, system state introspection, service connectivity validation

#### [Health Check Guide](HEALTH_CHECK_GUIDE.md)  
**Purpose:** Comprehensive health monitoring and recovery procedures
- **What it covers:** Health check hierarchy, automated recovery, monitoring dashboards
- **When to use:** System monitoring, problem detection, automated maintenance
- **Key features:** Critical vs optional service classification, self-healing capabilities

### ⚙️ **Configuration & Environment**

#### [Environment Configuration Reference](ENVIRONMENT_REFERENCE.md)
**Purpose:** Complete environment variable and configuration management
- **What it covers:** All environment variables, validation rules, fallback behaviors
- **When to use:** System configuration, environment setup, validation
- **Key features:** Configuration validation, environment-specific templates, automated checks

#### [Configuration Reference](CONFIGURATION_REFERENCE.md)
**Purpose:** Centralized service and port configuration reference
- **What it covers:** Service ports, API endpoints, integration points
- **When to use:** Port conflict resolution, service discovery, integration setup
- **Key features:** Complete service mapping, configuration troubleshooting

#### [Port Management Guide](PORT_MANAGEMENT.md)
**Purpose:** Port allocation and conflict resolution
- **What it covers:** Port allocation matrix, conflict resolution, startup sequences
- **When to use:** Port conflicts, service startup issues, network configuration
- **Key features:** Automated port checking, conflict resolution scripts

### 🎭 **Development & Testing**

#### [Mock Mode Reference](MOCK_MODE_REFERENCE.md)
**Purpose:** Mock mode configuration and behavior when external services unavailable
- **What it covers:** Mock activation triggers, service implementations, performance optimization
- **When to use:** Development without external dependencies, testing, CI/CD
- **Key features:** Intelligent mock activation, realistic mock responses, development tools

#### [Development Setup Validation](DEV_SETUP_VALIDATION.md)
**Purpose:** Comprehensive development environment validation
- **What it covers:** System requirements, dependency validation, automated setup
- **When to use:** New developer onboarding, environment troubleshooting, CI setup
- **Key features:** Automated validation scripts, setup assistance, environment scoring

### 🔧 **Problem Resolution**

#### [Troubleshooting Decision Tree Guide](TROUBLESHOOTING_GUIDE.md)
**Purpose:** Systematic problem diagnosis and resolution
- **What it covers:** Decision trees, automated diagnostics, self-healing procedures
- **When to use:** System issues, error investigation, automated problem resolution
- **Key features:** Interactive decision trees, automated healing, comprehensive diagnostics

## Usage Workflows

### 🚀 **System Startup Workflow**
1. **[Dev Setup Validation](DEV_SETUP_VALIDATION.md)** → Validate environment
2. **[Environment Reference](ENVIRONMENT_REFERENCE.md)** → Check configuration
3. **[Port Management](PORT_MANAGEMENT.md)** → Resolve port conflicts
4. **[System State Detection](SYSTEM_STATE_DETECTION.md)** → Verify system state
5. **[Health Check Guide](HEALTH_CHECK_GUIDE.md)** → Monitor system health

### 🔍 **Problem Diagnosis Workflow**
1. **[System State Detection](SYSTEM_STATE_DETECTION.md)** → Detect current state
2. **[Health Check Guide](HEALTH_CHECK_GUIDE.md)** → Assess system health  
3. **[Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)** → Follow decision trees
4. **[Configuration Reference](CONFIGURATION_REFERENCE.md)** → Verify configuration
5. **[Mock Mode Reference](MOCK_MODE_REFERENCE.md)** → Check mock status

### 🛠️ **Development Workflow**
1. **[Dev Setup Validation](DEV_SETUP_VALIDATION.md)** → Validate dev environment
2. **[Mock Mode Reference](MOCK_MODE_REFERENCE.md)** → Configure mock services
3. **[Environment Reference](ENVIRONMENT_REFERENCE.md)** → Set up environment variables
4. **[Port Management](PORT_MANAGEMENT.md)** → Configure ports
5. **[Health Check Guide](HEALTH_CHECK_GUIDE.md)** → Monitor development services

## Quick Reference

### 🚨 **Emergency Diagnostics**
For immediate system issues:
```bash
# Quick health check
curl http://localhost:3000/health

# Full diagnostic
curl http://localhost:3000/diagnostic

# Port status
curl http://localhost:3000/ports

# Mock mode status  
curl http://localhost:3000/mock-status
```

### 📋 **Configuration Validation**
```bash
# Validate development environment
./scripts/validate-dev-setup.sh

# Check configuration
./scripts/validate-config.sh

# Port availability check
./scripts/check-ports.sh
```

### 🔧 **Self-Healing**
```bash
# Attempt automatic healing
curl -X POST http://localhost:3000/self-heal

# Restart services
./scripts/restart-services.sh

# Reset to known good state
./scripts/reset-environment.sh
```

## Integration Points

### **With Existing Documentation**
- **[README.md](../README.md)** - Main project documentation
- **[CLAUDE.md](../CLAUDE.md)** - Development commands and procedures
- **[Project Overview](PROJECT_OVERVIEW.md)** - Architecture and feature overview

### **With AutoWeave Components**
- **System State Detection** integrates with all health endpoints
- **Environment Reference** used by all configuration loading
- **Mock Mode Reference** enables development without external dependencies
- **Health Check Guide** provides monitoring for all services
- **Troubleshooting Guide** covers all common AutoWeave issues

## Document Relationships

```
SELF_AWARENESS_INDEX.md (this file)
├── SYSTEM_STATE_DETECTION.md ← Real-time state monitoring
├── HEALTH_CHECK_GUIDE.md ← Service health and recovery
├── ENVIRONMENT_REFERENCE.md ← Configuration management
├── CONFIGURATION_REFERENCE.md ← Service configuration
├── PORT_MANAGEMENT.md ← Network configuration
├── MOCK_MODE_REFERENCE.md ← Development and testing
├── DEV_SETUP_VALIDATION.md ← Environment validation
└── TROUBLESHOOTING_GUIDE.md ← Problem resolution
```

## Best Practices

### **For Developers**
1. Always start with **Dev Setup Validation** when setting up
2. Use **Mock Mode Reference** for development without external services
3. Refer to **Environment Reference** for configuration questions
4. Follow **Troubleshooting Guide** decision trees for issues

### **For Operations**
1. Monitor using **Health Check Guide** procedures
2. Use **System State Detection** for real-time monitoring
3. Follow **Port Management** for service coordination
4. Apply **Troubleshooting Guide** for incident response

### **For System Integration**
1. All services should implement health endpoints per **Health Check Guide**
2. Configuration should follow **Environment Reference** patterns
3. Mock implementations should follow **Mock Mode Reference**
4. Error handling should integrate with **Troubleshooting Guide** procedures

## Maintenance

This self-awareness system should be updated when:
- New services are added to AutoWeave
- Configuration variables are added or changed
- New failure modes are discovered
- Development workflows change
- Integration points are modified

---

*This index ensures AutoWeave maintains complete self-awareness and can intelligently manage its own state, configuration, and environment.*