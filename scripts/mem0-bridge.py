#!/usr/bin/env python3
"""
mem0-bridge.py - Bridge Python pour mem0 self-hosted
Interface entre Node.js et mem0 pour AutoWeave
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from mem0 import Memory

# Configuration logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Mem0Bridge:
    """Bridge pour mem0 self-hosted avec configuration Qdrant + Memgraph"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.memory = None
        self.initialized = False
        
        # Configuration mem0 pour self-hosted
        self.mem0_config = {
            "embedder": {
                "provider": "openai",
                "config": {
                    "model": "text-embedding-3-large",
                    "embedding_dims": 1536,
                    "api_key": os.getenv('OPENAI_API_KEY')
                }
            },
            "vector_store": {
                "provider": "qdrant",
                "config": {
                    "collection_name": config.get('qdrant_collection', 'autoweave'),
                    "host": config.get('qdrant_host', os.getenv('QDRANT_HOST', 'localhost')),
                    "port": int(config.get('qdrant_port', os.getenv('QDRANT_PORT', '6333'))),
                    "api_key": config.get('qdrant_api_key')
                }
            },
            # Note: Graph store désactivé temporairement car Memgraph a des problèmes
            # "graph_store": {
            #     "provider": "memgraph",
            #     "config": {
            #         "url": f"bolt://{config.get('memgraph_host', 'localhost')}:{config.get('memgraph_port', 7687)}",
            #         "username": config.get('memgraph_user', 'memgraph'),
            #         "password": config.get('memgraph_password', 'memgraph')
            #     }
            # }
        }
        
        # Initialiser mem0
        self._initialize_memory()
    
    def _initialize_memory(self):
        """Initialiser la mémoire mem0"""
        try:
            logger.info("Initializing mem0 with self-hosted configuration...")
            
            # Vérifier que OpenAI API key est disponible
            openai_key = os.getenv('OPENAI_API_KEY')
            if not openai_key:
                raise ValueError("OPENAI_API_KEY environment variable is required")
            
            # Définir la clé API pour OpenAI
            os.environ['OPENAI_API_KEY'] = openai_key
            
            # Vérifier la connectivité Qdrant (désactivé temporairement pour les tests)
            # Dans un environnement Kubernetes, le service n'est pas accessible directement
            if os.getenv('SKIP_CONNECTIVITY_CHECK') != 'true':
                try:
                    import requests
                    qdrant_url = f"http://{self.config.get('qdrant_host', os.getenv('QDRANT_HOST', 'localhost'))}:{self.config.get('qdrant_port', os.getenv('QDRANT_PORT', '6333'))}"
                    response = requests.get(f"{qdrant_url}/collections", timeout=10)
                    logger.info(f"Qdrant connectivity check: {response.status_code}")
                except Exception as e:
                    logger.warning(f"Qdrant connectivity check failed: {e}")
            
            # Créer instance Memory avec configuration
            logger.info(f"mem0 config: {self.mem0_config}")
            self.memory = Memory.from_config(self.mem0_config)
            self.initialized = True
            logger.info("mem0 initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize mem0: {e}")
            logger.error(f"Config was: {self.mem0_config}")
            self.initialized = False
            # Ne pas lever l'exception pour permettre l'initialisation partielle
            # raise
    
    def add_memory(self, messages: List[Dict], user_id: str, metadata: Optional[Dict] = None) -> Dict:
        """Ajouter une mémoire"""
        if not self.initialized:
            raise RuntimeError("mem0 not initialized")
        
        try:
            logger.info(f"Adding memory for user {user_id}")
            
            # Ajouter métadonnées par défaut
            if metadata is None:
                metadata = {}
            
            metadata.update({
                "timestamp": datetime.now().isoformat(),
                "source": "autoweave",
                "user_id": user_id
            })
            
            # Ajouter la mémoire
            result = self.memory.add(messages, user_id=user_id, metadata=metadata)
            
            logger.info(f"Memory added successfully: {result}")
            return {"success": True, "result": result}
            
        except Exception as e:
            logger.error(f"Failed to add memory: {e}")
            return {"success": False, "error": str(e)}
    
    def search_memory(self, query: str, user_id: str, limit: int = 10) -> Dict:
        """Rechercher dans la mémoire"""
        if not self.initialized:
            raise RuntimeError("mem0 not initialized")
        
        try:
            logger.info(f"Searching memory for user {user_id} with query: {query}")
            
            # Rechercher
            results = self.memory.search(query, user_id=user_id, limit=limit)
            
            logger.info(f"Found {len(results)} memories")
            return {"success": True, "results": results}
            
        except Exception as e:
            logger.error(f"Failed to search memory: {e}")
            return {"success": False, "error": str(e)}
    
    def get_all_memories(self, user_id: str) -> Dict:
        """Récupérer toutes les mémoires d'un utilisateur"""
        if not self.initialized:
            raise RuntimeError("mem0 not initialized")
        
        try:
            logger.info(f"Getting all memories for user {user_id}")
            
            # Récupérer toutes les mémoires
            results = self.memory.get_all(user_id=user_id)
            
            logger.info(f"Retrieved {len(results)} memories")
            return {"success": True, "results": results}
            
        except Exception as e:
            logger.error(f"Failed to get all memories: {e}")
            return {"success": False, "error": str(e)}
    
    def update_memory(self, memory_id: str, data: Dict) -> Dict:
        """Mettre à jour une mémoire"""
        if not self.initialized:
            raise RuntimeError("mem0 not initialized")
        
        try:
            logger.info(f"Updating memory {memory_id}")
            
            # Mettre à jour
            result = self.memory.update(memory_id, data)
            
            logger.info(f"Memory updated successfully: {result}")
            return {"success": True, "result": result}
            
        except Exception as e:
            logger.error(f"Failed to update memory: {e}")
            return {"success": False, "error": str(e)}
    
    def delete_memory(self, memory_id: str) -> Dict:
        """Supprimer une mémoire"""
        if not self.initialized:
            raise RuntimeError("mem0 not initialized")
        
        try:
            logger.info(f"Deleting memory {memory_id}")
            
            # Supprimer
            result = self.memory.delete(memory_id)
            
            logger.info(f"Memory deleted successfully: {result}")
            return {"success": True, "result": result}
            
        except Exception as e:
            logger.error(f"Failed to delete memory: {e}")
            return {"success": False, "error": str(e)}
    
    def health_check(self) -> Dict:
        """Vérifier la santé du système"""
        try:
            status = {
                "initialized": self.initialized,
                "timestamp": datetime.now().isoformat(),
                "config": {
                    "vector_store": "qdrant",
                    "graph_store": "memgraph",
                    "embedder": "openai"
                }
            }
            
            if self.initialized:
                # Test simple de fonctionnement
                test_result = self.memory.search("test", user_id="health_check", limit=1)
                status["functional"] = True
                status["test_result"] = f"Search test successful: {len(test_result)} results"
            else:
                status["functional"] = False
                status["test_result"] = "mem0 not initialized"
            
            return {"success": True, "status": status}
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {"success": False, "error": str(e)}

def main():
    """Point d'entrée principal"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing command"}))
        sys.exit(1)
    
    # Lire la configuration depuis les variables d'environnement
    config = {
        "qdrant_host": os.getenv('QDRANT_HOST', 'localhost'),
        "qdrant_port": int(os.getenv('QDRANT_PORT', '6333')),
        "qdrant_collection": os.getenv('QDRANT_COLLECTION', 'autoweave'),
        "qdrant_api_key": os.getenv('QDRANT_API_KEY'),
        "memgraph_host": os.getenv('MEMGRAPH_HOST', 'localhost'),
        "memgraph_port": int(os.getenv('MEMGRAPH_PORT', '7687')),
        "memgraph_user": os.getenv('MEMGRAPH_USER', 'memgraph'),
        "memgraph_password": os.getenv('MEMGRAPH_PASSWORD', 'memgraph')
    }
    
    # Créer le bridge
    try:
        bridge = Mem0Bridge(config)
    except Exception as e:
        print(json.dumps({"error": f"Failed to initialize bridge: {e}"}))
        sys.exit(1)
    
    # Traiter la commande
    command = sys.argv[1]
    
    try:
        if command == "add":
            if len(sys.argv) < 5:
                raise ValueError("Usage: add <user_id> <message> <metadata_json>")
            
            user_id = sys.argv[2]
            message = sys.argv[3]
            metadata = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
            
            messages = [{"role": "user", "content": message}]
            result = bridge.add_memory(messages, user_id, metadata)
            print(json.dumps(result))
            
        elif command == "search":
            if len(sys.argv) < 4:
                raise ValueError("Usage: search <user_id> <query> [limit]")
            
            user_id = sys.argv[2]
            query = sys.argv[3]
            limit = int(sys.argv[4]) if len(sys.argv) > 4 else 10
            
            result = bridge.search_memory(query, user_id, limit)
            print(json.dumps(result))
            
        elif command == "get_all":
            if len(sys.argv) < 3:
                raise ValueError("Usage: get_all <user_id>")
            
            user_id = sys.argv[2]
            result = bridge.get_all_memories(user_id)
            print(json.dumps(result))
            
        elif command == "update":
            if len(sys.argv) < 4:
                raise ValueError("Usage: update <memory_id> <data_json>")
            
            memory_id = sys.argv[2]
            data = json.loads(sys.argv[3])
            result = bridge.update_memory(memory_id, data)
            print(json.dumps(result))
            
        elif command == "delete":
            if len(sys.argv) < 3:
                raise ValueError("Usage: delete <memory_id>")
            
            memory_id = sys.argv[2]
            result = bridge.delete_memory(memory_id)
            print(json.dumps(result))
            
        elif command == "health":
            result = bridge.health_check()
            print(json.dumps(result))
            
        else:
            raise ValueError(f"Unknown command: {command}")
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()