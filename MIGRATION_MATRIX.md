# Matrice de Migration Sprint T-X → Sprint 0-6

## 📊 Vue d'ensemble de la Migration

Cette matrice détaille la correspondance entre l'ancienne roadmap 15 sprints
(T-1 à T-15) et la nouvelle architecture 6 sprints (0-6) optimisée selon
COMMUNICATION_HUMAN_AI.md.

## 🔄 Matrice de Correspondance Complète

### Sprint 0: RFC & Validation OSS (≤ 1 semaine)

**Nouveau composant** - Aucune correspondance directe dans l'ancienne roadmap

| Élément                  | Status     | Source                    |
| ------------------------ | ---------- | ------------------------- |
| RFC-001 Plugin Manifest  | ✅ Nouveau | Requirements analysis     |
| Validation juridique OSS | ✅ Nouveau | COMMUNICATION_HUMAN_AI.md |
| Architecture USB daemon  | ✅ Nouveau | Hot-plug paradigm         |

### Sprint 1: Daemon USB & Plugin Loader (2 semaines)

**Correspondance: Anciens Sprint T-5 (partie) + éléments nouveaux**

| Ancien Sprint | Nouvel Sprint | Élément                            | Status     |
| ------------- | ------------- | ---------------------------------- | ---------- |
| T-5           | Sprint 1      | Plugin manifest schema             | 🔄 Adapté  |
| T-5           | Sprint 1      | Hot-loading infrastructure         | 🔄 Adapté  |
| T-5           | Sprint 1      | Worker Thread isolation            | 🔄 Adapté  |
| **Nouveau**   | Sprint 1      | **USB daemon node-usb**            | ✅ Nouveau |
| **Nouveau**   | Sprint 1      | **Redis Streams hot-plug**         | ✅ Nouveau |
| **Nouveau**   | Sprint 1      | **SHA-256 signature verification** | ✅ Nouveau |

### Sprint 2: Queue & Workers BullMQ (2 semaines)

**Correspondance: Anciens Sprint T-3 + T-4 (partie)**

| Ancien Sprint | Nouvel Sprint | Élément                     | Status      |
| ------------- | ------------- | --------------------------- | ----------- |
| T-3           | Sprint 2      | BullMQ job processing       | ✅ Conservé |
| T-3           | Sprint 2      | Redis Streams event bus     | ✅ Conservé |
| T-3           | Sprint 2      | Worker architecture         | ✅ Conservé |
| T-4           | Sprint 2      | Job monitoring dashboard    | 🔄 Adapté   |
| **Nouveau**   | Sprint 2      | **Plugin-worker générique** | ✅ Nouveau  |
| **Nouveau**   | Sprint 2      | **Flow multi-étapes**       | ✅ Nouveau  |

### Sprint 3: GraphQL Gateway & Auth RBAC (2 semaines)

**Correspondance: Anciens Sprint T-9 + T-10 (condensé)**

| Ancien Sprint | Nouvel Sprint | Élément                   | Status      |
| ------------- | ------------- | ------------------------- | ----------- |
| T-9           | Sprint 3      | Apollo Federation gateway | ✅ Conservé |
| T-9           | Sprint 3      | GraphQL subgraphs         | ✅ Conservé |
| T-10          | Sprint 3      | Rate limiting             | ✅ Conservé |
| T-13          | Sprint 3      | JWT + RBAC                | 🔄 Anticipé |
| **Nouveau**   | Sprint 3      | **Tenant isolation**      | ✅ Nouveau  |
| **Nouveau**   | Sprint 3      | **100 req/min/tenant**    | ✅ Nouveau  |

### Sprint 4: Observabilité Tempo/Loki (2 semaines)

**Correspondance: Anciens Sprint T-5 + T-6 (observabilité)**

| Ancien Sprint | Nouvel Sprint | Élément                        | Status      |
| ------------- | ------------- | ------------------------------ | ----------- |
| T-5           | Sprint 4      | OpenTelemetry instrumentation  | ✅ Conservé |
| T-5           | Sprint 4      | Grafana Tempo deployment       | ✅ Conservé |
| T-6           | Sprint 4      | Grafana Loki deployment        | ✅ Conservé |
| T-6           | Sprint 4      | Unified dashboards             | ✅ Conservé |
| **Nouveau**   | Sprint 4      | **Labels tenant/plugin/jobId** | ✅ Nouveau  |
| **Nouveau**   | Sprint 4      | **Helm charts stack**          | ✅ Nouveau  |

### Sprint 5: 3 Front-ends Next.js 15 (2 semaines)

**Correspondance: Anciens Sprint T-11 + T-12 (UI/UX)**

| Ancien Sprint | Nouvel Sprint | Élément                         | Status      |
| ------------- | ------------- | ------------------------------- | ----------- |
| T-11          | Sprint 5      | React Flow visual builder       | ✅ Conservé |
| T-11          | Sprint 5      | Admin dashboard                 | ✅ Conservé |
| T-12          | Sprint 5      | shadcn/ui components            | ✅ Conservé |
| T-12          | Sprint 5      | Real-time monitoring            | ✅ Conservé |
| **Nouveau**   | Sprint 5      | **3 applications Next.js 15**   | ✅ Nouveau  |
| **Nouveau**   | Sprint 5      | **Design system @autoweave/ui** | ✅ Nouveau  |
| **Nouveau**   | Sprint 5      | **Lighthouse CI >90**           | ✅ Nouveau  |

### Sprint 6: Qualité + Release + Docs (3 semaines)

**Correspondance: Anciens Sprint T-2 + T-15 (qualité + production)**

| Ancien Sprint | Nouvel Sprint | Élément                         | Status      |
| ------------- | ------------- | ------------------------------- | ----------- |
| T-2           | Sprint 6      | Testing framework               | ✅ Conservé |
| T-2           | Sprint 6      | SonarCloud quality gate         | ✅ Conservé |
| T-15          | Sprint 6      | Semantic Release                | ✅ Conservé |
| T-15          | Sprint 6      | Docker multi-stage builds       | ✅ Conservé |
| T-15          | Sprint 6      | Comprehensive documentation     | ✅ Conservé |
| **Nouveau**   | Sprint 6      | **SBOM + cosign signing**       | ✅ Nouveau  |
| **Nouveau**   | Sprint 6      | **RFC publiques + gouvernance** | ✅ Nouveau  |
| **Nouveau**   | Sprint 6      | **Docusaurus migration**        | ✅ Nouveau  |

## 🚫 Éléments Abandonnés de l'Ancienne Roadmap

### Sprints Complètement Supprimés

- **T-1**: TypeScript migration → Déjà complété
- **T-7**: Plugin Architecture détaillée → Condensé dans Sprint 1
- **T-8**: Plugin Architecture suite → Condensé dans Sprint 1
- **T-14**: Security & Multi-tenancy → Intégré dans Sprint 3

### Fonctionnalités Reportées (Hors Sprint 0-6)

- **LangGraph Studio integration** → Post-1.0
- **Plugin marketplace UI** → Post-1.0
- **Secrets management (Vault/K8s)** → Post-1.0
- **Zero-downtime deployment advanced** → Post-1.0

## ✅ Nouveaux Éléments Critiques

### Composants Entièrement Nouveaux

1. **USB Hot-Plug Daemon** (Sprint 1)
   - Callbacks libusb Linux
   - Events Redis Streams
   - Fallback udev rules

2. **3 Front-ends Next.js 15** (Sprint 5)
   - Admin UI (health, plugins, logs, costs)
   - Dev Studio (React Flow builder)
   - User UI (agents list + chat)

3. **RFC Process** (Sprint 0 + 6)
   - RFC-001 Plugin Manifest
   - Gouvernance publique
   - Community input process

4. **Advanced Observability** (Sprint 4)
   - Labels structurés tenant/plugin/jobId
   - Helm charts Tempo+Loki+Grafana
   - Drill-down iframe Admin UI

## 📈 Optimisations Apportées

### Réduction Timeline

- **15 sprints** → **6 sprints** (60% réduction)
- **~30 semaines** → **12 semaines** (60% réduction)
- **Parallélisation** augmentée des tâches

### Amélioration Focus

- **Production-ready** dès Sprint 1
- **Observabilité native** intégrée
- **Hot-plug paradigm** comme pilier central
- **Multi-tenant** architecture from day 1

### Renforcement Qualité

- **Quality gates** plus stricts (80% coverage vs 60%)
- **Security** intégrée dès Sprint 3
- **Performance** benchmarks Sprint 1
- **Documentation** industrielle Sprint 6

## 🎯 Migration Checklist

### Conservation des Acquis

- [ ] **TypeScript strict** migration (T-1) → Sprint 0 finalization
- [ ] **Testing framework** (T-2) → Sprint 6 quality gates
- [ ] **BullMQ infrastructure** (T-3/T-4) → Sprint 2 enhanced
- [ ] **Observabilité stack** (T-5/T-6) → Sprint 4 Tempo/Loki
- [ ] **GraphQL Federation** (T-9/T-10) → Sprint 3 + RBAC
- [ ] **React Flow UI** (T-11/T-12) → Sprint 5 multi-app

### Adaptation Nécessaire

- [ ] **Plugin system** T-5 → Sprint 1 (USB hot-plug)
- [ ] **Auth system** T-13 → Sprint 3 (tenant isolation)
- [ ] **Documentation** T-15 → Sprint 6 (Docusaurus)
- [ ] **Quality process** T-2 → Sprint 6 (enhanced)

### Validation Transition

- [ ] **Team alignment** sur nouveau périmètre
- [ ] **Skills assessment** USB/libusb, Next.js 15, Tempo/Loki
- [ ] **Risk mitigation** timeline aggressive
- [ ] **Stakeholder communication** scope changes

---

## 🏁 Impact Business de la Migration

### Bénéfices Attendus

- **Time-to-market** réduit de 60%
- **Production readiness** accélérée
- **Observability** native dès le début
- **Multi-tenancy** architecture scalable
- **Developer experience** améliorée (3 UIs)

### Risques Identifiés

- **Timeline agressive** 12 semaines non-négociables
- **Complexity USB/libusb** nouvelle pour l'équipe
- **Next.js 15** features bleeding-edge
- **Tempo/Loki** stack learning curve

Cette migration transforme AutoWeave d'une évolution incrémentale vers une
révolution architecturale, positioning the platform for enterprise adoption and
future avatar integration.
