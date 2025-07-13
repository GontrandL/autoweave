#!/usr/bin/env python3
"""
Database Reader Tool for AutoWeave
==================================
Outil pour lire et analyser les données dans Qdrant et Memgraph
Permet de comparer l'état avant/après migration
"""

import os
import sys
import json
import argparse
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import logging
from pathlib import Path

# Ajouter le chemin pour importer les utils AutoWeave
sys.path.insert(0, str(Path(__file__).parent.parent / ".claude"))

try:
    from utils.db_utils import get_qdrant_client, get_memgraph_client
    from utils.embeddings import EmbeddingsGenerator
    from utils.logger import setup_logger
except ImportError:
    print("Warning: Could not import AutoWeave utils, using direct imports")
    # Fallback imports directs
    from qdrant_client import QdrantClient
    import neo4j

# Configuration logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DatabaseReader:
    """Lecteur pour les bases de données AutoWeave"""
    
    def __init__(self, mode: str = "production"):
        self.mode = mode
        self.qdrant = None
        self.memgraph = None
        self.stats = {
            "qdrant": {},
            "memgraph": {},
            "timestamp": datetime.now().isoformat()
        }
        
        # Initialiser les connexions
        self._init_connections()
    
    def _init_connections(self):
        """Initialiser les connexions aux bases de données"""
        try:
            # Connexion Qdrant
            if self.mode == "direct":
                # Connexion directe sans utils
                host = os.getenv("QDRANT_HOST", "localhost")
                port = os.getenv("QDRANT_PORT", "6333")
                api_key = os.getenv("QDRANT_API_KEY")
                
                logger.info(f"Connecting to Qdrant at {host}:{port}")
                
                if api_key:
                    self.qdrant = QdrantClient(
                        url=f"http://{host}:{port}",
                        api_key=api_key,
                        prefer_grpc=False
                    )
                else:
                    self.qdrant = QdrantClient(
                        url=f"http://{host}:{port}",
                        prefer_grpc=False
                    )
            else:
                # Utiliser les utils AutoWeave
                self.qdrant = get_qdrant_client(self.mode)
            
            logger.info("Connected to Qdrant successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to Qdrant: {e}")
            self.qdrant = None
        
        try:
            # Connexion Memgraph
            if self.mode == "direct":
                # Connexion directe
                host = os.getenv("MEMGRAPH_HOST", "localhost")
                port = os.getenv("MEMGRAPH_PORT", "7687")
                
                logger.info(f"Connecting to Memgraph at {host}:{port}")
                
                uri = f"bolt://{host}:{port}"
                self.memgraph = neo4j.GraphDatabase.driver(uri)
            else:
                # Utiliser les utils AutoWeave
                self.memgraph = get_memgraph_client(self.mode)
            
            logger.info("Connected to Memgraph successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to Memgraph: {e}")
            self.memgraph = None
    
    def read_qdrant_collections(self) -> Dict[str, Any]:
        """Lire toutes les collections Qdrant"""
        if not self.qdrant:
            logger.error("Qdrant client not initialized")
            return {"error": "Qdrant not connected"}
        
        try:
            collections = self.qdrant.get_collections()
            collection_stats = {}
            
            for collection in collections.collections:
                name = collection.name
                logger.info(f"Reading collection: {name}")
                
                # Obtenir les infos de la collection
                info = self.qdrant.get_collection(name)
                
                # Compter les points
                count_result = self.qdrant.count(collection_name=name)
                count = count_result.count if hasattr(count_result, 'count') else 0
                
                # Échantillonner quelques points
                sample_points = []
                try:
                    scroll_result = self.qdrant.scroll(
                        collection_name=name,
                        limit=5,
                        with_payload=True,
                        with_vectors=False
                    )
                    
                    for point in scroll_result[0]:
                        sample_points.append({
                            "id": point.id,
                            "payload": point.payload
                        })
                except Exception as e:
                    logger.warning(f"Could not sample points from {name}: {e}")
                
                collection_stats[name] = {
                    "count": count,
                    "config": {
                        "vector_size": info.config.params.vectors.size if hasattr(info.config.params.vectors, 'size') else None,
                        "distance": info.config.params.vectors.distance if hasattr(info.config.params.vectors, 'distance') else None,
                    },
                    "sample_points": sample_points
                }
            
            self.stats["qdrant"] = {
                "collections": collection_stats,
                "total_collections": len(collections.collections)
            }
            
            return collection_stats
            
        except Exception as e:
            logger.error(f"Error reading Qdrant: {e}")
            return {"error": str(e)}
    
    def read_memgraph_data(self) -> Dict[str, Any]:
        """Lire les données Memgraph"""
        if not self.memgraph:
            logger.error("Memgraph client not initialized")
            return {"error": "Memgraph not connected"}
        
        try:
            with self.memgraph.session() as session:
                stats = {}
                
                # Compter les nœuds par label
                node_counts = session.run(
                    "MATCH (n) RETURN labels(n) as labels, COUNT(n) as count"
                ).data()
                
                stats["node_counts"] = {}
                for record in node_counts:
                    label = record["labels"][0] if record["labels"] else "No Label"
                    stats["node_counts"][label] = record["count"]
                
                # Compter les relations par type
                rel_counts = session.run(
                    "MATCH ()-[r]->() RETURN type(r) as type, COUNT(r) as count"
                ).data()
                
                stats["relationship_counts"] = {}
                for record in rel_counts:
                    stats["relationship_counts"][record["type"]] = record["count"]
                
                # Échantillonner quelques nœuds
                sample_nodes = session.run(
                    "MATCH (n) RETURN n LIMIT 5"
                ).data()
                
                stats["sample_nodes"] = []
                for record in sample_nodes:
                    node = record["n"]
                    stats["sample_nodes"].append({
                        "labels": list(node.labels) if hasattr(node, 'labels') else [],
                        "properties": dict(node) if node else {}
                    })
                
                # Total counts
                total_nodes = session.run("MATCH (n) RETURN COUNT(n) as count").single()["count"]
                total_rels = session.run("MATCH ()-[r]->() RETURN COUNT(r) as count").single()["count"]
                
                stats["totals"] = {
                    "nodes": total_nodes,
                    "relationships": total_rels
                }
                
                self.stats["memgraph"] = stats
                return stats
                
        except Exception as e:
            logger.error(f"Error reading Memgraph: {e}")
            return {"error": str(e)}
    
    def search_code_files(self, query: str = "", limit: int = 10) -> List[Dict[str, Any]]:
        """Rechercher des fichiers de code dans Qdrant"""
        if not self.qdrant:
            return []
        
        try:
            collection_name = "autoweave_code"
            
            # Vérifier si la collection existe
            collections = self.qdrant.get_collections()
            if not any(c.name == collection_name for c in collections.collections):
                logger.warning(f"Collection {collection_name} not found")
                return []
            
            if query:
                # Recherche avec embedding
                try:
                    embeddings_gen = EmbeddingsGenerator(mode=self.mode)
                    embedding = embeddings_gen.generate_embedding(query).embedding
                    
                    results = self.qdrant.query_points(
                        collection_name=collection_name,
                        query=embedding,
                        limit=limit,
                        with_payload=True
                    )
                    
                    return [
                        {
                            "id": point.id,
                            "score": point.score,
                            "file_path": point.payload.get("file_path"),
                            "type": point.payload.get("type"),
                            "language": point.payload.get("language"),
                            "content_preview": point.payload.get("content", "")[:200] + "..."
                        }
                        for point in results.points
                    ]
                    
                except Exception as e:
                    logger.warning(f"Could not search with embedding: {e}")
            
            # Fallback: récupérer les derniers fichiers
            scroll_result = self.qdrant.scroll(
                collection_name=collection_name,
                limit=limit,
                with_payload=True,
                with_vectors=False
            )
            
            return [
                {
                    "id": point.id,
                    "file_path": point.payload.get("file_path"),
                    "type": point.payload.get("type"),
                    "language": point.payload.get("language"),
                    "content_preview": point.payload.get("content", "")[:200] + "..."
                }
                for point in scroll_result[0]
            ]
            
        except Exception as e:
            logger.error(f"Error searching code files: {e}")
            return []
    
    def get_file_content(self, file_path: str) -> Optional[str]:
        """Récupérer le contenu complet d'un fichier depuis la DB"""
        if not self.qdrant:
            return None
        
        try:
            collection_name = "autoweave_code"
            
            # Rechercher par file_path exact
            # Note: Qdrant ne supporte pas directement la recherche par payload
            # On doit faire un scroll et filtrer
            scroll_result = self.qdrant.scroll(
                collection_name=collection_name,
                limit=1000,  # Augmenter si nécessaire
                with_payload=True,
                with_vectors=False
            )
            
            for point in scroll_result[0]:
                if point.payload.get("file_path") == file_path:
                    return point.payload.get("content", "")
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting file content: {e}")
            return None
    
    def export_snapshot(self, output_file: str = "db_snapshot.json"):
        """Exporter un snapshot complet des bases de données"""
        logger.info(f"Exporting database snapshot to {output_file}")
        
        snapshot = {
            "timestamp": datetime.now().isoformat(),
            "mode": self.mode,
            "qdrant": {},
            "memgraph": {},
            "summary": {}
        }
        
        # Lire Qdrant
        logger.info("Reading Qdrant data...")
        qdrant_data = self.read_qdrant_collections()
        snapshot["qdrant"] = qdrant_data
        
        # Lire Memgraph
        logger.info("Reading Memgraph data...")
        memgraph_data = self.read_memgraph_data()
        snapshot["memgraph"] = memgraph_data
        
        # Créer un résumé
        snapshot["summary"] = {
            "qdrant_collections": len(qdrant_data) if isinstance(qdrant_data, dict) and "error" not in qdrant_data else 0,
            "total_vectors": sum(
                coll.get("count", 0) 
                for coll in qdrant_data.values() 
                if isinstance(coll, dict)
            ) if isinstance(qdrant_data, dict) else 0,
            "memgraph_nodes": memgraph_data.get("totals", {}).get("nodes", 0) if isinstance(memgraph_data, dict) else 0,
            "memgraph_relationships": memgraph_data.get("totals", {}).get("relationships", 0) if isinstance(memgraph_data, dict) else 0
        }
        
        # Sauvegarder
        with open(output_file, 'w') as f:
            json.dump(snapshot, f, indent=2, default=str)
        
        logger.info(f"Snapshot saved to {output_file}")
        return snapshot
    
    def compare_snapshots(self, before_file: str, after_file: str) -> Dict[str, Any]:
        """Comparer deux snapshots de base de données"""
        logger.info(f"Comparing snapshots: {before_file} vs {after_file}")
        
        with open(before_file, 'r') as f:
            before = json.load(f)
        
        with open(after_file, 'r') as f:
            after = json.load(f)
        
        comparison = {
            "before_timestamp": before["timestamp"],
            "after_timestamp": after["timestamp"],
            "changes": {
                "qdrant": {},
                "memgraph": {}
            }
        }
        
        # Comparer Qdrant
        before_qdrant = before.get("qdrant", {})
        after_qdrant = after.get("qdrant", {})
        
        if isinstance(before_qdrant, dict) and isinstance(after_qdrant, dict):
            # Collections ajoutées/supprimées
            before_collections = set(before_qdrant.keys())
            after_collections = set(after_qdrant.keys())
            
            comparison["changes"]["qdrant"]["added_collections"] = list(after_collections - before_collections)
            comparison["changes"]["qdrant"]["removed_collections"] = list(before_collections - after_collections)
            
            # Changements dans les collections existantes
            common_collections = before_collections & after_collections
            collection_changes = {}
            
            for coll in common_collections:
                before_count = before_qdrant[coll].get("count", 0)
                after_count = after_qdrant[coll].get("count", 0)
                
                if before_count != after_count:
                    collection_changes[coll] = {
                        "before": before_count,
                        "after": after_count,
                        "diff": after_count - before_count
                    }
            
            comparison["changes"]["qdrant"]["collection_changes"] = collection_changes
        
        # Comparer Memgraph
        before_memgraph = before.get("memgraph", {})
        after_memgraph = after.get("memgraph", {})
        
        if isinstance(before_memgraph, dict) and isinstance(after_memgraph, dict):
            # Changements dans les totaux
            before_totals = before_memgraph.get("totals", {})
            after_totals = after_memgraph.get("totals", {})
            
            comparison["changes"]["memgraph"]["node_changes"] = {
                "before": before_totals.get("nodes", 0),
                "after": after_totals.get("nodes", 0),
                "diff": after_totals.get("nodes", 0) - before_totals.get("nodes", 0)
            }
            
            comparison["changes"]["memgraph"]["relationship_changes"] = {
                "before": before_totals.get("relationships", 0),
                "after": after_totals.get("relationships", 0),
                "diff": after_totals.get("relationships", 0) - before_totals.get("relationships", 0)
            }
        
        return comparison


def main():
    """Fonction principale"""
    parser = argparse.ArgumentParser(description="AutoWeave Database Reader")
    parser.add_argument("command", choices=["read", "search", "export", "compare", "get-file"],
                       help="Command to execute")
    parser.add_argument("--mode", default="direct", choices=["direct", "production", "mock"],
                       help="Connection mode")
    parser.add_argument("--query", help="Search query")
    parser.add_argument("--limit", type=int, default=10, help="Result limit")
    parser.add_argument("--output", help="Output file")
    parser.add_argument("--before", help="Before snapshot file (for compare)")
    parser.add_argument("--after", help="After snapshot file (for compare)")
    parser.add_argument("--file-path", help="File path to retrieve")
    
    args = parser.parse_args()
    
    # Créer le lecteur
    reader = DatabaseReader(mode=args.mode)
    
    if args.command == "read":
        # Lire et afficher les stats
        print("\n=== QDRANT DATA ===")
        qdrant_data = reader.read_qdrant_collections()
        print(json.dumps(qdrant_data, indent=2, default=str))
        
        print("\n=== MEMGRAPH DATA ===")
        memgraph_data = reader.read_memgraph_data()
        print(json.dumps(memgraph_data, indent=2, default=str))
        
    elif args.command == "search":
        # Rechercher des fichiers
        query = args.query or ""
        results = reader.search_code_files(query, args.limit)
        
        print(f"\nFound {len(results)} files:")
        for result in results:
            print(f"\n- {result['file_path']}")
            print(f"  Type: {result['type']}, Language: {result['language']}")
            if 'score' in result:
                print(f"  Score: {result['score']:.4f}")
            print(f"  Preview: {result['content_preview']}")
    
    elif args.command == "get-file":
        # Récupérer un fichier spécifique
        if not args.file_path:
            print("Error: --file-path required")
            sys.exit(1)
        
        content = reader.get_file_content(args.file_path)
        if content:
            print(f"\n=== Content of {args.file_path} ===\n")
            print(content)
        else:
            print(f"File not found: {args.file_path}")
    
    elif args.command == "export":
        # Exporter un snapshot
        output_file = args.output or f"db_snapshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        snapshot = reader.export_snapshot(output_file)
        print(f"\nSnapshot exported to: {output_file}")
        print(f"Summary: {json.dumps(snapshot['summary'], indent=2)}")
    
    elif args.command == "compare":
        # Comparer deux snapshots
        if not args.before or not args.after:
            print("Error: --before and --after files required")
            sys.exit(1)
        
        comparison = reader.compare_snapshots(args.before, args.after)
        print(f"\n=== COMPARISON RESULTS ===")
        print(json.dumps(comparison, indent=2, default=str))


if __name__ == "__main__":
    main()