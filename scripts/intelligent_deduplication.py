#!/usr/bin/env python3
"""
Intelligence de Déduplication pour le Système Génétique AutoWeave
================================================================
Système intelligent pour éviter les doublons et optimiser l'historique
"""

import hashlib
import json
from typing import Dict, List, Set, Optional, Tuple
from datetime import datetime, timedelta
import sqlite3
from pathlib import Path

class IntelligentDeduplicator:
    """Système intelligent de déduplication pour les gènes de code"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.dedup_db = self.project_root / ".claude" / "deduplication.db"
        self.init_database()
        
        # Cache des hash récents pour performance
        self.hash_cache: Dict[str, str] = {}
        self.content_cache: Dict[str, Dict] = {}
        
    def init_database(self):
        """Initialiser la base de déduplication"""
        self.dedup_db.parent.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(self.dedup_db)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS content_hashes (
                content_hash TEXT PRIMARY KEY,
                first_seen TIMESTAMP,
                last_seen TIMESTAMP,
                occurrence_count INTEGER DEFAULT 1,
                representative_gene_id TEXT,
                file_paths TEXT,  -- JSON array of file paths
                metadata TEXT     -- JSON metadata
            )
        """)
        
        conn.execute("""
            CREATE TABLE IF NOT EXISTS gene_evolution (
                gene_id TEXT PRIMARY KEY,
                content_hash TEXT,
                parent_gene_id TEXT,
                evolution_type TEXT,  -- creation, mutation, duplication, merge
                confidence_score REAL,
                timestamp TIMESTAMP,
                metadata TEXT
            )
        """)
        
        conn.execute("CREATE INDEX IF NOT EXISTS idx_content_hash ON content_hashes(content_hash)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_gene_evolution ON gene_evolution(gene_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_parent_gene ON gene_evolution(parent_gene_id)")
        
        conn.commit()
        conn.close()
    
    def calculate_content_hash(self, content: str, gene_type: str, name: str) -> str:
        """Calculer un hash intelligent du contenu"""
        # Normaliser le contenu pour détecter les vraies différences
        normalized = self._normalize_content(content)
        
        # Hash composite : contenu + type + nom normalisé
        composite = f"{normalized}::{gene_type}::{name.lower()}"
        return hashlib.sha256(composite.encode()).hexdigest()
    
    def _normalize_content(self, content: str) -> str:
        """Normaliser le contenu pour ignorer les différences non-significatives"""
        lines = content.split('\n')
        normalized_lines = []
        
        for line in lines:
            # Supprimer les espaces/tabs en début/fin
            clean_line = line.strip()
            
            # Ignorer les lignes vides et commentaires simples
            if not clean_line or clean_line.startswith(('#', '//', '/*', '*')):
                continue
                
            # Normaliser les espaces multiples
            clean_line = ' '.join(clean_line.split())
            normalized_lines.append(clean_line)
        
        return '\n'.join(normalized_lines)
    
    def is_duplicate(self, gene_data: Dict) -> Tuple[bool, Optional[str]]:
        """Vérifier si un gène est un doublon intelligent"""
        content_hash = self.calculate_content_hash(
            gene_data['content'], 
            gene_data['type'],
            gene_data['name']
        )
        
        conn = sqlite3.connect(self.dedup_db)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT representative_gene_id, occurrence_count FROM content_hashes WHERE content_hash = ?",
            (content_hash,)
        )
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            # C'est un doublon, retourner l'ID du représentant
            return True, result[0]
        
        return False, None
    
    def register_gene(self, gene_data: Dict, gene_id: str, file_path: str) -> Dict:
        """Enregistrer un gène avec intelligence anti-doublon"""
        content_hash = self.calculate_content_hash(
            gene_data['content'], 
            gene_data['type'],
            gene_data['name']
        )
        
        conn = sqlite3.connect(self.dedup_db)
        cursor = conn.cursor()
        
        # Vérifier si ce hash existe déjà
        cursor.execute(
            "SELECT representative_gene_id, file_paths, occurrence_count FROM content_hashes WHERE content_hash = ?",
            (content_hash,)
        )
        
        existing = cursor.fetchone()
        
        if existing:
            # Mettre à jour l'occurrence existante
            existing_paths = json.loads(existing[1])
            if file_path not in existing_paths:
                existing_paths.append(file_path)
            
            cursor.execute("""
                UPDATE content_hashes 
                SET last_seen = ?, occurrence_count = occurrence_count + 1, file_paths = ?
                WHERE content_hash = ?
            """, (datetime.now().isoformat(), json.dumps(existing_paths), content_hash))
            
            # Enregistrer comme duplication
            cursor.execute("""
                INSERT OR REPLACE INTO gene_evolution 
                (gene_id, content_hash, parent_gene_id, evolution_type, confidence_score, timestamp, metadata)
                VALUES (?, ?, ?, 'duplication', 0.95, ?, ?)
            """, (
                gene_id, content_hash, existing[0], 
                datetime.now().isoformat(),
                json.dumps({'original_file': existing_paths[0], 'duplicate_file': file_path})
            ))
            
            result = {
                'is_duplicate': True,
                'representative_gene_id': existing[0],
                'occurrence_count': existing[2] + 1,
                'action': 'linked_to_existing'
            }
            
        else:
            # Nouveau contenu unique
            cursor.execute("""
                INSERT INTO content_hashes 
                (content_hash, first_seen, last_seen, representative_gene_id, file_paths, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                content_hash, datetime.now().isoformat(), datetime.now().isoformat(),
                gene_id, json.dumps([file_path]), 
                json.dumps({'complexity': gene_data.get('complexity', 0)})
            ))
            
            # Enregistrer comme création
            cursor.execute("""
                INSERT INTO gene_evolution 
                (gene_id, content_hash, evolution_type, confidence_score, timestamp, metadata)
                VALUES (?, ?, 'creation', 1.0, ?, ?)
            """, (
                gene_id, content_hash, datetime.now().isoformat(),
                json.dumps({'file': file_path, 'size': len(gene_data['content'])})
            ))
            
            result = {
                'is_duplicate': False,
                'gene_id': gene_id,
                'action': 'created_new'
            }
        
        conn.commit()
        conn.close()
        
        return result
    
    def detect_mutations(self, old_gene: Dict, new_gene: Dict) -> Dict:
        """Détecter intelligemment les mutations vs les doublons"""
        old_hash = self.calculate_content_hash(old_gene['content'], old_gene['type'], old_gene['name'])
        new_hash = self.calculate_content_hash(new_gene['content'], new_gene['type'], new_gene['name'])
        
        if old_hash == new_hash:
            return {'type': 'no_change', 'confidence': 1.0}
        
        # Calculer la similarité
        similarity = self._calculate_similarity(old_gene['content'], new_gene['content'])
        
        if similarity > 0.8:
            return {
                'type': 'mutation',
                'confidence': similarity,
                'old_hash': old_hash,
                'new_hash': new_hash,
                'similarity': similarity
            }
        elif similarity > 0.3:
            return {
                'type': 'major_refactor',
                'confidence': similarity,
                'old_hash': old_hash,
                'new_hash': new_hash,
                'similarity': similarity
            }
        else:
            return {
                'type': 'replacement',
                'confidence': 1 - similarity,
                'old_hash': old_hash,
                'new_hash': new_hash,
                'similarity': similarity
            }
    
    def _calculate_similarity(self, content1: str, content2: str) -> float:
        """Calculer la similarité entre deux contenus"""
        # Algorithme simplifié de Jaccard
        words1 = set(self._normalize_content(content1).split())
        words2 = set(self._normalize_content(content2).split())
        
        if not words1 and not words2:
            return 1.0
        
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        
        return intersection / union if union > 0 else 0.0
    
    def get_gene_history(self, gene_id: str) -> List[Dict]:
        """Obtenir l'historique complet d'un gène"""
        conn = sqlite3.connect(self.dedup_db)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT evolution_type, confidence_score, timestamp, metadata, parent_gene_id
            FROM gene_evolution 
            WHERE gene_id = ? OR parent_gene_id = ?
            ORDER BY timestamp
        """, (gene_id, gene_id))
        
        history = []
        for row in cursor.fetchall():
            history.append({
                'evolution_type': row[0],
                'confidence_score': row[1],
                'timestamp': row[2],
                'metadata': json.loads(row[3] or '{}'),
                'parent_gene_id': row[4]
            })
        
        conn.close()
        return history
    
    def get_duplication_report(self) -> Dict:
        """Générer un rapport de déduplication intelligent"""
        conn = sqlite3.connect(self.dedup_db)
        cursor = conn.cursor()
        
        # Statistiques de base
        cursor.execute("SELECT COUNT(*) FROM content_hashes")
        unique_contents = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUM(occurrence_count) FROM content_hashes")
        total_genes = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT COUNT(*) FROM content_hashes WHERE occurrence_count > 1")
        duplicated_contents = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUM(occurrence_count - 1) FROM content_hashes WHERE occurrence_count > 1")
        duplicate_instances = cursor.fetchone()[0] or 0
        
        # Top doublons
        cursor.execute("""
            SELECT representative_gene_id, occurrence_count, file_paths 
            FROM content_hashes 
            WHERE occurrence_count > 1 
            ORDER BY occurrence_count DESC 
            LIMIT 10
        """)
        
        top_duplicates = []
        for row in cursor.fetchall():
            top_duplicates.append({
                'gene_id': row[0],
                'count': row[1],
                'files': json.loads(row[2])
            })
        
        conn.close()
        
        efficiency = (1 - (duplicate_instances / total_genes)) * 100 if total_genes > 0 else 100
        
        return {
            'summary': {
                'unique_contents': unique_contents,
                'total_gene_instances': total_genes,
                'duplicated_contents': duplicated_contents,
                'duplicate_instances': duplicate_instances,
                'efficiency_percentage': round(efficiency, 2)
            },
            'top_duplicates': top_duplicates,
            'recommendation': self._generate_recommendations(efficiency, duplicated_contents)
        }
    
    def _generate_recommendations(self, efficiency: float, duplicated_contents: int) -> List[str]:
        """Générer des recommandations intelligentes"""
        recommendations = []
        
        if efficiency < 80:
            recommendations.append("🔴 Fort taux de duplication détecté - Considérer une refactorisation")
            
        if duplicated_contents > 50:
            recommendations.append("⚠️ Nombreuses fonctions dupliquées - Créer des utilitaires communs")
            
        if efficiency > 95:
            recommendations.append("✅ Excellent taux de déduplication - Système optimisé")
            
        recommendations.append(f"📊 Efficacité actuelle: {efficiency:.1f}%")
        
        return recommendations


def main():
    """Test du système de déduplication"""
    dedup = IntelligentDeduplicator("/home/gontrand/AutoWeave")
    
    # Générer un rapport
    report = dedup.get_duplication_report()
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()