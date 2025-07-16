# AutoWeave Immediate Actions - Sprint 0 Focus

## 🚀 Sprint 0 Actions Immédiates (≤ 1 semaine)

### Jour 1-2: RFC-001 Draft & Architecture Decisions

#### 1. RFC-001 "Plugin Manifest & Hot-Swap" - Draft

```bash
# Create RFC structure
mkdir -p rfcs/001-plugin-manifest
touch rfcs/001-plugin-manifest/README.md
touch rfcs/001-plugin-manifest/schema.json
touch rfcs/001-plugin-manifest/examples/

# Schema validation setup
pnpm add -D -w ajv ajv-cli
touch packages/plugin-loader/src/manifest-schema.json
```

**RFC-001 Draft Template:**

````markdown
# RFC-001: Plugin Manifest & Hot-Swap Architecture

## Summary

Define the plugin manifest schema and hot-swap lifecycle for AutoWeave's
USB-like plugin system.

## Motivation

Enable dynamic plugin loading/unloading without downtime, following USB hot-plug
paradigm.

## Plugin Manifest Schema

```json
{
  "$schema": "https://autoweave.dev/schemas/plugin-v1.json",
  "name": "string",
  "version": "semver",
  "entry": "string",
  "permissions": ["string[]"],
  "hooks": {
    "onLoad": "string?",
    "onUnload": "string?",
    "onError": "string?"
  },
  "isolation": {
    "workerThread": "boolean",
    "memoryLimit": "string",
    "cpuLimit": "string"
  },
  "signature": {
    "algorithm": "SHA-256",
    "hash": "string",
    "publicKey": "string"
  }
}
```
````

## Implementation Plan

1. AJV schema validation
2. SHA-256 signature verification
3. Worker Thread isolation
4. Hot-reload via ES2020 dynamic import()

````

#### 2. Architecture Decision: USB Daemon (Node.js vs Go)
**Decision Matrix:**
```typescript
// Decision: Node.js + node-usb (CHOSEN)
// Rationale: Better TypeScript integration, faster development
interface USBDaemonDecision {
  technology: 'node-usb';
  language: 'TypeScript';
  eventBus: 'Redis Streams';
  hotplugChannel: 'aw:hotplug';
}

// Alternative: Go + libusb (REJECTED)
// Rationale: Additional complexity, CGO dependencies
````

#### 3. Dependency License Audit

```bash
# Create license audit script
touch scripts/license-audit.js
```

**Audit Critical Dependencies:**

```javascript
// scripts/license-audit.js
const criticalDeps = [
  { name: 'node-usb', license: 'MIT', status: '✅ Compatible' },
  { name: 'libusb', license: 'LGPL-2.1', status: '⚠️ Review needed' },
  { name: 'bullmq', license: 'MIT', status: '✅ Compatible' },
  { name: '@opentelemetry/*', license: 'Apache-2.0', status: '✅ Compatible' },
  { name: 'grafana/tempo', license: 'AGPLv3', status: '⚠️ Deploy only' },
  { name: 'grafana/loki', license: 'AGPLv3', status: '⚠️ Deploy only' },
  { name: 'apollo-server', license: 'MIT', status: '✅ Compatible' },
  { name: 'next.js', license: 'MIT', status: '✅ Compatible' },
  { name: 'radix-ui', license: 'MIT', status: '✅ Compatible' },
  { name: 'react-flow', license: 'MIT', status: '✅ Compatible' },
];

// Generate compliance report
console.log('AutoWeave OSS Compliance Report');
criticalDeps.forEach((dep) => {
  console.log(`${dep.name}: ${dep.license} - ${dep.status}`);
});
```

### Jour 3-4: Plugin Schema Validation & Signature Process

#### 1. AJV Schema Implementation

```bash
# Setup schema validation
mkdir -p packages/plugin-loader/src/schemas
touch packages/plugin-loader/src/schemas/manifest.json
touch packages/plugin-loader/src/validators/manifest-validator.ts
```

**Manifest Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "version", "entry", "permissions"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "entry": {
      "type": "string",
      "pattern": "^\\./.*\\.js$"
    },
    "permissions": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["memory:read", "memory:write", "llm:access", "queue:publish"]
      }
    },
    "isolation": {
      "type": "object",
      "properties": {
        "workerThread": { "type": "boolean" },
        "memoryLimit": { "type": "string" },
        "cpuLimit": { "type": "string" }
      }
    },
    "signature": {
      "type": "object",
      "required": ["algorithm", "hash", "publicKey"],
      "properties": {
        "algorithm": { "const": "SHA-256" },
        "hash": { "type": "string" },
        "publicKey": { "type": "string" }
      }
    }
  }
}
```

#### 2. SHA-256 Signature Process

```typescript
// packages/plugin-loader/src/crypto/signature.ts
import crypto from 'crypto';

export class PluginSignature {
  static generateKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
  }

  static signManifest(manifest: object, privateKey: string): string {
    const manifestContent = JSON.stringify(manifest);
    const sign = crypto.createSign('SHA256');
    sign.update(manifestContent);
    return sign.sign(privateKey, 'hex');
  }

  static verifySignature(
    manifest: object,
    signature: string,
    publicKey: string,
  ): boolean {
    const manifestContent = JSON.stringify(manifest);
    const verify = crypto.createVerify('SHA256');
    verify.update(manifestContent);
    return verify.verify(publicKey, signature, 'hex');
  }
}
```

### Jour 5-7: Team Alignment & Sprint 1 Preparation

#### 1. Team Communication & Alignment

**Sprint 0 Communication Plan:**

```markdown
# Sprint 0 Alignment Meeting

## Agenda

1. RFC-001 Review & Approval
2. Architecture Decisions Final
3. Sprint 1 Preparation
4. Risk Assessment & Mitigation

## Key Decisions

- ✅ Node.js + node-usb for USB daemon
- ✅ Worker Thread isolation for plugins
- ✅ SHA-256 signature verification
- ✅ Redis Streams for event bus

## Sprint 1 Readiness Checklist

- [ ] RFC-001 approved and documented
- [ ] USB daemon research complete
- [ ] Plugin schema finalized
- [ ] Signature process tested
```

#### 2. Sprint 1 Technical Preparation

```bash
# Create Sprint 1 packages structure
mkdir -p packages/usb-daemon/src
mkdir -p packages/plugin-loader/src/{schemas,validators,crypto}
mkdir -p packages/job-queue/src

# Install Sprint 1 dependencies
pnpm add usb chokidar worker_threads
pnpm add -D @types/usb
```

#### 3. Performance Testing Framework Setup

```bash
# Create performance testing structure
mkdir -p tests/performance
touch tests/performance/plugin-load-test.spec.ts
touch tests/performance/usb-hotplug-test.spec.ts

# Install performance testing tools
pnpm add -D clinic autocannon
```

---

## 📋 Sprint 0 Deliverables Tracking

### Jour 1-2: RFC & Architecture (Status: 🔄 In Progress)

- [ ] **RFC-001 draft complet** (Plugin Manifest & Hot-Swap)
- [ ] **Architecture USB daemon décidée** (Node.js vs Go)
- [ ] **Dependency audit lancé** (licences OSS)

### Jour 3-4: Schema & Signature (Status: ⏳ Pending)

- [ ] **AJV schema validation implémenté**
- [ ] **SHA-256 signature process testé**
- [ ] **Plugin manifest examples créés**

### Jour 5-7: Alignment & Preparation (Status: ⏳ Pending)

- [ ] **Team alignment meeting tenu**
- [ ] **Sprint 1 packages structure créée**
- [ ] **Performance testing framework prêt**

---

## 🎯 Sprint 0 Success Criteria

### Critères d'Acceptation Obligatoires

- [ ] **RFC-001 approuvé** par équipe technique
- [ ] **Aucune dépendance OSS bloquante** identifiée
- [ ] **Architecture USB daemon finalisée** (Node.js confirmé)
- [ ] **Schema plugin manifest validé** avec AJV functional
- [ ] **Process signature SHA-256 testé** et documenté

### Métriques Sprint 0

- **RFC Review Time**: <48h pour approbation
- **License Audit**: 0 blocker identifié
- **Schema Validation**: 100% des champs requis validés
- **Signature Process**: <5ms pour vérification

---

## 🛠️ Sprint 1 Preparation Checklist

### Technical Readiness

- [ ] **USB daemon package structure** créée
- [ ] **node-usb dependency** installée et testée
- [ ] **Plugin loader architecture** esquissée
- [ ] **Worker Thread isolation** proof-of-concept

### Documentation & Governance

- [ ] **RFC-001 published** dans repository public
- [ ] **Architecture Decision Records** (ADR) créés
- [ ] **Sprint 1 detailed tasks** définis
- [ ] **Performance benchmarks** baseline établis

---

## 📞 Actions Post-Sprint 0

### Semaine 2-3: Sprint 1 Execution

1. **USB Daemon Implementation**
   - Implement node-usb hotplug callbacks
   - Redis Streams event publishing
   - Linux udev rules fallback

2. **Plugin Loader Development**
   - Chokidar file watching
   - Worker Thread spawning
   - AJV manifest validation

3. **Performance Testing**
   - Plugin load time <250ms
   - 1000 cycles plug/unplug without memory leak

### Semaine 4-5: Sprint 2 Preparation

1. **BullMQ Infrastructure**
   - Queue system setup
   - Worker architecture
   - Job types definition

2. **Event Bus Design**
   - Redis Streams configuration
   - Event schema definition
   - Flow & repeatable jobs

Le Sprint 0 est crucial pour établir les fondations solides nécessaires à
l'execution réussie des 6 sprints suivants. Chaque décision prise maintenant
impacte directement la faisabilité du roadmap 12 semaines.
