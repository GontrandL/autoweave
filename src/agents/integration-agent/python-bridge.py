#!/usr/bin/env python3
"""
Python Bridge for Integration Agent Module
Provides OpenAPI parsing and Pydantic model generation capabilities
"""

import json
import sys
import os
import argparse
from typing import Dict, Any, Optional, List
from pathlib import Path

# Add the parent directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from openapi_core import OpenAPI
    from openapi_core.validation.exceptions import ValidationError
    from datamodel_code_generator import InputFileType, generate
    import tempfile
    import yaml
    import requests
    from urllib.parse import urlparse
    import logging
except ImportError as e:
    print(f"ImportError: {e}", file=sys.stderr)
    print("Please install required dependencies:", file=sys.stderr)
    print("pip install openapi-core pydantic datamodel-code-generator", file=sys.stderr)
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class OpenAPIBridge:
    """Bridge class for OpenAPI operations"""
    
    def __init__(self):
        self.openapi_spec = None
        self.spec_url = None
        
    def parse_specification(self, spec_url: str) -> Dict[str, Any]:
        """Parse OpenAPI specification from URL"""
        try:
            logger.info(f"Parsing OpenAPI specification from: {spec_url}")
            
            # Fetch the specification
            response = requests.get(spec_url, timeout=30)
            response.raise_for_status()
            
            # Parse JSON or YAML
            content_type = response.headers.get('content-type', '')
            if 'application/json' in content_type:
                spec_data = response.json()
            else:
                # Try YAML parsing
                spec_data = yaml.safe_load(response.text)
            
            # Create OpenAPI object for validation
            self.openapi_spec = OpenAPI.from_dict(spec_data)
            self.spec_url = spec_url
            
            # Extract metadata
            metadata = self._extract_metadata(spec_data)
            
            result = {
                'success': True,
                'spec': spec_data,
                'metadata': metadata,
                'validation': {
                    'valid': True,
                    'errors': []
                }
            }
            
            logger.info(f"Successfully parsed OpenAPI specification: {metadata['title']}")
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch OpenAPI spec: {e}")
            return {
                'success': False,
                'error': f'Failed to fetch specification: {str(e)}',
                'spec': None,
                'metadata': None
            }
        except ValidationError as e:
            logger.error(f"OpenAPI validation error: {e}")
            return {
                'success': False,
                'error': f'OpenAPI validation failed: {str(e)}',
                'spec': None,
                'metadata': None
            }
        except Exception as e:
            logger.error(f"Unexpected error parsing OpenAPI spec: {e}")
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}',
                'spec': None,
                'metadata': None
            }
    
    def _extract_metadata(self, spec_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metadata from OpenAPI specification"""
        info = spec_data.get('info', {})
        paths = spec_data.get('paths', {})
        
        # Count endpoints and methods
        endpoint_count = len(paths)
        method_count = sum(len(methods) for methods in paths.values())
        
        # Analyze complexity
        complexity = self._analyze_complexity(spec_data)
        
        # Extract components
        components = spec_data.get('components', {})
        schemas = components.get('schemas', {})
        
        return {
            'title': info.get('title', 'Unknown API'),
            'version': info.get('version', '1.0.0'),
            'description': info.get('description', ''),
            'endpoints': endpoint_count,
            'methods': method_count,
            'schemas': len(schemas),
            'complexity': complexity,
            'openapi_version': spec_data.get('openapi', spec_data.get('swagger', '2.0'))
        }
    
    def _analyze_complexity(self, spec_data: Dict[str, Any]) -> str:
        """Analyze API complexity"""
        paths = spec_data.get('paths', {})
        components = spec_data.get('components', {})
        
        endpoint_count = len(paths)
        schema_count = len(components.get('schemas', {}))
        
        if endpoint_count <= 5 and schema_count <= 5:
            return 'simple'
        elif endpoint_count <= 20 and schema_count <= 20:
            return 'moderate'
        else:
            return 'complex'
    
    def generate_pydantic_models(self, spec_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Pydantic models from OpenAPI specification"""
        try:
            logger.info("Generating Pydantic models from OpenAPI specification")
            
            # Create temporary file for the OpenAPI spec
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
                json.dump(spec_data, temp_file, indent=2)
                temp_file_path = temp_file.name
            
            try:
                # Generate Pydantic models with simplified API
                models_code = generate(
                    input_=Path(temp_file_path),
                    input_file_type=InputFileType.OpenAPI,
                    output='pydantic_v2'  # Use string instead of enum
                )
                
                # Analyze generated models
                models_info = self._analyze_models(models_code)
                
                result = {
                    'success': True,
                    'models_code': models_code,
                    'models_info': models_info,
                    'file_path': temp_file_path
                }
                
                logger.info(f"Successfully generated {len(models_info.get('models', []))} Pydantic models")
                return result
                
            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_file_path)
                except OSError:
                    pass
                    
        except Exception as e:
            logger.error(f"Failed to generate Pydantic models: {e}")
            return {
                'success': False,
                'error': f'Failed to generate models: {str(e)}',
                'models_code': None,
                'models_info': None
            }
    
    def _analyze_models(self, models_code: str) -> Dict[str, Any]:
        """Analyze generated Pydantic models"""
        lines = models_code.split('\n')
        models = []
        
        for line in lines:
            if line.strip().startswith('class ') and 'BaseModel' in line:
                class_name = line.split('class ')[1].split('(')[0].strip()
                models.append({
                    'name': class_name,
                    'type': 'model'
                })
        
        return {
            'models': models,
            'total_models': len(models),
            'lines_of_code': len(lines)
        }
    
    def validate_openapi_spec(self, spec_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate OpenAPI specification"""
        try:
            logger.info("Validating OpenAPI specification")
            
            # Create OpenAPI object for validation
            openapi_obj = OpenAPI.from_dict(spec_data)
            
            return {
                'success': True,
                'valid': True,
                'errors': [],
                'warnings': []
            }
            
        except ValidationError as e:
            logger.error(f"OpenAPI validation failed: {e}")
            return {
                'success': False,
                'valid': False,
                'errors': [str(e)],
                'warnings': []
            }
        except Exception as e:
            logger.error(f"Unexpected validation error: {e}")
            return {
                'success': False,
                'valid': False,
                'errors': [f'Unexpected error: {str(e)}'],
                'warnings': []
            }

def main():
    """Main function for CLI usage"""
    parser = argparse.ArgumentParser(description='OpenAPI Bridge for Integration Agent')
    parser.add_argument('command', choices=['parse', 'generate', 'validate', 'health'], 
                       help='Command to execute')
    parser.add_argument('--spec-url', help='OpenAPI specification URL')
    parser.add_argument('--spec-file', help='OpenAPI specification file path')
    parser.add_argument('--output', help='Output file path')
    
    args = parser.parse_args()
    
    bridge = OpenAPIBridge()
    
    if args.command == 'health':
        print(json.dumps({
            'status': 'healthy',
            'python_version': sys.version,
            'dependencies': {
                'openapi-core': True,
                'pydantic': True,
                'datamodel-code-generator': True
            }
        }, indent=2))
        return
    
    if args.command == 'parse':
        if not args.spec_url:
            print(json.dumps({'error': 'spec-url is required for parse command'}))
            sys.exit(1)
        
        result = bridge.parse_specification(args.spec_url)
        print(json.dumps(result, indent=2))
        
    elif args.command == 'generate':
        if not args.spec_file:
            print(json.dumps({'error': 'spec-file is required for generate command'}))
            sys.exit(1)
        
        try:
            with open(args.spec_file, 'r') as f:
                spec_data = json.load(f)
            
            result = bridge.generate_pydantic_models(spec_data)
            
            if args.output and result.get('success'):
                with open(args.output, 'w') as f:
                    f.write(result['models_code'])
                result['output_file'] = args.output
            
            print(json.dumps(result, indent=2))
            
        except Exception as e:
            print(json.dumps({'error': f'Failed to read spec file: {str(e)}'}))
            sys.exit(1)
            
    elif args.command == 'validate':
        if not args.spec_file:
            print(json.dumps({'error': 'spec-file is required for validate command'}))
            sys.exit(1)
        
        try:
            with open(args.spec_file, 'r') as f:
                spec_data = json.load(f)
            
            result = bridge.validate_openapi_spec(spec_data)
            print(json.dumps(result, indent=2))
            
        except Exception as e:
            print(json.dumps({'error': f'Failed to read spec file: {str(e)}'}))
            sys.exit(1)

if __name__ == '__main__':
    main()