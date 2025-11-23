#!/usr/bin/env python3
"""
Vercel serverless function entry point for Flask app
"""

import sys
import os
from pathlib import Path

# Add parent directory to path to import app
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
sys.path.insert(0, str(parent_dir))

# Change to parent directory so relative paths work
os.chdir(str(parent_dir))

try:
    from app import app
    
    # Vercel expects a handler function that returns a response
    def handler(request):
        """Vercel WSGI handler for Flask"""
        try:
            # Get the WSGI environment and start_response callable
            environ = request.environ if hasattr(request, 'environ') else {}
            start_response = lambda status, headers: None
            
            # Call the Flask app
            response = app(environ, start_response)
            
            # Convert WSGI response to Vercel format
            if isinstance(response, list):
                body = b''.join(response).decode('utf-8')
            else:
                body = str(response)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'text/html'},
                'body': body
            }
        except Exception as e:
            import traceback
            error_msg = traceback.format_exc()
            print(f"Handler error: {error_msg}")
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'text/html'},
                'body': f'<h1>Server Error</h1><pre>{error_msg}</pre>'
            }
            
except Exception as e:
    import traceback
    error_msg = traceback.format_exc()
    print(f"Import error: {error_msg}")
    
    # Fallback handler if app import fails
    def handler(request):
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'text/html'},
            'body': f'<h1>Import Error</h1><pre>{error_msg}</pre>'
        }
