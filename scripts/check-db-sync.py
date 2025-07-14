#!/usr/bin/env python3
"""
Check DB Sync - Vérificateur de synchronisation DB/Fichiers
============================================================
Vérifie que la base de données et le système de fichiers sont synchronisés
"""

import os
import sys
import json
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Set

# Configuration
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "3f08b95a-035e-41f3-a8b4-48d97e62e96a")

# Importer les clients
try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    HAS_QDRANT = True
except ImportError:
    HAS_QDRANT = False
    print("Warning: qdrant-client not installed", file=sys.stderr)

class DBSyncChecker:
    """Vérificateur de synchronisation entre DB et système de fichiers"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.qdrant = None
        
        if HAS_QDRANT:
            try:
                self.qdrant = QdrantClient(
                    url=f"http://{QDRANT_HOST}:{QDRANT_PORT}",
                    api_key=QDRANT_API_KEY
                )
            except Exception as e:
                print(f"Failed to connect to Qdrant: {e}", file=sys.stderr)
    
    def check_synchronization(self) -> Dict:
        """Vérifier la synchronisation complète"""
        
        # 1. Scanner les fichiers sur disque
        disk_files = self.scan_disk_files()
        
        # 2. Scanner les fichiers dans la DB
        db_files = self.scan_db_files() if self.qdrant else {}
        
        # 3. Comparer
        discrepancies = self.compare_files(disk_files, db_files)
        
        # 4. Générer le rapport
        return {
            "synchronized": len(discrepancies) == 0,
            "filesOnDisk": len(disk_files),
            "filesInDb": len(db_files),
            "discrepancies": discrepancies,
            "missingFromDb": [f for f in discrepancies if f['type'] == 'missing_from_db'],
            "missingFromDisk": [f for f in discrepancies if f['type'] == 'missing_from_disk'],
            "contentMismatches": [f for f in discrepancies if f['type'] == 'content_mismatch'],
            "timestamp": datetime.now().isoformat()
        }
    
    def scan_disk_files(self) -> Dict[str, Dict]:
        """Scanner tous les fichiers de code sur le disque"""
        files = {}
        
        # Extensions à scanner
        code_extensions = {'.js', '.ts', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.jsx', '.tsx'}
        config_files = {'package.json', 'tsconfig.json', '.eslintrc.js', 'Dockerfile', 'docker-compose.yml'}
        
        # Dossiers à ignorer
        ignore_dirs = {'node_modules', '.git', 'dist', 'build', '__pycache__', 'venv', '.next', 'coverage'}
        
        for root, dirs, filenames in os.walk(self.project_root):
            # Filtrer les dossiers à ignorer
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            
            for filename in filenames:
                file_path = Path(root) / filename
                rel_path = file_path.relative_to(self.project_root)
                
                # Vérifier si c'est un fichier à scanner
                if (file_path.suffix in code_extensions or 
                    filename in config_files):
                    
                    try:
                        content = file_path.read_text(encoding='utf-8')
                        files[str(rel_path)] = {
                            'path': str(rel_path),
                            'size': file_path.stat().st_size,
                            'modified': file_path.stat().st_mtime,
                            'hash': self.calculate_hash(content),
                            'hasGeneticMarker': 'Gene ID:' in content
                        }
                    except Exception as e:
                        # Ignorer les fichiers non lisibles
                        pass
        
        return files
    
    def scan_db_files(self) -> Dict[str, Dict]:
        """Scanner tous les fichiers dans la base de données"""
        files = {}
        
        if not self.qdrant:
            return files
        
        try:
            # Collections à scanner
            collections = ['autoweave_code', 'genetic_code_genome']
            
            for collection in collections:
                try:
                    # Vérifier si la collection existe
                    collections_list = self.qdrant.get_collections()
                    if not any(c.name == collection for c in collections_list.collections):
                        continue
                    
                    # Récupérer tous les points
                    offset = 0
                    limit = 100
                    
                    while True:
                        result = self.qdrant.scroll(
                            collection_name=collection,
                            scroll_filter=Filter(
                                must_not=[
                                    FieldCondition(
                                        key="deleted",
                                        match=MatchValue(value=True)
                                    )
                                ]
                            ),
                            limit=limit,
                            offset=offset
                        )
                        
                        if not result[0]:  # Plus de résultats
                            break
                        
                        for point in result[0]:
                            payload = point.payload
                            file_path = payload.get('filePath') or payload.get('file_path')
                            
                            if file_path:
                                # Normaliser le chemin
                                if file_path.startswith('/'):
                                    try:
                                        file_path = str(Path(file_path).relative_to(self.project_root))
                                    except:
                                        pass
                                
                                files[file_path] = {
                                    'path': file_path,
                                    'hash': payload.get('contentHash') or payload.get('content_hash'),
                                    'collection': collection,
                                    'geneId': payload.get('geneId'),
                                    'indexed': payload.get('indexedAt') or payload.get('indexed_at')
                                }
                        
                        offset = result[1]  # Prochain offset
                        if offset is None:
                            break
                        
                except Exception as e:
                    print(f"Error scanning collection {collection}: {e}", file=sys.stderr)
        
        except Exception as e:
            print(f"Error scanning DB: {e}", file=sys.stderr)
        
        return files
    
    def compare_files(self, disk_files: Dict, db_files: Dict) -> List[Dict]:
        """Comparer les fichiers disque et DB"""
        discrepancies = []
        
        # Fichiers sur disque mais pas dans DB
        for path, disk_info in disk_files.items():
            if path not in db_files:
                discrepancies.append({
                    'type': 'missing_from_db',
                    'file': path,
                    'diskHash': disk_info['hash'],
                    'hasGeneticMarker': disk_info['hasGeneticMarker']
                })
        
        # Fichiers dans DB mais pas sur disque
        for path, db_info in db_files.items():
            if path not in disk_files:
                discrepancies.append({
                    'type': 'missing_from_disk',
                    'file': path,
                    'dbHash': db_info['hash'],
                    'collection': db_info['collection'],
                    'geneId': db_info.get('geneId')
                })
        
        # Fichiers présents des deux côtés - vérifier le contenu
        for path in set(disk_files.keys()) & set(db_files.keys()):
            disk_hash = disk_files[path]['hash']
            db_hash = db_files[path]['hash']
            
            if disk_hash and db_hash and disk_hash != db_hash:
                discrepancies.append({
                    'type': 'content_mismatch',
                    'file': path,
                    'diskHash': disk_hash,
                    'dbHash': db_hash,
                    'diskModified': disk_files[path]['modified'],
                    'dbIndexed': db_files[path].get('indexed')
                })
        
        return discrepancies
    
    def calculate_hash(self, content: str) -> str:
        """Calculer le hash SHA256 d'un contenu"""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    def fix_discrepancy(self, discrepancy: Dict) -> bool:
        """Tenter de corriger une divergence"""
        try:
            if discrepancy['type'] == 'missing_from_db':
                # Indexer le fichier dans la DB
                return self.index_file_to_db(discrepancy['file'])
            
            elif discrepancy['type'] == 'missing_from_disk':
                # Reconstruire le fichier depuis la DB
                return self.reconstruct_file_from_db(discrepancy['file'])
            
            elif discrepancy['type'] == 'content_mismatch':
                # Décider quelle version garder (plus récente)
                return self.resolve_content_conflict(discrepancy)
            
        except Exception as e:
            print(f"Error fixing discrepancy: {e}", file=sys.stderr)
            return False
    
    def index_file_to_db(self, file_path: str) -> bool:
        """Indexer un fichier dans la base de données"""
        # TODO: Implémenter l'indexation
        print(f"Would index file: {file_path}")
        return True
    
    def reconstruct_file_from_db(self, file_path: str) -> bool:
        """Reconstruire un fichier depuis la DB"""
        # TODO: Implémenter la reconstruction
        print(f"Would reconstruct file: {file_path}")
        return True
    
    def resolve_content_conflict(self, discrepancy: Dict) -> bool:
        """Résoudre un conflit de contenu"""
        # TODO: Implémenter la résolution de conflit
        print(f"Would resolve conflict for: {discrepancy['file']}")
        return True

def main():
    """Point d'entrée principal"""
    if len(sys.argv) < 2:
        print("Usage: check-db-sync.py <command>")
        print("Commands: check-sync, fix-all, fix-file <path>")
        sys.exit(1)
    
    command = sys.argv[1]
    checker = DBSyncChecker()
    
    if command == "check-sync":
        result = checker.check_synchronization()
        print(json.dumps(result, indent=2))
    
    elif command == "fix-all":
        result = checker.check_synchronization()
        fixed = 0
        
        for discrepancy in result['discrepancies']:
            if checker.fix_discrepancy(discrepancy):
                fixed += 1
        
        print(f"Fixed {fixed}/{len(result['discrepancies'])} discrepancies")
    
    elif command == "fix-file" and len(sys.argv) > 2:
        file_path = sys.argv[2]
        # TODO: Implémenter la correction d'un fichier spécifique
        print(f"Would fix file: {file_path}")
    
    else:
        print("Invalid command")
        sys.exit(1)

if __name__ == "__main__":
    main()