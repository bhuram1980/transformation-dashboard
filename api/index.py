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
    
    # Vercel expects a handler function
    def handler(request):
        """Vercel WSGI handler"""
        try:
            return app(request.environ, lambda status, headers: None)
        except Exception as e:
            import traceback
            traceback.print_exc()
            # Return a basic error response
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'text/html'},
                'body': f'<h1>Server Error</h1><p>{str(e)}</p>'
            }
except Exception as e:
    import traceback
    traceback.print_exc()
    # Fallback handler if app import fails
    def handler(request):
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'text/html'},
            'body': f'<h1>Import Error</h1><p>{str(e)}</p><pre>{traceback.format_exc()}</pre>'
        }
