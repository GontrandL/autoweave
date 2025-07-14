# Implémentation du Système de Self-Awareness et ADN Génétique

## Vue d'ensemble

Un système complet de conscience de soi et de traçabilité génétique a été implémenté pour AutoWeave, permettant :

1. **Traçabilité Génétique** : Chaque fonction/classe a un ID unique avec historique complet
2. **Synchronisation DB/Fichiers** : Vérification et correction automatique des divergences
3. **Self-Awareness** : Le système connaît ses capacités et les communique au LLM
4. **Reconstruction** : Capacité de reconstruire le projet depuis la DB à n'importe quel moment

## 🧬 Architecture ADN Génétique

### Format des Gene IDs
```
AWF-20250111-104215-CLD-7B3A
│    │        │      │    └─> Hash du contenu
│    │        │      └──────> Instance responsable
│    │        └─────────────> Timestamp
│    └──────────────────────> Date
└───────────────────────────> Préfixe AutoWeave Function
```

### Métadonnées Stockées
- **Birth** : Création initiale (qui, quand, pourquoi)
- **Evolution** : Historique complet des mutations
- **Dependencies** : Graphe de dépendances
- **Purpose** : Description et tags
- **Health** : État des tests et performances

## 🔧 Composants Implémentés

### 1. Hooks Génétiques (`genetic_pre_tool_use.py`)
- Intercepte toutes les modifications de code
- Génère des Gene IDs uniques
- Trace l'évolution complète
- Stocke dans Qdrant avec embeddings

### 2. Agent Self-Awareness (`self-awareness-agent.js`)
- Scan continu du système
- Vérification de synchronisation DB/fichiers
- Mise à jour automatique de CLAUDE.md
- Ingestion des nouveaux fichiers

### 3. Reconstructeur Génétique (`genetic_reconstructor.py`)
- Reconstruction de fichiers/projets depuis la DB
- Voyage temporel (état à une date donnée)
- Analyse d'évolution des gènes
- Recherche de code similaire

### 4. Vérificateur de Synchronisation (`check-db-sync.py`)
- Compare fichiers disque vs DB
- Détecte les divergences
- Propose des corrections automatiques

### 5. Connecteur Qdrant Génétique (`genetic_qdrant.py`)
- Gestion des collections génétiques
- Stockage avec embeddings
- Recherche sémantique
- Statistiques du génome

## 📡 API Endpoints

### Routes Self-Awareness (`/api/self-awareness/*`)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/status` | GET | État complet du système |
| `/tools` | GET | Liste des outils disponibles |
| `/files` | GET | Fichiers trackés |
| `/sync` | GET | État de synchronisation |
| `/sync` | POST | Forcer une synchronisation |
| `/capabilities` | GET | Capacités du système |
| `/scan` | POST | Scanner le système |
| `/documentation` | GET | Documentation générée |
| `/ingest` | POST | Ingérer un nouveau fichier |
| `/health` | GET | Santé du système |

## 🚀 Utilisation

### 1. Vérifier l'état du système
```bash
curl http://localhost:3000/api/self-awareness/status
```

### 2. Vérifier la synchronisation
```bash
curl http://localhost:3000/api/self-awareness/sync
```

### 3. Forcer une synchronisation
```bash
curl -X POST http://localhost:3000/api/self-awareness/sync
```

### 4. Scanner un nouveau fichier
```bash
curl -X POST http://localhost:3000/api/self-awareness/ingest \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/path/to/new/file.js"}'
```

### 5. Reconstruire un fichier
```bash
python scripts/genetic_reconstructor.py reconstruct-file src/agents/example.js
```

### 6. Analyser l'évolution d'un gène
```bash
python scripts/genetic_reconstructor.py analyze-gene AWF-20250111-104215-CLD-7B3A
```

### 7. Vérifier la santé du génome
```bash
python scripts/genetic_reconstructor.py health
```

## 🧠 Instructions pour Claude

**IMPORTANT : Claude DOIT utiliser ces systèmes lors du travail avec AutoWeave :**

1. **Pour toute modification de fichier** :
   - Les hooks génétiques sont automatiquement activés
   - Chaque modification est tracée avec un Gene ID
   - L'historique complet est préservé

2. **Pour vérifier l'état du système** :
   - Utiliser `/api/self-awareness/status`
   - Consulter CLAUDE.md qui est auto-généré

3. **Pour la synchronisation** :
   - Vérifier régulièrement avec `/api/self-awareness/sync`
   - Forcer la sync si nécessaire

4. **Pour la reconstruction** :
   - Utiliser `genetic_reconstructor.py` pour restaurer des fichiers
   - Possibilité de voyage temporel

## 🔄 Workflow Automatique

1. **Au démarrage** :
   - Self-Awareness Agent scanne le système
   - Vérifie la synchronisation DB/fichiers
   - Met à jour CLAUDE.md

2. **En continu** (toutes les 5 minutes) :
   - Détection des nouveaux fichiers
   - Vérification de synchronisation
   - Ingestion automatique si configuré

3. **À chaque modification** :
   - Hook génétique capture le changement
   - Génération du Gene ID
   - Stockage dans Qdrant
   - Mise à jour du graphe de dépendances

## 📊 Bénéfices

1. **Traçabilité Complète** : Chaque ligne de code a une histoire
2. **Récupération** : Aucune perte de code possible
3. **Analyse** : Comprendre l'évolution du projet
4. **Self-Awareness** : Le système se connaît lui-même
5. **Documentation Automatique** : CLAUDE.md toujours à jour

## 🛠️ Configuration

Variables d'environnement :
```bash
SELF_AWARENESS_SCAN_INTERVAL=300000  # 5 minutes
SELF_AWARENESS_AUTO_SYNC=true
CLAUDE_GENOME_ENABLED=true
CLAUDE_TRACKING_LEVEL=full
```

## 🚧 Prochaines Étapes

1. Intégrer les embeddings OpenAI réels
2. Implémenter la reconstruction complète depuis DB
3. Ajouter des métriques de santé du code
4. Interface graphique pour visualiser l'évolution
5. Détection automatique de code dupliqué

---

Le système est maintenant conscient de lui-même et peut tracer, préserver et reconstruire son propre code. C'est un véritable "ADN numérique" vivant !