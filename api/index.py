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

# Print debug info
print(f"api/index.py: current_dir = {current_dir}")
print(f"api/index.py: parent_dir = {parent_dir}")
print(f"api/index.py: cwd = {os.getcwd()}")
print(f"api/index.py: VERCEL env = {os.getenv('VERCEL')}")
print(f"api/index.py: LAMBDA_TASK_ROOT = {os.getenv('LAMBDA_TASK_ROOT')}")
print(f"api/index.py: public/data exists = {(parent_dir / 'public' / 'data').exists()}")
print(f"api/index.py: Listing parent_dir contents:")
try:
    for item in parent_dir.iterdir():
        print(f"  - {item.name} ({'dir' if item.is_dir() else 'file'})")
except Exception as e:
    print(f"  Error listing: {e}")

try:
    from app import app
    print("Successfully imported app")
    
    # Use vercel-python-wsgi adapter for proper Flask handling on Vercel
    try:
        from vercel_wsgi import VercelApp
        application = VercelApp(app)
        print("Using vercel-python-wsgi adapter")
    except ImportError:
        # Fallback: @vercel/python should handle Flask automatically
        print("vercel-python-wsgi not available, using direct Flask app")
        application = app
except Exception as e:
    print(f"Error importing app: {e}")
    import traceback
    traceback.print_exc()
    # Create a minimal error handler app instead of crashing
    from flask import Flask, jsonify
    app = Flask(__name__)
    @app.route('/<path:path>')
    @app.route('/')
    def error_handler(path=''):
        return jsonify({'error': f'App import failed: {str(e)}', 'path': path}), 500
    try:
        from vercel_wsgi import VercelApp
        application = VercelApp(app)
    except ImportError:
        application = app

# Vercel expects a handler function
# Export the WSGI application
handler = application
