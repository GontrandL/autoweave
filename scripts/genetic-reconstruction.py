#!/usr/bin/env python3
"""
Genetic Reconstruction System
============================
Reconstructs files from genetic database using stored genes
"""

import sys
import json
import sqlite3
import hashlib
import os
from pathlib import Path

class GeneticReconstruction:
    def __init__(self, db_path="genetic_database.sqlite"):
        """Initialize genetic reconstruction system"""
        self.project_root = Path(__file__).parent.parent
        self.db_path = self.project_root / db_path
        self.connection = None
        
    def connect_db(self):
        """Connect to genetic database"""
        try:
            self.connection = sqlite3.connect(str(self.db_path))
            self.connection.row_factory = sqlite3.Row
            return True
        except Exception as e:
            print(f"Failed to connect to genetic database: {e}", file=sys.stderr)
            return False
            
    def reconstruct_file(self, file_path, version="latest"):
        """Reconstruct file from genetic database"""
        if not self.connect_db():
            return {"success": False, "error": "Database connection failed"}
            
        try:
            cursor = self.connection.cursor()
            
            # Find all genes for this file
            if version == "latest":
                cursor.execute("""
                    SELECT * FROM genes 
                    WHERE file_path = ? 
                    ORDER BY created_at DESC
                """, (file_path,))
            else:
                cursor.execute("""
                    SELECT * FROM genes 
                    WHERE file_path = ? AND gene_id LIKE ?
                    ORDER BY created_at DESC
                """, (file_path, f"%{version}%"))
                
            genes = cursor.fetchall()
            
            if not genes:
                return {
                    "success": False,
                    "error": f"No genes found for file: {file_path}",
                    "file_path": file_path,
                    "version": version
                }
                
            # Reconstruct file content
            reconstructed_content = ""
            gene_count = 0
            
            for gene in genes:
                gene_data = json.loads(gene['content'])
                if gene_data.get('type') == 'function':
                    reconstructed_content += gene_data.get('code', '') + "\n\n"
                    gene_count += 1
                elif gene_data.get('type') == 'full_file':
                    reconstructed_content = gene_data.get('content', '')
                    gene_count = 1
                    break
                    
            return {
                "success": True,
                "file_path": file_path,
                "version": version,
                "reconstructed_content": reconstructed_content,
                "gene_count": gene_count,
                "genes_used": [gene['gene_id'] for gene in genes],
                "content_hash": hashlib.sha256(reconstructed_content.encode()).hexdigest()[:8]
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Reconstruction failed: {str(e)}",
                "file_path": file_path,
                "version": version
            }
        finally:
            if self.connection:
                self.connection.close()
                
    def list_available_files(self):
        """List all files available for reconstruction"""
        if not self.connect_db():
            return {"success": False, "error": "Database connection failed"}
            
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT file_path, COUNT(*) as gene_count, 
                       MAX(created_at) as last_update
                FROM genes 
                GROUP BY file_path
                ORDER BY last_update DESC
            """)
            
            files = []
            for row in cursor.fetchall():
                files.append({
                    "file_path": row['file_path'],
                    "gene_count": row['gene_count'],
                    "last_update": row['last_update']
                })
                
            return {
                "success": True,
                "available_files": files,
                "total_files": len(files)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to list files: {str(e)}"
            }
        finally:
            if self.connection:
                self.connection.close()
                
    def get_file_versions(self, file_path):
        """Get all versions of a specific file"""
        if not self.connect_db():
            return {"success": False, "error": "Database connection failed"}
            
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT gene_id, created_at, actor, 
                       json_extract(content, '$.type') as content_type,
                       substr(content_hash, 1, 8) as short_hash
                FROM genes 
                WHERE file_path = ?
                ORDER BY created_at DESC
            """, (file_path,))
            
            versions = []
            for row in cursor.fetchall():
                versions.append({
                    "gene_id": row['gene_id'],
                    "created_at": row['created_at'],
                    "actor": row['actor'],
                    "content_type": row['content_type'],
                    "short_hash": row['short_hash']
                })
                
            return {
                "success": True,
                "file_path": file_path,
                "versions": versions,
                "total_versions": len(versions)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to get versions: {str(e)}",
                "file_path": file_path
            }
        finally:
            if self.connection:
                self.connection.close()

def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: genetic-reconstruction.py <command> [args...]",
            "commands": {
                "reconstruct": "reconstruct <file_path> [version]",
                "list": "list",
                "versions": "versions <file_path>"
            }
        }))
        sys.exit(1)
        
    command = sys.argv[1]
    reconstruction = GeneticReconstruction()
    
    try:
        if command == "reconstruct":
            if len(sys.argv) < 3:
                result = {"error": "File path required for reconstruction"}
            else:
                file_path = sys.argv[2]
                version = sys.argv[3] if len(sys.argv) > 3 else "latest"
                result = reconstruction.reconstruct_file(file_path, version)
                
        elif command == "list":
            result = reconstruction.list_available_files()
            
        elif command == "versions":
            if len(sys.argv) < 3:
                result = {"error": "File path required for versions command"}
            else:
                file_path = sys.argv[2]
                result = reconstruction.get_file_versions(file_path)
                
        else:
            result = {"error": f"Unknown command: {command}"}
            
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Genetic reconstruction failed: {str(e)}",
            "command": command
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()