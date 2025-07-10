# AutoWeave Dependency Audit Report

## Summary
This report identifies missing dependencies and optional imports in the AutoWeave `.claude` directory that might fail or fall back to mocks.

## Missing Python Dependencies

### 1. **neo4j** (Graph Database Driver)
- **File**: `/home/gontrand/AutoWeave/.claude/utils/db_utils.py`
- **Line**: 59
- **Usage**: Used for Memgraph database connections
- **Behavior**: Falls back to mock if import fails
- **Install**: `pip install neo4j`

### 2. **redis** (Cache Backend)
- **File**: `/home/gontrand/AutoWeave/.claude/utils/cache_manager.py`
- **Usage**: Optional caching backend
- **Behavior**: Sets `REDIS_AVAILABLE = False` if not installed
- **Install**: `pip install redis`

### 3. **openai** (AI API Client)
- **File**: `/home/gontrand/AutoWeave/.claude/utils/embeddings.py`
- **Usage**: For generating embeddings in production mode
- **Behavior**: Sets `OPENAI_AVAILABLE = False` if not installed
- **Install**: `pip install openai`

### 4. **qdrant-client** (Vector Database)
- **File**: `/home/gontrand/AutoWeave/.claude/utils/db_utils.py`
- **Line**: 19
- **Usage**: For vector search functionality
- **Behavior**: Falls back to mock in non-production mode
- **Install**: `pip install qdrant-client`

## Optional Import Patterns Found

### Try/Except Import Blocks
The codebase uses a consistent pattern for optional dependencies:

```python
try:
    import module_name
    MODULE_AVAILABLE = True
except ImportError:
    MODULE_AVAILABLE = False
```

### Mock Fallback Pattern
For database connections, the code falls back to `unittest.mock.MagicMock` when the actual client is unavailable:

```python
try:
    from qdrant_client import QdrantClient
    # ... connection logic
except Exception as e:
    logger.warning(f"Failed to connect: {e}, using mock")
    from unittest.mock import MagicMock
    return MagicMock()
```

## Recommendations

### 1. Create a Requirements File
Create `/home/gontrand/AutoWeave/.claude/requirements.txt`:
```txt
# Core dependencies
neo4j>=5.0.0
redis>=4.0.0
openai>=1.0.0
qdrant-client>=1.0.0

# Other dependencies used in the code
pytest>=7.0.0
python-dotenv>=0.19.0
```

### 2. Optional Dependencies Documentation
Create `/home/gontrand/AutoWeave/.claude/requirements-optional.txt`:
```txt
# Optional dependencies for full functionality
neo4j>=5.0.0  # For Memgraph graph database support
redis>=4.0.0  # For production caching
openai>=1.0.0  # For AI-powered embeddings
```

### 3. Environment Variables
The following environment variables are used for database connections:
- `QDRANT_API_KEY` - Qdrant authentication
- `QDRANT_HOST` (default: localhost)
- `QDRANT_PORT` (default: 6333)
- `MEMGRAPH_HOST` (default: localhost)
- `MEMGRAPH_PORT` (default: 7687)

### 4. Installation Commands
To install all optional dependencies:
```bash
pip install neo4j redis openai qdrant-client
```

## Impact Analysis

1. **Development Mode**: The system will work with mock implementations
2. **Production Mode**: Missing dependencies will cause failures for:
   - Vector search (qdrant-client)
   - Graph queries (neo4j)
   - Caching (redis)
   - AI embeddings (openai)

## JavaScript Dependencies (package.json)
The main AutoWeave package.json includes all necessary dependencies and they appear to be properly specified. No missing JavaScript dependencies were found.