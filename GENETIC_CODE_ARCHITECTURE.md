# Architecture ADN Numérique pour AutoWeave

## Vision

Transformer le système de hooks en un organisme vivant capable de :
- S'auto-documenter
- Tracer son évolution
- Se reconstruire depuis ses "gènes"
- Comprendre pourquoi chaque partie existe

## 1. Structure de l'ADN des Fonctions

### Identifiant Génétique Unique (GeneID)
```
GeneID: AWF-2025011-1042-CLD-7B3A
        │    │      │    │    └─> Hash court du contenu
        │    │      │    └──────> Instance responsable (CLaude)
        │    │      └───────────> Timestamp de création
        │    └──────────────────> Date (YYYYMMDD)
        └───────────────────────> Préfixe (AutoWeave Function)
```

### Métadonnées Génétiques
```json
{
  "geneId": "AWF-20250111-1042-CLD-7B3A",
  "dna": {
    "birth": {
      "timestamp": "2025-01-11T10:42:15.234Z",
      "creator": "claude-3-opus",
      "reason": "User requested file processing agent",
      "parentGenes": ["AWF-20250110-1523-CLD-4F2E"],
      "mutation": false
    },
    "evolution": [
      {
        "timestamp": "2025-01-11T14:23:45.123Z",
        "mutator": "claude-3-sonnet",
        "reason": "Bug fix: handle empty files",
        "changes": "Added null check on line 42",
        "diffHash": "a3b4c5d6"
      }
    ],
    "dependencies": {
      "imports": ["logger", "fs", "path"],
      "calls": ["AWF-20250109-0834-CLD-2A1C"],
      "calledBy": ["AWF-20250111-1623-CLD-9D4E"]
    },
    "purpose": {
      "description": "Process and validate incoming files",
      "tags": ["file-processing", "validation", "core"],
      "complexity": 3.2
    },
    "health": {
      "lastTested": "2025-01-11T16:00:00.000Z",
      "testsPassing": true,
      "performance": {
        "avgExecutionTime": 23.4,
        "memoryUsage": 12.3
      }
    }
  }
}
```

## 2. Système d'Historicalisation

### Structure de la Base de Données

#### Collection: `code_genome`
```javascript
{
  "_id": "AWF-20250111-1042-CLD-7B3A",
  "filePath": "/src/agents/file-processor.js",
  "functionName": "processFile",
  "content": "function processFile(path) { ... }",
  "contentHash": "7b3a4f2e...",
  "embedding": [0.123, -0.456, ...], // Pour recherche sémantique
  "dna": { /* Métadonnées complètes */ },
  "snapshots": [
    {
      "version": 1,
      "timestamp": "2025-01-11T10:42:15.234Z",
      "content": "...",
      "reason": "Initial creation"
    }
  ]
}
```

#### Collection: `evolution_log`
```javascript
{
  "_id": ObjectId(),
  "geneId": "AWF-20250111-1042-CLD-7B3A",
  "timestamp": "2025-01-11T14:23:45.123Z",
  "eventType": "mutation", // creation, mutation, deletion, merge
  "actor": "claude-3-sonnet",
  "context": {
    "userRequest": "Fix bug in file processing",
    "conversationId": "conv-12345",
    "previousState": "hash-before",
    "newState": "hash-after"
  },
  "impact": {
    "affectedGenes": ["AWF-..."],
    "testsRun": 15,
    "testsPassed": 15
  }
}
```

#### Collection: `dependency_graph`
```javascript
{
  "_id": "AWF-20250111-1042-CLD-7B3A",
  "dependencies": {
    "upstream": ["gene1", "gene2"], // Ce gène dépend de
    "downstream": ["gene3", "gene4"], // Dépendent de ce gène
    "siblings": ["gene5"], // Gènes similaires/alternatifs
    "conflicts": [] // Gènes incompatibles
  }
}
```

## 3. Hooks Améliorés avec ADN

### pre_tool_use.py amélioré
```python
import hashlib
import datetime
from typing import Dict, Any

class GeneticHook:
    def __init__(self):
        self.qdrant = QdrantClient(...)
        self.neo4j = Neo4jClient(...)
        
    def generate_gene_id(self, content: str, creator: str) -> str:
        """Générer un ID génétique unique"""
        timestamp = datetime.now().strftime("%Y%m%d-%H%M")
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:4].upper()
        creator_code = self.get_creator_code(creator)
        return f"AWF-{timestamp}-{creator_code}-{content_hash}"
    
    def capture_mutation(self, file_path: str, old_content: str, new_content: str, context: Dict[str, Any]):
        """Capturer une mutation de code"""
        gene_id = self.find_or_create_gene(file_path, old_content)
        
        mutation = {
            "timestamp": datetime.now().isoformat(),
            "mutator": context.get("actor", "unknown"),
            "reason": context.get("reason", "No reason provided"),
            "changes": self.compute_diff(old_content, new_content),
            "context": {
                "conversation_id": context.get("conversation_id"),
                "user_request": context.get("user_request"),
                "tool_calls": context.get("tool_calls", [])
            }
        }
        
        # Stocker dans Qdrant (vecteurs)
        self.store_gene_snapshot(gene_id, new_content, mutation)
        
        # Mettre à jour le graphe de dépendances dans Neo4j
        self.update_dependency_graph(gene_id, new_content)
        
        # Logger l'évolution
        self.log_evolution(gene_id, mutation)
        
    def reconstruct_file(self, file_path: str, target_date: datetime = None):
        """Reconstruire un fichier à une date donnée"""
        genes = self.get_file_genes(file_path)
        
        if target_date:
            # Récupérer l'état à la date cible
            return self.get_historical_state(genes, target_date)
        else:
            # Reconstruire depuis les gènes actuels
            return self.assemble_from_genes(genes)
```

## 4. Système de Reconstruction

### Reconstructeur de Projet
```python
class ProjectReconstructor:
    def __init__(self, db_config):
        self.genome_db = GenomeDatabase(db_config)
        
    def reconstruct_project(self, 
                          project_path: str, 
                          target_date: datetime = None,
                          filter_healthy: bool = True):
        """Reconstruire un projet complet depuis la DB"""
        
        # 1. Récupérer tous les gènes du projet
        genes = self.genome_db.get_project_genes(project_path, target_date)
        
        # 2. Filtrer les gènes sains si demandé
        if filter_healthy:
            genes = [g for g in genes if g['health']['testsPassing']]
        
        # 3. Résoudre les dépendances
        dependency_order = self.resolve_dependencies(genes)
        
        # 4. Reconstruire dans l'ordre
        for gene in dependency_order:
            self.materialize_gene(gene, project_path)
            
        # 5. Vérifier l'intégrité
        return self.verify_reconstruction(project_path)
    
    def create_evolution_report(self, gene_id: str):
        """Créer un rapport d'évolution pour un gène"""
        evolution = self.genome_db.get_gene_evolution(gene_id)
        
        return {
            "birth": evolution[0],
            "mutations": len(evolution) - 1,
            "last_modified": evolution[-1]['timestamp'],
            "contributors": list(set([e['mutator'] for e in evolution])),
            "health_trend": self.analyze_health_trend(evolution),
            "complexity_evolution": self.analyze_complexity_trend(evolution)
        }
```

## 5. Self-Awareness Module

### Module de Conscience du Code
```python
class CodeSelfAwareness:
    def __init__(self, genome_db):
        self.genome = genome_db
        self.memory = LongTermMemory()
        
    def understand_purpose(self, gene_id: str) -> Dict[str, Any]:
        """Comprendre pourquoi un gène existe"""
        gene = self.genome.get_gene(gene_id)
        
        return {
            "original_intent": gene['dna']['birth']['reason'],
            "evolution_reasons": [e['reason'] for e in gene['dna']['evolution']],
            "current_purpose": self.infer_current_purpose(gene),
            "impact_score": self.calculate_impact(gene),
            "suggestions": self.suggest_improvements(gene)
        }
    
    def find_redundancies(self) -> List[Dict[str, Any]]:
        """Trouver les gènes redondants"""
        all_genes = self.genome.get_all_genes()
        embeddings = [g['embedding'] for g in all_genes]
        
        # Clustering pour trouver les gènes similaires
        clusters = self.cluster_by_similarity(embeddings)
        
        redundancies = []
        for cluster in clusters:
            if len(cluster) > 1:
                redundancies.append({
                    "genes": cluster,
                    "similarity": self.calculate_similarity(cluster),
                    "recommendation": self.recommend_merge_or_keep(cluster)
                })
                
        return redundancies
    
    def health_check(self) -> Dict[str, Any]:
        """Vérifier la santé globale du génome"""
        return {
            "total_genes": self.genome.count(),
            "healthy_genes": self.genome.count_healthy(),
            "mutation_rate": self.calculate_mutation_rate(),
            "complexity_distribution": self.analyze_complexity(),
            "dependency_health": self.check_dependency_cycles(),
            "recommendations": self.generate_health_recommendations()
        }
```

## 6. Intégration avec AutoWeave

### Configuration
```javascript
// config/genetic-code.js
module.exports = {
    genome: {
        enabled: true,
        trackingLevel: 'full', // 'minimal', 'standard', 'full'
        autoReconstructEnabled: true,
        healthCheckInterval: 3600000, // 1 heure
        
        storage: {
            primary: 'qdrant',
            graph: 'neo4j',
            cache: 'redis'
        },
        
        policies: {
            retentionDays: 90,
            snapshotFrequency: 'on_change', // 'hourly', 'daily', 'on_change'
            compressionEnabled: true
        }
    },
    
    selfAwareness: {
        enabled: true,
        analysisDepth: 'deep',
        redundancyCheckInterval: 86400000, // 24 heures
        autoCleanupEnabled: false // Nécessite confirmation
    }
};
```

### API Endpoints
```javascript
// routes/genome.js
router.get('/api/genome/gene/:geneId', async (req, res) => {
    const gene = await genomeDB.getGene(req.params.geneId);
    res.json(gene);
});

router.get('/api/genome/evolution/:filePath', async (req, res) => {
    const evolution = await genomeDB.getFileEvolution(req.params.filePath);
    res.json(evolution);
});

router.post('/api/genome/reconstruct', async (req, res) => {
    const { targetDate, filterHealthy } = req.body;
    const result = await reconstructor.reconstructProject(targetDate, filterHealthy);
    res.json(result);
});

router.get('/api/genome/health', async (req, res) => {
    const health = await selfAwareness.healthCheck();
    res.json(health);
});
```

## 7. Cas d'Usage

### 1. Debugging Temporel
```javascript
// "Pourquoi cette fonction a-t-elle changé ?"
const evolution = await genome.getGeneEvolution('AWF-20250111-1042-CLD-7B3A');
console.log(`Cette fonction a évolué ${evolution.length} fois`);
evolution.forEach(e => {
    console.log(`${e.timestamp}: ${e.reason} par ${e.mutator}`);
});
```

### 2. Reconstruction Sélective
```javascript
// "Reconstruire seulement les parties saines du 10 janvier"
const snapshot = await reconstructor.reconstructProject({
    targetDate: new Date('2025-01-10'),
    filterHealthy: true,
    includeTags: ['core', 'stable']
});
```

### 3. Analyse d'Impact
```javascript
// "Que se passe-t-il si je supprime cette fonction ?"
const impact = await genome.analyzeRemovalImpact('AWF-20250111-1042-CLD-7B3A');
console.log(`Impact: ${impact.affectedGenes.length} gènes affectés`);
console.log(`Tests cassés: ${impact.brokenTests}`);
```

## Conclusion

Ce système transforme le code en organisme vivant avec :
- **Traçabilité complète** : Chaque ligne a une histoire
- **Reconstruction intelligente** : Le projet peut renaître de ses cendres
- **Self-awareness** : Le système comprend sa propre structure
- **Évolution contrôlée** : Les mutations sont tracées et réversibles

C'est un véritable "ADN numérique" qui permet au projet de s'auto-documenter et de s'auto-réparer.