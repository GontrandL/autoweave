#!/usr/bin/env python3
"""
Simple Database Reader for AutoWeave
====================================
Version simplifiée sans dépendances aux utils AutoWeave
Peut lire Qdrant et afficher les données indexées
"""

import os
import json
import argparse
from datetime import datetime
from typing import Dict, List, Optional, Any

try:
    from qdrant_client import QdrantClient
    HAS_QDRANT = True
except ImportError:
    print("Warning: qdrant-client not installed. Install with: pip install qdrant-client")
    HAS_QDRANT = False

try:
    import neo4j
    HAS_NEO4J = True
except ImportError:
    print("Warning: neo4j not installed. Install with: pip install neo4j")
    HAS_NEO4J = False


class SimpleDBReader:
    """Lecteur simple pour les bases de données"""
    
    def __init__(self):
        self.qdrant = None
        self.memgraph = None
        self.connected = False
        
        # Essayer de se connecter
        self._connect()
    
    def _connect(self):
        """Se connecter aux bases de données"""
        # Connexion Qdrant
        if HAS_QDRANT:
            try:
                host = os.getenv("QDRANT_HOST", "localhost")
                port = os.getenv("QDRANT_PORT", "6333")
                api_key = os.getenv("QDRANT_API_KEY", "3f08b95a-035e-41f3-a8b4-48d97e62e96a")
                
                print(f"Connecting to Qdrant at {host}:{port}...")
                self.qdrant = QdrantClient(
                    url=f"http://{host}:{port}",
                    api_key=api_key,
                    prefer_grpc=False,
                    timeout=10
                )
                
                # Test de connexion
                collections = self.qdrant.get_collections()
                print(f"✓ Connected to Qdrant. Found {len(collections.collections)} collections")
                self.connected = True
                
            except Exception as e:
                print(f"✗ Could not connect to Qdrant: {e}")
                self.qdrant = None
        
        # Connexion Memgraph (optionnelle)
        if HAS_NEO4J:
            try:
                host = os.getenv("MEMGRAPH_HOST", "localhost")
                port = os.getenv("MEMGRAPH_PORT", "7687")
                
                print(f"Connecting to Memgraph at {host}:{port}...")
                uri = f"bolt://{host}:{port}"
                self.memgraph = neo4j.GraphDatabase.driver(uri)
                
                # Test de connexion
                with self.memgraph.session() as session:
                    result = session.run("RETURN 1")
                    result.single()
                
                print("✓ Connected to Memgraph")
                
            except Exception as e:
                print(f"✗ Could not connect to Memgraph: {e}")
                self.memgraph = None
    
    def list_collections(self) -> List[Dict[str, Any]]:
        """Lister toutes les collections Qdrant"""
        if not self.qdrant:
            return []
        
        try:
            collections = self.qdrant.get_collections()
            result = []
            
            for collection in collections.collections:
                name = collection.name
                
                # Obtenir le nombre de points
                count = self.qdrant.count(collection_name=name).count
                
                # Obtenir la config
                info = self.qdrant.get_collection(name)
                
                result.append({
                    "name": name,
                    "count": count,
                    "vector_size": info.config.params.vectors.size if hasattr(info.config.params.vectors, 'size') else "Unknown",
                    "distance": str(info.config.params.vectors.distance) if hasattr(info.config.params.vectors, 'distance') else "Unknown"
                })
            
            return result
            
        except Exception as e:
            print(f"Error listing collections: {e}")
            return []
    
    def read_collection(self, collection_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Lire des échantillons d'une collection"""
        if not self.qdrant:
            return []
        
        try:
            # Vérifier que la collection existe
            collections = self.qdrant.get_collections()
            if not any(c.name == collection_name for c in collections.collections):
                print(f"Collection '{collection_name}' not found")
                return []
            
            # Récupérer des points
            scroll_result = self.qdrant.scroll(
                collection_name=collection_name,
                limit=limit,
                with_payload=True,
                with_vectors=False
            )
            
            points = []
            for point in scroll_result[0]:
                points.append({
                    "id": point.id,
                    "payload": point.payload
                })
            
            return points
            
        except Exception as e:
            print(f"Error reading collection: {e}")
            return []
    
    def find_files(self, pattern: str = "", collection: str = "autoweave_code") -> List[Dict[str, Any]]:
        """Trouver des fichiers dans la collection de code"""
        if not self.qdrant:
            return []
        
        try:
            # Récupérer tous les points (limite raisonnable)
            all_points = []
            offset = None
            
            while True:
                scroll_result = self.qdrant.scroll(
                    collection_name=collection,
                    limit=100,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False
                )
                
                points, next_offset = scroll_result
                all_points.extend(points)
                
                if next_offset is None or len(all_points) > 1000:
                    break
                    
                offset = next_offset
            
            # Filtrer par pattern
            files = []
            for point in all_points:
                file_path = point.payload.get("file_path", "")
                
                if not pattern or pattern.lower() in file_path.lower():
                    files.append({
                        "id": point.id,
                        "file_path": file_path,
                        "type": point.payload.get("type", "unknown"),
                        "language": point.payload.get("language", "unknown"),
                        "size": len(point.payload.get("content", "")),
                        "metadata": {k: v for k, v in point.payload.items() 
                                   if k not in ["content", "file_path", "type", "language"]}
                    })
            
            return files
            
        except Exception as e:
            print(f"Error finding files: {e}")
            return []
    
    def get_file_content(self, file_path: str, collection: str = "autoweave_code") -> Optional[str]:
        """Récupérer le contenu d'un fichier"""
        if not self.qdrant:
            return None
        
        try:
            # Parcourir la collection pour trouver le fichier
            offset = None
            
            while True:
                scroll_result = self.qdrant.scroll(
                    collection_name=collection,
                    limit=100,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False
                )
                
                points, next_offset = scroll_result
                
                for point in points:
                    if point.payload.get("file_path") == file_path:
                        return point.payload.get("content", "")
                
                if next_offset is None:
                    break
                    
                offset = next_offset
            
            return None
            
        except Exception as e:
            print(f"Error getting file content: {e}")
            return None
    
    def export_files(self, output_dir: str = "exported_files", collection: str = "autoweave_code"):
        """Exporter tous les fichiers vers un répertoire"""
        import os
        from pathlib import Path
        
        if not self.qdrant:
            print("Qdrant not connected")
            return
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        print(f"Exporting files to {output_path}...")
        
        try:
            exported = 0
            offset = None
            
            while True:
                scroll_result = self.qdrant.scroll(
                    collection_name=collection,
                    limit=50,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False
                )
                
                points, next_offset = scroll_result
                
                for point in points:
                    file_path = point.payload.get("file_path", "")
                    content = point.payload.get("content", "")
                    
                    if file_path and content:
                        # Nettoyer le chemin
                        clean_path = file_path.lstrip("/")
                        export_file = output_path / clean_path
                        
                        # Créer les répertoires
                        export_file.parent.mkdir(parents=True, exist_ok=True)
                        
                        # Écrire le fichier
                        export_file.write_text(content)
                        exported += 1
                        
                        if exported % 10 == 0:
                            print(f"  Exported {exported} files...")
                
                if next_offset is None:
                    break
                    
                offset = next_offset
            
            print(f"✓ Exported {exported} files to {output_path}")
            
        except Exception as e:
            print(f"Error exporting files: {e}")
    
    def print_stats(self):
        """Afficher des statistiques générales"""
        print("\n=== DATABASE STATISTICS ===")
        
        if self.qdrant:
            collections = self.list_collections()
            
            print(f"\nQdrant Collections ({len(collections)}):")
            total_vectors = 0
            
            for coll in collections:
                print(f"  - {coll['name']}: {coll['count']} vectors (dim={coll['vector_size']}, dist={coll['distance']})")
                total_vectors += coll['count']
            
            print(f"\nTotal vectors: {total_vectors}")
        
        if self.memgraph:
            try:
                with self.memgraph.session() as session:
                    # Compter les nœuds
                    node_count = session.run("MATCH (n) RETURN COUNT(n) as count").single()["count"]
                    # Compter les relations
                    rel_count = session.run("MATCH ()-[r]->() RETURN COUNT(r) as count").single()["count"]
                    
                    print(f"\nMemgraph:")
                    print(f"  - Nodes: {node_count}")
                    print(f"  - Relationships: {rel_count}")
            except Exception as e:
                print(f"\nMemgraph: Error reading stats - {e}")


def main():
    """Fonction principale"""
    parser = argparse.ArgumentParser(description="Simple AutoWeave DB Reader")
    parser.add_argument("command", nargs="?", default="stats",
                       choices=["stats", "list", "read", "find", "get", "export"],
                       help="Command to execute")
    parser.add_argument("--collection", default="autoweave_code",
                       help="Collection name")
    parser.add_argument("--limit", type=int, default=10,
                       help="Number of items to show")
    parser.add_argument("--pattern", help="Search pattern for find command")
    parser.add_argument("--file", help="File path for get command")
    parser.add_argument("--output", default="exported_files",
                       help="Output directory for export command")
    
    args = parser.parse_args()
    
    # Créer le lecteur
    reader = SimpleDBReader()
    
    if not reader.connected:
        print("\nNo database connection available. Check your configuration.")
        return
    
    # Exécuter la commande
    if args.command == "stats":
        reader.print_stats()
    
    elif args.command == "list":
        collections = reader.list_collections()
        print(f"\nFound {len(collections)} collections:")
        for coll in collections:
            print(f"  - {coll['name']}: {coll['count']} items")
    
    elif args.command == "read":
        print(f"\nReading from collection: {args.collection}")
        points = reader.read_collection(args.collection, args.limit)
        
        for i, point in enumerate(points):
            print(f"\n--- Point {i+1} (ID: {point['id']}) ---")
            print(json.dumps(point['payload'], indent=2))
    
    elif args.command == "find":
        pattern = args.pattern or ""
        print(f"\nSearching for files matching: '{pattern}'")
        
        files = reader.find_files(pattern, args.collection)
        print(f"\nFound {len(files)} files:")
        
        for file in files[:args.limit]:
            print(f"\n- {file['file_path']}")
            print(f"  Type: {file['type']}, Language: {file['language']}, Size: {file['size']} bytes")
            if file['metadata']:
                print(f"  Metadata: {file['metadata']}")
    
    elif args.command == "get":
        if not args.file:
            print("Error: --file required for get command")
            return
        
        print(f"\nGetting content for: {args.file}")
        content = reader.get_file_content(args.file, args.collection)
        
        if content:
            print(f"\n{'='*60}")
            print(content)
            print(f"{'='*60}")
        else:
            print(f"File not found: {args.file}")
    
    elif args.command == "export":
        reader.export_files(args.output, args.collection)


if __name__ == "__main__":
    main()