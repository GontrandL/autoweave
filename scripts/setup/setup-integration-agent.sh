#!/bin/bash

# AutoWeave Integration Agent Setup Script
# Sets up Python environment and dependencies for the Integration Agent

set -e

echo "🔧 Setting up Integration Agent Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INTEGRATION_AGENT_DIR="$PROJECT_ROOT/src/agents/integration-agent"
PYTHON_ENV_DIR="$PROJECT_ROOT/integration-agent-env"

echo "ℹ️  Project root: $PROJECT_ROOT"

# Check if Python 3.8+ is available
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
        echo "✅ Python $PYTHON_VERSION found"
        
        # Check if version is >= 3.8
        if python3 -c 'import sys; exit(0 if sys.version_info >= (3, 8) else 1)'; then
            echo "✅ Python version is compatible (>= 3.8)"
            PYTHON_CMD="python3"
        else
            echo -e "${RED}❌ Python 3.8+ required, found $PYTHON_VERSION${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Python 3 not found${NC}"
        exit 1
    fi
}

# Create Python virtual environment
setup_python_env() {
    echo "🐍 Setting up Python virtual environment..."
    
    if [ -d "$PYTHON_ENV_DIR" ]; then
        echo -e "${YELLOW}⚠️  Virtual environment already exists, removing...${NC}"
        rm -rf "$PYTHON_ENV_DIR"
    fi
    
    $PYTHON_CMD -m venv "$PYTHON_ENV_DIR"
    source "$PYTHON_ENV_DIR/bin/activate"
    
    # Upgrade pip
    pip install --upgrade pip
    
    echo "✅ Virtual environment created at $PYTHON_ENV_DIR"
}

# Install Python dependencies
install_python_deps() {
    echo "📦 Installing Python dependencies..."
    
    # Make sure we're in the virtual environment
    source "$PYTHON_ENV_DIR/bin/activate"
    
    # Install core dependencies
    pip install \
        openapi-core==0.19.5 \
        pydantic==2.8.2 \
        datamodel-code-generator==0.25.6 \
        kubernetes==30.1.0 \
        jinja2==3.1.4 \
        kopf==1.37.2 \
        langchain==0.2.14 \
        gitpython==3.1.43 \
        prometheus-client==0.20.0 \
        pyyaml==6.0.1 \
        requests==2.31.0 \
        click==8.1.7
    
    echo "✅ Python dependencies installed"
}

# Install CLI tools
install_cli_tools() {
    echo "🔧 Installing CLI tools..."
    
    # Check if kubeconform is available
    if ! command -v kubeconform &> /dev/null; then
        echo "📥 Installing kubeconform..."
        
        # Detect OS
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            KUBECONFORM_URL="https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz"
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            if command -v brew &> /dev/null; then
                brew install kubeconform
                echo "✅ kubeconform installed via Homebrew"
            else
                KUBECONFORM_URL="https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-darwin-amd64.tar.gz"
            fi
        else
            echo -e "${YELLOW}⚠️  Manual installation required for kubeconform${NC}"
        fi
        
        if [ ! -z "$KUBECONFORM_URL" ]; then
            # Download and install kubeconform
            TEMP_DIR=$(mktemp -d)
            cd "$TEMP_DIR"
            curl -L "$KUBECONFORM_URL" | tar -xzf -
            sudo mv kubeconform /usr/local/bin/
            cd - > /dev/null
            rm -rf "$TEMP_DIR"
            echo "✅ kubeconform installed"
        fi
    else
        echo "✅ kubeconform already installed"
    fi
    
    # Check if conftest is available
    if ! command -v conftest &> /dev/null; then
        echo "📥 Installing conftest..."
        
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            CONFTEST_URL="https://github.com/open-policy-agent/conftest/releases/latest/download/conftest_Linux_x86_64.tar.gz"
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            if command -v brew &> /dev/null; then
                brew install conftest
                echo "✅ conftest installed via Homebrew"
            else
                CONFTEST_URL="https://github.com/open-policy-agent/conftest/releases/latest/download/conftest_Darwin_x86_64.tar.gz"
            fi
        else
            echo -e "${YELLOW}⚠️  Manual installation required for conftest${NC}"
        fi
        
        if [ ! -z "$CONFTEST_URL" ]; then
            # Download and install conftest
            TEMP_DIR=$(mktemp -d)
            cd "$TEMP_DIR"
            curl -L "$CONFTEST_URL" | tar -xzf -
            sudo mv conftest /usr/local/bin/
            cd - > /dev/null
            rm -rf "$TEMP_DIR"
            echo "✅ conftest installed"
        fi
    else
        echo "✅ conftest already installed"
    fi
}

# Create Python bridge script
create_python_bridge() {
    echo "🔗 Creating Python bridge..."
    
    cat > "$INTEGRATION_AGENT_DIR/python-bridge.py" << 'EOF'
#!/usr/bin/env python3
"""
AutoWeave Integration Agent Python Bridge
Provides Python functionality for OpenAPI parsing and Pydantic model generation
"""

import sys
import json
import argparse
import traceback
from pathlib import Path
from typing import Dict, Any, Optional

# Add project root to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    from openapi_core import Spec
    from datamodel_code_generator import generate
    from datamodel_code_generator.model import DataModelType
    from datamodel_code_generator.parser.openapi import OpenAPIParser
    import yaml
    import requests
except ImportError as e:
    print(f"ERROR: Missing dependency: {e}", file=sys.stderr)
    sys.exit(1)

class OpenAPIProcessor:
    """Handles OpenAPI specification processing"""
    
    def __init__(self):
        self.spec = None
    
    def load_spec(self, spec_source: str) -> Dict[str, Any]:
        """Load OpenAPI specification from URL or file"""
        try:
            if spec_source.startswith(('http://', 'https://')):
                # Load from URL
                response = requests.get(spec_source)
                response.raise_for_status()
                spec_data = response.json()
            else:
                # Load from file
                with open(spec_source, 'r') as f:
                    if spec_source.endswith('.yaml') or spec_source.endswith('.yml'):
                        spec_data = yaml.safe_load(f)
                    else:
                        spec_data = json.load(f)
            
            # Validate with openapi-core
            self.spec = Spec.from_dict(spec_data)
            
            return spec_data
        except Exception as e:
            raise Exception(f"Failed to load OpenAPI spec: {e}")
    
    def generate_pydantic_models(self, spec_data: Dict[str, Any]) -> str:
        """Generate Pydantic models from OpenAPI specification"""
        try:
            # Create temporary spec file
            temp_spec = Path("/tmp/temp_spec.json")
            with open(temp_spec, 'w') as f:
                json.dump(spec_data, f, indent=2)
            
            # Generate models
            models_code = generate(
                input_=temp_spec,
                input_file_type="openapi",
                output_model_type=DataModelType.PydanticV2Model,
                field_constraints=True,
                snake_case_field=True,
                strip_default_none=True,
                use_double_quotes=True,
                use_schema_description=True,
                use_field_description=True,
                class_name="Model"
            )
            
            # Clean up
            temp_spec.unlink()
            
            return models_code
        except Exception as e:
            raise Exception(f"Failed to generate Pydantic models: {e}")

def main():
    parser = argparse.ArgumentParser(description="AutoWeave Integration Agent Python Bridge")
    parser.add_argument("command", choices=["parse", "generate", "validate"], help="Command to execute")
    parser.add_argument("--spec", required=True, help="OpenAPI specification URL or file path")
    parser.add_argument("--output", help="Output file path")
    
    args = parser.parse_args()
    
    try:
        processor = OpenAPIProcessor()
        
        if args.command == "parse":
            # Parse and validate OpenAPI spec
            spec_data = processor.load_spec(args.spec)
            result = {
                "success": True,
                "spec": spec_data,
                "info": {
                    "title": spec_data.get("info", {}).get("title", "Unknown"),
                    "version": spec_data.get("info", {}).get("version", "Unknown"),
                    "paths_count": len(spec_data.get("paths", {}))
                }
            }
            
        elif args.command == "generate":
            # Generate Pydantic models
            spec_data = processor.load_spec(args.spec)
            models_code = processor.generate_pydantic_models(spec_data)
            
            if args.output:
                with open(args.output, 'w') as f:
                    f.write(models_code)
            
            result = {
                "success": True,
                "models_code": models_code,
                "output_file": args.output
            }
            
        elif args.command == "validate":
            # Validate OpenAPI spec
            spec_data = processor.load_spec(args.spec)
            result = {
                "success": True,
                "valid": True,
                "spec_info": {
                    "title": spec_data.get("info", {}).get("title", "Unknown"),
                    "version": spec_data.get("info", {}).get("version", "Unknown"),
                    "openapi_version": spec_data.get("openapi", "Unknown")
                }
            }
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_result, indent=2), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
EOF
    
    chmod +x "$INTEGRATION_AGENT_DIR/python-bridge.py"
    echo "✅ Python bridge created"
}

# Create activation script
create_activation_script() {
    echo "📝 Creating activation script..."
    
    cat > "$PROJECT_ROOT/activate-integration-agent.sh" << EOF
#!/bin/bash
# AutoWeave Integration Agent Environment Activation Script

echo "🔧 Activating Integration Agent Environment..."

# Activate Python virtual environment
source "$PYTHON_ENV_DIR/bin/activate"

# Set environment variables
export AUTOWEAVE_INTEGRATION_AGENT_ENABLED=true
export AUTOWEAVE_PYTHON_BRIDGE="$INTEGRATION_AGENT_DIR/python-bridge.py"

echo "✅ Integration Agent environment activated"
echo "📍 Python environment: $PYTHON_ENV_DIR"
echo "🔗 Python bridge: \$AUTOWEAVE_PYTHON_BRIDGE"

# Show versions
echo ""
echo "🔍 Installed versions:"
python --version
pip show openapi-core pydantic datamodel-code-generator kubernetes | grep Version
EOF
    
    chmod +x "$PROJECT_ROOT/activate-integration-agent.sh"
    echo "✅ Activation script created at $PROJECT_ROOT/activate-integration-agent.sh"
}

# Verify installation
verify_installation() {
    echo "🔍 Verifying installation..."
    
    # Activate environment
    source "$PYTHON_ENV_DIR/bin/activate"
    
    # Test Python imports
    python3 -c "import openapi_core, pydantic, datamodel_code_generator, kubernetes; print('✅ All Python modules imported successfully')"
    
    # Test CLI tools
    kubeconform --version > /dev/null 2>&1 && echo "✅ kubeconform is working" || echo "⚠️  kubeconform not available"
    conftest --version > /dev/null 2>&1 && echo "✅ conftest is working" || echo "⚠️  conftest not available"
    
    # Test Python bridge
    python3 "$INTEGRATION_AGENT_DIR/python-bridge.py" --help > /dev/null 2>&1 && echo "✅ Python bridge is working" || echo "❌ Python bridge failed"
    
    echo "✅ Installation verification complete"
}

# Main execution
main() {
    echo "🚀 AutoWeave Integration Agent Setup"
    echo "======================================"
    
    check_python
    setup_python_env
    install_python_deps
    install_cli_tools
    create_python_bridge
    create_activation_script
    verify_installation
    
    echo ""
    echo -e "${GREEN}🎉 Integration Agent setup complete!${NC}"
    echo ""
    echo "To use the Integration Agent:"
    echo "  1. Run: source $PROJECT_ROOT/activate-integration-agent.sh"
    echo "  2. Start AutoWeave: npm start"
    echo "  3. Use the Integration Agent API or ChatUI"
    echo ""
    echo "Configuration files created:"
    echo "  - Python environment: $PYTHON_ENV_DIR"
    echo "  - Python bridge: $INTEGRATION_AGENT_DIR/python-bridge.py"
    echo "  - Activation script: $PROJECT_ROOT/activate-integration-agent.sh"
}

# Run main function
main "$@"