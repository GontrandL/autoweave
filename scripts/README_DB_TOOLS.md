# AutoWeave Database Reading Tools

Ces outils permettent de lire et analyser les données stockées dans Qdrant et Memgraph après la migration AutoWeave.

## Installation des dépendances

```bash
# Pour simple_db_reader.py (minimum requis)
pip install qdrant-client neo4j

# Pour db_reader.py (version complète)
pip install qdrant-client neo4j openai
```

## Configuration

Les outils utilisent des variables d'environnement pour se connecter :

```bash
# Qdrant
export QDRANT_HOST=localhost
export QDRANT_PORT=6333
export QDRANT_API_KEY=your_api_key  # Optionnel

# Memgraph
export MEMGRAPH_HOST=localhost
export MEMGRAPH_PORT=7687

# Pour les embeddings (db_reader.py uniquement)
export OPENAI_API_KEY=your_openai_key
```

## Outil 1: simple_db_reader.py

Version simplifiée sans dépendances aux utils AutoWeave.

### Commandes disponibles

#### 1. Afficher les statistiques
```bash
python simple_db_reader.py stats
```

#### 2. Lister les collections
```bash
python simple_db_reader.py list
```

#### 3. Lire des échantillons d'une collection
```bash
python simple_db_reader.py read --collection autoweave_code --limit 5
```

#### 4. Chercher des fichiers
```bash
# Tous les fichiers
python simple_db_reader.py find

# Fichiers contenant "agent"
python simple_db_reader.py find --pattern agent

# Fichiers JavaScript
python simple_db_reader.py find --pattern .js
```

#### 5. Récupérer le contenu d'un fichier
```bash
python simple_db_reader.py get --file /home/gontrand/AutoWeave/src/core/autoweave.js
```

#### 6. Exporter tous les fichiers
```bash
python simple_db_reader.py export --output ./exported_autoweave
```

## Outil 2: db_reader.py

Version complète avec plus de fonctionnalités.

### Commandes disponibles

#### 1. Lire toutes les données
```bash
python db_reader.py read --mode direct
```

#### 2. Rechercher avec embeddings
```bash
python db_reader.py search --query "agent creation" --limit 10
```

#### 3. Exporter un snapshot
```bash
# Avant migration
python db_reader.py export --output before_migration.json

# Après migration
python db_reader.py export --output after_migration.json
```

#### 4. Comparer deux snapshots
```bash
python db_reader.py compare --before before_migration.json --after after_migration.json
```

#### 5. Récupérer un fichier spécifique
```bash
python db_reader.py get-file --file-path /home/gontrand/AutoWeave/src/routes/agents.js
```

## Outil 3: mem0-bridge.py

Bridge Python pour interagir avec mem0 self-hosted.

### Utilisation

```bash
# Vérifier la santé
python mem0-bridge.py health

# Ajouter une mémoire
python mem0-bridge.py add "user123" "This is a test memory" '{}'

# Rechercher
python mem0-bridge.py search "user123" "test" 5

# Récupérer toutes les mémoires
python mem0-bridge.py get_all "user123"
```

## Exemples d'utilisation

### 1. Vérifier que les fichiers ont été indexés

```bash
# Voir combien de fichiers sont dans la DB
python simple_db_reader.py stats

# Chercher un fichier spécifique
python simple_db_reader.py find --pattern "autoweave.js"

# Lire son contenu
python simple_db_reader.py get --file /chemin/vers/fichier.js
```

### 2. Comparer avant/après migration

```bash
# Avant la migration
python db_reader.py export --output snapshot_before.json

# ... Faire la migration ...

# Après la migration
python db_reader.py export --output snapshot_after.json

# Comparer
python db_reader.py compare --before snapshot_before.json --after snapshot_after.json
```

### 3. Exporter tous les fichiers indexés

```bash
# Exporter vers un répertoire local
python simple_db_reader.py export --output ./autoweave_from_db

# Vérifier l'export
ls -la ./autoweave_from_db/
```

## Structure des données dans Qdrant

Les fichiers sont stockés dans la collection `autoweave_code` avec la structure suivante :

```json
{
  "file_path": "/chemin/complet/du/fichier.js",
  "content": "// Contenu complet du fichier...",
  "type": "file",
  "language": "javascript",
  "metadata": {
    "size": 1234,
    "last_modified": "2024-01-20T10:30:00Z"
  }
}
```

## Troubleshooting

### Erreur de connexion à Qdrant

1. Vérifier que Qdrant est lancé :
```bash
docker ps | grep qdrant
```

2. Tester la connexion :
```bash
curl http://localhost:6333/collections
```

### Erreur de connexion à Memgraph

1. Vérifier que Memgraph est lancé :
```bash
docker ps | grep memgraph
```

2. Tester avec memgraph-cli :
```bash
echo "MATCH (n) RETURN COUNT(n);" | mgconsole
```

### Pas de données trouvées

1. Vérifier le nom de la collection :
```bash
python simple_db_reader.py list
```

2. Vérifier que l'indexation a été faite :
```bash
# Dans les logs du hook pre_tool_use
tail -f /tmp/claude_hooks.log
```

## Notes importantes

- Les outils sont en lecture seule, ils ne modifient pas les données
- L'export peut prendre du temps pour de gros projets
- Les embeddings nécessitent une clé OpenAI pour la recherche sémantique
- Memgraph est optionnel, les outils fonctionnent avec Qdrant seul