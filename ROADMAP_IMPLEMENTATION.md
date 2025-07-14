# AutoWeave Roadmap Implementation Plan

Based on the comprehensive analysis in COMMUNICATION_HUMAN_AI.md, here's our
restructured implementation plan aligned with the new 6-sprint architecture.

## 🎯 Vision Actualisée

Transformer AutoWeave en plate-forme d'orchestration d'agents de production avec
daemon USB hot-plug fiable, gestionnaires de plug-ins, queue BullMQ, super-graph
GraphQL, observabilité Tempo/Loki, trois front-ends Next.js 15 et pipeline CI/CD
sémantique — afin d'être prêt à brancher ultérieurement la couche avatar sans
dette technique.

## 📊 Nouvelle Architecture en 6 Sprints (12 semaines)

Cette refonte abandonne l'ancien modèle 15 sprints pour adopter une approche
plus ciblée et industrielle basée sur les principes directeurs du document
COMMUNICATION_HUMAN_AI.md.

### 🚀 Sprint 0 — Gel des exigences & RFC (≤ 1 semaine)

**Objectif**: Finalisation des spécifications et validation OSS

#### Livrables Obligatoires

- [ ] **RFC-001 "Plugin Manifest & Hot-Swap"** : spécification complète des
      champs `name`, `version`, `entry`, `permissions`, `onLoad/onUnload`
- [ ] **Validation juridique OSS** : audit complet de la compatibilité de toutes
      les dépendances listées
- [ ] **Architecture décisionnelle** : choix techniques figés pour les 12
      semaines

#### Critères d'Acceptation

- RFC-001 approuvé et versionné
- Aucune dépendance OSS bloquante identifiée
- Équipe technique alignée sur l'architecture

### 🔧 Sprint 1 — Daemon USB & Plug-in Loader (2 semaines)

**Objectif**: Infrastructure hot-plug et gestionnaire de plugins

#### Composants Clés

- [ ] **usb-daemon** (package Go/Node) avec callbacks libusb
      `libusb_hotplug_register_callback()`
- [ ] **Event publishing** sur Redis Streams (channel `aw:hotplug`)
- [ ] **@autoweave/plugin-loader** : surveillance `plugins/` via Chokidar +
      Worker Threads
- [ ] **Validation AJV + SHA-256** avant import dynamique
- [ ] **Tests de charge** : 1 000 cycles plug/de-plug sans fuite mémoire (< 1
      MB)

#### Technologies Intégrées

- libusb pour callbacks Linux + fallback udev rules
- Worker Threads pour isolation des plugins
- Chokidar pour surveillance filesystem
- node-usb pour événements matériels

### ⚡ Sprint 2 — Queue & Workers (2 semaines)

**Objectif**: Système de queue asynchrone et workers distribuée

#### Infrastructure BullMQ

- [ ] **@autoweave/job-queue** : abstraction BullMQ pour files, flows,
      repeatable jobs
- [ ] **plugin-worker.ts générique** : connexion BullMQ + exécution + traces
      OTEL
- [ ] **Dashboard BullMQ intégré** dans Admin UI (iframe)
- [ ] **Gestion retry/error** avec agenda Redis Streams

#### Types de Jobs Définis

- `agent.create`, `memory.vectorize`, `llm.batch`, `plugin.load`,
  `system.cleanup`

### 🌐 Sprint 3 — GraphQL Gateway & Auth RBAC (2 semaines)

**Objectif**: Super-graph unifié avec authentification enterprise

#### Apollo Federation Setup

- [ ] **Super-graph Apollo Gateway** : chaque domaine (core, memory, queue) en
      subgraph
- [ ] **Auth JWT middleware** global avec scopes `role`, `tenantId`
- [ ] **Rate-limit 100 req/min/tenant**
- [ ] **Propagation contexte sécurisé** vers resolvers

#### Subgraphs Ciblés

- `agents`, `memory`, `queue`, `plugins`, `observability`

### 📊 Sprint 4 — Observabilité Tempo/Loki (2 semaines)

**Objectif**: Instrumentation complète et stack de monitoring

#### Stack OpenTelemetry

- [ ] **Instrumentation Express, BullMQ, Redis** avec SDK OpenTelemetry JS
- [ ] **Export OTLP/HTTP vers Tempo**
- [ ] **Helm chart stack Tempo + Loki + Grafana**
- [ ] **Labels structurés** : `tenant`, `plugin`, `jobId`
- [ ] **Admin UI dashboard temps réel** : CPU, latence LLM via API Grafana

#### Métriques Clés

- Latence P95/P99, throughput, taux d'erreur par tenant/plugin

### 🎨 Sprint 5 — 3 Front-ends Next.js 15 (2 semaines)

**Objectif**: Applications utilisateur avec design system unifié

#### Applications Next.js 15 App Router

- [ ] **Admin UI** : pages `/health`, `/plugins`, `/logs`, `/costs`
- [ ] **Dev Studio** : builder React-Flow pour agents + stream logs WS Loki
- [ ] **User UI** : liste agents actifs (left panel) + chat thread
- [ ] **Design System** : Radix UI primitives + tokens Tailwind + shadcn/ui
- [ ] **CI Lighthouse** : budget 90 + perf mobile

#### Composants Partagés

- Navigation OIDC, themes dark/light, composants A11Y Radix

### 🚀 Sprint 6 — Qualité + Release + Docs (3 semaines)

**Objectif**: Production readiness et gouvernance

#### Pipeline CI/CD Industriel

- [ ] **SonarCloud Quality Gate** : coverage ≥ 80%, vuln = 0
- [ ] **semantic-release automatique** : version, changelog, publish NPM
- [ ] **Docker multi-arch + cosign** : images signées
- [ ] **SBOM Syft** : génération et attachement aux tags GitHub
- [ ] **Documentation Docusaurus** : migration README → docs.autoweave.dev

#### Gouvernance

- [ ] **Tutoriels Quick-Start**, Dev Studio, Admin
- [ ] **Kick-off public beta** + blog Vercel (RSC article)
- [ ] **RFC publiques** + processus de gouvernance défini

## 🛠️ Stack Technologique Consolidé

### Backend Core

- **Runtime**: Node.js 20+ with TypeScript strict
- **Monorepo**: Turborepo + pnpm workspaces + cache incrémentale
- **Build**: tsup/swc pour ESM/CJS dual outputs
- **Framework**: Express → Apollo Server (GraphQL Federation)

### Queue & Events

- **Queue**: BullMQ (Redis Streams) avec retry/agenda
- **Event Bus**: Redis Streams pour hot-plug events (channel `aw:hotplug`)
- **Workers**: Worker Threads isolés par plugin
- **Jobs**: `agent.create`, `memory.vectorize`, `llm.batch`, `plugin.load`

### Plugin System Hot-Plug

- **USB Detection**: node-usb avec callbacks libusb Linux
- **File Watching**: Chokidar pour surveillance `plugins/`
- **Isolation**: Worker Threads + permission system AJV
- **Validation**: SHA-256 signature + manifest schema
- **Hot Reload**: ES2020 dynamic import() sans downtime

### Observabilité Built-in

- **Tracing**: OpenTelemetry JS → Grafana Tempo
- **Logging**: Winston → Grafana Loki
- **Export**: OTLP/HTTP avec labels `tenant`, `plugin`, `jobId`
- **Dashboards**: Grafana + Admin UI drill-down iframe
- **Monitoring**: /metrics, /healthz, /readyz endpoints

### Front-ends Next.js 15

- **Framework**: App Router + RSC (React Server Components)
- **UI Components**: Radix UI Primitives + shadcn/ui + Tailwind
- **Design System**: tokens cohérents + A11Y compliance WCAG 2.1
- **Visual Editor**: React Flow pour Dev Studio
- **State**: Zustand + TanStack Query pour cache GraphQL

### GraphQL Federation

- **Gateway**: Apollo Gateway avec subgraphs par domaine
- **Auth**: JWT middleware + RBAC avec scopes `role`, `tenantId`
- **Rate Limiting**: 100 req/min/tenant
- **Subgraphs**: `agents`, `memory`, `queue`, `plugins`, `observability`

### DevOps & Security

- **CI/CD**: GitHub Actions + semantic-release automatique
- **Quality**: SonarCloud Quality Gate (coverage ≥ 80%, vuln = 0)
- **Container**: Docker multi-arch + cosign signing
- **Helm**: Charts Tempo + Loki + Grafana stack
- **SBOM**: Syft génération + attachement tags GitHub

## 📈 Métriques de Succès Redéfinies

### Métriques Techniques Sprint 0-6

- **Plugin load time**: <250ms (Sprint 1)
- **Hot-plug cycles**: 1000 sans fuite mémoire <1MB (Sprint 1)
- **Job throughput**: >100/minute BullMQ (Sprint 2)
- **GraphQL latency**: <200ms P95 (Sprint 3)
- **Trace collection**: 100% services (Sprint 4)
- **Lighthouse score**: >90 mobile (Sprint 5)
- **Test coverage**: ≥80% global (Sprint 6)

### Métriques Business AutoWeave 1.0

- **4 protocoles hot-plug** : USB, FS, redeploy, webhook
- **Zero-downtime deployment**: 100% réussite
- **3 UIs consolidées** : Admin, Dev Studio, User
- **Documentation exhaustive** : RFC publiques + gouvernance

## 🔄 Stratégie de Migration Sprint T-X → Sprint 0-6

### Conservation des Acquis Sprint T-1/T-2

Les éléments TypeScript, tests et qualité des anciens sprints T-1/T-2 sont
intégrés dans :

- **Sprint 0** : finalisation TypeScript migration
- **Sprint 6** : quality gates et testing frameworks

### Refonte Architecture

L'ancien modèle 15 sprints est remplacé par une approche industrielle :

- **Anciens Sprint 3-6** → **Sprint 1-2** (USB + BullMQ)
- **Anciens Sprint 7-10** → **Sprint 3-4** (GraphQL + Observabilité)
- **Anciens Sprint 11-15** → **Sprint 5-6** (UIs + Production)

### Nouveaux Éléments Critiques

- **USB hot-plug daemon** (Sprint 1) : nouveau composant clé
- **3 front-ends Next.js 15** (Sprint 5) : architecture multi-app
- **RFC process** (Sprint 0) : gouvernance formalisée

## 🚨 Risques Identifiés & Mitigation

### Risques Techniques Sprint 0-6

- **Complexité USB/libusb** : POC early + fallback udev rules (Sprint 1)
- **Performance BullMQ** : load testing 100 jobs/min (Sprint 2)
- **Apollo Federation learning curve** : team training + documentation
  (Sprint 3)
- **OTLP/Tempo setup** : Helm charts testés + monitoring stack (Sprint 4)

### Risques Process

- **Timeline agressive** : 12 semaines non-négociables
- **Scope créep** : RFC process + change control (Sprint 0)
- **Team velocity** : métriques de sprint tracking quotidien

## 📝 Actions Immédiates Post-Refonte

### Semaine 1 (Sprint 0 Start)

1. **RFC-001 Draft** : plugin manifest schema design
2. **Dependency audit** : validation OSS compliance
3. **Architecture decisions** : Go vs Node pour usb-daemon
4. **Team alignment** : sprint 0-6 goals communication

### Semaine 2 (Sprint 0 Completion)

1. **RFC-001 approval** : manifest schema finalized
2. **Technical stack lock** : no more architecture changes
3. **Sprint 1 preparation** : USB daemon research + BullMQ setup

---

## 🏁 Livraison AutoWeave 1.0 "Prêt-Avatar"

Cette roadmap restructurée transforme AutoWeave de prototype en plate-forme
industrielle en 12 semaines précises. Chaque sprint est optimisé pour la
production readiness, l'observabilité native et la préparation à l'intégration
future de la couche avatar (VITS-fast + SadTalker) sans dette technique.
